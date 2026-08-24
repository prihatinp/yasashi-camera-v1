-- =====================================================================
-- YASASHI CAMERA V1.0 — MIGRATION 0002: AI Tool "Barcode/QR"
-- Jalankan di Supabase SQL Editor (satu kali saja).
-- =====================================================================

alter type public.ai_tool_type add value if not exists 'barcode';

comment on type public.ai_tool_type is
  'Jenis AI Tool: differentiate, identify, count, ocr, trigger, through_count, barcode '
  '(barcode = baca barcode 1D/linear maupun QR Code 2D/matrix).';
