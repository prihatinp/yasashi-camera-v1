export const meta = {
  key: "differentiate",
  label: "AI Differentiate",
  icon: "🆚",
  description: "Bandingkan gambar dengan reference tool → OK/NG berdasarkan similarity.",
  referenceMode: "single",
  defaultThreshold: { similarity_min: 0.85 },
};

export function ThresholdForm({ threshold, onChange }) {
  const value = threshold?.similarity_min ?? meta.defaultThreshold.similarity_min;
  return (
    <div>
      <label className="label">
        Similarity Minimum ({Math.round(value * 100)}%) — semakin tinggi, semakin ketat
      </label>
      <input
        type="range"
        min={0.5}
        max={0.99}
        step={0.01}
        value={value}
        onChange={(e) => onChange({ ...threshold, similarity_min: Number(e.target.value) })}
        className="w-full accent-yasashi-green"
      />
    </div>
  );
}
