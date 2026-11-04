// --- SERVICE WORKER UNTUK MODUS OFFLINE OPTIMAL CREATORDOCK VIEWFINDER ---

const CACHE_NAME = 'creatordock-viewfinder-v2';

// Daftar seluruh aset statis inti yang wajib disimpan di memori lokal ponsel/tablet
const ASSETS_TO_CACHE = [
    '/',
    '/index.html',
    '/main-viewfinder.js', // PENTING: Menyimpan engine JS agar offline
    '/manifest.json',
    '/icon-192.png',
    '/icon-512.png'
];

// 1. Fase Tahap Pemasangan (Installation Phase)
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('SW Engine: Mengamankan aset statis ke dalam penyimpanan lokal...');
                return cache.addAll(ASSETS_TO_CACHE);
            })
            .then(() => self.skipWaiting()) 
    );
});

// 2. Fase Aktivasi (Activation Phase)
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cache) => {
                    if (cache !== CACHE_NAME) {
                        console.log('SW Engine: Menghapus cache usang versi lama...', cache);
                        return caches.delete(cache);
                    }
                })
            );
        }).then(() => self.clients.claim()) 
    );
});

// 3. Fase Pengambilan Data (Fetch Interception - Strategi Cache-First)
self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;

    event.respondWith(
        caches.match(event.request)
            .then((cachedResponse) => {
                if (cachedResponse) {
                    return cachedResponse;
                }
                return fetch(event.request).then((networkResponse) => {
                    if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
                        return networkResponse;
                    }
                    const responseToCache = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseToCache);
                    });
                    return networkResponse;
                });
            }).catch(() => {
                console.error('SW Engine: Perangkat offline dan aset tidak ditemukan di penyimpanan lokal.');
            })
    );
});
