const mongoose = require("mongoose");

const carSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },

    brand: {
      type: String,
      required: true,
    },

    model: {
      type: String,
      required: true,
    },

    year: {
      type: Number,
      required: true,
    },

    category: {
      type: String,
      enum: ["Sedan", "SUV", "Luxury", "Sports", "Hatchback"],
      required: true,
    },

    pricePerDay: {
      type: Number,
      required: true,
    },

    image: {
      type: String,
      default: "",
    },

    description: {
      type: String,
      default: "",
    },

    seats: {
      type: Number,
      default: 5,
    },

    fuelType: {
      type: String,
      enum: ["Petrol", "Diesel", "Electric", "Hybrid"],
      default: "Petrol",
    },

    transmission: {
      type: String,
      enum: ["Manual", "Automatic"],
      default: "Automatic",
    },

    available: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Car", carSchema);