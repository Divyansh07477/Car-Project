const mongoose = require("mongoose");

const bookingSchema = new mongoose.Schema(
    {
        car: {
            type: String,
            required: true,
            trim: true
        },

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

        pickupLocation: {
            type: String,
            required: true,
            trim: true
        },

        pickupDate: {
            type: Date,
            required: true
        },

        returnDate: {
            type: Date,
            required: true
        },

        status: {
            type: String,
            enum: ["Pending", "Confirmed", "Cancelled"],
            default: "Pending"
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model("Booking", bookingSchema);