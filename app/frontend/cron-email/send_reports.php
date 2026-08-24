<?php
/**
 * VSApp - Script de Envío de Reportes Automáticos
 * 
 * Este script se ejecuta como Cron Job en hosting cPanel (vsa.cl)
 * Consulta la tabla reportes_automaticos en Supabase y envía los emails pendientes.
 * 
 * CONFIGURACIÓN DEL CRON JOB EN cPanel:
 * Frecuencia: Cada hora (0 * * * *)
 * Comando: /usr/local/bin/php /home/TU_USUARIO/public_html/cron-email/send_reports.php
 * 
 * INSTALACIÓN:
 * 1. Sube esta carpeta (cron-email/) a tu hosting vsa.cl via FTP o File Manager
 * 2. Edita las credenciales de Supabase abajo (SUPABASE_URL, SUPABASE_KEY)
 * 3. Crea la cuenta de correo reportes@vsa.cl en cPanel > Email Accounts
 * 4. Edita las credenciales SMTP abajo
 * 5. Configura el Cron Job en cPanel > Cron Jobs
 * 6. Ejecuta manualmente una vez para probar: php send_reports.php
 */

// ============================================================
// CONFIGURACIÓN - EDITAR ESTOS VALORES
// ============================================================

// Supabase
define('SUPABASE_URL', 'https://TU_PROYECTO.supabase.co');
define('SUPABASE_KEY', 'TU_SERVICE_ROLE_KEY'); // Service Role Key (no la anon key)

// SMTP del hosting cPanel (app.vsa.cl)
// Como el script corre en el MISMO servidor cPanel, usamos localhost directamente
// Esto evita el problema de DNS "getaddrinfo for mail.app.vsa.cl failed"
define('SMTP_HOST', 'localhost');
define('SMTP_PORT', 587); // Puerto local Exim (cPanel): 25 o 587
define('SMTP_USER', 'reportes@app.vsa.cl');
define('SMTP_PASS', 'TU_PASSWORD_AQUI');
define('SMTP_FROM_NAME', 'VSApp');
define('SMTP_FROM_EMAIL', 'reportes@app.vsa.cl');
// Host alternativo si localhost falla (para referencia)
define('SMTP_HOST_FALLBACK', 'mail.app.vsa.cl');
define('SMTP_PORT_FALLBACK', 465);

// Zona horaria Chile
date_default_timezone_set('America/Santiago');

// Log
define('LOG_FILE', __DIR__ . '/logs/send_reports_' . date('Y-m-d') . '.log');

// ============================================================
// FUNCIONES AUXILIARES
// ============================================================

function writeLog($message) {
    $logDir = __DIR__ . '/logs';
    if (!is_dir($logDir)) {
        mkdir($logDir, 0755, true);
    }
    $timestamp = date('Y-m-d H:i:s');
    file_put_contents(LOG_FILE, "[$timestamp] $message\n", FILE_APPEND);
}

function supabaseRequest($endpoint, $method = 'GET', $body = null, $retries = 3) {
    $url = SUPABASE_URL . '/rest/v1/' . $endpoint;
    
    $headers = [
        'apikey: ' . SUPABASE_KEY,
        'Authorization: Bearer ' . SUPABASE_KEY,
        'Content-Type: application/json',
        'Prefer: return=representation',
    ];
    
    $attempt = 0;
    $lastError = '';
    $lastHttpCode = 0;
    
    while ($attempt < $retries) {
        $attempt++;
        
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
        curl_setopt($ch, CURLOPT_TIMEOUT, 30);
        curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 15);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
        curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 2);
        // Forzar resolución DNS y IPv4
        curl_setopt($ch, CURLOPT_IPRESOLVE, CURL_IPRESOLVE_V4);
        curl_setopt($ch, CURLOPT_DNS_CACHE_TIMEOUT, 120);
        // Seguir redirecciones
        curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
        curl_setopt($ch, CURLOPT_MAXREDIRS, 3);
        
        if ($method === 'PATCH') {
            curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'PATCH');
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($body));
        }
        
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlError = curl_error($ch);
        $curlErrno = curl_errno($ch);
        $info = curl_getinfo($ch);
        curl_close($ch);
        
        // Conexión exitosa
        if ($httpCode >= 200 && $httpCode < 300) {
            if ($attempt > 1) {
                writeLog("OK Supabase: Conexión exitosa en intento $attempt para: $endpoint");
            }
            return json_decode($response, true);
        }
        
        // Error de conexión (httpCode = 0)
        if ($httpCode === 0) {
            $lastError = "cURL Error [$curlErrno]: $curlError | DNS: " . ($info['namelookup_time'] ?? '?') . "s | Connect: " . ($info['connect_time'] ?? '?') . "s | Total: " . ($info['total_time'] ?? '?') . "s | IP: " . ($info['primary_ip'] ?? 'ninguna');
            $lastHttpCode = 0;
            writeLog("WARN Supabase [intento $attempt/$retries]: $lastError | Endpoint: $endpoint");
            
            if ($attempt < $retries) {
                // Esperar antes de reintentar (backoff exponencial: 2s, 4s)
                $waitSeconds = pow(2, $attempt);
                writeLog("Reintentando en {$waitSeconds}s...");
                sleep($waitSeconds);
            }
            continue;
        }
        
        // Error HTTP (4xx, 5xx)
        $lastError = "HTTP $httpCode: $response";
        $lastHttpCode = $httpCode;
        
        // Si es 5xx (error del servidor), reintentar
        if ($httpCode >= 500 && $attempt < $retries) {
            writeLog("WARN Supabase [intento $attempt/$retries]: Error servidor HTTP $httpCode | Endpoint: $endpoint");
            $waitSeconds = pow(2, $attempt);
            sleep($waitSeconds);
            continue;
        }
        
        // Si es 4xx (error del cliente), no reintentar
        break;
    }
    
    writeLog("ERROR Supabase [código $lastHttpCode] después de $attempt intento(s): $lastError | Endpoint: $endpoint");
    return null;
}

