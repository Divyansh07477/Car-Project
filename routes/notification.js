const express = require("express");
const router = express.Router();

const Notification = require("../models/Notification");


// =====================================================
// GET ALL NOTIFICATIONS
// =====================================================

router.get("/", async (req, res) => {

    try {

        if (!req.session.userId) {
            return res.status(401).json({
                success: false,
                message: "Please login first."
            });
        }

        const notifications =
            await Notification.find({
                user: req.session.userId
            })
            .populate({
                path: "booking",
                populate: {
                    path: "car",
                    select: "name image pricePerDay"
                }
            })
            .sort({
                createdAt: -1
            })
            .lean();


        return res.status(200).json({
            success: true,
            notifications: notifications || []
        });

    } catch (error) {

        console.error(
            "Get Notifications Error:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Failed to fetch notifications.",
            notifications: []
        });

    }

});


// =====================================================
// GET UNREAD NOTIFICATION COUNT
// =====================================================

router.get("/unread-count", async (req, res) => {

    try {

        if (!req.session.userId) {
            return res.status(401).json({
                success: false,
                message: "Please login first."
            });
        }

        const count =
            await Notification.countDocuments({
                user: req.session.userId,
                isRead: false
            });


        return res.status(200).json({
            success: true,
            count
        });

    } catch (error) {

        console.error(
            "Unread Notification Count Error:",
            error
        );

        return res.status(500).json({
            success: false,
            count: 0
        });

    }

});


// =====================================================
// MARK SINGLE NOTIFICATION AS READ
// =====================================================

router.put("/:id/read", async (req, res) => {

    try {

        if (!req.session.userId) {
            return res.status(401).json({
                success: false,
                message: "Please login first."
            });
        }


        const notification =
            await Notification.findOne({
                _id: req.params.id,
                user: req.session.userId
            });


        if (!notification) {

            return res.status(404).json({
                success: false,
                message: "Notification not found."
            });

        }


        notification.isRead = true;

        await notification.save();


        return res.status(200).json({
            success: true,
            message: "Notification marked as read.",
            notification
        });

    } catch (error) {

        console.error(
            "Mark Notification Read Error:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Failed to update notification."
        });

    }

});


// =====================================================
// MARK ALL NOTIFICATIONS AS READ
// =====================================================

router.put("/read-all", async (req, res) => {

    try {

        if (!req.session.userId) {
            return res.status(401).json({
                success: false,
                message: "Please login first."
            });
        }


        await Notification.updateMany(

            {
                user: req.session.userId,
                isRead: false
            },

            {
                $set: {
                    isRead: true
                }
            }

        );


        return res.status(200).json({
            success: true,
            message: "All notifications marked as read."
        });

    } catch (error) {

        console.error(
            "Mark All Notifications Read Error:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Failed to update notifications."
        });

    }

});


module.exports = router;