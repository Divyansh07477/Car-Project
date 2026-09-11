const express = require("express");
const router = express.Router();

const Booking = require("../models/Booking");
const Car = require("../models/Car");
const Notification = require("../models/Notification");


// =====================================================
// 1. OWNER BOOKINGS
// Logged-in owner sees ONLY bookings for their own cars
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
// Customer creates a PENDING booking request
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
        // -------------------------------------------------

        if (
            carData.owner &&
            carData.owner.toString() ===
            req.session.userId.toString()
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
        // CHECK CONFIRMED BOOKING DATE OVERLAP
        // -------------------------------------------------

        const overlappingBooking = await Booking.findOne({
            car: carData._id,
            status: "confirmed",
            startDate: {
                $lt: returnDateObj
            },
            endDate: {
                $gt: pickup
            }
        });

        if (overlappingBooking) {

            return res.status(400).json({
                success: false,
                message:
                    "This car is already booked for the selected dates.",
                bookedFrom:
                    overlappingBooking.startDate,
                bookedUntil:
                    overlappingBooking.endDate
            });
        }


        // -------------------------------------------------
        // DATE CALCULATION
        // Same-day booking = 1 day
        // -------------------------------------------------

        const diffTime =
            returnDateObj.getTime() -
            pickup.getTime();

        let totalDays = Math.ceil(
            diffTime /
            (1000 * 60 * 60 * 24)
        );

        if (totalDays < 1) {
            totalDays = 1;
        }


        // -------------------------------------------------
        // CAR PRICE
        // -------------------------------------------------

        const pricePerDay =
            Number(carData.pricePerDay);

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
        // -------------------------------------------------

        const totalAmount =
            pricePerDay * totalDays;


        // =================================================
        // CREATE BOOKING
        // =================================================

        const booking = new Booking({

            car: carData._id,

            renter: req.session.userId,

            owner: carData.owner,

            name: name.trim(),

            email: email
                .toLowerCase()
                .trim(),

            phone: phone.trim(),

            pickupLocation:
                pickupLocation.trim(),

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


        // -------------------------------------------------
        // NOTIFICATION TO CAR OWNER
        // -------------------------------------------------

        await Notification.create({

            user: booking.owner,

            booking: booking._id,

            message:
                `New booking request received for ${carData.name}.`,

            type: "new_booking"

        });


        return res.status(201).json({

            success: true,

            message:
                "Booking request sent successfully. Waiting for owner confirmation.",

            booking

        });

    } catch (error) {

        console.error(
            "Create Booking Error:",
            error
        );

        return res.status(500).json({

            success: false,

            message:
                "Failed to create booking."

        });
    }
});


// =====================================================
// 3. GET LOGGED-IN USER BOOKINGS
// Customer sees ONLY their own bookings
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

        console.error(
            "My Bookings Fetch Error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Failed to fetch your bookings.",
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

        console.error(
            "Get Bookings Error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Failed to fetch bookings."
        });
    }
});


