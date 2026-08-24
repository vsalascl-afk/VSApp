import { useState, useEffect, useCallback, useRef } from "react";
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
  Package,
  Plus,
  Trash2,
  Loader2,
  Search,
  Download,
  Upload,
  Edit,
  Link2,
  X,
  ShoppingCart,
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileText,
} from "lucide-react";
import * as XLSX from "xlsx";

// ─── Types ───────────────────────────────────────────────────────────────────

interface CatalogoItem {
  id: string;
  empresa_id: string;
  nombre: string;
  descripcion: string;
  unidad: string;
  costo_unitario: number;
  codigo_material: string;
  categoria: string;
  stock_actual: number;
  stock_minimo: number;
  ubicacion: string;
  proveedor: string;
  created_at: string;
}

interface AsignacionOT {
  id: string;
  catalogo_item_id: string;
  ot_id: string;
  cantidad: number;
  notas: string;
  asignado_por: string;
  created_at: string;
  ot_numero?: string;
}

interface OTOption {
  id: string;
  numero: string;
  descripcion: string;
  estado: string;
}

interface OrdenCompra {
  id: string;
  numero: string;
  estado: "pendiente" | "aprobada" | "enviada" | "recibida" | "cancelada";
  proveedor: string;
  items: OCItem[];
  notas: string;
  created_at: string;
  created_by: string;
  total_estimado: number;
}

interface OCItem {
  catalogo_item_id: string;
  nombre: string;
  codigo_material: string;
  cantidad_solicitada: number;
  unidad: string;
  costo_unitario: number;
  stock_actual: number;
  stock_minimo: number;
}

