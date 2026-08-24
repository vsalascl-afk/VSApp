import jsPDF from "jspdf";

interface CotizacionItem {
  tipo: string;
  descripcion: string;
  cantidad: number;
  unidad: string;
  precio_unitario: number;
  descuento_porcentaje: number;
}

interface Cotizacion {
  numero: string;
  titulo: string;
  descripcion?: string;
  cliente_nombre: string;
  cliente_rut?: string;
  cliente_email?: string;
  cliente_telefono?: string;
  cliente_direccion?: string;
  ot_numero?: string;
  items: CotizacionItem[];
  subtotal: number;
  descuento_global: number;
  iva: number;
  total: number;
  validez_dias: number;
  notas?: string;
  condiciones_pago?: string;
  created_at: string;
}

function formatCLP(amount: number): string {
  return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", minimumFractionDigits: 0 }).format(Math.round(amount));
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric" });
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

const tipoLabels: Record<string, string> = {
  material: "Material",
  mano_obra: "Mano de obra",
  servicio: "Servicio",
  otro: "Otro",
};

export async function exportCotizacionPDF(
  cot: Cotizacion,
  empresaNombre: string,
  logoUrl?: string
): Promise<void> {
  const doc = new jsPDF("p", "mm", "a4");
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  const checkPageBreak = (needed: number) => {
    if (y + needed > pageHeight - 20) {
      doc.addPage();
      y = margin;
    }
  };

  // ===== HEADER =====
  doc.setFillColor(16, 185, 129); // emerald-500
  doc.rect(0, 0, pageWidth, 30, "F");

  // Logo
  if (logoUrl) {
    const logoData = await loadImageAsDataURL(logoUrl);
    if (logoData) {
      try {
        doc.addImage(logoData, "PNG", margin, 4, 22, 22);
      } catch {
        // ignore
      }
    }
  }

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text(empresaNombre, logoUrl ? margin + 26 : margin, 14);
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text("COTIZACIÓN", logoUrl ? margin + 26 : margin, 22);

  // Número y fecha
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text(cot.numero, pageWidth - margin, 14, { align: "right" });
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`Fecha: ${formatDate(cot.created_at)}`, pageWidth - margin, 22, { align: "right" });

  y = 38;

  // ===== TITLE =====
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text(cot.titulo, margin, y);
  y += 6;

  if (cot.descripcion) {
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 116, 139);
    const descLines = doc.splitTextToSize(cot.descripcion, contentWidth);
    doc.text(descLines, margin, y);
    y += descLines.length * 4 + 2;
  }

  // ===== CLIENT INFO =====
  y += 4;
  doc.setFillColor(241, 245, 249); // slate-100
  doc.roundedRect(margin, y, contentWidth, 28, 2, 2, "F");
  y += 5;
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("DATOS DEL CLIENTE", margin + 4, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.text(`Nombre: ${cot.cliente_nombre}`, margin + 4, y);
  if (cot.cliente_rut) doc.text(`RUT: ${cot.cliente_rut}`, margin + 100, y);
  y += 4;
  if (cot.cliente_email) doc.text(`Email: ${cot.cliente_email}`, margin + 4, y);
  if (cot.cliente_telefono) doc.text(`Tel: ${cot.cliente_telefono}`, margin + 100, y);
  y += 4;
  if (cot.cliente_direccion) doc.text(`Dirección: ${cot.cliente_direccion}`, margin + 4, y);
  if (cot.ot_numero) doc.text(`OT vinculada: ${cot.ot_numero}`, margin + 100, y);
  y += 8;

  // ===== ITEMS TABLE =====
  y += 4;
  checkPageBreak(20);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 41, 59);
  doc.text("DETALLE DE ÍTEMS", margin, y);
  y += 5;

  // Table header
  doc.setFillColor(16, 185, 129);
  doc.rect(margin, y, contentWidth, 7, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("#", margin + 2, y + 5);
  doc.text("Tipo", margin + 8, y + 5);
  doc.text("Descripción", margin + 30, y + 5);
  doc.text("Cant.", margin + 105, y + 5);
  doc.text("P.Unit.", margin + 120, y + 5);
  doc.text("Desc.", margin + 142, y + 5);
  doc.text("Total", margin + 158, y + 5);
  y += 9;

  // Table rows
  doc.setTextColor(30, 41, 59);
  doc.setFont("helvetica", "normal");
  cot.items.forEach((item, idx) => {
    checkPageBreak(8);
    const lineTotal = item.cantidad * item.precio_unitario * (1 - item.descuento_porcentaje / 100);

    if (idx % 2 === 0) {
      doc.setFillColor(248, 250, 252);
      doc.rect(margin, y - 3, contentWidth, 7, "F");
    }

    doc.setFontSize(8);
    doc.text(String(idx + 1), margin + 2, y);
    doc.text(tipoLabels[item.tipo] || item.tipo, margin + 8, y);
    const descText = doc.splitTextToSize(item.descripcion, 70);
    doc.text(descText[0] || "", margin + 30, y);
    doc.text(`${item.cantidad} ${item.unidad}`, margin + 105, y);
    doc.text(formatCLP(item.precio_unitario), margin + 120, y);
    doc.text(item.descuento_porcentaje > 0 ? `${item.descuento_porcentaje}%` : "-", margin + 142, y);
    doc.setFont("helvetica", "bold");
    doc.text(formatCLP(lineTotal), margin + 158, y);
    doc.setFont("helvetica", "normal");
    y += 6;
  });

  // ===== TOTALS =====
  y += 4;
  checkPageBreak(30);
  const totalsX = margin + contentWidth - 70;
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("Subtotal:", totalsX, y);
  doc.text(formatCLP(cot.subtotal), totalsX + 50, y, { align: "right" });
  y += 5;

  if (cot.descuento_global > 0) {
    doc.setTextColor(220, 38, 38);
    doc.text(`Descuento (${cot.descuento_global}%):`, totalsX, y);
    doc.text(`-${formatCLP(cot.subtotal * cot.descuento_global / 100)}`, totalsX + 50, y, { align: "right" });
    y += 5;
    doc.setTextColor(30, 41, 59);
  }

  doc.text("IVA (19%):", totalsX, y);
  doc.text(formatCLP(cot.iva), totalsX + 50, y, { align: "right" });
  y += 6;

  doc.setFillColor(16, 185, 129);
  doc.roundedRect(totalsX - 5, y - 4, 75, 9, 1, 1, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("TOTAL:", totalsX, y + 2);
  doc.text(formatCLP(cot.total), totalsX + 65, y + 2, { align: "right" });
  y += 12;

  // ===== CONDITIONS =====
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(9);
  checkPageBreak(20);

  if (cot.condiciones_pago) {
    doc.setFont("helvetica", "bold");
    doc.text("Condiciones de pago:", margin, y);
    doc.setFont("helvetica", "normal");
    doc.text(cot.condiciones_pago, margin + 40, y);
    y += 5;
  }

  doc.setFont("helvetica", "bold");
  doc.text("Validez:", margin, y);
  doc.setFont("helvetica", "normal");
  doc.text(`${cot.validez_dias} días desde la fecha de emisión`, margin + 40, y);
  y += 5;

  if (cot.notas) {
    y += 3;
    doc.setFont("helvetica", "bold");
    doc.text("Notas:", margin, y);
    y += 4;
    doc.setFont("helvetica", "normal");
    const notasLines = doc.splitTextToSize(cot.notas, contentWidth);
    doc.text(notasLines, margin, y);
    y += notasLines.length * 4;
  }

  // ===== FOOTER =====
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text(
    `Generado por VSApp • ${empresaNombre} • ${new Date().toLocaleDateString("es-CL")}`,
    pageWidth / 2,
    pageHeight - 8,
    { align: "center" }
  );

  // Save
  doc.save(`${cot.numero}_${cot.cliente_nombre.replace(/\s+/g, "_")}.pdf`);
}