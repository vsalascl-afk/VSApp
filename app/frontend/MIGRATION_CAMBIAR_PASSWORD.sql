-- Migración: Agregar campo debe_cambiar_password a tabla usuarios
-- Ejecutar en Supabase SQL Editor

ALTER TABLE usuarios 
ADD COLUMN IF NOT EXISTS debe_cambiar_password BOOLEAN DEFAULT true;

-- Marcar usuarios existentes como que NO necesitan cambiar (ya tienen su contraseña)
UPDATE usuarios SET debe_cambiar_password = false WHERE debe_cambiar_password IS NULL OR debe_cambiar_password = true;

-- Comentario: Los nuevos usuarios creados desde el panel admin tendrán debe_cambiar_password = true
-- y deberán cambiar su contraseña en el primer login.