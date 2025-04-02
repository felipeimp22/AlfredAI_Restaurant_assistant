// data\seed.js
import neo4j from "neo4j-driver";
import { faker } from "@faker-js/faker";
import { readFile } from "node:fs/promises";
import pkg from 'pg';
const { Pool } = pkg;

// Neo4j connection for graph database
const neoDriver = neo4j.driver(
    process.env.NEO4J_URI,
    neo4j.auth.basic(process.env.NEO4J_USER, process.env.NEO4J_PASSWORD)
);
const neoSession = neoDriver.session();

// PostgreSQL connection for Supabase
const pgPool = new Pool({
    user: process.env.POSTGRES_USER || 'postgres',
    host: process.env.POSTGRES_HOST || 'localhost',
    database: process.env.POSTGRES_DB || 'restaurant',
    password: process.env.POSTGRES_PASSWORD || 'postgres',
    port: process.env.POSTGRES_PORT || 5432,
});

// Read restaurant data
const restaurantData = JSON.parse(await readFile("./data/restaurant.json"));
const { menu, customers, staff, stock } = restaurantData[0];

async function seedSupabase() {
    const client = await pgPool.connect();
    try {
        await client.query('BEGIN');
        
        console.log("🍽️ Seeding restaurant data into Supabase...");
        
        // Insert ingredients (stock)
        for (const item of stock) {
            const result = await client.query(
                `INSERT INTO restaurant.ingredients (name, quantity, unit, reorder_level) 
                 VALUES ($1, $2, $3, $4) 
                 RETURNING id`,
                [item.ingredient, item.quantity, item.unit, item.reorderLevel]
            );
            console.log(`✅ Added ingredient: ${item.ingredient}`);
        }
        
        // Insert dishes (menu)
        for (const item of menu) {
            // Insert dish
            const dishResult = await client.query(
                `INSERT INTO restaurant.dishes (dish, description, price, category, sold) 
                 VALUES ($1, $2, $3, $4, $5) 
                 RETURNING id`,
                [item.dish, item.description, item.price, item.category, item.sold]
            );
            const dishId = dishResult.rows[0].id;
            
            // Link dish to ingredients
            for (const ingredient of item.ingredients) {
                const ingredientResult = await client.query(
                    'SELECT id FROM restaurant.ingredients WHERE name = $1',
                    [ingredient]
                );
                
                if (ingredientResult.rows.length > 0) {
                    const ingredientId = ingredientResult.rows[0].id;
                    await client.query(
                        `INSERT INTO restaurant.dish_ingredients (dish_id, ingredient_id) 
                         VALUES ($1, $2)`,
                        [dishId, ingredientId]
                    );
                }
            }
            console.log(`✅ Added dish: ${item.dish}`);
        }
        
        // Insert staff
        for (const member of staff) {
            const staffResult = await client.query(
                `INSERT INTO restaurant.staff (name, role, salary, hire_date) 
                 VALUES ($1, $2, $3, $4) 
                 RETURNING id`,
                [member.name, member.role, member.salary, member.hireDate]
            );
            const staffId = staffResult.rows[0].id;
            
            // Add specialties if they exist
            if (member.specialties) {
                for (const specialty of member.specialties) {
                    await client.query(
                        `INSERT INTO restaurant.staff_specialties (staff_id, specialty) 
                         VALUES ($1, $2)`,
                        [staffId, specialty]
                    );
                }
            }
            console.log(`✅ Added staff member: ${member.name}`);
        }
        
        // Insert customers and their orders
        for (const customer of customers) {
            const customerResult = await client.query(
                `INSERT INTO restaurant.customers (name, email, phone, visits) 
                 VALUES ($1, $2, $3, $4) 
                 RETURNING id`,
                [customer.name, customer.email, customer.phone, customer.visits]
            );
            const customerId = customerResult.rows[0].id;
            
            // Create orders from history
            const orderDates = [...new Set(customer.history.map(h => h.date))];
            
            for (const orderDate of orderDates) {
                // Find all items ordered on this date
                const orderItems = customer.history.filter(h => h.date === orderDate);
                
                // Calculate total amount
                let totalAmount = 0;
                for (const item of orderItems) {
                    const dishResult = await client.query(
                        'SELECT price FROM restaurant.dishes WHERE dish = $1',
                        [item.dish]
                    );
                    if (dishResult.rows.length > 0) {
                        totalAmount += dishResult.rows[0].price * item.quantity;
                    }
                }
                
                // Create order
                const orderResult = await client.query(
                    `INSERT INTO restaurant.orders (customer_id, order_date, total_amount) 
                     VALUES ($1, $2, $3) 
                     RETURNING id`,
                    [customerId, orderDate, totalAmount]
                );
                const orderId = orderResult.rows[0].id;
                
                // Add order items
                for (const item of orderItems) {
                    const dishResult = await client.query(
                        'SELECT id, price FROM restaurant.dishes WHERE dish = $1',
                        [item.dish]
                    );
                    
                    if (dishResult.rows.length > 0) {
                        const dishId = dishResult.rows[0].id;
                        const price = dishResult.rows[0].price;
                        
                        await client.query(
                            `INSERT INTO restaurant.order_items (order_id, dish_id, quantity, price_per_unit) 
                             VALUES ($1, $2, $3, $4)`,
                            [orderId, dishId, item.quantity, price]
                        );
                    }
                }
            }
            console.log(`✅ Added customer: ${customer.name} with their order history`);
        }
        
        await client.query('COMMIT');
        console.log("✅ Supabase database seeded successfully!");
    } catch (error) {
        await client.query('ROLLBACK');
        console.error("❌ Error seeding Supabase:", error);
        throw error;
    } finally {
        client.release();
    }
}

