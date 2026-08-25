import { useState, useEffect, useCallback, useRef } from "react";
import type { Empresa, Usuario } from "@/lib/types";
import { SUPABASE_URL, SUPABASE_KEY } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogFooter,
  DialogHeader,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Building2,
  Loader2,
  Plus,
  Pencil,
  Trash2,
  Upload,
  Users,
  Palette,
  ClipboardCheck,
} from "lucide-react";

interface EmpresaManagerProps {
  user: Usuario;
  token: string;
}

interface ModulesState {
  ordenes: boolean;
  checklists: boolean;
  mantencion_bms: boolean;
  operacion_bms: boolean;
  qr_equipos: boolean;
  inventario: boolean;
  programacion: boolean;
  cotizaciones: boolean;
  reportes_excel: boolean;
  reportes_ea: boolean;
  reportes_email: boolean;
  grupo_electrogeno: boolean;
  portal_clientes: boolean;
  tickets: boolean;
}

const defaultModules: ModulesState = {
  ordenes: true,
  checklists: false,
  mantencion_bms: false,
  operacion_bms: false,
  qr_equipos: false,
  inventario: false,
  programacion: false,
  cotizaciones: false,
  reportes_excel: false,
  reportes_ea: false,
  reportes_email: false,
  grupo_electrogeno: false,
  portal_clientes: false,
  tickets: false,
};

const defaultEmpresa: Omit<Empresa, "id" | "created_at"> = {
  nombre: "",
  logo_url: "",
  color_primario: "#2563eb",
  color_secundario: "#0f172a",
  rut: "",
  direccion: "",
  telefono: "",
  email: "",
  activa: true,
};

