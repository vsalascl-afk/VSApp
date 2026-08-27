import { useState, useEffect, useCallback } from "react";
import type { Usuario } from "@/lib/types";
import { SUPABASE_URL, SUPABASE_KEY } from "@/lib/supabase";
import { REGIONES_TICKET, getRegionTicketLabel } from "@/lib/regiones";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogFooter,
  DialogHeader,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { HardHat, Loader2, Plus, Pencil, MapPin, Users } from "lucide-react";

interface ProyectosModuleProps {
  user: Usuario;
  token: string;
}

interface Proyecto {
  id: string;
  empresa_id: string;
  nombre: string;
  region: string | null;
  direccion: string | null;
  cliente_final_id: string | null;
  activo: boolean;
  creado_en: string;
}

interface ClienteFinalOption {
  id: string;
  nombre_cliente: string;
}

interface TecnicoOption {
  id: number | string;
  nombre: string;
}

interface ProyectoForm {
  nombre: string;
  region: string;
  direccion: string;
  cliente_final_id: string;
}

const defaultForm: ProyectoForm = {
  nombre: "",
  region: "",
  direccion: "",
  cliente_final_id: "",
};

export default function ProyectosModule({ user, token }: ProyectosModuleProps) {
  const [proyectos, setProyectos] = useState<Proyecto[]>([]);
  const [loading, setLoading] = useState(true);
  const [clientesFinales, setClientesFinales] = useState<ClienteFinalOption[]>([]);
  const [tecnicos, setTecnicos] = useState<TecnicoOption[]>([]);
  const [showDialog, setShowDialog] = useState(false);
  const [editingProyecto, setEditingProyecto] = useState<Proyecto | null>(null);
  const [form, setForm] = useState<ProyectoForm>(defaultForm);
  const [saving, setSaving] = useState(false);
  const [asignados, setAsignados] = useState<Set<string>>(new Set());
  const [savingAsignacion, setSavingAsignacion] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchProyectos = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/proyectos?empresa_id=eq.${user.empresa_id}&order=creado_en.desc&select=*`,
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
        setProyectos(Array.isArray(data) ? data : []);
      }
    } catch {
      toast({
        title: "Error",
        description: "No se pudieron cargar los proyectos",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [user.empresa_id, token, toast]);

  const fetchClientesFinales = useCallback(async () => {
    try {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/portal_clientes?empresa_id=eq.${user.empresa_id}&select=id,nombre_cliente&order=nombre_cliente.asc`,
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
        setClientesFinales(Array.isArray(data) ? data : []);
      }
    } catch {
      // silently fail
    }
  }, [user.empresa_id, token]);

  const fetchTecnicos = useCallback(async () => {
    try {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/usuarios?empresa_id=eq.${user.empresa_id}&rol=eq.tecnico&select=id,nombre&order=nombre.asc`,
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
        setTecnicos(Array.isArray(data) ? data : []);
      }
    } catch {
      // silently fail
    }
  }, [user.empresa_id, token]);

  useEffect(() => {
    fetchProyectos();
    fetchClientesFinales();
    fetchTecnicos();
  }, [fetchProyectos, fetchClientesFinales, fetchTecnicos]);

  const fetchAsignados = async (proyectoId: string) => {
    try {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/proyecto_tecnicos?proyecto_id=eq.${proyectoId}&select=usuario_id`,
        {
          headers: {
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );
      if (res.ok) {
        const data: Array<{ usuario_id: number | string }> = await res.json();
        setAsignados(new Set(data.map((d) => String(d.usuario_id))));
      }
    } catch {
      setAsignados(new Set());
    }
  };

  const openCreateDialog = () => {
    setEditingProyecto(null);
    setForm(defaultForm);
    setAsignados(new Set());
    setShowDialog(true);
  };

  const openEditDialog = async (p: Proyecto) => {
    setEditingProyecto(p);
    setForm({
      nombre: p.nombre,
      region: p.region || "",
      direccion: p.direccion || "",
      cliente_final_id: p.cliente_final_id || "",
    });
    setShowDialog(true);
    await fetchAsignados(p.id);
  };

  const toggleTecnico = async (usuarioId: number | string, checked: boolean) => {
    if (!editingProyecto) return;
    const key = String(usuarioId);
    setSavingAsignacion(key);
    try {
      if (checked) {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/proyecto_tecnicos`, {
          method: "POST",
          headers: {
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            Prefer: "return=minimal",
          },
          body: JSON.stringify({ proyecto_id: editingProyecto.id, usuario_id: usuarioId }),
        });
        if (!res.ok) {
          toast({ title: "Error", description: "No se pudo asignar el técnico", variant: "destructive" });
          return;
        }
        setAsignados((prev) => new Set(prev).add(key));
      } else {
        const res = await fetch(
          `${SUPABASE_URL}/rest/v1/proyecto_tecnicos?proyecto_id=eq.${editingProyecto.id}&usuario_id=eq.${usuarioId}`,
          {
            method: "DELETE",
            headers: {
              apikey: SUPABASE_KEY,
              Authorization: `Bearer ${token}`,
            },
          }
        );
        if (!res.ok) {
          toast({ title: "Error", description: "No se pudo quitar el técnico", variant: "destructive" });
          return;
        }
        setAsignados((prev) => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
      }
    } catch {
      toast({ title: "Error de conexión", description: "No se pudo actualizar la asignación", variant: "destructive" });
    } finally {
      setSavingAsignacion(null);
    }
  };

  const handleSave = async () => {
    if (!form.nombre.trim()) {
      toast({
        title: "Campo requerido",
        description: "El nombre del proyecto es obligatorio",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const body: Record<string, string | null> = {
        nombre: form.nombre.trim(),
        region: form.region || null,
        direccion: form.direccion.trim() || null,
        cliente_final_id: form.cliente_final_id || null,
      };

      let url = `${SUPABASE_URL}/rest/v1/proyectos`;
      let method = "POST";

      if (editingProyecto) {
        url += `?id=eq.${editingProyecto.id}`;
        method = "PATCH";
      } else {
        body.empresa_id = user.empresa_id;
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
        let errorMsg = "No se pudo guardar el proyecto";
        try {
          const errJson = JSON.parse(errText);
          errorMsg = errJson.message || errJson.error || errorMsg;
        } catch {
          if (errText) errorMsg = errText;
        }
        toast({ title: "Error", description: errorMsg, variant: "destructive" });
        return;
      }

      toast({
        title: editingProyecto ? "Proyecto actualizado" : "Proyecto creado",
        description: `${form.nombre} se ha ${editingProyecto ? "actualizado" : "creado"} correctamente`,
      });

      setShowDialog(false);
      fetchProyectos();
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

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <HardHat className="w-5 h-5 text-slate-600" />
          <h2 className="text-lg font-bold text-slate-800">Proyectos</h2>
        </div>
        <Button onClick={openCreateDialog} className="gap-2 bg-blue-600 hover:bg-blue-700">
          <Plus className="w-4 h-4" />
          Nuevo Proyecto
        </Button>
      </div>

      {/* Lista de proyectos */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
        </div>
      ) : proyectos.length === 0 ? (
        <Card className="p-8 text-center">
          <HardHat className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <p className="text-muted-foreground">No hay proyectos registrados</p>
          <p className="text-xs text-muted-foreground mt-1">
            Crea el primer proyecto para comenzar
          </p>
        </Card>
      ) : (
        <div className="space-y-2">
          {proyectos.map((p) => {
            const clienteFinal = clientesFinales.find((c) => c.id === p.cliente_final_id);
            return (
              <Card key={p.id} className="p-4 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-slate-800 truncate">{p.nombre}</p>
                      {!p.activo && (
                        <Badge variant="outline" className="text-[10px] text-red-500 border-red-200">
                          Inactivo
                        </Badge>
                      )}
                    </div>
                    {(p.region || p.direccion) && (
                      <p className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                        <MapPin className="w-3 h-3 shrink-0" />
                        {[getRegionTicketLabel(p.region), p.direccion].filter(Boolean).join(" — ")}
                      </p>
                    )}
                    {clienteFinal && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Cliente final: {clienteFinal.nombre_cliente}
                      </p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openEditDialog(p)}
                    className="h-8 w-8 p-0 text-blue-500 hover:text-blue-700 hover:bg-blue-50 shrink-0"
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <HardHat className="w-5 h-5" />
              {editingProyecto ? "Editar Proyecto" : "Nuevo Proyecto"}
            </DialogTitle>
            <DialogDescription>
              {editingProyecto
                ? "Modifica los datos del proyecto y los técnicos asignados"
                : "Ingresa los datos del nuevo proyecto"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Nombre del proyecto *</Label>
              <Input
                value={form.nombre}
                onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
                placeholder="Nombre del proyecto"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Región</Label>
              <Select value={form.region} onValueChange={(v) => setForm((f) => ({ ...f, region: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona una región" />
                </SelectTrigger>
                <SelectContent>
                  {REGIONES_TICKET.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Dirección</Label>
              <Input
                value={form.direccion}
                onChange={(e) => setForm((f) => ({ ...f, direccion: e.target.value }))}
                placeholder="Dirección del proyecto"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Cliente final (opcional)</Label>
              <Select
                value={form.cliente_final_id || "none"}
                onValueChange={(v) => setForm((f) => ({ ...f, cliente_final_id: v === "none" ? "" : v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sin cliente final" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin cliente final</SelectItem>
                  {clientesFinales.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nombre_cliente}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {editingProyecto && (
              <div className="space-y-1.5 border rounded-lg p-3 bg-slate-50">
                <Label className="flex items-center gap-1.5 text-sm font-semibold">
                  <Users className="w-4 h-4 text-blue-600" />
                  Técnicos asignados
                </Label>
                {tecnicos.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    No hay técnicos registrados en esta empresa
                  </p>
                ) : (
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {tecnicos.map((t) => {
                      const key = String(t.id);
                      const checked = asignados.has(key);
                      const isSaving = savingAsignacion === key;
                      return (
                        <label
                          key={key}
                          className="flex items-center gap-2 py-1.5 px-2 bg-white rounded border text-sm cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={isSaving}
                            onChange={(e) => toggleTecnico(t.id, e.target.checked)}
                            className="w-4 h-4 rounded border-gray-300"
                          />
                          <span className="flex-1">{t.nombre}</span>
                          {isSaving && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowDialog(false)} disabled={saving}>
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
                <HardHat className="w-4 h-4" />
              )}
              {saving ? "Guardando..." : editingProyecto ? "Guardar cambios" : "Crear Proyecto"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