// =====================================================
// 5. UPDATE BOOKING STATUS
//
// OWNER ONLY
//
// pending   -> confirmed
// pending   -> cancelled
// confirmed -> completed
// confirmed -> cancelled
//
// Paid + Cancelled    -> Refunded
// Pending + Cancelled -> Pending
// Failed + Cancelled  -> Failed
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
            status,
            note
        } = req.body;


        if (!bookingId || !status) {
            return res.status(400).json({
                success: false,
                message:
                    "Booking ID and status are required."
            });
        }


        const newStatus =
            String(status)
                .toLowerCase()
                .trim();


        const allowedStatuses = [
            "pending",
            "confirmed",
            "cancelled",
            "completed"
        ];


        if (
            !allowedStatuses.includes(newStatus)
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Invalid booking status."
            });
        }


        const booking =
            await Booking.findById(bookingId);


        if (!booking) {
            return res.status(404).json({
                success: false,
                message:
                    "Booking not found."
            });
        }


        // ONLY OWNER
        if (
            !booking.owner ||
            booking.owner.toString() !==
            req.session.userId.toString()
        ) {
            return res.status(403).json({
                success: false,
                message:
                    "Only the car owner can update this booking."
            });
        }


        if (
            booking.status === newStatus
        ) {
            return res.status(400).json({
                success: false,
                message:
                    `Booking is already ${newStatus}.`
            });
        }


        const validTransitions = {

            pending: [
                "confirmed",
                "cancelled"
            ],

            confirmed: [
                "completed",
                "cancelled"
            ],

            cancelled: [],

            completed: []

        };


        if (
            !validTransitions[booking.status] ||
            !validTransitions[booking.status].includes(newStatus)
        ) {
            return res.status(400).json({
                success: false,
                message:
                    `Cannot change booking from ${booking.status} to ${newStatus}.`
            });
        }


        const car =
            await Car.findById(
                booking.car
            );


        const carName =
            car && car.name
                ? car.name
                : "your car";


        // -------------------------------------------------
        // CONFIRM BOOKING
        // -------------------------------------------------

        if (newStatus === "confirmed") {

            const overlappingBooking =
                await Booking.findOne({

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


            if (overlappingBooking) {

                return res.status(400).json({

                    success: false,

                    message:
                        "This car is already booked for these dates."

                });
            }
        }


        // -------------------------------------------------
        // OWNER NOTE
        // -------------------------------------------------

        booking.note =
            typeof note === "string"
                ? note.trim()
                : "";


        // -------------------------------------------------
        // ACTUAL RETURN DATE
        // -------------------------------------------------

        if (newStatus === "completed") {

            booking.actualReturnDate =
                new Date();

        }


        // -------------------------------------------------
        // REFUND IF OWNER CANCELS PAID BOOKING
        // -------------------------------------------------

        let paymentWasRefunded = false;


        if (
            newStatus === "cancelled" &&
            booking.payment &&
            booking.payment.status
        ) {

            const currentPaymentStatus =
                String(
                    booking.payment.status
                )
                    .toLowerCase()
                    .trim();


            if (currentPaymentStatus === "paid") {

                booking.payment.status =
                    "Refunded";

                booking.payment.amountRemaining =
                    0;

                paymentWasRefunded = true;
            }
        }


        booking.status =
            newStatus;


        await booking.save();


        // -------------------------------------------------
        // NOTIFICATION TO RENTER
        // -------------------------------------------------

        let notificationMessage = "";
        let notificationType = "";


        if (newStatus === "confirmed") {

            notificationMessage =
                `Your booking for ${carName} has been confirmed by the owner.`;

            notificationType =
                "booking_confirmed";
        }


        if (newStatus === "cancelled") {

            if (paymentWasRefunded) {

                notificationMessage =
                    `Your booking for ${carName} has been cancelled by the owner. Your payment has been marked as refunded.`;

            } else {

                notificationMessage =
                    `Your booking for ${carName} has been cancelled by the owner.`;
            }

            notificationType =
                "booking_cancelled";
        }


        if (newStatus === "completed") {

            notificationMessage =
                `Your booking for ${carName} has been completed.`;

            notificationType =
                "booking_completed";
        }


        if (
            notificationMessage &&
            notificationType
        ) {

            await Notification.create({

                user:
                    booking.renter,

                booking:
                    booking._id,

                message:
                    notificationMessage,

                type:
                    notificationType

            });
        }


        // -------------------------------------------------
        // AUTO CANCEL OVERLAPPING PENDING BOOKINGS
        // -------------------------------------------------

        if (newStatus === "confirmed") {

            const overlappingBookings =
                await Booking.find({

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


            for (
                const otherBooking
                of overlappingBookings
            ) {

                otherBooking.status =
                    "cancelled";

                otherBooking.note =
                    "";


                if (
                    otherBooking.payment &&
                    otherBooking.payment.status &&
                    String(
                        otherBooking.payment.status
                    )
                        .toLowerCase()
                        .trim() === "paid"
                ) {

                    otherBooking.payment.status =
                        "Refunded";

                    otherBooking.payment.amountRemaining =
                        0;
                }


                await otherBooking.save();


                await Notification.create({

                    user:
                        otherBooking.renter,

                    booking:
                        otherBooking._id,

                    message:
                        `Your booking for ${carName} was automatically cancelled because the car was already booked for those dates.`,

                    type:
                        "booking_auto_cancelled"

                });
            }
        }


        const updatedBooking =
            await Booking.findById(
                booking._id
            )
                .populate("car")
                .populate(
                    "renter",
                    "name email"
                )
                .populate(
                    "owner",
                    "name email"
                );


        let responseMessage =
            `Booking ${newStatus} successfully.`;


        if (paymentWasRefunded) {

            responseMessage =
                "Booking cancelled successfully and payment marked as refunded.";
        }


        return res.status(200).json({

            success: true,

            message:
                responseMessage,

            booking:
                updatedBooking

        });

    } catch (error) {

        console.error(
            "Status Update Error:",
            error
        );

        return res.status(500).json({

            success: false,

            message:
                "Failed to update booking status."

        });

    }
});


// =====================================================
// 6. CHECK CAR AVAILABILITY
// =====================================================

router.get(
    "/availability/:carId",
    async (req, res) => {

        try {

            const {
                carId
            } = req.params;

            const {
                startDate,
                endDate
            } = req.query;


            if (
                !carId ||
                !startDate ||
                !endDate
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Car ID, start date and end date are required."

                });

            }


            const car =
                await Car.findById(
                    carId
                );


            if (!car) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Car not found."

                });

            }


            if (car.isAvailable === false) {

                return res.status(200).json({

                    success: true,

                    available: false,

                    message:
                        "This car is currently unavailable."

                });

            }


            const pickup =
                new Date(startDate);

            const returnDate =
                new Date(endDate);


            if (
                isNaN(pickup.getTime()) ||
                isNaN(returnDate.getTime())
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Invalid dates."

                });

            }


            if (returnDate < pickup) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Return date cannot be before pickup date."

                });

            }


            const overlappingBooking =
                await Booking.findOne({

                    car: carId,

                    status: "confirmed",

                    startDate: {
                        $lt: returnDate
                    },

                    endDate: {
                        $gt: pickup
                    }

                }).sort({

                    startDate: 1

                });


            if (overlappingBooking) {

                return res.status(200).json({

                    success: true,

                    available: false,

                    message:
                        "This car is already booked for the selected dates.",

                    bookedFrom:
                        overlappingBooking.startDate,

                    bookedUntil:
                        overlappingBooking.endDate

                });

            }


            return res.status(200).json({

                success: true,

                available: true,

                message:
                    "Car is available for the selected dates."

            });

        } catch (error) {

            console.error(
                "Car Availability Check Error:",
                error
            );

            return res.status(500).json({

                success: false,

                message:
                    "Failed to check car availability."

            });

        }
    }
);


