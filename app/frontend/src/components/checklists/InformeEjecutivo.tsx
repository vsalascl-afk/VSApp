import { useState, useMemo } from "react";
import { useEmpresa } from "@/lib/empresaContext";
import type { Usuario } from "@/lib/types";
import { SUPABASE_URL, SUPABASE_KEY, SUPABASE_SERVICE_KEY } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  FileText,
  Sparkles,
  Download,
  Calendar,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Copy,
  RefreshCw,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import jsPDF from "jspdf";

interface ChecklistRecord {
  id: string;
  empresa_id: string;
  tecnico_id: string;
  estado: string;
  tipo?: string;
  informacion_general: Record<string, unknown>;
  inspeccion_visual?: Record<string, unknown>;
  inspeccion_electrica?: Record<string, unknown>;
  redes_comunicacion?: Record<string, unknown>;
  software_bms?: Record<string, unknown>;
  respaldos_data?: Record<string, unknown>;
  pruebas_funcionales?: Record<string, unknown>;
  hallazgos_data?: { criticidad: string; tipos: string[]; descripcion?: string }[];
  evidencias_data?: Record<string, unknown>;
  resultado_final?: Record<string, unknown>;
  firmas_data?: Record<string, unknown>;
  especialidades_data?: unknown[];
  bitacora?: string;
  created_at: string;
  hora_creacion?: string;
  hora_cierre?: string;
  region?: string;
}

interface Props {
  user: Usuario;
  token: string;
}

type TipoInforme = "individual" | "consolidado";

