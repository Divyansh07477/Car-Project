const express = require("express");
const router = express.Router();

const Contact = require("../models/contact");
// SEND CONTACT MESSAGE
router.post("/", async (req, res) => {
  try {
    const { name, email, phone, subject, message } = req.body;

    if (!name || !email || !subject || !message) {
      return res.status(400).json({
        message: "Please fill all required fields.",
      });
    }

    const contact = new Contact({
      name,
      email,
      phone,
      subject,
      message,
    });

    await contact.save();

    res.status(201).json({
      message: "Your message has been sent successfully",
    });
  } catch (error) {
    console.error("Contact Error:", error);

    res.status(500).json({
      message: "Failed to send message.",
    });
  }
});

module.exports = router;