// =====================================================
// 7. OWNER CONFIRM BOOKING
// pending → confirmed
// =====================================================

router.post(
    "/:id/confirm",
    async (req, res) => {

        try {

            if (!req.session.userId) {

                return res.status(401).json({

                    success: false,

                    message:
                        "Please login first."

                });

            }


            const booking =
                await Booking.findById(
                    req.params.id
                );


            if (!booking) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Booking not found."

                });

            }


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


            if (
                booking.status !==
                "pending"
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        `This booking is already ${booking.status}.`

                });

            }


            const existingConfirmedBooking =
                await Booking.findOne({

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


            booking.status =
                "confirmed";


            booking.note =
                typeof req.body.note === "string"
                    ? req.body.note.trim()
                    : "";


            if (!booking.payment) {

                booking.payment = {

                    status: "Pending",

                    method: "Other",

                    amountPaid: 0,

                    amountRemaining:
                        Number(
                            booking.totalAmount
                        ) || 0

                };

            }


            await booking.save();


            const car =
                await Car.findById(
                    booking.car
                );


            const carName =
                car && car.name
                    ? car.name
                    : "your car";


            await Notification.create({

                user:
                    booking.renter,

                booking:
                    booking._id,

                message:
                    `Your booking for ${carName} has been confirmed by the owner.`,

                type:
                    "booking_confirmed"

            });


            const overlappingBookings =
                await Booking.find({

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


            for (
                const otherBooking
                of overlappingBookings
            ) {

                otherBooking.status =
                    "cancelled";

                otherBooking.note =
                    "";


                if (
                    otherBooking.payment &&
                    otherBooking.payment.status &&
                    String(
                        otherBooking.payment.status
                    )
                        .toLowerCase()
                        .trim() === "paid"
                ) {

                    otherBooking.payment.status =
                        "Refunded";

                    otherBooking.payment.amountRemaining =
                        0;
                }


                await otherBooking.save();


                await Notification.create({

                    user:
                        otherBooking.renter,

                    booking:
                        otherBooking._id,

                    message:
                        `Your booking for ${carName} was automatically cancelled because the car was already booked for those dates.`,

                    type:
                        "booking_auto_cancelled"

                });
            }


            return res.status(200).json({

                success: true,

                message:
                    "Booking confirmed successfully.",

                booking

            });

        } catch (error) {

            console.error(
                "Confirm Booking Error:",
                error
            );

            return res.status(500).json({

                success: false,

                message:
                    "Failed to confirm booking."

            });

        }
    }
);


// =====================================================
// 8. OWNER CANCEL BOOKING
//
// pending / confirmed → cancelled
//
// Pending -> Pending
// Paid    -> Refunded
// =====================================================

router.post(
    "/:id/cancel",
    async (req, res) => {

        try {

            if (!req.session.userId) {

                return res.status(401).json({

                    success: false,

                    message:
                        "Please login first."

                });

            }


            const booking =
                await Booking.findById(
                    req.params.id
                );


            if (!booking) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Booking not found."

                });

            }


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


            if (
                booking.status !== "pending" &&
                booking.status !== "confirmed"
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        `This booking cannot be cancelled because it is already ${booking.status}.`

                });

            }


            booking.note =
                typeof req.body.note === "string"
                    ? req.body.note.trim()
                    : "";


            let paymentWasRefunded = false;


            if (
                booking.payment &&
                booking.payment.status &&
                String(
                    booking.payment.status
                )
                    .toLowerCase()
                    .trim() === "paid"
            ) {

                booking.payment.status =
                    "Refunded";

                booking.payment.amountRemaining =
                    0;

                paymentWasRefunded = true;
            }


            booking.status =
                "cancelled";


            await booking.save();


            const car =
                await Car.findById(
                    booking.car
                );


            const carName =
                car && car.name
                    ? car.name
                    : "your car";


            let notificationMessage =
                `Your booking for ${carName} has been cancelled by the owner.`;


            if (paymentWasRefunded) {

                notificationMessage =
                    `Your booking for ${carName} has been cancelled by the owner. Your payment has been marked as refunded.`;
            }


            await Notification.create({

                user:
                    booking.renter,

                booking:
                    booking._id,

                message:
                    notificationMessage,

                type:
                    "booking_cancelled"

            });


            return res.status(200).json({

                success: true,

                message:
                    paymentWasRefunded
                        ? "Booking cancelled and payment marked as refunded."
                        : "Booking cancelled successfully.",

                booking

            });

        } catch (error) {

            console.error(
                "Owner Cancel Booking Error:",
                error
            );

            return res.status(500).json({

                success: false,

                message:
                    "Failed to cancel booking."

            });

        }
    }
);


