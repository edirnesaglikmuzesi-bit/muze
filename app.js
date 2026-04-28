/* ============================================================
   app.js — Tur Yöneticisi + Ziyaretçi Defteri + UI Yardımcıları
   ============================================================ */

/* ── UI Yardımcıları (global) ────────────────────────────── */
const UI = {
  /* Toast bildirimi */
  toast(msg, duration = 3000) {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(UI._toastTimer);
    UI._toastTimer = setTimeout(() => el.classList.remove('show'), duration);
  },
  _toastTimer: null,

  /* HTML escape */
  esc(str) {
    return String(str || '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  },

  /* Popup aç */
  showPopup(msg) {
    const p  = document.getElementById('success-popup');
    const pm = document.getElementById('success-msg');
    if (pm) pm.textContent = msg;
    if (p)  { p.style.display = 'flex'; p.classList.add('active'); }
  },

  /* Popup kapat */
  closePopup() {
    const p = document.getElementById('success-popup');
    if (p) { p.style.display = 'none'; p.classList.remove('active'); }
  }
};

/* ════════════════════════════════════════════════════════════
   BÖLÜM HARİTASI
════════════════════════════════════════════════════════════ */
const SECTIONS = [
  { name: 'Müze Girişi',   color: '#1e5f5f', stops: [0] },
  { name: 'Darüşşifa',     color: '#b8860b', stops: [1, 2, 3] },
  { name: 'Medrese',       color: '#5a8a3a', stops: [4] },
  { name: 'Bahçe & İmaret',color: '#c97a2a', stops: [5, 6] },
  { name: 'Cami',          color: '#8b1a1a', stops: [7] },
  { name: 'Gönül Köprüsü', color: '#2d5a8a', stops: [8] },
];

function getSectionByIdx(idx) {
  return SECTIONS.find(s => s.stops.includes(idx)) || SECTIONS[0];
}

/* ════════════════════════════════════════════════════════════
   TUR YÖNETİCİSİ
════════════════════════════════════════════════════════════ */
const TourManager = (() => {
  let _step      = 0;
  let _imgIdx    = 0;
  let _evliyaDone = false;

  /* ── Başlat ─────────────────────────────────────────────── */
  function start() {
    Navigation.changeScreen('screen-tour');
    _step   = 0;
    _imgIdx = 0;
    AudioController.fx('assets/audio/muhur.mp3');
    render();
  }

  /* ── Render ─────────────────────────────────────────────── */
  function render() {
    if (typeof tourData === 'undefined') {
      console.error('[TourManager] tourData bulunamadı!');
      return;
    }

    const data  = tourData[_step];
    const total = tourData.length;
    const sec   = getSectionByIdx(_step);
    const pct   = Math.round(((_step + 1) / total) * 100);

    /* ── İçerik ─────────────────────────────────────────── */
    _setText('step-title',    data.t);
    _setText('step-subtitle', data.s);
    _setHTML('text-content',  _formatContent(data.m));
    _setText('step-question', data.q || '');
    _setText('btn-next',      data.btnNext || 'İleri ➡');
    document.getElementById('btn-prev').style.visibility =
      _step === 0 ? 'hidden' : 'visible';

    /* ── Timeline ────────────────────────────────────────── */
    const fillEl = document.getElementById('tl-fill');
    if (fillEl) fillEl.style.width = pct + '%';

    const secNameEl = document.getElementById('tl-section-name');
    if (secNameEl) { secNameEl.textContent = sec.name; secNameEl.style.color = sec.color; }

    const counterEl = document.getElementById('tl-counter');
    if (counterEl) counterEl.textContent = `${_step + 1} / ${total} · %${pct}`;

    if (document.getElementById('tl-prev')) {
      document.getElementById('tl-prev').textContent =
        _step > 0 ? getSectionByIdx(_step - 1).name : '';
    }
    if (document.getElementById('tl-next')) {
      document.getElementById('tl-next').textContent =
        _step < total - 1 ? getSectionByIdx(_step + 1).name : '';
    }

    /* ── Ses ─────────────────────────────────────────────── */
    AudioController.play(data.a || '');

    /* ── Galeri ──────────────────────────────────────────── */
    _imgIdx = 0;
    _buildGallery(data.g || []);

    /* ── Evliya Çelebi (ilk adımda bir kez) ─────────────── */
    if (_step === 0 && !_evliyaDone) {
      _evliyaDone = true;
      _triggerEvliya(data.evliya || '500 yıllık bu yolculuğa hoş geldiniz! Ben dijital rehberiniz Evliya Çelebi\'yim. 🎭');
    }

    /* ── Scroll ──────────────────────────────────────────── */
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* ── Navigasyon ──────────────────────────────────────────── */
  function nav(dir) {
    const total = typeof tourData !== 'undefined' ? tourData.length : 9;

    if (dir === 1) {
      if (_step === total - 1) {
        // Son adımdan Gönül Köprüsü'ne geç
        Navigation.changeScreen('screen-guestbook');
        GuestBook.load();
        return;
      }
      _step++;
    } else {
      if (_step > 0) _step--;
    }
    render();
  }

  /* ── Galeri ──────────────────────────────────────────────── */
  function _buildGallery(imgs) {
    const target = document.getElementById('gallery-target');
    if (!target) return;
    target.innerHTML = '';
    if (!imgs.length) return;

    const wrapper   = document.createElement('div');
    wrapper.className = 'gallery-wrapper';

    const container = document.createElement('div');
    container.id        = 'gallery-container';
    container.className = 'gallery-container';

    imgs.forEach(src => {
      const img    = document.createElement('img');
      img.src      = src;
      img.loading  = 'lazy';
      img.alt      = 'Külliye görseli';
      container.appendChild(img);
    });
    wrapper.appendChild(container);

    /* Fullscreen toggle */
    const fsBtn = document.createElement('button');
    fsBtn.className = 'gallery-fullscreen';
    fsBtn.setAttribute('aria-label', 'Tam ekran');
    fsBtn.innerHTML = '⛶';
    fsBtn.addEventListener('click', () => _toggleFullscreen(wrapper));
    wrapper.appendChild(fsBtn);

    /* Ok navigasyonu (birden fazla görsel) */
    if (imgs.length > 1) {
      const nav = document.createElement('div');
      nav.className = 'gallery-nav';

      const prev = _makeGalBtn('❮', () => _moveGallery(-1, imgs.length));
      const next = _makeGalBtn('❯', () => _moveGallery( 1, imgs.length));
      nav.appendChild(prev);
      nav.appendChild(next);
      wrapper.appendChild(nav);

      /* Dot göstergeleri */
      const dots = document.createElement('div');
      dots.className = 'gallery-dots';
      dots.id = 'gallery-dots';
      imgs.forEach((_, i) => {
        const d = document.createElement('div');
        d.className = 'gal-dot' + (i === 0 ? ' active' : '');
        d.addEventListener('click', () => _jumpGallery(i, imgs.length));
        dots.appendChild(d);
      });
      wrapper.appendChild(dots);
    }

    target.appendChild(wrapper);
  }

  function _makeGalBtn(label, fn) {
    const btn = document.createElement('button');
    btn.className   = 'gal-btn';
    btn.textContent = label;
    btn.setAttribute('aria-label', label === '❮' ? 'Önceki görsel' : 'Sonraki görsel');
    btn.addEventListener('click', fn);
    return btn;
  }

  function _moveGallery(dir, total) {
    _imgIdx = (_imgIdx + dir + total) % total;
    _applyGalleryPos();
  }

  function _jumpGallery(idx) {
    _imgIdx = idx;
    _applyGalleryPos();
  }

  function _applyGalleryPos() {
    const c = document.getElementById('gallery-container');
    if (c) c.style.transform = `translateX(-${_imgIdx * 100}%)`;

    const dots = document.querySelectorAll('.gal-dot');
    dots.forEach((d, i) => d.classList.toggle('active', i === _imgIdx));
  }

  function _toggleFullscreen(el) {
    if (!document.fullscreenElement) {
      el.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.();
    }
  }

  /* ── Evliya Çelebi animasyonu ─────────────────────────────── */
  function _triggerEvliya(text) {
    const wrap   = document.getElementById('evliya-wrap');
    const bubble = document.getElementById('evliya-bubble');
    if (!wrap || !bubble) return;

    bubble.textContent = text;
    wrap.classList.add('enter');

    setTimeout(() => { wrap.classList.remove('enter'); }, 6500);
  }

  /* ── İçerik formatlayıcı ──────────────────────────────────── */
  function _formatContent(raw) {
    if (!raw) return '';
    // Önce markdown'u işle, sonra güvenli HTML üret
    return raw
      .replace(/\*\*(.+?)\*\*/g, '\x00STRONG\x01$1\x02STRONG\x00')
      .replace(/\*(.+?)\*/g,     '\x00EM\x01$1\x02EM\x00')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/\x00STRONG\x01(.+?)\x02STRONG\x00/g, '<strong>$1</strong>')
      .replace(/\x00EM\x01(.+?)\x02EM\x00/g,         '<em>$1</em>')
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g,   '<br>');
  }

  function _setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val || '';
  }

  function _setHTML(id, html) {
    const el = document.getElementById(id);
    if (el) el.innerHTML = '<p>' + html + '</p>';
  }

  /* ── Getter ───────────────────────────────────────────────── */
  function currentData() {
    if (typeof tourData === 'undefined' || !tourData[_step]) return null;
    return tourData[_step];
  }

  return { start, nav, render, currentData };
})();

