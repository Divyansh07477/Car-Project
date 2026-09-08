const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");

const Car = require("../models/Car");
const Booking = require("../models/Booking");
const cloudinary = require("../config/cloudinary");
const upload = require("../middleware/uploadMiddleware");


// =====================================================
// GET ADMIN DASHBOARD (Direct & Fallback Fixed)
// =====================================================
router.get("/admin", async (req, res) => {
    try {
        const userId = req.session?.userId;

        console.log("-----------------------------------------");
        console.log("Logged-In User ID:", userId);

        if (!userId) {
            return res.redirect("/login");
        }

        const ownerObjectId = mongoose.Types.ObjectId.isValid(userId)
            ? new mongoose.Types.ObjectId(userId)
            : null;

        // Step 1: User ki specific cars find karo
        let userCars = await Car.find({
            $or: [
                { owner: ownerObjectId },
                { owner: String(userId) }
            ]
        }).sort({ createdAt: -1 });

        console.log("User Owned Cars Count:", userCars.length);

        // Agar userCars 0 hai (purana data bina owner ke bana tha), toh admin view ke liye all cars fetch karo
        const allCarsCount = await Car.countDocuments();
        const displayCars = userCars.length > 0 ? userCars : await Car.find().sort({ createdAt: -1 });
        const finalCarsCount = userCars.length > 0 ? userCars.length : allCarsCount;

        // Categories calculation
        const categories = [...new Set(displayCars.map(c => c.category).filter(Boolean))];

        // Average price calculation
        const totalPrice = displayCars.reduce((sum, c) => sum + (Number(c.pricePerDay) || 0), 0);
        const avg = displayCars.length > 0 ? Math.round(totalPrice / displayCars.length) : 0;

        // Step 2: Bookings Fetch Logic
        let pendingCount = 0;
        let recentBookings = [];

        if (userCars.length > 0) {
            const userCarIds = userCars.map(c => c._id);
            pendingCount = await Booking.countDocuments({
                car: { $in: userCarIds },
                status: "Pending"
            });

            recentBookings = await Booking.find({ car: { $in: userCarIds } })
                .populate("car")
                .sort({ createdAt: -1 })
                .limit(5);
        }

        // Agar specific cars ki booking nahi mili, toh general recent bookings dikhao (View All jaisa)
        if (recentBookings.length === 0) {
            pendingCount = await Booking.countDocuments({ status: "Pending" });
            recentBookings = await Booking.find()
                .populate("car")
                .sort({ createdAt: -1 })
                .limit(5);
        }

        console.log("Final Sent Count -> Cars:", finalCarsCount, "| Bookings:", recentBookings.length);
        console.log("-----------------------------------------");

        res.render("admin", {
            totalCars: finalCarsCount,
            totalCategories: categories.length,
            avgPrice: avg,
            pendingBookingsCount: pendingCount,
            recentBookings: recentBookings
        });

    } catch (error) {
        console.error("Admin Dashboard Error:", error);
        res.status(500).send("Dashboard load error: " + error.message);
    }
});

router.get("/", async (req, res) => {
    try {

        const cars = await Car.find()
            .populate("owner", "name email")
            .sort({ createdAt: -1 })
            .lean();

        const carIds = cars.map(car => car._id);

        const confirmedBookings = await Booking.find({
            car: { $in: carIds },
            status: "confirmed"
        })
            .select("car startDate endDate")
            .sort({ startDate: 1 })
            .lean();

        const bookingsByCar = {};

        confirmedBookings.forEach(booking => {

            const carId = booking.car.toString();

            if (!bookingsByCar[carId]) {
                bookingsByCar[carId] = [];
            }

            bookingsByCar[carId].push({
                startDate: booking.startDate,
                endDate: booking.endDate
            });
        });

        const carsWithAvailability = cars.map(car => {

            const bookedDates =
                bookingsByCar[car._id.toString()] || [];

            return {
                ...car,

                bookedDates: bookedDates
            };
        });

        res.status(200).json({
            success: true,
            cars: carsWithAvailability
        });

    } catch (error) {

        console.error(
            "Get Cars Error:",
            error
        );

        res.status(500).json({
            success: false,
            message: "Failed to fetch cars."
        });
    }
});;

// =====================================================
// GET LOGGED-IN USER'S CARS (API)
// =====================================================
router.get("/my-cars", async (req, res) => {
    try {
        const userId = req.session?.userId;
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "Please login first."
            });
        }

        const ownerObjectId = mongoose.Types.ObjectId.isValid(userId)
            ? new mongoose.Types.ObjectId(userId)
            : userId;

        const cars = await Car.find({
            $or: [{ owner: ownerObjectId }, { owner: String(userId) }]
        }).sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            cars: cars
        });
    } catch (error) {
        console.error("Get My Cars Error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch your cars."
        });
    }
});

