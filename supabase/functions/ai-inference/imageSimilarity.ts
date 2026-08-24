// =====================================================================
// PERBANDINGAN GAMBAR KLASIK (tanpa model AI eksternal) untuk AI Differentiate
// & AI Identify — dipakai sebagai pengganti image-embedding Hugging Face
// setelah provider gratis mereka (hf-inference) berhenti melayani task
// image-feature-extraction. Pendekatan ini gratis selamanya, tanpa cold-start,
// dan cukup untuk membandingkan "gambar acuan vs gambar saat ini" ala sensor
// vision industrial (mirip cara kerja Keyence IV series untuk mode compare).
//
// Metode: decode -> grayscale -> resize ke ukuran kecil tetap -> hitung SSIM
// (Structural Similarity Index) global antara dua gambar. Skor 0..1, makin
// dekat ke 1 makin mirip.
// =====================================================================

import jpeg from "npm:jpeg-js@0.4.4";
import { PNG } from "npm:pngjs@7.0.0";
import { Buffer } from "node:buffer";

const COMPARE_SIZE = 64; // resize kedua gambar ke 64x64 sebelum dibandingkan

export interface RgbaImage {
  width: number;
  height: number;
  data: Uint8Array; // RGBA, 4 byte per pixel
}

export interface Roi {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function decodeImageToRgba(bytes: Uint8Array): RgbaImage {
  const isJpeg = bytes.length > 2 && bytes[0] === 0xff && bytes[1] === 0xd8;
  const isPng =
    bytes.length > 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47;

  if (isJpeg) {
    const decoded = jpeg.decode(bytes, { useTArray: true });
    return { width: decoded.width, height: decoded.height, data: decoded.data as Uint8Array };
  }
  if (isPng) {
    const decoded = PNG.sync.read(Buffer.from(bytes));
    return { width: decoded.width, height: decoded.height, data: decoded.data as Uint8Array };
  }
  throw new Error(
    "Format gambar tidak didukung untuk perbandingan (hanya JPEG/PNG). " +
      "Pastikan gambar Mastering/reference berasal dari Capture kamera atau crop ROI.",
  );
}

/** Resize RGBA -> grayscale Float64Array ukuran tetap (nearest-neighbor, cukup untuk perbandingan kasar). */
export function resizeToGray(img: RgbaImage, targetWidth: number, targetHeight: number): Float64Array {
  const out = new Float64Array(targetWidth * targetHeight);
  for (let y = 0; y < targetHeight; y++) {
    const srcY = Math.min(img.height - 1, Math.floor((y * img.height) / targetHeight));
    for (let x = 0; x < targetWidth; x++) {
      const srcX = Math.min(img.width - 1, Math.floor((x * img.width) / targetWidth));
      const idx = (srcY * img.width + srcX) * 4;
      const r = img.data[idx];
      const g = img.data[idx + 1];
      const b = img.data[idx + 2];
      out[y * targetWidth + x] = 0.299 * r + 0.587 * g + 0.114 * b;
    }
  }
  return out;
}

/** Crop RGBA berdasarkan ROI relatif (0..1), dikliping ke batas gambar. */
export function cropRgba(img: RgbaImage, roi: Roi): RgbaImage {
  const x0 = Math.max(0, Math.min(img.width - 1, Math.round(roi.x * img.width)));
  const y0 = Math.max(0, Math.min(img.height - 1, Math.round(roi.y * img.height)));
  const w = Math.max(1, Math.min(img.width - x0, Math.round(roi.width * img.width)));
  const h = Math.max(1, Math.min(img.height - y0, Math.round(roi.height * img.height)));

  const out = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    const srcRowStart = ((y0 + y) * img.width + x0) * 4;
    out.set(img.data.subarray(srcRowStart, srcRowStart + w * 4), y * w * 4);
  }
  return { width: w, height: h, data: out };
}

/** Encode RGBA -> JPEG bytes, untuk hasil crop yang perlu dikirim ke Hugging Face / Tesseract. */
export function encodeRgbaToJpeg(img: RgbaImage, quality = 85): Uint8Array {
  const encoded = jpeg.encode({ data: img.data, width: img.width, height: img.height }, quality);
  return new Uint8Array(encoded.data);
}

/** SSIM global (satu window = seluruh gambar) — cukup sensitif untuk deteksi beda pola/cacat. */
function ssim(a: Float64Array, b: Float64Array): number {
  const n = a.length;
  let meanA = 0, meanB = 0;
  for (let i = 0; i < n; i++) {
    meanA += a[i];
    meanB += b[i];
  }
  meanA /= n;
  meanB /= n;

  let varA = 0, varB = 0, covAB = 0;
  for (let i = 0; i < n; i++) {
    const da = a[i] - meanA;
    const db = b[i] - meanB;
    varA += da * da;
    varB += db * db;
    covAB += da * db;
  }
  varA /= n - 1;
  varB /= n - 1;
  covAB /= n - 1;

  const C1 = (0.01 * 255) ** 2;
  const C2 = (0.03 * 255) ** 2;

  return (
    ((2 * meanA * meanB + C1) * (2 * covAB + C2)) /
    ((meanA ** 2 + meanB ** 2 + C1) * (varA + varB + C2))
  );
}

/** Bandingkan dua gambar (bytes JPEG/PNG) -> skor similarity 0..1. */
export function compareImages(bytesA: Uint8Array, bytesB: Uint8Array): number {
  const imgA = decodeImageToRgba(bytesA);
  const imgB = decodeImageToRgba(bytesB);
  const grayA = resizeToGray(imgA, COMPARE_SIZE, COMPARE_SIZE);
  const grayB = resizeToGray(imgB, COMPARE_SIZE, COMPARE_SIZE);
  const score = ssim(grayA, grayB);
  // SSIM idealnya -1..1 (identik = 1); clamp ke 0..1 supaya konsisten dengan slider threshold UI.
  return Math.max(0, Math.min(1, score));
}
