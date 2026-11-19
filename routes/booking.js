
const express = require("express");
const router = express.Router();

const Booking = require("../models/Booking");
const Car = require("../models/Car");
const Notification = require("../models/Notification");

const multer = require("multer");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const mongoose = require("mongoose");


// =====================================================
// PRIVATE DOCUMENT STORAGE
// =====================================================

const DOCUMENT_DIR = path.resolve(__dirname, "../private_documents");

if (!fs.existsSync(DOCUMENT_DIR)) {
    fs.mkdirSync(DOCUMENT_DIR, { recursive: true });
}


// Only Driving Licence is uploaded now.
const documentUpload = multer({
    storage: multer.memoryStorage(),

    limits: {
        fileSize: 5 * 1024 * 1024,
        files: 1
    },

    fileFilter: (req, file, cb) => {

        const allowedExtensions = [".jpg", ".jpeg", ".png", ".pdf"];
        const extension = path.extname(file.originalname).toLowerCase();

        const allowedMimeTypes = [
            "image/jpeg",
            "image/png",
            "application/pdf"
        ];

        if (
            !allowedExtensions.includes(extension) ||
            !allowedMimeTypes.includes(file.mimetype)
        ) {
            return cb(
                new Error("Only JPG, PNG and PDF files are allowed.")
            );
        }

        cb(null, true);
    }
});


function handleDocumentUpload(req, res, next) {

    documentUpload.single("drivingLicenceDocument")(
        req,
        res,
        (error) => {

            if (error) {
                return res.status(400).json({
                    success: false,
                    message: error.message || "Document upload failed."
                });
            }

            next();
        }
    );
}


// =====================================================
// AUTHENTICATION HELPER
// =====================================================

function requireLogin(req, res, next) {

    if (!req.session || !req.session.userId) {
        return res.status(401).json({
            success: false,
            message: "Please login first."
        });
    }

    next();
}


// =====================================================
// FILE SIGNATURE VALIDATION
// =====================================================

function getActualFileType(buffer) {

    if (!buffer || buffer.length < 8) {
        return null;
    }

    // PDF
    if (buffer.subarray(0, 5).toString() === "%PDF-") {
        return {
            extension: ".pdf",
            mimeType: "application/pdf"
        };
    }

    // PNG
    if (
        buffer[0] === 0x89 &&
        buffer[1] === 0x50 &&
        buffer[2] === 0x4E &&
        buffer[3] === 0x47 &&
        buffer[4] === 0x0D &&
        buffer[5] === 0x0A &&
        buffer[6] === 0x1A &&
        buffer[7] === 0x0A
    ) {
        return {
            extension: ".png",
            mimeType: "image/png"
        };
    }

    // JPEG
    if (
        buffer[0] === 0xFF &&
        buffer[1] === 0xD8 &&
        buffer[2] === 0xFF
    ) {
        return {
            extension: ".jpg",
            mimeType: "image/jpeg"
        };
    }

    return null;
}


// =====================================================
// SAVE PRIVATE DOCUMENT
// =====================================================

async function savePrivateDocument(file) {

    if (!file || !file.buffer) {
        throw new Error("Driving Licence is required.");
    }

    const actualType = getActualFileType(file.buffer);

    if (!actualType) {
        throw new Error(
            "Invalid document file. Please upload a genuine JPG, PNG or PDF."
        );
    }

    const originalExtension =
        path.extname(file.originalname).toLowerCase();

    if (
        originalExtension === ".jpeg" &&
        actualType.extension === ".jpg"
    ) {
        // JPEG and JPG are equivalent.
    } else if (originalExtension !== actualType.extension) {
        throw new Error(
            "Document file extension does not match its content."
        );
    }

    const filename =
        `${crypto.randomUUID()}${actualType.extension}`;

    const filePath = path.join(DOCUMENT_DIR, filename);

    await fs.promises.writeFile(filePath, file.buffer, {
        flag: "wx",
        mode: 0o600
    });

    return {
        filename,
        path: filePath
    };
}


