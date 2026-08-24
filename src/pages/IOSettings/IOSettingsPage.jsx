import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../context/AuthContext.jsx";
import { useWebSerial } from "../../hooks/useWebSerial.js";
import NoOrgNotice from "../../components/NoOrgNotice.jsx";

export default function IOSettingsPage() {
  const { programId } = useParams();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [programs, setPrograms] = useState([]);
  const [ioConfigs, setIoConfigs] = useState([]);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    if (!profile?.organisasi_id) return;
    supabase
      .from("programs")
      .select("id, nama_program")
      .eq("organisasi_id", profile.organisasi_id)
      .then(({ data }) => setPrograms(data ?? []));
  }, [profile?.organisasi_id]);

  async function reload() {
    if (!programId) return;
    const { data } = await supabase.from("io_configs").select("*").eq("program_id", programId);
    setIoConfigs(data ?? []);
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [programId]);

  if (!profile?.organisasi_id) return <NoOrgNotice />;

  if (!programId) {
    return (
      <div className="max-w-lg mx-auto space-y-4">
        <h1 className="text-xl font-bold">I/O Settings</h1>
        <p className="text-sm text-gray-500">Pilih Program untuk mengatur koneksi PLC/Arduino.</p>
        <div className="space-y-2">
          {programs.map((p) => (
            <button key={p.id} className="card w-full text-left" onClick={() => navigate(`/io-settings/${p.id}`)}>
              {p.nama_program}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <button className="text-sm text-gray-400" onClick={() => navigate("/io-settings")}>
            ← Ganti Program
          </button>
          <h1 className="text-xl font-bold">I/O Settings</h1>
        </div>
        <button className="btn-primary" onClick={() => setShowForm((v) => !v)}>
          {showForm ? "Tutup" : "+ Tambah I/O"}
        </button>
      </div>

      <div className="space-y-4">
        {ioConfigs.length === 0 && <p className="text-gray-400 text-sm">Belum ada I/O dikonfigurasi.</p>}
        {ioConfigs.map((io) => (
          <IoConfigCard key={io.id} io={io} onChanged={reload} />
        ))}
      </div>

      {showForm && (
        <NewIoConfigForm
          programId={programId}
          onDone={() => {
            setShowForm(false);
            reload();
          }}
        />
      )}
    </div>
  );
}

function IoConfigCard({ io, onChanged }) {
  const serial = useWebSerial({});
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState("");

  async function handleDelete() {
    if (!confirm("Hapus I/O Config ini?")) return;
    await supabase.from("io_configs").delete().eq("id", io.id);
    onChanged();
  }

  async function handleTestPlc(hasil) {
    setTesting(true);
    setMessage("");
    try {
      const { error } = await supabase.functions.invoke("plc-io", {
        body: { connection_info: io.connection_info, mapping: io.mapping_output?.[hasil] },
      });
      if (error) throw error;
      setMessage(`Sinyal ${hasil} terkirim ke PLC.`);
    } catch (err) {
      setMessage(err.message);
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between">
        <span className="font-semibold uppercase">{io.io_type}</span>
        <button className="text-red-500 text-sm" onClick={handleDelete}>
          Hapus
        </button>
      </div>
      <pre className="text-xs bg-gray-50 rounded-lg p-3 overflow-x-auto">
        {JSON.stringify({ connection_info: io.connection_info, mapping_output: io.mapping_output }, null, 2)}
      </pre>
      {io.supports_trigger_input && (
        <p className="text-xs text-yasashi-green-dark">
          Trigger input aktif: {JSON.stringify(io.trigger_input_mapping)}
        </p>
      )}

      {io.io_type === "arduino" && (
        <div className="flex items-center gap-2">
          <button className="btn-secondary !py-1.5 text-sm" onClick={serial.connected ? serial.disconnect : serial.connect}>
            {serial.connected ? "Putuskan" : "Hubungkan"} Arduino
          </button>
          <button className="btn-secondary !py-1.5 text-sm" disabled={!serial.connected} onClick={() => serial.sendLine("OK")}>
            Test OK
          </button>
          <button className="btn-secondary !py-1.5 text-sm" disabled={!serial.connected} onClick={() => serial.sendLine("NG")}>
            Test NG
          </button>
        </div>
      )}

      {io.io_type === "plc" && (
        <div className="flex items-center gap-2">
          <button className="btn-secondary !py-1.5 text-sm" disabled={testing} onClick={() => handleTestPlc("OK")}>
            Test OK
          </button>
          <button className="btn-secondary !py-1.5 text-sm" disabled={testing} onClick={() => handleTestPlc("NG")}>
            Test NG
          </button>
        </div>
      )}
      {message && <p className="text-xs text-gray-500">{message}</p>}
    </div>
  );
}

function NewIoConfigForm({ programId, onDone }) {
  const [ioType, setIoType] = useState("arduino");
  const [baudRate, setBaudRate] = useState(9600);
  const [ip, setIp] = useState("");
  const [port, setPort] = useState(502);
  const [okCoil, setOkCoil] = useState(1);
  const [ngCoil, setNgCoil] = useState(2);
  const [supportsInput, setSupportsInput] = useState(false);
  const [inputPin, setInputPin] = useState("D2");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    setSaving(true);
    setError("");
    try {
      const connection_info = ioType === "arduino" ? { baud_rate: Number(baudRate) } : { ip, port: Number(port), protocol: "modbus_tcp" };
      const mapping_output =
        ioType === "arduino"
          ? { OK: { value: "OK" }, NG: { value: "NG" } }
          : { OK: { coil: Number(okCoil), value: true }, NG: { coil: Number(ngCoil), value: true } };

      const { error: insertErr } = await supabase.from("io_configs").insert({
        program_id: programId,
        io_type: ioType,
        connection_info,
        mapping_output,
        supports_trigger_input: supportsInput,
        trigger_input_mapping: supportsInput
          ? ioType === "arduino"
            ? { input_pin: inputPin, edge: "rising" }
            : { input_bit: Number(inputPin) || 0 }
          : {},
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
    <div className="card space-y-4">
      <div>
        <label className="label">Tipe I/O</label>
        <div className="flex gap-2">
          <button
            className={ioType === "arduino" ? "btn-primary flex-1" : "btn-secondary flex-1"}
            onClick={() => setIoType("arduino")}
          >
            Arduino (USB)
          </button>
          <button
            className={ioType === "plc" ? "btn-primary flex-1" : "btn-secondary flex-1"}
            onClick={() => setIoType("plc")}
          >
            PLC (Ethernet)
          </button>
        </div>
      </div>

      {ioType === "arduino" ? (
        <div>
          <label className="label">Baud Rate</label>
          <input type="number" className="input" value={baudRate} onChange={(e) => setBaudRate(e.target.value)} />
          <p className="text-xs text-gray-400 mt-1">
            Port serial dipilih langsung lewat dialog browser saat klik "Hubungkan Arduino". App
            mengirim baris teks <code>OK</code>/<code>NG</code> — sketch Arduino kamu yang memetakan
            ke pin output fisik.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">IP Address PLC</label>
            <input className="input" value={ip} onChange={(e) => setIp(e.target.value)} placeholder="192.168.1.10" />
          </div>
          <div>
            <label className="label">Port</label>
            <input type="number" className="input" value={port} onChange={(e) => setPort(e.target.value)} />
          </div>
          <div>
            <label className="label">Coil OK</label>
            <input type="number" className="input" value={okCoil} onChange={(e) => setOkCoil(e.target.value)} />
          </div>
          <div>
            <label className="label">Coil NG</label>
            <input type="number" className="input" value={ngCoil} onChange={(e) => setNgCoil(e.target.value)} />
          </div>
        </div>
      )}

      <div className="flex items-center gap-2">
        <input type="checkbox" checked={supportsInput} onChange={(e) => setSupportsInput(e.target.checked)} />
        <label className="text-sm">Dipakai juga sebagai Trigger Eksternal (input)</label>
      </div>
      {supportsInput && (
        <div>
          <label className="label">{ioType === "arduino" ? "Input Pin" : "Input Bit"}</label>
          <input className="input" value={inputPin} onChange={(e) => setInputPin(e.target.value)} />
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
      <button className="btn-primary" disabled={saving} onClick={handleSave}>
        {saving ? "Menyimpan..." : "Save I/O Config"}
      </button>
    </div>
  );
}
