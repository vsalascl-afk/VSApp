-- ============================================================
-- SETUP: company_modules + equipos_bms
-- Ejecutar en Supabase SQL Editor (Dashboard > SQL Editor > New Query)
-- EJECUTAR TODO DE UNA VEZ
-- ============================================================

-- 1. Crear tabla company_modules si no existe
CREATE TABLE IF NOT EXISTS company_modules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL,
  module_name TEXT NOT NULL,
  active BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. ELIMINAR TODOS los constraints incorrectos
ALTER TABLE company_modules 
  DROP CONSTRAINT IF EXISTS company_modules_module_name_key;

ALTER TABLE company_modules 
  DROP CONSTRAINT IF EXISTS company_modules_empresa_id_key;

ALTER TABLE company_modules 
  DROP CONSTRAINT IF EXISTS company_modules_empresa_module_unique;

-- 3. Agregar constraint CORRECTO (empresa_id + module_name combinados)
ALTER TABLE company_modules 
  ADD CONSTRAINT company_modules_empresa_module_unique 
  UNIQUE (empresa_id, module_name);

-- 5. Eliminar indice antiguo si existe
DROP INDEX IF EXISTS idx_company_modules_empresa_module;

-- 4. Habilitar RLS
ALTER TABLE company_modules ENABLE ROW LEVEL SECURITY;

-- 5. Recrear politicas
DROP POLICY IF EXISTS "allow_read_company_modules" ON company_modules;
DROP POLICY IF EXISTS "allow_insert_company_modules" ON company_modules;
DROP POLICY IF EXISTS "allow_update_company_modules" ON company_modules;
DROP POLICY IF EXISTS "allow_delete_company_modules" ON company_modules;
DROP POLICY IF EXISTS "allow_anon_read_company_modules" ON company_modules;

CREATE POLICY "allow_anon_read_company_modules" ON company_modules
  FOR SELECT TO anon USING (true);

CREATE POLICY "allow_read_company_modules" ON company_modules
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "allow_insert_company_modules" ON company_modules
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "allow_update_company_modules" ON company_modules
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "allow_delete_company_modules" ON company_modules
  FOR DELETE TO authenticated USING (true);

-- ============================================================
-- 6. Crear tabla equipos_bms si no existe
-- ============================================================

CREATE TABLE IF NOT EXISTS equipos_bms (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL,
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
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_equipos_bms_empresa ON equipos_bms(empresa_id);
CREATE INDEX IF NOT EXISTS idx_equipos_bms_codigo ON equipos_bms(codigo_activo);

ALTER TABLE equipos_bms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_read_equipos_bms" ON equipos_bms;
DROP POLICY IF EXISTS "allow_insert_equipos_bms" ON equipos_bms;
DROP POLICY IF EXISTS "allow_update_equipos_bms" ON equipos_bms;
DROP POLICY IF EXISTS "allow_delete_equipos_bms" ON equipos_bms;
DROP POLICY IF EXISTS "allow_anon_read_equipos_bms" ON equipos_bms;

CREATE POLICY "allow_anon_read_equipos_bms" ON equipos_bms
  FOR SELECT TO anon USING (true);

CREATE POLICY "allow_read_equipos_bms" ON equipos_bms
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "allow_insert_equipos_bms" ON equipos_bms
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "allow_update_equipos_bms" ON equipos_bms
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "allow_delete_equipos_bms" ON equipos_bms
  FOR DELETE TO authenticated USING (true);