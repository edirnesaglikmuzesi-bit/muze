/* ============================================================
   analytics.js — Sultan II. Bayezid Külliyesi İzleme Modülü
   
   KURULUM: rehber.html'de Firebase scriptlerinden SONRA ekle:
   <script src="analytics.js"></script>
   
   Topladığı veriler (Firestore koleksiyonları):
   ─ analytics_sessions   : oturum başlangıç/bitiş, cihaz bilgisi
   ─ analytics_pageviews  : sayfa geçişleri + kalma süresi
   ─ analytics_events     : buton tıklamaları, ses olayları
   ─ analytics_audio      : sesli rehber dinleme süreleri
   ─ analytics_live       : anlık çevrimiçi varlık (heartbeat)
   ============================================================ */

const Analytics = (() => {
  'use strict';

  /* ── Yapılandırma ──────────────────────────────────────── */
  const CFG = {
    heartbeatInterval: 25000,   // ms — canlı varlık bildirimi
    minPageTime:       500,      // ms — minimum kayıt için kalma süresi
    liveExpirySec:     60,       // sn — heartbeat kesilince "çevrimdışı" sayılma süresi
    collection: {
      sessions:   'analytics_sessions',
      pageviews:  'analytics_pageviews',
      events:     'analytics_events',
      audio:      'analytics_audio',
      live:       'analytics_live',
    },
  };

  /* ── State ─────────────────────────────────────────────── */
  let _db           = null;
  let _sessionId    = null;
  let _sessionRef   = null;
  let _liveRef      = null;
  let _currentPage  = null;
  let _pageStart    = null;
  let _audioStart   = null;
  let _audioPage    = null;
  let _heartbeatTimer = null;
  let _initialized  = false;
  let _soundOn      = true;
  let _tourStep     = 0;

  /* ── Yardımcılar ─────────────────────────────────────────── */
  function _ts() {
    return typeof firebase !== 'undefined'
      ? firebase.firestore.FieldValue.serverTimestamp()
      : new Date();
  }

  function _now() { return Date.now(); }

  function _uid() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 8);
  }

  function _getDevice() {
    const ua = navigator.userAgent;
    let type = 'PC / Mac';
    if (/android/i.test(ua))          type = 'Android';
    else if (/iphone|ipad|ipod/i.test(ua)) type = 'iOS';

    let browser = 'Diğer';
    if (/edg\//i.test(ua))            browser = 'Edge';
    else if (/opr\//i.test(ua))       browser = 'Opera';
    else if (/samsungbrowser/i.test(ua)) browser = 'Samsung Browser';
    else if (/firefox/i.test(ua))     browser = 'Firefox';
    else if (/chrome/i.test(ua))      browser = 'Chrome';
    else if (/safari/i.test(ua))      browser = 'Safari';

    return {
      type,
      browser,
      os: navigator.platform || 'Bilinmiyor',
      screen: `${screen.width}×${screen.height}`,
      lang: navigator.language || 'tr',
      touch: 'ontouchstart' in window,
    };
  }

  function _getPageLabel(screenId) {
    const map = {
      'screen-intro':      'Müze Girişi',
      'screen-tour':       'Sesli Tur',
      'screen-guestbook':  'Gönül Köprüsü',
    };
    return map[screenId] || screenId || 'Bilinmiyor';
  }

  /* ── Oturum Başlat ─────────────────────────────────────── */
  async function _startSession() {
    if (!_db) return;
    _sessionId = _uid();

    const device = _getDevice();
    const data = {
      sessionId:  _sessionId,
      startedAt:  _ts(),
      endedAt:    null,
      durationSec: null,
      device:     device.type,
      browser:    device.browser,
      os:         device.os,
      screen:     device.screen,
      lang:       device.lang,
      touch:      device.touch,
      soundOn:    _soundOn,
      pagesVisited: 0,
      tourCompleted: false,
      guestbookSent: false,
    };

    try {
      _sessionRef = await _db.collection(CFG.collection.sessions).add(data);
    } catch (e) {
      console.warn('[Analytics] Oturum başlatılamadı:', e);
    }
  }

  /* ── Oturum Kapat ──────────────────────────────────────── */
  async function _endSession() {
    if (!_sessionRef) return;
    const durationSec = Math.round((_now() - _sessionStartTime) / 1000);
    try {
      await _sessionRef.update({
        endedAt:     _ts(),
        durationSec,
        soundOn:     _soundOn,
      });
    } catch (e) { /* sessiz başarısız */ }
    _stopHeartbeat();
    _removeLive();
  }

  let _sessionStartTime = _now();

  /* ── Sayfa Görüntüleme ─────────────────────────────────── */
  function _trackPageview(screenId) {
    if (!_db || !_sessionId) return;

    // Bir önceki sayfanın süresini kapat
    if (_currentPage && _pageStart) {
      const spent = _now() - _pageStart;
      if (spent >= CFG.minPageTime) {
        _db.collection(CFG.collection.pageviews).add({
          sessionId:   _sessionId,
          page:        _getPageLabel(_currentPage),
          screenId:    _currentPage,
          durationMs:  spent,
          durationSec: Math.round(spent / 1000),
          tourStep:    _tourStep,
          soundOn:     _soundOn,
          timestamp:   _ts(),
          date:        _dateKey(),
          hour:        new Date().getHours(),
          weekday:     new Date().getDay(),
          month:       new Date().getMonth() + 1,
        }).catch(() => {});
      }
    }

    _currentPage = screenId;
    _pageStart   = _now();

    // Oturumdaki sayfa sayısını arttır
    if (_sessionRef) {
      _sessionRef.update({
        pagesVisited: firebase.firestore.FieldValue.increment(1),
        lastPage: _getPageLabel(screenId),
        lastSeen: _ts(),
      }).catch(() => {});
    }
  }

  /* ── Buton / Olay Takibi ───────────────────────────────── */
  function _trackEvent(eventName, data = {}) {
    if (!_db || !_sessionId) return;
    _db.collection(CFG.collection.events).add({
      sessionId: _sessionId,
      event:     eventName,
      page:      _getPageLabel(_currentPage),
      tourStep:  _tourStep,
      soundOn:   _soundOn,
      timestamp: _ts(),
      date:      _dateKey(),
      hour:      new Date().getHours(),
      ...data,
    }).catch(() => {});
  }

  /* ── Ses Takibi ────────────────────────────────────────── */
  function _startAudioTracking() {
    _audioStart = _now();
    _audioPage  = _currentPage;
  }

  function _stopAudioTracking() {
    if (!_audioStart || !_db || !_sessionId) return;
    const durationMs = _now() - _audioStart;
    if (durationMs < 500) { _audioStart = null; return; }

    _db.collection(CFG.collection.audio).add({
      sessionId:   _sessionId,
      page:        _getPageLabel(_audioPage || _currentPage),
      tourStep:    _tourStep,
      durationMs,
      durationSec: Math.round(durationMs / 1000),
      type:        'audio_file', // veya 'tts'
      timestamp:   _ts(),
      date:        _dateKey(),
    }).catch(() => {});

    _audioStart = null;
    _audioPage  = null;
  }

  /* ── Heartbeat (Canlı Varlık) ──────────────────────────── */
  async function _startHeartbeat() {
    if (!_db || !_sessionId) return;

    _liveRef = _db.collection(CFG.collection.live).doc(_sessionId);
    await _pingLive();

    _heartbeatTimer = setInterval(_pingLive, CFG.heartbeatInterval);
  }

  async function _pingLive() {
    if (!_liveRef) return;
    const expiry = new Date(Date.now() + CFG.liveExpirySec * 1000);
    try {
      await _liveRef.set({
        sessionId: _sessionId,
        page:      _getPageLabel(_currentPage),
        tourStep:  _tourStep,
        soundOn:   _soundOn,
        device:    _getDevice().type,
        lastSeen:  _ts(),
        expiresAt: expiry,
        active:    true,
      }, { merge: true });
    } catch (e) { /* sessiz */ }
  }

  function _stopHeartbeat() {
    clearInterval(_heartbeatTimer);
    _heartbeatTimer = null;
  }

  async function _removeLive() {
    if (!_liveRef) return;
    try {
      await _liveRef.update({ active: false, endedAt: _ts() });
    } catch (e) { /* sessiz */ }
  }

  /* ── Tarih anahtarı ──────────────────────────────────────── */
  function _dateKey() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }

  /* ── Navigation patch (Navigation.changeScreen'i yakala) ─ */
  function _patchNavigation() {
    if (typeof Navigation === 'undefined') return;
    const original = Navigation.changeScreen.bind(Navigation);
    Navigation.changeScreen = function(id, pushState) {
      _trackPageview(id);
      return original(id, pushState);
    };
  }

  /* ── AudioController patch ─────────────────────────────── */
  function _patchAudio() {
    if (typeof AudioController === 'undefined') return;

    // toggle (ses aç/kapat)
    const origToggle = AudioController.toggle.bind(AudioController);
    AudioController.toggle = function() {
      origToggle();
      _soundOn = !AudioController.isMuted();
      _trackEvent(_soundOn ? 'sound_on' : 'sound_off');
      if (_soundOn) _startAudioTracking();
      else           _stopAudioTracking();
      if (_sessionRef) {
        _sessionRef.update({ soundOn: _soundOn }).catch(() => {});
      }
    };

    // play (ses dosyası çalınmaya başladı)
    const origPlay = AudioController.play.bind(AudioController);
    AudioController.play = function(src) {
      origPlay(src);
      if (src && !AudioController.isMuted()) {
        _stopAudioTracking();
        _startAudioTracking();
        _trackEvent('audio_play', { src: src.split('/').pop() });
      }
    };

    // stop
    const origStop = AudioController.stop.bind(AudioController);
    AudioController.stop = function() {
      _stopAudioTracking();
      origStop();
    };

    // speak (TTS)
    const origSpeak = AudioController.speak.bind(AudioController);
    AudioController.speak = function(text) {
      origSpeak(text);
      if (text && !AudioController.isMuted()) {
        _trackEvent('tts_speak', {
          textLen: text.length,
          textPreview: text.substr(0, 60),
        });
        // TTS süresini de ayrıca kaydet
        const approxMs = text.length * 65; // yaklaşık okuma süresi (ms)
        _db && _sessionId && _db.collection(CFG.collection.audio).add({
          sessionId:   _sessionId,
          page:        _getPageLabel(_currentPage),
          tourStep:    _tourStep,
          durationMs:  approxMs,
          durationSec: Math.round(approxMs / 1000),
          type:        'tts',
          timestamp:   _ts(),
          date:        _dateKey(),
        }).catch(() => {});
      }
    };
  }

  /* ── TourManager patch ─────────────────────────────────── */
  function _patchTourManager() {
    if (typeof TourManager === 'undefined') return;

    const origNav = TourManager.nav.bind(TourManager);
    TourManager.nav = function(dir) {
      const prevStep = _tourStep;
      origNav(dir);

      // nav sonrası adımı bul
      const d = TourManager.currentData?.();
      if (d) {
        // tourData dizisinde indeksi bul
        if (typeof tourData !== 'undefined') {
          const idx = tourData.indexOf(d);
          if (idx >= 0) _tourStep = idx;
        }
      }

      const btnLabel = dir === 1 ? 'İleri →' : '← Geri';
      _trackEvent('tour_nav', {
        button:    btnLabel,
        fromStep:  prevStep + 1,
        toStep:    _tourStep + 1,
        direction: dir === 1 ? 'ileri' : 'geri',
      });
    };

    const origStart = TourManager.start.bind(TourManager);
    TourManager.start = function() {
      _tourStep = 0;
      _trackEvent('tour_start');
      origStart();
    };
  }

  /* ── GuestBook patch ───────────────────────────────────── */
  function _patchGuestBook() {
    if (typeof GuestBook === 'undefined') return;

    const origSend = GuestBook.send.bind(GuestBook);
    GuestBook.send = async function() {
      await origSend();
      _trackEvent('guestbook_send');
      if (_sessionRef) {
        _sessionRef.update({ guestbookSent: true }).catch(() => {});
      }
    };
  }

  /* ── AI Rehber patch ───────────────────────────────────── */
  function _patchAIGuide() {
    if (typeof AIGuide === 'undefined') return;

    // togglePanel
    const origToggle = AIGuide.togglePanel.bind(AIGuide);
    AIGuide.togglePanel = function() {
      _trackEvent('ai_guide_toggle');
      origToggle();
    };

    // openPanel
    const origOpen = AIGuide.openPanel.bind(AIGuide);
    AIGuide.openPanel = function() {
      _trackEvent('ai_guide_open');
      origOpen();
    };
  }

  /* ── DOM Button Listener (tüm .btn tıklamalarını yakala) ── */
  function _patchButtons() {
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('button, [data-track], .btn, .nav-item');
      if (!btn || !_db || !_sessionId) return;

      const btnId = btn.id || '';
      const btnText = (btn.textContent || '').trim().substr(0, 40);
      const dataTrack = btn.dataset.track;

      // Zaten patch'lenen işlemleri çift kaydetme
      const skipIds = ['sound-btn','btn-next','btn-prev','btn-start','btn-send','ai-fab','ai-send-btn'];
      if (skipIds.includes(btnId)) return;

      // Navigasyon öğeleri
      if (btn.classList.contains('nav-item') || btn.dataset.screen) {
        _trackEvent('nav_click', {
          button:   btnText,
          targetScreen: btn.dataset.screen || '',
        });
        return;
      }

      if (btnId || dataTrack) {
        _trackEvent('btn_click', {
          buttonId:   btnId,
          buttonText: btnText,
          track:      dataTrack || '',
        });
      }
    }, true);

    // Özel butonları özel isimle izle
    const namedBtns = {
      'btn-next':    'İleri →',
      'btn-prev':    '← Geri',
      'btn-start':   'Turu Başlat',
      'btn-send':    'Defter Gönder',
      'ai-fab':      'AI Rehber (FAB)',
      'ai-send-btn': 'AI Rehber Gönder',
      'sound-btn':   'Ses Aç/Kapat',
      'menu-btn':    'Hamburger Menü',
      'global-konum-btn': 'Konum Butonu',
    };

    Object.entries(namedBtns).forEach(([id, label]) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('click', () => {
        _trackEvent('btn_click', { buttonId: id, buttonText: label });
      });
    });

    // Galeri butonları (dinamik — delegation)
    document.addEventListener('click', (e) => {
      const galBtn = e.target.closest('.gal-btn');
      if (!galBtn) return;
      _trackEvent('btn_click', {
        buttonId:   'gallery-nav',
        buttonText: 'Galeri ' + (galBtn.textContent.trim() === '❮' ? '← Önceki' : '→ Sonraki'),
      });
    });
  }

  /* ── Sayfa Kapanma ─────────────────────────────────────── */
  function _bindUnload() {
    const handler = () => {
      _stopAudioTracking();
      _trackPageview(null); // son sayfayı kapat
      _endSession();
    };

    window.addEventListener('beforeunload', handler);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        _stopAudioTracking();
        _pingLive().catch(() => {});
      } else {
        _pingLive().catch(() => {});
        if (!AudioController.isMuted()) _startAudioTracking();
      }
    });
  }

  /* ── Init ──────────────────────────────────────────────── */
  async function init() {
    if (_initialized) return;
    _initialized = true;

    // Firebase db referansı
    try {
      _db = typeof db !== 'undefined' ? db : firebase.firestore();
    } catch (e) {
      console.warn('[Analytics] Firebase bulunamadı — izleme pasif.');
      return;
    }

    _soundOn = localStorage.getItem('audioMuted') !== 'true';

    await _startSession();
    _startHeartbeat();
    _patchNavigation();
    _patchAudio();
    _patchButtons();
    _bindUnload();

    // TourManager ve GuestBook DOM yüklendikten sonra patch'le
    const patchAll = () => {
      _patchTourManager();
      _patchGuestBook();
      _patchAIGuide();
      // İlk sayfa görüntülemesini kaydet
      _trackPageview('screen-intro');
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', patchAll);
    } else {
      patchAll();
    }

    console.info('[Analytics] ✅ İzleme aktif — Oturum:', _sessionId);
  }

  /* ── Public API ────────────────────────────────────────── */
  return {
    init,
    trackEvent: (name, data) => _trackEvent(name, data),
    setTourStep: (step) => { _tourStep = step; },
  };
})();

/* ── Otomatik başlat (Firebase yüklendikten sonra) ─────── */
(function autoInit() {
  const tryInit = () => {
    if (typeof firebase !== 'undefined' && typeof firebase.firestore === 'function') {
      Analytics.init();
    } else {
      setTimeout(tryInit, 300);
    }
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', tryInit);
  } else {
    tryInit();
  }
})();
