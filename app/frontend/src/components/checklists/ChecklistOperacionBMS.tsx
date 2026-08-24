import { useState } from "react";
import { useEmpresa } from "@/lib/empresaContext";
import type { Usuario } from "@/lib/types";
import { SUPABASE_URL, SUPABASE_KEY, SUPABASE_SERVICE_KEY } from "@/lib/supabase";
import { offlineSaveFetch } from "@/lib/offlineFetch";
import { generateCorrelativo } from "@/lib/correlativoUtils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Save, AlertTriangle, Download, Camera, X, Image } from "lucide-react";
import { exportOperacionPDF } from "@/lib/exportChecklistPDF";

interface ModificacionEntry {
  fecha: string;
  usuario: string;
  descripcion: string;
}

interface EditRecordOp {
  id: string;
  estado: string;
  informacion_general: {
    operador: string;
    turno: "" | "diurno" | "nocturno";
    fecha: string;
    hora_inicio: string;
    hora_termino: string;
    numero_ronda: string;
    observaciones_turno: string;
  };
  especialidades_data: EspecialidadOperacion[];
  bitacora: string;
  historial_modificaciones?: ModificacionEntry[];
  hora_creacion?: string;
  hora_cierre?: string;
}

interface Props {
  user: Usuario;
  token: string;
  editRecord?: EditRecordOp | null;
  onEditDone?: () => void;
}

type EstadoItem = "normal" | "alarma" | "fuera_servicio" | "no_aplica" | "";

interface ItemOperacion {
  subespecialidad: string;
  monitoreo: boolean;
  control: boolean;
  estado: EstadoItem;
  valor_lectura: string;
  observacion: string;
  foto_alarma?: string; // base64 or URL of alarm screenshot/photo
}

interface EspecialidadOperacion {
  nombre: string;
  periodicidad: string;
  observaciones_ref: string;
  items: ItemOperacion[];
}

