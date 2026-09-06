const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
    {
        // User who will receive the notification
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },

        // Related booking
        booking: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Booking",
            required: true
        },

        // Notification message
        message: {
            type: String,
            required: true,
            trim: true
        },

        // Type of notification
        type: {
            type: String,
            enum: [
                "new_booking",
                "booking_confirmed",
                "booking_cancelled",
                "booking_auto_cancelled",
                "booking_completed"
            ],
            required: true
        },

        // Whether user has read it
        isRead: {
            type: Boolean,
            default: false
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model(
    "Notification",
    notificationSchema
);