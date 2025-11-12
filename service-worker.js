/**
 * SERVICE WORKER - Cache Management
 * 
 * Bu Service Worker, data dosyalarını cache'ler ve ikinci yüklemede çok hızlı yüklenmesini sağlar.
 * 
 * Cache Stratejisi:
 * - Data dosyaları (.json.gz): Cache First (ilk yüklemede network, sonraki yüklemelerde cache)
 * - HTML/CSS/JS: Network First (her zaman güncel versiyonu kullan)
 * 
 * Cache Versioning:
 * - Cache versiyonu değiştiğinde eski cache'ler temizlenir
 */

const CACHE_NAME = 'zuhal-dashboard-v1';
const DATA_CACHE_NAME = 'zuhal-data-v1';
const CACHE_VERSION = '1.0.0';

// Cache'e eklenecek dosyalar (static assets)
const STATIC_CACHE_FILES = [
    '/',
    '/index.html',
    '/styles.css',
    '/assets/css/main.css',
    '/assets/css/dashboard.css',
    '/assets/css/components.css',
    '/assets/css/modal.css',
    '/assets/css/responsive.css',
    '/assets/css/loading.css'
];

/**
 * Service Worker install event
 * Static dosyaları cache'le
 */
self.addEventListener('install', (event) => {
    console.log('[Service Worker] Installing...');
    
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[Service Worker] Caching static files');
            return cache.addAll(STATIC_CACHE_FILES).catch((error) => {
                console.warn('[Service Worker] Cache addAll hatası (bazı dosyalar eksik olabilir):', error);
                // Bazı dosyalar eksik olsa bile devam et
                return Promise.resolve();
            });
        })
    );
    
    // Service Worker'ı hemen aktif et (skipWaiting)
    self.skipWaiting();
});

/**
 * Service Worker activate event
 * Eski cache'leri temizle
 */
self.addEventListener('activate', (event) => {
    console.log('[Service Worker] Activating...');
    
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    // Eski cache'leri temizle (versiyon değiştiyse)
                    if (cacheName !== CACHE_NAME && cacheName !== DATA_CACHE_NAME) {
                        console.log('[Service Worker] Eski cache temizleniyor:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    
    // Tüm client'ları kontrol et (claim)
    self.clients.claim();
});

/**
 * Service Worker fetch event
 * Cache stratejisini uygula
 */
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);
    
    // Data dosyaları için Cache First stratejisi
    if (url.pathname.includes('.json.gz') || url.pathname.includes('data-') || url.pathname.includes('inventory.json') || url.pathname.includes('payments.json')) {
        event.respondWith(
            caches.open(DATA_CACHE_NAME).then((cache) => {
                return cache.match(event.request).then((cachedResponse) => {
                    // Cache'de varsa cache'den döndür
                    if (cachedResponse) {
                        console.log('[Service Worker] Data cache hit:', url.pathname);
                        return cachedResponse;
                    }
                    
                    // Cache'de yoksa network'ten yükle ve cache'le
                    return fetch(event.request).then((fetchResponse) => {
                        // Sadece başarılı response'ları cache'le
                        if (fetchResponse && fetchResponse.status === 200) {
                            const responseClone = fetchResponse.clone();
                            cache.put(event.request, responseClone);
                            console.log('[Service Worker] Data cache miss, cached:', url.pathname);
                        }
                        return fetchResponse;
                    }).catch((error) => {
                        console.error('[Service Worker] Fetch hatası:', error);
                        throw error;
                    });
                });
            })
        );
        return;
    }
    
    // HTML/CSS/JS için Network First stratejisi
    if (url.pathname.endsWith('.html') || url.pathname.endsWith('.css') || url.pathname.endsWith('.js')) {
        event.respondWith(
            fetch(event.request).then((fetchResponse) => {
                // Network'ten başarıyla yüklendi, cache'le
                if (fetchResponse && fetchResponse.status === 200) {
                    const responseClone = fetchResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseClone);
                    });
                }
                return fetchResponse;
            }).catch(() => {
                // Network hatası, cache'den döndür
                return caches.match(event.request).then((cachedResponse) => {
                    if (cachedResponse) {
                        console.log('[Service Worker] Cache fallback:', url.pathname);
                        return cachedResponse;
                    }
                    // Cache'de de yoksa hata döndür
                    throw new Error('Network ve cache hatası');
                });
            })
        );
        return;
    }
    
    // Diğer istekler için normal fetch
    event.respondWith(fetch(event.request));
});

/**
 * Message handler - Cache temizleme için
 */
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'CLEAR_CACHE') {
        console.log('[Service Worker] Cache temizleniyor...');
        caches.delete(CACHE_NAME).then(() => {
            console.log('[Service Worker] Static cache temizlendi');
        });
        caches.delete(DATA_CACHE_NAME).then(() => {
            console.log('[Service Worker] Data cache temizlendi');
        });
    }
    
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

console.log('[Service Worker] Service Worker yüklendi, versiyon:', CACHE_VERSION);

