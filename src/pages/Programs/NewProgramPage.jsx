import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../context/AuthContext.jsx";
import NoOrgNotice from "../../components/NoOrgNotice.jsx";

export default function NewProgramPage() {
  const { profile, user } = useAuth();
  const navigate = useNavigate();
  const [namaProgram, setNamaProgram] = useState("");
  const [cameraSource, setCameraSource] = useState("webcam");
  const [streamUrl, setStreamUrl] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (!profile?.organisasi_id) return <NoOrgNotice />;

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const { data, error } = await supabase
      .from("programs")
      .insert({
        organisasi_id: profile.organisasi_id,
        nama_program: namaProgram,
        camera_source: cameraSource,
        camera_connection: cameraSource === "ethernet" ? { stream_url: streamUrl } : {},
        created_by: user.id,
      })
      .select()
      .single();

    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    navigate(`/programs/${data.id}/setup/mastering`);
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <h1 className="text-xl font-bold">New Program</h1>
      <form onSubmit={handleSubmit} className="card space-y-4">
        <div>
          <label className="label">Nama Program</label>
          <input
            className="input"
            required
            value={namaProgram}
            onChange={(e) => setNamaProgram(e.target.value)}
            placeholder="Contoh: Cek Part A"
          />
        </div>
        <div>
          <label className="label">Sumber Kamera</label>
          <select
            className="input"
            value={cameraSource}
            onChange={(e) => setCameraSource(e.target.value)}
          >
            <option value="webcam">Webcam (laptop)</option>
            <option value="usb">Kamera USB/UVC</option>
            <option value="ethernet">Kamera Ethernet/IP (MJPEG stream)</option>
          </select>
        </div>
        {cameraSource === "ethernet" && (
          <div>
            <label className="label">Stream URL</label>
            <input
              className="input"
              required
              value={streamUrl}
              onChange={(e) => setStreamUrl(e.target.value)}
              placeholder="http://192.168.1.50/mjpeg"
            />
          </div>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? "Menyimpan..." : "Lanjut ke Mastering →"}
        </button>
      </form>
    </div>
  );
}
