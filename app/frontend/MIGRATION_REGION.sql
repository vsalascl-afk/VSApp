-- ============================================
-- MIGRACIÓN: Agregar campo region a usuarios y checklist_bms
-- ============================================
-- Ejecutar en Supabase Dashboard > SQL Editor

BEGIN;

-- 1. Agregar columna region a usuarios
ALTER TABLE usuarios 
ADD COLUMN IF NOT EXISTS region TEXT DEFAULT 'santiago';

-- 2. Agregar columna region a checklist_bms
ALTER TABLE checklist_bms 
ADD COLUMN IF NOT EXISTS region TEXT DEFAULT 'santiago';

-- 3. Crear índice para filtrado por región
CREATE INDEX IF NOT EXISTS idx_checklist_bms_region ON checklist_bms(region);

COMMIT;

-- ============================================
-- VALORES POSIBLES PARA region:
-- 'santiago' = Santiago
-- 'quinta_region' = Quinta Región
-- ============================================