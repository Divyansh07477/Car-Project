
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

function showFlash(message, type = "success") {

    const flash = document.createElement("div");

    flash.className = `flash-message ${type}`;
    flash.innerText = message;

    document.body.appendChild(flash);

    setTimeout(() => {
        flash.classList.add("show");
    }, 10);

    setTimeout(() => {

        flash.classList.remove("show");

        setTimeout(() => {
            flash.remove();
        }, 400);

    }, 3000);
}



// ===============================
// AUTH STATUS
// ===============================

async function checkLoginStatus() {
    try {
        const response = await fetch("/api/auth/me");

        const authButtons = document.getElementById("authButtons");
        const userProfile = document.getElementById("userProfile");

        // Naye UI ke elements
        const userNameDisplay = document.getElementById("userNameDisplay");
        const dropdownUserName = document.getElementById("dropdownUserName");
        const userEmail = document.getElementById("userEmail");

        if (!authButtons || !userProfile) {
            return;
        }

        if (response.ok) {
            const data = await response.json();

            authButtons.style.display = "none";
            userProfile.style.display = "flex";

            // User name aur email render karna
            if (userNameDisplay) userNameDisplay.textContent = data.user.name || "Admin";
            if (dropdownUserName) dropdownUserName.textContent = data.user.name || "Admin";
            if (userEmail) userEmail.textContent = data.user.email || "";
        } else {
            authButtons.style.display = "flex";
            userProfile.style.display = "none";
        }

    } catch (error) {
        console.error("Auth Check Error:", error);
    }
}

// ===============================
// FLASH MESSAGE
// ===============================
function showFlash(message, type = "success") {
    const flash = document.createElement("div");

    flash.className = `flash-message ${type}`;
    flash.textContent = message;

    document.body.appendChild(flash);

    setTimeout(() => {
        flash.classList.add("show");
    }, 50);

    setTimeout(() => {
        flash.classList.remove("show");

        setTimeout(() => {
            flash.remove();
        }, 300);

    }, 2500);
}

// ===============================
// LOGOUT
// ===============================
async function handleLogout() {
    try {
        const response = await fetch("/api/auth/logout", {
            method: "POST",
            credentials: "include"
        });

        const data = await response.json();

        if (response.ok) {
            localStorage.setItem(
                "flashMessage",
                data.message || "Logged out successfully!"
            );
            window.location.href = "/";
        } else {
            showFlash(
                data.message || "Logout failed.",
                "error"
            );
        }

    } catch (error) {
        console.error("Logout Error:", error);
        showFlash(
            "Server se connection nahi ho raha.",
            "error"
        );
    }
}

// ===============================
// DROPDOWN SETUP
// ===============================
function setupProfileDropdown() {
    const dropdownBtn = document.getElementById("profileDropdownBtn");
    const dropdownMenu = document.getElementById("profileDropdownMenu");
    const dropdownArrow = document.getElementById("dropdownArrow");

    if (dropdownBtn && dropdownMenu) {
        // Toggle on click
        dropdownBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            dropdownMenu.classList.toggle("hidden");
            if (dropdownArrow) {
                dropdownArrow.classList.toggle("rotate-180");
            }
        });

        // Close on click outside
        document.addEventListener("click", (e) => {
            if (!dropdownMenu.contains(e.target) && !dropdownBtn.contains(e.target)) {
                dropdownMenu.classList.add("hidden");
                if (dropdownArrow) {
                    dropdownArrow.classList.remove("rotate-180");
                }
            }
        });
    }
}

// ===============================
// PAGE LOAD
// ===============================
document.addEventListener("DOMContentLoaded", () => {

    const logoutBtn = document.getElementById("logoutBtn");

    if (logoutBtn) {
        logoutBtn.addEventListener("click", handleLogout);
    }

    // Dropdown functionality initialize
    setupProfileDropdown();

    // Show saved flash message
    const flashMessage = localStorage.getItem("flashMessage");

    if (flashMessage) {
        showFlash(flashMessage, "success");
        localStorage.removeItem("flashMessage");
    }

    checkLoginStatus();
});