/* ════════════════════════════════════════════════════════════
   ZİYARETÇİ DEFTERİ
════════════════════════════════════════════════════════════ */
const GuestBook = (() => {
  const PER_PAGE = 10;
  let _messages  = [];
  let _page      = 1;

  /* Firebase referansı (rehber.html içinde tanımlandı) */
  function _db() { return typeof db !== 'undefined' ? db : null; }

  /* ── Mesajları yükle ─────────────────────────────────────── */
  function load() {
    const database = _db();
    if (!database) { _renderMessages(); return; }

    database.collection('messages')
      .orderBy('timestamp', 'desc')
      .onSnapshot(
        snap => {
          _messages = [];
          snap.forEach(doc => _messages.push(doc.data()));
          _renderMessages();
        },
        err => console.error('[GuestBook] Mesajlar yüklenemedi:', err)
      );
  }

  /* ── Mesaj gönder ────────────────────────────────────────── */
  async function send() {
    const nameEl = document.getElementById('gb-name');
    const cityEl = document.getElementById('gb-city');
    const textEl = document.getElementById('gb-text');
    const btn    = document.getElementById('btn-send');

    if (!textEl || !textEl.value.trim()) {
      UI.toast('✨ Lütfen bir not bırakın');
      return;
    }

    const orig = btn?.textContent || '';
    if (btn) { btn.disabled = true; btn.textContent = 'Mühürleniyor...'; }

    AudioController.fx('assets/audio/muhur.mp3');

    const database = _db();
    if (database) {
      try {
        await database.collection('messages').add({
          user:      (nameEl?.value.trim()) || 'Anonim Ziyaretçi',
          city:      (cityEl?.value.trim()) || 'Belirtilmedi',
          text:      textEl.value.trim(),
          timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });

        if (nameEl) nameEl.value = '';
        if (cityEl) cityEl.value = '';
        textEl.value = '';

        setTimeout(() => {
          UI.showPopup(
            "Duygularınız Gönül Köprüsü'ne mühürlendi. ✨\n" +
            "Bıraktığınız bu anlamlı iz, külliyemizin manevi mirasını zenginleştirdi..."
          );
        }, 900);

      } catch (err) {
        console.error('[GuestBook] Firebase hatası:', err);
        UI.toast('❌ Bağlantı hatası! İnternet bağlantınızı kontrol edin.');
      }
    } else {
      // Firebase yoksa yerel gösterim
      _messages.unshift({
        user: (nameEl?.value.trim()) || 'Anonim',
        city: (cityEl?.value.trim()) || '',
        text: textEl.value.trim(),
        timestamp: null
      });
      if (nameEl) nameEl.value = '';
      if (cityEl) cityEl.value = '';
      textEl.value = '';
      _renderMessages();
      UI.showPopup('Not bırakıldı. ✨');
    }

    if (btn) { btn.disabled = false; btn.textContent = orig; }
  }

  /* ── Mesajları render et ─────────────────────────────────── */
  function _renderMessages() {
    const target = document.getElementById('list-target');
    if (!target) return;
    target.innerHTML = '';

    const start = (_page - 1) * PER_PAGE;
    const slice = _messages.slice(start, start + PER_PAGE);

    if (!slice.length) {
      target.innerHTML = '<p class="msg-empty">Henüz mesaj yok. İlk taşı siz koyun! ✨</p>';
      _renderPagination();
      return;
    }

    const frag = document.createDocumentFragment();
    slice.forEach(m => {
      const ts  = m.timestamp ? new Date(m.timestamp.seconds * 1000).toLocaleDateString('tr-TR') : '';
      const div = document.createElement('div');
      div.className = 'msg-card';
      div.innerHTML = `
        <div class="msg-author">${UI.esc(m.user || 'Anonim')}</div>
        <div class="msg-city">${UI.esc(m.city || '')}</div>
        <div class="msg-body">${UI.esc(m.text || '')}</div>
        ${ts ? `<div class="msg-date">${ts}</div>` : ''}
      `;
      frag.appendChild(div);
    });
    target.appendChild(frag);
    _renderPagination();
  }

  function _renderPagination() {
    const target = document.getElementById('page-target');
    if (!target) return;
    const total = Math.ceil(_messages.length / PER_PAGE);
    target.innerHTML = '';
    if (total <= 1) return;

    for (let i = 1; i <= total; i++) {
      const btn = document.createElement('button');
      btn.textContent = i;
      btn.className   = 'page-btn' + (i === _page ? ' active' : '');
      btn.addEventListener('click', () => { _page = i; _renderMessages(); });
      target.appendChild(btn);
    }
  }

  return { load, send };
})();

/* ════════════════════════════════════════════════════════════
   DOM HAZIR — BAŞLANGIC
════════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  /* Modülleri başlat */
  AudioController.init('audio-player');
  Navigation.init();
  AIGuide.init();

  /* Popup kapat butonu */
  document.getElementById('popup-close')?.addEventListener('click', UI.closePopup);

  /* Gönder butonu */
  document.getElementById('btn-send')?.addEventListener('click', GuestBook.send);

  /* Tour navigasyon butonları (event delegation) */
  document.getElementById('btn-next')?.addEventListener('click', () => TourManager.nav(1));
  document.getElementById('btn-prev')?.addEventListener('click', () => TourManager.nav(-1));

  /* Başla butonu */
  document.getElementById('btn-start')?.addEventListener('click', TourManager.start);

  /* Başlangıç ekranı */
  Navigation.changeScreen('screen-intro');
});
