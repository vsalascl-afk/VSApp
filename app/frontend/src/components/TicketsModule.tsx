import { useState, useEffect, useCallback } from "react";
import type { Usuario } from "@/lib/types";
import { SUPABASE_URL, SUPABASE_KEY } from "@/lib/supabase";
import { REGIONES_TICKET, getRegionTicketLabel } from "@/lib/regiones";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Ticket as TicketIcon,
  MapPin,
  Calendar,
  Loader2,
  UserCheck,
  Ban,
  CheckCircle,
  Wrench,
} from "lucide-react";
import CreateOTForm from "@/components/CreateOTForm";

interface TicketsModuleProps {
  user: Usuario;
  token: string;
  onGoToOrdenes: () => void;
}

interface TicketAdmin {
  id: string;
  titulo: string;
  descripcion: string;
  estado: "nuevo" | "asignado" | "convertido" | "descartado";
  region: string | null;
  direccion: string | null;
  ot_id: string | null;
  asignado_a: string | null;
  creado_en: string;
  nombre_cliente?: string | null;
  portal_cliente_id?: string | null;
}

interface TecnicoRPCOption {
  id?: string | number;
  auth_id?: string;
  nombre: string;
}

const ticketEstadoColors: Record<string, string> = {
  nuevo: "bg-amber-500",
  asignado: "bg-sky-500",
  convertido: "bg-green-500",
  descartado: "bg-gray-400",
};

const ticketEstadoLabels: Record<string, string> = {
  nuevo: "Nuevo",
  asignado: "Asignado",
  convertido: "Convertido",
  descartado: "Descartado",
};

