// src\ai.js
import { Neo4jGraph } from "@langchain/community/graphs/neo4j_graph";
import { ChatOllama, OllamaEmbeddings } from "@langchain/ollama";
import { Neo4jVectorStore } from "@langchain/community/vectorstores/neo4j_vector";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { RunnableSequence } from "@langchain/core/runnables";
import { getPresetQuery } from './utils/presetQueries.js';

import { readFile } from 'node:fs/promises'
import { isChartRequest, determineChartType, formatChartData } from './utils/chartUtils.js';
const promptsFolder = './prompts'
const promptsFiles = {
    nlpToCypher: `${promptsFolder}/nlpToCypher.md`,
    responseTemplateFromJson: `${promptsFolder}/responseTemplateFromJson.md`,
    context: `${promptsFolder}/context.md`,
    chartQueryGenerator: `${promptsFolder}/chartQueryGenerator.md`,
}

// ✅ Load Neo4j Credentials
const config = {
    url: process.env.NEO4J_URI,
    username: process.env.NEO4J_USER,
    password: process.env.NEO4J_PASSWORD,
    indexName: "restaurant_agent_index", // Changed index name to restaurant specific
    searchType: "vector",
    textNodeProperties: ["question"],
    nodeLabel: "Chunk",
};

// ✅ Initialize Models
const coderModel = new ChatOllama({
    temperature: 0,
    maxRetries: 2,
    model: process.env.CODER_MODEL,
    baseURL: process.env.OLLAMA_BASE_URL,
});

const nlpModel = new ChatOllama({
    temperature: 0,
    maxRetries: 2,
    model: process.env.NLP_MODEL,
    baseURL: process.env.OLLAMA_BASE_URL,
});

const ollamaEmbeddings = new OllamaEmbeddings({
    model: "nomic-embed-text",
    baseUrl: process.env.OLLAMA_BASE_URL,
});


