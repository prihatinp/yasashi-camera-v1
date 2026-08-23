-- =====================================================================
-- YASASHI CAMERA V1.0 — SUPABASE SCHEMA (MIGRATION) — v2
-- Struktur ini mengikuti alur operasional ala Keyence IV4:
--   1. New Program (bisa banyak Program)
--   2. Ambil Gambar -> Save sebagai Mastering
--   3. Add Tools (manual) / Auto Learning
--   4. Save Tools / Save Learn
--   5. Level Adjustment -> Save
--   6. Mode Running (Trigger Internal / Eksternal)
--   7. Hasil OK/NG
--
-- Jalankan urut dari atas ke bawah di Supabase SQL Editor
-- atau simpan sebagai file migration: supabase/migrations/0001_init.sql
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. EXTENSIONS
-- ---------------------------------------------------------------------
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- 1. ENUM TYPES
-- ---------------------------------------------------------------------
create type user_role as enum ('admin', 'engineer', 'operator', 'viewer');

create type ai_tool_type as enum (
  'differentiate',   -- AI Differentiate (OK/NG)
  'identify',        -- AI Identify
  'count',           -- AI Count
  'ocr',             -- AI OCR
  'trigger',         -- AI Trigger
  'through_count'    -- AI Through Count
);

create type tool_learn_mode as enum ('manual', 'auto');
-- 'manual' = user Add Tools satu-satu dan atur ROI/referensi sendiri
-- 'auto'   = Auto Learning: sistem menyarankan tool/ROI/threshold dari Mastering image

create type inspection_result as enum ('OK', 'NG', 'UNKNOWN');

create type trigger_mode as enum ('internal', 'external');
-- 'internal' = trigger dari aplikasi (tombol/otomatis interval)
-- 'external' = trigger dari sinyal luar (PLC digital input / Arduino pin)

create type io_type as enum ('plc', 'arduino');

create type camera_source_type as enum ('webcam', 'usb', 'ethernet');

create type image_usage_type as enum (
  'mastering',         -- dipakai sebagai Mastering image sebuah Program
  'run_test',          -- dipakai sebagai input pengujian di mode Run
  'reference_learn',   -- ditambahkan sebagai reference tambahan pada sebuah Tool
  'dataset_training'   -- dikumpulkan sebagai dataset untuk training V2.0
);

-- ---------------------------------------------------------------------
-- 2. ORGANISASI (multi-tenant sederhana: per plant/perusahaan)
-- ---------------------------------------------------------------------
create table public.organisasi (
  id uuid primary key default gen_random_uuid(),
  nama_organisasi text not null,
  created_at timestamptz not null default now()
);

comment on table public.organisasi is 'Tenant / perusahaan / plant pengguna Yasashi Camera';

