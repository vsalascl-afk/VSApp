import { useState, useEffect } from "react";
import { useEmpresa } from "@/lib/empresaContext";
import type { Usuario } from "@/lib/types";
import { SUPABASE_URL, SUPABASE_KEY, SUPABASE_SERVICE_KEY } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Eye, Search, FileText, Pencil, Download, History } from "lucide-react";
import { exportMantencionPDF, exportOperacionPDF } from "@/lib/exportChecklistPDF";
import { useToast } from "@/hooks/use-toast";

interface ModificacionEntry {
  fecha: string;
  usuario: string;
  descripcion: string;
}

interface ChecklistRecord {
  id: string;
  empresa_id: string;
  tecnico_id: string;
  estado: string;
  tipo?: string;
  informacion_general: Record<string, unknown>;
  inspeccion_visual?: Record<string, unknown>;
  inspeccion_electrica?: Record<string, unknown>;
  redes_comunicacion?: Record<string, unknown>;
  software_bms?: Record<string, unknown>;
  respaldos_data?: Record<string, unknown>;
  pruebas_funcionales?: Record<string, unknown>;
  hallazgos_data?: unknown[];
  evidencias_data?: Record<string, unknown>;
  resultado_final?: Record<string, unknown>;
  firmas_data?: Record<string, unknown>;
  especialidades_data?: unknown[];
  bitacora?: string;
  secciones_data?: unknown[];
  observaciones_generales?: string;
  historial_modificaciones?: ModificacionEntry[];
  numero_interno?: string;
  created_at: string;
  hora_creacion?: string;
  hora_cierre?: string;
}

interface Props {
  user: Usuario;
  token: string;
  tableKey?: "operacion_bms" | "mantencion_bms" | "grupo_electrogeno";
  onEdit?: (record: ChecklistRecord) => void;
}

