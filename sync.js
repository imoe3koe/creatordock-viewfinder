// --- KODE BAGIAN 3: MODUL SINKRONISASI METADATA & DATA PIPELINE ---

// 1. Fungsi Utama Pemicu Tangkapan Kamera & Pengiriman Data
async function triggerCapture() {
    console.log("Memulai proses pembekuan gambar dan kompilasi metadata...");
    
    // Ubah status visual tombol shutter agar pengguna tahu proses sedang berjalan
    const shutterBtn = document.querySelector('.btn-capture');
    shutterBtn.style.background = "#FF6B6B"; // Efek warna merah saat memproses

    try {
        // A. AMBIL KOORDINAT LOKASI (GPS GEOLOCATION)
        const locationData = await getUserCurrentLocation();

        // B. EKSTRAKSI GAMBAR BINGKAI DARI CANVAS
        // Mengubah gambar canvas yang sudah di-crop menjadi format Base64 (JPEG)
        const canvasElement = document.getElementById('viewfinderCanvas');
        const capturedImageBase64 = canvasElement.toDataURL('image/jpeg', 0.85); // Kualitas 85% kompresi seimbang

        // C. BACA PARAMETER KREATIF DARI ELEMEN UI
        const selectedShotSize = document.getElementById('shotSize').value;
        const activeLensMM = activeLens + "mm";
        const simulatedCamProfile = `${targetCamera.brand} ${targetCamera.model}`;

        // D. KEMAS SELURUH DATA MENJADI SCHEMATIC JSON PINTAR
        const payloadData = {
            project_id: "DOCUSTORY_PROJ_ACTIVE", // Dapat dihubungkan dengan ID Proyek dinamis Anda
            panel_metadata: {
                simulated_camera: simulatedCamProfile,
                focal_length: activeLensMM,
                aspect_ratio: targetAspectRatio === 2.39 ? "2.39:1" : "16:9",
                shot_size: selectedShotSize,
                composition_rule: showRuleOfThirds ? "Rule of Thirds" : "Custom/None",
                captured_at: new Date().toISOString()
            },
            location: {
                latitude: locationData.latitude,
                longitude: locationData.longitude,
                accuracy_meters: locationData.accuracy
            },
            image_data: capturedImageBase64
        };

        // E. KIRIM DATA KE API ENDPOINT DOCUSTORY-PRO
     async function sendDataToDocustoryPro(jsonData) {
    const apiEndpoint = "https://creatordock.online/api/viewfinder-sync";

    // Cek koneksi internet browser
    if (!navigator.onLine) {
        console.warn("Offline mode: Menyimpan shot data ke LocalStorage.");
        saveToLocalOfflineQueue(jsonData);
        return { status: 'queued_offline' };
    }

    try {
        const response = await fetch(apiEndpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(jsonData)
        });

        if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
        return await response.json();
    } catch (error) {
        console.error("Gagal sinkronisasi server, menyimpan ke antrean lokal: ", error);
        saveToLocalOfflineQueue(jsonData);
        throw error;
    }
}

// Handler Antrean Offline
function saveToLocalOfflineQueue(data) {
    let queue = JSON.parse(localStorage.getItem('cd_viewfinder_queue')) || [];
    queue.push(data);
    localStorage.setItem('cd_viewfinder_queue', JSON.stringify(queue));
    alert("Koneksi gagal. Shot berhasil diamankan ke memori internal ponsel.");
}

// 2. Fungsi Pembantu untuk Mendapatkan Koordinat GPS yang Akurat
function getUserCurrentLocation() {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            // Jika browser jadul tidak mendukung GPS, kirim data kosong agar aplikasi tidak mogok
            resolve({ latitude: null, longitude: null, accuracy: null });
        }

        const geoOptions = {
            enableHighAccuracy: true, // Memaksa HP menyalakan GPS hardware demi akurasi lokasi syuting
            timeout: 7000,            // Batas waktu tunggu pencarian lokasi (7 detik)
            maximumAge: 0
        };

        navigator.geolocation.getCurrentPosition(
            (position) => {
                resolve({
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                    accuracy: position.coords.accuracy
                });
            },
            (error) => {
                console.warn("Gagal mendapatkan koordinat GPS akurat: ", error.message);
                // Tetap teruskan proses meskipun GPS diblokir, demi kelancaran hunting
                resolve({ latitude: 0.0, longitude: 0.0, accuracy: 0 });
            },
            geoOptions
        );
    });
}

// 3. Fungsi Komunikasi HTTP Network (Koneksi ke Back-End Website Anda)
async function sendDataToDocustoryPro(jsonData) {
    // Alamat URL API back-end Docustory-Pro / CreatorDock Anda
    const apiEndpoint = "https://creatordock.online";

    const response = await fetch(apiEndpoint, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer TOKEN_AKSES_USER_ANDA" // Autentikasi sesi user login
        },
        body: JSON.stringify(jsonData)
    });

    if (!response.ok) {
        const errorResponse = await response.json().catch(() => ({}));
        throw new Error(errorResponse.message || `HTTP server error status: ${response.status}`);
    }

    return await response.json();

    