import { useState, useEffect } from "react";
import { useEmpresa } from "@/lib/empresaContext";
import type { Usuario } from "@/lib/types";
import { SUPABASE_URL, SUPABASE_KEY, SUPABASE_SERVICE_KEY } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import {
  Mail,
  Plus,
  Trash2,
  Clock,
  Calendar,
  Save,
  Loader2,
  CheckCircle2,
  PauseCircle,
  PlayCircle,
  Send,
  X,
} from "lucide-react";

interface ReportesAutomaticosProps {
  user: Usuario;
  token: string;
}

interface ReporteConfig {
  id?: string;
  empresa_id: string;
  nombre: string;
  tipo_reporte: string;
  periodicidad: string;
  dia_envio: string;
  hora_envio: string;
  destinatarios: string[];
  activo: boolean;
  created_at?: string;
  updated_at?: string;
  created_by?: string;
  ultimo_envio?: string | null;
}

const TIPOS_REPORTE = [
  { value: "resumen_ots", label: "Resumen de OTs", desc: "OTs abiertas, cerradas, vencidas y pendientes" },
  { value: "sla_cumplimiento", label: "Cumplimiento SLA", desc: "% de OTs dentro de SLA por prioridad" },
  { value: "carga_tecnicos", label: "Carga por Técnico", desc: "Distribución de OTs por técnico" },
  { value: "programacion", label: "Cumplimiento Programación", desc: "Programaciones ejecutadas vs pendientes" },
  { value: "inventario", label: "Estado Inventario", desc: "Stock bajo, movimientos y alertas" },
  { value: "consolidado", label: "Reporte Consolidado", desc: "Resumen ejecutivo completo de todos los módulos" },
];

const PERIODICIDADES = [
  { value: "diario", label: "Diario", desc: "Todos los días" },
  { value: "semanal", label: "Semanal", desc: "Una vez por semana" },
  { value: "quincenal", label: "Quincenal", desc: "Cada 15 días" },
  { value: "mensual", label: "Mensual", desc: "Una vez al mes" },
];

const DIAS_SEMANA = [
  { value: "lunes", label: "Lunes" },
  { value: "martes", label: "Martes" },
  { value: "miercoles", label: "Miércoles" },
  { value: "jueves", label: "Jueves" },
  { value: "viernes", label: "Viernes" },
  { value: "sabado", label: "Sábado" },
  { value: "domingo", label: "Domingo" },
];

const DIAS_MES = Array.from({ length: 28 }, (_, i) => ({
  value: String(i + 1),
  label: `Día ${i + 1}`,
}));

