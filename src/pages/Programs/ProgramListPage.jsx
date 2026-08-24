import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../context/AuthContext.jsx";
import NoOrgNotice from "../../components/NoOrgNotice.jsx";

export default function ProgramListPage() {
  const { profile, isEngineer } = useAuth();
  const [programs, setPrograms] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.organisasi_id) {
      setLoading(false);
      return;
    }
    supabase
      .from("programs")
      .select("id, nama_program, camera_source, is_mastered, is_ready_to_run, created_at")
      .eq("organisasi_id", profile.organisasi_id)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setPrograms(data ?? []);
        setLoading(false);
      });
  }, [profile?.organisasi_id]);

  if (!profile?.organisasi_id) return <NoOrgNotice />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Program</h1>
        {isEngineer && (
          <Link to="/programs/new" className="btn-primary">
            + New Program
          </Link>
        )}
      </div>

      {loading && <p className="text-gray-400">Memuat...</p>}
      {!loading && programs.length === 0 && (
        <div className="card text-center text-gray-500">
          Belum ada Program. {isEngineer ? "Buat Program baru untuk mulai." : "Hubungi engineer/admin."}
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-4">
        {programs.map((p) => (
          <div key={p.id} className="card space-y-3">
            <div className="flex items-start justify-between">
              <h2 className="font-semibold">{p.nama_program}</h2>
              <span
                className={p.is_ready_to_run ? "badge-ok" : "badge-unknown"}
              >
                {p.is_ready_to_run ? "Siap Run" : "Setup"}
              </span>
            </div>
            <p className="text-xs text-gray-500 uppercase tracking-wide">{p.camera_source}</p>
            <div className="flex gap-2">
              {isEngineer && (
                <Link to={`/programs/${p.id}/setup/mastering`} className="btn-secondary flex-1 !py-1.5 text-sm">
                  Setup
                </Link>
              )}
              {p.is_ready_to_run && (
                <Link to={`/run/${p.id}`} className="btn-primary flex-1 !py-1.5 text-sm">
                  Run
                </Link>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