export default function InformeEjecutivo({ user, token }: Props) {
  const { empresa, colorPrimario } = useEmpresa();
  const { toast } = useToast();

  const [tipoInforme, setTipoInforme] = useState<TipoInforme>("consolidado");
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [records, setRecords] = useState<ChecklistRecord[]>([]);
  const [selectedRecordId, setSelectedRecordId] = useState<string>("");
  const [informe, setInforme] = useState<string>("");
  const [contextoAdicional, setContextoAdicional] = useState("");

  // Filters for consolidated report
  const [fechaDesde, setFechaDesde] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().split("T")[0];
  });
  const [fechaHasta, setFechaHasta] = useState(() => new Date().toISOString().split("T")[0]);

  // Fetch records
  async function fetchRecords() {
    if (!empresa) return;
    setLoading(true);
    try {
      const serviceKey = SUPABASE_SERVICE_KEY || SUPABASE_KEY;
      const url = `${SUPABASE_URL}/rest/v1/checklist_bms?empresa_id=eq.${empresa.id}&estado=eq.finalizado&order=created_at.desc&limit=200`;
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
      console.error("Error fetching records:", err);
    }
    setLoading(false);
  }

  // Load records on mount
  useState(() => {
    fetchRecords();
  });

  // Filter records by date for consolidated report
  const filteredRecords = useMemo(() => {
    if (tipoInforme === "individual") return records;
    return records.filter((r) => {
      const date = r.created_at.split("T")[0];
      if (fechaDesde && date < fechaDesde) return false;
      if (fechaHasta && date > fechaHasta) return false;
      return true;
    });
  }, [records, fechaDesde, fechaHasta, tipoInforme]);

  // Build data summary for AI
  function buildDataSummary(recordsToAnalyze: ChecklistRecord[]): string {
    if (recordsToAnalyze.length === 0) return "No hay datos disponibles para analizar.";

    const total = recordsToAnalyze.length;
    const mantencion = recordsToAnalyze.filter((r) => r.tipo !== "operacion_bms");
    const operacion = recordsToAnalyze.filter((r) => r.tipo === "operacion_bms");

    // Results breakdown
    const operativos = mantencion.filter(
      (r) => (r.resultado_final as Record<string, string>)?.estado_general === "operativo"
    ).length;
    const conObs = mantencion.filter(
      (r) => (r.resultado_final as Record<string, string>)?.estado_general === "operativo_obs"
    ).length;
    const requiereCorrectivo = mantencion.filter(
      (r) => (r.resultado_final as Record<string, string>)?.estado_general === "requiere_correctivo"
    ).length;
    const fueraServicio = mantencion.filter(
      (r) => (r.resultado_final as Record<string, string>)?.estado_general === "fuera_servicio"
    ).length;

    // Hallazgos
    let totalHallazgos = 0;
    let hallazgosCriticos = 0;
    let hallazgosAltos = 0;
    let hallazgosMedios = 0;
    const hallazgosDetalle: string[] = [];

    for (const r of recordsToAnalyze) {
      const hallazgos = r.hallazgos_data || [];
      totalHallazgos += hallazgos.length;
      for (const h of hallazgos) {
        if (h.criticidad === "critica") hallazgosCriticos++;
        if (h.criticidad === "alta") hallazgosAltos++;
        if (h.criticidad === "media") hallazgosMedios++;
        if (h.descripcion) {
          hallazgosDetalle.push(`[${h.criticidad}] ${h.tipos?.join(", ") || ""}: ${h.descripcion}`);
        } else if (h.tipos && h.tipos.length > 0) {
          hallazgosDetalle.push(`[${h.criticidad}] ${h.tipos.join(", ")}`);
        }
      }
    }

    // MTTR calculation
    let mttrMinutes = 0;
    let mttrCount = 0;
    for (const r of recordsToAnalyze) {
      if (r.hora_creacion && r.hora_cierre) {
        const start = parseDateTime(r.hora_creacion);
        const end = parseDateTime(r.hora_cierre);
        if (start && end && end > start) {
          mttrMinutes += (end.getTime() - start.getTime()) / (1000 * 60);
          mttrCount++;
        }
      }
    }
    const mttr = mttrCount > 0 ? mttrMinutes / mttrCount : 0;

    // Activos/edificios involucrados
    const activos = new Set<string>();
    const edificios = new Set<string>();
    const clientes = new Set<string>();
    for (const r of recordsToAnalyze) {
      const info = r.informacion_general || {};
      if (info.codigo_activo) activos.add(info.codigo_activo as string);
      if (info.edificio) edificios.add(info.edificio as string);
      if (info.cliente) clientes.add(info.cliente as string);
    }

    let summary = `## DATOS DEL PERÍODO\n`;
    summary += `- Empresa: ${empresa?.nombre || "N/A"}\n`;
    summary += `- Período: ${fechaDesde} al ${fechaHasta}\n`;
    summary += `- Total de checklists finalizados: ${total}\n`;
    summary += `- Checklists de Mantención BMS: ${mantencion.length}\n`;
    summary += `- Rondas de Operación BMS: ${operacion.length}\n`;
    summary += `- Clientes involucrados: ${Array.from(clientes).join(", ") || "N/A"}\n`;
    summary += `- Edificios: ${Array.from(edificios).join(", ") || "N/A"}\n`;
    summary += `- Activos inspeccionados: ${activos.size}\n\n`;

    summary += `## RESULTADOS DE MANTENCIÓN\n`;
    summary += `- Operativos: ${operativos} (${mantencion.length > 0 ? Math.round((operativos / mantencion.length) * 100) : 0}%)\n`;
    summary += `- Con Observaciones: ${conObs} (${mantencion.length > 0 ? Math.round((conObs / mantencion.length) * 100) : 0}%)\n`;
    summary += `- Requiere Correctivo: ${requiereCorrectivo} (${mantencion.length > 0 ? Math.round((requiereCorrectivo / mantencion.length) * 100) : 0}%)\n`;
    summary += `- Fuera de Servicio: ${fueraServicio} (${mantencion.length > 0 ? Math.round((fueraServicio / mantencion.length) * 100) : 0}%)\n\n`;

    summary += `## HALLAZGOS\n`;
    summary += `- Total hallazgos: ${totalHallazgos}\n`;
    summary += `- Críticos: ${hallazgosCriticos}\n`;
    summary += `- Altos: ${hallazgosAltos}\n`;
    summary += `- Medios: ${hallazgosMedios}\n`;
    if (hallazgosDetalle.length > 0) {
      summary += `\nDetalle de hallazgos:\n`;
      for (const h of hallazgosDetalle.slice(0, 20)) {
        summary += `  - ${h}\n`;
      }
      if (hallazgosDetalle.length > 20) {
        summary += `  ... y ${hallazgosDetalle.length - 20} hallazgos más\n`;
      }
    }

    summary += `\n## INDICADORES\n`;
    summary += `- MTTR (Tiempo Medio de Resolución): ${mttr > 0 ? `${Math.round(mttr)} minutos (${(mttr / 60).toFixed(1)} horas)` : "N/A"}\n`;
    summary += `- Disponibilidad estimada: ${mantencion.length > 0 ? Math.round(((operativos + conObs) / mantencion.length) * 100) : "N/A"}%\n`;

    if (contextoAdicional.trim()) {
      summary += `\n## CONTEXTO ADICIONAL DEL USUARIO\n${contextoAdicional}\n`;
    }

    return summary;
  }

  function parseDateTime(str: string): Date | null {
    if (!str) return null;
    const cleaned = str.replace(",", "").trim();
    const parts = cleaned.split(/[\s]+/);
    if (parts.length >= 2) {
      let datePart = parts[0];
      const timePart = parts[1];
      if (datePart.includes("/") || (datePart.includes("-") && datePart.split("-")[0].length <= 2)) {
        const sep = datePart.includes("/") ? "/" : "-";
        const dp = datePart.split(sep);
        datePart = `${dp[2]}-${dp[1]}-${dp[0]}`;
      }
      const d = new Date(`${datePart}T${timePart}`);
      if (!isNaN(d.getTime())) return d;
    }
    const d = new Date(str);
    return isNaN(d.getTime()) ? null : d;
  }

  // Generate report using OpenAI API
  async function generateInforme() {
    const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
    if (!apiKey) {
      toast({
        title: "API Key no configurada",
        description: "Se requiere una API Key de OpenAI para generar informes con IA. Configure VITE_OPENAI_API_KEY.",
        variant: "destructive",
      });
      return;
    }

    let recordsToAnalyze: ChecklistRecord[] = [];

    if (tipoInforme === "individual") {
      const selected = records.find((r) => r.id === selectedRecordId);
      if (!selected) {
        toast({ title: "Error", description: "Seleccione un checklist para generar el informe.", variant: "destructive" });
        return;
      }
      recordsToAnalyze = [selected];
    } else {
      recordsToAnalyze = filteredRecords;
      if (recordsToAnalyze.length === 0) {
        toast({ title: "Sin datos", description: "No hay checklists finalizados en el período seleccionado.", variant: "destructive" });
        return;
      }
    }

    setGenerating(true);
    setInforme("");

    try {
      const dataSummary = buildDataSummary(recordsToAnalyze);

      const systemPrompt = `Eres un ingeniero senior especialista en sistemas BMS (Building Management Systems) y mantenimiento de infraestructura crítica. Tu tarea es generar informes ejecutivos profesionales para presentar a mandantes (clientes finales) basándote en datos de checklists de mantención y operación.

El informe debe ser:
- Profesional y técnico pero comprensible para gerentes no técnicos
- Estructurado con secciones claras
- Orientado a la toma de decisiones
- Con recomendaciones accionables priorizadas
- En español chileno formal

Formato del informe:
1. RESUMEN EJECUTIVO (1-2 párrafos concisos)
2. ESTADO GENERAL DEL SISTEMA BMS (semáforo: Verde/Amarillo/Rojo con justificación)
3. INDICADORES CLAVE DE DESEMPEÑO
4. HALLAZGOS PRINCIPALES (priorizados por criticidad)
5. ANÁLISIS DE RIESGOS
6. RECOMENDACIONES Y PLAN DE ACCIÓN (con prioridad y plazo sugerido)
7. CONCLUSIONES

Si es un informe individual, enfócate en el detalle del checklist específico.
Si es un informe consolidado (múltiples checklists), enfócate en tendencias, patrones y visión general del período.`;

      const userPrompt = tipoInforme === "individual"
        ? `Genera un informe ejecutivo INDIVIDUAL para presentar al mandante, basado en el siguiente checklist de ${recordsToAnalyze[0].tipo === "operacion_bms" ? "operación" : "mantención"} BMS:\n\n${dataSummary}`
        : `Genera un informe ejecutivo CONSOLIDADO del período para presentar al mandante, basado en los siguientes datos de ${recordsToAnalyze.length} checklists:\n\n${dataSummary}`;

      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.7,
          max_tokens: 3000,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `Error ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || "No se pudo generar el informe.";
      setInforme(content);
      toast({ title: "Informe generado", description: "El informe ejecutivo se generó exitosamente." });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Error desconocido";
      console.error("Error generating report:", err);
      toast({
        title: "Error al generar informe",
        description: errorMessage,
        variant: "destructive",
      });
    }
    setGenerating(false);
  }

  // Export to PDF
  async function exportPDF() {
    if (!informe) return;

    const doc = new jsPDF();
    const empresaNombre = empresa?.nombre || "VSApp";
    const empresaLogo = empresa?.logo_url || "";
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    const maxWidth = pageWidth - margin * 2;

    // Company logo in header
    if (empresaLogo) {
      try {
        const logoRes = await fetch(empresaLogo);
        if (logoRes.ok) {
          const logoBlob = await logoRes.blob();
          const logoDataUrl = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(logoBlob);
          });
          const format = logoDataUrl.startsWith("data:image/png") ? "PNG" : "JPEG";
          doc.addImage(logoDataUrl, format, pageWidth / 2 - 11, 4, 22, 22);
        }
      } catch { /* skip logo */ }
    }

    // Header
    const headerStartY = empresaLogo ? 30 : 20;
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("INFORME EJECUTIVO", pageWidth / 2, headerStartY, { align: "center" });

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`${empresaNombre} - Sistema BMS`, pageWidth / 2, headerStartY + 8, { align: "center" });

    const tipoLabel = tipoInforme === "individual" ? "Informe Individual" : `Informe Consolidado (${fechaDesde} al ${fechaHasta})`;
    doc.text(tipoLabel, pageWidth / 2, headerStartY + 14, { align: "center" });
    doc.text(`Generado: ${new Date().toLocaleString("es-CL")}`, pageWidth / 2, headerStartY + 20, { align: "center" });

    // Line separator
    doc.setDrawColor(0, 100, 200);
    doc.setLineWidth(0.5);
    doc.line(margin, headerStartY + 24, pageWidth - margin, headerStartY + 24);

    // Content
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");

    const lines = doc.splitTextToSize(informe, maxWidth);
    let y = headerStartY + 30;
    const lineHeight = 5;

    for (const line of lines) {
      if (y > doc.internal.pageSize.getHeight() - 20) {
        doc.addPage();
        y = 20;
      }

      // Bold for section headers
      if (line.match(/^\d+\.\s+[A-ZÁÉÍÓÚÑ\s]+/) || line.match(/^#{1,3}\s/)) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        const cleanLine = line.replace(/^#{1,3}\s*/, "");
        doc.text(cleanLine, margin, y);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
      } else {
        doc.text(line, margin, y);
      }
      y += lineHeight;
    }

    // Footer
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(128);
      doc.text(
        `${empresaNombre} - Informe Ejecutivo BMS | Página ${i} de ${totalPages}`,
        pageWidth / 2,
        doc.internal.pageSize.getHeight() - 10,
        { align: "center" }
      );
      doc.setTextColor(0);
    }

    const filename = tipoInforme === "individual"
      ? `informe_ejecutivo_${selectedRecordId.slice(0, 8)}.pdf`
      : `informe_consolidado_${fechaDesde}_${fechaHasta}.pdf`;

    doc.save(filename);
    toast({ title: "PDF exportado", description: "El informe se descargó correctamente." });
  }

  // Copy to clipboard
  function copyToClipboard() {
    if (!informe) return;
    navigator.clipboard.writeText(informe).then(() => {
      toast({ title: "Copiado", description: "El informe se copió al portapapeles." });
    });
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <FileText className="w-6 h-6" style={{ color: colorPrimario }} />
        <h2 className="text-xl font-bold text-gray-800">Informe Ejecutivo con IA</h2>
        <Badge className="bg-purple-100 text-purple-700 text-xs">
          <Sparkles className="w-3 h-3 mr-1" /> IA
        </Badge>
      </div>

      <p className="text-sm text-muted-foreground">
        Genera informes ejecutivos profesionales para presentar al mandante, basados en los datos de tus checklists.
        La IA analiza los resultados, hallazgos e indicadores para producir un informe estructurado con recomendaciones.
      </p>

      {/* Configuration */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Configuración del Informe</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Tipo de informe */}
          <div className="space-y-1">
            <Label className="text-xs font-medium">Tipo de Informe</Label>
            <Select value={tipoInforme} onValueChange={(v) => setTipoInforme(v as TipoInforme)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="consolidado">📊 Consolidado (período)</SelectItem>
                <SelectItem value="individual">📋 Individual (un checklist)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Filters based on type */}
          {tipoInforme === "consolidado" ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> Desde
                </Label>
                <Input
                  type="date"
                  value={fechaDesde}
                  onChange={(e) => setFechaDesde(e.target.value)}
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
                />
              </div>
            </div>
          ) : (
            <div className="space-y-1">
              <Label className="text-xs">Seleccionar Checklist</Label>
              <Select value={selectedRecordId} onValueChange={setSelectedRecordId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccione un checklist finalizado..." />
                </SelectTrigger>
                <SelectContent>
                  {records.map((r) => {
                    const info = r.informacion_general || {};
                    const isOp = r.tipo === "operacion_bms";
                    const label = isOp
                      ? `Operación - Ronda ${info.numero_ronda || "?"} (${info.fecha || new Date(r.created_at).toLocaleDateString()})`
                      : `Mantención - ${info.codigo_activo || "Sin código"} - ${info.edificio || ""} (${info.fecha || new Date(r.created_at).toLocaleDateString()})`;
                    return (
                      <SelectItem key={r.id} value={r.id}>
                        {label}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Contexto adicional */}
          <div className="space-y-1">
            <Label className="text-xs">Contexto adicional (opcional)</Label>
            <Textarea
              placeholder="Agregue contexto que la IA debe considerar: prioridades del mandante, situación particular, énfasis deseado..."
              value={contextoAdicional}
              onChange={(e) => setContextoAdicional(e.target.value)}
              rows={3}
              className="text-sm"
            />
          </div>

          {/* Summary info */}
          {tipoInforme === "consolidado" && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-blue-50 p-2 rounded">
              <CheckCircle2 className="w-4 h-4 text-blue-500" />
              <span>
                {filteredRecords.length} checklists finalizados en el período seleccionado
              </span>
            </div>
          )}

          {/* Generate button */}
          <Button
            onClick={generateInforme}
            disabled={generating || (tipoInforme === "individual" && !selectedRecordId) || (tipoInforme === "consolidado" && filteredRecords.length === 0)}
            className="w-full"
            style={{ backgroundColor: colorPrimario || "#3b82f6" }}
          >
            {generating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Generando informe con IA...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                Generar Informe Ejecutivo
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Generated Report */}
      {informe && (
        <Card className="border-2 border-blue-200">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-600" />
                Informe Ejecutivo Generado
              </CardTitle>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={copyToClipboard}>
                  <Copy className="w-3 h-3 mr-1" /> Copiar
                </Button>
                <Button variant="outline" size="sm" onClick={exportPDF}>
                  <Download className="w-3 h-3 mr-1" /> PDF
                </Button>
                <Button variant="outline" size="sm" onClick={generateInforme} disabled={generating}>
                  <RefreshCw className={`w-3 h-3 mr-1 ${generating ? "animate-spin" : ""}`} /> Regenerar
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="prose prose-sm max-w-none bg-white rounded-lg p-4 border">
              {informe.split("\n").map((line, idx) => {
                // Render markdown-like formatting
                if (line.match(/^#{1,2}\s/)) {
                  const cleanLine = line.replace(/^#{1,3}\s*/, "");
                  return (
                    <h3 key={idx} className="text-base font-bold text-slate-800 mt-4 mb-2">
                      {cleanLine}
                    </h3>
                  );
                }
                if (line.match(/^#{3}\s/)) {
                  const cleanLine = line.replace(/^#{1,3}\s*/, "");
                  return (
                    <h4 key={idx} className="text-sm font-semibold text-slate-700 mt-3 mb-1">
                      {cleanLine}
                    </h4>
                  );
                }
                if (line.match(/^\d+\.\s+[A-ZÁÉÍÓÚÑ]/)) {
                  return (
                    <h3 key={idx} className="text-base font-bold text-slate-800 mt-4 mb-2 border-b pb-1">
                      {line}
                    </h3>
                  );
                }
                if (line.startsWith("- ") || line.startsWith("• ")) {
                  const content = line.replace(/^[-•]\s*/, "");
                  // Highlight critical items
                  if (content.toLowerCase().includes("crític") || content.toLowerCase().includes("urgente")) {
                    return (
                      <div key={idx} className="flex items-start gap-2 ml-4 my-1">
                        <AlertTriangle className="w-3 h-3 text-red-500 mt-1 shrink-0" />
                        <span className="text-sm text-red-700">{content}</span>
                      </div>
                    );
                  }
                  return (
                    <div key={idx} className="flex items-start gap-2 ml-4 my-1">
                      <span className="text-blue-400 mt-0.5">•</span>
                      <span className="text-sm text-slate-600">{content}</span>
                    </div>
                  );
                }
                if (line.startsWith("**") && line.endsWith("**")) {
                  return (
                    <p key={idx} className="text-sm font-semibold text-slate-800 my-1">
                      {line.replace(/\*\*/g, "")}
                    </p>
                  );
                }
                if (line.trim() === "") {
                  return <div key={idx} className="h-2" />;
                }
                // Bold inline
                const formattedLine = line.replace(
                  /\*\*(.*?)\*\*/g,
                  '<strong>$1</strong>'
                );
                return (
                  <p
                    key={idx}
                    className="text-sm text-slate-600 my-1"
                    dangerouslySetInnerHTML={{ __html: formattedLine }}
                  />
                );
              })}
            </div>

            <div className="mt-4 p-3 bg-amber-50 rounded-lg border border-amber-200">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                <div className="text-xs text-amber-700">
                  <p className="font-medium">Nota importante:</p>
                  <p>
                    Este informe fue generado por IA como apoyo. Revise y valide la información antes de
                    presentarlo al mandante. Puede editar el contenido copiándolo o regenerarlo con contexto adicional.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Help section */}
      {!informe && !generating && (
        <Card className="bg-gray-50">
          <CardContent className="p-4">
            <h4 className="text-sm font-medium text-gray-700 mb-2">💡 ¿Cómo funciona?</h4>
            <ul className="text-xs text-gray-600 space-y-1">
              <li>• <strong>Informe Individual:</strong> Analiza un checklist específico en detalle</li>
              <li>• <strong>Informe Consolidado:</strong> Analiza todos los checklists de un período, identifica tendencias y patrones</li>
              <li>• La IA considera: resultados, hallazgos, criticidad, MTTR, disponibilidad y más</li>
              <li>• Puede agregar contexto adicional para personalizar el enfoque del informe</li>
              <li>• El formato es modificable: en el futuro se puede ajustar la estructura según los requerimientos del mandante</li>
              <li>• Exporte a PDF para presentación formal o copie el texto para editar en Word</li>
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}