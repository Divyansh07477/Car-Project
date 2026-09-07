const express = require("express");
const router = express.Router();

const Booking = require("../models/Booking");
const Car = require("../models/Car");
const Notification = require("../models/Notification");
// =====================================================
// 1. CREATE BOOKING
// Customer creates a PENDING booking request
// =====================================================

router.post("/", async (req, res) => {
    try {
        // -------------------------------------------------
        // LOGIN CHECK
        // -------------------------------------------------

        if (!req.session.userId) {
            return res.status(401).json({
                success: false,
                message: "Please login first."
            });
        }

        const {
            car,
            name,
            email,
            phone,
            pickupLocation,
            pickupDate,
            returnDate
        } = req.body;

        // -------------------------------------------------
        // REQUIRED FIELDS
        // -------------------------------------------------

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

        // -------------------------------------------------
        // FIND CAR
        // -------------------------------------------------

        const carData = await Car.findById(car);

        if (!carData) {
            return res.status(404).json({
                success: false,
                message: "Car not found."
            });
        }

        // -------------------------------------------------
        // SELF BOOKING CHECK
        // User cannot book their own car
        // -------------------------------------------------

        if (
            carData.owner &&
            carData.owner.toString() === req.session.userId.toString()
        ) {
            return res.status(403).json({
                success: false,
                message: "You cannot book your own car."
            });
        }

        // -------------------------------------------------
        // GENERAL CAR AVAILABILITY
        // -------------------------------------------------

        if (carData.isAvailable === false) {
            return res.status(400).json({
                success: false,
                message: "This car is currently not available."
            });
        }

        // -------------------------------------------------
        // DATE VALIDATION
        // -------------------------------------------------

        const pickup = new Date(pickupDate);
        const returnDateObj = new Date(returnDate);

        if (
            isNaN(pickup.getTime()) ||
            isNaN(returnDateObj.getTime())
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid pickup or return date."
            });
        }

        if (returnDateObj < pickup) {
            return res.status(400).json({
                success: false,
                message: "Return date cannot be before pickup date."
            });
        }

        // -------------------------------------------------
        // DATE CALCULATION
        // Same-day booking = 1 day
        // -------------------------------------------------

        const diffTime =
            returnDateObj.getTime() - pickup.getTime();

        let totalDays = Math.ceil(
            diffTime / (1000 * 60 * 60 * 24)
        );

        if (totalDays < 1) {
            totalDays = 1;
        }

        // -------------------------------------------------
        // CAR PRICE
        // Price always comes from database
        // Never trust frontend price
        // -------------------------------------------------

        const pricePerDay = Number(carData.pricePerDay);

        if (
            isNaN(pricePerDay) ||
            pricePerDay < 0
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid car price."
            });
        }

        // -------------------------------------------------
        // TOTAL AMOUNT
        // Backend calculates the final amount
        // -------------------------------------------------

        const totalAmount = pricePerDay * totalDays;

        // -------------------------------------------------
        // CREATE BOOKING
        // Booking starts as PENDING
        // -------------------------------------------------

        const booking = new Booking({
            car: carData._id,

            renter: req.session.userId,

            owner: carData.owner,

            name: name.trim(),

            email: email.toLowerCase().trim(),

            phone: phone.trim(),

            pickupLocation: pickupLocation.trim(),

            startDate: pickup,

            endDate: returnDateObj,

            totalDays: totalDays,

            pricePerDay: pricePerDay,

            totalAmount: totalAmount,

            actualReturnDate: null,

            status: "pending"
        });

        await booking.save();

        // -------------------------------------------------
// NOTIFICATION TO CAR OWNER
// -------------------------------------------------

await Notification.create({
    user: booking.owner,
    booking: booking._id,
    message: `New booking request received for ${carData.name}.`,
    type: "new_booking"
});
        // -------------------------------------------------
        // RESPONSE
        // -------------------------------------------------

        return res.status(201).json({
            success: true,
            message:
                "Booking request sent successfully. Waiting for owner confirmation.",
            booking
        });

    } catch (error) {
        console.error("Create Booking Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to create booking."
        });
    }
});


// =====================================================
// 2. GET LOGGED-IN USER BOOKINGS
// Customer sees ONLY their own bookings
// =====================================================

