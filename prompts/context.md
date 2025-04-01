### **📜 Context for AI to Generate Specific Questions on Restaurant Operations in Neo4j**

#### **Introduction**
This database models restaurant operations, tracking **menu items, customer orders, staff information, and inventory**. The database is structured in **Neo4j**, a graph database, where relationships define the connections between dishes, ingredients, customers, and staff.

---

### **📌 Database Structure & Rules**
The system follows strict rules to ensure data consistency and accuracy:

#### **📍 Entities & Relationships**
- **Dish (:Dish)**
  - Represents a menu item available in the restaurant.
  - Has attributes: `name`, `price`, `category`, `description`, `sold`.

- **Ingredient (:Ingredient)**
  - Represents an ingredient used in dishes.
  - Has attributes: `name`, `quantity`, `unit`, `reorderLevel`.

- **Customer (:Customer)**
  - Represents a customer who has visited the restaurant.
  - Has attributes: `id`, `name`, `email`, `phone`, `visits`.

- **Staff (:Staff)**
  - Represents restaurant employees.
  - Has attributes: `id`, `name`, `role`, `salary`, `hireDate`.

- **Specialty (:Specialty)**
  - Represents staff specializations.
  - Has attributes: `name`.

- **Order (:Order)**
  - Represents a customer's order.
  - Has attributes: `date`, `customer`, `dish`, `quantity`.

- **Contains (:CONTAINS)**
  - Relationship between a dish and its ingredients.
  - Relationship: `(d:Dish)-[:CONTAINS]->(i:Ingredient)`.

- **Purchased (:PURCHASED)**
  - Represents a customer's purchase history for dishes.
  - Relationship: `(c:Customer)-[:PURCHASED]->(d:Dish)`.
  - Has attributes: `quantity`.

- **Ordered (:ORDERED)**
  - Relationship between a customer and their specific orders.
  - Relationship: `(c:Customer)-[:ORDERED]->(o:Order)`.

- **Of_Dish (:OF_DISH)**
  - Relationship between an order and the dish that was ordered.
  - Relationship: `(o:Order)-[:OF_DISH]->(d:Dish)`.

- **Specializes_In (:SPECIALIZES_IN)**
  - Relationship between staff and their specialties.
  - Relationship: `(s:Staff)-[:SPECIALIZES_IN]->(sp:Specialty)`.

---

### **✅ Business Rules (Data Integrity Constraints)**
1. **Each dish contains specific ingredients.**
   - A `CONTAINS` relationship connects dishes to their ingredients.

2. **Customers can purchase multiple dishes.**
   - A `PURCHASED` relationship with a `quantity` tracks the total number purchased.

3. **Customers have a detailed order history.**
   - Each order is tracked with date and quantity information.

4. **Staff can have multiple specialties.**
   - A `SPECIALIZES_IN` relationship connects staff to their specialties.

5. **Ingredients have inventory tracking.**
   - Each ingredient has a current quantity and reorder level.

---

### **📌 Cypher Queries Mapping the Rules**

#### **1️⃣ Find Popular Dishes**
```cypher
MATCH (d:Dish)
RETURN d.name AS dish, d.sold AS timesSold
ORDER BY d.sold DESC
LIMIT 5;
```

#### **2️⃣ Find Dishes by Ingredient**
```cypher
MATCH (d:Dish)-[:CONTAINS]->(i:Ingredient {name: "cheese"})
RETURN d.name AS dish, d.price AS price, d.category AS category;
```

#### **3️⃣ Find Customer Order History**
```cypher
MATCH (c:Customer {name: "John Doe"})-[:ORDERED]->(o:Order)-[:OF_DISH]->(d:Dish)
RETURN o.date AS orderDate, d.name AS dish, o.quantity AS quantity
ORDER BY o.date DESC;
```

#### **4️⃣ Find Low Stock Ingredients**
```cypher
MATCH (i:Ingredient)
WHERE i.quantity <= i.reorderLevel
RETURN i.name AS ingredient, i.quantity AS currentStock, i.reorderLevel AS minimumRequired;
```

#### **5️⃣ Find Staff by Specialty**
```cypher
MATCH (s:Staff)-[:SPECIALIZES_IN]->(sp:Specialty {name: "Italian"})
RETURN s.name AS staffName, s.role AS role;
```

---

### **🚀 AI Question Examples Based on This Context**

#### ✅ **Valid Scenarios**
1. "What are the most popular dishes in our restaurant?"
2. "Which dishes contain cheese as an ingredient?"
3. "What is John Doe's order history?"
4. "Which ingredients are currently low in stock?"
5. "Who are the staff members that specialize in Italian cuisine?"

#### ❌ **Edge Cases & Data Analysis**
6. "Which customers have ordered the most dishes overall?"
7. "What ingredients do we need to restock urgently?"
8. "Who are our top spending customers?"
9. "Which dishes share the most common ingredients?"
10. "How many orders have we had in the past week?"

---

### **🎯 Summary**
- **Neo4j is used to track restaurant operations**.
- **Graph relationships model the connections** between dishes, ingredients, customers, staff, and orders.
- **Data integrity constraints maintain business rules**.
- **AI-generated questions should leverage graph relationships** to provide valuable insights.