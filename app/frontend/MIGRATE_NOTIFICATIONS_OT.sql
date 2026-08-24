-- Migración: Permitir notificaciones sin schedule_id (para notificaciones de OT)
-- Ejecutar en Supabase SQL Editor

-- Hacer schedule_id nullable para soportar notificaciones de OT
ALTER TABLE maintenance_notifications ALTER COLUMN schedule_id DROP NOT NULL;

-- Eliminar la foreign key constraint existente para permitir null y referencias a OTs
ALTER TABLE maintenance_notifications DROP CONSTRAINT IF EXISTS maintenance_notifications_schedule_id_fkey;

-- Agregar campo opcional para referenciar OT
ALTER TABLE maintenance_notifications ADD COLUMN IF NOT EXISTS ot_id TEXT;

-- Índice para buscar notificaciones por OT
CREATE INDEX IF NOT EXISTS idx_notifications_ot_id ON maintenance_notifications(ot_id);