// =====================================================
// GET SINGLE CAR
// =====================================================
router.get("/:id", async (req, res) => {
    try {
        const car = await Car.findById(req.params.id)
            .populate("owner", "name email");

        if (!car) {
            return res.status(404).json({
                success: false,
                message: "Car not found."
            });
        }

        res.status(200).json({
            success: true,
            car: car
        });
    } catch (error) {
        console.error("Get Single Car Error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch car."
        });
    }
});

// =====================================================
// ADD NEW CAR
// =====================================================
router.post("/", upload.single("image"), async (req, res) => {
    try {
        const userId = req.session?.userId;
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "Please login first."
            });
        }

        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: "Car image is required."
            });
        }

        const { name, category, transmission, pricePerDay } = req.body;

        const categoryMap = {
            sedan: "Sedan",
            suv: "SUV",
            hatchback: "Hatchback",
            luxury: "Luxury",
            sports: "Sports"
        };

        const transmissionMap = {
            automatic: "Automatic",
            manual: "Manual"
        };

        const formattedCategory = categoryMap[category?.toLowerCase()] || category;
        const formattedTransmission = transmissionMap[transmission?.toLowerCase()] || transmission;

        if (!formattedCategory || !formattedTransmission) {
            return res.status(400).json({
                success: false,
                message: "Invalid category or transmission."
            });
        }

        const result = await new Promise((resolve, reject) => {
            const uploadStream = cloudinary.uploader.upload_stream(
                { folder: "ridewave/cars" },
                (error, result) => {
                    if (error) reject(error);
                    else resolve(result);
                }
            );
            uploadStream.end(req.file.buffer);
        });

        const car = new Car({
            name: name,
            category: formattedCategory,
            transmission: formattedTransmission,
            pricePerDay: Number(pricePerDay),
            image: result.secure_url,
            owner: new mongoose.Types.ObjectId(userId)
        });

        await car.save();

        res.status(201).json({
            success: true,
            message: "Car added successfully.",
            car: car
        });

    } catch (error) {
        console.error("Add Car Error:", error);
        res.status(500).json({
            success: false,
            message: error.message || "Failed to add car."
        });
    }
});

// =====================================================
// DELETE CAR
// =====================================================
router.delete("/:id", async (req, res) => {
    try {
        const userId = req.session?.userId;
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "Please login first."
            });
        }

        const ownerObjectId = mongoose.Types.ObjectId.isValid(userId)
            ? new mongoose.Types.ObjectId(userId)
            : userId;

        const car = await Car.findOne({
            _id: req.params.id,
            owner: ownerObjectId
        });

        if (!car) {
            return res.status(404).json({
                success: false,
                message: "Car not found or you are not the owner."
            });
        }

        await Car.findByIdAndDelete(car._id);

        res.status(200).json({
            success: true,
            message: "Car deleted successfully."
        });

    } catch (error) {
        console.error("Delete Car Error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to delete car."
        });
    }
});

// =====================================================
// UPDATE CAR
// =====================================================
router.put("/:id", upload.single("image"), async (req, res) => {
    try {
        const userId = req.session?.userId;
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "Please login first."
            });
        }

        const ownerObjectId = mongoose.Types.ObjectId.isValid(userId)
            ? new mongoose.Types.ObjectId(userId)
            : userId;

        const car = await Car.findOne({
            _id: req.params.id,
            owner: ownerObjectId
        });

        if (!car) {
            return res.status(404).json({
                success: false,
                message: "Car not found or you are not the owner."
            });
        }

        const { name, category, transmission, pricePerDay } = req.body;

        const categoryMap = {
            sedan: "Sedan",
            suv: "SUV",
            hatchback: "Hatchback",
            luxury: "Luxury",
            sports: "Sports"
        };

        const transmissionMap = {
            automatic: "Automatic",
            manual: "Manual"
        };

        const formattedCategory = categoryMap[category?.toLowerCase()] || category;
        const formattedTransmission = transmissionMap[transmission?.toLowerCase()] || transmission;

        if (!formattedCategory || !formattedTransmission) {
            return res.status(400).json({
                success: false,
                message: "Invalid category or transmission."
            });
        }

        car.name = name;
        car.category = formattedCategory;
        car.transmission = formattedTransmission;
        car.pricePerDay = Number(pricePerDay);

        if (req.file) {
            const result = await new Promise((resolve, reject) => {
                const uploadStream = cloudinary.uploader.upload_stream(
                    { folder: "ridewave/cars" },
                    (error, result) => {
                        if (error) reject(error);
                        else resolve(result);
                    }
                );
                uploadStream.end(req.file.buffer);
            });
            car.image = result.secure_url;
        }

        await car.save();

        res.status(200).json({
            success: true,
            message: "Car updated successfully.",
            car: car
        });

    } catch (error) {
        console.error("Update Car Error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to update car."
        });
    }
});

module.exports = router;