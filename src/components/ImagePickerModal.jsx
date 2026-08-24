import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { getSignedUrl } from "../lib/storage";

/** Modal sederhana untuk memilih 1 gambar dari Image Library. */
export default function ImagePickerModal({ organisasiId, onSelect, onClose }) {
  const [images, setImages] = useState([]);
  const [urls, setUrls] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("captured_images")
      .select("id, image_url, label, created_at")
      .eq("organisasi_id", organisasiId)
      .order("created_at", { ascending: false })
      .limit(24)
      .then(async ({ data }) => {
        setImages(data ?? []);
        setLoading(false);
        const entries = await Promise.all(
          (data ?? []).map(async (img) => [img.id, await getSignedUrl("image-library", img.image_url)]),
        );
        setUrls(Object.fromEntries(entries));
      });
  }, [organisasiId]);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">Pilih dari Image Library</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            ✕
          </button>
        </div>
        {loading && <p className="text-gray-400 text-sm">Memuat...</p>}
        {!loading && images.length === 0 && (
          <p className="text-gray-400 text-sm">Belum ada gambar tersimpan di Image Library.</p>
        )}
        <div className="grid grid-cols-4 gap-3">
          {images.map((img) => (
            <button
              key={img.id}
              onClick={() => onSelect(img)}
              className="aspect-square rounded-lg overflow-hidden border border-gray-200 hover:border-yasashi-green"
            >
              {urls[img.id] ? (
                <img src={urls[img.id]} alt={img.label ?? ""} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gray-100" />
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
