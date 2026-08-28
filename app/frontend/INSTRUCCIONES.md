# Libro de Obra escribible desde el Portal Cliente — cómo aplicar

Dos archivos:

1. `MIGRATE_LIBRO_OBRA_PORTAL.sql` — corre en el SQL Editor de Supabase.
2. `libro_obra_portal.patch` — cambios de código para `PortalCliente.tsx` (nuevo botón "Nueva Nota" + formulario) y `LibroObraModule.tsx` (para que tu equipo vea en la vista interna qué notas escribió el cliente, con badge "Cliente").

## Pasos

1. **Supabase**: abre el SQL Editor y corre `MIGRATE_LIBRO_OBRA_PORTAL.sql` completo. Al final del archivo hay 3 queries de verificación opcionales (reemplaza los uuid de ejemplo por un token y proyecto reales de tu base para probar).

2. **Código**: en tu carpeta local del proyecto (`C:\Users\vsala\proyectos\Github` o donde la tengas), aplica el patch:

   ```
   git apply libro_obra_portal.patch
   ```

   Si prefieres, dile a tu Claude Code local: "aplica este patch" y pásale el archivo — o simplemente pídele que agregue la funcionalidad describiéndole lo mismo que está en `PENDIENTES_UI_BAS.md` del proyecto, usando este patch como referencia exacta de qué tocar.

3. Prueba local (`pnpm run dev`): entra al portal con un token de cliente que tenga un proyecto con Libro de Obra activo, click en "Nueva Nota", escribe algo y guarda. Debe aparecer en la lista y también en el módulo interno (`LibroObraModule.tsx`) con el badge "Cliente".

4. `git push` a `main` → Vercel redeploya solo.

## Notas de diseño

- El cliente solo puede elegir tipo **Avance**, **Incidencia** u **Otro** — dejé afuera Instrucción/Material/Corrección por ser de uso interno (instrucciones a técnicos). Si quieres cambiar esa lista, está en dos lugares: el array `v_tipos_permitidos` en la función SQL `crear_libro_obra_portal`, y la constante `LIBRO_OBRA_TIPOS_PORTAL` en `PortalCliente.tsx`.
- El Libro de Obra sigue siendo inmutable: esto solo agrega una vía más de INSERT, no hay UPDATE ni DELETE para nadie, tampoco para el cliente.
- La función `get_portal_libro_obra` fue reemplazada completa (ver el comentario dentro del `.sql`) para que el nombre del autor se resuelva bien tanto para notas de tu equipo como del cliente. Si la versión anterior tenía algo especial que no mencionaste, avísame para ajustarla.
