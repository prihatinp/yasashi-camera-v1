// =====================================================================
// YASASHI CAMERA V1.0 — SUPABASE EDGE FUNCTION: ai-inference (v2)
// Lokasi project   : supabase/functions/ai-inference/index.ts
// Deploy           : supabase functions deploy ai-inference
// Runtime          : Deno (Supabase Edge Functions)
//
// PERUBAHAN vs v1: satu Program (bekas "Project") sekarang bisa punya
// BANYAK Tool aktif sekaligus (tabel program_tools), persis seperti
// Keyence IV4. Fungsi ini menjalankan SEMUA tool aktif milik sebuah
// Program dalam satu eksekusi Run/Trigger, lalu menggabungkan hasilnya
// (AND/OR sesuai programs.decision_logic) menjadi Judgment akhir.
//
// Env vars yang wajib di-set (supabase secrets set ...):
//   HF_API_TOKEN               -> token Hugging Face (free tier, scope "read")
//   SUPABASE_URL                -> otomatis tersedia di runtime Edge Function
//   SUPABASE_SERVICE_ROLE_KEY   -> untuk baca/tulis tabel tanpa terkena RLS
// =====================================================================

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createWorker } from "npm:tesseract.js@5.1.1";
import { compareImages, cropRgba, decodeImageToRgba, encodeRgbaToJpeg, type Roi } from "./imageSimilarity.ts";
import { correctRoiPosition } from "./positionCorrection.ts";
// barcodeReader.ts (ZXing) di-import dinamis (lazy) di dalam runBarcode(), bukan di sini —
// supaya kalau library itu gagal dimuat, hanya Tool Barcode yang kena, bukan seluruh
// Edge Function (semua Tool lain gagal ikut error kalau import top-level ini bermasalah).

// ---------------------------------------------------------------------
// KONFIGURASI
// ---------------------------------------------------------------------
const HF_API_TOKEN = Deno.env.get("HF_API_TOKEN")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Model Hugging Face per AI Tool. HF sering mengubah daftar model yang didukung
// provider "hf-inference" gratis mereka, jadi tiap tugas punya beberapa kandidat
// cadangan — hfRequestWithFallback() coba satu-satu sampai ada yang berhasil.
//
// Catatan: image-feature-extraction & image-to-text sudah TIDAK didukung lagi
// oleh provider gratis hf-inference (dicek langsung di huggingface.co/models,
// hasilnya kosong) — Differentiate/Identify pakai perbandingan gambar klasik
// (imageSimilarity.ts) dan OCR pakai Tesseract.js, bukan Hugging Face lagi.
// Object detection masih didukung sehingga Count/Trigger/Through Count tetap
// pakai Hugging Face.
const HF_MODELS = {
  detection: [
    "facebook/detr-resnet-50",
    "hustvl/yolos-tiny",
  ], // Count / Through Count / Trigger (object detection)
};

// api-inference.huggingface.co (legacy) sudah dimatikan Hugging Face — pakai
// domain router baru mereka (Inference Providers), path "hf-inference" untuk
// model yang di-serve langsung oleh HF sendiri (bukan provider pihak ketiga).
const HF_BASE_URL = "https://router.huggingface.co/hf-inference/models";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*", // ganti ke domain GitHub Pages kamu di production
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ---------------------------------------------------------------------
// TYPES
// ---------------------------------------------------------------------
interface InferenceRequest {
  program_id: string;
  image_base64: string;             // gambar hasil capture saat Run, tanpa prefix "data:image/..."
  trigger_source?: "internal" | "external";
  operator_id?: string;
}

interface ToolResult {
  program_tool_id: string;
  ai_tool: string;
  hasil: "OK" | "NG" | "UNKNOWN";
  confidence: number | null;
  count_value: number | null;
  ocr_text: string | null;
  extra_data: Record<string, unknown>;
}

