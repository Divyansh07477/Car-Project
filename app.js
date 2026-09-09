require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const session = require("express-session");
const { MongoStore } = require("connect-mongo");
const path = require("path");

// =====================================================
// MODELS
// =====================================================

const Car = require("./models/Car");
const Booking = require("./models/Booking");
const Notification = require("./models/Notification");
// =====================================================
// ROUTES
// =====================================================

const contactRoutes = require("./routes/contact");
const authRoutes = require("./routes/auth");
const carRoutes = require("./routes/carRoutes");
const bookingRoutes = require("./routes/booking");
const notificationRoutes = require("./routes/notification");




// =====================================================
// APP CONFIGURATION
// =====================================================

const app = express();

const PORT = process.env.PORT || 5500;

const dbUrl = process.env.ATLASDB_URL;


// =====================================================
// ENVIRONMENT CHECK
// =====================================================

if (!dbUrl) {
    console.error("ATLASDB_URL is missing in .env file");
    process.exit(1);
}

if (!process.env.SESSION_SECRET) {
    console.error("SESSION_SECRET is missing in .env file");
    process.exit(1);
}


// =====================================================
// MIDDLEWARE
// =====================================================

app.use(express.json());

app.use(
    express.urlencoded({
        extended: true
    })
);


// =====================================================
// EJS SETUP
// =====================================================

app.set("view engine", "ejs");

app.set(
    "views",
    path.join(__dirname, "views")
);


// =====================================================
// STATIC FILES
// =====================================================

app.use(
    express.static(
        path.join(__dirname, "public")
    )
);


// =====================================================
// SESSION CONFIGURATION
// =====================================================

app.use(
    session({
        secret: process.env.SESSION_SECRET,

        resave: false,

        saveUninitialized: false,

        store: MongoStore.create({
            mongoUrl: dbUrl,
            dbName: "ridewave"
        }),

        cookie: {
            maxAge: 24 * 60 * 60 * 1000
        }
    })
);


// =====================================================
// GLOBAL LOGIN STATUS
// =====================================================

app.use((req, res, next) => {

    res.locals.isLoggedIn =
        !!req.session.userId;

    next();
});


// =====================================================
// API ROUTES
// =====================================================

// Booking APIs
app.use(
    "/api/bookings",
    bookingRoutes
);


// Contact APIs
app.use(
    "/api/contact",
    contactRoutes
);


// Authentication APIs
app.use(
    "/api/auth",
    authRoutes
);


// Car APIs
app.use(
    "/api/cars",
    carRoutes
);


// Notification APIs
app.use(
    "/api/notifications",
    notificationRoutes
);


// =====================================================
// STATIC VIEW ROUTES
// =====================================================

app.get("/teams", (req, res) => {

    res.render("teams");

});


app.get("/booking", (req, res) => {

    res.render("booking", {
        car: req.query.car || ""
    });

});


app.get("/test", (req, res) => {

    res.send(
        "RideWave Backend Working!"
    );

});


app.get("/", (req, res) => {

    res.render("index");

});


app.get("/search", (req, res) => {

    res.render("search", {
        query: req.query.q || ""
    });

});


app.get("/login", (req, res) => {

    res.render("login");

});


app.get("/signup", (req, res) => {

    res.render("signup");

});


app.get("/contact", (req, res) => {

    res.render("contact");

});


app.get("/carAdmin", (req, res) => {

    res.render("carAdmin");

});


app.get("/booking-confirm", (req, res) => {

    res.render("bookingConform");

});


app.get("/Mybookings", (req, res) => {

    res.render("Mybooking");

});


// =====================================================
// PAYMENT PAGE
// =====================================================

app.get("/payment", (req, res) => {

    res.render("payment", {

        bookingId:
            req.query.booking || ""

    });

});

// =====================================================
// PAYMENT SUCCESS PAGE
// =====================================================