function sendEmail($to, $subject, $htmlBody) {
    // Envío SMTP autenticado directo vía socket SSL
    // Con reintentos y fallback a localhost si DNS falla
    
    $smtpHost = SMTP_HOST;
    $smtpPort = SMTP_PORT;
    $smtpUser = SMTP_USER;
    $smtpPass = SMTP_PASS;
    $fromName = SMTP_FROM_NAME;
    $fromEmail = SMTP_FROM_EMAIL;
    
    // Verificar resolución DNS del host SMTP
    if ($smtpHost === 'localhost' || $smtpHost === '127.0.0.1') {
        writeLog("  ✓ SMTP: usando localhost (mismo servidor cPanel)");
    } else {
        $resolvedIp = @gethostbyname($smtpHost);
        if ($resolvedIp === $smtpHost) {
            writeLog("  ⚠ DNS no resuelve '$smtpHost'. Intentando con localhost...");
            $smtpHost = 'localhost';
            $smtpPort = 587;
        } else {
            writeLog("  ✓ SMTP DNS OK: $smtpHost -> $resolvedIp");
        }
    }
    
    // Construir el mensaje MIME completo
    $boundary = md5(uniqid(time()));
    $messageId = '<' . md5(uniqid(time())) . '@app.vsa.cl>';
    
    $emailHeaders = "MIME-Version: 1.0\r\n";
    $emailHeaders .= "Date: " . date('r') . "\r\n";
    $emailHeaders .= "Message-ID: $messageId\r\n";
    $emailHeaders .= "From: $fromName <$fromEmail>\r\n";
    $emailHeaders .= "To: $to\r\n";
    $emailHeaders .= "Subject: $subject\r\n";
    $emailHeaders .= "Content-Type: multipart/alternative; boundary=\"$boundary\"\r\n";
    $emailHeaders .= "X-Mailer: VSApp Report System\r\n";
    $emailHeaders .= "\r\n";
    
    // Versión texto plano (fallback)
    $textBody = strip_tags(str_replace(['<br>', '<br/>', '<br />', '</p>', '</div>', '</tr>'], "\n", $htmlBody));
    $textBody = html_entity_decode($textBody, ENT_QUOTES, 'UTF-8');
    $textBody = preg_replace('/\n{3,}/', "\n\n", $textBody);
    
    $emailBody = "--$boundary\r\n";
    $emailBody .= "Content-Type: text/plain; charset=UTF-8\r\n";
    $emailBody .= "Content-Transfer-Encoding: base64\r\n\r\n";
    $emailBody .= chunk_split(base64_encode($textBody)) . "\r\n";
    $emailBody .= "--$boundary\r\n";
    $emailBody .= "Content-Type: text/html; charset=UTF-8\r\n";
    $emailBody .= "Content-Transfer-Encoding: base64\r\n\r\n";
    $emailBody .= chunk_split(base64_encode($htmlBody)) . "\r\n";
    $emailBody .= "--$boundary--\r\n";
    
    $fullMessage = $emailHeaders . $emailBody;
    
    // Conectar al servidor SMTP con reintentos
    $context = stream_context_create([
        'ssl' => [
            'verify_peer' => false,
            'verify_peer_name' => false,
            'allow_self_signed' => true,
        ]
    ]);
    
    $protocol = ($smtpPort == 465) ? 'ssl' : 'tcp';
    $connection = false;
    $maxRetries = 3;
    
    for ($attempt = 1; $attempt <= $maxRetries; $attempt++) {
        $connection = @stream_socket_client(
            "$protocol://$smtpHost:$smtpPort",
            $errno,
            $errstr,
            30,
            STREAM_CLIENT_CONNECT,
            $context
        );
        
        if ($connection) {
            break;
        }
        
        writeLog("  ⚠ SMTP intento $attempt/$maxRetries falló: $errstr ($errno)");
        
        // Si falla con localhost, intentar el host remoto como fallback
        if ($attempt === 1 && $smtpHost === 'localhost' && defined('SMTP_HOST_FALLBACK')) {
            writeLog("  → Intentando fallback a " . SMTP_HOST_FALLBACK . ":" . SMTP_PORT_FALLBACK . "...");
            $smtpHost = SMTP_HOST_FALLBACK;
            $smtpPort = SMTP_PORT_FALLBACK;
            $protocol = ($smtpPort == 465) ? 'ssl' : 'tcp';
        } elseif ($attempt === 1 && $smtpHost !== 'localhost') {
            // Si el host remoto falla, intentar localhost
            writeLog("  → Intentando fallback a localhost:587...");
            $smtpHost = 'localhost';
            $smtpPort = 587;
            $protocol = 'tcp';
        } elseif ($attempt < $maxRetries) {
            sleep($attempt * 2); // Backoff
        }
    }
    
    if (!$connection) {
        // Último recurso: intentar con mail() nativa de PHP
        writeLog("  ⚠ SMTP socket falló después de $maxRetries intentos. Intentando con mail() nativa de PHP...");
        
        $mailHeaders = "MIME-Version: 1.0\r\n";
        $mailHeaders .= "Content-Type: text/html; charset=UTF-8\r\n";
        $mailHeaders .= "From: $fromName <$fromEmail>\r\n";
        $mailHeaders .= "Reply-To: $fromEmail\r\n";
        $mailHeaders .= "X-Mailer: VSApp Report System\r\n";
        
        $sent = @mail($to, $subject, $htmlBody, $mailHeaders);
        if ($sent) {
            writeLog("  ✓ Email enviado vía mail() nativa a: $to");
            return true;
        } else {
            $lastError = error_get_last();
            writeLog("ERROR SMTP+mail(): No se pudo enviar por ningún método. mail() error: " . ($lastError['message'] ?? 'desconocido'));
            return false;
        }
    }
    
    writeLog("  ✓ Conectado a SMTP $smtpHost:$smtpPort");
    
    // Leer saludo del servidor (puede ser multi-línea: 220-... / 220 ...)
    $greeting = '';
    while ($line = fgets($connection, 512)) {
        $greeting .= $line;
        // Si el 4to carácter es espacio (no guión), es la última línea del banner
        if (isset($line[3]) && $line[3] === ' ') break;
        // También terminar si la línea no empieza con 220- (seguridad)
        if (substr($line, 0, 4) !== '220-') break;
    }
    if (substr($greeting, 0, 3) !== '220') {
        writeLog("ERROR SMTP: Saludo inesperado: " . trim($greeting));
        fclose($connection);
        return false;
    }
    writeLog("  ✓ Banner SMTP recibido OK");
    
    // Función helper para enviar comandos SMTP
    // IMPORTANTE: $connection por referencia para que la reconexión en STARTTLS sea visible
    $smtpSend = function($command, $expectedCode) use (&$connection) {
        fwrite($connection, $command . "\r\n");
        $response = '';
        while ($line = fgets($connection, 512)) {
            $response .= $line;
            // Si el 4to carácter es espacio, es la última línea de respuesta
            if (isset($line[3]) && $line[3] === ' ') break;
        }
        $code = substr($response, 0, 3);
        if ($code !== (string)$expectedCode) {
            writeLog("ERROR SMTP: Comando '$command' esperaba $expectedCode, recibió: " . trim($response));
            return false;
        }
        return $response;
    };
    
    // EHLO
    $hostname = gethostname() ?: 'app.vsa.cl';
    if ($smtpSend("EHLO $hostname", 250) === false) { fclose($connection); return false; }
    
    // STARTTLS si es puerto 587
    if ($smtpPort == 587) {
        fwrite($connection, "STARTTLS\r\n");
        $starttlsResponse = '';
        while ($line = fgets($connection, 512)) {
            $starttlsResponse .= $line;
            if (isset($line[3]) && $line[3] === ' ') break;
        }
        $starttlsCode = substr($starttlsResponse, 0, 3);
        
        if ($starttlsCode === '220') {
            // STARTTLS aceptado, activar cifrado
            $cryptoResult = @stream_socket_enable_crypto($connection, true, STREAM_CRYPTO_METHOD_TLS_CLIENT);
            if ($cryptoResult === true) {
                writeLog("  ✓ STARTTLS activado correctamente");
                if ($smtpSend("EHLO $hostname", 250) === false) { fclose($connection); return false; }
            } else {
                // TLS falló (certificado inválido en localhost) - continuar sin cifrado si es localhost
                if ($smtpHost === 'localhost' || $smtpHost === '127.0.0.1') {
                    writeLog("  ⚠ STARTTLS falló en localhost (certificado). Reconectando sin TLS en puerto 25...");
                    fclose($connection);
                    // Reconectar en puerto 25 sin TLS
                    $connection = @stream_socket_client("tcp://localhost:25", $errno, $errstr, 30, STREAM_CLIENT_CONNECT, $context);
                    if (!$connection) {
                        writeLog("  ✗ Reconexión a localhost:25 falló: $errstr");
                        return false;
                    }
                    // Leer banner multi-línea del nuevo socket
                    $greet25 = '';
                    while ($gl = fgets($connection, 512)) {
                        $greet25 .= $gl;
                        if (isset($gl[3]) && $gl[3] === ' ') break;
                        if (substr($gl, 0, 4) !== '220-') break;
                    }
                    if (substr($greet25, 0, 3) !== '220') { fclose($connection); return false; }
                    if ($smtpSend("EHLO $hostname", 250) === false) { fclose($connection); return false; }
                    $smtpPort = 25; // Actualizar para lógica posterior
                } else {
                    writeLog("ERROR SMTP: STARTTLS crypto falló en host remoto");
                    fclose($connection);
                    return false;
                }
            }
        } elseif ($smtpHost === 'localhost' || $smtpHost === '127.0.0.1') {
            // Localhost no soporta STARTTLS, continuar sin cifrado
            writeLog("  ℹ Localhost no soporta STARTTLS (código $starttlsCode). Continuando sin cifrado.");
        } else {
            writeLog("ERROR SMTP: STARTTLS rechazado por servidor remoto: " . trim($starttlsResponse));
            fclose($connection);
            return false;
        }
    }
    
    // AUTH LOGIN (en localhost puede no requerir autenticación)
    $useAuth = true;
    if ($smtpHost === 'localhost') {
        // En localhost cPanel, intentar AUTH pero si falla, continuar sin ella
        fwrite($connection, "AUTH LOGIN\r\n");
        $authResponse = '';
        while ($line = fgets($connection, 512)) {
            $authResponse .= $line;
            if (isset($line[3]) && $line[3] === ' ') break;
        }
        $authCode = substr($authResponse, 0, 3);
        if ($authCode === '334') {
            // Servidor acepta AUTH, continuar con credenciales
            if ($smtpSend(base64_encode($smtpUser), 334) === false) { fclose($connection); return false; }
            if ($smtpSend(base64_encode($smtpPass), 235) === false) { fclose($connection); return false; }
        } else {
            // No requiere AUTH en localhost, continuar directamente
            writeLog("  ℹ Localhost no requiere AUTH (respuesta: $authCode). Continuando sin autenticación.");
            $useAuth = false;
        }
    } else {
        // Host remoto: AUTH obligatorio
        if ($smtpSend("AUTH LOGIN", 334) === false) { fclose($connection); return false; }
        if ($smtpSend(base64_encode($smtpUser), 334) === false) { fclose($connection); return false; }
        if ($smtpSend(base64_encode($smtpPass), 235) === false) { fclose($connection); return false; }
    }
    
    // MAIL FROM
    if ($smtpSend("MAIL FROM:<$fromEmail>", 250) === false) { fclose($connection); return false; }
    
    // RCPT TO
    if ($smtpSend("RCPT TO:<$to>", 250) === false) { fclose($connection); return false; }
    
    // DATA
    if ($smtpSend("DATA", 354) === false) { fclose($connection); return false; }
    
    // Enviar contenido del email (escapar líneas que empiezan con punto)
    $lines = explode("\r\n", $fullMessage);
    foreach ($lines as $line) {
        if (isset($line[0]) && $line[0] === '.') {
            $line = '.' . $line; // Dot-stuffing
        }
        fwrite($connection, $line . "\r\n");
    }
    
    // Fin del mensaje
    if ($smtpSend(".", 250) === false) { fclose($connection); return false; }
    
    // QUIT
    fwrite($connection, "QUIT\r\n");
    fclose($connection);
    
    writeLog("Email enviado OK vía SMTP a: $to | Asunto: $subject");
    return true;
}