// =====================================================================
// MAIN HANDLER
// =====================================================================
serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  try {
    if (req.method !== "POST") {
      return jsonError("Method not allowed", 405);
    }

    const body = (await req.json()) as InferenceRequest;
    if (!body.program_id || !body.image_base64) {
      return jsonError("program_id dan image_base64 wajib diisi", 400);
    }

    // 1) Ambil konfigurasi Program (decision_logic, organisasi, dll)
    const { data: program, error: programErr } = await supabase
      .from("programs")
      .select("id, organisasi_id, decision_logic, trigger_mode, is_ready_to_run, master_image_url")
      .eq("id", body.program_id)
      .single();

    if (programErr || !program) {
      return jsonError(`Program tidak ditemukan: ${programErr?.message ?? ""}`, 404);
    }

    if (!program.is_ready_to_run) {
      return jsonError(
        "Program belum siap dijalankan. Pastikan minimal 1 Tool sudah di-Save dan Level Adjustment selesai.",
        400,
      );
    }

    // 2) Ambil semua Tool aktif milik Program ini (bisa lebih dari 1, urut tool_order)
    const { data: tools, error: toolsErr } = await supabase
      .from("program_tools")
      .select("id, ai_tool, roi_config, reference_image_url, reference_image_urls, threshold")
      .eq("program_id", program.id)
      .eq("is_active", true)
      .eq("is_saved", true)
      .order("tool_order", { ascending: true });

    if (toolsErr) return jsonError(`Gagal ambil daftar Tool: ${toolsErr.message}`, 500);
    if (!tools || tools.length === 0) {
      return jsonError("Program ini belum memiliki Tool aktif (Add Tools/Save Tools dahulu).", 400);
    }

    // 3) Jalankan SETIAP tool secara berurutan, kumpulkan hasil per-tool
    const rawCurrentBytes = base64ToUint8Array(body.image_base64);
    const toolResults: ToolResult[] = [];
    for (const tool of tools) {
      let result: Omit<ToolResult, "program_tool_id" | "ai_tool">;
      try {
        const workingBytes = await resolveWorkingImage(program, tool, rawCurrentBytes);
        switch (tool.ai_tool) {
          case "differentiate":
            result = await runDifferentiate(tool, workingBytes);
            break;
          case "identify":
            result = await runIdentify(tool, workingBytes);
            break;
          case "count":
          case "through_count":
            result = await runCount(tool, workingBytes);
            break;
          case "ocr":
            result = await runOCR(tool, workingBytes);
            break;
          case "trigger":
            result = await runTrigger(tool, workingBytes);
            break;
          case "barcode":
            result = await runBarcode(tool, workingBytes);
            break;
          default:
            result = { hasil: "UNKNOWN", confidence: null, count_value: null, ocr_text: null, extra_data: {} };
        }
      } catch (err) {
        // Satu Tool gagal (mis. cold-start Tesseract) tidak boleh menggagalkan
        // seluruh Run — tool lain dalam Program yang sama tetap harus jalan.
        console.error(`Tool ${tool.ai_tool} (${tool.id}) gagal:`, (err as Error).message);
        result = {
          hasil: "UNKNOWN",
          confidence: null,
          count_value: null,
          ocr_text: null,
          extra_data: { error: (err as Error).message },
        };
      }
      toolResults.push({ program_tool_id: tool.id, ai_tool: tool.ai_tool, ...result });
    }

    // 4) Gabungkan hasil semua tool -> Judgment akhir Program (Langkah 7)
    const combineMode: string = program.decision_logic?.combine ?? "AND";
    const finalHasil = combineResults(toolResults, combineMode);

    // 5) Upload gambar hasil capture Run ke Storage
    const imagePath = `${program.organisasi_id}/${program.id}/${crypto.randomUUID()}.jpg`;
    const { error: uploadErr } = await supabase.storage
      .from("inspection-images")
      .upload(imagePath, rawCurrentBytes, { contentType: "image/jpeg" });
    const imageUrl = uploadErr ? null : imagePath;

    // 6) Simpan log akhir (inspection_logs) + rincian per tool (inspection_log_tool_results)
    const { data: logRow, error: logErr } = await supabase
      .from("inspection_logs")
      .insert({
        organisasi_id: program.organisasi_id,
        program_id: program.id,
        hasil: finalHasil,
        trigger_source: body.trigger_source ?? "internal",
        image_url: imageUrl,
        operator_id: body.operator_id ?? null,
      })
      .select()
      .single();

    if (logErr) {
      console.error("Gagal simpan inspection_logs:", logErr.message);
    } else {
      const rows = toolResults.map((r) => ({
        inspection_log_id: logRow.id,
        program_tool_id: r.program_tool_id,
        ai_tool: r.ai_tool,
        hasil: r.hasil,
        confidence: r.confidence,
        count_value: r.count_value,
        ocr_text: r.ocr_text,
        extra_data: r.extra_data,
      }));
      const { error: detailErr } = await supabase.from("inspection_log_tool_results").insert(rows);
      if (detailErr) console.error("Gagal simpan inspection_log_tool_results:", detailErr.message);
    }

    // 7) Response ke frontend: Judgment akhir + rincian tiap tool
    return new Response(
      JSON.stringify({
        hasil: finalHasil,          // Langkah 7: Result OK/NG (gabungan)
        log_id: logRow?.id ?? null,
        tool_results: toolResults,  // rincian per tool, untuk ditampilkan jika perlu
      }),
      { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error(err);
    return jsonError(`Internal error: ${(err as Error).message}`, 500);
  }
});

