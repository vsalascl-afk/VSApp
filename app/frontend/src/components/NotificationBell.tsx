import { useState, useEffect, useCallback, useRef } from "react";
import { useEmpresa } from "@/lib/empresaContext";
import type { Usuario } from "@/lib/types";
import { SUPABASE_URL, SUPABASE_KEY, SUPABASE_SERVICE_KEY } from "@/lib/supabase";
import { getRegionTicketLabel } from "@/lib/regiones";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Bell, CheckCheck, AlertTriangle, Clock, Info, XCircle, Ticket, MapPin } from "lucide-react";

interface Notification {
  id: string;
  schedule_id: string;
  empresa_id: string;
  usuario_id: string;
  tipo_alerta: "informativa" | "recordatorio" | "urgente" | "vencida";
  mensaje: string;
  leida: boolean;
  fecha_alerta: string;
  created_at: string;
}

interface TicketNuevo {
  id: string;
  titulo: string;
  descripcion: string;
  estado: string;
  creado_en: string;
}

interface TicketAsignado {
  id: string;
  titulo: string;
  region: string | null;
  direccion: string | null;
  actualizado_en: string;
}

function excerpt(text: string, max = 90) {
  if (!text) return "";
  return text.length > max ? `${text.slice(0, max).trim()}…` : text;
}

interface Props {
  user: Usuario;
  token: string;
}

const ALERTA_ICONS: Record<string, React.ReactNode> = {
  informativa: <Info className="w-4 h-4 text-blue-500" />,
  recordatorio: <Clock className="w-4 h-4 text-yellow-500" />,
  urgente: <AlertTriangle className="w-4 h-4 text-orange-500" />,
  vencida: <XCircle className="w-4 h-4 text-red-500" />,
};

const ALERTA_BG: Record<string, string> = {
  informativa: "bg-blue-50 border-blue-100",
  recordatorio: "bg-yellow-50 border-yellow-100",
  urgente: "bg-orange-50 border-orange-100",
  vencida: "bg-red-50 border-red-100",
};

