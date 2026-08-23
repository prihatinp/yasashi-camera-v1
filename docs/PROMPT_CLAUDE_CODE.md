# PROMPT UNTUK CLAUDE CODE — Yasashi Camera V1.0

Copy-paste seluruh isi di bawah ini ke Claude Code untuk memulai implementasi.
Lampirkan juga `supabase_schema.sql` dan `supabase/functions/ai-inference/index.ts`
(isi dari `supabase-edge-function-ai-inference.ts`) sebagai referensi struktur data & API.

---

Kamu adalah senior full-stack engineer. Bangun aplikasi web bernama **"Yasashi Camera V1.0"**,
sebuah **Built-in AI Vision Sensor** berbasis web yang meniru cara kerja & alur operasional
kamera Keyence IV4 series built-in AI. Developer/Product Owner: **Prihatin Purwadi, M.Pd.**,
untuk **PT. Yasashi Teknik (Yasashi Electric)**.

## 1. Tech Stack (WAJIB, skala FREE TIER)
- **Frontend**: React + Vite (static build), di-deploy ke **GitHub Pages**. Styling modern
  bergaya Canva (rounded cards, banyak white-space, aksen hijau `#1DB954` + hitam/putih),
  gunakan Tailwind CSS.
- **Backend**: **Supabase** (Postgres + Auth + Storage + Realtime + Edge Functions) — pakai free tier.
- **AI Inference**: **Hugging Face Inference API / Spaces (GPU)** free tier — panggil via REST
  dari Supabase Edge Function (jangan expose API key di frontend).
- **Kamera**: browser `getUserMedia` (webcam laptop/HP, kamera USB/UVC) dan input stream URL
  untuk kamera Ethernet/IP (MJPEG/HTTP).
- **I/O**: `Web Serial API` untuk Arduino Uno (USB, output DAN input trigger eksternal), dan
  client TCP/Modbus-TCP sederhana (via Edge Function, karena browser tidak bisa raw TCP) untuk
  PLC via Ethernet (output DAN input trigger eksternal).
- **Export Laporan**: `SheetJS (xlsx)` untuk export Excel, `jsPDF` + `jspdf-autotable` untuk
  export PDF — keduanya berjalan di client-side (browser), tidak perlu service tambahan berbayar.
- Semua service HARUS bisa jalan di plan gratis. Jangan gunakan library/API berbayar.

## 2. KONSEP INTI — WAJIB DIPAHAMI SEBELUM MULAI CODING

**Ini BUKAN aplikasi "1 project = 1 AI tool".** Arsitektur mengikuti model **Program** ala
Keyence IV4, di mana:
- Satu organisasi/kamera bisa memiliki **banyak Program** (mis. 1 Program per jenis part).
- Satu Program bisa memiliki **banyak Tool AI aktif sekaligus** (mis. Program "Cek Part A"
  punya Tool Differentiate + Tool OCR yang berjalan bersamaan di setiap eksekusi Run).
- Hasil akhir sebuah Program adalah **gabungan** hasil semua Tool-nya (logic AND/OR).

### Alur Operasional Baku (7 Langkah — WAJIB diikuti persis, jangan disederhanakan/diubah urutannya)

| # | Langkah | Detail |
|---|---|---|
| 1 | **New Program** | User buat Program baru dari menu Program. Bisa banyak Program. Set nama + sumber kamera. |
| 2 | **Ambil Gambar → Save Mastering** | Capture 1 gambar objek baik/normal dari live kamera, simpan sebagai **Mastering image** Program (acuan utama). |
| 3 | **Add Tools (manual) / Auto Learning** | Tambahkan 1+ Tool AI di atas Mastering image. Mode **manual**: user pilih jenis tool + gambar ROI sendiri. Mode **Auto Learning**: sistem menyarankan tool/ROI/referensi otomatis dari Mastering image, user tinggal cek/konfirmasi. |
| 4 | **Save Tools / Save Learn** | Simpan konfigurasi tiap Tool (ROI + gambar referensi hasil crop). Program boleh punya banyak Tool tersimpan. |
| 5 | **Level Adjustment → Save** | Atur sensitivitas/threshold tiap Tool (similarity minimum, jumlah objek, pola OCR, dst.) sambil lihat preview live, lalu simpan. Program jadi "siap Run" setelah minimal 1 Tool selesai tahap ini. |
| 6 | **Mode Running** | Jalankan Program. Trigger **Internal** (tombol capture di app / interval otomatis) ATAU **Eksternal** (sinyal dari PLC via Ethernet / pin Arduino via USB). |
| 7 | **Result OK/NG** | Semua Tool aktif dijalankan terhadap gambar yang sama → hasil digabung (AND/OR) → **Judgment akhir Program: OK atau NG**, ditampilkan besar & jelas, disimpan ke log, dikirim ke I/O. |

