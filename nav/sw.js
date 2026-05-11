// ═══════════════════════════════════════════════════
//  Sultan II. Bayezid Külliyesi Sağlık Müzesi
//  Service Worker — PWA Offline Desteği
//  Versiyon: 3.0.0
//
//  ⚠️  GÜNCELLEME YAPTIĞINIZDA SADECE ŞU SATIRI DEĞİŞTİRİN:
//      CACHE_NAME sayısını bir artırın → v3, v4, v5 ...
//      Geri kalanı otomatik — kullanıcı banner görür, yeniler.
// ═══════════════════════════════════════════════════

const CACHE_NAME = 'saglik-muzesi-v3.1';

// Önbelleğe alınacak dosyalar
const STATIC_ASSETS = [
  './rehber.html',
  './ziyaretci-defteri.html',
  './style.css',
  './manifest.json',
  // Google Fonts (opsiyonel — internet yoksa sistem fontu kullanılır)
  'https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&family=Lora:ital,wght@0,400;0,600;1,400&display=swap'
];

// ── Kurulum: statik dosyaları önbelleğe al ──
self.addEventListener('install', event => {
  console.log('[SW] Kurulum başladı — versiyon:', CACHE_NAME);
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('[SW] Dosyalar önbelleğe alınıyor');
      return Promise.allSettled(
        STATIC_ASSETS.map(url =>
          cache.add(url).catch(err => console.warn('[SW] Önbellek hatası:', url, err))
        )
      );
    })
    // skipWaiting YOK — yeni SW beklemeye geçer,
    // kullanıcı "YENİLE" butonuna basınca devreye girer
  );
});

// ── Aktivasyon: eski önbellekleri temizle ──
self.addEventListener('activate', event => {
  console.log('[SW] Aktif — yeni versiyon devreye girdi:', CACHE_NAME);
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
    // clients.claim() → açık sekmeleri yeni SW'ye bağlar
    // Böylece controllerchange eventi tetiklenir → sayfa yenilenir
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
        fetch(event.request)
          .then(response => {
            if (response && response.status === 200) {
              caches.open(CACHE_NAME).then(cache =>
                cache.put(event.request, response.clone())
              );
            }
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

// ── Güncelleme mesajı: yeni SW devreye girince tüm sekmelere haber ver ──
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    // Kullanıcı "YENİLE" butonuna bastı → yeni SW'yi hemen devreye al
    self.skipWaiting();
  }
});
