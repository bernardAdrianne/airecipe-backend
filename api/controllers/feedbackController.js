import multer from "multer";
import { supabase } from "../utils/supabaseClient.js";
import Feedback from "../model/feedbackModel.js";
import { errorHandler } from "../utils/error.js";

const storage = multer.memoryStorage();
const upload = multer({ storage });

export const createFeedback = [
  upload.single("image"),

  async (req, res, next) => {
    try {
      const { name, rate, feedback, exp } = req.body;

      if (!rate || !feedback) {
        return next(errorHandler(400, "Rating and feedback are required."));
      }

      let imageUrl = "";

      if (req.file) {
        const filename = `feedback/${Date.now()}_${req.file.originalname}`;

        const { error } = await supabase.storage
          .from("feedback") 
          .upload(filename, req.file.buffer, {
            contentType: req.file.mimetype,
            cacheControl: "3600",
            upsert: false
          });

        if (error) {
          return next(error);
        }

        imageUrl = supabase.storage
          .from("feedback")
          .getPublicUrl(filename).data.publicUrl;
      }

      const newFeedback = new Feedback({
        name: name?.trim() || "Anonymous",
        rate,
        feedback,
        exp: exp || "",
        image: imageUrl
      });

      await newFeedback.save();

      res.status(201).json({
        success: true,
        message: "Feedback submitted successfully",
        data: newFeedback
      });

    } catch (err) {
      next(errorHandler(500, "Failed to submit feedback"));
    }
  }
];

export const getAllFeedback = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 6;
    const sort = req.query.sort || "newest";

    let sortQuery = { createdAt: -1 };

    if (sort === "stars_desc") {
      sortQuery = { rate: -1, createdAt: -1 };
    }

    if (sort === "stars_asc") {
      sortQuery = { rate: 1, createdAt: -1 };
    }

    const feedbacks = await Feedback.find()
      .sort(sortQuery)
      .skip((page - 1) * limit)
      .limit(limit);

    res.status(200).json({ results: feedbacks });
  } catch (err) {
    next(errorHandler(500, "Failed to fetch all feedbacks."));
  }
};
