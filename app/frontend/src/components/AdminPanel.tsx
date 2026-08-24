import { useState, useEffect, useCallback } from "react";
import type { Usuario, Empresa } from "@/lib/types";
import { SUPABASE_URL, SUPABASE_KEY, supabaseAdmin } from "@/lib/supabase";
import { REGIONES, getRegionLabel } from "@/lib/regiones";
import { createClient } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Users,
  Loader2,
  UserPlus,
  Trash2,
  Shield,
  Wrench,
  Eye,
  Building2,
  Crown,
  KeyRound,
} from "lucide-react";

interface AdminPanelProps {
  user: Usuario;
  token: string;
}

const rolIcons: Record<string, React.ReactNode> = {
  superadmin: <Crown className="w-3.5 h-3.5" />,
  admin: <Shield className="w-3.5 h-3.5" />,
  tecnico: <Wrench className="w-3.5 h-3.5" />,
  supervisor: <Eye className="w-3.5 h-3.5" />,
};

const rolColors: Record<string, string> = {
  superadmin: "bg-rose-100 text-rose-700 border-rose-200",
  admin: "bg-purple-100 text-purple-700 border-purple-200",
  tecnico: "bg-blue-100 text-blue-700 border-blue-200",
  supervisor: "bg-amber-100 text-amber-700 border-amber-200",
};

const rolLabels: Record<string, string> = {
  superadmin: "Super Admin",
  admin: "Administrador",
  tecnico: "Técnico",
  supervisor: "Supervisor",
};

