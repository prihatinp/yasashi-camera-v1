import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../../lib/supabaseClient";

export default function TriggerConfigStep({ program, onSaved }) {
  const [mode, setMode] = useState(program.trigger_mode ?? "internal");
  const [intervalMs, setIntervalMs] = useState(program.trigger_config?.auto_interval_ms ?? "");
  const [ioConfigs, setIoConfigs] = useState([]);
  const [ioConfigId, setIoConfigId] = useState(program.trigger_config?.io_config_id ?? "");
  const [inputPin, setInputPin] = useState(program.trigger_config?.input_pin ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase
      .from("io_configs")
      .select("id, io_type, connection_info")
      .eq("program_id", program.id)
      .then(({ data }) => setIoConfigs(data ?? []));
  }, [program.id]);

  async function handleSave() {
    setSaving(true);
    const trigger_config =
      mode === "internal"
        ? { auto_interval_ms: intervalMs ? Number(intervalMs) : null }
        : { io_config_id: ioConfigId || null, input_pin: inputPin || null };

    await supabase.from("programs").update({ trigger_mode: mode, trigger_config }).eq("id", program.id);
    setSaving(false);
    onSaved?.();
  }

  return (
    <div className="space-y-5 max-w-lg">
      <div>
        <h2 className="font-semibold text-lg">Langkah — Trigger Config</h2>
        <p className="text-sm text-gray-500">
          Pilih bagaimana Program ini dipicu saat Mode Running: Internal (dari aplikasi) atau
          Eksternal (sinyal PLC/Arduino).
        </p>
      </div>

      <div className="flex gap-2">
        <button
          className={mode === "internal" ? "btn-primary flex-1" : "btn-secondary flex-1"}
          onClick={() => setMode("internal")}
        >
          Internal
        </button>
        <button
          className={mode === "external" ? "btn-primary flex-1" : "btn-secondary flex-1"}
          onClick={() => setMode("external")}
        >
          Eksternal
        </button>
      </div>

      {mode === "internal" && (
        <div>
          <label className="label">Interval Otomatis (ms) — kosongkan untuk trigger tombol manual</label>
          <input
            type="number"
            className="input"
            value={intervalMs}
            onChange={(e) => setIntervalMs(e.target.value)}
            placeholder="Contoh: 2000"
          />
        </div>
      )}

      {mode === "external" && (
        <div className="space-y-3">
          {ioConfigs.length === 0 ? (
            <p className="text-sm text-yellow-700 bg-yellow-50 rounded-xl p-3">
              Belum ada I/O Config untuk Program ini.{" "}
              <Link to={`/io-settings/${program.id}`} className="underline font-medium">
                Atur I/O Settings
              </Link>{" "}
              terlebih dahulu.
            </p>
          ) : (
            <div>
              <label className="label">Sumber I/O</label>
              <select className="input" value={ioConfigId} onChange={(e) => setIoConfigId(e.target.value)}>
                <option value="">— pilih —</option>
                {ioConfigs.map((io) => (
                  <option key={io.id} value={io.id}>
                    {io.io_type.toUpperCase()} — {JSON.stringify(io.connection_info)}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="label">Input Pin/Bit (opsional, override default I/O Config)</label>
            <input
              className="input"
              value={inputPin}
              onChange={(e) => setInputPin(e.target.value)}
              placeholder="Contoh: D2"
            />
          </div>
        </div>
      )}

      <button className="btn-primary" disabled={saving} onClick={handleSave}>
        {saving ? "Menyimpan..." : "Save Trigger Config"}
      </button>
    </div>
  );
}