function shouldSendNow($config) {
    $now = new DateTime();
    $currentHour = (int)$now->format('H');
    $configHour = (int)explode(':', $config['hora_envio'])[0];
    
    $periodicidad = $config['periodicidad'];
    $diaEnvio = $config['dia_envio'];
    
    // Verificar si HOY es día de envío según periodicidad
    $esDiaDeEnvio = false;
    switch ($periodicidad) {
        case 'diario':
            $esDiaDeEnvio = true;
            break;
            
        case 'semanal':
            $diasMap = [
                'lunes' => 1, 'martes' => 2, 'miercoles' => 3,
                'jueves' => 4, 'viernes' => 5, 'sabado' => 6, 'domingo' => 7
            ];
            $diaActual = (int)$now->format('N'); // 1=lunes, 7=domingo
            $esDiaDeEnvio = isset($diasMap[$diaEnvio]) && $diasMap[$diaEnvio] === $diaActual;
            break;
            
        case 'quincenal':
            $diasMap = [
                'lunes' => 1, 'martes' => 2, 'miercoles' => 3,
                'jueves' => 4, 'viernes' => 5, 'sabado' => 6, 'domingo' => 7
            ];
            $diaActual = (int)$now->format('N');
            $semanaActual = (int)$now->format('W');
            $esDiaDeEnvio = isset($diasMap[$diaEnvio]) && $diasMap[$diaEnvio] === $diaActual && ($semanaActual % 2 === 0);
            break;
            
        case 'mensual':
            $diaActual = (int)$now->format('j'); // día del mes
            $esDiaDeEnvio = (int)$diaEnvio === $diaActual;
            break;
            
        default:
            return false;
    }
    
    if (!$esDiaDeEnvio) {
        return false;
    }
    
    // Caso 1: Es la hora exacta configurada → enviar
    if ($currentHour === $configHour) {
        return true;
    }
    
    // Caso 2: Ya pasó la hora configurada → verificar si ya se envió hoy (recuperación)
    // Esto cubre el caso donde la conectividad falló en la hora programada
    if ($currentHour > $configHour) {
        $ultimoEnvio = $config['ultimo_envio'] ?? null;
        
        if ($ultimoEnvio === null) {
            // Nunca se ha enviado → enviar ahora
            writeLog("  → Recuperación: Reporte '{$config['nombre']}' nunca enviado, enviando ahora.");
            return true;
        }
        
        $fechaUltimoEnvio = new DateTime($ultimoEnvio);
        $hoyInicio = new DateTime('today'); // Hoy a las 00:00
        
        // Si el último envío fue ANTES de hoy, significa que hoy no se ha enviado
        if ($fechaUltimoEnvio < $hoyInicio) {
            writeLog("  → Recuperación: Reporte '{$config['nombre']}' no enviado hoy (último: " . $fechaUltimoEnvio->format('Y-m-d H:i') . "). Enviando ahora.");
            return true;
        }
    }
    
    return false;
}