Langkah 1-5 = tahap setup (role Engineer/Admin). Langkah 6-7 = operasional harian (role Operator,
tidak perlu paham detail AI). UI harus mencerminkan pemisahan ini dengan jelas (mis. menu terpisah
"Program Setup" vs "Run").

### 6 AI Tools yang harus ada (modul terpisah, mudah ditambah tool baru nanti)
1. **AI Differentiate** — bandingkan gambar dengan reference tool → OK/NG.
2. **AI Identify** — kenali keberadaan/jenis objek walau posisi berubah (image similarity/embedding), mendukung multi-referensi.
3. **AI Count** — hitung jumlah objek/fitur dalam frame.
4. **AI OCR** — baca teks/kode dari gambar.
5. **AI Trigger** — deteksi kondisi untuk memicu capture/analisa otomatis.
6. **AI Through Count** — counting objek yang melintas berurutan (mode line/conveyor).

Operasional Mode Running HARUS sesederhana Keyence IV4: sedikit klik, tombol besar, hasil
OK (hijau) / NG (merah) ditampilkan besar dan jelas.

## 3. Struktur Menu / Halaman
1. **Login/Register** (Supabase Auth, email+password).
2. **Dashboard** — tampilkan **logo Yasashi Electric** (ikon robot lingkaran hijau, tagline
   "Pray Hard · Work Smart · Keep Yasashi"), ringkasan: jumlah Program aktif, statistik inspeksi
   hari ini (OK/NG count), status koneksi kamera & I/O.
3. **Program** (daftar Program + tombol "+ New Program"):
   - **New Program**: form nama + pilih sumber kamera (webcam/USB/Ethernet).
   - **Setup Program** (per Program, mengikuti langkah 2-5):
     a. Mastering — live preview → Capture → Save sebagai Mastering (atau pilih dari Image Library).
     b. Add Tools — tambah Tool di atas Mastering image, mode Manual atau **tombol "Auto Learning"**
        yang otomatis menyarankan tool/ROI/threshold.
     c. Save Tools/Save Learn — simpan tiap Tool (bisa lebih dari 1 Tool per Program).
     d. Level Adjustment — slider/input threshold per Tool dengan preview OK/NG live, lalu Save.
     e. Decision Logic — pilih AND/OR untuk menggabungkan hasil antar-Tool (jika >1 Tool).
     f. Trigger Config — pilih Internal (tombol/interval) atau Eksternal (pilih sumber I/O).
4. **Run** (mode operasional harian, langkah 6-7):
   - Pilih Program yang sudah "siap Run" → live preview kamera (atau pilih gambar dari Image
     Library sebagai input pengganti kamera live) → Trigger (manual/internal atau menunggu sinyal
     eksternal) → jalankan SEMUA Tool aktif Program tsb → Judgment akhir besar & jelas → kirim ke
     I/O → simpan log (ringkas + rincian per Tool).
5. **Image Library** — galeri gambar tersimpan (dari Capture atau Upload), dengan fitur:
   - Filter berdasarkan Program, tanggal, dan label.
   - Multi-select gambar untuk 3 aksi: (a) **jadikan Mastering** Program, (b) **jadikan input di
     mode Run** (pengujian ulang tanpa kamera live), (c) **tambahkan sebagai reference tambahan**
     pada sebuah Tool (multi-referensi Identify, contoh NG tambahan Differentiate, atau dataset
     untuk V2.0 Object Detection).
   - Edit label (OK/NG/nama kelas) dan tag per gambar (hanya role engineer/admin).
