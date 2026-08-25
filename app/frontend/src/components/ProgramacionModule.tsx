import { useState, useEffect, useMemo, useCallback } from "react";
import { useEmpresa } from "@/lib/empresaContext";
import type { Usuario } from "@/lib/types";
import { SUPABASE_URL, SUPABASE_KEY, SUPABASE_SERVICE_KEY } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
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
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Calendar,
  Plus,
  Edit2,
  Trash2,
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  CalendarDays,
  Users,
  Wrench,
  Monitor,
  Zap,
  RefreshCw,
  FileText,
  Link2,
  Loader2,
  ChevronLeft,
  ChevronRight,
  BarChart3,
  Copy,
  Save,
  Bell,
  Columns3,
} from "lucide-react";

interface Schedule {
  id: string;
  empresa_id: string;
  tipo_checklist: string;
  sitio: string;
  equipo: string;
  descripcion: string;
  frecuencia: string;
  proxima_fecha: string;
  ultima_ejecucion: string | null;
  tecnico_id: string | null;
  supervisor_id: string | null;
  activo: boolean;
  dias_anticipacion_alerta: number;
  created_at: string;
}

interface Tecnico {
  id: string;
  auth_id: string;
  nombre: string;
  rol: string;
}

interface OTVinculada {
  id: string;
  numero: string;
  estado: string;
  programacion_id: string;
}

interface PlantillaProgramacion {
  id: string;
  nombre: string;
  tipo_checklist: string;
  frecuencia: string;
  descripcion: string;
  dias_anticipacion_alerta: number;
}

interface Props {
  user: Usuario;
  token: string;
  onOTCreated: () => void;
}

type ViewMode = "lista" | "calendario" | "kpis" | "kanban";

const TIPO_LABELS: Record<string, string> = {
  mantencion_bms: "Mantención BMS",
  operacion_bms: "Operación BMS",
  grupo_electrogeno: "Grupo Electrógeno",
  correctivo: "Correctivo",
  preventivo: "Preventivo",
  predictivo: "Predictivo",
};

const TIPO_ICONS: Record<string, React.ReactNode> = {
  mantencion_bms: <Wrench className="w-4 h-4" />,
  operacion_bms: <Monitor className="w-4 h-4" />,
  grupo_electrogeno: <Zap className="w-4 h-4" />,
  correctivo: <AlertTriangle className="w-4 h-4" />,
  preventivo: <Wrench className="w-4 h-4" />,
  predictivo: <Monitor className="w-4 h-4" />,
};

const FRECUENCIA_LABELS: Record<string, string> = {
  semanal: "Semanal",
  quincenal: "Quincenal",
  mensual: "Mensual",
  trimestral: "Trimestral",
  semestral: "Semestral",
  anual: "Anual",
};

const TIPO_SERV_MAP: Record<string, string> = {
  mantencion_bms: "Mantención BMS",
  operacion_bms: "Operación BMS",
  grupo_electrogeno: "Grupo Electrógeno",
  correctivo: "Correctivo",
  preventivo: "Preventivo",
  predictivo: "Predictivo",
};