function getEmpresaName($empresaId) {
    $data = supabaseRequest("empresas?id=eq.$empresaId&select=nombre");
    if ($data && count($data) > 0) {
        return $data[0]['nombre'];
    }
    return 'Empresa';
}

function generateReportContent($config, $empresaNombre) {
    $tipo = $config['tipo_reporte'];
    $empresaId = $config['empresa_id'];
    $periodicidad = $config['periodicidad'];
    
    // Calcular rango de fechas según periodicidad
    $now = new DateTime();
    $desde = clone $now;
    
    switch ($periodicidad) {
        case 'diario': $desde->modify('-1 day'); break;
        case 'semanal': $desde->modify('-7 days'); break;
        case 'quincenal': $desde->modify('-15 days'); break;
        case 'mensual': $desde->modify('-30 days'); break;
    }
    
    $desdeStr = $desde->format('Y-m-d\TH:i:s');
    $hastaStr = $now->format('Y-m-d\TH:i:s');
    $desdeFmt = $desde->format('d/m/Y');
    $hastaFmt = $now->format('d/m/Y');
    
    $html = getEmailHeader($empresaNombre, $config['nombre'], $desdeFmt, $hastaFmt);
    
    switch ($tipo) {
        case 'resumen_ots':
            $html .= generateOTSummary($empresaId, $desdeStr, $hastaStr);
            break;
        case 'sla':
            $html .= generateSLAReport($empresaId, $desdeStr, $hastaStr);
            break;
        case 'carga_tecnicos':
            $html .= generateTechLoadReport($empresaId);
            break;
        case 'programacion':
            $html .= generateScheduleReport($empresaId);
            break;
        case 'inventario':
            $html .= generateInventoryReport($empresaId);
            break;
        case 'consolidado':
            $html .= generateOTSummary($empresaId, $desdeStr, $hastaStr);
            $html .= '<hr style="margin: 20px 0; border: 1px solid #e5e7eb;">';
            $html .= generateSLAReport($empresaId, $desdeStr, $hastaStr);
            $html .= '<hr style="margin: 20px 0; border: 1px solid #e5e7eb;">';
            $html .= generateTechLoadReport($empresaId);
            break;
        default:
            $html .= '<p>Tipo de reporte no reconocido.</p>';
    }
    
    $html .= getEmailFooter();
    return $html;
}