// =====================================================================
// GABUNGKAN HASIL ANTAR TOOL -> JUDGMENT AKHIR PROGRAM
// =====================================================================
function combineResults(results: ToolResult[], mode: string): "OK" | "NG" | "UNKNOWN" {
  const relevant = results.filter((r) => r.hasil !== "UNKNOWN");
  if (relevant.length === 0) return "UNKNOWN";

  if (mode === "OR") {
    return relevant.some((r) => r.hasil === "OK") ? "OK" : "NG";
  }
  // default: "AND" -> semua tool harus OK
  return relevant.every((r) => r.hasil === "OK") ? "OK" : "NG";
}

// =====================================================================
// SIAPKAN GAMBAR KERJA PER TOOL: crop ke ROI (+ Position Compensation ala
// Keyence IV series jika diaktifkan) sebelum dianalisa. ROI penuh (0,0,1,1)
// = tidak di-crop, pakai frame utuh apa adanya (perilaku lama tetap sama).
// =====================================================================
function isFullFrameRoi(roi: Roi | undefined | null): boolean {
  return !roi || (roi.x <= 0 && roi.y <= 0 && roi.width >= 1 && roi.height >= 1);
}

async function resolveWorkingImage(program: any, tool: any, rawCurrentBytes: Uint8Array): Promise<Uint8Array> {
  const roi: Roi | undefined = tool.roi_config;
  if (isFullFrameRoi(roi)) return rawCurrentBytes;

  let effectiveRoi = roi as Roi;
  const posCorrection = (roi as any)?.position_correction;
  if (posCorrection?.enabled && program.master_image_url) {
    try {
      const masterBytes = await downloadReferenceBytes(program.master_image_url);
      const margin = posCorrection.search_margin ?? 0.15;
      const corrected = correctRoiPosition(masterBytes, rawCurrentBytes, effectiveRoi, margin);
      effectiveRoi = corrected.roi;
    } catch (err) {
      // Position Compensation gagal (mis. gambar Mastering tidak terbaca) -> tetap
      // pakai ROI asli daripada menggagalkan seluruh Tool.
      console.error("Position Compensation gagal, pakai ROI asli:", (err as Error).message);
    }
  }

  const currentImg = decodeImageToRgba(rawCurrentBytes);
  const cropped = cropRgba(currentImg, effectiveRoi);
  return encodeRgbaToJpeg(cropped);
}

