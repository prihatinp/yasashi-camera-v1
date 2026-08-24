import { useRef, useState } from "react";
import { useCamera } from "../../hooks/useCamera.js";
import CameraView from "./CameraView.jsx";

/**
 * Live preview kamera + tombol Capture. Mengembalikan dataURL JPEG lewat onCapture.
 * `source`/`streamUrl` mengikuti konfigurasi camera_source & camera_connection Program.
 */
export default function CaptureBox({ source = "webcam", streamUrl = "", onCapture }) {
  const { videoRef, ready, error, captureFrame, on, toggleOn, facingMode, switchFacing } = useCamera({
    source,
    streamUrl,
  });
  const imgRef = useRef(null);
  const [lastCapture, setLastCapture] = useState(null);

  function handleCapture() {
    const dataUrl = captureFrame(imgRef);
    if (dataUrl) {
      setLastCapture(dataUrl);
      onCapture?.(dataUrl);
    }
  }

  const canSwitchFacing = source !== "ethernet";

  return (
    <div className="space-y-3">
      <div className="relative aspect-video rounded-xl overflow-hidden bg-black">
        <CameraView source={source} streamUrl={streamUrl} videoRef={videoRef} imgRef={imgRef} />
        {!on && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/85 text-white text-sm gap-2">
            📷 Kamera nonaktif
          </div>
        )}
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {!error && on && !ready && <p className="text-sm text-gray-400">Menghubungkan ke kamera...</p>}

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="btn-primary" disabled={!ready} onClick={handleCapture}>
          📸 Capture
        </button>
        <button type="button" className="btn-secondary" onClick={toggleOn}>
          {on ? "⏻ Kamera OFF" : "⏻ Kamera ON"}
        </button>
        {canSwitchFacing && (
          <button type="button" className="btn-secondary" onClick={switchFacing} disabled={!on}>
            🔄 Ganti ke {facingMode === "user" ? "Belakang" : "Depan"}
          </button>
        )}
        {lastCapture && <span className="text-xs text-green-600">Frame terakhir tertangkap ✓</span>}
      </div>
      {lastCapture && (
        <img src={lastCapture} alt="Hasil capture" className="w-40 rounded-lg border border-gray-200" />
      )}
    </div>
  );
}