router.get("/my-bookings", async (req, res) => {
    try {
        // -------------------------------------------------
        // LOGIN CHECK
        // -------------------------------------------------

        if (!req.session.userId) {
            return res.status(401).json({
                success: false,
                message: "Please login first."
            });
        }

        // -------------------------------------------------
        // FIND ONLY CURRENT USER'S BOOKINGS
        // -------------------------------------------------

        const bookings = await Booking.find({
            renter: req.session.userId
        })
            .populate("car")
            .populate("owner", "name email")
            .sort({ createdAt: -1 })
            .lean();

        return res.status(200).json({
            success: true,
            bookings: bookings || []
        });

    } catch (error) {
        console.error("My Bookings Fetch Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch your bookings.",
            bookings: []
        });
    }
});


// =====================================================
// 3. GET ALL BOOKINGS
// TEMPORARY OWNER DASHBOARD DATA
// =====================================================

router.get("/", async (req, res) => {
    try {
        if (!req.session.userId) {
            return res.status(401).json({
                success: false,
                message: "Please login first."
            });
        }

        const bookings = await Booking.find()
            .populate("car")
            .populate("renter", "name email")
            .populate("owner", "name email")
            .sort({ createdAt: -1 });

        return res.status(200).json({
            success: true,
            bookings
        });

    } catch (error) {
        console.error("Get Bookings Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch bookings."
        });
    }
});


// =====================================================
// 4. TEMPORARY UPDATE BOOKING STATUS
// =====================================================

router.post("/update-status", async (req, res) => {
    try {
        if (!req.session.userId) {
            return res.status(401).json({
                success: false,
                message: "Please login first."
            });
        }

        const {
            bookingId,
            status
        } = req.body;

        if (!bookingId || !status) {
            return res.status(400).json({
                success: false,
                message: "Booking ID and status are required."
            });
        }

        const allowedStatuses = [
            "pending",
            "confirmed",
            "cancelled",
            "completed"
        ];

        if (!allowedStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: "Invalid booking status."
            });
        }

        const booking = await Booking.findById(bookingId);

        if (!booking) {
            return res.status(404).json({
                success: false,
                message: "Booking not found."
            });
        }

        const isRenter =
            booking.renter &&
            booking.renter.toString() ===
                req.session.userId.toString();

        const isOwner =
            booking.owner &&
            booking.owner.toString() ===
                req.session.userId.toString();

        if (!isRenter && !isOwner) {
            return res.status(403).json({
                success: false,
                message: "You are not allowed to update this booking."
            });
        }

        booking.status = status;

        await booking.save();

        return res.status(200).json({
            success: true,
            message: "Booking status updated successfully.",
            booking
        });

    } catch (error) {
        console.error("Status Update Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to update booking status."
        });
    }
});


// =====================================================
// 5. OWNER CONFIRM BOOKING
// pending → confirmed
// =====================================================

router.post("/:id/confirm", async (req, res) => {
    try {
        // -------------------------------------------------
        // LOGIN CHECK
        // -------------------------------------------------

        if (!req.session.userId) {
            return res.status(401).json({
                success: false,
                message: "Please login first."
            });
        }

        // -------------------------------------------------
        // FIND BOOKING
        // -------------------------------------------------

        const booking = await Booking.findById(req.params.id);

        if (!booking) {
            return res.status(404).json({
                success: false,
                message: "Booking not found."
            });
        }

        // -------------------------------------------------
        // ONLY PENDING BOOKING CAN BE CONFIRMED
        // -------------------------------------------------

        if (booking.status !== "pending") {
            return res.status(400).json({
                success: false,
                message:
                    `This booking is already ${booking.status}.`
            });
        }

        // -------------------------------------------------
        // CHECK OWNER
        // -------------------------------------------------

        if (
            !booking.owner ||
            booking.owner.toString() !==
                req.session.userId.toString()
        ) {
            return res.status(403).json({
                success: false,
                message:
                    "You are not allowed to confirm this booking."
            });
        }

        // -------------------------------------------------
        // CHECK EXISTING CONFIRMED BOOKING
        // Same car + overlapping dates
        // -------------------------------------------------

        const existingConfirmedBooking = await Booking.findOne({
            _id: {
                $ne: booking._id
            },

            car: booking.car,

            status: "confirmed",

            startDate: {
                $lt: booking.endDate
            },

            endDate: {
                $gt: booking.startDate
            }
        });

        if (existingConfirmedBooking) {
            return res.status(400).json({
                success: false,
                message:
                    "This car is already booked for the selected dates."
            });
        }

        // -------------------------------------------------
        // CONFIRM BOOKING
        // -------------------------------------------------

        booking.status = "confirmed";

        await booking.save();

        // -------------------------------------------------
// NOTIFICATION TO CUSTOMER
// -------------------------------------------------

await Notification.create({
    user: booking.renter,
    booking: booking._id,
    message: "Your booking has been confirmed by the car owner.",
    type: "booking_confirmed"
});
       // -------------------------------------------------
// CANCEL OTHER OVERLAPPING PENDING BOOKINGS
// -------------------------------------------------

const overlappingBookings = await Booking.find({
    _id: {
        $ne: booking._id
    },

    car: booking.car,

    status: "pending",

    startDate: {
        $lt: booking.endDate
    },

    endDate: {
        $gt: booking.startDate
    }
});

for (const otherBooking of overlappingBookings) {

    otherBooking.status = "cancelled";

    await otherBooking.save();

    // Notification to affected customer
    await Notification.create({
        user: otherBooking.renter,
        booking: otherBooking._id,
        message:
            "Your booking was automatically cancelled because another booking for this car was confirmed.",
        type: "booking_auto_cancelled"
    });
}
        // -------------------------------------------------
        // RESPONSE
        // -------------------------------------------------

        return res.status(200).json({
            success: true,
            message: "Booking confirmed successfully.",
            booking
        });

    } catch (error) {
        console.error("Confirm Booking Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to confirm booking."
        });
    }
});


