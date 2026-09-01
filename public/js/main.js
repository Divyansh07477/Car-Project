
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
const supabaseUrl = 'https://nqisunhjguxqdnlyckak.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5xaXN1bmhqZ3V4cWRubHlja2FrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgyNjc3NjIsImV4cCI6MjEwMzg0Mzc2Mn0.IKfBiMjMwwa6qMwKIb8BsMCKIwDtAh-dOeScRCkvXI0';
const _supabase = supabase.createClient(supabaseUrl, supabaseAnonKey);
function updateNavbarUI(user) {
  const authButtons = document.getElementById('authButtons');
  const userProfile = document.getElementById('userProfile');
  const userEmail = document.getElementById('userEmail');

  if (!authButtons || !userProfile || !userEmail) {
    console.error('Navbar DOM elements missing. Check HTML IDs.');
    return;
  }

  if (user) {
    authButtons.style.setProperty('display', 'none', 'important');
    userProfile.style.setProperty('display', 'flex', 'important');
    userEmail.innerText = user.email;
  } else {
    authButtons.style.setProperty('display', 'flex', 'important');
    userProfile.style.setProperty('display', 'none', 'important');
    userEmail.innerText = '';
  }
}

// 1. Page Load hote hi Initial Session Check Karo
document.addEventListener('DOMContentLoaded', async () => {
  const { data: { session } } = await _supabase.auth.getSession();
  updateNavbarUI(session?.user ?? null);
});

// 2. Realtime State Change Listener
_supabase.auth.onAuthStateChange((_event, session) => {
  updateNavbarUI(session?.user ?? null);
});

// 3. Logout Function
async function handleLogout() {
  const { error } = await _supabase.auth.signOut();
  if (error) {
    alert(error.message);
  } else {
    window.location.reload();
  }
}