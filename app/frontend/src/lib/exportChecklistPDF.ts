import jsPDF from "jspdf";
import type {
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
} from "@/lib/checklistTypes";

// ===== MANTENCIÓN BMS PDF =====

interface ModificacionEntry {
  fecha: string;
  usuario: string;
  descripcion: string;
}

interface MantencionData {
  info: InformacionGeneral;
  visual: InspeccionVisual;
  electrica: InspeccionElectrica;
  redes: RedesComunicacion;
  software: SoftwareBms;
  respaldos: Respaldos;
  pruebas: PruebasFuncionales;
  hallazgos: Hallazgo[];
  evidencias: Evidencias;
  resultado: ResultadoFinal;
  firmas: Firmas;
  empresaNombre?: string;
  empresaLogoUrl?: string;
  horaCreacion?: string;
  horaCierre?: string;
  historialModificaciones?: ModificacionEntry[];
  numeroInterno?: string;
}

interface OperacionData {
  infoRonda: {
    operador: string;
    turno: string;
    fecha: string;
    hora_inicio: string;
    hora_termino: string;
    numero_ronda: string;
    observaciones_turno: string;
  };
  especialidades: {
    nombre: string;
    periodicidad: string;
    items: {
      subespecialidad: string;
      monitoreo: boolean;
      control: boolean;
      estado: string;
      valor_lectura: string;
      observacion: string;
    }[];
  }[];
  bitacora: string;
  empresaNombre?: string;
  empresaLogoUrl?: string;
  horaCreacion?: string;
  horaCierre?: string;
  numeroInterno?: string;
}

function getImageFormat(dataURL: string): "JPEG" | "PNG" {
  if (dataURL.startsWith("data:image/png")) return "PNG";
  return "JPEG";
}

async function urlToDataURL(url: string): Promise<string | null> {
  try {
    if (url.startsWith("data:")) return url;
    if (url.startsWith("blob:")) return null; // blob URLs can't be fetched after page reload
    // Fetch remote image and convert to base64
    const response = await fetch(url);
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

async function resolveImageUrl(url: string): Promise<string | null> {
  if (!url) return null;
  if (url.startsWith("data:")) return url;
  return urlToDataURL(url);
}

async function addOkObsNaRow(
  doc: jsPDF,
  label: string,
  campo: CampoOkObsNa,
  y: number,
  margin: number,
  contentWidth: number
): Promise<number> {
  const valorLabel =
    campo.valor === "ok" ? "OK" : campo.valor === "obs" ? "OBS" : campo.valor === "na" ? "N/A" : "—";
  const valorColor: [number, number, number] =
    campo.valor === "ok" ? [34, 197, 94] : campo.valor === "obs" ? [245, 158, 11] : [148, 163, 184];

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(51, 65, 85);
  doc.text(label, margin + 2, y);

  doc.setTextColor(valorColor[0], valorColor[1], valorColor[2]);
  doc.setFont("helvetica", "bold");
  doc.text(valorLabel, margin + contentWidth * 0.65, y);

  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "normal");

  let extraY = 0;
  if (campo.valor === "obs" && campo.comentario) {
    extraY += 5;
    doc.setFontSize(8);
    doc.setTextColor(120, 100, 0);
    const lines = doc.splitTextToSize(`→ ${campo.comentario}`, contentWidth * 0.8);
    doc.text(lines, margin + 6, y + extraY);
    extraY += lines.length * 4;
  }

  // Add photo if available
  if (campo.foto_url) {
    const resolvedPhoto = await resolveImageUrl(campo.foto_url);
    if (resolvedPhoto) {
      extraY += 2;
      try {
        const format = getImageFormat(resolvedPhoto);
        doc.addImage(resolvedPhoto, format, margin + 6, y + extraY, 25, 25);
        extraY += 27;
      } catch { /* skip */ }
    }
  }

  return y + 6 + extraY;
}

async function addBuenoObsFallaRow(
  doc: jsPDF,
  label: string,
  campo: CampoBuenoObsFalla,
  y: number,
  margin: number,
  contentWidth: number
): Promise<number> {
  const valorLabel =
    campo.valor === "bueno" ? "BUENO" : campo.valor === "obs" ? "OBS" : campo.valor === "falla" ? "FALLA" : "—";
  const valorColor: [number, number, number] =
    campo.valor === "bueno" ? [34, 197, 94] : campo.valor === "obs" ? [245, 158, 11] : campo.valor === "falla" ? [239, 68, 68] : [148, 163, 184];

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(51, 65, 85);
  doc.text(label, margin + 2, y);

  doc.setTextColor(valorColor[0], valorColor[1], valorColor[2]);
  doc.setFont("helvetica", "bold");
  doc.text(valorLabel, margin + contentWidth * 0.65, y);

  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "normal");

  let extraY = 0;
  if ((campo.valor === "obs" || campo.valor === "falla") && campo.comentario) {
    extraY += 5;
    doc.setFontSize(8);
    doc.setTextColor(campo.valor === "falla" ? 200 : 120, campo.valor === "falla" ? 0 : 100, 0);
    const lines = doc.splitTextToSize(`→ ${campo.comentario}`, contentWidth * 0.8);
    doc.text(lines, margin + 6, y + extraY);
    extraY += lines.length * 4;
  }

  // Add photo if available
  if (campo.foto_url) {
    const resolvedPhoto = await resolveImageUrl(campo.foto_url);
    if (resolvedPhoto) {
      extraY += 2;
      try {
        const format = getImageFormat(resolvedPhoto);
        doc.addImage(resolvedPhoto, format, margin + 6, y + extraY, 25, 25);
        extraY += 27;
      } catch { /* skip */ }
    }
  }

  return y + 6 + extraY;
}

