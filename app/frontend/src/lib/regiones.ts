export interface RegionOption {
  value: string;
  label: string;
}

export const REGIONES: RegionOption[] = [
  { value: "arica", label: "Arica" },
  { value: "iquique", label: "Iquique" },
  { value: "antofagasta", label: "Antofagasta" },
  { value: "copiapo", label: "Copiapó" },
  { value: "la_serena", label: "La Serena" },
  { value: "valparaiso", label: "Valparaíso" },
  { value: "santiago", label: "Santiago" },
  { value: "rancagua", label: "Rancagua" },
  { value: "talca", label: "Talca" },
  { value: "chillan", label: "Chillán" },
  { value: "concepcion", label: "Concepción" },
  { value: "temuco", label: "Temuco" },
  { value: "valdivia", label: "Valdivia" },
  { value: "puerto_montt", label: "Puerto Montt" },
  { value: "coyhaique", label: "Coyhaique" },
  { value: "punta_arenas", label: "Punta Arenas" },
];

export function getRegionLabel(value: string | undefined): string {
  if (!value) return "";
  const region = REGIONES.find((r) => r.value === value);
  if (region) return region.label;
  // Fallback for legacy values
  if (value === "quinta_region") return "Valparaíso";
  return value;
}

// Las 16 regiones oficiales de Chile (nombre completo). Usadas en el portal de
// cliente y en la gestión interna de tickets. Los values arica/copiapo/valparaiso/
// santiago coinciden intencionalmente con los que ya existen en `usuarios.region`.
export const REGIONES_TICKET: RegionOption[] = [
  { value: "arica", label: "Arica y Parinacota" },
  { value: "tarapaca", label: "Tarapacá" },
  { value: "antofagasta", label: "Antofagasta" },
  { value: "copiapo", label: "Atacama" },
  { value: "coquimbo", label: "Coquimbo" },
  { value: "valparaiso", label: "Valparaíso" },
  { value: "santiago", label: "Metropolitana de Santiago" },
  { value: "ohiggins", label: "Libertador General Bernardo O'Higgins" },
  { value: "maule", label: "Maule" },
  { value: "nuble", label: "Ñuble" },
  { value: "biobio", label: "Biobío" },
  { value: "araucania", label: "La Araucanía" },
  { value: "los_rios", label: "Los Ríos" },
  { value: "los_lagos", label: "Los Lagos" },
  { value: "aysen", label: "Aysén del General Carlos Ibáñez del Campo" },
  { value: "magallanes", label: "Magallanes y de la Antártica Chilena" },
];

export function getRegionTicketLabel(value: string | null | undefined): string {
  if (!value) return "";
  return REGIONES_TICKET.find((r) => r.value === value)?.label || value;
}