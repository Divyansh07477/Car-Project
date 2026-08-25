//open search box
let search= document.querySelector(".search-box");
document.querySelector(".search-icon").onclick=()=>{
    search.classList.toggle("active")
}
let menu= document.querySelector(".menu-icon");
menu.onclick=()=>{
    menu.classList.toggle("move");
}