app.get("/payment-success", async (req, res) => {

    try {

        const bookingId =
            req.query.booking || "";

        const paymentMethod =
            req.query.method || "Online";

        const upiApp =
            req.query.app || "";


        // ---------------------------------------------
        // CHECK LOGIN
        // ---------------------------------------------

        if (!req.session.userId) {

            return res.redirect("/login");

        }


        // ---------------------------------------------
        // CHECK BOOKING ID
        // ---------------------------------------------

        if (!bookingId) {

            return res.redirect("/");

        }


        // ---------------------------------------------
        // FIND BOOKING
        // ---------------------------------------------

        const booking =
            await Booking.findById(bookingId);


        if (!booking) {

            return res.redirect("/Mybookings");

        }


        // ---------------------------------------------
        // SECURITY CHECK
        // ONLY BOOKING OWNER/CUSTOMER CAN PAY
        // ---------------------------------------------

        if (
            !booking.renter ||
            booking.renter.toString() !==
                req.session.userId.toString()
        ) {

            return res.status(403).send(
                "You are not allowed to make payment for this booking."
            );

        }


        // ---------------------------------------------
        // CHECK BOOKING STATUS
        // PAYMENT ONLY AFTER CONFIRMATION
        // ---------------------------------------------

        if (booking.status !== "confirmed") {

            return res.status(400).send(
                "This booking is not confirmed yet."
            );

        }


        // ---------------------------------------------
        // PAYMENT AMOUNT
        // ---------------------------------------------

        const amount =
            Number(booking.totalAmount) || 0;

if (booking.payment && booking.payment.status === "Paid") {
    return res.render("payment-success", {
        bookingId,
        amount: Number(booking.totalAmount || 0).toLocaleString("en-IN"),
        paymentMethod: booking.payment.method || paymentMethod,
        upiApp
    });
}
        // ---------------------------------------------
        // UPDATE PAYMENT
        // ---------------------------------------------

        if (!booking.payment) {

            booking.payment = {};

        }


        booking.payment.status = "Paid";

        booking.payment.method =
            paymentMethod;

        booking.payment.amountPaid =
            amount;

        booking.payment.amountRemaining =
            0;


        await booking.save();


        // ---------------------------------------------
        // GET CAR NAME
        // ---------------------------------------------

        const car =
            await Car.findById(booking.car);


        const carName =
            car && car.name
                ? car.name
                : "your car";


        // ---------------------------------------------
        // USER PAYMENT NOTIFICATION
        // ---------------------------------------------

        await Notification.create({

            user: booking.renter,

            booking: booking._id,

            message:
                `Payment successful for your booking of ${carName}.`,

            type:
                "payment_success"

        });


        // ---------------------------------------------
        // OWNER PAYMENT NOTIFICATION
        // ---------------------------------------------

        await Notification.create({

            user: booking.owner,

            booking: booking._id,

            message:
                `Payment received for the booking of ${carName}.`,

            type:
                "payment_received"

        });


        // ---------------------------------------------
        // RENDER SUCCESS PAGE
        // ---------------------------------------------

        return res.render(
            "payment-success",
            {

                bookingId,

                amount:
                    amount.toLocaleString(
                        "en-IN"
                    ),

                paymentMethod,

                upiApp

            }
        );


    } catch (error) {

        console.error(
            "Payment Success Route Error:",
            error
        );

        return res.redirect("/");

    }

});

// =====================================================
// CUSTOMER BOOKING PAGE
// OWNER SEES BOOKINGS FOR THEIR CARS
// =====================================================

app.get(
    "/Customerbooking",
    async (req, res) => {

        try {

            // ---------------------------------------------
            // LOGIN CHECK
            // ---------------------------------------------

            if (!req.session.userId) {

                return res.redirect(
                    "/login"
                );

            }


            // ---------------------------------------------
            // GET OWNER ID
            // ---------------------------------------------

            const ownerId =
                new mongoose.Types.ObjectId(
                    req.session.userId
                );


            // ---------------------------------------------
            // GET OWNER CARS
            // ---------------------------------------------

            const userCars =
                await Car.find({
                    owner: ownerId
                });


            const carIds =
                userCars.map(
                    car => car._id
                );


            // ---------------------------------------------
            // GET BOOKINGS FOR OWNER CARS
            // ---------------------------------------------

            const bookings =
                await Booking.find({
                    car: {
                        $in: carIds
                    }
                })
                    .populate("car")
                    .populate(
                        "renter",
                        "name email"
                    )
                    .sort({
                        createdAt: -1
                    });


            // ---------------------------------------------
            // RENDER PAGE
            // ---------------------------------------------

            res.render(
                "Customerbooking",
                {
                    bookings
                }
            );


        } catch (err) {

            console.error(
                "Customerbooking Error:",
                err
            );


            res.render(
                "Customerbooking",
                {
                    bookings: []
                }
            );

        }

    }
);