export async function exportMantencionPDF(data: MantencionData): Promise<void> {
  const doc = new jsPDF("p", "mm", "a4");
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 12;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  const title = data.empresaNombre || "VSApp";
  const createdAt = data.horaCreacion || new Date().toLocaleString("es-CL", { timeZone: "America/Santiago", hour12: false });
  const closedAt = data.horaCierre || "";

  const checkPageBreak = (needed: number) => {
    if (y + needed > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }
  };

  const addSectionTitle = (text: string) => {
    checkPageBreak(12);
    doc.setFillColor(15, 23, 42);
    doc.rect(margin, y - 4, contentWidth, 8, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text(text, margin + 3, y);
    doc.setTextColor(0, 0, 0);
    y += 8;
  };

  // ===== HEADER =====
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageWidth, 28, "F");

  // Company logo in header
  let logoOffset = 0;
  if (data.empresaLogoUrl) {
    const resolvedLogo = await resolveImageUrl(data.empresaLogoUrl);
    if (resolvedLogo) {
      try {
        const format = getImageFormat(resolvedLogo);
        doc.addImage(resolvedLogo, format, margin, 3, 22, 22);
        logoOffset = 25;
      } catch { /* skip logo */ }
    }
  }

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(title, margin + logoOffset, 10);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`Checklist Mantención BMS${data.numeroInterno ? "  |  N° " + data.numeroInterno : ""}`, margin + logoOffset, 17);
  doc.setFontSize(8);
  doc.text(`Hora Creación: ${createdAt}`, pageWidth - margin, 10, { align: "right" });
  if (closedAt) {
    doc.text(`Hora Cierre: ${closedAt}`, pageWidth - margin, 16, { align: "right" });
  }
  doc.text(`Generado: ${new Date().toLocaleString("es-CL", { timeZone: "America/Santiago", hour12: false })}`, pageWidth - margin, 22, { align: "right" });
  y = 34;

  // ===== SECCIÓN 1: Info General =====
  addSectionTitle("1. Información General");
  const infoRows: [string, string][] = [
    ["Cliente", data.info.cliente],
    ["Instalación", data.info.instalacion],
    ["Edificio / Piso / Área", `${data.info.edificio} / ${data.info.piso} / ${data.info.area}`],
    ["Fecha", data.info.fecha],
    ["Hora Inicio", data.info.hora_inicio],
    ["Hora Término", data.info.hora_termino],
    ["Técnico", data.info.tecnico_responsable],
    ["Supervisor", data.info.supervisor],
    ["Código Activo", data.info.codigo_activo],
    ["Marca / Modelo", `${data.info.marca} / ${data.info.modelo}`],
    ["N° Serie", data.info.numero_serie],
  ];
  for (const [label, value] of infoRows) {
    checkPageBreak(6);
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(51, 65, 85);
    doc.text(label + ":", margin + 2, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(0, 0, 0);
    doc.text(value || "—", margin + 40, y);
    y += 5;
  }
  y += 3;

  // ===== SECCIÓN 2: Inspección Visual =====
  addSectionTitle("2. Inspección Visual");
  const visualFields: [string, CampoOkObsNa][] = [
    ["Estado general equipo", data.visual.estado_general_equipo],
    ["Limpieza general equipo", data.visual.limpieza_general_equipo],
    ["Limpieza entorno", data.visual.limpieza_entorno],
    ["Estado gabinete", data.visual.estado_gabinete],
    ["Estado borneras", data.visual.estado_borneras],
    ["Estado patch cord", data.visual.estado_patch_cord],
    ["Estado conector red", data.visual.estado_conector_red],
    ["Estado ventilación", data.visual.estado_ventilacion],
    ["Estado etiquetado", data.visual.estado_etiquetado],
    ["Estado indicadores LED", data.visual.estado_indicadores_led],
    ["Ausencia humedad", data.visual.ausencia_humedad],
    ["Ausencia corrosión", data.visual.ausencia_corrosion],
  ];
  for (const [label, campo] of visualFields) {
    checkPageBreak(12);
    y = await addOkObsNaRow(doc, label, campo, y, margin, contentWidth);
  }
  y += 3;

  // ===== SECCIÓN 3: Inspección Eléctrica =====
  addSectionTitle("3. Inspección Eléctrica");
  const elecMediciones: [string, string][] = [
    ["Voltaje AC", data.electrica.voltaje_ac ? `${data.electrica.voltaje_ac} V` : "—"],
    ["Voltaje DC", data.electrica.voltaje_dc ? `${data.electrica.voltaje_dc} V` : "—"],
    ["Corriente Consumo", data.electrica.corriente_consumo ? `${data.electrica.corriente_consumo} A` : "—"],
  ];
  for (const [label, value] of elecMediciones) {
    checkPageBreak(6);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(51, 65, 85);
    doc.text(label + ":", margin + 2, y);
    doc.setTextColor(0, 0, 0);
    doc.text(value, margin + 50, y);
    y += 5;
  }
  y += 2;
  const bofFields: [string, CampoBuenoObsFalla][] = [
    ["Estado Fuente Alimentación", data.electrica.estado_fuente_alimentacion],
    ["Estado Fusibles", data.electrica.estado_fusibles],
    ["Estado Protección Eléctrica", data.electrica.estado_proteccion_electrica],
  ];
  for (const [label, campo] of bofFields) {
    checkPageBreak(12);
    y = await addBuenoObsFallaRow(doc, label, campo, y, margin, contentWidth);
  }
  const elecOkFields: [string, CampoOkObsNa][] = [
    ["Reapriete terminales", data.electrica.reapriete_terminales],
    ["Reapriete contactos E/S", data.electrica.reapriete_contactos],
    ["Estado cableado", data.electrica.estado_cableado],
  ];
  for (const [label, campo] of elecOkFields) {
    checkPageBreak(12);
    y = await addOkObsNaRow(doc, label, campo, y, margin, contentWidth);
  }
  y += 3;

  // ===== SECCIÓN 4: Redes =====
  addSectionTitle("4. Redes de Comunicación");
  const redesOkFields: [string, CampoOkObsNa][] = [
    ["BACnet IP", data.redes.comunicacion_bacnet_ip],
    ["BACnet MS-TP", data.redes.comunicacion_bacnet_mstp],
    ["Modbus RTU", data.redes.comunicacion_modbus_rtu],
    ["Modbus TCP", data.redes.comunicacion_modbus_tcp],
    ["Switch Industrial", data.redes.estado_switch_industrial],
    ["Red Ethernet", data.redes.estado_red_ethernet],
    ["Puntos de Red", data.redes.estado_puntos_red],
    ["Direccionamiento", data.redes.estado_direccionamiento],
  ];
  for (const [label, campo] of redesOkFields) {
    checkPageBreak(12);
    y = await addOkObsNaRow(doc, label, campo, y, margin, contentWidth);
  }
  checkPageBreak(20);
  doc.setFontSize(8);
  doc.setTextColor(51, 65, 85);
  doc.text(`IP: ${data.redes.direccion_ip || "—"} | Máscara: ${data.redes.mascara || "—"} | Gateway: ${data.redes.gateway || "—"} | BACnet ID: ${data.redes.bacnet_device_id || "—"}`, margin + 2, y);
  y += 6;

  // ===== SECCIÓN 5: Software BMS =====
  addSectionTitle("5. Software BMS");
  const softOkFields: [string, CampoOkObsNa][] = [
    ["Integración software", data.software.integracion_software],
    ["Comunicación servidor", data.software.comunicacion_servidor],
    ["Estado alarmas", data.software.estado_alarmas],
    ["Estado tendencias", data.software.estado_tendencias],
    ["Estado gráficos", data.software.estado_graficos],
    ["Puntos monitoreados", data.software.estado_puntos_monitoreados],
    ["Estado históricos", data.software.estado_historicos],
  ];
  for (const [label, campo] of softOkFields) {
    checkPageBreak(12);
    y = await addOkObsNaRow(doc, label, campo, y, margin, contentWidth);
  }
  checkPageBreak(6);
  doc.setFontSize(8);
  doc.setTextColor(51, 65, 85);
  doc.text(`Versión SW: ${data.software.version_software || "—"} | Versión FW: ${data.software.version_firmware || "—"}`, margin + 2, y);
  y += 6;

  // ===== SECCIÓN 6: Respaldos =====
  addSectionTitle("6. Respaldos");
  const respOkFields: [string, CampoOkObsNa][] = [
    ["Respaldo base de datos", data.respaldos.respaldo_base_datos],
    ["Respaldo programación", data.respaldos.respaldo_programacion],
    ["Respaldo lógica de control", data.respaldos.respaldo_logica_control],
    ["Respaldo configuraciones", data.respaldos.respaldo_configuraciones],
  ];
  for (const [label, campo] of respOkFields) {
    checkPageBreak(12);
    y = await addOkObsNaRow(doc, label, campo, y, margin, contentWidth);
  }
  y += 3;

  // ===== SECCIÓN 7: Pruebas Funcionales =====
  addSectionTitle("7. Pruebas Funcionales");
  const pruebasFields: [string, CampoOkObsNa][] = [
    ["Lectura de variables", data.pruebas.lectura_variables],
    ["Escritura de variables", data.pruebas.escritura_variables],
    ["Alarmas", data.pruebas.alarmas],
    ["Tendencias", data.pruebas.tendencias],
    ["Comandos remotos", data.pruebas.comandos_remotos],
    ["Operación normal controlador", data.pruebas.operacion_normal_controlador],
    ["Operación módulos I/O", data.pruebas.operacion_modulos_io],
  ];
  for (const [label, campo] of pruebasFields) {
    checkPageBreak(12);
    y = await addOkObsNaRow(doc, label, campo, y, margin, contentWidth);
  }
  y += 3;

  // ===== SECCIÓN 8: Hallazgos =====
  addSectionTitle("8. Hallazgos");
  if (data.hallazgos.length === 0) {
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text("Sin hallazgos registrados.", margin + 2, y);
    y += 6;
  } else {
    for (let i = 0; i < data.hallazgos.length; i++) {
      const h = data.hallazgos[i];
      checkPageBreak(25);
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(0, 0, 0);
      doc.text(`Hallazgo #${i + 1}`, margin + 2, y);
      y += 5;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.text(`Tipo(s): ${h.tipos.join(", ") || "—"}`, margin + 4, y);
      y += 4;
      const critColor: [number, number, number] =
        h.criticidad === "critica" ? [220, 38, 38] : h.criticidad === "alta" ? [234, 88, 12] : h.criticidad === "media" ? [217, 119, 6] : [34, 197, 94];
      doc.setTextColor(critColor[0], critColor[1], critColor[2]);
      doc.text(`Criticidad: ${h.criticidad.toUpperCase()}`, margin + 4, y);
      doc.setTextColor(0, 0, 0);
      y += 4;
      if (h.descripcion) {
        const descLines = doc.splitTextToSize(`Descripción: ${h.descripcion}`, contentWidth - 8);
        doc.text(descLines, margin + 4, y);
        y += descLines.length * 4;
      }
      if (h.accion_correctiva) {
        const accLines = doc.splitTextToSize(`Acción correctiva: ${h.accion_correctiva}`, contentWidth - 8);
        doc.text(accLines, margin + 4, y);
        y += accLines.length * 4;
      }
      // Photo for hallazgo
      if (h.foto_url) {
        const resolvedFoto = await resolveImageUrl(h.foto_url);
        if (resolvedFoto) {
          checkPageBreak(35);
          try {
            const format = getImageFormat(resolvedFoto);
            doc.addImage(resolvedFoto, format, margin + 4, y, 30, 30);
            y += 33;
          } catch { /* skip */ }
        }
      }
      y += 3;
    }
  }

  // ===== SECCIÓN 9: Evidencias =====
  addSectionTitle("9. Evidencias Fotográficas");
  const fotoLabels: [string, string][] = [
    ["Frontal", data.evidencias.foto_frontal],
    ["Interior", data.evidencias.foto_interior],
    ["Comunicaciones", data.evidencias.foto_comunicaciones],
    ["Hallazgos", data.evidencias.foto_hallazgos],
    ["Etiquetado", data.evidencias.foto_etiquetado],
    ["Mediciones", data.evidencias.foto_mediciones],
  ];
  let xPos = margin;
  const imgSize = 35;
  for (const [label, url] of fotoLabels) {
    if (url) {
      const resolvedUrl = await resolveImageUrl(url);
      if (resolvedUrl) {
        if (xPos + imgSize > pageWidth - margin) {
          xPos = margin;
          y += imgSize + 8;
        }
        checkPageBreak(imgSize + 12);
        try {
          const format = getImageFormat(resolvedUrl);
          doc.addImage(resolvedUrl, format, xPos, y, imgSize, imgSize);
          doc.setFontSize(7);
          doc.setTextColor(100, 100, 100);
          doc.text(label, xPos, y + imgSize + 3);
          xPos += imgSize + 4;
        } catch { /* skip */ }
      }
    }
  }
  if (xPos > margin) y += imgSize + 8;
  y += 3;

  // ===== SECCIÓN 10: Resultado Final =====
  addSectionTitle("10. Resultado Final");
  checkPageBreak(20);
  const estadoLabels: Record<string, string> = {
    operativo: "OPERATIVO",
    operativo_obs: "OPERATIVO CON OBSERVACIONES",
    requiere_correctivo: "REQUIERE CORRECTIVO",
    fuera_servicio: "FUERA DE SERVICIO",
  };
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  const estadoText = estadoLabels[data.resultado.estado_general] || "—";
  doc.setTextColor(
    data.resultado.estado_general === "operativo" ? 34 : data.resultado.estado_general === "fuera_servicio" ? 220 : 200,
    data.resultado.estado_general === "operativo" ? 197 : 50,
    data.resultado.estado_general === "operativo" ? 94 : data.resultado.estado_general === "fuera_servicio" ? 38 : 0
  );
  doc.text(estadoText, margin + 2, y);
  y += 6;
  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  if (data.resultado.observaciones_generales) {
    const obsLines = doc.splitTextToSize(`Observaciones: ${data.resultado.observaciones_generales}`, contentWidth - 4);
    doc.text(obsLines, margin + 2, y);
    y += obsLines.length * 4 + 2;
  }
  if (data.resultado.recomendaciones) {
    const recLines = doc.splitTextToSize(`Recomendaciones: ${data.resultado.recomendaciones}`, contentWidth - 4);
    doc.text(recLines, margin + 2, y);
    y += recLines.length * 4 + 2;
  }
  y += 3;

  // ===== SECCIÓN 11: Firmas =====
  addSectionTitle("11. Firmas");
  const firmaEntries: [string, string][] = [
    ["Firma Técnico", data.firmas.firma_tecnico],
    ["Firma Cliente", data.firmas.firma_cliente],
  ];
  for (const [label, sigUrl] of firmaEntries) {
    checkPageBreak(30);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(51, 65, 85);
    doc.text(label, margin + 2, y);
    y += 4;
    if (sigUrl) {
      const resolvedSig = await resolveImageUrl(sigUrl);
      if (resolvedSig) {
        try {
          const format = getImageFormat(resolvedSig);
          doc.addImage(resolvedSig, format, margin + 2, y, 55, 18);
          y += 20;
        } catch {
          doc.setFontSize(8);
          doc.text("(No disponible)", margin + 2, y + 5);
          y += 8;
        }
      } else {
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.text("(No disponible)", margin + 2, y + 3);
        y += 8;
      }
    } else {
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.text("(No firmado)", margin + 2, y + 3);
      y += 8;
    }
    y += 2;
  }
  if (data.firmas.fecha_cierre) {
    doc.setFontSize(8);
    doc.setTextColor(51, 65, 85);
    doc.text(`Fecha Cierre: ${data.firmas.fecha_cierre}`, margin + 2, y);
    y += 6;
  }

  // ===== HISTORIAL DE MODIFICACIONES =====
  if (data.historialModificaciones && data.historialModificaciones.length > 0) {
    addSectionTitle("Historial de Modificaciones");
    for (const entry of data.historialModificaciones) {
      checkPageBreak(6);
      doc.setFontSize(7);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(51, 65, 85);
      doc.text(`${entry.fecha} — ${entry.usuario} — ${entry.descripcion}`, margin + 2, y);
      y += 4;
    }
    y += 3;
  }

  // ===== TIMESTAMPS =====
  checkPageBreak(15);
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, y, margin + contentWidth, y);
  y += 4;
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(51, 65, 85);
  doc.text(`Hora de Creación: ${createdAt}`, margin + 2, y);
  y += 4;
  if (closedAt) {
    doc.text(`Hora de Cierre: ${closedAt}`, margin + 2, y);
    y += 4;
  }
  doc.text(`Hora de Generación PDF: ${new Date().toLocaleString("es-CL", { timeZone: "America/Santiago", hour12: false })}`, margin + 2, y);

  // ===== FOOTER =====
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `${title} — Checklist Mantención BMS — Creado: ${createdAt} — Pág ${i}/${totalPages}`,
      pageWidth / 2,
      pageHeight - 6,
      { align: "center" }
    );
  }

  const fileName = `Checklist_Mantencion_${data.info.cliente || "BMS"}_${data.info.fecha}.pdf`.replace(/\s+/g, "_");
  doc.save(fileName);
}

