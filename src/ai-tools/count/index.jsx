export const meta = {
  key: "count",
  label: "AI Count",
  icon: "🔢",
  description: "Hitung jumlah objek/fitur dalam frame, bandingkan dengan jumlah yang diharapkan.",
  referenceMode: "none",
  defaultThreshold: { detection_min_score: 0.6, expected_count: 1 },
};

export function ThresholdForm({ threshold, onChange }) {
  const minScore = threshold?.detection_min_score ?? meta.defaultThreshold.detection_min_score;
  const expected = threshold?.expected_count ?? meta.defaultThreshold.expected_count;
  return (
    <div className="space-y-4">
      <div>
        <label className="label">Deteksi Minimum Score ({Math.round(minScore * 100)}%)</label>
        <input
          type="range"
          min={0.2}
          max={0.95}
          step={0.01}
          value={minScore}
          onChange={(e) => onChange({ ...threshold, detection_min_score: Number(e.target.value) })}
          className="w-full accent-yasashi-green"
        />
      </div>
      <div>
        <label className="label">Jumlah Objek yang Diharapkan</label>
        <input
          type="number"
          min={0}
          className="input"
          value={expected}
          onChange={(e) => onChange({ ...threshold, expected_count: Number(e.target.value) })}
        />
      </div>
    </div>
  );
}