export default function ChecklistHistorial({ user, token, tableKey, onEdit }: Props) {
  const { empresa } = useEmpresa();
  const { toast } = useToast();
  const [records, setRecords] = useState<ChecklistRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedRecord, setSelectedRecord] = useState<ChecklistRecord | null>(null);
  const [showHistorial, setShowHistorial] = useState(false);

  useEffect(() => {
    fetchRecords();
  }, [empresa, tableKey]);

  async function fetchRecords() {
    if (!empresa) return;
    setLoading(true);
    try {
      const serviceKey = SUPABASE_SERVICE_KEY || SUPABASE_KEY;
      let url = `${SUPABASE_URL}/rest/v1/checklist_bms?empresa_id=eq.${empresa.id}&order=created_at.desc`;

      // Filter by type
      if (tableKey === "operacion_bms") {
        url += `&tipo=eq.operacion_bms`;
      } else if (tableKey === "grupo_electrogeno") {
        url += `&tipo=eq.grupo_electrogeno`;
      } else {
        // mantención: records without tipo or tipo is null (exclude operacion_bms and grupo_electrogeno)
        url += `&or=(tipo.is.null,tipo.eq.mantencion_bms)`;
      }

      // Filter by region - technicians only see checklists from their own region
      // Supervisors, admins and superadmins see all checklists of their empresa
      if (user.region && user.rol !== "superadmin" && user.rol !== "admin" && user.rol !== "supervisor") {
        url += `&region=eq.${user.region}`;
      }

      const res = await fetch(url, {
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
          "Content-Type": "application/json",
        },
      });
      if (res.ok) {
        const data = await res.json();
        setRecords(data || []);
      }
    } catch (err) {
      console.error("Error fetching checklists:", err);
    }
    setLoading(false);
  }

  const filteredRecords = records.filter((r) => {
    const q = search.toLowerCase();
    const info = r.informacion_general || {};
    return (
      ((info.cliente as string) || "").toLowerCase().includes(q) ||
      ((info.codigo_activo as string) || "").toLowerCase().includes(q) ||
      ((info.tecnico_responsable as string) || "").toLowerCase().includes(q) ||
      ((info.operador as string) || "").toLowerCase().includes(q) ||
      ((info.edificio as string) || "").toLowerCase().includes(q) ||
      ((info.tecnico as string) || "").toLowerCase().includes(q) ||
      ((info.marca_equipo as string) || "").toLowerCase().includes(q) ||
      ((info.modelo_equipo as string) || "").toLowerCase().includes(q) ||
      ((info.ubicacion as string) || "").toLowerCase().includes(q) ||
      ((r.numero_interno as string) || "").toLowerCase().includes(q)
    );
  });

  function getEstadoBadge(estado: string) {
    switch (estado) {
      case "finalizado":
        return <Badge className="bg-green-500 text-white text-xs">Finalizado</Badge>;
      case "en_proceso":
        return <Badge className="bg-blue-500 text-white text-xs">En Proceso</Badge>;
      default:
        return <Badge variant="outline" className="text-xs">Borrador</Badge>;
    }
  }

  function getResultadoBadge(estado: string | undefined) {
    if (!estado) return <Badge variant="outline" className="text-xs">Pendiente</Badge>;
    switch (estado) {
      case "operativo":
        return <Badge className="bg-green-100 text-green-800 text-xs">Operativo</Badge>;
      case "operativo_obs":
        return <Badge className="bg-amber-100 text-amber-800 text-xs">Con Observaciones</Badge>;
      case "requiere_correctivo":
        return <Badge className="bg-orange-100 text-orange-800 text-xs">Requiere Correctivo</Badge>;
      case "fuera_servicio":
        return <Badge className="bg-red-100 text-red-800 text-xs">Fuera de Servicio</Badge>;
      default:
        return <Badge variant="outline" className="text-xs">Pendiente</Badge>;
    }
  }

  async function handleExportPDF(record: ChecklistRecord) {
    try {
      const empresaNombre = empresa?.nombre || "VSApp";
      if (record.tipo === "operacion_bms") {
        await exportOperacionPDF({
          infoRonda: record.informacion_general as never,
          especialidades: (record.especialidades_data || []) as never,
          bitacora: record.bitacora || "",
          empresaNombre,
          horaCreacion: record.hora_creacion || record.created_at,
          horaCierre: record.hora_cierre || "",
          numeroInterno: record.numero_interno || "",
        });
      } else {
        await exportMantencionPDF({
          info: record.informacion_general as never,
          visual: record.inspeccion_visual as never,
          electrica: record.inspeccion_electrica as never,
          redes: record.redes_comunicacion as never,
          software: record.software_bms as never,
          respaldos: record.respaldos_data as never,
          pruebas: record.pruebas_funcionales as never,
          hallazgos: (record.hallazgos_data || []) as never,
          evidencias: record.evidencias_data as never,
          resultado: record.resultado_final as never,
          firmas: record.firmas_data as never,
          empresaNombre,
          horaCreacion: record.hora_creacion || record.created_at,
          horaCierre: record.hora_cierre || "",
          historialModificaciones: record.historial_modificaciones || [],
          numeroInterno: record.numero_interno || "",
        });
      }
      toast({ title: "PDF exportado", description: "El archivo se descargó correctamente." });
    } catch (err) {
      console.error("Error exporting PDF:", err);
      toast({ title: "Error", description: "No se pudo generar el PDF.", variant: "destructive" });
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (selectedRecord) {
    const info = selectedRecord.informacion_general || {};
    const isOperacion = selectedRecord.tipo === "operacion_bms";
    const isGrupoElectrogeno = selectedRecord.tipo === "grupo_electrogeno";
    const historial = selectedRecord.historial_modificaciones || [];

    const detailTitle = isOperacion
      ? "Ronda de Operación"
      : isGrupoElectrogeno
        ? "Grupo Electrógeno"
        : "Mantención BMS";

    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-base">
              {selectedRecord.numero_interno && (
                <span className="font-mono text-sm bg-slate-100 border border-slate-300 rounded px-2 py-0.5 mr-2">
                  {selectedRecord.numero_interno}
                </span>
              )}
              Detalle - {detailTitle}
            </CardTitle>
            <div className="flex gap-2">
              {selectedRecord.estado !== "finalizado" && onEdit && (
                <Button variant="outline" size="sm" onClick={() => { onEdit(selectedRecord); setSelectedRecord(null); }}>
                  <Pencil className="w-3 h-3 mr-1" /> Editar
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={() => handleExportPDF(selectedRecord)}>
                <Download className="w-3 h-3 mr-1" /> PDF
              </Button>
              <Button variant="outline" size="sm" onClick={() => setSelectedRecord(null)}>
                ← Volver
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2 text-sm">
              {isOperacion ? (
                <>
                  <div><span className="font-medium">Operador:</span> {info.operador as string}</div>
                  <div><span className="font-medium">Turno:</span> {info.turno as string}</div>
                  <div><span className="font-medium">Ronda N°:</span> {info.numero_ronda as string}</div>
                  <div><span className="font-medium">Fecha:</span> {info.fecha as string}</div>
                </>
              ) : isGrupoElectrogeno ? (
                <>
                  <div><span className="font-medium">Cliente:</span> {info.cliente as string}</div>
                  <div><span className="font-medium">Ubicación:</span> {info.ubicacion as string}</div>
                  <div><span className="font-medium">Técnico:</span> {info.tecnico as string}</div>
                  <div><span className="font-medium">Supervisor:</span> {info.supervisor as string}</div>
                  <div><span className="font-medium">Marca:</span> {info.marca_equipo as string}</div>
                  <div><span className="font-medium">Modelo:</span> {info.modelo_equipo as string}</div>
                  <div><span className="font-medium">N° Serie:</span> {info.numero_serie as string}</div>
                  <div><span className="font-medium">Horómetro:</span> {info.horometro as string}</div>
                  <div><span className="font-medium">Fecha:</span> {info.fecha as string}</div>
                  <div><span className="font-medium">Hora Inicio:</span> {info.hora_inicio as string}</div>
                  {(info.hora_termino as string) && (
                    <div><span className="font-medium">Hora Término:</span> {info.hora_termino as string}</div>
                  )}
                  <div><span className="font-medium">Tipo Servicio:</span> {info.tipo_servicio as string}</div>
                </>
              ) : (
                <>
                  <div><span className="font-medium">Cliente:</span> {info.cliente as string}</div>
                  <div><span className="font-medium">Instalación:</span> {info.instalacion as string}</div>
                  <div><span className="font-medium">Edificio:</span> {info.edificio as string}</div>
                  <div><span className="font-medium">Código Activo:</span> {info.codigo_activo as string}</div>
                  <div><span className="font-medium">Técnico:</span> {info.tecnico_responsable as string}</div>
                  <div><span className="font-medium">Fecha:</span> {info.fecha as string}</div>
                  <div><span className="font-medium">Modelo:</span> {info.modelo as string}</div>
                </>
              )}
              <div><span className="font-medium">Estado:</span> {getEstadoBadge(selectedRecord.estado)}</div>
              {!isOperacion && !isGrupoElectrogeno && (
                <div><span className="font-medium">Resultado:</span> {getResultadoBadge((selectedRecord.resultado_final as Record<string, string>)?.estado_general)}</div>
              )}
            </div>

            {/* Resumen de Alarmas - solo rondas de operación */}
            {isOperacion && selectedRecord.especialidades_data && (() => {
              const especialidades = selectedRecord.especialidades_data as Array<{
                nombre: string;
                items: Array<{
                  subespecialidad: string;
                  estado: string;
                  valor_lectura: string;
                  observacion: string;
                }>;
              }>;
              const alarmas = especialidades.flatMap((esp) =>
                (esp.items || [])
                  .filter((item) => item.estado === "alarma")
                  .map((item) => ({
                    especialidad: esp.nombre,
                    subespecialidad: item.subespecialidad,
                    valor_lectura: item.valor_lectura,
                    observacion: item.observacion,
                  }))
              );
              if (alarmas.length === 0) {
                return (
                  <div className="mt-3 border-t pt-3">
                    <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg p-3">
                      <span className="text-green-600 text-lg">✓</span>
                      <span className="text-sm font-medium text-green-700">Sin alarmas registradas en esta ronda</span>
                    </div>
                  </div>
                );
              }
              return (
                <div className="mt-3 border-t pt-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-red-500 text-lg">⚠</span>
                    <h4 className="text-sm font-semibold text-red-700">
                      Alarmas Detectadas ({alarmas.length})
                    </h4>
                  </div>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {alarmas.map((a, idx) => (
                      <div key={idx} className="bg-red-50 border border-red-200 rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded">
                            {a.especialidad}
                          </span>
                          <span className="text-xs font-medium text-gray-700">→ {a.subespecialidad}</span>
                        </div>
                        {a.valor_lectura && (
                          <div className="text-xs text-gray-600">
                            <span className="font-medium">Lectura:</span> {a.valor_lectura}
                          </div>
                        )}
                        {a.observacion && (
                          <div className="text-xs text-gray-600 mt-0.5">
                            <span className="font-medium">Observación:</span> {a.observacion}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Detalle de Grupo Electrógeno - Secciones */}
            {isGrupoElectrogeno && selectedRecord.especialidades_data && (() => {
              const secciones = selectedRecord.especialidades_data as Array<{
                nombre: string;
                items: Array<{
                  numero?: number;
                  descripcion: string;
                  estado: string;
                  valor_lectura?: string;
                  observacion?: string;
                }>;
              }>;
              const totalItems = secciones.reduce((acc, s) => acc + (s.items?.length || 0), 0);
              const okItems = secciones.reduce((acc, s) => acc + (s.items || []).filter(i => i.estado === "ok" || i.estado === "bueno").length, 0);
              const obsItems = secciones.reduce((acc, s) => acc + (s.items || []).filter(i => i.estado === "observacion" || i.estado === "regular").length, 0);
              const maloItems = secciones.reduce((acc, s) => acc + (s.items || []).filter(i => i.estado === "malo" || i.estado === "na").length, 0);

              // Collect items with observations
              const itemsConObs = secciones.flatMap((sec) =>
                (sec.items || [])
                  .filter((item) => item.estado === "observacion" || item.estado === "regular")
                  .map((item) => ({
                    seccion: sec.nombre,
                    descripcion: item.descripcion,
                    valor_lectura: item.valor_lectura || "",
                    observacion: item.observacion || "",
                  }))
              );

              // Collect items marked as malo/na
              const itemsMalos = secciones.flatMap((sec) =>
                (sec.items || [])
                  .filter((item) => item.estado === "malo" || item.estado === "na")
                  .map((item) => ({
                    seccion: sec.nombre,
                    descripcion: item.descripcion,
                    valor_lectura: item.valor_lectura || "",
                    observacion: item.observacion || "",
                  }))
              );

              return (
                <div className="mt-3 border-t pt-3 space-y-2">
                  <h4 className="text-sm font-semibold text-gray-700">Resumen de Inspección</h4>
                  <div className="grid grid-cols-4 gap-2 text-center">
                    <div className="bg-gray-50 rounded p-2">
                      <div className="text-lg font-bold text-gray-700">{totalItems}</div>
                      <div className="text-xs text-gray-500">Total</div>
                    </div>
                    <div className="bg-green-50 rounded p-2">
                      <div className="text-lg font-bold text-green-700">{okItems}</div>
                      <div className="text-xs text-green-600">OK/Bueno</div>
                    </div>
                    <div className="bg-amber-50 rounded p-2">
                      <div className="text-lg font-bold text-amber-700">{obsItems}</div>
                      <div className="text-xs text-amber-600">Observación</div>
                    </div>
                    <div className="bg-red-50 rounded p-2">
                      <div className="text-lg font-bold text-red-700">{maloItems}</div>
                      <div className="text-xs text-red-600">Malo/N/A</div>
                    </div>
                  </div>

                  {/* Detalle de ítems con Observación */}
                  {itemsConObs.length > 0 && (
                    <div className="mt-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-amber-500 text-lg">⚠</span>
                        <h4 className="text-sm font-semibold text-amber-700">
                          Ítems con Observación ({itemsConObs.length})
                        </h4>
                      </div>
                      <div className="space-y-2 max-h-60 overflow-y-auto">
                        {itemsConObs.map((item, idx) => (
                          <div key={idx} className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded">
                                {item.seccion}
                              </span>
                            </div>
                            <div className="text-sm font-medium text-gray-800">{item.descripcion}</div>
                            {item.valor_lectura && (
                              <div className="text-xs text-gray-600 mt-1">
                                <span className="font-medium">Lectura:</span> {item.valor_lectura}
                              </div>
                            )}
                            {item.observacion && (
                              <div className="text-xs text-gray-600 mt-0.5">
                                <span className="font-medium">Nota:</span> {item.observacion}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Detalle de ítems Malo/N/A */}
                  {itemsMalos.length > 0 && (
                    <div className="mt-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-red-500 text-lg">✗</span>
                        <h4 className="text-sm font-semibold text-red-700">
                          Ítems Malo / N/A ({itemsMalos.length})
                        </h4>
                      </div>
                      <div className="space-y-2 max-h-60 overflow-y-auto">
                        {itemsMalos.map((item, idx) => (
                          <div key={idx} className="bg-red-50 border border-red-200 rounded-lg p-3">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded">
                                {item.seccion}
                              </span>
                            </div>
                            <div className="text-sm font-medium text-gray-800">{item.descripcion}</div>
                            {item.valor_lectura && (
                              <div className="text-xs text-gray-600 mt-1">
                                <span className="font-medium">Lectura:</span> {item.valor_lectura}
                              </div>
                            )}
                            {item.observacion && (
                              <div className="text-xs text-gray-600 mt-0.5">
                                <span className="font-medium">Nota:</span> {item.observacion}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {(info.observaciones_generales as string) && (
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 mt-2">
                      <span className="text-xs font-medium text-gray-600 block mb-1">Observaciones Generales:</span>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">
                        {info.observaciones_generales as string}
                      </p>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Detalle de Resultado - Acciones tomadas (solo mantención BMS) */}
            {!isOperacion && !isGrupoElectrogeno && selectedRecord.resultado_final && (
              <div className="mt-3 space-y-2 border-t pt-3">
                <h4 className="text-sm font-semibold text-gray-700">Resultado de la Mantención</h4>
                {(selectedRecord.resultado_final as Record<string, string>)?.acciones_tomadas && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <span className="text-xs font-medium text-blue-700 block mb-1">Acciones Tomadas:</span>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">
                      {(selectedRecord.resultado_final as Record<string, string>).acciones_tomadas}
                    </p>
                  </div>
                )}
                {(selectedRecord.resultado_final as Record<string, string>)?.observaciones_generales && (
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                    <span className="text-xs font-medium text-gray-600 block mb-1">Observaciones Generales:</span>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">
                      {(selectedRecord.resultado_final as Record<string, string>).observaciones_generales}
                    </p>
                  </div>
                )}
                {(selectedRecord.resultado_final as Record<string, string>)?.recomendaciones && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                    <span className="text-xs font-medium text-amber-700 block mb-1">Recomendaciones:</span>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">
                      {(selectedRecord.resultado_final as Record<string, string>).recomendaciones}
                    </p>
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 text-sm">
              <div><span className="font-medium">Creado:</span> {selectedRecord.hora_creacion || new Date(selectedRecord.created_at).toLocaleString("es-CL")}</div>
              {selectedRecord.hora_cierre && (
                <div><span className="font-medium">Cerrado:</span> {selectedRecord.hora_cierre}</div>
              )}
            </div>

            {/* Historial de modificaciones */}
            {historial.length > 0 && (
              <div className="mt-4">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowHistorial(!showHistorial)}
                  className="text-xs"
                >
                  <History className="w-3 h-3 mr-1" />
                  Historial de modificaciones ({historial.length})
                </Button>
                {showHistorial && (
                  <div className="mt-2 border rounded-lg p-3 space-y-2 max-h-48 overflow-y-auto bg-gray-50">
                    {historial.map((entry, idx) => (
                      <div key={idx} className="text-xs border-b last:border-0 pb-1">
                        <span className="font-medium text-blue-600">{entry.fecha}</span>
                        <span className="mx-2">•</span>
                        <span className="font-medium">{entry.usuario}</span>
                        <span className="mx-2">—</span>
                        <span className="text-gray-600">{entry.descripcion}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          placeholder={tableKey === "operacion_bms" ? "Buscar por operador, turno..." : tableKey === "grupo_electrogeno" ? "Buscar por cliente, marca, técnico..." : "Buscar por cliente, activo, técnico..."}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Records */}
      {filteredRecords.length === 0 ? (
        <div className="text-center py-10">
          <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            {records.length === 0
              ? tableKey === "operacion_bms"
                ? "No hay rondas de operación registradas aún."
                : tableKey === "grupo_electrogeno"
                  ? "No hay checklists de Grupo Electrógeno registrados aún."
                  : "No hay checklists de mantención registrados aún."
              : "No se encontraron resultados."}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredRecords.map((r) => {
            const info = r.informacion_general || {};
            const isOperacion = r.tipo === "operacion_bms";
            const isGE = r.tipo === "grupo_electrogeno";

            return (
              <Card key={r.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {r.numero_interno && (
                          <Badge variant="outline" className="text-xs font-mono bg-slate-50 border-slate-300">
                            {r.numero_interno}
                          </Badge>
                        )}
                        <span className="font-medium text-sm truncate">
                          {isOperacion
                            ? `Ronda ${(info.numero_ronda as string) || "?"} - ${(info.turno as string) || ""}`
                            : isGE
                              ? `${(info.marca_equipo as string) || "GE"} ${(info.modelo_equipo as string) || ""} - ${(info.ubicacion as string) || "Sin ubicación"}`
                              : (info.codigo_activo as string) || "Sin código"}
                        </span>
                        {getEstadoBadge(r.estado)}
                        {!isOperacion && !isGE && getResultadoBadge((r.resultado_final as Record<string, string>)?.estado_general)}
                        {isOperacion && (() => {
                          const esps = (r.especialidades_data || []) as Array<{ items?: Array<{ estado: string }> }>;
                          const numAlarmas = esps.reduce((acc, esp) => acc + (esp.items || []).filter(i => i.estado === "alarma").length, 0);
                          if (numAlarmas > 0) {
                            return (
                              <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700 bg-red-100 border border-red-200 px-1.5 py-0.5 rounded">
                                ⚠ {numAlarmas} alarma{numAlarmas > 1 ? "s" : ""}
                              </span>
                            );
                          }
                          return null;
                        })()}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {isOperacion
                          ? `${(info.operador as string) || ""} • ${(info.fecha as string) || new Date(r.created_at).toLocaleDateString()}`
                          : isGE
                            ? `${(info.cliente as string) || ""} • ${(info.tecnico as string) || ""} • ${(info.fecha as string) || new Date(r.created_at).toLocaleDateString()}`
                            : `${(info.cliente as string) || ""} • ${(info.edificio as string) || ""} • ${(info.tecnico_responsable as string) || ""} • ${(info.fecha as string) || new Date(r.created_at).toLocaleDateString()}`}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {r.estado !== "finalizado" && onEdit && (
                        <Button variant="ghost" size="sm" onClick={() => onEdit(r)} title="Editar">
                          <Pencil className="w-4 h-4 text-blue-600" />
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" onClick={() => handleExportPDF(r)} title="Exportar PDF">
                        <Download className="w-4 h-4 text-green-600" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedRecord(r)}
                        title="Ver detalle"
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

export type { ChecklistRecord, ModificacionEntry };