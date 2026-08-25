import { supabase } from "./supabaseClient";

/**
 * Panggil Edge Function ai-inference lewat fetch langsung (bukan supabase.functions.invoke()).
 * supabase-js kadang sudah "mengonsumsi" body Response sebelum kita sempat membacanya saat
 * request gagal (non-2xx), sehingga pesan error asli dari server tidak pernah sampai ke UI —
 * hanya muncul teks generik "Edge Function returned a non-2xx status code". Fetch manual
 * memberi kita kendali penuh untuk membaca body apa adanya.
 */
export async function callAiInference(payload) {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-inference`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session?.access_token}`,
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
    },
    body: JSON.stringify(payload),
  });

  const text = await res.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    // respons bukan JSON (mis. crash mentah dari runtime) -> tampilkan teks apa adanya
  }

  if (!res.ok) {
    throw new Error(body?.error || text || `Edge Function error (HTTP ${res.status})`);
  }
  return body;
}
