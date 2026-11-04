
async function captureAndSaveToLocal() {
    console.log("Memulai proses rendering final untuk penyimpanan lokal...");
    
    // 1. Ambil koordinat GPS terlebih dahulu
    const gps = await getUserCurrentLocation();
    const latLonText = gps.latitude ? `${gps.latitude.toFixed(4)}, ${gps.longitude.toFixed(4)}` : "GPS Disabled";

    // 2. Dapatkan data UI saat ini
    const selectedShot = document.getElementById('shotSize').value;
    const activeLensText = activeLens + "mm";
    const cameraText = `${targetCamera.brand} ${targetCamera.model}`;
    
    // 3. Buat Canvas Tersembunyi (Offscreen Canvas) khusus untuk merender output resolusi tinggi
    // Ini memastikan hasil simpanan bersih dari elemen tombol-tombol UI ponsel
    const outputCanvas = document.createElement('canvas');
    const outCtx = outputCanvas.getContext('2d');
    
    // Gunakan resolusi tinggi standar Full HD untuk gambar output
    outputCanvas.width = 1920;
    outputCanvas.height = 1080;
    
    const W = outputCanvas.width;
    const H = outputCanvas.height;

    // A. Gambar Ulang Feed Kamera yang Sudah Disesuaikan Lensa (Matematika Crop dari Bagian 2)
    const targetAoV = 2 * Math.atan(targetCamera.sensorWidth / (2 * activeLens));
    const hpAoV = 2 * Math.atan(baseHPCamera.fullFrameWidth / (2 * baseHPCamera.equivalentFocalLength));
    const cropRatio = hpAoV / targetAoV;

    const videoW = streamVideo.videoWidth;
    const videoH = streamVideo.videoHeight;
    let srcW = videoW / cropRatio;
    let srcH = videoH / cropRatio;
    if (srcW > videoW) { srcW = videoW; srcH = videoH; }
    const srcX = (videoW - srcW) / 2;
    const srcY = (videoH - srcH) / 2;

    // Tentukan area penempatan gambar sinema di tengah kanvas output
    let destW = W;
    let destH = W / targetAspectRatio;
    const destX = (W - destW) / 2;
    const destY = (H - destH) / 2;

    // Gambar frame adegan utama
    outCtx.drawImage(streamVideo, srcX, srcY, srcW, srcH, destX, destY, destW, destH);

    // B. CETAK MATI MASKING LETTERBOX (Garis Batas Kamera Film)
    outCtx.fillStyle = "#000000";
    outCtx.fillRect(0, 0, W, destY); // Top Mask
    outCtx.fillRect(0, destY + destH, W, H - (destY + destH)); // Bottom Mask

    // C. CETAK MATI GARIS KOMPOSISI (Jika Aktif saat Bidik)
    if (showRuleOfThirds) {
        outCtx.strokeStyle = "rgba(255, 255, 255, 0.5)";
        outCtx.lineWidth = 3; // Lebih tebal agar jelas saat disimpan
        
        outCtx.beginPath();
        // Vertikal
        outCtx.moveTo(destX + destW / 3, destY); outCtx.lineTo(destX + destW / 3, destY + destH);
        outCtx.moveTo(destX + (destW / 3) * 2, destY); outCtx.lineTo(destX + (destW / 3) * 2, destY + destH);
        // Horizontal
        outCtx.moveTo(destX, destY + destH / 3); outCtx.lineTo(destX + destW, destY + destH / 3);
        outCtx.moveTo(destX, destY + (destH / 3) * 2); outCtx.lineTo(destX + destW, destY + (destH / 3) * 2);
        outCtx.stroke();
    }

    // D. CETAK METADATA PADA BOX HITAM (Revisi Estetika Burn-In)
    outCtx.fillStyle = "#FFFFFF";
    outCtx.font = "bold 28px -apple-system, BlinkMacSystemFont, sans-serif";
    outCtx.textBaseline = "middle";

    outCtx.fillText(`CAM: ${cameraText.toUpperCase()}`, 40, destY / 2);
    outCtx.textAlign = "right";
    outCtx.fillText(`ASPECT: ${targetAspectRatio === 2.39 ? "2.39:1" : "16:9"}`, W - 40, destY / 2);

    const footerY = destY + destH + ((H - (destY + destH)) / 2);
    outCtx.textAlign = "left";
    outCtx.fillStyle = "#F59E0B"; // Hex presisi untuk warna amber-500 Tailwind
    outCtx.fillText(`LENS: ${activeLensText}`, 40, footerY);
    
    outCtx.fillStyle = "#FFFFFF";
    outCtx.fillText(` |  SHOT: ${selectedShot}`, 240, footerY);
    
    outCtx.textAlign = "right";
    outCtx.font = "24px -apple-system, BlinkMacSystemFont, sans-serif";
    outCtx.fillText(`GPS: ${latLonText}`, W - 40, footerY);

    // 4. UNDUH SEBAGAI GAMBAR KE SISTEM OPERASI (iOS / Android)
    try {
        const imageURL = outputCanvas.toDataURL('image/jpeg', 0.90);
        const downloadLink = document.createElement('a');
        
        // Penamaan berkas otomatis terstruktur rapi untuk mempermudah manajemen berkas syuting
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        downloadLink.download = `CDView_${selectedShot}_${activeLensText}_${timestamp}.jpg`;
        downloadLink.href = imageURL;
        
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
        
        console.log("Gambar berhasil diekspor dan disimpan secara lokal.");
    } catch (err) {
        console.error("Gagal mengekspor file gambar: ", err);
        alert("Sistem web gagal menulis file lokal secara otomatis. Sediakan izin unduhan pada browser.");
    }
}