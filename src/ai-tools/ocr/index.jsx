export const meta = {
  key: "ocr",
  label: "AI OCR",
  icon: "🔤",
  description: "Baca teks/kode dari gambar, opsional validasi terhadap pola (regex).",
  referenceMode: "none",
  defaultThreshold: { expected_pattern: "" },
};

export function ThresholdForm({ threshold, onChange }) {
  const pattern = threshold?.expected_pattern ?? "";
  return (
    <div>
      <label className="label">Pola yang Diharapkan (regex, kosongkan jika hanya baca teks)</label>
      <input
        className="input font-mono"
        value={pattern}
        onChange={(e) => onChange({ ...threshold, expected_pattern: e.target.value })}
        placeholder="^[A-Z0-9]{8}$"
      />
      <p className="text-xs text-gray-400 mt-1">
        Contoh: <code>^[A-Z0-9]{"{8}"}$</code> untuk memvalidasi kode 8 karakter alfanumerik kapital.
      </p>
    </div>
  );
}
