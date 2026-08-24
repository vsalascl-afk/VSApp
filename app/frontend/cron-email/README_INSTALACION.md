# 📧 Instalación - Reportes Automáticos por Email

## Requisitos Previos
- Hosting cPanel con PHP 7.4+ (vsa.cl ✅)
- Acceso a cPanel del hosting
- Credenciales de Supabase (URL + Service Role Key)

---

## Paso 1: Crear cuenta de correo en cPanel

1. Ingresa a tu **cPanel** (https://app.vsa.cl:2083 o similar)
2. Ve a **Email Accounts** (Cuentas de correo)
3. ✅ Ya creada: `reportes@app.vsa.cl`
4. Anota la contraseña (la necesitarás en el paso 3)

---

## Paso 2: Ejecutar migración SQL en Supabase

1. Ve a tu proyecto en [Supabase Dashboard](https://supabase.com/dashboard)
2. Abre el **SQL Editor**
3. Copia y ejecuta el contenido de `MIGRATE_REPORTES_AUTOMATICOS.sql`
4. Verifica que la tabla `reportes_automaticos` se creó correctamente

---

## Paso 3: Configurar el script PHP

1. Abre el archivo `send_reports.php`
2. Edita las siguientes líneas con tus datos:

```php
// Supabase
define('SUPABASE_URL', 'https://TU_PROYECTO.supabase.co');  // ← Tu URL de Supabase
define('SUPABASE_KEY', 'TU_SERVICE_ROLE_KEY');               // ← Tu Service Role Key

// SMTP
define('SMTP_HOST', 'mail.app.vsa.cl');
define('SMTP_PORT', 465);
define('SMTP_USER', 'reportes@app.vsa.cl');
define('SMTP_PASS', 'TU_PASSWORD_AQUI');  // ← La contraseña de reportes@app.vsa.cl
```

---

## Paso 4: Subir archivos al hosting

1. En cPanel, abre **File Manager** (Administrador de archivos)
2. Navega a `public_html/` (o la carpeta raíz de tu hosting)
3. Crea una carpeta llamada `cron-email`
4. Sube el archivo `send_reports.php` dentro de esa carpeta
5. La ruta final debe ser: `/home/TU_USUARIO/public_html/cron-email/send_reports.php`

**⚠️ SEGURIDAD:** Agrega un archivo `.htaccess` en la carpeta `cron-email/` para evitar acceso web:

```apache
# Bloquear acceso web a esta carpeta
Deny from all
```

---

## Paso 5: Configurar el Cron Job

1. En cPanel, ve a **Cron Jobs** (Tareas programadas)
2. En "Add New Cron Job":
   - **Common Settings:** Once Per Hour (Una vez por hora)
   - O manualmente: `0 * * * *`
   - **Command:** `/usr/local/bin/php /home/TU_USUARIO/public_html/cron-email/send_reports.php`
3. Haz clic en **Add New Cron Job**

> 💡 Reemplaza `TU_USUARIO` con tu usuario de cPanel (lo ves en la barra superior de cPanel)

---

## Paso 6: Probar manualmente

Para verificar que funciona, ejecuta manualmente desde **Terminal** en cPanel:

```bash
php /home/TU_USUARIO/public_html/cron-email/send_reports.php
```

O accede por SSH:
```bash
ssh usuario@vsa.cl
php ~/public_html/cron-email/send_reports.php
```

Revisa los logs en: `cron-email/logs/send_reports_FECHA.log`

---

## Cómo funciona

1. El cron ejecuta el script **cada hora**
2. El script consulta la tabla `reportes_automaticos` en Supabase
3. Para cada reporte activo, verifica si **toca enviar ahora** (según periodicidad, día y hora configurados)
4. Si corresponde, genera el contenido del reporte consultando las OTs/datos de esa empresa
5. Envía el email a todos los destinatarios configurados
6. Actualiza el campo `ultimo_envio` en la base de datos

---

## Tipos de reportes disponibles

| Tipo | Contenido |
|------|-----------|
| Resumen OTs | Total OTs, por estado y prioridad |
| SLA | % cumplimiento, OTs vencidas vs a tiempo |
| Carga Técnicos | OTs activas por técnico, prioridades altas |
| Programación | Mantenciones vencidas y próximas |
| Inventario | Stock bajo, sin stock, ítems críticos |
| Consolidado | Todo lo anterior en un solo email |

---

## ⚠️ IMPORTANTE: Configuración DNS para Gmail (SPF, DKIM, DMARC)

Gmail rechaza correos de servidores que no tienen correctamente configurados los registros DNS de autenticación de email. **Sin estos registros, los correos NO llegarán a cuentas @gmail.com** (aunque sí lleguen a otros dominios como @vtr.net o @vsa.cl).

### Paso obligatorio: Configurar Email Deliverability en cPanel

1. Ingresa a **cPanel** → **Email Deliverability** (o "Entregabilidad de correo")
2. Busca el dominio `app.vsa.cl` (o `vsa.cl`)
3. Haz clic en **"Manage"** (Administrar)
4. cPanel te mostrará los registros DNS que faltan. Debes tener los 3:

#### SPF (Sender Policy Framework)
Permite a Gmail verificar que tu servidor está autorizado para enviar correos desde @app.vsa.cl.

```dns
Tipo: TXT
Nombre: app.vsa.cl (o @ si es vsa.cl)
Valor: v=spf1 +a +mx +ip4:IP_DE_TU_SERVIDOR include:_spf.google.com ~all
```

> 💡 cPanel genera automáticamente el registro SPF correcto. Solo haz clic en "Install" o "Repair".

#### DKIM (DomainKeys Identified Mail)
Firma criptográfica que Gmail usa para verificar que el correo no fue alterado.

1. En cPanel → **Email Deliverability** → clic en **"Manage"** para tu dominio
2. En la sección DKIM, haz clic en **"Generate"** si no existe
3. Luego haz clic en **"Install"** para agregar el registro DNS automáticamente

```dns
Tipo: TXT
Nombre: default._domainkey.app.vsa.cl
Valor: (generado automáticamente por cPanel - es una clave pública larga)
```

#### DMARC (Domain-based Message Authentication)
Política que indica a Gmail qué hacer con correos que no pasan SPF/DKIM.

```dns
Tipo: TXT
Nombre: _dmarc.app.vsa.cl
Valor: v=DMARC1; p=none; rua=mailto:reportes@app.vsa.cl
```

> Puedes empezar con `p=none` (solo monitoreo) y luego cambiar a `p=quarantine` cuando confirmes que todo funciona.

### Verificar que los registros están activos

Después de configurar, espera 15-30 minutos y verifica con:
- https://mxtoolbox.com/spf.aspx → ingresa `app.vsa.cl`
- https://mxtoolbox.com/dkim.aspx → ingresa `default._domainkey.app.vsa.cl`
- https://mxtoolbox.com/dmarc.aspx → ingresa `app.vsa.cl`

También puedes enviar un correo de prueba a https://mail-tester.com para ver tu puntuación (ideal: 9/10 o 10/10).

### Resumen rápido en cPanel

1. **cPanel** → **Email Deliverability** → **Manage** → **Repair All** (repara SPF + DKIM automáticamente)
2. Agregar registro DMARC manualmente en **cPanel** → **Zone Editor** → **Add Record** (TXT)
3. Esperar 15-30 min para propagación DNS
4. Probar enviando a una cuenta Gmail

---

## Solución de problemas

| Problema | Solución |
|----------|----------|
| No llegan correos a Gmail | **Configurar SPF + DKIM + DMARC** (ver sección anterior). Gmail los exige desde 2024. |
| Llegan a @vtr.net pero no a Gmail | Mismo problema: falta autenticación DNS. Los ISP locales son más permisivos que Gmail. |
| Correos van a spam en Gmail | SPF/DKIM configurados pero sin DMARC, o IP del servidor en blacklist. Verificar en mxtoolbox.com |
| No llegan correos a nadie | Revisa logs en `cron-email/logs/`. Verifica credenciales SMTP y que la cuenta `reportes@app.vsa.cl` existe. |
| Error de Supabase | Verifica SUPABASE_URL y SUPABASE_KEY. Usa la Service Role Key (no la anon). |
| Cron no ejecuta | Verifica la ruta del PHP: `which php` en terminal. Puede ser `/usr/bin/php` o `/usr/local/bin/php`. |
| Error "stream_socket_client" | PHP no tiene habilitada la extensión openssl. Contactar hosting o verificar php.ini. |

---

## Estructura de archivos

```
public_html/
└── cron-email/
    ├── send_reports.php    ← Script principal
    ├── .htaccess           ← Bloquea acceso web
    └── logs/               ← Logs diarios (se crean automáticamente)
        └── send_reports_2026-08-04.log
```