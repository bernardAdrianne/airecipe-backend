import multer from "multer";
import { supabase } from "../utils/supabaseClient.js";
import Recipe from '../model/recipeModel.js';
import { errorHandler } from "../utils/error.js";
import { groq } from "../utils/groqClient.js";
import jwt from "jsonwebtoken";
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
    const token = req.cookies.access_token;
    let isGuest = true;

    if (token) {
      try {
        jwt.verify(token, process.env.JWT_SECRET);
        isGuest = false;
      } catch (err) {
        isGuest = true;
      }
    }

    if (isGuest) {
      let guestCount = parseInt(req.cookies.guest_search_count || "0", 10);

      if (guestCount >= 3) {
        return res.status(403).json({
          message: "Guest search limit reached. Please Sign in or Sign up to continue.",
        });
      }

      guestCount += 1;
      res.cookie("guest_search_count", guestCount, {
        httpOnly: true,
        sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: 24 * 60 * 60 * 1000,
      });
    }

    const ingredients = ingredient
      .split(",")
      .map(i => i.trim().toLowerCase())
      .filter(Boolean);

    const dbMatches = await Recipe.find({
      ingredients: { $in: ingredients.map(i => new RegExp(i, "i")) },
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
      const score = matchCount - missingCount * 0.5;
      return { recipe, score, matchCount, missingCount };
    });

    scoredRecipes.sort((a, b) => b.score - a.score);
    const topRecipes = scoredRecipes.slice(0, 15).map(r => r.recipe);

    const recipeData = topRecipes.map(r => ({
      id: r._id,
      title: r.title,
      ingredients: r.ingredients,
      category: r.category,
    }));

    const prompt = `
      The user searched for: "${ingredients.join(", ")}".
      Rank recipes by ingredient match quality.
      Return valid JSON array of recipe IDs.
      ${JSON.stringify(recipeData, null, 2)}
    `;

    const completion = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [{ role: "user", content: prompt }],
      temperature: 0,
    });

    let matchedIds = [];
    try {
      const rawContent = completion.choices[0].message.content.trim();
      const match = rawContent.match(/\[.*\]/s);
      if (match) matchedIds = JSON.parse(match[0]);
    } catch (err) {
      console.warn("AI ranking failed, using local ranking only:", err.message);
      return res.status(200).json({ results: topRecipes });
    }

    const rankedRecipes = matchedIds
      .map(id => topRecipes.find(r => r._id.toString() === id))
      .filter(Boolean);

    const missingRecipes = topRecipes.filter(r => !rankedRecipes.includes(r));
    const finalResults = [...rankedRecipes, ...missingRecipes];

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

export const getFeaturedRecipes = async (req, res, next) => {
  try {
    const FEATURED_IDS =[
      "68460392efa57458bf388785",
      "6845e4fbfcdbee746a6007b9",
      "68ad06956d7c7c513decb1f6",
    ];

    const recipes = await Recipe.find({ _id: { $in: FEATURED_IDS } });

    res.status(200).json({ success: true, results: recipes });
  } catch (err) {
    next(errorHandler(500, 'Failed to fetch featured recipes.'));
  }
};

export const editRecipe = [
  upload.single("image"),

  async (req, res, next) => {
    try {
      const { id } = req.params;

      let recipe = await Recipe.findById(id);
      if (!recipe) {
        return next(errorHandler(404, "Recipe not found"));
      }

      const { title, ingredients, steps, category, difficulty, description, estimatedTime} = req.body;

      let updatedData = {
        title: title || recipe.title,
        category: category || recipe.category,
        ingredients: ingredients ? JSON.parse(ingredients) : recipe.ingredients,
        steps: steps ? JSON.parse(steps) : recipe.steps,
        difficulty: difficulty || recipe.difficulty,
        description: description || recipe.description,
        estimatedTime: estimatedTime || recipe.estimatedTime,
      };

      // If user uploads new image → replace it
      if (req.file) {
        const filename = `${Date.now()}_${req.file.originalname}`;

        const { error } = await supabase.storage
          .from("recipe")
          .upload(filename, req.file.buffer, {
            contentType: req.file.mimetype,
            upsert: false,
          });

        if (error) {
          return next(errorHandler(500, "Image upload failed"));
        }

        const publicUrl = supabase.storage
          .from("recipe")
          .getPublicUrl(filename).data.publicUrl;

        updatedData.image = publicUrl;
      }

      // Update recipe
      const updatedRecipe = await Recipe.findByIdAndUpdate(id, updatedData, {
        new: true,
      });

      res.status(200).json({
        message: "Recipe updated successfully",
        recipe: updatedRecipe,
      });

    } catch (err) {
      next(errorHandler(500, "Failed to update recipe"));
    }
  }
];
