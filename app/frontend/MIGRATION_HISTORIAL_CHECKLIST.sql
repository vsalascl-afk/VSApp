-- ============================================
-- MIGRACIÓN: Agregar campos de historial y timestamps a checklist_bms
-- ============================================
-- Ejecutar en Supabase Dashboard > SQL Editor

BEGIN;

-- 1. Agregar columna historial de modificaciones (JSONB array)
ALTER TABLE checklist_bms 
ADD COLUMN IF NOT EXISTS historial_modificaciones JSONB DEFAULT '[]'::jsonb;

-- 2. Agregar hora de creación (texto con formato local)
ALTER TABLE checklist_bms 
ADD COLUMN IF NOT EXISTS hora_creacion TEXT;

-- 3. Agregar hora de cierre (texto con formato local)
ALTER TABLE checklist_bms 
ADD COLUMN IF NOT EXISTS hora_cierre TEXT;

COMMIT;

-- ============================================
-- ESTRUCTURA historial_modificaciones:
-- [
--   { "fecha": "26-06-2026, 21:30:00", "usuario": "Juan Pérez", "descripcion": "Creó el checklist" },
--   { "fecha": "26-06-2026, 22:15:00", "usuario": "Juan Pérez", "descripcion": "Editó y guardó cambios" },
--   { "fecha": "27-06-2026, 09:00:00", "usuario": "Juan Pérez", "descripcion": "Completó y finalizó el checklist" }
-- ]
-- ============================================