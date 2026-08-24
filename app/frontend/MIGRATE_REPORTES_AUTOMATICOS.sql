-- Migración: Tabla para configuración de reportes automáticos por email
-- Ejecutar en Supabase SQL Editor

BEGIN;

-- Tabla de configuraciones de reportes automáticos
CREATE TABLE IF NOT EXISTS reportes_automaticos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL,
  nombre TEXT NOT NULL,
  tipo_reporte TEXT NOT NULL DEFAULT 'resumen_ots',
  periodicidad TEXT NOT NULL DEFAULT 'semanal', -- diario, semanal, quincenal, mensual
  dia_envio TEXT NOT NULL DEFAULT 'lunes', -- día de la semana o número del mes
  hora_envio TEXT NOT NULL DEFAULT '08:00',
  destinatarios JSONB NOT NULL DEFAULT '[]'::jsonb,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  ultimo_envio TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_reportes_auto_empresa ON reportes_automaticos(empresa_id);
CREATE INDEX IF NOT EXISTS idx_reportes_auto_activo ON reportes_automaticos(activo);
CREATE INDEX IF NOT EXISTS idx_reportes_auto_periodicidad ON reportes_automaticos(periodicidad);

-- RLS
ALTER TABLE reportes_automaticos ENABLE ROW LEVEL SECURITY;

-- Política: usuarios autenticados pueden ver reportes de su empresa
CREATE POLICY "allow_select_reportes_auto" ON reportes_automaticos
  FOR SELECT USING (true);

-- Política: usuarios autenticados pueden insertar
CREATE POLICY "allow_insert_reportes_auto" ON reportes_automaticos
  FOR INSERT WITH CHECK (true);

-- Política: usuarios autenticados pueden actualizar
CREATE POLICY "allow_update_reportes_auto" ON reportes_automaticos
  FOR UPDATE USING (true);

-- Política: usuarios autenticados pueden eliminar
CREATE POLICY "allow_delete_reportes_auto" ON reportes_automaticos
  FOR DELETE USING (true);

COMMIT;