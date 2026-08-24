import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../context/AuthContext.jsx";

export default function AccountPage() {
  const { profile, user, refreshProfile } = useAuth();
  const [nama, setNama] = useState(profile?.nama ?? "");
  const [orgName, setOrgName] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!profile?.organisasi_id) return;
    supabase
      .from("organisasi")
      .select("nama_organisasi")
      .eq("id", profile.organisasi_id)
      .single()
      .then(({ data }) => setOrgName(data?.nama_organisasi ?? ""));
  }, [profile?.organisasi_id]);

  async function handleSave() {
    setSaving(true);
    setMessage("");
    const { error } = await supabase.from("profiles").update({ nama }).eq("id", user.id);
    setSaving(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    setMessage("Profil berhasil diperbarui.");
    refreshProfile();
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <h1 className="text-xl font-bold">Account / Settings</h1>

      <div className="card space-y-4">
        <div>
          <label className="label">Email</label>
          <input className="input bg-gray-50" value={profile?.email ?? ""} disabled />
        </div>
        <div>
          <label className="label">Nama</label>
          <input className="input" value={nama} onChange={(e) => setNama(e.target.value)} />
        </div>
        <div>
          <label className="label">Role</label>
          <input className="input bg-gray-50 capitalize" value={profile?.role ?? ""} disabled />
        </div>
        <div>
          <label className="label">Organisasi</label>
          <input className="input bg-gray-50" value={orgName || "Belum terhubung"} disabled />
        </div>
        {message && <p className="text-sm text-yasashi-green-dark">{message}</p>}
        <button className="btn-primary" disabled={saving} onClick={handleSave}>
          {saving ? "Menyimpan..." : "Simpan Perubahan"}
        </button>
      </div>
    </div>
  );
}
