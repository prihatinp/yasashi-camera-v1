import { useState } from "react";
import { supabase } from "../../../lib/supabaseClient";

export default function DecisionLogicStep({ program, onSaved }) {
  const [combine, setCombine] = useState(program.decision_logic?.combine ?? "AND");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    await supabase
      .from("programs")
      .update({ decision_logic: { combine } })
      .eq("id", program.id);
    setSaving(false);
    onSaved?.();
  }

  return (
    <div className="space-y-5 max-w-lg">
      <div>
        <h2 className="font-semibold text-lg">Langkah — Decision Logic</h2>
        <p className="text-sm text-gray-500">
          Pilih cara menggabungkan hasil antar-Tool menjadi Judgment akhir Program (dipakai jika
          Program punya lebih dari 1 Tool aktif).
        </p>
      </div>

      <div className="space-y-3">
        <OptionCard
          selected={combine === "AND"}
          onClick={() => setCombine("AND")}
          title="AND — Semua Tool harus OK"
          desc="Program dinyatakan OK hanya jika seluruh Tool aktif menghasilkan OK. Umum dipakai untuk inspeksi ketat."
        />
        <OptionCard
          selected={combine === "OR"}
          onClick={() => setCombine("OR")}
          title="OR — Salah satu Tool cukup OK"
          desc="Program dinyatakan OK jika minimal salah satu Tool aktif menghasilkan OK."
        />
      </div>

      <button className="btn-primary" disabled={saving} onClick={handleSave}>
        {saving ? "Menyimpan..." : "Save Decision Logic"}
      </button>
    </div>
  );
}

function OptionCard({ selected, onClick, title, desc }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left rounded-xl border p-4 transition ${
        selected ? "border-yasashi-green bg-yasashi-green/5" : "border-gray-200 hover:bg-gray-50"
      }`}
    >
      <p className="font-medium">{title}</p>
      <p className="text-sm text-gray-500 mt-1">{desc}</p>
    </button>
  );
}
