/* ============================================================
   SULTAN II. BAYEZİD KÜLLİYESİ — script.js
   Zaman çizelgesi + tur yönetimi + ziyaretçi defteri
   ============================================================ */

// ── Durak → Bölüm Haritası ────────────────────────────────────
// tourData index 0-28 (29 durak)
const BOLUMLER = [
    { name: "Giriş",           color: "#5ac9c9", stops: [0, 1, 2] },
    { name: "Darüşşifa",       color: "#c9962a", stops: [3] },
    { name: "Sunum Odası",     color: "#e8c46a", stops: [4] },
    { name: "Darüşşifa",       color: "#c9962a", stops: [5,6,7,8,9,10,11,12] },
    { name: "Medrese",         color: "#8b9a3a", stops: [13, 14] },
    { name: "İmarethane",      color: "#c97a2a", stops: [15,16,17,18] },
    { name: "Tabhaneler",      color: "#3a8a3a", stops: [19, 20] },
    { name: "Yahya Baba",      color: "#8a3a8a", stops: [21] },
    { name: "Camii",           color: "#8b1a1a", stops: [22,23,24,25] },
    { name: "Veda",            color: "#1e5f5f", stops: [26, 27] },
    { name: "Gönül Köprüsü",   color: "#2d5a8a", stops: [28] }
];

function getBolumByIndex(idx) {
    for (const b of BOLUMLER) {
        if (b.stops.includes(idx)) return b;
    }
    return BOLUMLER[0];
}

function getBolumRange(bolum) {
    const first = bolum.stops[0];
    const last  = bolum.stops[bolum.stops.length - 1];
    if (first === last) return `Durak ${first + 1}`;
    return `Durak ${first + 1} – ${last + 1}`;
}

// ── Değişkenler ───────────────────────────────────────────────
let currentStep = 0;
let isMuted     = localStorage.getItem('audioMuted') === 'true';
let currentImgIdx = 0;
let messages    = [];
let currentPage = 1;
const MSGS_PER_PAGE = 10;

// ── Başlangıç ─────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    updateSoundIcon();
});

function changeScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active-screen'));
    const el = document.getElementById(id);
    if (el) el.classList.add('active-screen');
    window.scrollTo(0, 0);
}

function startJourney() {
    changeScreen('screen-tour');
    renderStep();
    const sealSound = document.getElementById('seal-sound');
    if (sealSound) sealSound.play().catch(() => {});
}

// ── Adım Render ───────────────────────────────────────────────
function renderStep() {
    if (typeof tourData === 'undefined') { console.error('tourData bulunamadı!'); return; }

    const data   = tourData[currentStep];
    const total  = tourData.length;
    const bolum  = getBolumByIndex(currentStep);

    // İçerik
    document.getElementById('title').innerText    = data.t;
    document.getElementById('subtitle').innerText = data.s;
    document.getElementById('content').innerHTML  = data.m.replace(/\n/g, '<br>');
    document.getElementById('question').innerText  = data.q || '';
    document.getElementById('btn-next').innerText  = data.btnNext || 'İleri ➡';

    // ── Zaman Çizelgesi Güncelleme ─────────────────────────────
    const pct = Math.round(((currentStep + 1) / total) * 100);

    // Global bar
    const fill = document.getElementById('tl-global-fill');
    if (fill) fill.style.width = pct + '%';

    // Bölüm adı + renk
    const bolumNameEl  = document.getElementById('tl-bolum-name');
    const bolumRangeEl = document.getElementById('tl-bolum-range');
    if (bolumNameEl)  { bolumNameEl.textContent = bolum.name; bolumNameEl.style.color = bolum.color; }
    if (bolumRangeEl) bolumRangeEl.textContent  = getBolumRange(bolum) + ' · %' + pct;

    // Önceki / Sonraki isimler
    const prevEl    = document.getElementById('tl-prev-name');
    const nextEl    = document.getElementById('tl-next-name');
    const counterEl = document.getElementById('tl-step-counter');

    if (prevEl) {
        if (currentStep > 0) {
            const pb = getBolumByIndex(currentStep - 1);
            prevEl.textContent = pb.name;
            prevEl.className   = 'tl-side-name prev';
            prevEl.style.color = 'rgba(243,223,160,0.5)';
        } else {
            prevEl.textContent = '';
        }
    }
    if (nextEl) {
        if (currentStep < total - 1) {
            const nb = getBolumByIndex(currentStep + 1);
            nextEl.textContent = nb.name;
            nextEl.className   = 'tl-side-name next';
            nextEl.style.color = 'rgba(243,223,160,0.5)';
        } else {
            nextEl.textContent = '';
        }
    }
    if (counterEl) counterEl.textContent = (currentStep + 1) + ' / ' + total;

    // ── Ses ───────────────────────────────────────────────────
    const audio = document.getElementById('audio-player');
    if (audio && data.a) {
        audio.src   = data.a;
        audio.muted = isMuted;
        if (!isMuted) audio.play().catch(() => {});
    }

    // ── Galeri ────────────────────────────────────────────────
    currentImgIdx = 0;
    const gallery = document.getElementById('gallery-target');
    gallery.innerHTML = '';
    if (data.g && data.g.length > 0) {
        const wrapper = document.createElement('div');
        wrapper.className = 'gallery-wrapper';

        const container = document.createElement('div');
        container.id        = 'gallery-container';
        container.className = 'gallery-container';

        data.g.forEach(src => {
            const img = document.createElement('img');
            img.src = src;
            img.loading = 'lazy';
            container.appendChild(img);
        });
        wrapper.appendChild(container);

        if (data.g.length > 1) {
            const nav = document.createElement('div');
            nav.className = 'gallery-nav';
            nav.innerHTML = '<button class="gal-btn" onclick="moveGallery(-1)">❮</button><button class="gal-btn" onclick="moveGallery(1)">❯</button>';
            wrapper.appendChild(nav);
        }
        gallery.appendChild(wrapper);
    }

    // ── Geri butonu ───────────────────────────────────────────
    document.getElementById('btn-prev').style.visibility = currentStep === 0 ? 'hidden' : 'visible';
}