export default function TicketsModule({ user, token, onGoToOrdenes }: TicketsModuleProps) {
  const { toast } = useToast();
  const isAdminView = user.rol === "admin" || user.rol === "supervisor" || user.rol === "superadmin";
  const isTecnico = user.rol === "tecnico";

  const [tickets, setTickets] = useState<TicketAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroEstado, setFiltroEstado] = useState("todos");
  const [filtroRegion, setFiltroRegion] = useState("todas");

  const [tecnicosPorRegion, setTecnicosPorRegion] = useState<Record<string, TecnicoRPCOption[]>>({});
  const [loadingTecnicosRegion, setLoadingTecnicosRegion] = useState<Record<string, boolean>>({});
  const [asignandoId, setAsignandoId] = useState<string | null>(null);
  const [descartandoId, setDescartandoId] = useState<string | null>(null);
  const [tecnicoNombres, setTecnicoNombres] = useState<Record<string, string>>({});
  const [otNumeros, setOtNumeros] = useState<Record<string, string>>({});
  const [otFormTicket, setOtFormTicket] = useState<TicketAdmin | null>(null);

  // silent=true se usa en el polling automático: actualiza la lista sin mostrar
  // el estado de carga ni reemplazar el contenido, para que no parpadee ni se
  // pierda el scroll del usuario.
  const fetchTickets = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent ?? false;
    if (!silent) setLoading(true);
    try {
      let url = `${SUPABASE_URL}/rest/v1/tickets?select=*&order=creado_en.desc`;
      if (filtroEstado !== "todos") url += `&estado=eq.${filtroEstado}`;
      if (filtroRegion !== "todas") url += `&region=eq.${filtroRegion}`;
      const res = await fetch(url, {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${token}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        setTickets(data || []);
      } else if (!silent) {
        setTickets([]);
      }
    } catch {
      if (!silent) setTickets([]);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [token, filtroEstado, filtroRegion]);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  // Actualización automática cada 30s (mismo intervalo que NotificationBell),
  // silenciosa para no interrumpir al usuario mientras revisa la lista.
  useEffect(() => {
    const interval = setInterval(() => {
      fetchTickets({ silent: true });
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchTickets]);

  // Resolver nombres de técnicos asignados y números de OT vinculadas
  useEffect(() => {
    const asignadoIds = [...new Set(tickets.filter((t) => t.asignado_a).map((t) => String(t.asignado_a)))];
    const idsAFaltar = asignadoIds.filter((id) => !(id in tecnicoNombres));
    if (idsAFaltar.length > 0) {
      fetch(`${SUPABASE_URL}/rest/v1/usuarios?id=in.(${idsAFaltar.join(",")})&select=id,nombre`, {
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}` },
      })
        .then((res) => (res.ok ? res.json() : []))
        .then((data: Array<{ id: number | string; nombre: string }>) => {
          setTecnicoNombres((prev) => {
            const next = { ...prev };
            (data || []).forEach((u) => {
              next[String(u.id)] = u.nombre;
            });
            return next;
          });
        })
        .catch(() => {});
    }

    const otIds = [...new Set(tickets.filter((t) => t.ot_id).map((t) => String(t.ot_id)))];
    const otIdsAFaltar = otIds.filter((id) => !(id in otNumeros));
    if (otIdsAFaltar.length > 0) {
      fetch(`${SUPABASE_URL}/rest/v1/ordenes_trabajo?id=in.(${otIdsAFaltar.join(",")})&select=id,numero`, {
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}` },
      })
        .then((res) => (res.ok ? res.json() : []))
        .then((data: Array<{ id: number | string; numero: string }>) => {
          setOtNumeros((prev) => {
            const next = { ...prev };
            (data || []).forEach((o) => {
              next[String(o.id)] = o.numero;
            });
            return next;
          });
        })
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tickets, token]);

  async function loadTecnicosForRegion(region: string) {
    if (!region || tecnicosPorRegion[region] || loadingTecnicosRegion[region]) return;
    setLoadingTecnicosRegion((p) => ({ ...p, [region]: true }));
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_tecnicos_por_region`, {
        method: "POST",
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ p_region: region }),
      });
      if (res.ok) {
        const data = await res.json();
        setTecnicosPorRegion((p) => ({ ...p, [region]: data || [] }));
      }
    } catch {
      // silencioso
    } finally {
      setLoadingTecnicosRegion((p) => ({ ...p, [region]: false }));
    }
  }

  async function handleAsignar(ticket: TicketAdmin, tecnicoId: string) {
    if (!tecnicoId) return;
    setAsignandoId(ticket.id);
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/tickets?id=eq.${ticket.id}`, {
        method: "PATCH",
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify({ asignado_a: tecnicoId, estado: "asignado" }),
      });
      if (!res.ok) {
        toast({ title: "Error", description: "No se pudo asignar el ticket.", variant: "destructive" });
        return;
      }
      toast({ title: "Ticket asignado", description: "Se asignó correctamente al técnico." });
      await fetchTickets();
    } catch {
      toast({ title: "Error de conexión", description: "No se pudo asignar el ticket.", variant: "destructive" });
    } finally {
      setAsignandoId(null);
    }
  }

  async function handleDescartar(ticket: TicketAdmin) {
    setDescartandoId(ticket.id);
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/tickets?id=eq.${ticket.id}`, {
        method: "PATCH",
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify({ estado: "descartado" }),
      });
      if (!res.ok) {
        toast({ title: "Error", description: "No se pudo descartar el ticket.", variant: "destructive" });
        return;
      }
      toast({ title: "Ticket descartado" });
      await fetchTickets();
    } catch {
      toast({ title: "Error de conexión", description: "No se pudo descartar el ticket.", variant: "destructive" });
    } finally {
      setDescartandoId(null);
    }
  }

  async function handleOTGenerada(createdOT?: { id: string; numero: string }) {
    const ticket = otFormTicket;
    setOtFormTicket(null);
    if (!ticket || !createdOT) {
      await fetchTickets();
      return;
    }
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/tickets?id=eq.${ticket.id}`, {
        method: "PATCH",
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify({ estado: "convertido", ot_id: createdOT.id }),
      });
      toast({
        title: "Ticket convertido",
        description: `Se generó la OT ${createdOT.numero} y se vinculó al ticket.`,
      });
    } catch {
      toast({
        title: "OT creada",
        description: "La OT se creó pero no se pudo vincular al ticket automáticamente.",
        variant: "destructive",
      });
    } finally {
      await fetchTickets();
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <TicketIcon className="w-5 h-5 text-slate-700" />
        <h2 className="text-lg font-bold text-slate-800">
          {isTecnico ? "Mis Tickets" : "Tickets"}
        </h2>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={filtroEstado} onValueChange={setFiltroEstado}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="nuevo">Nuevo</SelectItem>
            <SelectItem value="asignado">Asignado</SelectItem>
            <SelectItem value="convertido">Convertido</SelectItem>
            <SelectItem value="descartado">Descartado</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filtroRegion} onValueChange={setFiltroRegion}>
          <SelectTrigger className="w-56">
            <SelectValue placeholder="Filtrar región" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas las regiones</SelectItem>
            {REGIONES_TICKET.map((r) => (
              <SelectItem key={r.value} value={r.value}>
                {r.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground ml-auto">
          {tickets.length} ticket(s)
        </span>
      </div>

      {loading ? (
        <div className="text-center py-10 text-muted-foreground">Cargando tickets...</div>
      ) : tickets.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground">
          {isTecnico ? "No tienes tickets asignados" : "No hay tickets"}
        </div>
      ) : (
        tickets.map((t) => (
          <Card key={t.id} className="p-4 hover:shadow-lg transition-all duration-200">
            <div className="flex items-start justify-between gap-3 mb-2">
              <p className="font-bold text-sm text-slate-800">{t.titulo}</p>
              <Badge className={`${ticketEstadoColors[t.estado]} text-white text-xs shrink-0`}>
                {ticketEstadoLabels[t.estado] || t.estado}
              </Badge>
            </div>

            {(t.region || t.direccion) && (
              <p className="flex items-center gap-1 text-xs text-slate-500 mb-2">
                <MapPin className="w-3.5 h-3.5 shrink-0 text-blue-500" />
                {[getRegionTicketLabel(t.region), t.direccion].filter(Boolean).join(" — ")}
              </p>
            )}

            <p className="text-sm text-slate-600 whitespace-pre-wrap mb-2">{t.descripcion}</p>

            <p className="flex items-center gap-1 text-xs text-slate-400 mb-3">
              <Calendar className="w-3 h-3" />
              {new Date(t.creado_en).toLocaleDateString("es-CL")} ·{" "}
              {new Date(t.creado_en).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}
            </p>

            {/* Acciones: admin/supervisor con ticket nuevo */}
            {isAdminView && t.estado === "nuevo" && (
              <div className="flex flex-wrap items-center gap-2">
                <Select
                  onOpenChange={(o) => {
                    if (o && t.region) loadTecnicosForRegion(t.region);
                  }}
                  onValueChange={(v) => handleAsignar(t, v)}
                  disabled={asignandoId === t.id}
                >
                  <SelectTrigger className="w-56">
                    <SelectValue placeholder={t.region ? "Asignar a técnico" : "Ticket sin región"} />
                  </SelectTrigger>
                  <SelectContent>
                    {loadingTecnicosRegion[t.region || ""] ? (
                      <div className="p-2 text-xs text-muted-foreground flex items-center gap-1">
                        <Loader2 className="w-3 h-3 animate-spin" /> Cargando técnicos...
                      </div>
                    ) : (tecnicosPorRegion[t.region || ""] || []).length === 0 ? (
                      <div className="p-2 text-xs text-muted-foreground">Sin técnicos en esta región</div>
                    ) : (
                      (tecnicosPorRegion[t.region || ""] || []).map((tec) => {
                        const val = String(tec.id ?? tec.auth_id ?? "");
                        return (
                          <SelectItem key={val} value={val}>
                            {tec.nombre}
                          </SelectItem>
                        );
                      })
                    )}
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleDescartar(t)}
                  disabled={descartandoId === t.id}
                  className="gap-1 text-xs border-red-300 text-red-600 hover:bg-red-50"
                >
                  {descartandoId === t.id ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Ban className="w-3 h-3" />
                  )}
                  Descartar
                </Button>
              </div>
            )}

            {/* Admin/supervisor: ticket ya asignado */}
            {isAdminView && t.estado === "asignado" && (
              <p className="text-xs text-sky-700 font-medium flex items-center gap-1">
                <UserCheck className="w-3.5 h-3.5" />
                Asignado a: {t.asignado_a ? tecnicoNombres[String(t.asignado_a)] || "Cargando..." : "—"}
              </p>
            )}

            {/* Cualquier vista: ticket convertido a OT */}
            {t.estado === "convertido" && (
              <button
                onClick={onGoToOrdenes}
                className="text-xs font-medium text-blue-600 hover:underline flex items-center gap-1"
              >
                <CheckCircle className="w-3.5 h-3.5" />
                Convertido a OT #{t.ot_id ? otNumeros[String(t.ot_id)] || t.ot_id : ""}
              </button>
            )}

            {/* Técnico: ticket asignado a él, puede generar la OT */}
            {isTecnico && t.estado === "asignado" && (
              <Button
                size="sm"
                onClick={() => setOtFormTicket(t)}
                className="gap-1 text-xs bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Wrench className="w-3.5 h-3.5" />
                Generar OT
              </Button>
            )}
          </Card>
        ))
      )}

      {/* Dialog: generar OT desde un ticket asignado */}
      <Dialog open={!!otFormTicket} onOpenChange={(o) => { if (!o) setOtFormTicket(null); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wrench className="w-4 h-4" />
              Generar OT desde Ticket
            </DialogTitle>
          </DialogHeader>
          {otFormTicket && (
            <CreateOTForm
              key={otFormTicket.id}
              user={user}
              token={token}
              defaultOpen
              initialCliente={otFormTicket.nombre_cliente || ""}
              initialClienteFinalId={otFormTicket.portal_cliente_id || undefined}
              initialDescripcion={otFormTicket.descripcion}
              initialDireccion={otFormTicket.direccion || ""}
              onCreated={handleOTGenerada}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
