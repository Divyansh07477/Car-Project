document.addEventListener("DOMContentLoaded", () => {

    // ==========================================
    // RIDEWAVE MJ - INITIAL SETUP
    // ==========================================

    const micBtn = document.getElementById("mjMicBtn");

    if (!micBtn) {
        console.warn("MJ microphone button not found.");
        return;
    }

    const SpeechRecognition =
        window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
        console.error("Speech Recognition is not supported.");
        return;
    }

    const recognition = new SpeechRecognition();

    recognition.lang = "en-IN";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 3;

    let isListening = false;
    let currentLanguage = "hi";
    let mjVoices = [];
    let mjHindiVoice = null;
    let mjEnglishVoice = null;
    let speechId = 0;

    // ==========================================
    // LOAD VOICES
    // ==========================================

    function loadVoices() {
        mjVoices = window.speechSynthesis.getVoices();

        mjEnglishVoice = mjVoices.find(voice =>
            /female|woman|google/i.test(voice.name) &&
            voice.lang.toLowerCase().startsWith("en")
        );

        if (!mjEnglishVoice) {
            mjEnglishVoice =
                mjVoices.find(voice =>
                    voice.lang.toLowerCase() === "en-in"
                ) ||
                mjVoices.find(voice =>
                    voice.lang.toLowerCase().startsWith("en")
                ) ||
                null;
        }

        mjHindiVoice = mjVoices.find(voice =>
            voice.lang.toLowerCase().startsWith("hi")
        ) || null;

        console.log("MJ Hindi Voice:",
            mjHindiVoice?.name || "Not available");

        console.log("MJ English Voice:",
            mjEnglishVoice?.name || "Not available");

        console.log("Available Voices:", mjVoices.map(voice => ({
            name: voice.name,
            language: voice.lang
        })));
    }

    loadVoices();
    window.speechSynthesis.addEventListener("voiceschanged", loadVoices);

    // ==========================================
    // SPEECH FUNCTION
    // ==========================================

    function speakMJ(message, language = currentLanguage, callback) {

        const thisSpeechId = ++speechId;

        window.speechSynthesis.cancel();

        console.log("MJ Response:", message);

        const speech = new SpeechSynthesisUtterance(message);

        if (language === "hi") {
            speech.lang = "hi-IN";

            if (mjHindiVoice) {
                speech.voice = mjHindiVoice;
            }

            speech.rate = 1.15;
            speech.pitch = 1.05;

        } else {
            // Hindi wali voice English bhi Indian accent me bolti hai,
            // isliye pehle wahi use hoti hai. Agar Hindi voice na mile
            // to English voice fallback me chalti hai.
            const englishSpeaker = mjHindiVoice || mjEnglishVoice;

            speech.lang = englishSpeaker ? englishSpeaker.lang : "en-IN";

            if (englishSpeaker) {
                speech.voice = englishSpeaker;
            }

            speech.rate = 1.1;
            speech.pitch = 1.05;
        }

        speech.volume = 1;

        let callbackCalled = false;

        function finishSpeech() {
            if (callbackCalled || thisSpeechId !== speechId) return;

            callbackCalled = true;

            if (typeof callback === "function") {
                callback();
            }
        }

        // NOTE: Lambi car list bolne me 7 sec se zyada lag sakta hai,
        // isliye timer message ki length ke hisaab se rakha hai.
        const fallbackMs = Math.max(7000, message.length * 120);

        const fallbackTimer = setTimeout(() => {
            finishSpeech();
        }, fallbackMs);

        speech.onend = () => {
            clearTimeout(fallbackTimer);
            finishSpeech();
        };

        speech.onerror = event => {
            clearTimeout(fallbackTimer);
            console.error("MJ speech error:", event.error);
            finishSpeech();
        };

        window.speechSynthesis.speak(speech);
    }

    // ==========================================
    // LANGUAGE DETECTION
    // ==========================================

    function detectLanguage(command) {

        if (/[\u0900-\u097F]/.test(command)) {
            return "hi";
        }

        const hindiWords = [
            "mujhe", "mera", "meri", "mere",
            "kya", "kaise", "hai", "hain",
            "kholo", "khol", "dikhao", "batao",
            "karna", "karni", "karo", "chahiye",
            "leni", "lena", "rent pe", "rent par",
            "kiraye", "gaadi", "gadi", "aap",
            "tum", "kaun", "kitni", "kitne",
            "apne paas", "bata", "khol do",
            "dikha do", "meri", "aapki"
        ];

        return hindiWords.some(word =>
            command.includes(word)
        ) ? "hi" : "en";
    }

    // ==========================================
    // RESPONSE FUNCTION
    // ==========================================

    function say(english, hinglish, callback) {

        const message =
            currentLanguage === "hi" ? hinglish : english;

        speakMJ(message, currentLanguage, callback);
    }


    // ==========================================
    // TEXT NORMALIZATION
    // ==========================================

    function normalize(value) {
        return String(value || "")
            .toLowerCase()
            .replace(/[^\p{L}\p{N}\s]/gu, " ")
            .replace(/\s+/g, " ")
            .trim();
    }

    // ==========================================
    // PAGE NAVIGATION
    // ==========================================

    function openPage(path, english, hinglish) {
        say(english, hinglish, () => {
            window.location.href = path;
        });
    }

// ==========================================
// SMART PAGE COMMAND MATCHING
// ==========================================

function handlePageNavigation(text) {

    const navigationWords = [
        "open", "go", "goto", "visit", "navigate",
        "chalo", "chal", "le chalo", "jana", "jao",
        "khol", "kholo", "khol do", "dikhao",
        "dikha do", "page per", "page pe",
        "page par", "take me", "show me"
    ];

    const hasNavigationIntent = navigationWords.some(word =>
        text.includes(word)
    );

    if (!hasNavigationIntent) return false;

    const pages = [
        {
            url: "/",
            keywords: ["home page", "homepage", "home", "ghar"],
            english: "Taking you to the Home page, Sir.",
            hinglish: "Sir, aapko Home page par le ja rahi hoon."
        },
        {
            url: "/search",
            keywords: ["search page", "search", "find cars"],
            english: "Opening Search page, Sir.",
            hinglish: "Sir, Search page khol rahi hoon."
        },
        {
            url: "/blog",
            keywords: ["clips", "clip", "blog"],
            english: "Opening Clips page, Sir.",
            hinglish: "Sir, Clips page khol rahi hoon."
        },
        {
            url: "/contact",
            keywords: ["contact"],
            english: "Opening Contact page, Sir.",
            hinglish: "Sir, Contact page khol rahi hoon."
        },
        {
            url: "/login",
            keywords: ["login", "log in"],
            english: "Opening Login page, Sir.",
            hinglish: "Sir, Login page khol rahi hoon."
        },
        {
            url: "/signup",
            keywords: ["signup", "sign up", "register"],
            english: "Opening Signup page, Sir.",
            hinglish: "Sir, Signup page khol rahi hoon."
        },
        {
            url: "/teams",
            keywords: ["teams", "team"],
            english: "Opening Teams page, Sir.",
            hinglish: "Sir, Teams page khol rahi hoon."
        },
        {
            url: "/Mybookings",
            keywords: ["my bookings", "my booking", "mybookings", "meri bookings", "meri booking"],
            english: "Opening My Bookings page, Sir.",
            hinglish: "Sir, aapki My Bookings page khol rahi hoon."
        },
        {
            url: "/Customerbooking",
            keywords: ["customer booking", "customer bookings", "customerbooking"],
            english: "Opening Customer Booking page, Sir.",
            hinglish: "Sir, Customer Booking page khol rahi hoon."
        },
        {
            url: "/carAdmin",
            keywords: ["car admin", "caradmin", "manage cars", "manage my cars"],
            english: "Opening Car Admin page, Sir.",
            hinglish: "Sir, Car Admin page khol rahi hoon."
        },
        {
            url: "/admin",
            keywords: ["admin dashboard", "admin page", "admin"],
            english: "Opening Admin Dashboard, Sir.",
            hinglish: "Sir, Admin Dashboard khol rahi hoon."
        },
        {
            url: "/booking",
            keywords: ["booking form", "booking page", "new booking"],
            english: "Opening Booking Form, Sir.",
            hinglish: "Sir, Booking Form khol rahi hoon."
        }
    ];

    pages.sort((a, b) =>
        Math.max(...b.keywords.map(k => k.length)) -
        Math.max(...a.keywords.map(k => k.length))
    );

    const matchedPage = pages.find(page =>
        page.keywords.some(keyword => text.includes(keyword))
    );

    if (!matchedPage) return false;

    openPage(
        matchedPage.url,
        matchedPage.english,
        matchedPage.hinglish
    );

    return true;
}



    // ==========================================
    // GET CARS FROM DATABASE
    // ==========================================

    async function getMongoCars() {

        const response = await fetch("/api/cars", {
            method: "GET",
            credentials: "include",
            headers: {
                "Accept": "application/json"
            }
        });

        if (!response.ok) {
            throw new Error("Cars API request failed.");
        }

        const data = await response.json();

        if (!data.success || !Array.isArray(data.cars)) {
            throw new Error("Invalid cars data.");
        }

        console.log("MJ MongoDB Cars:", data.cars);

        return data.cars;
    }

    // ==========================================
    // FIND CAR BY NAME
    // ==========================================

    function findBestCar(command, cars) {

        const text = normalize(command);

        const ignoredWords = [
            "mujhe", "mera", "meri", "mere",
            "kar", "car", "cars", "gaadi", "gadi",
            "rent", "pe", "par", "lena", "leni",
            "hai", "hain", "please", "sir",
            "book", "booking", "chahiye",
            "available", "dikhao", "batao",
            "open", "show", "the", "a", "an",
            "i", "want", "to", "for", "me",
            "find", "search", "page", "khol",
            "kholo", "do"
        ];

        const commandWords = text
            .split(" ")
            .filter(word => word && !ignoredWords.includes(word));

        let bestCar = null;
        let bestScore = 0;

        for (const car of cars) {

            const carName = normalize(car.name);

            if (!carName) continue;

            const carWords = carName.split(" ");
            let score = 0;

            if (text.includes(carName)) {
                score += 100;
            }

            const matchedWords = carWords.filter(word =>
                commandWords.includes(word)
            );

            if (matchedWords.length === carWords.length) {
                score += 80;
            } else {
                score += matchedWords.length * 15;
            }

            if (
                carName.length > 3 &&
                text.includes(carName.replace(/\s/g, ""))
            ) {
                score += 70;
            }

            if (score > bestScore) {
                bestScore = score;
                bestCar = car;
            }
        }

        return bestScore >= 15 ? bestCar : null;
    }

    // ==========================================
    // SEARCH CAR
    // ==========================================

    async function searchCarFromMongo(command) {

        try {
            const cars = await getMongoCars();
            const selectedCar = findBestCar(command, cars);

            if (!selectedCar) {

                sessionStorage.setItem("mjSearchCar", command);

                openPage(
                    "/search",
                    "Opening the Search page, Sir.",
                    "Sir, exact car nahi mili. Search page khol rahi hoon."
                );

                return;
            }

            if (selectedCar.isAvailable === false) {

                say(
                    `Sorry Sir, ${selectedCar.name} is unavailable.`,
                    `Sorry Sir, ${selectedCar.name} abhi available nahi hai.`
                );

                return;
            }

            sessionStorage.setItem("mjSearchCar", selectedCar.name);

            openPage(
                "/search",
                `Searching for ${selectedCar.name}, Sir.`,
                `Sir, ${selectedCar.name} search kar rahi hoon.`
            );

        } catch (error) {
            console.error("MJ Search Error:", error);

            say(
                "Sorry Sir, I could not search the cars.",
                "Sorry Sir, cars search nahi ho paayi."
            );
        }
    }

    // ==========================================
    // BOOK CAR
    // ==========================================

    async function bookCarFromMongo(command) {

        try {
            const cars = await getMongoCars();
            const selectedCar = findBestCar(command, cars);

            if (!selectedCar) {

                sessionStorage.setItem("mjSearchCar", command);

                openPage(
                    "/search",
                    "I could not find that exact car. Opening Search page.",
                    "Sir, exact car nahi mili. Search page khol rahi hoon."
                );

                return;
            }

            if (selectedCar.isAvailable === false) {

                say(
                    `Sorry Sir, ${selectedCar.name} is not available.`,
                    `Sorry Sir, ${selectedCar.name} abhi booking ke liye available nahi hai.`
                );

                return;
            }

            if (!selectedCar._id) {
                throw new Error("Car ID not found.");
            }

            openPage(
                `/booking?car=${encodeURIComponent(selectedCar._id)}`,
                `Opening booking for ${selectedCar.name}, Sir.`,
                `Ji Sir, ${selectedCar.name} ka booking page khol rahi hoon.`
            );

        } catch (error) {
            console.error("MJ Booking Error:", error);

            say(
                "Sorry Sir, booking page could not be opened.",
                "Sorry Sir, booking page open nahi ho paaya."
            );
        }
    }



// ==========================================
// CAR DATABASE QUESTION
// "BMW ki kitni cars hain" -> count + naam + price
// ==========================================

// ==========================================
// CATEGORY CARS QUESTION
// "SUV aur luxury me kaun si cars hain" -> DB se naam + price
// Ek ya zyada categories ek saath handle karta hai.
// ==========================================

// ==========================================
// PRICE RANK QUESTION
// "sabse mahangi car konsi hai" / "cheapest SUV" -> DB se
// ==========================================

async function handlePriceRankQuestion(text) {

    const command = normalize(text);

    const asksExpensive =
        /\b(sabse|most|highest|top)\s+(costly|expensive|mehngi|mehangi|mahangi|mahengi|mehnga|mahnga|mahanga)\b/.test(command) ||
        /\b(costliest|priciest|most expensive)\b/.test(command);

    const asksCheapest =
        /\b(sabse|most|lowest)\s+(sasti|sasta|cheap|cheapest|affordable|kam)\b/.test(command) ||
        /\b(cheapest|least expensive)\b/.test(command);

    if (!asksExpensive && !asksCheapest) return false;

    try {
        const cars = await getMongoCars();

        const categories = [
            { name: "SUV",    pattern: /\b(suv|suvs|s u v)\b/ },
            { name: "Sports", pattern: /\b(sports?|supercars?)\b/ },
            { name: "Luxury", pattern: /\b(luxury|luxary|luxry|luxurious)\b/ },
            { name: "Sedan",  pattern: /\b(sedans?)\b/ }
        ];

        // Category boli ho to sirf usi me dhundo
        const category = categories.find(item => item.pattern.test(command));

        const priceOf = car => {
            const value = Number(car.pricePerDay ?? car.price);
            return Number.isFinite(value) ? value : null;
        };

        let pool = cars.filter(car => priceOf(car) !== null);

        if (category) {
            pool = pool.filter(car =>
                normalize(car.category) === normalize(category.name)
            );
        }

        if (pool.length === 0) {
            say(
                "Sorry Sir, I could not find price details for that right now.",
                "Sorry Sir, abhi iske price details mere paas nahi mile."
            );
            return true;
        }

        pool.sort((a, b) =>
            asksExpensive
                ? priceOf(b) - priceOf(a)
                : priceOf(a) - priceOf(b)
        );

        const car = pool[0];
        const price = priceOf(car);
        const unavailable = car.isAvailable === false;
        const where = category ? ` in the ${category.name} category` : " on RideWave";
        const whereHi = category ? `${category.name} category mein` : "RideWave par";

        say(
            `Sir, the ${asksExpensive ? "most expensive" : "cheapest"} car${where} is ${car.name} at ${price} rupees per day.${unavailable ? " It is currently unavailable." : ""}`,
            `Sir, ${whereHi} sabse ${asksExpensive ? "mehngi" : "sasti"} car ${car.name} hai, jiska rent ${price} rupees per day hai.${unavailable ? " Ye abhi available nahi hai." : ""}`
        );

        return true;

    } catch (error) {
        console.error("MJ Price Rank Error:", error);

        say(
            "Sorry Sir, I could not check the prices right now.",
            "Sorry Sir, abhi prices check nahi ho paayi."
        );

        return true;
    }
}


async function handleCategoryCarsQuestion(text) {

    const command = normalize(text);

    const categories = [
        { name: "SUV",    pattern: /\b(suv|suvs|s u v)\b/ },
        { name: "Sports", pattern: /\b(sports?|supercars?)\b/ },
        { name: "Luxury", pattern: /\b(luxury|luxary|luxry|luxurious)\b/ },
        { name: "Sedan",  pattern: /\b(sedans?)\b/ }
    ];

    // FIX: pehle sirf pehli category milti thi, ab saari milti hain
    const requested = categories.filter(item => item.pattern.test(command));

    if (requested.length === 0) return false;

    const asksList =
        /\b(kitni|kitne|kitna|how many|kaun|kon|kaunsi|konsi|konse|kaunse|which|what|list|naam|name|names)\b/.test(command) ||
        /\bcars?\b.*\b(hai|he|hain|hein|available)\b/.test(command);

    // Recommendation / booking / navigation wale commands yahan nahi aate
    const wantsOtherAction =
        /\b(best|suggest|recommend|recommendation|chahiye|book|booking|rent|open|kholo|khol|play|video|clip|clips)\b/.test(command);

    if (!asksList || wantsOtherAction) return false;

    try {
        const cars = await getMongoCars();

        const priceOf = car => {
            const value = Number(car.pricePerDay ?? car.price);
            return Number.isFinite(value) ? value : null;
        };

        const partsEn = [];
        const partsHi = [];

        for (const category of requested) {

            const matched = cars.filter(car =>
                car.isAvailable !== false &&
                normalize(car.category) === normalize(category.name)
            );

            if (matched.length === 0) {
                partsEn.push(`no ${category.name} cars are available right now.`);
                partsHi.push(`${category.name} category mein abhi koi car available nahi hai.`);
                continue;
            }

            const listEn = matched.map(car => {
                const price = priceOf(car);
                return price === null
                    ? car.name
                    : `${car.name} at ${price} rupees per day`;
            }).join(", ");

            const listHi = matched.map(car => {
                const price = priceOf(car);
                return price === null
                    ? car.name
                    : `${car.name}, ${price} rupees per day`;
            }).join(", ");

            partsEn.push(
                `in the ${category.name} category we have ${matched.length} car${matched.length > 1 ? "s" : ""}: ${listEn}.`
            );

            partsHi.push(
                `${category.name} category mein ${matched.length} car${matched.length > 1 ? "s" : ""} hain: ${listHi}.`
            );
        }

        say(
            `Sir, ${partsEn.join(" Also, ")}`,
            `Sir, ${partsHi.join(" Aur ")}`
        );

        return true;

    } catch (error) {
        console.error("MJ Category Cars Error:", error);

        say(
            "Sorry Sir, I could not check the categories right now.",
            "Sorry Sir, abhi categories check nahi ho paayi."
        );

        return true;
    }
}


async function handleCarDatabaseQuestion(text) {

    const command = String(text || "")
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, " ")
        .replace(/\s+/g, " ")
        .trim();

    const asksCount =
        /\b(total|kitne|kitni|kitna|how many|count|number of|hamare paas|apne paas|apne pass)\b/i.test(command);

    // NOTE: sirf "rent" / "rental" nahi rakha, warna
    // "BMW rent pe leni hai" booking ki jagah price bol deta.
    const asksPrice =
        /\b(price|prices|rate|kiraya|kitne ka|kitne ki|per day|daily)\b/i.test(command) ||
        /\b(rent|rental)\s+(price|rate)\b/i.test(command);

    if (!asksCount && !asksPrice) return false;

    try {
        const cars = await getMongoCars();

        const brands = [
            "rolls royce", "rolls-royce", "bmw", "mercedes", "audi",
            "lamborghini", "ferrari", "porsche", "mustang", "ford",
            "toyota", "tesla", "maserati", "volvo", "jaguar",
            "land rover", "range rover", "bentley", "bugatti", "pagani"
        ];

        const squash = value => String(value || "")
            .toLowerCase()
            .replace(/[-\s]/g, "");

        const requestedBrand = brands.find(brand =>
            command.includes(brand)
        );

        let matchingCars = [];

        if (requestedBrand) {
            matchingCars = cars.filter(car =>
                squash(car.name).includes(squash(requestedBrand))
            );
        } else {
            matchingCars = cars.filter(car => {
                const name = String(car.name || "").toLowerCase();
                return name && command.includes(name);
            });
        }

        // Brand / car ka naam nahi mila -> dusre handlers ko chance do
        if (!requestedBrand && matchingCars.length === 0) return false;

        if (matchingCars.length === 0) {
            say(
                "Sorry Sir, I could not find that car in our current inventory.",
                "Sorry Sir, ye car abhi hamare database mein nahi mili."
            );
            return true;
        }

        const brandLabel = requestedBrand
            ? requestedBrand.toUpperCase()
            : matchingCars[0].name;

        const priceOf = car => {
            const value = Number(car.pricePerDay ?? car.price);
            return Number.isFinite(value) ? value : null;
        };

        const carDetailsEn = matchingCars
            .map(car => {
                const price = priceOf(car);
                return price === null
                    ? `${car.name}, price not available`
                    : `${car.name} at ${price} rupees per day`;
            })
            .join(", ");

        const carDetailsHi = matchingCars
            .map(car => {
                const price = priceOf(car);
                return price === null
                    ? `${car.name}, price available nahi hai`
                    : `${car.name}, ${price} rupees per day`;
            })
            .join(", ");

        const count = matchingCars.length;

        say(
            `Sir, we have ${count} ${brandLabel} car${count > 1 ? "s" : ""}. They are: ${carDetailsEn}.`,
            `Sir, hamare paas ${count} ${brandLabel} car${count > 1 ? "s" : ""} hain. Inke naam aur price hain: ${carDetailsHi}.`
        );

        return true;

    } catch (error) {
        console.error("MJ Database Question Error:", error);

        say(
            "Sorry Sir, I could not check the database right now.",
            "Sorry Sir, abhi database check nahi ho pa raha hai."
        );

        return true;
    }
}



