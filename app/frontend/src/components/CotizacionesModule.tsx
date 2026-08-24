import { useState, useEffect, useCallback } from "react";
import type { Usuario } from "@/lib/types";
import { SUPABASE_URL, SUPABASE_KEY, SUPABASE_SERVICE_KEY } from "@/lib/supabase";
import { useEmpresa } from "@/lib/empresaContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
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
import { useToast } from "@/hooks/use-toast";
import {
  FileText,
  Plus,
  Trash2,
  Loader2,
  Search,
  Edit,
  Send,
  CheckCircle2,
  XCircle,
  FileDown,
  Copy,
  DollarSign,
} from "lucide-react";
import { exportCotizacionPDF } from "@/lib/exportCotizacionPDF";

// ─── Types ───────────────────────────────────────────────────────────────────

interface CotizacionItem {
  id: string;
  tipo: "material" | "mano_obra" | "servicio" | "otro";
  descripcion: string;
  cantidad: number;
  unidad: string;
  precio_unitario: number;
  descuento_porcentaje: number;
}

interface Cotizacion {
  id: string;
  numero: string;
  empresa_id: string;
  ot_id?: string;
  ot_numero?: string;
  cliente_nombre: string;
  cliente_rut?: string;
  cliente_email?: string;
  cliente_telefono?: string;
  cliente_direccion?: string;
  titulo: string;
  descripcion?: string;
  items: CotizacionItem[];
  subtotal: number;
  descuento_global: number;
  iva: number;
  total: number;
  estado: "borrador" | "enviada" | "aprobada" | "rechazada";
  validez_dias: number;
  notas?: string;
  condiciones_pago?: string;
  created_by: string;
  created_at: string;
  updated_at?: string;
}

interface OTOption {
  id: string;
  numero: string;
  cliente: string;
  descripcion: string;
  direccion: string;
}

