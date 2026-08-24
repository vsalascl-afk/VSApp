-- ============================================
-- MIGRACIÓN: Ampliar CHECK constraint de tipo_checklist
-- para soportar tipos adicionales en el módulo Programación independiente
-- Ejecutar en Supabase SQL Editor
-- ============================================

BEGIN;

-- Eliminar el constraint existente de tipo_checklist
ALTER TABLE maintenance_schedules DROP CONSTRAINT IF EXISTS maintenance_schedules_tipo_checklist_check;

-- Crear nuevo constraint con todos los tipos soportados
ALTER TABLE maintenance_schedules ADD CONSTRAINT maintenance_schedules_tipo_checklist_check 
  CHECK (tipo_checklist IN ('mantencion_bms', 'operacion_bms', 'grupo_electrogeno', 'preventivo', 'correctivo', 'predictivo'));

-- Agregar campo programacion_id a ordenes_trabajo (si no existe)
ALTER TABLE ordenes_trabajo ADD COLUMN IF NOT EXISTS programacion_id UUID REFERENCES maintenance_schedules(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_ot_programacion_id ON ordenes_trabajo(programacion_id);

COMMIT;