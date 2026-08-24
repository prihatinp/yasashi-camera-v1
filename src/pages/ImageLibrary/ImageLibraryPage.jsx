import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../context/AuthContext.jsx";
import { uploadImageDataUrl, getSignedUrl } from "../../lib/storage";
import NoOrgNotice from "../../components/NoOrgNotice.jsx";

export default function ImageLibraryPage() {
  const { profile, isEngineer } = useAuth();
  const [images, setImages] = useState([]);
  const [urls, setUrls] = useState({});
  const [programs, setPrograms] = useState([]);
  const [filterProgram, setFilterProgram] = useState("");
  const [filterLabel, setFilterLabel] = useState("");
  const [selected, setSelected] = useState(new Set());
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");

  async function loadImages() {
    if (!profile?.organisasi_id) return;
    let query = supabase
      .from("captured_images")
      .select("*")
      .eq("organisasi_id", profile.organisasi_id)
      .order("created_at", { ascending: false });
    if (filterProgram) query = query.eq("program_id", filterProgram);
    if (filterLabel) query = query.eq("label", filterLabel);

    const { data } = await query;
    setImages(data ?? []);
    setLoading(false);

    const entries = await Promise.all(
      (data ?? []).map(async (img) => [img.id, await getSignedUrl("image-library", img.image_url)]),
    );
    setUrls(Object.fromEntries(entries));
  }

  useEffect(() => {
    if (!profile?.organisasi_id) return;
    supabase
      .from("programs")
      .select("id, nama_program")
      .eq("organisasi_id", profile.organisasi_id)
      .then(({ data }) => setPrograms(data ?? []));
  }, [profile?.organisasi_id]);

  useEffect(() => {
    loadImages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.organisasi_id, filterProgram, filterLabel]);

  function toggleSelect(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function handleUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setMessage("");
    try {
      const dataUrl = await fileToDataUrl(file);
      const path = await uploadImageDataUrl("image-library", profile.organisasi_id, dataUrl, "upload-");
      await supabase.from("captured_images").insert({
        organisasi_id: profile.organisasi_id,
        image_url: path,
        source: "webcam",
        tags: ["upload"],
        captured_by: profile.id,
      });
      setMessage("Gambar berhasil diupload.");
      loadImages();
    } catch (err) {
      setMessage(err.message);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  async function tagUsage(usageType) {
    const ids = Array.from(selected);
    for (const id of ids) {
      const img = images.find((i) => i.id === id);
      const current = img?.usage_type ?? [];
      if (current.includes(usageType)) continue;
      await supabase
        .from("captured_images")
        .update({ usage_type: [...current, usageType] })
        .eq("id", id);
    }
    setMessage(`${ids.length} gambar ditandai untuk "${usageType}".`);
    setSelected(new Set());
    loadImages();
  }

  if (!profile?.organisasi_id) return <NoOrgNotice />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-bold">Image Library</h1>
        <label className="btn-primary cursor-pointer">
          {uploading ? "Mengupload..." : "+ Upload Gambar"}
          <input type="file" accept="image/*" className="hidden" onChange={handleUpload} disabled={uploading} />
        </label>
      </div>

      <div className="flex flex-wrap gap-3">
        <select className="input !w-auto" value={filterProgram} onChange={(e) => setFilterProgram(e.target.value)}>
          <option value="">Semua Program</option>
          {programs.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nama_program}
            </option>
          ))}
        </select>
        <select className="input !w-auto" value={filterLabel} onChange={(e) => setFilterLabel(e.target.value)}>
          <option value="">Semua Label</option>
          <option value="OK">OK</option>
          <option value="NG">NG</option>
        </select>
      </div>

      {message && <p className="text-sm text-yasashi-green-dark">{message}</p>}

      {selected.size > 0 && (
        <div className="card flex flex-wrap items-center gap-3">
          <span className="text-sm text-gray-500">{selected.size} gambar dipilih:</span>
          <button className="btn-secondary !py-1.5 text-sm" onClick={() => tagUsage("mastering")}>
            Tandai untuk Mastering
          </button>
          <button className="btn-secondary !py-1.5 text-sm" onClick={() => tagUsage("run_test")}>
            Tandai untuk Input Run
          </button>
          <button className="btn-secondary !py-1.5 text-sm" onClick={() => tagUsage("reference_learn")}>
            Tandai sebagai Reference Tool
          </button>
        </div>
      )}

      {loading && <p className="text-gray-400">Memuat...</p>}
      {!loading && images.length === 0 && <p className="text-gray-400">Belum ada gambar.</p>}

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {images.map((img) => (
          <div key={img.id} className="card !p-2 space-y-2">
            <div className="relative aspect-square rounded-lg overflow-hidden bg-gray-100">
              {urls[img.id] && <img src={urls[img.id]} alt="" className="w-full h-full object-cover" />}
              <input
                type="checkbox"
                checked={selected.has(img.id)}
                onChange={() => toggleSelect(img.id)}
                className="absolute top-2 left-2 h-5 w-5 accent-yasashi-green"
              />
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className={img.label === "OK" ? "badge-ok" : img.label === "NG" ? "badge-ng" : "badge-unknown"}>
                {img.label ?? "-"}
              </span>
              {isEngineer && (
                <button className="text-gray-400 hover:text-gray-700" onClick={() => setEditing(img)}>
                  Edit
                </button>
              )}
            </div>
            {img.tags?.length > 0 && (
              <p className="text-[10px] text-gray-400 truncate">{img.tags.join(", ")}</p>
            )}
          </div>
        ))}
      </div>

      {editing && (
        <EditLabelModal
          image={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            loadImages();
          }}
        />
      )}
    </div>
  );
}

function EditLabelModal({ image, onClose, onSaved }) {
  const [label, setLabel] = useState(image.label ?? "");
  const [tags, setTags] = useState((image.tags ?? []).join(", "));
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    await supabase
      .from("captured_images")
      .update({
        label: label || null,
        tags: tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
      })
      .eq("id", image.id);
    setSaving(false);
    onSaved();
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-sm w-full p-5 space-y-4">
        <h3 className="font-semibold">Edit Label &amp; Tag</h3>
        <div>
          <label className="label">Label</label>
          <select className="input" value={label} onChange={(e) => setLabel(e.target.value)}>
            <option value="">-</option>
            <option value="OK">OK</option>
            <option value="NG">NG</option>
          </select>
        </div>
        <div>
          <label className="label">Tags (pisahkan dengan koma)</label>
          <input className="input" value={tags} onChange={(e) => setTags(e.target.value)} />
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary flex-1" onClick={onClose}>
            Batal
          </button>
          <button className="btn-primary flex-1" disabled={saving} onClick={handleSave}>
            {saving ? "Menyimpan..." : "Simpan"}
          </button>
        </div>
      </div>
    </div>
  );
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
