// --- KODE BAGIAN 2: MESIN PENGGERAK VIEW FINDER & KALIBRASI SENSOR ---

// 1. Definisikan Data Kamera Bioskop Target (Referensi dari Riset Sensor Resmi)
const targetCamera = {
    brand: "ARRI",
    model: "Alexa 35",
    sensorWidth: 27.99,  // Lebar fisik sensor Open Gate (mm)
    sensorHeight: 19.22  // Tinggi fisik sensor Open Gate (mm)
};

// 2. Asumsi Kalibrasi Kamera HP Utama
// Sebagian besar lensa utama HP modern memiliki sudut pandang horizontal (FOV) setara dengan lensa Full Frame 24mm.
const baseHPCamera = {
    equivalentFocalLength: 24, 
    fullFrameWidth: 36.00      // Standar lebar sensor Full Frame (mm)
};

// 3. Status Aplikasi (State Management)
let streamVideo = document.getElementById('rawVideo');
let previewCanvas = document.getElementById('viewfinderCanvas');
let ctx = previewCanvas.getContext('2d');
let animationFrameId;

// Konfigurasi Bawaan Awal
let activeLens = 35;       // Bawaan 35mm Prime
let targetAspectRatio = 2.39; // Aspek Rasio Sinematik (2.39:1 Anamorphic Top/Bottom Mask)
let showRuleOfThirds = true;

// 4. Inisialisasi Akses Kamera Belakang Ponsel (WebRTC API)
async function initCamera() {
    const constraints = {
        video: {
            facingMode: { exact: "environment" }, // Memaksa browser menggunakan kamera belakang
            width: { ideal: 1920 },
            height: { ideal: 1080 }
        },
        audio: false
    };

    try {
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        streamVideo.srcObject = stream;
        streamVideo.addEventListener('loadedmetadata', () => {
            setupCanvasDimensions();
            startLiveViewRendering();
        });
    } catch (err) {
        console.error("Gagal mengakses kamera belakang utama: ", err);
        alert("Aplikasi memerlukan akses kamera belakang. Silakan periksa izin browser Anda.");
        
        // Cadangan jika kamera belakang spesifik (environment) gagal di desktop/emulator
        fallbackCamera();
    }
}

async function fallbackCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        streamVideo.srcObject = stream;
        streamVideo.addEventListener('loadedmetadata', () => {
            setupCanvasDimensions();
            startLiveViewRendering();
        });
    } catch (e) {
        console.error("Kamera cadangan juga gagal: ", e);
    }
}

// 5. Menyelaraskan Ukuran Canvas dengan Dimensi Layar HP
function setupCanvasDimensions() {
    const container = document.querySelector('.viewfinder-container');
    previewCanvas.width = container.clientWidth * window.devicePixelRatio;
    previewCanvas.height = container.clientHeight * window.devicePixelRatio;
    previewCanvas.style.width = container.clientWidth + 'px';
    previewCanvas.style.height = container.clientHeight + 'px';
}

// 6. Loop Rendering Utama (Looping Manipulasi Piksel Real-Time)
function startLiveViewRendering() {
    if (animationFrameId) cancelAnimationFrame(animationFrameId);
    
    function renderFrame() {
        if (streamVideo.readyState === streamVideo.HAVE_CURRENT_DATA) {
            // Bersihkan Canvas
            ctx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);

            // A. HITUNG MATEMATIKA CROP FACTOR (Kalkulasi Inti)
            // Rumus Sudut Pandang Horizontal (Angle of View) Kamera Bioskop Target
            const targetAoV = 2 * Math.atan(targetCamera.sensorWidth / (2 * activeLens));
            
            // Rumus Sudut Pandang Kamera HP Acuan
            const hpAoV = 2 * Math.atan(baseHPCamera.fullFrameWidth / (2 * baseHPCamera.equivalentFocalLength));

            // Rasio Zoom Digital untuk memotong feed video asli kamera HP
            const cropRatio = hpAoV / targetAoV;

            // B. TENTUKAN KOORDINAT TANGKAPAN DARI VIDEO UTAMA
            const videoW = streamVideo.videoWidth;
            const videoH = streamVideo.videoHeight;

            // Tentukan area potong di video sumber berdasarkan Crop Ratio
            let srcW = videoW / cropRatio;
            let srcH = videoH / cropRatio;

            // Batasi agar pemotongan tidak melebihi resolusi fisik kamera bawaan
            if (srcW > videoW) { srcW = videoW; srcH = videoH; }

            const srcX = (videoW - srcW) / 2;
            const srcY = (videoH - srcH) / 2;

            // C. PROSES PENEMPATAN GAMBAR DI CANVAS TUJUAN
            const canvasW = previewCanvas.width;
            const canvasH = previewCanvas.height;

            // Hitung dimensi penempatan agar aspek rasio bioskop terjaga di canvas layar
            let destW = canvasW;
            let destH = canvasW / targetAspectRatio;

            if (destH > canvasH) {
                destH = canvasH;
                destW = canvasH * targetAspectRatio;
            }

            const destX = (canvasW - destW) / 2;
            const destY = (canvasH - destH) / 2;

            // Gambarkan potongan video utama ke atas Canvas secara presisi
            ctx.drawImage(streamVideo, srcX, srcY, srcW, srcH, destX, destY, destW, destH);

            // D. GAMBAR OVERLAY GARIS KOMPOSISI (Rule of Thirds)
            if (showRuleOfThirds) {
                ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
                ctx.lineWidth = 2 * window.devicePixelRatio;

                // Garis Vertikal Sepertiga
                ctx.beginPath();
                ctx.moveTo(destX + destW / 3, destY);
                ctx.lineTo(destX + destW / 3, destY + destH);
                ctx.moveTo(destX + (destW / 3) * 2, destY);
                ctx.lineTo(destX + (destW / 3) * 2, destY + destH);

                // Garis Horizontal Sepertiga
                ctx.moveTo(destX, destY + destH / 3);
                ctx.lineTo(destX + destW, destY + destH / 3);
                ctx.moveTo(destX, destY + (destH / 3) * 2);
                ctx.lineTo(destX + destW, destY + (destH / 3) * 2);
                ctx.stroke();
            }

            // E. GAMBAR LETTERBOX HITAM (Topeng Batas Perekaman Sinema)
            ctx.fillStyle = "rgba(0, 0, 0, 0.85)";
            // Kotak Atas
            ctx.fillRect(0, 0, canvasW, destY);
            // Kotak Bawah
            ctx.fillRect(0, destY + destH, canvasW, canvasH - (destY + destH));
            // Kotak Kiri
            ctx.fillRect(0, destY, destX, destH);
            // Kotak Kanan
            ctx.fillRect(destX + destW, destY, canvasW - (destX + destW), destH);
        }
        animationFrameId = requestAnimationFrame(renderFrame);
    }
    
    renderFrame();
}

// 7. Fungsi Pengendali dari Antarmuka UI (Bridge Functions)
function setLens(mm) {
    activeLens = mm;
    console.log(`Menggeser Fokus Lensa Simulasi ke: ${mm}mm`);
}

function toggleGrid() {
    showRuleOfThirds = !showRuleOfThirds;
}

// Jalankan sistem kamera saat jendela browser selesai dimuat
window.addEventListener('DOMContentLoaded', initCamera);
window.addEventListener('resize', setupCanvasDimensions);