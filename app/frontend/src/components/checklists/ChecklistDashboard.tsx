import { useState, useEffect, useMemo } from "react";
import { useEmpresa } from "@/lib/empresaContext";
import type { Usuario } from "@/lib/types";
import { SUPABASE_URL, SUPABASE_KEY, SUPABASE_SERVICE_KEY } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BarChart3,
  ClipboardCheck,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Wrench,
  TrendingUp,
  Filter,
  Users,
  Calendar,
} from "lucide-react";

interface ChecklistRecord {
  id: string;
  empresa_id: string;
  tecnico_id: string;
  estado: string;
  tipo?: string;
  informacion_general: Record<string, unknown>;
  resultado_final?: Record<string, unknown>;
  hallazgos_data?: { criticidad: string; tipos: string[] }[];
  created_at: string;
  hora_creacion?: string;
  hora_cierre?: string;
  region?: string;
}

interface Props {
  user: Usuario;
  token: string;
}

export default function ChecklistDashboard({ user, token }: Props) {
  const { empresa, colorPrimario } = useEmpresa();
  const [records, setRecords] = useState<ChecklistRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [tecnicos, setTecnicos] = useState<{ id: string; nombre: string }[]>([]);

  // Filters
  const [fechaDesde, setFechaDesde] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 3);
    return d.toISOString().split("T")[0];
  });
  const [fechaHasta, setFechaHasta] = useState(() => new Date().toISOString().split("T")[0]);
  const [tecnicoFilter, setTecnicoFilter] = useState("todos");
  const [tipoFilter, setTipoFilter] = useState("todos");

  useEffect(() => {
    fetchRecords();
    fetchTecnicos();
  }, [empresa]);

  async function fetchRecords() {
    if (!empresa) return;
    setLoading(true);
    try {
      const serviceKey = SUPABASE_SERVICE_KEY || SUPABASE_KEY;
      const url = `${SUPABASE_URL}/rest/v1/checklist_bms?empresa_id=eq.${empresa.id}&order=created_at.desc&limit=500`;
      const res = await fetch(url, {
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
          "Content-Type": "application/json",
        },
      });
      if (res.ok) {
        const data = await res.json();
        setRecords(data || []);
      }
    } catch (err) {
      console.error("Error fetching checklists for dashboard:", err);
    }
    setLoading(false);
  }

  async function fetchTecnicos() {
    if (!empresa) return;
    try {
      const serviceKey = SUPABASE_SERVICE_KEY || SUPABASE_KEY;
      const url = `${SUPABASE_URL}/rest/v1/usuarios?empresa_id=eq.${empresa.id}&select=id,nombre&order=nombre.asc`;
      const res = await fetch(url, {
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
          "Content-Type": "application/json",
        },
      });
      if (res.ok) {
        const data = await res.json();
        setTecnicos(data || []);
      }
    } catch {
      // silently fail
    }
  }

  // Filtered records
  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      // Date filter
      const recordDate = r.hora_creacion
        ? r.hora_creacion.split(",")[0]?.trim()
        : r.created_at.split("T")[0];
      // Parse date - handle dd-mm-yyyy and yyyy-mm-dd formats
      let dateStr = recordDate;
      if (recordDate && recordDate.includes("-") && recordDate.split("-")[0].length === 2) {
        // dd-mm-yyyy format -> convert to yyyy-mm-dd
        const parts = recordDate.split("-");
        dateStr = `${parts[2]}-${parts[1]}-${parts[0]}`;
      }
      // Also handle dd/mm/yyyy
      if (recordDate && recordDate.includes("/")) {
        const parts = recordDate.split("/");
        dateStr = `${parts[2]}-${parts[1]}-${parts[0]}`;
      }

      if (fechaDesde && dateStr < fechaDesde) return false;
      if (fechaHasta && dateStr > fechaHasta) return false;

      // Tecnico filter - match by tecnico_id or by name in informacion_general
      if (tecnicoFilter !== "todos") {
        const tecnicoMatch = r.tecnico_id === tecnicoFilter;
        // Also check by name in case tecnico_id doesn't match
        const selectedTecnico = tecnicos.find((t) => t.id === tecnicoFilter);
        const nameInRecord =
          (r.informacion_general?.tecnico_responsable as string) ||
          (r.informacion_general?.operador as string) ||
          "";
        const nameMatch = selectedTecnico
          ? nameInRecord.toLowerCase().includes(selectedTecnico.nombre.toLowerCase())
          : false;
        if (!tecnicoMatch && !nameMatch) return false;
      }

      // Tipo filter
      if (tipoFilter === "mantencion" && r.tipo === "operacion_bms") return false;
      if (tipoFilter === "operacion" && r.tipo !== "operacion_bms") return false;

      return true;
    });
  }, [records, fechaDesde, fechaHasta, tecnicoFilter, tipoFilter, tecnicos]);

  // KPIs
  const kpis = useMemo(() => {
    const total = filteredRecords.length;
    const finalizados = filteredRecords.filter((r) => r.estado === "finalizado").length;
    const borradores = filteredRecords.filter((r) => r.estado === "borrador").length;
    const enProceso = filteredRecords.filter((r) => r.estado === "en_proceso").length;

    // Resultado breakdown (only for mantención)
    const mantencionRecords = filteredRecords.filter((r) => r.tipo !== "operacion_bms");
    const operativos = mantencionRecords.filter(
      (r) => (r.resultado_final as Record<string, string>)?.estado_general === "operativo"
    ).length;
    const conObs = mantencionRecords.filter(
      (r) => (r.resultado_final as Record<string, string>)?.estado_general === "operativo_obs"
    ).length;
    const requiereCorrectivo = mantencionRecords.filter(
      (r) => (r.resultado_final as Record<string, string>)?.estado_general === "requiere_correctivo"
    ).length;
    const fueraServicio = mantencionRecords.filter(
      (r) => (r.resultado_final as Record<string, string>)?.estado_general === "fuera_servicio"
    ).length;

    // Hallazgos
    let totalHallazgos = 0;
    let hallazgosCriticos = 0;
    let hallazgosAltos = 0;
    for (const r of filteredRecords) {
      const hallazgos = r.hallazgos_data || [];
      totalHallazgos += hallazgos.length;
      for (const h of hallazgos) {
        if (h.criticidad === "critica") hallazgosCriticos++;
        if (h.criticidad === "alta") hallazgosAltos++;
      }
    }

    // MTTR (Mean Time To Repair) - Average time from creation to closure for finalized checklists
    let mttrMinutes = 0;
    let mttrCount = 0;
    for (const r of filteredRecords) {
      if (r.estado === "finalizado" && r.hora_creacion && r.hora_cierre) {
        const start = parseDateTime(r.hora_creacion);
        const end = parseDateTime(r.hora_cierre);
        if (start && end && end > start) {
          mttrMinutes += (end.getTime() - start.getTime()) / (1000 * 60);
          mttrCount++;
        }
      }
    }
    const mttr = mttrCount > 0 ? mttrMinutes / mttrCount : 0;

    // MTBF (Mean Time Between Failures) - Average time between checklists that found issues
    const failureRecords = filteredRecords
      .filter((r) => {
        const estado = (r.resultado_final as Record<string, string>)?.estado_general;
        return estado === "requiere_correctivo" || estado === "fuera_servicio";
      })
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    let mtbfHours = 0;
    let mtbfCount = 0;
    for (let i = 1; i < failureRecords.length; i++) {
      const prev = new Date(failureRecords[i - 1].created_at).getTime();
      const curr = new Date(failureRecords[i].created_at).getTime();
      if (curr > prev) {
        mtbfHours += (curr - prev) / (1000 * 60 * 60);
        mtbfCount++;
      }
    }
    const mtbf = mtbfCount > 0 ? mtbfHours / mtbfCount : 0;

    // Checklists per technician
    const perTecnico: Record<string, number> = {};
    for (const r of filteredRecords) {
      const tecName =
        (r.informacion_general?.tecnico_responsable as string) ||
        (r.informacion_general?.operador as string) ||
        "Sin asignar";
      perTecnico[tecName] = (perTecnico[tecName] || 0) + 1;
    }

    // Monthly trend
    const monthlyTrend: Record<string, number> = {};
    for (const r of filteredRecords) {
      const date = new Date(r.created_at);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      monthlyTrend[key] = (monthlyTrend[key] || 0) + 1;
    }

    return {
      total,
      finalizados,
      borradores,
      enProceso,
      operativos,
      conObs,
      requiereCorrectivo,
      fueraServicio,
      totalHallazgos,
      hallazgosCriticos,
      hallazgosAltos,
      mttr,
      mtbf,
      perTecnico,
      monthlyTrend,
    };
  }, [filteredRecords]);

  function parseDateTime(str: string): Date | null {
    if (!str) return null;
    // Try common formats: "dd-mm-yyyy, HH:MM:SS" or "dd/mm/yyyy HH:MM:SS"
    const cleaned = str.replace(",", "").trim();
    const parts = cleaned.split(/[\s]+/);
    if (parts.length >= 2) {
      let datePart = parts[0];
      const timePart = parts[1];
      // Convert dd-mm-yyyy or dd/mm/yyyy to yyyy-mm-dd
      if (datePart.includes("/") || (datePart.includes("-") && datePart.split("-")[0].length <= 2)) {
        const sep = datePart.includes("/") ? "/" : "-";
        const dp = datePart.split(sep);
        datePart = `${dp[2]}-${dp[1]}-${dp[0]}`;
      }
      const d = new Date(`${datePart}T${timePart}`);
      if (!isNaN(d.getTime())) return d;
    }
    // Fallback: try direct parse
    const d = new Date(str);
    return isNaN(d.getTime()) ? null : d;
  }

  function formatMTTR(minutes: number): string {
    if (minutes === 0) return "N/A";
    if (minutes < 60) return `${Math.round(minutes)} min`;
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    if (hours < 24) return `${hours}h ${mins}m`;
    const days = Math.floor(hours / 24);
    const remainHours = hours % 24;
    return `${days}d ${remainHours}h`;
  }

  function formatMTBF(hours: number): string {
    if (hours === 0) return "N/A";
    if (hours < 24) return `${Math.round(hours)} horas`;
    const days = Math.round(hours / 24);
    if (days < 30) return `${days} días`;
    const months = Math.round(days / 30);
    return `${months} mes${months > 1 ? "es" : ""}`;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  const sortedTecnicos = Object.entries(kpis.perTecnico).sort((a, b) => b[1] - a[1]);
  const sortedMonths = Object.entries(kpis.monthlyTrend).sort((a, b) => a[0].localeCompare(b[0]));
  const maxMonthly = Math.max(...sortedMonths.map(([, v]) => v), 1);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <BarChart3 className="w-6 h-6" style={{ color: colorPrimario }} />
        <h2 className="text-xl font-bold text-gray-800">Dashboard CheckList</h2>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Filter className="w-4 h-4" /> Filtros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="space-y-1">
              <Label className="text-xs flex items-center gap-1">
                <Calendar className="w-3 h-3" /> Desde
              </Label>
              <Input
                type="date"
                value={fechaDesde}
                onChange={(e) => setFechaDesde(e.target.value)}
                className="text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs flex items-center gap-1">
                <Calendar className="w-3 h-3" /> Hasta
              </Label>
              <Input
                type="date"
                value={fechaHasta}
                onChange={(e) => setFechaHasta(e.target.value)}
                className="text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs flex items-center gap-1">
                <Users className="w-3 h-3" /> Técnico
              </Label>
              <Select value={tecnicoFilter} onValueChange={setTecnicoFilter}>
                <SelectTrigger className="text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos los técnicos</SelectItem>
                  {tecnicos.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs flex items-center gap-1">
                <ClipboardCheck className="w-3 h-3" /> Tipo
              </Label>
              <Select value={tipoFilter} onValueChange={setTipoFilter}>
                <SelectTrigger className="text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="mantencion">Mantención BMS</SelectItem>
                  <SelectItem value="operacion">Operación BMS</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPI Cards Row 1 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="text-center py-4">
          <div className="flex flex-col items-center gap-1">
            <div className="w-10 h-10 rounded-full flex items-center justify-center bg-blue-100 text-blue-600">
              <ClipboardCheck className="w-5 h-5" />
            </div>
            <p className="text-2xl font-bold text-slate-800">{kpis.total}</p>
            <p className="text-xs text-muted-foreground">Checklists Ejecutados</p>
          </div>
        </Card>
        <Card className="text-center py-4">
          <div className="flex flex-col items-center gap-1">
            <div className="w-10 h-10 rounded-full flex items-center justify-center bg-green-100 text-green-600">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <p className="text-2xl font-bold text-slate-800">{kpis.finalizados}</p>
            <p className="text-xs text-muted-foreground">Finalizados</p>
          </div>
        </Card>
        <Card className="text-center py-4">
          <div className="flex flex-col items-center gap-1">
            <div className="w-10 h-10 rounded-full flex items-center justify-center bg-amber-100 text-amber-600">
              <Clock className="w-5 h-5" />
            </div>
            <p className="text-2xl font-bold text-slate-800">{formatMTTR(kpis.mttr)}</p>
            <p className="text-xs text-muted-foreground">MTTR (Tiempo Medio Reparación)</p>
          </div>
        </Card>
        <Card className="text-center py-4">
          <div className="flex flex-col items-center gap-1">
            <div className="w-10 h-10 rounded-full flex items-center justify-center bg-purple-100 text-purple-600">
              <TrendingUp className="w-5 h-5" />
            </div>
            <p className="text-2xl font-bold text-slate-800">{formatMTBF(kpis.mtbf)}</p>
            <p className="text-xs text-muted-foreground">MTBF (Tiempo Medio Entre Fallas)</p>
          </div>
        </Card>
      </div>

      {/* KPI Cards Row 2 - Resultados */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="border-l-4 border-l-green-500">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Operativos</p>
                <p className="text-xl font-bold text-green-600">{kpis.operativos}</p>
              </div>
              <CheckCircle2 className="w-6 h-6 text-green-400" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-amber-500">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Con Observaciones</p>
                <p className="text-xl font-bold text-amber-600">{kpis.conObs}</p>
              </div>
              <AlertTriangle className="w-6 h-6 text-amber-400" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-orange-500">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Requiere Correctivo</p>
                <p className="text-xl font-bold text-orange-600">{kpis.requiereCorrectivo}</p>
              </div>
              <Wrench className="w-6 h-6 text-orange-400" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-red-500">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Fuera de Servicio</p>
                <p className="text-xl font-bold text-red-600">{kpis.fueraServicio}</p>
              </div>
              <AlertTriangle className="w-6 h-6 text-red-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Hallazgos Summary */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Resumen de Hallazgos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Total:</span>
              <Badge variant="outline" className="text-sm font-bold">{kpis.totalHallazgos}</Badge>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Críticos:</span>
              <Badge className="bg-red-500 text-white text-sm">{kpis.hallazgosCriticos}</Badge>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Altos:</span>
              <Badge className="bg-orange-500 text-white text-sm">{kpis.hallazgosAltos}</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Monthly Trend */}
      {sortedMonths.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Tendencia Mensual de Checklists</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {sortedMonths.slice(-6).map(([month, count]) => {
                const [y, m] = month.split("-");
                const monthNames = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
                const label = `${monthNames[parseInt(m) - 1]} ${y}`;
                const pct = (count / maxMonthly) * 100;
                return (
                  <div key={month} className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground w-16 shrink-0">{label}</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-5 relative overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${pct}%`, backgroundColor: colorPrimario || "#3b82f6" }}
                      />
                    </div>
                    <span className="text-xs font-bold text-slate-700 w-8 text-right">{count}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Per Technician */}
      {sortedTecnicos.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Checklists por Técnico</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {sortedTecnicos.slice(0, 10).map(([name, count]) => {
                const maxTec = sortedTecnicos[0][1];
                const pct = (count / maxTec) * 100;
                return (
                  <div key={name} className="flex items-center gap-3">
                    <span className="text-xs text-slate-700 w-32 truncate shrink-0">{name}</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-4 relative overflow-hidden">
                      <div
                        className="h-full rounded-full bg-blue-500 transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-xs font-bold text-slate-700 w-6 text-right">{count}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Estado breakdown */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Distribución por Estado</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 flex-wrap">
            {kpis.finalizados > 0 && (
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <span className="text-xs">Finalizados: {kpis.finalizados}</span>
              </div>
            )}
            {kpis.borradores > 0 && (
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-gray-400" />
                <span className="text-xs">Borradores: {kpis.borradores}</span>
              </div>
            )}
            {kpis.enProceso > 0 && (
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-blue-500" />
                <span className="text-xs">En Proceso: {kpis.enProceso}</span>
              </div>
            )}
          </div>
          {/* Visual bar */}
          {kpis.total > 0 && (
            <div className="flex h-4 rounded-full overflow-hidden mt-3">
              {kpis.finalizados > 0 && (
                <div
                  className="bg-green-500 transition-all"
                  style={{ width: `${(kpis.finalizados / kpis.total) * 100}%` }}
                />
              )}
              {kpis.enProceso > 0 && (
                <div
                  className="bg-blue-500 transition-all"
                  style={{ width: `${(kpis.enProceso / kpis.total) * 100}%` }}
                />
              )}
              {kpis.borradores > 0 && (
                <div
                  className="bg-gray-400 transition-all"
                  style={{ width: `${(kpis.borradores / kpis.total) * 100}%` }}
                />
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}