export async function prompt(question, debugLog = () => { }) {

    // ✅ Initialize Neo4j Graph Connection
    const graph = await Neo4jGraph.initialize({
        url: config.url,
        username: config.username,
        password: config.password,
        enhancedSchema: false,
    });

    const vectorIndex = await Neo4jVectorStore.fromExistingGraph(ollamaEmbeddings, config);
    
    // Check if this is a chart request
    const isChartReq = isChartRequest(question);
    debugLog(isChartReq ? "📊 Chart request detected!" : "💬 Regular query detected");
    
    // ✅ LangChain Pipeline
    const chain = RunnableSequence.from([
        retrieveVectorSearchResults,
        generateQueryIfNoCached,
        validateAndExecuteQuery,
        generateNLPResponse,
        cacheResult,
        parseTemplateToData,
    ]);

    // Add request type to the input
    const result = await chain.invoke({ 
        question,
        isChartRequest: isChartReq
    });
    
    debugLog("\n🎙️ Question:")
    debugLog("\n", question, "\n");
    debugLog(result.answer || result.error);

    await vectorIndex.close()
    await graph.close()

    return result;

    async function retrieveVectorSearchResults(input) {
        debugLog("🔍 Searching Neo4j vector store...");
        const vectorResults = await vectorIndex.similaritySearchWithScore(input.question, 1);
        const results = vectorResults?.at(0);
        const score = results?.at(1);

        if (results?.length && score > process.env.NEO4J_VECTOR_THRESHOLD) {
            debugLog(`✅ Vector match found! - score: ${score}`);
            return {
                ...input,
                cached: true,
                answerTemplate: results[0].metadata.answerTemplate,
                query: results[0].metadata.query
            };
        }

        debugLog("⚠️ No vector match found, generating Cypher query...");
        return {
            ...input,
            cached: false,
        };
    }

    async function generateQueryIfNoCached(input) {
        if (input.cached) return input; // Skip if we already have a cached answer

        const schema = await graph.getSchema();
        const context = await readFile(promptsFiles.context, 'utf-8');
        
        // Choose the appropriate prompt template based on request type
        let promptTemplate;
        if (input.isChartRequest) {
            debugLog("🎭 Using chart-specific query generator");
            promptTemplate = await readFile(promptsFiles.chartQueryGenerator, 'utf-8');
        } else {
            promptTemplate = await readFile(promptsFiles.nlpToCypher, 'utf-8');
        }
        
        const queryPrompt = ChatPromptTemplate.fromTemplate(promptTemplate);
        const queryChain = queryPrompt.pipe(coderModel).pipe(new StringOutputParser());
        
        const query = (await queryChain.invoke({
            question: input.question,
            schema,
            context
        }));

        return { ...input, query };
    }

    async function validateAndExecuteQuery(input) {
        if (input.cached) {
            const dbResults = await graph.query(input.query);
            if (!dbResults || dbResults.length === 0) {
                debugLog("⚠️ No meaningful results from Neo4j.");
                return { error: "No results found." };
            }
    
            return { ...input, dbResults };
        }
    
        debugLog("🤖 AI Generated Cypher Query:\n", input.query);
        
        // Try direct execution without validation first
        try {
            const dbResults = await graph.query(input.query);
            if (!dbResults || dbResults.length === 0) {
                debugLog("⚠️ No meaningful results from Neo4j.");
                return { error: "No results found." };
            }
            return { ...input, dbResults };
        } catch (error) {
            debugLog("❌ Error executing query:", error.message);
            
            // Try to clean up the query - remove backticks, "cypher" text, etc.
            let extractedQuery = input.query
                .replace(/```cypher|```/g, '') // Remove code block markers
                .replace(/^cypher\s+/i, '')    // Remove leading "cypher" word
                .trim();
            
            // Try to extract just the Cypher query if there's surrounding text
            const cypherMatch = extractedQuery.match(/(MATCH|RETURN|CREATE|MERGE|WITH|CALL|UNWIND)[\s\S]+?;/i);
            if (cypherMatch) {
                extractedQuery = cypherMatch[0];
            }
            
            debugLog("🔄 Attempting to execute extracted query:", extractedQuery);
            
            try {
                const dbResults = await graph.query(extractedQuery);
                if (!dbResults || dbResults.length === 0) {
                    debugLog("⚠️ No meaningful results from extracted query.");
                    return { error: "No results found." };
                }
                // Update the input query with the extracted one that worked
                return { ...input, query: extractedQuery, dbResults };
            } catch (secondError) {
                debugLog("❌ Extracted query also failed:", secondError.message);
                
                // For chart requests, try using preset queries as a fallback
                if (input.isChartRequest) {
                    debugLog("🔍 Trying preset query for chart request...");
                    const presetQuery = getPresetQuery(input.question);
                    
                    if (presetQuery) {
                        debugLog("✅ Found matching preset query:", presetQuery);
                        
                        try {
                            const dbResults = await graph.query(presetQuery);
                            if (dbResults && dbResults.length > 0) {
                                debugLog("✅ Preset query executed successfully");
                                return { ...input, query: presetQuery, dbResults };
                            }
                        } catch (presetError) {
                            debugLog("❌ Preset query failed:", presetError.message);
                        }
                    }
                }
                
                return { error: "I couldn't generate a valid query for your question." };
            }
        }
    }

    async function generateNLPResponse(input) {
        if (input.cached) return input; // Skip if cached
        if (input.error) return input; // Handle errors
        
        // Check for empty or small result sets FIRST, before preparing the response chain
        if (!input.dbResults || input.dbResults.length === 0 || 
            JSON.stringify(input.dbResults[0]).length < 10) {
            return { 
                ...input, 
                answerTemplate: "I don't have enough information to answer that question based on our restaurant database."
            };
        }
        
        // Only proceed with template loading and chain setup if we have valid results
        const responseTemplatePrompt = await readFile(promptsFiles.responseTemplateFromJson, 'utf-8')
        const responsePrompt = ChatPromptTemplate.fromTemplate(responseTemplatePrompt);
        const responseChain = responsePrompt.pipe(nlpModel).pipe(new StringOutputParser());
    
        // ✅ Ensure structuredResponse is formatted as a string
        const aiResponse = await responseChain.invoke({
            question: input.question,
            structuredResponse: JSON.stringify(input.dbResults[0]) // Fix: Ensure JSON data is properly formatted
        });
    
        return { ...input, answerTemplate: aiResponse };
    }

    function parseTemplateToData(input) {
        if (input.error) return input;
        if (!input.dbResults.length) {
            return {
                ...input,
                answer: "I'm sorry, but I couldn't find any relevant information in our restaurant database."
            };
        }
        
        // Handle chart requests
        if (input.isChartRequest) {
            // Determine the appropriate chart type based on data and question
            const chartType = determineChartType(input.dbResults, input.question);
            debugLog(`📊 Generating ${chartType} chart data`);
            
            // Format data for chart visualization
            const chartData = formatChartData(input.dbResults, chartType, input.question);
            
            // Create a human-readable answer describing the chart
            let formattedResponse = `**${chartData.options.title}**\n\n`;
            
            // Add a brief description of what the chart shows
            if (chartType === 'pie' || chartType === 'doughnut') {
                const topItems = chartData.data.labels
                    .map((label, i) => ({ label, value: chartData.data.datasets[0].data[i] }))
                    .sort((a, b) => b.value - a.value)
                    .slice(0, 3);
                    
                formattedResponse += `The chart shows the distribution of ${chartData.options.title.toLowerCase()}. `;
                formattedResponse += `The top items are: ${topItems.map(item => `${item.label} (${item.value})`).join(', ')}.`;
            } else if (chartType === 'bar') {
                const topItems = chartData.data.labels
                    .map((label, i) => ({ label, value: chartData.data.datasets[0].data[i] }))
                    .sort((a, b) => b.value - a.value)
                    .slice(0, 3);
                    
                formattedResponse += `The chart compares ${chartData.options.title.toLowerCase()}. `;
                formattedResponse += `The highest values are: ${topItems.map(item => `${item.label} (${item.value})`).join(', ')}.`;
            } else if (chartType === 'line') {
                formattedResponse += `The chart shows the trend of ${chartData.options.title.toLowerCase()} over time. `;
                
                // Try to identify trend
                const data = chartData.data.datasets[0].data;
                const firstValue = data[0];
                const lastValue = data[data.length - 1];
                const trend = lastValue > firstValue ? "increasing" : lastValue < firstValue ? "decreasing" : "stable";
                
                formattedResponse += `The overall trend appears to be ${trend}.`;
            }
            
            return {
                ...input,
                answer: formattedResponse,
                chartData: chartData,
                jsonResponse: {
                    header: chartData.options.title,
                    results: input.dbResults
                }
            };
        }
        
        // Handle regular (non-chart) requests
        
        // 1. SPECIAL CASE: For "how many" questions that return multiple results
        if (input.question.toLowerCase().includes("how many") && input.dbResults.length > 0) {
            const entityType = Object.keys(input.dbResults[0])[0].replace("Name", "").trim();
            return {
                ...input,
                answer: `We have **${input.dbResults.length}** ${entityType}s in our database.`,
                jsonResponse: {
                    header: `${entityType} Count`,
                    count: input.dbResults.length,
                    results: input.dbResults
                }
            };
        }
        
        // 2. SPECIAL CASE: For single value results
        if (input.dbResults.length === 1 && Object.keys(input.dbResults[0]).length === 1) {
            const key = Object.keys(input.dbResults[0])[0];
            const value = input.dbResults[0][key];
            return {
                ...input,
                answer: `**${key}**: ${value}`,
                jsonResponse: { [key]: value }
            };
        }
        
        // 3. LIST CASE: For questions asking for a list of items
        if (
            (input.question.toLowerCase().includes("list") || 
            input.question.toLowerCase().includes("all") ||
            input.question.toLowerCase().includes("show me") ||
            input.question.toLowerCase().includes("what are")) &&
            input.dbResults.length > 0
        ) {
            const key = Object.keys(input.dbResults[0])[0];
            let formattedResponse = `**${key}s:**\n`;
            
            input.dbResults.forEach(entry => {
                formattedResponse += `- ${entry[key]}\n`;
            });
            
            return {
                ...input,
                answer: formattedResponse.trim(),
                jsonResponse: {
                    header: `${key}s:`,
                    results: input.dbResults
                }
            };
        }
        
        // 4. FALLBACK: Use the template approach if we have an answer template
        if (input.answerTemplate) {
            let template = input.answerTemplate;
            
            // Extract the header (if any) from the template
            const headerMatch = template.match(/^\*\*([^*]+)\*\*/);
            const header = headerMatch ? headerMatch[1].trim() : "Results";
            
            // Check if the template contains list formatting indicators
            const isListFormat = template.includes("- ") || template.includes("* ") || 
                                template.includes("{") && input.dbResults.length > 1;
            
            if (isListFormat) {
                // Create a list-style response
                let formattedResponse = `**${header}**\n`;
                
                input.dbResults.forEach(entry => {
                    // Use the first value as the main item
                    const mainKey = Object.keys(entry)[0];
                    formattedResponse += `- ${entry[mainKey]}\n`;
                });
                
                return {
                    ...input,
                    answer: formattedResponse.trim(),
                    jsonResponse: {
                        header: header,
                        results: input.dbResults
                    }
                };
            } else {
                // For non-list templates, just join the values
                const placeholders = template.match(/{(.*?)}/g) || [];
                
                const formattedEntries = input.dbResults.map(entry => {
                    let formattedEntry = template;
                    
                    placeholders.forEach(placeholder => {
                        const key = placeholder.replace(/{|}/g, "");
                        let value = entry[key] || "";
                        formattedEntry = formattedEntry.replace(new RegExp(placeholder, "g"), value);
                    });
                    
                    return formattedEntry;
                });
                
                return {
                    ...input,
                    answer: formattedEntries.join("\n\n"),
                    jsonResponse: {
                        header: header,
                        results: input.dbResults
                    }
                };
            }
        }
        
        // 5. EMERGENCY FALLBACK: Just format the results simply if nothing else worked
        const mainKey = Object.keys(input.dbResults[0])[0];
        let fallbackResponse = `**${mainKey}s:**\n`;
        
        input.dbResults.forEach(entry => {
            fallbackResponse += `- ${entry[mainKey]}\n`;
        });
        
        return {
            ...input,
            answer: fallbackResponse.trim(),
            jsonResponse: {
                header: `${mainKey}s`,
                results: input.dbResults
            }
        };
    }
    async function cacheResult(input) {
        if (input.cached || input.error) return input;

        debugLog("💾 Storing new question-answer pair in Neo4j Vector Store...");
        await vectorIndex.addDocuments([
            {
                pageContent: input.question,
                metadata: {
                    answerTemplate: input.answerTemplate,
                    query: input.query
                },
            },
        ]);

        debugLog("✅ New data stored in Neo4j Vector Store!");
        return input;
    }
}