/** Crop area ROI (relatif 0..1) dari sebuah image URL, hasil dataURL JPEG. */
export function cropImageToDataUrl(imageSrc, roi) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const sx = roi.x * img.naturalWidth;
      const sy = roi.y * img.naturalHeight;
      const sw = Math.max(1, roi.width * img.naturalWidth);
      const sh = Math.max(1, roi.height * img.naturalHeight);
      const canvas = document.createElement("canvas");
      canvas.width = sw;
      canvas.height = sh;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
      resolve(canvas.toDataURL("image/jpeg", 0.9));
    };
    img.onerror = reject;
    img.src = imageSrc;
  });
}

export const FULL_ROI = { x: 0, y: 0, width: 1, height: 1 };
export const DEFAULT_AUTO_ROI = { x: 0.15, y: 0.15, width: 0.7, height: 0.7 };
