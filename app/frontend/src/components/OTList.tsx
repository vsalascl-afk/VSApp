import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import type { OrdenTrabajo, Usuario } from "@/lib/types";
import { SUPABASE_URL, SUPABASE_KEY, supabase } from "@/lib/supabase";
import { getRegionLabel } from "@/lib/regiones";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogFooter,
  DialogHeader,
  DialogDescription,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowRight,
  CheckCircle,
  Image as ImageIcon,
  Pen,
  Eraser,
  Save,
  FileDown,
  Loader2,
  Search,
  X,
  Edit,
  Camera,
  UserCheck,
  Trash2,
  Package,
} from "lucide-react";
import SignaturePad from "signature_pad";
import { exportOTPDF, type MaterialPDF } from "@/lib/exportPDF";

interface OTListProps {
  user: Usuario;
  token: string;
  refreshKey: number;
}

interface EditFormData {
  cliente: string;
  descripcion: string;
  direccion: string;
  tipo_serv: string;
  prioridad: "baja" | "media" | "alta";
  estado: "pendiente" | "en_curso" | "en_revision" | "completada";
  notas: string;
  tecnico_id: string;
  firma_por: string;
}

interface TecnicoOption {
  auth_id: string;
  nombre: string;
  rol?: string;
  region?: string;
}

const estadoColors: Record<string, string> = {
  pendiente: "bg-amber-500 hover:bg-amber-600",
  en_curso: "bg-sky-500 hover:bg-sky-600",
  en_revision: "bg-purple-500 hover:bg-purple-600",
  completada: "bg-green-500 hover:bg-green-600",
};

const estadoLabels: Record<string, string> = {
  pendiente: "Pendiente",
  en_curso: "En Curso",
  en_revision: "En Revisión",
  completada: "Completada",
};

const prioridadColors: Record<string, string> = {
  baja: "bg-slate-400",
  media: "bg-orange-400",
  alta: "bg-red-500",
};

interface MaterialAsignado {
  id: string;
  catalogo_item_id: string;
  ot_id: string;
  cantidad: number;
  notas: string;
  asignado_por: string;
  created_at: string;
  // Joined from catalogo_inventario
  nombre?: string;
  unidad?: string;
  costo_unitario?: number;
  categoria?: string;
}

// SLA por prioridad (en horas)
const SLA_HORAS: Record<string, number> = {
  alta: 24,
  media: 48,
  baja: 72,
};

function calcularSLA(ot: OrdenTrabajo): { horasRestantes: number; porcentaje: number; vencida: boolean; texto: string } | null {
  if (ot.estado === "completada") return null;
  const inicio = new Date(ot.fecha_inicio);
  if (isNaN(inicio.getTime())) return null;
  const slaHoras = SLA_HORAS[ot.prioridad] || 72;
  const ahora = new Date();
  const transcurridas = (ahora.getTime() - inicio.getTime()) / (1000 * 60 * 60);
  const restantes = slaHoras - transcurridas;
  const porcentaje = Math.min(100, Math.max(0, (transcurridas / slaHoras) * 100));
  const vencida = restantes <= 0;
  let texto = "";
  if (vencida) {
    const horasVencidas = Math.abs(Math.round(restantes));
    texto = `Vencida hace ${horasVencidas}h`;
  } else if (restantes < 4) {
    texto = `⚠️ ${Math.round(restantes)}h restantes`;
  } else {
    texto = `${Math.round(restantes)}h restantes`;
  }
  return { horasRestantes: restantes, porcentaje, vencida, texto };
}

