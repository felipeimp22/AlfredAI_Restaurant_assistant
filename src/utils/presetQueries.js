// src/utils/presetQueries.js
/**
 * Preset queries for common chart and data requests
 * These are used as fallbacks when the AI-generated query fails
 */

/**
 * A mapping of query patterns to predefined Cypher queries
 * @type {Object}
 */
const presetQueries = {
    // Monthly sales chart query
    monthlySales: `
      MATCH (c:Customer)-[:ORDERED]->(o:Order)-[r:OF_DISH]->(d:Dish)
      WITH SUBSTRING(o.date, 0, 7) AS yearMonth, SUM(o.quantity * d.price) AS monthlySales
      ORDER BY yearMonth
      RETURN yearMonth AS month, monthlySales AS sales
      LIMIT 12
    `,
    
    // Popular dishes chart query
    popularDishes: `
      MATCH (d:Dish)
      RETURN d.name AS dish, d.sold AS timesSold
      ORDER BY timesSold DESC
      LIMIT 10
    `,
    
    // Sales by category chart query
    salesByCategory: `
      MATCH (d:Dish)
      WITH d.category AS category, SUM(d.sold * d.price) AS categorySales
      ORDER BY categorySales DESC
      RETURN category, categorySales AS sales
      LIMIT 10
    `,
    
    // Low stock ingredients chart query
    lowStockIngredients: `
      MATCH (i:Ingredient)
      WHERE i.quantity <= i.reorderLevel * 1.2
      RETURN i.name AS ingredient, i.quantity AS currentStock, i.reorderLevel AS minimumRequired
      ORDER BY i.quantity / i.reorderLevel ASC
      LIMIT 10
    `,
    
    // Customer spending chart query
    customerSpending: `
      MATCH (c:Customer)-[:ORDERED]->(o:Order)
      WITH c.name AS customer, COUNT(o) AS orderCount, SUM(o.total_amount) AS totalSpent
      ORDER BY totalSpent DESC
      RETURN customer, totalSpent
      LIMIT 10
    `,
    
    // Last month's top spending customers
    lastMonthTopCustomers: `
      MATCH (c:Customer)-[:ORDERED]->(o:Order)-[r:OF_DISH]->(d:Dish)
      WHERE o.date STARTS WITH SUBSTRING(DATETIME().toString(), 0, 7)
           OR o.date STARTS WITH SUBSTRING((DATETIME() - DURATION('P1M')).toString(), 0, 7)
      WITH c.name AS customer, SUM(o.quantity * d.price) AS spent
      ORDER BY spent DESC
      RETURN customer, spent AS amountSpent
      LIMIT 10
    `,
    
    // Top spending customers for any time period
    topSpendingCustomers: `
      MATCH (c:Customer)-[:ORDERED]->(o:Order)-[r:OF_DISH]->(d:Dish)
      WITH c.name AS customer, SUM(o.quantity * d.price) AS spent
      ORDER BY spent DESC
      RETURN customer, spent AS amountSpent
      LIMIT 10
    `,
    
    // All staff and their roles
    staffAndRoles: `
      MATCH (s:Staff)
      RETURN s.name AS staffName, s.role AS role
      ORDER BY s.role, s.name
    `,
    
    // Customer order history
    customerOrderHistory: `
      MATCH (c:Customer)-[:ORDERED]->(o:Order)-[r:OF_DISH]->(d:Dish)
      RETURN c.name AS customer, o.date AS orderDate, d.name AS dish, o.quantity AS quantity
      ORDER BY o.date DESC
      LIMIT 20
    `
  };
  
  /**
   * Get a preset query based on the user question
   * @param {string} question - The user's question
   * @returns {string|null} - The preset query or null if no match
   */
  export function getPresetQuery(question) {
    const questionLower = question.toLowerCase();
    
    // Process time references
    const hasLastMonth = questionLower.includes('last month') || questionLower.includes('previous month');
    const hasThisMonth = questionLower.includes('this month') || questionLower.includes('current month');
    const hasTimeReference = hasLastMonth || hasThisMonth || 
                            questionLower.includes('recent') || 
                            questionLower.includes('latest');
    
    // Customer spending with time reference
    if ((questionLower.includes('customer') && (
        questionLower.includes('spent') || 
        questionLower.includes('spending') || 
        questionLower.includes('top') ||
        questionLower.includes('most')
      )) && hasTimeReference) {
      return presetQueries.lastMonthTopCustomers;
    }
    
    // General customer spending without time reference
    if (questionLower.includes('customer') && (
        questionLower.includes('spent') || 
        questionLower.includes('spending') || 
        questionLower.includes('top') ||
        questionLower.includes('most')
      )) {
      return presetQueries.topSpendingCustomers;
    }
    
    // Monthly sales
    if (
      (questionLower.includes('month') && questionLower.includes('sale')) ||
      (questionLower.includes('month') && questionLower.includes('revenue')) ||
      (questionLower.includes('sale') && questionLower.includes('by month')) ||
      (questionLower.includes('monthly') && questionLower.includes('sale'))
    ) {
      return presetQueries.monthlySales;
    }
    
    // Popular dishes
    if (
      (questionLower.includes('popular') && questionLower.includes('dish')) ||
      (questionLower.includes('best') && questionLower.includes('sell')) ||
      (questionLower.includes('most ordered') && questionLower.includes('dish'))
    ) {
      return presetQueries.popularDishes;
    }
    
    // Sales by category
    if (
      (questionLower.includes('category') && questionLower.includes('sale')) ||
      (questionLower.includes('category') && questionLower.includes('revenue'))
    ) {
      return presetQueries.salesByCategory;
    }
    
    // Low stock ingredients
    if (
      (questionLower.includes('low') && questionLower.includes('stock')) ||
      (questionLower.includes('reorder') && questionLower.includes('ingredient'))
    ) {
      return presetQueries.lowStockIngredients;
    }
    
    // Staff information
    if (
      (questionLower.includes('staff') || questionLower.includes('employee')) &&
      (questionLower.includes('role') || questionLower.includes('all') || 
       questionLower.includes('list') || questionLower.includes('show'))
    ) {
      return presetQueries.staffAndRoles;
    }
    
    // Customer order history
    if (
      questionLower.includes('order') && 
      questionLower.includes('history') &&
      (questionLower.includes('customer') || questionLower.includes('client'))
    ) {
      return presetQueries.customerOrderHistory;
    }
    
    // No matching preset query
    return null;
  }
  
  export default presetQueries;