async function seedNeo4j() {
    try {
        console.log("🧠 Seeding Neo4j graph database...");
        
        // Create constraints
        await neoSession.run(`
            CREATE CONSTRAINT dish_name IF NOT EXISTS
            FOR (d:Dish) REQUIRE d.name IS UNIQUE
        `);
        
        await neoSession.run(`
            CREATE CONSTRAINT ingredient_name IF NOT EXISTS
            FOR (i:Ingredient) REQUIRE i.name IS UNIQUE
        `);
        
        await neoSession.run(`
            CREATE CONSTRAINT customer_id IF NOT EXISTS
            FOR (c:Customer) REQUIRE c.id IS UNIQUE
        `);
        
        await neoSession.run(`
            CREATE CONSTRAINT staff_id IF NOT EXISTS
            FOR (s:Staff) REQUIRE s.id IS UNIQUE
        `);
        
        // Create dishes
        await neoSession.run(
            `UNWIND $batch AS row
            MERGE (d:Dish {name: row.dish})
            ON CREATE SET d.price = row.price, d.category = row.category, 
                          d.description = row.description, d.sold = row.sold`,
            { batch: menu }
        );
        console.log("✅ Neo4j Dishes created!");
        
        // Create ingredients
        await neoSession.run(
            `UNWIND $batch AS row
            MERGE (i:Ingredient {name: row.ingredient})
            ON CREATE SET i.quantity = row.quantity, i.unit = row.unit, i.reorderLevel = row.reorderLevel`,
            { batch: stock }
        );
        console.log("✅ Neo4j Ingredients created!");
        
        // Connect dishes to ingredients
        for (const item of menu) {
            await neoSession.run(
                `MATCH (d:Dish {name: $dishName})
                 UNWIND $ingredients AS ingredient
                 MATCH (i:Ingredient {name: ingredient})
                 MERGE (d)-[r:CONTAINS]->(i)`,
                { dishName: item.dish, ingredients: item.ingredients }
            );
        }
        console.log("✅ Neo4j Dish-Ingredient relationships created!");
        
        // Create staff
        await neoSession.run(
            `UNWIND $batch AS row
            MERGE (s:Staff {id: row.id})
            ON CREATE SET s.name = row.name, s.role = row.role, 
                          s.salary = row.salary, s.hireDate = row.hireDate`,
            { batch: staff }
        );
        console.log("✅ Neo4j Staff created!");
        
        // Add staff specialties
        for (const member of staff) {
            if (member.specialties) {
                await neoSession.run(
                    `MATCH (s:Staff {id: $staffId})
                     UNWIND $specialties AS specialty
                     MERGE (sp:Specialty {name: specialty})
                     MERGE (s)-[r:SPECIALIZES_IN]->(sp)`,
                    { staffId: member.id, specialties: member.specialties }
                );
            }
        }
        
        // Create customers
        await neoSession.run(
            `UNWIND $batch AS row
            MERGE (c:Customer {id: row.id})
            ON CREATE SET c.name = row.name, c.email = row.email, 
                          c.phone = row.phone, c.visits = row.visits`,
            { batch: customers }
        );
        console.log("✅ Neo4j Customers created!");
        
        // Create purchase relationships
        for (const customer of customers) {
            for (const purchase of customer.purchased) {
                await neoSession.run(
                    `MATCH (c:Customer {id: $customerId}), (d:Dish {name: $dishName})
                     MERGE (c)-[r:PURCHASED]->(d)
                     ON CREATE SET r.quantity = $quantity`,
                    { 
                        customerId: customer.id, 
                        dishName: purchase.dish, 
                        quantity: purchase.quantity 
                    }
                );
            }
        }
        console.log("✅ Neo4j Purchase relationships created!");
        
        // Create order history
        for (const customer of customers) {
            for (const historyItem of customer.history) {
                await neoSession.run(
                    `MATCH (c:Customer {id: $customerId}), (d:Dish {name: $dishName})
                     MERGE (o:Order {date: $date, customer: $customerId, dish: $dishName})
                     MERGE (c)-[r1:ORDERED]->(o)
                     MERGE (o)-[r2:OF_DISH]->(d)
                     SET o.quantity = $quantity`,
                    { 
                        customerId: customer.id, 
                        dishName: historyItem.dish, 
                        date: historyItem.date,
                        quantity: historyItem.quantity 
                    }
                );
            }
        }
        console.log("✅ Neo4j Order history created!");
        
        console.log("✅ Neo4j database seeded successfully!");
    } catch (error) {
        console.error("❌ Error seeding Neo4j:", error);
        throw error;
    }
}

async function seedAll() {
    try {
        await seedSupabase();
        await seedNeo4j();
        console.log("🎉 All databases seeded successfully!");
    } catch (error) {
        console.error("❌ Error during seeding process:", error);
    } finally {
        await neoSession.close();
        await neoDriver.close();
        await pgPool.end();
    }
}

await seedAll();