6. **Logs** — tabel histori inspeksi (timestamp, Program, hasil akhir, trigger_source, thumbnail),
   dengan expand/detail untuk lihat rincian tiap Tool, filter by tanggal/Program/hasil, dan 2
   tombol export:
   - **Export Excel (.xlsx)** — seluruh kolom log (termasuk rincian per Tool) untuk analisa lanjutan
     (Pivot Table, Pareto NG). Gunakan library `SheetJS (xlsx)`, dibangkitkan client-side.
   - **Export PDF** — laporan ringkas siap cetak (header Program & rentang tanggal, ringkasan
     jumlah OK/NG, tabel hasil, opsional thumbnail gambar NG). Gunakan `jsPDF` + `jspdf-autotable`.
   - Export mengikuti filter aktif (mis. 1 shift/1 Program/1 rentang tanggal) maupun seluruh histori.
7. **I/O Settings** (per Program) — konfigurasi koneksi PLC (Ethernet, IP:port, protokol) dan
   Arduino Uno (pilih serial port via Web Serial API): mapping OUTPUT (hasil Judgment → sinyal
   digital) dan mapping INPUT (sinyal eksternal → trigger capture, dipakai jika Program di-set
   Trigger Eksternal di langkah 6).
8. **Chatbot / Help** — widget chat berisi panduan pengoperasian & troubleshooting dasar
   (rule-based knowledge base dulu; opsional dihubungkan ke Hugging Face LLM ringan).
9. **Account/Settings** — profil user, organisasi.

## 4. Data Model (Supabase Postgres)
**Gunakan skema SQL lengkap yang sudah disiapkan di `supabase_schema.sql`** sebagai satu-satunya
acuan migration — JANGAN buat ulang dari nol atau memakai struktur "1 tabel = 1 tool" yang lebih
sederhana. Ringkasan tabel intinya:

- `profiles` (id, email, nama, role, organisasi_id)
- `programs` (id, nama_program, camera_source, camera_connection, master_image_url,
  decision_logic, trigger_mode, trigger_config, is_ready_to_run) — Langkah 1-2.
- `program_tools` (id, program_id, ai_tool, tool_order, learn_mode, roi_config,
  reference_image_url, reference_image_urls, threshold, is_saved, is_level_adjusted) — Langkah
  3-5. **Satu program_id bisa punya banyak baris di tabel ini.**
- `captured_images` (id, organisasi_id, program_id, image_url, source, label, tags, usage_type)
  — Image Library.
- `inspection_logs` (id, program_id, timestamp, hasil, trigger_source, image_url, io_sent) —
  Judgment akhir (gabungan) per eksekusi Run — Langkah 6-7.
- `inspection_log_tool_results` (id, inspection_log_id, program_tool_id, ai_tool, hasil,
  confidence, count_value, ocr_text, extra_data) — rincian hasil tiap Tool per eksekusi Run.
- `io_configs` (id, program_id, io_type, connection_info, mapping_output,
  supports_trigger_input, trigger_input_mapping) — output DAN input trigger eksternal.
- `chatbot_kb` (id, kategori, pertanyaan, jawaban)

Aktifkan **Row Level Security (RLS)** — sudah didefinisikan lengkap di `supabase_schema.sql`
(user hanya bisa akses data organisasinya sendiri; operator read-only untuk Program/Tool,
insert-only untuk log; engineer/admin full manage Program/Tool/I-O).

## 5. Alur Teknis AI Inference (Mode Running)
**Gunakan `supabase-edge-function-ai-inference.ts` sebagai acuan implementasi** — sudah
mengimplementasikan seluruh logic berikut:

- Frontend capture 1 frame saat Trigger (internal/eksternal) → kompres gambar → kirim
  `{ program_id, image_base64, trigger_source }` ke Edge Function `ai-inference`.
- Edge Function membaca **semua `program_tools`** milik `program_id` yang `is_saved=true` dan
  `is_active=true`, lalu menjalankan setiap Tool secara berurutan terhadap gambar yang sama
  (memanggil Hugging Face Inference API sesuai jenis tool: embedding model untuk
  Differentiate/Identify, object detection untuk Count/Trigger/Through Count, OCR model untuk
  AI OCR).
- Hasil tiap Tool digabung sesuai `programs.decision_logic` (AND/OR) menjadi Judgment akhir.
- Edge Function menyimpan `inspection_logs` (hasil akhir) + `inspection_log_tool_results`
  (rincian per Tool), lalu mengembalikan `{ hasil, log_id, tool_results }` ke frontend.
