import { useState, useRef } from "react";
import { useEmpresa } from "@/lib/empresaContext";
import type { Usuario } from "@/lib/types";
import type {
  ChecklistBMS,
  InformacionGeneral,
  InspeccionVisual,
  InspeccionElectrica,
  RedesComunicacion,
  SoftwareBms,
  Respaldos,
  PruebasFuncionales,
  Hallazgo,
  Evidencias,
  ResultadoFinal,
  Firmas,
  CampoOkObsNa,
  CampoBuenoObsFalla,
  OkObsNa,
  BuenoObsFalla,
  Criticidad,
  EstadoGeneral,
} from "@/lib/checklistTypes";
import { TIPOS_HALLAZGO, EQUIPOS_COMPATIBLES } from "@/lib/checklistTypes";
import { SUPABASE_URL, SUPABASE_KEY, SUPABASE_SERVICE_KEY } from "@/lib/supabase";
import { offlineSaveFetch, buildSupabaseUrl } from "@/lib/offlineFetch";
import { generateCorrelativo } from "@/lib/correlativoUtils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Save, Plus, Trash2, Camera, FileText, Download } from "lucide-react";
import { exportMantencionPDF } from "@/lib/exportChecklistPDF";
import SignaturePad from "signature_pad";

interface ModificacionEntry {
  fecha: string;
  usuario: string;
  descripcion: string;
}

interface EditRecord {
  id: string;
  estado: string;
  informacion_general: InformacionGeneral;
  inspeccion_visual: InspeccionVisual;
  inspeccion_electrica: InspeccionElectrica;
  redes_comunicacion: RedesComunicacion;
  software_bms: SoftwareBms;
  respaldos_data: Respaldos;
  pruebas_funcionales: PruebasFuncionales;
  hallazgos_data: Hallazgo[];
  evidencias_data: Evidencias;
  resultado_final: ResultadoFinal;
  firmas_data: Firmas;
  historial_modificaciones?: ModificacionEntry[];
  hora_creacion?: string;
  hora_cierre?: string;
}

interface Props {
  user: Usuario;
  token: string;
  editRecord?: EditRecord | null;
  onEditDone?: () => void;
}

function emptyOkObsNa(): CampoOkObsNa {
  return { valor: "", comentario: "", foto_url: "" };
}

function getInitialInfo(user: Usuario): InformacionGeneral {
  const now = new Date();
  return {
    cliente: user.region === "valparaiso" ? "Hospital Provincial Marga Marga" : "",
    instalacion: "",
    edificio: "",
    piso: "",
    area: "",
    fecha: now.toISOString().split("T")[0],
    hora_inicio: now.toTimeString().slice(0, 5),
    hora_termino: "",
    tecnico_responsable: user.nombre || "",
    supervisor: "",
    codigo_activo: "",
    marca: "",
    modelo: "",
    numero_serie: "",
  };
}

function getInitialVisual(): InspeccionVisual {
  return {
    estado_general_equipo: emptyOkObsNa(),
    limpieza_general_equipo: emptyOkObsNa(),
    limpieza_entorno: emptyOkObsNa(),
    estado_gabinete: emptyOkObsNa(),
    estado_borneras: emptyOkObsNa(),
    estado_patch_cord: emptyOkObsNa(),
    estado_conector_red: emptyOkObsNa(),
    estado_ventilacion: emptyOkObsNa(),
    estado_etiquetado: emptyOkObsNa(),
    estado_indicadores_led: emptyOkObsNa(),
    ausencia_humedad: emptyOkObsNa(),
    ausencia_corrosion: emptyOkObsNa(),
  };
}

function emptyBuenoObsFalla(): CampoBuenoObsFalla {
  return { valor: "", comentario: "", foto_url: "" };
}

function getInitialElectrica(): InspeccionElectrica {
  return {
    voltaje_ac: "",
    voltaje_dc: "",
    corriente_consumo: "",
    estado_fuente_alimentacion: emptyBuenoObsFalla(),
    estado_fusibles: emptyBuenoObsFalla(),
    estado_proteccion_electrica: emptyBuenoObsFalla(),
    reapriete_terminales: emptyOkObsNa(),
    reapriete_contactos: emptyOkObsNa(),
    estado_cableado: emptyOkObsNa(),
    foto_url: "",
  };
}

function getInitialRedes(): RedesComunicacion {
  return {
    comunicacion_bacnet_ip: emptyOkObsNa(),
    comunicacion_bacnet_mstp: emptyOkObsNa(),
    comunicacion_modbus_rtu: emptyOkObsNa(),
    comunicacion_modbus_tcp: emptyOkObsNa(),
    estado_switch_industrial: emptyOkObsNa(),
    estado_red_ethernet: emptyOkObsNa(),
    estado_puntos_red: emptyOkObsNa(),
    estado_direccionamiento: emptyOkObsNa(),
    direccion_ip: "",
    mascara: "",
    gateway: "",
    bacnet_device_id: "",
  };
}