function getEmailHeader($empresaNombre, $reporteName, $desde, $hasta) {
    return '
    <!DOCTYPE html>
    <html>
    <head><meta charset="UTF-8"></head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, sans-serif; background-color: #f3f4f6; margin: 0; padding: 20px;">
    <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #1e40af, #3b82f6); padding: 24px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 20px;">📊 VSApp</h1>
            <p style="color: #bfdbfe; margin: 8px 0 0; font-size: 14px;">' . htmlspecialchars($reporteName) . '</p>
        </div>
        <!-- Info -->
        <div style="padding: 20px; border-bottom: 1px solid #e5e7eb;">
            <table style="width: 100%; font-size: 13px; color: #6b7280;">
                <tr>
                    <td><strong>Empresa:</strong> ' . htmlspecialchars($empresaNombre) . '</td>
                    <td style="text-align: right;"><strong>Período:</strong> ' . $desde . ' - ' . $hasta . '</td>
                </tr>
                <tr>
                    <td colspan="2" style="padding-top: 4px;"><strong>Generado:</strong> ' . date('d/m/Y H:i') . ' hrs</td>
                </tr>
            </table>
        </div>
        <!-- Content -->
        <div style="padding: 20px;">';
}

function getEmailFooter() {
    return '
        </div>
        <!-- Footer -->
        <div style="background: #f9fafb; padding: 16px; text-align: center; border-top: 1px solid #e5e7eb;">
            <p style="margin: 0; font-size: 11px; color: #9ca3af;">
                Este es un reporte automático generado por VSApp.<br>
                Para modificar la configuración, ingrese a la plataforma > Reportabilidad > Reportes Email.
            </p>
        </div>
    </div>
    </body>
    </html>';
}

function generateOTSummary($empresaId, $desde, $hasta) {
    // Obtener OTs del período
    $ots = supabaseRequest("ordenes_trabajo?empresa_id=eq.$empresaId&created_at=gte.$desde&created_at=lte.$hasta&select=id,estado,prioridad,tipo_servicio");
    
    if (!$ots) $ots = [];
    
    $total = count($ots);
    $estados = ['abierta' => 0, 'en_progreso' => 0, 'en_revision' => 0, 'cerrada' => 0];
    $prioridades = ['alta' => 0, 'media' => 0, 'baja' => 0];
    
    foreach ($ots as $ot) {
        $estado = $ot['estado'] ?? 'abierta';
        $prioridad = $ot['prioridad'] ?? 'media';
        if (isset($estados[$estado])) $estados[$estado]++;
        if (isset($prioridades[$prioridad])) $prioridades[$prioridad]++;
    }
    
    $html = '<h2 style="color: #1f2937; font-size: 16px; margin-bottom: 12px;">📋 Resumen de Órdenes de Trabajo</h2>';
    $html .= '<table style="width: 100%; border-collapse: collapse; font-size: 13px;">';
    $html .= '<tr style="background: #eff6ff;"><td style="padding: 8px; font-weight: bold;">Total OTs en período</td><td style="padding: 8px; text-align: right; font-weight: bold; font-size: 18px; color: #1e40af;">' . $total . '</td></tr>';
    $html .= '<tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">🟡 Abiertas</td><td style="padding: 8px; text-align: right; border-bottom: 1px solid #e5e7eb;">' . $estados['abierta'] . '</td></tr>';
    $html .= '<tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">🔵 En Progreso</td><td style="padding: 8px; text-align: right; border-bottom: 1px solid #e5e7eb;">' . $estados['en_progreso'] . '</td></tr>';
    $html .= '<tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">🟠 En Revisión</td><td style="padding: 8px; text-align: right; border-bottom: 1px solid #e5e7eb;">' . $estados['en_revision'] . '</td></tr>';
    $html .= '<tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">✅ Cerradas</td><td style="padding: 8px; text-align: right; border-bottom: 1px solid #e5e7eb;">' . $estados['cerrada'] . '</td></tr>';
    $html .= '</table>';
    
    $html .= '<h3 style="color: #374151; font-size: 14px; margin-top: 16px;">Por Prioridad:</h3>';
    $html .= '<table style="width: 100%; border-collapse: collapse; font-size: 13px;">';
    $html .= '<tr><td style="padding: 6px;">🔴 Alta</td><td style="text-align: right; padding: 6px;">' . $prioridades['alta'] . '</td></tr>';
    $html .= '<tr><td style="padding: 6px;">🟡 Media</td><td style="text-align: right; padding: 6px;">' . $prioridades['media'] . '</td></tr>';
    $html .= '<tr><td style="padding: 6px;">🟢 Baja</td><td style="text-align: right; padding: 6px;">' . $prioridades['baja'] . '</td></tr>';
    $html .= '</table>';
    
    return $html;
}

