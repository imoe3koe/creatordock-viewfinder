// --- KODE BAGIAN 3B: MODUL SINKRONISASI METADATA & DATA PIPELINE OFFLINE ---

// 1. Fungsi Utama Pemicu Tangkapan Kamera & Pengiriman Data
async function triggerCapture() {
    console.log("Memulai proses pembekuan gambar dan kompilasi metadata...");
    
    const shutterBtn = document.querySelector('.btn-capture');
    if (shutterBtn) shutterBtn.style.transform = "scale(0.9)"; // Efek visual saat ditekan

    try {
        // A. Ambil Data Koordinat
        const locationData = await getUserCurrentLocation();
        
        // B. Picu Rendering Gambar ke Folder Lokal Ponsel (Dari local-render.js)
        // Pemanggilan dilakukan secara asynchronous agar proses UI tidak terhenti
        await captureAndSaveToLocal();

        // C. Kumpulkan Data Teknis Lensa
        const selectedShotSize = document.getElementById('shotSize') ? document.getElementById('shotSize').value : "MCU";
        const activeLensMM = (typeof activeLens !== 'undefined' ? activeLens : 35) + "mm";
        const simulatedCamProfile = typeof targetCamera !== 'undefined' ? `${targetCamera.brand} ${targetCamera.model}` : "Default Camera";
        const currentAspect = typeof targetAspectRatio !== 'undefined' ? targetAspectRatio : 2.39;
        const isGridOn = typeof showRuleOfThirds !== 'undefined' ? showRuleOfThirds : false;

        // D. KEMAS SELURUH DATA MENJADI SCHEMATIC JSON
        const payloadData = {
            project_id: "DOCUSTORY_PROJ_ACTIVE",
            panel_metadata: {
                simulated_camera: simulatedCamProfile,
                focal_length: activeLensMM,
                aspect_ratio: currentAspect === 2.39 ? "2.39:1" : "16:9",
                shot_size: selectedShotSize,
                composition_rule: isGridOn ? "Rule of Thirds" : "Custom/None",
                captured_at: new Date().toISOString()
            },
            location: {
                latitude: locationData.latitude,
                longitude: locationData.longitude,
                accuracy_meters: locationData.accuracy
            }
        };

        // E. AMANKAN METADATA KE ANTRIAN MEMORI OFFLINE (LOCALSTORAGE)
        saveToLocalOfflineQueue(payloadData);

    } catch (error) {
        console.error("Proses pengambilan data lapangan gagal: ", error);
        alert("Terjadi kesalahan saat memproses gambar: " + error.message);
    } finally {
        if (shutterBtn) {
            setTimeout(() => { shutterBtn.style.transform = "scale(1)"; }, 200);
        }
    }
}

// 2. Fungsi Pembantu untuk Koordinat GPS
function getUserCurrentLocation() {
    return new Promise((resolve) => {
        if (!navigator.geolocation) {
            resolve({ latitude: null, longitude: null, accuracy: null });
            return;
        }

        const geoOptions = { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 };

        navigator.geolocation.getCurrentPosition(
            (position) => {
                // Update tampilan UI jika fungsi dipanggil dan berhasil
                const gpsUI = document.getElementById('gpsDisplay');
                if (gpsUI) gpsUI.innerText = `GPS: ${position.coords.latitude.toFixed(4)}, ${position.coords.longitude.toFixed(4)}`;
                
                resolve({
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                    accuracy: position.coords.accuracy
                });
            },
            (error) => {
                console.warn("Gagal / Ditolak akses GPS: ", error.message);
                const gpsUI = document.getElementById('gpsDisplay');
                if (gpsUI) gpsUI.innerText = "GPS: OFF";
                resolve({ latitude: 0.0, longitude: 0.0, accuracy: 0 });
            },
            geoOptions
        );
    });
}

// 3. Handler Antrean Offline (Offline-First Pipeline)
function saveToLocalOfflineQueue(data) {
    try {
        let queue = JSON.parse(localStorage.getItem('cd_viewfinder_queue')) || [];
        queue.push(data);
        localStorage.setItem('cd_viewfinder_queue', JSON.stringify(queue));
        console.log("Metadata bidikan berhasil diamankan secara lokal ke browser.");
    } catch (e) {
        console.warn("LocalStorage penuh atau di blokir oleh mode samaran browser.");
    }
}
