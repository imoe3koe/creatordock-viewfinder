/**
 * CREATORDOCK VIEWFINDER - PRO ENGINE v2.0
 * Dioptimalkan untuk stabilitas iOS/Android & Fitur Broadcast Profesional
 */

// =========================================================================
// BAGIAN 1: STATE MANAGEMENT & INISIALISASI KAMERA
// =========================================================================
window.targetCamera = { brand: "ARRI", model: "Alexa 35", sensorWidth: 27.99, sensorHeight: 19.22 };
window.activeLens = 35;       
window.targetAspectRatio = 2.39; 
window.showRuleOfThirds = true;

const baseHPCamera = { equivalentFocalLength: 24, fullFrameWidth: 36.00 };
let streamVideo = null;
let previewCanvas = null;
let ctx = null;
let animationFrameId;

// Variabel untuk Level Horizon (Gyroscope)
let currentBeta = 0; // Kemiringan depan-belakang
let currentGamma = 0; // Kemiringan kiri-kanan

async function initCamera() {
    streamVideo = document.getElementById('rawVideo');
    previewCanvas = document.getElementById('viewfinderCanvas');
    if(!streamVideo || !previewCanvas) return; 
    ctx = previewCanvas.getContext('2d', { alpha: false });

    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
            audio: false
        });
        streamVideo.srcObject = stream;
        
        // FIX BLACK SCREEN: Menunggu video siap diputar secara eksplisit
        await streamVideo.play();
        
        setupCanvasDimensions();
        startLiveViewRendering();
        initGyroscope();
        getUserCurrentLocation();

    } catch (err) {
        console.warn("Kamera belakang gagal. Beralih ke kamera default...", err);
        fallbackCamera();
    }
}

async function fallbackCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        streamVideo.srcObject = stream;
        await streamVideo.play();
        setupCanvasDimensions();
        startLiveViewRendering();
    } catch (e) {
        if(ctx && previewCanvas) {
            ctx.fillStyle = "#020617"; ctx.fillRect(0, 0, previewCanvas.width, previewCanvas.height);
            ctx.fillStyle = "#ef4444"; ctx.font = "16px sans-serif"; ctx.textAlign = "center";
            ctx.fillText("Izin Kamera Ditolak / Tidak Ditemukan.", previewCanvas.width/2, previewCanvas.height/2);
        }
    }
}

function setupCanvasDimensions() {
    const container = document.querySelector('.viewfinder-container');
    if(!container || !previewCanvas) return;
    previewCanvas.width = container.clientWidth * window.devicePixelRatio;
    previewCanvas.height = container.clientHeight * window.devicePixelRatio;
}

// Fungsi mengaktifkan sensor Gyroscope HP untuk Level Horizon
function initGyroscope() {
    if (window.DeviceOrientationEvent) {
        window.addEventListener('deviceorientation', (event) => {
            // Beta (x-axis): -180 to 180 (depan belakang)
            // Gamma (y-axis): -90 to 90 (kiri kanan)
            if (event.beta !== null && event.gamma !== null) {
                currentBeta = event.beta;
                currentGamma = event.gamma;
            }
        });
    }
}

