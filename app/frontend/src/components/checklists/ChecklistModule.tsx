import { useState, useEffect } from "react";
import { useEmpresa } from "@/lib/empresaContext";
import type { Usuario } from "@/lib/types";
import { SUPABASE_URL, SUPABASE_KEY, SUPABASE_SERVICE_KEY } from "@/lib/supabase";
import ChecklistBMSForm from "./ChecklistBMSForm";
import ChecklistHistorial from "./ChecklistHistorial";
import type { ChecklistRecord } from "./ChecklistHistorial";
import ChecklistOperacionBMS from "./ChecklistOperacionBMS";
import ChecklistGrupoElectrogeno from "./ChecklistGrupoElectrogeno";
import ChecklistDashboard from "./ChecklistDashboard";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ShieldAlert, ClipboardCheck, Wrench, Monitor, BarChart3, Zap } from "lucide-react";

type SubModulo = "mantencion" | "operacion" | "grupo_electrogeno" | "dashboard";

interface ChecklistModuleProps {
  user: Usuario;
  token: string;
  initialSubModulo?: SubModulo;
  standalone?: boolean; // When true, hide sub-module tabs and show only the specified module
}

export default function ChecklistModule({ user, token, initialSubModulo, standalone }: ChecklistModuleProps) {
  const { empresa, colorPrimario } = useEmpresa();
  const [moduleActive, setModuleActive] = useState<boolean | null>(null);
  const [geModuleActive, setGeModuleActive] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);
  const [subModulo, setSubModulo] = useState<SubModulo>(initialSubModulo || "dashboard");
  const [activeTab, setActiveTab] = useState<"formulario" | "historial">("formulario");
  const [activeTabOp, setActiveTabOp] = useState<"formulario" | "historial">("formulario");
  const [activeTabGE, setActiveTabGE] = useState<"formulario" | "historial">("formulario");

  // Edit state
  const [editingMantencion, setEditingMantencion] = useState<ChecklistRecord | null>(null);
  const [editingGE, setEditingGE] = useState<ChecklistRecord | null>(null);
  const [editingOperacion, setEditingOperacion] = useState<ChecklistRecord | null>(null);
  const [editKey, setEditKey] = useState(0); // Force re-render on edit

  // Sync sub-module when navigated from Sidebar
  useEffect(() => {
    if (initialSubModulo) {
      setSubModulo(initialSubModulo);
    }
  }, [initialSubModulo]);

  useEffect(() => {
    checkModuleLicense();
  }, [empresa]);

  async function checkModuleLicense() {
    if (!empresa) {
      setModuleActive(false);
      setLoading(false);
      return;
    }

    const isPrivileged = user.rol === "superadmin" || user.rol === "admin";
    // Use service key if available, otherwise fall back to user's auth token
    const authKey = SUPABASE_SERVICE_KEY || token;
    const apiKey = SUPABASE_SERVICE_KEY || SUPABASE_KEY;

    try {
      // Check checklists and grupo_electrogeno modules
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/company_modules?empresa_id=eq.${empresa.id}&module_name=in.(checklists,grupo_electrogeno)`,
        {
          headers: {
            apikey: apiKey,
            Authorization: `Bearer ${authKey}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (res.ok) {
        const data = await res.json();
        const checklistRow = data?.find((r: { module_name: string; active: boolean }) => r.module_name === "checklists");
        const geRow = data?.find((r: { module_name: string; active: boolean }) => r.module_name === "grupo_electrogeno");

        if (checklistRow) {
          setModuleActive(checklistRow.active || isPrivileged);
        } else {
          setModuleActive(isPrivileged);
        }

        if (geRow) {
          setGeModuleActive(geRow.active || isPrivileged);
        } else {
          setGeModuleActive(isPrivileged);
        }
      } else {
        // Table might not exist - allow privileged users
        setModuleActive(isPrivileged);
        setGeModuleActive(isPrivileged);
      }

    } catch {
      // If any error (table doesn't exist, network, etc.) - allow privileged users
      setModuleActive(isPrivileged);
      setGeModuleActive(isPrivileged);
    }
    setLoading(false);
  }

  function handleEditMantencion(record: ChecklistRecord) {
    setEditingMantencion(record);
    setActiveTab("formulario");
    setEditKey((k) => k + 1);
  }

  function handleEditOperacion(record: ChecklistRecord) {
    setEditingOperacion(record);
    setActiveTabOp("formulario");
    setEditKey((k) => k + 1);
  }

  function handleEditMantencionDone() {
    setEditingMantencion(null);
    setActiveTab("historial");
    setEditKey((k) => k + 1);
  }

  function handleEditOperacionDone() {
    setEditingOperacion(null);
    setActiveTabOp("historial");
    setEditKey((k) => k + 1);
  }

  function handleEditGE(record: ChecklistRecord) {
    setEditingGE(record);
    setActiveTabGE("formulario");
    setEditKey((k) => k + 1);
  }

  function handleEditGEDone() {
    setEditingGE(null);
    setActiveTabGE("historial");
    setEditKey((k) => k + 1);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!moduleActive && user.rol !== "superadmin" && user.rol !== "admin") {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <ShieldAlert className="w-16 h-16 text-amber-500 mb-4" />
        <h2 className="text-xl font-bold text-gray-800 mb-2">Módulo No Disponible</h2>
        <p className="text-gray-600 max-w-md">
          El módulo de CheckList no está activado para su empresa.
          Contacte al administrador para solicitar la licencia.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        {standalone && subModulo === "mantencion" && <Wrench className="w-6 h-6" style={{ color: colorPrimario }} />}
        {standalone && subModulo === "operacion" && <Monitor className="w-6 h-6" style={{ color: colorPrimario }} />}
        {standalone && subModulo === "grupo_electrogeno" && <Zap className="w-6 h-6" style={{ color: colorPrimario }} />}
        {!standalone && <ClipboardCheck className="w-6 h-6" style={{ color: colorPrimario }} />}
        <h2 className="text-xl font-bold text-gray-800">
          {standalone && subModulo === "mantencion" ? "Mantenimiento BMS" :
           standalone && subModulo === "operacion" ? "Operación BMS" :
           standalone && subModulo === "grupo_electrogeno" ? "Grupo Electrógeno" :
           "CheckList"}
        </h2>
      </div>

      {/* Sub-módulo selector (árbol) - only shown when NOT standalone */}
      {!standalone && (
        <div className="flex gap-2 border-b pb-3 flex-wrap">
          <button
            type="button"
            onClick={() => setSubModulo("dashboard")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              subModulo === "dashboard"
                ? "bg-blue-600 text-white shadow-md"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            Dashboard
          </button>
          <button
            type="button"
            onClick={() => setSubModulo("mantencion")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              subModulo === "mantencion"
                ? "bg-blue-600 text-white shadow-md"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            <Wrench className="w-4 h-4" />
            Mantención BMS
          </button>
          <button
            type="button"
            onClick={() => setSubModulo("operacion")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              subModulo === "operacion"
                ? "bg-blue-600 text-white shadow-md"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            <Monitor className="w-4 h-4" />
            Operación BMS
          </button>
          {geModuleActive && (
            <button
              type="button"
              onClick={() => setSubModulo("grupo_electrogeno")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                subModulo === "grupo_electrogeno"
                  ? "bg-blue-600 text-white shadow-md"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              <Zap className="w-4 h-4" />
              Grupo Electrógeno
            </button>
          )}
        </div>
      )}

      {/* Sub-módulo: Dashboard */}
      {subModulo === "dashboard" && (
        <ChecklistDashboard user={user} token={token} />
      )}

      {/* Sub-módulo: Mantención BMS */}
      {subModulo === "mantencion" && (
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "formulario" | "historial")}>
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="formulario">
              {editingMantencion ? "✏️ Editando Checklist" : "Nuevo Checklist"}
            </TabsTrigger>
            <TabsTrigger value="historial">Historial</TabsTrigger>
          </TabsList>

          <TabsContent value="formulario">
            <ChecklistBMSForm
              key={`mantencion-${editKey}`}
              user={user}
              token={token}
              editRecord={editingMantencion ? {
                id: editingMantencion.id,
                estado: editingMantencion.estado,
                informacion_general: editingMantencion.informacion_general as never,
                inspeccion_visual: editingMantencion.inspeccion_visual as never,
                inspeccion_electrica: editingMantencion.inspeccion_electrica as never,
                redes_comunicacion: editingMantencion.redes_comunicacion as never,
                software_bms: editingMantencion.software_bms as never,
                respaldos_data: editingMantencion.respaldos_data as never,
                pruebas_funcionales: editingMantencion.pruebas_funcionales as never,
                hallazgos_data: (editingMantencion.hallazgos_data || []) as never,
                evidencias_data: editingMantencion.evidencias_data as never,
                resultado_final: editingMantencion.resultado_final as never,
                firmas_data: editingMantencion.firmas_data as never,
                historial_modificaciones: editingMantencion.historial_modificaciones || [],
                hora_creacion: editingMantencion.hora_creacion,
                hora_cierre: editingMantencion.hora_cierre,
              } : null}
              onEditDone={handleEditMantencionDone}
            />
          </TabsContent>
          <TabsContent value="historial">
            <ChecklistHistorial
              key={`hist-mantencion-${editKey}`}
              user={user}
              token={token}
              onEdit={handleEditMantencion}
            />
          </TabsContent>
        </Tabs>
      )}

      {/* Sub-módulo: Operación BMS */}
      {subModulo === "operacion" && (
        <Tabs value={activeTabOp} onValueChange={(v) => setActiveTabOp(v as "formulario" | "historial")}>
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="formulario">
              {editingOperacion ? "✏️ Editando Ronda" : "Nueva Ronda"}
            </TabsTrigger>
            <TabsTrigger value="historial">Historial</TabsTrigger>
          </TabsList>

          <TabsContent value="formulario">
            <ChecklistOperacionBMS
              key={`operacion-${editKey}`}
              user={user}
              token={token}
              editRecord={editingOperacion ? {
                id: editingOperacion.id,
                estado: editingOperacion.estado,
                informacion_general: editingOperacion.informacion_general as never,
                especialidades_data: (editingOperacion.especialidades_data || []) as never,
                bitacora: editingOperacion.bitacora || "",
                historial_modificaciones: editingOperacion.historial_modificaciones || [],
                hora_creacion: editingOperacion.hora_creacion,
                hora_cierre: editingOperacion.hora_cierre,
              } : null}
              onEditDone={handleEditOperacionDone}
            />
          </TabsContent>
          <TabsContent value="historial">
            <ChecklistHistorial
              key={`hist-operacion-${editKey}`}
              user={user}
              token={token}
              tableKey="operacion_bms"
              onEdit={handleEditOperacion}
            />
          </TabsContent>
        </Tabs>
      )}

      {/* Sub-módulo: Grupo Electrógeno */}
      {subModulo === "grupo_electrogeno" && geModuleActive && (
        <Tabs value={activeTabGE} onValueChange={(v) => setActiveTabGE(v as "formulario" | "historial")}>
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="formulario">
              {editingGE ? "✏️ Editando Checklist" : "Nuevo Checklist"}
            </TabsTrigger>
            <TabsTrigger value="historial">Historial</TabsTrigger>
          </TabsList>

          <TabsContent value="formulario">
            <ChecklistGrupoElectrogeno
              key={`ge-${editKey}`}
              user={user}
              token={token}
              editRecord={editingGE ? {
                id: editingGE.id,
                estado: editingGE.estado,
                informacion_general: editingGE.informacion_general as never,
                secciones_data: (editingGE.especialidades_data || editingGE.secciones_data || []) as never,
                observaciones_generales: (editingGE.informacion_general as Record<string, string>)?.observaciones_generales || editingGE.bitacora || "",
                historial_modificaciones: editingGE.historial_modificaciones || [],
                hora_creacion: editingGE.hora_creacion,
                hora_cierre: editingGE.hora_cierre,
              } : null}
              onEditDone={handleEditGEDone}
            />
          </TabsContent>
          <TabsContent value="historial">
            <ChecklistHistorial
              key={`hist-ge-${editKey}`}
              user={user}
              token={token}
              tableKey="grupo_electrogeno"
              onEdit={handleEditGE}
            />
          </TabsContent>
        </Tabs>
      )}

    </div>
  );
}