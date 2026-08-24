import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Mengelola live preview kamera. Mendukung:
 * - "webcam" / "usb": getUserMedia (video element), termasuk ganti kamera depan/belakang di HP
 * - "ethernet": MJPEG/HTTP stream URL (img element, browser refresh sendiri per multipart frame)
 */
export function useCamera({ source = "webcam", streamUrl = "", facingMode: initialFacingMode = "environment" } = {}) {
  const videoRef = useRef(null);
  const streamObjRef = useRef(null);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const [on, setOn] = useState(true);
  const [facingMode, setFacingMode] = useState(initialFacingMode);

  const stop = useCallback(() => {
    streamObjRef.current?.getTracks().forEach((t) => t.stop());
    streamObjRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setReady(false);
  }, []);

  useEffect(() => {
    if (source === "ethernet") {
      setReady(!!streamUrl && on);
      return () => {};
    }

    if (!on) {
      stop();
      return () => {};
    }

    let cancelled = false;
    setError("");
    setReady(false);

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("Browser tidak mendukung akses kamera (getUserMedia).");
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: { ideal: facingMode },
          },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamObjRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setReady(true);
      } catch (err) {
        setError(err.message || "Gagal mengakses kamera.");
      }
    }

    start();
    return () => {
      cancelled = true;
      stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, streamUrl, facingMode, on]);

  /** Ambil 1 frame -> dataURL base64 JPEG (dikompres) */
  const captureFrame = useCallback(
    (imgRef, quality = 0.8, maxWidth = 1024) => {
      const el = source === "ethernet" ? imgRef?.current : videoRef.current;
      if (!el) return null;

      const sourceWidth = source === "ethernet" ? el.naturalWidth : el.videoWidth;
      const sourceHeight = source === "ethernet" ? el.naturalHeight : el.videoHeight;
      if (!sourceWidth || !sourceHeight) return null;

      const scale = Math.min(1, maxWidth / sourceWidth);
      const canvas = document.createElement("canvas");
      canvas.width = sourceWidth * scale;
      canvas.height = sourceHeight * scale;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(el, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL("image/jpeg", quality);
    },
    [source],
  );

  const toggleOn = useCallback(() => setOn((v) => !v), []);
  const switchFacing = useCallback(
    () => setFacingMode((f) => (f === "user" ? "environment" : "user")),
    [],
  );

  return { videoRef, ready, error, captureFrame, stop, on, toggleOn, facingMode, switchFacing };
}
