import mongoose from 'mongoose';

const recipeSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
  },
  image: {
    type: String,
    required: true,
  },
  ingredients: {
    type: [String],
    required: true,
  },
  steps: {
    type: [String], 
    required: true,
  },
  category: {
    type: String,
    enum: ['Breakfast', 'Lunch', 'Dinner', 'Dessert'],
    required: true,
  },
   difficulty: {
    type: String,
    enum: ['Easy', 'Medium', 'Hard'],
    default: 'Easy'
  },
  description: {
    type: String,
    default: ''
  },
  estimatedTime: {
    type: String, 
    default: 0
  }

}, { timestamps: true });

const Recipe = mongoose.model("Recipe", recipeSchema);

export default Recipe;
