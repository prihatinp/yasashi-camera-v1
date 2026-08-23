# Yasashi Camera V1.0

Built-in AI Vision Sensor berbasis web — Frontend GitHub Pages, Backend Supabase, AI Inference
Hugging Face. Meniru alur operasional Keyence IV4 series built-in AI (Program → Mastering →
Add Tools/Auto Learning → Save Tools/Learn → Level Adjustment → Mode Running → Result OK/NG).

**Developer:** Prihatin Purwadi, M.Pd. — PT. Yasashi Teknik (Yasashi Electric)

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
3. Deploy Edge Function:
   ```bash
   supabase secrets set HF_API_TOKEN=hf_xxxxxxxxxxxxxxxx
   supabase functions deploy ai-inference
   ```
4. Salin `Project URL` dan `anon public key` dari Settings > API ke file `.env` lokal
   (dan ke GitHub Actions Secrets untuk deployment — lihat di bawah).

## Deploy ke GitHub Pages
Repo ini sudah dilengkapi workflow `.github/workflows/deploy.yml` yang otomatis build & deploy
setiap kali push ke branch `main`.

1. Di GitHub repo: **Settings > Pages > Build and deployment > Source** pilih **GitHub Actions**.
2. Di GitHub repo: **Settings > Secrets and variables > Actions**, tambahkan repository secrets:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. Push ke `main` — GitHub Actions otomatis build & publish ke GitHub Pages.

## Status
🚧 Dalam pengembangan — lihat `docs/PROMPT_CLAUDE_CODE.md` untuk roadmap implementasi step-by-step.
