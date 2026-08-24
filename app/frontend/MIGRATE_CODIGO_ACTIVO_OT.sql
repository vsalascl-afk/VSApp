-- Migración: Agregar campo codigo_activo a ordenes_trabajo
-- Permite vincular OTs con equipos del catálogo QR

BEGIN;

-- Agregar columna codigo_activo a ordenes_trabajo
ALTER TABLE ordenes_trabajo 
ADD COLUMN IF NOT EXISTS codigo_activo TEXT;

-- Crear índice para búsquedas por codigo_activo
CREATE INDEX IF NOT EXISTS idx_ordenes_trabajo_codigo_activo 
ON ordenes_trabajo(codigo_activo) 
WHERE codigo_activo IS NOT NULL;

COMMIT;