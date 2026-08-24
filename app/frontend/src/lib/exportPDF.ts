import jsPDF from "jspdf";
import type { OrdenTrabajo } from "@/lib/types";
import { SUPABASE_URL } from "@/lib/supabase";

function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return "—";
  try {
    // Supabase may return timestamps without timezone suffix
    // We store dates with toISOString() which is always UTC.
    // If no timezone indicator is present, append 'Z' to ensure correct UTC interpretation.
    let normalized = dateStr.trim();
    const hasTimezone = normalized.endsWith("Z") || 
      /[+-]\d{2}:\d{2}$/.test(normalized) || 
      /[+-]\d{4}$/.test(normalized);
    if (!hasTimezone) {
      normalized = normalized.replace(" ", "T") + "Z";
    }
    const date = new Date(normalized);
    if (isNaN(date.getTime())) return dateStr;
    return date.toLocaleString("es-CL", {
      timeZone: "America/Santiago",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  } catch {
    return dateStr;
  }
}

async function loadImageAsDataURL(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, { mode: "cors" });
    if (!response.ok) return null;
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function getImageFormat(dataURL: string): "JPEG" | "PNG" {
  if (dataURL.startsWith("data:image/png")) return "PNG";
  return "JPEG";
}

export interface MaterialPDF {
  nombre: string;
  cantidad: number;
  unidad: string;
  categoria?: string;
}

export async function exportOTPDF(ot: OrdenTrabajo, empresaNombre?: string, materiales?: MaterialPDF[]): Promise<void> {
  const doc = new jsPDF("p", "mm", "a4");
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  const headerTitle = empresaNombre || "Sistema OT";

  // Helper to check page break
  const checkPageBreak = (needed: number) => {
    if (y + needed > doc.internal.pageSize.getHeight() - margin) {
      doc.addPage();
      y = margin;
    }
  };

  // ===== HEADER =====
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, pageWidth, 28, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(headerTitle, margin, 12);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("Orden de Trabajo", margin, 19);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text(ot.numero || "Sin número", pageWidth - margin, 12, {
    align: "right",
  });

  y = 36;

  // ===== STATUS & PRIORITY BADGES =====
  doc.setTextColor(0, 0, 0);

  const estadoColors: Record<string, [number, number, number]> = {
    pendiente: [245, 158, 11],
    en_curso: [14, 165, 233],
    completada: [34, 197, 94],
  };
  const estadoLabels: Record<string, string> = {
    pendiente: "PENDIENTE",
    en_curso: "EN CURSO",
    completada: "COMPLETADA",
  };

  const badgeColor = estadoColors[ot.estado] || [100, 100, 100];
  doc.setFillColor(badgeColor[0], badgeColor[1], badgeColor[2]);
  const estadoText = estadoLabels[ot.estado] || ot.estado.toUpperCase();
  const estadoWidth = doc.getTextWidth(estadoText) + 8;
  doc.roundedRect(margin, y - 5, estadoWidth, 8, 2, 2, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text(estadoText, margin + 4, y);

  const prioridadColors: Record<string, [number, number, number]> = {
    baja: [148, 163, 184],
    media: [251, 146, 60],
    alta: [239, 68, 68],
  };
  const prioColor = prioridadColors[ot.prioridad] || [100, 100, 100];
  const prioText = `Prioridad: ${ot.prioridad.toUpperCase()}`;
  const prioWidth = doc.getTextWidth(prioText) + 8;
  doc.setFillColor(prioColor[0], prioColor[1], prioColor[2]);
  doc.roundedRect(margin + estadoWidth + 4, y - 5, prioWidth, 8, 2, 2, "F");
  doc.setTextColor(255, 255, 255);
  doc.text(prioText, margin + estadoWidth + 8, y);

  y += 12;

  // ===== DATA TABLE =====
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(10);

  const rows: [string, string][] = [
    ["Cliente", ot.cliente || "—"],
    ["Técnico", ot.tecnico_nombre || "—"],
    ["Dirección", ot.direccion || "—"],
    ["Descripción", ot.descripcion || "—"],
    ["Tipo de Servicio", ot.tipo_serv || "—"],
    ["Firmado por", ot.firma_por || "—"],
    ["Observaciones", ot.notas || "—"],
    ["Fecha Inicio", formatDate(ot.fecha_inicio)],
    ["Fecha Cierre", formatDate(ot.fecha_cierre)],
    ["Completado por", ot.completado_por || "—"],
  ];

  for (const [label, value] of rows) {
    checkPageBreak(10);

    doc.setFillColor(241, 245, 249);
    doc.rect(margin, y - 4, 45, 8, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(51, 65, 85);
    doc.text(label, margin + 2, y);

    doc.setFont("helvetica", "normal");
    doc.setTextColor(0, 0, 0);
    const lines = doc.splitTextToSize(value, contentWidth - 50);
    doc.text(lines, margin + 48, y);

    const lineHeight = Math.max(1, lines.length) * 5;
    y += lineHeight + 4;
  }

  y += 4;

  // ===== MATERIALES ASIGNADOS =====
  if (materiales && materiales.length > 0) {
    checkPageBreak(20);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text("Materiales Utilizados", margin, y);
    y += 6;

    doc.setDrawColor(200, 200, 200);
    doc.line(margin, y, pageWidth - margin, y);
    y += 4;

    // Table header
    doc.setFillColor(226, 232, 240); // slate-200
    doc.rect(margin, y - 4, contentWidth, 7, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(51, 65, 85);
    doc.text("Material", margin + 2, y);
    doc.text("Categoría", margin + 85, y);
    doc.text("Cantidad", margin + 125, y);
    doc.text("Unidad", margin + 150, y);
    y += 5;

    // Table rows
    doc.setFont("helvetica", "normal");
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(8);

    for (const mat of materiales) {
      checkPageBreak(8);
      // Alternate row background
      const rowIndex = materiales.indexOf(mat);
      if (rowIndex % 2 === 1) {
        doc.setFillColor(248, 250, 252); // slate-50
        doc.rect(margin, y - 3.5, contentWidth, 6, "F");
      }

      const nombreLines = doc.splitTextToSize(mat.nombre, 80);
      doc.text(nombreLines[0] || "—", margin + 2, y);
      doc.text(mat.categoria || "—", margin + 85, y);
      doc.text(String(mat.cantidad), margin + 125, y);
      doc.text(mat.unidad || "—", margin + 150, y);
      y += 6;
    }

    y += 4;
  }

  // ===== PHOTOS =====
  if (ot.foto_url && ot.foto_url.length > 0) {
    checkPageBreak(20);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text("Fotos", margin, y);
    y += 6;

    doc.setDrawColor(200, 200, 200);
    doc.line(margin, y, pageWidth - margin, y);
    y += 4;

    let xPos = margin;
    const imgSize = 45;
    const imgGap = 5;

    for (const foto of ot.foto_url) {
      const url = `${SUPABASE_URL}/storage/v1/object/public/fotos_ot/${foto}`;
      const dataURL = await loadImageAsDataURL(url);

      if (dataURL) {
        if (xPos + imgSize > pageWidth - margin) {
          xPos = margin;
          y += imgSize + imgGap;
        }
        checkPageBreak(imgSize + 10);

        try {
          const format = getImageFormat(dataURL);
          doc.addImage(dataURL, format, xPos, y, imgSize, imgSize);
          xPos += imgSize + imgGap;
        } catch {
          // Skip image if it fails to load
        }
      }
    }
    y += imgSize + 8;
  }

  // ===== SIGNATURE =====
  if (ot.firma_cliente_url) {
    checkPageBreak(50);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text("Firma del Cliente", margin, y);
    y += 6;

    doc.setDrawColor(200, 200, 200);
    doc.line(margin, y, pageWidth - margin, y);
    y += 4;

    const sigDataURL = await loadImageAsDataURL(ot.firma_cliente_url);
    if (sigDataURL) {
      try {
        const format = getImageFormat(sigDataURL);
        doc.addImage(sigDataURL, format, margin, y, 70, 25);
        y += 30;
      } catch {
        doc.setFont("helvetica", "italic");
        doc.setFontSize(9);
        doc.setTextColor(150, 150, 150);
        doc.text("(Firma no disponible)", margin, y + 10);
        y += 15;
      }
    }
  }

  // ===== FOOTER =====
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    const pageH = doc.internal.pageSize.getHeight();
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.setFont("helvetica", "normal");
    doc.text(
      `${headerTitle} — Generado el ${new Date().toLocaleString("es-CL", { timeZone: "America/Santiago", hour12: false })} — Página ${i} de ${totalPages}`,
      pageWidth / 2,
      pageH - 8,
      { align: "center" }
    );
  }

  // Save
  const fileName = `${ot.numero || "OT"}_${ot.cliente || "sin_cliente"}.pdf`.replace(
    /\s+/g,
    "_"
  );
  doc.save(fileName);
}