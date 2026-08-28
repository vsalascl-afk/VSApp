-- ============================================================
-- MIGRACIÓN: Libro de Obra escribible desde el Portal Cliente
-- Fecha: 28 agosto 2026
--
-- Contexto: hoy el tab "Libro de Obra" del Portal Cliente es de solo
-- lectura (usa la función get_portal_libro_obra). El cliente pidió poder
-- agregar sus propias notas desde ahí.
--
-- Los clientes del portal se autentican solo con un token (uuid) de
-- portal_clientes, NO son usuarios de Supabase Auth, así que no pueden
-- pasar por la misma política RLS que usa el personal interno para
-- escribir en libro_obra (esa política valida vía auth.uid()).
-- Se resuelve con el mismo patrón ya usado por "tickets": una función
-- SECURITY DEFINER (crear_libro_obra_portal) que valida el token a mano
-- y hace el insert con privilegios elevados.
--
-- Esquema real de libro_obra confirmado antes de esta migración:
--   id uuid, empresa_id uuid, proyecto_id uuid, ot_id bigint (nullable),
--   autor_id bigint NOT NULL (→ usuarios.id), tipo_evento text,
--   contenido text, adjuntos jsonb (nullable), creado_en timestamptz
--
-- La tabla sigue siendo inmutable (sin UPDATE/DELETE para nadie, esto no
-- cambia). Solo se agrega una forma más de INSERT.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1. Esquema: permitir que una entrada la haya escrito un cliente
--    del portal en vez de un usuario interno.
-- ------------------------------------------------------------

ALTER TABLE libro_obra ALTER COLUMN autor_id DROP NOT NULL;

ALTER TABLE libro_obra
  ADD COLUMN IF NOT EXISTS autor_portal_cliente_id UUID REFERENCES portal_clientes(id);

CREATE INDEX IF NOT EXISTS idx_libro_obra_autor_portal_cliente
  ON libro_obra(autor_portal_cliente_id);

-- Exactamente uno de los dos debe estar seteado: o lo escribió un
-- usuario interno (autor_id) o un cliente del portal (autor_portal_cliente_id).
ALTER TABLE libro_obra DROP CONSTRAINT IF EXISTS libro_obra_autor_check;
ALTER TABLE libro_obra
  ADD CONSTRAINT libro_obra_autor_check
  CHECK (
    (autor_id IS NOT NULL AND autor_portal_cliente_id IS NULL)
    OR
    (autor_id IS NULL AND autor_portal_cliente_id IS NOT NULL)
  );

