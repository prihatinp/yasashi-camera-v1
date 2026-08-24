export const meta = {
  key: "trigger",
  label: "AI Trigger",
  icon: "🎯",
  description: "Deteksi kondisi/kehadiran objek untuk memicu capture/analisa otomatis.",
  referenceMode: "none",
  defaultThreshold: { detection_min_score: 0.5 },
};

export function ThresholdForm({ threshold, onChange }) {
  const minScore = threshold?.detection_min_score ?? meta.defaultThreshold.detection_min_score;
  return (
    <div>
      <label className="label">Deteksi Minimum Score ({Math.round(minScore * 100)}%)</label>
      <input
        type="range"
        min={0.1}
        max={0.95}
        step={0.01}
        value={minScore}
        onChange={(e) => onChange({ ...threshold, detection_min_score: Number(e.target.value) })}
        className="w-full accent-yasashi-green"
      />
    </div>
  );
}
