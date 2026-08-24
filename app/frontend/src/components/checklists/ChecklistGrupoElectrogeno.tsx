import { useState } from "react";
import { useEmpresa } from "@/lib/empresaContext";
import type { Usuario } from "@/lib/types";
import { SUPABASE_URL } from "@/lib/supabase";
import { offlineSaveFetch } from "@/lib/offlineFetch";
import { generateCorrelativo } from "@/lib/correlativoUtils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Save, Download, CheckCircle2, AlertTriangle, Wrench } from "lucide-react";
import jsPDF from "jspdf";

// Types
type EstadoItem = "ok" | "observacion" | "no_aplica" | "";
type Frecuencia = "semanal" | "cada_vez" | "250h" | "anual" | "adicional";

interface ItemGE {
  numero: number;
  descripcion: string;
  frecuencias: Frecuencia[];
  estado: EstadoItem;
  valor_lectura: string;
  observacion: string;
}

interface SeccionGE {
  nombre: string;
  items: ItemGE[];
}

interface InfoGeneralGE {
  cliente: string;
  ubicacion: string;
  fecha: string;
  hora_inicio: string;
  hora_termino: string;
  tecnico: string;
  supervisor: string;
  marca_equipo: string;
  modelo_equipo: string;
  numero_serie: string;
  horometro: string;
  tipo_servicio: string; // semanal, cada_vez, 250h, anual
}

interface ModificacionEntry {
  fecha: string;
  usuario: string;
  descripcion: string;
}

interface EditRecordGE {
  id: string;
  estado: string;
  informacion_general: InfoGeneralGE;
  secciones_data: SeccionGE[];
  observaciones_generales: string;
  historial_modificaciones?: ModificacionEntry[];
  hora_creacion?: string;
  hora_cierre?: string;
}

interface Props {
  user: Usuario;
  token: string;
  editRecord?: EditRecordGE | null;
  onEditDone?: () => void;
}

