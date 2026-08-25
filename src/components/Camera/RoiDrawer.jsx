import { useRef } from "react";

const MIN_SIZE = 0.03;
const HANDLES = [
  { id: "nw", top: 0, left: 0 },
  { id: "ne", top: 0, left: 1 },
  { id: "sw", top: 1, left: 0 },
  { id: "se", top: 1, left: 1 },
];

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

/**
 * Gambar kotak ROI (region of interest) di atas sebuah gambar statis (mis. Mastering image).
 * ROI disimpan dalam koordinat relatif 0..1 agar tidak bergantung ukuran render.
 *
 * Ramah sentuhan (HP): drag di area kosong = gambar baru, drag di dalam kotak = geser,
 * drag di sudut = ubah ukuran. touch-action:none + pointer capture supaya halaman tidak
 * ikut ter-scroll saat menggambar di layar sentuh.
 */
export default function RoiDrawer({ imageUrl, roi, onChange }) {
  const containerRef = useRef(null);
  const modeRef = useRef("idle"); // "idle" | "draw" | "move" | "resize"
  const cornerRef = useRef(null);
  const dragStartRef = useRef(null); // titik relatif saat drag mulai
  const roiStartRef = useRef(null); // snapshot roi saat drag mulai

  function toRelative(clientX, clientY) {
    const rect = containerRef.current.getBoundingClientRect();
    const x = clamp((clientX - rect.left) / rect.width, 0, 1);
    const y = clamp((clientY - rect.top) / rect.height, 0, 1);
    return { x, y };
  }

  function isInsideRoi(p) {
    if (!roi || roi.width <= 0 || roi.height <= 0) return false;
    return p.x >= roi.x && p.x <= roi.x + roi.width && p.y >= roi.y && p.y <= roi.y + roi.height;
  }

  function handleContainerPointerDown(e) {
    e.preventDefault();
    const p = toRelative(e.clientX, e.clientY);
    dragStartRef.current = p;
    roiStartRef.current = roi ? { ...roi } : null;

    if (isInsideRoi(p)) {
      modeRef.current = "move";
    } else {
      modeRef.current = "draw";
      onChange({ x: p.x, y: p.y, width: 0, height: 0 });
    }
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function handleHandlePointerDown(corner) {
    return (e) => {
      e.preventDefault();
      e.stopPropagation();
      dragStartRef.current = toRelative(e.clientX, e.clientY);
      roiStartRef.current = { ...roi };
      modeRef.current = "resize";
      cornerRef.current = corner;
      e.currentTarget.setPointerCapture(e.pointerId);
    };
  }

  function handlePointerMove(e) {
    const mode = modeRef.current;
    if (mode === "idle" || !dragStartRef.current) return;
    e.preventDefault();
    const p = toRelative(e.clientX, e.clientY);
    const start = dragStartRef.current;
    const roiStart = roiStartRef.current;

    if (mode === "draw") {
      const x = Math.min(start.x, p.x);
      const y = Math.min(start.y, p.y);
      const width = Math.abs(p.x - start.x);
      const height = Math.abs(p.y - start.y);
      onChange({ x, y, width, height });
      return;
    }

    if (mode === "move" && roiStart) {
      const dx = p.x - start.x;
      const dy = p.y - start.y;
      const x = clamp(roiStart.x + dx, 0, Math.max(0, 1 - roiStart.width));
      const y = clamp(roiStart.y + dy, 0, Math.max(0, 1 - roiStart.height));
      onChange({ ...roiStart, x, y });
      return;
    }

    if (mode === "resize" && roiStart) {
      const right = roiStart.x + roiStart.width;
      const bottom = roiStart.y + roiStart.height;
      let { x, y } = roiStart;
      let width = roiStart.width;
      let height = roiStart.height;

      const corner = cornerRef.current;
      if (corner === "nw" || corner === "sw") {
        x = Math.min(p.x, right - MIN_SIZE);
        width = right - x;
      } else {
        width = Math.max(MIN_SIZE, p.x - x);
      }
      if (corner === "nw" || corner === "ne") {
        y = Math.min(p.y, bottom - MIN_SIZE);
        height = bottom - y;
      } else {
        height = Math.max(MIN_SIZE, p.y - y);
      }
      onChange({ x: clamp(x, 0, 1), y: clamp(y, 0, 1), width, height });
    }
  }

  function handlePointerUp() {
    modeRef.current = "idle";
    dragStartRef.current = null;
    roiStartRef.current = null;
    cornerRef.current = null;
  }

  const hasRoi = roi && roi.width > 0 && roi.height > 0;

  return (
    <div
      ref={containerRef}
      className="relative w-full aspect-video bg-black rounded-xl overflow-hidden select-none touch-none"
      style={{ touchAction: "none" }}
      onPointerDown={handleContainerPointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      {imageUrl && (
        <img src={imageUrl} alt="Mastering" className="w-full h-full object-contain pointer-events-none" />
      )}
      {hasRoi && (
        <div
          className="absolute border-2 border-yasashi-green bg-yasashi-green/20 pointer-events-none"
          style={{
            left: `${roi.x * 100}%`,
            top: `${roi.y * 100}%`,
            width: `${roi.width * 100}%`,
            height: `${roi.height * 100}%`,
          }}
        />
      )}
      {hasRoi &&
        HANDLES.map((h) => (
          <div
            key={h.id}
            onPointerDown={handleHandlePointerDown(h.id)}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            className="absolute h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full bg-yasashi-green border-2 border-white shadow touch-none"
            style={{
              left: `${(roi.x + h.left * roi.width) * 100}%`,
              top: `${(roi.y + h.top * roi.height) * 100}%`,
              cursor: h.id === "nw" || h.id === "se" ? "nwse-resize" : "nesw-resize",
              touchAction: "none",
            }}
          />
        ))}
      <p className="absolute bottom-2 left-2 text-[11px] text-white/80 bg-black/40 rounded px-2 py-0.5">
        {hasRoi ? "Geser kotak atau tarik sudut untuk ubah ukuran" : "Drag untuk menggambar area ROI"}
      </p>
    </div>
  );
}
