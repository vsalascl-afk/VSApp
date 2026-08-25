import { useState, useEffect, useCallback } from "react";
import {
  ClipboardList,
  LogOut,
  X,
  Zap,
  Users,
  Building2,
  ClipboardCheck,
  QrCode,
  CalendarClock,
  Package,
  DollarSign,
  ChevronDown,
  ChevronRight,
  Globe,
  Wrench,
  Monitor,
  FileSpreadsheet,
  FileText,
  Mail,
  Ticket,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useEmpresa } from "@/lib/empresaContext";
import { SUPABASE_URL, SUPABASE_KEY, SUPABASE_SERVICE_KEY } from "@/lib/supabase";

type Section =
  | "ordenes"
  | "admin"
  | "empresas"
  | "checklists"
  | "checklists_mantencion"
  | "checklists_operacion"
  | "checklists_grupo_electrogeno"
  | "qr_equipos"
  | "reportabilidad_excel"
  | "reportabilidad_informes"
  | "reportabilidad_email"
  | "programacion"
  | "inventario"
  | "cotizaciones"
  | "portal_clientes"
  | "tickets";

interface SidebarProps {
  open: boolean;
  onClose: () => void;
  activeSection: Section;
  onNavigate: (section: Section) => void;
  onLogout: () => void;
  userRole?: string;
}

interface MenuItem {
  id: Section;
  label: string;
  icon: React.ReactNode;
  roles?: string[];
  licensed?: string;
  badge?: number | null;
}

interface MenuCategory {
  label: string;
  items: MenuItem[];
}

