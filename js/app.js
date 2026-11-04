// --- KODE BAGIAN 2: MESIN PENGGERAK VIEW FINDER & KALIBRASI SENSOR ---

// 1. Definisikan Data Kamera Bioskop Target ke Objek Jendela Global
window.targetCamera = {
    brand: "ARRI",
    model: "Alexa 35",
    sensorWidth: 27.99,  
    sensorHeight: 19.22  
};

const baseHPCamera = {
    equivalentFocalLength: 24, 
    fullFrameWidth: 36.00      
};

// Variabel Global Esensial
window.activeLens = 35;       
window.targetAspectRatio = 2.39; 
window.showRuleOfThirds = true;

let streamVideo = null;
let previewCanvas = null;
let ctx = null;
let animationFrameId;

// 4. Inisialisasi Akses Kamera
async function initCamera() {
    streamVideo = document.getElementById('rawVideo');
    previewCanvas = document.getElementById('viewfinderCanvas');
    
    if(!streamVideo || !previewCanvas) return; // Cegah error jika elemen HTML belum ter-load
    ctx = previewCanvas.getContext('2d', { alpha: false });

    const mobileConstraints = {
        video: {
            facingMode: { ideal: "environment" }, // Gunakan ideal agar tidak langsung crash jika ditolak
            width: { ideal: 1920 },
            height: { ideal: 1080 }
        },
        audio: false
    };

    try {
        const stream = await navigator.mediaDevices.getUserMedia(mobileConstraints);
        streamVideo.srcObject = stream;
        streamVideo.addEventListener('loadedmetadata', () => {
            streamVideo.play();
            setupCanvasDimensions();
            startLiveViewRendering();
        });
    } catch (err) {
        console.warn("Kamera utama gagal. Mengakses webcam default.", err);
        fallbackCamera();
    }
}

async function fallbackCamera() {
    try {
        const pcConstraints = { video: { width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false };
        const stream = await navigator.mediaDevices.getUserMedia(pcConstraints);
        streamVideo.srcObject = stream;
        streamVideo.addEventListener('loadedmetadata', () => {
            streamVideo.play();
            setupCanvasDimensions();
            startLiveViewRendering();
        });
    } catch (e) {
        console.error("Izin Kamera Ditolak.", e);
        if(ctx && previewCanvas) {
            ctx.fillStyle = "#020617";
            ctx.fillRect(0, 0, previewCanvas.width, previewCanvas.height);
            ctx.fillStyle = "#ef4444";
            ctx.font = "16px sans-serif";
            ctx.textAlign = "center";
            ctx.fillText("Izin Kamera Diperlukan.", previewCanvas.width/2, previewCanvas.height/2);
        }
    }
}

function setupCanvasDimensions() {
    const container = document.querySelector('.viewfinder-container');
    if(!container || !previewCanvas) return;
    
    previewCanvas.width = container.clientWidth * window.devicePixelRatio;
    previewCanvas.height = container.clientHeight * window.devicePixelRatio;
}

// Render Utama
function startLiveViewRendering() {
    if (animationFrameId) cancelAnimationFrame(animationFrameId);
    
    function renderFrame() {
        if (streamVideo.readyState === streamVideo.HAVE_CURRENT_DATA) {
            ctx.fillStyle = "#020617";
            ctx.fillRect(0, 0, previewCanvas.width, previewCanvas.height);

            const targetAoV = 2 * Math.atan(window.targetCamera.sensorWidth / (2 * window.activeLens));
            const hpAoV = 2 * Math.atan(baseHPCamera.fullFrameWidth / (2 * baseHPCamera.equivalentFocalLength));
            const cropRatio = hpAoV / targetAoV;

            const videoW = streamVideo.videoWidth;
            const videoH = streamVideo.videoHeight;
            let srcW = videoW / cropRatio;
            let srcH = videoH / cropRatio;

            if (srcW > videoW) { srcW = videoW; srcH = videoH; }
            const srcX = (videoW - srcW) / 2;
            const srcY = (videoH - srcH) / 2;

            const canvasW = previewCanvas.width;
            const canvasH = previewCanvas.height;
            let destW = canvasW;
            let destH = canvasW / window.targetAspectRatio;

            if (destH > canvasH) {
                destH = canvasH;
                destW = canvasH * window.targetAspectRatio;
            }

            const destX = (canvasW - destW) / 2;
            const destY = (canvasH - destH) / 2;

            ctx.drawImage(streamVideo, srcX, srcY, srcW, srcH, destX, destY, destW, destH);

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

            ctx.fillStyle = "rgba(0, 0, 0, 0.9)";
            ctx.fillRect(0, 0, canvasW, destY);
            ctx.fillRect(0, destY + destH, canvasW, canvasH - (destY + destH));
            ctx.fillRect(0, destY, destX, destH);
            ctx.fillRect(destX + destW, destY, canvasW - (destX + destW), destH);
        }
        animationFrameId = requestAnimationFrame(renderFrame);
    }
    renderFrame();
}

// 7. Fungsi Bridge Global
window.toggleGrid = function() {
    window.showRuleOfThirds = !window.showRuleOfThirds;
}

window.addEventListener('DOMContentLoaded', initCamera);
window.addEventListener('resize', setupCanvasDimensions);
