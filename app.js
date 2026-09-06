require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const session = require("express-session");
const { MongoStore } = require("connect-mongo");
const path = require("path");

// Models
const Car = require("./models/Car");
const Booking = require("./models/Booking");

// Routes
const contactRoutes = require("./routes/contact");
const authRoutes = require("./routes/auth");
const carRoutes = require("./routes/carRoutes");
const bookingRoutes = require("./routes/booking");

const app = express();
const PORT = process.env.PORT || 5500;
const dbUrl = process.env.ATLASDB_URL;

if (!dbUrl) {
    console.error("ATLASDB_URL is missing in .env file");
    process.exit(1);
}

if (!process.env.SESSION_SECRET) {
    console.error("SESSION_SECRET is missing in .env file");
    process.exit(1);
}

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// EJS Setup
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Static files
app.use(express.static(path.join(__dirname, "public")));

// Session Configuration
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

app.use((req, res, next) => {
    res.locals.isLoggedIn = !!req.session.userId;
    next();
});

// API Routes
app.use("/api/bookings", bookingRoutes);
app.use("/api/contact", contactRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/cars", carRoutes);

// Static View Routes
app.get("/teams", (req, res) => res.render("teams"));
app.get("/booking", (req, res) => res.render("booking", { car: req.query.car || "" }));
app.get("/test", (req, res) => res.send("RideWave Backend Working!"));
app.get("/", (req, res) => res.render("index"));
app.get("/search", (req, res) => res.render("search", { query: req.query.q || "" }));
app.get("/login", (req, res) => res.render("login"));
app.get("/signup", (req, res) => res.render("signup"));
app.get("/contact", (req, res) => res.render("contact"));
app.get("/carAdmin", (req, res) => res.render("carAdmin"));
app.get("/booking-confirm", (req, res) => res.render("bookingConform"));
app.get("/Mybookings", (req, res) => res.render("Mybooking"));



// payment
app.get("/payment", (req, res) => {

    res.render("payment", {
        bookingId: req.query.booking || ""
    });

});

// =====================================================
// PAYMENT SUCCESS PAGE
// =====================================================
app.get("/payment-success", async (req, res) => {
    try {
        const bookingId = req.query.booking || "";
        const paymentMethod = req.query.method || "Online";
        const upiApp = req.query.app || "";

        if (!bookingId) {
            return res.redirect("/");
        }

        let amount = 0;

        // Booking database se amount fetch
        try {
            const booking = await Booking.findById(bookingId);

            if (booking) {
                amount =
                    Number(booking.totalPrice) ||
                    Number(booking.totalAmount) ||
                    Number(booking.price) ||
                    0;
            }
        } catch (error) {
            console.log("Payment amount fetch error:", error.message);
        }

        res.render("payment-success", {
            bookingId,
            amount: amount.toLocaleString("en-IN"),
            paymentMethod,
            upiApp
        });

    } catch (error) {
        console.error("Payment Success Route Error:", error);
        res.redirect("/");
    }
});


// Customer Bookings View Route
app.get("/Customerbooking", async (req, res) => {
    try {
        if (!req.session.userId) return res.redirect("/login");

        const ownerId = new mongoose.Types.ObjectId(req.session.userId);
        const userCars = await Car.find({ owner: ownerId });
        const carIds = userCars.map(c => c._id);

        const bookings = await Booking.find({ car: { $in: carIds } })
            .populate("car")
            .sort({ createdAt: -1 });

        res.render("Customerbooking", { bookings });
    } catch (err) {
        console.error("Customerbooking Error:", err);
        res.render("Customerbooking", { bookings: [] });
    }
});

// =====================================================
// FIXED ADMIN DASHBOARD ROUTE (Real Data Fetch)
// =====================================================
app.get("/admin", async (req, res) => {
    try {
        const userId = req.session?.userId;

        if (!userId) {
            return res.redirect("/login");
        }

        const ownerId = new mongoose.Types.ObjectId(userId);

        // 1. Logged-in user ki cars fetch karo
        const userCars = await Car.find({ owner: ownerId }).sort({ createdAt: -1 });

        // 2. Categories count
        const categories = [...new Set(userCars.map(c => c.category).filter(Boolean))];

        // 3. Average price calculation
        const totalPrice = userCars.reduce((sum, c) => sum + (Number(c.pricePerDay) || 0), 0);
        const avg = userCars.length > 0 ? Math.round(totalPrice / userCars.length) : 0;

        // 4. Logged-in user ki cars ki bookings
        const userCarIds = userCars.map(c => c._id);

        let pendingCount = await Booking.countDocuments({
            car: { $in: userCarIds },
            status: "Pending"
        });

        let recentBookings = await Booking.find({
            car: { $in: userCarIds }
        })
        .populate("car")
        .sort({ createdAt: -1 })
        .limit(5);

        // Agar specific cars ki booking nahi hai toh generic bookings dikhao
        if (recentBookings.length === 0) {
            pendingCount = await Booking.countDocuments({ status: "Pending" });
            recentBookings = await Booking.find()
                .populate("car")
                .sort({ createdAt: -1 })
                .limit(5);
        }

        res.render("admin", {
            totalCars: userCars.length,
            totalCategories: categories.length,
            avgPrice: avg,
            pendingBookingsCount: pendingCount,
            recentBookings: recentBookings
        });

    } catch (error) {
        console.error("Admin Route Error:", error);
        res.status(500).send("Dashboard Error: " + error.message);
    }
});

// MongoDB + Server Start
async function main() {
    try {
        await mongoose.connect(dbUrl, {
            dbName: "ridewave",
        });

        console.log(" MongoDB Atlas Connected Successfully!");

        app.listen(PORT, () => {
            console.log(`CAR-RENTALS server running at http://localhost:${PORT}`);
        });
    } catch (err) {
        console.error(" MongoDB Connection Error:");
        console.error(err);
    }
}

main();