export default function OTList({ user, token, refreshKey }: OTListProps) {
  const [ordenes, setOrdenes] = useState<OrdenTrabajo[]>([]);
  const [filtroEstado, setFiltroEstado] = useState("todos");
  const [loading, setLoading] = useState(true);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [materialesPorOT, setMaterialesPorOT] = useState<Record<string, MaterialAsignado[]>>({});
  const [editingOT, setEditingOT] = useState<OrdenTrabajo | null>(null);
  // Estado para diálogo de devolución con observaciones
  const [devolucionOT, setDevolucionOT] = useState<OrdenTrabajo | null>(null);
  const [devolucionMotivo, setDevolucionMotivo] = useState("");
  const [editForm, setEditForm] = useState<EditFormData>({
    cliente: "",
    descripcion: "",
    direccion: "",
    tipo_serv: "",
    prioridad: "baja",
    estado: "pendiente",
    notas: "",
    tecnico_id: "",
    firma_por: "",
  });
  const [saving, setSaving] = useState(false);
  const [editTecnicos, setEditTecnicos] = useState<TecnicoOption[]>([]);

  const canReassign = user.rol === "superadmin" || user.rol === "admin" || user.rol === "supervisor";
  const [uploadingPhotoId, setUploadingPhotoId] = useState<string | null>(null);
  const photoInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const { toast } = useToast();
  const signatureRefs = useRef<Record<string, SignaturePad | null>>({});
  const canvasRefs = useRef<Record<string, HTMLCanvasElement | null>>({});

  const fetchEditTecnicos = useCallback(async () => {
    if (!canReassign) return;
    try {
      const serviceKey = import.meta.env.VITE_SUPABASE_SERVICE_KEY;
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/usuarios?empresa_id=eq.${user.empresa_id}&select=auth_id,nombre,rol,region&order=nombre.asc`,
        {
          headers: {
            apikey: serviceKey || SUPABASE_KEY,
            Authorization: `Bearer ${serviceKey || token}`,
            "Content-Type": "application/json",
          },
        }
      );
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          const tecList: TecnicoOption[] = data
            .filter((u: { auth_id?: string; nombre?: string; rol?: string; region?: string }) =>
              u.auth_id && u.nombre &&
              (u.rol === "tecnico" || u.rol === "supervisor") &&
              (!user.region || !u.region || u.region === user.region)
            )
            .map((u: { auth_id: string; nombre: string; rol?: string; region?: string }) => ({
              auth_id: u.auth_id,
              nombre: u.nombre,
              rol: u.rol,
              region: u.region,
            }));
          setEditTecnicos(tecList);
        }
      }
    } catch {
      // Silently ignore
    }
  }, [canReassign, user.empresa_id, user.region, token]);

  const openEditDialog = (ot: OrdenTrabajo) => {
    setEditingOT(ot);
    setEditForm({
      cliente: ot.cliente || "",
      descripcion: ot.descripcion || "",
      direccion: ot.direccion || "",
      tipo_serv: ot.tipo_serv || "",
      prioridad: ot.prioridad,
      estado: ot.estado,
      notas: ot.notas || "",
      tecnico_id: ot.tecnico_id || "",
      firma_por: ot.firma_por || "",
    });
    if (canReassign) {
      fetchEditTecnicos();
    }
  };

  const closeEditDialog = () => {
    setEditingOT(null);
  };

  const handleEditSave = async () => {
    if (!editingOT) return;

    if (!editForm.cliente.trim() || !editForm.descripcion.trim()) {
      toast({
        title: "Campos requeridos",
        description: "Cliente y descripción son obligatorios",
        variant: "destructive",
      });
      return;
    }

    // Técnicos no pueden pasar a completada desde el diálogo de edición
    if (editForm.estado === "completada" && user.rol === "tecnico") {
      toast({
        title: "Acción no permitida",
        description: "Solo supervisores y administradores pueden aprobar y cerrar una OT",
        variant: "destructive",
      });
      return;
    }

    // Validate before completing or sending to review via edit dialog
    if (
      (editForm.estado === "completada" || editForm.estado === "en_revision") &&
      editingOT.estado !== "completada" &&
      editingOT.estado !== "en_revision"
    ) {
      const error = validarCompletarOT(editingOT);
      if (error) {
        toast({
          title: editForm.estado === "en_revision"
            ? "No se puede enviar a revisión"
            : "No se puede finalizar la OT",
          description: error,
          variant: "destructive",
        });
        return;
      }
    }

    setSaving(true);

    try {
      const body: Record<string, string> = {
        cliente: editForm.cliente,
        descripcion: editForm.descripcion,
        direccion: editForm.direccion,
        tipo_serv: editForm.tipo_serv,
        prioridad: editForm.prioridad,
        estado: editForm.estado,
        notas: editForm.notas,
        firma_por: editForm.firma_por,
      };

      // Include tecnico_id if supervisor/admin is reassigning
      if (canReassign && editForm.tecnico_id) {
        body.tecnico_id = editForm.tecnico_id;
        const tecnicoNombre = editTecnicos.find((t) => t.auth_id === editForm.tecnico_id)?.nombre;
        if (tecnicoNombre) {
          body.tecnico_nombre = tecnicoNombre;
        }
      }

      // If changing to completada, add closure fields
      if (
        editForm.estado === "completada" &&
        editingOT.estado !== "completada"
      ) {
        body.fecha_cierre = new Date().toISOString();
        body.completado_por = user.nombre || "Usuario";
      }

      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/ordenes_trabajo?id=eq.${editingOT.id}`,
        {
          method: "PATCH",
          headers: {
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            Prefer: "return=representation",
          },
          body: JSON.stringify(body),
        }
      );

      if (!res.ok) {
        const errText = await res.text();
        let errorMsg = "No se pudo actualizar la OT";
        try {
          const errJson = JSON.parse(errText);
          errorMsg = errJson.message || errJson.error || errorMsg;
        } catch {
          if (errText) errorMsg = errText;
        }
        toast({
          title: "Error",
          description: errorMsg,
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "OT actualizada",
        description: `${editingOT.numero} se ha actualizado correctamente`,
      });
      closeEditDialog();
      fetchOrdenes();
    } catch {
      toast({
        title: "Error",
        description: "Error de conexión al guardar",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const fetchOrdenes = useCallback(async () => {
    setLoading(true);

    let filtro: string;
    if (user.rol === "tecnico") {
      filtro = `?tecnico_id=eq.${user.auth_id}`;
    } else if (user.rol === "superadmin") {
      filtro = `?empresa_id=eq.${user.empresa_id}`;
    } else {
      filtro = `?empresa_id=eq.${user.empresa_id}`;
    }

    if (filtroEstado !== "todos") {
      filtro += `&estado=eq.${filtroEstado}`;
    }

    filtro += "&order=fecha_inicio.desc";

    try {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/ordenes_trabajo${filtro}`,
        {
          headers: {
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );
      const data = await res.json();
      const rawOts: OrdenTrabajo[] = Array.isArray(data) ? data : [];
      // Ensure foto_url is always an array (Supabase may return string for jsonb/text[])
      const ots = rawOts.map((ot) => ({
        ...ot,
        foto_url: Array.isArray(ot.foto_url)
          ? ot.foto_url
          : typeof ot.foto_url === "string" && ot.foto_url
            ? [ot.foto_url]
            : [],
      }));

      // Fetch all technicians from the same company to resolve names
      const tecnicoMap: Record<string, string> = {};
      try {
        const tecRes = await fetch(
          `${SUPABASE_URL}/rest/v1/usuarios?empresa_id=eq.${user.empresa_id}&select=id,auth_id,nombre`,
          {
            headers: {
              apikey: SUPABASE_KEY,
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          }
        );
        const tecData = await tecRes.json();
        if (Array.isArray(tecData)) {
          for (const t of tecData) {
            if (t.auth_id) tecnicoMap[t.auth_id] = t.nombre;
            if (t.id) tecnicoMap[t.id] = t.nombre;
          }
        }
      } catch {
        // Silently ignore – RLS may block this query
        // At minimum, map the current user
      }
      // Always ensure current user is in the map
      if (user.auth_id) tecnicoMap[user.auth_id] = user.nombre;
      if (user.id) tecnicoMap[user.id] = user.nombre;

      // Enrich OTs with technician name from map
      const enriched = ots.map((ot) => ({
        ...ot,
        tecnico_nombre: ot.tecnico_nombre || tecnicoMap[ot.tecnico_id] || "",
      }));

      setOrdenes(enriched);
    } catch {
      toast({
        title: "Error",
        description: "No se pudieron cargar las OTs",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [user, token, filtroEstado, toast]);

  useEffect(() => {
    fetchOrdenes();
  }, [fetchOrdenes, refreshKey]);

  // ─── Cargar materiales asignados por OT ──────────────────────────────────
  const fetchMaterialesAsignados = useCallback(async (ots: OrdenTrabajo[]) => {
    if (ots.length === 0) return;
    const serviceKey = import.meta.env.VITE_SUPABASE_SERVICE_KEY;
    const otIds = ots.map((ot) => String(ot.id));
    
    try {
      // Fetch all assignments for these OTs
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/inventario_ot_asignacion?ot_id=in.(${otIds.map(id => `"${id}"`).join(",")})&empresa_id=eq.${user.empresa_id}&order=created_at.desc`,
        {
          headers: {
            apikey: serviceKey || SUPABASE_KEY,
            Authorization: `Bearer ${serviceKey || token}`,
            "Content-Type": "application/json",
          },
        }
      );
      if (!res.ok) return;
      const asignaciones = await res.json();
      if (!Array.isArray(asignaciones) || asignaciones.length === 0) {
        setMaterialesPorOT({});
        return;
      }

      // Get unique catalogo_item_ids to fetch names/costs
      const itemIds = [...new Set(asignaciones.map((a: { catalogo_item_id: string }) => a.catalogo_item_id))];
      const catalogoRes = await fetch(
        `${SUPABASE_URL}/rest/v1/catalogo_inventario?id=in.(${itemIds.map(id => `"${id}"`).join(",")})&select=id,nombre,unidad,costo_unitario,categoria`,
        {
          headers: {
            apikey: serviceKey || SUPABASE_KEY,
            Authorization: `Bearer ${serviceKey || token}`,
            "Content-Type": "application/json",
          },
        }
      );
      
      const catalogoMap: Record<string, { nombre: string; unidad: string; costo_unitario: number; categoria: string }> = {};
      if (catalogoRes.ok) {
        const catalogoData = await catalogoRes.json();
        if (Array.isArray(catalogoData)) {
          for (const item of catalogoData) {
            catalogoMap[item.id] = {
              nombre: item.nombre || "Sin nombre",
              unidad: item.unidad || "unidad",
              costo_unitario: item.costo_unitario || 0,
              categoria: item.categoria || "material",
            };
          }
        }
      }

      // Group by ot_id and enrich with catalog data
      const grouped: Record<string, MaterialAsignado[]> = {};
      for (const asig of asignaciones) {
        const otId = String(asig.ot_id);
        if (!grouped[otId]) grouped[otId] = [];
        const catInfo = catalogoMap[asig.catalogo_item_id];
        grouped[otId].push({
          ...asig,
          nombre: catInfo?.nombre || "Ítem eliminado",
          unidad: catInfo?.unidad || "unidad",
          costo_unitario: catInfo?.costo_unitario || 0,
          categoria: catInfo?.categoria || "material",
        });
      }
      setMaterialesPorOT(grouped);
    } catch {
      // Silently ignore - table may not exist yet
    }
  }, [user.empresa_id, token]);

  // Load materials when ordenes change
  useEffect(() => {
    if (ordenes.length > 0) {
      fetchMaterialesAsignados(ordenes);
    }
  }, [ordenes, fetchMaterialesAsignados]);

  // Determine if user can see costs (supervisor, admin, superadmin)
  const canSeeCosts = user.rol === "superadmin" || user.rol === "admin" || user.rol === "supervisor";

  // Note: SignaturePad initialization is handled directly in the canvas ref callback
  // This ensures the pad is always properly connected to the current canvas element,
  // even after re-renders triggered by photo uploads or state changes.

  const validarCompletarOT = (ot: OrdenTrabajo): string | null => {
    const fotos = Array.isArray(ot.foto_url) ? ot.foto_url : [];
    const tieneFirma = !!ot.firma_cliente_url;
    const mensajes: string[] = [];

    if (fotos.length < 2) {
      mensajes.push(`Se requieren al menos 2 fotos (actualmente tiene ${fotos.length})`);
    }
    if (!tieneFirma) {
      mensajes.push("Se requiere la firma del cliente");
    }

    return mensajes.length > 0 ? mensajes.join(". ") : null;
  };

  // Función para devolver OT con motivo (desde diálogo)
  const devolverOTConMotivo = async () => {
    if (!devolucionOT) return;
    const motivo = devolucionMotivo.trim();
    setDevolucionOT(null);
    setDevolucionMotivo("");
    await cambiarEstado(devolucionOT.id, "en_curso", motivo || undefined);
  };

  const cambiarEstado = async (
    id: string,
    nuevoEstado: "en_curso" | "en_revision" | "completada",
    motivoDevolucion?: string
  ) => {
    // Validar requisitos antes de enviar a revisión o completar
    if (nuevoEstado === "en_revision" || nuevoEstado === "completada") {
      const ot = ordenes.find((o) => o.id === id);
      if (ot) {
        const error = validarCompletarOT(ot);
        if (error) {
          toast({
            title: nuevoEstado === "en_revision"
              ? "No se puede enviar a revisión"
              : "No se puede finalizar la OT",
            description: error,
            variant: "destructive",
          });
          return;
        }
      }
    }

    // Solo supervisores/admins pueden aprobar (pasar a completada)
    if (nuevoEstado === "completada" && user.rol === "tecnico") {
      toast({
        title: "Acción no permitida",
        description: "Solo supervisores y administradores pueden aprobar y cerrar una OT",
        variant: "destructive",
      });
      return;
    }

    const body: Record<string, string> = { estado: nuevoEstado };
    if (nuevoEstado === "completada") {
      body.fecha_cierre = new Date().toISOString();
      body.completado_por = user.nombre || "Usuario";
    }

    try {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/ordenes_trabajo?id=eq.${id}`,
        {
          method: "PATCH",
          headers: {
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            Prefer: "return=representation",
          },
          body: JSON.stringify(body),
        }
      );

      if (!res.ok) {
        toast({
          title: "Error",
          description: "No se pudo actualizar el estado",
          variant: "destructive",
        });
        return;
      }

      // ─── Notificaciones por cambio de estado ───────────────────────────
      const ot = ordenes.find((o) => o.id === id);
      if (ot) {
        const serviceKey = import.meta.env.VITE_SUPABASE_SERVICE_KEY;
        const notifApiKey = serviceKey || SUPABASE_KEY;
        const notifAuthKey = serviceKey || token;
        const hoyStr = new Date().toISOString().split("T")[0];

        if (nuevoEstado === "en_revision") {
          // Técnico envía a revisión → notificar a supervisores/admins de la empresa
          try {
            const usersRes = await fetch(
              `${SUPABASE_URL}/rest/v1/usuarios?empresa_id=eq.${user.empresa_id}&select=id,rol,nombre`,
              {
                headers: {
                  apikey: notifApiKey,
                  Authorization: `Bearer ${notifAuthKey}`,
                },
              }
            );
            if (usersRes.ok) {
              const usuarios = await usersRes.json();
              const supervisores = usuarios.filter(
                (u: { id: string; rol: string }) =>
                  u.rol === "supervisor" || u.rol === "admin" || u.rol === "superadmin"
              );
              const notificaciones = supervisores.map((sup: { id: string }) => ({
                empresa_id: user.empresa_id,
                usuario_id: sup.id,
                tipo_alerta: "urgente",
                mensaje: `📋 OT "${ot.numero}" enviada a revisión por ${user.nombre || "Técnico"}. Cliente: ${ot.cliente || "N/A"} - ${ot.descripcion || "Sin descripción"}`,
                fecha_alerta: hoyStr,
                ot_id: ot.id,
              }));
              if (notificaciones.length > 0) {
                await fetch(`${SUPABASE_URL}/rest/v1/maintenance_notifications`, {
                  method: "POST",
                  headers: {
                    apikey: notifApiKey,
                    Authorization: `Bearer ${notifAuthKey}`,
                    "Content-Type": "application/json",
                    Prefer: "return=minimal",
                  },
                  body: JSON.stringify(notificaciones),
                });
              }
            }
          } catch {
            // Notificación no crítica, no bloquear el flujo
          }
        } else if (nuevoEstado === "en_curso" && ot.estado === "en_revision") {
          // Supervisor devuelve al técnico → notificar al técnico asignado
          try {
            if (ot.tecnico_id) {
              // Buscar el id interno del técnico por auth_id
              const tecRes = await fetch(
                `${SUPABASE_URL}/rest/v1/usuarios?empresa_id=eq.${user.empresa_id}&auth_id=eq.${ot.tecnico_id}&select=id,nombre`,
                {
                  headers: {
                    apikey: notifApiKey,
                    Authorization: `Bearer ${notifAuthKey}`,
                  },
                }
              );
              if (tecRes.ok) {
                const tecData = await tecRes.json();
                if (tecData && tecData.length > 0) {
                  const tecnicoInterno = tecData[0];
                  await fetch(`${SUPABASE_URL}/rest/v1/maintenance_notifications`, {
                    method: "POST",
                    headers: {
                      apikey: notifApiKey,
                      Authorization: `Bearer ${notifAuthKey}`,
                      "Content-Type": "application/json",
                      Prefer: "return=minimal",
                    },
                    body: JSON.stringify({
                      empresa_id: user.empresa_id,
                      usuario_id: tecnicoInterno.id,
                      tipo_alerta: "recordatorio",
                      mensaje: `🔄 OT "${ot.numero}" devuelta por ${user.nombre || "Supervisor"} para correcciones.${motivoDevolucion ? ` Motivo: "${motivoDevolucion}".` : ""} Por favor revisa y vuelve a enviar.`,
                      fecha_alerta: hoyStr,
                      ot_id: ot.id,
                    }),
                  });
                }
              }
            }
          } catch {
            // Notificación no crítica
          }
        } else if (nuevoEstado === "completada") {
          // Supervisor aprueba → notificar al técnico que su OT fue aprobada
          try {
            if (ot.tecnico_id) {
              const tecRes = await fetch(
                `${SUPABASE_URL}/rest/v1/usuarios?empresa_id=eq.${user.empresa_id}&auth_id=eq.${ot.tecnico_id}&select=id,nombre`,
                {
                  headers: {
                    apikey: notifApiKey,
                    Authorization: `Bearer ${notifAuthKey}`,
                  },
                }
              );
              if (tecRes.ok) {
                const tecData = await tecRes.json();
                if (tecData && tecData.length > 0) {
                  const tecnicoInterno = tecData[0];
                  await fetch(`${SUPABASE_URL}/rest/v1/maintenance_notifications`, {
                    method: "POST",
                    headers: {
                      apikey: notifApiKey,
                      Authorization: `Bearer ${notifAuthKey}`,
                      "Content-Type": "application/json",
                      Prefer: "return=minimal",
                    },
                    body: JSON.stringify({
                      empresa_id: user.empresa_id,
                      usuario_id: tecnicoInterno.id,
                      tipo_alerta: "informativa",
                      mensaje: `✅ OT "${ot.numero}" aprobada y cerrada por ${user.nombre || "Supervisor"}. ¡Buen trabajo!`,
                      fecha_alerta: hoyStr,
                      ot_id: ot.id,
                    }),
                  });
                }
              }
            }
          } catch {
            // Notificación no crítica
          }
        }
      }

      toast({
        title: "Actualizado",
        description: `Estado cambiado a ${estadoLabels[nuevoEstado]}`,
      });
      fetchOrdenes();
    } catch {
      toast({
        title: "Error",
        description: "Error de conexión",
        variant: "destructive",
      });
    }
  };

  const guardarFirma = async (otId: string) => {
    const pad = signatureRefs.current[otId];
    if (!pad || pad.isEmpty()) {
      toast({
        title: "Firma vacía",
        description: "Debe firmar antes de guardar",
        variant: "destructive",
      });
      return;
    }

    try {
      const dataURL = pad.toDataURL();
      const blob = await (await fetch(dataURL)).blob();
      const fileName = `firma_${otId}.png`;

      const { error } = await supabase.storage
        .from("firmas_ot")
        .upload(fileName, blob, { upsert: true });

      if (error) {
        toast({
          title: "Error",
          description: "Error subiendo firma",
          variant: "destructive",
        });
        return;
      }

      const { data } = supabase.storage
        .from("firmas_ot")
        .getPublicUrl(fileName);

      await supabase
        .from("ordenes_trabajo")
        .update({ firma_cliente_url: data.publicUrl })
        .eq("id", otId);

      toast({ title: "Firma guardada" });
      // Clean up signature pad reference
      signatureRefs.current[otId] = null;
      fetchOrdenes();
    } catch {
      toast({
        title: "Error",
        description: "Error guardando firma",
        variant: "destructive",
      });
    }
  };

  const limpiarFirma = (otId: string) => {
    signatureRefs.current[otId]?.clear();
  };

  const handleUploadPhoto = async (otId: string, file: File) => {
    setUploadingPhotoId(otId);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const fileName = `ot_${otId}_${Date.now()}.${ext}`;

      const { error } = await supabase.storage
        .from("fotos_ot")
        .upload(fileName, file, { upsert: false });

      if (error) {
        toast({
          title: "Error",
          description: "Error subiendo la foto: " + (error.message || ""),
          variant: "destructive",
        });
        return;
      }

      // Get current foto_url array from the OT
      const ot = ordenes.find((o) => o.id === otId);
      const currentPhotos = Array.isArray(ot?.foto_url) ? ot.foto_url : [];
      const updatedPhotos = [...currentPhotos, fileName];

      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/ordenes_trabajo?id=eq.${otId}`,
        {
          method: "PATCH",
          headers: {
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            Prefer: "return=representation",
          },
          body: JSON.stringify({ foto_url: updatedPhotos }),
        }
      );

      if (!res.ok) {
        toast({
          title: "Error",
          description: "No se pudo actualizar la OT con la foto",
          variant: "destructive",
        });
        return;
      }

      toast({ title: "Foto subida", description: "La foto se agregó correctamente" });
      fetchOrdenes();
    } catch {
      toast({
        title: "Error",
        description: "Error de conexión al subir la foto",
        variant: "destructive",
      });
    } finally {
      setUploadingPhotoId(null);
      // Reset the file input
      const input = photoInputRefs.current[otId];
      if (input) input.value = "";
    }
  };

  const handleExportPDF = async (ot: OrdenTrabajo) => {
    setExportingId(ot.id);
    try {
      // Preparar materiales sin costos para el PDF
      const mats = materialesPorOT[String(ot.id)];
      const materialesPDF: MaterialPDF[] | undefined = mats && mats.length > 0
        ? mats.map(m => ({
            nombre: m.nombre || "Sin nombre",
            cantidad: m.cantidad,
            unidad: m.unidad || "unid",
            categoria: m.categoria || undefined,
          }))
        : undefined;
      await exportOTPDF(ot, undefined, materialesPDF);
      toast({ title: "PDF exportado", description: `${ot.numero} descargado` });
    } catch {
      toast({
        title: "Error",
        description: "No se pudo generar el PDF",
        variant: "destructive",
      });
    } finally {
      setExportingId(null);
    }
  };

  const canDelete = user.rol === "superadmin" || user.rol === "admin";

  const handleDeleteOT = async (ot: OrdenTrabajo) => {
    const confirmed = window.confirm(
      `¿Estás seguro de que deseas eliminar la OT ${ot.numero}?\nEsta acción no se puede deshacer.`
    );
    if (!confirmed) return;

    try {
      const serviceKey = import.meta.env.VITE_SUPABASE_SERVICE_KEY;
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/ordenes_trabajo?id=eq.${ot.id}&empresa_id=eq.${user.empresa_id}`,
        {
          method: "DELETE",
          headers: {
            apikey: serviceKey || SUPABASE_KEY,
            Authorization: `Bearer ${serviceKey || token}`,
            "Content-Type": "application/json",
          },
        }
      );
      if (res.ok) {
        setOrdenes((prev) => prev.filter((o) => o.id !== ot.id));
        toast({
          title: "OT eliminada",
          description: `La orden ${ot.numero} fue eliminada correctamente`,
        });
      } else {
        const errData = await res.json().catch(() => null);
        toast({
          title: "Error al eliminar",
          description: errData?.message || "No se pudo eliminar la OT",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Error",
        description: "Error de conexión al intentar eliminar",
        variant: "destructive",
      });
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      if (!dateStr) return "";
      // Supabase may return timestamps in different formats:
      // - With timezone: "2026-06-16T20:00:00+00:00" or "2026-06-16T20:00:00Z"
      // - Without timezone: "2026-06-16 20:00:00" or "2026-06-16T20:00:00"
      // We store dates with toISOString() which is always UTC.
      // If no timezone indicator is present, we must append 'Z' to ensure
      // the browser interprets it as UTC (not local time).
      let normalized = dateStr.trim();
      const hasTimezone = normalized.endsWith("Z") || 
        /[+-]\d{2}:\d{2}$/.test(normalized) || 
        /[+-]\d{4}$/.test(normalized);
      if (!hasTimezone) {
        // Replace space with T if needed for proper ISO parsing
        normalized = normalized.replace(" ", "T") + "Z";
      }
      const date = new Date(normalized);
      if (isNaN(date.getTime())) return dateStr;
      return date.toLocaleString("es-CL", {
        timeZone: "America/Santiago",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
    } catch {
      return dateStr;
    }
  };

  // Real-time search filtering
  const filteredOrdenes = useMemo(() => {
    if (!searchQuery.trim()) return ordenes;
    const q = searchQuery.toLowerCase().trim();
    return ordenes.filter(
      (ot) =>
        (ot.numero && ot.numero.toLowerCase().includes(q)) ||
        (ot.cliente && ot.cliente.toLowerCase().includes(q)) ||
        (ot.descripcion && ot.descripcion.toLowerCase().includes(q)) ||
        (ot.tecnico_nombre && ot.tecnico_nombre.toLowerCase().includes(q))
    );
  }, [ordenes, searchQuery]);

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Buscar por N° OT, cliente, técnico o descripción..."
          className="pl-9 pr-9"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Filter */}
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-slate-600">Filtrar:</span>
        <Select value={filtroEstado} onValueChange={setFiltroEstado}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="pendiente">Pendiente</SelectItem>
            <SelectItem value="en_curso">En Curso</SelectItem>
            <SelectItem value="en_revision">En Revisión</SelectItem>
            <SelectItem value="completada">Completada</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground ml-auto">
          {filteredOrdenes.length} de {ordenes.length} orden(es)
        </span>
      </div>

      {loading ? (
        <div className="text-center py-10 text-muted-foreground">
          Cargando órdenes...
        </div>
      ) : filteredOrdenes.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground">
          {searchQuery
            ? `No se encontraron resultados para "${searchQuery}"`
            : "No hay órdenes de trabajo"}
        </div>
      ) : (
        filteredOrdenes.map((ot) => (
          <Card
            key={ot.id}
            className="p-4 hover:shadow-lg transition-all duration-200"
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-slate-800">
                  {ot.numero}
                </span>
                <Badge
                  className={`${prioridadColors[ot.prioridad]} text-white text-[10px] px-2`}
                >
                  {ot.prioridad}
                </Badge>
                {/* Indicador SLA */}
                {(() => {
                  const sla = calcularSLA(ot);
                  if (!sla) return null;
                  return (
                    <span
                      className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                        sla.vencida
                          ? "bg-red-100 text-red-700"
                          : sla.horasRestantes < 4
                          ? "bg-amber-100 text-amber-700"
                          : "bg-green-100 text-green-700"
                      }`}
                      title={`SLA ${SLA_HORAS[ot.prioridad] || 72}h - ${sla.texto}`}
                    >
                      {sla.texto}
                    </span>
                  );
                })()}
              </div>
              <Badge
                className={`${estadoColors[ot.estado]} text-white text-xs`}
              >
                {estadoLabels[ot.estado]}
              </Badge>
            </div>

            {/* Date */}
            <p className="text-xs text-muted-foreground mb-2">
              {ot.fecha_inicio ? formatDate(ot.fecha_inicio) : "Sin fecha"}
              {ot.fecha_cierre && (
                <span className="ml-2 text-green-600">
                  → Cerrada: {formatDate(ot.fecha_cierre)}
                </span>
              )}
            </p>

            {/* Details */}
            <div className="text-sm space-y-1 mb-3">
              <p>
                <span className="font-medium text-slate-700">Cliente:</span>{" "}
                {ot.cliente}
              </p>
              {ot.tecnico_nombre && (
                <p>
                  <span className="font-medium text-slate-700">Técnico:</span>{" "}
                  {ot.tecnico_nombre}
                </p>
              )}
              {ot.firma_por && (
                <p>
                  <span className="font-medium text-slate-700">Firma:</span>{" "}
                  {ot.firma_por}
                </p>
              )}
              {ot.direccion && (
                <p>
                  <span className="font-medium text-slate-700">
                    Dirección:
                  </span>{" "}
                  {ot.direccion}
                </p>
              )}
              <p>
                <span className="font-medium text-slate-700">
                  Descripción:
                </span>{" "}
                {ot.descripcion}
              </p>
              {ot.tipo_serv && (
                <p>
                  <span className="font-medium text-slate-700">Servicio:</span>{" "}
                  {ot.tipo_serv}
                </p>
              )}
              {ot.notas && (
                <p className="text-xs text-slate-500 italic">
                  Obs: {ot.notas}
                </p>
              )}
            </div>

            {/* Photos */}
            {ot.foto_url && ot.foto_url.length > 0 && (
              <div className="flex gap-2 flex-wrap mb-2">
                {ot.foto_url.map((foto, i) => (
                  <img
                    key={i}
                    src={`${SUPABASE_URL}/storage/v1/object/public/fotos_ot/${foto}`}
                    alt={`Foto ${i + 1}`}
                    className="w-14 h-14 rounded-lg object-cover border cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={() =>
                      setPreviewImage(
                        `${SUPABASE_URL}/storage/v1/object/public/fotos_ot/${foto}`
                      )
                    }
                  />
                ))}
              </div>
            )}

            {/* Upload Photo Button */}
            {ot.estado !== "completada" && (
              <div className="mb-3">
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  ref={(el) => {
                    photoInputRefs.current[ot.id] = el;
                  }}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleUploadPhoto(ot.id, file);
                  }}
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => photoInputRefs.current[ot.id]?.click()}
                  disabled={uploadingPhotoId === ot.id}
                  className="gap-1.5 text-xs border-violet-300 text-violet-600 hover:bg-violet-50"
                >
                  {uploadingPhotoId === ot.id ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Camera className="w-3 h-3" />
                  )}
                  {uploadingPhotoId === ot.id ? "Subiendo..." : "Subir Foto"}
                </Button>
                <span className="text-xs text-muted-foreground ml-2">
                  {Array.isArray(ot.foto_url) ? ot.foto_url.length : 0} foto(s)
                </span>
              </div>
            )}

            {/* Signature */}
            {ot.firma_cliente_url ? (
              <div className="mb-3">
                <p className="text-xs font-medium text-slate-600 mb-1 flex items-center gap-1">
                  <Pen className="w-3 h-3" /> Firma del cliente:
                </p>
                <img
                  src={ot.firma_cliente_url}
                  alt="Firma"
                  className="w-60 h-20 border rounded-lg object-contain bg-white"
                />
              </div>
            ) : (
              <div className="mb-3">
                <p className="text-xs font-medium text-slate-600 mb-1 flex items-center gap-1">
                  <Pen className="w-3 h-3" /> Firma del cliente:
                </p>
                <canvas
                  ref={(el) => {
                    canvasRefs.current[ot.id] = el;
                    // Immediately initialize SignaturePad when canvas mounts
                    if (el) {
                      // Destroy old pad if exists
                      if (signatureRefs.current[ot.id]) {
                        signatureRefs.current[ot.id]!.off();
                        signatureRefs.current[ot.id] = null;
                      }
                      signatureRefs.current[ot.id] = new SignaturePad(el, {
                        backgroundColor: "rgb(255, 255, 255)",
                        penColor: "rgb(0, 0, 0)",
                      });
                    } else {
                      // Canvas unmounted, clean up
                      if (signatureRefs.current[ot.id]) {
                        signatureRefs.current[ot.id]!.off();
                        signatureRefs.current[ot.id] = null;
                      }
                    }
                  }}
                  width={280}
                  height={90}
                  className="border rounded-lg bg-white touch-none"
                />
                <div className="flex gap-2 mt-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => guardarFirma(ot.id)}
                    className="gap-1 text-xs"
                  >
                    <Save className="w-3 h-3" /> Guardar
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => limpiarFirma(ot.id)}
                    className="gap-1 text-xs"
                  >
                    <Eraser className="w-3 h-3" /> Borrar
                  </Button>
                </div>
              </div>
            )}

            {/* Completion Requirements Indicator */}
            {ot.estado !== "completada" && (() => {
              const fotos = Array.isArray(ot.foto_url) ? ot.foto_url : [];
              const faltanFotos = fotos.length < 2;
              const faltaFirma = !ot.firma_cliente_url;
              if (faltanFotos || faltaFirma) {
                return (
                  <div className="mb-3 p-2.5 bg-amber-50 border border-amber-200 rounded-lg">
                    <p className="text-xs font-semibold text-amber-700 mb-1">
                      ⚠️ Para finalizar esta OT se requiere:
                    </p>
                    <ul className="text-xs text-amber-600 list-disc list-inside space-y-0.5">
                      {faltanFotos && (
                        <li>
                          Al menos 2 fotos (actualmente: {fotos.length})
                        </li>
                      )}
                      {faltaFirma && <li>Firma del cliente</li>}
                    </ul>
                  </div>
                );
              }
              return null;
            })()}

            {/* Actions Row */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Status Actions */}
              {ot.estado === "pendiente" && (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => cambiarEstado(ot.id, "en_curso")}
                    className="gap-1 text-xs border-sky-300 text-sky-600 hover:bg-sky-50"
                  >
                    <ArrowRight className="w-3 h-3" /> En Curso
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openEditDialog(ot)}
                    className="gap-1 text-xs border-blue-300 text-blue-600 hover:bg-blue-50"
                  >
                    <Edit className="w-3 h-3" /> Editar
                  </Button>
                </>
              )}

              {ot.estado === "en_curso" && (
                <>
                  {/* Técnicos envían a revisión, supervisores/admins pueden completar directamente */}
                  {user.rol === "tecnico" ? (
                    <Button
                      size="sm"
                      onClick={() => cambiarEstado(ot.id, "en_revision")}
                      className="gap-1 text-xs bg-purple-600 hover:bg-purple-700 text-white"
                    >
                      <ArrowRight className="w-3 h-3" /> Enviar a Revisión
                    </Button>
                  ) : (
                    <>
                      <Button
                        size="sm"
                        onClick={() => cambiarEstado(ot.id, "en_revision")}
                        className="gap-1 text-xs bg-purple-600 hover:bg-purple-700 text-white"
                      >
                        <ArrowRight className="w-3 h-3" /> Enviar a Revisión
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => cambiarEstado(ot.id, "completada")}
                        className="gap-1 text-xs bg-green-600 hover:bg-green-700 text-white"
                      >
                        <CheckCircle className="w-3 h-3" /> Aprobar y Cerrar
                      </Button>
                    </>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openEditDialog(ot)}
                    className="gap-1 text-xs border-blue-300 text-blue-600 hover:bg-blue-50"
                  >
                    <Edit className="w-3 h-3" /> Editar
                  </Button>
                </>
              )}

              {ot.estado === "en_revision" && (
                <>
                  {/* Solo supervisores/admins pueden aprobar */}
                  {(user.rol === "superadmin" || user.rol === "admin" || user.rol === "supervisor") ? (
                    <>
                      <Button
                        size="sm"
                        onClick={() => cambiarEstado(ot.id, "completada")}
                        className="gap-1 text-xs bg-green-600 hover:bg-green-700 text-white"
                      >
                        <CheckCircle className="w-3 h-3" /> Aprobar y Cerrar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => { setDevolucionOT(ot); setDevolucionMotivo(""); }}
                        className="gap-1 text-xs border-orange-300 text-orange-600 hover:bg-orange-50"
                      >
                        <ArrowRight className="w-3 h-3" /> Devolver a Técnico
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openEditDialog(ot)}
                        className="gap-1 text-xs border-blue-300 text-blue-600 hover:bg-blue-50"
                      >
                        <Edit className="w-3 h-3" /> Editar
                      </Button>
                    </>
                  ) : (
                    <p className="text-xs text-purple-600 font-medium flex items-center gap-1">
                      <ArrowRight className="w-3 h-3" /> En revisión por supervisor
                    </p>
                  )}
                </>
              )}

              {ot.estado === "completada" && (
                <p className="text-xs text-green-600 font-medium flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" /> Finalizada
                  {ot.completado_por && ` por ${ot.completado_por}`}
                </p>
              )}

              {/* PDF Export Button */}
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleExportPDF(ot)}
                disabled={exportingId === ot.id}
                className="gap-1 text-xs border-slate-300 text-slate-600 hover:bg-slate-50 ml-auto"
              >
                {exportingId === ot.id ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <FileDown className="w-3 h-3" />
                )}
                {exportingId === ot.id ? "Exportando..." : "Exportar PDF"}
              </Button>

              {/* Delete Button - only for admin/superadmin */}
              {canDelete && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleDeleteOT(ot)}
                  className="gap-1 text-xs border-red-300 text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="w-3 h-3" /> Eliminar
                </Button>
              )}
            </div>

            {/* Vista previa de materiales asignados */}
            {(() => {
              const materiales = materialesPorOT[String(ot.id)];
              if (!materiales || materiales.length === 0) return null;
              const costoTotal = materiales.reduce((sum, m) => sum + (m.costo_unitario || 0) * m.cantidad, 0);
              return (
                <div className="mt-3 border border-indigo-100 rounded-lg p-3 bg-indigo-50/40">
                  <p className="text-xs font-semibold text-indigo-800 mb-2 flex items-center gap-1.5">
                    <Package className="w-3.5 h-3.5" />
                    Materiales asignados ({materiales.length})
                    {canSeeCosts && costoTotal > 0 && (
                      <span className="ml-auto text-xs font-bold text-indigo-600">
                        Total: ${costoTotal.toLocaleString("es-CL", { minimumFractionDigits: 0 })}
                      </span>
                    )}
                  </p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-left text-indigo-600 border-b border-indigo-200">
                          <th className="pb-1 pr-2">Material</th>
                          <th className="pb-1 pr-2">Cant.</th>
                          <th className="pb-1 pr-2">Unidad</th>
                          {canSeeCosts && <th className="pb-1 pr-2">C. Unit.</th>}
                          {canSeeCosts && <th className="pb-1">Subtotal</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {materiales.map((mat) => (
                          <tr key={mat.id} className="border-b border-indigo-100 last:border-0">
                            <td className="py-1 pr-2 text-slate-700 font-medium">{mat.nombre}</td>
                            <td className="py-1 pr-2 text-slate-600">{mat.cantidad}</td>
                            <td className="py-1 pr-2 text-slate-500">{mat.unidad}</td>
                            {canSeeCosts && (
                              <td className="py-1 pr-2 text-slate-600">
                                ${(mat.costo_unitario || 0).toLocaleString("es-CL")}
                              </td>
                            )}
                            {canSeeCosts && (
                              <td className="py-1 text-slate-700 font-medium">
                                ${((mat.costo_unitario || 0) * mat.cantidad).toLocaleString("es-CL")}
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })()}

            {/* Botón para agregar materiales desde Inventario - solo si OT no está completada */}
            {ot.estado !== "completada" && (
              <div className="mt-3 flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1 text-indigo-700 border-indigo-200 hover:bg-indigo-50"
                  onClick={() => {
                    // Navegar a la sección de Inventario para asignar materiales a esta OT
                    const event = new CustomEvent("navigate-inventario", { detail: { otId: ot.id, otNumero: ot.numero } });
                    window.dispatchEvent(event);
                  }}
                >
                  <Package className="w-4 h-4" />
                  Agregar materiales desde Inventario
                </Button>
              </div>
            )}
          </Card>
        ))
      )}

      {/* Image Preview Dialog */}
      <Dialog
        open={!!previewImage}
        onOpenChange={() => setPreviewImage(null)}
      >
        <DialogContent className="max-w-lg p-2">
          <DialogTitle className="flex items-center gap-2 px-2 pt-2 text-sm">
            <ImageIcon className="w-4 h-4" /> Vista previa
          </DialogTitle>
          {previewImage && (
            <img
              src={previewImage}
              alt="Preview"
              className="w-full rounded-lg"
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Edit OT Dialog */}
      <Dialog open={!!editingOT} onOpenChange={() => closeEditDialog()}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="w-4 h-4" /> Editar OT {editingOT?.numero}
            </DialogTitle>
            <DialogDescription>
              Modifica los campos y presiona Guardar para actualizar la orden de
              trabajo.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="edit-cliente">Cliente *</Label>
              <Input
                id="edit-cliente"
                value={editForm.cliente}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, cliente: e.target.value }))
                }
                placeholder="Nombre del cliente"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-descripcion">Descripción *</Label>
              <Textarea
                id="edit-descripcion"
                value={editForm.descripcion}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, descripcion: e.target.value }))
                }
                placeholder="Descripción del trabajo"
                rows={3}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-direccion">Dirección</Label>
              <Input
                id="edit-direccion"
                value={editForm.direccion}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, direccion: e.target.value }))
                }
                placeholder="Dirección"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-tipo_serv">Tipo de Servicio</Label>
              <Input
                id="edit-tipo_serv"
                value={editForm.tipo_serv}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, tipo_serv: e.target.value }))
                }
                placeholder="Tipo de servicio"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-firma_por">Firmado por</Label>
              <Input
                id="edit-firma_por"
                value={editForm.firma_por}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, firma_por: e.target.value }))
                }
                placeholder="Nombre de quien firma"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Prioridad</Label>
                <Select
                  value={editForm.prioridad}
                  onValueChange={(v) =>
                    setEditForm((f) => ({
                      ...f,
                      prioridad: v as "baja" | "media" | "alta",
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="baja">Baja</SelectItem>
                    <SelectItem value="media">Media</SelectItem>
                    <SelectItem value="alta">Alta</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Estado</Label>
                <Select
                  value={editForm.estado}
                  onValueChange={(v) =>
                    setEditForm((f) => ({
                      ...f,
                      estado: v as "pendiente" | "en_curso" | "en_revision" | "completada",
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pendiente">Pendiente</SelectItem>
                    <SelectItem value="en_curso">En Curso</SelectItem>
                    <SelectItem value="en_revision">En Revisión</SelectItem>
                    {(user.rol === "superadmin" || user.rol === "admin" || user.rol === "supervisor") && (
                      <SelectItem value="completada">Completada</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Technician Reassignment - only for supervisors/admins */}
            {canReassign && editTecnicos.length > 0 && (
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5">
                  <UserCheck className="w-4 h-4 text-blue-600" />
                  Reasignar Técnico
                </Label>
                <Select
                  value={editForm.tecnico_id}
                  onValueChange={(v) =>
                    setEditForm((f) => ({ ...f, tecnico_id: v }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar responsable" />
                  </SelectTrigger>
                  <SelectContent>
                    {editTecnicos.map((tec) => (
                      <SelectItem key={tec.auth_id} value={tec.auth_id}>
                        {tec.nombre} {tec.rol === "supervisor" ? "(Sup.)" : "(Téc.)"}{tec.region ? ` — ${getRegionLabel(tec.region)}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Puede reasignar esta OT a otro técnico si es necesario.
                </p>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="edit-notas">Observaciones</Label>
              <Textarea
                id="edit-notas"
                value={editForm.notas}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, notas: e.target.value }))
                }
                placeholder="Observaciones adicionales"
                rows={2}
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={closeEditDialog} disabled={saving}>
              Cancelar
            </Button>
            <Button
              onClick={handleEditSave}
              disabled={saving}
              className="gap-1 bg-blue-600 hover:bg-blue-700 text-white"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {saving ? "Guardando..." : "Guardar cambios"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo de devolución con observaciones */}
      <Dialog open={!!devolucionOT} onOpenChange={(open) => { if (!open) { setDevolucionOT(null); setDevolucionMotivo(""); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-orange-600">
              <ArrowRight className="w-5 h-5" />
              Devolver OT a Técnico
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              Está devolviendo la OT <strong>{devolucionOT?.numero}</strong> al técnico para correcciones.
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="motivo-devolucion">Motivo / Observaciones <span className="text-red-500">*</span></Label>
              <Textarea
                id="motivo-devolucion"
                value={devolucionMotivo}
                onChange={(e) => setDevolucionMotivo(e.target.value)}
                placeholder="Indique el motivo de la devolución y las correcciones requeridas..."
                rows={3}
                className="resize-none"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => { setDevolucionOT(null); setDevolucionMotivo(""); }}>
              Cancelar
            </Button>
            <Button
              onClick={devolverOTConMotivo}
              disabled={!devolucionMotivo.trim()}
              className="gap-1 bg-orange-600 hover:bg-orange-700 text-white"
            >
              <ArrowRight className="w-4 h-4" />
              Devolver con observaciones
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}