// ==========================================
// INVENTORY
// ==========================================

async function handleInventory(command) {

    const inventoryWords = [
        "how many cars",
        "how many car",
        "kitni cars",
        "kitni car",
        "total cars",
        "total car",
        "available cars",
        "available car",
        "which cars",
        "kaunsi cars",
        "kaun si cars",
        "cars available",
        "list cars",
        "show all cars",
        "car list",
        "cars list",

        // CATEGORY QUESTIONS - HINDI + ENGLISH + HINGLISH

        "kitni categories",
        "kitni category",
        "total categories",
        "total category",
        "how many categories",
        "how many car categories",
        "how many types of cars",
        "what are the cars categories",
        "tell me cars categories",
        "show cars categories",
        "list all categories",

        "category ki cars",
        "categories ki cars",
        "cars ki categories",
        "cars ki category",
        "kitni category ki cars",
        "kitni categories ki cars",
        "total kitni category ki cars",
        "total kitni categories ki cars",

        "apne paas kitni category",
        "apne pass kitni category",
        "apne paas total kitni category",
        "apne pass total kitni category",
        "apne paas total kitni category ki cars hai",
        "apne pass total kitni category hai",
        "apne paas kitni categories hain",
        "apne pass kitni categories hain",

        "ridewave mein kitni categories",
        "ridewave me kitni category",
        "ridewave mein total kitni categories",
        "ridewave me total kitni category",
        "ridewave ki categories batao",
        "cars categories batao",
        "categories batao",
        "category batao",
        "saari categories dikhao",
        "kitni type ki cars hain",
        "kitne type ki cars hai",
        "kitne prakar ki cars hain",
        "cars ki kitni types hain",
        "cars ke kitne types hain",

        "how many category we have",
        "how many categories do we have",
        "how many categories are available",
        "total number of categories",
        "tell me how many categories",
        "can you tell me cars categories"
    ];

    // Speech recognition ki galtiyon ke liye loose match
    // ("kitne category ke kam hai", "kitne category bekar hai" etc.)
    const asksCategoryLoose =
        /kitn|how many|total/.test(command) &&
        /categor/.test(command);

    const asksInventory = asksCategoryLoose || inventoryWords.some(word =>
        command.includes(word)
    );

    if (!asksInventory) return false;

    try {

        const cars = await getMongoCars();

        const availableCars = cars.filter(car =>
            car.isAvailable !== false
        );

        // CATEGORY COUNT
        if (
            command.includes("categor") ||
            command.includes("category")
        ) {

            const categoryList = [
                ...new Set(
                    availableCars
                        .map(car => car.category)
                        .filter(Boolean)
                )
            ];

            say(
                `Sir, RideWave has ${categoryList.length} available car categories: ${categoryList.join(", ")}. Which category of cars would you like to explore?`,
                `Sir, RideWave mein total ${categoryList.length} car categories available hain: ${categoryList.join(", ")}. Aap konsi category ki cars dekhna chahte hain?`
            );

            return true;
        }

        // CAR COUNT
        const names = availableCars
            .map(car => car.name)
            .filter(Boolean);

        say(
            `Sir, we have ${names.length} cars available. ${names.join(", ")}.`,
            `Sir, RideWave mein ${names.length} cars available hain. Inke naam hain: ${names.join(", ")}.`
        );

        return true;

    } catch (error) {

        console.error("MJ Inventory Error:", error);

        say(
            "Sorry Sir, I could not fetch the inventory.",
            "Sorry Sir, car inventory load nahi ho paayi."
        );

        return true;
    }
}



    // ==========================================
    // CATEGORY FILTER
    // ==========================================

    async function filterCategory(category) {

        try {
            const cars = await getMongoCars();

            const matchedCars = cars.filter(car =>
                normalize(car.category) === normalize(category) &&
                car.isAvailable !== false
            );

            if (matchedCars.length === 0) {

                say(
                    `Sorry Sir, no ${category} cars are available.`,
                    `Sorry Sir, abhi ${category} category mein koi car available nahi hai.`
                );

                return;
            }

            sessionStorage.setItem("mjCategory", category);

            openPage(
                "/search?category=" + encodeURIComponent(category),
                `Opening ${category} cars, Sir.`,
                `Sir, ${category} category khol rahi hoon.`
            );

        } catch (error) {
            console.error("MJ Category Error:", error);

            say(
                "Sorry Sir, category could not be loaded.",
                "Sorry Sir, category load nahi ho paayi."
            );
        }
    }


    // ==========================================
    // NOTIFICATION READER
    // "meri notification padho" / "koi nayi notification aayi hai?"
    // ==========================================

    async function handleNotificationQuestion(text) {

        const command = normalize(text);

        // "notif" loose match: speech recognition ki galtiyon ke liye
        // (notification, notifiaction, notifications etc.)
        const mentionsNotification =
            /notif|\b(alerts?|sandesh|suchna)\b/.test(command);

        const isHowTo = /\b(kaise|how to|band|off|disable)\b/.test(command);

        if (!mentionsNotification || isHowTo) return false;

        const asksCount =
            /\b(kitni|kitne|how many|count)\b/.test(command);

        try {
            const response = await fetch("/api/notifications", {
                method: "GET",
                credentials: "include",
                headers: { "Accept": "application/json" }
            });

            if (response.status === 401) {
                say(
                    "Sir, please login first so I can read your notifications.",
                    "Sir, pehle login kijiye, phir main aapki notifications padh dungi."
                );
                return true;
            }

            if (!response.ok) {
                throw new Error("Notifications API request failed.");
            }

            const data = await response.json();
            const list = Array.isArray(data.notifications) ? data.notifications : [];

            // Sabse nayi notification pehle
            list.sort((a, b) =>
                new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
            );

            const isUnread = item =>
                item.isRead === false || item.read === false;

            const unread = list.filter(isUnread);

            if (asksCount) {
                say(
                    `Sir, you have ${unread.length} unread notification${unread.length === 1 ? "" : "s"}.`,
                    `Sir, aapki ${unread.length} nayi notification${unread.length === 1 ? "" : "s"} hain.`
                );
                return true;
            }

            if (list.length === 0) {
                say(
                    "Sir, you have no notifications right now.",
                    "Sir, abhi aapki koi notification nahi hai."
                );
                return true;
            }

            if (unread.length === 0) {
                say(
                    "Sir, you have no new notifications.",
                    "Sir, aapki koi nayi notification nahi hai."
                );
                return true;
            }

            // Sabse upar wali (latest) 3 unread notifications padho
            const toRead = unread.slice(0, 3);

            const introEn = toRead.length === 1
                ? "Sir, you have one new notification."
                : `Sir, you have ${unread.length} new notifications. Here are the latest ${toRead.length}.`;

            const introHi = toRead.length === 1
                ? "Sir, aapki ek nayi notification hai."
                : `Sir, aapki ${unread.length} nayi notifications hain. Ye sabse nayi ${toRead.length} hain.`;

            const bodyEn = toRead
                .map((item, index) => `Number ${index + 1}. ${item.message}`)
                .join(" ");

            const bodyHi = toRead
                .map((item, index) => `Number ${index + 1}. ${item.message}`)
                .join(" ");

            say(
                `${introEn} ${bodyEn}`,
                `${introHi} ${bodyHi}`
            );

            return true;

        } catch (error) {
            console.error("MJ Notification Error:", error);

            say(
                "Sorry Sir, I could not read your notifications right now.",
                "Sorry Sir, abhi main aapki notifications nahi padh paayi."
            );

            return true;
        }
    }


    // ==========================================
    // BOOKING STATUS QUESTION
    // "meri booking confirm hui?" -> pending / confirmed / cancelled
    // ==========================================

    async function handleBookingStatusQuestion(text) {

        const command = normalize(text);

        // Booking ki taraf ishara karne wale words
        // ("booking", "request", "owner", "payment", "car" etc.)
        const mentionsBooking =
            /\b(booking|bookings|book|booked|request|requests|status|reservation|refund|refunded|paise|paisa|payment|owner|car|gaadi|gadi|rent|rental|ride|order)\b/.test(command);

        // Status poochne wale words (speech recognition ki galtiyon ke saath:
        // "conform", "cancle", "cansel" etc.)
        const asksStatus =
            /\b(confirm|confirmed|confirmation|conform|confrm|conferm|kanform|accept|accepted|approve|approved|approval|manzoor|manjoor|cancel|cancelled|canceled|cancle|cansel|reject|rejected|pending|status|owner|complete|completed|refund|refunded|wapas|hui|hua|hue|hoi|hogai|hogayi|hogaya|reply|replied|jawab|response|respond|kari|kiya|diya|mila)\b/.test(command) ||
            /ho gayi|ho gaya|ho gai|abhi tak|kar diya|kar di|kar dia/.test(command);

        const asksRefund = /refund|wapas/.test(command);

        const isHowTo = /\b(kaise|how)\b/.test(command) && !asksRefund;

        // "BMW book karni hai" / "car chahiye" jaise commands status nahi hain
        const isActionRequest =
            /\b(chahiye|leni|lena|karni|karna|kar do|karo|dikhao|dikha do|batao kaun)\b/.test(command) &&
            !/(hui|hua|hue|ho gayi|ho gaya|abhi tak|kari|kiya|diya)/.test(command);

        if (!mentionsBooking || !asksStatus || isHowTo || isActionRequest) return false;

        try {
            const response = await fetch("/api/bookings/my-bookings", {
                method: "GET",
                credentials: "include",
                headers: { "Accept": "application/json" }
            });

            if (response.status === 401) {
                say(
                    "Sir, please login first so I can check your booking.",
                    "Sir, pehle login kijiye, phir main aapki booking check kar dungi."
                );
                return true;
            }

            if (!response.ok) {
                throw new Error("Bookings API request failed.");
            }

            const data = await response.json();
            const bookings = Array.isArray(data.bookings) ? data.bookings : [];

            if (bookings.length === 0) {
                say(
                    "Sir, I could not find any booking on your account.",
                    "Sir, aapke account par mujhe koi booking nahi mili."
                );
                return true;
            }

            // Sabse latest booking (API already latest first deti hai)
            bookings.sort((a, b) =>
                new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
            );

            const booking = bookings[0];

            const carName = booking.car?.name || "your car";
            const status = normalize(booking.status);
            const paymentStatus = normalize(booking.payment?.status);
            const note = String(booking.note || "").trim();
            const cancelledByUser =
                booking.cancelledBy === "customer" ||
                normalize(note) === "user cancelled";

            const refundAmount = Number(booking.payment?.refundAmount) || 0;

            const refundTextEn = paymentStatus === "refunded"
                ? (refundAmount
                    ? ` Your payment of ${refundAmount} rupees has been marked as refunded.`
                    : " Your payment has been marked as refunded.")
                : "";

            const refundTextHi = paymentStatus === "refunded"
                ? (refundAmount
                    ? ` Aapki ${refundAmount} rupees ki payment refund mark kar di gayi hai.`
                    : " Aapki payment refund mark kar di gayi hai.")
                : "";

            // REFUND SAWAAL: booking cancel nahi hui hai to samjhao
            if (asksRefund && status !== "cancelled") {

                if (status === "completed") {
                    say(
                        `Sir, your booking for ${carName} is already completed, so there is no refund.`,
                        `Sir, aapki ${carName} ki booking complete ho chuki hai, isliye refund nahi hoga.`
                    );
                } else if (paymentStatus === "paid") {
                    say(
                        `Sir, your payment for ${carName} is done. If you cancel this booking, your payment will be marked as refunded. You can cancel it from the My Bookings page.`,
                        `Sir, aapki ${carName} ki payment ho chuki hai. Agar aap ye booking cancel karenge, to aapki payment refund mark ho jayegi. Cancel karne ke liye My Bookings page par cancel button dabaiye.`
                    );
                } else {
                    say(
                        `Sir, you have not paid for ${carName} yet, so there is nothing to refund.`,
                        `Sir, aapne ${carName} ki payment abhi nahi ki hai, isliye refund ki zaroorat nahi hai.`
                    );
                }

                return true;
            }

            switch (status) {

                case "pending":
                    say(
                        `Sir, your request for ${carName} has been sent to the owner. The owner has not confirmed it yet, please wait a little.`,
                        `Sir, aapki ${carName} ki request owner ko bhej di gayi hai. Owner ne abhi confirm nahi kiya hai, thoda wait kijiye.`
                    );
                    break;

                case "confirmed":
                    if (paymentStatus === "paid") {
                        say(
                            `Sir, your payment is done and your booking for ${carName} is confirmed. Happy journey!`,
                            `Sir, aapki payment ho chuki hai aur ${carName} ki booking pakki hai. Happy journey!`
                        );
                    } else {
                        say(
                            `Yes Sir, your request for ${carName} has been accepted. The owner has confirmed it, you can now make the payment.`,
                            `Ji Sir, aapki ${carName} ki request accept ho gayi hai. Owner ne confirm kar diya hai, ab aap payment kar sakte hain niche paid ka button aa rha hoga. Agar aapko payment ka option na dikhe, to ek baar page refresh karke dekhiye.`
                        );
                    }
                    break;

                case "cancelled":
                    if (cancelledByUser) {
                        say(
                            `Sir, this booking for ${carName} was cancelled by you.${refundTextEn}`,
                            `Sir, ${carName} ki ye booking aapne khud cancel ki thi.${refundTextHi}`
                        );
                    } else {
                        const refundEn = refundTextEn;
                        const refundHi = refundTextHi;

                        say(
                            `Sorry Sir, the owner has cancelled your booking for ${carName}.${note ? " Reason: " + note + "." : ""}${refundEn} You can look at another car.`,
                            `Sorry Sir, owner ne aapki ${carName} ki booking cancel kar di hai.${note ? " Reason: " + note + "." : ""}${refundHi} Aap koi dusri car dekh sakte hain.`
                        );
                    }
                    break;

                case "completed":
                    say(
                        `Sir, your booking for ${carName} has been completed. Thank you for riding with RideWave!`,
                        `Sir, aapki ${carName} ki booking complete ho chuki hai. RideWave ke saath ride karne ke liye shukriya!`
                    );
                    break;

                default:
                    say(
                        "Sir, I cannot check the booking status right now. Please try again in a moment.",
                        "Sir, abhi booking ka status check nahi ho pa raha. Thodi der baad try kijiye."
                    );
            }

            return true;

        } catch (error) {
            console.error("MJ Booking Status Error:", error);

            say(
                "Sorry Sir, I could not check your booking status right now.",
                "Sorry Sir, abhi booking status check nahi ho paaya."
            );

            return true;
        }
    }


    // ==========================================
    // OPEN CAR COMMAND
    // "BMW open karo" / "Fortuner kholo" / "open Defender"
    // ==========================================

    // Do words me kitna farak hai (speech recognition ki chhoti galtiyon ke liye)
    function mjEditDistance(a, b) {

        const rows = a.length + 1;
        const cols = b.length + 1;
        const grid = Array.from({ length: rows }, () => new Array(cols).fill(0));

        for (let i = 0; i < rows; i++) grid[i][0] = i;
        for (let j = 0; j < cols; j++) grid[0][j] = j;

        for (let i = 1; i < rows; i++) {
            for (let j = 1; j < cols; j++) {
                const cost = a[i - 1] === b[j - 1] ? 0 : 1;
                grid[i][j] = Math.min(
                    grid[i - 1][j] + 1,
                    grid[i][j - 1] + 1,
                    grid[i - 1][j - 1] + cost
                );
            }
        }

        return grid[a.length][b.length];
    }

    // Normal match na mile to: "for tuner" -> "fortuner", "fortunar" -> "fortuner"
    function findCarLoosely(command, cars) {

        const squashedCommand = command.replace(/\s/g, "");
        const commandWords = command.split(" ").filter(Boolean);

        for (const car of cars) {

            const carName = normalize(car.name);
            const squashedName = carName.replace(/\s/g, "");

            if (squashedName.length > 3 && squashedCommand.includes(squashedName)) {
                return car;
            }
        }

        // Car ke naam ka koi lamba word (jaise "fortuner") jab bolne me
        // alag alag tut gaya ho ("for tuner")
        for (const car of cars) {

            const longWords = normalize(car.name)
                .split(" ")
                .filter(word => word.length >= 5);

            if (longWords.some(word => squashedCommand.includes(word))) {
                return car;
            }
        }

        for (const car of cars) {

            const carWords = normalize(car.name)
                .split(" ")
                .filter(word => word.length >= 5);

            for (const carWord of carWords) {

                const allowed = carWord.length >= 8 ? 2 : 1;

                const close = commandWords.some(word =>
                    word.length >= 4 &&
                    Math.abs(word.length - carWord.length) <= allowed &&
                    mjEditDistance(word, carWord) <= allowed
                );

                if (close) return car;
            }
        }

        return null;
    }

    async function handleOpenCarCommand(text) {

        const command = normalize(text);

        const wantsOpen =
            /\b(open|kholo|khol|kholiye|dikhao|dikha|dekhna|dekho|dekhni|chalo|jao|show|view|visit)\b/.test(command) ||
            /khol do|le chalo/.test(command);

        if (!wantsOpen) return false;

        // "BMW book karni hai" jaise commands booking wale handler ke paas jayenge
        if (hasBookingIntent(command)) return false;

        try {
            const cars = await getMongoCars();

            const selectedCar =
                findBestCar(command, cars) ||
                findCarLoosely(command, cars);

            // Car ka naam nahi mila -> baaki handlers / AI ko chance do
            if (!selectedCar) return false;

            if (selectedCar.isAvailable === false) {
                say(
                    `Sorry Sir, ${selectedCar.name} is not available right now.`,
                    `Sorry Sir, ${selectedCar.name} abhi available nahi hai.`
                );
                return true;
            }

            sessionStorage.setItem("mjSearchCar", selectedCar.name);

            openPage(
                "/search",
                `Opening ${selectedCar.name}, Sir.`,
                `Ji Sir, ${selectedCar.name} khol rahi hoon.`
            );

            return true;

        } catch (error) {
            console.error("MJ Open Car Error:", error);

            say(
                "Sorry Sir, I could not open that car right now.",
                "Sorry Sir, abhi ye car open nahi ho paayi."
            );

            return true;
        }
    }


    // ==========================================
    // BOOKING INTENT
    // ==========================================

    function hasBookingIntent(text) {

        const words = [
            "book", "booking", "rent", "rental",
            "hire", "reserve", "kiraye",
            "lena hai", "leni hai", "rent pe",
            "rent par", "book karna", "book karni",
            "rent karna", "rent karni", "chahiye"
        ];

        return words.some(word => text.includes(word));
    }

    // ==========================================
    // VIDEO CONTROL (CLIPS PAGE)
    // ==========================================

    let mjLastVideo = null;

    // Jo bhi video play ho, usse "last video" yaad rakho (start video ke liye)
    document.querySelectorAll("video").forEach(video => {
        video.addEventListener("play", () => {
            mjLastVideo = video;
        });
    });

    // Fallback fullscreen ka style (jab browser native fullscreen block kare)
    const mjFsStyle = document.createElement("style");
    mjFsStyle.textContent = `
        .mj-fs-card {
            transform: none !important;
            transition: none !important;
        }
        .mj-fs-card video {
            position: fixed !important;
            inset: 0 !important;
            width: 100vw !important;
            height: 100vh !important;
            max-width: none !important;
            object-fit: contain !important;
            background: #000 !important;
            z-index: 2000000 !important;
        }
        body.mj-fs-active .navbar {
            display: none !important;
        }
        .mj-fs-close {
            position: fixed;
            top: 16px;
            right: 16px;
            z-index: 2000001;
            padding: 10px 16px;
            border: 1px solid rgba(255,255,255,.3);
            border-radius: 8px;
            background: rgba(0,0,0,.7);
            color: #fff;
            font-size: 13px;
            font-weight: 700;
            cursor: pointer;
        }
    `;
    document.head.appendChild(mjFsStyle);

    function mjPauseAll(except) {
        document.querySelectorAll("video").forEach(video => {
            if (video !== except) video.pause();
        });
    }

    function mjCurrentVideo() {
        if (mjLastVideo) return mjLastVideo;

        const all = Array.from(document.querySelectorAll("video"));

        return (
            all.find(video => !video.paused) ||
            document.querySelector(".video-card:not(.hidden) video") ||
            all[0] ||
            null
        );
    }

    function mjExitFullscreen() {
        if (document.fullscreenElement) {
            document.exitFullscreen().catch(() => {});
        } else if (document.webkitFullscreenElement) {
            document.webkitExitFullscreen();
        }

        document.querySelectorAll(".mj-fs-card")
            .forEach(card => card.classList.remove("mj-fs-card"));

        document.body.classList.remove("mj-fs-active");

        document.querySelectorAll(".mj-fs-close")
            .forEach(btn => btn.remove());
    }

    document.addEventListener("keydown", event => {
        if (event.key === "Escape") mjExitFullscreen();
    });

    async function mjEnterFullscreen(video) {

        // 1) Native fullscreen try karo
        try {
            if (video.requestFullscreen) {
                await video.requestFullscreen();
                return;
            }
            if (video.webkitRequestFullscreen) {
                video.webkitRequestFullscreen();
                return;
            }
            if (video.webkitEnterFullscreen) {
                video.webkitEnterFullscreen();
                return;
            }
        } catch (error) {
            console.warn("Native fullscreen blocked, using fallback:", error);
        }

        // 2) Fallback: page ke andar full screen
        const card = video.closest(".video-card");

        if (!card) return;

        mjExitFullscreen();

        card.classList.add("mj-fs-card");
        document.body.classList.add("mj-fs-active");

        const closeBtn = document.createElement("button");
        closeBtn.className = "mj-fs-close";
        closeBtn.textContent = "✕ Close";
        closeBtn.addEventListener("click", mjExitFullscreen);
        document.body.appendChild(closeBtn);
    }

    // Command se car ka video dhundo (title: "BMW M3 CS", "Defender" etc.)
    function mjFindVideoCard(text) {

        const aliases = {
            lambo: "lamborghini",
            merc: "mercedes",
            benz: "mercedes"
        };

        const ignore = [
            "video", "videos", "vedio", "clip", "clips", "film", "movie",
            "play", "start", "resume", "chalao", "chalu", "chala", "shuru",
            "full", "screen", "fullscreen", "poori", "pura", "puri",
            "pe", "par", "me", "mein", "ki", "ka", "ke", "ko",
            "karo", "kar", "do", "dikhao", "dikha", "dekhna", "dekho",
            "open", "show", "watch", "the", "a", "an", "of", "and", "aur",
            "please", "sir", "mj", "hey", "car", "cars", "gaadi", "gadi",
            "wali", "wala", "hai", "to", "in", "on", "i", "want", "mujhe"
        ];

        const words = normalize(text)
            .split(" ")
            .map(word => aliases[word] || word)
            .filter(word => word && !ignore.includes(word));

        let bestCard = null;
        let bestScore = 0;

        document.querySelectorAll(".video-card").forEach(card => {

            const title = normalize(card.querySelector("h3")?.textContent);

            const score = title
                .split(" ")
                .filter(word => words.includes(word)).length;

            if (score > bestScore) {
                bestScore = score;
                bestCard = card;
            }
        });

        return bestCard;
    }

    async function handleVideoCommand(text) {

        // Is page par video hi nahi hai toh kuch mat karo
        if (!document.querySelector("video")) return false;

        const hasVideoWord =
            /\b(video|videos|vedio|clip|clips|film|films|movie)\b/.test(text) ||
            /वीडियो/.test(text);

        const bookingWord = /\b(book|booking|rent|reserve|hire)\b/.test(text);

        const wantsFullscreen =
            /full\s*screen|fullscreen kar do|ful\s*screen|puri screen|poori screen|pura screen kar do|full screen par kar do|full screen mein kar do/.test(text);

        const wantsStop = /\b(stop|pause|ruko|ruk|roko|rok|band)\b/.test(text);

        const wantsPlay =
            /\b(play|start|resume|chalao|chalu|chala|shuru)\b/.test(text);

        // ---------- EXIT FULLSCREEN ----------
        if (
            wantsFullscreen &&
            /\b(exit|close|band|minimize|normal|hatao|hata|chhota|back)\b/.test(text)
        ) {
            mjExitFullscreen();

            say(
                "Exiting full screen, Sir.",
                "Sir, full screen band kar di."
            );
            return true;
        }

        // ---------- STOP / PAUSE VIDEO ----------
        if (wantsStop && (hasVideoWord || text === "pause")) {
            mjPauseAll();

            say(
                "Video stopped, Sir.",
                "Ji Sir, video band kar di."
            );
            return true;
        }

        // ---------- RANDOM VIDEO ----------
        // FIX: pehle yahan beech me ";" tha, isliye neeche ki
        // start/stop/pause conditions alag statements ban gayi thi.
        // Wo conditions random video ki nahi hain (wantsStop / wantsPlay
        // se already handle hoti hain), isliye hata di.
        const wantsRandomVideo =
            text.includes("koi bhi video") ||
            text.includes("koi si bhi video") ||
            text.includes("koi video") ||
            text.includes("kuch bhi chalao") ||
            text.includes("any video") ||
            text.includes("random video") ||
            text.includes("surprise me");

        if (wantsRandomVideo && !bookingWord) {

            const visibleCards = Array.from(
                document.querySelectorAll(".video-card:not(.hidden)")
            );

            if (visibleCards.length > 0) {

                const randomCard =
                    visibleCards[Math.floor(Math.random() * visibleCards.length)];

                const video = randomCard.querySelector("video");
                const title =
                    randomCard.querySelector("h3")?.textContent.trim() || "this";

                mjPauseAll(video);
                mjLastVideo = video;

                randomCard.scrollIntoView({ behavior: "smooth", block: "center" });

                if (wantsFullscreen) {
                    await mjEnterFullscreen(video);
                }

                say(
                    `Playing the ${title} video, Sir.`,
                    `Sir, ${title} ki video chala rahi hoon.`,
                    () => {
                        video.play().catch(error => {
                            console.warn("Video play blocked:", error);
                        });
                    }
                );

                return true;
            }
        }

        // ---------- PLAY SPECIFIC CAR VIDEO ----------
        const card = (!bookingWord && (hasVideoWord || wantsPlay || wantsFullscreen))
            ? mjFindVideoCard(text)
            : null;

        if (card) {

            const video = card.querySelector("video");
            const title = card.querySelector("h3")?.textContent.trim() || "this";

            if (!video) return false;

            if (card.classList.contains("hidden")) {
                document
                    .querySelector('.filter-btn[data-filter="all"]')
                    ?.click();
            }

            mjPauseAll(video);
            mjLastVideo = video;

            card.scrollIntoView({
                behavior: "smooth",
                block: "center"
            });

            // Play video first
            try {
                await video.play();
            } catch (error) {
                console.warn("Video play blocked:", error);
            }

            // Then try fullscreen if requested
            if (wantsFullscreen) {
                try {
                    await mjEnterFullscreen(video);
                } catch (error) {
                    console.warn("Fullscreen failed:", error);
                }
            }

            say(
                `Playing the ${title} video${wantsFullscreen ? " in full screen" : ""}, Sir.`,
                `Sir, ${title} ki video${wantsFullscreen ? " full screen mein" : ""} chala rahi hoon.`
            );

            return true;
        }

        // ---------- START / RESUME LAST VIDEO ----------
        if (
            (wantsPlay && hasVideoWord) ||
            text === "resume" ||
            text === "play"
        ) {

            const video = mjCurrentVideo();

            if (!video) {
                say(
                    "Sir, which video would you like to play? For example BMW or Lamborghini.",
                    "Sir, aap konsi video dekhna chahte hain? Jaise BMW ya Lamborghini."
                );
                return true;
            }

            mjPauseAll(video);
            mjLastVideo = video;

            if (wantsFullscreen) {
                await mjEnterFullscreen(video);
            }

            say(
                "Playing the video, Sir.",
                "Ji Sir, video chala rahi hoon.",
                () => {
                    video.play().catch(error => {
                        console.warn("Video play blocked:", error);
                    });
                }
            );

            return true;
        }

        // ---------- FULLSCREEN CURRENT PLAYING VIDEO ----------
        if (wantsFullscreen) {

            const video = mjCurrentVideo();

            if (!video) {
                say(
                    "Sir, no video is currently selected.",
                    "Sir, abhi koi video select nahi hai."
                );
                return true;
            }

            await mjEnterFullscreen(video);

            say(
                "Sure Sir, switching the video to full screen.",
                " Sir, video ko full screen kar rahi hoon."
            );

            return true;
        }

        // FIX: koi bhi video condition match nahi hui -> false return karo
        // taaki baaki commands (BMW kitni cars etc.) aage chal sakein.
        return false;
    }



    // ==========================================
    // COMMAND HANDLER
    // ==========================================

    async function handleMJCommand(command) {

        const text = normalize(command);

        if (!text) return;

        console.log("User Command:", text);

        currentLanguage = detectLanguage(text);

        console.log("Detected Language:", currentLanguage);

        // STOP MJ
        if (
            text === "stop" ||
            text.includes("stop talking") ||
            text.includes("be quiet") ||
            text.includes("chup ho jao")
        ) {
            speechId++;
            window.speechSynthesis.cancel();
            return;
        }

        // VIDEO CONTROL (clips page)
        if (await handleVideoCommand(text)) {
            return;
        }

        // INTRODUCTION
        if (
            text.includes("who are you") ||
            text.includes("who r u") ||
            text.includes("introduce yourself") ||
            text.includes("tumhara introduction do") ||
            text.includes("tell me about self") ||
            text.includes("your name") ||
            text.includes("what can you do") ||
            text.includes("what do you do") ||
            text.includes("what are you") ||
            text.includes("how can you help") ||
            text.includes("what can you help") ||
            text.includes("tum kya karti ho") ||
            text.includes("aap kya karti ho") ||
            text.includes("tum kya kar sakti") ||
            text.includes("tum kaun ho") ||
            text.includes("tum kon ho") ||
            text.includes("aap kaun ho") ||
            text.includes("aap kon ho") ||
            text.includes("aap kaun hain") ||
            text.includes("apna introduction do") ||
            text.includes("apna intro") ||
            text.includes("apna parichay") ||
            text.includes("apne bare mein batao") ||
            text.includes("apne baare mein batao") ||
            text.includes("tumhara naam kya he ") ||
            text.includes("tumhara naam") ||
            text.includes("aapka naam") ||
            text.includes("tum kya kar sakti ho") ||
            text.includes("aap kya kar sakti ho")
        ) {
            say(
                "Hello Sir, I am MJ, the AI assistant of RideWave. I can help you search cars, explore categories, recommend the right car, start a booking, play car videos and navigate the website. Just tell me what you need.",
                "Hello Sir, main MJ hoon, Ride Wave ki AI assistant. Main aapko cars search karne, categories dekhne, sahi car suggest karne, booking shuru karne, car videos chalane aur website navigate karne mein help kar sakti hoon. Bas bataiye kya chahiye."
            );
            return;
        }

        // WHO BUILT MJ
        if (
            text.includes("who built you") ||
            text.includes("who made you") ||
            text.includes("who created you") ||
            text.includes("kisne banaya") ||
            text.includes("tumhe kisne banaya") ||
            text.includes(" MJ tumhe kisne build kiya he")
        ) {
            say(
                "I was developed for the RideWave development team.",
                "Sir, mujhe build RideWave development team ne kiya  hai."
            );
            return;
        }

        // ==========================================
        // RIDEWAVE CEO / OWNER (Divyansh Singh, Nikhil Dhakad)
        // Regex se match hota hai, isliye alag-alag tarah se
        // poochne par aur speech recognition ki galtiyon par bhi chalega.
        // ==========================================

        const companyWords =
            /\b(ridewave|ride wave|ride web|ride way|right wave|rydewave|company|compani|platform|website|is company|iss company|ess company|ye company|yeh company|apni company|hamari company|our company|this company|is website|iss website)\b/.test(text);

        const mentionsDivyansh =
            /\b(divyansh|divyanshu|divyaansh|divyans|divansh|divyash|divyanch)\b/.test(text);

        const mentionsNikhil =
            /\b(nikhil|nikhill|nikhel|nikil|nikhi)\b/.test(text);

        const asksCeoRole =
            /\b(ceo|c e o|see o|chief executive|chief executive officer|company head|head of|boss)\b/.test(text);

        const asksOwnerRole =
            /\b(owner|owners|malik|maalik|mallik|founder|co founder|cofounder|proprietor|sanchalak)\b/.test(text);

        const wantsCeoInfo =
            mentionsDivyansh || (asksCeoRole && companyWords);

        const wantsOwnerInfo =
            mentionsNikhil || (asksOwnerRole && companyWords);

        if (wantsCeoInfo && wantsOwnerInfo) {
            say(
                "Divyansh Singh is the CEO of RideWave, and Nikhil Dhakad is the owner of RideWave.",
                "Sir, Divyansh Singh RideWave ke CEO hain, aur Nikhil Dhakad RideWave ke owner hain."
            );
            return;
        }

        // DIVYANSH
        if (wantsCeoInfo) {
            say(
                "Divyansh Singh is the CEO of RideWave.",
                "Sir, Divyansh Singh RideWave ke CEO hain."
            );
            return;
        }

        // NIKHIL
        if (wantsOwnerInfo) {
            say(
                "Nikhil Dhakad is the owner of RideWave.",
                "Sir, Nikhil Dhakad RideWave ke owner hain."
            );
            return;
        }

        // GREETING
        if (
            text.includes("hello") ||
            text.includes("hey mj") ||
            text.includes("hi mj") ||
            text.includes("namaste")
        ) {
            say(
                "Hello Sir, MJ is ready to assist you.",
                "Hello Sir, MJ aapki help ke liye ready hai."
            );
            return;
        }

        // THANK YOU
        if (
            text.includes("thank you") ||
            text.includes("thanks") ||
            text.includes("shukriya") ||
            text.includes("dhanyawad")
        ) {
            say(
                "You're welcome, Sir.",
                "Sukhariya sir aapko jo bhi help chahiye me uske liye ready hoon."
            );
            return;
        }

        // ABOUT RIDEWAVE
        if (
            text.includes("what is ridewave") ||
            text.includes("about ridewave") ||
            text.includes("ridewave kya hai")
        ) {
            say(
                "RideWave is a car rental platform where users can explore and rent their preferred cars.",
                "Sir, RideWave ek car rental platform hai jahan users apni pasand ki cars explore aur rent kar sakte hain."
            );
            return;
        }

        // HOW TO BOOK
        if (
            text.includes("how to book") ||
            text.includes("booking kaise kare") ||
            text.includes("car book kaise kare")
        ) {
            say(
                "Open the Search page, select your preferred car and continue with the booking process.",
                "Sir, Search page open kijiye, apni pasand ki car select kijiye aur booking process complete kijiye."
            );
            return;
        }


// ==========================================================
// Order: Car DB Question -> Inventory -> All Categories ->
//        Open Category -> Ask Category -> Recommendations
// ==========================================================

// ==========================================
// CAR DATABASE QUESTION (BMW kitni hai, price etc.)
// NOTE: Ye handleInventory se PEHLE hona zaroori hai.
// ==========================================

// NOTIFICATION READER (meri notification padho)
if (await handleNotificationQuestion(text)) {
    return;
}

// BOOKING STATUS QUESTION (meri booking confirm hui ya nahi)
if (await handleBookingStatusQuestion(text)) {
    return;
}

// CATEGORY CARS QUESTION (SUV / Luxury me kaun si cars hain)
// PRICE RANK QUESTION (sabse mahangi / sasti car)
if (await handlePriceRankQuestion(text)) {
    return;
}

if (await handleCategoryCarsQuestion(text)) {
    return;
}

if (await handleCarDatabaseQuestion(text)) {
    return;
}

// ==========================================
// INVENTORY ("kitni category hai" etc.)
// ==========================================

if (await handleInventory(text)) {
    return;
}

// ==========================================
// ALL CATEGORIES
// ==========================================

if (
    text.includes("open categories") ||
    text.includes("show categories") ||
    text.includes("all categories") ||
    text.includes("categories page") ||
    text.includes("categories kholo") ||
    text.includes("categories dikhao") ||
    text.includes("category batao") ||
    text.includes("car categories") ||
    text.includes("cars categories") ||
    text.includes("saari categories") ||
    text.includes("all car categories")
) {
    openPage(
        "/search",
        "Opening all car categories, Sir.",
        "Sir, saari car categories ka page khol rahi hoon."
    );
    return;
}

// ==========================================
// OPEN CAR CATEGORIES - PRIORITY COMMAND
// ==========================================

const categoryMap = {
    suv: {
        name: "SUV",
        aliases: ["suv", "s u v"]
    },
    sports: {
        name: "Sports",
        aliases: ["sports", "sport", "sports car", "sport car"]
    },
    luxury: {
        name: "Luxury",
        aliases: ["luxury", "luxary", "luxry", "luxury car", "luxury cars"]
    },
    sedan: {
        name: "Sedan",
        aliases: ["sedan", "sedan car", "sedan cars"]
    }
};

const categoryActionWords = [
    "open",
    "show",
    "go to",
    "navigate",
    "kholo",
    "khol do",
    "dikhao",
    "dikha do",
    "dekhna",
    "page",
    "category",
    "categories",
    "section"
];

let requestedCategory = null;

for (const category of Object.values(categoryMap)) {

    if (
        category.aliases.some(alias =>
            text.includes(alias)
        )
    ) {
        requestedCategory = category.name;
        break;
    }
}


// CATEGORY INFORMATION QUESTION
const asksWhereCategory =
    /\b(kahan|kahaan|where|which|kis|konse|kaunsi|konsi)\b/i.test(text) ||
    /\b(dekhne|dekhna|milna|milegi|milengi|available|available hai|find|browse|explore)\b/i.test(text) ||
    /\b(show me|tell me|batao|bataiye|dikhao|dikha do)\b/i.test(text);

if (requestedCategory && asksWhereCategory) {
    const category = requestedCategory;

    say(
        `Certainly, Sir! You can explore ${category} cars in the ${category} category on RideWave. Would you like me to open it for you?`,
        `Bilkul Sir! Aap RideWave ke ${category} category section mein ye cars dekh sakte hain. Kya main aapke liye ye section open kar doon?`
    );

    return;
}


const hasCategoryAction = categoryActionWords.some(word =>
    text.includes(word)
);

if (requestedCategory && hasCategoryAction) {

    await filterCategory(requestedCategory);
    return;
}

// Category ka naam nahi mila toh user se poochho
if (
    hasCategoryAction &&
    (
        text.includes("category") ||
        text.includes("categories")
    )
) {
    say(
        "Sir, which category would you like to explore: SUV, Sports, Luxury or Sedan?",
        "Sir, aapne pass 4 category ki cars hain: SUV, Sports, Luxury Sedan?"
    );
    return;
}


// ==========================================
// RECOMMENDATION BLOCKS (ab category ke BAAD)
// ==========================================
// ==========================================
// SUV / OFF-ROAD RECOMMENDATION
// ==========================================

if (
    text.includes("suv") ||
    text.includes("off road") ||
    text.includes("offroad") ||
    text.includes("offroading") ||
    text.includes("off roading") ||
    text.includes("adventure car") ||
    text.includes("best suv") ||
    text.includes("best car for off road") ||
    text.includes("off road ke liye best car") ||
    text.includes("off roading ke liye car") ||
    text.includes("off roading ke liye best car") ||
    text.includes("off roading ke liye best car suggest karo") ||
    text.includes("off roading ke liye best car konsi hogi") ||
    text.includes("off roading ke liye car suggest karo") ||
    text.includes("off road ke liye car batao") ||
    text.includes("off road ke liye best car batao") ||
    text.includes("adventure ke liye best car") ||
    text.includes("pahadon ke liye car") ||
    text.includes("pahadon mein chalane ke liye car") ||
    text.includes("suv ke liye konsi best hogi") ||
    text.includes("rough road ke liye car") ||
    text.includes("rough roads ke liye best car") ||
    text.includes("suv suggest karo") ||
    text.includes("suv dikhao") ||
    text.includes("suv batao") ||
    text.includes("mujhe suv chahiye") ||
    text.includes("koi achhi suv suggest karo") ||
    text.includes("ek best suv batao") ||
    text.includes("adventure car suggest karo") ||
    text.includes("mujhe off road car chahiye")
) {
    say(
        " Sir! For SUV and adventure driving, I recommend the Land Rover Defender. It offers versatility, comfort and capability for different driving conditions.",
        "Bilkul Sir! SUV aur adventure driving ke liye meri recommendation Land Rover Defender hai. Ye comfort, versatility aur different driving conditions ke liye ek achha option hai."
    );
    return;
}


// ==========================================
// LUXURY RECOMMENDATION
// ==========================================

if (
    text.includes("luxury") ||
    text.includes("luxurious") ||
    text.includes("premium car") ||
    text.includes("royal car") ||
    text.includes("shahi car") ||
    text.includes("luxury car dikhao") ||
    text.includes("luxury car batao") ||
    text.includes("luxury car suggest karo") ||
    text.includes("mujhe luxury car chahiye") ||
    text.includes("luxary ke liye konsi best hogi") ||
    text.includes("or luxary ke liye") ||
    text.includes("mj luxury") ||
    text.includes("mj luxury car batao") ||
    text.includes("mj luxury car suggest karo") ||
    text.includes("mj luxury car dikhao") ||
    text.includes("mj luxary car ke bare me suggest karo") ||
    text.includes("mj premium car suggest karo") ||
    text.includes("hey mj luxury") ||
    text.includes("hey mj luxury car batao") ||
    text.includes("hey mj premium car dikhao")
) {
    say(
        " Sir! For a luxurious experience, I recommend the Rolls-Royce Ghost. It offers exceptional comfort, elegance and a prestigious experience.",
        "Bilkul Sir! Luxury experience ke liye meri recommendation Rolls-Royce Ghost hai. Ye exceptional comfort, elegance aur royal experience deti hai."
    );
    return;
}


// ==========================================
// SPORTS RECOMMENDATION
// ==========================================

if (
    text.includes("sports") ||
    text.includes("sporty") ||
    text.includes("supercar") ||
    text.includes("racing car") ||
    text.includes("fast car") ||
    text.includes("speed wali car") ||
    text.includes("tez car") ||
    text.includes("mj sports") ||
    text.includes("sports ke liye konsi best hogi") ||
    text.includes("or sports ke liye konsi best hogi") ||
    text.includes("mj sports car batao") ||
    text.includes("mj sports car suggest karo") ||
    text.includes("mj sports car dikhao") ||
    text.includes("mj sports car ke bare me suggest karo") ||
    text.includes("mj supercar suggest karo") ||
    text.includes("hey mj sports") ||
    text.includes("hey mj sports car batao") ||
    text.includes("hey mj supercar dikhao")
) {
    say(
        " Sir If you are looking for the most expensive car in RideWave, I recommend the Pagani Huayra. It offers an extraordinary combination of luxury, stunning design and exceptional performance.",
        "Sir! Agar aap RideWave ki sabse expensive car experience karna chahte hain, toh meri recommendation Pagani or Nisaan GTR hai. Ye apne premium luxury, stunning design aur outstanding performance ke liye jaani jaati hai."
    );
    return;
}


// ==========================================
// SEDAN RECOMMENDATION
// ==========================================

if (
    text.includes("sedan") ||
    text.includes("family sedan") ||
    text.includes("family ke liye car") ||
    text.includes("city driving") ||
    text.includes("sedan dikhao") ||
    text.includes("sedan batao") ||
    text.includes("sedan ke liye konsi best hogi") ||
    text.includes("or sedan ke liye konsi best hogi") ||
    text.includes("mj sedan car suggest karo") ||
    text.includes("mj sedan") ||
    text.includes("mj sedan car ke bare me suggest karo") ||
    text.includes("mj sedan dikhao") ||
    text.includes("mj family car suggest karo") ||
    text.includes("hey mj sedan") ||
    text.includes("hey mj sedan batao") ||
    text.includes("hey mj family car dikhao")
) {
    say(
        "Certainly, Sir! For a premium sedan experience, I recommend the Bentley Flying Spur. It offers excellent comfort, luxury and a refined driving experience.",
        "Sir! Premium sedan experience ke liye meri recommendation Bentley Flying Spur hai. Ye excellent comfort aur refined driving experience deti hai."
    );
    return;
}

        // ==========================================
        // ALL PAGE NAVIGATION
        // ==========================================

        // HOME PAGE
        if (
            text.includes("open home page") ||
            text.includes("open home") ||
            text.includes("home page kholo") ||
            text.includes("home page per chalo") ||
            text.includes("home page khol do") ||
            text.includes("home kholo") ||
            text.includes("mj home page pe chalo") ||
            text.includes("go to homepage") ||
            text.includes("go to home") ||
            text.includes("going to home page") ||
            text.includes("ghar kholo")
        ) {
            openPage(
                "/",
                "Opening Home page, Sir.",
                "Sir, Home page khol rahi hoon."
            );
            return;
        }

        // SEARCH PAGE
        if (
            text.includes("open search page") ||
            text.includes("open search") ||
            text.includes("mj search page open karo") ||
            text.includes("search page kholo") ||
            text.includes("search page khol do") ||
            text.includes("search kholo") ||
            text.includes("go to search page") ||
            text.includes("search page per chalo")
        ) {
            openPage(
                "/search",
                "Opening Search page, Sir.",
                "Sir, Search page khol rahi hoon."
            );
            return;
        }

        // CLIPS / BLOG PAGE
        if (
            text.includes("open clip page") ||
            text.includes("mj open clip page") ||
            text.includes("open clip section") ||
            text.includes("open clip") ||
            text.includes("clip page kholo") ||
            text.includes("clip page khol do") ||
            text.includes("clip kholo") ||
            text.includes("clip dikhao") ||
            text.includes("clip section kholo") ||
            text.includes("mujhe clip dikhao") ||
            text.includes("mj clip open karo") ||
            text.includes("clip chalao") ||
            text.includes("clip dekhna hai") ||
            text.includes("clip dekhne hain") ||
            text.includes("clip par le chalo") ||
            text.includes("clip wale page par jao") ||
            text.includes("open blog page") ||
            text.includes("open blog section") ||
            text.includes("open blog") ||
            text.includes("blog page kholo") ||
            text.includes("blog page khol do") ||
            text.includes("blog kholo") ||
            text.includes("blog dikhao") ||
            text.includes("blog section kholo") ||
            text.includes("mujhe blog dikhao") ||
            text.includes("blog open karo") ||
            text.includes("blog dekhna hai") ||
            text.includes("blog par le chalo") ||
            text.includes("blog wale page par jao")
        ) {
            openPage(
                "/blog",
                "Opening clips page, Sir.",
                "Sir, Clips page open kar rahi hoon."
            );
            return;
        }

        // CONTACT PAGE
        if (
            text.includes("open contact page") ||
            text.includes("open contact") ||
            text.includes("contact page kholo") ||
            text.includes("contact page khol do") ||
            text.includes("contact kholo")
        ) {
            openPage(
                "/contact",
                "Opening Contact page, Sir.",
                "Sir, Contact page khol rahi hoon."
            );
            return;
        }

        // LOGIN PAGE
        if (
            text.includes("open login page") ||
            text.includes("open login") ||
            text.includes("login page kholo") ||
            text.includes("login page khol do") ||
            text.includes("login kholo")
        ) {
            openPage(
                "/login",
                "Opening Login page, Sir.",
                "Sir, Login page khol rahi hoon."
            );
            return;
        }

        // SIGNUP PAGE
        if (
            text.includes("open signup page") ||
            text.includes("open sign up page") ||
            text.includes("open signup") ||
            text.includes("signup page kholo") ||
            text.includes("signup page khol do") ||
            text.includes("register page kholo") ||
            text.includes("signup kholo")
        ) {
            openPage(
                "/signup",
                "Opening Signup page, Sir.",
                "Sir, Signup page khol rahi hoon."
            );
            return;
        }

        // TEAMS PAGE
        if (
            text.includes("open teams page") ||
            text.includes("open team page") ||
            text.includes("open team") ||
            text.includes("team page kholo") ||
            text.includes("teams page kholo") ||
            text.includes("team page khol do") ||
            text.includes("team kholo")
        ) {
            openPage(
                "/teams",
                "Opening Teams page, Sir.",
                "Sir, Teams page khol rahi hoon."
            );
            return;
        }

        // MY BOOKINGS PAGE
        if (
            text.includes("open my bookings page") ||
            text.includes("open my booking page") ||
            text.includes("open my bookings") ||
            text.includes("my bookings page kholo") ||
            text.includes("my booking page kholo") ||
            text.includes("my bookings page khol do") ||
            text.includes("meri bookings kholo") ||
            text.includes("meri booking dikhao") ||
            text.includes("my bookings dikhao") ||
            text.includes("my booking kholo")
        ) {
            openPage(
                "/Mybookings",
                "Opening My Bookings page, Sir.",
                "Sir, aapki My Bookings page khol rahi hoon."
            );
            return;
        }

        // ADMIN DASHBOARD PAGE
        if (
            text.includes("open admin dashboard page") ||
            text.includes("open admin dashboard") ||
            text.includes("open admin page") ||
            text.includes("admin dashboard page kholo") ||
            text.includes("admin dashboard kholo") ||
            text.includes("admin page kholo") ||
            text.includes("admin page khol do")
        ) {
            openPage(
                "/admin",
                "Opening Admin Dashboard page, Sir.",
                "Sir, Admin Dashboard page khol rahi hoon."
            );
            return;
        }

        // CAR ADMIN PAGE
        if (
            text.includes("open car admin page") ||
            text.includes("open car admin") ||
            text.includes("car admin page kholo") ||
            text.includes("car admin page khol do") ||
            text.includes("car admin kholo") ||
            text.includes("car admin open karo") ||
            text.includes("manage my cars") ||
            text.includes("manage cars page kholo")
        ) {
            openPage(
                "/carAdmin",
                "Opening Car Admin page, Sir.",
                "Sir, Car Admin page khol rahi hoon."
            );
            return;
        }

        // CUSTOMER BOOKING PAGE
        if (
            text.includes("open customer booking page") ||
            text.includes("open customer bookings page") ||
            text.includes("open customer booking") ||
            text.includes("customer booking page kholo") ||
            text.includes("customer bookings page kholo") ||
            text.includes("customer booking page khol do") ||
            text.includes("customer bookings dikhao") ||
            text.includes("customer booking kholo")
        ) {
            openPage(
                "/Customerbooking",
                "Opening Customer Booking page, Sir.",
                "Sir, Customer Booking page khol rahi hoon."
            );
            return;
        }

        // BOOKING FORM PAGE
        if (
            text.includes("open booking form page") ||
            text.includes("open booking form") ||
            text.includes("booking form page kholo") ||
            text.includes("booking form kholo") ||
            text.includes("new booking page kholo") ||
            text.includes("open new booking page")
        ) {
            openPage(
                "/booking",
                "Opening Booking Form page, Sir.",
                "Sir, Booking Form page khol rahi hoon."
            );
            return;
        }

        // ==========================================
        // OPEN CAR (car ka naam bolke "open karo" / "kholo")
        // ==========================================

        if (await handleOpenCarCommand(text)) {
            return;
        }

        // ==========================================
        // BOOKING INTENT
        // ==========================================

        if (hasBookingIntent(text)) {
            await bookCarFromMongo(text);
            return;
        }

        // ==========================================
        // LOGOUT
        // ==========================================

        if (
            text === "logout" ||
            text.includes("log out") ||
            text.includes("logout kar do") ||
            text.includes("sign out") ||
            text.includes("signout") ||
            text.includes("logout page")
        ) {
            say(
                "Logging you out of RideWave, Sir.",
                "Ji Sir, aapko RideWave se logout kar rahi hoon.",
                async () => {
                    try {
                        const response = await fetch("/api/auth/logout", {
                            method: "POST",
                            credentials: "include"
                        });

                        if (response.ok) {
                            window.location.href = "/login";
                        } else {
                            say(
                                "Sorry Sir, logout failed.",
                                "Sorry Sir, logout nahi ho paaya."
                            );
                        }

                    } catch (error) {
                        console.error("MJ Logout Error:", error);

                        say(
                            "Sorry Sir, logout failed.",
                            "Sorry Sir, logout nahi ho paaya."
                        );
                    }
                }
            );
            return;
        }

        // ==========================================
        // SEARCH ANY CAR
        // ==========================================

        if (
            text.includes("search") ||
            text.includes("find") ||
            text.includes("show") ||
            text.includes("car search karni he") ||
            text.includes("dikhao") ||
            text.includes("car chahiye") ||
            text.includes("car dekhni")
        ) {
            await searchCarFromMongo(text);
            return;
        }

        // ==========================================
        // GEMINI AI - UNKNOWN COMMAND
        // ==========================================

        async function askGeminiMJ(command) {

            try {
                const response = await fetch("/api/mj/ask", {
                    method: "POST",
                    credentials: "include",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        message: command,
                        language: currentLanguage
                    })
                });

                const data = await response.json();

                if (!response.ok || !data.success) {
                    throw new Error(data.reply || "AI request failed");
                }

                speakMJ(data.reply, currentLanguage);

            } catch (error) {
                console.error("MJ Gemini Error:", error);

                say(
                    "Sorry Sir, my AI service is not responding right now. But I can still help you with cars, categories, prices, bookings and navigation.",
                    "Sorry Sir, abhi meri AI service respond nahi kar rahi hai. Lekin main cars, categories, price, booking aur navigation mein abhi bhi help kar sakti hoon."
                );
            }
        }

        await askGeminiMJ(command);
        return;
    }

    // ==========================================
    // MICROPHONE BUTTON
    // ==========================================

    micBtn.addEventListener("click", () => {

        if (isListening) {
            recognition.stop();
            return;
        }

        speechId++;
        window.speechSynthesis.cancel();

        try {
            recognition.start();
        } catch (error) {
            console.error("MJ start error:", error);
        }
    });

    // ==========================================
    // RECOGNITION START
    // ==========================================

    recognition.onstart = () => {

        isListening = true;
        micBtn.classList.add("mj-listening");

        const icon = micBtn.querySelector("i");

        if (icon) {
            icon.className = "bx bx-stop";
        }

        console.log("MJ listening...");
    };

    // ==========================================
    // VOICE RESULT
    // ==========================================

    recognition.onresult = event => {

        const command = event.results[0][0].transcript.trim();

        console.log("User said:", command);

        if (command) {
            handleMJCommand(command);
        }
    };

    // ==========================================
    // RECOGNITION END
    // ==========================================

    recognition.onend = () => {

        isListening = false;
        micBtn.classList.remove("mj-listening");

        const icon = micBtn.querySelector("i");

        if (icon) {
            icon.className = "bx bxs-microphone";
        }

        console.log("MJ stopped listening.");
    };

    // ==========================================
    // RECOGNITION ERROR
    // ==========================================

    recognition.onerror = event => {

        console.error("MJ recognition error:", event.error);

        isListening = false;
        micBtn.classList.remove("mj-listening");

        const icon = micBtn.querySelector("i");

        if (icon) {
            icon.className = "bx bxs-microphone";
        }

        if (event.error === "not-allowed") {
            say(
                "Please allow microphone permission.",
                "Sir, microphone permission allow kijiye."
            );
        }

        if (event.error === "no-speech") {
            console.log("MJ did not receive a voice command.");
        }
    };

    // ==========================================
    // APPLY SAVED SEARCH AND CATEGORY
    // ==========================================

    function applySavedCommands() {

        const searchInput =
            document.getElementById("searchInput");

        const searchBtn =
            document.getElementById("searchBtn");

        const savedSearch =
            sessionStorage.getItem("mjSearchCar");

        if (savedSearch && searchInput) {

            sessionStorage.removeItem("mjSearchCar");

            searchInput.value = savedSearch;

            searchInput.dispatchEvent(
                new Event("input", { bubbles: true })
            );

            if (searchBtn) {
                searchBtn.click();
            }
        }

        const savedCategory =
            sessionStorage.getItem("mjCategory");

        if (savedCategory) {

            const buttons =
                document.querySelectorAll(".filter-btn");

            const matchedButton = Array.from(buttons).find(button =>
                button.dataset.category &&
                normalize(button.dataset.category) ===
                normalize(savedCategory)
            );

            if (matchedButton) {
                sessionStorage.removeItem("mjCategory");
                matchedButton.click();
            }
        }
    }

    applySavedCommands();

    console.log("RideWave MJ initialized successfully.");

});