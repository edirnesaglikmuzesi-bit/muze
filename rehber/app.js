// --- FIREBASE INIT ---
const firebaseConfig = {
    apiKey: "SENIN_KEYIN",
    authDomain: "bayezid-saglik-muzesi.firebaseapp.com",
    projectId: "bayezid-saglik-muzesi",
    storageBucket: "bayezid-saglik-muzesi.appspot.com",
    messagingSenderId: "...",
    appId: "..."
};
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// --- DEĞİŞKENLER ---
let currentStep = 0;
let isMuted = localStorage.getItem('audioMuted') === 'true';
let currentImgIdx = 0;
let messages = [];
let currentPage = 1;

// --- BAŞLANGIÇ ---
document.addEventListener("DOMContentLoaded", () => {
    updateSoundIcon();
});

function changeScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active-screen'));
    document.getElementById(id).classList.add('active-screen');
    window.scrollTo(0,0);
}

function startJourney() {
    changeScreen('screen-tour');
    loadStep();
}

// --- TUR YÖNETİMİ ---
function loadStep() {
    const data = tourData[currentStep];
    document.getElementById("title").innerText = data.t;
    document.getElementById("subtitle").innerText = data.s;
    document.getElementById("content").innerText = data.m;
    document.getElementById("question").innerText = data.q;
    
    // Galeri Yükle
    const galleryTarget = document.getElementById("gallery-target");
    galleryTarget.innerHTML = `
        <div class="gallery-wrapper">
            <div id="gallery-container" class="gallery-container">
                ${data.g.map(img => `<img src="${img}">`).join('')}
            </div>
            ${data.g.length > 1 ? `
            <div class="gallery-nav">
                <button class="gal-btn" onclick="moveGallery(-1)">❮</button>
                <button class="gal-btn" onclick="moveGallery(1)">❯</button>
            </div>` : ''}
        </div>
    `;
    currentImgIdx = 0;

    // Ses Çalma
    const audio = document.getElementById("audio-player");
    audio.src = data.a;
    audio.muted = isMuted;
    audio.play().catch(() => console.log("Etkileşim bekleniyor."));

    document.getElementById("bar").style.width = ((currentStep + 1) / tourData.length * 100) + "%";
    document.getElementById("btn-prev").style.visibility = currentStep === 0 ? "hidden" : "visible";
    document.getElementById("btn-next").innerText = currentStep === tourData.length - 1 ? "Gönül Köprüsü" : "İleri ➡";
}

function navStep(dir) {
    if (dir === 1 && currentStep === tourData.length - 1) {
        changeScreen('screen-guestbook');
        fetchMessages();
    } else {
        currentStep += dir;
        loadStep();
    }
}

function moveGallery(dir) {
    const container = document.getElementById("gallery-container");
    const imgs = container.querySelectorAll("img").length;
    currentImgIdx = (currentImgIdx + dir + imgs) % imgs;
    container.style.transform = `translateX(-${currentImgIdx * 100}%)`;
}

// --- SES AYARLARI ---
function toggleMute() {
    isMuted = !isMuted;
    localStorage.setItem('audioMuted', isMuted);
    document.getElementById("audio-player").muted = isMuted;
    updateSoundIcon();
}

function updateSoundIcon() {
    const icon = document.getElementById("vol-icon");
    icon.className = isMuted ? "fas fa-volume-mute" : "fas fa-volume-up";
}

// --- MESAJ SİSTEMİ ---
async function handleMessageSubmit(e) {
    e.preventDefault();
    const btn = document.getElementById('submit-btn');
    btn.querySelector('.light-sweep').classList.add('sweep-active');
    document.getElementById('seal-sound').play();

    const data = {
        name: document.getElementById('msg-user').value || "Anonim",
        city: document.getElementById('msg-city').value || "Belirtilmemiş",
        text: document.getElementById('msg-text').value,
        tarih: firebase.firestore.FieldValue.serverTimestamp()
    };

    await db.collection("ziyaretci_mesajlari").add(data);
    
    setTimeout(() => {
        const popup = document.getElementById('success-popup');
        document.getElementById('success-msg').innerText = "Kelimeleriniz 'Gönül Köprüsü'ndeki yerini aldı. ✨\nBıraktığınız bu anlamlı iz, külliyemizin manevi mirasını zenginleştirdi...";
        popup.style.display = 'flex';
    }, 1200);
}

async function fetchMessages() {
    db.collection("ziyaretci_mesajlari").orderBy("tarih", "desc").onSnapshot(snap => {
        messages = [];
        snap.forEach(doc => messages.push(doc.data()));
        renderMessages();
    });
}

function renderMessages() {
    const target = document.getElementById("list-target");
    target.innerHTML = "";
    const start = (currentPage - 1) * 10;
    messages.slice(start, start + 10).forEach(m => {
        target.innerHTML += `<div style="background:white; padding:10px; margin-bottom:8px; border-radius:5px; border-left:3px solid var(--accent)">
            <small style="color:var(--accent)"><b>${m.name}</b> (${m.city})</small><br>${m.text}
        </div>`;
    });
    renderPagination();
}

function renderPagination() {
    const target = document.getElementById("page-target");
    const total = Math.ceil(messages.length / 10);
    target.innerHTML = "";
    for(let i=1; i<=total; i++) {
        target.innerHTML += `<button class="main-btn" style="margin:2px; padding:5px 10px; ${i===currentPage?'background:var(--accent)':''}" onclick="currentPage=${i};renderMessages()">${i}</button>`;
    }
}