export default function Sidebar({
  open,
  onClose,
  activeSection,
  onNavigate,
  onLogout,
  userRole,
}: SidebarProps) {
  const { empresa, colorSecundario } = useEmpresa();

  // License-based module visibility
  const [activeModules, setActiveModules] = useState<Record<string, boolean>>({});
  // Dynamic indicators
  const [otPendientes, setOtPendientes] = useState<number>(0);
  const [otEnCurso, setOtEnCurso] = useState<number>(0);
  // Collapsed categories
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});

  const isSuperAdmin = userRole === "superadmin";

  useEffect(() => {
    if (!empresa) return;
    const fetchModules = async () => {
      try {
        const authKey = SUPABASE_SERVICE_KEY || SUPABASE_KEY;
        const res = await fetch(
          `${SUPABASE_URL}/rest/v1/company_modules?empresa_id=eq.${empresa.id}&active=eq.true`,
          {
            headers: {
              apikey: SUPABASE_KEY,
              Authorization: `Bearer ${authKey}`,
              "Content-Type": "application/json",
            },
          }
        );
        if (res.ok) {
          const data = await res.json();
          const mods: Record<string, boolean> = {};
          data.forEach((m: { module_name: string; active: boolean }) => {
            mods[m.module_name] = m.active;
          });
          setActiveModules(mods);
        }
      } catch (err) {
        console.error("Sidebar license check error:", err);
      }
    };
    fetchModules();
  }, [empresa?.id]);

  // Fetch OT counts for dynamic badges
  const fetchOTCounts = useCallback(async () => {
    if (!empresa) return;
    try {
      const authKey = SUPABASE_SERVICE_KEY || SUPABASE_KEY;
      const token = authKey;

      // Fetch pendientes count
      const resPend = await fetch(
        `${SUPABASE_URL}/rest/v1/ordenes_trabajo?empresa_id=eq.${empresa.id}&estado=eq.pendiente&select=id`,
        {
          headers: {
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            Prefer: "count=exact",
          },
        }
      );
      const pendCount = parseInt(resPend.headers.get("content-range")?.split("/")[1] || "0", 10);

      // Fetch en_curso count
      const resCurso = await fetch(
        `${SUPABASE_URL}/rest/v1/ordenes_trabajo?empresa_id=eq.${empresa.id}&estado=eq.en_curso&select=id`,
        {
          headers: {
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            Prefer: "count=exact",
          },
        }
      );
      const cursoCount = parseInt(resCurso.headers.get("content-range")?.split("/")[1] || "0", 10);

      setOtPendientes(pendCount);
      setOtEnCurso(cursoCount);
    } catch {
      // ignore
    }
  }, [empresa?.id]);

  useEffect(() => {
    fetchOTCounts();
    const interval = setInterval(fetchOTCounts, 60000); // refresh every 60s
    return () => clearInterval(interval);
  }, [fetchOTCounts]);

  const toggleCategory = (label: string) => {
    setCollapsedCategories((prev) => ({ ...prev, [label]: !prev[label] }));
  };



  // Build categorized menu according to new structure
  const categories: MenuCategory[] = [
    {
      label: "Operación",
      items: [
        {
          id: "ordenes",
          label: "Órdenes",
          icon: <ClipboardList className="w-5 h-5" />,
          licensed: "ordenes",
          badge: otPendientes + otEnCurso > 0 ? otPendientes + otEnCurso : null,
        },
        {
          id: "checklists",
          label: "CheckList",
          icon: <ClipboardCheck className="w-5 h-5" />,
          licensed: "checklists",
        },
        {
          id: "checklists_mantencion",
          label: "Mantenimiento BMS",
          icon: <Wrench className="w-5 h-5" />,
          licensed: "mantencion_bms",
        },
        {
          id: "checklists_operacion",
          label: "Operación BMS",
          icon: <Monitor className="w-5 h-5" />,
          licensed: "operacion_bms",
        },
        {
          id: "checklists_grupo_electrogeno",
          label: "Grupo Generador",
          icon: <Zap className="w-5 h-5" />,
          licensed: "grupo_electrogeno",
        },
      ],
    },
    {
      label: "Activos",
      items: [
        {
          id: "qr_equipos",
          label: "Catálogo Equipos / QR",
          icon: <QrCode className="w-5 h-5" />,
          licensed: "qr_equipos",
        },
      ],
    },
    {
      label: "Gestión",
      items: [
        {
          id: "inventario",
          label: "Inventario",
          icon: <Package className="w-5 h-5" />,
          roles: ["admin", "superadmin", "supervisor", "tecnico"],
          licensed: "inventario",
        },
        {
          id: "programacion",
          label: "Programación",
          icon: <CalendarClock className="w-5 h-5" />,
          roles: ["admin", "superadmin", "supervisor"],
          licensed: "programacion",
        },
        {
          id: "tickets",
          label: "Tickets",
          icon: <Ticket className="w-5 h-5" />,
          roles: ["admin", "superadmin", "supervisor", "tecnico"],
        },
      ],
    },
    {
      label: "Administración",
      items: [
        {
          id: "cotizaciones",
          label: "Cotizaciones",
          icon: <DollarSign className="w-5 h-5" />,
          roles: ["admin", "superadmin", "supervisor"],
          licensed: "cotizaciones",
        },
        {
          id: "reportabilidad_excel",
          label: "Reportes Excel",
          icon: <FileSpreadsheet className="w-5 h-5" />,
          roles: ["admin", "superadmin", "supervisor"],
          licensed: "reportes_excel",
        },
        {
          id: "reportabilidad_informes",
          label: "Reportes EA",
          icon: <FileText className="w-5 h-5" />,
          roles: ["admin", "superadmin", "supervisor"],
          licensed: "reportes_ea",
        },
        {
          id: "reportabilidad_email",
          label: "Reportes Email",
          icon: <Mail className="w-5 h-5" />,
          roles: ["admin", "superadmin", "supervisor"],
          licensed: "reportes_email",
        },
      ],
    },
    {
      label: "Portal Cliente",
      items: [
        {
          id: "portal_clientes",
          label: "Portal Clientes",
          icon: <Globe className="w-5 h-5" />,
          roles: ["admin", "superadmin"],
          licensed: "portal_clientes",
        },
      ],
    },
    {
      label: "Configuración",
      items: [
        {
          id: "admin",
          label: "Usuarios",
          icon: <Users className="w-5 h-5" />,
          roles: ["admin", "superadmin"],
        },
        {
          id: "empresas",
          label: "Empresas",
          icon: <Building2 className="w-5 h-5" />,
          roles: ["superadmin"],
        },
      ],
    },
  ];

  // Filter items based on role and license
  const getVisibleItems = (items: MenuItem[]): MenuItem[] => {
    return items.filter((item) => {
      // Role check
      if (item.roles && (!userRole || !item.roles.includes(userRole))) return false;
      // License check: if item requires a license
      // - superadmin always sees all (with OFF badge for inactive)
      // - admin/others only see modules that are active for their company
      if (item.licensed) {
        return activeModules[item.licensed] || isSuperAdmin;
      }
      return true;
    });
  };

  // Check if a category has the active item
  const categoryHasActive = (items: MenuItem[]) =>
    items.some((item) => item.id === activeSection);

  // Filter categories that have at least one visible item
  const visibleCategories = categories
    .map((cat) => ({
      ...cat,
      items: getVisibleItems(cat.items),
    }))
    .filter((cat) => cat.items.length > 0);

  const sidebarBg = colorSecundario || "#0f172a";

  return (
    <>
      {/* Overlay */}
      {open && (
        <div
          className="fixed inset-0 bg-black/30 z-40 transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <div
        className={cn(
          "fixed top-0 left-0 h-full w-64 text-white z-50 transform transition-transform duration-300 ease-in-out flex flex-col"
        )}
        style={{
          backgroundColor: sidebarBg,
          transform: open ? "translateX(0)" : "translateX(-100%)",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <div className="flex items-center gap-2 min-w-0">
            {empresa?.logo_url ? (
              <img
                src={empresa.logo_url}
                alt={empresa.nombre}
                className="w-8 h-8 rounded object-contain bg-white/10 shrink-0"
              />
            ) : (
              <Zap className="w-5 h-5 text-blue-400 shrink-0" />
            )}
            <span className="font-bold text-lg truncate">
              {empresa?.nombre || "VSApp"}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-white/10 transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {visibleCategories.map((category) => {
            const isCollapsed = collapsedCategories[category.label] || false;
            const hasActiveItem = categoryHasActive(category.items);

            return (
              <div key={category.label} className="mb-1">
                {/* Category header */}
                <button
                  onClick={() => toggleCategory(category.label)}
                  className={cn(
                    "w-full flex items-center justify-between px-3 py-2 rounded-md text-xs font-semibold uppercase tracking-wider transition-colors",
                    hasActiveItem
                      ? "text-blue-300"
                      : "text-white/50 hover:text-white/70"
                  )}
                >
                  <span>{category.label}</span>
                  {isCollapsed ? (
                    <ChevronRight className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5" />
                  )}
                </button>

                {/* Category items */}
                {!isCollapsed && (
                  <div className="mt-0.5 space-y-0.5 ml-1">
                    {category.items.map((item) => {
                      const isActive = activeSection === item.id;
                      const isLicensed = item.licensed
                        ? activeModules[item.licensed] || false
                        : true;
                      const isDisabledByLicense = item.licensed && !isLicensed && isSuperAdmin;

                      return (
                        <button
                          key={item.id}
                          onClick={() => {
                            onNavigate(item.id);
                            onClose();
                          }}
                          className={cn(
                            "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors relative",
                            isActive
                              ? "bg-white/20 text-white"
                              : "text-white/70 hover:bg-white/10 hover:text-white",
                            isDisabledByLicense && "opacity-50"
                          )}
                        >
                          {item.icon}
                          <span className="flex-1 text-left">{item.label}</span>
                          {/* Dynamic badge */}
                          {item.badge && item.badge > 0 && (
                            <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-[10px] font-bold rounded-full bg-red-500 text-white">
                              {item.badge > 99 ? "99+" : item.badge}
                            </span>
                          )}
                          {/* License disabled indicator */}
                          {isDisabledByLicense && (
                            <span className="text-[9px] bg-yellow-500/20 text-yellow-300 px-1.5 py-0.5 rounded-full">
                              OFF
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Logout */}
        <div className="p-3 border-t border-white/10">
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-white/70 hover:bg-white/10 hover:text-white transition-colors"
          >
            <LogOut className="w-5 h-5" />
            Salir
          </button>
        </div>
      </div>
    </>
  );
}