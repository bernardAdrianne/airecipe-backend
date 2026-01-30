import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

// Routes
import authRoutes from './routes/authRoutes.js';
import feedbackRoutes from './routes/feedbackRoutes.js';
import userRoutes from './routes/userRoutes.js';
import recipeRoutes from './routes/recipeRoutes.js';
import savedRoutes from './routes/savedRoutes.js';
 
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config();

mongoose.connect(process.env.MONGO_URL).then(() => {
  console.log('MongoDB is connected');
}).catch((err) => {
  console.log(err);
});

// Initializing express app
const app = express();

// Enable CORS
app.use(cors({
  origin: [
    'http://localhost:5173',
    'https://recipe-frontend-oqiurq08x-gordon-college.vercel.app',
    'https://recipe-frontend-eta-five.vercel.app',
    'https://recipe-frontend-divwv579n-gordon-college.vercel.app',
  ],
  credentials: true
}));

app.use(express.json());
app.use(cookieParser());

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/user', userRoutes);
app.use('/api/recipe', recipeRoutes);
app.use('/api/', savedRoutes);

// Global error handler
app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';
  res.status(statusCode).json({
    success: false,
    statusCode,
    message,
  });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}!`);
});