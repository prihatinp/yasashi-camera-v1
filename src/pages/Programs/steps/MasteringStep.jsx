import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { useAuth } from "../../../context/AuthContext.jsx";
import { uploadImageDataUrl, getSignedUrl } from "../../../lib/storage";
import { copyLibraryImageToReferenceBucket } from "../../../lib/imageLibrary";
import CaptureBox from "../../../components/Camera/CaptureBox.jsx";
import ImagePickerModal from "../../../components/ImagePickerModal.jsx";

export default function MasteringStep({ program, onSaved }) {
  const { profile } = useAuth();
  const [pendingCapture, setPendingCapture] = useState(null);
  const [currentUrl, setCurrentUrl] = useState(null);
  const [showPicker, setShowPicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (program.master_image_url) {
      getSignedUrl("reference-images", program.master_image_url).then(setCurrentUrl);
    } else {
      setCurrentUrl(null);
    }
  }, [program.master_image_url]);

  async function saveMasteringFromDataUrl(dataUrl) {
    setSaving(true);
    setError("");
    try {
      const path = await uploadImageDataUrl("reference-images", profile.organisasi_id, dataUrl, "mastering-");
      await supabase
        .from("programs")
        .update({
          master_image_url: path,
          master_image_captured_at: new Date().toISOString(),
          is_mastered: true,
        })
        .eq("id", program.id);
      setPendingCapture(null);
      onSaved?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handlePickFromLibrary(img) {
    setSaving(true);
    setError("");
    try {
      const newPath = await copyLibraryImageToReferenceBucket(img.image_url, profile.organisasi_id);
      await supabase
        .from("programs")
        .update({
          master_image_url: newPath,
          master_image_captured_at: new Date().toISOString(),
          is_mastered: true,
        })
        .eq("id", program.id);
      setShowPicker(false);
      onSaved?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-semibold text-lg">Langkah 2 — Mastering</h2>
        <p className="text-sm text-gray-500">
          Ambil gambar objek yang baik/normal dari kamera live, lalu simpan sebagai gambar acuan
          (Mastering) Program ini.
        </p>
      </div>

      {currentUrl && !pendingCapture && (
        <div>
          <p className="label">Mastering Image Saat Ini</p>
          <img src={currentUrl} alt="Mastering saat ini" className="w-64 rounded-xl border border-gray-200" />
        </div>
      )}

      <CaptureBox
        source={program.camera_source}
        streamUrl={program.camera_connection?.stream_url ?? ""}
        onCapture={setPendingCapture}
      />

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex flex-wrap gap-3">
        <button
          className="btn-primary"
          disabled={!pendingCapture || saving}
          onClick={() => saveMasteringFromDataUrl(pendingCapture)}
        >
          {saving ? "Menyimpan..." : "Save sebagai Mastering"}
        </button>
        <button className="btn-secondary" onClick={() => setShowPicker(true)}>
          Pilih dari Image Library
        </button>
      </div>

      {showPicker && (
        <ImagePickerModal
          organisasiId={profile.organisasi_id}
          onSelect={handlePickFromLibrary}
          onClose={() => setShowPicker(false)}
        />
      )}
    </div>
  );
}
