const Car = require("../models/Car");
const cloudinary = require("../config/cloudinary");

const addCar = async (req, res) => {
  try {
    const { name, category, transmission, pricePerDay } = req.body;

    // Image check
    if (!req.file) {
      return res.status(400).json({
        message: "Car image is required"
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
    const car = await Car.create({
      name,
      category,
      transmission,
      pricePerDay,
      image: result.secure_url,

      // IMPORTANT:
      // owner automatically comes from logged-in user
      owner: req.user._id
    });

    res.status(201).json({
      message: "Car added successfully",
      car
    });

  } catch (error) {
    console.error("Add car error:", error);

    res.status(500).json({
      message: "Failed to add car",
      error: error.message
    });
  }
};

module.exports = {
  addCar
};