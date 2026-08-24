export interface CompanyModule {
  id: string;
  empresa_id: string;
  module_name: string;
  active: boolean;
  created_at: string;
}

// Tipos para el formulario BMS
export type OkObsNa = "ok" | "obs" | "na" | "";
export type BuenoObsFalla = "bueno" | "obs" | "falla" | "";
export type Criticidad = "baja" | "media" | "alta" | "critica";
export type EstadoGeneral = "operativo" | "operativo_obs" | "requiere_correctivo" | "fuera_servicio";

export interface InformacionGeneral {
  cliente: string;
  instalacion: string;
  edificio: string;
  piso: string;
  area: string;
  fecha: string;
  hora_inicio: string;
  hora_termino: string;
  tecnico_responsable: string;
  supervisor: string;
  codigo_activo: string;
  marca: string;
  modelo: string;
  numero_serie: string;
}

export interface CampoOkObsNa {
  valor: OkObsNa;
  comentario: string;
  foto_url: string;
}

export interface CampoBuenoObsFalla {
  valor: BuenoObsFalla;
  comentario: string;
  foto_url: string;
}

export interface InspeccionVisual {
  estado_general_equipo: CampoOkObsNa;
  limpieza_general_equipo: CampoOkObsNa;
  limpieza_entorno: CampoOkObsNa;
  estado_gabinete: CampoOkObsNa;
  estado_borneras: CampoOkObsNa;
  estado_patch_cord: CampoOkObsNa;
  estado_conector_red: CampoOkObsNa;
  estado_ventilacion: CampoOkObsNa;
  estado_etiquetado: CampoOkObsNa;
  estado_indicadores_led: CampoOkObsNa;
  ausencia_humedad: CampoOkObsNa;
  ausencia_corrosion: CampoOkObsNa;
}

export interface InspeccionElectrica {
  voltaje_ac: string;
  voltaje_dc: string;
  corriente_consumo: string;
  estado_fuente_alimentacion: CampoBuenoObsFalla;
  estado_fusibles: CampoBuenoObsFalla;
  estado_proteccion_electrica: CampoBuenoObsFalla;
  reapriete_terminales: CampoOkObsNa;
  reapriete_contactos: CampoOkObsNa;
  estado_cableado: CampoOkObsNa;
  foto_url: string;
}

export interface RedesComunicacion {
  comunicacion_bacnet_ip: CampoOkObsNa;
  comunicacion_bacnet_mstp: CampoOkObsNa;
  comunicacion_modbus_rtu: CampoOkObsNa;
  comunicacion_modbus_tcp: CampoOkObsNa;
  estado_switch_industrial: CampoOkObsNa;
  estado_red_ethernet: CampoOkObsNa;
  estado_puntos_red: CampoOkObsNa;
  estado_direccionamiento: CampoOkObsNa;
  direccion_ip: string;
  mascara: string;
  gateway: string;
  bacnet_device_id: string;
}

export interface SoftwareBms {
  integracion_software: CampoOkObsNa;
  comunicacion_servidor: CampoOkObsNa;
  estado_alarmas: CampoOkObsNa;
  estado_tendencias: CampoOkObsNa;
  estado_graficos: CampoOkObsNa;
  estado_puntos_monitoreados: CampoOkObsNa;
  estado_historicos: CampoOkObsNa;
  version_software: string;
  version_firmware: string;
}

export interface Respaldos {
  respaldo_base_datos: CampoOkObsNa;
  respaldo_programacion: CampoOkObsNa;
  respaldo_logica_control: CampoOkObsNa;
  respaldo_configuraciones: CampoOkObsNa;
  archivo_respaldo_url: string;
}

export interface PruebasFuncionales {
  lectura_variables: CampoOkObsNa;
  escritura_variables: CampoOkObsNa;
  alarmas: CampoOkObsNa;
  tendencias: CampoOkObsNa;
  comandos_remotos: CampoOkObsNa;
  operacion_normal_controlador: CampoOkObsNa;
  operacion_modulos_io: CampoOkObsNa;
}

export interface Hallazgo {
  tipos: string[];
  criticidad: Criticidad;
  descripcion: string;
  foto_url: string;
  accion_correctiva: string;
}

export interface Evidencias {
  foto_frontal: string;
  foto_interior: string;
  foto_comunicaciones: string;
  foto_hallazgos: string;
  foto_etiquetado: string;
  foto_mediciones: string;
}

export interface ResultadoFinal {
  estado_general: EstadoGeneral | "";
  observaciones_generales: string;
  recomendaciones: string;
  acciones_tomadas: string;
}

export interface Firmas {
  firma_tecnico: string;
  firma_supervisor: string;
  firma_cliente: string;
  fecha_cierre: string;
}

export interface ChecklistBMS {
  id?: string;
  empresa_id: string;
  informacion_general: InformacionGeneral;
  inspeccion_visual: InspeccionVisual;
  inspeccion_electrica: InspeccionElectrica;
  redes_comunicacion: RedesComunicacion;
  software_bms: SoftwareBms;
  respaldos: Respaldos;
  pruebas_funcionales: PruebasFuncionales;
  hallazgos: Hallazgo[];
  evidencias: Evidencias;
  resultado_final: ResultadoFinal;
  firmas: Firmas;
  estado: "borrador" | "en_proceso" | "finalizado";
  created_at?: string;
  updated_at?: string;
}

export const TIPOS_HALLAZGO = [
  "Sobrecalentamiento",
  "Humedad",
  "Corrosión",
  "Conexión floja",
  "Comunicación intermitente",
  "Pérdida de configuración",
  "Fuente defectuosa",
  "Puerto de red defectuoso",
  "Error BACnet",
  "Error Modbus",
  "Otro",
];

export const EQUIPOS_COMPATIBLES = [
  "SNE 22000-0",
  "SNE 11000-0",
  "SNC-25150-0",
  "FAC-4911",
  "IOM-4711",
  "IOM-2721",
  "IOM-3721",
  "IOM-3731",
  "XPM-18000",
  "XPM-09090",
  "Servidores BMS",
  "Software Metasys",
  "Dispositivos BACnet",
  "Dispositivos Modbus",
];