// =====================================================
// 9. CUSTOMER CANCEL BOOKING
//
// pending   -> cancelled
// confirmed -> cancelled IF NOT PAID
//
// PAID      -> NOT ALLOWED
// REFUNDED  -> NOT ALLOWED
// completed -> NOT ALLOWED
//
// OWNER WILL SEE:
// "User Cancelled"
// =====================================================

router.post(
    "/:id/customer-cancel",
    async (req, res) => {

        try {

            // -------------------------------------------------
            // LOGIN CHECK
            // -------------------------------------------------

            if (!req.session.userId) {

                return res.status(401).json({

                    success: false,

                    message:
                        "Please login first."

                });

            }


            // -------------------------------------------------
            // FIND BOOKING
            // -------------------------------------------------

            const booking =
                await Booking.findById(
                    req.params.id
                );


            if (!booking) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Booking not found."

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
            // ALLOW PENDING AND CONFIRMED
            // -------------------------------------------------

            if (
                booking.status !== "pending" &&
                booking.status !== "confirmed"
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        `This booking cannot be cancelled because it is already ${booking.status}.`

                });

            }


            // -------------------------------------------------
            // PAYMENT CHECK
            // -------------------------------------------------

            let paymentStatus = "pending";


            if (
                booking.payment &&
                booking.payment.status
            ) {

                paymentStatus =
                    String(
                        booking.payment.status
                    )
                        .toLowerCase()
                        .trim();

            }


            // -------------------------------------------------
            // PAID BOOKING CANNOT BE CANCELLED BY USER
            // -------------------------------------------------

            if (
                paymentStatus === "paid" ||
                paymentStatus === "refunded"
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "You cannot cancel this booking after payment."

                });

            }


            // -------------------------------------------------
            // GET CAR
            // -------------------------------------------------

            const car =
                await Car.findById(
                    booking.car
                );


            const carName =
                car && car.name
                    ? car.name
                    : "the car";


            // -------------------------------------------------
            // IMPORTANT:
            // SAVE USER CANCELLATION NOTE
            // -------------------------------------------------

            booking.note =
                "User Cancelled";


            // -------------------------------------------------
            // CANCEL BOOKING
            // -------------------------------------------------

            booking.status =
                "cancelled";


            await booking.save();


            // -------------------------------------------------
            // NOTIFY OWNER
            // -------------------------------------------------

            await Notification.create({

                user:
                    booking.owner,

                booking:
                    booking._id,

                message:
                    `User Cancelled the booking for ${carName}.`,

                type:
                    "booking_cancelled"

            });


            // -------------------------------------------------
            // RESPONSE
            // -------------------------------------------------

            return res.status(200).json({

                success: true,

                message:
                    "Booking cancelled successfully.",

                booking

            });


        } catch (error) {

            console.error(
                "Customer Cancel Booking Error:",
                error
            );


            return res.status(500).json({

                success: false,

                message:
                    "Failed to cancel booking."

            });

        }
    }
);


