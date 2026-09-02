
//open search box
let search= document.querySelector(".search-box");
document.querySelector(".search-icon").onclick=()=>{
    search.classList.toggle("active")
     navLinks.classList.remove("menu-open")
       menu.classList.remove("move");
}
// menu open close
let menu= document.querySelector(".menu-icon");
let navLinks= document.querySelector(".nav-links");


menu.onclick=()=>{
    menu.classList.toggle("move");
    navLinks.classList.toggle("menu-open")
    search.classList.remove("active")
}

// scroll
window.onscroll = () =>{
    search.classList.remove("active")
     navLinks.classList.remove("menu-open")
         menu.classList.remove("move");
}


// card hover effect home car only
const bmwCard = document.querySelector(".bmw-card");

if (bmwCard) {
    bmwCard.addEventListener("mousemove", (e) => {

        const rect = bmwCard.getBoundingClientRect();

        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

         const centerX = rect.width / 0;
        const centerY = rect.height / 0; 
const rotateX = ((y - centerY) / centerY) * -12;
const rotateY = ((x - centerX) / centerX) * 15;
        bmwCard.style.transform = `
            rotateX(${rotateX}deg)
            rotateY(${rotateY}deg)
            translateY(-12px)
        `;
    });

    bmwCard.addEventListener("mouseleave", () => {
        bmwCard.style.transform = `
            rotateX(0deg)
            rotateY(0deg)
            translateY(0)
        `;
    });
}




//header backgorund change an scroll
let header=document.querySelector("header");
window.addEventListener("scroll",() => {
    header.classList.toggle("shadow", window.scrollY > 0);
})


// FAQ
const accordionItems = document.querySelectorAll(".accordion-item");

accordionItems.forEach((item) => {

    const header = item.querySelector(".accordion-header");

    header.addEventListener("click", () => {

        item.classList.toggle("active");

    });

});

// --- SUPABASE AUTH STATE & LOGOUT ---


const SUPABASE_URL = "https://nqisunhjguxqdnlyckak.supabase.co";

const SUPABASE_KEY =   'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzIiwicmVmIjoibnFpc3VuaGpndXhxZG5seWNrYWsiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTc4ODI2Nzc2MiwiZXhwIjoyMTAzODQzNzYyfQ.IKfBiMjMwwa6qMwKIb8BsMCKIwDtAh-dOeScRCkvXI0';

const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);


// ==========================================
// GET HTML ELEMENTS
// ==========================================

const authButtons = document.getElementById("authButtons");
const userProfile = document.getElementById("userProfile");
const userEmail = document.getElementById("userEmail");


// ==========================================
// CHECK USER LOGIN
// ==========================================

async function checkUser() {

    const {
        data: { session },
        error
    } = await supabaseClient.auth.getSession();


    if (error) {

        console.error(
            "Session Error:",
            error
        );

        return;
    }


    // ======================================
    // USER LOGGED IN
    // ======================================

    if (session) {

        authButtons.style.display = "none";

        userProfile.style.display = "flex";

        userEmail.textContent =
            session.user.email;

    }


    // ======================================
    // USER LOGGED OUT
    // ======================================

    else {

        authButtons.style.display = "flex";

        userProfile.style.display = "none";

        userEmail.textContent = "";

    }
}


// ==========================================
// RUN WHEN PAGE LOADS
// ==========================================

document.addEventListener(
    "DOMContentLoaded",
    () => {

        checkUser();

    }
);


// ==========================================
// AUTOMATIC LOGIN / LOGOUT DETECTION
// ==========================================

supabaseClient.auth.onAuthStateChange(
    (event, session) => {

        console.log(
            "Auth Event:",
            event
        );


        // ==================================
        // USER LOGGED IN
        // ==================================

        if (session) {

            authButtons.style.display = "none";

            userProfile.style.display = "flex";

            userEmail.textContent =
                session.user.email;

        }


        // ==================================
        // USER LOGGED OUT
        // ==================================

        else {

            authButtons.style.display = "flex";

            userProfile.style.display = "none";

            userEmail.textContent = "";

        }

    }
);


// ==========================================
// LOGOUT FUNCTION
// ==========================================

async function handleLogout() {

    try {

        const {
            error
        } = await supabaseClient.auth.signOut();


        if (error) {

            console.error(
                "Logout Error:",
                error
            );

            alert(
                "Logout failed. Please try again."
            );

            return;
        }


        // Logout successful

        authButtons.style.display = "flex";

        userProfile.style.display = "none";

        userEmail.textContent = "";


        // Go to home page

        window.location.href =
            "index.html";

    }

    catch (error) {

        console.error(
            "Logout Error:",
            error
        );

    }

}