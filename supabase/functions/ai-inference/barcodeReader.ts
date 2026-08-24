// =====================================================================
// AI BARCODE/QR — baca barcode 1D (linear, "model bar") maupun QR Code 2D
// ("model kotak"/matrix) pakai ZXing (murni JS, tanpa API luar, tanpa
// cold-start), jalan langsung di Edge Function.
// =====================================================================

import {
  BinaryBitmap,
  DecodeHintType,
  HybridBinarizer,
  MultiFormatReader,
  RGBLuminanceSource,
} from "npm:@zxing/library@0.21.3";
import { decodeImageToRgba } from "./imageSimilarity.ts";

export interface BarcodeReadResult {
  text: string;
  format: string;
}

/** Baca barcode/QR dari bytes gambar (JPEG/PNG). null jika tidak ada yang terbaca. */
export function readBarcodeOrQr(bytes: Uint8Array): BarcodeReadResult | null {
  const img = decodeImageToRgba(bytes);

  const luminanceSource = new RGBLuminanceSource(
    new Int32Array(rgbaToPackedInt(img.data)),
    img.width,
    img.height,
  );
  const binaryBitmap = new BinaryBitmap(new HybridBinarizer(luminanceSource));

  const hints = new Map();
  hints.set(DecodeHintType.TRY_HARDER, true);
  const reader = new MultiFormatReader();
  reader.setHints(hints);

  try {
    const result = reader.decode(binaryBitmap);
    return { text: result.getText(), format: String(result.getBarcodeFormat()) };
  } catch {
    return null;
  }
}

/** RGBLuminanceSource versi zxing-js mengharapkan Int32Array ARGB per pixel. */
function rgbaToPackedInt(rgba: Uint8Array): Int32Array {
  const pixelCount = rgba.length / 4;
  const out = new Int32Array(pixelCount);
  for (let i = 0; i < pixelCount; i++) {
    const o = i * 4;
    const r = rgba[o];
    const g = rgba[o + 1];
    const b = rgba[o + 2];
    out[i] = (0xff << 24) | (r << 16) | (g << 8) | b;
  }
  return out;
}