function getInitialSoftware(): SoftwareBms {
  return {
    integracion_software: emptyOkObsNa(),
    comunicacion_servidor: emptyOkObsNa(),
    estado_alarmas: emptyOkObsNa(),
    estado_tendencias: emptyOkObsNa(),
    estado_graficos: emptyOkObsNa(),
    estado_puntos_monitoreados: emptyOkObsNa(),
    estado_historicos: emptyOkObsNa(),
    version_software: "",
    version_firmware: "",
  };
}

function getInitialRespaldos(): Respaldos {
  return {
    respaldo_base_datos: emptyOkObsNa(),
    respaldo_programacion: emptyOkObsNa(),
    respaldo_logica_control: emptyOkObsNa(),
    respaldo_configuraciones: emptyOkObsNa(),
    archivo_respaldo_url: "",
  };
}

function getInitialPruebas(): PruebasFuncionales {
  return {
    lectura_variables: emptyOkObsNa(),
    escritura_variables: emptyOkObsNa(),
    alarmas: emptyOkObsNa(),
    tendencias: emptyOkObsNa(),
    comandos_remotos: emptyOkObsNa(),
    operacion_normal_controlador: emptyOkObsNa(),
    operacion_modulos_io: emptyOkObsNa(),
  };
}

function getInitialEvidencias(): Evidencias {
  return {
    foto_frontal: "",
    foto_interior: "",
    foto_comunicaciones: "",
    foto_hallazgos: "",
    foto_etiquetado: "",
    foto_mediciones: "",
  };
}

function getInitialResultado(): ResultadoFinal {
  return {
    estado_general: "",
    observaciones_generales: "",
    recomendaciones: "",
    acciones_tomadas: "",
  };
}

function getInitialFirmas(): Firmas {
  return {
    firma_tecnico: "",
    firma_supervisor: "",
    firma_cliente: "",
    fecha_cierre: "",
  };
}

// OK/OBS/NA Field Component
function OkObsNaField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: CampoOkObsNa;
  onChange: (v: CampoOkObsNa) => void;
}) {
  return (
    <div className="border rounded-lg p-3 space-y-2">
      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
        <span className="text-sm font-medium flex-1 min-w-0">{label}</span>
        <div className="flex gap-1">
          {(["ok", "obs", "na"] as OkObsNa[]).map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => onChange({ ...value, valor: opt })}
              className={`px-3 py-1 text-xs font-bold rounded transition-colors ${
                value.valor === opt
                  ? opt === "ok"
                    ? "bg-green-500 text-white"
                    : opt === "obs"
                    ? "bg-amber-500 text-white"
                    : "bg-gray-400 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {opt.toUpperCase()}
            </button>
          ))}
        </div>
      </div>
      {value.valor === "obs" && (
        <div className="space-y-2 pl-2 border-l-2 border-amber-300">
          <Input
            placeholder="Comentario obligatorio..."
            value={value.comentario}
            onChange={(e) => onChange({ ...value, comentario: e.target.value })}
            className="text-sm"
          />
          <div className="flex items-center gap-2">
            <Camera className="w-4 h-4 text-gray-400" />
            <Input
              type="file"
              accept="image/*"
              className="text-xs"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (file) {
                  const dataUrl = await fileToDataURL(file);
                  onChange({ ...value, foto_url: dataUrl });
                }
              }}
            />
          </div>
          {value.foto_url && (
            <img src={value.foto_url} alt="Evidencia" className="w-20 h-20 object-cover rounded border" />
          )}
        </div>
      )}
    </div>
  );
}

// Bueno/OBS/Falla Field Component
function BuenoObsFallaField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: CampoBuenoObsFalla;
  onChange: (v: CampoBuenoObsFalla) => void;
}) {
  return (
    <div className="border rounded-lg p-3 space-y-2">
      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
        <span className="text-sm font-medium flex-1 min-w-0">{label}</span>
        <div className="flex gap-1">
          {(["bueno", "obs", "falla"] as BuenoObsFalla[]).map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => onChange({ ...value, valor: opt })}
              className={`px-3 py-1 text-xs font-bold rounded transition-colors ${
                value.valor === opt
                  ? opt === "bueno"
                    ? "bg-green-500 text-white"
                    : opt === "obs"
                    ? "bg-amber-500 text-white"
                    : "bg-red-500 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {opt === "bueno" ? "BUENO" : opt === "obs" ? "OBS" : "FALLA"}
            </button>
          ))}
        </div>
      </div>
      {(value.valor === "obs" || value.valor === "falla") && (
        <div className={`space-y-2 pl-2 border-l-2 ${value.valor === "falla" ? "border-red-300" : "border-amber-300"}`}>
          <Input
            placeholder={value.valor === "falla" ? "Descripción de la falla..." : "Comentario de observación..."}
            value={value.comentario}
            onChange={(e) => onChange({ ...value, comentario: e.target.value })}
            className="text-sm"
          />
          <div className="flex items-center gap-2">
            <Camera className="w-4 h-4 text-gray-400" />
            <Input
              type="file"
              accept="image/*"
              className="text-xs"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (file) {
                  const dataUrl = await fileToDataURL(file);
                  onChange({ ...value, foto_url: dataUrl });
                }
              }}
            />
          </div>
          {value.foto_url && (
            <img src={value.foto_url} alt="Evidencia" className="w-20 h-20 object-cover rounded border" />
          )}
        </div>
      )}
    </div>
  );
}

