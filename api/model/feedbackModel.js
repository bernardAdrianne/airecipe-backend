import mongoose from 'mongoose';

const feedbackSchema = new mongoose.Schema({
  name: {
    type: String,
    default: 'Anonymous',
  },
  rate: {
    type: Number,
    required: true,
  },
  feedback: {
    type: String,
    required: true,
  },
  exp: {
    type: String,
  },
  image: {
    type: String,
  },
}, { timestamps: true });

const Feedback = mongoose.model("Feedback", feedbackSchema);

export default Feedback;