function getEstadoProgramacion(schedule: Schedule): { estado: string; color: string; icon: React.ReactNode } {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const proxima = new Date(schedule.proxima_fecha + "T00:00:00");
  const diffDias = Math.ceil((proxima.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDias < 0) {
    return { estado: `Vencida (${Math.abs(diffDias)} días)`, color: "bg-red-100 text-red-700 border-red-200", icon: <XCircle className="w-4 h-4 text-red-600" /> };
  }
  if (diffDias === 0) {
    return { estado: "Hoy", color: "bg-orange-100 text-orange-700 border-orange-200", icon: <AlertTriangle className="w-4 h-4 text-orange-600" /> };
  }
  if (diffDias <= 3) {
    return { estado: `En ${diffDias} día${diffDias > 1 ? "s" : ""}`, color: "bg-yellow-100 text-yellow-700 border-yellow-200", icon: <Clock className="w-4 h-4 text-yellow-600" /> };
  }
  if (diffDias <= 7) {
    return { estado: `En ${diffDias} días`, color: "bg-blue-100 text-blue-700 border-blue-200", icon: <CalendarDays className="w-4 h-4 text-blue-600" /> };
  }
  return { estado: `En ${diffDias} días`, color: "bg-green-100 text-green-700 border-green-200", icon: <CheckCircle2 className="w-4 h-4 text-green-600" /> };
}

export default function ProgramacionModule({ user, token, onOTCreated }: Props) {
  const { empresa, colorPrimario } = useEmpresa();
  const { toast } = useToast();

  // License check
  const [moduleActive, setModuleActive] = useState<boolean | null>(null);
  const [licenseLoading, setLicenseLoading] = useState(true);

  const isPrivileged = user.rol === "superadmin" || user.rol === "admin";

  useEffect(() => {
    checkLicense();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresa?.id]);

  async function checkLicense() {
    if (!empresa) {
      setModuleActive(isPrivileged);
      setLicenseLoading(false);
      return;
    }
    try {
      const lAuthKey = SUPABASE_SERVICE_KEY || token;
      const lApiKey = SUPABASE_SERVICE_KEY || SUPABASE_KEY;
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/company_modules?empresa_id=eq.${empresa.id}&module_name=eq.programacion`,
        {
          headers: {
            apikey: lApiKey,
            Authorization: `Bearer ${lAuthKey}`,
            "Content-Type": "application/json",
          },
        }
      );
      if (res.ok) {
        const data = await res.json();
        if (data && data.length > 0) {
          setModuleActive(data[0].active || isPrivileged);
        } else {
          setModuleActive(isPrivileged);
        }
      } else {
        setModuleActive(isPrivileged);
      }
    } catch (err) {
      console.error("Programacion Module license check error:", err);
      setModuleActive(isPrivileged);
    }
    setLicenseLoading(false);
  }

  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [tecnicos, setTecnicos] = useState<Tecnico[]>([]);
  const [otsVinculadas, setOtsVinculadas] = useState<OTVinculada[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);
  const [filterTipo, setFilterTipo] = useState<string>("todos");
  const [filterEstado, setFilterEstado] = useState<string>("todos");
  const [generatingOTId, setGeneratingOTId] = useState<string | null>(null);
  const [confirmGenOT, setConfirmGenOT] = useState<Schedule | null>(null);
  const [otDescripcion, setOtDescripcion] = useState("");
  const [otCliente, setOtCliente] = useState("");
  const [otPrioridad, setOtPrioridad] = useState<"baja" | "media" | "alta">("media");

  // View mode
  const [viewMode, setViewMode] = useState<ViewMode>("lista");

  // Calendar state
  const [calendarMonth, setCalendarMonth] = useState(new Date().getMonth());
  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear());

  // Plantillas state
  const [plantillas, setPlantillas] = useState<PlantillaProgramacion[]>([]);
  const [showPlantillaDialog, setShowPlantillaDialog] = useState(false);
  const [plantillaNombre, setPlantillaNombre] = useState("");
  const [showLoadPlantillaDialog, setShowLoadPlantillaDialog] = useState(false);

  // Form state
  const [formTipo, setFormTipo] = useState("preventivo");
  const [formSitio, setFormSitio] = useState("");
  const [formEquipo, setFormEquipo] = useState("");
  const [formDescripcion, setFormDescripcion] = useState("");
  const [formFrecuencia, setFormFrecuencia] = useState("mensual");
  const [formProximaFecha, setFormProximaFecha] = useState("");
  const [formTecnicoId, setFormTecnicoId] = useState("");
  const [formSupervisorId, setFormSupervisorId] = useState("");
  const [formDiasAnticipacion, setFormDiasAnticipacion] = useState("7");
  const [saving, setSaving] = useState(false);

  const authKey = SUPABASE_SERVICE_KEY || token;
  const apiKey = SUPABASE_SERVICE_KEY || SUPABASE_KEY;

  const loadSchedules = useCallback(async () => {
    if (!empresa) return;
    setLoading(true);
    try {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/maintenance_schedules?empresa_id=eq.${empresa.id}&order=proxima_fecha.asc`,
        {
          headers: {
            apikey: apiKey,
            Authorization: `Bearer ${authKey}`,
          },
        }
      );
      if (res.ok) {
        const data = await res.json();
        setSchedules(data || []);
      }
    } catch (err) {
      console.error("Error loading schedules:", err);
    }
    setLoading(false);
  }, [empresa, apiKey, authKey]);

  const loadOTsVinculadas = useCallback(async () => {
    if (!empresa) return;
    try {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/ordenes_trabajo?empresa_id=eq.${empresa.id}&programacion_id=not.is.null&select=id,numero,estado,programacion_id`,
        {
          headers: {
            apikey: apiKey,
            Authorization: `Bearer ${authKey}`,
          },
        }
      );
      if (res.ok) {
        const data = await res.json();
        setOtsVinculadas(Array.isArray(data) ? data : []);
      }
    } catch {
      // silently fail
    }
  }, [empresa, apiKey, authKey]);

  const loadTecnicos = useCallback(async () => {
    if (!empresa) return;
    try {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/usuarios?empresa_id=eq.${empresa.id}&select=id,auth_id,nombre,rol`,
        {
          headers: {
            apikey: apiKey,
            Authorization: `Bearer ${authKey}`,
          },
        }
      );
      if (res.ok) {
        const data = await res.json();
        setTecnicos(data || []);
      }
    } catch (err) {
      console.error("Error loading tecnicos:", err);
    }
  }, [empresa, apiKey, authKey]);

  // Load plantillas from localStorage
  const loadPlantillas = useCallback(() => {
    try {
      const stored = localStorage.getItem(`plantillas_prog_${empresa?.id || "default"}`);
      if (stored) {
        setPlantillas(JSON.parse(stored));
      }
    } catch {
      // ignore
    }
  }, [empresa?.id]);

  useEffect(() => {
    if (empresa) {
      loadSchedules();
      loadTecnicos();
      loadOTsVinculadas();
      loadPlantillas();
    }
  }, [empresa, loadSchedules, loadTecnicos, loadOTsVinculadas, loadPlantillas]);

  function resetForm() {
    setFormTipo("preventivo");
    setFormSitio("");
    setFormEquipo("");
    setFormDescripcion("");
    setFormFrecuencia("mensual");
    setFormProximaFecha("");
    setFormTecnicoId("");
    setFormSupervisorId("");
    setFormDiasAnticipacion("7");
    setEditingSchedule(null);
  }

  function openEditDialog(schedule: Schedule) {
    setEditingSchedule(schedule);
    setFormTipo(schedule.tipo_checklist);
    setFormSitio(schedule.sitio);
    setFormEquipo(schedule.equipo || "");
    setFormDescripcion(schedule.descripcion || "");
    setFormFrecuencia(schedule.frecuencia);
    setFormProximaFecha(schedule.proxima_fecha);
    setFormTecnicoId(schedule.tecnico_id || "");
    setFormSupervisorId(schedule.supervisor_id || "");
    setFormDiasAnticipacion(String(schedule.dias_anticipacion_alerta));
    setDialogOpen(true);
  }

  // ─── Plantillas ─────────────────────────────────────────────────────────
  function handleSavePlantilla() {
    if (!plantillaNombre.trim()) {
      toast({ title: "Error", description: "Ingrese un nombre para la plantilla", variant: "destructive" });
      return;
    }
    const newPlantilla: PlantillaProgramacion = {
      id: Date.now().toString(),
      nombre: plantillaNombre.trim(),
      tipo_checklist: formTipo,
      frecuencia: formFrecuencia,
      descripcion: formDescripcion,
      dias_anticipacion_alerta: parseInt(formDiasAnticipacion) || 7,
    };
    const updated = [...plantillas, newPlantilla];
    setPlantillas(updated);
    localStorage.setItem(`plantillas_prog_${empresa?.id || "default"}`, JSON.stringify(updated));
    toast({ title: "✅ Plantilla guardada", description: `"${plantillaNombre}" guardada correctamente` });
    setShowPlantillaDialog(false);
    setPlantillaNombre("");
  }

  function handleLoadPlantilla(plantilla: PlantillaProgramacion) {
    setFormTipo(plantilla.tipo_checklist);
    setFormFrecuencia(plantilla.frecuencia);
    setFormDescripcion(plantilla.descripcion);
    setFormDiasAnticipacion(String(plantilla.dias_anticipacion_alerta));
    setShowLoadPlantillaDialog(false);
    toast({ title: "Plantilla cargada", description: `Se aplicó "${plantilla.nombre}"` });
  }

  function handleDeletePlantilla(id: string) {
    const updated = plantillas.filter((p) => p.id !== id);
    setPlantillas(updated);
    localStorage.setItem(`plantillas_prog_${empresa?.id || "default"}`, JSON.stringify(updated));
    toast({ title: "Eliminada", description: "Plantilla eliminada" });
  }

  async function handleSave() {
    if (!empresa) return;
    if (!formSitio.trim() || !formProximaFecha) {
      toast({ title: "Error", description: "Sitio y próxima fecha son obligatorios", variant: "destructive" });
      return;
    }

    setSaving(true);
    const payload = {
      empresa_id: empresa.id,
      tipo_checklist: formTipo,
      sitio: formSitio.trim(),
      equipo: formEquipo.trim() || null,
      descripcion: formDescripcion.trim() || null,
      frecuencia: formFrecuencia,
      proxima_fecha: formProximaFecha,
      tecnico_id: (formTecnicoId && formTecnicoId !== "none") ? formTecnicoId : null,
      supervisor_id: (formSupervisorId && formSupervisorId !== "none") ? formSupervisorId : null,
      dias_anticipacion_alerta: parseInt(formDiasAnticipacion) || 7,
      activo: true,
      updated_at: new Date().toISOString(),
    };

    try {
      let res: Response;
      if (editingSchedule) {
        res = await fetch(
          `${SUPABASE_URL}/rest/v1/maintenance_schedules?id=eq.${editingSchedule.id}`,
          {
            method: "PATCH",
            headers: {
              apikey: apiKey,
              Authorization: `Bearer ${authKey}`,
              "Content-Type": "application/json",
              Prefer: "return=minimal",
            },
            body: JSON.stringify(payload),
          }
        );
      } else {
        res = await fetch(
          `${SUPABASE_URL}/rest/v1/maintenance_schedules`,
          {
            method: "POST",
            headers: {
              apikey: apiKey,
              Authorization: `Bearer ${authKey}`,
              "Content-Type": "application/json",
              Prefer: "return=minimal",
            },
            body: JSON.stringify(payload),
          }
        );
      }

      if (res.ok || res.status === 201) {
        toast({ title: "✅ Guardado", description: editingSchedule ? "Programación actualizada" : "Programación creada exitosamente" });
        setDialogOpen(false);
        resetForm();
        loadSchedules();
      } else {
        const errText = await res.text();
        toast({ title: "Error", description: errText, variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Error de conexión", variant: "destructive" });
    }
    setSaving(false);
  }

  async function handleDelete(id: string) {
    if (!confirm("¿Eliminar esta programación?")) return;
    try {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/maintenance_schedules?id=eq.${id}`,
        {
          method: "DELETE",
          headers: {
            apikey: apiKey,
            Authorization: `Bearer ${authKey}`,
          },
        }
      );
      if (res.ok) {
        toast({ title: "Eliminada", description: "Programación eliminada" });
        loadSchedules();
      }
    } catch {
      toast({ title: "Error", description: "No se pudo eliminar", variant: "destructive" });
    }
  }

  async function handleToggleActive(schedule: Schedule) {
    try {
      await fetch(
        `${SUPABASE_URL}/rest/v1/maintenance_schedules?id=eq.${schedule.id}`,
        {
          method: "PATCH",
          headers: {
            apikey: apiKey,
            Authorization: `Bearer ${authKey}`,
            "Content-Type": "application/json",
            Prefer: "return=minimal",
          },
          body: JSON.stringify({ activo: !schedule.activo, updated_at: new Date().toISOString() }),
        }
      );
      loadSchedules();
    } catch {
      toast({ title: "Error", description: "No se pudo actualizar", variant: "destructive" });
    }
  }

  // Generar OT desde programación
  function openGenerarOTDialog(schedule: Schedule) {
    setConfirmGenOT(schedule);
    setOtDescripcion(
      `${TIPO_SERV_MAP[schedule.tipo_checklist] || schedule.tipo_checklist} - ${schedule.equipo || schedule.sitio}${schedule.descripcion ? ` - ${schedule.descripcion}` : ""}`
    );
    setOtCliente(schedule.sitio);
    setOtPrioridad("media");
  }

  async function handleGenerarOT() {
    if (!confirmGenOT || !empresa) return;
    const schedule = confirmGenOT;

    if (!otCliente.trim() || !otDescripcion.trim()) {
      toast({ title: "Error", description: "Cliente y descripción son obligatorios", variant: "destructive" });
      return;
    }

    setGeneratingOTId(schedule.id);

    let tecnicoAuthId = user.auth_id;
    let tecnicoNombre = user.nombre;
    if (schedule.tecnico_id) {
      const tec = tecnicos.find((t) => String(t.id) === String(schedule.tecnico_id));
      if (tec?.auth_id) {
        tecnicoAuthId = tec.auth_id;
        tecnicoNombre = tec.nombre;
      }
    }

    const body = {
      numero: "OT-" + Date.now(),
      cliente: otCliente.trim(),
      descripcion: otDescripcion.trim(),
      direccion: schedule.sitio,
      tipo_serv: TIPO_SERV_MAP[schedule.tipo_checklist] || schedule.tipo_checklist,
      prioridad: otPrioridad,
      estado: "pendiente",
      notas: `Generada desde programación: ${FRECUENCIA_LABELS[schedule.frecuencia] || schedule.frecuencia} - Equipo: ${schedule.equipo || "N/A"}`,
      firma_por: "",
      fecha_inicio: new Date().toISOString(),
      tecnico_id: tecnicoAuthId,
      tecnico_nombre: tecnicoNombre,
      empresa_id: empresa.id,
      programacion_id: schedule.id,
      foto_url: [],
    };

    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/ordenes_trabajo`, {
        method: "POST",
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Prefer: "return=representation",
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errText = await res.text();
        let errorMsg = "No se pudo crear la OT";
        try {
          const errJson = JSON.parse(errText);
          errorMsg = errJson.message || errJson.error || errorMsg;
        } catch {
          if (errText) errorMsg = errText;
        }
        toast({ title: "Error", description: errorMsg, variant: "destructive" });
        return;
      }

      const createdOT = await res.json();
      const otNumero = Array.isArray(createdOT) ? createdOT[0]?.numero : createdOT?.numero;

      // Actualizar la programación con la última ejecución y avanzar próxima fecha
      const nuevaProximaFecha = calcularProximaFecha(schedule.proxima_fecha, schedule.frecuencia);
      await fetch(
        `${SUPABASE_URL}/rest/v1/maintenance_schedules?id=eq.${schedule.id}`,
        {
          method: "PATCH",
          headers: {
            apikey: apiKey,
            Authorization: `Bearer ${authKey}`,
            "Content-Type": "application/json",
            Prefer: "return=minimal",
          },
          body: JSON.stringify({
            ultima_ejecucion: new Date().toISOString(),
            proxima_fecha: nuevaProximaFecha,
            updated_at: new Date().toISOString(),
          }),
        }
      );

      toast({
        title: "✅ OT Generada",
        description: `Se creó la ${otNumero || "OT"} y se actualizó la próxima fecha de la programación`,
      });

      setConfirmGenOT(null);
      loadSchedules();
      loadOTsVinculadas();
      onOTCreated();
    } catch {
      toast({ title: "Error", description: "Error de conexión al crear la OT", variant: "destructive" });
    } finally {
      setGeneratingOTId(null);
    }
  }

  function calcularProximaFecha(fechaActual: string, frecuencia: string): string {
    const fecha = new Date(fechaActual + "T00:00:00");
    switch (frecuencia) {
      case "semanal":
        fecha.setDate(fecha.getDate() + 7);
        break;
      case "quincenal":
        fecha.setDate(fecha.getDate() + 15);
        break;
      case "mensual":
        fecha.setMonth(fecha.getMonth() + 1);
        break;
      case "trimestral":
        fecha.setMonth(fecha.getMonth() + 3);
        break;
      case "semestral":
        fecha.setMonth(fecha.getMonth() + 6);
        break;
      case "anual":
        fecha.setFullYear(fecha.getFullYear() + 1);
        break;
      default:
        fecha.setMonth(fecha.getMonth() + 1);
    }
    return fecha.toISOString().split("T")[0];
  }

  const filteredSchedules = useMemo(() => {
    return schedules.filter((s) => {
      if (filterTipo !== "todos" && s.tipo_checklist !== filterTipo) return false;
      if (filterEstado === "activas" && !s.activo) return false;
      if (filterEstado === "inactivas" && s.activo) return false;
      if (filterEstado === "vencidas") {
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);
        const proxima = new Date(s.proxima_fecha + "T00:00:00");
        if (proxima >= hoy) return false;
      }
      return true;
    });
  }, [schedules, filterTipo, filterEstado]);

  // Stats & KPIs
  const stats = useMemo(() => {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const activas = schedules.filter((s) => s.activo);
    const vencidas = activas.filter((s) => new Date(s.proxima_fecha + "T00:00:00") < hoy);
    const proximas7d = activas.filter((s) => {
      const diff = Math.ceil((new Date(s.proxima_fecha + "T00:00:00").getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
      return diff >= 0 && diff <= 7;
    });
    const otsGeneradas = otsVinculadas.length;
    const otsCompletadas = otsVinculadas.filter((ot) => ot.estado === "completada").length;
    const otsPendientes = otsVinculadas.filter((ot) => ot.estado === "pendiente").length;
    const otsEnCurso = otsVinculadas.filter((ot) => ot.estado === "en_curso").length;
    const cumplimiento = otsGeneradas > 0 ? Math.round((otsCompletadas / otsGeneradas) * 100) : 0;
    const aTiempo = otsCompletadas;
    const conRetraso = vencidas.length;

    return { total: activas.length, vencidas: vencidas.length, proximas7d: proximas7d.length, otsGeneradas, otsCompletadas, otsPendientes, otsEnCurso, cumplimiento, aTiempo, conRetraso };
  }, [schedules, otsVinculadas]);

  const getTecnicoNombre = (id: string | null) => {
    if (!id) return "Sin asignar";
    return tecnicos.find((t) => String(t.id) === String(id))?.nombre || "Desconocido";
  };

  const getOTsForSchedule = (scheduleId: string) => {
    return otsVinculadas.filter((ot) => ot.programacion_id === scheduleId);
  };

  const supervisores = tecnicos.filter((t) => t.rol === "supervisor" || t.rol === "admin" || t.rol === "superadmin");
  const tecnicosList = tecnicos.filter((t) => t.rol === "tecnico" || t.rol === "supervisor");

  // ─── Calendar helpers ───────────────────────────────────────────────────
  const calendarDays = useMemo(() => {
    const firstDay = new Date(calendarYear, calendarMonth, 1);
    const lastDay = new Date(calendarYear, calendarMonth + 1, 0);
    const startDayOfWeek = firstDay.getDay(); // 0=Sun
    const daysInMonth = lastDay.getDate();

    const days: { date: number; schedules: Schedule[]; isToday: boolean }[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Empty slots before first day
    for (let i = 0; i < startDayOfWeek; i++) {
      days.push({ date: 0, schedules: [], isToday: false });
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${calendarYear}-${String(calendarMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const daySchedules = schedules.filter((s) => s.activo && s.proxima_fecha === dateStr);
      const isToday = today.getFullYear() === calendarYear && today.getMonth() === calendarMonth && today.getDate() === d;
      days.push({ date: d, schedules: daySchedules, isToday });
    }

    return days;
  }, [calendarYear, calendarMonth, schedules]);

  const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

  // ─── Notifications check ────────────────────────────────────────────────
  const alertSchedules = useMemo(() => {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    return schedules.filter((s) => {
      if (!s.activo) return false;
      const proxima = new Date(s.proxima_fecha + "T00:00:00");
      const diff = Math.ceil((proxima.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
      return diff <= s.dias_anticipacion_alerta;
    });
  }, [schedules]);

  if (licenseLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <span className="ml-2 text-muted-foreground">Verificando licencia...</span>
      </div>
    );
  }

  if (!moduleActive) {
    return (
      <Card className="max-w-lg mx-auto mt-10">
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 text-red-600 mb-3">
            <CalendarDays className="w-6 h-6" />
            <h3 className="text-lg font-semibold">Módulo Programación no disponible</h3>
          </div>
          <p className="text-sm text-muted-foreground">
            El módulo de Programación no está activo para su empresa.
            Contacte al administrador para activar esta funcionalidad.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <CalendarDays className="w-6 h-6" style={{ color: colorPrimario }} />
        <h2 className="text-xl font-bold text-slate-800">Programación de Trabajos</h2>
        {alertSchedules.length > 0 && (
          <Badge className="bg-amber-100 text-amber-700 border border-amber-200 gap-1">
            <Bell className="w-3 h-3" />
            {alertSchedules.length} alerta{alertSchedules.length > 1 ? "s" : ""}
          </Badge>
        )}
      </div>

      {/* View Mode Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        <button
          onClick={() => setViewMode("lista")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
            viewMode === "lista" ? "bg-white shadow-sm text-slate-800" : "text-slate-500 hover:text-slate-700"
          }`}
        >
          <FileText className="w-3.5 h-3.5" /> Lista
        </button>
        <button
          onClick={() => setViewMode("calendario")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
            viewMode === "calendario" ? "bg-white shadow-sm text-slate-800" : "text-slate-500 hover:text-slate-700"
          }`}
        >
          <Calendar className="w-3.5 h-3.5" /> Calendario
        </button>
        <button
          onClick={() => setViewMode("kanban")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
            viewMode === "kanban" ? "bg-white shadow-sm text-slate-800" : "text-slate-500 hover:text-slate-700"
          }`}
        >
          <Columns3 className="w-3.5 h-3.5" /> Kanban
        </button>
        <button
          onClick={() => setViewMode("kpis")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
            viewMode === "kpis" ? "bg-white shadow-sm text-slate-800" : "text-slate-500 hover:text-slate-700"
          }`}
        >
          <BarChart3 className="w-3.5 h-3.5" /> KPIs
        </button>
      </div>

      {/* Stats (always visible) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-100">
              <Calendar className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.total}</p>
              <p className="text-xs text-gray-500">Activas</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-yellow-100">
              <Clock className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.proximas7d}</p>
              <p className="text-xs text-gray-500">Próx. 7 días</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-100">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-red-600">{stats.vencidas}</p>
              <p className="text-xs text-gray-500">Vencidas</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-100">
              <FileText className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-green-600">{stats.otsGeneradas}</p>
              <p className="text-xs text-gray-500">OTs generadas</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ═══════════════════ CALENDAR VIEW ═══════════════════ */}
      {viewMode === "calendario" && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <Button variant="ghost" size="sm" onClick={() => {
                if (calendarMonth === 0) { setCalendarMonth(11); setCalendarYear(calendarYear - 1); }
                else setCalendarMonth(calendarMonth - 1);
              }}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <CardTitle className="text-base">
                {monthNames[calendarMonth]} {calendarYear}
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={() => {
                if (calendarMonth === 11) { setCalendarMonth(0); setCalendarYear(calendarYear + 1); }
                else setCalendarMonth(calendarMonth + 1);
              }}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 gap-px bg-gray-200 rounded-lg overflow-hidden">
              {["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"].map((d) => (
                <div key={d} className="bg-gray-50 text-center text-xs font-medium text-gray-600 py-2">{d}</div>
              ))}
              {calendarDays.map((day, idx) => (
                <div
                  key={idx}
                  className={`bg-white min-h-[60px] p-1 ${day.date === 0 ? "bg-gray-50" : ""} ${day.isToday ? "ring-2 ring-blue-400 ring-inset" : ""}`}
                >
                  {day.date > 0 && (
                    <>
                      <span className={`text-xs font-medium ${day.isToday ? "text-blue-600" : "text-gray-700"}`}>
                        {day.date}
                      </span>
                      <div className="mt-0.5 space-y-0.5">
                        {day.schedules.slice(0, 3).map((s) => {
                          const est = getEstadoProgramacion(s);
                          return (
                            <div
                              key={s.id}
                              className={`text-[9px] px-1 py-0.5 rounded truncate ${est.color}`}
                              title={`${s.sitio} - ${TIPO_LABELS[s.tipo_checklist] || s.tipo_checklist}`}
                            >
                              {s.sitio.slice(0, 12)}
                            </div>
                          );
                        })}
                        {day.schedules.length > 3 && (
                          <span className="text-[9px] text-gray-400">+{day.schedules.length - 3} más</span>
                        )}
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-100 border border-red-200" /> Vencida</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-orange-100 border border-orange-200" /> Hoy</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-yellow-100 border border-yellow-200" /> Próxima (1-3d)</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-blue-100 border border-blue-200" /> Próxima (4-7d)</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-100 border border-green-200" /> Futura</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ═══════════════════ KPIs VIEW ═══════════════════ */}
      {viewMode === "kpis" && (
        <div className="space-y-4">
          {/* Cumplimiento general */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-slate-700">Indicador de Cumplimiento</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-6">
                <div className="relative w-24 h-24">
                  <svg className="w-24 h-24 -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="40" fill="none" stroke="#e5e7eb" strokeWidth="12" />
                    <circle
                      cx="50" cy="50" r="40" fill="none"
                      stroke={stats.cumplimiento >= 80 ? "#22c55e" : stats.cumplimiento >= 50 ? "#f59e0b" : "#ef4444"}
                      strokeWidth="12"
                      strokeDasharray={`${stats.cumplimiento * 2.51} 251`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-xl font-bold">{stats.cumplimiento}%</span>
                  </div>
                </div>
                <div className="flex-1 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">OTs Completadas</span>
                    <span className="font-semibold text-green-600">{stats.otsCompletadas}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">OTs En Curso</span>
                    <span className="font-semibold text-blue-600">{stats.otsEnCurso}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">OTs Pendientes</span>
                    <span className="font-semibold text-amber-600">{stats.otsPendientes}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Programaciones Vencidas</span>
                    <span className="font-semibold text-red-600">{stats.conRetraso}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Distribución por tipo */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-slate-700">Distribución por Tipo de Trabajo</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {Object.entries(TIPO_LABELS).map(([key, label]) => {
                  const count = schedules.filter((s) => s.activo && s.tipo_checklist === key).length;
                  const pct = stats.total > 0 ? Math.round((count / stats.total) * 100) : 0;
                  if (count === 0) return null;
                  return (
                    <div key={key} className="flex items-center gap-3">
                      <div className="w-28 text-xs text-gray-600 truncate flex items-center gap-1">
                        {TIPO_ICONS[key]} {label}
                      </div>
                      <div className="flex-1 h-5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${pct}%`, backgroundColor: colorPrimario || "#3b82f6" }}
                        />
                      </div>
                      <span className="text-xs font-medium w-12 text-right">{count} ({pct}%)</span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Distribución por frecuencia */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-slate-700">Distribución por Frecuencia</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {Object.entries(FRECUENCIA_LABELS).map(([key, label]) => {
                  const count = schedules.filter((s) => s.activo && s.frecuencia === key).length;
                  if (count === 0) return null;
                  return (
                    <div key={key} className="border rounded-lg p-2.5 text-center">
                      <p className="text-lg font-bold" style={{ color: colorPrimario }}>{count}</p>
                      <p className="text-xs text-gray-500">{label}</p>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Alertas activas */}
          {alertSchedules.length > 0 && (
            <Card className="border-amber-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-amber-700 flex items-center gap-2">
                  <Bell className="w-4 h-4" /> Alertas Activas ({alertSchedules.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1.5">
                  {alertSchedules.slice(0, 10).map((s) => {
                    const est = getEstadoProgramacion(s);
                    return (
                      <div key={s.id} className="flex items-center gap-2 text-sm">
                        {est.icon}
                        <span className="font-medium">{s.sitio}</span>
                        <span className="text-gray-400">—</span>
                        <span className="text-xs text-gray-500">{TIPO_LABELS[s.tipo_checklist]}</span>
                        <Badge className={`ml-auto text-[10px] ${est.color} border`}>{est.estado}</Badge>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ═══════════════════ KANBAN VIEW ═══════════════════ */}
      {viewMode === "kanban" && (() => {
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);

        const activeSchedules = schedules.filter((s) => s.activo);

        const kanbanColumns: { key: string; title: string; color: string; bgColor: string; borderColor: string; items: Schedule[] }[] = [
          {
            key: "vencidas",
            title: "Vencidas",
            color: "text-red-700",
            bgColor: "bg-red-50",
            borderColor: "border-red-200",
            items: activeSchedules.filter((s) => {
              const proxima = new Date(s.proxima_fecha + "T00:00:00");
              return proxima < hoy;
            }),
          },
          {
            key: "hoy",
            title: "Hoy",
            color: "text-orange-700",
            bgColor: "bg-orange-50",
            borderColor: "border-orange-200",
            items: activeSchedules.filter((s) => {
              const proxima = new Date(s.proxima_fecha + "T00:00:00");
              return proxima.getTime() === hoy.getTime();
            }),
          },
          {
            key: "proximas",
            title: "Próximas (1-7 días)",
            color: "text-amber-700",
            bgColor: "bg-amber-50",
            borderColor: "border-amber-200",
            items: activeSchedules.filter((s) => {
              const proxima = new Date(s.proxima_fecha + "T00:00:00");
              const diff = Math.ceil((proxima.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
              return diff >= 1 && diff <= 7;
            }),
          },
          {
            key: "programadas",
            title: "Programadas (+7 días)",
            color: "text-blue-700",
            bgColor: "bg-blue-50",
            borderColor: "border-blue-200",
            items: activeSchedules.filter((s) => {
              const proxima = new Date(s.proxima_fecha + "T00:00:00");
              const diff = Math.ceil((proxima.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
              return diff > 7;
            }),
          },
          {
            key: "completadas",
            title: "Con OT Generada",
            color: "text-green-700",
            bgColor: "bg-green-50",
            borderColor: "border-green-200",
            items: activeSchedules.filter((s) => {
              const ots = getOTsForSchedule(s.id);
              return ots.some((ot) => ot.estado === "completada");
            }),
          },
        ];

        return (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
            {kanbanColumns.map((col) => (
              <div key={col.key} className={`rounded-xl border ${col.borderColor} ${col.bgColor} p-3 min-h-[300px]`}>
                {/* Column Header */}
                <div className="flex items-center justify-between mb-3">
                  <h3 className={`text-sm font-bold ${col.color}`}>{col.title}</h3>
                  <Badge variant="outline" className={`text-xs ${col.color} ${col.borderColor}`}>
                    {col.items.length}
                  </Badge>
                </div>

                {/* Cards */}
                <div className="space-y-2">
                  {col.items.length === 0 ? (
                    <p className="text-xs text-gray-400 text-center py-6">Sin programaciones</p>
                  ) : (
                    col.items.map((schedule) => {
                      const otsLinked = getOTsForSchedule(schedule.id);
                      const tecnicoNombre = getTecnicoNombre(schedule.tecnico_id);
                      const supervisorNombre = getTecnicoNombre(schedule.supervisor_id);

                      return (
                        <Card key={schedule.id} className="shadow-sm hover:shadow-md transition-shadow cursor-pointer border border-white/80">
                          <CardContent className="p-3 space-y-2">
                            {/* Tipo badge + Sitio */}
                            <div className="flex items-start justify-between gap-1">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <div className="p-1 rounded bg-gray-100 shrink-0">
                                  {TIPO_ICONS[schedule.tipo_checklist] || <Wrench className="w-3 h-3" />}
                                </div>
                                <span className="text-xs font-semibold text-gray-800 truncate">{schedule.sitio}</span>
                              </div>
                              <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0" onClick={() => openEditDialog(schedule)}>
                                <Edit2 className="w-3 h-3 text-gray-400" />
                              </Button>
                            </div>

                            {/* Tipo y frecuencia */}
                            <div className="flex flex-wrap gap-1">
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                {TIPO_LABELS[schedule.tipo_checklist] || schedule.tipo_checklist}
                              </Badge>
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                {FRECUENCIA_LABELS[schedule.frecuencia]}
                              </Badge>
                            </div>

                            {/* Equipo / Descripción (actividades) */}
                            {schedule.equipo && (
                              <p className="text-[11px] text-gray-600 flex items-center gap-1">
                                <Wrench className="w-3 h-3 text-gray-400 shrink-0" />
                                <span className="truncate">{schedule.equipo}</span>
                              </p>
                            )}
                            {schedule.descripcion && (
                              <p className="text-[11px] text-gray-500 bg-gray-50 rounded px-2 py-1 line-clamp-2">
                                {schedule.descripcion}
                              </p>
                            )}

                            {/* Fecha */}
                            <div className="flex items-center gap-1 text-[10px] text-gray-500">
                              <CalendarDays className="w-3 h-3" />
                              {new Date(schedule.proxima_fecha + "T00:00:00").toLocaleDateString("es-CL")}
                            </div>

                            {/* Técnico y Supervisor */}
                            <div className="border-t pt-1.5 space-y-1">
                              <div className="flex items-center gap-1 text-[10px]">
                                <Users className="w-3 h-3 text-blue-500 shrink-0" />
                                <span className="text-gray-600 font-medium">Técnico:</span>
                                <span className="text-gray-800 truncate">{tecnicoNombre}</span>
                              </div>
                              <div className="flex items-center gap-1 text-[10px]">
                                <Users className="w-3 h-3 text-purple-500 shrink-0" />
                                <span className="text-gray-600 font-medium">Supervisor:</span>
                                <span className="text-gray-800 truncate">{supervisorNombre}</span>
                              </div>
                            </div>

                            {/* OTs vinculadas */}
                            {otsLinked.length > 0 && (
                              <div className="border-t pt-1.5">
                                <div className="flex items-center gap-1 flex-wrap">
                                  <Link2 className="w-3 h-3 text-blue-500" />
                                  {otsLinked.map((ot) => (
                                    <Badge
                                      key={ot.id}
                                      variant="outline"
                                      className={`text-[9px] px-1 py-0 ${
                                        ot.estado === "completada"
                                          ? "border-green-300 text-green-700"
                                          : ot.estado === "en_curso"
                                            ? "border-sky-300 text-sky-700"
                                            : "border-amber-300 text-amber-700"
                                      }`}
                                    >
                                      {ot.numero}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Generar OT si aplica */}
                            {col.key !== "completadas" && (() => {
                              const proxima = new Date(schedule.proxima_fecha + "T00:00:00");
                              const diff = Math.ceil((proxima.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
                              return diff <= 7;
                            })() && (
                              <Button
                                size="sm"
                                className="w-full h-6 text-[10px] gap-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                                onClick={() => openGenerarOTDialog(schedule)}
                                disabled={generatingOTId === schedule.id}
                              >
                                {generatingOTId === schedule.id ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <FileText className="w-3 h-3" />
                                )}
                                Generar OT
                              </Button>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })
                  )}
                </div>
              </div>
            ))}
          </div>
        );
      })()}

      {/* ═══════════════════ LIST VIEW ═══════════════════ */}
      {viewMode === "lista" && (
        <>
          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-3">
            <Select value={filterTipo} onValueChange={setFilterTipo}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los tipos</SelectItem>
                <SelectItem value="mantencion_bms">Mantención BMS</SelectItem>
                <SelectItem value="operacion_bms">Operación BMS</SelectItem>
                <SelectItem value="grupo_electrogeno">Grupo Electrógeno</SelectItem>
                <SelectItem value="preventivo">Preventivo</SelectItem>
                <SelectItem value="correctivo">Correctivo</SelectItem>
                <SelectItem value="predictivo">Predictivo</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterEstado} onValueChange={setFilterEstado}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas</SelectItem>
                <SelectItem value="activas">Activas</SelectItem>
                <SelectItem value="inactivas">Inactivas</SelectItem>
                <SelectItem value="vencidas">Vencidas</SelectItem>
              </SelectContent>
            </Select>

            <Button variant="outline" size="sm" onClick={() => { loadSchedules(); loadOTsVinculadas(); }}>
              <RefreshCw className="w-4 h-4 mr-1" /> Actualizar
            </Button>

            <div className="ml-auto flex gap-2">
              <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
                <DialogTrigger asChild>
                  <Button style={{ backgroundColor: colorPrimario }} className="text-white">
                    <Plus className="w-4 h-4 mr-1" /> Nueva Programación
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>{editingSchedule ? "Editar Programación" : "Nueva Programación"}</DialogTitle>
                    <DialogDescription>
                      Configure los detalles de la programación. Al vencerse, podrá generar una OT automáticamente.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 mt-4">
                    {/* Plantillas buttons */}
                    {!editingSchedule && (
                      <div className="flex gap-2 flex-wrap">
                        <Button type="button" variant="outline" size="sm" className="gap-1 text-xs" onClick={() => setShowLoadPlantillaDialog(true)}>
                          <Copy className="w-3 h-3" /> Cargar Plantilla
                        </Button>
                        <Button type="button" variant="outline" size="sm" className="gap-1 text-xs" onClick={() => { setPlantillaNombre(""); setShowPlantillaDialog(true); }}>
                          <Save className="w-3 h-3" /> Guardar como Plantilla
                        </Button>
                      </div>
                    )}
                    <div>
                      <Label>Tipo de Trabajo *</Label>
                      <Select value={formTipo} onValueChange={setFormTipo}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="preventivo">Preventivo</SelectItem>
                          <SelectItem value="correctivo">Correctivo</SelectItem>
                          <SelectItem value="predictivo">Predictivo</SelectItem>
                          <SelectItem value="mantencion_bms">Mantención BMS</SelectItem>
                          <SelectItem value="operacion_bms">Operación BMS</SelectItem>
                          <SelectItem value="grupo_electrogeno">Grupo Electrógeno</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Sitio / Ubicación *</Label>
                      <Input value={formSitio} onChange={(e) => setFormSitio(e.target.value)} placeholder="Ej: Edificio Central, Piso 3" />
                    </div>
                    <div>
                      <Label>Equipo</Label>
                      <Input value={formEquipo} onChange={(e) => setFormEquipo(e.target.value)} placeholder="Ej: UPS-001, Generador #2" />
                    </div>
                    <div>
                      <Label>Descripción</Label>
                      <Input value={formDescripcion} onChange={(e) => setFormDescripcion(e.target.value)} placeholder="Descripción breve del trabajo" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Frecuencia *</Label>
                        <Select value={formFrecuencia} onValueChange={setFormFrecuencia}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="semanal">Semanal</SelectItem>
                            <SelectItem value="quincenal">Quincenal</SelectItem>
                            <SelectItem value="mensual">Mensual</SelectItem>
                            <SelectItem value="trimestral">Trimestral</SelectItem>
                            <SelectItem value="semestral">Semestral</SelectItem>
                            <SelectItem value="anual">Anual</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Próxima Fecha *</Label>
                        <Input type="date" value={formProximaFecha} onChange={(e) => setFormProximaFecha(e.target.value)} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Técnico Asignado</Label>
                        <Select value={formTecnicoId} onValueChange={setFormTecnicoId}>
                          <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Sin asignar</SelectItem>
                            {tecnicosList.map((t) => (
                              <SelectItem key={String(t.id)} value={String(t.id)}>{t.nombre}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Supervisor</Label>
                        <Select value={formSupervisorId} onValueChange={setFormSupervisorId}>
                          <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Sin asignar</SelectItem>
                            {supervisores.map((t) => (
                              <SelectItem key={String(t.id)} value={String(t.id)}>{t.nombre}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div>
                      <Label>Días de anticipación para alertas</Label>
                      <Select value={formDiasAnticipacion} onValueChange={setFormDiasAnticipacion}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="3">3 días</SelectItem>
                          <SelectItem value="5">5 días</SelectItem>
                          <SelectItem value="7">7 días (recomendado)</SelectItem>
                          <SelectItem value="10">10 días</SelectItem>
                          <SelectItem value="14">14 días</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button onClick={handleSave} disabled={saving} className="w-full text-white" style={{ backgroundColor: colorPrimario }}>
                      {saving ? "Guardando..." : editingSchedule ? "Actualizar" : "Crear Programación"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {/* Schedule List */}
          {filteredSchedules.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">No hay programaciones {filterTipo !== "todos" || filterEstado !== "todos" ? "con estos filtros" : "creadas aún"}</p>
                <p className="text-sm text-gray-400 mt-1">Crea una nueva programación para planificar trabajos preventivos y generar OTs automáticamente</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3">
              {filteredSchedules.map((schedule) => {
                const estadoInfo = getEstadoProgramacion(schedule);
                const otsLinked = getOTsForSchedule(schedule.id);
                const hoy = new Date();
                hoy.setHours(0, 0, 0, 0);
                const proxima = new Date(schedule.proxima_fecha + "T00:00:00");
                const diffDias = Math.ceil((proxima.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
                const puedeGenerarOT = schedule.activo && diffDias <= 7;

                return (
                  <Card key={schedule.id} className={`border ${!schedule.activo ? "opacity-60" : ""}`}>
                    <CardContent className="py-4">
                      <div className="flex flex-col gap-3">
                        {/* Top Row */}
                        <div className="flex flex-col md:flex-row md:items-center gap-3">
                          <div className="flex items-start gap-3 flex-1">
                            <div className="p-2 rounded-lg bg-gray-100 mt-0.5">
                              {TIPO_ICONS[schedule.tipo_checklist] || <Wrench className="w-4 h-4" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-semibold text-gray-800">{schedule.sitio}</span>
                                <Badge variant="outline" className="text-xs">
                                  {TIPO_LABELS[schedule.tipo_checklist] || schedule.tipo_checklist}
                                </Badge>
                                <Badge variant="outline" className="text-xs">
                                  {FRECUENCIA_LABELS[schedule.frecuencia]}
                                </Badge>
                                {!schedule.activo && (
                                  <Badge variant="secondary" className="text-xs">Inactiva</Badge>
                                )}
                              </div>
                              {schedule.equipo && (
                                <p className="text-sm text-gray-500 mt-0.5">Equipo: {schedule.equipo}</p>
                              )}
                              {schedule.descripcion && (
                                <p className="text-sm text-gray-400 mt-0.5">{schedule.descripcion}</p>
                              )}
                              <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
                                <span className="flex items-center gap-1">
                                  <Users className="w-3 h-3" />
                                  {getTecnicoNombre(schedule.tecnico_id)}
                                </span>
                                <span className="flex items-center gap-1">
                                  <CalendarDays className="w-3 h-3" />
                                  {new Date(schedule.proxima_fecha + "T00:00:00").toLocaleDateString("es-CL")}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Status + Actions */}
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge className={`${estadoInfo.color} border flex items-center gap-1`}>
                              {estadoInfo.icon}
                              {estadoInfo.estado}
                            </Badge>
                            <Button variant="ghost" size="icon" onClick={() => openEditDialog(schedule)} title="Editar">
                              <Edit2 className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleToggleActive(schedule)} title={schedule.activo ? "Desactivar" : "Activar"}>
                              {schedule.activo ? <XCircle className="w-4 h-4 text-gray-400" /> : <CheckCircle2 className="w-4 h-4 text-green-500" />}
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleDelete(schedule.id)} title="Eliminar">
                              <Trash2 className="w-4 h-4 text-red-400" />
                            </Button>
                          </div>
                        </div>

                        {/* OTs vinculadas */}
                        {otsLinked.length > 0 && (
                          <div className="flex items-center gap-2 flex-wrap pl-11">
                            <Link2 className="w-3.5 h-3.5 text-blue-500" />
                            <span className="text-xs font-medium text-blue-600">OTs vinculadas:</span>
                            {otsLinked.map((ot) => (
                              <Badge
                                key={ot.id}
                                variant="outline"
                                className={`text-xs ${
                                  ot.estado === "completada"
                                    ? "border-green-300 text-green-700"
                                    : ot.estado === "en_curso"
                                      ? "border-sky-300 text-sky-700"
                                      : ot.estado === "en_revision"
                                        ? "border-purple-300 text-purple-700"
                                        : "border-amber-300 text-amber-700"
                                }`}
                              >
                                {ot.numero} ({ot.estado === "en_curso" ? "En Curso" : ot.estado === "en_revision" ? "En Revisión" : ot.estado === "completada" ? "Completada" : "Pendiente"})
                              </Badge>
                            ))}
                          </div>
                        )}

                        {/* Generar OT Button */}
                        {puedeGenerarOT && (
                          <div className="pl-11">
                            <Button
                              size="sm"
                              onClick={() => openGenerarOTDialog(schedule)}
                              disabled={generatingOTId === schedule.id}
                              className="gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                            >
                              {generatingOTId === schedule.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <FileText className="w-3.5 h-3.5" />
                              )}
                              Generar OT
                            </Button>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Dialog para confirmar generación de OT */}
      <Dialog open={!!confirmGenOT} onOpenChange={(open) => { if (!open) setConfirmGenOT(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-emerald-600" />
              Generar Orden de Trabajo
            </DialogTitle>
            <DialogDescription>
              Se creará una OT vinculada a esta programación. La próxima fecha se actualizará automáticamente según la frecuencia.
            </DialogDescription>
          </DialogHeader>

          {confirmGenOT && (
            <div className="space-y-4 py-2">
              <div className="p-3 bg-slate-50 rounded-lg text-sm space-y-1">
                <p><span className="font-medium">Programación:</span> {confirmGenOT.sitio}</p>
                <p><span className="font-medium">Tipo:</span> {TIPO_LABELS[confirmGenOT.tipo_checklist] || confirmGenOT.tipo_checklist}</p>
                <p><span className="font-medium">Frecuencia:</span> {FRECUENCIA_LABELS[confirmGenOT.frecuencia]}</p>
                {confirmGenOT.equipo && <p><span className="font-medium">Equipo:</span> {confirmGenOT.equipo}</p>}
                <p><span className="font-medium">Técnico:</span> {getTecnicoNombre(confirmGenOT.tecnico_id)}</p>
              </div>

              <div className="space-y-1.5">
                <Label>Cliente / Sitio *</Label>
                <Input
                  value={otCliente}
                  onChange={(e) => setOtCliente(e.target.value)}
                  placeholder="Nombre del cliente"
                />
              </div>

              <div className="space-y-1.5">
                <Label>Descripción de la OT *</Label>
                <Textarea
                  value={otDescripcion}
                  onChange={(e) => setOtDescripcion(e.target.value)}
                  placeholder="Descripción del trabajo"
                  rows={3}
                />
              </div>

              <div className="space-y-1.5">
                <Label>Prioridad</Label>
                <Select value={otPrioridad} onValueChange={(v) => setOtPrioridad(v as "baja" | "media" | "alta")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="baja">Baja</SelectItem>
                    <SelectItem value="media">Media</SelectItem>
                    <SelectItem value="alta">Alta</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setConfirmGenOT(null)}>
              Cancelar
            </Button>
            <Button
              onClick={handleGenerarOT}
              disabled={generatingOTId !== null}
              className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {generatingOTId ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <FileText className="w-4 h-4" />
              )}
              {generatingOTId ? "Generando..." : "Crear OT"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Guardar Plantilla */}
      <Dialog open={showPlantillaDialog} onOpenChange={setShowPlantillaDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Guardar como Plantilla</DialogTitle>
            <DialogDescription>
              Guarde la configuración actual (tipo, frecuencia, descripción, días alerta) como plantilla reutilizable.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label>Nombre de la plantilla *</Label>
              <Input value={plantillaNombre} onChange={(e) => setPlantillaNombre(e.target.value)} placeholder="Ej: Preventivo mensual BMS" />
            </div>
            <div className="text-xs text-muted-foreground p-2 bg-gray-50 rounded">
              <p>Se guardará: <strong>{TIPO_LABELS[formTipo]}</strong>, {FRECUENCIA_LABELS[formFrecuencia]}, {formDiasAnticipacion} días alerta</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPlantillaDialog(false)}>Cancelar</Button>
            <Button onClick={handleSavePlantilla} className="bg-indigo-600 hover:bg-indigo-700 text-white">
              <Save className="w-4 h-4 mr-1" /> Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Cargar Plantilla */}
      <Dialog open={showLoadPlantillaDialog} onOpenChange={setShowLoadPlantillaDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Cargar Plantilla</DialogTitle>
            <DialogDescription>
              Seleccione una plantilla para aplicar su configuración al formulario.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2 max-h-60 overflow-y-auto">
            {plantillas.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No hay plantillas guardadas</p>
            ) : (
              plantillas.map((p) => (
                <div key={p.id} className="flex items-center justify-between border rounded-lg p-2.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{p.nombre}</p>
                    <p className="text-xs text-muted-foreground">
                      {TIPO_LABELS[p.tipo_checklist]} • {FRECUENCIA_LABELS[p.frecuencia]} • {p.dias_anticipacion_alerta}d alerta
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => handleLoadPlantilla(p)} className="h-7 text-xs text-blue-600">
                      Aplicar
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => handleDeletePlantilla(p.id)} className="h-7 w-7 p-0 text-red-400">
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLoadPlantillaDialog(false)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}