function generateSLAReport($empresaId, $desde, $hasta) {
    $ots = supabaseRequest("ordenes_trabajo?empresa_id=eq.$empresaId&created_at=gte.$desde&select=id,estado,prioridad,created_at,closed_at");
    
    if (!$ots) $ots = [];
    
    $slaLimits = ['alta' => 24, 'media' => 48, 'baja' => 72]; // horas
    $cumplidas = 0;
    $vencidas = 0;
    $enCurso = 0;
    
    foreach ($ots as $ot) {
        $prioridad = $ot['prioridad'] ?? 'media';
        $limite = $slaLimits[$prioridad] ?? 48;
        $createdAt = new DateTime($ot['created_at']);
        
        if ($ot['estado'] === 'cerrada' && !empty($ot['closed_at'])) {
            $closedAt = new DateTime($ot['closed_at']);
            $horasTranscurridas = ($closedAt->getTimestamp() - $createdAt->getTimestamp()) / 3600;
            if ($horasTranscurridas <= $limite) {
                $cumplidas++;
            } else {
                $vencidas++;
            }
        } else {
            $now = new DateTime();
            $horasTranscurridas = ($now->getTimestamp() - $createdAt->getTimestamp()) / 3600;
            if ($horasTranscurridas > $limite) {
                $vencidas++;
            } else {
                $enCurso++;
            }
        }
    }
    
    $total = $cumplidas + $vencidas + $enCurso;
    $porcentaje = $total > 0 ? round(($cumplidas / $total) * 100, 1) : 0;
    
    $html = '<h2 style="color: #1f2937; font-size: 16px; margin-bottom: 12px;">⏱️ Cumplimiento SLA</h2>';
    $html .= '<div style="text-align: center; padding: 16px; background: ' . ($porcentaje >= 80 ? '#ecfdf5' : '#fef2f2') . '; border-radius: 8px; margin-bottom: 12px;">';
    $html .= '<p style="font-size: 32px; font-weight: bold; color: ' . ($porcentaje >= 80 ? '#059669' : '#dc2626') . '; margin: 0;">' . $porcentaje . '%</p>';
    $html .= '<p style="font-size: 12px; color: #6b7280; margin: 4px 0 0;">Cumplimiento SLA</p>';
    $html .= '</div>';
    $html .= '<table style="width: 100%; border-collapse: collapse; font-size: 13px;">';
    $html .= '<tr><td style="padding: 6px;">✅ Cumplidas a tiempo</td><td style="text-align: right; padding: 6px; color: #059669; font-weight: bold;">' . $cumplidas . '</td></tr>';
    $html .= '<tr><td style="padding: 6px;">❌ Vencidas</td><td style="text-align: right; padding: 6px; color: #dc2626; font-weight: bold;">' . $vencidas . '</td></tr>';
    $html .= '<tr><td style="padding: 6px;">🔄 En curso (dentro de plazo)</td><td style="text-align: right; padding: 6px;">' . $enCurso . '</td></tr>';
    $html .= '</table>';
    $html .= '<p style="font-size: 11px; color: #9ca3af; margin-top: 8px;">SLA: Alta=24h, Media=48h, Baja=72h</p>';
    
    return $html;
}

