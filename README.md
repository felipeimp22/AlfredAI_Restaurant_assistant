# 🍽️ Restaurant Assistant - AI-Powered Business Intelligence

![Version](https://img.shields.io/badge/version-0.1.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)

## Overview

Restaurant Assistant is an intelligent system that transforms natural language queries into powerful database insights for restaurant management. Leveraging RAG (Retrieval Augmented Generation), vector search, and graph databases, it enables restaurant staff to interact with their business data through simple conversation.

> "What were our most popular dishes last month?" → _Instant visualization of top-selling menu items_

This system combines the power of Neo4j graph database for complex relationship queries with PostgreSQL for structured data storage, all unified through an AI interface that understands restaurant terminology and business needs.

## 🌟 Key Features

- **Natural Language Interface**: Ask questions about your restaurant in plain English
- **Automatic Data Visualization**: Generates charts based on query results when visualization is requested
- **Vector Similarity Search**: Caches previous queries for lightning-fast responses
- **Graph Data Analysis**: Leverages Neo4j to understand complex relationships between customers, menu items, and orders
- **Multi-database Integration**: Combines the power of graph (Neo4j) and relational (PostgreSQL) databases
- **RAG Architecture**: Enhances AI responses with knowledge from your actual restaurant data
- **Authentication System**: Secure user management with JWT-based authentication
- **Docker Integration**: Simple deployment with containerized infrastructure

## 🔧 Technology Stack

- **AI/ML**: 
  - Retrieval Augmented Generation (RAG)
  - LangChain for AI orchestration
  - Ollama for local model execution (gemma:7b, deepseek-coder:6.7b, nomic-embed-text)
  - Vector embedding and similarity search

- **Databases**:
  - Neo4j (Graph database)
  - PostgreSQL via Supabase (Relational database)
  - Vector indexing for semantic search

- **Backend**:
  - Node.js
  - LangChain.js
  - HTTP API server
  - JWT-based authentication

- **Visualization**: 
  - Chart.js-compatible data structures
  - Multiple chart types (bar, pie, line, scatter)

## 📊 Architecture

Restaurant Assistant works by:

1. **Reception**: Capturing natural language queries through an HTTP API
2. **Vector Lookup**: Checking if similar questions have been answered before
3. **AI Processing**: Translating plain language to optimized database queries
4. **Database Execution**: Running queries on Neo4j and/or PostgreSQL
5. **Formatting**: Generating human-readable answers or chart-ready data
6. **Caching**: Storing successful Q&A pairs for future acceleration

```
User Query → Vector Search → Query Generation → Neo4j/PostgreSQL → Response Formatting → User
                ↑                                                           |
                |                                                           ↓
                └────────────────── Vector Storage ◄─────────────────────────
```

## 🚀 Installation

### Prerequisites

- [Docker](https://www.docker.com/) and Docker Compose
- [Node.js](https://nodejs.org/) (v22+ recommended)
- [Ollama](https://ollama.ai/) for running AI models locally

### Step 1: Clone the Repository

```bash
git clone https://github.com/yourusername/restaurant-assistant.git
cd restaurant-assistant
```

### Step 2: Configure Environment

Create a `.env` file in the project root:

```
OLLAMA_BASE_URL='http://localhost:11434'
OPENAI_API_KEY=ollama
NLP_MODEL='gemma:7b'
CODER_MODEL='deepseek-coder:6.7b'

NEO4J_USER=neo4j
NEO4J_PASSWORD=password
NEO4J_URI=bolt://localhost:7687
NEO4J_DATABASE=neo4j

POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_HOST=localhost
POSTGRES_DB=restaurant
POSTGRES_PORT=5432

JWT_SECRET=your-super-secret-jwt-token-with-at-least-32-characters
JWT_EXPIRES_IN=24h

NEO4J_VECTOR_THRESHOLD=0.85
```

### Step 3: Start Ollama and Download Models

```bash
# Start Ollama service
ollama serve

# Download required models (in a new terminal)
ollama pull gemma:7b
ollama pull deepseek-coder:6.7b
ollama pull nomic-embed-text
```

### Step 4: Launch Database Services

```bash
# Start Neo4j and PostgreSQL
docker compose up -d
```

### Step 5: Install Node.js Dependencies

```bash
npm ci
```

### Step 6: Initialize the Database

```bash
# Run the database seed script
npm run seed
```

### Step 7: Start the Application

```bash
npm run dev
```

The server will be running at http://localhost:3002

## 📝 Usage Examples

### Authentication

The system provides user authentication with the following endpoints:

```bash
# Register a new user
curl -X POST http://localhost:3002/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "email": "john@example.com",
    "password": "yourpassword"
  }'

# Login
curl -X POST http://localhost:3002/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "yourpassword"
  }'

# Get current user session (requires auth token)
curl -X GET http://localhost:3002/auth/session \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Logout (requires auth token)
curl -X POST http://localhost:3002/auth/logout \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Making Simple Queries

Send POST requests to `/v1/chat`:

```bash
curl -X POST http://localhost:3002/v1/chat \
  -H "Content-Type: application/json" \
  -d '{"prompt": "How many customers do we have?"}'
```

Response:
```json
{
  "message": "**CustomerCount**: 3"
}
```

### Requesting Data Visualization

For charts, include visualization keywords in your query:

```bash
curl -X POST http://localhost:3002/v1/chat \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Show me a chart of our most popular dishes", "format": "json"}'
```

Response:
```json
{
  "success": true,
  "message": "**Most Popular Dishes**\n\nThe chart compares the popularity of dishes by sales. The highest values are: Classic Burger (210), Margherita Pizza (178), Mac and Cheese (125).",
  "data": {
    "header": "Most Popular Dishes",
    "results": [
      {"dish": "Classic Burger", "timesSold": 210},
      {"dish": "Margherita Pizza", "timesSold": 178},
      {"dish": "Mac and Cheese", "timesSold": 125},
      {"dish": "Chocolate Lava Cake", "timesSold": 94},
      {"dish": "Caesar Salad", "timesSold": 87}
    ]
  },
  "chart": {
    "type": "bar",
    "data": {
      "labels": ["Classic Burger", "Margherita Pizza", "Mac and Cheese", "Chocolate Lava Cake", "Caesar Salad"],
      "datasets": [{
        "label": "Times Sold",
        "data": [210, 178, 125, 94, 87],
        "backgroundColor": "#4e79a7"
      }]
    },
    "options": {
      "title": "Most Popular Dishes",
      "responsive": true
    }
  }
}
```

### Sample Restaurant Questions

- "Which dishes contain cheese as an ingredient?"
- "What is John Doe's order history?"
- "Which ingredients are currently low in stock?"
- "Who are the staff members that specialize in Italian cuisine?"
- "How many customers have we served?"
- "What is our most profitable dish?"
- "Generate a chart of monthly sales"
- "Show me a visualization of ingredient usage"

## 📁 Project Structure

```
restaurant-assistant/
├── data/                       # Data and seeding scripts
│   ├── restaurant.json         # Sample restaurant data
│   └── seed.js                 # Database seeding script
├── docker-compose.yml          # Docker configuration
├── init-scripts/               # SQL initialization scripts
│   └── 01_restaurant_schema.sql # PostgreSQL schema definition
├── neo4j/                      # Neo4j data directory (created on first run)
├── package.json                # Node.js dependencies
├── prompts/                    # LLM prompt templates
│   ├── chartQueryGenerator.md  # Chart-specific query generator
│   ├── context.md              # Restaurant domain knowledge
│   ├── nlpToCypher.md          # NLP to Cypher translation
│   └── responseTemplateFromJson.md # Response formatting
└── src/                        # Source code
    ├── ai.js                   # AI model integration
    ├── index.js                # Main application server
    ├── middleware/             # Express middleware
    │   └── authMiddleware.js   # JWT authentication middleware
    ├── routes/                 # API routes
    │   └── authRoutes.js       # Authentication endpoints
    ├── services/               # Business logic
    │   └── authService.js      # Authentication service
    └── utils/                  # Utility functions
        └── chartUtils.js       # Chart detection and generation
```

## 🤖 Understanding RAG and Vector Search

This project implements Retrieval Augmented Generation (RAG) architecture, which enhances large language models by:

1. **Retrieving** relevant information from your restaurant's database
2. **Augmenting** the AI's context with this specific information
3. **Generating** accurate, domain-specific responses

The vector search mechanism:
- Converts natural language questions into high-dimensional vectors
- Identifies semantically similar previous questions
- Reuses successful query patterns and response templates
- Accelerates responses for similar future questions
- Continuously improves with each successful interaction

## 📈 Visualization Capabilities

Restaurant Assistant can automatically generate visualization-ready data for:

- **Bar charts**: Comparing values across categories (most popular dishes)
- **Pie charts**: Showing distribution of values (sales by category)
- **Line charts**: Displaying trends over time (sales across months)
- **Scatter plots**: Revealing relationships between variables

The chart data is formatted for easy integration with Chart.js, the most popular JavaScript charting library.

## 🔐 Authentication System

The application includes a complete JWT-based authentication system that:

- Manages user registration and login securely
- Creates matching customer records for registered users
- Hashes passwords with bcrypt for security
- Issues JWT tokens for authenticated API access
- Supports role-based access control
- Maintains user sessions with secure token verification

This authentication system is built on:
- JSON Web Tokens (JWT) for stateless authentication
- PostgreSQL database for user data storage
- Express middleware for protecting routes

## 🔄 Extending the System

To add new restaurant data types or query capabilities:

1. Extend the PostgreSQL schema in `init-scripts/01_restaurant_schema.sql`
2. Update the Neo4j schema in the seed script
3. Enhance the context document in `prompts/context.md` to teach the AI about new entities
4. Retrain or update the vector index

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.