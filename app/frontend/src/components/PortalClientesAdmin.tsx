import { useState, useEffect, useCallback } from "react";
import { SUPABASE_URL, SUPABASE_KEY } from "@/lib/supabase";
import type { Usuario } from "@/lib/types";
import { useEmpresa } from "@/lib/empresaContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogFooter,
  DialogHeader,
  DialogDescription,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Plus,
  Copy,
  Pencil,
  Trash2,
  Loader2,
  ExternalLink,
  Users,
  Link2,
  Search,
  Mail,
  Phone,
  Calendar,
  Shield,
  ShieldOff,
} from "lucide-react";

interface PortalClientesAdminProps {
  user: Usuario;
  token: string;
}

interface PortalCliente {
  id: string;
  empresa_id: string;
  nombre_cliente: string;
  email_cliente: string;
  telefono_cliente: string;
  token: string;
  activo: boolean;
  fecha_expiracion: string | null;
  notas: string;
  created_at: string;
  updated_at: string;
}

const emptyForm = {
  nombre_cliente: "",
  email_cliente: "",
  telefono_cliente: "",
  fecha_expiracion: "",
  notas: "",
  activo: true,
};

export default function PortalClientesAdmin({ user, token }: PortalClientesAdminProps) {
  const { empresa } = useEmpresa();
  const { toast } = useToast();
  const [clientes, setClientes] = useState<PortalCliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editing, setEditing] = useState<PortalCliente | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const fetchClientes = useCallback(async () => {
    if (!empresa) return;
    setLoading(true);
    try {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/portal_clientes?empresa_id=eq.${empresa.id}&order=nombre_cliente.asc`,
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
        setClientes(data || []);
      }
    } catch (err) {
      console.error("Error fetching portal clientes:", err);
    }
    setLoading(false);
  }, [empresa?.id, token]);

  useEffect(() => {
    fetchClientes();
  }, [fetchClientes]);

  const handleNew = () => {
    setEditing(null);
    setForm(emptyForm);
    setShowDialog(true);
  };

  const handleEdit = (cliente: PortalCliente) => {
    setEditing(cliente);
    setForm({
      nombre_cliente: cliente.nombre_cliente,
      email_cliente: cliente.email_cliente || "",
      telefono_cliente: cliente.telefono_cliente || "",
      fecha_expiracion: cliente.fecha_expiracion
        ? cliente.fecha_expiracion.split("T")[0]
        : "",
      notas: cliente.notas || "",
      activo: cliente.activo,
    });
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (!form.nombre_cliente.trim()) {
      toast({ title: "Error", description: "El nombre del cliente es obligatorio", variant: "destructive" });
      return;
    }
    if (!empresa) return;

    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        empresa_id: empresa.id,
        nombre_cliente: form.nombre_cliente.trim(),
        email_cliente: form.email_cliente.trim() || null,
        telefono_cliente: form.telefono_cliente.trim() || null,
        fecha_expiracion: form.fecha_expiracion || null,
        notas: form.notas.trim() || null,
        activo: form.activo,
        updated_at: new Date().toISOString(),
      };

      let res: Response;
      if (editing) {
        // Update
        res = await fetch(
          `${SUPABASE_URL}/rest/v1/portal_clientes?id=eq.${editing.id}`,
          {
            method: "PATCH",
            headers: {
              apikey: SUPABASE_KEY,
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
              Prefer: "return=minimal",
            },
            body: JSON.stringify(body),
          }
        );
      } else {
        // Insert (token se genera automáticamente por default en DB)
        res = await fetch(
          `${SUPABASE_URL}/rest/v1/portal_clientes`,
          {
            method: "POST",
            headers: {
              apikey: SUPABASE_KEY,
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
              Prefer: "return=representation",
            },
            body: JSON.stringify(body),
          }
        );
      }

      if (res.ok) {
        toast({
          title: editing ? "Acceso actualizado" : "Acceso creado",
          description: editing
            ? "Los datos del cliente se actualizaron correctamente"
            : "Se generó un nuevo enlace de portal para el cliente",
        });
        setShowDialog(false);
        fetchClientes();
      } else {
        const errData = await res.json().catch(() => null);
        toast({
          title: "Error",
          description: errData?.message || "No se pudo guardar",
          variant: "destructive",
        });
      }
    } catch {
      toast({ title: "Error", description: "Error de conexión", variant: "destructive" });
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar este acceso de portal? El cliente ya no podrá acceder.")) return;
    setDeleting(id);
    try {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/portal_clientes?id=eq.${id}`,
        {
          method: "DELETE",
          headers: {
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );
      if (res.ok) {
        toast({ title: "Eliminado", description: "Acceso de portal eliminado" });
        fetchClientes();
      }
    } catch {
      toast({ title: "Error", description: "No se pudo eliminar", variant: "destructive" });
    }
    setDeleting(null);
  };

  const handleToggleActive = async (cliente: PortalCliente) => {
    try {
      await fetch(
        `${SUPABASE_URL}/rest/v1/portal_clientes?id=eq.${cliente.id}`,
        {
          method: "PATCH",
          headers: {
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            Prefer: "return=minimal",
          },
          body: JSON.stringify({
            activo: !cliente.activo,
            updated_at: new Date().toISOString(),
          }),
        }
      );
      fetchClientes();
      toast({
        title: cliente.activo ? "Acceso desactivado" : "Acceso activado",
        description: cliente.activo
          ? "El cliente ya no puede acceder al portal"
          : "El cliente puede acceder nuevamente",
      });
    } catch {
      toast({ title: "Error", description: "No se pudo cambiar el estado", variant: "destructive" });
    }
  };

  const copyLink = (clienteToken: string) => {
    const baseUrl = window.location.origin;
    const link = `${baseUrl}/portal/${clienteToken}`;
    navigator.clipboard.writeText(link).then(() => {
      toast({ title: "Enlace copiado", description: "El enlace del portal se copió al portapapeles" });
    }).catch(() => {
      // Fallback
      const textarea = document.createElement("textarea");
      textarea.value = link;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      toast({ title: "Enlace copiado", description: "El enlace del portal se copió al portapapeles" });
    });
  };

  const filteredClientes = clientes.filter((c) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      c.nombre_cliente.toLowerCase().includes(term) ||
      c.email_cliente?.toLowerCase().includes(term) ||
      c.telefono_cliente?.toLowerCase().includes(term)
    );
  });

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-600" />
            Portal de Clientes
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Gestiona los accesos externos para que tus clientes vean el estado de sus trabajos
          </p>
        </div>
        <Button onClick={handleNew} className="gap-2">
          <Plus className="w-4 h-4" />
          Nuevo Acceso
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-2xl font-bold text-blue-600">{clientes.length}</p>
            <p className="text-xs text-gray-500">Total Clientes</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-2xl font-bold text-green-600">
              {clientes.filter((c) => c.activo).length}
            </p>
            <p className="text-xs text-gray-500">Activos</p>
          </CardContent>
        </Card>
        <Card className="col-span-2 sm:col-span-1">
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-2xl font-bold text-red-500">
              {clientes.filter((c) => !c.activo).length}
            </p>
            <p className="text-xs text-gray-500">Inactivos</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          placeholder="Buscar por nombre, email o teléfono..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Lista */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      ) : filteredClientes.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-center py-12">
            <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">
              {searchTerm ? "No se encontraron clientes" : "Aún no hay accesos de portal configurados"}
            </p>
            {!searchTerm && (
              <Button onClick={handleNew} variant="outline" className="mt-4 gap-2">
                <Plus className="w-4 h-4" />
                Crear primer acceso
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredClientes.map((cliente) => {
            const isExpired = cliente.fecha_expiracion && new Date(cliente.fecha_expiracion) < new Date();
            return (
              <Card key={cliente.id} className={!cliente.activo || isExpired ? "opacity-60" : ""}>
                <CardContent className="pt-4 pb-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-gray-800 truncate">{cliente.nombre_cliente}</h3>
                        {cliente.activo && !isExpired ? (
                          <Badge className="bg-green-100 text-green-700 hover:bg-green-100 text-[10px]">
                            <Shield className="w-3 h-3 mr-0.5" />
                            Activo
                          </Badge>
                        ) : isExpired ? (
                          <Badge className="bg-red-100 text-red-700 hover:bg-red-100 text-[10px]">
                            <Calendar className="w-3 h-3 mr-0.5" />
                            Expirado
                          </Badge>
                        ) : (
                          <Badge className="bg-gray-100 text-gray-600 hover:bg-gray-100 text-[10px]">
                            <ShieldOff className="w-3 h-3 mr-0.5" />
                            Inactivo
                          </Badge>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
                        {cliente.email_cliente && (
                          <span className="flex items-center gap-1">
                            <Mail className="w-3 h-3" />
                            {cliente.email_cliente}
                          </span>
                        )}
                        {cliente.telefono_cliente && (
                          <span className="flex items-center gap-1">
                            <Phone className="w-3 h-3" />
                            {cliente.telefono_cliente}
                          </span>
                        )}
                        {cliente.fecha_expiracion && (
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            Expira: {new Date(cliente.fecha_expiracion).toLocaleDateString("es-CL")}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyLink(cliente.token)}
                        className="gap-1 text-xs"
                        title="Copiar enlace del portal"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Copiar</span>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(`/portal/${cliente.token}`, "_blank")}
                        className="gap-1 text-xs"
                        title="Abrir portal"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleToggleActive(cliente)}
                        title={cliente.activo ? "Desactivar" : "Activar"}
                      >
                        {cliente.activo ? (
                          <ShieldOff className="w-3.5 h-3.5 text-red-500" />
                        ) : (
                          <Shield className="w-3.5 h-3.5 text-green-500" />
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(cliente)}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(cliente.id)}
                        disabled={deleting === cliente.id}
                      >
                        {deleting === cliente.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5 text-red-500" />
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* Link preview */}
                  <div className="mt-2 flex items-center gap-2 bg-gray-50 rounded px-3 py-1.5">
                    <Link2 className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                    <code className="text-[11px] text-gray-500 truncate flex-1">
                      {window.location.origin}/portal/{cliente.token}
                    </code>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Dialog crear/editar */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Editar Acceso de Portal" : "Nuevo Acceso de Portal"}
            </DialogTitle>
            <DialogDescription>
              {editing
                ? "Modifica los datos del acceso del cliente"
                : "Crea un enlace único para que tu cliente pueda ver el estado de sus trabajos"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="nombre_cliente">Nombre del Cliente *</Label>
              <Input
                id="nombre_cliente"
                value={form.nombre_cliente}
                onChange={(e) => setForm({ ...form, nombre_cliente: e.target.value })}
                placeholder="Ej: Empresa ABC Ltda."
                className="mt-1"
              />
              <p className="text-[11px] text-gray-400 mt-1">
                Debe coincidir con el campo "Cliente" de las OTs para que se muestren en el portal
              </p>
            </div>

            <div>
              <Label htmlFor="email_cliente">Email (opcional)</Label>
              <Input
                id="email_cliente"
                type="email"
                value={form.email_cliente}
                onChange={(e) => setForm({ ...form, email_cliente: e.target.value })}
                placeholder="cliente@empresa.cl"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="telefono_cliente">Teléfono (opcional)</Label>
              <Input
                id="telefono_cliente"
                value={form.telefono_cliente}
                onChange={(e) => setForm({ ...form, telefono_cliente: e.target.value })}
                placeholder="+56 9 1234 5678"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="fecha_expiracion">Fecha de Expiración (opcional)</Label>
              <Input
                id="fecha_expiracion"
                type="date"
                value={form.fecha_expiracion}
                onChange={(e) => setForm({ ...form, fecha_expiracion: e.target.value })}
                className="mt-1"
              />
              <p className="text-[11px] text-gray-400 mt-1">
                Si se deja vacío, el acceso no expira
              </p>
            </div>

            <div>
              <Label htmlFor="notas">Notas internas (opcional)</Label>
              <Textarea
                id="notas"
                value={form.notas}
                onChange={(e) => setForm({ ...form, notas: e.target.value })}
                placeholder="Notas internas sobre este cliente..."
                className="mt-1"
                rows={2}
              />
            </div>

            <div className="flex items-center gap-3">
              <Switch
                checked={form.activo}
                onCheckedChange={(checked) => setForm({ ...form, activo: checked })}
              />
              <Label>Acceso activo</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving} className="gap-2">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {editing ? "Guardar Cambios" : "Crear Acceso"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}