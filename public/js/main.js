
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

