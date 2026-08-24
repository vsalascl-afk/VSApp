import { useState, useEffect, useMemo } from "react";
import { useEmpresa } from "@/lib/empresaContext";
import type { Usuario } from "@/lib/types";
import { SUPABASE_URL, SUPABASE_KEY, SUPABASE_SERVICE_KEY } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
  nombre: string;
  rol: string;
}

interface Props {
  user: Usuario;
  token: string;
}

const TIPO_LABELS: Record<string, string> = {
  mantencion_bms: "Mantención BMS",
  operacion_bms: "Operación BMS",
  grupo_electrogeno: "Grupo Electrógeno",
};

const TIPO_ICONS: Record<string, React.ReactNode> = {
  mantencion_bms: <Wrench className="w-4 h-4" />,
  operacion_bms: <Monitor className="w-4 h-4" />,
  grupo_electrogeno: <Zap className="w-4 h-4" />,
};

const FRECUENCIA_LABELS: Record<string, string> = {
  semanal: "Semanal",
  quincenal: "Quincenal",
  mensual: "Mensual",
  trimestral: "Trimestral",
  semestral: "Semestral",
  anual: "Anual",
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

export default function ChecklistProgramacion({ user, token }: Props) {
  const { empresa, colorPrimario } = useEmpresa();
  const { toast } = useToast();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [tecnicos, setTecnicos] = useState<Tecnico[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);
  const [filterTipo, setFilterTipo] = useState<string>("todos");
  const [filterEstado, setFilterEstado] = useState<string>("todos");

  // Form state
  const [formTipo, setFormTipo] = useState("mantencion_bms");
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

  useEffect(() => {
    if (empresa) {
      loadSchedules();
      loadTecnicos();
    }
  }, [empresa]);

  async function loadSchedules() {
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
  }

  async function loadTecnicos() {
    if (!empresa) return;
    try {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/usuarios?empresa_id=eq.${empresa.id}&select=id,nombre,rol`,
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
  }

  function resetForm() {
    setFormTipo("mantencion_bms");
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
    } catch (err) {
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

  // Stats
  const stats = useMemo(() => {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const activas = schedules.filter((s) => s.activo);
    const vencidas = activas.filter((s) => new Date(s.proxima_fecha + "T00:00:00") < hoy);
    const proximas7d = activas.filter((s) => {
      const diff = Math.ceil((new Date(s.proxima_fecha + "T00:00:00").getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
      return diff >= 0 && diff <= 7;
    });
    return { total: activas.length, vencidas: vencidas.length, proximas7d: proximas7d.length };
  }, [schedules]);

  const getTecnicoNombre = (id: string | null) => {
    if (!id) return "Sin asignar";
    return tecnicos.find((t) => String(t.id) === String(id))?.nombre || "Desconocido";
  };

  const supervisores = tecnicos.filter((t) => t.rol === "supervisor" || t.rol === "admin" || t.rol === "superadmin");
  const tecnicosList = tecnicos.filter((t) => t.rol === "tecnico" || t.rol === "supervisor");

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header + Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-100">
              <Calendar className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.total}</p>
              <p className="text-sm text-gray-500">Programaciones activas</p>
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
              <p className="text-sm text-gray-500">Próximas 7 días</p>
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
              <p className="text-sm text-gray-500">Vencidas</p>
            </div>
          </CardContent>
        </Card>
      </div>

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

        <Button variant="outline" size="sm" onClick={loadSchedules}>
          <RefreshCw className="w-4 h-4 mr-1" /> Actualizar
        </Button>

        <div className="ml-auto">
          <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button style={{ backgroundColor: colorPrimario }}>
                <Plus className="w-4 h-4 mr-1" /> Nueva Programación
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingSchedule ? "Editar Programación" : "Nueva Programación"}</DialogTitle>
                <DialogDescription>
                  Configure los detalles de la programación de mantenimiento preventivo.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div>
                  <Label>Tipo de Checklist *</Label>
                  <Select value={formTipo} onValueChange={setFormTipo}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
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
                  <Input value={formDescripcion} onChange={(e) => setFormDescripcion(e.target.value)} placeholder="Descripción breve de la mantención" />
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
                <Button onClick={handleSave} disabled={saving} className="w-full" style={{ backgroundColor: colorPrimario }}>
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
            <p className="text-sm text-gray-400 mt-1">Crea una nueva programación para comenzar el plan de mantenimiento preventivo</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {filteredSchedules.map((schedule) => {
            const estadoInfo = getEstadoProgramacion(schedule);
            return (
              <Card key={schedule.id} className={`border ${!schedule.activo ? "opacity-60" : ""}`}>
                <CardContent className="py-4">
                  <div className="flex flex-col md:flex-row md:items-center gap-3">
                    {/* Left: Type icon + info */}
                    <div className="flex items-start gap-3 flex-1">
                      <div className="p-2 rounded-lg bg-gray-100 mt-0.5">
                        {TIPO_ICONS[schedule.tipo_checklist]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-gray-800">{schedule.sitio}</span>
                          <Badge variant="outline" className="text-xs">
                            {TIPO_LABELS[schedule.tipo_checklist]}
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

                    {/* Right: Status + Actions */}
                    <div className="flex items-center gap-2">
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
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}