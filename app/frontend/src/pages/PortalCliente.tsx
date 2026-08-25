import { useEffect, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import { SUPABASE_URL, SUPABASE_KEY } from "@/lib/supabase";
import type { OrdenTrabajo } from "@/lib/types";
import { REGIONES_TICKET, getRegionTicketLabel } from "@/lib/regiones";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  AlertTriangle,
  ClipboardList,
  Search,
  Eye,
  ArrowLeft,
  ClipboardCheck,
  Calendar,
  MapPin,
  User,
  Clock,
  Camera,
  FileText,
  Package,
  Ticket as TicketIcon,
  Plus,
} from "lucide-react";

interface PortalAccess {
  id: string;
  empresa_id: string;
  nombre_cliente: string;
  email_cliente: string;
}

interface EmpresaInfo {
  id: string;
  nombre: string;
  logo_url?: string;
  color_primario: string;
  color_secundario: string;
}

interface ChecklistBMS {
  id: string;
  tipo: string;
  numero_interno: string;
  fecha_creacion: string;
  resultado_general: string;
  tecnico_nombre: string;
  especialidad?: string;
  datos: Record<string, unknown>;
}

interface MaterialAsignado {
  id: string;
  nombre: string;
  cantidad: number;
  unidad: string;
  categoria: string;
}

interface PortalTicket {
  id: string;
  titulo: string;
  descripcion: string;
  estado: "nuevo" | "en_revision" | "convertido" | "descartado";
  ot_id: string | null;
  creado_en: string;
  region?: string | null;
  direccion?: string | null;
}

const estadoColors: Record<string, string> = {
  pendiente: "bg-amber-500",
  en_curso: "bg-sky-500",
  en_revision: "bg-purple-500",
  completada: "bg-green-500",
};

const estadoLabels: Record<string, string> = {
  pendiente: "Pendiente",
  en_curso: "En Curso",
  en_revision: "En Revisión",
  completada: "Completada",
};

const ticketEstadoColors: Record<string, string> = {
  nuevo: "bg-sky-500",
  en_revision: "bg-amber-500",
  convertido: "bg-green-500",
  descartado: "bg-gray-400",
};

const ticketEstadoLabels: Record<string, string> = {
  nuevo: "Nuevo",
  en_revision: "En Revisión",
  convertido: "Convertido",
  descartado: "Descartado",
};

