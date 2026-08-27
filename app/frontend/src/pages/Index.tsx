import { useState, useCallback, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import type { Usuario } from "@/lib/types";
import { useEmpresa } from "@/lib/empresaContext";
import LoginScreen from "@/components/LoginScreen";
import ChangePasswordScreen from "@/components/ChangePasswordScreen";
import Sidebar from "@/components/Sidebar";
import CreateOTForm from "@/components/CreateOTForm";
import OTList from "@/components/OTList";
import Dashboard from "@/components/Dashboard";
import AdminPanel from "@/components/AdminPanel";
import EmpresaManager from "@/components/EmpresaManager";
import ChecklistModule from "@/components/checklists/ChecklistModule";
import QREquiposModule from "@/components/qr/QREquiposModule";
import ReportabilidadModule from "@/components/reportabilidad/ReportabilidadModule";
import ProgramacionModule from "@/components/ProgramacionModule";
import InventarioModule from "@/components/InventarioModule";
import CotizacionesModule from "@/components/CotizacionesModule";
import PortalClientesAdmin from "@/components/PortalClientesAdmin";
import TicketsModule from "@/components/TicketsModule";
import ProyectosModule from "@/components/ProyectosModule";
import LibroObraModule from "@/components/LibroObraModule";
import NotificationBell from "@/components/NotificationBell";
import { Toaster } from "@/components/ui/toaster";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Menu, LogOut, Zap, ClipboardList, BarChart3, Plus } from "lucide-react";

type Section = "ordenes" | "admin" | "empresas" | "checklists" | "checklists_mantencion" | "checklists_operacion" | "checklists_grupo_electrogeno" | "qr_equipos" | "reportabilidad_excel" | "reportabilidad_informes" | "reportabilidad_email" | "programacion" | "inventario" | "cotizaciones" | "portal_clientes" | "tickets" | "proyectos" | "libro_obra";

function getInitials(name: string | undefined | null): string {
  if (!name || typeof name !== "string") return "--";
  return name
    .split(" ")
    .filter(Boolean)
    .map((p) => p[0] || "")
    .join("")
    .toUpperCase()
    .slice(0, 2) || "--";
}

