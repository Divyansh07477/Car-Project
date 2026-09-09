const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },

        booking: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Booking",
            required: true
        },

        message: {
            type: String,
            required: true,
            trim: true
        },

       type: {
    type: String,
    enum: [
        "booking_created",
        "booking_confirmed",
        "booking_cancelled",
        "payment_success",
        "payment_received"
    ],
    default: "booking_created"
},

        isRead: {
            type: Boolean,
            default: false
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model("Notification", notificationSchema);
