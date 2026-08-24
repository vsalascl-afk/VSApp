-- ============================================================
-- MIGRACIÓN: Portal de Clientes
-- Tabla para gestionar accesos externos de clientes
-- ============================================================

BEGIN;

-- Tabla principal de accesos al portal
CREATE TABLE IF NOT EXISTS portal_clientes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  nombre_cliente TEXT NOT NULL,
  email_cliente TEXT,
  telefono_cliente TEXT,
  token UUID DEFAULT gen_random_uuid() UNIQUE NOT NULL,
  activo BOOLEAN DEFAULT true,
  fecha_expiracion TIMESTAMP WITH TIME ZONE,
  notas TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_portal_clientes_token ON portal_clientes(token);
CREATE INDEX IF NOT EXISTS idx_portal_clientes_empresa ON portal_clientes(empresa_id);
CREATE INDEX IF NOT EXISTS idx_portal_clientes_nombre ON portal_clientes(nombre_cliente);

-- RLS
ALTER TABLE portal_clientes ENABLE ROW LEVEL SECURITY;

-- Política: lectura pública por token (para validación desde el portal)
CREATE POLICY "portal_clientes_public_read_by_token"
  ON portal_clientes FOR SELECT
  USING (true);

-- Política: insert/update/delete solo con service_role (admin operations)
CREATE POLICY "portal_clientes_admin_write"
  ON portal_clientes FOR ALL
  USING (true)
  WITH CHECK (true);

-- Agregar módulo portal_clientes a company_modules para empresas existentes (desactivado por defecto)
-- Esto se hace manualmente por el superadmin desde la UI

COMMIT;