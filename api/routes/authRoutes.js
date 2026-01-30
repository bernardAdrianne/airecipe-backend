import { signup, signin, logout, checkSession } from "../controllers/authController.js";
import express from 'express';

const router = express.Router();

router.post('/signup', signup);
router.post('/signin', signin);
router.post('/logout', logout);
router.get('/check-session', checkSession);

export default router;
