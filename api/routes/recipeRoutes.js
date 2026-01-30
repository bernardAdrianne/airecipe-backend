import express from 'express';
import { addRecipeWithImage, searchRecipesAI, getRecipesByCategory, getAllRecipes, getRecipe, getFeaturedRecipes, editRecipe} from '../controllers/recipeController.js';
import { verifyToken } from '../middleware/verifyToken.js';

const router = express.Router();

router.post('/add', verifyToken, addRecipeWithImage);
router.get('/search', searchRecipesAI);
router.get('/category', getRecipesByCategory);
router.get('/all', getAllRecipes);
router.get('/featured', getFeaturedRecipes);
router.put('/:id', editRecipe);
router.get('/:id', getRecipe);

export default router;
