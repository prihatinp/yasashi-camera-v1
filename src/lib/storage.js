import { supabase } from "./supabaseClient";

export function dataUrlToBlob(dataUrl) {
  const [meta, base64] = dataUrl.split(",");
  const mime = meta.match(/data:(.*);base64/)?.[1] ?? "image/jpeg";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

/**
 * Upload gambar (dataURL) ke bucket Supabase Storage di bawah folder organisasi_id
 * (wajib, karena RLS storage difilter dari path folder pertama = organisasi_id).
 */
export async function uploadImageDataUrl(bucket, organisasiId, dataUrl, prefix = "") {
  const blob = dataUrlToBlob(dataUrl);
  const path = `${organisasiId}/${prefix}${crypto.randomUUID()}.jpg`;
  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, blob, { contentType: "image/jpeg", upsert: false });
  if (error) throw error;
  return path;
}

export function getPublicOrSignedUrlCache() {
  return new Map();
}

/** Buat signed URL sementara (bucket privat) untuk ditampilkan di <img>. */
export async function getSignedUrl(bucket, path, expiresIn = 3600) {
  if (!path) return null;
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresIn);
  if (error) {
    console.error("Gagal membuat signed URL:", error.message);
    return null;
  }
  return data.signedUrl;
}
