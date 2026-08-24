-- Migración: Agregar campo programacion_id a ordenes_trabajo para vincular OTs con programaciones
-- Ejecutar en Supabase SQL Editor

BEGIN;

-- Agregar columna programacion_id a ordenes_trabajo
ALTER TABLE ordenes_trabajo 
ADD COLUMN IF NOT EXISTS programacion_id UUID REFERENCES maintenance_schedules(id) ON DELETE SET NULL;

-- Crear índice para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_ot_programacion_id ON ordenes_trabajo(programacion_id);

COMMIT;