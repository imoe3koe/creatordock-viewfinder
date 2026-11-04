// --- SERVICE WORKER UNTUK MODUS OFFLINE OPTIMAL CREATORDOCK VIEWFINDER ---

const CACHE_NAME = 'creatordock-viewfinder-v1';

// Daftar seluruh aset statis inti yang wajib disimpan di memori lokal ponsel/tablet
const ASSETS_TO_CACHE = [
    '/',
    '/index.html',
    '/manifest.json',
    '/icon-192.png',
    '/icon-512.png'
    // Tambahkan path berkas .js atau .css terpisah Anda di sini jika ada (misal: '/app.js')
];

// 1. Fase Tahap Pemasangan (Installation Phase)
// Service worker mendownload dan mengunci semua aset penting ke dalam penyimpanan cache lokal browser.
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('SW Engine: Mengamankan aset statis ke dalam penyimpanan lokal...');
                return cache.addAll(ASSETS_TO_CACHE);
            })
            .then(() => self.skipWaiting()) // Memaksa SW baru langsung aktif tanpa menunggu tab browser di-refresh
    );
});

// 2. Fase Aktivasi (Activation Phase)
// Membersihkan cache versi lama jika Anda melakukan pembaruan fitur di masa mendatang agar memori HP tidak penuh.
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
        }).then(() => self.clients.claim()) // Langsung mengontrol seluruh halaman web aktif secara instan
    );
});

// 3. Fase Pengambilan Data (Fetch Interception - Strategi Cache-First)
// Ketika sutradara membuka aplikasi di lapangan, browser akan langsung membaca memori HP, bukan internet.
self.addEventListener('fetch', (event) => {
    // Abaikan permintaan POST (seperti pengiriman data ke server API) karena POST tidak bisa di-cache
    if (event.request.method !== 'GET') return;

    event.respondWith(
        caches.match(event.request)
            .then((cachedResponse) => {
                // Jika berkas ditemukan di memori lokal, langsung berikan ke pengguna secara instan
                if (cachedResponse) {
                    return cachedResponse;
                }

                // Jika berkas belum ada di cache (misal akses fitur eksternal baru), ambil lewat jaringan internet
                return fetch(event.request).then((networkResponse) => {
                    // Pastikan respons valid sebelum menyimpannya ke cache dinamis
                    if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
                        return networkResponse;
                    }

                    // Gandakan respons untuk disimpan ke cache agar pembukaan kedua kalinya menjadi offline
                    const responseToCache = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseToCache);
                    });

                    return networkResponse;
                });
            }).catch(() => {
                // Cadangan darurat jika internet mati total dan berkas yang dicari tidak ada di cache
                console.error('SW Engine: Perangkat offline dan aset tidak ditemukan di penyimpanan lokal.');
            })
    );
});