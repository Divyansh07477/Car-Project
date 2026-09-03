require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const session = require("express-session");
const { MongoStore } = require("connect-mongo");
const path = require("path");

const authRoutes = require("./routes/auth");

const app = express();

const PORT = process.env.PORT || 5500;

// MongoDB URL
const dbUrl = process.env.ATLASDB_URL;

// MONGODB CONNECTION
async function main() {
    await mongoose.connect(dbUrl, {
        dbName: "ridewave",
    });

    console.log("MongoDB Atlas Connected Successfully!");
}

main()
    .then(() => {
        app.listen(PORT, () => {
            console.log(
                `CAR-RENTALS server running at http://localhost:${PORT}`
            );
        });
    })
    .catch((err) => {
        console.log("MongoDB Connection Error:");
        console.log(err);
    });

// MIDDLEWARE
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// SESSION
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

// STATIC FILES
app.use(express.static(path.join(__dirname, "public")));

// AUTH ROUTES
app.use("/api/auth", authRoutes);

// TEST
app.get("/test", (req, res) => {
    res.send("RideWave Backend Working!");
});

// HOME
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});