function generateTechLoadReport($empresaId) {
    // OTs abiertas/en progreso agrupadas por técnico
    $ots = supabaseRequest("ordenes_trabajo?empresa_id=eq.$empresaId&estado=neq.cerrada&select=id,tecnico_id,estado,prioridad");
    
    if (!$ots) $ots = [];
    
    // Obtener nombres de técnicos desde la tabla usuarios
    $tecnicoIds = [];
    foreach ($ots as $ot) {
        if (!empty($ot['tecnico_id'])) {
            $tecnicoIds[$ot['tecnico_id']] = true;
        }
    }
    
    $nombresMap = [];
    if (!empty($tecnicoIds)) {
        $usuarios = supabaseRequest("usuarios?empresa_id=eq.$empresaId&select=auth_id,nombre");
        if ($usuarios) {
            foreach ($usuarios as $u) {
                $nombresMap[$u['auth_id']] = $u['nombre'];
            }
        }
    }
    
    $tecnicos = [];
    foreach ($ots as $ot) {
        $tecnicoId = $ot['tecnico_id'] ?? null;
        $nombre = $tecnicoId ? ($nombresMap[$tecnicoId] ?? 'Técnico ' . substr($tecnicoId, 0, 6)) : 'Sin asignar';
        if (!isset($tecnicos[$nombre])) {
            $tecnicos[$nombre] = ['total' => 0, 'alta' => 0];
        }
        $tecnicos[$nombre]['total']++;
        if (($ot['prioridad'] ?? '') === 'alta') {
            $tecnicos[$nombre]['alta']++;
        }
    }
    
    // Ordenar por carga (mayor primero)
    uasort($tecnicos, function($a, $b) { return $b['total'] - $a['total']; });
    
    $html = '<h2 style="color: #1f2937; font-size: 16px; margin-bottom: 12px;">👷 Carga por Técnico</h2>';
    
    if (empty($tecnicos)) {
        $html .= '<p style="color: #6b7280; font-size: 13px;">No hay OTs activas asignadas.</p>';
    } else {
        $html .= '<table style="width: 100%; border-collapse: collapse; font-size: 13px;">';
        $html .= '<tr style="background: #f3f4f6;"><th style="padding: 8px; text-align: left;">Técnico</th><th style="padding: 8px; text-align: center;">OTs Activas</th><th style="padding: 8px; text-align: center;">Prioridad Alta</th></tr>';
        foreach ($tecnicos as $nombre => $data) {
            $bgColor = $data['total'] >= 5 ? '#fef2f2' : 'white';
            $html .= '<tr style="background: ' . $bgColor . ';"><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">' . htmlspecialchars($nombre) . '</td>';
            $html .= '<td style="padding: 8px; text-align: center; border-bottom: 1px solid #e5e7eb; font-weight: bold;">' . $data['total'] . '</td>';
            $html .= '<td style="padding: 8px; text-align: center; border-bottom: 1px solid #e5e7eb; color: #dc2626;">' . ($data['alta'] > 0 ? $data['alta'] : '-') . '</td></tr>';
        }
        $html .= '</table>';
    }
    
    return $html;
}

function generateScheduleReport($empresaId) {
    $schedules = supabaseRequest("maintenance_schedules?empresa_id=eq.$empresaId&activo=eq.true&select=id,titulo,proxima_fecha,frecuencia,tipo_trabajo");
    
    if (!$schedules) $schedules = [];
    
    $vencidas = 0;
    $proximas = 0;
    $now = new DateTime();
    
    foreach ($schedules as $s) {
        if (!empty($s['proxima_fecha'])) {
            $fecha = new DateTime($s['proxima_fecha']);
            if ($fecha < $now) $vencidas++;
            elseif ($fecha < (clone $now)->modify('+7 days')) $proximas++;
        }
    }
    
    $html = '<h2 style="color: #1f2937; font-size: 16px; margin-bottom: 12px;">📅 Programación de Mantenciones</h2>';
    $html .= '<table style="width: 100%; border-collapse: collapse; font-size: 13px;">';
    $html .= '<tr><td style="padding: 8px;">Total programaciones activas</td><td style="text-align: right; padding: 8px; font-weight: bold;">' . count($schedules) . '</td></tr>';
    $html .= '<tr><td style="padding: 8px; color: #dc2626;">⚠️ Vencidas</td><td style="text-align: right; padding: 8px; font-weight: bold; color: #dc2626;">' . $vencidas . '</td></tr>';
    $html .= '<tr><td style="padding: 8px; color: #d97706;">📌 Próximas 7 días</td><td style="text-align: right; padding: 8px; font-weight: bold; color: #d97706;">' . $proximas . '</td></tr>';
    $html .= '</table>';
    
    return $html;
}

function generateInventoryReport($empresaId) {
    $items = supabaseRequest("catalogo_inventario?empresa_id=eq.$empresaId&select=id,nombre,stock_actual,stock_minimo,categoria");
    
    if (!$items) $items = [];
    
    $totalItems = count($items);
    $stockBajo = 0;
    $sinStock = 0;
    
    foreach ($items as $item) {
        $actual = (int)($item['stock_actual'] ?? 0);
        $minimo = (int)($item['stock_minimo'] ?? 0);
        if ($actual <= 0) $sinStock++;
        elseif ($actual <= $minimo) $stockBajo++;
    }
    
    $html = '<h2 style="color: #1f2937; font-size: 16px; margin-bottom: 12px;">📦 Estado de Inventario</h2>';
    $html .= '<table style="width: 100%; border-collapse: collapse; font-size: 13px;">';
    $html .= '<tr><td style="padding: 8px;">Total ítems en catálogo</td><td style="text-align: right; padding: 8px; font-weight: bold;">' . $totalItems . '</td></tr>';
    $html .= '<tr><td style="padding: 8px; color: #d97706;">⚠️ Stock bajo (bajo mínimo)</td><td style="text-align: right; padding: 8px; font-weight: bold; color: #d97706;">' . $stockBajo . '</td></tr>';
    $html .= '<tr><td style="padding: 8px; color: #dc2626;">🚫 Sin stock</td><td style="text-align: right; padding: 8px; font-weight: bold; color: #dc2626;">' . $sinStock . '</td></tr>';
    $html .= '</table>';
    
    if ($stockBajo > 0 || $sinStock > 0) {
        $html .= '<h3 style="font-size: 13px; margin-top: 12px; color: #374151;">Ítems críticos:</h3>';
        $html .= '<ul style="font-size: 12px; color: #6b7280; padding-left: 20px;">';
        foreach ($items as $item) {
            $actual = (int)($item['stock_actual'] ?? 0);
            $minimo = (int)($item['stock_minimo'] ?? 0);
            if ($actual <= $minimo) {
                $html .= '<li>' . htmlspecialchars($item['nombre']) . ' (Stock: ' . $actual . ' / Mín: ' . $minimo . ')</li>';
            }
        }
        $html .= '</ul>';
    }
    
    return $html;
}

