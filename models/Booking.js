const mongoose = require("mongoose");

const bookingSchema = new mongoose.Schema(
    {
        // Which car is being booked
        car: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Car",
            required: true
        },

        // Customer who made the booking
        renter: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },

        // Owner of the booked car
        owner: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },

        // Customer details
        name: {
            type: String,
            required: true,
            trim: true
        },

        email: {
            type: String,
            required: true,
            trim: true,
            lowercase: true
        },

        phone: {
            type: String,
            required: true,
            trim: true
        },

        // Pickup location
        pickupLocation: {
            type: String,
            required: true,
            trim: true
        },

        // Rental dates
        startDate: {
            type: Date,
            required: true
        },

        endDate: {
            type: Date,
            required: true
        },

        // Price snapshot at booking time
        totalDays: {
            type: Number,
            required: true,
            min: 1
        },

        pricePerDay: {
            type: Number,
            required: true,
            min: 0
        },

        totalAmount: {
            type: Number,
            required: true,
            min: 0
        },

        // Actual date when owner marks rental completed
        actualReturnDate: {
            type: Date,
            default: null
        },

        // Booking lifecycle
        status: {
            type: String,
            enum: [
                "pending",
                "confirmed",
                "cancelled",
                "completed"
            ],
            default: "pending"
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model("Booking", bookingSchema);