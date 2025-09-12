import multer from "multer";
import { supabase } from "../utils/supabaseClient.js";
import Recipe from '../model/recipeModel.js';
import { errorHandler } from "../utils/error.js";
import { groq } from "../utils/groqClient.js";
import mongoose from "mongoose";

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

export const addRecipeWithImage = [
  upload.single('image'), 

  async (req, res, next) => {
    try {
      const { title, ingredients, steps, category } = req.body;

      if (!req.file) {
        return res.status(400).json({ error: 'Image file is required' });
      }

      const filename = `${Date.now()}_${req.file.originalname}`;
      const { data, error } = await supabase.storage
        .from('recipe') 
        .upload(filename, req.file.buffer, {
          contentType: req.file.mimetype,
          cacheControl: '3600',
          upsert: false,
        });

      if (error) {
        return next(error);
      }

      const publicUrl = supabase.storage
        .from('recipe')
        .getPublicUrl(filename).data.publicUrl;

      // Save recipe to MongoDB
      const newRecipe = new Recipe({
        title,
        image: publicUrl,
        ingredients: JSON.parse(ingredients),  
        steps: JSON.parse(steps),    
        category,     
      });

      await newRecipe.save();

      res.status(201).json({ message: 'Recipe created', recipe: newRecipe });

    } catch (err) {
      next(err);
    }
  }
];

export const getRecipesByCategory = async (req, res, next) => {
  const { category } = req.query;

  try {
    const query = category && category !== 'All' 
      ? { category } 
      : {};

    const recipes = await Recipe.find(query).sort({ createdAt: -1 });
    res.status(200).json({ results: recipes });
  } catch (err) {
    next(errorHandler(500, 'Failed to fetch recipes by category'));
  }
};
export const searchRecipesAI = async (req, res, next) => {
  const { ingredient } = req.query;
  if (!ingredient) {
    return res.status(400).json({ message: "Ingredient query missing" });
  }

  try {
    // Normalize and clean user input
    const ingredients = ingredient
      .split(",")
      .map(i => i.trim().toLowerCase())
      .filter(Boolean);

    // Find recipes containing ANY of the searched ingredients
    const dbMatches = await Recipe.find({
      ingredients: { $in: ingredients.map(i => new RegExp(i, "i")) }
    });

    if (dbMatches.length === 0) {
      return res.status(404).json({ message: "No recipes found with those ingredients" });
    }

    const scoredRecipes = dbMatches.map(recipe => {
      const recipeIngredients = recipe.ingredients.map(rIng => rIng.toLowerCase());

      const matchCount = ingredients.filter(ing =>
        recipeIngredients.some(rIng => rIng.includes(ing))
      ).length;

      const missingCount = recipeIngredients.length - matchCount;

      // Higher is better
      const score = matchCount - missingCount * 0.5;

      return { recipe, score, matchCount, missingCount };
    });

    // Sort locally before sending to AI
    scoredRecipes.sort((a, b) => b.score - a.score);

    // Prepare data for AI reranking (limit to top 15 for performance)
    const topRecipes = scoredRecipes.slice(0, 15).map(r => r.recipe);

    const recipeData = topRecipes.map(r => ({
      id: r._id,
      title: r.title,
      ingredients: r.ingredients,
      category: r.category,
    }));

    const prompt = `
      The user searched for: "${ingredients.join(", ")}".

      Rules for ranking recipes:
      1. Recipes with more exact ingredient matches rank higher.
      2. Penalize recipes that require many additional ingredients not provided by the user.
      3. Prefer simpler recipes (fewer total ingredients) if match counts are the same.

      Output Instructions:
      - Return ALL candidate recipe IDs, sorted best to worst.
      - Return ONLY a valid JSON array, no extra text.
      - Example: ["65d8f2...", "65d8f3...", "65d8f4..."]

      Candidate recipes:
      ${JSON.stringify(recipeData, null, 2)}
    `;

    // Query AI model
    const completion = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [{ role: "user", content: prompt }],
      temperature: 0,
    });

    let matchedIds = [];
    try {
      const rawContent = completion.choices[0].message.content.trim();

      // Extract first valid JSON array
      const match = rawContent.match(/\[.*\]/s);
      if (match) {
        matchedIds = JSON.parse(match[0]);
      } else {
        throw new Error("No valid JSON array found in AI response");
      }
    } catch (err) {
      console.warn("AI ranking failed, using local ranking only:", err.message);
      return res.status(200).json({ results: topRecipes });
    }

    // Reorder results based on AI ranking
    const rankedRecipes = matchedIds
      .map(id => topRecipes.find(r => r._id.toString() === id))
      .filter(Boolean);

    // Add any recipes AI forgot to mention (least relevant at the end)
    const missingRecipes = topRecipes.filter(r => !rankedRecipes.includes(r));
    const finalResults = [...rankedRecipes, ...missingRecipes];

    // Fallback if AI gave wrong IDs (finalResults would still include everything)
    if (finalResults.length === 0) {
      return res.status(200).json({ results: topRecipes });
    }

    res.status(200).json({ results: finalResults });
  } catch (err) {
    console.error("AI search error:", err);
    next(errorHandler(500, "AI search failed"));
  }
};

export const getAllRecipes = async (req, res, next) => {
   try {
    const recipes = await Recipe.find().sort({ createdAt: -1 });
    res.status(200).json({ results: recipes }); 
   } catch (err) {
    next(errorHandler(500, 'Failed to fetch all recipes.'));
   }
};

export const getRecipe = async (req, res, next) => {
  try {
    const { id } = req.params;
    const recipe = await Recipe.findById(id);

    if (!recipe) {
      return next(errorHandler(404, 'Recipe not found'));
    }

    res.status(200).json({ results: recipe });
  } catch (err) {
    next(errorHandler(500, 'Failed to fetch recipe'));
  }
};