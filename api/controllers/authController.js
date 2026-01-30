import User from "../model/userModel.js";
import bcryptjs from 'bcryptjs';
import jwt from "jsonwebtoken";
import { errorHandler } from "../utils/error.js";

export const signup = async (req, res, next) => {
    const { username, email, password } = req.body;

    // Validation
    if (!username || !email || !password) {
        return next(errorHandler(400, 'All fields are required'));
    }

    if (password.length < 8) {
        return next(errorHandler(400,'Password must be at least 8 character'));
    }

    const hashedPassword = bcryptjs.hashSync(password, 10);

    try {
        const newUser = new User ({
            username,
            email,
            password: hashedPassword
        });
        await newUser.save();

        res.status(201).json({ 
            success: true, 
            message: 'User created successfully', 
            userId: newUser._id 
        });
    } catch (error) {
        next(error);
    }
};

export const signin = async (req, res, next) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return next(errorHandler(400, 'All fields are required'));
    }

    try {
        const validUser = await User.findOne({ email });
        if (!validUser) {
            return next(errorHandler(404, 'User not found'));
        }

        const validPassword = bcryptjs.compareSync(password, validUser.password);
        if (!validPassword) {
            return next(errorHandler(400, 'Invalid Password'));
        }

        const token = jwt.sign(
            { id: validUser._id }, process.env.JWT_SECRET
        );

        const { password: pass, ...rest } = validUser._doc;

        res.status(200)
        .clearCookie("guest_search_count")
        .cookie('access_token', token, {
            httpOnly: true,
            secure: false,//process.env.NODE_ENV === "production",
            sameSite: "lax",
        }).json(rest);
    } catch(error) {
        next(error);
    }
};

export const logout = async (req, res) => {
    res.clearCookie("access_token", {
    httpOnly: true,
    secure: false,
    sameSite: "lax",
}).status(200).json({ message: "Logout successfully" });
};

export const checkSession = async (req, res) => {
  try {
    const token = req.cookies?.access_token;

    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        return res.status(200).json({
          authenticated: true,
          user: { id: decoded.id },
        });
      } catch (err) {
        return res.status(401).json({
          authenticated: false,
          message: "Invalid or expired token",
        });
      }
    }

    return res.status(401).json({ authenticated: false });
  } catch (err) {
    console.error("Error in checkSession:", err);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};