export default function NotificationBell({ user, token }: Props) {
  const { empresa } = useEmpresa();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [ticketsNuevos, setTicketsNuevos] = useState<TicketNuevo[]>([]);
  const [ticketsAsignados, setTicketsAsignados] = useState<TicketAsignado[]>([]);
  const [open, setOpen] = useState(false);
  const [pushPermission, setPushPermission] = useState<NotificationPermission>("default");
  const generatedRef = useRef(false);
  const usuarioInternoIdRef = useRef<string | null>(null);

  const authKey = SUPABASE_SERVICE_KEY || token;
  const apiKey = SUPABASE_SERVICE_KEY || SUPABASE_KEY;
  const totalBadgeCount = unreadCount + ticketsNuevos.length + ticketsAsignados.length;

  useEffect(() => {
    if (empresa) {
      generateNotifications();
      generateSLAAlerts();
      loadNotifications();
      loadTicketsNuevos();
      loadTicketsAsignados();
    }
    // Check push permission
    if ("Notification" in window) {
      setPushPermission(Notification.permission);
    }
  }, [empresa]);

  // Polling: verificar nuevas notificaciones cada 30s y disparar push para las nuevas no leídas
  useEffect(() => {
    if (!empresa) return;
    const lastCheckRef = { count: unreadCount };
    const interval = setInterval(async () => {
      await loadNotifications();
      await loadTicketsNuevos();
      await loadTicketsAsignados();
      // Si hay nuevas no leídas desde el último check, disparar push
      setUnreadCount((current) => {
        if (current > lastCheckRef.count) {
          // Hay nuevas notificaciones - disparar push via SW
          const diff = current - lastCheckRef.count;
          showPushNotification(
            "VSApp",
            `Tienes ${diff} nueva(s) notificación(es) pendiente(s)`,
          );
        }
        lastCheckRef.count = current;
        return current;
      });
    }, 30000); // cada 30 segundos

    // Listener para mensajes del Service Worker (periodic sync / background check)
    let swCleanup: (() => void) | undefined;
    if ("serviceWorker" in navigator) {
      const handler = (event: MessageEvent) => {
        if (event.data?.type === "CHECK_NOTIFICATIONS") {
          loadNotifications();
        }
      };
      navigator.serviceWorker.addEventListener("message", handler);
      swCleanup = () => navigator.serviceWorker.removeEventListener("message", handler);
    }

    return () => {
      clearInterval(interval);
      swCleanup?.();
    };
  }, [empresa]);

  // Request push notification permission
  const requestPushPermission = useCallback(async () => {
    if (!("Notification" in window)) return;
    const permission = await Notification.requestPermission();
    setPushPermission(permission);
    if (permission === "granted") {
      showPushNotification("Notificaciones activadas", "Recibirás alertas de mantenciones programadas");
    }
  }, []);

  async function showPushNotification(title: string, body: string) {
    if (!("Notification" in window) || Notification.permission !== "granted") return;
    try {
      // Intentar usar Service Worker para notificaciones persistentes (funciona con app cerrada)
      if ("serviceWorker" in navigator) {
        const registration = await navigator.serviceWorker.ready;
        if (registration.showNotification) {
          await registration.showNotification(title, {
            body,
            icon: "/icons/icon-192x192.png",
            badge: "/icons/icon-72x72.png",
            tag: `maintenance-${Date.now()}`,
            vibrate: [200, 100, 200],
            requireInteraction: true,
            data: { url: window.location.origin },
          });
          return;
        }
      }
      // Fallback: Notification API directa (solo funciona con app abierta)
      new Notification(title, {
        body,
        icon: "/icons/icon-192x192.png",
        badge: "/icons/icon-72x72.png",
        tag: "maintenance-alert",
      });
    } catch {
      // Fallback silencioso
    }
  }

  // SLA por prioridad (en horas)
  const SLA_HOURS: Record<string, number> = { alta: 24, media: 48, baja: 72 };

  async function generateSLAAlerts() {
    if (!empresa) return;
    // Solo supervisores/admins reciben alertas SLA
    if (user.rol !== "supervisor" && user.rol !== "admin" && user.rol !== "superadmin") return;

    try {
      // Cargar OTs activas (no completadas) de la empresa
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/ordenes_trabajo?empresa_id=eq.${empresa.id}&estado=neq.completada&select=id,numero,cliente,prioridad,estado,fecha_inicio,tecnico_id`,
        {
          headers: {
            apikey: apiKey,
            Authorization: `Bearer ${authKey}`,
          },
        }
      );
      if (!res.ok) return;
      const ordenes = await res.json();
      if (!ordenes || ordenes.length === 0) return;

      const ahora = Date.now();
      const hoyStr = new Date().toISOString().split("T")[0];

      // Verificar notificaciones SLA ya generadas hoy
      const existingRes = await fetch(
        `${SUPABASE_URL}/rest/v1/maintenance_notifications?empresa_id=eq.${empresa.id}&fecha_alerta=eq.${hoyStr}&mensaje=like.*SLA*&select=ot_id,tipo_alerta`,
        {
          headers: {
            apikey: apiKey,
            Authorization: `Bearer ${authKey}`,
          },
        }
      );
      const existing = existingRes.ok ? await existingRes.json() : [];
      const existingKeys = new Set(existing.map((e: { ot_id: string; tipo_alerta: string }) => `${e.ot_id}_${e.tipo_alerta}`));

      const newNotifications: Array<{
        ot_id: string;
        empresa_id: string;
        usuario_id: string;
        tipo_alerta: string;
        mensaje: string;
        fecha_alerta: string;
      }> = [];

      for (const ot of ordenes) {
        const slaHours = SLA_HOURS[ot.prioridad] || 72;
        const inicio = new Date(ot.fecha_inicio).getTime();
        const horasTranscurridas = (ahora - inicio) / (1000 * 60 * 60);
        const horasRestantes = slaHours - horasTranscurridas;
        const porcentaje = (horasTranscurridas / slaHours) * 100;

        let tipoAlerta: string | null = null;
        let mensaje = "";

        if (horasRestantes <= 0) {
          tipoAlerta = "vencida";
          const horasVencida = Math.abs(Math.round(horasRestantes));
          mensaje = `🚨 SLA VENCIDO: OT "${ot.numero}" (${ot.cliente}) - Prioridad ${ot.prioridad.toUpperCase()} superó las ${slaHours}h por ${horasVencida}h.`;
        } else if (porcentaje >= 75) {
          tipoAlerta = "urgente";
          const horasQueda = Math.round(horasRestantes);
          mensaje = `⚠️ SLA CRÍTICO: OT "${ot.numero}" (${ot.cliente}) - Prioridad ${ot.prioridad.toUpperCase()}, quedan ${horasQueda}h de ${slaHours}h.`;
        }

        if (tipoAlerta) {
          const key = `${ot.id}_${tipoAlerta}`;
          if (!existingKeys.has(key)) {
            newNotifications.push({
              ot_id: ot.id,
              empresa_id: empresa.id,
              usuario_id: user.id,
              tipo_alerta: tipoAlerta,
              mensaje,
              fecha_alerta: hoyStr,
            });
            existingKeys.add(key);
          }
        }
      }

      // Insertar notificaciones SLA
      if (newNotifications.length > 0) {
        await fetch(
          `${SUPABASE_URL}/rest/v1/maintenance_notifications`,
          {
            method: "POST",
            headers: {
              apikey: apiKey,
              Authorization: `Bearer ${authKey}`,
              "Content-Type": "application/json",
              Prefer: "return=minimal",
            },
            body: JSON.stringify(newNotifications),
          }
        );

        // Disparar push para alertas SLA vencidas/urgentes
        for (const alert of newNotifications) {
          showPushNotification(
            alert.tipo_alerta === "vencida" ? "🚨 SLA Vencido" : "⚠️ SLA Crítico",
            alert.mensaje.replace(/^[^\w\s]+\s*/u, "").trim()
          );
        }
      }
    } catch (err) {
      console.error("Error generating SLA alerts:", err);
    }
  }

  async function generateNotifications() {
    if (!empresa || generatedRef.current) return;
    generatedRef.current = true;

    try {
      // Load active schedules
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/maintenance_schedules?empresa_id=eq.${empresa.id}&activo=eq.true`,
        {
          headers: {
            apikey: apiKey,
            Authorization: `Bearer ${authKey}`,
          },
        }
      );
      if (!res.ok) return;
      const schedules = await res.json();
      if (!schedules || schedules.length === 0) return;

      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);
      const hoyStr = hoy.toISOString().split("T")[0];

      // Check existing notifications for today to avoid duplicates
      const existingRes = await fetch(
        `${SUPABASE_URL}/rest/v1/maintenance_notifications?empresa_id=eq.${empresa.id}&fecha_alerta=eq.${hoyStr}&select=schedule_id,tipo_alerta`,
        {
          headers: {
            apikey: apiKey,
            Authorization: `Bearer ${authKey}`,
          },
        }
      );
      const existing = existingRes.ok ? await existingRes.json() : [];
      const existingKeys = new Set(existing.map((e: { schedule_id: string; tipo_alerta: string }) => `${e.schedule_id}_${e.tipo_alerta}`));

      const newNotifications: Array<{
        schedule_id: string;
        empresa_id: string;
        usuario_id: string;
        tipo_alerta: string;
        mensaje: string;
        fecha_alerta: string;
      }> = [];

      for (const schedule of schedules) {
        const proxima = new Date(schedule.proxima_fecha + "T00:00:00");
        const diffDias = Math.ceil((proxima.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));

        let tipoAlerta: string | null = null;
        let mensaje = "";

        if (diffDias < 0) {
          tipoAlerta = "vencida";
          mensaje = `⚠️ VENCIDA: La mantención "${schedule.sitio}" (${schedule.tipo_checklist === "mantencion_bms" ? "Mantención BMS" : schedule.tipo_checklist === "operacion_bms" ? "Operación BMS" : "Grupo Electrógeno"}) tiene ${Math.abs(diffDias)} día(s) de atraso.`;
        } else if (diffDias === 0) {
          tipoAlerta = "urgente";
          mensaje = `🔴 HOY: La mantención "${schedule.sitio}" debe ejecutarse hoy.`;
        } else if (diffDias <= 3) {
          tipoAlerta = "recordatorio";
          mensaje = `🟡 RECORDATORIO: La mantención "${schedule.sitio}" está programada para dentro de ${diffDias} día(s).`;
        } else if (diffDias <= (schedule.dias_anticipacion_alerta || 7)) {
          tipoAlerta = "informativa";
          mensaje = `ℹ️ PRÓXIMA: La mantención "${schedule.sitio}" está programada para el ${proxima.toLocaleDateString("es-CL")}.`;
        }

        if (tipoAlerta) {
          // Determine recipients: tecnico + supervisor
          const recipients: string[] = [];
          if (schedule.tecnico_id) recipients.push(schedule.tecnico_id);
          if (schedule.supervisor_id && schedule.supervisor_id !== schedule.tecnico_id) {
            recipients.push(schedule.supervisor_id);
          }
          // If no specific assignment, notify current user if they're supervisor/admin
          if (recipients.length === 0 && (user.rol === "supervisor" || user.rol === "admin" || user.rol === "superadmin")) {
            recipients.push(user.id);
          }

          for (const uid of recipients) {
            const key = `${schedule.id}_${tipoAlerta}`;
            if (!existingKeys.has(key)) {
              newNotifications.push({
                schedule_id: schedule.id,
                empresa_id: empresa.id,
                usuario_id: uid,
                tipo_alerta: tipoAlerta,
                mensaje,
                fecha_alerta: hoyStr,
              });
              existingKeys.add(key); // Prevent duplicates in batch
            }
          }
        }
      }

      // Batch insert new notifications
      if (newNotifications.length > 0) {
        await fetch(
          `${SUPABASE_URL}/rest/v1/maintenance_notifications`,
          {
            method: "POST",
            headers: {
              apikey: apiKey,
              Authorization: `Bearer ${authKey}`,
              "Content-Type": "application/json",
              Prefer: "return=minimal",
            },
            body: JSON.stringify(newNotifications),
          }
        );

        // Send push notifications for urgent/vencida
        const pushAlerts = newNotifications.filter(
          (n) => n.usuario_id === user.id && (n.tipo_alerta === "urgente" || n.tipo_alerta === "vencida")
        );
        for (const alert of pushAlerts) {
          showPushNotification("Alerta de Mantención", alert.mensaje.replace(/^[^\w\s]+\s*/u, "").trim());
        }
      }
    } catch (err) {
      console.error("Error generating notifications:", err);
    }
  }

  async function loadNotifications() {
    if (!empresa) return;
    try {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/maintenance_notifications?empresa_id=eq.${empresa.id}&usuario_id=eq.${user.id}&order=created_at.desc&limit=20`,
        {
          headers: {
            apikey: apiKey,
            Authorization: `Bearer ${authKey}`,
          },
        }
      );
      if (res.ok) {
        const data: Notification[] = await res.json();
        setNotifications(data || []);
        setUnreadCount(data.filter((n) => !n.leida).length);
      }
    } catch (err) {
      console.error("Error loading notifications:", err);
    }
  }

  async function loadTicketsNuevos() {
    try {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/tickets?estado=eq.nuevo&select=id,titulo,descripcion,estado,creado_en&order=creado_en.desc`,
        {
          headers: {
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${token}`,
          },
        }
      );
      if (res.ok) {
        const data: TicketNuevo[] = await res.json();
        setTicketsNuevos(data || []);
      }
    } catch (err) {
      console.error("Error loading tickets:", err);
    }
  }

  // Resuelve el id interno (usuarios.id) del técnico a partir de su auth_id,
  // y lo cachea en un ref para no repetir la consulta en cada polling.
  async function resolveUsuarioInternoId(): Promise<string | null> {
    if (usuarioInternoIdRef.current) return usuarioInternoIdRef.current;
    try {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/usuarios?auth_id=eq.${user.auth_id}&select=id&limit=1`,
        {
          headers: {
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${token}`,
          },
        }
      );
      if (res.ok) {
        const data = await res.json();
        if (data && data[0]) {
          const id = String(data[0].id);
          usuarioInternoIdRef.current = id;
          return id;
        }
      }
    } catch (err) {
      console.error("Error resolving usuario interno id:", err);
    }
    return null;
  }

  async function loadTicketsAsignados() {
    if (user.rol !== "tecnico") return;
    try {
      const internoId = await resolveUsuarioInternoId();
      if (!internoId) return;
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/tickets?asignado_a=eq.${internoId}&estado=eq.asignado&select=id,titulo,region,direccion,actualizado_en&order=actualizado_en.desc`,
        {
          headers: {
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${token}`,
          },
        }
      );
      if (res.ok) {
        const data: TicketAsignado[] = await res.json();
        setTicketsAsignados(data || []);
      }
    } catch (err) {
      console.error("Error loading tickets asignados:", err);
    }
  }

  async function markAsRead(id: string) {
    try {
      await fetch(
        `${SUPABASE_URL}/rest/v1/maintenance_notifications?id=eq.${id}`,
        {
          method: "PATCH",
          headers: {
            apikey: apiKey,
            Authorization: `Bearer ${authKey}`,
            "Content-Type": "application/json",
            Prefer: "return=minimal",
          },
          body: JSON.stringify({ leida: true }),
        }
      );
      setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, leida: true } : n));
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch {
      // silent
    }
  }

  async function markAllAsRead() {
    const unread = notifications.filter((n) => !n.leida);
    if (unread.length === 0) return;
    try {
      await fetch(
        `${SUPABASE_URL}/rest/v1/maintenance_notifications?empresa_id=eq.${empresa?.id}&usuario_id=eq.${user.id}&leida=eq.false`,
        {
          method: "PATCH",
          headers: {
            apikey: apiKey,
            Authorization: `Bearer ${authKey}`,
            "Content-Type": "application/json",
            Prefer: "return=minimal",
          },
          body: JSON.stringify({ leida: true }),
        }
      );
      setNotifications((prev) => prev.map((n) => ({ ...n, leida: true })));
      setUnreadCount(0);
    } catch {
      // silent
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="w-5 h-5" />
          {totalBadgeCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
              {totalBadgeCount > 9 ? "9+" : totalBadgeCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0 max-h-[480px] overflow-hidden flex flex-col" align="end">
        <div className="p-3 border-b flex items-center justify-between shrink-0">
          <h4 className="font-semibold text-sm">Notificaciones</h4>
          <div className="flex items-center gap-2">
            {pushPermission !== "granted" && (
              <Button variant="ghost" size="sm" className="text-xs h-7" onClick={requestPushPermission}>
                Activar Push
              </Button>
            )}
            {unreadCount > 0 && (
              <Button variant="ghost" size="sm" className="text-xs h-7" onClick={markAllAsRead}>
                <CheckCheck className="w-3 h-3 mr-1" /> Leer todas
              </Button>
            )}
          </div>
        </div>
        <div className="overflow-y-auto flex-1">
          {notifications.length === 0 ? (
            <div className="p-6 text-center text-gray-400 text-sm">
              <Bell className="w-8 h-8 mx-auto mb-2 opacity-30" />
              Sin notificaciones
            </div>
          ) : (
            notifications.map((notif) => (
              <div
                key={notif.id}
                className={`p-3 border-b last:border-b-0 cursor-pointer transition-colors hover:bg-gray-50 ${
                  !notif.leida ? ALERTA_BG[notif.tipo_alerta] : ""
                }`}
                onClick={() => { if (!notif.leida) markAsRead(notif.id); }}
              >
                <div className="flex items-start gap-2">
                  <div className="mt-0.5">{ALERTA_ICONS[notif.tipo_alerta]}</div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs leading-relaxed ${!notif.leida ? "font-medium text-gray-800" : "text-gray-500"}`}>
                      {notif.mensaje}
                    </p>
                    <p className="text-[10px] text-gray-400 mt-1">
                      {new Date(notif.created_at).toLocaleDateString("es-CL")} · {new Date(notif.created_at).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                  {!notif.leida && (
                    <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 flex-shrink-0" />
                  )}
                </div>
              </div>
            ))
          )}

          {/* Tickets nuevos */}
          <div className="border-t">
            <div className="px-3 py-2 bg-gray-50 flex items-center justify-between sticky top-0">
              <h5 className="text-xs font-semibold text-gray-600">Tickets nuevos</h5>
              {ticketsNuevos.length > 0 && (
                <span className="text-[10px] text-gray-400">{ticketsNuevos.length}</span>
              )}
            </div>
            {ticketsNuevos.length === 0 ? (
              <div className="p-6 text-center text-gray-400 text-sm">
                <Ticket className="w-8 h-8 mx-auto mb-2 opacity-30" />
                Sin tickets nuevos
              </div>
            ) : (
              ticketsNuevos.map((t) => (
                <div
                  key={t.id}
                  className="p-3 border-b last:border-b-0 bg-purple-50 border-purple-100"
                >
                  <div className="flex items-start gap-2">
                    <div className="mt-0.5">
                      <Ticket className="w-4 h-4 text-purple-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-800">{t.titulo}</p>
                      <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                        {excerpt(t.descripcion)}
                      </p>
                      <p className="text-[10px] text-gray-400 mt-1">
                        {new Date(t.creado_en).toLocaleDateString("es-CL")} · {new Date(t.creado_en).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Tickets asignados a ti (solo técnico) */}
          {user.rol === "tecnico" && (
            <div className="border-t">
              <div className="px-3 py-2 bg-gray-50 flex items-center justify-between sticky top-0">
                <h5 className="text-xs font-semibold text-gray-600">Tickets asignados a ti</h5>
                {ticketsAsignados.length > 0 && (
                  <span className="text-[10px] text-sky-500 font-semibold">{ticketsAsignados.length}</span>
                )}
              </div>
              {ticketsAsignados.length === 0 ? (
                <div className="p-6 text-center text-gray-400 text-sm">
                  <Ticket className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  Sin tickets asignados
                </div>
              ) : (
                ticketsAsignados.map((t) => (
                  <div
                    key={t.id}
                    className="p-3 border-b last:border-b-0 bg-sky-50 border-sky-100"
                  >
                    <div className="flex items-start gap-2">
                      <div className="mt-0.5">
                        <Ticket className="w-4 h-4 text-sky-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-800">{t.titulo}</p>
                        {(t.region || t.direccion) && (
                          <p className="flex items-center gap-1 text-xs text-gray-500 mt-0.5">
                            <MapPin className="w-3 h-3 shrink-0 text-sky-500" />
                            {[getRegionTicketLabel(t.region), t.direccion].filter(Boolean).join(" — ")}
                          </p>
                        )}
                        <p className="text-[10px] text-gray-400 mt-1">
                          {new Date(t.actualizado_en).toLocaleDateString("es-CL")} ·{" "}
                          {new Date(t.actualizado_en).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}