// =====================================================
// DELETE PRIVATE FILE HELPER
// =====================================================

async function deletePrivateFile(filePath) {

    if (!filePath) return;

    try {

        const resolvedPath = path.resolve(filePath);

        if (!resolvedPath.startsWith(DOCUMENT_DIR + path.sep)) {
            return;
        }

        await fs.promises.unlink(resolvedPath);

    } catch (error) {

        if (error.code !== "ENOENT") {
            console.error("Private document cleanup error:", error);
        }
    }
}


async function deleteBookingDocuments(files = []) {

    for (const file of files) {
        await deletePrivateFile(file.path);
    }
}


// =====================================================
// HELPER: REFUND IF PAID
// NOTE: Database status only. No actual money transfer.
// =====================================================

function refundIfPaid(booking) {

    const paymentStatus =
        booking.payment && booking.payment.status
            ? String(booking.payment.status).toLowerCase().trim()
            : "pending";

    if (paymentStatus !== "paid") return 0;

    const amount =
        Number(booking.payment.amountPaid) ||
        Number(booking.totalAmount) ||
        0;

    booking.payment.status = "Refunded";
    booking.payment.refundAmount = amount;
    booking.payment.refundedAt = new Date();
    booking.payment.amountRemaining = 0;

    return amount;
}


// =====================================================
// HELPER: CHECK BOOKING OWNERSHIP
// =====================================================

function isBookingOwner(booking, userId) {

    return booking.owner &&
        booking.owner.toString() === userId.toString();
}


function isBookingRenter(booking, userId) {

    return booking.renter &&
        booking.renter.toString() === userId.toString();
}


// =====================================================
// 1. OWNER BOOKINGS - MJ AI API
// =====================================================

router.get("/owner-bookings", requireLogin, async (req, res) => {

    try {

        const userCars = await Car.find({
            owner: req.session.userId
        }).select("_id");

        const carIds = userCars.map(car => car._id);

        const bookings = await Booking.find({
            car: { $in: carIds }
        })
            .select("-aadhaarNumber -aadhaarDocument -drivingLicenceDocument")
            .populate("car")
            .populate("renter", "name email")
            .populate("owner", "name email")
            .sort({ createdAt: -1 })
            .lean();

        return res.status(200).json({
            success: true,
            totalBookings: bookings.length,
            bookings
        });

    } catch (error) {

        console.error("MJ Owner Bookings Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch owner bookings.",
            bookings: []
        });
    }
});


// =====================================================
// 2. CREATE BOOKING
// Aadhaar upload removed.
// Aadhaar number optional.
// Driving Licence required.
// =====================================================

