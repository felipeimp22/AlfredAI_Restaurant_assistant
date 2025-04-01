/**
 * Utility functions for detecting and formatting chart data
 */

/**
 * Detects if a user prompt is requesting chart visualization
 * @param {string} question - The user's question
 * @returns {boolean} - Whether the question is requesting a chart
 */
export function isChartRequest(question) {
    const chartKeywords = [
        'chart', 'graph', 'plot', 'visualization', 'dashboard', 'visualize',
        'show me', 'display', 'diagram', 'trend', 'compare', 'comparison',
        'statistics', 'stats', 'analytics', 'histogram', 'pie chart', 'bar chart',
        'line graph', 'scatter plot'
    ];
    
    // Convert to lowercase for case-insensitive matching
    const lowerQuestion = question.toLowerCase();
    
    // Check for chart keywords
    return chartKeywords.some(keyword => lowerQuestion.includes(keyword));
}

/**
 * Determines the appropriate chart type based on the data and question
 * @param {Array} data - The data from the database
 * @param {string} question - The user's question
 * @returns {string} - The recommended chart type
 */
export function determineChartType(data, question) {
    const lowerQuestion = question.toLowerCase();
    
    // Explicitly requested chart types
    if (lowerQuestion.includes('pie chart') || lowerQuestion.includes('pie graph')) return 'pie';
    if (lowerQuestion.includes('bar chart') || lowerQuestion.includes('bar graph')) return 'bar';
    if (lowerQuestion.includes('line chart') || lowerQuestion.includes('line graph')) return 'line';
    if (lowerQuestion.includes('scatter plot')) return 'scatter';
    
    // Implicit chart types based on question semantics
    if (lowerQuestion.includes('distribution') || lowerQuestion.includes('breakdown')) return 'pie';
    if (lowerQuestion.includes('trend') || lowerQuestion.includes('over time')) return 'line';
    if (lowerQuestion.includes('compare') || lowerQuestion.includes('comparison')) return 'bar';
    
    // Default chart types based on data structure
    if (data.length <= 5) return 'pie';  // Small datasets work well as pie charts
    if (Object.keys(data[0]).length <= 2) return 'bar'; // Simple key-value pairs work well as bar charts
    if (Object.keys(data[0]).some(key => key.toLowerCase().includes('date') || 
                                 key.toLowerCase().includes('time'))) {
        return 'line';  // Data with time/dates works well as line charts
    }
    
    // Default to bar chart for most data
    return 'bar';
}

/**
 * Formats database results into chart-friendly data structure
 * @param {Array} dbResults - The raw database results
 * @param {string} chartType - The type of chart to format for
 * @param {string} question - The original user question
 * @returns {Object} - Formatted chart data
 */
