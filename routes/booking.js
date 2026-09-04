const express = require("express");
const router = express.Router();
const Booking = require("../models/Booking");

// ===============================
// CREATE BOOKING
// ===============================
router.post("/", async (req, res) => {
    try {
        const {
            car,
            name,
            email,
            phone,
            pickupLocation,
            pickupDate,
            returnDate
        } = req.body;

        // Check all fields
        if (
            !car ||
            !name ||
            !email ||
            !phone ||
            !pickupLocation ||
            !pickupDate ||
            !returnDate
        ) {
            return res.status(400).json({
                success: false,
                message: "Please fill all fields."
            });
        }

        // Check if same email already has a booking
        const existingBooking = await Booking.findOne({
            email: email.toLowerCase().trim()
        });

        if (existingBooking) {
            return res.status(400).json({
                success: false,
                message: "This email has already been used for a booking."
            });
        }

        // Check dates
        if (new Date(returnDate) < new Date(pickupDate)) {
            return res.status(400).json({
                success: false,
                message: "Return date cannot be before pickup date."
            });
        }

        // Create booking
        const booking = new Booking({
            car,
            name,
            email: email.toLowerCase().trim(),
            phone,
            pickupLocation,
            pickupDate,
            returnDate
        });

        await booking.save();

        res.status(201).json({
            success: true,
            message: "Booking confirmed successfully!",
            booking
        });

    } catch (error) {
        console.error("Booking Error:", error);

        // MongoDB duplicate email safety
        if (error.code === 11000) {
            return res.status(400).json({
                success: false,
                message: "This email has already been used for a booking."
            });
        }

        res.status(500).json({
            success: false,
            message: "Failed to create booking."
        });
    }
});


// ===============================
// GET ALL BOOKINGS
// ===============================
router.get("/", async (req, res) => {
    try {
        const bookings = await Booking
            .find()
            .sort({ createdAt: -1 });

        res.json({
            success: true,
            bookings
        });

    } catch (error) {
        console.error("Get Bookings Error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to fetch bookings."
        });
    }
});


// ===============================
// GET SINGLE BOOKING
// ===============================
router.get("/:id", async (req, res) => {
    try {
        const booking = await Booking.findById(req.params.id);

        if (!booking) {
            return res.status(404).json({
                success: false,
                message: "Booking not found."
            });
        }

        res.json({
            success: true,
            booking
        });

    } catch (error) {
        console.error("Get Booking Error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to fetch booking."
        });
    }
});


module.exports = router;