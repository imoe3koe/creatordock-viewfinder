/**
 * CREATORDOCK VIEWFINDER - MAIN CORE ENGINE
 * Gabungan dari app.js, local-render.js, dan sync.js (Bebas Konflik Variabel)
 */

// =========================================================================
// BAGIAN 1: STATE MANAGEMENT & INISIALISASI KAMERA (Eks. app.js)
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
        streamVideo.addEventListener('loadedmetadata', () => {
            streamVideo.play();
            setupCanvasDimensions();
            startLiveViewRendering();
        });
    } catch (err) {
        console.warn("Kamera belakang gagal. Akses kamera sekunder...", err);
        fallbackCamera();
    }
}

async function fallbackCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        streamVideo.srcObject = stream;
        streamVideo.addEventListener('loadedmetadata', () => {
            streamVideo.play();
            setupCanvasDimensions();
            startLiveViewRendering();
        });
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

function startLiveViewRendering() {
    if (animationFrameId) cancelAnimationFrame(animationFrameId);
    
    function renderFrame() {
        if (streamVideo.readyState === streamVideo.HAVE_CURRENT_DATA) {
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

            // Render Garis Komposisi
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

            // Render Letterbox
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

window.toggleGrid = function() { window.showRuleOfThirds = !window.showRuleOfThirds; }
window.addEventListener('DOMContentLoaded', initCamera);
window.addEventListener('resize', setupCanvasDimensions);


// =========================================================================
// BAGIAN 2: EXPORT GAMBAR RESOLUSI TINGGI (Eks. local-render.js)
// =========================================================================
async function captureAndSaveToLocal(locationData) {
    const latLonText = locationData.latitude ? `${locationData.latitude.toFixed(4)}, ${locationData.longitude.toFixed(4)}` : "GPS OFF";
    const selectedShot = document.getElementById('shotSize') ? document.getElementById('shotSize').value : "MCU";
    const activeLensText = window.activeLens + "mm";
    const cameraText = `${window.targetCamera.brand} ${window.targetCamera.model}`;
    const currentAspect = window.targetAspectRatio;
    const isGridOn = window.showRuleOfThirds;
    
    const outputCanvas = document.createElement('canvas');
    const outCtx = outputCanvas.getContext('2d', { alpha: false });
    const W = 1920; const H = 1080;
    outputCanvas.width = W; outputCanvas.height = H;
    
    let destW = W; let destH = H; let destX = 0; let destY = 0;

    if (streamVideo && streamVideo.videoWidth > 0) {
        const videoW = streamVideo.videoWidth; const videoH = streamVideo.videoHeight;
        let targetAoV = 2 * Math.atan(window.targetCamera.sensorWidth / (2 * window.activeLens));
        const hpAoV = 2 * Math.atan(36.00 / (2 * 24)); 
        const cropRatio = hpAoV / targetAoV;

        let srcW = videoW / cropRatio; let srcH = videoH / cropRatio;
        if (srcW > videoW) { srcW = videoW; srcH = videoH; }
        const srcX = (videoW - srcW) / 2; const srcY = (videoH - srcH) / 2;

        destH = W / currentAspect; destX = (W - destW) / 2; destY = (H - destH) / 2;
        outCtx.drawImage(streamVideo, srcX, srcY, srcW, srcH, destX, destY, destW, destH);
    } else {
        outCtx.fillStyle = "#1e293b"; outCtx.fillRect(0,0,W,H);
    }

    outCtx.fillStyle = "#000000";
    outCtx.fillRect(0, 0, W, destY); 
    outCtx.fillRect(0, destY + destH, W, H - (destY + destH)); 

    if (isGridOn) {
        outCtx.strokeStyle = "rgba(255, 255, 255, 0.4)"; outCtx.lineWidth = 3; 
        outCtx.beginPath();
        outCtx.moveTo(destX + destW / 3, destY); outCtx.lineTo(destX + destW / 3, destY + destH);
        outCtx.moveTo(destX + (destW / 3) * 2, destY); outCtx.lineTo(destX + (destW / 3) * 2, destY + destH);
        outCtx.moveTo(destX, destY + destH / 3); outCtx.lineTo(destX + destW, destY + destH / 3);
        outCtx.moveTo(destX, destY + (destH / 3) * 2); outCtx.lineTo(destX + destW, destY + (destH / 3) * 2);
        outCtx.stroke();
    }

    // Teks Burn-In
    outCtx.fillStyle = "#FFFFFF"; outCtx.font = "bold 28px sans-serif"; outCtx.textBaseline = "middle";
    outCtx.fillText(`CAM: ${cameraText.toUpperCase()}`, 40, destY / 2);
    outCtx.textAlign = "right"; outCtx.fillText(`ASPECT: ${currentAspect === 2.39 ? "2.39:1" : "16:9"}`, W - 40, destY / 2);

    const footerY = destY + destH + ((H - (destY + destH)) / 2);
    outCtx.textAlign = "left"; outCtx.fillStyle = "#F59E0B"; 
    outCtx.fillText(`LENS: ${activeLensText}`, 40, footerY);
    outCtx.fillStyle = "#FFFFFF"; outCtx.fillText(` |  SHOT: ${selectedShot}`, 240, footerY);
    outCtx.textAlign = "right"; outCtx.font = "24px sans-serif"; outCtx.fillText(`GPS: ${latLonText}`, W - 40, footerY);

    try {
        const imageURL = outputCanvas.toDataURL('image/jpeg', 0.90);
        const dlLink = document.createElement('a');
        const ts = new Date().toISOString().replace(/[:.]/g, "-");
        dlLink.download = `CDView_${selectedShot}_${activeLensText}_${ts}.jpg`;
        dlLink.href = imageURL;
        document.body.appendChild(dlLink); dlLink.click();
        setTimeout(() => document.body.removeChild(dlLink), 100);
    } catch (err) {
        alert("Gagal menyimpan gambar lokal. Periksa izin browser.");
    }
}


// =========================================================================
// BAGIAN 3: PIPELINE SINKRONISASI (Eks. sync.js)
// =========================================================================
function getUserCurrentLocation() {
    return new Promise((resolve) => {
        if (!navigator.geolocation) {
            resolve({ latitude: null, longitude: null, accuracy: null }); return;
        }
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const ui = document.getElementById('gpsDisplay');
                if (ui) ui.innerText = `GPS: ${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`;
                resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude, accuracy: pos.coords.accuracy });
            },
            () => {
                const ui = document.getElementById('gpsDisplay');
                if (ui) ui.innerText = "GPS: OFF";
                resolve({ latitude: 0.0, longitude: 0.0, accuracy: 0 });
            }, { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
        );
    });
}

window.triggerCapture = async function() {
    const btn = document.querySelector('.btn-capture');
    if (btn) btn.style.transform = "scale(0.85)"; 

    try {
        const loc = await getUserCurrentLocation();
        await captureAndSaveToLocal(loc);

        // Amankan Metadata ke Offline Queue Browser
        const payloadData = {
            simulated_camera: `${window.targetCamera.brand} ${window.targetCamera.model}`,
            focal_length: window.activeLens + "mm",
            shot_size: document.getElementById('shotSize') ? document.getElementById('shotSize').value : "MCU",
            captured_at: new Date().toISOString()
        };

        let queue = JSON.parse(localStorage.getItem('cd_viewfinder_queue')) || [];
        queue.push(payloadData);
        localStorage.setItem('cd_viewfinder_queue', JSON.stringify(queue));

    } catch (error) {
        console.error("Gagal memproses gambar:", error);
    } finally {
        if (btn) setTimeout(() => { btn.style.transform = "scale(1)"; }, 150);
    }
}
