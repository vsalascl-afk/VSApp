import { useState, useEffect, useCallback, useRef } from "react";
import type { OrdenTrabajo, Usuario, Empresa } from "@/lib/types";
import { SUPABASE_URL, SUPABASE_KEY } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { ClipboardList, Clock, PlayCircle, CheckCircle2, Building2, Users, Eye, AlertTriangle, RefreshCw } from "lucide-react";

interface DashboardProps {
  user: Usuario;
  token: string;
  refreshKey: number;
}

const COLORS_STATUS = ["#f59e0b", "#0ea5e9", "#8b5cf6", "#22c55e"];

// SLA por prioridad (en horas)
const SLA_HOURS: Record<string, number> = { alta: 24, media: 48, baja: 72 };

function getSLAStatus(ot: OrdenTrabajo): { vencida: boolean; horasRestantes: number; porcentaje: number } {
  if (ot.estado === "completada") return { vencida: false, horasRestantes: 999, porcentaje: 0 };
  const slaHours = SLA_HOURS[ot.prioridad] || 72;
  const inicio = new Date(ot.fecha_inicio).getTime();
  const ahora = Date.now();
  const horasTranscurridas = (ahora - inicio) / (1000 * 60 * 60);
  const horasRestantes = slaHours - horasTranscurridas;
  const porcentaje = Math.min(100, (horasTranscurridas / slaHours) * 100);
  return { vencida: horasRestantes <= 0, horasRestantes, porcentaje };
}

