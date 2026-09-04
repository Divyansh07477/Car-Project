const express = require("express");
const router = express.Router();

const Car = require("../models/Car");
const cloudinary = require("../config/cloudinary");
const upload = require("../middleware/uploadMiddleware");


router.post("/", upload.single("image"), async (req, res) => {

    try {

        // Check login
        if (!req.session.userId) {
            return res.status(401).json({
                success: false,
                message: "Please login first."
            });
        }


        // Check image
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: "Car image is required."
            });
        }


        const {
            name,
            category,
            transmission,
            pricePerDay
        } = req.body;


        // Convert frontend lowercase values
        // to Car model enum values
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


        const formattedCategory = categoryMap[category];
        const formattedTransmission = transmissionMap[transmission];


        // Validate category and transmission
        if (!formattedCategory || !formattedTransmission) {
            return res.status(400).json({
                success: false,
                message: "Invalid category or transmission."
            });
        }


        // Upload image to Cloudinary
        const result = await new Promise((resolve, reject) => {

            const uploadStream = cloudinary.uploader.upload_stream(
                {
                    folder: "ridewave/cars"
                },

                (error, result) => {

                    if (error) {
                        reject(error);
                    } else {
                        resolve(result);
                    }

                }
            );

            uploadStream.end(req.file.buffer);

        });


        // Create car
        const car = new Car({

            name: name,

            // IMPORTANT:
            // Use formatted values here
            category: formattedCategory,

            transmission: formattedTransmission,

            pricePerDay: Number(pricePerDay),

            // Cloudinary URL
            image: result.secure_url,

            // Logged-in user automatically becomes owner
            owner: req.session.userId

        });


        // Save car to MongoDB
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


module.exports = router;