// ============================================================
// EJECUCIÓN PRINCIPAL
// ============================================================

writeLog("=== Inicio ejecución de reportes automáticos ===");

// 0. Test de conectividad básica a Supabase
$testUrl = SUPABASE_URL . '/rest/v1/';
$testCh = curl_init();
curl_setopt($testCh, CURLOPT_URL, $testUrl);
curl_setopt($testCh, CURLOPT_RETURNTRANSFER, true);
curl_setopt($testCh, CURLOPT_TIMEOUT, 10);
curl_setopt($testCh, CURLOPT_CONNECTTIMEOUT, 10);
curl_setopt($testCh, CURLOPT_NOBODY, true); // Solo HEAD
curl_setopt($testCh, CURLOPT_IPRESOLVE, CURL_IPRESOLVE_V4);
curl_setopt($testCh, CURLOPT_HTTPHEADER, ['apikey: ' . SUPABASE_KEY]);
curl_exec($testCh);
$testHttpCode = curl_getinfo($testCh, CURLINFO_HTTP_CODE);
$testError = curl_error($testCh);
$testErrno = curl_errno($testCh);
$testInfo = curl_getinfo($testCh);
curl_close($testCh);

if ($testHttpCode === 0) {
    writeLog("❌ FALLO CONECTIVIDAD: No se puede alcanzar Supabase.");
    writeLog("   URL: $testUrl");
    writeLog("   cURL Error [$testErrno]: $testError");
    writeLog("   DNS lookup: " . ($testInfo['namelookup_time'] ?? '?') . "s");
    writeLog("   Connect time: " . ($testInfo['connect_time'] ?? '?') . "s");
    writeLog("   IP resuelta: " . ($testInfo['primary_ip'] ?? 'ninguna'));
    writeLog("   Posibles causas: firewall del hosting, DNS bloqueado, Supabase caído.");
    writeLog("=== Fin ejecución (sin conectividad) ===");
    echo "ERROR: Sin conectividad a Supabase. Ver logs para detalles.\n";
    exit(1);
} else {
    writeLog("✓ Conectividad OK (HTTP $testHttpCode, IP: " . ($testInfo['primary_ip'] ?? '?') . ", DNS: " . round($testInfo['namelookup_time'] * 1000) . "ms)");
}

// 1. Obtener todas las configuraciones activas
$configs = supabaseRequest("reportes_automaticos?activo=eq.true&select=*");

if ($configs === null) {
    writeLog("❌ ERROR: No se pudo obtener configuraciones de reportes (respuesta null). Posible error de conexión o permisos.");
    writeLog("=== Fin ejecución (error de consulta) ===");
    echo "ERROR: No se pudieron obtener los reportes. Ver logs.\n";
    exit(1);
}

if (count($configs) === 0) {
    writeLog("No hay reportes activos configurados. Finalizando.");
    exit(0);
}

writeLog("Encontrados " . count($configs) . " reportes activos.");

$enviados = 0;
$errores = 0;

// 2. Para cada configuración, verificar si toca enviar ahora
foreach ($configs as $config) {
    $configId = $config['id'];
    $configNombre = $config['nombre'];
    $configHora = $config['hora_envio'] ?? '?';
    $configPeriodicidad = $config['periodicidad'] ?? '?';
    
    if (!shouldSendNow($config)) {
        writeLog("  Omitido '$configNombre' (periodicidad: $configPeriodicidad, hora: $configHora, último envío: " . ($config['ultimo_envio'] ?? 'nunca') . ")");
        continue;
    }
    
    writeLog("✉ Procesando reporte: $configNombre (ID: $configId)");
    
    // 3. Obtener nombre de empresa
    $empresaNombre = getEmpresaName($config['empresa_id']);
    
    // 4. Generar contenido del reporte
    $htmlContent = generateReportContent($config, $empresaNombre);
    
    // 5. Enviar a cada destinatario
    $destinatarios = $config['destinatarios'] ?? [];
    $subject = "[VSApp] $configNombre - $empresaNombre";
    
    $allSent = true;
    foreach ($destinatarios as $email) {
        $sent = sendEmail($email, $subject, $htmlContent);
        if (!$sent) {
            $allSent = false;
            $errores++;
        } else {
            $enviados++;
        }
    }
    
    // 6. Actualizar último envío en la base de datos
    if ($allSent && count($destinatarios) > 0) {
        supabaseRequest(
            "reportes_automaticos?id=eq.$configId",
            'PATCH',
            ['ultimo_envio' => date('c'), 'updated_at' => date('c')]
        );
        writeLog("Reporte '$configNombre' enviado exitosamente a " . count($destinatarios) . " destinatario(s).");
    }
}

writeLog("=== Fin ejecución. Enviados: $enviados | Errores: $errores ===");
echo "Ejecución completada. Enviados: $enviados | Errores: $errores\n";