export function formatChartData(dbResults, chartType, question) {
    if (!dbResults || !dbResults.length) return null;
    
    // Create a fresh object with chart-related attributes
    const chartData = {
        type: chartType,
        data: null,
        options: {
            title: generateChartTitle(question),
            responsive: true
        }
    };
    
    // Get the keys from the first result object
    const keys = Object.keys(dbResults[0]);
    
    // For most charts, we need labels and datasets
    switch (chartType) {
        case 'pie':
        case 'doughnut':
            // For pie charts, we need a label field and a value field
            const labelField = keys.find(k => 
                k.toLowerCase().includes('name') || 
                k.toLowerCase().includes('dish') ||
                k.toLowerCase().includes('category')
            ) || keys[0];
            
            const valueField = keys.find(k => 
                k.toLowerCase().includes('count') || 
                k.toLowerCase().includes('quantity') || 
                k.toLowerCase().includes('amount') ||
                k.toLowerCase().includes('sold') ||
                k.toLowerCase().includes('total')
            ) || keys[1] || keys[0];
            
            chartData.data = {
                labels: dbResults.map(item => item[labelField]),
                datasets: [{
                    data: dbResults.map(item => item[valueField]),
                    backgroundColor: generateColors(dbResults.length)
                }]
            };
            break;
            
        case 'bar':
            // For bar charts, similar to pie but with more formatting
            const barLabelField = keys.find(k => 
                k.toLowerCase().includes('name') || 
                k.toLowerCase().includes('dish') ||
                k.toLowerCase().includes('category')
            ) || keys[0];
            
            const barValueField = keys.find(k => 
                k.toLowerCase().includes('count') || 
                k.toLowerCase().includes('quantity') || 
                k.toLowerCase().includes('amount') ||
                k.toLowerCase().includes('sold') ||
                k.toLowerCase().includes('total')
            ) || keys[1] || keys[0];
            
            chartData.data = {
                labels: dbResults.map(item => item[barLabelField]),
                datasets: [{
                    label: formatFieldName(barValueField),
                    data: dbResults.map(item => item[barValueField]),
                    backgroundColor: generateColors(1)[0]
                }]
            };
            break;
            
        case 'line':
            // For line charts, we need x and y coordinates
            const xField = keys.find(k => 
                k.toLowerCase().includes('date') || 
                k.toLowerCase().includes('time') ||
                k.toLowerCase().includes('month') ||
                k.toLowerCase().includes('year')
            ) || keys[0];
            
            const yField = keys.find(k => 
                k.toLowerCase().includes('count') || 
                k.toLowerCase().includes('quantity') || 
                k.toLowerCase().includes('amount') ||
                k.toLowerCase().includes('sold') ||
                k.toLowerCase().includes('total')
            ) || keys[1] || keys[0];
            
            chartData.data = {
                labels: dbResults.map(item => item[xField]),
                datasets: [{
                    label: formatFieldName(yField),
                    data: dbResults.map(item => item[yField]),
                    borderColor: generateColors(1)[0],
                    fill: false
                }]
            };
            break;
            
        case 'scatter':
            // For scatter plots, we need x and y coordinates
            const scatterXField = keys.find(k => 
                !k.toLowerCase().includes('count') && 
                !k.toLowerCase().includes('quantity') && 
                !k.toLowerCase().includes('total')
            ) || keys[0];
            
            const scatterYField = keys.find(k => 
                k.toLowerCase().includes('count') || 
                k.toLowerCase().includes('quantity') || 
                k.toLowerCase().includes('total')
            ) || keys[1] || keys[0];
            
            chartData.data = {
                datasets: [{
                    label: `${formatFieldName(scatterXField)} vs ${formatFieldName(scatterYField)}`,
                    data: dbResults.map(item => ({
                        x: item[scatterXField],
                        y: item[scatterYField]
                    })),
                    backgroundColor: generateColors(1)[0]
                }]
            };
            break;
            
        default:
            // Default to tabular data
            chartData.data = dbResults;
    }
    
    chartData.rawData = dbResults;
    
    return chartData;
}

/**
 * Generates a meaningful chart title from the user's question
 * @param {string} question - The user's question
 * @returns {string} - A formatted chart title
 */
function generateChartTitle(question) {
    // Remove question marks and chart-related keywords
    let title = question.replace(/\?/g, '').trim();
    
    const chartKeywords = [
        'chart', 'graph', 'plot', 'visualization', 'dashboard', 'visualize',
        'show me', 'display', 'diagram', 'generate', 'create', 'make'
    ];
    
    // Remove chart keywords
    chartKeywords.forEach(keyword => {
        const pattern = new RegExp(`\\b${keyword}\\b`, 'gi');
        title = title.replace(pattern, '').trim();
    });
    
    // Capitalize first letter and end with meaningful word if needed
    title = title.charAt(0).toUpperCase() + title.slice(1);
    
    // If title doesn't contain words like "of", "for", etc., add context
    if (!title.toLowerCase().includes(' of ') && !title.toLowerCase().includes(' by ')) {
        if (title.toLowerCase().includes('dish')) {
            title = `${title} by Popularity`;
        } else if (title.toLowerCase().includes('ingredient')) {
            title = `${title} by Quantity`;
        } else if (title.toLowerCase().includes('customer')) {
            title = `${title} by Count`;
        }
    }
    
    return title;
}

/**
 * Converts database field names to user-friendly labels
 * @param {string} fieldName - The field name from the database
 * @returns {string} - A formatted, user-friendly field name
 */
function formatFieldName(fieldName) {
    // Remove underscores and camelCase to spaces
    let formatted = fieldName
        .replace(/_/g, ' ')
        .replace(/([A-Z])/g, ' $1')
        .toLowerCase();
    
    // Capitalize each word
    formatted = formatted.split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
    
    return formatted;
}

/**
 * Generates an array of colors for chart visualization
 * @param {number} count - The number of colors needed
 * @returns {Array} - An array of color strings
 */
function generateColors(count) {
    const baseColors = [
        '#4e79a7', '#f28e2c', '#e15759', '#76b7b2', '#59a14f',
        '#edc949', '#af7aa1', '#ff9da7', '#9c755f', '#bab0ab'
    ];
    
    // If we need more colors than in our base set, we'll repeat with different opacity
    const colors = [];
    for (let i = 0; i < count; i++) {
        colors.push(baseColors[i % baseColors.length]);
    }
    
    return colors;
}