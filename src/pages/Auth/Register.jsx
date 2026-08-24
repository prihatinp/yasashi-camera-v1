import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import YasashiLogo from "../../components/YasashiLogo.jsx";

export default function Register() {
  const [nama, setNama] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setInfo("");
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { nama } },
    });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    if (data.session) {
      navigate("/dashboard", { replace: true });
    } else {
      setInfo("Pendaftaran berhasil. Silakan cek email untuk verifikasi, lalu login.");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm card">
        <div className="flex justify-center mb-6">
          <YasashiLogo size={56} />
        </div>
        <h1 className="text-lg font-semibold text-center mb-1">Daftar Akun</h1>
        <p className="text-sm text-gray-500 text-center mb-6">
          Buat akun baru untuk Yasashi Camera V1.0
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Nama</label>
            <input
              className="input"
              required
              value={nama}
              onChange={(e) => setNama(e.target.value)}
              placeholder="Nama lengkap"
            />
          </div>
          <div>
            <label className="label">Email</label>
            <input
              type="email"
              className="input"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nama@perusahaan.com"
            />
          </div>
          <div>
            <label className="label">Password</label>
            <input
              type="password"
              className="input"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimal 6 karakter"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          {info && <p className="text-sm text-yasashi-green-dark">{info}</p>}
          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? "Memproses..." : "Daftar"}
          </button>
        </form>
        <p className="text-sm text-center text-gray-500 mt-6">
          Sudah punya akun?{" "}
          <Link to="/login" className="text-yasashi-green-dark font-medium">
            Masuk
          </Link>
        </p>
      </div>
    </div>
  );
}