-- ------------------------------------------------------------
-- 2. Función: crear_libro_obra_portal
--    Valida el token, valida que el proyecto sea del cliente dueño
--    del token, valida el tipo de evento permitido, e inserta.
--
--    Tipos de evento habilitados para el cliente: avance, incidencia,
--    otro. Se dejan afuera instruccion/material/correccion por ser de
--    uso interno (instrucciones/correcciones a los técnicos). Si esto
--    no es lo que quieres, ajusta el array v_tipos_permitidos abajo.
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.crear_libro_obra_portal(
  p_token UUID,
  p_proyecto_id UUID,
  p_contenido TEXT,
  p_tipo_evento TEXT DEFAULT 'otro',
  p_adjuntos JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_portal_cliente_id UUID;
  v_empresa_id UUID;
  v_nuevo_id UUID;
  v_tipos_permitidos TEXT[] := ARRAY['avance', 'incidencia', 'otro'];
BEGIN
  -- Token válido, activo y vigente
  SELECT id INTO v_portal_cliente_id
  FROM portal_clientes
  WHERE token = p_token
    AND activo = true
    AND (fecha_expiracion IS NULL OR fecha_expiracion > now())
  LIMIT 1;

  IF v_portal_cliente_id IS NULL THEN
    RAISE EXCEPTION 'Token inválido o expirado' USING ERRCODE = '28000';
  END IF;

  -- El proyecto debe pertenecer a este cliente
  SELECT empresa_id INTO v_empresa_id
  FROM proyectos
  WHERE id = p_proyecto_id
    AND cliente_final_id = v_portal_cliente_id;

  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Proyecto no encontrado o no autorizado' USING ERRCODE = '42501';
  END IF;

  -- Tipo de evento permitido para el portal
  IF p_tipo_evento IS NULL OR NOT (p_tipo_evento = ANY(v_tipos_permitidos)) THEN
    RAISE EXCEPTION 'Tipo de evento no permitido para el portal cliente' USING ERRCODE = '22023';
  END IF;

  -- Contenido no vacío
  IF p_contenido IS NULL OR length(trim(p_contenido)) = 0 THEN
    RAISE EXCEPTION 'El contenido es obligatorio' USING ERRCODE = '22023';
  END IF;

  INSERT INTO libro_obra (empresa_id, proyecto_id, autor_id, autor_portal_cliente_id, tipo_evento, contenido, adjuntos)
  VALUES (v_empresa_id, p_proyecto_id, NULL, v_portal_cliente_id, p_tipo_evento, trim(p_contenido), p_adjuntos)
  RETURNING id INTO v_nuevo_id;

  RETURN v_nuevo_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.crear_libro_obra_portal(UUID, UUID, TEXT, TEXT, JSONB) TO anon, authenticated;

-- ------------------------------------------------------------
-- 3. Función: get_portal_libro_obra (reemplazo)
--    Mismo contrato de entrada/salida que ya usa el frontend hoy
--    (p_token, p_proyecto_id) -> (id, tipo_evento, contenido, adjuntos,
--    creado_en, autor_nombre). Se reemplaza completa para que
--    autor_nombre resuelva bien tanto para entradas de usuarios
--    internos como para entradas de clientes del portal.
--
--    OJO: esto reemplaza la función actual. Si la versión original
--    tenía alguna lógica extra (por ejemplo, ocultar cierto tipo_evento
--    al cliente) que no esté reflejada acá, avísame antes de correr esto
--    para no perderla — a juzgar por el frontend (que ya tiene labels
--    para los 6 tipos) no parece haber ese filtro, pero no está de más
--    confirmarlo.
-- ------------------------------------------------------------

DROP FUNCTION IF EXISTS public.get_portal_libro_obra(UUID, UUID);

CREATE OR REPLACE FUNCTION public.get_portal_libro_obra(
  p_token UUID,
  p_proyecto_id UUID
)
RETURNS TABLE (
  id UUID,
  tipo_evento TEXT,
  contenido TEXT,
  adjuntos JSONB,
  creado_en TIMESTAMPTZ,
  autor_nombre TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_portal_cliente_id UUID;
BEGIN
  SELECT pc.id INTO v_portal_cliente_id
  FROM portal_clientes pc
  WHERE pc.token = p_token
    AND pc.activo = true
    AND (pc.fecha_expiracion IS NULL OR pc.fecha_expiracion > now())
  LIMIT 1;

  IF v_portal_cliente_id IS NULL THEN
    RAISE EXCEPTION 'Token inválido o expirado' USING ERRCODE = '28000';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM proyectos p
    WHERE p.id = p_proyecto_id AND p.cliente_final_id = v_portal_cliente_id
  ) THEN
    RAISE EXCEPTION 'Proyecto no encontrado o no autorizado' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    lo.id,
    lo.tipo_evento,
    lo.contenido,
    lo.adjuntos,
    lo.creado_en,
    COALESCE(u.nombre, pc2.nombre_cliente || ' (Cliente)') AS autor_nombre
  FROM libro_obra lo
  LEFT JOIN usuarios u ON u.id = lo.autor_id
  LEFT JOIN portal_clientes pc2 ON pc2.id = lo.autor_portal_cliente_id
  WHERE lo.proyecto_id = p_proyecto_id
  ORDER BY lo.creado_en DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_portal_libro_obra(UUID, UUID) TO anon, authenticated;

COMMIT;

-- ============================================================
-- Verificación rápida después de aplicar (reemplaza los uuid/valores):
--
--   -- Debe funcionar sin error de constraint:
--   select autor_id, autor_portal_cliente_id from libro_obra limit 5;
--
--   -- Prueba de la función nueva (usa un token real de portal_clientes
--   -- y un proyecto que le pertenezca):
--   select crear_libro_obra_portal(
--     '00000000-0000-0000-0000-000000000000'::uuid, -- token
--     '00000000-0000-0000-0000-000000000000'::uuid, -- proyecto_id
--     'Prueba de nota desde el portal',
--     'avance'
--   );
--
--   -- Debe traerla de vuelta con el nombre del cliente:
--   select * from get_portal_libro_obra(
--     '00000000-0000-0000-0000-000000000000'::uuid,
--     '00000000-0000-0000-0000-000000000000'::uuid
--   );
-- ============================================================