// =====================================================================
// AI TOOL: DIFFERENTIATE
// =====================================================================
async function runDifferentiate(tool: any, currentBytes: Uint8Array) {
  if (!tool.reference_image_url) {
    throw new Error("Tool Differentiate belum punya reference image (selesaikan Save Tools/Learn dahulu)");
  }

  const refBytes = await downloadReferenceBytes(tool.reference_image_url);
  const similarity = compareImages(refBytes, currentBytes);

  const minSimilarity = tool.threshold?.similarity_min ?? 0.85; // hasil Level Adjustment
  const hasil = similarity >= minSimilarity ? "OK" : "NG";

  return {
    hasil,
    confidence: round4(similarity),
    count_value: null,
    ocr_text: null,
    extra_data: { similarity, min_similarity: minSimilarity, method: "ssim" },
  };
}

// =====================================================================
// AI TOOL: IDENTIFY (multi-referensi)
// =====================================================================
async function runIdentify(tool: any, currentBytes: Uint8Array) {
  const refs: { label: string; url: string }[] = tool.reference_image_urls ?? [];
  if (refs.length === 0) {
    throw new Error("Tool Identify butuh minimal 1 reference_image_urls (label + url)");
  }

  let bestLabel = "UNKNOWN";
  let bestScore = -1;
  for (const ref of refs) {
    const refBytes = await downloadReferenceBytes(ref.url);
    const score = compareImages(refBytes, currentBytes);
    if (score > bestScore) {
      bestScore = score;
      bestLabel = ref.label;
    }
  }

  const minSimilarity = tool.threshold?.similarity_min ?? 0.75;
  const hasil = bestScore >= minSimilarity ? "OK" : "NG";

  return {
    hasil,
    confidence: round4(bestScore),
    count_value: null,
    ocr_text: null,
    extra_data: { matched_label: bestLabel, score: bestScore, method: "ssim" },
  };
}

// =====================================================================
// AI TOOL: COUNT / THROUGH COUNT
// =====================================================================
async function runCount(tool: any, currentBytes: Uint8Array) {
  const { detections, model } = await hfDetectObjects(currentBytes);

  const minScore = tool.threshold?.detection_min_score ?? 0.6;
  const filtered = detections.filter((d) => d.score >= minScore);
  const count = filtered.length;

  const expectedCount = tool.threshold?.expected_count;
  const hasil =
    expectedCount === undefined || expectedCount === null
      ? "UNKNOWN"
      : count === expectedCount
      ? "OK"
      : "NG";

  return {
    hasil,
    confidence: filtered.length
      ? round4(filtered.reduce((s, d) => s + d.score, 0) / filtered.length)
      : null,
    count_value: count,
    ocr_text: null,
    extra_data: { detections: filtered, model },
  };
}

// =====================================================================
// AI TOOL: OCR
// =====================================================================
async function runOCR(tool: any, currentBytes: Uint8Array) {
  const text = await runTesseractOCR(currentBytes);

  const expectedPattern: string | undefined = tool.threshold?.expected_pattern;
  let hasil: "OK" | "NG" | "UNKNOWN" = "UNKNOWN";
  if (expectedPattern) {
    try {
      hasil = new RegExp(expectedPattern).test(text) ? "OK" : "NG";
    } catch {
      hasil = "UNKNOWN";
    }
  }

  return {
    hasil,
    confidence: null,
    count_value: null,
    ocr_text: text,
    extra_data: { engine: "tesseract.js", expected_pattern: expectedPattern ?? null },
  };
}

// =====================================================================
// AI TOOL: TRIGGER (deteksi kehadiran objek)
// =====================================================================
async function runTrigger(tool: any, currentBytes: Uint8Array) {
  const { detections, model } = await hfDetectObjects(currentBytes);
  const minScore = tool.threshold?.detection_min_score ?? 0.5;
  const present = detections.some((d) => d.score >= minScore);

  return {
    hasil: present ? "OK" : "NG",
    confidence: detections.length ? round4(Math.max(...detections.map((d) => d.score))) : null,
    count_value: detections.length,
    ocr_text: null,
    extra_data: { present, model },
  };
}

