-- ============================================================
-- FIX: Cambiar ot_id de UUID a TEXT en inventario_ot_asignacion
-- Motivo: ordenes_trabajo usa id INTEGER, no UUID
-- ============================================================
-- Ejecutar en el SQL Editor de Supabase

-- Opción 1: Si la tabla YA EXISTE y tiene datos
ALTER TABLE inventario_ot_asignacion ALTER COLUMN ot_id TYPE TEXT;

-- Opción 2: Si la tabla NO EXISTE o quieres recrearla desde cero
-- (Descomenta las líneas siguientes y comenta la Opción 1)
-- DROP TABLE IF EXISTS inventario_ot_asignacion;
-- Luego ejecuta MIGRATE_INVENTARIO_INDEPENDIENTE.sql completo