export default function ReportesAutomaticos({ user, token }: ReportesAutomaticosProps) {
  const { empresa, colorPrimario } = useEmpresa();
  const { toast } = useToast();
  const [configs, setConfigs] = useState<ReporteConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newEmail, setNewEmail] = useState("");

  const emptyForm: ReporteConfig = {
    empresa_id: empresa?.id || "",
    nombre: "",
    tipo_reporte: "resumen_ots",
    periodicidad: "semanal",
    dia_envio: "lunes",
    hora_envio: "08:00",
    destinatarios: [],
    activo: true,
  };

  const [form, setForm] = useState<ReporteConfig>(emptyForm);

  useEffect(() => {
    if (empresa) {
      loadConfigs();
    }
  }, [empresa]);

  const [tableExists, setTableExists] = useState(true);

  async function loadConfigs() {
    if (!empresa) return;
    setLoading(true);
    const authKey = SUPABASE_SERVICE_KEY || token;
    const apiKey = SUPABASE_SERVICE_KEY || SUPABASE_KEY;

    try {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/reportes_automaticos?empresa_id=eq.${empresa.id}&order=created_at.desc`,
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
        setConfigs(data || []);
        setTableExists(true);
      } else {
        // Table might not exist yet (404 or 42P01 error)
        const errBody = await res.text();
        if (res.status === 404 || errBody.includes("42P01") || errBody.includes("does not exist") || errBody.includes("relation")) {
          setTableExists(false);
          setConfigs([]);
        }
      }
    } catch (err) {
      console.error("Error loading report configs:", err);
      setTableExists(false);
    }
    setLoading(false);
  }

  async function handleSave() {
    if (!empresa) return;
    if (!tableExists) {
      toast({ title: "Tabla no disponible", description: "Ejecute la migración MIGRATE_REPORTES_AUTOMATICOS.sql en Supabase antes de usar esta funcionalidad.", variant: "destructive" });
      return;
    }
    if (!form.nombre.trim()) {
      toast({ title: "Error", description: "Ingrese un nombre para el reporte", variant: "destructive" });
      return;
    }
    if (form.destinatarios.length === 0) {
      toast({ title: "Error", description: "Agregue al menos un destinatario", variant: "destructive" });
      return;
    }

    setSaving(true);
    const authKey = SUPABASE_SERVICE_KEY || token;
    const apiKey = SUPABASE_SERVICE_KEY || SUPABASE_KEY;

    const payload = {
      empresa_id: empresa.id,
      nombre: form.nombre.trim(),
      tipo_reporte: form.tipo_reporte,
      periodicidad: form.periodicidad,
      dia_envio: form.dia_envio,
      hora_envio: form.hora_envio,
      destinatarios: form.destinatarios,
      activo: form.activo,
      updated_at: new Date().toISOString(),
      ...(editingId ? {} : { created_by: user.auth_id, created_at: new Date().toISOString() }),
    };

    try {
      let res: Response;
      if (editingId) {
        res = await fetch(
          `${SUPABASE_URL}/rest/v1/reportes_automaticos?id=eq.${editingId}`,
          {
            method: "PATCH",
            headers: {
              apikey: apiKey,
              Authorization: `Bearer ${authKey}`,
              "Content-Type": "application/json",
              Prefer: "return=representation",
            },
            body: JSON.stringify(payload),
          }
        );
      } else {
        res = await fetch(`${SUPABASE_URL}/rest/v1/reportes_automaticos`, {
          method: "POST",
          headers: {
            apikey: apiKey,
            Authorization: `Bearer ${authKey}`,
            "Content-Type": "application/json",
            Prefer: "return=representation",
          },
          body: JSON.stringify(payload),
        });
      }

      if (res.ok) {
        toast({ title: "✅ Guardado", description: editingId ? "Configuración actualizada" : "Reporte programado creado" });
        setShowForm(false);
        setEditingId(null);
        setForm(emptyForm);
        loadConfigs();
      } else {
        const errData = await res.json().catch(() => null);
        toast({ title: "Error", description: errData?.message || "No se pudo guardar", variant: "destructive" });
      }
    } catch (err) {
      console.error(err);
      toast({ title: "Error", description: "Error de conexión", variant: "destructive" });
    }
    setSaving(false);
  }

  async function handleDelete(id: string) {
    if (!confirm("¿Eliminar esta configuración de reporte automático?")) return;
    const authKey = SUPABASE_SERVICE_KEY || token;
    const apiKey = SUPABASE_SERVICE_KEY || SUPABASE_KEY;

    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/reportes_automaticos?id=eq.${id}`, {
        method: "DELETE",
        headers: {
          apikey: apiKey,
          Authorization: `Bearer ${authKey}`,
        },
      });
      if (res.ok) {
        toast({ title: "Eliminado", description: "Configuración eliminada" });
        loadConfigs();
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function handleToggleActive(config: ReporteConfig) {
    const authKey = SUPABASE_SERVICE_KEY || token;
    const apiKey = SUPABASE_SERVICE_KEY || SUPABASE_KEY;

    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/reportes_automaticos?id=eq.${config.id}`, {
        method: "PATCH",
        headers: {
          apikey: apiKey,
          Authorization: `Bearer ${authKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ activo: !config.activo, updated_at: new Date().toISOString() }),
      });
      if (res.ok) {
        toast({
          title: config.activo ? "⏸ Pausado" : "▶ Activado",
          description: `Reporte "${config.nombre}" ${config.activo ? "pausado" : "activado"}`,
        });
        loadConfigs();
      }
    } catch (err) {
      console.error(err);
    }
  }

  function handleEdit(config: ReporteConfig) {
    setForm({ ...config });
    setEditingId(config.id || null);
    setShowForm(true);
  }

  function handleAddEmail() {
    const email = newEmail.trim().toLowerCase();
    if (!email) return;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast({ title: "Email inválido", description: "Ingrese un email válido", variant: "destructive" });
      return;
    }
    if (form.destinatarios.includes(email)) {
      toast({ title: "Duplicado", description: "Este email ya está en la lista", variant: "destructive" });
      return;
    }
    setForm({ ...form, destinatarios: [...form.destinatarios, email] });
    setNewEmail("");
  }

  function handleRemoveEmail(email: string) {
    setForm({ ...form, destinatarios: form.destinatarios.filter((e) => e !== email) });
  }

  function getDiaLabel(config: ReporteConfig): string {
    if (config.periodicidad === "diario") return "Todos los días";
    if (config.periodicidad === "semanal" || config.periodicidad === "quincenal") {
      const dia = DIAS_SEMANA.find((d) => d.value === config.dia_envio);
      return dia ? dia.label : config.dia_envio;
    }
    if (config.periodicidad === "mensual") {
      return `Día ${config.dia_envio} del mes`;
    }
    return config.dia_envio;
  }

  function getPeriodicidadLabel(p: string): string {
    const found = PERIODICIDADES.find((x) => x.value === p);
    return found ? found.label : p;
  }

  function getTipoLabel(t: string): string {
    const found = TIPOS_REPORTE.find((x) => x.value === t);
    return found ? found.label : t;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        <span className="ml-2 text-sm text-gray-500">Cargando configuraciones...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header + botón crear */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Mail className="w-5 h-5" style={{ color: colorPrimario }} />
          <h3 className="font-semibold text-gray-800">Reportes Automáticos por Email</h3>
        </div>
        {!showForm && (
          <button
            type="button"
            onClick={() => {
              setForm({ ...emptyForm, empresa_id: empresa?.id || "" });
              setEditingId(null);
              setShowForm(true);
            }}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-white shadow-md transition-colors"
            style={{ backgroundColor: colorPrimario }}
          >
            <Plus className="w-4 h-4" />
            Nuevo Reporte
          </button>
        )}
      </div>

      {/* Formulario de creación/edición */}
      {showForm && (
        <div className="border rounded-xl p-4 bg-white shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-gray-700">
              {editingId ? "Editar Reporte Programado" : "Nuevo Reporte Programado"}
            </h4>
            <button
              type="button"
              onClick={() => { setShowForm(false); setEditingId(null); setForm(emptyForm); }}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Nombre */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-600">Nombre del reporte *</label>
            <input
              type="text"
              className="w-full border rounded-lg px-3 py-2 text-sm"
              placeholder="Ej: Resumen semanal OTs"
              value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
            />
          </div>

          {/* Tipo de reporte */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-600">Tipo de reporte</label>
            <select
              className="w-full border rounded-lg px-3 py-2 text-sm"
              value={form.tipo_reporte}
              onChange={(e) => setForm({ ...form, tipo_reporte: e.target.value })}
            >
              {TIPOS_REPORTE.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label} — {t.desc}
                </option>
              ))}
            </select>
          </div>

          {/* Periodicidad */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">Periodicidad *</label>
              <select
                className="w-full border rounded-lg px-3 py-2 text-sm"
                value={form.periodicidad}
                onChange={(e) => {
                  const p = e.target.value;
                  let dia = form.dia_envio;
                  if (p === "diario") dia = "todos";
                  else if (p === "semanal" || p === "quincenal") dia = "lunes";
                  else if (p === "mensual") dia = "1";
                  setForm({ ...form, periodicidad: p, dia_envio: dia });
                }}
              >
                {PERIODICIDADES.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Día de envío */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">
                {form.periodicidad === "diario"
                  ? "Día"
                  : form.periodicidad === "mensual"
                  ? "Día del mes"
                  : "Día de la semana"}
              </label>
              {form.periodicidad === "diario" ? (
                <input
                  type="text"
                  className="w-full border rounded-lg px-3 py-2 text-sm bg-gray-50"
                  value="Todos los días"
                  disabled
                />
              ) : form.periodicidad === "mensual" ? (
                <select
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  value={form.dia_envio}
                  onChange={(e) => setForm({ ...form, dia_envio: e.target.value })}
                >
                  {DIAS_MES.map((d) => (
                    <option key={d.value} value={d.value}>
                      {d.label}
                    </option>
                  ))}
                </select>
              ) : (
                <select
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  value={form.dia_envio}
                  onChange={(e) => setForm({ ...form, dia_envio: e.target.value })}
                >
                  {DIAS_SEMANA.map((d) => (
                    <option key={d.value} value={d.value}>
                      {d.label}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Hora de envío */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">Hora de envío</label>
              <input
                type="time"
                className="w-full border rounded-lg px-3 py-2 text-sm"
                value={form.hora_envio}
                onChange={(e) => setForm({ ...form, hora_envio: e.target.value })}
              />
            </div>
          </div>

          {/* Destinatarios */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-gray-600">Destinatarios *</label>
            <div className="flex gap-2">
              <input
                type="email"
                className="flex-1 border rounded-lg px-3 py-2 text-sm"
                placeholder="email@ejemplo.com"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddEmail(); } }}
              />
              <button
                type="button"
                onClick={handleAddEmail}
                className="px-3 py-2 rounded-lg text-sm font-medium text-white"
                style={{ backgroundColor: colorPrimario }}
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            {form.destinatarios.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {form.destinatarios.map((email) => (
                  <span
                    key={email}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-blue-50 text-blue-700 text-xs"
                  >
                    <Mail className="w-3 h-3" />
                    {email}
                    <button
                      type="button"
                      onClick={() => handleRemoveEmail(email)}
                      className="ml-1 text-blue-400 hover:text-red-500"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Resumen y guardar */}
          <div className="flex items-center justify-between pt-2 border-t">
            <div className="text-xs text-gray-500">
              <Calendar className="w-3 h-3 inline mr-1" />
              {getPeriodicidadLabel(form.periodicidad)} • {form.periodicidad !== "diario" ? getDiaLabel(form) + " • " : ""}
              {form.hora_envio} hrs • {form.destinatarios.length} destinatario(s)
            </div>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white shadow-md transition-colors disabled:opacity-50"
              style={{ backgroundColor: colorPrimario }}
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {editingId ? "Actualizar" : "Guardar"}
            </button>
          </div>
        </div>
      )}

      {/* Lista de reportes configurados */}
      {configs.length === 0 && !showForm ? (
        <div className="text-center py-12 border rounded-xl bg-gray-50">
          <Mail className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          {!tableExists ? (
            <>
              <p className="text-gray-500 text-sm">Módulo de Reportes Automáticos</p>
              <p className="text-gray-400 text-xs mt-1">
                Para activar esta funcionalidad, ejecute la migración SQL proporcionada en el archivo
                <code className="mx-1 px-1 py-0.5 bg-gray-200 rounded text-xs">MIGRATE_REPORTES_AUTOMATICOS.sql</code>
                en su base de datos Supabase.
              </p>
            </>
          ) : (
            <>
              <p className="text-gray-500 text-sm">No hay reportes automáticos configurados</p>
              <p className="text-gray-400 text-xs mt-1">
                Cree un reporte para recibir resúmenes periódicos por email
              </p>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {configs.map((config) => (
            <div
              key={config.id}
              className={`border rounded-xl p-4 transition-colors ${
                config.activo ? "bg-white border-gray-200" : "bg-gray-50 border-gray-100 opacity-70"
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${config.activo ? "bg-green-500" : "bg-gray-400"}`} />
                    <h4 className="font-medium text-gray-800 text-sm">{config.nombre}</h4>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">
                      {getTipoLabel(config.tipo_reporte)}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {getPeriodicidadLabel(config.periodicidad)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {getDiaLabel(config)} a las {config.hora_envio}
                    </span>
                    <span className="flex items-center gap-1">
                      <Send className="w-3 h-3" />
                      {config.destinatarios.length} destinatario(s)
                    </span>
                  </div>
                  {config.destinatarios.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {config.destinatarios.map((email) => (
                        <span key={email} className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600">
                          {email}
                        </span>
                      ))}
                    </div>
                  )}
                  {config.ultimo_envio && (
                    <p className="mt-1 text-xs text-green-600 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      Último envío: {new Date(config.ultimo_envio).toLocaleString("es-CL")}
                    </p>
                  )}
                </div>

                {/* Acciones */}
                <div className="flex items-center gap-1 ml-3">
                  <button
                    type="button"
                    onClick={() => handleToggleActive(config)}
                    className={`p-2 rounded-lg transition-colors ${
                      config.activo
                        ? "text-amber-600 hover:bg-amber-50"
                        : "text-green-600 hover:bg-green-50"
                    }`}
                    title={config.activo ? "Pausar" : "Activar"}
                  >
                    {config.activo ? <PauseCircle className="w-4 h-4" /> : <PlayCircle className="w-4 h-4" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleEdit(config)}
                    className="p-2 rounded-lg text-blue-600 hover:bg-blue-50 transition-colors"
                    title="Editar"
                  >
                    <Mail className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(config.id!)}
                    className="p-2 rounded-lg text-red-500 hover:bg-red-50 transition-colors"
                    title="Eliminar"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Nota informativa */}
      <div className="mt-4 p-3 rounded-lg bg-blue-50 border border-blue-100">
        <p className="text-xs text-blue-700">
          <strong>ℹ️ Nota:</strong> Los reportes se enviarán automáticamente según la periodicidad configurada.
          El sistema generará un resumen con los datos del período correspondiente y lo enviará a los destinatarios indicados.
          Puede pausar o reactivar cualquier reporte en cualquier momento.
        </p>
      </div>
    </div>
  );
}