// =====================================================================
// AI TOOL: BARCODE / QR CODE
// =====================================================================
async function runBarcode(tool: any, currentBytes: Uint8Array) {
  const { readBarcodeOrQr } = await import("./barcodeReader.ts");
  const decoded = readBarcodeOrQr(currentBytes);
  const expectedPattern: string | undefined = tool.threshold?.expected_pattern;

  let hasil: "OK" | "NG" | "UNKNOWN" = "UNKNOWN";
  if (!decoded) {
    hasil = "NG"; // tidak ada barcode/QR yang terbaca di ROI
  } else if (expectedPattern) {
    try {
      hasil = new RegExp(expectedPattern).test(decoded.text) ? "OK" : "NG";
    } catch {
      hasil = "UNKNOWN";
    }
  } else {
    hasil = "OK"; // berhasil terbaca, tanpa validasi pola spesifik
  }

  return {
    hasil,
    confidence: null,
    count_value: null,
    ocr_text: decoded?.text ?? null,
    extra_data: { format: decoded?.format ?? null, engine: "zxing", expected_pattern: expectedPattern ?? null },
  };
}

// =====================================================================
// HELPER: PANGGIL HUGGING FACE INFERENCE API
// =====================================================================
async function hfRequest(model: string, body: Uint8Array | Record<string, unknown>) {
  const isBinary = body instanceof Uint8Array;
  const res = await fetch(`${HF_BASE_URL}/${model}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${HF_API_TOKEN}`,
      "Content-Type": isBinary ? "application/octet-stream" : "application/json",
    },
    body: isBinary ? body : JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    if (res.status === 503) {
      throw new Error("AI Engine sedang warming up, coba lagi beberapa detik lagi.");
    }
    throw new Error(`Hugging Face error (${res.status}): ${errText}`);
  }

  return res.json();
}

/**
 * Coba tiap model kandidat berurutan sampai ada yang berhasil (2xx). HF sering
 * mengubah daftar model yang didukung provider gratis "hf-inference", jadi satu
 * model bisa tiba-tiba menghasilkan "Model not supported by provider" — model
 * berikutnya di daftar akan dicoba secara otomatis. Melempar error terakhir jika
 * semua kandidat gagal.
 */
async function hfRequestWithFallback(
  models: string[],
  body: Uint8Array | Record<string, unknown>,
): Promise<{ result: unknown; model: string }> {
  let lastError: Error | null = null;
  for (const model of models) {
    try {
      const result = await hfRequest(model, body);
      return { result, model };
    } catch (err) {
      lastError = err as Error;
    }
  }
  throw lastError ?? new Error("Tidak ada model Hugging Face yang berhasil dipanggil.");
}

async function downloadReferenceBytes(path: string): Promise<Uint8Array> {
  const { data, error } = await supabase.storage.from("reference-images").download(path);
  if (error || !data) throw new Error(`Gagal ambil reference image: ${error?.message}`);
  return new Uint8Array(await data.arrayBuffer());
}

async function hfDetectObjects(
  bytes: Uint8Array,
): Promise<{ detections: { label: string; score: number }[]; model: string }> {
  const { result, model } = await hfRequestWithFallback(HF_MODELS.detection, bytes);
  return { detections: (result as any[]).map((r) => ({ label: r.label, score: r.score })), model };
}

// =====================================================================
// OCR: Tesseract.js (WASM, jalan langsung di Edge Function, tanpa API luar)
// Worker di-cache di module scope supaya instance Edge Function yang "warm"
// tidak perlu re-init tiap request.
// =====================================================================
let tesseractWorkerPromise: ReturnType<typeof createWorker> | null = null;

async function getTesseractWorker() {
  if (!tesseractWorkerPromise) {
    tesseractWorkerPromise = createWorker("eng");
  }
  return tesseractWorkerPromise;
}

async function runTesseractOCR(bytes: Uint8Array): Promise<string> {
  const worker = await getTesseractWorker();
  const {
    data: { text },
  } = await worker.recognize(bytes);
  return text.trim();
}

// =====================================================================
// HELPER: UTILITAS UMUM
// =====================================================================
function base64ToUint8Array(base64: string): Uint8Array {
  const clean = base64.includes(",") ? base64.split(",")[1] : base64;
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}
