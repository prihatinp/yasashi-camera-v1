import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { useAuth } from "../../../context/AuthContext.jsx";
import { getSignedUrl, uploadImageDataUrl } from "../../../lib/storage";
import { cropImageToDataUrl, DEFAULT_AUTO_ROI, FULL_ROI } from "../../../lib/imageCrop";
import { AI_TOOL_LIST, getToolMeta } from "../../../ai-tools/registry";
import RoiDrawer from "../../../components/Camera/RoiDrawer.jsx";
import ImagePickerModal from "../../../components/ImagePickerModal.jsx";
import { copyLibraryImageToToolReference } from "../../../lib/imageLibrary";

export default function AddToolsStep({ program, tools, onSaved }) {
  const { profile } = useAuth();
  const [masterUrl, setMasterUrl] = useState(null);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    if (program.master_image_url) {
      getSignedUrl("reference-images", program.master_image_url).then(setMasterUrl);
    }
  }, [program.master_image_url]);

  if (!program.is_mastered) {
    return (
      <p className="text-sm text-gray-500">
        Selesaikan langkah Mastering terlebih dahulu sebelum menambah Tool.
      </p>
    );
  }

  async function handleDeleteTool(toolId) {
    if (!confirm("Hapus Tool ini?")) return;
    await supabase.from("program_tools").delete().eq("id", toolId);
    onSaved?.();
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-lg">Langkah 3-4 — Add Tools &amp; Save Tools</h2>
          <p className="text-sm text-gray-500">
            Tambahkan 1 atau lebih Tool AI di atas Mastering image. Mode Manual: pilih sendiri
            jenis tool + ROI. Auto Learning: sistem menyarankan ROI awal, tinggal dikonfirmasi.
          </p>
        </div>
        <button className="btn-primary" onClick={() => setShowForm((v) => !v)}>
          {showForm ? "Tutup" : "+ Add Tool"}
        </button>
      </div>

      <div className="space-y-2">
        {tools.length === 0 && <p className="text-sm text-gray-400">Belum ada Tool ditambahkan.</p>}
        {tools.map((tool) => {
          const meta = getToolMeta(tool.ai_tool);
          return (
            <div key={tool.id} className="flex items-center justify-between rounded-xl border border-gray-100 px-4 py-3">
              <div className="flex items-center gap-3">
                <span className="text-xl">{meta?.icon}</span>
                <div>
                  <p className="font-medium">{tool.nama_tool || meta?.label}</p>
                  <p className="text-xs text-gray-400">
                    {meta?.label} · {tool.learn_mode === "auto" ? "Auto Learning" : "Manual"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={tool.is_saved ? "badge-ok" : "badge-unknown"}>
                  {tool.is_saved ? "Tersimpan" : "Draft"}
                </span>
                <button className="text-red-500 text-sm" onClick={() => handleDeleteTool(tool.id)}>
                  Hapus
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {showForm && masterUrl && (
        <AddToolForm
          program={program}
          masterUrl={masterUrl}
          organisasiId={profile.organisasi_id}
          nextOrder={tools.length}
          onDone={() => {
            setShowForm(false);
            onSaved?.();
          }}
        />
      )}
    </div>
  );
}

function AddToolForm({ program, masterUrl, organisasiId, nextOrder, onDone }) {
  const [aiTool, setAiTool] = useState("differentiate");
  const [learnMode, setLearnMode] = useState("manual");
  const [namaTool, setNamaTool] = useState("");
  const [roi, setRoi] = useState(FULL_ROI);
  const [positionCorrection, setPositionCorrection] = useState(true);
  const [searchMargin, setSearchMargin] = useState(0.15);
  const [references, setReferences] = useState([]); // untuk mode multi (Identify)
  const [refLabel, setRefLabel] = useState("OK");
  const [showPicker, setShowPicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const meta = getToolMeta(aiTool);

  function handleModeChange(mode) {
    setLearnMode(mode);
    setRoi(mode === "auto" ? DEFAULT_AUTO_ROI : FULL_ROI);
  }

  async function handleAddReferenceFromRoi() {
    setError("");
    try {
      const dataUrl = await cropImageToDataUrl(masterUrl, roi);
      const path = await uploadImageDataUrl("reference-images", organisasiId, dataUrl, "tool-ref-");
      setReferences((prev) => [...prev, { label: refLabel || `Ref ${prev.length + 1}`, url: path }]);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handlePickFromLibrary(img) {
    setError("");
    try {
      const path = await copyLibraryImageToToolReference(img.image_url, organisasiId);
      setReferences((prev) => [...prev, { label: refLabel || img.label || `Ref ${prev.length + 1}`, url: path }]);
      setShowPicker(false);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleSaveTool() {
    setSaving(true);
    setError("");
    try {
      let referenceImageUrl = null;
      let referenceImageUrls = [];

      if (meta.referenceMode === "single") {
        const dataUrl = await cropImageToDataUrl(masterUrl, roi);
        referenceImageUrl = await uploadImageDataUrl("reference-images", organisasiId, dataUrl, "tool-ref-");
      } else if (meta.referenceMode === "multi") {
        if (references.length === 0) {
          throw new Error("Tambahkan minimal 1 reference untuk AI Identify.");
        }
        referenceImageUrls = references;
      }

      const isFullFrame = roi.width >= 1 && roi.height >= 1;
      const roiConfig = isFullFrame
        ? roi
        : { ...roi, position_correction: { enabled: positionCorrection, search_margin: searchMargin } };

      const { error: insertErr } = await supabase.from("program_tools").insert({
        program_id: program.id,
        ai_tool: aiTool,
        tool_order: nextOrder,
        nama_tool: namaTool || meta.label,
        learn_mode: learnMode,
        roi_config: roiConfig,
        reference_image_url: referenceImageUrl,
        reference_image_urls: referenceImageUrls,
        threshold: meta.defaultThreshold,
        is_saved: true,
      });
      if (insertErr) throw insertErr;
      onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl border border-gray-200 p-4 space-y-4">
      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <label className="label">Jenis AI Tool</label>
          <select className="input" value={aiTool} onChange={(e) => setAiTool(e.target.value)}>
            {AI_TOOL_LIST.map((m) => (
              <option key={m.key} value={m.key}>
                {m.icon} {m.label}
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-400 mt-1">{meta?.description}</p>
        </div>
        <div>
          <label className="label">Nama Tool (opsional)</label>
          <input
            className="input"
            value={namaTool}
            onChange={(e) => setNamaTool(e.target.value)}
            placeholder={meta?.label}
          />
        </div>
      </div>

      <div>
        <label className="label">Mode</label>
        <div className="flex gap-2">
          <button
            type="button"
            className={learnMode === "manual" ? "btn-primary !py-1.5 text-sm" : "btn-secondary !py-1.5 text-sm"}
            onClick={() => handleModeChange("manual")}
          >
            Manual
          </button>
          <button
            type="button"
            className={learnMode === "auto" ? "btn-primary !py-1.5 text-sm" : "btn-secondary !py-1.5 text-sm"}
            onClick={() => handleModeChange("auto")}
          >
            ✨ Auto Learning
          </button>
        </div>
        {learnMode === "auto" && (
          <p className="text-xs text-gray-400 mt-1">
            Auto Learning menyarankan ROI area tengah gambar secara otomatis — geser/perbesar kotak
            di bawah jika perlu, lalu Save.
          </p>
        )}
      </div>

      <div>
        <label className="label">Area ROI (relatif terhadap Mastering image)</label>
        <RoiDrawer imageUrl={masterUrl} roi={roi} onChange={setRoi} />
      </div>

      {roi.width < 1 && roi.height < 1 && (
        <div className="rounded-xl bg-gray-50 p-3 space-y-2">
          <div className="flex items-center gap-2">
            <input
              id="position-correction"
              type="checkbox"
              checked={positionCorrection}
              onChange={(e) => setPositionCorrection(e.target.checked)}
            />
            <label htmlFor="position-correction" className="text-sm">
              🎯 Aktifkan Position Compensation (ala Keyence IV series) — kejar posisi objek kalau
              sedikit bergeser dari saat Mastering
            </label>
          </div>
          {positionCorrection && (
            <div>
              <label className="label">
                Area Pencarian Tambahan ({Math.round(searchMargin * 100)}%) — makin besar, makin
                toleran terhadap pergeseran, tapi makin lambat
              </label>
              <input
                type="range"
                min={0.05}
                max={0.5}
                step={0.05}
                value={searchMargin}
                onChange={(e) => setSearchMargin(Number(e.target.value))}
                className="w-full accent-yasashi-green"
              />
            </div>
          )}
        </div>
      )}

      {meta?.referenceMode === "multi" && (
        <div className="space-y-2">
          <label className="label">Reference (multi) — untuk AI Identify</label>
          <div className="flex flex-wrap gap-2">
            {references.map((r, i) => (
              <span key={i} className="badge-unknown">
                {r.label}
              </span>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <input
              className="input !w-40"
              value={refLabel}
              onChange={(e) => setRefLabel(e.target.value)}
              placeholder="Label, mis. OK"
            />
            <button type="button" className="btn-secondary !py-1.5 text-sm" onClick={handleAddReferenceFromRoi}>
              + Dari ROI Mastering
            </button>
            <button type="button" className="btn-secondary !py-1.5 text-sm" onClick={() => setShowPicker(true)}>
              + Dari Image Library
            </button>
          </div>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button className="btn-primary" disabled={saving} onClick={handleSaveTool}>
        {saving ? "Menyimpan..." : "Save Tool"}
      </button>

      {showPicker && (
        <ImagePickerModal
          organisasiId={organisasiId}
          onSelect={handlePickFromLibrary}
          onClose={() => setShowPicker(false)}
        />
      )}
    </div>
  );
}
