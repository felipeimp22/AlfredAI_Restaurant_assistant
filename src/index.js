import express from 'express';
import cors from 'cors';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { prompt } from './ai.js';
import authRoutes from './routes/authRoutes.js';

// Enable debugging
const DEBUG_ENABLED = process.env.DEBUG_ENABLED === 'true' || true;
const debugLog = (...args) => {
    if (!DEBUG_ENABLED) return;
    console.log(...args);
};

// Create Express app
const app = express();

// Middleware
app.use(cors({
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());



// Routes
app.use('/auth', authRoutes);

// AI chat endpoint
app.post('/v1/chat', async (req, res) => {
    try {
        const data = req.body;
        debugLog("🔹 Received AI Prompt:", data.prompt);

        const aiResponse = await prompt(data.prompt, debugLog);
        
        res.json(aiResponse.answer ? 
            { message: aiResponse.answer, data: aiResponse.jsonResponse, chart: aiResponse.chartData } : 
            { message: aiResponse.error }
        );
    } catch (error) {
        console.error("❌ AI Backend Error:", error.stack);
        res.status(500).json({ message: "Internal Server Error" });
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

// Start server
const PORT = process.env.PORT || 3002;
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});

// Handle uncaught exceptions
['uncaughtException', 'unhandledRejection'].forEach(event => {
    process.on(event, (error) => {
        console.error(`❌ ${event}:`, error);
        process.exit(1);
    });
});

export default app;







