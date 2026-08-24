// =====================================================================
// YASASHI CAMERA V1.0 — SUPABASE EDGE FUNCTION: plc-io
// Lokasi   : supabase/functions/plc-io/index.ts
// Deploy   : supabase functions deploy plc-io
// Runtime  : Deno (Supabase Edge Functions)
//
// Jembatan Modbus-TCP sederhana untuk mengirim hasil Judgment (OK/NG) ke PLC
// via Ethernet. Browser tidak bisa membuka raw TCP socket, jadi permintaan
// dari frontend diteruskan lewat Edge Function ini yang memakai Deno.connect
// untuk membuka koneksi TCP langsung ke PLC dan mengirim frame Modbus-TCP
// "Write Single Coil" (function code 0x05).
//
// Body request dari frontend:
//   {
//     connection_info: { ip: "192.168.1.10", port: 502, protocol: "modbus_tcp" },
//     mapping: { coil: 1, value: true }
//   }
// =====================================================================

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface PlcIoRequest {
  connection_info: { ip: string; port: number; protocol?: string };
  mapping: { coil: number; value: boolean } | null | undefined;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });

  try {
    if (req.method !== "POST") return jsonError("Method not allowed", 405);

    const body = (await req.json()) as PlcIoRequest;
    const { connection_info, mapping } = body;

    if (!connection_info?.ip || !connection_info?.port) {
      return jsonError("connection_info.ip dan connection_info.port wajib diisi", 400);
    }
    if (!mapping || typeof mapping.coil !== "number") {
      return jsonError("mapping.coil wajib diisi (Program/I-O Settings belum memetakan hasil ini)", 400);
    }

    await writeSingleCoil(connection_info.ip, connection_info.port, mapping.coil, !!mapping.value);

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error(err);
    return jsonError(`Gagal mengirim sinyal ke PLC: ${(err as Error).message}`, 500);
  }
});

// =====================================================================
// MODBUS-TCP: WRITE SINGLE COIL (function code 0x05)
// =====================================================================
async function writeSingleCoil(ip: string, port: number, coilAddress: number, value: boolean) {
  const conn = await Promise.race([
    Deno.connect({ hostname: ip, port }),
    timeout(5000, "Timeout menghubungi PLC (cek IP/port dan jaringan)"),
  ]);

  try {
    const transactionId = Math.floor(Math.random() * 0xffff);
    const frame = buildWriteSingleCoilFrame(transactionId, coilAddress, value);
    await conn.write(frame);

    const responseBuf = new Uint8Array(256);
    const bytesRead = await Promise.race([
      conn.read(responseBuf),
      timeout(5000, "Timeout menunggu balasan dari PLC"),
    ]);

    if (bytesRead === null) throw new Error("PLC menutup koneksi tanpa balasan");
  } finally {
    conn.close();
  }
}

function buildWriteSingleCoilFrame(transactionId: number, coilAddress: number, value: boolean): Uint8Array {
  const unitId = 1;
  const functionCode = 0x05;
  const outputValue = value ? 0xff00 : 0x0000;
  const pduLength = 6; // unitId + functionCode + address(2) + value(2)

  const buf = new Uint8Array(6 + pduLength);
  const view = new DataView(buf.buffer);

  view.setUint16(0, transactionId); // Transaction Identifier
  view.setUint16(2, 0x0000); // Protocol Identifier (selalu 0 untuk Modbus)
  view.setUint16(4, pduLength); // Length (byte setelah field ini)
  buf[6] = unitId; // Unit Identifier
  buf[7] = functionCode;
  view.setUint16(8, coilAddress);
  view.setUint16(10, outputValue);

  return buf;
}

function timeout(ms: number, message: string): Promise<never> {
  return new Promise((_, reject) => setTimeout(() => reject(new Error(message)), ms));
}

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}