export default function Dashboard({ user, token, refreshKey }: DashboardProps) {
  const [ordenes, setOrdenes] = useState<OrdenTrabajo[]>([]);
  const [loading, setLoading] = useState(true);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [selectedEmpresa, setSelectedEmpresa] = useState<string>(
    user.rol === "superadmin" ? "todas" : user.empresa_id
  );
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const autoRefreshRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [totalUsuarios, setTotalUsuarios] = useState(0);
  const [usuariosMap, setUsuariosMap] = useState<Record<string, string>>({});
  const isSuperAdmin = user.rol === "superadmin";
  const isSupervisor = user.rol === "supervisor" || user.rol === "admin" || isSuperAdmin;

  const fetchUsuariosCount = useCallback(async () => {
    try {
      let url = `${SUPABASE_URL}/rest/v1/usuarios?select=id,auth_id,nombre,rol`;
      if (!isSuperAdmin) {
        url += `&empresa_id=eq.${user.empresa_id}`;
      } else if (selectedEmpresa !== "todas") {
        url += `&empresa_id=eq.${selectedEmpresa}`;
      }

      // Use service_role key to bypass RLS
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
        if (Array.isArray(data)) {
          setTotalUsuarios(data.length);
          // Crear mapa auth_id -> nombre para resolver nombres de técnicos
          const map: Record<string, string> = {};
          data.forEach((u: { auth_id: string; nombre: string }) => {
            if (u.auth_id && u.nombre) {
              map[u.auth_id] = u.nombre;
            }
          });
          setUsuariosMap(map);
        }
      }
    } catch {
      // silently fail
    }
  }, [isSuperAdmin, user.empresa_id, selectedEmpresa, token]);

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

  const fetchOrdenes = useCallback(async () => {
    setLoading(true);

    let filtro: string;
    if (user.rol === "tecnico") {
      filtro = `?tecnico_id=eq.${user.auth_id}`;
    } else if (isSuperAdmin && selectedEmpresa === "todas") {
      filtro = "?";
    } else if (isSuperAdmin && selectedEmpresa !== "todas") {
      filtro = `?empresa_id=eq.${selectedEmpresa}`;
    } else {
      filtro = `?empresa_id=eq.${user.empresa_id}`;
    }

    // Remove leading ? if we need to add order
    const separator = filtro === "?" ? "" : "&";
    filtro += `${separator}order=fecha_inicio.desc`;

    try {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/ordenes_trabajo${filtro}`,
        {
          headers: {
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );
      const data = await res.json();
      setOrdenes(Array.isArray(data) ? data : []);
    } catch {
      console.error("Error fetching ordenes");
    } finally {
      setLoading(false);
    }
  }, [user, token, isSuperAdmin, selectedEmpresa]);

  useEffect(() => {
    fetchEmpresas();
  }, [fetchEmpresas]);

  useEffect(() => {
    fetchOrdenes();
  }, [fetchOrdenes, refreshKey]);

  useEffect(() => {
    fetchUsuariosCount();
  }, [fetchUsuariosCount]);

  // Auto-refresh cada 30 segundos para supervisión en tiempo real
  useEffect(() => {
    if (!isSupervisor) return;
    autoRefreshRef.current = setInterval(() => {
      fetchOrdenes();
      setLastRefresh(new Date());
    }, 30000);
    return () => {
      if (autoRefreshRef.current) clearInterval(autoRefreshRef.current);
    };
  }, [isSupervisor, fetchOrdenes]);

  const pendientes = ordenes.filter((o) => o.estado === "pendiente").length;
  const enCurso = ordenes.filter((o) => o.estado === "en_curso").length;
  const enRevision = ordenes.filter((o) => o.estado === "en_revision").length;
  const completadas = ordenes.filter((o) => o.estado === "completada").length;
  const total = ordenes.length;

  // SLA metrics
  const otActivas = ordenes.filter((o) => o.estado !== "completada");
  const slaVencidas = otActivas.filter((o) => getSLAStatus(o).vencida);
  const slaCriticas = otActivas.filter((o) => {
    const s = getSLAStatus(o);
    return !s.vencida && s.porcentaje >= 75;
  });

  // Carga por técnico (solo OTs activas)
  const cargaTecnicos = (() => {
    const map: Record<string, { nombre: string; total: number; vencidas: number }> = {};
    otActivas.forEach((ot) => {
      const tecId = ot.tecnico_id || "sin_asignar";
      // Resolver nombre: primero desde el mapa de usuarios (auth_id -> nombre), luego tecnico_nombre, luego fallback
      const nombre = usuariosMap[tecId] || ot.tecnico_nombre || (tecId === "sin_asignar" ? "Sin asignar" : tecId);
      if (!map[tecId]) map[tecId] = { nombre, total: 0, vencidas: 0 };
      map[tecId].total++;
      if (getSLAStatus(ot).vencida) map[tecId].vencidas++;
    });
    return Object.values(map).sort((a, b) => b.total - a.total);
  })();

  // Pie chart data
  const pieData = [
    { name: "Pendientes", value: pendientes },
    { name: "En Curso", value: enCurso },
    { name: "En Revisión", value: enRevision },
    { name: "Completadas", value: completadas },
  ];

  // Bar chart: OTs by month
  const monthlyData = (() => {
    const months: Record<string, { pendiente: number; en_curso: number; en_revision: number; completada: number }> = {};
    ordenes.forEach((ot) => {
      if (!ot.fecha_inicio) return;
      const date = new Date(ot.fecha_inicio);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      if (!months[key]) {
        months[key] = { pendiente: 0, en_curso: 0, en_revision: 0, completada: 0 };
      }
      if (ot.estado in months[key]) {
        months[key][ot.estado as keyof typeof months[string]]++;
      }
    });

    return Object.entries(months)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([month, counts]) => ({
        mes: month,
        Pendientes: counts.pendiente,
        "En Curso": counts.en_curso,
        "En Revisión": counts.en_revision,
        Completadas: counts.completada,
      }));
  })();

  if (loading) {
    return (
      <div className="text-center py-10 text-muted-foreground">
        Cargando dashboard...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Empresa filter for superadmin */}
      {isSuperAdmin && empresas.length > 0 && (
        <div className="flex items-center gap-2">
          <Building2 className="w-4 h-4 text-slate-500" />
          <span className="text-sm text-slate-600">Empresa:</span>
          <Select value={selectedEmpresa} onValueChange={setSelectedEmpresa}>
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

      {/* Real-time indicator for supervisors */}
      {isSupervisor && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <RefreshCw className="w-3 h-3 animate-spin" />
          <span>Actualización automática · Última: {lastRefresh.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
        <Card className="bg-gradient-to-br from-slate-50 to-slate-100">
          <CardContent className="p-4 text-center">
            <ClipboardList className="w-6 h-6 mx-auto text-slate-500 mb-1" />
            <p className="text-2xl font-bold text-slate-800">{total}</p>
            <p className="text-xs text-muted-foreground">Total OTs</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-amber-50 to-amber-100">
          <CardContent className="p-4 text-center">
            <Clock className="w-6 h-6 mx-auto text-amber-500 mb-1" />
            <p className="text-2xl font-bold text-amber-600">{pendientes}</p>
            <p className="text-xs text-muted-foreground">Pendientes</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-sky-50 to-sky-100">
          <CardContent className="p-4 text-center">
            <PlayCircle className="w-6 h-6 mx-auto text-sky-500 mb-1" />
            <p className="text-2xl font-bold text-sky-600">{enCurso}</p>
            <p className="text-xs text-muted-foreground">En Curso</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-purple-50 to-purple-100">
          <CardContent className="p-4 text-center">
            <Eye className="w-6 h-6 mx-auto text-purple-500 mb-1" />
            <p className="text-2xl font-bold text-purple-600">{enRevision}</p>
            <p className="text-xs text-muted-foreground">En Revisión</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-green-50 to-green-100">
          <CardContent className="p-4 text-center">
            <CheckCircle2 className="w-6 h-6 mx-auto text-green-500 mb-1" />
            <p className="text-2xl font-bold text-green-600">{completadas}</p>
            <p className="text-xs text-muted-foreground">Completadas</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-indigo-50 to-indigo-100">
          <CardContent className="p-4 text-center">
            <Users className="w-6 h-6 mx-auto text-indigo-500 mb-1" />
            <p className="text-2xl font-bold text-indigo-600">{totalUsuarios}</p>
            <p className="text-xs text-muted-foreground">Usuarios</p>
          </CardContent>
        </Card>
      </div>

      {/* Panel de Supervisión SLA - solo para supervisores/admins */}
      {isSupervisor && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Alertas SLA */}
          <Card className="border-red-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-500" />
                Alertas SLA
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">OTs con SLA vencido</span>
                <Badge variant={slaVencidas.length > 0 ? "destructive" : "secondary"}>
                  {slaVencidas.length}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">OTs en zona crítica (&gt;75%)</span>
                <Badge variant={slaCriticas.length > 0 ? "default" : "secondary"} className={slaCriticas.length > 0 ? "bg-orange-500" : ""}>
                  {slaCriticas.length}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Pendientes de revisión</span>
                <Badge variant={enRevision > 0 ? "default" : "secondary"} className={enRevision > 0 ? "bg-purple-500" : ""}>
                  {enRevision}
                </Badge>
              </div>
              {slaVencidas.length > 0 && (
                <div className="mt-3 space-y-1 max-h-32 overflow-y-auto">
                  {slaVencidas.slice(0, 5).map((ot) => (
                    <div key={ot.id} className="text-xs bg-red-50 p-2 rounded border border-red-100 flex justify-between">
                      <span className="font-medium truncate">{ot.numero} - {ot.cliente}</span>
                      <Badge variant="destructive" className="text-[10px] h-4">
                        {ot.prioridad}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Carga por Técnico */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-500" />
                Carga por Técnico
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 max-h-48 overflow-y-auto">
              {cargaTecnicos.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">Sin OTs activas</p>
              ) : (
                cargaTecnicos.map((t) => (
                  <div key={t.nombre} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="truncate max-w-[140px]">{t.nombre}</span>
                      <span className="text-muted-foreground">
                        {t.total} OT{t.total > 1 ? "s" : ""}
                        {t.vencidas > 0 && (
                          <span className="text-red-500 ml-1">({t.vencidas} vencida{t.vencidas > 1 ? "s" : ""})</span>
                        )}
                      </span>
                    </div>
                    <Progress value={(t.total / Math.max(...cargaTecnicos.map(x => x.total), 1)) * 100} className="h-1.5" />
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Pie Chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Distribución por Estado</CardTitle>
          </CardHeader>
          <CardContent>
            {total === 0 ? (
              <p className="text-center text-muted-foreground py-8 text-sm">
                Sin datos
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="45%"
                    innerRadius={40}
                    outerRadius={70}
                    paddingAngle={4}
                    dataKey="value"
                    label={({ value }: { value: number }) => (value > 0 ? `${value}` : "")}
                    labelLine={false}
                  >
                    {pieData.map((_, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={COLORS_STATUS[index]}
                      />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number, name: string) => [`${value}`, name]} />
                  <Legend
                    verticalAlign="bottom"
                    height={36}
                    iconSize={10}
                    wrapperStyle={{ fontSize: 11 }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Bar Chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">OTs por Mes</CardTitle>
          </CardHeader>
          <CardContent>
            {monthlyData.length === 0 ? (
              <p className="text-center text-muted-foreground py-8 text-sm">
                Sin datos
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar
                    dataKey="Pendientes"
                    fill="#f59e0b"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    dataKey="En Curso"
                    fill="#0ea5e9"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    dataKey="En Revisión"
                    fill="#8b5cf6"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    dataKey="Completadas"
                    fill="#22c55e"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}