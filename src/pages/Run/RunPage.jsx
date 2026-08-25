import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import { callAiInference } from "../../lib/aiInference";
import { useAuth } from "../../context/AuthContext.jsx";
import { useCamera } from "../../hooks/useCamera.js";
import { useWebSerial } from "../../hooks/useWebSerial.js";
import { sendResultToIoConfigs } from "../../lib/io.js";
import CameraView from "../../components/Camera/CameraView.jsx";
import ImagePickerModal from "../../components/ImagePickerModal.jsx";
import StatusBadge from "../../components/StatusBadge.jsx";
import { getSignedUrl, libraryImageToDataUrl } from "../../lib/storage";
import NoOrgNotice from "../../components/NoOrgNotice.jsx";

export default function RunPage() {
  const { programId } = useParams();
  const navigate = useNavigate();
  const { profile, session } = useAuth();

  const [programs, setPrograms] = useState([]);
  const [program, setProgram] = useState(null);
  const [ioConfigs, setIoConfigs] = useState([]);
  const [inputMode, setInputMode] = useState("camera"); // "camera" | "library"
  const [libraryImage, setLibraryImage] = useState(null);
  const [showPicker, setShowPicker] = useState(false);
  const [result, setResult] = useState(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const imgRef = useRef(null);

  const {
    videoRef,
    ready,
    captureFrame,
    on: cameraOn,
    toggleOn: toggleCameraOn,
    facingMode,
    switchFacing,
  } = useCamera({
    source: program?.camera_source ?? "webcam",
    streamUrl: program?.camera_connection?.stream_url ?? "",
  });

  const serial = useWebSerial({
    onLine: (line) => {
      if (line === "TRIGGER" && program?.trigger_mode === "external") {
        handleTrigger();
      }
    },
  });

  useEffect(() => {
    if (!profile?.organisasi_id) return;
    supabase
      .from("programs")
      .select("*")
      .eq("organisasi_id", profile.organisasi_id)
      .eq("is_ready_to_run", true)
      .then(({ data }) => setPrograms(data ?? []));
  }, [profile?.organisasi_id]);

  useEffect(() => {
    if (!programId) {
      setProgram(null);
      return;
    }
    supabase
      .from("programs")
      .select("*")
      .eq("id", programId)
      .single()
      .then(({ data }) => setProgram(data ?? null));
    supabase
      .from("io_configs")
      .select("*")
      .eq("program_id", programId)
      .then(({ data }) => setIoConfigs(data ?? []));
  }, [programId]);

  useEffect(() => {
    if (!libraryImage) return;
    getSignedUrl("image-library", libraryImage.image_url).then((url) => {
      if (imgRef.current) imgRef.current.src = url;
    });
  }, [libraryImage]);

  const handleTrigger = useCallback(
    async (triggerSource = "internal") => {
      if (!program) return;
      setError("");
      setRunning(true);
      setResult(null);
      try {
        let frame;
        if (inputMode === "library" && libraryImage) {
          frame = await libraryImageToDataUrl(libraryImage.image_url);
        } else {
          frame = captureFrame(imgRef);
        }
        if (!frame) throw new Error("Tidak ada frame untuk dianalisa.");

        const data = await callAiInference({
          program_id: program.id,
          image_base64: frame,
          trigger_source: triggerSource,
          operator_id: session?.user?.id,
        });
        setResult(data);

        const ioResults = await sendResultToIoConfigs(ioConfigs, data.hasil, {
          arduinoSendLine: serial.sendLine,
          arduinoConnected: serial.connected,
        });
        setResult((prev) => ({ ...prev, ioResults }));
      } catch (err) {
        setError(err.message || "Gagal menjalankan AI Inference.");
      } finally {
        setRunning(false);
      }
    },
    [program, inputMode, libraryImage, captureFrame, ioConfigs, serial, session],
  );

  // Trigger internal otomatis (interval)
  useEffect(() => {
    if (!program || program.trigger_mode !== "internal") return;
    const intervalMs = program.trigger_config?.auto_interval_ms;
    if (!intervalMs) return;
    const id = setInterval(() => handleTrigger("internal"), intervalMs);
    return () => clearInterval(id);
  }, [program, handleTrigger]);

  if (!profile?.organisasi_id) return <NoOrgNotice />;

  if (!program) {
    return (
      <div className="max-w-lg mx-auto space-y-4">
        <h1 className="text-xl font-bold">Run</h1>
        <p className="text-sm text-gray-500">Pilih Program yang sudah siap Run.</p>
        {programs.length === 0 && (
          <p className="text-sm text-gray-400">Belum ada Program yang siap Run.</p>
        )}
        <div className="space-y-2">
          {programs.map((p) => (
            <button key={p.id} className="card w-full text-left" onClick={() => navigate(`/run/${p.id}`)}>
              <p className="font-medium">{p.nama_program}</p>
              <p className="text-xs text-gray-400 uppercase">{p.camera_source}</p>
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
          <button className="text-sm text-gray-400" onClick={() => navigate("/run")}>
            ← Ganti Program
          </button>
          <h1 className="text-xl font-bold">{program.nama_program}</h1>
        </div>
        <span className="badge-unknown uppercase">{program.trigger_mode}</span>
      </div>

      <div className="flex gap-2">
        <button
          className={inputMode === "camera" ? "btn-primary flex-1" : "btn-secondary flex-1"}
          onClick={() => setInputMode("camera")}
        >
          Live Kamera
        </button>
        <button
          className={inputMode === "library" ? "btn-primary flex-1" : "btn-secondary flex-1"}
          onClick={() => setInputMode("library")}
        >
          Dari Image Library
        </button>
      </div>

      <div className="card space-y-4">
        <div className="relative aspect-video rounded-xl overflow-hidden bg-black">
          {inputMode === "camera" ? (
            <CameraView
              source={program.camera_source}
              streamUrl={program.camera_connection?.stream_url ?? ""}
              videoRef={videoRef}
              imgRef={imgRef}
            />
          ) : (
            <img ref={imgRef} alt="Gambar dari Image Library" className="w-full h-full object-contain bg-black" />
          )}
          {inputMode === "camera" && !cameraOn && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/85 text-white text-sm">
              📷 Kamera nonaktif
            </div>
          )}
        </div>

        {inputMode === "camera" && (
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className="btn-secondary !py-1.5 text-sm" onClick={toggleCameraOn}>
              {cameraOn ? "⏻ Kamera OFF" : "⏻ Kamera ON"}
            </button>
            {program.camera_source !== "ethernet" && (
              <button
                type="button"
                className="btn-secondary !py-1.5 text-sm"
                onClick={switchFacing}
                disabled={!cameraOn}
              >
                🔄 Ganti ke {facingMode === "user" ? "Belakang" : "Depan"}
              </button>
            )}
          </div>
        )}

        {inputMode === "library" && (
          <button className="btn-secondary" onClick={() => setShowPicker(true)}>
            {libraryImage ? "Ganti Gambar" : "Pilih Gambar"}
          </button>
        )}

        {program.trigger_mode === "internal" ? (
          <button
            className="btn-primary w-full !py-4 text-lg"
            disabled={running || (inputMode === "camera" && !ready) || (inputMode === "library" && !libraryImage)}
            onClick={() => handleTrigger("internal")}
          >
            {running ? "Menganalisa..." : "▶️ TRIGGER"}
          </button>
        ) : (
          <div className="rounded-xl bg-gray-50 p-4 text-sm space-y-2">
            <p className="text-gray-600">
              Trigger Eksternal — menunggu sinyal dari Arduino/PLC. Hubungkan Arduino via Web Serial
              di bawah, atau pastikan PLC mengirim sinyal ke Edge Function.
            </p>
            {serial.supported && (
              <button
                className="btn-secondary !py-1.5 text-sm"
                onClick={serial.connected ? serial.disconnect : serial.connect}
              >
                {serial.connected ? "Putuskan Arduino" : "Hubungkan Arduino"}
              </button>
            )}
            {serial.error && <p className="text-red-600">{serial.error}</p>}
          </div>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>

      {result && (
        <div className="card text-center space-y-4">
          <StatusBadge hasil={result.hasil} size="lg" />
          <div className="text-left space-y-1">
            {result.tool_results?.map((r) => (
              <div key={r.program_tool_id} className="flex items-center gap-2 text-sm">
                <StatusBadge hasil={r.hasil} />
                <span className="text-gray-600">
                  {r.ai_tool}
                  {r.confidence != null ? ` (${(r.confidence * 100).toFixed(1)}%)` : ""}
                  {r.ocr_text ? ` — "${r.ocr_text}"` : ""}
                  {r.count_value != null ? ` — count: ${r.count_value}` : ""}
                </span>
              </div>
            ))}
          </div>
          {result.ioResults?.length > 0 && (
            <div className="text-left text-xs text-gray-400">
              {result.ioResults.map((r, i) => (
                <p key={i}>
                  I/O {r.io}: {r.ok ? "terkirim ✓" : `gagal — ${r.message}`}
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      {showPicker && (
        <ImagePickerModal
          organisasiId={profile.organisasi_id}
          onSelect={(img) => {
            setLibraryImage(img);
            setShowPicker(false);
          }}
          onClose={() => setShowPicker(false)}
        />
      )}
    </div>
  );
}
