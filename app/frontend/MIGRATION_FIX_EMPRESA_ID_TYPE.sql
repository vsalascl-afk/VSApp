-- ============================================
-- MIGRACIÓN: Corregir tipo de empresa_id y tecnico_id en tablas de checklists
-- ============================================
-- PROBLEMA: Las tablas checklist_bms y company_modules fueron creadas con
-- empresa_id UUID, pero la tabla empresas usa BIGINT como ID.
-- Esto causa el error: "invalid input syntax for type uuid: '20'"
--
-- SOLUCIÓN: Cambiar el tipo de las columnas a TEXT para compatibilidad.
-- ============================================

-- Ejecutar en Supabase Dashboard > SQL Editor:

BEGIN;

-- 1. Corregir company_modules
ALTER TABLE company_modules 
  ALTER COLUMN empresa_id TYPE TEXT USING empresa_id::TEXT;

-- 2. Corregir checklist_bms
ALTER TABLE checklist_bms 
  ALTER COLUMN empresa_id TYPE TEXT USING empresa_id::TEXT;

ALTER TABLE checklist_bms 
  ALTER COLUMN tecnico_id TYPE TEXT USING tecnico_id::TEXT;

COMMIT;