-- ---------------------------------------------------------------------
-- 3. PROFILES (extend auth.users bawaan Supabase)
-- ---------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  nama text,
  role user_role not null default 'operator',
  organisasi_id uuid references public.organisasi (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is 'Profil user, 1:1 dengan auth.users';

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, nama)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'nama', new.email));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ---------------------------------------------------------------------
-- 4. PROGRAMS (Langkah 1 & 2: New Program + Mastering)
--    Satu organisasi bisa punya BANYAK Program (mis. per part/per station).
-- ---------------------------------------------------------------------
create table public.programs (
  id uuid primary key default gen_random_uuid(),
  organisasi_id uuid not null references public.organisasi (id) on delete cascade,

  nama_program text not null,
  deskripsi text,

  -- Sumber & koneksi kamera terikat per Program (tiap Program bisa beda kamera/ROI dasar)
  camera_source camera_source_type not null default 'webcam',
  camera_connection jsonb default '{}'::jsonb,  -- mis. { "stream_url": "..." } utk ethernet

  -- Langkah 2: "Ambil Gambar, save sebagai Mastering"
  master_image_url text,             -- path gambar Mastering di bucket 'reference-images'
  master_image_captured_at timestamptz,

  -- Logika penggabungan hasil antar Tool -> Judgment akhir Program
  -- contoh: { "combine": "AND" }  artinya semua tool harus OK agar Program = OK
  decision_logic jsonb not null default '{"combine": "AND"}'::jsonb,

  -- Langkah 6: konfigurasi Mode Running (trigger internal/eksternal)
  trigger_mode trigger_mode not null default 'internal',
  -- internal: { "auto_interval_ms": null }  (null = manual button trigger)
  -- external: { "io_config_id": "<uuid io_configs>", "input_pin": "D2" }
  trigger_config jsonb not null default '{}'::jsonb,

  is_active boolean not null default true,
  is_mastered boolean not null default false,   -- true setelah Mastering image tersimpan
  is_ready_to_run boolean not null default false, -- true setelah minimal 1 tool ter-Save & Level Adjustment selesai

  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_programs_organisasi on public.programs (organisasi_id);

comment on table public.programs is
  'Program inspeksi (setara "Program" pada Keyence IV4). Satu organisasi bisa punya banyak Program. '
  'Menyimpan Mastering image, sumber kamera, decision logic antar-tool, dan konfigurasi trigger Run.';

-- ---------------------------------------------------------------------
-- 5. PROGRAM_TOOLS (Langkah 3-5: Add Tools/Auto Learning, Save Tools/Learn,
--    Level Adjustment). Satu Program bisa punya BANYAK Tool aktif sekaligus,
--    persis seperti IV4 (mis. 1 Program = AI Differentiate + AI OCR berbarengan).
-- ---------------------------------------------------------------------
create table public.program_tools (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs (id) on delete cascade,

  ai_tool ai_tool_type not null,
  tool_order integer not null default 0,   -- urutan eksekusi tool dalam 1 Program
  nama_tool text,                          -- label bebas dari user, mis. "Cek Lubang Kiri"

  -- Langkah 3: "Add Tools (manual)" atau "Auto Learning"
  learn_mode tool_learn_mode not null default 'manual',

  -- ROI tool ini, relatif terhadap Mastering image Program (koordinat 0..1)
  roi_config jsonb not null default '{"x":0,"y":0,"width":1,"height":1}'::jsonb,

  -- Langkah 4: "Save Tools / Save Learn" -> hasil crop/referensi tool ini
  reference_image_url text,                        -- referensi utama (Differentiate)
  reference_image_urls jsonb default '[]'::jsonb,   -- multi-referensi (Identify: [{label,url}])

  -- Langkah 5: "Level Adjustment" -> threshold/toleransi/sensitivity tool ini
  -- Differentiate/Identify: { "similarity_min": 0.85 }
  -- Count/Through Count:    { "detection_min_score": 0.6, "expected_count": 12 }
  -- OCR:                    { "expected_pattern": "^[A-Z0-9]{8}$" }
  -- Trigger:                { "detection_min_score": 0.5 }
  threshold jsonb not null default '{}'::jsonb,

  is_saved boolean not null default false,   -- true setelah "Save Tools/Save Learn" ditekan
  is_level_adjusted boolean not null default false, -- true setelah "Level Adjustment" disimpan
  is_active boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_program_tools_program on public.program_tools (program_id);
create index idx_program_tools_ai_tool on public.program_tools (ai_tool);

comment on table public.program_tools is
  'Tool AI yang ditambahkan ke sebuah Program (bisa lebih dari 1 tool per Program). '
  'Menyimpan hasil Add Tools/Auto Learning (langkah 3), Save Tools/Learn (langkah 4), '
  'dan Level Adjustment (langkah 5).';

-- ---------------------------------------------------------------------
-- 6. CAPTURED IMAGES (Image Library — simpan & pakai ulang gambar)
-- ---------------------------------------------------------------------
create table public.captured_images (
  id uuid primary key default gen_random_uuid(),
  organisasi_id uuid not null references public.organisasi (id) on delete cascade,

  program_id uuid references public.programs (id) on delete set null,

  image_url text not null,             -- path di bucket 'image-library'
  source camera_source_type not null,  -- webcam / usb / ethernet (upload disimpan sbg tag 'upload')

  label text,                          -- opsional: 'OK' / 'NG' / nama kelas
  tags text[] default '{}',
  usage_type image_usage_type[] default '{}',  -- boleh dipakai untuk >1 keperluan

  captured_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_captured_images_org on public.captured_images (organisasi_id);
create index idx_captured_images_program on public.captured_images (program_id);
create index idx_captured_images_label on public.captured_images (label);
create index idx_captured_images_usage on public.captured_images using gin (usage_type);
create index idx_captured_images_tags on public.captured_images using gin (tags);

comment on table public.captured_images is
  'Image Library: gambar hasil capture/upload yang disimpan untuk dipakai ulang sebagai Mastering, '
  'input di mode Run, reference tool tambahan, atau dataset training V2.0.';

-- ---------------------------------------------------------------------
-- 7. INSPECTION LOGS (Langkah 6 & 7: histori hasil Run/Trigger, per Program)
--    Ini adalah hasil AKHIR (gabungan seluruh Tool dalam Program tsb).
-- ---------------------------------------------------------------------
create table public.inspection_logs (
  id uuid primary key default gen_random_uuid(),
  organisasi_id uuid not null references public.organisasi (id) on delete cascade,
  program_id uuid not null references public.programs (id) on delete cascade,

  "timestamp" timestamptz not null default now(),
  hasil inspection_result not null default 'UNKNOWN',   -- Judgment akhir Program (langkah 7)
  trigger_source trigger_mode not null default 'internal',

  image_url text,                    -- gambar hasil capture saat Run (Supabase Storage)
  io_sent boolean not null default false,   -- apakah sudah dikirim ke PLC/Arduino
  operator_id uuid references public.profiles (id) on delete set null,

  created_at timestamptz not null default now()
);

create index idx_logs_program on public.inspection_logs (program_id);
create index idx_logs_organisasi_time on public.inspection_logs (organisasi_id, "timestamp" desc);
create index idx_logs_hasil on public.inspection_logs (hasil);

comment on table public.inspection_logs is 'Log hasil akhir (Judgment gabungan) setiap eksekusi Run/Trigger per Program';

-- ---------------------------------------------------------------------
-- 8. INSPECTION LOG TOOL RESULTS (rincian hasil PER TOOL dalam satu eksekusi Run)
-- ---------------------------------------------------------------------
create table public.inspection_log_tool_results (
  id uuid primary key default gen_random_uuid(),
  inspection_log_id uuid not null references public.inspection_logs (id) on delete cascade,
  program_tool_id uuid references public.program_tools (id) on delete set null,

  ai_tool ai_tool_type not null,
  hasil inspection_result not null default 'UNKNOWN',
  confidence numeric(5,4),           -- 0.0000 - 1.0000
  count_value integer,               -- untuk AI Count / Through Count
  ocr_text text,                     -- untuk AI OCR
  extra_data jsonb default '{}'::jsonb,  -- payload tambahan dari AI Engine

  created_at timestamptz not null default now()
);

create index idx_log_tool_results_log on public.inspection_log_tool_results (inspection_log_id);
create index idx_log_tool_results_tool on public.inspection_log_tool_results (program_tool_id);

comment on table public.inspection_log_tool_results is
  'Rincian hasil tiap Tool AI dalam satu eksekusi Run — 1 baris inspection_logs bisa punya banyak '
  'baris di sini jika Program memiliki lebih dari 1 Tool aktif.';

-- ---------------------------------------------------------------------
-- 9. IO CONFIGS (koneksi ke PLC / Arduino — output hasil DAN input trigger eksternal)
-- ---------------------------------------------------------------------
create table public.io_configs (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs (id) on delete cascade,
  io_type io_type not null,

  -- PLC (Ethernet): { "ip": "192.168.1.10", "port": 502, "protocol": "modbus_tcp" }
  -- Arduino (USB):  { "baud_rate": 9600 }  (port dipilih user via Web Serial API di browser)
  connection_info jsonb not null default '{}'::jsonb,

  -- OUTPUT: mapping hasil Judgment -> sinyal digital, mis:
  -- { "OK": {"coil": 1, "value": true}, "NG": {"coil": 2, "value": true} }
  mapping_output jsonb not null default '{}'::jsonb,

  -- INPUT: dipakai jika Program.trigger_mode = 'external' -> konfigurasi
  -- sinyal masuk yang memicu capture+analisa, mis:
  -- { "input_pin": "D2", "edge": "rising" }  (Arduino) atau { "input_bit": 5 } (PLC)
  supports_trigger_input boolean not null default false,
  trigger_input_mapping jsonb not null default '{}'::jsonb,

  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_io_configs_program on public.io_configs (program_id);

comment on table public.io_configs is
  'Konfigurasi koneksi PLC (Ethernet) / Arduino Uno (USB) per Program — untuk output hasil Judgment '
  'dan/atau input sinyal trigger eksternal (Mode Running - Trigger Eksternal).';

-- ---------------------------------------------------------------------
-- 10. CHATBOT KNOWLEDGE BASE
-- ---------------------------------------------------------------------
create table public.chatbot_kb (
  id uuid primary key default gen_random_uuid(),
  kategori text not null,           -- mis. 'operasional', 'troubleshooting', 'setup_io'
  pertanyaan text not null,
  jawaban text not null,
  keywords text[],
  created_at timestamptz not null default now()
);

create index idx_chatbot_kategori on public.chatbot_kb (kategori);

comment on table public.chatbot_kb is 'Knowledge base panduan pengoperasian & troubleshooting untuk chatbot';

-- ---------------------------------------------------------------------
-- 11. TRIGGER updated_at OTOMATIS
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_profiles_updated_at before update on public.profiles
  for each row execute procedure public.set_updated_at();

create trigger trg_programs_updated_at before update on public.programs
  for each row execute procedure public.set_updated_at();

create trigger trg_program_tools_updated_at before update on public.program_tools
  for each row execute procedure public.set_updated_at();

create trigger trg_captured_images_updated_at before update on public.captured_images
  for each row execute procedure public.set_updated_at();

create trigger trg_io_configs_updated_at before update on public.io_configs
  for each row execute procedure public.set_updated_at();

-- =====================================================================
-- 12. ROW LEVEL SECURITY (RLS)
-- Prinsip: user hanya boleh akses data pada organisasi_id miliknya sendiri.
-- Role 'operator' hanya boleh INSERT log (Run) & SELECT (tidak boleh ubah
-- Program/Tool/I-O). Role 'engineer'/'admin' boleh kelola Program & Tool
-- (New Program, Mastering, Add Tools, Save Learn, Level Adjustment, I/O).
-- =====================================================================

alter table public.organisasi enable row level security;
alter table public.profiles enable row level security;
alter table public.programs enable row level security;
alter table public.program_tools enable row level security;
alter table public.captured_images enable row level security;
alter table public.inspection_logs enable row level security;
alter table public.inspection_log_tool_results enable row level security;
alter table public.io_configs enable row level security;
alter table public.chatbot_kb enable row level security;

create or replace function public.current_user_org()
returns uuid
language sql stable
security definer set search_path = public
as $$
  select organisasi_id from public.profiles where id = auth.uid();
$$;

create or replace function public.is_admin_or_engineer()
returns boolean
language sql stable
security definer set search_path = public
as $$
  select role in ('admin', 'engineer')
  from public.profiles where id = auth.uid();
$$;

-- ---- organisasi ----
create policy "org_select_own" on public.organisasi
  for select using (id = public.current_user_org());

-- ---- profiles ----
create policy "profiles_select_own_org" on public.profiles
  for select using (organisasi_id = public.current_user_org());

create policy "profiles_update_self" on public.profiles
  for update using (id = auth.uid());

-- ---- programs ----
create policy "programs_select_own_org" on public.programs
  for select using (organisasi_id = public.current_user_org());

create policy "programs_insert_engineer" on public.programs
  for insert with check (
    organisasi_id = public.current_user_org()
    and public.is_admin_or_engineer()
  );

create policy "programs_update_engineer" on public.programs
  for update using (
    organisasi_id = public.current_user_org()
    and public.is_admin_or_engineer()
  );

create policy "programs_delete_engineer" on public.programs
  for delete using (
    organisasi_id = public.current_user_org()
    and public.is_admin_or_engineer()
  );

-- ---- program_tools ----
create policy "program_tools_select_own_org" on public.program_tools
  for select using (
    program_id in (select id from public.programs where organisasi_id = public.current_user_org())
  );

create policy "program_tools_manage_engineer" on public.program_tools
  for all using (
    public.is_admin_or_engineer()
    and program_id in (select id from public.programs where organisasi_id = public.current_user_org())
  )
  with check (
    public.is_admin_or_engineer()
    and program_id in (select id from public.programs where organisasi_id = public.current_user_org())
  );

-- ---- captured_images (Image Library) ----
create policy "captured_images_select_own_org" on public.captured_images
  for select using (organisasi_id = public.current_user_org());

create policy "captured_images_insert_own_org" on public.captured_images
  for insert with check (organisasi_id = public.current_user_org());

create policy "captured_images_update_engineer" on public.captured_images
  for update using (
    organisasi_id = public.current_user_org()
    and public.is_admin_or_engineer()
  );

create policy "captured_images_delete_engineer" on public.captured_images
  for delete using (
    organisasi_id = public.current_user_org()
    and public.is_admin_or_engineer()
  );

-- ---- inspection_logs ----
create policy "logs_select_own_org" on public.inspection_logs
  for select using (organisasi_id = public.current_user_org());

create policy "logs_insert_own_org" on public.inspection_logs
  for insert with check (organisasi_id = public.current_user_org());

-- Log tidak boleh diubah/dihapus lewat client (integritas data).
-- Hapus hanya lewat retention job (service_role, bypass RLS by default).

-- ---- inspection_log_tool_results ----
create policy "log_tool_results_select_own_org" on public.inspection_log_tool_results
  for select using (
    inspection_log_id in (
      select id from public.inspection_logs where organisasi_id = public.current_user_org()
    )
  );

create policy "log_tool_results_insert_own_org" on public.inspection_log_tool_results
  for insert with check (
    inspection_log_id in (
      select id from public.inspection_logs where organisasi_id = public.current_user_org()
    )
  );

-- ---- io_configs ----
create policy "io_select_own_org" on public.io_configs
  for select using (
    program_id in (select id from public.programs where organisasi_id = public.current_user_org())
  );

create policy "io_manage_engineer" on public.io_configs
  for all using (
    public.is_admin_or_engineer()
    and program_id in (select id from public.programs where organisasi_id = public.current_user_org())
  )
  with check (
    public.is_admin_or_engineer()
    and program_id in (select id from public.programs where organisasi_id = public.current_user_org())
  );

-- ---- chatbot_kb ----
create policy "kb_select_authenticated" on public.chatbot_kb
  for select using (auth.role() = 'authenticated');

-- =====================================================================
-- 13. STORAGE BUCKETS
-- =====================================================================
insert into storage.buckets (id, name, public)
values ('reference-images', 'reference-images', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('inspection-images', 'inspection-images', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('image-library', 'image-library', false)
on conflict (id) do nothing;

-- Policy storage: hanya user login dari organisasi terkait yang bisa akses
-- (disederhanakan: path file WAJIB diawali <organisasi_id>/... agar bisa difilter)

create policy "storage_select_own_org_ref"
  on storage.objects for select
  using (
    bucket_id = 'reference-images'
    and (storage.foldername(name))[1] = public.current_user_org()::text
  );

create policy "storage_insert_own_org_ref"
  on storage.objects for insert
  with check (
    bucket_id = 'reference-images'
    and (storage.foldername(name))[1] = public.current_user_org()::text
    and public.is_admin_or_engineer()
  );

create policy "storage_select_own_org_insp"
  on storage.objects for select
  using (
    bucket_id = 'inspection-images'
    and (storage.foldername(name))[1] = public.current_user_org()::text
  );

create policy "storage_insert_own_org_insp"
  on storage.objects for insert
  with check (
    bucket_id = 'inspection-images'
    and (storage.foldername(name))[1] = public.current_user_org()::text
  );

create policy "storage_select_own_org_lib"
  on storage.objects for select
  using (
    bucket_id = 'image-library'
    and (storage.foldername(name))[1] = public.current_user_org()::text
  );

create policy "storage_insert_own_org_lib"
  on storage.objects for insert
  with check (
    bucket_id = 'image-library'
    and (storage.foldername(name))[1] = public.current_user_org()::text
  );

create policy "storage_delete_own_org_lib"
  on storage.objects for delete
  using (
    bucket_id = 'image-library'
    and (storage.foldername(name))[1] = public.current_user_org()::text
    and public.is_admin_or_engineer()
  );

-- =====================================================================
-- 14. SEED DATA (opsional, contoh awal)
-- =====================================================================
insert into public.organisasi (nama_organisasi)
values ('PT. Yasashi Teknik (Demo)')
on conflict do nothing;

insert into public.chatbot_kb (kategori, pertanyaan, jawaban, keywords) values
('operasional', 'Bagaimana cara membuat Program baru?',
 'Buka menu Program > New Program > beri nama > pilih sumber kamera > lanjut ke langkah Mastering.',
 array['program', 'baru', 'new program']),
('operasional', 'Apa itu Mastering dan bagaimana caranya?',
 'Mastering adalah gambar acuan utama Program. Ambil gambar objek yang baik/normal lewat kamera, lalu klik Save sebagai Mastering. Gambar ini menjadi dasar untuk menambahkan Tools.',
 array['mastering', 'gambar acuan', 'golden image']),
('operasional', 'Bedanya Add Tools manual dan Auto Learning apa?',
 'Add Tools manual: Anda memilih sendiri jenis AI Tool, area ROI, dan referensinya. Auto Learning: sistem otomatis menyarankan tool, ROI, dan threshold berdasarkan gambar Mastering — Anda tinggal cek dan simpan.',
 array['add tools', 'auto learning', 'manual']),
('operasional', 'Apa itu Level Adjustment?',
 'Level Adjustment adalah langkah mengatur sensitivitas/toleransi tiap Tool (mis. similarity minimum, jumlah objek yang diharapkan) setelah Tool disimpan, sebelum Program dipakai di Mode Running.',
 array['level adjustment', 'threshold', 'sensitivitas']),
('operasional', 'Apa beda trigger Internal dan Eksternal di Mode Running?',
 'Trigger Internal dijalankan dari aplikasi sendiri (tombol capture atau interval otomatis). Trigger Eksternal dipicu oleh sinyal dari luar, misalnya sensor/PLC via Ethernet atau pin Arduino via USB.',
 array['trigger', 'internal', 'eksternal', 'running']),
('troubleshooting', 'Kamera tidak terdeteksi, bagaimana solusinya?',
 'Pastikan browser mendapat izin akses kamera, gunakan HTTPS, dan cek apakah kamera lain sedang memakai device yang sama. Untuk kamera Ethernet, cek kembali stream URL.',
 array['kamera', 'tidak terdeteksi', 'webcam', 'usb']),
('troubleshooting', 'Koneksi ke PLC gagal, apa yang harus dicek?',
 'Cek IP address dan port PLC pada menu I/O Settings, pastikan PLC dan komputer berada dalam satu jaringan, dan protokol (Modbus-TCP) sudah aktif di sisi PLC.',
 array['plc', 'koneksi', 'ethernet', 'gagal'])
on conflict do nothing;

-- =====================================================================
-- SELESAI. Langkah selanjutnya di Supabase Dashboard:
-- 1. Jalankan file ini di SQL Editor (atau supabase db push jika pakai CLI).
-- 2. Set environment variable SUPABASE_URL & SUPABASE_ANON_KEY di frontend.
-- 3. Buat Edge Function untuk memanggil Hugging Face Inference API
--    (simpan HF_API_TOKEN sebagai secret di Supabase, bukan di frontend).
-- 4. Update kolom organisasi_id user pertama secara manual (admin) setelah
--    signup pertama, karena trigger new_user tidak otomatis assign organisasi.
-- =====================================================================
