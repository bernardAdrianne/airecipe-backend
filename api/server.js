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

// ✅ Initialize express app first
const app = express();

// ✅ Now use middlewares
app.use(cors({
  origin: [
    'https://recipe-frontend-divwv579n-gordon-college.vercel.app',
    'https://recipe-frontend-eta-five.vercel.app'
  ],
  credentials: true
}));

app.use(express.json());
app.use(cookieParser());

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/recipe', recipeRoutes);
app.use('/api/', savedRoutes);

// Serve frontend (optional if you serve Svelte separately)
// app.use(express.static(path.join(__dirname, '/client/dist')));

// app.get('*', (req, res) => {
//   res.sendFile(path.join(__dirname, 'client', 'dist', 'index.html'));
// });

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


//MONGO_URL=mongodb+srv://recipe:Benedicto123@cluster0.c9mhyk0.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0
// JWT_SECRET=reciperecommendationpassword

// SUPABASE_URL=https://sfoyguywhcyqnxpvdexr.supabase.co
// SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNmb3lndXl3aGN5cW54cHZkZXhyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg3MTkwNzEsImV4cCI6MjA2NDI5NTA3MX0.gQh5Sp_tYF0XrWKgwEfhbaZJm7PTLYHay82gzi5kmzs

// SPOONACULAR_API_KEY=9d113425d4ee417bba548c6674deb787