export default function AdminPanel({ user, token }: AdminPanelProps) {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [selectedEmpresaFilter, setSelectedEmpresaFilter] = useState<string>(
    user.rol === "superadmin" ? "todas" : user.empresa_id
  );

  // Password reset state
  const [resetPasswordUser, setResetPasswordUser] = useState<Usuario | null>(null);
  const [newPasswordValue, setNewPasswordValue] = useState("");
  const [resettingPassword, setResettingPassword] = useState(false);

  // Create form state
  const [newNombre, setNewNombre] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRol, setNewRol] = useState<"tecnico" | "supervisor" | "admin">("tecnico");
  const [newEmpresaId, setNewEmpresaId] = useState(user.empresa_id);
  const [newRegion, setNewRegion] = useState("santiago");

  const { toast } = useToast();
  const isSuperAdmin = user.rol === "superadmin";

  const fetchEmpresas = useCallback(async () => {
    if (!isSuperAdmin) return;
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
      // silently fail
    }
  }, [isSuperAdmin, token]);

  const fetchUsuarios = useCallback(async () => {
    setLoading(true);
    try {
      let url = `${SUPABASE_URL}/rest/v1/usuarios?order=nombre.asc`;
      if (!isSuperAdmin) {
        url += `&empresa_id=eq.${user.empresa_id}`;
      } else if (selectedEmpresaFilter !== "todas") {
        url += `&empresa_id=eq.${selectedEmpresaFilter}`;
      }

      // Use service_role key to bypass RLS (avoids infinite recursion in policies)
      const serviceKey = import.meta.env.VITE_SUPABASE_SERVICE_KEY;
      const res = await fetch(url, {
        headers: {
          apikey: serviceKey || SUPABASE_KEY,
          Authorization: `Bearer ${serviceKey || token}`,
          "Content-Type": "application/json",
        },
      });
      if (res.ok) {
        const data = await res.json();
        setUsuarios(data);
      } else {
        const errText = await res.text();
        console.error("Error fetching usuarios:", res.status, errText);
        // Fallback: try with regular token if service key failed
        if (serviceKey) {
          const fallbackRes = await fetch(url, {
            headers: {
              apikey: SUPABASE_KEY,
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          });
          if (fallbackRes.ok) {
            const data = await fallbackRes.json();
            setUsuarios(data);
          }
        }
      }
    } catch {
      toast({
        title: "Error",
        description: "No se pudieron cargar los usuarios",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [user.empresa_id, token, toast, isSuperAdmin, selectedEmpresaFilter]);

  useEffect(() => {
    fetchEmpresas();
  }, [fetchEmpresas]);

  useEffect(() => {
    fetchUsuarios();
  }, [fetchUsuarios]);

  const handleCreateUser = async () => {
    // Only superadmin can create users
    if (!isSuperAdmin) {
      toast({
        title: "Sin permisos",
        description: "Solo el Super Administrador puede crear usuarios",
        variant: "destructive",
      });
      return;
    }

    if (!newNombre.trim() || !newEmail.trim() || !newPassword.trim()) {
      toast({
        title: "Campos requeridos",
        description: "Nombre, email y contraseña son obligatorios",
        variant: "destructive",
      });
      return;
    }

    if (newPassword.length < 6) {
      toast({
        title: "Contraseña muy corta",
        description: "La contraseña debe tener al menos 6 caracteres",
        variant: "destructive",
      });
      return;
    }

    if (!newEmpresaId) {
      toast({
        title: "Empresa requerida",
        description: "Debe seleccionar una empresa para el usuario",
        variant: "destructive",
      });
      return;
    }

    setCreating(true);

    try {
      const tempClient = createClient(SUPABASE_URL, SUPABASE_KEY, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      });

      const { data: signUpData, error: signUpError } =
        await tempClient.auth.signUp({
          email: newEmail.trim(),
          password: newPassword,
        });

      if (signUpError) {
        let errorMsg = signUpError.message;
        if (errorMsg.includes("already registered")) {
          errorMsg = "Este email ya está registrado";
        }
        toast({
          title: "Error al crear usuario",
          description: errorMsg,
          variant: "destructive",
        });
        return;
      }

      if (!signUpData.user) {
        toast({
          title: "Error",
          description: "No se pudo crear el usuario de autenticación",
          variant: "destructive",
        });
        return;
      }

      // empresa_id may be bigint in DB - convert to number if it's numeric
      const empresaIdValue = /^\d+$/.test(newEmpresaId)
        ? parseInt(newEmpresaId, 10)
        : newEmpresaId;

      const usuarioBody: Record<string, unknown> = {
        auth_id: signUpData.user.id,
        nombre: newNombre.trim(),
        email: newEmail.trim(),
        rol: newRol,
        empresa_id: empresaIdValue,
        region: newRegion,
        debe_cambiar_password: true,
      };

      // Use service_role key to bypass RLS when inserting into usuarios table
      const serviceKey = import.meta.env.VITE_SUPABASE_SERVICE_KEY;
      const insertHeaders: Record<string, string> = {
        apikey: serviceKey || SUPABASE_KEY,
        Authorization: `Bearer ${serviceKey || token}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      };

      let res = await fetch(`${SUPABASE_URL}/rest/v1/usuarios`, {
        method: "POST",
        headers: insertHeaders,
        body: JSON.stringify(usuarioBody),
      });

      // If columns don't exist yet, retry without them
      if (!res.ok) {
        const errText = await res.text();
        if (errText.includes("debe_cambiar_password") || errText.includes("region")) {
          if (errText.includes("debe_cambiar_password")) delete usuarioBody.debe_cambiar_password;
          if (errText.includes("region")) delete usuarioBody.region;
          res = await fetch(`${SUPABASE_URL}/rest/v1/usuarios`, {
            method: "POST",
            headers: insertHeaders,
            body: JSON.stringify(usuarioBody),
          });
          // If still fails (other column), retry without both
          if (!res.ok) {
            delete usuarioBody.debe_cambiar_password;
            delete usuarioBody.region;
            res = await fetch(`${SUPABASE_URL}/rest/v1/usuarios`, {
              method: "POST",
              headers: insertHeaders,
              body: JSON.stringify(usuarioBody),
            });
          }
        }
      }

      if (!res.ok) {
        const errText = await res.text();
        let errorMsg = "No se pudo registrar el usuario en el sistema";
        try {
          const errJson = JSON.parse(errText);
          errorMsg = errJson.message || errJson.error || errorMsg;
        } catch {
          if (errText) errorMsg = errText;
        }
        // If RLS error and no service key, show helpful message
        if (
          (errText.includes("infinite recursion") ||
            errText.includes("policy") ||
            errText.includes("permission denied")) &&
          !serviceKey
        ) {
          errorMsg =
            "Error de permisos (RLS). Configure VITE_SUPABASE_SERVICE_KEY en Vercel con la Service Role Key de Supabase para resolver este problema.";
        }
        toast({
          title: "Error",
          description: errorMsg,
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Usuario creado",
        description: `${newNombre} ha sido registrado como ${rolLabels[newRol]}`,
      });

      setNewNombre("");
      setNewEmail("");
      setNewPassword("");
      setNewRol("tecnico");
      setNewEmpresaId(user.empresa_id);
      setShowCreateDialog(false);
      fetchUsuarios();
    } catch {
      toast({
        title: "Error",
        description: "Error de conexión al crear usuario",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteUser = async (targetUser: Usuario) => {
    if (targetUser.id === user.id) {
      toast({
        title: "Acción no permitida",
        description: "No puedes eliminar tu propia cuenta",
        variant: "destructive",
      });
      return;
    }

    if (targetUser.rol === "superadmin") {
      toast({
        title: "Acción no permitida",
        description: "No puedes eliminar a un Super Admin",
        variant: "destructive",
      });
      return;
    }

    if (!isSuperAdmin && targetUser.rol === "admin") {
      toast({
        title: "Acción no permitida",
        description: "No puedes eliminar a otro administrador",
        variant: "destructive",
      });
      return;
    }

    if (!supabaseAdmin) {
      toast({
        title: "No disponible",
        description:
          "Para eliminar usuarios, se requiere la Service Role Key configurada en VITE_SUPABASE_SERVICE_KEY.",
        variant: "destructive",
      });
      return;
    }

    const confirmDelete = window.confirm(
      `¿Estás seguro de que deseas eliminar a "${targetUser.nombre}" (${targetUser.email})? Esta acción no se puede deshacer.`
    );
    if (!confirmDelete) return;

    setDeleting(targetUser.id);

    try {
      // 1. Delete from usuarios table using service role (bypasses RLS)
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/usuarios?id=eq.${targetUser.id}`,
        {
          method: "DELETE",
          headers: {
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_SERVICE_KEY}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!res.ok) {
        const errText = await res.text();
        console.error("Error deleting from usuarios:", res.status, errText);
        toast({
          title: "Error",
          description: "No se pudo eliminar el usuario de la base de datos",
          variant: "destructive",
        });
        return;
      }

      // 2. Delete from Supabase Auth using admin client
      if (targetUser.auth_id) {
        const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(
          targetUser.auth_id
        );
        if (authError) {
          console.error("Error deleting auth user:", authError.message);
          // User was already removed from usuarios table, inform but don't block
          toast({
            title: "Advertencia",
            description: `Usuario eliminado de la base de datos, pero no se pudo eliminar de autenticación: ${authError.message}`,
          });
          fetchUsuarios();
          return;
        }
      }

      toast({
        title: "Usuario eliminado",
        description: `${targetUser.nombre} ha sido eliminado completamente del sistema`,
      });
      fetchUsuarios();
    } catch {
      toast({
        title: "Error",
        description: "Error de conexión al eliminar",
        variant: "destructive",
      });
    } finally {
      setDeleting(null);
    }
  };

  const handleChangeRegion = async (
    targetUser: Usuario,
    newRegionValue: string
  ) => {
    try {
      const serviceKey = import.meta.env.VITE_SUPABASE_SERVICE_KEY;
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/usuarios?id=eq.${targetUser.id}`,
        {
          method: "PATCH",
          headers: {
            apikey: serviceKey || SUPABASE_KEY,
            Authorization: `Bearer ${serviceKey || token}`,
            "Content-Type": "application/json",
            Prefer: "return=representation",
          },
          body: JSON.stringify({ region: newRegionValue }),
        }
      );

      if (!res.ok) {
        toast({
          title: "Error",
          description: "No se pudo cambiar la región",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Región actualizada",
        description: `${targetUser.nombre} ahora está asignado a ${getRegionLabel(newRegionValue)}`,
      });
      fetchUsuarios();
    } catch {
      toast({
        title: "Error",
        description: "Error de conexión",
        variant: "destructive",
      });
    }
  };

  const handleChangeRole = async (
    targetUser: Usuario,
    newRole: "tecnico" | "supervisor" | "admin"
  ) => {
    try {
      // Use service_role key to bypass RLS (avoids infinite recursion in policies)
      const serviceKey = import.meta.env.VITE_SUPABASE_SERVICE_KEY;
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/usuarios?id=eq.${targetUser.id}`,
        {
          method: "PATCH",
          headers: {
            apikey: serviceKey || SUPABASE_KEY,
            Authorization: `Bearer ${serviceKey || token}`,
            "Content-Type": "application/json",
            Prefer: "return=representation",
          },
          body: JSON.stringify({ rol: newRole }),
        }
      );

      if (!res.ok) {
        toast({
          title: "Error",
          description: "No se pudo cambiar el rol",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Rol actualizado",
        description: `${targetUser.nombre} ahora es ${rolLabels[newRole]}`,
      });
      fetchUsuarios();
    } catch {
      toast({
        title: "Error",
        description: "Error de conexión",
        variant: "destructive",
      });
    }
  };

  const handleResetPassword = async () => {
    if (!resetPasswordUser) return;

    if (!newPasswordValue || newPasswordValue.length < 6) {
      toast({
        title: "Contraseña inválida",
        description: "La nueva contraseña debe tener al menos 6 caracteres",
        variant: "destructive",
      });
      return;
    }

    if (!supabaseAdmin) {
      toast({
        title: "No disponible",
        description:
          "Para resetear contraseñas, configure la variable VITE_SUPABASE_SERVICE_KEY en el archivo .env con la Service Role Key de Supabase.",
        variant: "destructive",
      });
      return;
    }

    setResettingPassword(true);

    try {
      const { error } = await supabaseAdmin.auth.admin.updateUserById(
        resetPasswordUser.auth_id,
        { password: newPasswordValue }
      );

      if (error) {
        toast({
          title: "Error",
          description: error.message || "No se pudo resetear la contraseña",
          variant: "destructive",
        });
        return;
      }

      // Mark user as must change password on next login (skip for self-change)
      if (resetPasswordUser.id !== user.id) {
        const serviceKey = import.meta.env.VITE_SUPABASE_SERVICE_KEY;
        try {
          await fetch(
            `${SUPABASE_URL}/rest/v1/usuarios?id=eq.${resetPasswordUser.id}`,
            {
              method: "PATCH",
              headers: {
                apikey: serviceKey || SUPABASE_KEY,
                Authorization: `Bearer ${serviceKey || token}`,
                "Content-Type": "application/json",
                Prefer: "return=minimal",
              },
              body: JSON.stringify({ debe_cambiar_password: true }),
            }
          );
        } catch {
          // Column may not exist yet - skip silently
        }
      }

      toast({
        title: "Contraseña actualizada",
        description: resetPasswordUser.id === user.id
          ? "Tu contraseña ha sido cambiada exitosamente."
          : `La contraseña de ${resetPasswordUser.nombre} ha sido cambiada. El usuario deberá cambiarla en su próximo ingreso.`,
      });
      setResetPasswordUser(null);
      setNewPasswordValue("");
    } catch {
      toast({
        title: "Error",
        description: "Error de conexión al resetear la contraseña",
        variant: "destructive",
      });
    } finally {
      setResettingPassword(false);
    }
  };

  const getEmpresaName = (empresaId: string) => {
    if (!empresaId) return "—";
    const emp = empresas.find((e) => e.id === empresaId);
    return emp?.nombre || (typeof empresaId === "string" ? empresaId.slice(0, 8) : "—");
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-slate-600" />
          <h2 className="text-lg font-bold text-slate-800">
            Administración de Usuarios
          </h2>
        </div>
        {isSuperAdmin && (
          <Button
            onClick={() => setShowCreateDialog(true)}
            className="gap-2 bg-blue-600 hover:bg-blue-700"
          >
            <UserPlus className="w-4 h-4" />
            Nuevo Usuario
          </Button>
        )}
      </div>

      {/* Empresa filter for superadmin */}
      {isSuperAdmin && empresas.length > 0 && (
        <div className="flex items-center gap-2">
          <Building2 className="w-4 h-4 text-slate-500" />
          <span className="text-sm text-slate-600">Empresa:</span>
          <Select
            value={selectedEmpresaFilter}
            onValueChange={setSelectedEmpresaFilter}
          >
            <SelectTrigger className="w-[200px] h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas las empresas</SelectItem>
              {empresas.map((emp) => (
                <SelectItem key={emp.id} value={emp.id}>
                  {emp.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {(["admin", "tecnico", "supervisor"] as const).map((rol) => {
          const count = usuarios.filter((u) => u.rol === rol).length;
          return (
            <Card key={rol} className="text-center py-3">
              <div className="flex flex-col items-center gap-1">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center ${rolColors[rol]}`}
                >
                  {rolIcons[rol]}
                </div>
                <p className="text-2xl font-bold text-slate-800">{count}</p>
                <p className="text-xs text-muted-foreground">
                  {rolLabels[rol]}
                  {count !== 1 ? "es" : ""}
                </p>
              </div>
            </Card>
          );
        })}
        <Card className="text-center py-3">
          <div className="flex flex-col items-center gap-1">
            <div className="w-8 h-8 rounded-full flex items-center justify-center bg-slate-100 text-slate-600">
              <Users className="w-3.5 h-3.5" />
            </div>
            <p className="text-2xl font-bold text-slate-800">{usuarios.length}</p>
            <p className="text-xs text-muted-foreground">Total</p>
          </div>
        </Card>
      </div>

      {/* User List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
        </div>
      ) : usuarios.length === 0 ? (
        <Card className="p-8 text-center">
          <Users className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <p className="text-muted-foreground">No hay usuarios registrados</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {usuarios.map((u) => (
            <Card
              key={u.id}
              className="p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${rolColors[u.rol]}`}
                  >
                    {rolIcons[u.rol]}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-800 truncate">
                      {u.nombre}
                      {u.id === user.id && (
                        <span className="text-xs text-muted-foreground ml-1">
                          (tú)
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {u.email}
                    </p>
                    {isSuperAdmin && (
                      <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Building2 className="w-2.5 h-2.5" />
                        {getEmpresaName(u.empresa_id)}
                      </p>
                    )}
                    {u.region && !(isSuperAdmin || user.rol === "admin") && (
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        📍 {getRegionLabel(u.region)}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {u.rol === "superadmin" || (u.rol === "admin" && !isSuperAdmin) ? (
                    <Badge
                      variant="outline"
                      className={`${rolColors[u.rol]} text-xs`}
                    >
                      {rolLabels[u.rol]}
                    </Badge>
                  ) : (
                    <Select
                      value={u.rol}
                      onValueChange={(v) =>
                        handleChangeRole(
                          u,
                          v as "tecnico" | "supervisor" | "admin"
                        )
                      }
                      disabled={u.id === user.id}
                    >
                      <SelectTrigger className="w-[130px] h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="tecnico">Técnico</SelectItem>
                        <SelectItem value="supervisor">Supervisor</SelectItem>
                        <SelectItem value="admin">Administrador</SelectItem>
                      </SelectContent>
                    </Select>
                  )}

                  {(isSuperAdmin || user.rol === "admin") && u.rol !== "superadmin" && (
                    <Select
                      value={u.region || "santiago"}
                      onValueChange={(v) => handleChangeRegion(u, v)}
                    >
                      <SelectTrigger className="w-[140px] h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {REGIONES.map((r) => (
                          <SelectItem key={r.value} value={r.value}>
                            📍 {r.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}

                  {(isSuperAdmin || (user.rol === "admin" && u.id !== user.id && u.rol !== "superadmin")) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setResetPasswordUser(u);
                        setNewPasswordValue("");
                      }}
                      className="text-amber-500 hover:text-amber-700 hover:bg-amber-50 h-8 w-8 p-0"
                      title="Cambiar contraseña"
                    >
                      <KeyRound className="w-4 h-4" />
                    </Button>
                  )}

                  {u.id !== user.id && u.rol !== "superadmin" && (isSuperAdmin || u.rol !== "admin") && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteUser(u)}
                      disabled={deleting === u.id}
                      className="text-red-500 hover:text-red-700 hover:bg-red-50 h-8 w-8 p-0"
                    >
                      {deleting === u.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Reset Password Dialog */}
      <Dialog open={!!resetPasswordUser} onOpenChange={() => { setResetPasswordUser(null); setNewPasswordValue(""); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-amber-500" /> Cambiar Contraseña
            </DialogTitle>
            <DialogDescription>
              {resetPasswordUser?.id === user.id
                ? "Ingresa tu nueva contraseña"
                : <>Ingresa la nueva contraseña para <strong>{resetPasswordUser?.nombre}</strong> ({resetPasswordUser?.email})</>
              }
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="reset-password">Nueva contraseña *</Label>
              <Input
                id="reset-password"
                type="password"
                value={newPasswordValue}
                onChange={(e) => setNewPasswordValue(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                autoFocus
              />
            </div>
            {!supabaseAdmin && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-xs text-amber-700">
                  ⚠️ Para usar esta función, debe configurar la variable de entorno <code className="font-mono bg-amber-100 px-1 rounded">VITE_SUPABASE_SERVICE_KEY</code> con la Service Role Key de su proyecto Supabase.
                </p>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => { setResetPasswordUser(null); setNewPasswordValue(""); }}
              disabled={resettingPassword}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleResetPassword}
              disabled={resettingPassword || !supabaseAdmin}
              className="gap-1 bg-amber-600 hover:bg-amber-700 text-white"
            >
              {resettingPassword ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <KeyRound className="w-4 h-4" />
              )}
              {resettingPassword ? "Reseteando..." : "Resetear Contraseña"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create User Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5" /> Crear Nuevo Usuario
            </DialogTitle>
            <DialogDescription>
              Ingresa los datos del nuevo usuario. Se creará una cuenta con
              acceso a la aplicación.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="new-nombre">Nombre completo *</Label>
              <Input
                id="new-nombre"
                value={newNombre}
                onChange={(e) => setNewNombre(e.target.value)}
                placeholder="Nombre y apellido"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="new-email">Email *</Label>
              <Input
                id="new-email"
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="usuario@empresa.com"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="new-password">Contraseña *</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
              />
            </div>

            {/* Empresa selector for superadmin */}
            {isSuperAdmin && empresas.length > 0 && (
              <div className="space-y-1.5">
                <Label>Empresa *</Label>
                <Select
                  value={newEmpresaId}
                  onValueChange={setNewEmpresaId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar empresa" />
                  </SelectTrigger>
                  <SelectContent>
                    {empresas.map((emp) => (
                      <SelectItem key={emp.id} value={emp.id}>
                        <div className="flex items-center gap-2">
                          <Building2 className="w-3.5 h-3.5" />
                          {emp.nombre}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Región *</Label>
              <Select
                value={newRegion}
                onValueChange={setNewRegion}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar región" />
                </SelectTrigger>
                <SelectContent>
                  {REGIONES.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Determina qué checklists y OTs puede ver el usuario.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label>Rol</Label>
              <Select
                value={newRol}
                onValueChange={(v) =>
                  setNewRol(v as "tecnico" | "supervisor" | "admin")
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tecnico">
                    <div className="flex items-center gap-2">
                      <Wrench className="w-3.5 h-3.5" />
                      Técnico
                    </div>
                  </SelectItem>
                  <SelectItem value="supervisor">
                    <div className="flex items-center gap-2">
                      <Eye className="w-3.5 h-3.5" />
                      Supervisor
                    </div>
                  </SelectItem>
                  {isSuperAdmin && (
                    <SelectItem value="admin">
                      <div className="flex items-center gap-2">
                        <Shield className="w-3.5 h-3.5" />
                        Administrador
                      </div>
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Los técnicos gestionan OTs. Los supervisores supervisan. Los administradores gestionan usuarios de su empresa.
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setShowCreateDialog(false)}
              disabled={creating}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleCreateUser}
              disabled={creating}
              className="gap-1 bg-blue-600 hover:bg-blue-700 text-white"
            >
              {creating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <UserPlus className="w-4 h-4" />
              )}
              {creating ? "Creando..." : "Crear Usuario"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}