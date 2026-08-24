import { useRef, useState } from "react";

/**
 * Gambar kotak ROI (region of interest) di atas sebuah gambar statis (mis. Mastering image).
 * ROI disimpan dalam koordinat relatif 0..1 agar tidak bergantung ukuran render.
 */
export default function RoiDrawer({ imageUrl, roi, onChange }) {
  const containerRef = useRef(null);
  const [dragStart, setDragStart] = useState(null);

  function toRelative(clientX, clientY) {
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1);
    const y = Math.min(Math.max((clientY - rect.top) / rect.height, 0), 1);
    return { x, y };
  }

  function handlePointerDown(e) {
    const p = toRelative(e.clientX, e.clientY);
    setDragStart(p);
    onChange({ x: p.x, y: p.y, width: 0, height: 0 });
  }

  function handlePointerMove(e) {
    if (!dragStart) return;
    const p = toRelative(e.clientX, e.clientY);
    const x = Math.min(dragStart.x, p.x);
    const y = Math.min(dragStart.y, p.y);
    const width = Math.abs(p.x - dragStart.x);
    const height = Math.abs(p.y - dragStart.y);
    onChange({ x, y, width, height });
  }

  function handlePointerUp() {
    setDragStart(null);
  }

  return (
    <div
      ref={containerRef}
      className="relative w-full aspect-video bg-black rounded-xl overflow-hidden cursor-crosshair select-none"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
    >
      {imageUrl && (
        <img src={imageUrl} alt="Mastering" className="w-full h-full object-contain pointer-events-none" />
      )}
      {roi && roi.width > 0 && roi.height > 0 && (
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
      <p className="absolute bottom-2 left-2 text-[11px] text-white/80 bg-black/40 rounded px-2 py-0.5">
        Drag untuk menggambar area ROI
      </p>
    </div>
  );
}
