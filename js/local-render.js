// --- KODE BAGIAN 3A: MESIN EXPORT GAMBAR LOKAL (OFFSCREEN CANVAS) ---

async function captureAndSaveToLocal() {
    console.log("Memulai proses rendering final untuk penyimpanan lokal...");
    
    // 1. Ambil koordinat GPS terlebih dahulu dengan aman (Fallback jika offline)
    let gps = { latitude: 0, longitude: 0 };
    try {
        if(typeof getUserCurrentLocation === "function") {
            gps = await getUserCurrentLocation();
        }
    } catch(e) {
        console.warn("GPS Bypass aktif untuk mode offline.");
    }
    const latLonText = gps.latitude ? `${gps.latitude.toFixed(4)}, ${gps.longitude.toFixed(4)}` : "GPS Disabled";

    // 2. Dapatkan data UI saat ini secara dinamis
    const selectedShot = document.getElementById('shotSize') ? document.getElementById('shotSize').value : "MCU";
    const activeLensText = (typeof activeLens !== 'undefined' ? activeLens : 35) + "mm";
    const cameraText = typeof targetCamera !== 'undefined' ? `${targetCamera.brand} ${targetCamera.model}` : "ARRI ALEXA 35";
    const currentAspect = typeof targetAspectRatio !== 'undefined' ? targetAspectRatio : 2.39;
    const isGridOn = typeof showRuleOfThirds !== 'undefined' ? showRuleOfThirds : false;
    
    // 3. Buat Canvas Tersembunyi khusus resolusi tinggi (1920x1080)
    const outputCanvas = document.createElement('canvas');
    const outCtx = outputCanvas.getContext('2d', { alpha: false });
    
    const W = 1920;
    const H = 1080;
    outputCanvas.width = W;
    outputCanvas.height = H;
    
    // A. Hitung Matematika Crop untuk Output Canvas (Resolusi Asli Kamera Utama)
    let destW = W;
    let destH = H;
    let destX = 0;
    let destY = 0;

    // Jika video feed aktif dan siap
    if (typeof streamVideo !== 'undefined' && streamVideo.videoWidth > 0) {
        const videoW = streamVideo.videoWidth;
        const videoH = streamVideo.videoHeight;
        
        let targetAoV = 2 * Math.atan(27.99 / (2 * parseInt(activeLensText))); // Default fallback ke Arri
        if(typeof targetCamera !== 'undefined') {
            targetAoV = 2 * Math.atan(targetCamera.sensorWidth / (2 * parseInt(activeLensText)));
        }
        const hpAoV = 2 * Math.atan(36.00 / (2 * 24)); // Fullframe fallback
        const cropRatio = hpAoV / targetAoV;

        let srcW = videoW / cropRatio;
        let srcH = videoH / cropRatio;
        if (srcW > videoW) { srcW = videoW; srcH = videoH; }
        const srcX = (videoW - srcW) / 2;
        const srcY = (videoH - srcH) / 2;

        destH = W / currentAspect;
        destX = (W - destW) / 2;
        destY = (H - destH) / 2;

        // Cetak frame kamera ke Offscreen
        outCtx.drawImage(streamVideo, srcX, srcY, srcW, srcH, destX, destY, destW, destH);
    } else {
        // Fallback warna kosong jika kamera macet
        outCtx.fillStyle = "#1e293b";
        outCtx.fillRect(0,0,W,H);
    }

    // B. CETAK MATI MASKING LETTERBOX HITAM
    outCtx.fillStyle = "#000000";
    outCtx.fillRect(0, 0, W, destY); // Top Mask
    outCtx.fillRect(0, destY + destH, W, H - (destY + destH)); // Bottom Mask

    // C. CETAK MATI GARIS KOMPOSISI (Burn-In Grid)
    if (isGridOn) {
        outCtx.strokeStyle = "rgba(255, 255, 255, 0.4)";
        outCtx.lineWidth = 3; 
        
        outCtx.beginPath();
        outCtx.moveTo(destX + destW / 3, destY); outCtx.lineTo(destX + destW / 3, destY + destH);
        outCtx.moveTo(destX + (destW / 3) * 2, destY); outCtx.lineTo(destX + (destW / 3) * 2, destY + destH);
        outCtx.moveTo(destX, destY + destH / 3); outCtx.lineTo(destX + destW, destY + destH / 3);
        outCtx.moveTo(destX, destY + (destH / 3) * 2); outCtx.lineTo(destX + destW, destY + (destH / 3) * 2);
        outCtx.stroke();
    }

    // D. CETAK METADATA TEKS EKSKLUSIF (Branding & Parameter Lensa)
    outCtx.fillStyle = "#FFFFFF";
    outCtx.font = "bold 28px -apple-system, BlinkMacSystemFont, Arial, sans-serif";
    outCtx.textBaseline = "middle";

    outCtx.fillText(`CAM: ${cameraText.toUpperCase()}`, 40, destY / 2);
    outCtx.textAlign = "right";
    outCtx.fillText(`ASPECT: ${currentAspect === 2.39 ? "2.39:1" : "16:9"}`, W - 40, destY / 2);

    const footerY = destY + destH + ((H - (destY + destH)) / 2);
    outCtx.textAlign = "left";
    outCtx.fillStyle = "#F59E0B"; // Hex presisi untuk warna amber-500 Tailwind
    outCtx.fillText(`LENS: ${activeLensText}`, 40, footerY);
    
    outCtx.fillStyle = "#FFFFFF";
    outCtx.fillText(` |  SHOT: ${selectedShot}`, 240, footerY);
    
    outCtx.textAlign = "right";
    outCtx.font = "24px -apple-system, BlinkMacSystemFont, Arial, sans-serif";
    outCtx.fillText(`GPS: ${latLonText}`, W - 40, footerY);

    // 4. DOWNLOAD KE SISTEM OPERASI SECARA AMAN (Mobile/Desktop)
    try {
        const imageURL = outputCanvas.toDataURL('image/jpeg', 0.90);
        const downloadLink = document.createElement('a');
        
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        downloadLink.download = `CDView_${selectedShot}_${activeLensText}_${timestamp}.jpg`;
        downloadLink.href = imageURL;
        
        document.body.appendChild(downloadLink);
        downloadLink.click();
        
        // Membersihkan antrean DOM demi keamanan memori browser
        setTimeout(() => document.body.removeChild(downloadLink), 100);
        console.log("Gambar offline berhasil diekspor.");
    } catch (err) {
        console.error("Gagal mengekspor file gambar: ", err);
        alert("Gagal menulis file lokal. Periksa izin unduhan browser Anda.");
    }
}
