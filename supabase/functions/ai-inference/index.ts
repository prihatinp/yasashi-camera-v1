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

// ---------------------------------------------------------------------
// KONFIGURASI
// ---------------------------------------------------------------------
const HF_API_TOKEN = Deno.env.get("HF_API_TOKEN")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Model Hugging Face per AI Tool (semua tersedia di free Inference API).
const HF_MODELS = {
  embedding: "facebook/dinov2-base",       // Differentiate & Identify (image similarity)
  detection: "facebook/detr-resnet-50",    // Count / Through Count / Trigger (object detection)
  ocr: "microsoft/trocr-base-printed",     // OCR (image-to-text)
};

const HF_BASE_URL = "https://api-inference.huggingface.co/models";

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
      .select("id, organisasi_id, decision_logic, trigger_mode, is_ready_to_run")
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
    const toolResults: ToolResult[] = [];
    for (const tool of tools) {
      let result: Omit<ToolResult, "program_tool_id" | "ai_tool">;
      switch (tool.ai_tool) {
        case "differentiate":
          result = await runDifferentiate(tool, body.image_base64);
          break;
        case "identify":
          result = await runIdentify(tool, body.image_base64);
          break;
        case "count":
        case "through_count":
          result = await runCount(tool, body.image_base64);
          break;
        case "ocr":
          result = await runOCR(tool, body.image_base64);
          break;
        case "trigger":
          result = await runTrigger(tool, body.image_base64);
          break;
        default:
          result = { hasil: "UNKNOWN", confidence: null, count_value: null, ocr_text: null, extra_data: {} };
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
      .upload(imagePath, base64ToUint8Array(body.image_base64), { contentType: "image/jpeg" });
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
// AI TOOL: DIFFERENTIATE
// =====================================================================
async function runDifferentiate(tool: any, imageBase64: string) {
  if (!tool.reference_image_url) {
    throw new Error("Tool Differentiate belum punya reference image (selesaikan Save Tools/Learn dahulu)");
  }

  const refEmbedding = await getEmbeddingFromStoragePath(tool.reference_image_url);
  const currentEmbedding = await getEmbeddingFromBase64(imageBase64);
  const similarity = cosineSimilarity(refEmbedding, currentEmbedding);

  const minSimilarity = tool.threshold?.similarity_min ?? 0.85; // hasil Level Adjustment
  const hasil = similarity >= minSimilarity ? "OK" : "NG";

  return {
    hasil,
    confidence: round4(similarity),
    count_value: null,
    ocr_text: null,
    extra_data: { similarity, min_similarity: minSimilarity, model: HF_MODELS.embedding },
  };
}

// =====================================================================
// AI TOOL: IDENTIFY (multi-referensi)
// =====================================================================
async function runIdentify(tool: any, imageBase64: string) {
  const refs: { label: string; url: string }[] = tool.reference_image_urls ?? [];
  if (refs.length === 0) {
    throw new Error("Tool Identify butuh minimal 1 reference_image_urls (label + url)");
  }

  const currentEmbedding = await getEmbeddingFromBase64(imageBase64);

  let bestLabel = "UNKNOWN";
  let bestScore = -1;
  for (const ref of refs) {
    const refEmbedding = await getEmbeddingFromStoragePath(ref.url);
    const score = cosineSimilarity(refEmbedding, currentEmbedding);
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
    extra_data: { matched_label: bestLabel, score: bestScore, model: HF_MODELS.embedding },
  };
}

// =====================================================================
// AI TOOL: COUNT / THROUGH COUNT
// =====================================================================
async function runCount(tool: any, imageBase64: string) {
  const detections = await hfDetectObjects(imageBase64);

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
    extra_data: { detections: filtered, model: HF_MODELS.detection },
  };
}

// =====================================================================
// AI TOOL: OCR
// =====================================================================
async function runOCR(tool: any, imageBase64: string) {
  const text = await hfImageToText(imageBase64);

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
    extra_data: { model: HF_MODELS.ocr, expected_pattern: expectedPattern ?? null },
  };
}

// =====================================================================
// AI TOOL: TRIGGER (deteksi kehadiran objek)
// =====================================================================
async function runTrigger(tool: any, imageBase64: string) {
  const detections = await hfDetectObjects(imageBase64);
  const minScore = tool.threshold?.detection_min_score ?? 0.5;
  const present = detections.some((d) => d.score >= minScore);

  return {
    hasil: present ? "OK" : "NG",
    confidence: detections.length ? round4(Math.max(...detections.map((d) => d.score))) : null,
    count_value: detections.length,
    ocr_text: null,
    extra_data: { present, model: HF_MODELS.detection },
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

async function getEmbeddingFromBase64(imageBase64: string): Promise<number[]> {
  const bytes = base64ToUint8Array(imageBase64);
  const result = await hfRequest(HF_MODELS.embedding, bytes);
  return meanPoolEmbedding(result);
}

async function getEmbeddingFromStoragePath(path: string): Promise<number[]> {
  const { data, error } = await supabase.storage.from("reference-images").download(path);
  if (error || !data) throw new Error(`Gagal ambil reference image: ${error?.message}`);
  const bytes = new Uint8Array(await data.arrayBuffer());
  const result = await hfRequest(HF_MODELS.embedding, bytes);
  return meanPoolEmbedding(result);
}

async function hfDetectObjects(imageBase64: string): Promise<{ label: string; score: number }[]> {
  const bytes = base64ToUint8Array(imageBase64);
  const result = await hfRequest(HF_MODELS.detection, bytes);
  return (result as any[]).map((r) => ({ label: r.label, score: r.score }));
}

async function hfImageToText(imageBase64: string): Promise<string> {
  const bytes = base64ToUint8Array(imageBase64);
  const result = await hfRequest(HF_MODELS.ocr, bytes);
  return (result as any[])[0]?.generated_text ?? "";
}

// =====================================================================
// HELPER: UTILITAS UMUM
// =====================================================================
function meanPoolEmbedding(raw: unknown): number[] {
  const arr = raw as number[] | number[][];
  if (Array.isArray(arr[0])) {
    const tokens = arr as number[][];
    const dims = tokens[0].length;
    const pooled = new Array(dims).fill(0);
    for (const t of tokens) {
      for (let i = 0; i < dims; i++) pooled[i] += t[i];
    }
    return pooled.map((v) => v / tokens.length);
  }
  return arr as number[];
}

function cosineSimilarity(a: number[], b: number[]): number {
  const len = Math.min(a.length, b.length);
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

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