function startLiveViewRendering() {
    if (animationFrameId) cancelAnimationFrame(animationFrameId);
    
    function renderFrame() {
        if (streamVideo && streamVideo.readyState === streamVideo.HAVE_CURRENT_DATA) {
            ctx.fillStyle = "#020617";
            ctx.fillRect(0, 0, previewCanvas.width, previewCanvas.height);

            const targetAoV = 2 * Math.atan(window.targetCamera.sensorWidth / (2 * window.activeLens));
            const hpAoV = 2 * Math.atan(baseHPCamera.fullFrameWidth / (2 * baseHPCamera.equivalentFocalLength));
            const cropRatio = hpAoV / targetAoV;

            const videoW = streamVideo.videoWidth; const videoH = streamVideo.videoHeight;
            let srcW = videoW / cropRatio; let srcH = videoH / cropRatio;
            if (srcW > videoW) { srcW = videoW; srcH = videoH; }
            const srcX = (videoW - srcW) / 2; const srcY = (videoH - srcH) / 2;

            const canvasW = previewCanvas.width; const canvasH = previewCanvas.height;
            let destW = canvasW; let destH = canvasW / window.targetAspectRatio;
            if (destH > canvasH) { destH = canvasH; destW = canvasH * window.targetAspectRatio; }

            const destX = (canvasW - destW) / 2; const destY = (canvasH - destH) / 2;

            // Render Gambar Utama
            ctx.drawImage(streamVideo, srcX, srcY, srcW, srcH, destX, destY, destW, destH);

            // --- FITUR PROFESIONAL: LEVEL HORIZON (WATERPASS) ---
            // Hanya tampil jika HP dalam posisi landscape (gamma > 45 atau < -45)
            if (Math.abs(currentGamma) > 45) {
                // Menghitung sudut kemiringan (roll)
                let angle = currentGamma;
                if (currentGamma > 90) angle = 90;
                if (currentGamma < -90) angle = -90;

                // Menggambar garis level di tengah layar
                ctx.save();
                ctx.translate(canvasW / 2, canvasH / 2);
                // Rotasi berdasarkan sudut HP (dikonversi ke radian)
                ctx.rotate((angle * Math.PI) / 180);

                // Jika sudut mendekati 0 (datar), warna HIJAU, jika miring, warna PUTIH
                const isLevel = Math.abs(angle) < 1.5; 
                ctx.strokeStyle = isLevel ? "#22c55e" : "rgba(255, 255, 255, 0.8)";
                ctx.lineWidth = Math.max(2, 3 * window.devicePixelRatio);
                
                ctx.beginPath();
                ctx.moveTo(-destW / 4, 0); ctx.lineTo(destW / 4, 0);
                ctx.stroke();
                ctx.restore();
            }

            // --- FITUR PROFESIONAL: RULE OF THIRDS ---
            if (window.showRuleOfThirds) {
                ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
                ctx.lineWidth = Math.max(1, 2 * window.devicePixelRatio);
                ctx.beginPath();
                ctx.moveTo(destX + destW / 3, destY); ctx.lineTo(destX + destW / 3, destY + destH);
                ctx.moveTo(destX + (destW / 3) * 2, destY); ctx.lineTo(destX + (destW / 3) * 2, destY + destH);
                ctx.moveTo(destX, destY + destH / 3); ctx.lineTo(destX + destW, destY + destH / 3);
                ctx.moveTo(destX, destY + (destH / 3) * 2); ctx.lineTo(destX + destW, destY + (destH / 3) * 2);
                ctx.stroke();
            }

            // --- FITUR PROFESIONAL: CENTER CROSSHAIR & SAFE AREA ---
            // Center Crosshair
            ctx.strokeStyle = "rgba(255, 255, 255, 0.7)";
            ctx.lineWidth = Math.max(1, 2 * window.devicePixelRatio);
            const cx = destX + destW / 2; const cy = destY + destH / 2;
            const crossSize = 15 * window.devicePixelRatio;
            ctx.beginPath();
            ctx.moveTo(cx - crossSize, cy); ctx.lineTo(cx + crossSize, cy);
            ctx.moveTo(cx, cy - crossSize); ctx.lineTo(cx, cy + crossSize);
            ctx.stroke();

            // Safe Area (90%)
            ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
            ctx.setLineDash([10, 10]); // Garis putus-putus
            const safeW = destW * 0.9; const safeH = destH * 0.9;
            const safeX = destX + (destW - safeW) / 2; const safeY = destY + (destH - safeH) / 2;
            ctx.strokeRect(safeX, safeY, safeW, safeH);
            ctx.setLineDash([]); // Reset garis putus-putus

            // Render Letterbox (Bingkai Hitam)
            ctx.fillStyle = "rgba(0, 0, 0, 0.95)";
            ctx.fillRect(0, 0, canvasW, destY);
            ctx.fillRect(0, destY + destH, canvasW, canvasH - (destY + destH));
            ctx.fillRect(0, destY, destX, destH);
            ctx.fillRect(destX + destW, destY, canvasW - (destX + destW), destH);
        }
        animationFrameId = requestAnimationFrame(renderFrame);
    }
    renderFrame();
}

// =========================================================================
// BAGIAN 2: UI INTERACTIONS
// =========================================================================
window.selectCamera = function(name, width, height, el) {
    document.querySelectorAll('.cam-chip').forEach(btn => {
        btn.className = "cam-chip px-4 py-1.5 rounded-full text-[11px] font-bold border border-slate-700 bg-slate-900 text-slate-300 cursor-pointer";
    });
    el.className = "cam-chip active px-4 py-1.5 rounded-full text-[11px] font-bold border border-amber-500 bg-amber-500 text-slate-950 cursor-pointer";
    document.getElementById('camDisplay').innerText = name.toUpperCase();
    window.targetCamera = { brand: name.split(' ')[0], model: name.split(' ').slice(1).join(' '), sensorWidth: width, sensorHeight: height };
};

window.setLens = function(mm, el) {
    document.querySelectorAll('.btn-lens').forEach(btn => {
        btn.className = "btn-lens px-5 py-1.5 rounded-xl text-xs font-semibold bg-slate-800 border border-slate-600 text-slate-100 cursor-pointer";
    });
    el.className = "btn-lens active px-5 py-1.5 rounded-xl text-xs font-semibold bg-amber-500 text-slate-950 border border-amber-400 cursor-pointer";
    window.activeLens = mm;
};

// FIX TOMBOL GRID: Menambahkan parameter 'el' (element) agar bisa berubah warna
window.toggleGrid = function(el) {
    window.showRuleOfThirds = !window.showRuleOfThirds;
    if (window.showRuleOfThirds) {
        el.classList.add('grid-active');
    } else {
        el.classList.remove('grid-active');
    }
};