function getEspecialidades(): EspecialidadOperacion[] {
  return [
    {
      nombre: "Climatización",
      periodicidad: "4 veces en turno (12 horas)",
      observaciones_ref: "Atención a UMA y equipos de clima en sectores críticos: Pabellones, aislamiento, urgencias, data center, UPC e imagenología",
      items: [
        { subespecialidad: "Unidades manejadoras de aire", monitoreo: true, control: true, estado: "", valor_lectura: "", observacion: "" },
        { subespecialidad: "Equipos VAV", monitoreo: true, control: true, estado: "", valor_lectura: "", observacion: "" },
        { subespecialidad: "Equipos Baterías", monitoreo: true, control: true, estado: "", valor_lectura: "", observacion: "" },
        { subespecialidad: "Equipos VF", monitoreo: true, control: true, estado: "", valor_lectura: "", observacion: "" },
        { subespecialidad: "Equipos Fan coil", monitoreo: true, control: true, estado: "", valor_lectura: "", observacion: "" },
        { subespecialidad: "Unidad interior", monitoreo: true, control: true, estado: "", valor_lectura: "", observacion: "" },
        { subespecialidad: "Equipo de precisión (Data center)", monitoreo: true, control: true, estado: "", valor_lectura: "", observacion: "" },
        { subespecialidad: "Equipos EX", monitoreo: true, control: true, estado: "", valor_lectura: "", observacion: "" },
        { subespecialidad: "Equipos VIN", monitoreo: true, control: true, estado: "", valor_lectura: "", observacion: "" },
        { subespecialidad: "Equipos VEX", monitoreo: true, control: true, estado: "", valor_lectura: "", observacion: "" },
      ],
    },
    {
      nombre: "Central Frío",
      periodicidad: "4 veces en turno (12 horas)",
      observaciones_ref: "Atención a parámetros de Chiller y BCM, bombas de circuitos primarios y secundarios",
      items: [
        { subespecialidad: "Chiller", monitoreo: true, control: true, estado: "", valor_lectura: "", observacion: "" },
        { subespecialidad: "BCM", monitoreo: true, control: true, estado: "", valor_lectura: "", observacion: "" },
        { subespecialidad: "Bombas", monitoreo: true, control: true, estado: "", valor_lectura: "", observacion: "" },
      ],
    },
    {
      nombre: "Central Calor",
      periodicidad: "4 veces en turno (12 horas)",
      observaciones_ref: "Atención a bombas de calor y sistema de agua caliente para climatización",
      items: [
        { subespecialidad: "BCM", monitoreo: true, control: true, estado: "", valor_lectura: "", observacion: "" },
        { subespecialidad: "Bombas", monitoreo: true, control: true, estado: "", valor_lectura: "", observacion: "" },
      ],
    },
    {
      nombre: "Paneles Solares",
      periodicidad: "4 veces en turno (12 horas)",
      observaciones_ref: "Atención a parámetros de paneles solares y sistema de ACS",
      items: [
        { subespecialidad: "Drycooler", monitoreo: true, control: true, estado: "", valor_lectura: "", observacion: "" },
        { subespecialidad: "Boiler", monitoreo: true, control: true, estado: "", valor_lectura: "", observacion: "" },
        { subespecialidad: "Bombas", monitoreo: true, control: true, estado: "", valor_lectura: "", observacion: "" },
      ],
    },
    {
      nombre: "Estanques",
      periodicidad: "3 veces en turno (12 horas)",
      observaciones_ref: "Atención a presión de suministro, nivel de estanques y estado de bombas",
      items: [
        { subespecialidad: "Agua potable", monitoreo: true, control: false, estado: "", valor_lectura: "", observacion: "" },
        { subespecialidad: "Riego", monitoreo: true, control: false, estado: "", valor_lectura: "", observacion: "" },
        { subespecialidad: "Agua servida", monitoreo: true, control: false, estado: "", valor_lectura: "", observacion: "" },
        { subespecialidad: "Sentina", monitoreo: true, control: false, estado: "", valor_lectura: "", observacion: "" },
        { subespecialidad: "Combustibles generadores", monitoreo: true, control: false, estado: "", valor_lectura: "", observacion: "" },
      ],
    },
    {
      nombre: "Gases Clínicos",
      periodicidad: "3 veces en turno (12 horas)",
      observaciones_ref: "Atención a presión en sectores críticos: Pabellones, Urgencias, UPC e Imagenología",
      items: [
        { subespecialidad: "Panel de alarma de Manifold", monitoreo: true, control: false, estado: "", valor_lectura: "", observacion: "" },
        { subespecialidad: "Panel de alarma de compresores", monitoreo: true, control: false, estado: "", valor_lectura: "", observacion: "" },
        { subespecialidad: "Comunicación BACnet IP", monitoreo: true, control: false, estado: "", valor_lectura: "", observacion: "" },
        { subespecialidad: "Paneles de alarma por piso", monitoreo: true, control: false, estado: "", valor_lectura: "", observacion: "" },
      ],
    },
    {
      nombre: "Energía y UPS",
      periodicidad: "3 veces en turno (12 horas)",
      observaciones_ref: "Atención a activación de UPS",
      items: [
        { subespecialidad: "UPS por pisos", monitoreo: true, control: false, estado: "", valor_lectura: "", observacion: "" },
        { subespecialidad: "Diagrama Unilineal de la Red", monitoreo: true, control: false, estado: "", valor_lectura: "", observacion: "" },
        { subespecialidad: "Generadores", monitoreo: true, control: false, estado: "", valor_lectura: "", observacion: "" },
        { subespecialidad: "Transformadores", monitoreo: true, control: false, estado: "", valor_lectura: "", observacion: "" },
      ],
    },
    {
      nombre: "Iluminación",
      periodicidad: "2 veces en turno (12 horas)",
      observaciones_ref: "Atención a iluminación y protecciones de sectores críticos: Pabellones, Urgencias, UPC e Imagenología",
      items: [
        { subespecialidad: "Circuitos de iluminación por piso (DALI)", monitoreo: true, control: true, estado: "", valor_lectura: "", observacion: "" },
        { subespecialidad: "Estado de disyuntores termomagnéticos", monitoreo: true, control: false, estado: "", valor_lectura: "", observacion: "" },
      ],
    },
    {
      nombre: "Incendio",
      periodicidad: "2 veces en turno (12 horas)",
      observaciones_ref: "Atención a manifold de red húmeda y dispositivos de detección",
      items: [
        { subespecialidad: "Detectores de humo", monitoreo: true, control: false, estado: "", valor_lectura: "", observacion: "" },
        { subespecialidad: "Detectores de temperatura", monitoreo: true, control: false, estado: "", valor_lectura: "", observacion: "" },
        { subespecialidad: "Detectores por aspiración", monitoreo: true, control: false, estado: "", valor_lectura: "", observacion: "" },
        { subespecialidad: "Bombas", monitoreo: true, control: false, estado: "", valor_lectura: "", observacion: "" },
        { subespecialidad: "Señales luminosas y sonoras", monitoreo: true, control: false, estado: "", valor_lectura: "", observacion: "" },
        { subespecialidad: "Pulsadores de alarma", monitoreo: true, control: false, estado: "", valor_lectura: "", observacion: "" },
        { subespecialidad: "Sistemas de extinción FM-200", monitoreo: true, control: false, estado: "", valor_lectura: "", observacion: "" },
        { subespecialidad: "VIP", monitoreo: true, control: false, estado: "", valor_lectura: "", observacion: "" },
      ],
    },
    {
      nombre: "Agua Tratada",
      periodicidad: "3 veces en turno (12 horas)",
      observaciones_ref: "Atención a parámetros de bombas y nivel de estanques",
      items: [
        { subespecialidad: "Plantas de tratamiento", monitoreo: true, control: false, estado: "", valor_lectura: "", observacion: "" },
        { subespecialidad: "Bombas", monitoreo: true, control: false, estado: "", valor_lectura: "", observacion: "" },
        { subespecialidad: "Estanques", monitoreo: true, control: false, estado: "", valor_lectura: "", observacion: "" },
      ],
    },
    {
      nombre: "Correo Neumático, Remarcador y Sensores",
      periodicidad: "2 veces en turno (12 horas)",
      observaciones_ref: "Atención a parámetros de sensores de CO2, CO y NO2",
      items: [
        { subespecialidad: "Lectura de suministro", monitoreo: true, control: false, estado: "", valor_lectura: "", observacion: "" },
        { subespecialidad: "Lectura de sensores de CO2, CO y NO2", monitoreo: true, control: false, estado: "", valor_lectura: "", observacion: "" },
        { subespecialidad: "Estado de zonas y componentes del correo neumático", monitoreo: true, control: false, estado: "", valor_lectura: "", observacion: "" },
      ],
    },
    {
      nombre: "Portal de Alarmas BMS",
      periodicidad: "4 veces en turno (12 horas)",
      observaciones_ref: "Atención a categorías críticas del portal, sin dejar de lado consolas integradas en pantallas gráficas",
      items: [
        { subespecialidad: "Consolas de alarma por categoría", monitoreo: true, control: true, estado: "", valor_lectura: "", observacion: "" },
        { subespecialidad: "Historial y base de datos de alarmas", monitoreo: true, control: true, estado: "", valor_lectura: "", observacion: "" },
      ],
    },
  ];
}