export default function IndexPage() {
  const [user, setUser] = useState<Usuario | null>(null);
  const [token, setToken] = useState<string>("");
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<Section>("ordenes");
  const [otSubTab, setOtSubTab] = useState<"crear" | "dashboard">("crear");
  const [refreshKey, setRefreshKey] = useState(0);
  const { empresa, colorPrimario, colorSecundario, setEmpresa } = useEmpresa();
  const [searchParams, setSearchParams] = useSearchParams();

  // Si viene con ?equipo_id=xxx desde la página QR, abrir directamente la sección QR Equipos
  useEffect(() => {
    const equipoId = searchParams.get("equipo_id");
    if (equipoId && user) {
      setActiveSection("qr_equipos");
      // Limpiar el parámetro de la URL para no repetir la acción
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, user, setSearchParams]);

  // Listener para navegar a Inventario desde OT (botón "Agregar materiales desde Inventario")
  useEffect(() => {
    const handler = () => {
      setActiveSection("inventario");
    };
    window.addEventListener("navigate-inventario", handler);
    return () => window.removeEventListener("navigate-inventario", handler);
  }, []);

  const handleLogin = useCallback((u: Usuario, t: string) => {
    setUser(u);
    setToken(t);
    localStorage.setItem("token", t);
    // Check if user must change password on first login
    if (u.debe_cambiar_password) {
      setMustChangePassword(true);
    }
  }, []);

  const handlePasswordChanged = useCallback(() => {
    setMustChangePassword(false);
    if (user) {
      setUser({ ...user, debe_cambiar_password: false });
    }
  }, [user]);

  const handleLogout = useCallback(() => {
    setUser(null);
    setToken("");
    setEmpresa(null);
    localStorage.removeItem("token");
  }, [setEmpresa]);

  const handleOTCreated = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  if (!user) {
    return (
      <>
        <LoginScreen onLogin={handleLogin} />
        <Toaster />
      </>
    );
  }

  if (mustChangePassword) {
    return (
      <>
        <ChangePasswordScreen
          user={user}
          token={token}
          onPasswordChanged={handlePasswordChanged}
        />
        <Toaster />
      </>
    );
  }

  const headerBg = colorSecundario;
  const accentColor = colorPrimario;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 to-blue-100">
      {/* Header */}
      <header
        className="text-white sticky top-0 z-30 shadow-lg"
        style={{ backgroundColor: headerBg }}
      >
        <div className="flex items-center justify-between px-4 py-3 max-w-5xl mx-auto">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2 min-w-0">
            {empresa?.logo_url ? (
              <img
                src={empresa.logo_url}
                alt={empresa.nombre}
                className="w-7 h-7 rounded object-contain bg-white/10 shrink-0"
              />
            ) : (
              <Zap className="w-5 h-5 shrink-0" style={{ color: accentColor }} />
            )}
            <h1 className="text-lg font-bold tracking-wide truncate">
              {empresa?.nombre || "Sistema OT"}
            </h1>
          </div>

          <div className="flex items-center gap-1">
            <NotificationBell user={user} token={token} />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2">
                  <Avatar className="w-8 h-8 shrink-0">
                    <AvatarFallback
                      className="text-white text-xs font-bold"
                      style={{ backgroundColor: accentColor }}
                    >
                      {getInitials(user.nombre)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium text-white truncate max-w-[120px] hidden sm:inline">
                    {user.nombre}
                  </span>
                </button>
              </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem className="text-xs text-muted-foreground" disabled>
                {user.nombre} ({user.rol})
              </DropdownMenuItem>
              {empresa && (
                <DropdownMenuItem className="text-xs text-muted-foreground" disabled>
                  {empresa.nombre}
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={handleLogout} className="gap-2">
                <LogOut className="w-4 h-4" />
                Cerrar sesión
              </DropdownMenuItem>
            </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Sidebar */}
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        activeSection={activeSection}
        onNavigate={setActiveSection}
        onLogout={handleLogout}
        userRole={user.rol}
        token={token}
      />

      {/* Content */}
      <main className="max-w-5xl mx-auto p-4 pb-20">
        {activeSection === "ordenes" && (
          <div className="space-y-4">
            {/* Sub-tabs for Órdenes */}
            <div className="flex gap-2 border-b pb-3 flex-wrap">
              <button
                type="button"
                onClick={() => setOtSubTab("crear")}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  otSubTab === "crear"
                    ? "bg-blue-600 text-white shadow-md"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                <Plus className="w-4 h-4" />
                Crear OT
              </button>
              <button
                type="button"
                onClick={() => setOtSubTab("dashboard")}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  otSubTab === "dashboard"
                    ? "bg-blue-600 text-white shadow-md"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                <BarChart3 className="w-4 h-4" />
                Dashboard
              </button>
            </div>

            {otSubTab === "crear" && (
              <>
                <CreateOTForm
                  user={user}
                  token={token}
                  onCreated={handleOTCreated}
                />
                <OTList user={user} token={token} refreshKey={refreshKey} />
              </>
            )}

            {otSubTab === "dashboard" && (
              <Dashboard user={user} token={token} refreshKey={refreshKey} />
            )}
          </div>
        )}

        {activeSection === "admin" &&
          (user.rol === "admin" || user.rol === "superadmin") && (
            <AdminPanel user={user} token={token} />
          )}

        {activeSection === "empresas" && user.rol === "superadmin" && (
          <EmpresaManager user={user} token={token} />
        )}

        {activeSection === "checklists" && (
          <ChecklistModule
            key="checklists-dashboard"
            user={user}
            token={token}
            initialSubModulo="dashboard"
          />
        )}

        {activeSection === "checklists_mantencion" && (
          <ChecklistModule
            key="checklists-mantencion"
            user={user}
            token={token}
            initialSubModulo="mantencion"
            standalone
          />
        )}

        {activeSection === "checklists_operacion" && (
          <ChecklistModule
            key="checklists-operacion"
            user={user}
            token={token}
            initialSubModulo="operacion"
            standalone
          />
        )}

        {activeSection === "checklists_grupo_electrogeno" && (
          <ChecklistModule
            key="checklists-grupo-electrogeno"
            user={user}
            token={token}
            initialSubModulo="grupo_electrogeno"
            standalone
          />
        )}

        {activeSection === "qr_equipos" && (
          <QREquiposModule user={user} token={token} onNavigate={setActiveSection} />
        )}

        {activeSection === "programacion" && (
          <ProgramacionModule user={user} token={token} onOTCreated={handleOTCreated} />
        )}

        {activeSection === "inventario" && (
          <InventarioModule user={user} token={token} />
        )}

        {activeSection === "cotizaciones" &&
          (user.rol === "superadmin" || user.rol === "admin" || user.rol === "supervisor") && (
            <CotizacionesModule user={user} token={token} />
          )}

        {activeSection === "reportabilidad_excel" && (
          <ReportabilidadModule
            key="reportes-excel"
            user={user}
            token={token}
            initialSubModulo="reporte_excel"
            standalone
          />
        )}

        {activeSection === "reportabilidad_informes" && (
          <ReportabilidadModule
            key="reportes-ea"
            user={user}
            token={token}
            initialSubModulo="informes_ia"
            standalone
          />
        )}

        {activeSection === "reportabilidad_email" && (
          <ReportabilidadModule
            key="reportes-email"
            user={user}
            token={token}
            initialSubModulo="reportes_auto"
            standalone
          />
        )}

        {activeSection === "portal_clientes" &&
          (user.rol === "superadmin" || user.rol === "admin") && (
            <PortalClientesAdmin user={user} token={token} />
          )}

        {activeSection === "tickets" && (
          <TicketsModule
            user={user}
            token={token}
            onGoToOrdenes={() => setActiveSection("ordenes")}
          />
        )}

        {activeSection === "proyectos" &&
          (user.rol === "superadmin" || user.rol === "admin" || user.rol === "supervisor") && (
            <ProyectosModule user={user} token={token} />
          )}

        {activeSection === "libro_obra" && (
          <LibroObraModule user={user} token={token} />
        )}
      </main>

      <Toaster />
    </div>
  );
}