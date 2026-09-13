const express = require("express");
const router = express.Router();

const Booking = require("../models/Booking");
const Car = require("../models/Car");
const Notification = require("../models/Notification");


// =====================================================
// 1. OWNER BOOKINGS
// =====================================================
router.get("/owner-bookings", async (req, res) => {
    try {
        if (!req.session.userId) {
            return res.status(401).json({
                success: false,
                message: "Please login first."
            });
        }

        const bookings = await Booking.find({
            owner: req.session.userId
        })
            .populate("car")
            .populate("renter", "name email")
            .populate("owner", "name email")
            .sort({ createdAt: -1 });

        return res.status(200).json({
            success: true,
            bookings: bookings || []
        });
    } catch (error) {
        console.error("Owner Bookings Fetch Error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch owner bookings.",
            bookings: []
        });
    }
});


// =====================================================
// 2. CREATE BOOKING
// =====================================================
router.post("/", async (req, res) => {
    try {
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

        if (!car || !name || !email || !phone || !pickupLocation || !pickupDate || !returnDate) {
            return res.status(400).json({
                success: false,
                message: "Please fill all fields."
            });
        }

        const carData = await Car.findById(car);
        if (!carData) {
            return res.status(404).json({
                success: false,
                message: "Car not found."
            });
        }

        if (carData.owner && carData.owner.toString() === req.session.userId.toString()) {
            return res.status(403).json({
                success: false,
                message: "You cannot book your own car."
            });
        }

        if (carData.isAvailable === false) {
            return res.status(400).json({
                success: false,
                message: "This car is currently not available."
            });
        }

        const pickup = new Date(pickupDate);
        const returnDateObj = new Date(returnDate);

        if (isNaN(pickup.getTime()) || isNaN(returnDateObj.getTime())) {
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

        // Sirf PAID booking se clash roko (Pending/Confirmed unpaid se request block mat karo)
        const overlappingPaidBooking = await Booking.findOne({
            car: carData._id,
            status: "confirmed",
            "payment.status": "Paid",
            startDate: { $lt: returnDateObj },
            endDate: { $gt: pickup }
        });

        if (overlappingPaidBooking) {
            return res.status(400).json({
                success: false,
                message: "This car is already booked and paid for the selected dates."
            });
        }

        const diffTime = returnDateObj.getTime() - pickup.getTime();
        let totalDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (totalDays < 1) totalDays = 1;

        const pricePerDay = Number(carData.pricePerDay);
        if (isNaN(pricePerDay) || pricePerDay < 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid car price."
            });
        }

        const totalAmount = pricePerDay * totalDays;

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
            payment: {
                status: "Pending",
                method: "Other",
                amountPaid: 0,
                amountRemaining: totalAmount
            },
            actualReturnDate: null,
            note: "",
            status: "pending"
        });

        await booking.save();

        await Notification.create({
            user: booking.owner,
            booking: booking._id,
            message: `New booking request received for ${carData.name}.`,
            type: "new_booking"
        });

        return res.status(201).json({
            success: true,
            message: "Booking request sent successfully. Waiting for owner confirmation.",
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
// 3. GET LOGGED-IN USER BOOKINGS
// =====================================================
router.get("/my-bookings", async (req, res) => {
    try {
        if (!req.session.userId) {
            return res.status(401).json({
                success: false,
                message: "Please login first."
            });
        }

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
// 4. GET ALL BOOKINGS
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
// 5. UPDATE BOOKING STATUS (OWNER ONLY)
// NOTE: Dusre user ki booking yahan cancel NAHI hogi
// =====================================================
router.post("/update-status", async (req, res) => {
    try {
        if (!req.session.userId) {
            return res.status(401).json({
                success: false,
                message: "Please login first."
            });
        }

        const { bookingId, status, note } = req.body;

        if (!bookingId || !status) {
            return res.status(400).json({
                success: false,
                message: "Booking ID and status are required."
            });
        }

        const newStatus = String(status).toLowerCase().trim();
        const allowedStatuses = ["pending", "confirmed", "cancelled", "completed"];

        if (!allowedStatuses.includes(newStatus)) {
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

        if (!booking.owner || booking.owner.toString() !== req.session.userId.toString()) {
            return res.status(403).json({
                success: false,
                message: "Only the car owner can update this booking."
            });
        }

        if (booking.status === newStatus) {
            return res.status(400).json({
                success: false,
                message: `Booking is already ${newStatus}.`
            });
        }

        const validTransitions = {
            pending: ["confirmed", "cancelled"],
            confirmed: ["completed", "cancelled"],
            cancelled: [],
            completed: []
        };

        if (!validTransitions[booking.status] || !validTransitions[booking.status].includes(newStatus)) {
            return res.status(400).json({
                success: false,
                message: `Cannot change booking from ${booking.status} to ${newStatus}.`
            });
        }

        const car = await Car.findById(booking.car);
        const carName = car && car.name ? car.name : "your car";

        // Agar kisi ne pehle hi PAY kar diya hai is date par, tabhi confirm block hoga
        if (newStatus === "confirmed") {
            const paidBooking = await Booking.findOne({
                _id: { $ne: booking._id },
                car: booking.car,
                status: "confirmed",
                "payment.status": "Paid",
                startDate: { $lt: booking.endDate },
                endDate: { $gt: booking.startDate }
            });

            if (paidBooking) {
                return res.status(400).json({
                    success: false,
                    message: "Slot already locked by another user who completed payment."
                });
            }
        }

        booking.note = typeof note === "string" ? note.trim() : "";
        if (newStatus === "completed") {
            booking.actualReturnDate = new Date();
        }

        let paymentWasRefunded = false;
        if (newStatus === "cancelled" && booking.payment && booking.payment.status) {
            const currentPaymentStatus = String(booking.payment.status).toLowerCase().trim();
            if (currentPaymentStatus === "paid") {
                booking.payment.status = "Refunded";
                booking.payment.amountRemaining = 0;
                paymentWasRefunded = true;
            }
        }

        booking.status = newStatus;
        await booking.save();

        // Notification
        let notificationMessage = "";
        let notificationType = "";

        if (newStatus === "confirmed") {
            notificationMessage = `Your booking for ${carName} has been approved by the owner! Please complete payment to reserve your car.`;
            notificationType = "booking_confirmed";
        } else if (newStatus === "cancelled") {
            notificationMessage = paymentWasRefunded
                ? `Your booking for ${carName} has been cancelled by the owner. Your payment has been marked as refunded.`
                : `Your booking for ${carName} has been cancelled by the owner.`;
            notificationType = "booking_cancelled";
        } else if (newStatus === "completed") {
            notificationMessage = `Your booking for ${carName} has been completed.`;
            notificationType = "booking_completed";
        }

        if (notificationMessage && notificationType) {
            await Notification.create({
                user: booking.renter,
                booking: booking._id,
                message: notificationMessage,
                type: notificationType
            });
        }

        const updatedBooking = await Booking.findById(booking._id)
            .populate("car")
            .populate("renter", "name email")
            .populate("owner", "name email");

        return res.status(200).json({
            success: true,
            message: paymentWasRefunded ? "Booking cancelled and refunded." : `Booking ${newStatus} successfully.`,
            booking: updatedBooking
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
// 6. CHECK CAR AVAILABILITY
// =====================================================
router.get("/availability/:carId", async (req, res) => {
    try {
        const { carId } = req.params;
        const { startDate, endDate } = req.query;

        if (!carId || !startDate || !endDate) {
            return res.status(400).json({
                success: false,
                message: "Car ID, start date and end date are required."
            });
        }

        const car = await Car.findById(carId);
        if (!car) {
            return res.status(404).json({
                success: false,
                message: "Car not found."
            });
        }

        if (car.isAvailable === false) {
            return res.status(200).json({
                success: true,
                available: false,
                message: "This car is currently unavailable."
            });
        }

        const pickup = new Date(startDate);
        const returnDate = new Date(endDate);

        if (isNaN(pickup.getTime()) || isNaN(returnDate.getTime()) || returnDate < pickup) {
            return res.status(400).json({
                success: false,
                message: "Invalid dates."
            });
        }

        // Sirf PAID booking par unavailable bolna hai
        const overlappingBooking = await Booking.findOne({
            car: carId,
            status: "confirmed",
            "payment.status": "Paid",
            startDate: { $lt: returnDate },
            endDate: { $gt: pickup }
        });

        if (overlappingBooking) {
            return res.status(200).json({
                success: true,
                available: false,
                message: "This car is already booked and paid for the selected dates."
            });
        }

        return res.status(200).json({
            success: true,
            available: true,
            message: "Car is available for the selected dates."
        });

    } catch (error) {
        console.error("Car Availability Check Error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to check car availability."
        });
    }
});


// =====================================================
// 7. OWNER CONFIRM BOOKING (ALLOWS MULTIPLE CONFIRMS)
// =====================================================
router.post("/:id/confirm", async (req, res) => {
    try {
        if (!req.session.userId) {
            return res.status(401).json({
                success: false,
                message: "Please login first."
            });
        }

        const booking = await Booking.findById(req.params.id);
        if (!booking) {
            return res.status(404).json({
                success: false,
                message: "Booking not found."
            });
        }

        if (!booking.owner || booking.owner.toString() !== req.session.userId.toString()) {
            return res.status(403).json({
                success: false,
                message: "You are not allowed to confirm this booking."
            });
        }

        if (booking.status !== "pending") {
            return res.status(400).json({
                success: false,
                message: `This booking is already ${booking.status}.`
            });
        }

        // Sirf check karo agar kisi ne is car/dates ke liye pehle hi PAYMENT kar di hai
        const alreadyPaidBooking = await Booking.findOne({
            _id: { $ne: booking._id },
            car: booking.car,
            status: "confirmed",
            "payment.status": "Paid",
            startDate: { $lt: booking.endDate },
            endDate: { $gt: booking.startDate }
        });

        if (alreadyPaidBooking) {
            return res.status(400).json({
                success: false,
                message: "Cannot confirm. Another customer has already paid and locked these dates."
            });
        }

        booking.status = "confirmed";
        booking.note = typeof req.body.note === "string" ? req.body.note.trim() : "";

        if (!booking.payment) {
            booking.payment = {
                status: "Pending",
                method: "Other",
                amountPaid: 0,
                amountRemaining: Number(booking.totalAmount) || 0
            };
        }

        await booking.save();

        const car = await Car.findById(booking.car);
        const carName = car && car.name ? car.name : "your car";

        await Notification.create({
            user: booking.renter,
            booking: booking._id,
            message: `Your booking request for ${carName} has been confirmed by the owner! Pay now to lock your dates.`,
            type: "booking_confirmed"
        });

        // NOTE: Yahan se overlapping booking auto-cancel wala code hata diya gaya hai!
        // Ab dono user confirmed rahenge jab tak koi ek payment na kar de.

        return res.status(200).json({
            success: true,
            message: "Booking confirmed successfully. Waiting for customer payment.",
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
// 8. OWNER CANCEL BOOKING
// =====================================================
router.post("/:id/cancel", async (req, res) => {
    try {
        if (!req.session.userId) {
            return res.status(401).json({
                success: false,
                message: "Please login first."
            });
        }

        const booking = await Booking.findById(req.params.id);
        if (!booking) {
            return res.status(404).json({
                success: false,
                message: "Booking not found."
            });
        }

        if (!booking.owner || booking.owner.toString() !== req.session.userId.toString()) {
            return res.status(403).json({
                success: false,
                message: "You are not allowed to cancel this booking."
            });
        }

        if (booking.status !== "pending" && booking.status !== "confirmed") {
            return res.status(400).json({
                success: false,
                message: `This booking cannot be cancelled because it is already ${booking.status}.`
            });
        }

        booking.note = typeof req.body.note === "string" ? req.body.note.trim() : "";
        let paymentWasRefunded = false;

        if (booking.payment && booking.payment.status && String(booking.payment.status).toLowerCase().trim() === "paid") {
            booking.payment.status = "Refunded";
            booking.payment.amountRemaining = 0;
            paymentWasRefunded = true;
        }

        booking.status = "cancelled";
        await booking.save();

        const car = await Car.findById(booking.car);
        const carName = car && car.name ? car.name : "your car";

        await Notification.create({
            user: booking.renter,
            booking: booking._id,
            message: paymentWasRefunded
                ? `Your booking for ${carName} has been cancelled by the owner. Your payment has been marked as refunded.`
                : `Your booking for ${carName} has been cancelled by the owner.`,
            type: "booking_cancelled"
        });

        return res.status(200).json({
            success: true,
            message: paymentWasRefunded
                ? "Booking cancelled and payment marked as refunded."
                : "Booking cancelled successfully.",
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
// 9. CUSTOMER CANCEL BOOKING
// =====================================================
router.post("/:id/customer-cancel", async (req, res) => {
    try {
        if (!req.session.userId) {
            return res.status(401).json({
                success: false,
                message: "Please login first."
            });
        }

        const booking = await Booking.findById(req.params.id);
        if (!booking) {
            return res.status(404).json({
                success: false,
                message: "Booking not found."
            });
        }

        if (!booking.renter || booking.renter.toString() !== req.session.userId.toString()) {
            return res.status(403).json({
                success: false,
                message: "You are not allowed to cancel this booking."
            });
        }

        if (booking.status !== "pending" && booking.status !== "confirmed") {
            return res.status(400).json({
                success: false,
                message: `This booking cannot be cancelled because it is already ${booking.status}.`
            });
        }

        let paymentStatus = booking.payment?.status ? String(booking.payment.status).toLowerCase().trim() : "pending";
        if (paymentStatus === "paid" || paymentStatus === "refunded") {
            return res.status(400).json({
                success: false,
                message: "You cannot cancel this booking after payment."
            });
        }

        const car = await Car.findById(booking.car);
        const carName = car && car.name ? car.name : "the car";

        booking.note = "User Cancelled";
        booking.status = "cancelled";
        await booking.save();

        await Notification.create({
            user: booking.owner,
            booking: booking._id,
            message: `User Cancelled the booking for ${carName}.`,
            type: "booking_cancelled"
        });

        return res.status(200).json({
            success: true,
            message: "Booking cancelled successfully.",
            booking
        });

    } catch (error) {
        console.error("Customer Cancel Booking Error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to cancel booking."
        });
    }
});


// =====================================================
// 10. OWNER COMPLETE BOOKING
// =====================================================
router.post("/:id/complete", async (req, res) => {
    try {
        if (!req.session.userId) {
            return res.status(401).json({
                success: false,
                message: "Please login first."
            });
        }

        const booking = await Booking.findById(req.params.id);
        if (!booking) {
            return res.status(404).json({
                success: false,
                message: "Booking not found."
            });
        }

        if (!booking.owner || booking.owner.toString() !== req.session.userId.toString()) {
            return res.status(403).json({
                success: false,
                message: "You are not allowed to complete this booking."
            });
        }

        if (booking.status !== "confirmed") {
            return res.status(400).json({
                success: false,
                message: `This booking cannot be completed because it is ${booking.status}.`
            });
        }

        booking.note = typeof req.body.note === "string" ? req.body.note.trim() : "";
        booking.actualReturnDate = new Date();
        booking.status = "completed";
        await booking.save();

        const car = await Car.findById(booking.car);
        const carName = car && car.name ? car.name : "your car";

        await Notification.create({
            user: booking.renter,
            booking: booking._id,
            message: `Your booking for ${carName} has been completed.`,
            type: "booking_completed"
        });

        return res.status(200).json({
            success: true,
            message: "Booking completed successfully.",
            booking
        });

    } catch (error) {
        console.error("Complete Booking Error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to update booking."
        });
    }
});


// =====================================================
// 11. GET SINGLE BOOKING
// =====================================================
router.get("/:id", async (req, res) => {
    try {
        if (!req.session.userId) {
            return res.status(401).json({
                success: false,
                message: "Please login first."
            });
        }

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

        const isRenter = booking.renter && booking.renter._id.toString() === req.session.userId.toString();
        const isOwner = booking.owner && booking.owner._id.toString() === req.session.userId.toString();

        if (!isRenter && !isOwner) {
            return res.status(403).json({
                success: false,
                message: "You are not allowed to view this booking."
            });
        }

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