router.post(
    "/",
    requireLogin,
    handleDocumentUpload,
    async (req, res) => {

        let savedDocuments = [];

        try {

            const {
                car,
                name,
                email,
                phone,
                pickupLocation,
                pickupDate,
                returnDate,
                aadhaarNumber
            } = req.body;


            // BASIC VALIDATION

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
                    message: "Please fill all required booking fields."
                });
            }


            if (!mongoose.isValidObjectId(car)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid car ID."
                });
            }


            if (!/^[0-9]{10}$/.test(String(phone).trim())) {
                return res.status(400).json({
                    success: false,
                    message: "Please enter a valid 10-digit phone number."
                });
            }


            // Aadhaar number is optional.
            // If entered, it must contain exactly 12 digits.

            const cleanAadhaarNumber =
                typeof aadhaarNumber === "string"
                    ? aadhaarNumber.trim()
                    : "";

            if (
                cleanAadhaarNumber &&
                !/^[0-9]{12}$/.test(cleanAadhaarNumber)
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Please enter a valid 12-digit Aadhaar number."
                });
            }


            // ONLY DRIVING LICENCE REQUIRED

            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    message: "Please upload your Driving Licence."
                });
            }


            // FIND CAR

            const carData = await Car.findById(car);

            if (!carData) {
                return res.status(404).json({
                    success: false,
                    message: "Car not found."
                });
            }


            if (!carData.owner) {
                return res.status(400).json({
                    success: false,
                    message: "This car does not have a valid owner."
                });
            }


            if (
                carData.owner.toString() ===
                req.session.userId.toString()
            ) {
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


            // DATE VALIDATION

            const pickup = new Date(`${pickupDate}T00:00:00`);
            const returnDateObj = new Date(`${returnDate}T00:00:00`);

            if (
                isNaN(pickup.getTime()) ||
                isNaN(returnDateObj.getTime())
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid pickup or return date."
                });
            }


            if (returnDateObj <= pickup) {
                return res.status(400).json({
                    success: false,
                    message: "Return date must be after pickup date."
                });
            }


            // CHECK OVERLAPPING PAID BOOKING

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


            // PRICE CALCULATION

            const diffTime =
                returnDateObj.getTime() - pickup.getTime();

            const totalDays = Math.ceil(
                diffTime / (1000 * 60 * 60 * 24)
            );

            const pricePerDay = Number(carData.pricePerDay);

            if (
                !Number.isFinite(pricePerDay) ||
                pricePerDay <= 0
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid car price."
                });
            }


            const baseAmount = pricePerDay * totalDays;
            const gstAmount = baseAmount * 0.08;

            const totalAmount = Number(
                (baseAmount + gstAmount).toFixed(2)
            );


            // SAVE ONLY DRIVING LICENCE

            const licenceFile = await savePrivateDocument(req.file);

            savedDocuments.push(licenceFile);


            // CREATE BOOKING

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

                totalDays,

                pricePerDay,

                totalAmount,

                // Optional Aadhaar number. No Aadhaar photo stored.
                aadhaarNumber: cleanAadhaarNumber || undefined,

                // Only Driving Licence document is stored.
                drivingLicenceDocument: {
                    filename: licenceFile.filename,
                    path: licenceFile.path
                },

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


            // NOTIFICATION

            try {

                await Notification.create({
                    user: booking.owner,
                    booking: booking._id,
                    message: `New booking request received for ${carData.name}.`,
                    type: "new_booking"
                });

            } catch (notificationError) {

                console.error(
                    "Booking notification error:",
                    notificationError
                );
            }


            return res.status(201).json({

                success: true,

                message: "Booking request sent successfully. Waiting for owner confirmation.",

                booking: {
                    _id: booking._id,
                    status: booking.status,
                    totalDays: booking.totalDays,
                    totalAmount: booking.totalAmount
                }
            });


        } catch (error) {

            console.error("Create Booking Error:", error);

            await deleteBookingDocuments(savedDocuments);

            return res.status(500).json({
                success: false,
                message: "Failed to create booking."
            });
        }
    }
);


// =====================================================
// 3. GET LOGGED-IN USER BOOKINGS
// =====================================================