// =====================================================
// ADMIN DASHBOARD
// REAL DATABASE DATA
// =====================================================

app.get(
    "/admin",
    async (req, res) => {

        try {

            // ---------------------------------------------
            // LOGIN CHECK
            // ---------------------------------------------

            const userId =
                req.session?.userId;


            if (!userId) {

                return res.redirect(
                    "/login"
                );

            }


            // ---------------------------------------------
            // OWNER ID
            // ---------------------------------------------

            const ownerId =
                new mongoose.Types.ObjectId(
                    userId
                );


            // ---------------------------------------------
            // 1. GET USER'S CARS
            // ---------------------------------------------

            const userCars =
                await Car.find({
                    owner: ownerId
                })
                    .sort({
                        createdAt: -1
                    });


            // ---------------------------------------------
            // 2. CATEGORY COUNT
            // ---------------------------------------------

            const categories =
                [
                    ...new Set(
                        userCars
                            .map(
                                car =>
                                    car.category
                            )
                            .filter(Boolean)
                    )
                ];


            // ---------------------------------------------
            // 3. AVERAGE PRICE
            // ---------------------------------------------

            const totalPrice =
                userCars.reduce(
                    (sum, car) =>
                        sum +
                        (
                            Number(
                                car.pricePerDay
                            ) || 0
                        ),
                    0
                );


            const avg =
                userCars.length > 0
                    ? Math.round(
                        totalPrice /
                        userCars.length
                    )
                    : 0;


            // ---------------------------------------------
            // 4. USER CAR IDS
            // ---------------------------------------------

            const userCarIds =
                userCars.map(
                    car => car._id
                );


            // ---------------------------------------------
            // 5. PENDING BOOKINGS
            //
            // IMPORTANT:
            // Booking schema uses:
            // pending
            // confirmed
            // cancelled
            // completed
            // ---------------------------------------------

            let pendingCount =
                await Booking.countDocuments({

                    car: {
                        $in: userCarIds
                    },

                    status: "pending"

                });


            // ---------------------------------------------
            // 6. RECENT BOOKINGS
            // ---------------------------------------------

            let recentBookings =
                await Booking.find({

                    car: {
                        $in: userCarIds
                    }

                })
                    .populate("car")
                    .populate(
                        "renter",
                        "name email"
                    )
                    .sort({
                        createdAt: -1
                    })
                    .limit(5);


            // ---------------------------------------------
            // 7. FALLBACK
            // ---------------------------------------------

            if (
                recentBookings.length === 0
            ) {

                pendingCount =
                    await Booking.countDocuments({
                        status: "pending"
                    });


                recentBookings =
                    await Booking.find()
                        .populate("car")
                        .populate(
                            "renter",
                            "name email"
                        )
                        .sort({
                            createdAt: -1
                        })
                        .limit(5);

            }


            // ---------------------------------------------
            // 8. RENDER ADMIN DASHBOARD
            // ---------------------------------------------

            res.render(
                "admin",
                {

                    totalCars:
                        userCars.length,

                    totalCategories:
                        categories.length,

                    avgPrice:
                        avg,

                    pendingBookingsCount:
                        pendingCount,

                    recentBookings:
                        recentBookings

                }
            );


        } catch (error) {

            console.error(
                "Admin Route Error:",
                error
            );


            res
                .status(500)
                .send(
                    "Dashboard Error: " +
                    error.message
                );

        }

    }
);

app.get("/confirmationPage", (req, res) => {
    res.render("confirmationPage", {
        bookingId: req.query.booking || ""
    });
});
// =====================================================
// MONGODB + SERVER START
// =====================================================

async function main() {

    try {

        // ---------------------------------------------
        // CONNECT TO MONGODB
        // ---------------------------------------------

        await mongoose.connect(
            dbUrl,
            {
                dbName: "ridewave"
            }
        );


        console.log(
            "MongoDB Atlas Connected Successfully!"
        );


        // ---------------------------------------------
        // START SERVER
        // ---------------------------------------------

        app.listen(
            PORT,
            () => {

                console.log(
                    `CAR-RENTALS server running at http://localhost:${PORT}`
                );

            }
        );


    } catch (err) {

        console.error(
            "MongoDB Connection Error:"
        );

        console.error(err);

    }

}


// =====================================================
// START APPLICATION
// =====================================================

main();