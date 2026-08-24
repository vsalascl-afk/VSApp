-- ============================================================
-- MIGRACIÓN: Módulo de Inventario Independiente
-- Tablas: catalogo_inventario + inventario_ot_asignacion
-- ============================================================

BEGIN;

-- 1. Tabla catálogo maestro de inventario
CREATE TABLE IF NOT EXISTS catalogo_inventario (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL,
  nombre TEXT NOT NULL,
  descripcion TEXT DEFAULT '',
  unidad TEXT DEFAULT 'unidad',
  costo_unitario NUMERIC(12,2) DEFAULT 0,
  codigo_material TEXT DEFAULT '',
  categoria TEXT DEFAULT 'material' CHECK (categoria IN ('repuesto','insumo','material','herramienta')),
  stock_actual INTEGER DEFAULT 0,
  stock_minimo INTEGER DEFAULT 0,
  ubicacion TEXT DEFAULT '',
  proveedor TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_catalogo_inv_empresa ON catalogo_inventario(empresa_id);
CREATE INDEX IF NOT EXISTS idx_catalogo_inv_categoria ON catalogo_inventario(categoria);
CREATE INDEX IF NOT EXISTS idx_catalogo_inv_nombre ON catalogo_inventario(nombre);

-- RLS
ALTER TABLE catalogo_inventario ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "catalogo_inventario_select" ON catalogo_inventario;
CREATE POLICY "catalogo_inventario_select" ON catalogo_inventario FOR SELECT USING (true);
DROP POLICY IF EXISTS "catalogo_inventario_insert" ON catalogo_inventario;
CREATE POLICY "catalogo_inventario_insert" ON catalogo_inventario FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "catalogo_inventario_update" ON catalogo_inventario;
CREATE POLICY "catalogo_inventario_update" ON catalogo_inventario FOR UPDATE USING (true);
DROP POLICY IF EXISTS "catalogo_inventario_delete" ON catalogo_inventario;
CREATE POLICY "catalogo_inventario_delete" ON catalogo_inventario FOR DELETE USING (true);

-- 2. Tabla de asignaciones de ítems del catálogo a OTs
-- NOTA: ot_id es TEXT porque ordenes_trabajo usa id INTEGER (no UUID)
CREATE TABLE IF NOT EXISTS inventario_ot_asignacion (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL,
  catalogo_item_id UUID NOT NULL REFERENCES catalogo_inventario(id) ON DELETE CASCADE,
  ot_id TEXT NOT NULL,
  cantidad INTEGER DEFAULT 1,
  notas TEXT DEFAULT '',
  asignado_por TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_inv_asig_empresa ON inventario_ot_asignacion(empresa_id);
CREATE INDEX IF NOT EXISTS idx_inv_asig_catalogo ON inventario_ot_asignacion(catalogo_item_id);
CREATE INDEX IF NOT EXISTS idx_inv_asig_ot ON inventario_ot_asignacion(ot_id);

-- RLS
ALTER TABLE inventario_ot_asignacion ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "inv_asig_select" ON inventario_ot_asignacion;
CREATE POLICY "inv_asig_select" ON inventario_ot_asignacion FOR SELECT USING (true);
DROP POLICY IF EXISTS "inv_asig_insert" ON inventario_ot_asignacion;
CREATE POLICY "inv_asig_insert" ON inventario_ot_asignacion FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "inv_asig_update" ON inventario_ot_asignacion;
CREATE POLICY "inv_asig_update" ON inventario_ot_asignacion FOR UPDATE USING (true);
DROP POLICY IF EXISTS "inv_asig_delete" ON inventario_ot_asignacion;
CREATE POLICY "inv_asig_delete" ON inventario_ot_asignacion FOR DELETE USING (true);

COMMIT;