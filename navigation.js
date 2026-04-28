/* ============================================================
   navigation.js — SPA Ekran Yöneticisi + Menü + History API
   ============================================================ */

const Navigation = (() => {
  /* ── Sayfa tanımları ─────────────────────────────────────── */
  const PAGES = [
    { id: 'screen-intro',      label: '🏛️ Müze Girişi',         icon: '🏛️' },
    { id: 'screen-tour',       label: '🎭 Sesli Tur',             icon: '🎭' },
    { id: 'screen-guestbook',  label: '🖋️ Gönül Köprüsü',       icon: '🖋️' },
  ];

  let _active = 'screen-intro';

  /* ── Init ─────────────────────────────────────────────────── */
  function init() {
    _buildMenu();
    _bindHamburger();
    _bindHistory();

    // Geri tuşu desteği
    window.addEventListener('popstate', (e) => {
      if (e.state && e.state.screen) changeScreen(e.state.screen, false);
    });
  }

  /* ── Menü oluştur ─────────────────────────────────────────── */
  function _buildMenu() {
    const container = document.getElementById('nav-items');
    if (!container) return;
    container.innerHTML = '';

    PAGES.forEach(p => {
      const el = document.createElement('div');
      el.className  = 'nav-item' + (p.id === _active ? ' active' : '');
      el.dataset.screen = p.id;
      el.setAttribute('role', 'menuitem');
      el.setAttribute('aria-label', p.label);
      el.innerHTML = `<span class="nav-icon">${p.icon}</span><span>${p.label}</span>`;
      el.addEventListener('click', () => {
        changeScreen(p.id);
        closeMenu();
      });
      container.appendChild(el);
    });
  }

  /* ── Hamburger menü aç/kapa ──────────────────────────────── */
  function _bindHamburger() {
    const btn     = document.getElementById('menu-btn');
    const overlay = document.getElementById('nav-overlay');
    if (btn)     btn.addEventListener('click', toggleMenu);
    if (overlay) overlay.addEventListener('click', closeMenu);
  }

  function toggleMenu() {
    const drawer  = document.getElementById('nav-drawer');
    const overlay = document.getElementById('nav-overlay');
    const btn     = document.getElementById('menu-btn');
    const isOpen  = drawer && drawer.classList.contains('open');
    if (isOpen) closeMenu();
    else        openMenu();
  }

  function openMenu() {
    document.getElementById('nav-drawer')?.classList.add('open');
    document.getElementById('nav-overlay')?.classList.add('open');
    document.getElementById('menu-btn')?.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeMenu() {
    document.getElementById('nav-drawer')?.classList.remove('open');
    document.getElementById('nav-overlay')?.classList.remove('open');
    document.getElementById('menu-btn')?.classList.remove('open');
    document.body.style.overflow = '';
  }

  /* ── History API ─────────────────────────────────────────── */
  function _bindHistory() {
    // İlk durum
    history.replaceState({ screen: _active }, '', '#' + _active);
  }

  /* ── Ekran değiştir ───────────────────────────────────────── */
  function changeScreen(id, pushState = true) {
    if (!document.getElementById(id)) return;

    // Mevcut ekranı gizle
    document.querySelectorAll('.screen').forEach(s => {
      s.classList.remove('active-screen');
    });

    // Yeni ekranı göster
    const el = document.getElementById(id);
    el.classList.add('active-screen');
    _active = id;
    window.scrollTo(0, 0);

    // History
    if (pushState) {
      history.pushState({ screen: id }, '', '#' + id);
    }

    // Menüde aktif öğeyi güncelle
    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.toggle('active', item.dataset.screen === id);
    });

    // AI fab: tur ekranında göster
    const fab = document.getElementById('ai-fab');
    if (fab) fab.classList.toggle('hidden', id !== 'screen-tour');
  }

  /* ── Aktif ekran getter ───────────────────────────────────── */
  function activeScreen() { return _active; }

  return { init, changeScreen, openMenu, closeMenu, toggleMenu, activeScreen };
})();
