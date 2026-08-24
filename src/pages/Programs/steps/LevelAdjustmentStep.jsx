import { useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { describeFunctionError } from "../../../lib/functionsError";
import { useAuth } from "../../../context/AuthContext.jsx";
import { getToolMeta, getToolThresholdForm } from "../../../ai-tools/registry";
import CaptureBox from "../../../components/Camera/CaptureBox.jsx";
import StatusBadge from "../../../components/StatusBadge.jsx";

export default function LevelAdjustmentStep({ program, tools, onSaved }) {
  const savedTools = tools.filter((t) => t.is_saved);

  if (savedTools.length === 0) {
    return <p className="text-sm text-gray-500">Belum ada Tool tersimpan. Selesaikan langkah Add Tools dahulu.</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-semibold text-lg">Langkah 5 — Level Adjustment</h2>
        <p className="text-sm text-gray-500">
          Atur sensitivitas/threshold tiap Tool. Gunakan preview di bawah untuk menguji hasil
          dengan frame kamera saat ini sebelum Save.
        </p>
      </div>

      <LivePreviewTester program={program} />

      <div className="space-y-4">
        {savedTools.map((tool) => (
          <ToolThresholdCard key={tool.id} tool={tool} onSaved={onSaved} />
        ))}
      </div>
    </div>
  );
}

function ToolThresholdCard({ tool, onSaved }) {
  const meta = getToolMeta(tool.ai_tool);
  const ThresholdForm = getToolThresholdForm(tool.ai_tool);
  const [threshold, setThreshold] = useState(tool.threshold ?? meta.defaultThreshold);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    await supabase
      .from("program_tools")
      .update({ threshold, is_level_adjusted: true })
      .eq("id", tool.id);
    setSaving(false);
    onSaved?.();
  }

  return (
    <div className="rounded-xl border border-gray-100 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">{meta.icon}</span>
          <p className="font-medium">{tool.nama_tool || meta.label}</p>
        </div>
        <span className={tool.is_level_adjusted ? "badge-ok" : "badge-unknown"}>
          {tool.is_level_adjusted ? "Sudah Diatur" : "Belum Diatur"}
        </span>
      </div>
      {ThresholdForm && <ThresholdForm threshold={threshold} onChange={setThreshold} />}
      <button className="btn-primary !py-1.5 text-sm" disabled={saving} onClick={handleSave}>
        {saving ? "Menyimpan..." : "Save Level Adjustment"}
      </button>
    </div>
  );
}

function LivePreviewTester({ program }) {
  const { session } = useAuth();
  const [frame, setFrame] = useState(null);
  const [result, setResult] = useState(null);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState("");

  async function handleTest() {
    if (!frame) return;
    setTesting(true);
    setError("");
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("ai-inference", {
        body: {
          program_id: program.id,
          image_base64: frame,
          trigger_source: "internal",
          operator_id: session?.user?.id,
        },
      });
      if (error) throw error;
      setResult(data);
    } catch (err) {
      setError(await describeFunctionError(err));
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="rounded-xl bg-gray-50 p-4 space-y-3">
      <p className="text-sm font-medium text-gray-600">Preview Live (opsional)</p>
      <CaptureBox
        source={program.camera_source}
        streamUrl={program.camera_connection?.stream_url ?? ""}
        onCapture={setFrame}
      />
      <button className="btn-secondary" disabled={!frame || testing} onClick={handleTest}>
        {testing ? "AI Engine warming up..." : "Test dengan Frame Ini"}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {result && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">Judgment akhir:</span>
            <StatusBadge hasil={result.hasil} />
          </div>
          <ul className="text-sm space-y-1">
            {result.tool_results?.map((r) => (
              <li key={r.program_tool_id} className="flex items-center gap-2">
                <StatusBadge hasil={r.hasil} />
                <span className="text-gray-600">
                  {r.ai_tool} {r.confidence != null ? `(${(r.confidence * 100).toFixed(1)}%)` : ""}
                  {r.ocr_text ? ` — "${r.ocr_text}"` : ""}
                  {r.count_value != null ? ` — count: ${r.count_value}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
