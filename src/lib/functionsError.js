/**
 * supabase-js membungkus error Edge Function non-2xx sebagai FunctionsHttpError dengan
 * message generik ("Edge Function returned a non-2xx status code"). Body JSON asli
 * (mis. { error: "Program belum siap dijalankan" }) ada di error.context (Response object).
 */
export async function describeFunctionError(error) {
  if (!error) return "Terjadi kesalahan tidak dikenal.";
  try {
    if (error.context && typeof error.context.json === "function") {
      const body = await error.context.clone().json();
      if (body?.error) return body.error;
    }
  } catch {
    // context bukan JSON / sudah terbaca, fallback ke message biasa
  }
  return error.message || "Terjadi kesalahan tidak dikenal.";
}