router.get("/my-bookings", requireLogin, async (req, res) => {

    try {

        const bookings = await Booking.find({
            renter: req.session.userId
        })
            .select("-aadhaarNumber -aadhaarDocument -drivingLicenceDocument")
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
// 4. GET BOOKINGS RELATED TO LOGGED-IN USER
// =====================================================

router.get("/", requireLogin, async (req, res) => {

    try {

        const bookings = await Booking.find({
            $or: [
                { renter: req.session.userId },
                { owner: req.session.userId }
            ]
        })
            .select("-aadhaarNumber -aadhaarDocument -drivingLicenceDocument")
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
// 5. UPDATE BOOKING STATUS - OWNER ONLY
// =====================================================

router.post("/update-status", requireLogin, async (req, res) => {

    try {

        const { bookingId, status, note } = req.body;

        if (!bookingId || !status) {
            return res.status(400).json({
                success: false,
                message: "Booking ID and status are required."
            });
        }


        if (!mongoose.isValidObjectId(bookingId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid booking ID."
            });
        }


        const newStatus = String(status).toLowerCase().trim();

        const allowedStatuses = [
            "pending",
            "confirmed",
            "cancelled",
            "completed"
        ];

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


        if (!isBookingOwner(booking, req.session.userId)) {
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


        if (
            !validTransitions[booking.status] ||
            !validTransitions[booking.status].includes(newStatus)
        ) {
            return res.status(400).json({
                success: false,
                message: `Cannot change booking from ${booking.status} to ${newStatus}.`
            });
        }


        const car = await Car.findById(booking.car);

        const carName =
            car && car.name ? car.name : "your car";


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


        booking.note =
            typeof note === "string" ? note.trim() : "";


        if (newStatus === "completed") {
            booking.actualReturnDate = new Date();
        }


        let refundAmount = 0;

        if (newStatus === "cancelled") {

            refundAmount = refundIfPaid(booking);

            booking.cancelledBy = "owner";
        }


        const paymentWasRefunded = refundAmount > 0;

        booking.status = newStatus;

        await booking.save();


        let notificationMessage = "";
        let notificationType = "";


        if (newStatus === "confirmed") {

            notificationMessage =
                `Your booking for ${carName} has been approved by the owner! Please complete payment to reserve your car.`;

            notificationType = "booking_confirmed";

        } else if (newStatus === "cancelled") {

            notificationMessage = paymentWasRefunded
                ? `Your booking for ${carName} has been cancelled by the owner. Your payment of Rs ${refundAmount} has been marked as refunded.`
                : `Your booking for ${carName} has been cancelled by the owner.`;

            notificationType = "booking_cancelled";

        } else if (newStatus === "completed") {

            notificationMessage =
                `Your booking for ${carName} has been completed.`;

            notificationType = "booking_completed";
        }


        if (notificationMessage) {

            await Notification.create({
                user: booking.renter,
                booking: booking._id,
                message: notificationMessage,
                type: notificationType
            });
        }


        const updatedBooking = await Booking.findById(booking._id)
            .select("-aadhaarNumber -aadhaarDocument -drivingLicenceDocument")
            .populate("car")
            .populate("renter", "name email")
            .populate("owner", "name email");


        return res.status(200).json({

            success: true,

            message: paymentWasRefunded
                ? "Booking cancelled and payment marked as refunded."
                : `Booking ${newStatus} successfully.`,

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


        if (
            !mongoose.isValidObjectId(carId) ||
            !startDate ||
            !endDate
        ) {
            return res.status(400).json({
                success: false,
                message: "Valid car ID, start date and end date are required."
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


        const pickup = new Date(`${startDate}T00:00:00`);
        const returnDate = new Date(`${endDate}T00:00:00`);


        if (
            isNaN(pickup.getTime()) ||
            isNaN(returnDate.getTime()) ||
            returnDate <= pickup
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid dates. Return date must be after pickup date."
            });
        }


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
// 7. OWNER CONFIRM BOOKING
// =====================================================

router.post("/:id/confirm", requireLogin, async (req, res) => {

    try {

        const { id } = req.params;

        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid booking ID."
            });
        }


        const booking = await Booking.findById(id);

        if (!booking) {
            return res.status(404).json({
                success: false,
                message: "Booking not found."
            });
        }


        if (!isBookingOwner(booking, req.session.userId)) {
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

        booking.note =
            typeof req.body.note === "string"
                ? req.body.note.trim()
                : "";


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

        const carName =
            car && car.name ? car.name : "your car";


        await Notification.create({
            user: booking.renter,
            booking: booking._id,
            message: `Your booking request for ${carName} has been confirmed by the owner! Pay now to lock your dates.`,
            type: "booking_confirmed"
        });


        return res.status(200).json({

            success: true,

            message: "Booking confirmed successfully. Waiting for customer payment.",

            booking: {
                _id: booking._id,
                status: booking.status,
                totalAmount: booking.totalAmount
            }
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

router.post("/:id/cancel", requireLogin, async (req, res) => {

    try {

        const { id } = req.params;

        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid booking ID."
            });
        }


        const booking = await Booking.findById(id);

        if (!booking) {
            return res.status(404).json({
                success: false,
                message: "Booking not found."
            });
        }


        if (!isBookingOwner(booking, req.session.userId)) {
            return res.status(403).json({
                success: false,
                message: "You are not allowed to cancel this booking."
            });
        }


        if (
            booking.status !== "pending" &&
            booking.status !== "confirmed"
        ) {
            return res.status(400).json({
                success: false,
                message: `This booking cannot be cancelled because it is already ${booking.status}.`
            });
        }


        booking.note =
            typeof req.body.note === "string"
                ? req.body.note.trim()
                : "";


        const refundAmount = refundIfPaid(booking);
        const paymentWasRefunded = refundAmount > 0;


        booking.cancelledBy = "owner";
        booking.status = "cancelled";

        await booking.save();


        const car = await Car.findById(booking.car);

        const carName =
            car && car.name ? car.name : "your car";


        await Notification.create({
            user: booking.renter,
            booking: booking._id,

            message: paymentWasRefunded
                ? `Your booking for ${carName} has been cancelled by the owner. Your payment of Rs ${refundAmount} has been marked as refunded.`
                : `Your booking for ${carName} has been cancelled by the owner.`,

            type: "booking_cancelled"
        });


        return res.status(200).json({

            success: true,

            message: paymentWasRefunded
                ? "Booking cancelled and payment marked as refunded."
                : "Booking cancelled successfully.",

            refundAmount,

            booking: {
                _id: booking._id,
                status: booking.status,
                cancelledBy: booking.cancelledBy
            }
        });


    } catch (error) {

        console.error("Owner Cancel Booking Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to update booking."
        });
    }
});


// =====================================================
// 9. CUSTOMER CANCEL BOOKING
// =====================================================

router.post("/:id/customer-cancel", requireLogin, async (req, res) => {

    try {

        const { id } = req.params;

        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid booking ID."
            });
        }


        const booking = await Booking.findById(id);

        if (!booking) {
            return res.status(404).json({
                success: false,
                message: "Booking not found."
            });
        }


        if (!isBookingRenter(booking, req.session.userId)) {
            return res.status(403).json({
                success: false,
                message: "You are not allowed to cancel this booking."
            });
        }


        if (
            booking.status !== "pending" &&
            booking.status !== "confirmed"
        ) {
            return res.status(400).json({
                success: false,
                message: `This booking cannot be cancelled because it is already ${booking.status}.`
            });
        }


        const car = await Car.findById(booking.car);

        const carName =
            car && car.name ? car.name : "the car";


        const refundAmount = refundIfPaid(booking);
        const paymentWasRefunded = refundAmount > 0;


        booking.note = "User Cancelled";
        booking.cancelledBy = "customer";
        booking.status = "cancelled";

        await booking.save();


        // OWNER NOTIFICATION

        if (booking.owner) {

            await Notification.create({
                user: booking.owner,
                booking: booking._id,

                message: paymentWasRefunded
                    ? `User cancelled the booking for ${carName}. The paid amount of Rs ${refundAmount} has been marked as refunded.`
                    : `User cancelled the booking for ${carName}.`,

                type: "booking_cancelled"
            });
        }


        // CUSTOMER NOTIFICATION

        if (paymentWasRefunded) {

            await Notification.create({
                user: booking.renter,
                booking: booking._id,

                message: `You cancelled your booking for ${carName}. Your payment of Rs ${refundAmount} has been marked as refunded.`,

                type: "booking_cancelled"
            });
        }


        return res.status(200).json({

            success: true,

            message: paymentWasRefunded
                ? "Booking cancelled and payment marked as refunded."
                : "Booking cancelled successfully.",

            refundAmount,

            booking: {
                _id: booking._id,
                status: booking.status,
                cancelledBy: booking.cancelledBy
            }
        });


    } catch (error) {

        console.error("Customer Cancel Booking Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to update booking."
        });
    }
});


// =====================================================
// 10. OWNER COMPLETE BOOKING
// =====================================================

router.post("/:id/complete", requireLogin, async (req, res) => {

    try {

        const { id } = req.params;

        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid booking ID."
            });
        }


        const booking = await Booking.findById(id);

        if (!booking) {
            return res.status(404).json({
                success: false,
                message: "Booking not found."
            });
        }


        if (!isBookingOwner(booking, req.session.userId)) {
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


        booking.note =
            typeof req.body.note === "string"
                ? req.body.note.trim()
                : "";

        booking.actualReturnDate = new Date();
        booking.status = "completed";

        await booking.save();


        const car = await Car.findById(booking.car);

        const carName =
            car && car.name ? car.name : "your car";


        await Notification.create({
            user: booking.renter,
            booking: booking._id,
            message: `Your booking for ${carName} has been completed.`,
            type: "booking_completed"
        });


        return res.status(200).json({

            success: true,

            message: "Booking completed successfully.",

            booking: {
                _id: booking._id,
                status: booking.status,
                actualReturnDate: booking.actualReturnDate
            }
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
// 11. PRIVATE DOCUMENT ACCESS
// Only booking renter or owner can access documents.
// =====================================================

router.get("/:id/document/:type", requireLogin, async (req, res) => {

    try {

        const { id, type } = req.params;

        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid booking ID."
            });
        }


        const booking = await Booking.findById(id);

        if (!booking) {
            return res.status(404).json({
                success: false,
                message: "Booking not found."
            });
        }


        const isRenter = isBookingRenter(
            booking,
            req.session.userId
        );

        const isOwner = isBookingOwner(
            booking,
            req.session.userId
        );


        if (!isRenter && !isOwner) {
            return res.status(403).json({
                success: false,
                message: "You are not allowed to access these documents."
            });
        }


        // Aadhaar entry retained only for old bookings.
        const documentFields = {
            aadhaar: booking.aadhaarDocument,
            licence: booking.drivingLicenceDocument
        };


        if (!Object.prototype.hasOwnProperty.call(documentFields, type)) {
            return res.status(400).json({
                success: false,
                message: "Invalid document type."
            });
        }


        const document = documentFields[type];

        if (!document || !document.path) {
            return res.status(404).json({
                success: false,
                message: "Document not found."
            });
        }


        const resolvedPath = path.resolve(document.path);

        if (!resolvedPath.startsWith(DOCUMENT_DIR + path.sep)) {
            return res.status(403).json({
                success: false,
                message: "Invalid document location."
            });
        }


        if (!fs.existsSync(resolvedPath)) {
            return res.status(404).json({
                success: false,
                message: "Document file is unavailable."
            });
        }


        const extension = path.extname(resolvedPath).toLowerCase();

        const contentTypes = {
            ".pdf": "application/pdf",
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".png": "image/png"
        };


        res.setHeader(
            "Content-Type",
            contentTypes[extension] || "application/octet-stream"
        );

        res.setHeader(
            "Content-Disposition",
            `attachment; filename="${path.basename(resolvedPath)}"`
        );

        res.setHeader("X-Content-Type-Options", "nosniff");
        res.setHeader("Cache-Control", "private, no-store");

        return res.sendFile(resolvedPath);


    } catch (error) {

        console.error("Private Document Access Error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to access document."
        });
    }
});


// =====================================================
// 12. GET SINGLE BOOKING
// =====================================================

router.get("/:id", requireLogin, async (req, res) => {

    try {

        const { id } = req.params;

        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid booking ID."
            });
        }


        const booking = await Booking.findById(id)
            .select("-aadhaarNumber -aadhaarDocument -drivingLicenceDocument")
            .populate("car")
            .populate("renter", "name email")
            .populate("owner", "name email");


        if (!booking) {
            return res.status(404).json({
                success: false,
                message: "Booking not found."
            });
        }


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