// ── Navigasyon ─────────────────────────────────────────────────
function navStep(dir) {
    const total = typeof tourData !== 'undefined' ? tourData.length : 29;
    if (dir === 1) {
        if (currentStep === total - 1) {
            changeScreen('screen-guestbook');
            loadMessages();
        } else {
            currentStep++;
            renderStep();
        }
    } else {
        if (currentStep > 0) { currentStep--; renderStep(); }
    }
    window.scrollTo(0, 0);
}

function moveGallery(dir) {
    const container = document.getElementById('gallery-container');
    if (!container) return;
    const count   = container.querySelectorAll('img').length;
    currentImgIdx = (currentImgIdx + dir + count) % count;
    container.style.transform = `translateX(-${currentImgIdx * 100}%)`;
}

// ── Ses Kontrol ─────────────────────────────────────────────────
function toggleMute() {
    isMuted = !isMuted;
    localStorage.setItem('audioMuted', isMuted);
    const audio = document.getElementById('audio-player');
    if (audio) {
        audio.muted = isMuted;
        if (!isMuted) audio.play().catch(() => {});
        else audio.pause();
    }
    updateSoundIcon();
}

function updateSoundIcon() {
    const icon = document.getElementById('vol-icon');
    if (icon) icon.className = isMuted ? 'fas fa-volume-mute' : 'fas fa-volume-up';
}

// ── Popup ───────────────────────────────────────────────────────
function closePopup() {
    const popup = document.getElementById('success-popup');
    if (popup) popup.style.display = 'none';
}

// ── Ziyaretçi Defteri ──────────────────────────────────────────
async function sendMessage() {
    const nameEl = document.getElementById('guest-name');
    const cityEl = document.getElementById('guest-city');
    const textEl = document.getElementById('guest-text');
    const btn    = document.querySelector('.send-btn');

    if (!textEl || !textEl.value.trim()) {
        alert('Lütfen bir not bırakın ✨');
        return;
    }

    const origText = btn.innerText;
    btn.disabled   = true;
    btn.innerText  = 'Mühürleniyor...';

    const sealSound = document.getElementById('seal-sound');
    if (sealSound) sealSound.play().catch(() => {});

    try {
        await db.collection('messages').add({
            user:      nameEl.value.trim() || 'Anonim Ziyaretçi',
            city:      cityEl.value.trim() || 'Belirtilmedi',
            text:      textEl.value.trim(),
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });

        nameEl.value = '';
        cityEl.value = '';
        textEl.value = '';

        const popup = document.getElementById('success-popup');
        if (popup) {
            document.getElementById('success-msg').innerText =
                "Duygularınız Gönül Köprüsü'ne mühürlendi. ✨\nBıraktığınız bu anlamlı iz, külliyemizin manevi mirasını zenginleştirdi...";
            popup.style.display = 'flex';
        }
        loadMessages();
    } catch (err) {
        console.error('Firebase Hatası:', err);
        alert('Bağlantı hatası! Lütfen internet bağlantınızı kontrol edin.');
    } finally {
        btn.disabled  = false;
        btn.innerText = origText;
    }
}

function loadMessages() {
    const listTarget = document.getElementById('list-target');
    if (!listTarget) return;

    db.collection('messages')
        .orderBy('timestamp', 'desc')
        .onSnapshot(snap => {
            messages = [];
            snap.forEach(doc => messages.push(doc.data()));
            renderMessages();
        }, err => {
            console.error('Mesajlar yüklenemedi:', err);
        });
}

function renderMessages() {
    const target = document.getElementById('list-target');
    if (!target) return;
    target.innerHTML = '';

    const start = (currentPage - 1) * MSGS_PER_PAGE;
    const slice = messages.slice(start, start + MSGS_PER_PAGE);

    if (slice.length === 0) {
        target.innerHTML = '<p style="color:rgba(245,234,214,0.35);font-style:italic;text-align:center;padding:1rem;">Henüz mesaj yok. İlk taşı siz koyun! ✨</p>';
        return;
    }

    slice.forEach(m => {
        const ts   = m.timestamp ? new Date(m.timestamp.seconds * 1000).toLocaleDateString('tr-TR') : '';
        const card = document.createElement('div');
        card.className = 'msg-card';
        card.innerHTML = `
            <div class="msg-author">${escapeHtml(m.user || 'Anonim')}</div>
            <div class="msg-city">${escapeHtml(m.city || '')}</div>
            <div class="msg-body">${escapeHtml(m.text || '')}</div>
            ${ts ? `<div class="msg-date">${ts}</div>` : ''}
        `;
        target.appendChild(card);
    });

    renderPagination();
}

function renderPagination() {
    const target = document.getElementById('page-target');
    if (!target) return;
    const total = Math.ceil(messages.length / MSGS_PER_PAGE);
    target.innerHTML = '';
    if (total <= 1) return;

    for (let i = 1; i <= total; i++) {
        const btn = document.createElement('button');
        btn.textContent = i;
        btn.className   = i === currentPage ? 'active' : '';
        btn.onclick     = () => { currentPage = i; renderMessages(); };
        target.appendChild(btn);
    }
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
