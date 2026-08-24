export const meta = {
  key: "identify",
  label: "AI Identify",
  icon: "🔎",
  description: "Kenali keberadaan/jenis objek walau posisi berubah, mendukung multi-referensi.",
  referenceMode: "multi",
  defaultThreshold: { similarity_min: 0.75 },
};

export function ThresholdForm({ threshold, onChange }) {
  const value = threshold?.similarity_min ?? meta.defaultThreshold.similarity_min;
  return (
    <div>
      <label className="label">
        Similarity Minimum ({Math.round(value * 100)}%) — skor tertinggi antar semua referensi
      </label>
      <input
        type="range"
        min={0.4}
        max={0.99}
        step={0.01}
        value={value}
        onChange={(e) => onChange({ ...threshold, similarity_min: Number(e.target.value) })}
        className="w-full accent-yasashi-green"
      />
    </div>
  );
}
