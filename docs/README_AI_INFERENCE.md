# Panduan: Edge Function `ai-inference` (Yasashi Camera V1.0)

File `supabase-edge-function-ai-inference.ts` menjembatani **Frontend (GitHub Pages)** →
**Supabase Edge Function** → **Hugging Face Inference API**, dengan model operasional
mengikuti Keyence IV4: **satu Program bisa punya banyak Tool aktif sekaligus**, dan hasil
akhirnya (Judgment OK/NG) adalah gabungan dari seluruh Tool tersebut.

## 1. Struktur Folder di Project
```
supabase/
  functions/
    ai-inference/
      index.ts   <-- isi dari supabase-edge-function-ai-inference.ts
```

## 2. Setup Token & Secrets
```bash
supabase secrets set HF_API_TOKEN=hf_xxxxxxxxxxxxxxxx
```
`SUPABASE_URL` & `SUPABASE_SERVICE_ROLE_KEY` otomatis tersedia di runtime Edge Function.

## 3. Deploy
```bash
supabase functions deploy ai-inference
```

## 4. Bagaimana Fungsi Ini Mengikuti Alur Program (IV4-style)
1. **New Program & Mastering** — sudah dilakukan di frontend sebelumnya (menyimpan
   `programs.master_image_url`). Edge Function ini dipanggil **setelah** Program siap Run.
2. **Add Tools / Auto Learning + Save Tools + Level Adjustment** — setiap Tool tersimpan
   sebagai satu baris di `program_tools`, lengkap dengan `reference_image_url` dan
   `threshold` (hasil Level Adjustment). Fungsi ini membaca SEMUA baris `program_tools`
   milik Program yang `is_saved = true` dan `is_active = true`.
3. **Mode Running** — saat trigger (internal/eksternal) terjadi, frontend mengirim 1 gambar
   hasil capture ke fungsi ini bersama `program_id`.
4. Fungsi menjalankan **setiap Tool secara berurutan** (sesuai `tool_order`) terhadap gambar
   yang sama, mengumpulkan hasil per-tool.
5. Hasil per-tool digabung menjadi **Judgment akhir Program** mengikuti `programs.decision_logic`:
   - `{"combine": "AND"}` → semua Tool harus OK agar Program = OK (default, umum di IV4).
   - `{"combine": "OR"}` → cukup salah satu Tool OK agar Program = OK.
6. **Result OK/NG** dikembalikan ke frontend, sekaligus disimpan:
   - `inspection_logs` — 1 baris = Judgment akhir Program untuk 1 eksekusi Run.
   - `inspection_log_tool_results` — rincian hasil tiap Tool (bisa >1 baris per eksekusi).

## 5. Model Hugging Face yang Dipakai (default, bisa diganti)
| AI Tool | Model | Tugas |
|---|---|---|
| Differentiate | `facebook/dinov2-base` | image feature-extraction → cosine similarity ke reference Tool |
| Identify | `facebook/dinov2-base` | similarity ke multi-referensi, ambil skor tertinggi |
| Count / Through Count | `facebook/detr-resnet-50` | object detection → hitung jumlah deteksi di atas threshold |
| OCR | `microsoft/trocr-base-printed` | image-to-text |
| Trigger | `facebook/detr-resnet-50` | deteksi kehadiran objek (presence) |

Ganti model cukup di objek `HF_MODELS` di bagian atas file.

## 6. Format Request dari Frontend
```ts
const { data: { session } } = await supabase.auth.getSession();

const res = await fetch(`${SUPABASE_URL}/functions/v1/ai-inference`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${session?.access_token}`,
    apikey: SUPABASE_ANON_KEY,
  },
  body: JSON.stringify({
    program_id: currentProgram.id,
    image_base64: capturedImageBase64,      // dari canvas.toDataURL() / frame kamera
    trigger_source: "internal",             // atau "external" jika dipicu sinyal luar
    operator_id: currentUser.id,
  }),
});

const result = await res.json();
```

## 7. Format Response
```json
{
  "hasil": "OK",
  "log_id": "uuid-log-akhir",
  "tool_results": [
    {
      "program_tool_id": "uuid-tool-1",
      "ai_tool": "differentiate",
      "hasil": "OK",
      "confidence": 0.9123,
      "count_value": null,
      "ocr_text": null,
      "extra_data": { "similarity": 0.9123, "min_similarity": 0.85 }
    },
    {
      "program_tool_id": "uuid-tool-2",
      "ai_tool": "ocr",
      "hasil": "OK",
      "confidence": null,
      "count_value": null,
      "ocr_text": "A1B23C4",
      "extra_data": { "expected_pattern": "^[A-Z0-9]{7}$" }
    }
  ]
}
```
Frontend menampilkan `hasil` (Judgment akhir Program, besar & jelas — hijau/merah), dan bisa
juga menampilkan rincian `tool_results` per Tool jika operator perlu tahu tool mana yang NG.

## 8. Catatan Penting
- **Program harus "siap Run"**: fungsi menolak eksekusi jika `programs.is_ready_to_run = false`
  (frontend bertanggung jawab mengeset flag ini setelah minimal 1 Tool selesai Save + Level Adjustment).
- **Cold start** Hugging Face (`503`) ditangani dan dikembalikan sebagai pesan "AI Engine sedang
  warming up..." — tampilkan sebagai loading state, bukan error keras.
- **Trigger Eksternal**: saat `programs.trigger_mode = 'external'`, sinyal fisik (PLC/Arduino)
  memicu frontend untuk capture + panggil fungsi ini dengan `trigger_source: "external"` —
  fungsi ini sendiri tidak mendengarkan hardware secara langsung (browser tidak bisa),
  jadi listener hardware tetap berjalan di sisi frontend (Web Serial API untuk Arduino) atau
  lewat polling/webhook sederhana untuk PLC.
- **Threshold per Tool** (hasil Level Adjustment) disimpan di `program_tools.threshold`, bukan
  lagi di level Program — karena satu Program bisa punya banyak Tool dengan sensitivitas berbeda.
- Untuk V2.0 (Object Detection custom defect halus), tambahkan `case` baru di
  `switch (tool.ai_tool)` — arsitektur per-tool ini sudah dirancang modular untuk itu.