// Data from PDF - 46 items organized in 3 sections
function getSeccionesIniciales(): SeccionGE[] {
  return [
    {
      nombre: "Servicio / Chequeos / Cambios en el Motor Diésel",
      items: [
        { numero: 1, descripcion: "Nivel de lubricante del cárter, rellenar si es necesario según varilla de medición (Entre marcas)", frecuencias: ["semanal", "cada_vez"], estado: "", valor_lectura: "", observacion: "" },
        { numero: 2, descripcion: "Nivel de refrigerante de radiador, rellenar si es necesario según medidas de bote de expansión", frecuencias: ["semanal", "cada_vez"], estado: "", valor_lectura: "", observacion: "" },
        { numero: 3, descripcion: "Chequear funcionamiento del motor por posibles filtraciones de lubricante, refrigerante o combustible", frecuencias: ["semanal", "cada_vez", "250h"], estado: "", valor_lectura: "", observacion: "" },
        { numero: 4, descripcion: "Nivel de electrolito baterías y verificar reapriete de bornes, rellenar si es necesario a 1cm del nivel superior de cada vaso (Para baterías libres de mantención, solo verificar reapriete de bornes)", frecuencias: ["semanal", "cada_vez", "250h"], estado: "", valor_lectura: "", observacion: "" },
        { numero: 5, descripcion: "Nivel de combustible estanque, mantener con capacidad según operación, verificar presencia de agua", frecuencias: ["semanal", "cada_vez"], estado: "", valor_lectura: "", observacion: "" },
        { numero: 6, descripcion: "Chequeo restricción de prefiltro de combustible motor, verificar presencia de agua y residuos, despichar (Si está montado)", frecuencias: ["semanal", "cada_vez"], estado: "", valor_lectura: "", observacion: "" },
        { numero: 7, descripcion: "Hacer funcionar 15-30 minutos aproximados, recomendable con carga (Carga suministrada por cliente)", frecuencias: ["semanal"], estado: "", valor_lectura: "", observacion: "" },
        { numero: 8, descripcion: "Chequeo y reaprete de cañerías, mangueras y abrazaderas de lubricante y refrigerante (Si se requiere)", frecuencias: ["semanal", "cada_vez", "250h"], estado: "", valor_lectura: "", observacion: "" },
        { numero: 9, descripcion: "Chequeo de accesorios térmicos para partir en frío (Calefactores, bomba de recirculación y control) (Si están montados)", frecuencias: ["semanal", "cada_vez", "250h"], estado: "", valor_lectura: "", observacion: "" },
        { numero: 10, descripcion: "Inspección visual de estado y tensión de correas de distribución del motor", frecuencias: ["cada_vez", "250h"], estado: "", valor_lectura: "", observacion: "" },
        { numero: 11, descripcion: "Nivel de anticorrosivo DCA y corrección de concentración", frecuencias: ["cada_vez"], estado: "", valor_lectura: "", observacion: "" },
        { numero: 12, descripcion: "Cambiar lubricante del motor", frecuencias: ["cada_vez", "250h"], estado: "", valor_lectura: "", observacion: "" },
        { numero: 13, descripcion: "Inspección visual del turbocargador por ruidos o fugas", frecuencias: ["cada_vez", "250h"], estado: "", valor_lectura: "", observacion: "" },
        { numero: 14, descripcion: "Chequeo densidad del electrolito de baterías (Solo para baterías que requieren mantención)", frecuencias: ["cada_vez"], estado: "", valor_lectura: "", observacion: "" },
        { numero: 15, descripcion: "Medir voltaje y régimen de carga de alternador DC y limpieza exterior", frecuencias: ["cada_vez", "250h"], estado: "", valor_lectura: "", observacion: "" },
        { numero: 16, descripcion: "Revisión de fugas en el ducto de evacuación de los gases del escape (Múltiple)", frecuencias: ["250h"], estado: "", valor_lectura: "", observacion: "" },
        { numero: 17, descripcion: "Reaprete general exterior de G.E. Inspección visual y auditiva (Cuando sea necesario)", frecuencias: ["cada_vez", "250h"], estado: "", valor_lectura: "", observacion: "" },
        { numero: 18, descripcion: "Cambiar filtro(s) de refrigerante (Si está montado)", frecuencias: ["anual"], estado: "", valor_lectura: "", observacion: "" },
        { numero: 19, descripcion: "Cambiar filtro(s) de lubricante del motor", frecuencias: ["anual"], estado: "", valor_lectura: "", observacion: "" },
        { numero: 20, descripcion: "Cambiar filtro(s) de combustible del motor", frecuencias: ["anual"], estado: "", valor_lectura: "", observacion: "" },
        { numero: 21, descripcion: "Lavado de radiador", frecuencias: ["anual"], estado: "", valor_lectura: "", observacion: "" },
        { numero: 22, descripcion: "Cambiar junta de prefiltro de combustible del motor (Si está montada)", frecuencias: ["anual"], estado: "", valor_lectura: "", observacion: "" },
        { numero: 23, descripcion: "Cambiar filtro(s) de aire", frecuencias: ["anual"], estado: "", valor_lectura: "", observacion: "" },
        { numero: 24, descripcion: "Cambiar refrigerante", frecuencias: ["anual"], estado: "", valor_lectura: "", observacion: "" },
        { numero: 25, descripcion: "Cambiar pre filtro de combustible del motor (Si está montado)", frecuencias: ["adicional"], estado: "", valor_lectura: "", observacion: "" },
        { numero: 26, descripcion: "Chequeo de sistema de protección (Detención automática del motor por irregularidad de funcionamiento, presión de aceite, temperatura motor, baterías) (Si sistema lo permite)", frecuencias: ["adicional"], estado: "", valor_lectura: "", observacion: "" },
        { numero: 27, descripcion: "Chequear presión de aceite (Si sistema lo permite)", frecuencias: ["cada_vez", "250h"], estado: "", valor_lectura: "", observacion: "" },
        { numero: 28, descripcion: "Chequear presión de combustible (Si sistema lo permite)", frecuencias: ["cada_vez", "250h"], estado: "", valor_lectura: "", observacion: "" },
        { numero: 29, descripcion: "Medir temperatura de los gases de escape (Con carga, provista por cliente)", frecuencias: ["cada_vez", "250h"], estado: "", valor_lectura: "", observacion: "" },
        { numero: 30, descripcion: "Medir y controlar el Blow By (Contrapresión del motor, con carga)", frecuencias: ["cada_vez", "250h"], estado: "", valor_lectura: "", observacion: "" },
        { numero: 31, descripcion: "Inspección visual de radiador por obstrucción o fugas (Si instalación lo permite)", frecuencias: ["adicional"], estado: "", valor_lectura: "", observacion: "" },
        { numero: 32, descripcion: "Revisión de funcionamiento y nivel de carga mantenedor electrónico de batería (Si está montado)", frecuencias: ["cada_vez", "250h"], estado: "", valor_lectura: "", observacion: "" },
      ],
    },
    {
      nombre: "Servicio / Chequeos en el Alternador Trifásico",
      items: [
        { numero: 33, descripcion: "Inspección audible por posibles ruidos rotatorios y de rodamiento", frecuencias: ["cada_vez", "250h"], estado: "", valor_lectura: "", observacion: "" },
        { numero: 34, descripcion: "Medición de temperatura en carcaza alternador y tapa trasera (Rodamiento)", frecuencias: ["cada_vez", "250h"], estado: "", valor_lectura: "", observacion: "" },
        { numero: 35, descripcion: "Limpieza exterior general (Cuando sea necesario)", frecuencias: ["adicional"], estado: "", valor_lectura: "", observacion: "" },
        { numero: 36, descripcion: "Prueba de funcionamiento y verificación de parámetros en vacío (Sin carga)", frecuencias: ["cada_vez", "250h"], estado: "", valor_lectura: "", observacion: "" },
        { numero: 37, descripcion: "Prueba de funcionamiento con carga y verificación de parámetros (Carga provista por cliente)", frecuencias: ["250h"], estado: "", valor_lectura: "", observacion: "" },
        { numero: 38, descripcion: "Control de voltaje en vacío y con carga (Carga provista por cliente)", frecuencias: ["cada_vez", "250h"], estado: "", valor_lectura: "", observacion: "" },
        { numero: 39, descripcion: "Medición de aislación de bobinados (Se requiere desconexión de cableado de fuerza del alternador)", frecuencias: ["cada_vez", "250h"], estado: "", valor_lectura: "", observacion: "" },
        { numero: 40, descripcion: "Control de frecuencia en vacío y con carga (Carga provista por cliente)", frecuencias: ["cada_vez", "250h"], estado: "", valor_lectura: "", observacion: "" },
        { numero: 41, descripcion: "Regulación de voltaje y frecuencia (Sólo si es necesario)", frecuencias: ["cada_vez", "250h"], estado: "", valor_lectura: "", observacion: "" },
      ],
    },
    {
      nombre: "Servicio / Chequeos en el Sistema de Control",
      items: [
        { numero: 42, descripcion: "Limpieza componentes de pupitres y tableros (Cuando sea necesario)", frecuencias: ["cada_vez", "250h"], estado: "", valor_lectura: "", observacion: "" },
        { numero: 43, descripcion: "Comprobación y aprete de conductores de sistema de fuerza (Interruptor automático de carga, pupitres y tableros)", frecuencias: ["cada_vez", "250h"], estado: "", valor_lectura: "", observacion: "" },
        { numero: 44, descripcion: "Chequeo de funcionamiento de instrumentación", frecuencias: ["cada_vez", "250h"], estado: "", valor_lectura: "", observacion: "" },
        { numero: 45, descripcion: "Comprobación y aprete conductores y contactos de sistema de control Grupo-Tablero de transferencia automática", frecuencias: ["cada_vez", "250h"], estado: "", valor_lectura: "", observacion: "" },
        { numero: 46, descripcion: "Extracción Capture File y verificación de programa y parámetros (Si panel lo permite)", frecuencias: ["250h"], estado: "", valor_lectura: "", observacion: "" },
      ],
    },
  ];
}

