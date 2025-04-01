import { createServer } from "node:http"
import { once } from "node:events"
import { prompt } from "./ai.js"

// const DEBUG_ENABLED = false
const DEBUG_ENABLED = true
const debugLog = (...args) => {
    if (!DEBUG_ENABLED) return

    console.log(...args);
    // const msg = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : arg);
    // response.write(msg.toString() + "\n");
}

// Example restaurant-specific queries for testing
// await prompt("What are the most popular dishes in our restaurant?", debugLog);
// await prompt("Which dishes contain cheese as an ingredient?", debugLog);
// await prompt("What is John Doe's order history?", debugLog);
// await prompt("Which ingredients are currently low in stock?", debugLog);
// await prompt("Who are the staff members that specialize in Italian cuisine?", debugLog);
// await prompt("How many customers do we have?", debugLog);

// Test chart generation
await prompt("Show me a chart of the most popular dishes based on sales", debugLog);

createServer(async (request, response) => {
    try {
        if (request.url === '/v1/chat' && request.method === 'POST') {
            const data = JSON.parse(await once(request, 'data'))
            debugLog("🔹 Received Restaurant AI Prompt:", data.prompt);

            const aiResponse = await prompt(data.prompt, debugLog);
            
            // Determine response format based on request
            const format = data.format || 'text';
            
            response.writeHead(200, { 'Content-Type': 'application/json' });
            
            if (format === 'json') {
                // Return structured JSON for frontend applications
                const responseData = {
                    success: !aiResponse.error,
                    message: aiResponse.answer || aiResponse.error,
                    data: aiResponse.jsonResponse || null,
                    rawData: aiResponse.dbResults || null,
                    query: aiResponse.query
                };
                
                // If this was a chart request, include chart data
                if (aiResponse.chartData) {
                    responseData.chart = {
                        type: aiResponse.chartData.type,
                        data: aiResponse.chartData.data,
                        options: aiResponse.chartData.options
                    };
                }
                
                response.end(JSON.stringify(responseData));
            } else {
                // Return simple text response with chart data if available
                const responseData = {
                    message: aiResponse.answer || aiResponse.error
                };
                
                // Always include chart data if available, even in text mode
                if (aiResponse.chartData) {
                    responseData.chart = {
                        type: aiResponse.chartData.type,
                        data: aiResponse.chartData.data,
                        options: aiResponse.chartData.options
                    };
                }
                
                response.end(JSON.stringify(responseData));
            }
            return
        }

        response.writeHead(404, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ message: "Not Found" }));

    } catch (error) {
        console.error("❌ Restaurant AI Backend Error:", error.stack);
        response.writeHead(500, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ message: "Internal Server Error" }));
    }

}).listen(process.env.PORT || 3002, () => console.log("🍽️ Restaurant AI Backend running on port 3002"));

['uncatchException', 'unhandledRejection'].forEach(event => process.on(event, error => {
    console.error("❌ Unhandled Error:", error.stack);
    process.exit(1);
}));