export default function PortalCliente() {
  const { token } = useParams<{ token: string }>();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [portalAccess, setPortalAccess] = useState<PortalAccess | null>(null);
  const [empresa, setEmpresa] = useState<EmpresaInfo | null>(null);
  const [ordenes, setOrdenes] = useState<OrdenTrabajo[]>([]);
  const [filteredOrdenes, setFilteredOrdenes] = useState<OrdenTrabajo[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [estadoFilter, setEstadoFilter] = useState<string>("todos");
  const [selectedOT, setSelectedOT] = useState<OrdenTrabajo | null>(null);
  const [checklists, setChecklists] = useState<ChecklistBMS[]>([]);
  const [materiales, setMateriales] = useState<MaterialAsignado[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [activeTab, setActiveTab] = useState<"ordenes" | "checklists" | "tickets">("ordenes");
  const [checklistsModuleActive, setChecklistsModuleActive] = useState(false);
  const [tickets, setTickets] = useState<PortalTicket[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(false);
  const [ticketDialogOpen, setTicketDialogOpen] = useState(false);
  const [ticketTitulo, setTicketTitulo] = useState("");
  const [ticketRegion, setTicketRegion] = useState("");
  const [ticketDireccion, setTicketDireccion] = useState("");
  const [ticketDescripcion, setTicketDescripcion] = useState("");
  const [submittingTicket, setSubmittingTicket] = useState(false);

  // Validar token y obtener acceso
  useEffect(() => {
    if (!token) {
      setError("Token no proporcionado");
      setLoading(false);
      return;
    }
    validateToken(token);
  }, [token]);

  async function validateToken(tkn: string) {
    try {
      // Buscar acceso por token vía RPC segura (RLS-safe)
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/rpc/get_portal_access`,
        {
          method: "POST",
          headers: {
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${SUPABASE_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ p_token: tkn }),
        }
      );

      if (!res.ok) {
        setError("Error al validar acceso");
        setLoading(false);
        return;
      }

      const data = await res.json();
      if (!data || data.length === 0) {
        setError("Enlace inválido o expirado");
        setLoading(false);
        return;
      }

      const access = data[0] as PortalAccess;

      setPortalAccess(access);

      // Obtener info de empresa
      await fetchEmpresa(access.empresa_id);
      // Verificar módulo checklists
      await checkModules(access.empresa_id);
      // Obtener OTs del cliente
      await fetchOrdenes(tkn);

      setLoading(false);
    } catch {
      setError("Error de conexión");
      setLoading(false);
    }
  }

  async function fetchEmpresa(empresaId: string) {
    try {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/empresas?id=eq.${empresaId}&select=id,nombre,logo_url,color_primario,color_secundario`,
        {
          headers: {
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${SUPABASE_KEY}`,
            "Content-Type": "application/json",
          },
        }
      );
      if (res.ok) {
        const data = await res.json();
        if (data?.[0]) setEmpresa(data[0]);
      }
    } catch {
      // silently fail
    }
  }

  async function checkModules(empresaId: string) {
    try {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/company_modules?empresa_id=eq.${empresaId}&module_name=eq.checklists&active=eq.true`,
        {
          headers: {
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${SUPABASE_KEY}`,
            "Content-Type": "application/json",
          },
        }
      );
      if (res.ok) {
        const data = await res.json();
        setChecklistsModuleActive(data && data.length > 0);
      }
    } catch {
      // silently fail
    }
  }

  async function fetchOrdenes(tkn: string) {
    try {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/rpc/get_portal_ots`,
        {
          method: "POST",
          headers: {
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${SUPABASE_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ p_token: tkn }),
        }
      );
      if (res.ok) {
        const data = await res.json();
        setOrdenes(data || []);
        setFilteredOrdenes(data || []);
      }
    } catch {
      // silently fail
    }
  }

  // Filtrar órdenes
  useEffect(() => {
    let filtered = [...ordenes];
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (ot) =>
          ot.numero?.toLowerCase().includes(term) ||
          ot.descripcion?.toLowerCase().includes(term) ||
          ot.direccion?.toLowerCase().includes(term)
      );
    }
    if (estadoFilter !== "todos") {
      filtered = filtered.filter((ot) => ot.estado === estadoFilter);
    }
    setFilteredOrdenes(filtered);
  }, [searchTerm, estadoFilter, ordenes]);

  // Cargar detalle de OT
  const loadOTDetail = useCallback(async (ot: OrdenTrabajo) => {
    setSelectedOT(ot);
    setLoadingDetail(true);

    // Cargar materiales asignados
    try {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/inventario_ot_asignacion?ot_id=eq.${ot.id}&select=id,nombre,cantidad,unidad,categoria`,
        {
          headers: {
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${SUPABASE_KEY}`,
            "Content-Type": "application/json",
          },
        }
      );
      if (res.ok) {
        const data = await res.json();
        setMateriales(data || []);
      }
    } catch {
      setMateriales([]);
    }

    // Cargar checklists asociados a esta OT (por codigo_activo o matching)
    if (checklistsModuleActive && ot.codigo_activo) {
      try {
        const res = await fetch(
          `${SUPABASE_URL}/rest/v1/checklist_bms?empresa_id=eq.${ot.empresa_id}&codigo_activo=eq.${encodeURIComponent(ot.codigo_activo)}&order=fecha_creacion.desc&limit=10`,
          {
            headers: {
              apikey: SUPABASE_KEY,
              Authorization: `Bearer ${SUPABASE_KEY}`,
              "Content-Type": "application/json",
            },
          }
        );
        if (res.ok) {
          const data = await res.json();
          setChecklists(data || []);
        }
      } catch {
        setChecklists([]);
      }
    } else {
      setChecklists([]);
    }

    setLoadingDetail(false);
  }, [checklistsModuleActive]);

  // Cargar todos los checklists del cliente (por OTs)
  const loadAllChecklists = useCallback(async () => {
    if (!portalAccess || !checklistsModuleActive) return;
    const codigosActivos = ordenes
      .filter((ot) => ot.codigo_activo)
      .map((ot) => ot.codigo_activo!);

    if (codigosActivos.length === 0) {
      setChecklists([]);
      return;
    }

    try {
      const codigosParam = codigosActivos.map((c) => `"${c}"`).join(",");
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/checklist_bms?empresa_id=eq.${portalAccess.empresa_id}&codigo_activo=in.(${codigosParam})&order=fecha_creacion.desc&limit=50`,
        {
          headers: {
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${SUPABASE_KEY}`,
            "Content-Type": "application/json",
          },
        }
      );
      if (res.ok) {
        const data = await res.json();
        setChecklists(data || []);
      }
    } catch {
      setChecklists([]);
    }
  }, [portalAccess, ordenes, checklistsModuleActive]);

  useEffect(() => {
    if (activeTab === "checklists" && checklistsModuleActive) {
      loadAllChecklists();
    }
  }, [activeTab, loadAllChecklists, checklistsModuleActive]);

  // Cargar tickets del cliente
  const loadTickets = useCallback(async () => {
    if (!token) return;
    setLoadingTickets(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_portal_tickets`, {
        method: "POST",
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ p_token: token }),
      });
      if (res.ok) {
        const data = await res.json();
        setTickets(data || []);
      }
    } catch {
      setTickets([]);
    } finally {
      setLoadingTickets(false);
    }
  }, [token]);

  useEffect(() => {
    if (activeTab === "tickets") {
      loadTickets();
    }
  }, [activeTab, loadTickets]);

  async function handleCrearTicket() {
    if (!token) return;
    if (!ticketTitulo.trim() || !ticketRegion || !ticketDescripcion.trim()) {
      toast({
        title: "Campos requeridos",
        description: "Completa el título, la región y la descripción del ticket.",
        variant: "destructive",
      });
      return;
    }

    setSubmittingTicket(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/crear_ticket_portal`, {
        method: "POST",
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          p_token: token,
          p_titulo: ticketTitulo.trim(),
          p_descripcion: ticketDescripcion.trim(),
          p_region: ticketRegion,
          p_direccion: ticketDireccion.trim(),
        }),
      });

      if (!res.ok) {
        toast({
          title: "Error",
          description: "No se pudo crear el ticket. Intenta nuevamente.",
          variant: "destructive",
        });
        return;
      }

      toast({ title: "Ticket creado", description: "Tu solicitud fue enviada correctamente." });
      setTicketTitulo("");
      setTicketRegion("");
      setTicketDireccion("");
      setTicketDescripcion("");
      setTicketDialogOpen(false);
      await loadTickets();
    } catch {
      toast({
        title: "Error de conexión",
        description: "No se pudo enviar el ticket. Revisa tu conexión.",
        variant: "destructive",
      });
    } finally {
      setSubmittingTicket(false);
    }
  }

  const primaryColor = empresa?.color_primario || "#2563eb";
  const secondaryColor = empresa?.color_secundario || "#0f172a";

  // --- LOADING STATE ---
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          <p className="text-sm text-gray-500">Validando acceso...</p>
        </div>
      </div>
    );
  }

  // --- ERROR STATE ---
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-red-50 p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center space-y-4">
            <AlertTriangle className="w-12 h-12 text-red-500 mx-auto" />
            <h2 className="text-xl font-bold text-gray-800">Acceso Denegado</h2>
            <p className="text-gray-600">{error}</p>
            <p className="text-sm text-gray-400">
              Si crees que esto es un error, contacta a tu proveedor de servicios.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // --- OT DETAIL VIEW ---
  if (selectedOT) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
        {/* Header */}
        <header className="text-white sticky top-0 z-30 shadow-lg" style={{ backgroundColor: secondaryColor }}>
          <div className="flex items-center justify-between px-4 py-3 max-w-4xl mx-auto">
            <button
              onClick={() => setSelectedOT(null)}
              className="flex items-center gap-2 p-2 rounded-lg hover:bg-white/10 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="text-sm">Volver</span>
            </button>
            <div className="flex items-center gap-2">
              {empresa?.logo_url && (
                <img src={empresa.logo_url} alt="" className="w-7 h-7 rounded object-contain bg-white/10" />
              )}
              <span className="font-bold text-sm">OT #{selectedOT.numero}</span>
            </div>
            <Badge className={`${estadoColors[selectedOT.estado]} text-white text-xs`}>
              {estadoLabels[selectedOT.estado] || selectedOT.estado}
            </Badge>
          </div>
        </header>

        <main className="max-w-4xl mx-auto p-4 space-y-4">
          {/* Info principal */}
          <Card>
            <CardContent className="pt-5 space-y-3">
              <h2 className="text-lg font-bold text-gray-800">{selectedOT.descripcion}</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div className="flex items-center gap-2 text-gray-600">
                  <MapPin className="w-4 h-4 shrink-0" style={{ color: primaryColor }} />
                  <span>{selectedOT.direccion || "Sin dirección"}</span>
                </div>
                <div className="flex items-center gap-2 text-gray-600">
                  <User className="w-4 h-4 shrink-0" style={{ color: primaryColor }} />
                  <span>{selectedOT.tecnico_nombre || "Sin asignar"}</span>
                </div>
                <div className="flex items-center gap-2 text-gray-600">
                  <Calendar className="w-4 h-4 shrink-0" style={{ color: primaryColor }} />
                  <span>Inicio: {new Date(selectedOT.fecha_inicio).toLocaleDateString("es-CL")}</span>
                </div>
                {selectedOT.fecha_cierre && (
                  <div className="flex items-center gap-2 text-gray-600">
                    <Clock className="w-4 h-4 shrink-0" style={{ color: primaryColor }} />
                    <span>Cierre: {new Date(selectedOT.fecha_cierre).toLocaleDateString("es-CL")}</span>
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-2 pt-2">
                <Badge variant="outline">{selectedOT.tipo_serv || "General"}</Badge>
                <Badge variant="outline" className="capitalize">Prioridad: {selectedOT.prioridad}</Badge>
              </div>
            </CardContent>
          </Card>

          {/* Notas */}
          {selectedOT.notas && (
            <Card>
              <CardContent className="pt-5">
                <h3 className="font-semibold text-gray-700 mb-2 flex items-center gap-2">
                  <FileText className="w-4 h-4" style={{ color: primaryColor }} />
                  Notas
                </h3>
                <p className="text-sm text-gray-600 whitespace-pre-wrap">{selectedOT.notas}</p>
              </CardContent>
            </Card>
          )}

          {/* Fotos */}
          {selectedOT.foto_url && selectedOT.foto_url.length > 0 && (
            <Card>
              <CardContent className="pt-5">
                <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <Camera className="w-4 h-4" style={{ color: primaryColor }} />
                  Evidencia Fotográfica ({selectedOT.foto_url.length})
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {selectedOT.foto_url.map((url, i) => (
                    <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                      <img
                        src={url}
                        alt={`Foto ${i + 1}`}
                        className="w-full h-32 object-cover rounded-lg border hover:opacity-80 transition-opacity"
                      />
                    </a>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Firma del cliente */}
          {selectedOT.firma_cliente_url && (
            <Card>
              <CardContent className="pt-5">
                <h3 className="font-semibold text-gray-700 mb-3">Firma del Cliente</h3>
                <div className="bg-white border rounded-lg p-2 inline-block">
                  <img src={selectedOT.firma_cliente_url} alt="Firma" className="h-20 object-contain" />
                </div>
                {selectedOT.firma_por && (
                  <p className="text-xs text-gray-500 mt-1">Firmado por: {selectedOT.firma_por}</p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Materiales */}
          {loadingDetail ? (
            <Card>
              <CardContent className="pt-5 flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
              </CardContent>
            </Card>
          ) : materiales.length > 0 && (
            <Card>
              <CardContent className="pt-5">
                <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <Package className="w-4 h-4" style={{ color: primaryColor }} />
                  Materiales Utilizados ({materiales.length})
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-gray-500">
                        <th className="pb-2">Material</th>
                        <th className="pb-2">Categoría</th>
                        <th className="pb-2 text-right">Cantidad</th>
                        <th className="pb-2">Unidad</th>
                      </tr>
                    </thead>
                    <tbody>
                      {materiales.map((m) => (
                        <tr key={m.id} className="border-b last:border-0">
                          <td className="py-2 font-medium">{m.nombre}</td>
                          <td className="py-2 capitalize text-gray-500">{m.categoria}</td>
                          <td className="py-2 text-right">{m.cantidad}</td>
                          <td className="py-2 text-gray-500">{m.unidad}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Checklists asociados */}
          {checklistsModuleActive && checklists.length > 0 && (
            <Card>
              <CardContent className="pt-5">
                <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <ClipboardCheck className="w-4 h-4" style={{ color: primaryColor }} />
                  Checklists Asociados ({checklists.length})
                </h3>
                <div className="space-y-2">
                  {checklists.map((cl) => (
                    <div key={cl.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <p className="text-sm font-medium">{cl.numero_interno || cl.tipo}</p>
                        <p className="text-xs text-gray-500">
                          {new Date(cl.fecha_creacion).toLocaleDateString("es-CL")} — {cl.tecnico_nombre}
                        </p>
                      </div>
                      <Badge
                        variant="outline"
                        className={
                          cl.resultado_general === "conforme"
                            ? "border-green-500 text-green-700"
                            : cl.resultado_general === "con_observaciones"
                            ? "border-amber-500 text-amber-700"
                            : "border-red-500 text-red-700"
                        }
                      >
                        {cl.resultado_general === "conforme"
                          ? "Conforme"
                          : cl.resultado_general === "con_observaciones"
                          ? "Con Obs."
                          : "No Conforme"}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </main>
      </div>
    );
  }

  // --- MAIN PORTAL VIEW ---
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Header */}
      <header className="text-white sticky top-0 z-30 shadow-lg" style={{ backgroundColor: secondaryColor }}>
        <div className="flex items-center justify-between px-4 py-3 max-w-4xl mx-auto">
          <div className="flex items-center gap-2">
            {empresa?.logo_url ? (
              <img src={empresa.logo_url} alt={empresa.nombre} className="w-8 h-8 rounded object-contain bg-white/10" />
            ) : (
              <ClipboardList className="w-5 h-5" style={{ color: primaryColor }} />
            )}
            <div>
              <h1 className="text-base font-bold">{empresa?.nombre || "Portal"}</h1>
              <p className="text-xs text-white/70">Portal de Cliente</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm font-medium">{portalAccess?.nombre_cliente}</p>
            {portalAccess?.email_cliente && (
              <p className="text-xs text-white/60">{portalAccess.email_cliente}</p>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4 space-y-4">
        {/* Tabs */}
        <div className="flex gap-2 border-b pb-3">
          <button
            onClick={() => setActiveTab("ordenes")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === "ordenes"
                ? "text-white shadow-md"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
            style={activeTab === "ordenes" ? { backgroundColor: primaryColor } : undefined}
          >
            <ClipboardList className="w-4 h-4" />
            Órdenes de Trabajo
          </button>
          {checklistsModuleActive && (
            <button
              onClick={() => setActiveTab("checklists")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === "checklists"
                  ? "text-white shadow-md"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
              style={activeTab === "checklists" ? { backgroundColor: primaryColor } : undefined}
            >
              <ClipboardCheck className="w-4 h-4" />
              Checklists
            </button>
          )}
          <button
            onClick={() => setActiveTab("tickets")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === "tickets"
                ? "text-white shadow-md"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
            style={activeTab === "tickets" ? { backgroundColor: primaryColor } : undefined}
          >
            <TicketIcon className="w-4 h-4" />
            Tickets
          </button>
        </div>

        {/* Stats */}
        {activeTab === "ordenes" && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Card className="text-center">
                <CardContent className="pt-4 pb-3">
                  <p className="text-2xl font-bold" style={{ color: primaryColor }}>{ordenes.length}</p>
                  <p className="text-xs text-gray-500">Total OTs</p>
                </CardContent>
              </Card>
              <Card className="text-center">
                <CardContent className="pt-4 pb-3">
                  <p className="text-2xl font-bold text-amber-500">
                    {ordenes.filter((o) => o.estado === "pendiente").length}
                  </p>
                  <p className="text-xs text-gray-500">Pendientes</p>
                </CardContent>
              </Card>
              <Card className="text-center">
                <CardContent className="pt-4 pb-3">
                  <p className="text-2xl font-bold text-sky-500">
                    {ordenes.filter((o) => o.estado === "en_curso").length}
                  </p>
                  <p className="text-xs text-gray-500">En Curso</p>
                </CardContent>
              </Card>
              <Card className="text-center">
                <CardContent className="pt-4 pb-3">
                  <p className="text-2xl font-bold text-green-500">
                    {ordenes.filter((o) => o.estado === "completada").length}
                  </p>
                  <p className="text-xs text-gray-500">Completadas</p>
                </CardContent>
              </Card>
            </div>

            {/* Filtros */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Buscar por número, descripción o dirección..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={estadoFilter} onValueChange={setEstadoFilter}>
                <SelectTrigger className="w-full sm:w-44">
                  <SelectValue placeholder="Filtrar estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="pendiente">Pendiente</SelectItem>
                  <SelectItem value="en_curso">En Curso</SelectItem>
                  <SelectItem value="en_revision">En Revisión</SelectItem>
                  <SelectItem value="completada">Completada</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Lista de OTs */}
            {filteredOrdenes.length === 0 ? (
              <Card>
                <CardContent className="pt-6 text-center py-12">
                  <ClipboardList className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">No se encontraron órdenes de trabajo</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {filteredOrdenes.map((ot) => (
                  <Card
                    key={ot.id}
                    className="cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => loadOTDetail(ot)}
                  >
                    <CardContent className="pt-4 pb-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-mono text-gray-400">#{ot.numero}</span>
                            <Badge className={`${estadoColors[ot.estado]} text-white text-[10px] px-1.5 py-0`}>
                              {estadoLabels[ot.estado] || ot.estado}
                            </Badge>
                          </div>
                          <p className="font-medium text-gray-800 truncate">{ot.descripcion}</p>
                          <div className="flex flex-wrap items-center gap-3 mt-1.5 text-xs text-gray-500">
                            {ot.direccion && (
                              <span className="flex items-center gap-1">
                                <MapPin className="w-3 h-3" />
                                {ot.direccion}
                              </span>
                            )}
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {new Date(ot.fecha_inicio).toLocaleDateString("es-CL")}
                            </span>
                          </div>
                        </div>
                        <Button variant="ghost" size="sm" className="shrink-0">
                          <Eye className="w-4 h-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}

        {/* Tab Checklists */}
        {activeTab === "checklists" && checklistsModuleActive && (
          <div>
            {checklists.length === 0 ? (
              <Card>
                <CardContent className="pt-6 text-center py-12">
                  <ClipboardCheck className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">No hay checklists asociados a sus equipos</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {checklists.map((cl) => (
                  <Card key={cl.id}>
                    <CardContent className="pt-4 pb-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-mono text-gray-400">{cl.numero_interno}</span>
                            <Badge variant="outline" className="text-[10px]">{cl.tipo}</Badge>
                          </div>
                          <p className="text-sm font-medium text-gray-800">
                            {cl.especialidad || cl.tipo}
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {new Date(cl.fecha_creacion).toLocaleDateString("es-CL")} — {cl.tecnico_nombre}
                          </p>
                        </div>
                        <Badge
                          className={
                            cl.resultado_general === "conforme"
                              ? "bg-green-100 text-green-700 hover:bg-green-100"
                              : cl.resultado_general === "con_observaciones"
                              ? "bg-amber-100 text-amber-700 hover:bg-amber-100"
                              : "bg-red-100 text-red-700 hover:bg-red-100"
                          }
                        >
                          {cl.resultado_general === "conforme"
                            ? "✓ Conforme"
                            : cl.resultado_general === "con_observaciones"
                            ? "⚠ Con Obs."
                            : "✗ No Conforme"}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab Tickets */}
        {activeTab === "tickets" && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <Button
                onClick={() => setTicketDialogOpen(true)}
                className="gap-2 text-white"
                style={{ backgroundColor: primaryColor }}
              >
                <Plus className="w-4 h-4" />
                Nuevo Ticket
              </Button>
            </div>

            {loadingTickets ? (
              <Card>
                <CardContent className="pt-5 flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                </CardContent>
              </Card>
            ) : tickets.length === 0 ? (
              <Card>
                <CardContent className="pt-6 text-center py-12">
                  <TicketIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">Aún no has creado tickets</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {tickets.map((t) => {
                  const otMatch = t.ot_id
                    ? ordenes.find((o) => String(o.id) === String(t.ot_id))
                    : undefined;
                  return (
                    <Card key={t.id}>
                      <CardContent className="pt-4 pb-4 space-y-2">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-gray-800">{t.titulo}</p>
                            <p className="text-sm text-gray-600 mt-1 whitespace-pre-wrap">
                              {t.descripcion}
                            </p>
                            {(t.region || t.direccion) && (
                              <p className="flex items-center gap-1 text-xs text-gray-500 mt-1.5">
                                <MapPin className="w-3 h-3 shrink-0" style={{ color: primaryColor }} />
                                {[getRegionTicketLabel(t.region), t.direccion].filter(Boolean).join(" — ")}
                              </p>
                            )}
                          </div>
                          <Badge
                            className={`${ticketEstadoColors[t.estado]} text-white text-[10px] px-1.5 py-0 shrink-0`}
                          >
                            {ticketEstadoLabels[t.estado] || t.estado}
                          </Badge>
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t">
                          <span className="flex items-center gap-1 text-xs text-gray-400">
                            <Calendar className="w-3 h-3" />
                            {new Date(t.creado_en).toLocaleDateString("es-CL")}
                          </span>
                          {t.ot_id &&
                            (otMatch ? (
                              <button
                                onClick={() => loadOTDetail(otMatch)}
                                className="text-xs font-medium hover:underline"
                                style={{ color: primaryColor }}
                              >
                                Convertido a OT #{otMatch.numero}
                              </button>
                            ) : (
                              <span className="text-xs text-gray-500">Convertido a OT</span>
                            ))}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Dialog Nuevo Ticket */}
        <Dialog open={ticketDialogOpen} onOpenChange={setTicketDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nuevo Ticket</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="ticket-titulo">Título</Label>
                <Input
                  id="ticket-titulo"
                  value={ticketTitulo}
                  onChange={(e) => setTicketTitulo(e.target.value)}
                  placeholder="Resumen breve del problema o solicitud"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ticket-region">Región</Label>
                <Select value={ticketRegion} onValueChange={setTicketRegion}>
                  <SelectTrigger id="ticket-region">
                    <SelectValue placeholder="Selecciona una región" />
                  </SelectTrigger>
                  <SelectContent>
                    {REGIONES_TICKET.map((r) => (
                      <SelectItem key={r.value} value={r.value}>
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ticket-direccion">Dirección (opcional)</Label>
                <Input
                  id="ticket-direccion"
                  value={ticketDireccion}
                  onChange={(e) => setTicketDireccion(e.target.value)}
                  placeholder="Dirección relacionada con la solicitud"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ticket-descripcion">Descripción</Label>
                <Textarea
                  id="ticket-descripcion"
                  value={ticketDescripcion}
                  onChange={(e) => setTicketDescripcion(e.target.value)}
                  placeholder="Describe el detalle de tu solicitud"
                  rows={5}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setTicketDialogOpen(false)}
                disabled={submittingTicket}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleCrearTicket}
                disabled={submittingTicket}
                className="text-white"
                style={{ backgroundColor: primaryColor }}
              >
                {submittingTicket ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  "Enviar Ticket"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Footer */}
        <div className="text-center pt-8 pb-4">
          <p className="text-xs text-gray-400">
            Portal de Cliente — {empresa?.nombre} © {new Date().getFullYear()}
          </p>
        </div>
      </main>
    </div>
  );
}