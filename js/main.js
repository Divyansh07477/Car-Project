//open search box
let search= document.querySelector(".search-box");
document.querySelector(".search-icon").onclick=()=>{
    search.classList.toggle("active")
}
let menu= document.querySelector(".menu-icon");
menu.onclick=()=>{
    menu.classList.toggle("move");
}


// card hover effect home car only
const bmwCard = document.querySelector(".bmw-card");

if (bmwCard) {
    bmwCard.addEventListener("mousemove", (e) => {

        const rect = bmwCard.getBoundingClientRect();

        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

       
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


// header
let lastScroll = 0;
const header = document.querySelector(".header");

window.addEventListener("scroll", () => {
    const currentScroll = window.scrollY;

    if (currentScroll === 0) {
        // Sirf top par navbar show
        header.classList.remove("hide");
    } else if (currentScroll > lastScroll) {
        // Scroll down → hide
        header.classList.add("hide");
    }

    lastScroll = currentScroll;
});