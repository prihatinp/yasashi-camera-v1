// =====================================================================
// POSITION COMPENSATION (ala Keyence IV series)
//
// Di Keyence IV4, tiap Tool bisa "mengejar" posisi objek yang sedikit
// bergeser: sistem mendefinisikan area pencarian yang lebih besar dari ROI
// asli, mencari pola referensi (dari Mastering) di area itu lewat template
// matching, lalu menggeser ROI sesuai posisi yang ditemukan sebelum
// menjalankan analisa Tool yang sesungguhnya — jadi pembacaan tetap akurat
// walau objek tidak persis di posisi yang sama seperti saat Mastering.
//
// Implementasi di sini pakai Normalized Cross-Correlation (NCC) sederhana:
// - Template = crop ROI dari gambar Mastering, di-resize ke skala kerja tetap
//   (targetPxPerUnit px per satuan ROI relatif) supaya independen dari
//   resolusi asli gambar.
// - Search window = ROI + margin pencarian, di-resize ke skala kerja yang sama.
// - Geser template di atas search window, cari posisi dengan NCC tertinggi.
// - Offset yang ditemukan (dalam satuan relatif) dipakai untuk menggeser ROI.
// =====================================================================

import { cropRgba, decodeImageToRgba, resizeToGray, type Roi } from "./imageSimilarity.ts";

const TARGET_PX_PER_UNIT = 300; // resolusi kerja sintetis, lepas dari resolusi asli gambar

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function expandRoi(roi: Roi, margin: number): Roi {
  const dx = roi.width * margin;
  const dy = roi.height * margin;
  const x = clamp(roi.x - dx, 0, 1);
  const y = clamp(roi.y - dy, 0, 1);
  const x2 = clamp(roi.x + roi.width + dx, 0, 1);
  const y2 = clamp(roi.y + roi.height + dy, 0, 1);
  return { x, y, width: Math.max(roi.width, x2 - x), height: Math.max(roi.height, y2 - y) };
}

/** Normalized cross-correlation, geser template di seluruh area search, kembalikan posisi terbaik. */
function templateMatch(
  search: Float64Array,
  searchW: number,
  searchH: number,
  template: Float64Array,
  templateW: number,
  templateH: number,
): { x: number; y: number; score: number } {
  let templateMean = 0;
  for (let i = 0; i < template.length; i++) templateMean += template[i];
  templateMean /= template.length;

  let templateNorm = 0;
  for (let i = 0; i < template.length; i++) templateNorm += (template[i] - templateMean) ** 2;
  templateNorm = Math.sqrt(templateNorm);

  let bestScore = -Infinity;
  let bestX = 0;
  let bestY = 0;

  const maxX = searchW - templateW;
  const maxY = searchH - templateH;

  for (let sy = 0; sy <= maxY; sy++) {
    for (let sx = 0; sx <= maxX; sx++) {
      let windowMean = 0;
      for (let ty = 0; ty < templateH; ty++) {
        const rowStart = (sy + ty) * searchW + sx;
        for (let tx = 0; tx < templateW; tx++) windowMean += search[rowStart + tx];
      }
      windowMean /= template.length;

      let windowNorm = 0;
      let cross = 0;
      for (let ty = 0; ty < templateH; ty++) {
        const rowStart = (sy + ty) * searchW + sx;
        const tRowStart = ty * templateW;
        for (let tx = 0; tx < templateW; tx++) {
          const wv = search[rowStart + tx] - windowMean;
          const tv = template[tRowStart + tx] - templateMean;
          windowNorm += wv * wv;
          cross += wv * tv;
        }
      }
      windowNorm = Math.sqrt(windowNorm);

      const denom = templateNorm * windowNorm;
      const score = denom > 1e-6 ? cross / denom : -Infinity;
      if (score > bestScore) {
        bestScore = score;
        bestX = sx;
        bestY = sy;
      }
    }
  }

  return { x: bestX, y: bestY, score: bestScore };
}

/**
 * Cari posisi ROI yang sebenarnya di gambar saat ini, berdasarkan pola ROI
 * pada gambar Mastering. Mengembalikan ROI baru (ukuran sama, posisi
 * disesuaikan) beserta skor kecocokan (-1..1, makin tinggi makin yakin).
 */
export function correctRoiPosition(
  masterBytes: Uint8Array,
  currentBytes: Uint8Array,
  roi: Roi,
  searchMargin: number,
): { roi: Roi; score: number } {
  const masterImg = decodeImageToRgba(masterBytes);
  const currentImg = decodeImageToRgba(currentBytes);

  const templateW = Math.max(8, Math.round(roi.width * TARGET_PX_PER_UNIT));
  const templateH = Math.max(8, Math.round(roi.height * TARGET_PX_PER_UNIT));
  const templateCrop = cropRgba(masterImg, roi);
  const templateGray = resizeToGray(templateCrop, templateW, templateH);

  const searchRoi = expandRoi(roi, searchMargin);
  const searchW = Math.max(templateW, Math.round(searchRoi.width * TARGET_PX_PER_UNIT));
  const searchH = Math.max(templateH, Math.round(searchRoi.height * TARGET_PX_PER_UNIT));
  const searchCrop = cropRgba(currentImg, searchRoi);
  const searchGray = resizeToGray(searchCrop, searchW, searchH);

  const match = templateMatch(searchGray, searchW, searchH, templateGray, templateW, templateH);

  const matchedX = searchRoi.x + match.x / TARGET_PX_PER_UNIT;
  const matchedY = searchRoi.y + match.y / TARGET_PX_PER_UNIT;

  const correctedRoi: Roi = {
    x: clamp(matchedX, 0, Math.max(0, 1 - roi.width)),
    y: clamp(matchedY, 0, Math.max(0, 1 - roi.height)),
    width: roi.width,
    height: roi.height,
  };

  return { roi: correctedRoi, score: match.score };
}