function EstadoButton({
  estado,
  value,
  onChange,
}: {
  estado: EstadoItem;
  value: EstadoItem;
  onChange: (v: EstadoItem) => void;
}) {
  const labels: Record<EstadoItem, string> = {
    normal: "Normal",
    alarma: "Alarma",
    fuera_servicio: "F/S",
    no_aplica: "N/A",
    "": "",
  };
  const colors: Record<EstadoItem, string> = {
    normal: "bg-green-500 text-white",
    alarma: "bg-red-500 text-white",
    fuera_servicio: "bg-gray-600 text-white",
    no_aplica: "bg-gray-300 text-gray-700",
    "": "",
  };

  if (estado === "") return null;

  return (
    <button
      type="button"
      onClick={() => onChange(estado === value ? "" : estado)}
      className={`px-2 py-1 text-xs font-bold rounded transition-colors ${
        value === estado ? colors[estado] : "bg-gray-100 text-gray-500 hover:bg-gray-200"
      }`}
    >
      {labels[estado]}
    </button>
  );
}

export default function ChecklistOperacionBMS({ user, token, editRecord, onEditDone }: Props) {
  const { empresa } = useEmpresa();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [currentSection, setCurrentSection] = useState(0);

  const isEditing = !!editRecord;

  // Info general de la ronda - captura hora del equipo automáticamente
  const nowLocal = new Date();
  const [infoRonda, setInfoRonda] = useState(
    editRecord?.informacion_general || {
      operador: user.nombre || "",
      turno: "" as "diurno" | "nocturno" | "",
      fecha: nowLocal.toISOString().split("T")[0],
      hora_inicio: nowLocal.toTimeString().slice(0, 5),
      hora_termino: "",
      numero_ronda: "",
      observaciones_turno: "",
      hora_equipo_creacion: nowLocal.toLocaleString("es-CL", { hour12: false }),
    }
  );

  const [especialidades, setEspecialidades] = useState<EspecialidadOperacion[]>(
    editRecord?.especialidades_data || getEspecialidades()
  );
  const [bitacora, setBitacora] = useState(editRecord?.bitacora || "");
  const [historialMods, setHistorialMods] = useState<ModificacionEntry[]>(editRecord?.historial_modificaciones || []);

  function updateItem(espIdx: number, itemIdx: number, field: keyof ItemOperacion, value: string) {
    const updated = [...especialidades];
    (updated[espIdx].items[itemIdx] as Record<string, unknown>)[field] = value;
    setEspecialidades(updated);
  }

  async function handleSave(finalizar: boolean) {
    if (!empresa) {
      toast({ title: "Error", description: "No hay empresa seleccionada", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const serviceKey = SUPABASE_SERVICE_KEY || SUPABASE_KEY;
      const now = new Date();
      const horaActual = now.toLocaleString("es-CL", { timeZone: "America/Santiago", hour12: false });

      // Build modification history
      const newHistorial = [...historialMods];
      if (isEditing) {
        newHistorial.push({
          fecha: horaActual,
          usuario: user.nombre,
          descripcion: finalizar ? "Completó y finalizó la ronda" : "Editó y guardó cambios",
        });
      } else {
        newHistorial.push({
          fecha: horaActual,
          usuario: user.nombre,
          descripcion: "Creó la ronda de operación",
        });
      }

      const record: Record<string, unknown> = {
        empresa_id: empresa.id,
        tecnico_id: user.id,
        estado: finalizar ? "finalizado" : "borrador",
        tipo: "operacion_bms",
        informacion_general: infoRonda,
        especialidades_data: especialidades,
        bitacora,
        historial_modificaciones: newHistorial,
      };
      if (user.region) {
        record.region = user.region;
      }
      if (!isEditing) {
        record.hora_creacion = horaActual;
        const correlativo = await generateCorrelativo(empresa.id, "operacion_bms");
        record.numero_interno = correlativo;
      }
      if (finalizar) {
        record.hora_cierre = horaActual;
      }

      let url = `${SUPABASE_URL}/rest/v1/checklist_bms`;
      let method: "POST" | "PATCH" = "POST";

      if (isEditing && editRecord) {
        url += `?id=eq.${editRecord.id}`;
        method = "PATCH";
      }

      const result = await offlineSaveFetch({
        type: "checklist_bms",
        action: isEditing ? "update" : "create",
        payload: record,
        url,
        method,
        token,
        useServiceKey: true,
      });

      if (!result.success) {
        throw new Error(result.error || "Error al guardar");
      }

      if (result.offline) {
        toast({
          title: "Guardado localmente",
          description: "Sin conexión a internet. Los datos se sincronizarán automáticamente cuando vuelva la señal.",
        });
      } else {
        toast({
          title: finalizar ? "Ronda completada" : isEditing ? "Cambios guardados" : "Borrador guardado",
          description: finalizar
            ? "La ronda ha sido completada y puede exportarse a PDF."
            : isEditing
            ? "Los cambios se guardaron correctamente."
            : "Se guardó como borrador.",
        });
      }

      // Export PDF on finalize
      if (finalizar) {
        try {
          await exportOperacionPDF({
            infoRonda,
            especialidades,
            bitacora,
            empresaNombre: empresa.nombre,
            empresaLogoUrl: empresa.logo_url || "",
            horaCreacion: editRecord?.hora_creacion || horaActual,
            horaCierre: horaActual,
          });
        } catch { /* best-effort */ }
      }

      if (isEditing && onEditDone) {
        onEditDone();
      } else if (finalizar) {
        setInfoRonda({
          operador: user.nombre || "",
          turno: "",
          fecha: new Date().toISOString().split("T")[0],
          hora_inicio: new Date().toTimeString().slice(0, 5),
          hora_termino: "",
          numero_ronda: "",
          observaciones_turno: "",
        });
        setEspecialidades(getEspecialidades());
        setBitacora("");
        setHistorialMods([]);
        setCurrentSection(0);
      } else {
        setHistorialMods(newHistorial);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al guardar";
      toast({ title: "Error", description: msg, variant: "destructive" });
    }
    setSaving(false);
  }

  // Sections: Info + 12 especialidades + Bitácora
  const sectionNames = [
    "Información de Ronda",
    ...especialidades.map((e, i) => `${i + 1}. ${e.nombre}`),
    "Bitácora",
  ];

  const totalAlarmas = especialidades.reduce(
    (acc, esp) => acc + esp.items.filter((it) => it.estado === "alarma").length,
    0
  );

  const renderInfoRonda = () => (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Información de la Ronda de Operación</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Operador</Label>
          <Input
            value={infoRonda.operador}
            readOnly
            className="bg-gray-50 cursor-not-allowed"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Turno</Label>
          <div className="flex gap-2">
            {(["diurno", "nocturno"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setInfoRonda({ ...infoRonda, turno: t })}
                className={`px-4 py-2 text-sm rounded-lg font-medium transition-colors ${
                  infoRonda.turno === t
                    ? t === "diurno"
                      ? "bg-amber-500 text-white"
                      : "bg-indigo-600 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {t === "diurno" ? "☀️ Diurno" : "🌙 Nocturno"}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Fecha</Label>
          <Input
            type="date"
            value={infoRonda.fecha}
            onChange={(e) => setInfoRonda({ ...infoRonda, fecha: e.target.value })}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">N° Ronda</Label>
          <Input
            value={infoRonda.numero_ronda}
            onChange={(e) => setInfoRonda({ ...infoRonda, numero_ronda: e.target.value })}
            placeholder="Ej: 1, 2, 3, 4"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Hora Inicio (automática)</Label>
          <Input
            type="time"
            value={infoRonda.hora_inicio}
            readOnly
            disabled
            className="bg-gray-100 cursor-not-allowed"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Hora Término</Label>
          <Input
            type="time"
            value={infoRonda.hora_termino}
            onChange={(e) => setInfoRonda({ ...infoRonda, hora_termino: e.target.value })}
          />
        </div>
        <div className="sm:col-span-2 space-y-1">
          <Label className="text-xs">Observaciones del turno</Label>
          <Textarea
            value={infoRonda.observaciones_turno}
            onChange={(e) => setInfoRonda({ ...infoRonda, observaciones_turno: e.target.value })}
            placeholder="Novedades del turno anterior, instrucciones especiales..."
            rows={2}
          />
        </div>
        {infoRonda.hora_equipo_creacion && (
          <div className="sm:col-span-2 bg-blue-50 border border-blue-200 rounded-lg p-2">
            <p className="text-xs text-blue-700">
              🕐 <span className="font-medium">Hora del equipo al crear:</span> {infoRonda.hora_equipo_creacion}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );

  const renderEspecialidad = (espIdx: number) => {
    const esp = especialidades[espIdx];
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between flex-wrap gap-2">
            <span>{esp.nombre}</span>
            <Badge variant="outline" className="text-xs">
              {esp.periodicidad}
            </Badge>
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            <AlertTriangle className="w-3 h-3 inline mr-1" />
            {esp.observaciones_ref}
          </p>
        </CardHeader>
        <CardContent className="space-y-2">
          {/* Table header */}
          <div className="hidden sm:grid sm:grid-cols-12 gap-1 text-xs font-medium text-gray-500 border-b pb-1">
            <div className="col-span-3">Sub-especialidad</div>
            <div className="col-span-1 text-center">Mon.</div>
            <div className="col-span-1 text-center">Ctrl.</div>
            <div className="col-span-3 text-center">Estado</div>
            <div className="col-span-2">Lectura</div>
            <div className="col-span-2">Observación</div>
          </div>

          {esp.items.map((item, itemIdx) => (
            <div
              key={itemIdx}
              className={`border rounded-lg p-2 space-y-2 ${
                item.estado === "alarma" ? "border-red-300 bg-red-50" : ""
              }`}
            >
              <div className="sm:grid sm:grid-cols-12 sm:gap-1 sm:items-center space-y-2 sm:space-y-0">
                {/* Subespecialidad */}
                <div className="col-span-3 text-sm font-medium">{item.subespecialidad}</div>

                {/* Monitoreo */}
                <div className="col-span-1 text-center">
                  {item.monitoreo && (
                    <Badge variant="outline" className="text-[10px] px-1">M</Badge>
                  )}
                </div>

                {/* Control */}
                <div className="col-span-1 text-center">
                  {item.control && (
                    <Badge className="bg-blue-100 text-blue-800 text-[10px] px-1">C</Badge>
                  )}
                </div>

                {/* Estado */}
                <div className="col-span-3 flex gap-1 flex-wrap">
                  {(["normal", "alarma", "fuera_servicio", "no_aplica"] as EstadoItem[]).map((est) => (
                    <EstadoButton
                      key={est}
                      estado={est}
                      value={item.estado}
                      onChange={(v) => updateItem(espIdx, itemIdx, "estado", v)}
                    />
                  ))}
                </div>

                {/* Valor lectura */}
                <div className="col-span-2">
                  <Input
                    className="text-xs h-7"
                    placeholder="Valor..."
                    value={item.valor_lectura}
                    onChange={(e) => updateItem(espIdx, itemIdx, "valor_lectura", e.target.value)}
                  />
                </div>

                {/* Observación */}
                <div className="col-span-2">
                  <Input
                    className="text-xs h-7"
                    placeholder="Obs..."
                    value={item.observacion}
                    onChange={(e) => updateItem(espIdx, itemIdx, "observacion", e.target.value)}
                  />
                </div>
              </div>

              {/* Foto de alarma - visible solo cuando estado es "alarma" */}
              {item.estado === "alarma" && (
                <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Camera className="w-4 h-4 text-red-600" />
                    <span className="text-xs font-medium text-red-700">
                      Evidencia fotográfica de alarma (screenshot o foto)
                    </span>
                  </div>
                  {item.foto_alarma ? (
                    <div className="relative inline-block">
                      <img
                        src={item.foto_alarma}
                        alt="Evidencia alarma"
                        className="max-h-40 rounded-lg border border-red-300 object-contain"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const updated = [...especialidades];
                          updated[espIdx].items[itemIdx].foto_alarma = undefined;
                          setEspecialidades(updated);
                        }}
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-2 flex-wrap">
                      <label className="cursor-pointer flex items-center gap-1 px-3 py-2 bg-white border border-red-300 rounded-lg text-xs text-red-700 hover:bg-red-50 transition-colors">
                        <Camera className="w-4 h-4" />
                        <span>Tomar foto</span>
                        <input
                          type="file"
                          accept="image/*"
                          capture="environment"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onload = (ev) => {
                                const updated = [...especialidades];
                                updated[espIdx].items[itemIdx].foto_alarma = ev.target?.result as string;
                                setEspecialidades(updated);
                              };
                              reader.readAsDataURL(file);
                            }
                          }}
                        />
                      </label>
                      <label className="cursor-pointer flex items-center gap-1 px-3 py-2 bg-white border border-red-300 rounded-lg text-xs text-red-700 hover:bg-red-50 transition-colors">
                        <Image className="w-4 h-4" />
                        <span>Subir imagen / screenshot</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onload = (ev) => {
                                const updated = [...especialidades];
                                updated[espIdx].items[itemIdx].foto_alarma = ev.target?.result as string;
                                setEspecialidades(updated);
                              };
                              reader.readAsDataURL(file);
                            }
                          }}
                        />
                      </label>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    );
  };

  const renderBitacora = () => (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Bitácora Digital</CardTitle>
        <p className="text-xs text-muted-foreground">
          Registre eventos, acciones ejecutadas y novedades durante la ronda.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <Textarea
          value={bitacora}
          onChange={(e) => setBitacora(e.target.value)}
          placeholder="Registrar eventos, entregas de turno, solicitudes y/o acciones ejecutadas..."
          rows={6}
        />
        {totalAlarmas > 0 && (
          <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            <span className="text-sm text-red-700 font-medium">
              Se detectaron {totalAlarmas} alarma(s) en esta ronda. Asegúrese de documentar las acciones tomadas.
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-4">
      {/* Company logo header */}
      {empresa?.logo_url && (
        <div className="flex items-center gap-3 pb-2 border-b">
          <img
            src={empresa.logo_url}
            alt={empresa.nombre}
            className="h-10 w-auto object-contain"
          />
          <span className="text-sm font-semibold text-gray-700">{empresa.nombre}</span>
        </div>
      )}

      {/* Header badges */}
      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant="outline" className="text-xs">
          Protocolo de Operación Sala de Control
        </Badge>
        {totalAlarmas > 0 && (
          <Badge className="bg-red-500 text-white text-xs">
            {totalAlarmas} Alarma(s)
          </Badge>
        )}
      </div>

      {/* Section navigation */}
      <div className="flex flex-wrap gap-1 mb-4">
        {sectionNames.map((s, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setCurrentSection(i)}
            className={`px-2 py-1 text-xs rounded transition-colors ${
              currentSection === i
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Current section */}
      {currentSection === 0 && renderInfoRonda()}
      {currentSection >= 1 && currentSection <= 12 && renderEspecialidad(currentSection - 1)}
      {currentSection === 13 && renderBitacora()}

      {/* Navigation buttons */}
      <div className="flex items-center justify-between pt-4 flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={currentSection === 0}
          onClick={() => setCurrentSection((s) => s - 1)}
        >
          ← Anterior
        </Button>

        <div className="flex gap-2 flex-wrap">
          {isEditing && onEditDone && (
            <Button type="button" variant="ghost" onClick={onEditDone} disabled={saving}>
              Cancelar
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            onClick={() => handleSave(false)}
            disabled={saving}
          >
            <Save className="w-4 h-4 mr-1" />
            {isEditing ? "Guardar cambios" : "Guardar borrador"}
          </Button>
          <Button
            type="button"
            onClick={() => handleSave(true)}
            disabled={saving}
            className="bg-green-600 hover:bg-green-700"
          >
            <Download className="w-4 h-4 mr-1" />
            Completar y Exportar PDF
          </Button>
        </div>

        <Button
          type="button"
          variant="outline"
          disabled={currentSection === sectionNames.length - 1}
          onClick={() => setCurrentSection((s) => s + 1)}
        >
          Siguiente →
        </Button>
      </div>
    </div>
  );
}