-- =====================================================
-- MIGRACIÓN: Manuales/Fichas Técnicas + Inventario OT
-- =====================================================

BEGIN;

-- 1. Tabla para manuales/fichas técnicas asociados a activos
CREATE TABLE IF NOT EXISTS activo_documentos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL,
  equipo_id UUID NOT NULL,
  nombre TEXT NOT NULL,
  descripcion TEXT DEFAULT '',
  tipo TEXT DEFAULT 'manual', -- manual, ficha_tecnica, plano, certificado, otro
  archivo_url TEXT NOT NULL,
  archivo_nombre TEXT NOT NULL,
  archivo_size INTEGER DEFAULT 0,
  subido_por UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_activo_documentos_empresa ON activo_documentos(empresa_id);
CREATE INDEX IF NOT EXISTS idx_activo_documentos_equipo ON activo_documentos(equipo_id);

-- RLS
ALTER TABLE activo_documentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_read_activo_documentos" ON activo_documentos FOR SELECT USING (true);
CREATE POLICY "allow_insert_activo_documentos" ON activo_documentos FOR INSERT WITH CHECK (true);
CREATE POLICY "allow_delete_activo_documentos" ON activo_documentos FOR DELETE USING (true);

-- 2. Tabla para inventario de materiales/insumos/repuestos asociados a OT
CREATE TABLE IF NOT EXISTS inventario_ot (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL,
  ot_id UUID NOT NULL,
  nombre TEXT NOT NULL,
  descripcion TEXT DEFAULT '',
  cantidad NUMERIC(10,2) NOT NULL DEFAULT 1,
  unidad TEXT DEFAULT 'unidad', -- unidad, metro, litro, kg, rollo, caja, etc.
  costo_unitario NUMERIC(12,2) DEFAULT 0,
  codigo_material TEXT DEFAULT '',
  categoria TEXT DEFAULT 'repuesto', -- repuesto, insumo, material, herramienta
  agregado_por UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_inventario_ot_empresa ON inventario_ot(empresa_id);
CREATE INDEX IF NOT EXISTS idx_inventario_ot_ot ON inventario_ot(ot_id);

-- RLS
ALTER TABLE inventario_ot ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_read_inventario_ot" ON inventario_ot FOR SELECT USING (true);
CREATE POLICY "allow_insert_inventario_ot" ON inventario_ot FOR INSERT WITH CHECK (true);
CREATE POLICY "allow_update_inventario_ot" ON inventario_ot FOR UPDATE USING (true);
CREATE POLICY "allow_delete_inventario_ot" ON inventario_ot FOR DELETE USING (true);

-- 3. Storage bucket para documentos de activos (ejecutar en Supabase Dashboard > Storage)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('activo_documentos', 'activo_documentos', true) ON CONFLICT (id) DO NOTHING;

COMMIT;