// =========================================================================
// BAGIAN 3: GPS & CAPTURE PIPELINE
// =========================================================================
function getUserCurrentLocation() {
    return new Promise((resolve) => {
        if (!navigator.geolocation) {
            resolve({ latitude: 0, longitude: 0 }); return;
        }
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const ui = document.getElementById('gpsDisplay');
                if (ui) ui.innerText = `GPS: ${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`;
                resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
            },
            () => {
                const ui = document.getElementById('gpsDisplay');
                if (ui) ui.innerText = "GPS: OFF";
                resolve({ latitude: 0.0, longitude: 0.0 });
            }, { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
        );
    });
}

window.triggerCapture = async function() {
    const loc = await getUserCurrentLocation();
    const latLonText = loc.latitude ? `${loc.latitude.toFixed(4)}, ${loc.longitude.toFixed(4)}` : "GPS Disabled";
    
    const selectedShot = document.getElementById('shotSize').value;
    const activeLensText = window.activeLens + "mm";
    const cameraText = `${window.targetCamera.brand} ${window.targetCamera.model}`;
    
    const outputCanvas = document.createElement('canvas');
    const outCtx = outputCanvas.getContext('2d', { alpha: false });
    const W = 1920; const H = 1080;
    outputCanvas.width = W; outputCanvas.height = H;
    
    let destW = W; let destH = H; let destX = 0; let destY = 0;

    if (streamVideo && streamVideo.videoWidth > 0) {
        let targetAoV = 2 * Math.atan(window.targetCamera.sensorWidth / (2 * window.activeLens));
        const hpAoV = 2 * Math.atan(baseHPCamera.fullFrameWidth / (2 * baseHPCamera.equivalentFocalLength));
        const cropRatio = hpAoV / targetAoV;
        let srcW = streamVideo.videoWidth / cropRatio; let srcH = streamVideo.videoHeight / cropRatio;
        if (srcW > streamVideo.videoWidth) { srcW = streamVideo.videoWidth; srcH = streamVideo.videoHeight; }
        const srcX = (streamVideo.videoWidth - srcW) / 2; const srcY = (streamVideo.videoHeight - srcH) / 2;

        destH = W / window.targetAspectRatio; destX = (W - destW) / 2; destY = (H - destH) / 2;
        outCtx.drawImage(streamVideo, srcX, srcY, srcW, srcH, destX, destY, destW, destH);
    }

    // Letterbox Masking
    outCtx.fillStyle = "#000000";
    outCtx.fillRect(0, 0, W, destY); 
    outCtx.fillRect(0, destY + destH, W, H - (destY + destH)); 

    // Burn-In Metadata Profesional
    const now = new Date();
    const timestamp = now.toLocaleDateString('id-ID') + ' ' + now.toLocaleTimeString('id-ID');
    
    outCtx.fillStyle = "#FFFFFF"; 
    outCtx.font = "bold 28px sans-serif"; 
    outCtx.textBaseline = "middle";
    
    // Baris Atas
    outCtx.textAlign = "left";
    outCtx.fillText(`CAM: ${cameraText.toUpperCase()}`, 40, destY / 2);
    outCtx.textAlign = "right"; 
    outCtx.fillText(`ASPECT: 2.39:1`, W - 40, destY / 2);

    // Baris Bawah
    const footerY = destY + destH + ((H - (destY + destH)) / 2);
    outCtx.textAlign = "left"; 
    outCtx.fillStyle = "#F59E0B"; 
    outCtx.fillText(`LENS: ${activeLensText}`, 40, footerY);
    
    outCtx.fillStyle = "#FFFFFF"; 
    outCtx.fillText(` |  SHOT: ${selectedShot}`, 240, footerY);
    
    outCtx.textAlign = "right"; 
    outCtx.font = "24px sans-serif"; 
    outCtx.fillText(`GPS: ${latLonText}`, W - 40, footerY - 15);
    outCtx.fillText(`TIME: ${timestamp}`, W - 40, footerY + 15);

    try {
        const imageURL = outputCanvas.toDataURL('image/jpeg', 0.90);
        const dlLink = document.createElement('a');
        const ts = now.toISOString().replace(/[:.]/g, "-");
        dlLink.download = `CDView_${selectedShot}_${activeLensText}_${ts}.jpg`;
        dlLink.href = imageURL;
        document.body.appendChild(dlLink); dlLink.click();
        setTimeout(() => document.body.removeChild(dlLink), 100);
    } catch (err) {
        alert("Gagal menyimpan gambar lokal. Periksa izin unduhan browser.");
    }
}

// Inisialisasi Saat Halaman Dimuat
window.addEventListener('DOMContentLoaded', initCamera);
window.addEventListener('resize', setupCanvasDimensions);
