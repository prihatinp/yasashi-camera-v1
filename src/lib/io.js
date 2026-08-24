import { supabase } from "./supabaseClient";

/**
 * Kirim hasil Judgment (OK/NG) ke seluruh I/O aktif milik sebuah Program.
 * - Arduino: lewat Web Serial (harus sudah connect() dari sisi UI, browser tidak bisa auto-connect).
 * - PLC: lewat Edge Function `plc-io` (browser tidak bisa raw TCP/Modbus langsung).
 */
export async function sendResultToIoConfigs(ioConfigs, hasil, { arduinoSendLine, arduinoConnected } = {}) {
  const results = [];
  for (const io of ioConfigs) {
    if (!io.is_active) continue;
    try {
      if (io.io_type === "arduino") {
        if (!arduinoConnected) {
          results.push({ io: io.id, ok: false, message: "Arduino belum terhubung (Web Serial)." });
          continue;
        }
        await arduinoSendLine(hasil);
        results.push({ io: io.id, ok: true });
      } else if (io.io_type === "plc") {
        const mapping = io.mapping_output?.[hasil];
        const { error } = await supabase.functions.invoke("plc-io", {
          body: { connection_info: io.connection_info, mapping },
        });
        if (error) throw error;
        results.push({ io: io.id, ok: true });
      }
    } catch (err) {
      results.push({ io: io.id, ok: false, message: err.message });
    }
  }
  return results;
}
