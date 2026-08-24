# Yasashi Camera V1.0

Built-in AI Vision Sensor berbasis web — Frontend GitHub Pages, Backend Supabase, AI Inference
Hugging Face. Meniru alur operasional Keyence IV4 series built-in AI (Program → Mastering →
Add Tools/Auto Learning → Save Tools/Learn → Level Adjustment → Mode Running → Result OK/NG).

**Developer:** Prihatin Purwadi, M.Pd. 
Customer For : PT. Yasashi Teknik (Yasashi Electric)

## Dokumen Referensi
- `docs/Yasashi_Camera_V1.0_PRD.pdf` — Product Requirements Document lengkap.
- `docs/PROMPT_CLAUDE_CODE.md` — brief teknis untuk implementasi (dipakai sebagai instruksi awal Claude Code).
- `docs/README_AI_INFERENCE.md` — panduan deploy & pemakaian Edge Function AI Inference.
- `supabase/migrations/0001_init.sql` — skema database lengkap (tabel, enum, RLS, storage buckets).
- `supabase/functions/ai-inference/index.ts` — Edge Function penghubung ke Hugging Face Inference API.

## Tech Stack
- **Frontend**: React + Vite + Tailwind CSS → GitHub Pages
- **Backend**: Supabase (Postgres, Auth, Storage, Realtime, Edge Functions) — free tier
- **AI Inference**: Hugging Face Inference API — free tier

## Setup Development Lokal
```bash
npm install
cp .env.example .env   # isi dengan Supabase URL & anon key kamu
npm run dev
```

## Setup Supabase
1. Buat project baru di https://supabase.com (free tier).
2. Jalankan `supabase/migrations/0001_init.sql` di SQL Editor Supabase (atau `supabase db push`).
3. Deploy Edge Function `ai-inference` dan `plc-io`, serta set secret `HF_API_TOKEN`:
   - **Lewat GitHub Actions (direkomendasikan, tidak perlu install CLI lokal):**
     tambahkan repository secrets `SUPABASE_ACCESS_TOKEN` (dari
     https://supabase.com/dashboard/account/tokens) dan `HF_API_TOKEN` di **Settings > Secrets
     and variables > Actions**, lalu jalankan workflow **Deploy Supabase Edge Functions**
     (tab Actions > pilih workflow > Run workflow), atau cukup push perubahan di folder
     `supabase/functions/`.
   - **Atau manual dari komputer sendiri:**
     ```bash
     supabase login
     supabase link --project-ref <project-ref>
     supabase secrets set HF_API_TOKEN=hf_xxxxxxxxxxxxxxxx
     supabase functions deploy ai-inference
     supabase functions deploy plc-io
     ```
4. Salin `Project URL` dan `anon public key` dari Settings > API ke file `.env` lokal
   (dan ke GitHub Actions Secrets untuk deployment — lihat di bawah).

> Catatan: `plc-io` menjembatani koneksi Modbus-TCP ke PLC via `Deno.connect` di sisi server.
> PLC harus bisa dijangkau dari internet (IP publik/port-forward/VPN) karena Edge Function
> berjalan di cloud Supabase, bukan di jaringan lokal pabrik.

## Deploy ke GitHub Pages
Repo ini sudah dilengkapi workflow `.github/workflows/deploy.yml` yang otomatis build & deploy
setiap kali push ke branch `main`.

1. Di GitHub repo: **Settings > Pages > Build and deployment > Source** pilih **GitHub Actions**.
2. Di GitHub repo: **Settings > Secrets and variables > Actions**, tambahkan repository secrets:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. Push ke `main` — GitHub Actions otomatis build & publish ke GitHub Pages.

## Struktur Frontend
```
src/
  ai-tools/            # modul per AI Tool (differentiate, identify, count, through_count, ocr, trigger)
  components/          # komponen UI reusable (Camera, Chatbot, Layout, dst.)
  context/AuthContext  # session & profile Supabase Auth
  hooks/               # useCamera, useWebSerial, useChatbotKb
  lib/                 # supabaseClient, storage, imageLibrary, imageCrop, io, exportExcel, exportPdf
  pages/               # Auth, Dashboard, Programs (wizard setup), Run, ImageLibrary, Logs,
                        # IOSettings, Chatbot, Account
```

Setelah signup pertama, isi manual kolom `organisasi_id` pada tabel `profiles` (Supabase Table
Editor) agar user terhubung ke organisasi — trigger `handle_new_user` tidak melakukan ini otomatis.

## Status
✅ Scaffold lengkap 13 langkah `docs/PROMPT_CLAUDE_CODE.md`: Auth, Dashboard, Program Setup
wizard (Mastering → Add/Save Tools → Level Adjustment → Decision Logic → Trigger Config), Run,
Image Library, Logs (export Excel/PDF), I/O Settings (Web Serial Arduino + PLC via Edge Function
`plc-io`), Chatbot/Help, Account. Uji end-to-end dengan Program 1-Tool (AI Differentiate) dahulu,
baru lanjut ke multi-Tool dan 5 AI Tool lainnya sesuai `docs/PROMPT_CLAUDE_CODE.md` langkah 12.
