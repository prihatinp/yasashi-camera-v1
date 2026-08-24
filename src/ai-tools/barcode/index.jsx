export const meta = {
  key: "barcode",
  label: "AI Barcode/QR",
  icon: "🔳",
  description: "Baca barcode 1D (garis/linear) maupun QR Code 2D (kotak/matrix), opsional validasi pola.",
  referenceMode: "none",
  defaultThreshold: { expected_pattern: "" },
};

export function ThresholdForm({ threshold, onChange }) {
  const pattern = threshold?.expected_pattern ?? "";
  return (
    <div>
      <label className="label">Pola yang Diharapkan (regex, kosongkan jika hanya baca kode)</label>
      <input
        className="input font-mono"
        value={pattern}
        onChange={(e) => onChange({ ...threshold, expected_pattern: e.target.value })}
        placeholder="^SN-[0-9]{6}$"
      />
      <p className="text-xs text-gray-400 mt-1">
        Mendukung barcode 1D (Code128, EAN, UPC, dst.) dan QR Code 2D secara otomatis — tidak perlu
        pilih jenisnya, sistem mendeteksi sendiri.
      </p>
    </div>
  );
}
