import { useState, useEffect } from "react";
import { useEmpresa } from "@/lib/empresaContext";
import type { Usuario } from "@/lib/types";
import { SUPABASE_URL, SUPABASE_KEY, SUPABASE_SERVICE_KEY } from "@/lib/supabase";
import InformeEjecutivo from "@/components/checklists/InformeEjecutivo";
import ReporteExcel from "@/components/checklists/ReporteExcel";
import ReportesAutomaticos from "@/components/reportabilidad/ReportesAutomaticos";
import { ShieldAlert, BarChart3, FileText, FileSpreadsheet, Mail } from "lucide-react";

type SubModulo = "informes_ia" | "reporte_excel" | "reportes_auto";

interface ReportabilidadModuleProps {
  user: Usuario;
  token: string;
  initialSubModulo?: SubModulo;
  standalone?: boolean; // When true, hide sub-module tabs and show only the specified module
}

export default function ReportabilidadModule({ user, token, initialSubModulo, standalone }: ReportabilidadModuleProps) {
  const { empresa, colorPrimario } = useEmpresa();
  const [moduleActive, setModuleActive] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [subModulo, setSubModulo] = useState<SubModulo>(initialSubModulo || "reporte_excel");

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
    const authKey = SUPABASE_SERVICE_KEY || token;
    const apiKey = SUPABASE_SERVICE_KEY || SUPABASE_KEY;

    try {
      // Check specific module license based on which sub-module we're showing
      const moduleToCheck = subModulo === "reporte_excel" ? "reportes_excel" :
                            subModulo === "informes_ia" ? "reportes_ea" :
                            subModulo === "reportes_auto" ? "reportes_email" :
                            "reportes_excel";

      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/company_modules?empresa_id=eq.${empresa.id}&module_name=eq.${moduleToCheck}`,
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
        if (data && data.length > 0) {
          setModuleActive(data[0].active || isPrivileged);
        } else {
          // No record - also check legacy reportabilidad for backward compatibility
          const resLegacy = await fetch(
            `${SUPABASE_URL}/rest/v1/company_modules?empresa_id=eq.${empresa.id}&module_name=eq.reportabilidad`,
            {
              headers: {
                apikey: apiKey,
                Authorization: `Bearer ${authKey}`,
                "Content-Type": "application/json",
              },
            }
          );
          if (resLegacy.ok) {
            const dataLegacy = await resLegacy.json();
            if (dataLegacy && dataLegacy.length > 0) {
              setModuleActive(dataLegacy[0].active || isPrivileged);
            } else {
              setModuleActive(isPrivileged);
            }
          } else {
            setModuleActive(isPrivileged);
          }
        }
      } else {
        setModuleActive(isPrivileged);
      }
    } catch {
      setModuleActive(isPrivileged);
    }
    setLoading(false);
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
          El módulo de Reportabilidad no está activado para su empresa.
          Contacte al administrador para solicitar la licencia.
        </p>
      </div>
    );
  }

  // Solo supervisores y administradores pueden ver Reportes Email
  const canAccessReportesEmail = ["superadmin", "admin", "supervisor"].includes(user.rol);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        {standalone && subModulo === "reporte_excel" && <FileSpreadsheet className="w-6 h-6" style={{ color: colorPrimario }} />}
        {standalone && subModulo === "informes_ia" && <FileText className="w-6 h-6" style={{ color: colorPrimario }} />}
        {standalone && subModulo === "reportes_auto" && <Mail className="w-6 h-6" style={{ color: colorPrimario }} />}
        {!standalone && <BarChart3 className="w-6 h-6" style={{ color: colorPrimario }} />}
        <h2 className="text-xl font-bold text-gray-800">
          {standalone && subModulo === "reporte_excel" ? "Reportes Excel" :
           standalone && subModulo === "informes_ia" ? "Reportes EA" :
           standalone && subModulo === "reportes_auto" ? "Reportes Email" :
           "Reportabilidad"}
        </h2>
      </div>

      {/* Sub-módulo selector - only shown when NOT standalone */}
      {!standalone && (
        <div className="flex gap-2 border-b pb-3 flex-wrap">
          <button
            type="button"
            onClick={() => setSubModulo("reporte_excel")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              subModulo === "reporte_excel"
                ? "bg-green-600 text-white shadow-md"
                : "bg-green-50 text-green-600 hover:bg-green-100"
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            Reporte Excel
          </button>
          <button
            type="button"
            onClick={() => setSubModulo("informes_ia")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              subModulo === "informes_ia"
                ? "bg-purple-600 text-white shadow-md"
                : "bg-purple-50 text-purple-600 hover:bg-purple-100"
            }`}
          >
            <FileText className="w-4 h-4" />
            Informes IA
          </button>
          {canAccessReportesEmail && (
            <button
              type="button"
              onClick={() => setSubModulo("reportes_auto")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                subModulo === "reportes_auto"
                  ? "bg-blue-600 text-white shadow-md"
                  : "bg-blue-50 text-blue-600 hover:bg-blue-100"
              }`}
            >
              <Mail className="w-4 h-4" />
              Reportes Email
            </button>
          )}
        </div>
      )}

      {/* Sub-módulo: Reporte Excel */}
      {subModulo === "reporte_excel" && (
        <ReporteExcel user={user} token={token} />
      )}

      {/* Sub-módulo: Informes IA */}
      {subModulo === "informes_ia" && (
        <InformeEjecutivo user={user} token={token} />
      )}

      {/* Sub-módulo: Reportes Automáticos por Email - Solo supervisores y admins */}
      {subModulo === "reportes_auto" && canAccessReportesEmail && (
        <ReportesAutomaticos user={user} token={token} />
      )}
    </div>
  );
}