// ===== OPERACIÓN BMS PDF =====

export async function exportOperacionPDF(data: OperacionData): Promise<void> {
  const doc = new jsPDF("p", "mm", "a4");
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 12;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  const title = data.empresaNombre || "VSApp";
  const createdAt = data.horaCreacion || new Date().toLocaleString("es-CL", { timeZone: "America/Santiago", hour12: false });
  const closedAt = data.horaCierre || "";

  const checkPageBreak = (needed: number) => {
    if (y + needed > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }
  };

  const addSectionTitle = (text: string) => {
    checkPageBreak(12);
    doc.setFillColor(15, 23, 42);
    doc.rect(margin, y - 4, contentWidth, 8, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text(text, margin + 3, y);
    doc.setTextColor(0, 0, 0);
    y += 8;
  };

  // ===== HEADER =====
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageWidth, 28, "F");

  // Company logo in header
  let logoOffset = 0;
  if (data.empresaLogoUrl) {
    const resolvedLogo = await resolveImageUrl(data.empresaLogoUrl);
    if (resolvedLogo) {
      try {
        const format = getImageFormat(resolvedLogo);
        doc.addImage(resolvedLogo, format, margin, 3, 22, 22);
        logoOffset = 25;
      } catch { /* skip logo */ }
    }
  }

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(title, margin + logoOffset, 10);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`Checklist Operación BMS${data.numeroInterno ? "  |  N° " + data.numeroInterno : ""}`, margin + logoOffset, 17);
  doc.setFontSize(8);
  doc.text(`Hora Creación: ${createdAt}`, pageWidth - margin, 10, { align: "right" });
  if (closedAt) {
    doc.text(`Hora Cierre: ${closedAt}`, pageWidth - margin, 16, { align: "right" });
  }
  doc.text(`Generado: ${new Date().toLocaleString("es-CL", { timeZone: "America/Santiago", hour12: false })}`, pageWidth - margin, 22, { align: "right" });
  y = 34;

  // ===== INFO RONDA =====
  addSectionTitle("Información de Ronda");
  const rondaRows: [string, string][] = [
    ["Operador", data.infoRonda.operador],
    ["Turno", data.infoRonda.turno === "diurno" ? "☀️ Diurno" : data.infoRonda.turno === "nocturno" ? "🌙 Nocturno" : "—"],
    ["Fecha", data.infoRonda.fecha],
    ["N° Ronda", data.infoRonda.numero_ronda],
    ["Hora Inicio", data.infoRonda.hora_inicio],
    ["Hora Término", data.infoRonda.hora_termino],
  ];
  for (const [label, value] of rondaRows) {
    checkPageBreak(6);
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(51, 65, 85);
    doc.text(label + ":", margin + 2, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(0, 0, 0);
    doc.text(value || "—", margin + 35, y);
    y += 5;
  }
  if (data.infoRonda.observaciones_turno) {
    checkPageBreak(10);
    doc.setFontSize(8);
    const obsLines = doc.splitTextToSize(`Observaciones: ${data.infoRonda.observaciones_turno}`, contentWidth - 4);
    doc.text(obsLines, margin + 2, y);
    y += obsLines.length * 4 + 2;
  }
  y += 3;

  // ===== ESPECIALIDADES =====
  for (let espIdx = 0; espIdx < data.especialidades.length; espIdx++) {
    const esp = data.especialidades[espIdx];
    addSectionTitle(`${espIdx + 1}. ${esp.nombre} (${esp.periodicidad})`);

    // Table header
    checkPageBreak(8);
    doc.setFillColor(241, 245, 249);
    doc.rect(margin, y - 3, contentWidth, 6, "F");
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(51, 65, 85);
    doc.text("Sub-especialidad", margin + 2, y);
    doc.text("M", margin + 62, y);
    doc.text("C", margin + 68, y);
    doc.text("Estado", margin + 78, y);
    doc.text("Lectura", margin + 110, y);
    doc.text("Observación", margin + 135, y);
    y += 6;

    for (const item of esp.items) {
      checkPageBreak(6);
      doc.setFontSize(7);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(0, 0, 0);
      doc.text(item.subespecialidad.slice(0, 30), margin + 2, y);
      doc.text(item.monitoreo ? "✓" : "—", margin + 63, y);
      doc.text(item.control ? "✓" : "—", margin + 69, y);

      // Estado with color
      const estadoColor: [number, number, number] =
        item.estado === "normal" ? [34, 197, 94] :
        item.estado === "alarma" ? [239, 68, 68] :
        item.estado === "fuera_servicio" ? [100, 100, 100] : [180, 180, 180];
      doc.setTextColor(estadoColor[0], estadoColor[1], estadoColor[2]);
      const estadoLabel = item.estado === "normal" ? "Normal" : item.estado === "alarma" ? "ALARMA" : item.estado === "fuera_servicio" ? "F/S" : item.estado === "no_aplica" ? "N/A" : "—";
      doc.text(estadoLabel, margin + 78, y);

      doc.setTextColor(0, 0, 0);
      doc.text((item.valor_lectura || "—").slice(0, 15), margin + 110, y);
      doc.text((item.observacion || "—").slice(0, 20), margin + 135, y);
      y += 5;
    }
    y += 3;
  }

  // ===== BITÁCORA =====
  if (data.bitacora) {
    addSectionTitle("Bitácora Digital");
    checkPageBreak(15);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(0, 0, 0);
    const bitLines = doc.splitTextToSize(data.bitacora, contentWidth - 4);
    doc.text(bitLines, margin + 2, y);
    y += bitLines.length * 4 + 4;
  }

  // ===== TIMESTAMPS =====
  checkPageBreak(15);
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, y, margin + contentWidth, y);
  y += 4;
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(51, 65, 85);
  doc.text(`Hora de Creación: ${createdAt}`, margin + 2, y);
  y += 4;
  if (closedAt) {
    doc.text(`Hora de Cierre: ${closedAt}`, margin + 2, y);
    y += 4;
  }
  doc.text(`Hora de Generación PDF: ${new Date().toLocaleString("es-CL", { timeZone: "America/Santiago", hour12: false })}`, margin + 2, y);

  // ===== FOOTER =====
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `${title} — Checklist Operación BMS — Creado: ${createdAt} — Pág ${i}/${totalPages}`,
      pageWidth / 2,
      pageHeight - 6,
      { align: "center" }
    );
  }

  const fileName = `Checklist_Operacion_${data.infoRonda.operador || "BMS"}_${data.infoRonda.fecha}_R${data.infoRonda.numero_ronda || "0"}.pdf`.replace(/\s+/g, "_");
  doc.save(fileName);
}