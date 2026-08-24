import { useRef, useState } from "react";
import { useCamera } from "../../hooks/useCamera.js";
import CameraView from "./CameraView.jsx";

/**
 * Live preview kamera + tombol Capture. Mengembalikan dataURL JPEG lewat onCapture.
 * `source`/`streamUrl` mengikuti konfigurasi camera_source & camera_connection Program.
 */
export default function CaptureBox({ source = "webcam", streamUrl = "", onCapture }) {
  const { videoRef, ready, error, captureFrame } = useCamera({ source, streamUrl });
  const imgRef = useRef(null);
  const [lastCapture, setLastCapture] = useState(null);

  function handleCapture() {
    const dataUrl = captureFrame(imgRef);
    if (dataUrl) {
      setLastCapture(dataUrl);
      onCapture?.(dataUrl);
    }
  }

  return (
    <div className="space-y-3">
      <div className="aspect-video rounded-xl overflow-hidden bg-black">
        <CameraView source={source} streamUrl={streamUrl} videoRef={videoRef} imgRef={imgRef} />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {!error && !ready && <p className="text-sm text-gray-400">Menghubungkan ke kamera...</p>}
      <div className="flex items-center gap-3">
        <button type="button" className="btn-primary" disabled={!ready} onClick={handleCapture}>
          📸 Capture
        </button>
        {lastCapture && <span className="text-xs text-green-600">Frame terakhir tertangkap ✓</span>}
      </div>
      {lastCapture && (
        <img src={lastCapture} alt="Hasil capture" className="w-40 rounded-lg border border-gray-200" />
      )}
    </div>
  );
}