- Frontend tampilkan `hasil` (OK/NG besar) → (jika I/O aktif) kirim sinyal ke PLC/Arduino.
- Tangani cold-start Hugging Face (`503`) dengan loading state "AI Engine warming up..." dan
  timeout wajar — Edge Function sudah menangani ini, tinggal frontend menampilkan state-nya.

## 6. Kebutuhan UI/UX
- Bergaya Canva: card rounded-2xl, shadow lembut, white-space luas, warna aksen hijau `#1DB954`.
- Responsif penuh: desktop (multi-panel), HP (single column, tombol besar untuk sentuhan).
- Hasil OK = hijau besar, NG = merah besar, animasi ringan saat AI Engine memproses.
- Tahap Setup Program (langkah 1-5) tampil sebagai wizard/stepper linear yang jelas progress-nya.
- Mode Running (langkah 6-7) didesain seringan mungkin — operator tidak perlu scroll/klik banyak.
- Bahasa antarmuka: **Bahasa Indonesia** sebagai default (opsional toggle English nanti).

## 7. Batasan Penting
- JANGAN taruh API key Hugging Face atau service_role key Supabase di kode frontend — semua
  panggilan sensitif lewat Supabase Edge Function.
- JANGAN gunakan library berbayar atau tier berbayar apa pun.
- JANGAN sederhanakan struktur data menjadi "1 Program = 1 Tool" — ini akan merusak seluruh
  alur Add Tools / Level Adjustment / Decision Logic yang menjadi ciri khas produk ini.
- Desain kode modular per AI Tool (folder `ai-tools/differentiate`, `ai-tools/identify`, dst.)
  agar mudah menambah tool baru dan agar V2.0 (Object Detection custom untuk defect halus)
  bisa ditambahkan tanpa merombak arsitektur.
- Kompres gambar sebelum upload ke Storage (batasi ukuran, karena Supabase Storage free tier 1GB).
- Sediakan retention/cleanup log gambar lama (konfigurasi, default 30 hari) agar kuota free tier
  tidak cepat habis.

## 8. Urutan Kerja yang Diminta (step-by-step)
1. Setup project (Vite + React + Tailwind), struktur folder, konfigurasi GitHub Pages deploy.
2. Setup Supabase: jalankan `supabase_schema.sql` sebagai migration, konfigurasi Auth, Storage.
3. Bangun Dashboard + navigasi + branding (logo & tagline Yasashi Electric).
4. Bangun modul kamera (pilih sumber: webcam/USB/Ethernet stream, live preview, capture, ROI
   drawer, opsi "Simpan ke Image Library" pada tiap gambar capture/upload).
5. Bangun halaman Image Library (galeri, filter, multi-select untuk Mastering/Run/reference tool,
   edit label & tag).
6. Bangun alur Setup Program lengkap sesuai langkah 1-5: New Program → Mastering → Add Tools
   (manual + Auto Learning) → Save Tools/Learn → Level Adjustment (dengan preview live) → Decision
   Logic → Trigger Config.
7. Deploy Edge Function `ai-inference` (pakai `supabase-edge-function-ai-inference.ts` sebagai basis).
8. Bangun Mode Running sesuai langkah 6-7: live preview / gambar dari Image Library → trigger
   (internal/eksternal) → panggil Edge Function → Judgment akhir + rincian per Tool → simpan log
   → kirim I/O.
9. Bangun halaman Logs (tabel + expand rincian per Tool, filter, export Excel & PDF).
10. Bangun halaman I/O Settings per Program (Web Serial untuk Arduino, form koneksi TCP untuk
    PLC via Edge Function) — termasuk konfigurasi input Trigger Eksternal.
11. Bangun Chatbot/Help (knowledge base panduan pengoperasian, sudah ada seed data di
    `supabase_schema.sql` tabel `chatbot_kb`).
12. Testing end-to-end dengan 1 Program berisi 1 Tool (mis. AI Differentiate) dulu sampai
    seluruh 7 langkah berjalan mulus, baru lanjut ke Program dengan multi-Tool dan 5 AI Tool
    lainnya.
13. Siapkan dokumentasi singkat cara deploy (GitHub Pages + Supabase env vars + deploy Edge Function).

Mulai dari langkah 1. Tanyakan konfirmasi singkat jika ada keputusan arsitektur besar yang
ambigu, tapi untuk keputusan kecil silakan ambil pendekatan paling sederhana dan lanjutkan.