// =====================================================
// 6. OWNER CANCEL BOOKING
// pending → cancelled
// =====================================================

router.post("/:id/cancel", async (req, res) => {
    try {
        // -------------------------------------------------
        // LOGIN CHECK
        // -------------------------------------------------

        if (!req.session.userId) {
            return res.status(401).json({
                success: false,
                message: "Please login first."
            });
        }

        // -------------------------------------------------
        // FIND BOOKING
        // -------------------------------------------------

        const booking = await Booking.findById(req.params.id);

        if (!booking) {
            return res.status(404).json({
                success: false,
                message: "Booking not found."
            });
        }

        // -------------------------------------------------
        // ONLY OWNER CAN CANCEL
        // -------------------------------------------------

        if (
            !booking.owner ||
            booking.owner.toString() !==
                req.session.userId.toString()
        ) {
            return res.status(403).json({
                success: false,
                message:
                    "You are not allowed to cancel this booking."
            });
        }

        // -------------------------------------------------
        // ONLY PENDING BOOKING CAN BE CANCELLED
        // -------------------------------------------------

        if (booking.status !== "pending") {
            return res.status(400).json({
                success: false,
                message:
                    `This booking cannot be cancelled because it is already ${booking.status}.`
            });
        }

        // -------------------------------------------------
        // CANCEL BOOKING
        // -------------------------------------------------

        booking.status = "cancelled";

        await booking.save();

        // -------------------------------------------------
// NOTIFICATION TO CUSTOMER
// -------------------------------------------------

await Notification.create({
    user: booking.renter,
    booking: booking._id,
    message: "The car owner has cancelled your booking request.",
    type: "booking_cancelled"
});
        // -------------------------------------------------
        // RESPONSE
        // -------------------------------------------------

        return res.status(200).json({
            success: true,
            message: "Booking cancelled successfully.",
            booking
        });

    } catch (error) {
        console.error("Owner Cancel Booking Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to cancel booking."
        });
    }
});


// =====================================================
// 7. CUSTOMER CANCEL BOOKING
// pending → cancelled
// =====================================================

router.post("/:id/customer-cancel", async (req, res) => {
    try {
        // -------------------------------------------------
        // LOGIN CHECK
        // -------------------------------------------------

        if (!req.session.userId) {
            return res.status(401).json({
                success: false,
                message: "Please login first."
            });
        }

        // -------------------------------------------------
        // FIND BOOKING
        // -------------------------------------------------

        const booking = await Booking.findById(req.params.id);

        if (!booking) {
            return res.status(404).json({
                success: false,
                message: "Booking not found."
            });
        }

        // -------------------------------------------------
        // ONLY RENTER CAN CANCEL
        // -------------------------------------------------

        if (
            !booking.renter ||
            booking.renter.toString() !==
                req.session.userId.toString()
        ) {
            return res.status(403).json({
                success: false,
                message:
                    "You are not allowed to cancel this booking."
            });
        }

        // -------------------------------------------------
        // ONLY PENDING BOOKING CAN BE CANCELLED
        // -------------------------------------------------

        if (booking.status !== "pending") {
            return res.status(400).json({
                success: false,
                message:
                    `This booking cannot be cancelled because it is already ${booking.status}.`
            });
        }

        // -------------------------------------------------
        // CANCEL BOOKING
        // -------------------------------------------------

        booking.status = "cancelled";

        await booking.save();

        // -------------------------------------------------
// NOTIFICATION TO OWNER
// -------------------------------------------------

await Notification.create({
    user: booking.owner,
    booking: booking._id,
    message: "The customer has cancelled the booking request.",
    type: "booking_cancelled"
});
        // -------------------------------------------------
        // RESPONSE
        // -------------------------------------------------

        return res.status(200).json({
            success: true,
            message: "Booking cancelled successfully.",
            booking
        });

    } catch (error) {
        console.error(
            "Customer Cancel Booking Error:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Failed to cancel booking."
        });
    }
});

