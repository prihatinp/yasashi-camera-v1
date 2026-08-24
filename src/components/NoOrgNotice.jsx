export default function NoOrgNotice() {
  return (
    <div className="card border-yellow-200 bg-yellow-50 text-yellow-800">
      <p className="font-medium">Akun kamu belum terhubung ke organisasi.</p>
      <p className="text-sm mt-1">
        Minta admin untuk mengisi kolom <code>organisasi_id</code> pada tabel{" "}
        <code>profiles</code> (Supabase Table Editor) sesuai baris email kamu, lalu muat ulang
        halaman ini.
      </p>
    </div>
  );
}
