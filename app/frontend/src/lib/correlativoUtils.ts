import { SUPABASE_URL, SUPABASE_KEY, SUPABASE_SERVICE_KEY } from "@/lib/supabase";

/**
 * Generates the next correlative number for a checklist type within an empresa.
 * Format: PREFIX-NNN (e.g., MTO-001, OP-002, GE-015)
 */

const PREFIXES: Record<string, string> = {
  mantencion_bms: "MTO",
  operacion_bms: "OP",
  grupo_electrogeno: "GE",
};

export function getPrefix(tipo: string): string {
  return PREFIXES[tipo] || "CL";
}

export async function generateCorrelativo(empresaId: string, tipo: string): Promise<string> {
  const prefix = getPrefix(tipo);
  const serviceKey = SUPABASE_SERVICE_KEY || SUPABASE_KEY;

  try {
    // Query existing records of this type for this empresa that have a numero_interno
    // We need to find the highest number
    let tipoFilter: string;
    if (tipo === "mantencion_bms") {
      tipoFilter = `&or=(tipo.is.null,tipo.eq.mantencion_bms)`;
    } else {
      tipoFilter = `&tipo=eq.${tipo}`;
    }

    const url = `${SUPABASE_URL}/rest/v1/checklist_bms?empresa_id=eq.${empresaId}${tipoFilter}&numero_interno=not.is.null&select=numero_interno&order=numero_interno.desc&limit=1`;

    const res = await fetch(url, {
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
      },
    });

    if (res.ok) {
      const data = await res.json();
      if (data && data.length > 0 && data[0].numero_interno) {
        // Extract the number from the last correlative (e.g., "MTO-005" -> 5)
        const lastCorrelativo = data[0].numero_interno as string;
        const match = lastCorrelativo.match(/-(\d+)$/);
        if (match) {
          const nextNum = parseInt(match[1], 10) + 1;
          return `${prefix}-${String(nextNum).padStart(3, "0")}`;
        }
      }
    }

    // If no previous records or error, start at 001
    return `${prefix}-001`;
  } catch (err) {
    console.error("Error generating correlativo:", err);
    return `${prefix}-001`;
  }
}