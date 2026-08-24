import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

/** Chatbot rule-based sederhana: cocokkan pertanyaan user dengan keywords/pertanyaan di chatbot_kb. */
export function useChatbotKb() {
  const [kb, setKb] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("chatbot_kb")
      .select("*")
      .then(({ data }) => {
        setKb(data ?? []);
        setLoading(false);
      });
  }, []);

  function findAnswer(query) {
    const q = query.toLowerCase();
    const words = q.split(/\s+/).filter((w) => w.length > 2);

    let best = null;
    let bestScore = 0;
    for (const row of kb) {
      let score = 0;
      const keywordHits = (row.keywords ?? []).filter((k) => q.includes(k.toLowerCase()));
      score += keywordHits.length * 2;
      const pertanyaanWords = row.pertanyaan.toLowerCase();
      score += words.filter((w) => pertanyaanWords.includes(w)).length;

      if (score > bestScore) {
        bestScore = score;
        best = row;
      }
    }

    if (best && bestScore > 0) return best.jawaban;
    return "Maaf, saya belum menemukan jawaban untuk pertanyaan itu di knowledge base. Coba kata kunci lain, mis. \"program\", \"mastering\", \"trigger\", atau \"kamera\".";
  }

  return { kb, loading, findAnswer };
}
