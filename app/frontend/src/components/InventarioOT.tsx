import { useState, useEffect, useCallback } from "react";
import type { Usuario } from "@/lib/types";
import { SUPABASE_URL, SUPABASE_KEY } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Package,
  Plus,
  Trash2,
  Loader2,
  BoxIcon,
  DollarSign,
} from "lucide-react";

interface InventarioItem {
  id: string;
  empresa_id: string;
  ot_id: string;
  nombre: string;
  descripcion: string;
  cantidad: number;
  unidad: string;
  costo_unitario: number;
  codigo_material: string;
  categoria: string;
  agregado_por: string;
  created_at: string;
}

interface InventarioOTProps {
  user: Usuario;
  token: string;
  otId: string;
  empresaId: string;
  readOnly?: boolean;
}

const UNIDADES = [
  "unidad",
  "metro",
  "litro",
  "kg",
  "rollo",
  "caja",
  "par",
  "set",
  "galón",
  "bolsa",
];

const CATEGORIAS = [
  { value: "repuesto", label: "Repuesto" },
  { value: "insumo", label: "Insumo" },
  { value: "material", label: "Material" },
  { value: "herramienta", label: "Herramienta" },
];

const categoriaColors: Record<string, string> = {
  repuesto: "bg-blue-100 text-blue-700",
  insumo: "bg-green-100 text-green-700",
  material: "bg-amber-100 text-amber-700",
  herramienta: "bg-purple-100 text-purple-700",
};

