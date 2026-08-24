import { supabase } from "./supabaseClient";

/** Salin object dari bucket 'image-library' ke bucket 'reference-images' (dipakai untuk set-as-Mastering). */
export async function copyLibraryImageToReferenceBucket(libraryPath, organisasiId) {
  const { data: fileData, error: downloadErr } = await supabase.storage
    .from("image-library")
    .download(libraryPath);
  if (downloadErr) throw downloadErr;

  const newPath = `${organisasiId}/mastering-${crypto.randomUUID()}.jpg`;
  const { error: uploadErr } = await supabase.storage
    .from("reference-images")
    .upload(newPath, fileData, { contentType: "image/jpeg" });
  if (uploadErr) throw uploadErr;

  return newPath;
}

/** Salin object dari bucket 'image-library' ke bucket 'reference-images' untuk reference Tool. */
export async function copyLibraryImageToToolReference(libraryPath, organisasiId) {
  return copyLibraryImageToReferenceBucket(libraryPath, organisasiId);
}
