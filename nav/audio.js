/* ============================================================
   audio.js — Global Audio & Text-to-Speech Controller
   Ses durumu localStorage'da saklanır, tüm ekranlarda paylaşılır
   ============================================================ */

const AudioController = (() => {
  /* ── State ───────────────────────────────────────────────── */
  let _muted   = localStorage.getItem('audioMuted') === 'true';
  let _ttsLang = 'tr-TR';
  let _ttsRate = 0.92;
  let _audioEl = null; // set once DOM ready

  /* ── Init ─────────────────────────────────────────────────── */
  function init(audioElementId = 'audio-player') {
    _audioEl = document.getElementById(audioElementId);
    _syncIcon();

    // Ses butonuna tıklama
    const btn = document.getElementById('sound-btn');
    if (btn) btn.addEventListener('click', toggle);

    // TTS ses listesini hazırla
    if ('speechSynthesis' in window) {
      window.speechSynthesis.getVoices();
      window.speechSynthesis.addEventListener('voiceschanged', () =>
        window.speechSynthesis.getVoices()
      );
    }
  }

  /* ── Toggle mute ─────────────────────────────────────────── */
  function toggle() {
    _muted = !_muted;
    localStorage.setItem('audioMuted', _muted);
    if (_audioEl) {
      _audioEl.muted = _muted;
      if (_muted) {
        _audioEl.pause();
        _cancelTTS();
      } else {
        _audioEl.play().catch(() => {});
      }
    }
    _syncIcon();
    UI.toast(_muted ? '🔇 Ses kapalı' : '🔊 Ses açık');
  }

  /* ── Play an audio file ──────────────────────────────────── */
  function play(src) {
    if (!_audioEl) return;
    _audioEl.src   = src || '';
    _audioEl.muted = _muted;
    if (!_muted && src) {
      _audioEl.play().catch(() => {});
    }
  }

  /* ── Stop audio ─────────────────────────────────────────── */
  function stop() {
    if (!_audioEl) return;
    _audioEl.pause();
    _audioEl.src = '';
  }

  /* ── Play a one-shot sound effect (seal, bell, etc.) ─────── */
  function fx(src) {
    if (_muted) return;
    const a = new Audio(src);
    a.volume = 0.6;
    a.play().catch(() => {});
  }

  /* ── Text-to-Speech ─────────────────────────────────────── */
  function speak(text) {
    if (_muted || !('speechSynthesis' in window) || !text) return;
    _cancelTTS();
    const u   = new SpeechSynthesisUtterance(text);
    u.lang    = _ttsLang;
    u.rate    = _ttsRate;
    const voices = window.speechSynthesis.getVoices();
    const tr  = voices.find(v => v.lang.startsWith('tr'));
    if (tr) u.voice = tr;
    window.speechSynthesis.speak(u);
  }

  function _cancelTTS() {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  }

  /* ── Getters ─────────────────────────────────────────────── */
  function isMuted() { return _muted; }

  /* ── Private icon sync ───────────────────────────────────── */
  function _syncIcon() {
    const icon = document.getElementById('vol-icon');
    if (!icon) return;
    // FontAwesome 6
    icon.className = _muted
      ? 'fas fa-volume-xmark'
      : 'fas fa-volume-high';
    // Fallback for FA < 6
    if (!icon.className.includes('fa-')) {
      icon.textContent = _muted ? '🔇' : '🔊';
    }
  }

  return { init, toggle, play, stop, fx, speak, isMuted };
})();
