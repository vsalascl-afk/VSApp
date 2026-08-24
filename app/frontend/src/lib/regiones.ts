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