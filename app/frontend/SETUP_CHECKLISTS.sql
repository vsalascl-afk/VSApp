-- ============================================
-- ElecData Pro - Módulo Checklist BMS
-- SQL para crear tablas en Supabase
-- Ejecutar en: Supabase Dashboard > SQL Editor
-- ============================================

BEGIN;

-- 1. Tabla de licenciamiento por módulo por empresa
-- (Controla qué empresas tienen acceso al módulo de checklists)
-- NOTA: empresa_id es TEXT para compatibilidad con empresas que usan BIGINT o UUID
CREATE TABLE IF NOT EXISTS company_modules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id TEXT NOT NULL,
  module_name TEXT NOT NULL,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE(empresa_id, module_name)
);

-- 2. Tabla principal del checklist BMS
-- Almacena todo el formulario como JSONB por sección
-- Soporta tanto Mantención BMS como Operación BMS (diferenciados por campo 'tipo')
-- NOTA: empresa_id y tecnico_id son TEXT para compatibilidad con IDs numéricos o UUID
CREATE TABLE IF NOT EXISTS checklist_bms (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id TEXT NOT NULL,
  tecnico_id TEXT NOT NULL,
  estado TEXT DEFAULT 'borrador' CHECK (estado IN ('borrador', 'en_proceso', 'finalizado')),
  
  -- Tipo de checklist: NULL o vacío = mantención BMS, 'operacion_bms' = operación
  tipo TEXT DEFAULT NULL,
  
  -- Sección 1: Información General (ambos tipos)
  informacion_general JSONB DEFAULT '{}'::jsonb,
  
  -- Secciones de Mantención BMS:
  -- Sección 2: Inspección Visual (campos OK/OBS/N/A)
  inspeccion_visual JSONB DEFAULT '{}'::jsonb,
  
  -- Sección 3: Inspección Eléctrica
  inspeccion_electrica JSONB DEFAULT '{}'::jsonb,
  
  -- Sección 4: Redes de Comunicación
  redes_comunicacion JSONB DEFAULT '{}'::jsonb,
  
  -- Sección 5: Software BMS
  software_bms JSONB DEFAULT '{}'::jsonb,
  
  -- Sección 6: Respaldos
  respaldos_data JSONB DEFAULT '{}'::jsonb,
  
  -- Sección 7: Pruebas Funcionales
  pruebas_funcionales JSONB DEFAULT '{}'::jsonb,
  
  -- Sección 8: Hallazgos (array de hallazgos)
  hallazgos_data JSONB DEFAULT '[]'::jsonb,
  
  -- Sección 9: Evidencias (URLs de fotos)
  evidencias_data JSONB DEFAULT '{}'::jsonb,
  
  -- Sección 10: Resultado Final
  resultado_final JSONB DEFAULT '{}'::jsonb,
  
  -- Sección 11: Firmas (base64 de firmas digitales)
  firmas_data JSONB DEFAULT '{}'::jsonb,
  
  -- Secciones de Operación BMS:
  -- Especialidades con items de monitoreo/control
  especialidades_data JSONB DEFAULT '[]'::jsonb,
  
  -- Bitácora digital
  bitacora TEXT DEFAULT '',
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Índices para optimización de consultas
CREATE INDEX IF NOT EXISTS idx_company_modules_empresa ON company_modules(empresa_id);
CREATE INDEX IF NOT EXISTS idx_checklist_bms_empresa ON checklist_bms(empresa_id);
CREATE INDEX IF NOT EXISTS idx_checklist_bms_tecnico ON checklist_bms(tecnico_id);
CREATE INDEX IF NOT EXISTS idx_checklist_bms_estado ON checklist_bms(estado);
CREATE INDEX IF NOT EXISTS idx_checklist_bms_tipo ON checklist_bms(tipo);
CREATE INDEX IF NOT EXISTS idx_checklist_bms_created ON checklist_bms(created_at DESC);

-- Índice GIN para búsquedas dentro del JSON de información general
CREATE INDEX IF NOT EXISTS idx_checklist_bms_info_general ON checklist_bms USING GIN (informacion_general);

-- Desactivar RLS (usando service role key desde la app)
ALTER TABLE company_modules DISABLE ROW LEVEL SECURITY;
ALTER TABLE checklist_bms DISABLE ROW LEVEL SECURITY;

COMMIT;

-- ============================================
-- INSTRUCCIONES DE USO:
-- ============================================
-- 
-- 1. Ejecutar este SQL completo en Supabase > SQL Editor
--
-- 2. Para ACTIVAR el módulo de checklists para una empresa:
--    INSERT INTO company_modules (empresa_id, module_name, active) 
--    VALUES ('UUID-DE-LA-EMPRESA', 'checklists', true);
--
-- 3. Para DESACTIVAR el módulo para una empresa:
--    UPDATE company_modules 
--    SET active = false 
--    WHERE empresa_id = 'UUID-DE-LA-EMPRESA' AND module_name = 'checklists';
--
-- 4. Para ver todos los checklists de una empresa:
--    SELECT * FROM checklist_bms 
--    WHERE empresa_id = 'UUID-DE-LA-EMPRESA' 
--    ORDER BY created_at DESC;
--
-- ============================================
-- ESTRUCTURA DE DATOS POR SECCIÓN:
-- ============================================
--
-- informacion_general: {
--   "cliente": "", "instalacion": "", "edificio": "", "piso": "",
--   "area": "", "fecha": "", "hora_inicio": "", "hora_termino": "",
--   "tecnico_responsable": "", "supervisor": "", "codigo_activo": "",
--   "marca": "", "modelo": "", "numero_serie": ""
-- }
--
-- inspeccion_visual: {
--   "estado_general_equipo": {"valor": "ok|obs|na", "comentario": "", "foto_url": ""},
--   "limpieza_general_equipo": {...}, "limpieza_entorno": {...},
--   "estado_gabinete": {...}, "estado_borneras": {...},
--   "estado_patch_cord": {...}, "estado_conector_red": {...},
--   "estado_ventilacion": {...}, "estado_etiquetado": {...},
--   "estado_indicadores_led": {...}, "ausencia_humedad": {...},
--   "ausencia_corrosion": {...}
-- }
--
-- inspeccion_electrica: {
--   "voltaje_ac": "", "voltaje_dc": "", "corriente_consumo": "",
--   "estado_fuente_alimentacion": "", "estado_fusibles": "",
--   "estado_proteccion_electrica": "",
--   "reapriete_terminales": {"valor": "", "comentario": "", "foto_url": ""},
--   "reapriete_contactos": {...}, "estado_cableado": {...},
--   "foto_url": ""
-- }
--
-- redes_comunicacion: {
--   "comunicacion_bacnet_ip": {"valor": "", "comentario": "", "foto_url": ""},
--   "comunicacion_bacnet_mstp": {...}, "comunicacion_modbus_rtu": {...},
--   "comunicacion_modbus_tcp": {...}, "estado_switch_industrial": {...},
--   "estado_red_ethernet": {...}, "estado_puntos_red": {...},
--   "estado_direccionamiento": {...},
--   "direccion_ip": "", "mascara": "", "gateway": "", "bacnet_device_id": ""
-- }
--
-- software_bms: {
--   "integracion_software": {"valor": "", "comentario": "", "foto_url": ""},
--   "comunicacion_servidor": {...}, "estado_alarmas": {...},
--   "estado_tendencias": {...}, "estado_graficos": {...},
--   "estado_puntos_monitoreados": {...}, "estado_historicos": {...},
--   "version_software": "", "version_firmware": ""
-- }
--
-- respaldos_data: {
--   "respaldo_base_datos": {"valor": "", "comentario": "", "foto_url": ""},
--   "respaldo_programacion": {...}, "respaldo_logica_control": {...},
--   "respaldo_configuraciones": {...}, "archivo_respaldo_url": ""
-- }
--
-- pruebas_funcionales: {
--   "lectura_variables": {"valor": "", "comentario": "", "foto_url": ""},
--   "escritura_variables": {...}, "alarmas": {...}, "tendencias": {...},
--   "comandos_remotos": {...}, "operacion_normal_controlador": {...},
--   "operacion_modulos_io": {...}
-- }
--
-- hallazgos_data: [
--   {
--     "tipos": ["Sobrecalentamiento", "Conexión floja"],
--     "criticidad": "alta",
--     "descripcion": "...",
--     "foto_url": "",
--     "accion_correctiva": "..."
--   }
-- ]
--
-- evidencias_data: {
--   "foto_frontal": "", "foto_interior": "", "foto_comunicaciones": "",
--   "foto_hallazgos": "", "foto_etiquetado": "", "foto_mediciones": ""
-- }
--
-- resultado_final: {
--   "estado_general": "operativo|operativo_obs|requiere_correctivo|fuera_servicio",
--   "observaciones_generales": "", "recomendaciones": ""
-- }
--
-- firmas_data: {
--   "firma_tecnico": "data:image/png;base64,...",
--   "firma_supervisor": "data:image/png;base64,...",
--   "firma_cliente": "data:image/png;base64,...",
--   "fecha_cierre": "2026-01-15"
-- }
-- ============================================