interface InventarioModuleProps {
  user: Usuario;
  token: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

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

const OC_ESTADO_COLORS: Record<string, string> = {
  pendiente: "bg-amber-100 text-amber-700 border-amber-200",
  aprobada: "bg-blue-100 text-blue-700 border-blue-200",
  enviada: "bg-indigo-100 text-indigo-700 border-indigo-200",
  recibida: "bg-green-100 text-green-700 border-green-200",
  cancelada: "bg-red-100 text-red-700 border-red-200",
};

const OC_ESTADO_LABELS: Record<string, string> = {
  pendiente: "Pendiente",
  aprobada: "Aprobada",
  enviada: "Enviada a Proveedor",
  recibida: "Recibida",
  cancelada: "Cancelada",
};

type TabView = "catalogo" | "ordenes_compra";

// ─── Component ───────────────────────────────────────────────────────────────

export default function InventarioModule({ user, token }: InventarioModuleProps) {
  const { toast } = useToast();
  const { empresa } = useEmpresa();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // License check
  const [moduleActive, setModuleActive] = useState<boolean | null>(null);
  const [licenseLoading, setLicenseLoading] = useState(true);

  const isPrivileged = user.rol === "superadmin" || user.rol === "admin";

  useEffect(() => {
    checkLicense();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresa?.id]);

  async function checkLicense() {
    if (!empresa) {
      setModuleActive(isPrivileged);
      setLicenseLoading(false);
      return;
    }
    try {
      const authKey = SUPABASE_SERVICE_KEY || token;
      const apiKey = SUPABASE_SERVICE_KEY || SUPABASE_KEY;
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/company_modules?empresa_id=eq.${empresa.id}&module_name=eq.inventario`,
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
          setModuleActive(isPrivileged);
        }
      } else {
        setModuleActive(isPrivileged);
      }
    } catch (err) {
      console.error("Inventario Module license check error:", err);
      setModuleActive(isPrivileged);
    }
    setLicenseLoading(false);
  }

  // Tab view
  const [activeTab, setActiveTab] = useState<TabView>("catalogo");

  // State
  const [items, setItems] = useState<CatalogoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState("todos");

  // Dialog: crear/editar item
  const [showItemDialog, setShowItemDialog] = useState(false);
  const [editingItem, setEditingItem] = useState<CatalogoItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    nombre: "",
    descripcion: "",
    unidad: "unidad",
    costo_unitario: "0",
    codigo_material: "",
    categoria: "repuesto",
    stock_actual: "0",
    stock_minimo: "0",
    ubicacion: "",
    proveedor: "",
  });

  // Dialog: asignar a OT
  const [showAsignarDialog, setShowAsignarDialog] = useState(false);
  const [asignarItem, setAsignarItem] = useState<CatalogoItem | null>(null);
  const [asignarForm, setAsignarForm] = useState({ ot_id: "", cantidad: "1", notas: "" });
  const [ots, setOts] = useState<OTOption[]>([]);
  const [loadingOTs, setLoadingOTs] = useState(false);
  const [savingAsignacion, setSavingAsignacion] = useState(false);

  // Dialog: ver asignaciones de un item
  const [showAsignacionesDialog, setShowAsignacionesDialog] = useState(false);
  const [asignaciones, setAsignaciones] = useState<AsignacionOT[]>([]);
  const [loadingAsignaciones, setLoadingAsignaciones] = useState(false);
  const [asignacionesItem, setAsignacionesItem] = useState<CatalogoItem | null>(null);

  // Órdenes de Compra state
  const [ordenesCompra, setOrdenesCompra] = useState<OrdenCompra[]>([]);
  const [showOCDialog, setShowOCDialog] = useState(false);
  const [ocNotas, setOcNotas] = useState("");
  const [ocProveedor, setOcProveedor] = useState("");
  const [ocItemsSeleccionados, setOcItemsSeleccionados] = useState<OCItem[]>([]);
  const [savingOC, setSavingOC] = useState(false);
  const [showOCDetailDialog, setShowOCDetailDialog] = useState(false);
  const [selectedOC, setSelectedOC] = useState<OrdenCompra | null>(null);

  const serviceKey = import.meta.env.VITE_SUPABASE_SERVICE_KEY;

  // ─── Fetch catálogo ──────────────────────────────────────────────────────

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/catalogo_inventario?empresa_id=eq.${user.empresa_id}&order=nombre.asc`,
        {
          headers: {
            apikey: serviceKey || SUPABASE_KEY,
            Authorization: `Bearer ${serviceKey || token}`,
            "Content-Type": "application/json",
          },
        }
      );
      if (res.ok) {
        const data = await res.json();
        setItems(Array.isArray(data) ? data : []);
      } else {
        const errText = await res.text();
        const isTableMissing = errText.includes("relation") && errText.includes("does not exist") || res.status === 404;
        if (isTableMissing) {
          toast({
            title: "Tabla no encontrada",
            description: "Debe ejecutar la migración MIGRATE_INVENTARIO_INDEPENDIENTE.sql en Supabase para habilitar el módulo de Inventario.",
            variant: "destructive",
          });
        } else {
          toast({ title: "Error", description: "No se pudo cargar el inventario", variant: "destructive" });
        }
      }
    } catch {
      toast({ title: "Error", description: "No se pudo cargar el inventario", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [user.empresa_id, token, serviceKey, toast]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  // ─── Órdenes de Compra: load from localStorage ──────────────────────────

  const loadOrdenesCompra = useCallback(() => {
    try {
      const stored = localStorage.getItem(`ordenes_compra_${user.empresa_id}`);
      if (stored) {
        setOrdenesCompra(JSON.parse(stored));
      }
    } catch {
      // ignore
    }
  }, [user.empresa_id]);

  useEffect(() => {
    loadOrdenesCompra();
  }, [loadOrdenesCompra]);

  function saveOrdenesCompra(ocs: OrdenCompra[]) {
    setOrdenesCompra(ocs);
    localStorage.setItem(`ordenes_compra_${user.empresa_id}`, JSON.stringify(ocs));
  }

  // ─── CRUD Item ───────────────────────────────────────────────────────────

  const openCreateDialog = () => {
    setEditingItem(null);
    setForm({
      nombre: "",
      descripcion: "",
      unidad: "unidad",
      costo_unitario: "0",
      codigo_material: "",
      categoria: "repuesto",
      stock_actual: "0",
      stock_minimo: "0",
      ubicacion: "",
      proveedor: "",
    });
    setShowItemDialog(true);
  };

  const openEditDialog = (item: CatalogoItem) => {
    setEditingItem(item);
    setForm({
      nombre: item.nombre,
      descripcion: item.descripcion || "",
      unidad: item.unidad,
      costo_unitario: String(item.costo_unitario || 0),
      codigo_material: item.codigo_material || "",
      categoria: item.categoria,
      stock_actual: String(item.stock_actual || 0),
      stock_minimo: String(item.stock_minimo || 0),
      ubicacion: item.ubicacion || "",
      proveedor: item.proveedor || "",
    });
    setShowItemDialog(true);
  };

  const handleSaveItem = async () => {
    if (!form.nombre.trim()) {
      toast({ title: "Error", description: "El nombre es obligatorio", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const body = {
        empresa_id: user.empresa_id,
        nombre: form.nombre.trim(),
        descripcion: form.descripcion.trim(),
        unidad: form.unidad,
        costo_unitario: parseFloat(form.costo_unitario) || 0,
        codigo_material: form.codigo_material.trim(),
        categoria: form.categoria,
        stock_actual: parseInt(form.stock_actual) || 0,
        stock_minimo: parseInt(form.stock_minimo) || 0,
        ubicacion: form.ubicacion.trim(),
        proveedor: form.proveedor.trim(),
      };

      const url = editingItem
        ? `${SUPABASE_URL}/rest/v1/catalogo_inventario?id=eq.${editingItem.id}`
        : `${SUPABASE_URL}/rest/v1/catalogo_inventario`;

      const res = await fetch(url, {
        method: editingItem ? "PATCH" : "POST",
        headers: {
          apikey: serviceKey || SUPABASE_KEY,
          Authorization: `Bearer ${serviceKey || token}`,
          "Content-Type": "application/json",
          Prefer: "return=representation",
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.text();
        toast({ title: "Error", description: err || "No se pudo guardar", variant: "destructive" });
        return;
      }

      toast({ title: editingItem ? "Actualizado" : "Creado", description: `${form.nombre} guardado correctamente` });
      setShowItemDialog(false);
      fetchItems();
    } catch {
      toast({ title: "Error", description: "Error de conexión", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteItem = async (item: CatalogoItem) => {
    if (!window.confirm(`¿Eliminar "${item.nombre}" del catálogo?`)) return;
    try {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/catalogo_inventario?id=eq.${item.id}`,
        {
          method: "DELETE",
          headers: {
            apikey: serviceKey || SUPABASE_KEY,
            Authorization: `Bearer ${serviceKey || token}`,
          },
        }
      );
      if (res.ok) {
        toast({ title: "Eliminado", description: `${item.nombre} eliminado del catálogo` });
        fetchItems();
      } else {
        toast({ title: "Error", description: "No se pudo eliminar", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Error de conexión", variant: "destructive" });
    }
  };

  // ─── Asignar a OT ───────────────────────────────────────────────────────

  const openAsignarDialog = async (item: CatalogoItem) => {
    setAsignarItem(item);
    setAsignarForm({ ot_id: "", cantidad: "1", notas: "" });
    setShowAsignarDialog(true);
    setLoadingOTs(true);
    try {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/ordenes_trabajo?empresa_id=eq.${user.empresa_id}&estado=neq.completada&select=id,numero,descripcion,estado&order=fecha_inicio.desc&limit=50`,
        {
          headers: {
            apikey: serviceKey || SUPABASE_KEY,
            Authorization: `Bearer ${serviceKey || token}`,
            "Content-Type": "application/json",
          },
        }
      );
      if (res.ok) {
        const data = await res.json();
        setOts(Array.isArray(data) ? data : []);
      }
    } catch {
      // ignore
    } finally {
      setLoadingOTs(false);
    }
  };

  const handleAsignar = async () => {
    if (!asignarForm.ot_id || !asignarItem) {
      toast({ title: "Error", description: "Seleccione una OT", variant: "destructive" });
      return;
    }
    // Validar que la OT seleccionada no esté completada
    const selectedOT = ots.find(o => o.id === asignarForm.ot_id);
    if (selectedOT && selectedOT.estado === "completada") {
      toast({ title: "OT completada", description: "No se pueden agregar materiales a una OT ya completada", variant: "destructive" });
      return;
    }
    const cantidad = parseInt(asignarForm.cantidad) || 1;
    if (cantidad <= 0) {
      toast({ title: "Error", description: "La cantidad debe ser mayor a 0", variant: "destructive" });
      return;
    }
    if (cantidad > (asignarItem.stock_actual || 0)) {
      toast({ title: "Stock insuficiente", description: `Solo hay ${asignarItem.stock_actual} unidades disponibles`, variant: "destructive" });
      return;
    }
    setSavingAsignacion(true);
    try {
      const body: Record<string, unknown> = {
        empresa_id: user.empresa_id,
        catalogo_item_id: asignarItem.id,
        ot_id: String(asignarForm.ot_id),
        cantidad,
        notas: asignarForm.notas.trim() || "",
        asignado_por: user.nombre || user.auth_id || "sistema",
      };

      const res = await fetch(`${SUPABASE_URL}/rest/v1/inventario_ot_asignacion`, {
        method: "POST",
        headers: {
          apikey: serviceKey || SUPABASE_KEY,
          Authorization: `Bearer ${serviceKey || token}`,
          "Content-Type": "application/json",
          Prefer: "return=representation",
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.text();
        const isTableMissing =
          (err.includes("relation") && err.includes("does not exist")) ||
          err.includes("could not find") ||
          res.status === 404;

        const isForeignKey =
          err.includes("foreign key") ||
          err.includes("violates foreign key") ||
          err.includes("is not present in table");

        const isColumnMissing =
          err.includes("column") && err.includes("does not exist");

        if (isTableMissing) {
          toast({
            title: "Tabla no encontrada",
            description: "Debe ejecutar la migración MIGRATE_INVENTARIO_INDEPENDIENTE.sql en el SQL Editor de Supabase.",
            variant: "destructive",
          });
        } else if (isForeignKey) {
          toast({
            title: "Error de referencia",
            description: "El ítem del catálogo o la OT seleccionada no existe en la base de datos.",
            variant: "destructive",
          });
        } else if (isColumnMissing) {
          toast({
            title: "Columna faltante",
            description: "La tabla inventario_ot_asignacion no tiene todas las columnas requeridas. Ejecute la migración nuevamente.",
            variant: "destructive",
          });
        } else {
          let msg = "No se pudo asignar material a la OT";
          try {
            const parsed = JSON.parse(err);
            msg = parsed.message || parsed.msg || parsed.details || parsed.hint || msg;
          } catch {
            if (err) msg = err.slice(0, 300);
          }
          toast({ title: "Error al asignar", description: msg, variant: "destructive" });
        }
        return;
      }

      // Descontar stock
      const newStock = Math.max(0, (asignarItem.stock_actual || 0) - cantidad);
      await fetch(
        `${SUPABASE_URL}/rest/v1/catalogo_inventario?id=eq.${asignarItem.id}`,
        {
          method: "PATCH",
          headers: {
            apikey: serviceKey || SUPABASE_KEY,
            Authorization: `Bearer ${serviceKey || token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ stock_actual: newStock }),
        }
      );

      toast({ title: "Asignado", description: `${asignarItem.nombre} asignado a la OT` });
      setShowAsignarDialog(false);
      fetchItems();
    } catch {
      toast({ title: "Error", description: "Error de conexión", variant: "destructive" });
    } finally {
      setSavingAsignacion(false);
    }
  };

  // ─── Ver asignaciones ────────────────────────────────────────────────────

  const openAsignacionesDialog = async (item: CatalogoItem) => {
    setAsignacionesItem(item);
    setShowAsignacionesDialog(true);
    setLoadingAsignaciones(true);
    try {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/inventario_ot_asignacion?catalogo_item_id=eq.${item.id}&order=created_at.desc`,
        {
          headers: {
            apikey: serviceKey || SUPABASE_KEY,
            Authorization: `Bearer ${serviceKey || token}`,
            "Content-Type": "application/json",
          },
        }
      );
      if (res.ok) {
        const data = await res.json();
        const asignacionesData: AsignacionOT[] = Array.isArray(data) ? data : [];
        const otIds = [...new Set(asignacionesData.map((a) => a.ot_id))];
        if (otIds.length > 0) {
          const otsRes = await fetch(
            `${SUPABASE_URL}/rest/v1/ordenes_trabajo?id=in.(${otIds.join(",")})&select=id,numero`,
            {
              headers: {
                apikey: serviceKey || SUPABASE_KEY,
                Authorization: `Bearer ${serviceKey || token}`,
                "Content-Type": "application/json",
              },
            }
          );
          if (otsRes.ok) {
            const otsData = await otsRes.json();
            const otMap: Record<string, string> = {};
            for (const ot of otsData) {
              otMap[ot.id] = ot.numero;
            }
            for (const a of asignacionesData) {
              a.ot_numero = otMap[a.ot_id] || a.ot_id.slice(0, 8);
            }
          }
        }
        setAsignaciones(asignacionesData);
      } else {
        toast({ title: "Error", description: "No se pudieron cargar las asignaciones", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "No se pudieron cargar las asignaciones", variant: "destructive" });
    } finally {
      setLoadingAsignaciones(false);
    }
  };

  // ─── Órdenes de Compra ──────────────────────────────────────────────────

  function openCrearOCDialog() {
    // Pre-select items with stock below minimum
    const itemsBajoStock = items.filter((i) => i.stock_actual <= i.stock_minimo && i.stock_minimo > 0);
    const ocItems: OCItem[] = itemsBajoStock.map((i) => ({
      catalogo_item_id: i.id,
      nombre: i.nombre,
      codigo_material: i.codigo_material,
      cantidad_solicitada: Math.max(1, (i.stock_minimo * 2) - i.stock_actual),
      unidad: i.unidad,
      costo_unitario: i.costo_unitario,
      stock_actual: i.stock_actual,
      stock_minimo: i.stock_minimo,
    }));
    setOcItemsSeleccionados(ocItems);
    // Default proveedor from first item
    const proveedores = [...new Set(itemsBajoStock.map((i) => i.proveedor).filter(Boolean))];
    setOcProveedor(proveedores[0] || "");
    setOcNotas("");
    setShowOCDialog(true);
  }

  function handleOCCantidadChange(idx: number, value: string) {
    const updated = [...ocItemsSeleccionados];
    updated[idx].cantidad_solicitada = parseInt(value) || 1;
    setOcItemsSeleccionados(updated);
  }

  function handleOCRemoveItem(idx: number) {
    setOcItemsSeleccionados(ocItemsSeleccionados.filter((_, i) => i !== idx));
  }

  function handleOCAddItem(item: CatalogoItem) {
    if (ocItemsSeleccionados.find((i) => i.catalogo_item_id === item.id)) return;
    setOcItemsSeleccionados([
      ...ocItemsSeleccionados,
      {
        catalogo_item_id: item.id,
        nombre: item.nombre,
        codigo_material: item.codigo_material,
        cantidad_solicitada: Math.max(1, item.stock_minimo - item.stock_actual),
        unidad: item.unidad,
        costo_unitario: item.costo_unitario,
        stock_actual: item.stock_actual,
        stock_minimo: item.stock_minimo,
      },
    ]);
  }

  function handleCrearOC() {
    if (ocItemsSeleccionados.length === 0) {
      toast({ title: "Error", description: "Agregue al menos un ítem a la orden", variant: "destructive" });
      return;
    }
    setSavingOC(true);

    const totalEstimado = ocItemsSeleccionados.reduce(
      (sum, i) => sum + i.cantidad_solicitada * i.costo_unitario, 0
    );

    const newOC: OrdenCompra = {
      id: Date.now().toString(),
      numero: `OC-${String(ordenesCompra.length + 1).padStart(4, "0")}`,
      estado: "pendiente",
      proveedor: ocProveedor.trim() || "Sin especificar",
      items: ocItemsSeleccionados,
      notas: ocNotas.trim(),
      created_at: new Date().toISOString(),
      created_by: user.nombre || user.auth_id || "sistema",
      total_estimado: totalEstimado,
    };

    const updated = [newOC, ...ordenesCompra];
    saveOrdenesCompra(updated);
    toast({ title: "✅ Orden de Compra creada", description: `${newOC.numero} generada con ${ocItemsSeleccionados.length} ítems` });
    setShowOCDialog(false);
    setSavingOC(false);
  }

  function handleCambiarEstadoOC(ocId: string, nuevoEstado: OrdenCompra["estado"]) {
    const updated = ordenesCompra.map((oc) => {
      if (oc.id === ocId) {
        const updatedOC = { ...oc, estado: nuevoEstado };
        // Si se recibe, actualizar stock de los ítems
        if (nuevoEstado === "recibida") {
          handleRecibirOC(oc);
        }
        return updatedOC;
      }
      return oc;
    });
    saveOrdenesCompra(updated);
    toast({ title: "Estado actualizado", description: `Orden cambiada a: ${OC_ESTADO_LABELS[nuevoEstado]}` });
  }

  async function handleRecibirOC(oc: OrdenCompra) {
    // Update stock for each item in the OC
    for (const ocItem of oc.items) {
      const catalogItem = items.find((i) => i.id === ocItem.catalogo_item_id);
      if (catalogItem) {
        const newStock = (catalogItem.stock_actual || 0) + ocItem.cantidad_solicitada;
        try {
          await fetch(
            `${SUPABASE_URL}/rest/v1/catalogo_inventario?id=eq.${ocItem.catalogo_item_id}`,
            {
              method: "PATCH",
              headers: {
                apikey: serviceKey || SUPABASE_KEY,
                Authorization: `Bearer ${serviceKey || token}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ stock_actual: newStock }),
            }
          );
        } catch {
          // continue with other items
        }
      }
    }
    // Refresh items
    setTimeout(() => fetchItems(), 500);
    toast({ title: "✅ Stock actualizado", description: "Se actualizó el stock de los ítems recibidos" });
  }

  function handleDeleteOC(ocId: string) {
    if (!window.confirm("¿Eliminar esta orden de compra?")) return;
    const updated = ordenesCompra.filter((oc) => oc.id !== ocId);
    saveOrdenesCompra(updated);
    toast({ title: "Eliminada", description: "Orden de compra eliminada" });
  }

  function handleExportOC(oc: OrdenCompra) {
    const data = oc.items.map((item) => ({
      Código: item.codigo_material,
      Nombre: item.nombre,
      "Cantidad Solicitada": item.cantidad_solicitada,
      Unidad: item.unidad,
      "Costo Unitario": item.costo_unitario,
      Subtotal: item.cantidad_solicitada * item.costo_unitario,
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Orden de Compra");
    XLSX.writeFile(wb, `${oc.numero}_${oc.proveedor.replace(/\s/g, "_")}.xlsx`);
    toast({ title: "Exportado", description: `${oc.numero} exportada a Excel` });
  }

  // ─── Excel Export ────────────────────────────────────────────────────────

  const handleExportExcel = () => {
    const data = filteredItems.map((item) => ({
      Código: item.codigo_material,
      Nombre: item.nombre,
      Descripción: item.descripcion,
      Categoría: item.categoria,
      Unidad: item.unidad,
      "Costo Unitario": item.costo_unitario,
      "Stock Actual": item.stock_actual,
      "Stock Mínimo": item.stock_minimo,
      Ubicación: item.ubicacion,
      Proveedor: item.proveedor,
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Inventario");
    XLSX.writeFile(wb, `inventario_${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast({ title: "Exportado", description: "Archivo Excel descargado" });
  };

  // ─── Excel Import ────────────────────────────────────────────────────────

  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet);

        if (rows.length === 0) {
          toast({ title: "Error", description: "El archivo está vacío", variant: "destructive" });
          return;
        }

        let imported = 0;
        for (const row of rows) {
          const nombre = String(row["Nombre"] || row["nombre"] || "").trim();
          if (!nombre) continue;

          const body = {
            empresa_id: user.empresa_id,
            nombre,
            descripcion: String(row["Descripción"] || row["descripcion"] || "").trim(),
            unidad: String(row["Unidad"] || row["unidad"] || "unidad").trim().toLowerCase(),
            costo_unitario: parseFloat(String(row["Costo Unitario"] || row["costo_unitario"] || "0")) || 0,
            codigo_material: String(row["Código"] || row["codigo_material"] || row["codigo"] || "").trim(),
            categoria: String(row["Categoría"] || row["categoria"] || "material").trim().toLowerCase(),
            stock_actual: parseInt(String(row["Stock Actual"] || row["stock_actual"] || "0")) || 0,
            stock_minimo: parseInt(String(row["Stock Mínimo"] || row["stock_minimo"] || "0")) || 0,
            ubicacion: String(row["Ubicación"] || row["ubicacion"] || "").trim(),
            proveedor: String(row["Proveedor"] || row["proveedor"] || "").trim(),
          };

          const validCats = CATEGORIAS.map((c) => c.value);
          if (!validCats.includes(body.categoria)) {
            body.categoria = "material";
          }

          const res = await fetch(`${SUPABASE_URL}/rest/v1/catalogo_inventario`, {
            method: "POST",
            headers: {
              apikey: serviceKey || SUPABASE_KEY,
              Authorization: `Bearer ${serviceKey || token}`,
              "Content-Type": "application/json",
              Prefer: "return=representation",
            },
            body: JSON.stringify(body),
          });

          if (res.ok) imported++;
        }

        toast({
          title: "Importación completada",
          description: `${imported} de ${rows.length} ítems importados correctamente`,
        });
        fetchItems();
      } catch {
        toast({ title: "Error", description: "Error al procesar el archivo Excel", variant: "destructive" });
      }
    };
    reader.readAsArrayBuffer(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // ─── Filter ──────────────────────────────────────────────────────────────

  const filteredItems = items.filter((item) => {
    const matchSearch =
      !search ||
      item.nombre.toLowerCase().includes(search.toLowerCase()) ||
      item.codigo_material.toLowerCase().includes(search.toLowerCase()) ||
      item.descripcion?.toLowerCase().includes(search.toLowerCase()) ||
      item.proveedor?.toLowerCase().includes(search.toLowerCase());
    const matchCategoria = filtroCategoria === "todos" || item.categoria === filtroCategoria;
    return matchSearch && matchCategoria;
  });

  // Stats
  const totalItems = items.length;
  const stockBajo = items.filter((i) => i.stock_actual <= i.stock_minimo && i.stock_minimo > 0).length;
  const valorTotal = items.reduce((sum, i) => sum + i.costo_unitario * i.stock_actual, 0);

  const canEdit = user.rol === "superadmin" || user.rol === "admin" || user.rol === "supervisor";
  const canSeeCosts = user.rol === "superadmin" || user.rol === "admin" || user.rol === "supervisor";

  // ─── Render ──────────────────────────────────────────────────────────────

  if (licenseLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
        <span className="ml-2 text-muted-foreground">Verificando licencia...</span>
      </div>
    );
  }

  if (!moduleActive) {
    return (
      <Card className="max-w-lg mx-auto mt-10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-600">
            <Package className="w-6 h-6" />
            Módulo Inventario no disponible
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            El módulo de Inventario no está activo para su empresa.
            Contacte al administrador para activar esta funcionalidad.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <Package className="w-6 h-6 text-indigo-600" />
          Inventario
        </h2>
        {canEdit && activeTab === "catalogo" && (
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" onClick={openCreateDialog} className="gap-1 bg-indigo-600 hover:bg-indigo-700 text-white">
              <Plus className="w-4 h-4" /> Nuevo Ítem
            </Button>
            <Button size="sm" variant="outline" onClick={handleExportExcel} className="gap-1">
              <Download className="w-4 h-4" /> Exportar Excel
            </Button>
            <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()} className="gap-1">
              <Upload className="w-4 h-4" /> Importar Excel
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={handleImportExcel}
            />
          </div>
        )}
      </div>

      {/* Tabs: Catálogo / Órdenes de Compra */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        <button
          onClick={() => setActiveTab("catalogo")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
            activeTab === "catalogo" ? "bg-white shadow-sm text-slate-800" : "text-slate-500 hover:text-slate-700"
          }`}
        >
          <Package className="w-3.5 h-3.5" /> Catálogo
        </button>
        <button
          onClick={() => setActiveTab("ordenes_compra")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
            activeTab === "ordenes_compra" ? "bg-white shadow-sm text-slate-800" : "text-slate-500 hover:text-slate-700"
          }`}
        >
          <ShoppingCart className="w-3.5 h-3.5" /> Órdenes de Compra
          {stockBajo > 0 && (
            <Badge className="ml-1 bg-red-100 text-red-700 text-[9px] px-1.5 py-0">{stockBajo}</Badge>
          )}
        </button>
      </div>

      {/* ═══════════════════ CATÁLOGO TAB ═══════════════════ */}
      {activeTab === "catalogo" && (
        <>
          {/* Stats */}
          <div className={`grid grid-cols-1 ${canSeeCosts ? "sm:grid-cols-3" : "sm:grid-cols-2"} gap-3`}>
            <Card className="border-indigo-200">
              <CardContent className="p-3 text-center">
                <p className="text-2xl font-bold text-indigo-600">{totalItems}</p>
                <p className="text-xs text-muted-foreground">Ítems en catálogo</p>
              </CardContent>
            </Card>
            <Card className={`border-${stockBajo > 0 ? "red" : "green"}-200`}>
              <CardContent className="p-3 text-center">
                <p className={`text-2xl font-bold ${stockBajo > 0 ? "text-red-600" : "text-green-600"}`}>{stockBajo}</p>
                <p className="text-xs text-muted-foreground">Stock bajo mínimo</p>
              </CardContent>
            </Card>
            {canSeeCosts && (
              <Card className="border-emerald-200">
                <CardContent className="p-3 text-center">
                  <p className="text-2xl font-bold text-emerald-600">
                    ${valorTotal.toLocaleString("es-CL")}
                  </p>
                  <p className="text-xs text-muted-foreground">Valor total inventario</p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Alert: Stock bajo */}
          {stockBajo > 0 && canEdit && (
            <Card className="border-amber-200 bg-amber-50">
              <CardContent className="p-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  <span className="text-sm text-amber-800 font-medium">
                    {stockBajo} ítem{stockBajo > 1 ? "s" : ""} con stock bajo mínimo
                  </span>
                </div>
                <Button
                  size="sm"
                  onClick={openCrearOCDialog}
                  className="gap-1 bg-amber-600 hover:bg-amber-700 text-white text-xs"
                >
                  <ShoppingCart className="w-3.5 h-3.5" /> Generar Orden de Compra
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Filters */}
          <div className="flex gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre, código, proveedor..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={filtroCategoria} onValueChange={setFiltroCategoria}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Categoría" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas</SelectItem>
                {CATEGORIAS.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Items List */}
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
            </div>
          ) : filteredItems.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center text-muted-foreground">
                <Package className="w-10 h-10 mx-auto mb-2 opacity-40" />
                <p>{items.length === 0 ? "No hay ítems en el catálogo. Cree uno o importe desde Excel." : "Sin resultados para la búsqueda."}</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {filteredItems.map((item) => (
                <Card key={item.id} className="hover:shadow-sm transition-shadow">
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm text-slate-800 truncate">
                            {item.nombre}
                          </span>
                          <Badge className={`text-[10px] ${categoriaColors[item.categoria] || "bg-gray-100 text-gray-700"}`}>
                            {item.categoria}
                          </Badge>
                          {item.stock_actual <= item.stock_minimo && item.stock_minimo > 0 && (
                            <Badge variant="destructive" className="text-[10px]">
                              Stock bajo
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                          {item.codigo_material && <span>Cód: {item.codigo_material}</span>}
                          <span>Stock: {item.stock_actual} {item.unidad}</span>
                          {canSeeCosts && <span>${item.costo_unitario.toLocaleString("es-CL")}/{item.unidad}</span>}
                          {item.proveedor && <span>Prov: {item.proveedor}</span>}
                          {item.ubicacion && <span>Ubic: {item.ubicacion}</span>}
                        </div>
                        {item.descripcion && (
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">{item.descripcion}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => openAsignarDialog(item)}
                          title="Asignar a OT"
                          className="h-7 w-7 p-0 text-indigo-600 hover:bg-indigo-50"
                        >
                          <Link2 className="w-3.5 h-3.5" />
                        </Button>
                        {canEdit && (
                          <>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => openAsignacionesDialog(item)}
                              title="Ver asignaciones"
                              className="h-7 w-7 p-0 text-slate-600 hover:bg-slate-50"
                            >
                              <Package className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => openEditDialog(item)}
                              title="Editar"
                              className="h-7 w-7 p-0 text-blue-600 hover:bg-blue-50"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDeleteItem(item)}
                              title="Eliminar"
                              className="h-7 w-7 p-0 text-red-600 hover:bg-red-50"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {/* ═══════════════════ ÓRDENES DE COMPRA TAB ═══════════════════ */}
      {activeTab === "ordenes_compra" && (
        <div className="space-y-4">
          {/* OC Header */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <p className="text-sm text-muted-foreground">
              Gestione las órdenes de compra para reponer stock. Al marcar como &quot;Recibida&quot;, el stock se actualiza automáticamente.
            </p>
            {canEdit && (
              <Button size="sm" onClick={openCrearOCDialog} className="gap-1 bg-indigo-600 hover:bg-indigo-700 text-white">
                <Plus className="w-4 h-4" /> Nueva Orden de Compra
              </Button>
            )}
          </div>

          {/* OC Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="border-amber-200">
              <CardContent className="p-3 text-center">
                <p className="text-xl font-bold text-amber-600">{ordenesCompra.filter((oc) => oc.estado === "pendiente").length}</p>
                <p className="text-xs text-muted-foreground">Pendientes</p>
              </CardContent>
            </Card>
            <Card className="border-blue-200">
              <CardContent className="p-3 text-center">
                <p className="text-xl font-bold text-blue-600">{ordenesCompra.filter((oc) => oc.estado === "aprobada" || oc.estado === "enviada").length}</p>
                <p className="text-xs text-muted-foreground">En proceso</p>
              </CardContent>
            </Card>
            <Card className="border-green-200">
              <CardContent className="p-3 text-center">
                <p className="text-xl font-bold text-green-600">{ordenesCompra.filter((oc) => oc.estado === "recibida").length}</p>
                <p className="text-xs text-muted-foreground">Recibidas</p>
              </CardContent>
            </Card>
            <Card className="border-red-200">
              <CardContent className="p-3 text-center">
                <p className="text-xl font-bold text-red-600">{stockBajo}</p>
                <p className="text-xs text-muted-foreground">Ítems bajo stock</p>
              </CardContent>
            </Card>
          </div>

          {/* OC List */}
          {ordenesCompra.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                <ShoppingCart className="w-10 h-10 mx-auto mb-2 opacity-40" />
                <p>No hay órdenes de compra creadas</p>
                <p className="text-xs mt-1">Cree una orden cuando necesite reponer stock de materiales</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {ordenesCompra.map((oc) => (
                <Card key={oc.id} className="hover:shadow-sm transition-shadow">
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm text-slate-800">{oc.numero}</span>
                          <Badge className={`text-[10px] border ${OC_ESTADO_COLORS[oc.estado]}`}>
                            {OC_ESTADO_LABELS[oc.estado]}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                          <span>Proveedor: {oc.proveedor}</span>
                          <span>{oc.items.length} ítem{oc.items.length > 1 ? "s" : ""}</span>
                          {canSeeCosts && <span>Total est.: ${oc.total_estimado.toLocaleString("es-CL")}</span>}
                          <span>{new Date(oc.created_at).toLocaleDateString("es-CL")}</span>
                        </div>
                        {oc.notas && <p className="text-xs text-gray-400 mt-0.5 truncate">{oc.notas}</p>}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => { setSelectedOC(oc); setShowOCDetailDialog(true); }}
                          title="Ver detalle"
                          className="h-7 w-7 p-0 text-indigo-600 hover:bg-indigo-50"
                        >
                          <FileText className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleExportOC(oc)}
                          title="Exportar Excel"
                          className="h-7 w-7 p-0 text-green-600 hover:bg-green-50"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </Button>
                        {canEdit && oc.estado !== "recibida" && oc.estado !== "cancelada" && (
                          <>
                            {oc.estado === "pendiente" && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleCambiarEstadoOC(oc.id, "aprobada")}
                                title="Aprobar"
                                className="h-7 w-7 p-0 text-blue-600 hover:bg-blue-50"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                              </Button>
                            )}
                            {oc.estado === "aprobada" && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleCambiarEstadoOC(oc.id, "enviada")}
                                title="Marcar como enviada"
                                className="h-7 w-7 p-0 text-indigo-600 hover:bg-indigo-50"
                              >
                                <Clock className="w-3.5 h-3.5" />
                              </Button>
                            )}
                            {(oc.estado === "enviada" || oc.estado === "aprobada") && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleCambiarEstadoOC(oc.id, "recibida")}
                                title="Marcar como recibida"
                                className="h-7 w-7 p-0 text-green-600 hover:bg-green-50"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDeleteOC(oc.id)}
                              title="Eliminar"
                              className="h-7 w-7 p-0 text-red-600 hover:bg-red-50"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════ DIALOGS ═══════════════════ */}

      {/* Dialog: Crear/Editar Item */}
      <Dialog open={showItemDialog} onOpenChange={setShowItemDialog}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingItem ? "Editar Ítem" : "Nuevo Ítem de Inventario"}</DialogTitle>
            <DialogDescription>
              {editingItem ? "Modifique los datos del ítem" : "Complete los datos del nuevo ítem para el catálogo"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nombre *</Label>
              <Input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} placeholder="Ej: Filtro de aire" />
            </div>
            <div>
              <Label>Código Material</Label>
              <Input value={form.codigo_material} onChange={(e) => setForm({ ...form, codigo_material: e.target.value })} placeholder="Ej: FLT-001" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Categoría</Label>
                <Select value={form.categoria} onValueChange={(v) => setForm({ ...form, categoria: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIAS.map((c) => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Unidad</Label>
                <Select value={form.unidad} onValueChange={(v) => setForm({ ...form, unidad: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {UNIDADES.map((u) => (
                      <SelectItem key={u} value={u}>{u}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Stock Actual</Label>
                <Input type="number" min="0" value={form.stock_actual} onChange={(e) => setForm({ ...form, stock_actual: e.target.value })} />
              </div>
              <div>
                <Label>Stock Mínimo</Label>
                <Input type="number" min="0" value={form.stock_minimo} onChange={(e) => setForm({ ...form, stock_minimo: e.target.value })} />
              </div>
            </div>
            {canSeeCosts && (
              <div>
                <Label>Costo Unitario ($)</Label>
                <Input type="number" min="0" step="0.01" value={form.costo_unitario} onChange={(e) => setForm({ ...form, costo_unitario: e.target.value })} />
              </div>
            )}
            <div>
              <Label>Descripción</Label>
              <Input value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} placeholder="Descripción opcional" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Ubicación</Label>
                <Input value={form.ubicacion} onChange={(e) => setForm({ ...form, ubicacion: e.target.value })} placeholder="Ej: Bodega A" />
              </div>
              <div>
                <Label>Proveedor</Label>
                <Input value={form.proveedor} onChange={(e) => setForm({ ...form, proveedor: e.target.value })} placeholder="Ej: ProveedorXYZ" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowItemDialog(false)}>Cancelar</Button>
            <Button onClick={handleSaveItem} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700 text-white">
              {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
              {editingItem ? "Guardar" : "Crear"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Asignar a OT */}
      <Dialog open={showAsignarDialog} onOpenChange={setShowAsignarDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Asignar a Orden de Trabajo</DialogTitle>
            <DialogDescription>
              Asignar &quot;{asignarItem?.nombre}&quot; a una OT activa
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Orden de Trabajo *</Label>
              {loadingOTs ? (
                <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" /> Cargando OTs...
                </div>
              ) : (
                <Select value={asignarForm.ot_id} onValueChange={(v) => setAsignarForm({ ...asignarForm, ot_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Seleccione una OT" /></SelectTrigger>
                  <SelectContent>
                    {ots.map((ot) => (
                      <SelectItem key={ot.id} value={ot.id}>
                        {ot.numero} - {ot.descripcion?.slice(0, 30) || "Sin descripción"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div>
              <Label>Cantidad (disponible: {asignarItem?.stock_actual || 0})</Label>
              <Input
                type="number"
                min="1"
                max={asignarItem?.stock_actual || 999}
                value={asignarForm.cantidad}
                onChange={(e) => setAsignarForm({ ...asignarForm, cantidad: e.target.value })}
              />
            </div>
            <div>
              <Label>Notas</Label>
              <Input
                value={asignarForm.notas}
                onChange={(e) => setAsignarForm({ ...asignarForm, notas: e.target.value })}
                placeholder="Notas opcionales"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAsignarDialog(false)}>Cancelar</Button>
            <Button onClick={handleAsignar} disabled={savingAsignacion} className="bg-indigo-600 hover:bg-indigo-700 text-white">
              {savingAsignacion && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
              Asignar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Ver asignaciones */}
      <Dialog open={showAsignacionesDialog} onOpenChange={setShowAsignacionesDialog}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Asignaciones: {asignacionesItem?.nombre}</DialogTitle>
            <DialogDescription>
              Historial de asignaciones a Órdenes de Trabajo
            </DialogDescription>
          </DialogHeader>
          {loadingAsignaciones ? (
            <div className="flex justify-center py-4">
              <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
            </div>
          ) : asignaciones.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No hay asignaciones registradas
            </p>
          ) : (
            <div className="space-y-2">
              {asignaciones.map((a) => (
                <div key={a.id} className="border rounded-lg p-2.5 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-indigo-700">OT: {a.ot_numero || a.ot_id.slice(0, 8)}</span>
                    <Badge variant="outline" className="text-[10px]">{a.cantidad} {asignacionesItem?.unidad}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {a.asignado_por} • {new Date(a.created_at).toLocaleDateString("es-CL")}
                    {a.notas && <span className="ml-2">— {a.notas}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAsignacionesDialog(false)}>
              <X className="w-4 h-4 mr-1" /> Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Crear Orden de Compra */}
      <Dialog open={showOCDialog} onOpenChange={setShowOCDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-indigo-600" />
              Nueva Orden de Compra
            </DialogTitle>
            <DialogDescription>
              Se pre-seleccionan los ítems con stock bajo mínimo. Puede agregar o quitar ítems y ajustar cantidades.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Proveedor</Label>
              <Input value={ocProveedor} onChange={(e) => setOcProveedor(e.target.value)} placeholder="Nombre del proveedor" />
            </div>

            {/* Items en la OC */}
            <div>
              <Label className="mb-2 block">Ítems a solicitar ({ocItemsSeleccionados.length})</Label>
              {ocItemsSeleccionados.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-3 border rounded-lg">
                  No hay ítems seleccionados. Agregue desde el catálogo.
                </p>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {ocItemsSeleccionados.map((ocItem, idx) => (
                    <div key={ocItem.catalogo_item_id} className="flex items-center gap-2 border rounded-lg p-2 text-sm">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{ocItem.nombre}</p>
                        <p className="text-xs text-muted-foreground">
                          Stock: {ocItem.stock_actual}/{ocItem.stock_minimo} {ocItem.unidad}
                          {canSeeCosts && ` • $${ocItem.costo_unitario}`}
                        </p>
                      </div>
                      <Input
                        type="number"
                        min="1"
                        value={ocItem.cantidad_solicitada}
                        onChange={(e) => handleOCCantidadChange(idx, e.target.value)}
                        className="w-16 h-7 text-xs"
                      />
                      <Button size="sm" variant="ghost" onClick={() => handleOCRemoveItem(idx)} className="h-7 w-7 p-0 text-red-500">
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Add more items */}
            {items.filter((i) => !ocItemsSeleccionados.find((oc) => oc.catalogo_item_id === i.id)).length > 0 && (
              <div>
                <Label className="text-xs text-muted-foreground">Agregar más ítems:</Label>
                <div className="flex flex-wrap gap-1 mt-1 max-h-24 overflow-y-auto">
                  {items
                    .filter((i) => !ocItemsSeleccionados.find((oc) => oc.catalogo_item_id === i.id))
                    .slice(0, 20)
                    .map((item) => (
                      <Button
                        key={item.id}
                        size="sm"
                        variant="outline"
                        onClick={() => handleOCAddItem(item)}
                        className="text-[10px] h-6 px-2"
                      >
                        <Plus className="w-2.5 h-2.5 mr-0.5" /> {item.nombre.slice(0, 20)}
                      </Button>
                    ))}
                </div>
              </div>
            )}

            {/* Total estimado */}
            {canSeeCosts && ocItemsSeleccionados.length > 0 && (
              <div className="p-2 bg-gray-50 rounded-lg text-sm">
                <div className="flex justify-between font-medium">
                  <span>Total estimado:</span>
                  <span className="text-indigo-600">
                    ${ocItemsSeleccionados.reduce((sum, i) => sum + i.cantidad_solicitada * i.costo_unitario, 0).toLocaleString("es-CL")}
                  </span>
                </div>
              </div>
            )}

            <div>
              <Label>Notas / Observaciones</Label>
              <Textarea value={ocNotas} onChange={(e) => setOcNotas(e.target.value)} placeholder="Notas adicionales para la orden" rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowOCDialog(false)}>Cancelar</Button>
            <Button onClick={handleCrearOC} disabled={savingOC} className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1">
              {savingOC && <Loader2 className="w-4 h-4 animate-spin" />}
              <ShoppingCart className="w-4 h-4" /> Crear Orden
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Detalle OC */}
      <Dialog open={showOCDetailDialog} onOpenChange={setShowOCDetailDialog}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-600" />
              {selectedOC?.numero}
            </DialogTitle>
            <DialogDescription>
              Detalle de la orden de compra
            </DialogDescription>
          </DialogHeader>
          {selectedOC && (
            <div className="space-y-3 py-2">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Estado:</span>
                  <Badge className={`ml-2 text-[10px] border ${OC_ESTADO_COLORS[selectedOC.estado]}`}>
                    {OC_ESTADO_LABELS[selectedOC.estado]}
                  </Badge>
                </div>
                <div>
                  <span className="text-muted-foreground">Proveedor:</span>
                  <span className="ml-1 font-medium">{selectedOC.proveedor}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Fecha:</span>
                  <span className="ml-1">{new Date(selectedOC.created_at).toLocaleDateString("es-CL")}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Creada por:</span>
                  <span className="ml-1">{selectedOC.created_by}</span>
                </div>
              </div>

              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left p-2">Ítem</th>
                      <th className="text-center p-2">Cant.</th>
                      {canSeeCosts && <th className="text-right p-2">Subtotal</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {selectedOC.items.map((item, idx) => (
                      <tr key={idx} className="border-t">
                        <td className="p-2">
                          <p className="font-medium">{item.nombre}</p>
                          <p className="text-muted-foreground">{item.codigo_material}</p>
                        </td>
                        <td className="text-center p-2">{item.cantidad_solicitada} {item.unidad}</td>
                        {canSeeCosts && (
                          <td className="text-right p-2">${(item.cantidad_solicitada * item.costo_unitario).toLocaleString("es-CL")}</td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                  {canSeeCosts && (
                    <tfoot className="bg-gray-50 border-t">
                      <tr>
                        <td className="p-2 font-semibold" colSpan={2}>Total</td>
                        <td className="text-right p-2 font-semibold text-indigo-600">
                          ${selectedOC.total_estimado.toLocaleString("es-CL")}
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>

              {selectedOC.notas && (
                <div className="text-sm">
                  <span className="text-muted-foreground">Notas:</span>
                  <p className="mt-0.5">{selectedOC.notas}</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter className="gap-2">
            {selectedOC && (
              <Button variant="outline" size="sm" onClick={() => handleExportOC(selectedOC)} className="gap-1">
                <Download className="w-3.5 h-3.5" /> Exportar Excel
              </Button>
            )}
            <Button variant="outline" onClick={() => setShowOCDetailDialog(false)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}