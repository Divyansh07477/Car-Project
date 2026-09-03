const express = require("express");
const bcrypt = require("bcryptjs");
const User = require("../models/User");

const router = express.Router();


// ===============================
// SIGNUP
// ===============================

router.post("/signup", async (req, res) => {
    try {

        const { name, email, password } = req.body;

        // Check fields
        if (!name || !email || !password) {
            return res.status(400).json({
                message: "All fields are required."
            });
        }

        // Check password length
        if (password.length < 6) {
            return res.status(400).json({
                message: "Password must be at least 6 characters."
            });
        }

        // Check existing user
        const existingUser = await User.findOne({
            email: email.toLowerCase()
        });

        if (existingUser) {
            return res.status(409).json({
                message: "Email already registered. Please login."
            });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create user
        const user = await User.create({
            name,
            email: email.toLowerCase(),
            password: hashedPassword
        });

        res.status(201).json({
            message: "Account created successfully!",
            user: {
                id: user._id,
                name: user.name,
                email: user.email
            }
        });

    } catch (error) {

        console.error("Signup Error:", error);

        res.status(500).json({
            message: "Server error. Please try again."
        });

    }
});


// ===============================
// LOGIN
// ===============================

router.post("/login", async (req, res) => {
    try {

        const { email, password } = req.body;

        // Check fields
        if (!email || !password) {
            return res.status(400).json({
                message: "Email and password are required."
            });
        }

        // Find user
        const user = await User.findOne({
            email: email.toLowerCase()
        });

        if (!user) {
            return res.status(401).json({
                message: "Invalid email or password."
            });
        }

        // Check password
        const isMatch = await bcrypt.compare(
            password,
            user.password
        );

        if (!isMatch) {
            return res.status(401).json({
                message: "Invalid email or password."
            });
        }

        // Create session
        req.session.userId = user._id;
        req.session.userName = user.name;
        req.session.userEmail = user.email;

        res.status(200).json({
            message: "Login Successful!",
            user: {
                id: user._id,
                name: user.name,
                email: user.email
            }
        });

    } catch (error) {

        console.error("Login Error:", error);

        res.status(500).json({
            message: "Server error. Please try again."
        });

    }
});


// ===============================
// LOGOUT
// ===============================

router.post("/logout", (req, res) => {

    req.session.destroy((error) => {

        if (error) {

            return res.status(500).json({
                message: "Logout failed."
            });

        }

        res.clearCookie("connect.sid");

        res.status(200).json({
            message: "Logged out successfully."
        });

    });

});

// ===============================
// CHECK LOGIN SESSION
// ===============================

router.get("/me", async (req, res) => {
    try {

        if (!req.session.userId) {
            return res.status(401).json({
                loggedIn: false
            });
        }

        const user = await User.findById(req.session.userId)
            .select("-password");

        if (!user) {
            return res.status(401).json({
                loggedIn: false
            });
        }

        res.status(200).json({
            loggedIn: true,
            user: {
                id: user._id,
                name: user.name,
                email: user.email
            }
        });

    } catch (error) {

        console.error("Session Check Error:", error);

        res.status(500).json({
            loggedIn: false
        });
    }
});


// ===============================
// LOGOUT
// ===============================

router.post("/logout", (req, res) => {

    req.session.destroy((error) => {

        if (error) {
            console.error("Logout Error:", error);

            return res.status(500).json({
                message: "Logout failed."
            });
        }

        res.clearCookie("connect.sid");

        res.status(200).json({
            message: "Logged out successfully."
        });
    });
});
















// ===============================
// EXPORT ROUTER
// ===============================

module.exports = router;