// Signature Component
function SignatureField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const padRef = useRef<SignaturePad | null>(null);

  function initPad() {
    if (canvasRef.current && !padRef.current) {
      padRef.current = new SignaturePad(canvasRef.current, {
        backgroundColor: "rgb(255, 255, 255)",
      });
    }
  }

  function clearSig() {
    padRef.current?.clear();
    onChange("");
  }

  function saveSig() {
    if (padRef.current && !padRef.current.isEmpty()) {
      onChange(padRef.current.toDataURL());
    }
  }

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">{label}</Label>
      {value ? (
        <div className="space-y-2">
          <img src={value} alt={label} className="border rounded h-20 bg-white" />
          <Button type="button" variant="outline" size="sm" onClick={() => onChange("")}>
            Cambiar firma
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          <canvas
            ref={canvasRef}
            width={300}
            height={100}
            className="border rounded cursor-crosshair bg-white w-full max-w-[300px]"
            onMouseEnter={initPad}
            onTouchStart={initPad}
          />
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={clearSig}>
              Limpiar
            </Button>
            <Button type="button" size="sm" onClick={saveSig}>
              Guardar firma
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function fileToDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function ChecklistBMSForm({ user, token, editRecord, onEditDone }: Props) {
  const { empresa } = useEmpresa();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [currentSection, setCurrentSection] = useState(0);

  const isEditing = !!editRecord;

  const [info, setInfo] = useState<InformacionGeneral>(editRecord?.informacion_general || getInitialInfo(user));
  const [visual, setVisual] = useState<InspeccionVisual>(editRecord?.inspeccion_visual || getInitialVisual());
  const [electrica, setElectrica] = useState<InspeccionElectrica>(editRecord?.inspeccion_electrica || getInitialElectrica());
  const [redes, setRedes] = useState<RedesComunicacion>(editRecord?.redes_comunicacion || getInitialRedes());
  const [software, setSoftware] = useState<SoftwareBms>(editRecord?.software_bms || getInitialSoftware());
  const [respaldos, setRespaldos] = useState<Respaldos>(editRecord?.respaldos_data || getInitialRespaldos());
  const [pruebas, setPruebas] = useState<PruebasFuncionales>(editRecord?.pruebas_funcionales || getInitialPruebas());
  const [hallazgos, setHallazgos] = useState<Hallazgo[]>(editRecord?.hallazgos_data || []);
  const [evidencias, setEvidencias] = useState<Evidencias>(editRecord?.evidencias_data || getInitialEvidencias());
  const [resultado, setResultado] = useState<ResultadoFinal>(editRecord?.resultado_final || getInitialResultado());
  const [firmas, setFirmas] = useState<Firmas>(editRecord?.firmas_data || getInitialFirmas());
  const [historialMods, setHistorialMods] = useState<ModificacionEntry[]>(editRecord?.historial_modificaciones || []);

  const sections = [
    "Información General",
    "Inspección Visual",
    "Inspección Eléctrica",
    "Redes de Comunicación",
    "Software BMS",
    "Respaldos",
    "Pruebas Funcionales",
    "Hallazgos",
    "Evidencias",
    "Resultado Final",
    "Firmas",
  ];

  async function handleSave(finalizar: boolean) {
    if (!empresa) {
      toast({ title: "Error", description: "No hay empresa seleccionada", variant: "destructive" });
      return;
    }

    // Validación obligatoria de Resultado Final antes de finalizar
    if (finalizar && !resultado.estado_general) {
      toast({
        title: "Resultado obligatorio",
        description: "Debe seleccionar un Estado General en la sección 'Resultado Final' antes de completar el checklist.",
        variant: "destructive",
      });
      setCurrentSection(9); // Ir a sección Resultado Final
      return;
    }

    if (finalizar && !resultado.acciones_tomadas.trim()) {
      toast({
        title: "Acciones tomadas obligatorias",
        description: "Debe detallar las acciones tomadas en la sección 'Resultado Final' antes de completar el checklist.",
        variant: "destructive",
      });
      setCurrentSection(9); // Ir a sección Resultado Final
      return;
    }

    setSaving(true);
    try {
      const serviceKey = SUPABASE_SERVICE_KEY || SUPABASE_KEY;
      const now = new Date();
      const horaActual = now.toLocaleString("es-CL", { timeZone: "America/Santiago", hour12: false });

      // Build modification history entry
      const newHistorial = [...historialMods];
      if (isEditing) {
        newHistorial.push({
          fecha: horaActual,
          usuario: user.nombre,
          descripcion: finalizar ? "Completó y finalizó el checklist" : "Editó y guardó cambios",
        });
      } else {
        newHistorial.push({
          fecha: horaActual,
          usuario: user.nombre,
          descripcion: "Creó el checklist",
        });
      }

      const record: Record<string, unknown> = {
        empresa_id: empresa.id,
        tecnico_id: user.id,
        estado: finalizar ? "finalizado" : "borrador",
        informacion_general: info,
        inspeccion_visual: visual,
        inspeccion_electrica: electrica,
        redes_comunicacion: redes,
        software_bms: software,
        respaldos_data: respaldos,
        pruebas_funcionales: pruebas,
        hallazgos_data: hallazgos,
        evidencias_data: evidencias,
        resultado_final: resultado,
        firmas_data: firmas,
        historial_modificaciones: newHistorial,
      };

      if (user.region) {
        record.region = user.region;
      }

      // Set creation time and correlative for new records
      if (!isEditing) {
        record.hora_creacion = horaActual;
        const correlativo = await generateCorrelativo(empresa.id, "mantencion_bms");
        record.numero_interno = correlativo;
      }

      // Set closure time when finalizing
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
          title: finalizar ? "Checklist completado" : isEditing ? "Cambios guardados" : "Borrador guardado",
          description: finalizar
            ? "El checklist ha sido completado y puede exportarse a PDF."
            : isEditing
            ? "Los cambios se guardaron correctamente."
            : "Se guardó como borrador.",
        });
      }

      // If finalizing, also export PDF
      if (finalizar) {
        try {
          await exportMantencionPDF({
            info,
            visual,
            electrica,
            redes,
            software,
            respaldos,
            pruebas,
            hallazgos,
            evidencias,
            resultado,
            firmas,
            empresaNombre: empresa.nombre,
            empresaLogoUrl: empresa.logo_url || "",
            horaCreacion: editRecord?.hora_creacion || horaActual,
            horaCierre: horaActual,
            historialModificaciones: newHistorial,
          });
        } catch { /* PDF export is best-effort */ }
      }

      // Reset form or go back
      if (isEditing && onEditDone) {
        onEditDone();
      } else if (finalizar) {
        setInfo(getInitialInfo(user));
        setVisual(getInitialVisual());
        setElectrica(getInitialElectrica());
        setRedes(getInitialRedes());
        setSoftware(getInitialSoftware());
        setRespaldos(getInitialRespaldos());
        setPruebas(getInitialPruebas());
        setHallazgos([]);
        setEvidencias(getInitialEvidencias());
        setResultado(getInitialResultado());
        setFirmas(getInitialFirmas());
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

  function addHallazgo() {
    setHallazgos([
      ...hallazgos,
      { tipos: [], criticidad: "media", descripcion: "", foto_url: "", accion_correctiva: "" },
    ]);
  }

  function removeHallazgo(idx: number) {
    setHallazgos(hallazgos.filter((_, i) => i !== idx));
  }

  function updateHallazgo(idx: number, field: keyof Hallazgo, value: unknown) {
    const updated = [...hallazgos];
    (updated[idx] as Record<string, unknown>)[field] = value;
    setHallazgos(updated);
  }

  function toggleHallazgoTipo(idx: number, tipo: string) {
    const updated = [...hallazgos];
    const current = updated[idx].tipos;
    if (current.includes(tipo)) {
      updated[idx].tipos = current.filter((t) => t !== tipo);
    } else {
      updated[idx].tipos = [...current, tipo];
    }
    setHallazgos(updated);
  }

  // Section navigation
  const renderSectionNav = () => (
    <div className="flex flex-wrap gap-1 mb-4">
      {sections.map((s, i) => (
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
          {i + 1}. {s}
        </button>
      ))}
    </div>
  );

  // SECTION 1 - Información General
  const isQuintaRegion = user.region === "valparaiso" || user.region === "quinta_region";

  const renderSeccion1 = () => (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Sección 1 - Información General</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {([
          ["cliente", "Cliente"],
          ["instalacion", "Instalación"],
          ["edificio", "Edificio"],
          ["piso", "Piso"],
          ["area", "Área"],
          ["fecha", "Fecha"],
          ["hora_inicio", "Hora Inicio"],
          ["hora_termino", "Hora Término"],
          ["tecnico_responsable", "Técnico Responsable"],
          ["supervisor", "Supervisor"],
          ["codigo_activo", "Código Activo"],
          ["marca", "Marca"],
          ["modelo", "Modelo"],
          ["numero_serie", "Número de Serie"],
        ] as [keyof InformacionGeneral, string][]).map(([key, label]) => (
          <div key={key} className="space-y-1">
            <Label className="text-xs">{label}</Label>
            <Input
              type={key === "fecha" ? "date" : key.includes("hora") ? "time" : "text"}
              value={info[key]}
              onChange={(e) => setInfo({ ...info, [key]: e.target.value })}
              placeholder={label}
              readOnly={(key === "cliente" && isQuintaRegion) || key === "tecnico_responsable"}
              className={(key === "cliente" && isQuintaRegion) || key === "tecnico_responsable" ? "bg-gray-50 cursor-not-allowed" : ""}
            />
          </div>
        ))}
        <div className="sm:col-span-2">
          <Label className="text-xs">Equipo Compatible</Label>
          <select
            className="w-full border rounded px-3 py-2 text-sm"
            value={info.modelo}
            onChange={(e) => setInfo({ ...info, modelo: e.target.value })}
          >
            <option value="">Seleccionar equipo...</option>
            {EQUIPOS_COMPATIBLES.map((eq) => (
              <option key={eq} value={eq}>{eq}</option>
            ))}
          </select>
        </div>
      </CardContent>
    </Card>
  );

  // SECTION 2 - Inspección Visual
  const renderSeccion2 = () => {
    const fields: [keyof InspeccionVisual, string][] = [
      ["estado_general_equipo", "Estado general del equipo"],
      ["limpieza_general_equipo", "Limpieza general del equipo"],
      ["limpieza_entorno", "Limpieza del entorno"],
      ["estado_gabinete", "Estado gabinete"],
      ["estado_borneras", "Estado borneras"],
      ["estado_patch_cord", "Estado patch cord"],
      ["estado_conector_red", "Estado conector de red"],
      ["estado_ventilacion", "Estado ventilación"],
      ["estado_etiquetado", "Estado etiquetado"],
      ["estado_indicadores_led", "Estado indicadores LED"],
      ["ausencia_humedad", "Ausencia de humedad"],
      ["ausencia_corrosion", "Ausencia de corrosión"],
    ];

    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sección 2 - Inspección Visual</CardTitle>
          <p className="text-xs text-muted-foreground">
            Comentario y fotografía obligatorios si respuesta = OBS
          </p>
        </CardHeader>
        <CardContent className="space-y-2">
          {fields.map(([key, label]) => (
            <OkObsNaField
              key={key}
              label={label}
              value={visual[key]}
              onChange={(v) => setVisual({ ...visual, [key]: v })}
            />
          ))}
        </CardContent>
      </Card>
    );
  };

  // SECTION 3 - Inspección Eléctrica
  const renderSeccion3 = () => {
    const numFields: [keyof InspeccionElectrica, string, string][] = [
      ["voltaje_ac", "Voltaje Alimentación AC", "V"],
      ["voltaje_dc", "Voltaje Alimentación DC", "V"],
      ["corriente_consumo", "Corriente Consumo", "A"],
    ];
    const bofFields: [keyof InspeccionElectrica, string][] = [
      ["estado_fuente_alimentacion", "Estado Fuente Alimentación"],
      ["estado_fusibles", "Estado Fusibles"],
      ["estado_proteccion_electrica", "Estado Protección Eléctrica"],
    ];
    const okFields: [keyof InspeccionElectrica, string][] = [
      ["reapriete_terminales", "Reapriete terminales"],
      ["reapriete_contactos", "Reapriete contactos E/S"],
      ["estado_cableado", "Estado cableado"],
    ];

    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sección 3 - Inspección Eléctrica</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {numFields.map(([key, label, unit]) => (
              <div key={key} className="space-y-1">
                <Label className="text-xs">{label} {unit && `(${unit})`}</Label>
                <Input
                  type="text"
                  value={electrica[key] as string}
                  onChange={(e) => setElectrica({ ...electrica, [key]: e.target.value })}
                  placeholder={label}
                />
              </div>
            ))}
          </div>
          <div className="space-y-2 mt-3">
            {bofFields.map(([key, label]) => (
              <BuenoObsFallaField
                key={key}
                label={label}
                value={electrica[key] as CampoBuenoObsFalla}
                onChange={(v) => setElectrica({ ...electrica, [key]: v })}
              />
            ))}
          </div>
          <div className="space-y-2 mt-3">
            {okFields.map(([key, label]) => (
              <OkObsNaField
                key={key}
                label={label}
                value={electrica[key] as CampoOkObsNa}
                onChange={(v) => setElectrica({ ...electrica, [key]: v })}
              />
            ))}
          </div>
          <div className="flex items-center gap-2 mt-2">
            <Camera className="w-4 h-4 text-gray-400" />
            <Label className="text-xs">Fotografía (opcional)</Label>
            <Input
              type="file"
              accept="image/*"
              className="text-xs"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (file) {
                  const dataUrl = await fileToDataURL(file);
                  setElectrica({ ...electrica, foto_url: dataUrl });
                }
              }}
            />
          </div>
        </CardContent>
      </Card>
    );
  };

  // SECTION 4 - Redes de Comunicación
  const renderSeccion4 = () => {
    const okFields: [keyof RedesComunicacion, string][] = [
      ["comunicacion_bacnet_ip", "Comunicación BACnet IP"],
      ["comunicacion_bacnet_mstp", "Comunicación BACnet MS-TP"],
      ["comunicacion_modbus_rtu", "Comunicación Modbus RTU"],
      ["comunicacion_modbus_tcp", "Comunicación Modbus TCP"],
      ["estado_switch_industrial", "Estado Switch Industrial"],
      ["estado_red_ethernet", "Estado Red Ethernet"],
      ["estado_puntos_red", "Estado Puntos de Red"],
      ["estado_direccionamiento", "Estado Direccionamiento"],
    ];
    const textFields: [keyof RedesComunicacion, string][] = [
      ["direccion_ip", "Dirección IP"],
      ["mascara", "Máscara"],
      ["gateway", "Gateway"],
      ["bacnet_device_id", "BACnet Device ID"],
    ];

    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sección 4 - Redes de Comunicación</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            {okFields.map(([key, label]) => (
              <OkObsNaField
                key={key}
                label={label}
                value={redes[key] as CampoOkObsNa}
                onChange={(v) => setRedes({ ...redes, [key]: v })}
              />
            ))}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
            {textFields.map(([key, label]) => (
              <div key={key} className="space-y-1">
                <Label className="text-xs">{label}</Label>
                <Input
                  value={redes[key] as string}
                  onChange={(e) => setRedes({ ...redes, [key]: e.target.value })}
                  placeholder={label}
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  };

  // SECTION 5 - Software BMS
  const renderSeccion5 = () => {
    const okFields: [keyof SoftwareBms, string][] = [
      ["integracion_software", "Integración en software BMS"],
      ["comunicacion_servidor", "Comunicación con servidor"],
      ["estado_alarmas", "Estado de alarmas"],
      ["estado_tendencias", "Estado de tendencias"],
      ["estado_graficos", "Estado gráficos"],
      ["estado_puntos_monitoreados", "Estado puntos monitoreados"],
      ["estado_historicos", "Estado históricos"],
    ];

    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sección 5 - Software BMS</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            {okFields.map(([key, label]) => (
              <OkObsNaField
                key={key}
                label={label}
                value={software[key] as CampoOkObsNa}
                onChange={(v) => setSoftware({ ...software, [key]: v })}
              />
            ))}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
            <div className="space-y-1">
              <Label className="text-xs">Versión Software</Label>
              <Input
                value={software.version_software}
                onChange={(e) => setSoftware({ ...software, version_software: e.target.value })}
                placeholder="Ej: 12.0.1"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Versión Firmware</Label>
              <Input
                value={software.version_firmware}
                onChange={(e) => setSoftware({ ...software, version_firmware: e.target.value })}
                placeholder="Ej: 3.2.0"
              />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  // SECTION 6 - Respaldos
  const renderSeccion6 = () => {
    const okFields: [keyof Respaldos, string][] = [
      ["respaldo_base_datos", "Respaldo base de datos realizado"],
      ["respaldo_programacion", "Respaldo programación realizado"],
      ["respaldo_logica_control", "Respaldo lógica de control realizado"],
      ["respaldo_configuraciones", "Respaldo configuraciones realizado"],
    ];

    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sección 6 - Respaldos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            {okFields.map(([key, label]) => (
              <OkObsNaField
                key={key}
                label={label}
                value={respaldos[key] as CampoOkObsNa}
                onChange={(v) => setRespaldos({ ...respaldos, [key]: v })}
              />
            ))}
          </div>
          <div className="flex items-center gap-2 mt-3">
            <FileText className="w-4 h-4 text-gray-400" />
            <Label className="text-xs">Adjuntar respaldo</Label>
            <Input
              type="file"
              className="text-xs"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (file) {
                  const dataUrl = await fileToDataURL(file);
                  setRespaldos({ ...respaldos, archivo_respaldo_url: dataUrl });
                }
              }}
            />
          </div>
        </CardContent>
      </Card>
    );
  };

  // SECTION 7 - Pruebas Funcionales
  const renderSeccion7 = () => {
    const fields: [keyof PruebasFuncionales, string][] = [
      ["lectura_variables", "Lectura de variables"],
      ["escritura_variables", "Escritura de variables"],
      ["alarmas", "Alarmas"],
      ["tendencias", "Tendencias"],
      ["comandos_remotos", "Comandos remotos"],
      ["operacion_normal_controlador", "Operación normal controlador"],
      ["operacion_modulos_io", "Operación módulos I/O"],
    ];

    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sección 7 - Pruebas Funcionales</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {fields.map(([key, label]) => (
            <OkObsNaField
              key={key}
              label={label}
              value={pruebas[key]}
              onChange={(v) => setPruebas({ ...pruebas, [key]: v })}
            />
          ))}
        </CardContent>
      </Card>
    );
  };

  // SECTION 8 - Hallazgos
  const renderSeccion8 = () => (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center justify-between">
          <span>Sección 8 - Hallazgos</span>
          <Button type="button" size="sm" variant="outline" onClick={addHallazgo}>
            <Plus className="w-4 h-4 mr-1" /> Agregar
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {hallazgos.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            Sin hallazgos registrados. Presione "Agregar" si detectó alguno.
          </p>
        )}
        {hallazgos.map((h, idx) => (
          <div key={idx} className="border rounded-lg p-3 space-y-3 relative">
            <button
              type="button"
              onClick={() => removeHallazgo(idx)}
              className="absolute top-2 right-2 text-red-400 hover:text-red-600"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <Label className="text-xs font-bold">Hallazgo #{idx + 1}</Label>

            {/* Tipos multiselección */}
            <div className="space-y-1">
              <Label className="text-xs">Tipo(s)</Label>
              <div className="flex flex-wrap gap-1">
                {TIPOS_HALLAZGO.map((tipo) => (
                  <button
                    key={tipo}
                    type="button"
                    onClick={() => toggleHallazgoTipo(idx, tipo)}
                    className={`px-2 py-1 text-xs rounded transition-colors ${
                      h.tipos.includes(tipo)
                        ? "bg-blue-500 text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {tipo}
                  </button>
                ))}
              </div>
            </div>

            {/* Criticidad */}
            <div className="space-y-1">
              <Label className="text-xs">Criticidad</Label>
              <div className="flex gap-1">
                {(["baja", "media", "alta", "critica"] as Criticidad[]).map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => updateHallazgo(idx, "criticidad", c)}
                    className={`px-3 py-1 text-xs rounded font-bold transition-colors ${
                      h.criticidad === c
                        ? c === "critica"
                          ? "bg-red-600 text-white"
                          : c === "alta"
                          ? "bg-orange-500 text-white"
                          : c === "media"
                          ? "bg-amber-500 text-white"
                          : "bg-green-500 text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {c.charAt(0).toUpperCase() + c.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Descripción</Label>
              <Textarea
                value={h.descripcion}
                onChange={(e) => updateHallazgo(idx, "descripcion", e.target.value)}
                placeholder="Descripción del hallazgo..."
                rows={2}
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Acción Correctiva Recomendada</Label>
              <Textarea
                value={h.accion_correctiva}
                onChange={(e) => updateHallazgo(idx, "accion_correctiva", e.target.value)}
                placeholder="Acción correctiva..."
                rows={2}
              />
            </div>

            <div className="flex items-center gap-2">
              <Camera className="w-4 h-4 text-gray-400" />
              <Input
                type="file"
                accept="image/*"
                className="text-xs"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const dataUrl = await fileToDataURL(file);
                    updateHallazgo(idx, "foto_url", dataUrl);
                  }
                }}
              />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );

  // SECTION 9 - Evidencias
  const renderSeccion9 = () => {
    const fotos: [keyof Evidencias, string][] = [
      ["foto_frontal", "Fotografía Frontal"],
      ["foto_interior", "Fotografía Interior"],
      ["foto_comunicaciones", "Fotografía Comunicaciones"],
      ["foto_hallazgos", "Fotografía Hallazgos"],
      ["foto_etiquetado", "Fotografía Etiquetado"],
      ["foto_mediciones", "Fotografía Mediciones"],
    ];

    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sección 9 - Evidencias</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {fotos.map(([key, label]) => (
            <div key={key} className="space-y-1">
              <Label className="text-xs flex items-center gap-1">
                <Camera className="w-3 h-3" /> {label}
              </Label>
              {evidencias[key] ? (
                <div className="space-y-1">
                  <img
                    src={evidencias[key]}
                    alt={label}
                    className="w-full h-24 object-cover rounded border"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    onClick={() => setEvidencias({ ...evidencias, [key]: "" })}
                  >
                    Cambiar
                  </Button>
                </div>
              ) : (
                <Input
                  type="file"
                  accept="image/*"
                  className="text-xs"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const dataUrl = await fileToDataURL(file);
                      setEvidencias({ ...evidencias, [key]: dataUrl });
                    }
                  }}
                />
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    );
  };

  // SECTION 10 - Resultado Final
  const renderSeccion10 = () => {
    const estados: [EstadoGeneral, string][] = [
      ["operativo", "Operativo"],
      ["operativo_obs", "Operativo con observaciones"],
      ["requiere_correctivo", "Requiere mantenimiento correctivo"],
      ["fuera_servicio", "Fuera de servicio"],
    ];

    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sección 10 - Resultado Final</CardTitle>
          <p className="text-xs text-muted-foreground">
            ⚠️ Los campos Estado General y Acciones Tomadas son <span className="font-bold text-red-600">obligatorios</span> para finalizar el checklist.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs font-medium">
              Estado General <span className="text-red-500">*</span>
            </Label>
            <div className="flex flex-wrap gap-2">
              {estados.map(([val, label]) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setResultado({ ...resultado, estado_general: val })}
                  className={`px-3 py-2 text-xs rounded-lg border transition-colors ${
                    resultado.estado_general === val
                      ? val === "operativo"
                        ? "bg-green-500 text-white border-green-500"
                        : val === "operativo_obs"
                        ? "bg-amber-500 text-white border-amber-500"
                        : val === "requiere_correctivo"
                        ? "bg-orange-500 text-white border-orange-500"
                        : "bg-red-500 text-white border-red-500"
                      : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            {!resultado.estado_general && (
              <p className="text-xs text-red-500 mt-1">Debe seleccionar un estado para finalizar</p>
            )}
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-medium">
              Acciones Tomadas <span className="text-red-500">*</span>
            </Label>
            <Textarea
              value={resultado.acciones_tomadas}
              onChange={(e) => setResultado({ ...resultado, acciones_tomadas: e.target.value })}
              placeholder="Detalle las acciones realizadas durante la mantención: limpieza, ajustes, reemplazos, configuraciones, pruebas ejecutadas, etc."
              rows={4}
              className={!resultado.acciones_tomadas.trim() ? "border-red-300" : ""}
            />
            {!resultado.acciones_tomadas.trim() && (
              <p className="text-xs text-red-500 mt-1">Debe detallar las acciones tomadas para finalizar</p>
            )}
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Observaciones Generales</Label>
            <Textarea
              value={resultado.observaciones_generales}
              onChange={(e) => setResultado({ ...resultado, observaciones_generales: e.target.value })}
              placeholder="Observaciones generales del mantenimiento..."
              rows={3}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Recomendaciones</Label>
            <Textarea
              value={resultado.recomendaciones}
              onChange={(e) => setResultado({ ...resultado, recomendaciones: e.target.value })}
              placeholder="Recomendaciones para próximo mantenimiento..."
              rows={3}
            />
          </div>
        </CardContent>
      </Card>
    );
  };

  // SECTION 11 - Firmas
  const renderSeccion11 = () => (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Sección 11 - Firmas</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <SignatureField
          label="Firma Técnico"
          value={firmas.firma_tecnico}
          onChange={(v) => setFirmas({ ...firmas, firma_tecnico: v })}
        />
        <SignatureField
          label="Firma Cliente"
          value={firmas.firma_cliente}
          onChange={(v) => setFirmas({ ...firmas, firma_cliente: v })}
        />
        <div className="space-y-1">
          <Label className="text-xs">Fecha Cierre</Label>
          <Input
            type="date"
            value={firmas.fecha_cierre}
            onChange={(e) => setFirmas({ ...firmas, fecha_cierre: e.target.value })}
          />
        </div>
      </CardContent>
    </Card>
  );

  const sectionRenderers = [
    renderSeccion1,
    renderSeccion2,
    renderSeccion3,
    renderSeccion4,
    renderSeccion5,
    renderSeccion6,
    renderSeccion7,
    renderSeccion8,
    renderSeccion9,
    renderSeccion10,
    renderSeccion11,
  ];

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

      {/* Header info */}
      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant="outline" className="text-xs">
          Categoría: Automatización y Control
        </Badge>
        <Badge variant="outline" className="text-xs">
          Frecuencia: Bimensual / Trimestral / Semestral
        </Badge>
      </div>

      {/* Section navigation */}
      {renderSectionNav()}

      {/* Current section */}
      {sectionRenderers[currentSection]()}

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
          disabled={currentSection === sections.length - 1}
          onClick={() => setCurrentSection((s) => s + 1)}
        >
          Siguiente →
        </Button>
      </div>
    </div>
  );
}