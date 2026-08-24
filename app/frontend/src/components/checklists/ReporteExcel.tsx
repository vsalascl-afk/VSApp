import { useState, useEffect } from "react";
import { useEmpresa } from "@/lib/empresaContext";
import type { Usuario } from "@/lib/types";
import { SUPABASE_URL, SUPABASE_KEY, SUPABASE_SERVICE_KEY } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { FileSpreadsheet, Download, Filter, Calendar, Loader2 } from "lucide-react";
import * as XLSX from "xlsx";

interface ReporteExcelProps {
  user: Usuario;
  token: string;
}

interface ChecklistData {
  id: string;
  empresa_id: string;
  tipo: string;
  estado: string;
  created_at: string;
  tecnico_nombre?: string;
  informacion_general?: Record<string, unknown>;
  hallazgos_data?: Array<Record<string, unknown>>;
  resultado_final?: Record<string, unknown>;
  especialidades_data?: Array<Record<string, unknown>>;
  bitacora?: string;
  hora_creacion?: string;
  hora_cierre?: string;
  inspeccion_visual?: Record<string, unknown>;
  inspeccion_electrica?: Record<string, unknown>;
  redes_comunicacion?: Record<string, unknown>;
  software_bms?: Record<string, unknown>;
  respaldos_data?: Record<string, unknown>;
  pruebas_funcionales?: Record<string, unknown>;
}

type FiltroPeriodo = "dia" | "semana" | "mes" | "anio" | "personalizado";