// =====================================================
// 8. OWNER COMPLETE BOOKING
// confirmed → completed
// =====================================================

router.post("/:id/complete", async (req, res) => {
    try {
        // -------------------------------------------------
        // LOGIN CHECK
        // -------------------------------------------------

        if (!req.session.userId) {
            return res.status(401).json({
                success: false,
                message: "Please login first."
            });
        }

        // -------------------------------------------------
        // FIND BOOKING
        // -------------------------------------------------

        const booking = await Booking.findById(req.params.id);

        if (!booking) {
            return res.status(404).json({
                success: false,
                message: "Booking not found."
            });
        }

        // -------------------------------------------------
        // ONLY OWNER CAN COMPLETE BOOKING
        // -------------------------------------------------

        if (
            !booking.owner ||
            booking.owner.toString() !==
                req.session.userId.toString()
        ) {
            return res.status(403).json({
                success: false,
                message:
                    "You are not allowed to complete this booking."
            });
        }

        // -------------------------------------------------
        // ONLY CONFIRMED BOOKING CAN BE COMPLETED
        // -------------------------------------------------

        if (booking.status !== "confirmed") {
            return res.status(400).json({
                success: false,
                message:
                    `This booking cannot be completed because it is ${booking.status}.`
            });
        }

        // -------------------------------------------------
        // SET ACTUAL RETURN DATE
        // -------------------------------------------------

        booking.actualReturnDate = new Date();

        // -------------------------------------------------
        // COMPLETE BOOKING
        // -------------------------------------------------

        booking.status = "completed";

        await booking.save();

        // -------------------------------------------------
// NOTIFICATION TO CUSTOMER
// -------------------------------------------------

await Notification.create({
    user: booking.renter,
    booking: booking._id,
    message: "Your rental has been completed successfully.",
    type: "booking_completed"
});
        // -------------------------------------------------
        // RESPONSE
        // -------------------------------------------------

        return res.status(200).json({
            success: true,
            message: "Booking completed successfully.",
            booking
        });

    } catch (error) {
        console.error(
            "Complete Booking Error:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Failed to complete booking."
        });
    }
});
// =====================================================
// 8. GET SINGLE BOOKING
// MUST BE LAST
// =====================================================

router.get("/:id", async (req, res) => {
    try {
        // -------------------------------------------------
        // LOGIN CHECK
        // -------------------------------------------------

        if (!req.session.userId) {
            return res.status(401).json({
                success: false,
                message: "Please login first."
            });
        }

        // -------------------------------------------------
        // FIND BOOKING
        // -------------------------------------------------

        const booking = await Booking.findById(req.params.id)
            .populate("car")
            .populate("renter", "name email")
            .populate("owner", "name email");

        if (!booking) {
            return res.status(404).json({
                success: false,
                message: "Booking not found."
            });
        }

        // -------------------------------------------------
        // SECURITY
        // Only renter or owner can see this booking
        // -------------------------------------------------

        const isRenter =
            booking.renter &&
            booking.renter._id.toString() ===
                req.session.userId.toString();

        const isOwner =
            booking.owner &&
            booking.owner._id.toString() ===
                req.session.userId.toString();

        if (!isRenter && !isOwner) {
            return res.status(403).json({
                success: false,
                message:
                    "You are not allowed to view this booking."
            });
        }

        // -------------------------------------------------
        // RESPONSE
        // -------------------------------------------------

        return res.status(200).json({
            success: true,
            booking
        });

    } catch (error) {
        console.error("Get Booking Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch booking."
        });
    }
});


module.exports = router;