export default function EmpresaManager({ user, token }: EmpresaManagerProps) {
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingEmpresa, setEditingEmpresa] = useState<Empresa | null>(null);
  const [form, setForm] = useState(defaultEmpresa);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [userCounts, setUserCounts] = useState<Record<string, number>>({});
  const [modules, setModules] = useState<ModulesState>(defaultModules);
  const [empresaModules, setEmpresaModules] = useState<Record<string, boolean>>({});
  const [empresaModulesReportExcel, setEmpresaModulesReportExcel] = useState<Record<string, boolean>>({});
  const [empresaModulesReportEA, setEmpresaModulesReportEA] = useState<Record<string, boolean>>({});
  const [empresaModulesReportEmail, setEmpresaModulesReportEmail] = useState<Record<string, boolean>>({});
  const [empresaModulesQR, setEmpresaModulesQR] = useState<Record<string, boolean>>({});
  const [empresaModulesGE, setEmpresaModulesGE] = useState<Record<string, boolean>>({});
  const [empresaModulesInv, setEmpresaModulesInv] = useState<Record<string, boolean>>({});
  const [empresaModulesProg, setEmpresaModulesProg] = useState<Record<string, boolean>>({});
  const [empresaModulesOrdenes, setEmpresaModulesOrdenes] = useState<Record<string, boolean>>({});
  const [empresaModulesCot, setEmpresaModulesCot] = useState<Record<string, boolean>>({});
  const [empresaModulesPortal, setEmpresaModulesPortal] = useState<Record<string, boolean>>({});
  const [empresaModulesMantBMS, setEmpresaModulesMantBMS] = useState<Record<string, boolean>>({});
  const [empresaModulesOpBMS, setEmpresaModulesOpBMS] = useState<Record<string, boolean>>({});
  const [empresaModulesTickets, setEmpresaModulesTickets] = useState<Record<string, boolean>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const fetchEmpresas = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/empresas?order=nombre.asc`,
        {
          headers: {
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );
      if (res.ok) {
        const data = await res.json();
        setEmpresas(Array.isArray(data) ? data : []);
      }
    } catch {
      toast({
        title: "Error",
        description: "No se pudieron cargar las empresas",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [token, toast]);

  const fetchUserCounts = useCallback(async () => {
    try {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/usuarios?select=empresa_id`,
        {
          headers: {
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );
      if (res.ok) {
        const data = await res.json();
        const counts: Record<string, number> = {};
        if (Array.isArray(data)) {
          for (const u of data) {
            if (u.empresa_id) {
              counts[u.empresa_id] = (counts[u.empresa_id] || 0) + 1;
            }
          }
        }
        setUserCounts(counts);
      }
    } catch {
      // silently fail
    }
  }, [token]);

  const fetchEmpresaModules = useCallback(async () => {
    try {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/company_modules?module_name=in.(ordenes,checklists,mantencion_bms,operacion_bms,reportes_excel,reportes_ea,reportes_email,qr_equipos,grupo_electrogeno,inventario,programacion,cotizaciones,portal_clientes,tickets)&select=empresa_id,module_name,active`,
        {
          headers: {
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );
      if (res.ok) {
        const data = await res.json();
        const map: Record<string, boolean> = {};
        const mapReportExcel: Record<string, boolean> = {};
        const mapReportEA: Record<string, boolean> = {};
        const mapReportEmail: Record<string, boolean> = {};
        const mapQR: Record<string, boolean> = {};
        const mapGE: Record<string, boolean> = {};
        const mapInv: Record<string, boolean> = {};
        const mapProg: Record<string, boolean> = {};
        const mapOrdenes: Record<string, boolean> = {};
        const mapCot: Record<string, boolean> = {};
        const mapPortal: Record<string, boolean> = {};
        const mapMantBMS: Record<string, boolean> = {};
        const mapOpBMS: Record<string, boolean> = {};
        const mapTickets: Record<string, boolean> = {};
        if (Array.isArray(data)) {
          for (const row of data) {
            if (row.module_name === "checklists") {
              map[row.empresa_id] = row.active;
            } else if (row.module_name === "reportes_excel") {
              mapReportExcel[row.empresa_id] = row.active;
            } else if (row.module_name === "reportes_ea") {
              mapReportEA[row.empresa_id] = row.active;
            } else if (row.module_name === "reportes_email") {
              mapReportEmail[row.empresa_id] = row.active;
            } else if (row.module_name === "qr_equipos") {
              mapQR[row.empresa_id] = row.active;
            } else if (row.module_name === "grupo_electrogeno") {
              mapGE[row.empresa_id] = row.active;
            } else if (row.module_name === "inventario") {
              mapInv[row.empresa_id] = row.active;
            } else if (row.module_name === "programacion") {
              mapProg[row.empresa_id] = row.active;
            } else if (row.module_name === "ordenes") {
              mapOrdenes[row.empresa_id] = row.active;
            } else if (row.module_name === "cotizaciones") {
              mapCot[row.empresa_id] = row.active;
            } else if (row.module_name === "portal_clientes") {
              mapPortal[row.empresa_id] = row.active;
            } else if (row.module_name === "mantencion_bms") {
              mapMantBMS[row.empresa_id] = row.active;
            } else if (row.module_name === "operacion_bms") {
              mapOpBMS[row.empresa_id] = row.active;
            } else if (row.module_name === "tickets") {
              mapTickets[row.empresa_id] = row.active;
            }
          }
        }
        setEmpresaModules(map);
        setEmpresaModulesReportExcel(mapReportExcel);
        setEmpresaModulesReportEA(mapReportEA);
        setEmpresaModulesReportEmail(mapReportEmail);
        setEmpresaModulesQR(mapQR);
        setEmpresaModulesGE(mapGE);
        setEmpresaModulesInv(mapInv);
        setEmpresaModulesProg(mapProg);
        setEmpresaModulesOrdenes(mapOrdenes);
        setEmpresaModulesCot(mapCot);
        setEmpresaModulesPortal(mapPortal);
        setEmpresaModulesMantBMS(mapMantBMS);
        setEmpresaModulesOpBMS(mapOpBMS);
        setEmpresaModulesTickets(mapTickets);
      }
    } catch {
      // silently fail
    }
  }, [token]);

  useEffect(() => {
    fetchEmpresas();
    fetchUserCounts();
    fetchEmpresaModules();
  }, [fetchEmpresas, fetchUserCounts, fetchEmpresaModules]);

  const openCreateDialog = () => {
    setEditingEmpresa(null);
    setForm(defaultEmpresa);
    setModules(defaultModules);
    setShowDialog(true);
  };

  const openEditDialog = (emp: Empresa) => {
    setEditingEmpresa(emp);
    setForm({
      nombre: emp.nombre,
      logo_url: emp.logo_url || "",
      color_primario: emp.color_primario || "#2563eb",
      color_secundario: emp.color_secundario || "#0f172a",
      rut: emp.rut || "",
      direccion: emp.direccion || "",
      telefono: emp.telefono || "",
      email: emp.email || "",
      activa: emp.activa,
    });
    setModules({
      ordenes: empresaModulesOrdenes[emp.id] ?? true,
      checklists: empresaModules[emp.id] ?? false,
      mantencion_bms: empresaModulesMantBMS[emp.id] ?? false,
      operacion_bms: empresaModulesOpBMS[emp.id] ?? false,
      qr_equipos: empresaModulesQR[emp.id] ?? false,
      inventario: empresaModulesInv[emp.id] ?? false,
      programacion: empresaModulesProg[emp.id] ?? false,
      cotizaciones: empresaModulesCot[emp.id] ?? false,
      reportes_excel: empresaModulesReportExcel[emp.id] ?? false,
      reportes_ea: empresaModulesReportEA[emp.id] ?? false,
      reportes_email: empresaModulesReportEmail[emp.id] ?? false,
      grupo_electrogeno: empresaModulesGE[emp.id] ?? false,
      portal_clientes: empresaModulesPortal[emp.id] ?? false,
      tickets: empresaModulesTickets[emp.id] ?? false,
    });
    setShowDialog(true);
  };

  const handleLogoUpload = async (file: File) => {
    setUploading(true);
    try {
      const fileName = `logo_${Date.now()}_${Math.random().toString(36).slice(2)}.${file.name.split(".").pop()}`;
      const res = await fetch(
        `${SUPABASE_URL}/storage/v1/object/logos_empresa/${fileName}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": file.type,
          },
          body: file,
        }
      );

      if (!res.ok) {
        toast({
          title: "Error",
          description: "No se pudo subir el logo. Verifica que el bucket 'logos_empresa' exista en Supabase Storage.",
          variant: "destructive",
        });
        return;
      }

      const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/logos_empresa/${fileName}`;
      setForm((f) => ({ ...f, logo_url: publicUrl }));
      toast({ title: "Logo subido correctamente" });
    } catch {
      toast({
        title: "Error",
        description: "Error de conexión al subir logo",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!form.nombre.trim()) {
      toast({
        title: "Campo requerido",
        description: "El nombre de la empresa es obligatorio",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);

    try {
      const body = {
        nombre: form.nombre.trim(),
        logo_url: form.logo_url || null,
        color_primario: form.color_primario,
        color_secundario: form.color_secundario,
        rut: form.rut || null,
        direccion: form.direccion || null,
        telefono: form.telefono || null,
        email: form.email || null,
        activa: form.activa,
      };

      let url = `${SUPABASE_URL}/rest/v1/empresas`;
      let method = "POST";

      if (editingEmpresa) {
        url += `?id=eq.${editingEmpresa.id}`;
        method = "PATCH";
      }

      const res = await fetch(url, {
        method,
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Prefer: "return=representation",
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errText = await res.text();
        let errorMsg = "No se pudo guardar la empresa";
        try {
          const errJson = JSON.parse(errText);
          errorMsg = errJson.message || errJson.error || errorMsg;
        } catch {
          if (errText) errorMsg = errText;
        }
        toast({ title: "Error", description: errorMsg, variant: "destructive" });
        return;
      }

      // Get the empresa ID for module assignment
      let empresaId = editingEmpresa?.id;
      if (!empresaId) {
        // For new empresa, get the ID from response
        try {
          const resData = await res.json();
          empresaId = Array.isArray(resData) ? resData[0]?.id : resData?.id;
        } catch {
          // If we can't parse, try fetching by name
        }
      }

      // Save module assignments
      if (empresaId) {
        const moduleErrors: string[] = [];

        // Upsert directo sobre el constraint unico (empresa_id, module_name) usando
        // el token del usuario autenticado + anon key. La tabla company_modules
        // tiene una politica RLS que permite escritura a superadmin, asi que no
        // hace falta la service key (Supabase la bloquea desde el navegador).
        const upsertModule = async (moduleName: string, active: boolean) => {
          const res = await fetch(`${SUPABASE_URL}/rest/v1/company_modules?on_conflict=empresa_id,module_name`, {
            method: "POST",
            headers: {
              apikey: SUPABASE_KEY,
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
              Prefer: "resolution=merge-duplicates,return=representation",
            },
            body: JSON.stringify({
              empresa_id: empresaId,
              module_name: moduleName,
              active: active === true,
            }),
          });

          if (!res.ok) {
            const errText = await res.text();
            let errorMsg = errText;
            try {
              const errJson = JSON.parse(errText);
              errorMsg = errJson.message || errJson.error || errText;
            } catch {
              // dejar el texto crudo si no es JSON
            }
            moduleErrors.push(`${moduleName}: ${errorMsg}`);
          }
        };

        // Save all modules sequentially for better error handling
        await upsertModule("ordenes", modules.ordenes);
        await upsertModule("checklists", modules.checklists);
        await upsertModule("mantencion_bms", modules.mantencion_bms);
        await upsertModule("operacion_bms", modules.operacion_bms);
        await upsertModule("qr_equipos", modules.qr_equipos);
        await upsertModule("inventario", modules.inventario);
        await upsertModule("programacion", modules.programacion);
        await upsertModule("cotizaciones", modules.cotizaciones);
        await upsertModule("reportes_excel", modules.reportes_excel);
        await upsertModule("reportes_ea", modules.reportes_ea);
        await upsertModule("reportes_email", modules.reportes_email);
        await upsertModule("grupo_electrogeno", modules.grupo_electrogeno);
        await upsertModule("portal_clientes", modules.portal_clientes);
        await upsertModule("tickets", modules.tickets);

        if (moduleErrors.length > 0) {
          toast({
            title: "Error al guardar módulos",
            description: moduleErrors.join(" | "),
            variant: "destructive",
          });
          fetchEmpresas();
          fetchUserCounts();
          fetchEmpresaModules();
          return;
        }
      }

      toast({
        title: editingEmpresa ? "Empresa actualizada" : "Empresa creada",
        description: `${form.nombre} se ha ${editingEmpresa ? "actualizado" : "creado"} correctamente`,
      });

      setShowDialog(false);
      fetchEmpresas();
      fetchUserCounts();
      fetchEmpresaModules();
    } catch {
      toast({
        title: "Error",
        description: "Error de conexión",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (emp: Empresa) => {
    const count = userCounts[emp.id] || 0;
    if (count > 0) {
      toast({
        title: "No se puede eliminar",
        description: `La empresa "${emp.nombre}" tiene ${count} usuario(s) asociado(s). Elimine o reasigne los usuarios primero.`,
        variant: "destructive",
      });
      return;
    }

    setDeleting(emp.id);

    try {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/empresas?id=eq.${emp.id}`,
        {
          method: "DELETE",
          headers: {
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!res.ok) {
        toast({
          title: "Error",
          description: "No se pudo eliminar la empresa",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Empresa eliminada",
        description: `${emp.nombre} ha sido eliminada`,
      });
      fetchEmpresas();
    } catch {
      toast({
        title: "Error",
        description: "Error de conexión",
        variant: "destructive",
      });
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Building2 className="w-5 h-5 text-slate-600" />
          <h2 className="text-lg font-bold text-slate-800">
            Gestión de Empresas
          </h2>
        </div>
        <Button
          onClick={openCreateDialog}
          className="gap-2 bg-blue-600 hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          Nueva Empresa
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="text-center py-3">
          <div className="flex flex-col items-center gap-1">
            <Building2 className="w-6 h-6 text-blue-500" />
            <p className="text-2xl font-bold text-slate-800">{empresas.length}</p>
            <p className="text-xs text-muted-foreground">Empresas</p>
          </div>
        </Card>
        <Card className="text-center py-3">
          <div className="flex flex-col items-center gap-1">
            <Building2 className="w-6 h-6 text-green-500" />
            <p className="text-2xl font-bold text-slate-800">
              {empresas.filter((e) => e.activa).length}
            </p>
            <p className="text-xs text-muted-foreground">Activas</p>
          </div>
        </Card>
      </div>

      {/* Empresa List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
        </div>
      ) : empresas.length === 0 ? (
        <Card className="p-8 text-center">
          <Building2 className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <p className="text-muted-foreground">No hay empresas registradas</p>
          <p className="text-xs text-muted-foreground mt-1">
            Crea la primera empresa para comenzar
          </p>
        </Card>
      ) : (
        <div className="space-y-2">
          {empresas.map((emp) => (
            <Card
              key={emp.id}
              className="p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  {/* Logo / Color swatch */}
                  {emp.logo_url ? (
                    <img
                      src={emp.logo_url}
                      alt={emp.nombre}
                      className="w-10 h-10 rounded object-contain bg-slate-50 border shrink-0"
                    />
                  ) : (
                    <div
                      className="w-10 h-10 rounded flex items-center justify-center shrink-0 text-white font-bold text-sm"
                      style={{ backgroundColor: emp.color_primario }}
                    >
                      {emp.nombre.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-slate-800 truncate">
                        {emp.nombre}
                      </p>
                      {!emp.activa && (
                        <Badge variant="outline" className="text-[10px] text-red-500 border-red-200">
                          Inactiva
                        </Badge>
                      )}
                      {empresaModules[emp.id] && (
                        <Badge variant="outline" className="text-[10px] text-blue-600 border-blue-200 bg-blue-50">
                          <ClipboardCheck className="w-3 h-3 mr-0.5" />
                          CL
                        </Badge>
                      )}
                      {empresaModulesMantBMS[emp.id] && (
                        <Badge variant="outline" className="text-[10px] text-sky-600 border-sky-200 bg-sky-50">
                          Mant
                        </Badge>
                      )}
                      {empresaModulesOpBMS[emp.id] && (
                        <Badge variant="outline" className="text-[10px] text-violet-600 border-violet-200 bg-violet-50">
                          Op
                        </Badge>
                      )}
                      {empresaModulesReportExcel[emp.id] && (
                        <Badge variant="outline" className="text-[10px] text-purple-600 border-purple-200 bg-purple-50">
                          RExcel
                        </Badge>
                      )}
                      {empresaModulesReportEA[emp.id] && (
                        <Badge variant="outline" className="text-[10px] text-fuchsia-600 border-fuchsia-200 bg-fuchsia-50">
                          REA
                        </Badge>
                      )}
                      {empresaModulesReportEmail[emp.id] && (
                        <Badge variant="outline" className="text-[10px] text-pink-600 border-pink-200 bg-pink-50">
                          REmail
                        </Badge>
                      )}
                      {empresaModulesQR[emp.id] && (
                        <Badge variant="outline" className="text-[10px] text-green-600 border-green-200 bg-green-50">
                          QR
                        </Badge>
                      )}
                      {empresaModulesGE[emp.id] && (
                        <Badge variant="outline" className="text-[10px] text-orange-600 border-orange-200 bg-orange-50">
                          GE
                        </Badge>
                      )}
                      {empresaModulesInv[emp.id] && (
                        <Badge variant="outline" className="text-[10px] text-teal-600 border-teal-200 bg-teal-50">
                          Inv
                        </Badge>
                      )}
                      {empresaModulesProg[emp.id] && (
                        <Badge variant="outline" className="text-[10px] text-indigo-600 border-indigo-200 bg-indigo-50">
                          Prog
                        </Badge>
                      )}
                      {empresaModulesPortal[emp.id] && (
                        <Badge variant="outline" className="text-[10px] text-cyan-600 border-cyan-200 bg-cyan-50">
                          Portal
                        </Badge>
                      )}
                      {empresaModulesTickets[emp.id] && (
                        <Badge variant="outline" className="text-[10px] text-rose-600 border-rose-200 bg-rose-50">
                          Tickets
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {emp.rut && <span>{emp.rut}</span>}
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {userCounts[emp.id] || 0} usuarios
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {/* Color preview */}
                  <div className="flex gap-0.5 mr-2">
                    <div
                      className="w-4 h-4 rounded-full border"
                      style={{ backgroundColor: emp.color_primario }}
                      title="Color primario"
                    />
                    <div
                      className="w-4 h-4 rounded-full border"
                      style={{ backgroundColor: emp.color_secundario }}
                      title="Color secundario"
                    />
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openEditDialog(emp)}
                    className="h-8 w-8 p-0 text-blue-500 hover:text-blue-700 hover:bg-blue-50"
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(emp)}
                    disabled={deleting === emp.id}
                    className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                  >
                    {deleting === emp.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5" />
              {editingEmpresa ? "Editar Empresa" : "Nueva Empresa"}
            </DialogTitle>
            <DialogDescription>
              {editingEmpresa
                ? "Modifica los datos de la empresa"
                : "Ingresa los datos de la nueva empresa"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Nombre de la empresa *</Label>
              <Input
                value={form.nombre}
                onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
                placeholder="Nombre de la empresa"
              />
            </div>

            <div className="space-y-1.5">
              <Label>RUT</Label>
              <Input
                value={form.rut || ""}
                onChange={(e) => setForm((f) => ({ ...f, rut: e.target.value }))}
                placeholder="12.345.678-9"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Teléfono</Label>
                <Input
                  value={form.telefono || ""}
                  onChange={(e) => setForm((f) => ({ ...f, telefono: e.target.value }))}
                  placeholder="+56 9 1234 5678"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={form.email || ""}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="empresa@email.com"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Dirección</Label>
              <Input
                value={form.direccion || ""}
                onChange={(e) => setForm((f) => ({ ...f, direccion: e.target.value }))}
                placeholder="Dirección de la empresa"
              />
            </div>

            {/* Logo Upload */}
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1">
                <Upload className="w-3.5 h-3.5" /> Logo
              </Label>
              <div className="flex items-center gap-3">
                {form.logo_url ? (
                  <img
                    src={form.logo_url}
                    alt="Logo"
                    className="w-12 h-12 rounded border object-contain bg-slate-50"
                  />
                ) : (
                  <div className="w-12 h-12 rounded border border-dashed border-slate-300 flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-slate-300" />
                  </div>
                )}
                <div className="flex flex-col gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="gap-1 text-xs"
                  >
                    {uploading ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Upload className="w-3 h-3" />
                    )}
                    {uploading ? "Subiendo..." : "Subir logo"}
                  </Button>
                  {form.logo_url && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setForm((f) => ({ ...f, logo_url: "" }))}
                      className="text-xs text-red-500 h-6 px-1"
                    >
                      Quitar logo
                    </Button>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleLogoUpload(file);
                    e.target.value = "";
                  }}
                />
              </div>
            </div>

            {/* Colors */}
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1">
                <Palette className="w-3.5 h-3.5" /> Colores de marca
              </Label>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">Primario (botones)</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={form.color_primario}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, color_primario: e.target.value }))
                      }
                      className="w-8 h-8 rounded cursor-pointer border-0"
                    />
                    <Input
                      value={form.color_primario}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, color_primario: e.target.value }))
                      }
                      className="h-8 text-xs font-mono"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">Secundario (header)</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={form.color_secundario}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, color_secundario: e.target.value }))
                      }
                      className="w-8 h-8 rounded cursor-pointer border-0"
                    />
                    <Input
                      value={form.color_secundario}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, color_secundario: e.target.value }))
                      }
                      className="h-8 text-xs font-mono"
                    />
                  </div>
                </div>
              </div>
              {/* Preview */}
              <div className="mt-2 rounded-lg overflow-hidden border">
                <div
                  className="h-8 flex items-center px-3"
                  style={{ backgroundColor: form.color_secundario }}
                >
                  <span className="text-white text-xs font-medium truncate">
                    {form.nombre || "Vista previa header"}
                  </span>
                </div>
                <div className="p-3 bg-slate-50 flex items-center gap-2">
                  <div
                    className="px-3 py-1 rounded text-white text-xs font-medium"
                    style={{ backgroundColor: form.color_primario }}
                  >
                    Botón ejemplo
                  </div>
                </div>
              </div>
            </div>

            {/* Modules */}
            <div className="space-y-2 border rounded-lg p-3 bg-slate-50">
              <Label className="flex items-center gap-1.5 text-sm font-semibold">
                <ClipboardCheck className="w-4 h-4 text-blue-600" />
                Módulos Contratados
              </Label>
              <p className="text-xs text-muted-foreground mb-2">
                Active o suspenda módulos según el contrato del cliente
              </p>
              <div className="flex items-center justify-between py-2 px-2 bg-white rounded border">
                <div>
                  <p className="text-sm font-medium">Órdenes de Trabajo</p>
                  <p className="text-xs text-muted-foreground">
                    Gestión completa de órdenes de trabajo y seguimiento
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className={`text-[10px] ${
                      modules.ordenes
                        ? "text-green-600 border-green-300 bg-green-50"
                        : "text-red-500 border-red-200 bg-red-50"
                    }`}
                  >
                    {modules.ordenes ? "Activo" : "Suspendido"}
                  </Badge>
                  <Switch
                    checked={modules.ordenes}
                    onCheckedChange={(v) => setModules((m) => ({ ...m, ordenes: v }))}
                  />
                </div>
              </div>
              <div className="flex items-center justify-between py-2 px-2 bg-white rounded border">
                <div>
                  <p className="text-sm font-medium">CheckList (Dashboard)</p>
                  <p className="text-xs text-muted-foreground">
                    Dashboard general de checklists y acceso al módulo
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className={`text-[10px] ${
                      modules.checklists
                        ? "text-green-600 border-green-300 bg-green-50"
                        : "text-red-500 border-red-200 bg-red-50"
                    }`}
                  >
                    {modules.checklists ? "Activo" : "Suspendido"}
                  </Badge>
                  <Switch
                    checked={modules.checklists}
                    onCheckedChange={(v) => setModules((m) => ({ ...m, checklists: v }))}
                  />
                </div>
              </div>
              <div className="flex items-center justify-between py-2 px-2 bg-white rounded border">
                <div>
                  <p className="text-sm font-medium">Mantenimiento BMS</p>
                  <p className="text-xs text-muted-foreground">
                    Checklist de mantenimiento preventivo para sistemas BMS
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className={`text-[10px] ${
                      modules.mantencion_bms
                        ? "text-green-600 border-green-300 bg-green-50"
                        : "text-red-500 border-red-200 bg-red-50"
                    }`}
                  >
                    {modules.mantencion_bms ? "Activo" : "Suspendido"}
                  </Badge>
                  <Switch
                    checked={modules.mantencion_bms}
                    onCheckedChange={(v) => setModules((m) => ({ ...m, mantencion_bms: v }))}
                  />
                </div>
              </div>
              <div className="flex items-center justify-between py-2 px-2 bg-white rounded border">
                <div>
                  <p className="text-sm font-medium">Operación BMS</p>
                  <p className="text-xs text-muted-foreground">
                    Rondas de operación BMS con 12 especialidades
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className={`text-[10px] ${
                      modules.operacion_bms
                        ? "text-green-600 border-green-300 bg-green-50"
                        : "text-red-500 border-red-200 bg-red-50"
                    }`}
                  >
                    {modules.operacion_bms ? "Activo" : "Suspendido"}
                  </Badge>
                  <Switch
                    checked={modules.operacion_bms}
                    onCheckedChange={(v) => setModules((m) => ({ ...m, operacion_bms: v }))}
                  />
                </div>
              </div>
              <div className="flex items-center justify-between py-2 px-2 bg-white rounded border">
                <div>
                  <p className="text-sm font-medium">Reportes Excel</p>
                  <p className="text-xs text-muted-foreground">
                    Exportación de datos a planillas Excel
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className={`text-[10px] ${
                      modules.reportes_excel
                        ? "text-green-600 border-green-300 bg-green-50"
                        : "text-red-500 border-red-200 bg-red-50"
                    }`}
                  >
                    {modules.reportes_excel ? "Activo" : "Suspendido"}
                  </Badge>
                  <Switch
                    checked={modules.reportes_excel}
                    onCheckedChange={(v) => setModules((m) => ({ ...m, reportes_excel: v }))}
                  />
                </div>
              </div>
              <div className="flex items-center justify-between py-2 px-2 bg-white rounded border">
                <div>
                  <p className="text-sm font-medium">Reportes EA</p>
                  <p className="text-xs text-muted-foreground">
                    Informes con inteligencia artificial para análisis de datos
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className={`text-[10px] ${
                      modules.reportes_ea
                        ? "text-green-600 border-green-300 bg-green-50"
                        : "text-red-500 border-red-200 bg-red-50"
                    }`}
                  >
                    {modules.reportes_ea ? "Activo" : "Suspendido"}
                  </Badge>
                  <Switch
                    checked={modules.reportes_ea}
                    onCheckedChange={(v) => setModules((m) => ({ ...m, reportes_ea: v }))}
                  />
                </div>
              </div>
              <div className="flex items-center justify-between py-2 px-2 bg-white rounded border">
                <div>
                  <p className="text-sm font-medium">Reportes Email</p>
                  <p className="text-xs text-muted-foreground">
                    Envío automático de reportes por correo electrónico
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className={`text-[10px] ${
                      modules.reportes_email
                        ? "text-green-600 border-green-300 bg-green-50"
                        : "text-red-500 border-red-200 bg-red-50"
                    }`}
                  >
                    {modules.reportes_email ? "Activo" : "Suspendido"}
                  </Badge>
                  <Switch
                    checked={modules.reportes_email}
                    onCheckedChange={(v) => setModules((m) => ({ ...m, reportes_email: v }))}
                  />
                </div>
              </div>
              <div className="flex items-center justify-between py-2 px-2 bg-white rounded border">
                <div>
                  <p className="text-sm font-medium">QR Equipos</p>
                  <p className="text-xs text-muted-foreground">
                    Catálogo de equipos con códigos QR para escaneo en terreno
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className={`text-[10px] ${
                      modules.qr_equipos
                        ? "text-green-600 border-green-300 bg-green-50"
                        : "text-red-500 border-red-200 bg-red-50"
                    }`}
                  >
                    {modules.qr_equipos ? "Activo" : "Suspendido"}
                  </Badge>
                  <Switch
                    checked={modules.qr_equipos}
                    onCheckedChange={(v) => setModules((m) => ({ ...m, qr_equipos: v }))}
                  />
                </div>
              </div>
              <div className="flex items-center justify-between py-2 px-2 bg-white rounded border">
                <div>
                  <p className="text-sm font-medium">Grupo Electrógeno</p>
                  <p className="text-xs text-muted-foreground">
                    Checklist de inspección y mantenimiento de grupos electrógenos
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className={`text-[10px] ${
                      modules.grupo_electrogeno
                        ? "text-green-600 border-green-300 bg-green-50"
                        : "text-red-500 border-red-200 bg-red-50"
                    }`}
                  >
                    {modules.grupo_electrogeno ? "Activo" : "Suspendido"}
                  </Badge>
                  <Switch
                    checked={modules.grupo_electrogeno}
                    onCheckedChange={(v) => setModules((m) => ({ ...m, grupo_electrogeno: v }))}
                  />
                </div>
              </div>
              <div className="flex items-center justify-between py-2 px-2 bg-white rounded border">
                <div>
                  <p className="text-sm font-medium">Inventario</p>
                  <p className="text-xs text-muted-foreground">
                    Catálogo de materiales, asignación a OTs y control de stock
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className={`text-[10px] ${
                      modules.inventario
                        ? "text-green-600 border-green-300 bg-green-50"
                        : "text-red-500 border-red-200 bg-red-50"
                    }`}
                  >
                    {modules.inventario ? "Activo" : "Suspendido"}
                  </Badge>
                  <Switch
                    checked={modules.inventario}
                    onCheckedChange={(v) => setModules((m) => ({ ...m, inventario: v }))}
                  />
                </div>
              </div>
              <div className="flex items-center justify-between py-2 px-2 bg-white rounded border">
                <div>
                  <p className="text-sm font-medium">Programación</p>
                  <p className="text-xs text-muted-foreground">
                    Programación de mantenciones con generación automática de OTs
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className={`text-[10px] ${
                      modules.programacion
                        ? "text-green-600 border-green-300 bg-green-50"
                        : "text-red-500 border-red-200 bg-red-50"
                    }`}
                  >
                    {modules.programacion ? "Activo" : "Suspendido"}
                  </Badge>
                  <Switch
                    checked={modules.programacion}
                    onCheckedChange={(v) => setModules((m) => ({ ...m, programacion: v }))}
                  />
                </div>
              </div>
              <div className="flex items-center justify-between py-2 px-2 bg-white rounded border">
                <div>
                  <p className="text-sm font-medium">Cotizaciones</p>
                  <p className="text-xs text-muted-foreground">
                    Generación de cotizaciones y presupuestos desde OTs
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className={`text-[10px] ${
                      modules.cotizaciones
                        ? "text-green-600 border-green-300 bg-green-50"
                        : "text-red-500 border-red-200 bg-red-50"
                    }`}
                  >
                    {modules.cotizaciones ? "Activo" : "Suspendido"}
                  </Badge>
                  <Switch
                    checked={modules.cotizaciones}
                    onCheckedChange={(v) => setModules((m) => ({ ...m, cotizaciones: v }))}
                  />
                </div>
              </div>
              <div className="flex items-center justify-between py-2 px-2 bg-white rounded border">
                <div>
                  <p className="text-sm font-medium">Portal de Clientes</p>
                  <p className="text-xs text-muted-foreground">
                    Acceso externo para clientes: consulta de OTs y checklists en tiempo real
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className={`text-[10px] ${
                      modules.portal_clientes
                        ? "text-green-600 border-green-300 bg-green-50"
                        : "text-red-500 border-red-200 bg-red-50"
                    }`}
                  >
                    {modules.portal_clientes ? "Activo" : "Suspendido"}
                  </Badge>
                  <Switch
                    checked={modules.portal_clientes}
                    onCheckedChange={(v) =>
                      setModules((m) => ({
                        ...m,
                        portal_clientes: v,
                        // Si se desactiva el Portal de Clientes, Tickets no puede
                        // quedar activo (depende de él) para evitar un estado inconsistente.
                        tickets: v ? m.tickets : false,
                      }))
                    }
                  />
                </div>
              </div>
              <div className="flex items-center justify-between py-2 px-2 bg-white rounded border">
                <div>
                  <p className="text-sm font-medium">Solicitudes de Clientes (Tickets)</p>
                  {modules.portal_clientes ? (
                    <p className="text-xs text-muted-foreground">
                      Los clientes reportan solicitudes desde su portal, que tu equipo asigna a técnicos por región
                    </p>
                  ) : (
                    <p className="text-xs text-amber-600">
                      Requiere activar primero el Portal de Clientes
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className={`text-[10px] ${
                      modules.tickets
                        ? "text-green-600 border-green-300 bg-green-50"
                        : "text-red-500 border-red-200 bg-red-50"
                    }`}
                  >
                    {modules.tickets ? "Activo" : "Suspendido"}
                  </Badge>
                  <Switch
                    checked={modules.tickets}
                    disabled={!modules.portal_clientes}
                    onCheckedChange={(v) => setModules((m) => ({ ...m, tickets: v }))}
                  />
                </div>
              </div>
            </div>

            {/* Active toggle */}
            <div className="flex items-center justify-between">
              <div>
                <Label>Empresa activa</Label>
                <p className="text-xs text-muted-foreground">
                  Las empresas inactivas no pueden acceder al sistema
                </p>
              </div>
              <Switch
                checked={form.activa}
                onCheckedChange={(v) => setForm((f) => ({ ...f, activa: v }))}
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setShowDialog(false)}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="gap-1 bg-blue-600 hover:bg-blue-700 text-white"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Building2 className="w-4 h-4" />
              )}
              {saving ? "Guardando..." : editingEmpresa ? "Guardar cambios" : "Crear Empresa"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}