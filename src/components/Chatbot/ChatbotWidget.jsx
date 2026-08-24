import { useState } from "react";
import { useChatbotKb } from "../../hooks/useChatbotKb.js";

export default function ChatbotWidget() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([
    { role: "bot", text: "Halo! Ada yang bisa saya bantu seputar penggunaan Yasashi Camera?" },
  ]);
  const { findAnswer } = useChatbotKb();

  function handleSend(e) {
    e.preventDefault();
    if (!input.trim()) return;
    const question = input.trim();
    const answer = findAnswer(question);
    setMessages((prev) => [...prev, { role: "user", text: question }, { role: "bot", text: answer }]);
    setInput("");
  }

  return (
    <>
      <button
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-5 right-5 h-14 w-14 rounded-full bg-yasashi-green text-white text-2xl shadow-lg flex items-center justify-center z-40"
        aria-label="Chatbot / Help"
      >
        💬
      </button>

      {open && (
        <div className="fixed bottom-24 right-5 w-80 max-h-[28rem] bg-white rounded-2xl shadow-xl border border-gray-100 flex flex-col z-40">
          <div className="px-4 py-3 border-b border-gray-100 font-semibold">Yasashi Help</div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2 text-sm">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`rounded-xl px-3 py-2 max-w-[85%] ${
                  m.role === "bot" ? "bg-gray-100 text-gray-700" : "bg-yasashi-green text-white ml-auto"
                }`}
              >
                {m.text}
              </div>
            ))}
          </div>
          <form onSubmit={handleSend} className="p-3 border-t border-gray-100 flex gap-2">
            <input
              className="input !py-2"
              placeholder="Tanya sesuatu..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
            />
            <button type="submit" className="btn-primary !py-2 !px-3">
              Kirim
            </button>
          </form>
        </div>
      )}
    </>
  );
}