export default function ReporteExcel({ user, token }: ReporteExcelProps) {
  const { empresa, colorPrimario } = useEmpresa();
  const { toast } = useToast();
  const [periodo, setPeriodo] = useState<FiltroPeriodo>("mes");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [loading, setLoading] = useState(false);
  const [checklists, setChecklists] = useState<ChecklistData[]>([]);
  const [dataLoaded, setDataLoaded] = useState(false);

  // Set default dates based on period
  useEffect(() => {
    const now = new Date();
    let desde: Date;
    const hasta = new Date(now);

    switch (periodo) {
      case "dia":
        desde = new Date(now);
        desde.setHours(0, 0, 0, 0);
        break;
      case "semana":
        desde = new Date(now);
        desde.setDate(desde.getDate() - 7);
        break;
      case "mes":
        desde = new Date(now);
        desde.setMonth(desde.getMonth() - 1);
        break;
      case "anio":
        desde = new Date(now);
        desde.setFullYear(desde.getFullYear() - 1);
        break;
      case "personalizado":
        return; // Don't auto-set dates
    }

    setFechaDesde(desde.toISOString().split("T")[0]);
    setFechaHasta(hasta.toISOString().split("T")[0]);
  }, [periodo]);

  async function fetchData() {
    if (!empresa || !fechaDesde || !fechaHasta) {
      toast({ title: "Error", description: "Seleccione un rango de fechas válido", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const authKey = SUPABASE_SERVICE_KEY || token;
      const apiKey = SUPABASE_SERVICE_KEY || SUPABASE_KEY;

      const fromDate = `${fechaDesde}T00:00:00`;
      const toDate = `${fechaHasta}T23:59:59`;

      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/checklist_bms?empresa_id=eq.${empresa.id}&created_at=gte.${fromDate}&created_at=lte.${toDate}&order=created_at.desc`,
        {
          headers: {
            apikey: apiKey,
            Authorization: `Bearer ${authKey}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (res.ok) {
        const data = await res.json();
        setChecklists(data || []);
        setDataLoaded(true);
        toast({ title: "Datos cargados", description: `${data.length} registros encontrados` });
      } else {
        toast({ title: "Error", description: "No se pudieron obtener los datos", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Error de conexión", variant: "destructive" });
    }
    setLoading(false);
  }

  function generateExcel() {
    if (checklists.length === 0) {
      toast({ title: "Sin datos", description: "No hay datos para exportar en el período seleccionado", variant: "destructive" });
      return;
    }

    const wb = XLSX.utils.book_new();
    const empresaNombre = empresa?.nombre || "VSApp";

    // ===== HOJA 1: RESUMEN EJECUTIVO =====
    const totalChecklists = checklists.length;
    const completados = checklists.filter(c => c.estado === "completado").length;
    const enProceso = checklists.filter(c => c.estado === "borrador" || c.estado === "en_proceso").length;
    const mantencion = checklists.filter(c => c.tipo === "mantencion_bms").length;
    const operacion = checklists.filter(c => c.tipo === "operacion_bms").length;
    const cumplimiento = totalChecklists > 0 ? Math.round((completados / totalChecklists) * 100) : 0;

    // Count hallazgos by criticality
    let hallazgosCriticos = 0;
    let hallazgosAltos = 0;
    let hallazgosMedios = 0;
    let hallazgosBajos = 0;
    let totalHallazgos = 0;

    checklists.forEach(c => {
      if (c.hallazgos_data && Array.isArray(c.hallazgos_data)) {
        c.hallazgos_data.forEach((h: Record<string, unknown>) => {
          totalHallazgos++;
          const crit = (h.criticidad as string || "").toLowerCase();
          if (crit === "critica" || crit === "crítica") hallazgosCriticos++;
          else if (crit === "alta") hallazgosAltos++;
          else if (crit === "media") hallazgosMedios++;
          else hallazgosBajos++;
        });
      }
    });

    const resumenData = [
      ["REPORTE EJECUTIVO PMP", "", "", ""],
      ["Empresa:", empresaNombre, "", ""],
      ["Período:", `${fechaDesde} al ${fechaHasta}`, "", ""],
      ["Generado:", new Date().toLocaleString("es-CL"), "", ""],
      ["", "", "", ""],
      ["INDICADORES CLAVE (KPIs)", "", "", ""],
      ["", "", "", ""],
      ["Indicador", "Valor", "Meta", "Estado"],
      ["Total Checklists", totalChecklists, "-", "-"],
      ["Completados", completados, "-", cumplimiento >= 80 ? "✓ OK" : "⚠ Bajo"],
      ["En Proceso", enProceso, "-", "-"],
      ["% Cumplimiento", `${cumplimiento}%`, "80%", cumplimiento >= 80 ? "✓ OK" : "⚠ Bajo"],
      ["Mantención BMS", mantencion, "-", "-"],
      ["Operación BMS", operacion, "-", "-"],
      ["", "", "", ""],
      ["HALLAZGOS", "", "", ""],
      ["", "", "", ""],
      ["Criticidad", "Cantidad", "% del Total", ""],
      ["Crítica", hallazgosCriticos, totalHallazgos > 0 ? `${Math.round((hallazgosCriticos / totalHallazgos) * 100)}%` : "0%", ""],
      ["Alta", hallazgosAltos, totalHallazgos > 0 ? `${Math.round((hallazgosAltos / totalHallazgos) * 100)}%` : "0%", ""],
      ["Media", hallazgosMedios, totalHallazgos > 0 ? `${Math.round((hallazgosMedios / totalHallazgos) * 100)}%` : "0%", ""],
      ["Baja", hallazgosBajos, totalHallazgos > 0 ? `${Math.round((hallazgosBajos / totalHallazgos) * 100)}%` : "0%", ""],
      ["Total Hallazgos", totalHallazgos, "100%", ""],
    ];

    const wsResumen = XLSX.utils.aoa_to_sheet(resumenData);
    wsResumen["!cols"] = [{ wch: 22 }, { wch: 20 }, { wch: 15 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, wsResumen, "Resumen Ejecutivo");

    // ===== HOJA 2: DETALLE CHECKLISTS =====
    const checklistRows = checklists.map(c => {
      const infoGen = c.informacion_general as Record<string, string> || {};
      const resultado = c.resultado_final as Record<string, string> || {};
      return {
        "ID": c.id.substring(0, 8),
        "Tipo": c.tipo === "mantencion_bms" ? "Mantención BMS" : "Operación BMS",
        "Estado": c.estado === "completado" ? "Completado" : c.estado === "borrador" ? "Borrador" : c.estado,
        "Fecha Creación": c.hora_creacion || c.created_at?.split("T")[0] || "",
        "Fecha Cierre": c.hora_cierre || "",
        "Técnico": c.tecnico_nombre || infoGen.tecnico_responsable || infoGen.operador || "",
        "Ubicación": infoGen.ubicacion || infoGen.edificio || "",
        "Equipo/Sistema": infoGen.equipo || infoGen.sistema || "",
        "Resultado": resultado.estado_general || resultado.resultado || "",
        "Observaciones": resultado.observaciones || resultado.comentarios || "",
      };
    });

    const wsChecklists = XLSX.utils.json_to_sheet(checklistRows);
    wsChecklists["!cols"] = [
      { wch: 10 }, { wch: 16 }, { wch: 12 }, { wch: 14 },
      { wch: 14 }, { wch: 20 }, { wch: 20 }, { wch: 20 },
      { wch: 15 }, { wch: 30 },
    ];
    XLSX.utils.book_append_sheet(wb, wsChecklists, "Checklists");

    // ===== HOJA 3: HALLAZGOS =====
    const hallazgosRows: Array<Record<string, string>> = [];
    checklists.forEach(c => {
      if (c.hallazgos_data && Array.isArray(c.hallazgos_data)) {
        const infoGen = c.informacion_general as Record<string, string> || {};
        c.hallazgos_data.forEach((h: Record<string, unknown>) => {
          hallazgosRows.push({
            "Checklist ID": c.id.substring(0, 8),
            "Tipo": c.tipo === "mantencion_bms" ? "Mantención" : "Operación",
            "Fecha": c.created_at?.split("T")[0] || "",
            "Técnico": c.tecnico_nombre || infoGen.tecnico_responsable || "",
            "Ubicación": infoGen.ubicacion || "",
            "Hallazgo": (h.descripcion as string) || (h.hallazgo as string) || "",
            "Criticidad": (h.criticidad as string) || "",
            "Acción Requerida": (h.accion as string) || (h.accion_correctiva as string) || "",
            "Responsable": (h.responsable as string) || "",
            "Fecha Límite": (h.fecha_limite as string) || "",
            "Estado": (h.estado as string) || "Pendiente",
          });
        });
      }
    });

    if (hallazgosRows.length > 0) {
      const wsHallazgos = XLSX.utils.json_to_sheet(hallazgosRows);
      wsHallazgos["!cols"] = [
        { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 18 },
        { wch: 18 }, { wch: 35 }, { wch: 10 }, { wch: 30 },
        { wch: 18 }, { wch: 12 }, { wch: 12 },
      ];
      XLSX.utils.book_append_sheet(wb, wsHallazgos, "Hallazgos");
    } else {
      const wsHallazgos = XLSX.utils.aoa_to_sheet([
        ["No se encontraron hallazgos en el período seleccionado"],
      ]);
      XLSX.utils.book_append_sheet(wb, wsHallazgos, "Hallazgos");
    }

    // ===== HOJA 4: RECURSOS / TÉCNICOS =====
    const tecnicoMap: Record<string, { nombre: string; mantencion: number; operacion: number; completados: number; hallazgos: number }> = {};
    checklists.forEach(c => {
      const infoGen = c.informacion_general as Record<string, string> || {};
      const nombre = c.tecnico_nombre || infoGen.tecnico_responsable || infoGen.operador || "Sin asignar";
      if (!tecnicoMap[nombre]) {
        tecnicoMap[nombre] = { nombre, mantencion: 0, operacion: 0, completados: 0, hallazgos: 0 };
      }
      if (c.tipo === "mantencion_bms") tecnicoMap[nombre].mantencion++;
      else tecnicoMap[nombre].operacion++;
      if (c.estado === "completado") tecnicoMap[nombre].completados++;
      if (c.hallazgos_data && Array.isArray(c.hallazgos_data)) {
        tecnicoMap[nombre].hallazgos += c.hallazgos_data.length;
      }
    });

    const recursosRows = Object.values(tecnicoMap).map(t => ({
      "Técnico": t.nombre,
      "Mantención BMS": t.mantencion,
      "Operación BMS": t.operacion,
      "Total Checklists": t.mantencion + t.operacion,
      "Completados": t.completados,
      "% Cumplimiento": t.mantencion + t.operacion > 0 ? `${Math.round((t.completados / (t.mantencion + t.operacion)) * 100)}%` : "0%",
      "Hallazgos Reportados": t.hallazgos,
    }));

    const wsRecursos = XLSX.utils.json_to_sheet(recursosRows);
    wsRecursos["!cols"] = [
      { wch: 22 }, { wch: 16 }, { wch: 14 }, { wch: 16 },
      { wch: 12 }, { wch: 16 }, { wch: 20 },
    ];
    XLSX.utils.book_append_sheet(wb, wsRecursos, "Recursos");

    // ===== HOJA 5: TENDENCIAS =====
    const tendenciaMap: Record<string, { fecha: string; total: number; completados: number; hallazgos: number; mantencion: number; operacion: number }> = {};
    checklists.forEach(c => {
      let key: string;
      const fecha = c.created_at?.split("T")[0] || "";
      if (periodo === "dia") {
        key = fecha;
      } else if (periodo === "semana") {
        // Group by week
        const d = new Date(fecha);
        const weekStart = new Date(d);
        weekStart.setDate(d.getDate() - d.getDay());
        key = weekStart.toISOString().split("T")[0];
      } else if (periodo === "anio") {
        // Group by month
        key = fecha.substring(0, 7); // YYYY-MM
      } else {
        // Group by day for month/custom
        key = fecha;
      }

      if (!tendenciaMap[key]) {
        tendenciaMap[key] = { fecha: key, total: 0, completados: 0, hallazgos: 0, mantencion: 0, operacion: 0 };
      }
      tendenciaMap[key].total++;
      if (c.estado === "completado") tendenciaMap[key].completados++;
      if (c.hallazgos_data && Array.isArray(c.hallazgos_data)) {
        tendenciaMap[key].hallazgos += c.hallazgos_data.length;
      }
      if (c.tipo === "mantencion_bms") tendenciaMap[key].mantencion++;
      else tendenciaMap[key].operacion++;
    });

    const tendenciaRows = Object.values(tendenciaMap)
      .sort((a, b) => a.fecha.localeCompare(b.fecha))
      .map(t => ({
        "Período": t.fecha,
        "Total Checklists": t.total,
        "Completados": t.completados,
        "% Cumplimiento": t.total > 0 ? `${Math.round((t.completados / t.total) * 100)}%` : "0%",
        "Mantención": t.mantencion,
        "Operación": t.operacion,
        "Hallazgos": t.hallazgos,
      }));

    const wsTendencias = XLSX.utils.json_to_sheet(tendenciaRows);
    wsTendencias["!cols"] = [
      { wch: 14 }, { wch: 16 }, { wch: 12 }, { wch: 16 },
      { wch: 12 }, { wch: 12 }, { wch: 12 },
    ];
    XLSX.utils.book_append_sheet(wb, wsTendencias, "Tendencias");

    // ===== HOJA 6: PLAN DE ACCIÓN =====
    const planAccionRows: Array<Record<string, string>> = [];
    checklists.forEach(c => {
      if (c.hallazgos_data && Array.isArray(c.hallazgos_data)) {
        c.hallazgos_data.forEach((h: Record<string, unknown>) => {
          const crit = (h.criticidad as string || "").toLowerCase();
          if (crit === "critica" || crit === "crítica" || crit === "alta") {
            planAccionRows.push({
              "Prioridad": crit === "critica" || crit === "crítica" ? "🔴 Crítica" : "🟠 Alta",
              "Hallazgo": (h.descripcion as string) || (h.hallazgo as string) || "",
              "Ubicación": ((c.informacion_general as Record<string, string>)?.ubicacion) || "",
              "Acción Correctiva": (h.accion as string) || (h.accion_correctiva as string) || "Por definir",
              "Responsable": (h.responsable as string) || "Por asignar",
              "Fecha Límite": (h.fecha_limite as string) || "Por definir",
              "Estado": (h.estado as string) || "Pendiente",
              "Fecha Detección": c.created_at?.split("T")[0] || "",
            });
          }
        });
      }
    });

    if (planAccionRows.length > 0) {
      const wsPlan = XLSX.utils.json_to_sheet(planAccionRows);
      wsPlan["!cols"] = [
        { wch: 12 }, { wch: 35 }, { wch: 18 }, { wch: 30 },
        { wch: 18 }, { wch: 14 }, { wch: 12 }, { wch: 14 },
      ];
      XLSX.utils.book_append_sheet(wb, wsPlan, "Plan de Acción");
    } else {
      const wsPlan = XLSX.utils.aoa_to_sheet([
        ["No hay hallazgos críticos o altos que requieran plan de acción"],
      ]);
      XLSX.utils.book_append_sheet(wb, wsPlan, "Plan de Acción");
    }

    // Generate file
    const fileName = `Reporte_PMP_${empresaNombre.replace(/\s+/g, "_")}_${fechaDesde}_${fechaHasta}.xlsx`;
    XLSX.writeFile(wb, fileName);

    toast({
      title: "Reporte generado",
      description: `Se descargó: ${fileName}`,
    });
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <FileSpreadsheet className="w-6 h-6" style={{ color: colorPrimario }} />
            <span>Reporte Excel</span>
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Genera reportes ejecutivos para Jefes de Proyecto (PMP) con KPIs, hallazgos, recursos y tendencias.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filtros */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Filter className="w-4 h-4" />
                Período
              </label>
              <Select value={periodo} onValueChange={(v) => setPeriodo(v as FiltroPeriodo)}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar período" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dia">Hoy (Día)</SelectItem>
                  <SelectItem value="semana">Última Semana</SelectItem>
                  <SelectItem value="mes">Último Mes</SelectItem>
                  <SelectItem value="anio">Último Año</SelectItem>
                  <SelectItem value="personalizado">Personalizado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Desde
              </label>
              <Input
                type="date"
                value={fechaDesde}
                onChange={(e) => setFechaDesde(e.target.value)}
                disabled={periodo !== "personalizado"}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Hasta
              </label>
              <Input
                type="date"
                value={fechaHasta}
                onChange={(e) => setFechaHasta(e.target.value)}
                disabled={periodo !== "personalizado"}
              />
            </div>

            <Button
              onClick={fetchData}
              disabled={loading || !fechaDesde || !fechaHasta}
              className="h-10"
              style={{ backgroundColor: colorPrimario }}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Cargando...
                </>
              ) : (
                <>
                  <Filter className="w-4 h-4 mr-2" />
                  Consultar
                </>
              )}
            </Button>
          </div>

          {/* Preview de datos */}
          {dataLoaded && (
            <div className="mt-4 p-4 bg-slate-50 rounded-lg border">
              <h3 className="font-semibold text-sm mb-3">Vista previa de datos:</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-3 bg-white rounded-lg shadow-sm">
                  <p className="text-2xl font-bold" style={{ color: colorPrimario }}>{checklists.length}</p>
                  <p className="text-xs text-muted-foreground">Total Checklists</p>
                </div>
                <div className="text-center p-3 bg-white rounded-lg shadow-sm">
                  <p className="text-2xl font-bold text-green-600">
                    {checklists.filter(c => c.estado === "completado").length}
                  </p>
                  <p className="text-xs text-muted-foreground">Completados</p>
                </div>
                <div className="text-center p-3 bg-white rounded-lg shadow-sm">
                  <p className="text-2xl font-bold text-amber-600">
                    {checklists.filter(c => c.tipo === "mantencion_bms").length}
                  </p>
                  <p className="text-xs text-muted-foreground">Mantención</p>
                </div>
                <div className="text-center p-3 bg-white rounded-lg shadow-sm">
                  <p className="text-2xl font-bold text-blue-600">
                    {checklists.filter(c => c.tipo === "operacion_bms").length}
                  </p>
                  <p className="text-xs text-muted-foreground">Operación</p>
                </div>
              </div>

              <Button
                onClick={generateExcel}
                className="w-full mt-4"
                size="lg"
                style={{ backgroundColor: colorPrimario }}
              >
                <Download className="w-5 h-5 mr-2" />
                Descargar Reporte Excel
              </Button>

              <p className="text-xs text-muted-foreground mt-2 text-center">
                El archivo incluye: Resumen Ejecutivo, Checklists, Hallazgos, Recursos, Tendencias y Plan de Acción
              </p>
            </div>
          )}

          {/* Info de hojas */}
          {!dataLoaded && (
            <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <h3 className="font-semibold text-sm mb-2 text-blue-800">El reporte Excel incluye:</h3>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>📊 <strong>Resumen Ejecutivo</strong> — KPIs, estado general, indicadores de cumplimiento</li>
                <li>📋 <strong>Checklists</strong> — Detalle de todos los checklists del período</li>
                <li>⚠️ <strong>Hallazgos</strong> — Listado con criticidad, responsable y fecha límite</li>
                <li>👷 <strong>Recursos</strong> — Técnicos asignados, carga de trabajo, productividad</li>
                <li>📈 <strong>Tendencias</strong> — Evolución por período (cumplimiento, hallazgos)</li>
                <li>🎯 <strong>Plan de Acción</strong> — Hallazgos críticos/altos con acciones correctivas</li>
              </ul>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}