// --- KODE BAGIAN 3B: MODUL SINKRONISASI METADATA & DATA PIPELINE OFFLINE ---

async function triggerCapture() {
    console.log("Memproses pembekuan gambar...");
    const shutterBtn = document.querySelector('.btn-capture');
    if (shutterBtn) shutterBtn.style.transform = "scale(0.9)"; 

    try {
        const locationData = await getUserCurrentLocation();
        
        // Panggil rendering image (dari local-render.js)
        if(typeof captureAndSaveToLocal === 'function') {
            await captureAndSaveToLocal();
        }

        const shotSelect = document.getElementById('shotSize');
        const selectedShotSize = shotSelect ? shotSelect.value : "MCU";
        const activeLensMM = (window.activeLens || 35) + "mm";
        const simulatedCamProfile = window.targetCamera ? `${window.targetCamera.brand} ${window.targetCamera.model}` : "Default Camera";
        const currentAspect = window.targetAspectRatio || 2.39;
        const isGridOn = window.showRuleOfThirds || false;

        const payloadData = {
            project_id: "DOCUSTORY_PROJ_ACTIVE",
            panel_metadata: {
                simulated_camera: simulatedCamProfile,
                focal_length: activeLensMM,
                aspect_ratio: currentAspect === 2.39 ? "2.39:1" : "16:9",
                shot_size: selectedShotSize,
                composition_rule: isGridOn ? "Rule of Thirds" : "None",
                captured_at: new Date().toISOString()
            },
            location: {
                latitude: locationData.latitude,
                longitude: locationData.longitude,
                accuracy_meters: locationData.accuracy
            }
        };

        // Otomatis amankan metadata ke Queue Lokal karena offline-first
        saveToLocalOfflineQueue(payloadData);

    } catch (error) {
        console.error("Gagal mengambil data bidikan:", error);
    } finally {
        if (shutterBtn) {
            setTimeout(() => { shutterBtn.style.transform = "scale(1)"; }, 150);
        }
    }
}

function getUserCurrentLocation() {
    return new Promise((resolve) => {
        if (!navigator.geolocation) {
            resolve({ latitude: null, longitude: null, accuracy: null });
            return;
        }
        const geoOptions = { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 };
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const gpsUI = document.getElementById('gpsDisplay');
                if (gpsUI) gpsUI.innerText = `GPS: ${position.coords.latitude.toFixed(4)}, ${position.coords.longitude.toFixed(4)}`;
                resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude, accuracy: position.coords.accuracy });
            },
            () => {
                const gpsUI = document.getElementById('gpsDisplay');
                if (gpsUI) gpsUI.innerText = "GPS: OFF";
                resolve({ latitude: 0.0, longitude: 0.0, accuracy: 0 });
            }, geoOptions
        );
    });
}

function saveToLocalOfflineQueue(data) {
    try {
        let queue = JSON.parse(localStorage.getItem('cd_viewfinder_queue')) || [];
        queue.push(data);
        localStorage.setItem('cd_viewfinder_queue', JSON.stringify(queue));
    } catch (e) {
        console.warn("LocalStorage penuh/diblokir.");
    }
}

// Jadikan triggerCapture dapat diakses global oleh HTML (Tombol Shutter)
window.triggerCapture = triggerCapture;
