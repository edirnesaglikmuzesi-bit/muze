// ═══════════════════════════════════════════════════
//  Sultan II. Bayezid Külliyesi Sağlık Müzesi
//  Service Worker — PWA Offline Desteği
//  Versiyon: 1.0.0
// ═══════════════════════════════════════════════════

const CACHE_NAME = 'saglik-muzesi-v1';

// Önbelleğe alınacak dosyalar
const STATIC_ASSETS = [
  './rehber.html',
  './konum.html',
  './ziyaretci-defteri.html',
  './style.css',
  './script.js',
  './manifest.json',
  // Google Fonts (opsiyonel — internet yoksa sistem fontu kullanılır)
  'https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&family=Lora:ital,wght@0,400;0,600;1,400&display=swap'
];

// ── Kurulum: statik dosyaları önbelleğe al ──
self.addEventListener('install', event => {
  console.log('[SW] Kurulum başladı');
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('[SW] Dosyalar önbelleğe alınıyor');
      // Tek tek dene — biri başarısız olursa diğerleri durmasın
      return Promise.allSettled(
        STATIC_ASSETS.map(url =>
          cache.add(url).catch(err => console.warn('[SW] Önbellek hatası:', url, err))
        )
      );
    }).then(() => self.skipWaiting())
  );
});

// ── Aktivasyon: eski önbellekleri temizle ──
self.addEventListener('activate', event => {
  console.log('[SW] Aktif');
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => {
            console.log('[SW] Eski önbellek silindi:', key);
            return caches.delete(key);
          })
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch: önce önbellek, yoksa ağ ──
self.addEventListener('fetch', event => {
  // POST isteklerini geç (Firebase Firestore)
  if (event.request.method !== 'GET') return;

  // Firebase ve dış API isteklerini önbelleğe alma
  const url = new URL(event.request.url);
  const skipDomains = [
    'firebaseio.com',
    'googleapis.com',
    'gstatic.com',
    'anthropic.com'
  ];
  if (skipDomains.some(d => url.hostname.includes(d))) {
    return; // Ağdan doğrudan al
  }

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) {
        // Önbellekte var → hemen döndür, arka planda güncelle
        const fetchPromise = fetch(event.request)
          .then(response => {
            if (response && response.status === 200) {
              caches.open(CACHE_NAME).then(cache =>
                cache.put(event.request, response.clone())
              );
            }
            return response;
          })
          .catch(() => {}); // Offline ise sessizce geç
        return cached;
      }

      // Önbellekte yok → ağdan al ve kaydet
      return fetch(event.request)
        .then(response => {
          if (!response || response.status !== 200 || response.type === 'opaque') {
            return response;
          }
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache =>
            cache.put(event.request, responseClone)
          );
          return response;
        })
        .catch(() => {
          // Tamamen offline — fallback sayfası
          if (event.request.destination === 'document') {
            return caches.match('./rehber.html');
          }
        });
    })
  );
});

// ── Push bildirimleri (ileride kullanım için) ──
self.addEventListener('push', event => {
  if (!event.data) return;
  const data = event.data.json();
  self.registration.showNotification(data.title || 'Sağlık Müzesi', {
    body: data.body || '',
    icon: './assets/icons/icon-192.png',
    badge: './assets/icons/icon-72.png'
  });
});
