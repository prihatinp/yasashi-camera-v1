import { useChatbotKb } from "../../hooks/useChatbotKb.js";

export default function ChatbotPage() {
  const { kb, loading } = useChatbotKb();
  const kategori = [...new Set(kb.map((k) => k.kategori))];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">Chatbot / Help</h1>
        <p className="text-sm text-gray-500">
          Gunakan tombol chat 💬 di pojok kanan bawah untuk bertanya langsung, atau lihat daftar
          panduan di bawah ini.
        </p>
      </div>

      {loading && <p className="text-gray-400">Memuat...</p>}

      {kategori.map((kat) => (
        <div key={kat} className="space-y-3">
          <h2 className="font-semibold capitalize">{kat}</h2>
          <div className="grid md:grid-cols-2 gap-3">
            {kb
              .filter((k) => k.kategori === kat)
              .map((k) => (
                <div key={k.id} className="card">
                  <p className="font-medium text-sm">{k.pertanyaan}</p>
                  <p className="text-sm text-gray-500 mt-1">{k.jawaban}</p>
                </div>
              ))}
          </div>
        </div>
      ))}
    </div>
  );
}
