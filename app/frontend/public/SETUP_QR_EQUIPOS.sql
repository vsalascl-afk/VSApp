-- =====================================================
-- SETUP QR EQUIPOS MODULE
-- Run this SQL in your Supabase SQL Editor
-- =====================================================

BEGIN;

-- Table: equipos_bms (Equipment catalog with QR codes)
CREATE TABLE IF NOT EXISTS equipos_bms (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  codigo_activo TEXT NOT NULL,
  nombre TEXT NOT NULL,
  marca TEXT DEFAULT '',
  modelo TEXT DEFAULT '',
  numero_serie TEXT DEFAULT '',
  ubicacion_edificio TEXT DEFAULT '',
  ubicacion_piso TEXT DEFAULT '',
  ubicacion_area TEXT DEFAULT '',
  tipo_equipo TEXT DEFAULT '',
  notas TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS equipos_bms_empresa_idx ON equipos_bms(empresa_id);
CREATE INDEX IF NOT EXISTS equipos_bms_codigo_idx ON equipos_bms(codigo_activo);
CREATE UNIQUE INDEX IF NOT EXISTS equipos_bms_empresa_codigo_idx ON equipos_bms(empresa_id, codigo_activo);

-- RLS
ALTER TABLE equipos_bms ENABLE ROW LEVEL SECURITY;

-- Policy: Allow all operations with service role (used by the app)
CREATE POLICY "allow_all_equipos_bms" ON equipos_bms
  FOR ALL
  USING (true)
  WITH CHECK (true);

COMMIT;