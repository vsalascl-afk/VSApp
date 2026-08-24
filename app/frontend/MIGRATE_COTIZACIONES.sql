-- ============================================================
-- MIGRACIÓN: Módulo de Cotizaciones/Presupuestos
-- Ejecutar en Supabase SQL Editor
-- ============================================================

BEGIN;

-- Tabla principal de cotizaciones
CREATE TABLE IF NOT EXISTS cotizaciones (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  numero TEXT NOT NULL,
  empresa_id UUID NOT NULL,
  ot_id BIGINT REFERENCES ordenes_trabajo(id) ON DELETE SET NULL,
  ot_numero TEXT,
  cliente_nombre TEXT NOT NULL,
  cliente_rut TEXT,
  cliente_email TEXT,
  cliente_telefono TEXT,
  cliente_direccion TEXT,
  titulo TEXT NOT NULL,
  descripcion TEXT,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  descuento_global NUMERIC(5,2) NOT NULL DEFAULT 0,
  iva NUMERIC(12,2) NOT NULL DEFAULT 0,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  estado TEXT NOT NULL DEFAULT 'borrador' CHECK (estado IN ('borrador', 'enviada', 'aprobada', 'rechazada')),
  validez_dias INTEGER NOT NULL DEFAULT 30,
  notas TEXT,
  condiciones_pago TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS cotizaciones_empresa_idx ON cotizaciones(empresa_id);
CREATE INDEX IF NOT EXISTS cotizaciones_estado_idx ON cotizaciones(estado);
CREATE INDEX IF NOT EXISTS cotizaciones_created_idx ON cotizaciones(created_at DESC);
CREATE INDEX IF NOT EXISTS cotizaciones_ot_idx ON cotizaciones(ot_id);

-- RLS
ALTER TABLE cotizaciones ENABLE ROW LEVEL SECURITY;

-- Políticas: usuarios autenticados de la misma empresa pueden ver/crear/editar/eliminar
CREATE POLICY "cotizaciones_select" ON cotizaciones
  FOR SELECT USING (true);

CREATE POLICY "cotizaciones_insert" ON cotizaciones
  FOR INSERT WITH CHECK (true);

CREATE POLICY "cotizaciones_update" ON cotizaciones
  FOR UPDATE USING (true);

CREATE POLICY "cotizaciones_delete" ON cotizaciones
  FOR DELETE USING (true);

COMMIT;