export default function InventarioOT({
  user,
  token,
  otId,
  empresaId,
  readOnly = false,
}: InventarioOTProps) {
  const { toast } = useToast();
  const [items, setItems] = useState<InventarioItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    nombre: "",
    descripcion: "",
    cantidad: "1",
    unidad: "unidad",
    costo_unitario: "0",
    codigo_material: "",
    categoria: "repuesto",
  });

  const serviceKey = import.meta.env.VITE_SUPABASE_SERVICE_KEY;

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const authKey = serviceKey || token;
      const apiKey = serviceKey || SUPABASE_KEY;
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/inventario_ot?ot_id=eq.${otId}&empresa_id=eq.${empresaId}&order=created_at.desc`,
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
        setItems(data || []);
      }
    } catch (err) {
      console.error("Error fetching inventario:", err);
    }
    setLoading(false);
  }, [otId, empresaId, token, serviceKey]);

  useEffect(() => {
    if (otId && empresaId) {
      fetchItems();
    }
  }, [otId, empresaId, fetchItems]);

  async function handleAdd() {
    if (!form.nombre.trim()) {
      toast({
        title: "Campo requerido",
        description: "El nombre del material es obligatorio",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const authKey = serviceKey || token;
      const apiKey = serviceKey || SUPABASE_KEY;
      const body = {
        empresa_id: empresaId,
        ot_id: otId,
        nombre: form.nombre.trim(),
        descripcion: form.descripcion.trim(),
        cantidad: parseFloat(form.cantidad) || 1,
        unidad: form.unidad,
        costo_unitario: parseFloat(form.costo_unitario) || 0,
        codigo_material: form.codigo_material.trim(),
        categoria: form.categoria,
        agregado_por: user.auth_id,
      };

      const res = await fetch(`${SUPABASE_URL}/rest/v1/inventario_ot`, {
        method: "POST",
        headers: {
          apikey: apiKey,
          Authorization: `Bearer ${authKey}`,
          "Content-Type": "application/json",
          Prefer: "return=representation",
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error("Error al agregar material");

      toast({
        title: "Material agregado",
        description: `${form.nombre} se ha registrado correctamente`,
      });

      setShowDialog(false);
      setForm({
        nombre: "",
        descripcion: "",
        cantidad: "1",
        unidad: "unidad",
        costo_unitario: "0",
        codigo_material: "",
        categoria: "repuesto",
      });
      fetchItems();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error al guardar";
      toast({ title: "Error", description: msg, variant: "destructive" });
    }
    setSaving(false);
  }

  async function handleDelete(item: InventarioItem) {
    if (!confirm(`¿Eliminar "${item.nombre}" del inventario?`)) return;

    try {
      const authKey = serviceKey || token;
      const apiKey = serviceKey || SUPABASE_KEY;
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/inventario_ot?id=eq.${item.id}`,
        {
          method: "DELETE",
          headers: {
            apikey: apiKey,
            Authorization: `Bearer ${authKey}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!res.ok) throw new Error("Error al eliminar");

      toast({ title: "Material eliminado", description: item.nombre });
      fetchItems();
    } catch {
      toast({
        title: "Error",
        description: "No se pudo eliminar",
        variant: "destructive",
      });
    }
  }

  const totalCosto = items.reduce(
    (sum, item) => sum + item.cantidad * item.costo_unitario,
    0
  );

  return (
    <Card className="border-t-2 border-t-indigo-200">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Package className="w-4 h-4 text-indigo-600" />
            Materiales / Insumos / Repuestos ({items.length})
          </CardTitle>
          {!readOnly && (
            <Button
              size="sm"
              onClick={() => setShowDialog(true)}
              className="gap-1 h-7 text-xs bg-indigo-600 hover:bg-indigo-700"
            >
              <Plus className="w-3.5 h-3.5" />
              Agregar
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {loading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="w-5 h-5 animate-spin text-indigo-500" />
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-4">
            <BoxIcon className="w-6 h-6 text-slate-300 mx-auto mb-1" />
            <p className="text-xs text-muted-foreground">
              No hay materiales registrados para esta OT
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between gap-2 border rounded-lg p-2 hover:bg-gray-50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-slate-800 truncate">
                      {item.nombre}
                    </span>
                    <Badge
                      className={`text-[10px] ${
                        categoriaColors[item.categoria] || "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {item.categoria}
                    </Badge>
                    {item.codigo_material && (
                      <Badge variant="outline" className="text-[10px]">
                        {item.codigo_material}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                    <span>
                      {item.cantidad} {item.unidad}
                    </span>
                    {item.costo_unitario > 0 && (
                      <span className="flex items-center gap-0.5">
                        <DollarSign className="w-3 h-3" />
                        {(item.cantidad * item.costo_unitario).toLocaleString(
                          "es-CL"
                        )}
                      </span>
                    )}
                    {item.descripcion && (
                      <span className="truncate max-w-[150px]">
                        {item.descripcion}
                      </span>
                    )}
                  </div>
                </div>
                {!readOnly && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(item)}
                    className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50 shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
            ))}

            {/* Total */}
            {totalCosto > 0 && (
              <div className="flex items-center justify-end gap-2 pt-2 border-t">
                <span className="text-xs font-medium text-slate-600">
                  Costo total:
                </span>
                <Badge className="bg-indigo-100 text-indigo-700 text-xs">
                  ${totalCosto.toLocaleString("es-CL")}
                </Badge>
              </div>
            )}
          </div>
        )}
      </CardContent>

      {/* ADD MATERIAL DIALOG */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="w-5 h-5 text-indigo-600" />
              Agregar Material / Insumo
            </DialogTitle>
            <DialogDescription>
              Registre un material, insumo o repuesto utilizado en esta OT
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label className="text-xs">Nombre del material *</Label>
              <Input
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                placeholder="Ej: Filtro de aire, Cable UTP, Fusible 10A..."
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Categoría</Label>
                <select
                  className="w-full border rounded px-3 py-2 text-sm"
                  value={form.categoria}
                  onChange={(e) =>
                    setForm({ ...form, categoria: e.target.value })
                  }
                >
                  {CATEGORIAS.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Código (opcional)</Label>
                <Input
                  value={form.codigo_material}
                  onChange={(e) =>
                    setForm({ ...form, codigo_material: e.target.value })
                  }
                  placeholder="SKU o código"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Cantidad</Label>
                <Input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={form.cantidad}
                  onChange={(e) =>
                    setForm({ ...form, cantidad: e.target.value })
                  }
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Unidad</Label>
                <select
                  className="w-full border rounded px-3 py-2 text-sm"
                  value={form.unidad}
                  onChange={(e) => setForm({ ...form, unidad: e.target.value })}
                >
                  {UNIDADES.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Costo unit. ($)</Label>
                <Input
                  type="number"
                  min="0"
                  step="1"
                  value={form.costo_unitario}
                  onChange={(e) =>
                    setForm({ ...form, costo_unitario: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Descripción (opcional)</Label>
              <Input
                value={form.descripcion}
                onChange={(e) =>
                  setForm({ ...form, descripcion: e.target.value })
                }
                placeholder="Detalle adicional del material..."
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
              onClick={handleAdd}
              disabled={saving}
              className="gap-1 bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              {saving ? "Guardando..." : "Agregar Material"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}