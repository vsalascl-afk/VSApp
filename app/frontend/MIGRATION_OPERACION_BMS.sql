-- ============================================
-- ElecData Pro - Migración: Agregar Operación BMS
-- Ejecutar en: Supabase Dashboard > SQL Editor
-- ============================================
-- Este script agrega las columnas necesarias para el sub-módulo
-- "Operación BMS" a la tabla checklist_bms existente.
-- Es seguro ejecutar múltiples veces (usa IF NOT EXISTS).
-- ============================================

-- Agregar columna 'tipo' para diferenciar mantención vs operación
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'checklist_bms' AND column_name = 'tipo'
  ) THEN
    ALTER TABLE checklist_bms ADD COLUMN tipo TEXT DEFAULT NULL;
  END IF;
END $$;

-- Agregar columna 'especialidades_data' para datos de ronda de operación
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'checklist_bms' AND column_name = 'especialidades_data'
  ) THEN
    ALTER TABLE checklist_bms ADD COLUMN especialidades_data JSONB DEFAULT '[]'::jsonb;
  END IF;
END $$;

-- Agregar columna 'bitacora' para la bitácora digital
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'checklist_bms' AND column_name = 'bitacora'
  ) THEN
    ALTER TABLE checklist_bms ADD COLUMN bitacora TEXT DEFAULT '';
  END IF;
END $$;

-- Crear índice para filtrar por tipo
CREATE INDEX IF NOT EXISTS idx_checklist_bms_tipo ON checklist_bms(tipo);

-- ============================================
-- VERIFICACIÓN: Ejecutar después para confirmar
-- ============================================
-- SELECT column_name, data_type 
-- FROM information_schema.columns 
-- WHERE table_name = 'checklist_bms' 
-- ORDER BY ordinal_position;
-- ============================================