interface Props {
  user: Usuario;
  token: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function generateId(): string {
  return crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function calcularTotales(items: CotizacionItem[], descuentoGlobal: number) {
  const subtotal = items.reduce((sum, item) => {
    const lineTotal = item.cantidad * item.precio_unitario;
    const lineDiscount = lineTotal * (item.descuento_porcentaje / 100);
    return sum + (lineTotal - lineDiscount);
  }, 0);
  const descuento = subtotal * (descuentoGlobal / 100);
  const baseIva = subtotal - descuento;
  const iva = baseIva * 0.19;
  const total = baseIva + iva;
  return { subtotal, descuento, iva, total };
}

const estadoColors: Record<string, string> = {
  borrador: "bg-gray-500",
  enviada: "bg-blue-500",
  aprobada: "bg-green-500",
  rechazada: "bg-red-500",
};

const estadoLabels: Record<string, string> = {
  borrador: "Borrador",
  enviada: "Enviada",
  aprobada: "Aprobada",
  rechazada: "Rechazada",
};

function formatCLP(amount: number): string {
  return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", minimumFractionDigits: 0 }).format(Math.round(amount));
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch {
    return dateStr;
  }
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function CotizacionesModule({ user, token }: Props) {
  const { empresa } = useEmpresa();
  const { toast } = useToast();

  const [cotizaciones, setCotizaciones] = useState<Cotizacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("todos");

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState<string | null>(null);

  // Form fields
  const [formTitulo, setFormTitulo] = useState("");
  const [formDescripcion, setFormDescripcion] = useState("");
  const [formClienteNombre, setFormClienteNombre] = useState("");
  const [formClienteRut, setFormClienteRut] = useState("");
  const [formClienteEmail, setFormClienteEmail] = useState("");
  const [formClienteTelefono, setFormClienteTelefono] = useState("");
  const [formClienteDireccion, setFormClienteDireccion] = useState("");
  const [formOtId, setFormOtId] = useState("");
  const [formItems, setFormItems] = useState<CotizacionItem[]>([]);
  const [formDescuentoGlobal, setFormDescuentoGlobal] = useState(0);
  const [formValidezDias, setFormValidezDias] = useState(30);
  const [formNotas, setFormNotas] = useState("");
  const [formCondicionesPago, setFormCondicionesPago] = useState("50% anticipo, 50% contra entrega");

  // OT selector
  const [otOptions, setOtOptions] = useState<OTOption[]>([]);
  const [showOtSelector, setShowOtSelector] = useState(false);
  const [loadingOts, setLoadingOts] = useState(false);

  // Delete confirmation
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const authKey = SUPABASE_SERVICE_KEY || SUPABASE_KEY;

  // ─── Fetch cotizaciones ──────────────────────────────────────────────────
  const fetchCotizaciones = useCallback(async () => {
    if (!empresa) return;
    setLoading(true);
    try {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/cotizaciones?empresa_id=eq.${empresa.id}&order=created_at.desc`,
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
        setCotizaciones(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error("Error fetching cotizaciones:", err);
    } finally {
      setLoading(false);
    }
  }, [empresa, authKey]);

  useEffect(() => {
    fetchCotizaciones();
  }, [fetchCotizaciones]);

  // ─── Fetch OTs for selector ──────────────────────────────────────────────
  const fetchOTs = useCallback(async () => {
    if (!empresa) return;
    setLoadingOts(true);
    try {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/ordenes_trabajo?empresa_id=eq.${empresa.id}&select=id,numero,cliente,descripcion,direccion&order=fecha_inicio.desc&limit=50`,
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
        setOtOptions(Array.isArray(data) ? data : []);
      }
    } catch {
      // silent
    } finally {
      setLoadingOts(false);
    }
  }, [empresa, authKey]);

  // ─── Load materials from OT ──────────────────────────────────────────────
  const loadMaterialsFromOT = async (otId: string) => {
    try {
      // Get assignments
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/inventario_ot_asignacion?ot_id=eq.${otId}&empresa_id=eq.${empresa?.id}`,
        {
          headers: {
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${authKey}`,
            "Content-Type": "application/json",
          },
        }
      );
      if (!res.ok) return;
      const asignaciones = await res.json();
      if (!Array.isArray(asignaciones) || asignaciones.length === 0) {
        toast({ title: "Sin materiales", description: "Esta OT no tiene materiales asignados" });
        return;
      }

      // Get catalog info
      const itemIds = [...new Set(asignaciones.map((a: { catalogo_item_id: string }) => a.catalogo_item_id))];
      const catRes = await fetch(
        `${SUPABASE_URL}/rest/v1/catalogo_inventario?id=in.(${itemIds.map(id => `"${id}"`).join(",")})&select=id,nombre,unidad,costo_unitario,categoria`,
        {
          headers: {
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${authKey}`,
            "Content-Type": "application/json",
          },
        }
      );
      const catalogoMap: Record<string, { nombre: string; unidad: string; costo_unitario: number; categoria: string }> = {};
      if (catRes.ok) {
        const catData = await catRes.json();
        if (Array.isArray(catData)) {
          for (const item of catData) {
            catalogoMap[item.id] = item;
          }
        }
      }

      // Convert to cotizacion items
      const newItems: CotizacionItem[] = asignaciones.map((a: { catalogo_item_id: string; cantidad: number }) => {
        const cat = catalogoMap[a.catalogo_item_id];
        return {
          id: generateId(),
          tipo: "material" as const,
          descripcion: cat?.nombre || "Material",
          cantidad: a.cantidad || 1,
          unidad: cat?.unidad || "unidad",
          precio_unitario: cat?.costo_unitario || 0,
          descuento_porcentaje: 0,
        };
      });

      setFormItems(prev => [...prev, ...newItems]);
      toast({ title: "Materiales cargados", description: `${newItems.length} ítems importados desde la OT` });
    } catch {
      toast({ title: "Error", description: "No se pudieron cargar los materiales", variant: "destructive" });
    }
  };

  // ─── Generate next number ────────────────────────────────────────────────
  const getNextNumero = (): string => {
    const existing = cotizaciones.map(c => {
      const match = c.numero.match(/COT-(\d+)/);
      return match ? parseInt(match[1], 10) : 0;
    });
    const max = existing.length > 0 ? Math.max(...existing) : 0;
    return `COT-${String(max + 1).padStart(4, "0")}`;
  };

  // ─── Open form ───────────────────────────────────────────────────────────
  const openNewForm = () => {
    setEditingId(null);
    setFormTitulo("");
    setFormDescripcion("");
    setFormClienteNombre("");
    setFormClienteRut("");
    setFormClienteEmail("");
    setFormClienteTelefono("");
    setFormClienteDireccion("");
    setFormOtId("");
    setFormItems([]);
    setFormDescuentoGlobal(0);
    setFormValidezDias(30);
    setFormNotas("");
    setFormCondicionesPago("50% anticipo, 50% contra entrega");
    setShowForm(true);
  };

  const openEditForm = (cot: Cotizacion) => {
    setEditingId(cot.id);
    setFormTitulo(cot.titulo);
    setFormDescripcion(cot.descripcion || "");
    setFormClienteNombre(cot.cliente_nombre);
    setFormClienteRut(cot.cliente_rut || "");
    setFormClienteEmail(cot.cliente_email || "");
    setFormClienteTelefono(cot.cliente_telefono || "");
    setFormClienteDireccion(cot.cliente_direccion || "");
    setFormOtId(cot.ot_id || "");
    setFormItems(cot.items || []);
    setFormDescuentoGlobal(cot.descuento_global || 0);
    setFormValidezDias(cot.validez_dias || 30);
    setFormNotas(cot.notas || "");
    setFormCondicionesPago(cot.condiciones_pago || "");
    setShowForm(true);
  };

  // ─── Add item ────────────────────────────────────────────────────────────
  const addItem = () => {
    setFormItems(prev => [
      ...prev,
      {
        id: generateId(),
        tipo: "material",
        descripcion: "",
        cantidad: 1,
        unidad: "unidad",
        precio_unitario: 0,
        descuento_porcentaje: 0,
      },
    ]);
  };

  const updateItem = (id: string, field: keyof CotizacionItem, value: string | number) => {
    setFormItems(prev =>
      prev.map(item => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const removeItem = (id: string) => {
    setFormItems(prev => prev.filter(item => item.id !== id));
  };

  // ─── Save cotizacion ─────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!formTitulo.trim() || !formClienteNombre.trim()) {
      toast({ title: "Campos requeridos", description: "Título y nombre del cliente son obligatorios", variant: "destructive" });
      return;
    }
    if (formItems.length === 0) {
      toast({ title: "Sin ítems", description: "Agrega al menos un ítem a la cotización", variant: "destructive" });
      return;
    }

    setSaving(true);
    const { subtotal, iva, total } = calcularTotales(formItems, formDescuentoGlobal);

    const otOption = otOptions.find(o => o.id === formOtId);

    const body = {
      empresa_id: empresa?.id,
      titulo: formTitulo.trim(),
      descripcion: formDescripcion.trim() || null,
      cliente_nombre: formClienteNombre.trim(),
      cliente_rut: formClienteRut.trim() || null,
      cliente_email: formClienteEmail.trim() || null,
      cliente_telefono: formClienteTelefono.trim() || null,
      cliente_direccion: formClienteDireccion.trim() || null,
      ot_id: formOtId || null,
      ot_numero: otOption?.numero || null,
      items: formItems,
      subtotal,
      descuento_global: formDescuentoGlobal,
      iva,
      total,
      validez_dias: formValidezDias,
      notas: formNotas.trim() || null,
      condiciones_pago: formCondicionesPago.trim() || null,
      updated_at: new Date().toISOString(),
    };

    try {
      let res: Response;
      if (editingId) {
        res = await fetch(
          `${SUPABASE_URL}/rest/v1/cotizaciones?id=eq.${editingId}`,
          {
            method: "PATCH",
            headers: {
              apikey: SUPABASE_KEY,
              Authorization: `Bearer ${authKey}`,
              "Content-Type": "application/json",
              Prefer: "return=representation",
            },
            body: JSON.stringify(body),
          }
        );
      } else {
        res = await fetch(
          `${SUPABASE_URL}/rest/v1/cotizaciones`,
          {
            method: "POST",
            headers: {
              apikey: SUPABASE_KEY,
              Authorization: `Bearer ${authKey}`,
              "Content-Type": "application/json",
              Prefer: "return=representation",
            },
            body: JSON.stringify({
              ...body,
              numero: getNextNumero(),
              estado: "borrador",
              created_by: user.auth_id,
              created_at: new Date().toISOString(),
            }),
          }
        );
      }

      if (res.ok) {
        toast({ title: editingId ? "Cotización actualizada" : "Cotización creada", description: "Guardada correctamente" });
        setShowForm(false);
        fetchCotizaciones();
      } else {
        const errText = await res.text();
        toast({ title: "Error", description: errText || "No se pudo guardar", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Error de conexión", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  // ─── Change estado ───────────────────────────────────────────────────────
  const changeEstado = async (id: string, nuevoEstado: Cotizacion["estado"]) => {
    try {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/cotizaciones?id=eq.${id}`,
        {
          method: "PATCH",
          headers: {
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${authKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ estado: nuevoEstado, updated_at: new Date().toISOString() }),
        }
      );
      if (res.ok) {
        toast({ title: "Estado actualizado", description: `Cotización marcada como "${estadoLabels[nuevoEstado]}"` });
        fetchCotizaciones();
      }
    } catch {
      toast({ title: "Error", description: "No se pudo actualizar el estado", variant: "destructive" });
    }
  };

  // ─── Delete ──────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await fetch(
        `${SUPABASE_URL}/rest/v1/cotizaciones?id=eq.${deleteId}`,
        {
          method: "DELETE",
          headers: {
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${authKey}`,
          },
        }
      );
      toast({ title: "Eliminada", description: "Cotización eliminada correctamente" });
      setDeleteId(null);
      fetchCotizaciones();
    } catch {
      toast({ title: "Error", description: "No se pudo eliminar", variant: "destructive" });
    }
  };

  // ─── Export PDF ──────────────────────────────────────────────────────────
  const handleExportPDF = async (cot: Cotizacion) => {
    setExporting(cot.id);
    try {
      await exportCotizacionPDF(cot, empresa?.nombre || "VSApp", empresa?.logo_url);
      toast({ title: "PDF generado", description: `Cotización ${cot.numero} exportada` });
    } catch {
      toast({ title: "Error", description: "No se pudo generar el PDF", variant: "destructive" });
    } finally {
      setExporting(null);
    }
  };

  // ─── Duplicate ───────────────────────────────────────────────────────────
  const handleDuplicate = (cot: Cotizacion) => {
    setEditingId(null);
    setFormTitulo(cot.titulo + " (copia)");
    setFormDescripcion(cot.descripcion || "");
    setFormClienteNombre(cot.cliente_nombre);
    setFormClienteRut(cot.cliente_rut || "");
    setFormClienteEmail(cot.cliente_email || "");
    setFormClienteTelefono(cot.cliente_telefono || "");
    setFormClienteDireccion(cot.cliente_direccion || "");
    setFormOtId(cot.ot_id || "");
    setFormItems(cot.items.map(i => ({ ...i, id: generateId() })));
    setFormDescuentoGlobal(cot.descuento_global || 0);
    setFormValidezDias(cot.validez_dias || 30);
    setFormNotas(cot.notas || "");
    setFormCondicionesPago(cot.condiciones_pago || "");
    setShowForm(true);
  };

  // ─── Filter ──────────────────────────────────────────────────────────────
  const filtered = cotizaciones.filter(c => {
    if (filtroEstado !== "todos" && c.estado !== filtroEstado) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        c.numero.toLowerCase().includes(q) ||
        c.cliente_nombre.toLowerCase().includes(q) ||
        c.titulo.toLowerCase().includes(q) ||
        (c.ot_numero || "").toLowerCase().includes(q)
      );
    }
    return true;
  });

  // ─── Totals for form ─────────────────────────────────────────────────────
  const formTotales = calcularTotales(formItems, formDescuentoGlobal);

  // ─── Stats ───────────────────────────────────────────────────────────────
  const stats = {
    total: cotizaciones.length,
    borradores: cotizaciones.filter(c => c.estado === "borrador").length,
    enviadas: cotizaciones.filter(c => c.estado === "enviada").length,
    aprobadas: cotizaciones.filter(c => c.estado === "aprobada").length,
    montoAprobado: cotizaciones.filter(c => c.estado === "aprobada").reduce((s, c) => s + c.total, 0),
  };

  // ─── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <DollarSign className="w-6 h-6 text-emerald-600" />
          <h2 className="text-xl font-bold text-slate-800">Cotizaciones</h2>
        </div>
        <Button onClick={openNewForm} className="gap-2 bg-emerald-600 hover:bg-emerald-700">
          <Plus className="w-4 h-4" />
          Nueva Cotización
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card className="p-3">
          <p className="text-xs text-muted-foreground">Total</p>
          <p className="text-2xl font-bold">{stats.total}</p>
        </Card>
        <Card className="p-3">
          <p className="text-xs text-muted-foreground">Borradores</p>
          <p className="text-2xl font-bold text-gray-600">{stats.borradores}</p>
        </Card>
        <Card className="p-3">
          <p className="text-xs text-muted-foreground">Enviadas</p>
          <p className="text-2xl font-bold text-blue-600">{stats.enviadas}</p>
        </Card>
        <Card className="p-3">
          <p className="text-xs text-muted-foreground">Aprobadas</p>
          <p className="text-2xl font-bold text-green-600">{stats.aprobadas}</p>
        </Card>
        <Card className="p-3">
          <p className="text-xs text-muted-foreground">Monto Aprobado</p>
          <p className="text-lg font-bold text-emerald-600">{formatCLP(stats.montoAprobado)}</p>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por número, cliente, título..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filtroEstado} onValueChange={setFiltroEstado}>
          <SelectTrigger className="w-[150px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="borrador">Borrador</SelectItem>
            <SelectItem value="enviada">Enviada</SelectItem>
            <SelectItem value="aprobada">Aprobada</SelectItem>
            <SelectItem value="rechazada">Rechazada</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
        </div>
      ) : filtered.length === 0 ? (
        <Card className="p-8 text-center">
          <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">
            {cotizaciones.length === 0
              ? "No hay cotizaciones aún. Crea la primera."
              : "No se encontraron cotizaciones con ese filtro."}
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map(cot => (
            <Card key={cot.id} className="p-4 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono font-bold text-sm">{cot.numero}</span>
                    <Badge className={`${estadoColors[cot.estado]} text-white text-xs`}>
                      {estadoLabels[cot.estado]}
                    </Badge>
                    {cot.ot_numero && (
                      <Badge variant="outline" className="text-xs">
                        OT: {cot.ot_numero}
                      </Badge>
                    )}
                  </div>
                  <h3 className="font-semibold text-slate-800 mt-1 truncate">{cot.titulo}</h3>
                  <p className="text-sm text-muted-foreground">
                    Cliente: {cot.cliente_nombre} • {formatDate(cot.created_at)}
                  </p>
                  <p className="text-sm font-medium text-emerald-700 mt-1">
                    Total: {formatCLP(cot.total)} ({cot.items.length} ítems)
                  </p>
                </div>
                <div className="flex flex-col gap-1 shrink-0">
                  <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={() => openEditForm(cot)}>
                    <Edit className="w-3 h-3" /> Editar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1 text-xs"
                    onClick={() => handleExportPDF(cot)}
                    disabled={exporting === cot.id}
                  >
                    {exporting === cot.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileDown className="w-3 h-3" />}
                    PDF
                  </Button>
                  <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={() => handleDuplicate(cot)}>
                    <Copy className="w-3 h-3" /> Duplicar
                  </Button>
                  {cot.estado === "borrador" && (
                    <Button size="sm" variant="outline" className="gap-1 text-xs text-blue-600" onClick={() => changeEstado(cot.id, "enviada")}>
                      <Send className="w-3 h-3" /> Enviar
                    </Button>
                  )}
                  {cot.estado === "enviada" && (
                    <>
                      <Button size="sm" variant="outline" className="gap-1 text-xs text-green-600" onClick={() => changeEstado(cot.id, "aprobada")}>
                        <CheckCircle2 className="w-3 h-3" /> Aprobar
                      </Button>
                      <Button size="sm" variant="outline" className="gap-1 text-xs text-red-600" onClick={() => changeEstado(cot.id, "rechazada")}>
                        <XCircle className="w-3 h-3" /> Rechazar
                      </Button>
                    </>
                  )}
                  <Button size="sm" variant="ghost" className="gap-1 text-xs text-red-500" onClick={() => setDeleteId(cot.id)}>
                    <Trash2 className="w-3 h-3" /> Eliminar
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* ─── Form Dialog ──────────────────────────────────────────────────── */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar Cotización" : "Nueva Cotización"}</DialogTitle>
            <DialogDescription>
              Completa los datos del presupuesto. Puedes importar materiales desde una OT existente.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Client info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label>Título *</Label>
                <Input value={formTitulo} onChange={e => setFormTitulo(e.target.value)} placeholder="Ej: Mantención preventiva HVAC" />
              </div>
              <div>
                <Label>Cliente *</Label>
                <Input value={formClienteNombre} onChange={e => setFormClienteNombre(e.target.value)} placeholder="Nombre del cliente" />
              </div>
              <div>
                <Label>RUT</Label>
                <Input value={formClienteRut} onChange={e => setFormClienteRut(e.target.value)} placeholder="12.345.678-9" />
              </div>
              <div>
                <Label>Email</Label>
                <Input value={formClienteEmail} onChange={e => setFormClienteEmail(e.target.value)} placeholder="cliente@email.com" type="email" />
              </div>
              <div>
                <Label>Teléfono</Label>
                <Input value={formClienteTelefono} onChange={e => setFormClienteTelefono(e.target.value)} placeholder="+56 9 1234 5678" />
              </div>
              <div>
                <Label>Dirección</Label>
                <Input value={formClienteDireccion} onChange={e => setFormClienteDireccion(e.target.value)} placeholder="Dirección del cliente" />
              </div>
            </div>

            <div>
              <Label>Descripción</Label>
              <Textarea value={formDescripcion} onChange={e => setFormDescripcion(e.target.value)} placeholder="Descripción general del trabajo..." rows={2} />
            </div>

            {/* OT Link */}
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <Label>Vincular a OT (opcional)</Label>
                <Input
                  value={formOtId ? (otOptions.find(o => o.id === formOtId)?.numero || formOtId) : ""}
                  readOnly
                  placeholder="Sin OT vinculada"
                  className="bg-gray-50"
                />
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  fetchOTs();
                  setShowOtSelector(true);
                }}
              >
                Seleccionar OT
              </Button>
              {formOtId && (
                <Button type="button" variant="ghost" size="sm" onClick={() => setFormOtId("")}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
            </div>

            {/* Items */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">Ítems</Label>
                <div className="flex gap-2">
                  {formOtId && (
                    <Button type="button" variant="outline" size="sm" onClick={() => loadMaterialsFromOT(formOtId)}>
                      Importar materiales OT
                    </Button>
                  )}
                  <Button type="button" variant="outline" size="sm" onClick={addItem} className="gap-1">
                    <Plus className="w-3 h-3" /> Agregar ítem
                  </Button>
                </div>
              </div>

              {formItems.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Sin ítems. Agrega materiales, mano de obra o servicios.</p>
              ) : (
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {formItems.map((item, idx) => (
                    <div key={item.id} className="border rounded-lg p-3 space-y-2 bg-gray-50">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-muted-foreground w-6">{idx + 1}.</span>
                        <Select value={item.tipo} onValueChange={v => updateItem(item.id, "tipo", v)}>
                          <SelectTrigger className="w-[130px] h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="material">Material</SelectItem>
                            <SelectItem value="mano_obra">Mano de obra</SelectItem>
                            <SelectItem value="servicio">Servicio</SelectItem>
                            <SelectItem value="otro">Otro</SelectItem>
                          </SelectContent>
                        </Select>
                        <Input
                          value={item.descripcion}
                          onChange={e => updateItem(item.id, "descripcion", e.target.value)}
                          placeholder="Descripción"
                          className="flex-1 h-8 text-sm"
                        />
                        <Button type="button" variant="ghost" size="sm" onClick={() => removeItem(item.id)} className="text-red-500 h-8 w-8 p-0">
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                      <div className="flex items-center gap-2 pl-8">
                        <div className="flex items-center gap-1">
                          <Label className="text-xs whitespace-nowrap">Cant:</Label>
                          <Input
                            type="number"
                            min={0.01}
                            step={0.01}
                            value={item.cantidad}
                            onChange={e => updateItem(item.id, "cantidad", parseFloat(e.target.value) || 0)}
                            className="w-16 h-7 text-xs"
                          />
                        </div>
                        <div className="flex items-center gap-1">
                          <Label className="text-xs whitespace-nowrap">Unidad:</Label>
                          <Input
                            value={item.unidad}
                            onChange={e => updateItem(item.id, "unidad", e.target.value)}
                            className="w-20 h-7 text-xs"
                          />
                        </div>
                        <div className="flex items-center gap-1">
                          <Label className="text-xs whitespace-nowrap">P.Unit:</Label>
                          <Input
                            type="number"
                            min={0}
                            value={item.precio_unitario}
                            onChange={e => updateItem(item.id, "precio_unitario", parseFloat(e.target.value) || 0)}
                            className="w-24 h-7 text-xs"
                          />
                        </div>
                        <div className="flex items-center gap-1">
                          <Label className="text-xs whitespace-nowrap">Desc%:</Label>
                          <Input
                            type="number"
                            min={0}
                            max={100}
                            value={item.descuento_porcentaje}
                            onChange={e => updateItem(item.id, "descuento_porcentaje", parseFloat(e.target.value) || 0)}
                            className="w-16 h-7 text-xs"
                          />
                        </div>
                        <span className="text-xs font-medium text-emerald-700 whitespace-nowrap">
                          {formatCLP(item.cantidad * item.precio_unitario * (1 - item.descuento_porcentaje / 100))}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Totals */}
            <div className="border-t pt-3 space-y-2">
              <div className="flex items-center gap-3">
                <Label className="text-sm">Descuento global (%):</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={formDescuentoGlobal}
                  onChange={e => setFormDescuentoGlobal(parseFloat(e.target.value) || 0)}
                  className="w-20 h-8"
                />
              </div>
              <div className="bg-emerald-50 rounded-lg p-3 space-y-1">
                <div className="flex justify-between text-sm">
                  <span>Subtotal:</span>
                  <span>{formatCLP(formTotales.subtotal)}</span>
                </div>
                {formDescuentoGlobal > 0 && (
                  <div className="flex justify-between text-sm text-red-600">
                    <span>Descuento ({formDescuentoGlobal}%):</span>
                    <span>-{formatCLP(formTotales.descuento)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span>IVA (19%):</span>
                  <span>{formatCLP(formTotales.iva)}</span>
                </div>
                <div className="flex justify-between text-base font-bold text-emerald-700 border-t pt-1">
                  <span>Total:</span>
                  <span>{formatCLP(formTotales.total)}</span>
                </div>
              </div>
            </div>

            {/* Extra fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label>Validez (días)</Label>
                <Input type="number" min={1} value={formValidezDias} onChange={e => setFormValidezDias(parseInt(e.target.value) || 30)} />
              </div>
              <div>
                <Label>Condiciones de pago</Label>
                <Input value={formCondicionesPago} onChange={e => setFormCondicionesPago(e.target.value)} placeholder="Ej: 50% anticipo..." />
              </div>
            </div>
            <div>
              <Label>Notas adicionales</Label>
              <Textarea value={formNotas} onChange={e => setFormNotas(e.target.value)} placeholder="Observaciones, exclusiones, etc." rows={2} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving} className="gap-2 bg-emerald-600 hover:bg-emerald-700">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {editingId ? "Guardar cambios" : "Crear cotización"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── OT Selector Dialog ───────────────────────────────────────────── */}
      <Dialog open={showOtSelector} onOpenChange={setShowOtSelector}>
        <DialogContent className="max-w-lg max-h-[70vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Seleccionar Orden de Trabajo</DialogTitle>
            <DialogDescription>Vincula esta cotización a una OT existente para importar materiales.</DialogDescription>
          </DialogHeader>
          {loadingOts ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : otOptions.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">No hay OTs disponibles</p>
          ) : (
            <div className="space-y-2">
              {otOptions.map(ot => (
                <button
                  key={ot.id}
                  type="button"
                  className="w-full text-left p-3 border rounded-lg hover:bg-emerald-50 transition-colors"
                  onClick={() => {
                    setFormOtId(ot.id);
                    setFormClienteNombre(prev => prev || ot.cliente);
                    setFormClienteDireccion(prev => prev || ot.direccion);
                    setShowOtSelector(false);
                  }}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-sm">{ot.numero}</span>
                    <span className="text-sm text-muted-foreground">• {ot.cliente}</span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate mt-1">{ot.descripcion}</p>
                </button>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ─── Delete Confirmation ──────────────────────────────────────────── */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar eliminación</DialogTitle>
            <DialogDescription>¿Estás seguro de eliminar esta cotización? Esta acción no se puede deshacer.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDelete}>Eliminar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}