// =====================================================
// 10. OWNER COMPLETE BOOKING
// confirmed → completed
// =====================================================

router.post(
    "/:id/complete",
    async (req, res) => {

        try {

            if (!req.session.userId) {

                return res.status(401).json({

                    success: false,

                    message:
                        "Please login first."

                });

            }


            const booking =
                await Booking.findById(
                    req.params.id
                );


            if (!booking) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Booking not found."

                });

            }


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


            if (
                booking.status !==
                "confirmed"
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        `This booking cannot be completed because it is ${booking.status}.`

                });

            }


            booking.note =
                typeof req.body.note === "string"
                    ? req.body.note.trim()
                    : "";


            booking.actualReturnDate =
                new Date();


            booking.status =
                "completed";


            await booking.save();


            const car =
                await Car.findById(
                    booking.car
                );


            const carName =
                car && car.name
                    ? car.name
                    : "your car";


            await Notification.create({

                user:
                    booking.renter,

                booking:
                    booking._id,

                message:
                    `Your booking for ${carName} has been completed.`,

                type:
                    "booking_completed"

            });


            return res.status(200).json({

                success: true,

                message:
                    "Booking completed successfully.",

                booking

            });

        } catch (error) {

            console.error(
                "Complete Booking Error:",
                error
            );

            return res.status(500).json({

                success: false,

                message:
                    "Failed to update booking."

            });

        }
    }
);


// =====================================================
// 11. GET SINGLE BOOKING
// MUST BE LAST
// =====================================================

router.get(
    "/:id",
    async (req, res) => {

        try {

            if (!req.session.userId) {

                return res.status(401).json({

                    success: false,

                    message:
                        "Please login first."

                });

            }


            const booking =
                await Booking.findById(
                    req.params.id
                )
                    .populate("car")
                    .populate(
                        "renter",
                        "name email"
                    )
                    .populate(
                        "owner",
                        "name email"
                    );


            if (!booking) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Booking not found."

                });

            }


            const isRenter =
                booking.renter &&
                booking.renter._id
                    .toString() ===
                req.session.userId.toString();


            const isOwner =
                booking.owner &&
                booking.owner._id
                    .toString() ===
                req.session.userId.toString();


            if (
                !isRenter &&
                !isOwner
            ) {

                return res.status(403).json({

                    success: false,

                    message:
                        "You are not allowed to view this booking."

                });

            }


            return res.status(200).json({

                success: true,

                booking

            });

        } catch (error) {

            console.error(
                "Get Booking Error:",
                error
            );

            return res.status(500).json({

                success: false,

                message:
                    "Failed to fetch booking."

            });

        }
    }
);


module.exports = router;