function getInitialInfo(user: Usuario): InfoGeneralGE {
  const now = new Date();
  return {
    cliente: "",
    ubicacion: "",
    fecha: now.toISOString().split("T")[0],
    hora_inicio: now.toTimeString().slice(0, 5),
    hora_termino: "",
    tecnico: user.nombre || "",
    supervisor: "",
    marca_equipo: "",
    modelo_equipo: "",
    numero_serie: "",
    horometro: "",
    tipo_servicio: "cada_vez",
  };
}

const FRECUENCIA_LABELS: Record<Frecuencia, string> = {
  semanal: "Semanal",
  cada_vez: "C/Vez",
  "250h": "C/250H",
  anual: "Rev. Anual",
  adicional: "Adicional",
};

const FRECUENCIA_COLORS: Record<Frecuencia, string> = {
  semanal: "bg-blue-100 text-blue-700 border-blue-300",
  cada_vez: "bg-green-100 text-green-700 border-green-300",
  "250h": "bg-amber-100 text-amber-700 border-amber-300",
  anual: "bg-purple-100 text-purple-700 border-purple-300",
  adicional: "bg-gray-100 text-gray-600 border-gray-300",
};

export default function ChecklistGrupoElectrogeno({ user, token, editRecord, onEditDone }: Props) {
  const { empresa, colorPrimario } = useEmpresa();
  const { toast } = useToast();

  const [info, setInfo] = useState<InfoGeneralGE>(
    editRecord ? editRecord.informacion_general : getInitialInfo(user)
  );
  const [secciones, setSecciones] = useState<SeccionGE[]>(
    editRecord ? editRecord.secciones_data : getSeccionesIniciales()
  );
  const [observaciones, setObservaciones] = useState(
    editRecord ? editRecord.observaciones_generales || "" : ""
  );
  const [saving, setSaving] = useState(false);
  const [filtroFrecuencia, setFiltroFrecuencia] = useState<Frecuencia | "todas">("todas");

  // Filter items by selected service type
  function getFilteredSecciones(): SeccionGE[] {
    if (filtroFrecuencia === "todas") return secciones;
    return secciones.map((sec) => ({
      ...sec,
      items: sec.items.filter((item) => item.frecuencias.includes(filtroFrecuencia)),
    })).filter((sec) => sec.items.length > 0);
  }

  function updateItem(secIdx: number, itemIdx: number, field: keyof ItemGE, value: string) {
    setSecciones((prev) => {
      const copy = [...prev];
      const secCopy = { ...copy[secIdx], items: [...copy[secIdx].items] };
      // Find the real index in unfiltered data
      const filteredItems = filtroFrecuencia === "todas"
        ? secCopy.items
        : secCopy.items.filter((it) => it.frecuencias.includes(filtroFrecuencia as Frecuencia));
      const realItem = filteredItems[itemIdx];
      const realIdx = secCopy.items.findIndex((it) => it.numero === realItem.numero);
      if (realIdx >= 0) {
        secCopy.items[realIdx] = { ...secCopy.items[realIdx], [field]: value };
      }
      copy[secIdx] = secCopy;
      return copy;
    });
  }

  async function guardar(estadoParam: "borrador" | "completado") {
    if (!empresa) {
      toast({ title: "Error", description: "No hay empresa seleccionada", variant: "destructive" });
      return;
    }

    setSaving(true);
    const horaActual = new Date().toLocaleString("es-CL");
    // Map "completado" to "finalizado" to match DB CHECK constraint
    const estadoDB = estadoParam === "completado" ? "finalizado" : "borrador";

    // Store observaciones inside informacion_general to avoid non-existent column
    const infoConObs = { ...info, observaciones_generales: observaciones };

    const record: Record<string, unknown> = {
      empresa_id: empresa.id,
      tecnico_id: user.id,
      tipo: "grupo_electrogeno",
      estado: estadoDB,
      informacion_general: infoConObs,
      especialidades_data: secciones,
      bitacora: observaciones,
    };
    if (user.region) {
      record.region = user.region;
    }

    if (editRecord) {
      // Update existing
      const mods = editRecord.historial_modificaciones || [];
      mods.push({ fecha: horaActual, usuario: user.nombre, descripcion: estadoParam === "completado" ? "Completó el checklist" : "Editó y guardó cambios" });
      record.historial_modificaciones = mods;
      if (estadoParam === "completado" && !editRecord.hora_cierre) {
        record.hora_cierre = horaActual;
      }

      const url = `${SUPABASE_URL}/rest/v1/checklist_bms?id=eq.${editRecord.id}`;
      const result = await offlineSaveFetch({
        type: "checklist_bms",
        action: "update",
        payload: record,
        url,
        method: "PATCH",
        token,
        useServiceKey: true,
      });

      setSaving(false);
      if (result.success) {
        toast({ title: "✅ Actualizado", description: result.offline ? "Guardado offline, se sincronizará al reconectar" : "Checklist de Grupo Electrógeno actualizado correctamente" });
        if (onEditDone) onEditDone();
      } else {
        toast({ title: "Error", description: result.error || "Error al guardar", variant: "destructive" });
      }
    } else {
      // Create new
      record.hora_creacion = horaActual;
      if (estadoParam === "completado") record.hora_cierre = horaActual;
      record.historial_modificaciones = [{ fecha: horaActual, usuario: user.nombre, descripcion: "Creó el checklist" }];
      const correlativo = await generateCorrelativo(empresa.id, "grupo_electrogeno");
      record.numero_interno = correlativo;

      const url = `${SUPABASE_URL}/rest/v1/checklist_bms`;
      const result = await offlineSaveFetch({
        type: "checklist_bms",
        action: "create",
        payload: record,
        url,
        method: "POST",
        token,
        useServiceKey: true,
      });

      setSaving(false);
      if (result.success) {
        toast({ title: "✅ Guardado", description: result.offline ? "Guardado offline, se sincronizará al reconectar" : "Checklist de Grupo Electrógeno guardado correctamente" });
        // Reset form
        setInfo(getInitialInfo(user));
        setSecciones(getSeccionesIniciales());
        setObservaciones("");
      } else {
        toast({ title: "Error", description: result.error || "Error al guardar", variant: "destructive" });
      }
    }
  }

  function exportPDF() {
    const doc = new jsPDF("p", "mm", "a4");
    const pageWidth = doc.internal.pageSize.getWidth();
    let y = 15;

    // Header
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Checklist Grupo Electrógeno", pageWidth / 2, y, { align: "center" });
    y += 8;
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`Cliente: ${info.cliente} | Ubicación: ${info.ubicacion}`, pageWidth / 2, y, { align: "center" });
    y += 5;
    doc.text(`Fecha: ${info.fecha} | Técnico: ${info.tecnico} | Horómetro: ${info.horometro}`, pageWidth / 2, y, { align: "center" });
    y += 5;
    doc.text(`Equipo: ${info.marca_equipo} ${info.modelo_equipo} - S/N: ${info.numero_serie}`, pageWidth / 2, y, { align: "center" });
    y += 8;

    // Sections
    for (const sec of secciones) {
      if (y > 270) { doc.addPage(); y = 15; }
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text(sec.nombre, 10, y);
      y += 5;

      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");

      for (const item of sec.items) {
        if (y > 275) { doc.addPage(); y = 15; }
        const estadoLabel = item.estado === "ok" ? "✓" : item.estado === "observacion" ? "OBS" : item.estado === "no_aplica" ? "N/A" : "—";
        const line = `${item.numero}. ${item.descripcion.substring(0, 80)}`;
        doc.text(line, 12, y);
        doc.text(estadoLabel, pageWidth - 25, y);
        if (item.valor_lectura) {
          doc.text(`Val: ${item.valor_lectura}`, pageWidth - 50, y);
        }
        y += 4;
        if (item.observacion) {
          doc.setTextColor(150, 50, 50);
          doc.text(`   Obs: ${item.observacion.substring(0, 90)}`, 14, y);
          doc.setTextColor(0, 0, 0);
          y += 4;
        }
      }
      y += 3;
    }

    // Observaciones generales
    if (observaciones) {
      if (y > 260) { doc.addPage(); y = 15; }
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text("Observaciones Generales:", 10, y);
      y += 5;
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      const lines = doc.splitTextToSize(observaciones, pageWidth - 20);
      doc.text(lines, 10, y);
    }

    doc.save(`Checklist_GE_${info.fecha}_${info.cliente || "sin_cliente"}.pdf`);
    toast({ title: "PDF exportado", description: "El archivo se descargó correctamente" });
  }

  const filteredSecciones = getFilteredSecciones();

  // Count completed items
  const totalItems = secciones.reduce((acc, s) => acc + s.items.length, 0);
  const completedItems = secciones.reduce((acc, s) => acc + s.items.filter((i) => i.estado !== "").length, 0);
  const obsItems = secciones.reduce((acc, s) => acc + s.items.filter((i) => i.estado === "observacion").length, 0);

  return (
    <div className="space-y-4">
      {/* Logo header */}
      {empresa?.logo_url && (
        <div className="flex justify-center mb-2">
          <img src={empresa.logo_url} alt="Logo" className="h-12 object-contain" />
        </div>
      )}

      {/* Progress bar */}
      <div className="flex items-center gap-3 bg-white rounded-lg p-3 border">
        <div className="flex-1">
          <div className="flex justify-between text-xs text-gray-600 mb-1">
            <span>Progreso: {completedItems}/{totalItems} ítems</span>
            <span>{Math.round((completedItems / totalItems) * 100)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="h-2 rounded-full transition-all"
              style={{ width: `${(completedItems / totalItems) * 100}%`, backgroundColor: colorPrimario }}
            />
          </div>
        </div>
        {obsItems > 0 && (
          <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50">
            <AlertTriangle className="w-3 h-3 mr-1" /> {obsItems} OBS
          </Badge>
        )}
      </div>

      {/* Información General */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Wrench className="w-4 h-4" style={{ color: colorPrimario }} />
            Información General
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          <div>
            <Label className="text-xs">Cliente</Label>
            <Input value={info.cliente} onChange={(e) => setInfo({ ...info, cliente: e.target.value })} placeholder="Nombre del cliente" />
          </div>
          <div>
            <Label className="text-xs">Ubicación</Label>
            <Input value={info.ubicacion} onChange={(e) => setInfo({ ...info, ubicacion: e.target.value })} placeholder="Dirección o sitio" />
          </div>
          <div>
            <Label className="text-xs">Fecha</Label>
            <Input type="date" value={info.fecha} onChange={(e) => setInfo({ ...info, fecha: e.target.value })} />
          </div>
          <div>
            <Label className="text-xs">Hora Inicio</Label>
            <Input type="time" value={info.hora_inicio} onChange={(e) => setInfo({ ...info, hora_inicio: e.target.value })} />
          </div>
          <div>
            <Label className="text-xs">Hora Término</Label>
            <Input type="time" value={info.hora_termino} onChange={(e) => setInfo({ ...info, hora_termino: e.target.value })} />
          </div>
          <div>
            <Label className="text-xs">Técnico Responsable</Label>
            <Input value={info.tecnico} readOnly className="bg-gray-50" />
          </div>
          <div>
            <Label className="text-xs">Supervisor</Label>
            <Input value={info.supervisor} onChange={(e) => setInfo({ ...info, supervisor: e.target.value })} placeholder="Nombre supervisor" />
          </div>
          <div>
            <Label className="text-xs">Marca Equipo</Label>
            <Input value={info.marca_equipo} onChange={(e) => setInfo({ ...info, marca_equipo: e.target.value })} placeholder="Ej: Cummins, Caterpillar" />
          </div>
          <div>
            <Label className="text-xs">Modelo Equipo</Label>
            <Input value={info.modelo_equipo} onChange={(e) => setInfo({ ...info, modelo_equipo: e.target.value })} placeholder="Modelo" />
          </div>
          <div>
            <Label className="text-xs">Número de Serie</Label>
            <Input value={info.numero_serie} onChange={(e) => setInfo({ ...info, numero_serie: e.target.value })} placeholder="S/N" />
          </div>
          <div>
            <Label className="text-xs">Horómetro (hrs)</Label>
            <Input value={info.horometro} onChange={(e) => setInfo({ ...info, horometro: e.target.value })} placeholder="Lectura actual" />
          </div>
          <div>
            <Label className="text-xs">Tipo de Servicio</Label>
            <select
              value={info.tipo_servicio}
              onChange={(e) => setInfo({ ...info, tipo_servicio: e.target.value })}
              className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="semanal">Semanal</option>
              <option value="cada_vez">Cada Vez (Visita)</option>
              <option value="250h">Cada 250 Horas</option>
              <option value="anual">Revisión Anual</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Filtro de frecuencia */}
      <div className="flex gap-2 flex-wrap items-center bg-white p-3 rounded-lg border">
        <span className="text-xs font-medium text-gray-600 mr-2">Filtrar por frecuencia:</span>
        <button
          type="button"
          onClick={() => setFiltroFrecuencia("todas")}
          className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
            filtroFrecuencia === "todas" ? "bg-gray-800 text-white border-gray-800" : "bg-white text-gray-600 border-gray-300 hover:bg-gray-100"
          }`}
        >
          Todas ({totalItems})
        </button>
        {(Object.keys(FRECUENCIA_LABELS) as Frecuencia[]).map((freq) => {
          const count = secciones.reduce((acc, s) => acc + s.items.filter((i) => i.frecuencias.includes(freq)).length, 0);
          return (
            <button
              key={freq}
              type="button"
              onClick={() => setFiltroFrecuencia(freq)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                filtroFrecuencia === freq ? "bg-gray-800 text-white border-gray-800" : `${FRECUENCIA_COLORS[freq]} hover:opacity-80`
              }`}
            >
              {FRECUENCIA_LABELS[freq]} ({count})
            </button>
          );
        })}
      </div>

      {/* Secciones de inspección */}
      {filteredSecciones.map((sec, secIdx) => (
        <Card key={sec.nombre}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold" style={{ color: colorPrimario }}>
              {sec.nombre}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {sec.items.map((item, itemIdx) => (
              <div key={item.numero} className={`p-3 rounded-lg border ${item.estado === "observacion" ? "border-amber-300 bg-amber-50" : item.estado === "ok" ? "border-green-200 bg-green-50/30" : "border-gray-200 bg-white"}`}>
                <div className="flex items-start gap-2">
                  <span className="text-xs font-bold text-gray-500 mt-1 min-w-[24px]">{item.numero}.</span>
                  <div className="flex-1 space-y-2">
                    <p className="text-xs text-gray-700 leading-relaxed">{item.descripcion}</p>
                    {/* Frecuencia badges */}
                    <div className="flex gap-1 flex-wrap">
                      {item.frecuencias.map((f) => (
                        <span key={f} className={`text-[10px] px-1.5 py-0.5 rounded border ${FRECUENCIA_COLORS[f]}`}>
                          {FRECUENCIA_LABELS[f]}
                        </span>
                      ))}
                    </div>
                    {/* Estado + Lectura */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <select
                        value={item.estado}
                        onChange={(e) => updateItem(secIdx, itemIdx, "estado", e.target.value)}
                        className="h-8 rounded border border-gray-300 px-2 text-xs min-w-[100px]"
                      >
                        <option value="">— Estado —</option>
                        <option value="ok">✓ OK</option>
                        <option value="observacion">⚠ Observación</option>
                        <option value="no_aplica">N/A</option>
                      </select>
                      <Input
                        value={item.valor_lectura}
                        onChange={(e) => updateItem(secIdx, itemIdx, "valor_lectura", e.target.value)}
                        placeholder="Lectura / Valor"
                        className="h-8 text-xs max-w-[150px]"
                      />
                    </div>
                    {/* Observación (visible always for OBS, optional for others) */}
                    {(item.estado === "observacion" || item.observacion) && (
                      <Textarea
                        value={item.observacion}
                        onChange={(e) => updateItem(secIdx, itemIdx, "observacion", e.target.value)}
                        placeholder="Detalle de la observación..."
                        className="text-xs min-h-[50px]"
                      />
                    )}
                    {item.estado !== "observacion" && !item.observacion && item.estado !== "" && (
                      <button
                        type="button"
                        onClick={() => updateItem(secIdx, itemIdx, "observacion", " ")}
                        className="text-[10px] text-blue-500 hover:underline"
                      >
                        + Agregar nota
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}

      {/* Observaciones generales */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Observaciones Generales</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
            placeholder="Observaciones importantes del servicio, recomendaciones, notas para el cliente..."
            className="min-h-[80px] text-sm"
          />
          <div className="mt-2 p-2 bg-amber-50 rounded border border-amber-200 text-[10px] text-amber-700">
            <strong>Notas importantes:</strong>
            <ul className="list-disc ml-3 mt-1 space-y-0.5">
              <li>Los puntos 1, 3, 4, 6, 7, 8 y 9 deben ser chequeados por el cliente periódicamente</li>
              <li>Elementos de relleno (lubricante, electrolito, refrigerante) suministrados por el cliente</li>
              <li>La carga para pruebas será suministrada por el cliente</li>
              <li>Para puntos 39-41 se requiere tablero de transferencia desenergizado</li>
              <li>No incluye lavado de estanques ni análisis de combustible</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex gap-2 flex-wrap sticky bottom-0 bg-white p-3 rounded-lg border shadow-sm">
        <Button
          onClick={() => guardar("borrador")}
          disabled={saving}
          variant="outline"
          className="flex-1 min-w-[140px]"
        >
          <Save className="w-4 h-4 mr-1" />
          {saving ? "Guardando..." : "Guardar Borrador"}
        </Button>
        <Button
          onClick={() => guardar("completado")}
          disabled={saving}
          className="flex-1 min-w-[140px]"
          style={{ backgroundColor: colorPrimario }}
        >
          <CheckCircle2 className="w-4 h-4 mr-1" />
          Completar
        </Button>
        <Button onClick={exportPDF} variant="outline" className="min-w-[100px]">
          <Download className="w-4 h-4 mr-1" />
          PDF
        </Button>
      </div>
    </div>
  );
}