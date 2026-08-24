import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../context/AuthContext.jsx";
import NoOrgNotice from "../../components/NoOrgNotice.jsx";
import YasashiLogo from "../../components/YasashiLogo.jsx";

export default function Dashboard() {
  const { profile } = useAuth();
  const [stats, setStats] = useState({ programCount: 0, okToday: 0, ngToday: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.organisasi_id) {
      setLoading(false);
      return;
    }
    let cancelled = false;

    async function load() {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      const [{ count: programCount }, { data: logsToday }] = await Promise.all([
        supabase
          .from("programs")
          .select("id", { count: "exact", head: true })
          .eq("organisasi_id", profile.organisasi_id)
          .eq("is_active", true),
        supabase
          .from("inspection_logs")
          .select("hasil")
          .eq("organisasi_id", profile.organisasi_id)
          .gte("timestamp", startOfDay.toISOString()),
      ]);

      if (cancelled) return;
      const okToday = logsToday?.filter((l) => l.hasil === "OK").length ?? 0;
      const ngToday = logsToday?.filter((l) => l.hasil === "NG").length ?? 0;
      setStats({ programCount: programCount ?? 0, okToday, ngToday });
      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [profile?.organisasi_id]);

  const cameraSupported = typeof navigator !== "undefined" && !!navigator.mediaDevices;
  const serialSupported = typeof navigator !== "undefined" && "serial" in navigator;

  return (
    <div className="space-y-6">
      <div className="card flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-gradient-to-br from-yasashi-green/10 to-white">
        <div className="flex items-center gap-4">
          <YasashiLogo size={56} showText={false} />
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              Selamat datang, {profile?.nama ?? profile?.email ?? "..."}
            </h1>
            <p className="text-sm text-gray-500">
              Pray Hard &middot; Work Smart &middot; Keep Yasashi — PT. Yasashi Teknik
            </p>
          </div>
        </div>
        <Link to="/run" className="btn-primary">
          ▶️ Mulai Run
        </Link>
      </div>

      {!profile?.organisasi_id && <NoOrgNotice />}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Program Aktif" value={loading ? "…" : stats.programCount} icon="🧩" />
        <StatCard label="OK Hari Ini" value={loading ? "…" : stats.okToday} icon="✅" accent="text-green-600" />
        <StatCard label="NG Hari Ini" value={loading ? "…" : stats.ngToday} icon="⛔" accent="text-red-600" />
        <StatCard
          label="Total Inspeksi"
          value={loading ? "…" : stats.okToday + stats.ngToday}
          icon="📊"
        />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="card">
          <h2 className="font-semibold mb-3">Status Koneksi Kamera</h2>
          <StatusRow label="Browser mendukung getUserMedia (webcam/USB)" ok={cameraSupported} />
          <p className="text-xs text-gray-400 mt-2">
            Koneksi kamera Ethernet (MJPEG) dikonfigurasi per Program di menu Program Setup.
          </p>
        </div>
        <div className="card">
          <h2 className="font-semibold mb-3">Status Koneksi I/O</h2>
          <StatusRow label="Browser mendukung Web Serial (Arduino)" ok={serialSupported} />
          <p className="text-xs text-gray-400 mt-2">
            Koneksi PLC (Modbus-TCP) dijembatani lewat Edge Function <code>plc-io</code>.
          </p>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <QuickLink to="/programs/new" title="+ New Program" desc="Buat Program inspeksi baru" />
        <QuickLink to="/image-library" title="Image Library" desc="Kelola gambar Mastering & referensi" />
        <QuickLink to="/logs" title="Logs" desc="Riwayat inspeksi & export laporan" />
      </div>
    </div>
  );
}

function StatCard({ label, value, icon, accent = "text-gray-900" }) {
  return (
    <div className="card">
      <div className="text-2xl">{icon}</div>
      <div className={`text-2xl font-bold mt-2 ${accent}`}>{value}</div>
      <div className="text-xs text-gray-500 mt-1">{label}</div>
    </div>
  );
}

function StatusRow({ label, ok }) {
  return (
    <div className="flex items-center justify-between text-sm py-1">
      <span className="text-gray-600">{label}</span>
      <span className={ok ? "text-green-600 font-medium" : "text-red-500 font-medium"}>
        {ok ? "Siap" : "Tidak tersedia"}
      </span>
    </div>
  );
}

function QuickLink({ to, title, desc }) {
  return (
    <Link to={to} className="card hover:shadow-md transition block">
      <div className="font-semibold text-yasashi-green-dark">{title}</div>
      <div className="text-sm text-gray-500 mt-1">{desc}</div>
    </Link>
  );
}
