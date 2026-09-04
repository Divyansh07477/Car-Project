require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const session = require("express-session");
const { MongoStore } = require("connect-mongo");
const path = require("path");
const contactRoutes = require("./routes/contact");
const authRoutes = require("./routes/auth");
const carRoutes = require("./routes/carRoutes");
const app = express();
const PORT = process.env.PORT || 5500;
const bookingRoutes = require("./routes/booking");
const dbUrl = process.env.ATLASDB_URL;

if (!dbUrl) {
    console.error("❌ ATLASDB_URL is missing in .env file");
    process.exit(1);
}

if (!process.env.SESSION_SECRET) {
    console.error("❌ SESSION_SECRET is missing in .env file");
    process.exit(1);
}

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// EJS
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Static files
app.use(express.static(path.join(__dirname, "public")));

// Session
app.use(
    session({
        secret: process.env.SESSION_SECRET,
        resave: false,
        saveUninitialized: false,

        store: MongoStore.create({
            mongoUrl: dbUrl,
            dbName: "ridewave",
        }),

        cookie: {
            maxAge: 24 * 60 * 60 * 1000,
        },
    })
);

app.use("/api/bookings", bookingRoutes);



// teams
app.get("/teams", (req, res) => {
    res.render("teams");
});

// Booking Page
app.get("/booking", (req, res) => {
    res.render("booking", {
        car: req.query.car || ""
    });
});
// contact routes
app.use("/api/contact", contactRoutes);
// Auth routes
app.use("/api/auth", authRoutes);
// Car routes
app.use("/api/cars", carRoutes);

// Test
app.get("/test", (req, res) => {
    res.send("RideWave Backend Working!");
});

// Pages
app.get("/", (req, res) => {
    res.render("index");
});

app.get("/login", (req, res) => {
    res.render("login");
});

app.get("/signup", (req, res) => {
    res.render("signup");
});
// CONTACT PAGE
app.get("/contact", (req, res) => {
    res.render("contact");
});

app.get("/admin", (req, res) => {
    res.render("admin");
});


app.get("/carAdmin", (req, res) => {
    res.render("carAdmin");
});

// MongoDB + Server
async function main() {
    try {
        await mongoose.connect(dbUrl, {
            dbName: "ridewave",
        });

        console.log("✅ MongoDB Atlas Connected Successfully!");

        app.listen(PORT, () => {
            console.log(
                `🚗 CAR-RENTALS server running at http://localhost:${PORT}`
            );
        });
    } catch (err) {
        console.error("❌ MongoDB Connection Error:");
        console.error(err);
    }
}

main();