export interface Empresa {
  id: string;
  nombre: string;
  logo_url?: string;
  color_primario: string;
  color_secundario: string;
  rut?: string;
  direccion?: string;
  telefono?: string;
  email?: string;
  activa: boolean;
  created_at: string;
}

export interface Usuario {
  id: string;
  auth_id: string;
  nombre: string;
  email: string;
  rol: "superadmin" | "admin" | "tecnico" | "supervisor";
  empresa_id: string;
  region?: string;
  debe_cambiar_password?: boolean;
}

export interface OrdenTrabajo {
  id: string;
  numero: string;
  cliente: string;
  descripcion: string;
  direccion: string;
  tipo_serv: string;
  prioridad: "baja" | "media" | "alta";
  estado: "pendiente" | "en_curso" | "en_revision" | "completada";
  notas: string;
  firma_por: string;
  fecha_inicio: string;
  fecha_cierre?: string;
  completado_por?: string;
  tecnico_id: string;
  empresa_id: string;
  foto_url?: string[];
  firma_cliente_url?: string;
  tecnico_nombre?: string;
  codigo_activo?: string;
  programacion_id?: string;
}