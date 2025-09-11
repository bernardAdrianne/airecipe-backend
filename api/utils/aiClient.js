import dotenv from "dotenv";
import Groq from "groq-sdk";

dotenv.config();

export const client = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});
