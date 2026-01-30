import express from "express";
import { createFeedback, getAllFeedback } from "../controllers/feedbackController.js";

const router = express.Router();

router.post("/create", createFeedback);
router.get("/all", getAllFeedback);

export default router;