-- ============================================
-- FIX: Cambiar tipos de tecnico_id/supervisor_id/usuario_id
-- empresa_id es UUID (tabla empresas usa UUID)
-- tecnico_id, supervisor_id, usuario_id son TEXT (tabla usuarios usa IDs numéricos)
-- Ejecutar este script en Supabase SQL Editor
-- ============================================

BEGIN;

-- Eliminar tablas existentes (si tienen datos, hacer backup primero)
DROP TABLE IF EXISTS maintenance_notifications;
DROP TABLE IF EXISTS maintenance_schedules;

-- Recrear tabla de programaciones con tipos correctos
CREATE TABLE IF NOT EXISTS maintenance_schedules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL,
  tipo_checklist TEXT NOT NULL CHECK (tipo_checklist IN ('mantencion_bms', 'operacion_bms', 'grupo_electrogeno')),
  sitio TEXT NOT NULL,
  equipo TEXT,
  descripcion TEXT,
  frecuencia TEXT NOT NULL CHECK (frecuencia IN ('semanal', 'quincenal', 'mensual', 'trimestral', 'semestral', 'anual')),
  proxima_fecha DATE NOT NULL,
  ultima_ejecucion DATE,
  tecnico_id TEXT,
  supervisor_id TEXT,
  activo BOOLEAN DEFAULT true,
  dias_anticipacion_alerta INTEGER DEFAULT 7,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Índices para maintenance_schedules
CREATE INDEX IF NOT EXISTS idx_schedules_empresa ON maintenance_schedules(empresa_id);
CREATE INDEX IF NOT EXISTS idx_schedules_proxima_fecha ON maintenance_schedules(proxima_fecha);
CREATE INDEX IF NOT EXISTS idx_schedules_tecnico ON maintenance_schedules(tecnico_id);
CREATE INDEX IF NOT EXISTS idx_schedules_activo ON maintenance_schedules(activo);

-- Recrear tabla de notificaciones con tipos correctos
CREATE TABLE IF NOT EXISTS maintenance_notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  schedule_id UUID REFERENCES maintenance_schedules(id) ON DELETE CASCADE,
  empresa_id UUID NOT NULL,
  usuario_id TEXT NOT NULL,
  tipo_alerta TEXT NOT NULL CHECK (tipo_alerta IN ('informativa', 'recordatorio', 'urgente', 'vencida')),
  mensaje TEXT NOT NULL,
  leida BOOLEAN DEFAULT false,
  fecha_alerta DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Índices para maintenance_notifications
CREATE INDEX IF NOT EXISTS idx_notifications_usuario ON maintenance_notifications(usuario_id);
CREATE INDEX IF NOT EXISTS idx_notifications_empresa ON maintenance_notifications(empresa_id);
CREATE INDEX IF NOT EXISTS idx_notifications_leida ON maintenance_notifications(leida);
CREATE INDEX IF NOT EXISTS idx_notifications_fecha ON maintenance_notifications(fecha_alerta DESC);

-- RLS
ALTER TABLE maintenance_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_notifications ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "schedules_all_service" ON maintenance_schedules FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "notifications_all_service" ON maintenance_notifications FOR ALL USING (true) WITH CHECK (true);

COMMIT;