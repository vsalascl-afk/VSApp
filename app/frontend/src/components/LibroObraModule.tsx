import { useState, useEffect, useCallback } from "react";
import type { Usuario } from "@/lib/types";
import { SUPABASE_URL, SUPABASE_KEY } from "@/lib/supabase";
import { getRegionTicketLabel } from "@/lib/regiones";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { BookOpen, Loader2, Plus, ArrowLeft, MapPin, Calendar, User } from "lucide-react";

interface LibroObraModuleProps {
  user: Usuario;
  token: string;
}

interface Proyecto {
  id: string;
  empresa_id: string;
  nombre: string;
  region: string | null;
  direccion: string | null;
}

interface EntradaLibroObra {
  id: string;
  proyecto_id: string;
  autor_id: number | string | null;
  autor_portal_cliente_id: string | null;
  tipo_evento: string;
  contenido: string;
  creado_en: string;
}

const TIPO_EVENTO_OPTIONS = [
  { value: "avance", label: "Avance" },
  { value: "incidencia", label: "Incidencia" },
  { value: "instruccion", label: "Instrucción" },
  { value: "material", label: "Material" },
  { value: "correccion", label: "Corrección" },
  { value: "otro", label: "Otro" },
];

const tipoEventoColors: Record<string, string> = {
  avance: "bg-green-500",
  incidencia: "bg-red-500",
  instruccion: "bg-blue-500",
  material: "bg-amber-500",
  correccion: "bg-gray-500",
  otro: "bg-gray-500",
};

const tipoEventoLabels: Record<string, string> = {
  avance: "Avance",
  incidencia: "Incidencia",
  instruccion: "Instrucción",
  material: "Material",
  correccion: "Corrección",
  otro: "Otro",
};

export default function LibroObraModule({ user, token }: LibroObraModuleProps) {
  const { toast } = useToast();
  const isTecnico = user.rol === "tecnico";
  const isSuperAdmin = user.rol === "superadmin";

  const [usuarioInternoId, setUsuarioInternoId] = useState<number | string | null>(null);
  const [proyectos, setProyectos] = useState<Proyecto[]>([]);
  const [loadingProyectos, setLoadingProyectos] = useState(true);
  const [selectedProyecto, setSelectedProyecto] = useState<Proyecto | null>(null);
  const [entradas, setEntradas] = useState<EntradaLibroObra[]>([]);
  const [loadingEntradas, setLoadingEntradas] = useState(false);
  const [autorNombres, setAutorNombres] = useState<Record<string, string>>({});
  const [clienteNombres, setClienteNombres] = useState<Record<string, string>>({});

  const [dialogOpen, setDialogOpen] = useState(false);
  const [tipoEvento, setTipoEvento] = useState("avance");
  const [contenido, setContenido] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Resolver el id interno (usuarios.id) del usuario logueado a partir de su auth_id
  useEffect(() => {
    async function resolveUsuarioInternoId() {
      try {
        const res = await fetch(
          `${SUPABASE_URL}/rest/v1/usuarios?auth_id=eq.${user.auth_id}&select=id&limit=1`,
          {
            headers: {
              apikey: SUPABASE_KEY,
              Authorization: `Bearer ${token}`,
            },
          }
        );
        if (res.ok) {
          const data = await res.json();
          if (data && data[0]) setUsuarioInternoId(data[0].id);
        }
      } catch {
        // silencioso
      }
    }
    resolveUsuarioInternoId();
  }, [user.auth_id, token]);

  const fetchProyectos = useCallback(async () => {
    setLoadingProyectos(true);
    try {
      if (isTecnico) {
        if (!usuarioInternoId) {
          setProyectos([]);
          return;
        }
        const asigRes = await fetch(
          `${SUPABASE_URL}/rest/v1/proyecto_tecnicos?usuario_id=eq.${usuarioInternoId}&select=proyecto_id`,
          {
            headers: {
              apikey: SUPABASE_KEY,
              Authorization: `Bearer ${token}`,
            },
          }
        );
        if (!asigRes.ok) {
          setProyectos([]);
          return;
        }
        const asigData: Array<{ proyecto_id: string }> = await asigRes.json();
        const ids = asigData.map((a) => a.proyecto_id);
        if (ids.length === 0) {
          setProyectos([]);
          return;
        }
        const res = await fetch(
          `${SUPABASE_URL}/rest/v1/proyectos?id=in.(${ids.join(",")})&order=nombre.asc&select=id,empresa_id,nombre,region,direccion`,
          {
            headers: {
              apikey: SUPABASE_KEY,
              Authorization: `Bearer ${token}`,
            },
          }
        );
        if (res.ok) {
          const data = await res.json();
          setProyectos(Array.isArray(data) ? data : []);
        }
      } else {
        const url = isSuperAdmin
          ? `${SUPABASE_URL}/rest/v1/proyectos?order=nombre.asc&select=id,empresa_id,nombre,region,direccion`
          : `${SUPABASE_URL}/rest/v1/proyectos?empresa_id=eq.${user.empresa_id}&order=nombre.asc&select=id,empresa_id,nombre,region,direccion`;
        const res = await fetch(url, {
          headers: {
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${token}`,
          },
        });
        if (res.ok) {
          const data = await res.json();
          setProyectos(Array.isArray(data) ? data : []);
        }
      }
    } catch {
      setProyectos([]);
    } finally {
      setLoadingProyectos(false);
    }
  }, [isTecnico, isSuperAdmin, usuarioInternoId, user.empresa_id, token]);

  useEffect(() => {
    // Para tecnico esperamos a resolver su id interno antes de cargar sus proyectos
    if (isTecnico && !usuarioInternoId) return;
    fetchProyectos();
  }, [fetchProyectos, isTecnico, usuarioInternoId]);

  const fetchEntradas = useCallback(
    async (proyectoId: string) => {
      setLoadingEntradas(true);
      try {
        const res = await fetch(
          `${SUPABASE_URL}/rest/v1/libro_obra?proyecto_id=eq.${proyectoId}&order=creado_en.desc&select=*`,
          {
            headers: {
              apikey: SUPABASE_KEY,
              Authorization: `Bearer ${token}`,
            },
          }
        );
        if (res.ok) {
          const data: EntradaLibroObra[] = await res.json();
          setEntradas(data || []);

          const autorIds = [...new Set(data.filter((e) => e.autor_id != null).map((e) => String(e.autor_id)))];
          if (autorIds.length > 0) {
            const autoresRes = await fetch(
              `${SUPABASE_URL}/rest/v1/usuarios?id=in.(${autorIds.join(",")})&select=id,nombre`,
              {
                headers: {
                  apikey: SUPABASE_KEY,
                  Authorization: `Bearer ${token}`,
                },
              }
            );
            if (autoresRes.ok) {
              const autoresData: Array<{ id: number | string; nombre: string }> = await autoresRes.json();
              const map: Record<string, string> = {};
              autoresData.forEach((a) => {
                map[String(a.id)] = a.nombre;
              });
              setAutorNombres(map);
            }
          } else {
            setAutorNombres({});
          }

          // Entradas escritas desde el Portal Cliente (autor_id null, autor_portal_cliente_id seteado)
          const clienteIds = [
            ...new Set(data.filter((e) => e.autor_portal_cliente_id != null).map((e) => String(e.autor_portal_cliente_id))),
          ];
          if (clienteIds.length > 0) {
            const clientesRes = await fetch(
              `${SUPABASE_URL}/rest/v1/portal_clientes?id=in.(${clienteIds.join(",")})&select=id,nombre_cliente`,
              {
                headers: {
                  apikey: SUPABASE_KEY,
                  Authorization: `Bearer ${token}`,
                },
              }
            );
            if (clientesRes.ok) {
              const clientesData: Array<{ id: string; nombre_cliente: string }> = await clientesRes.json();
              const map: Record<string, string> = {};
              clientesData.forEach((c) => {
                map[String(c.id)] = c.nombre_cliente;
              });
              setClienteNombres(map);
            }
          } else {
            setClienteNombres({});
          }
        }
      } catch {
        setEntradas([]);
      } finally {
        setLoadingEntradas(false);
      }
    },
    [token]
  );

  const openProyecto = (p: Proyecto) => {
    setSelectedProyecto(p);
    fetchEntradas(p.id);
  };

  const volverALista = () => {
    setSelectedProyecto(null);
    setEntradas([]);
  };

  async function handleCrearEntrada() {
    if (!selectedProyecto || !usuarioInternoId) return;
    if (!contenido.trim()) {
      toast({
        title: "Campo requerido",
        description: "El contenido de la entrada es obligatorio",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/libro_obra`, {
        method: "POST",
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify({
          empresa_id: selectedProyecto.empresa_id,
          proyecto_id: selectedProyecto.id,
          autor_id: usuarioInternoId,
          tipo_evento: tipoEvento,
          contenido: contenido.trim(),
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        let errorMsg = "No se pudo guardar la entrada";
        try {
          const errJson = JSON.parse(errText);
          errorMsg = errJson.message || errJson.error || errorMsg;
        } catch {
          if (errText) errorMsg = errText;
        }
        toast({ title: "Error", description: errorMsg, variant: "destructive" });
        return;
      }

      toast({ title: "Entrada registrada", description: "Se agregó al libro de obra correctamente" });
      setContenido("");
      setTipoEvento("avance");
      setDialogOpen(false);
      fetchEntradas(selectedProyecto.id);
    } catch {
      toast({
        title: "Error de conexión",
        description: "No se pudo guardar la entrada",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  }

  // --- Vista de lista de proyectos ---
  if (!selectedProyecto) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-slate-600" />
          <h2 className="text-lg font-bold text-slate-800">Libro de Obra</h2>
        </div>

        {loadingProyectos ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
          </div>
        ) : proyectos.length === 0 ? (
          <Card className="p-8 text-center">
            <BookOpen className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-muted-foreground">
              {isTecnico ? "No estás asignado a ningún proyecto" : "No hay proyectos registrados"}
            </p>
          </Card>
        ) : (
          <div className="space-y-2">
            {proyectos.map((p) => (
              <Card
                key={p.id}
                className="p-4 hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => openProyecto(p)}
              >
                <p className="font-semibold text-slate-800">{p.nombre}</p>
                {(p.region || p.direccion) && (
                  <p className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                    <MapPin className="w-3 h-3 shrink-0" />
                    {[getRegionTicketLabel(p.region), p.direccion].filter(Boolean).join(" — ")}
                  </p>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    );
  }

  // --- Vista de detalle: feed del libro de obra ---
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={volverALista} className="gap-1 -ml-2">
          <ArrowLeft className="w-4 h-4" />
          Volver
        </Button>
      </div>

      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-slate-600" />
            {selectedProyecto.nombre}
          </h2>
          {(selectedProyecto.region || selectedProyecto.direccion) && (
            <p className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
              <MapPin className="w-3.5 h-3.5 shrink-0" />
              {[getRegionTicketLabel(selectedProyecto.region), selectedProyecto.direccion]
                .filter(Boolean)
                .join(" — ")}
            </p>
          )}
        </div>
        <Button onClick={() => setDialogOpen(true)} className="gap-2 bg-blue-600 hover:bg-blue-700 shrink-0">
          <Plus className="w-4 h-4" />
          Nueva Entrada
        </Button>
      </div>

      {loadingEntradas ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
        </div>
      ) : entradas.length === 0 ? (
        <Card className="p-8 text-center">
          <BookOpen className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <p className="text-muted-foreground">Aún no hay entradas registradas</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {entradas.map((e) => (
            <Card key={e.id} className="p-4">
              <div className="flex items-start justify-between gap-3 mb-2">
                <Badge className={`${tipoEventoColors[e.tipo_evento] || "bg-gray-500"} text-white text-xs shrink-0`}>
                  {tipoEventoLabels[e.tipo_evento] || e.tipo_evento}
                </Badge>
                <span className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                  <Calendar className="w-3 h-3" />
                  {new Date(e.creado_en).toLocaleDateString("es-CL")} ·{" "}
                  {new Date(e.creado_en).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
              <p className="text-sm text-slate-700 whitespace-pre-wrap">{e.contenido}</p>
              <p className="flex items-center gap-1 text-xs text-muted-foreground mt-2 pt-2 border-t">
                <User className="w-3 h-3" />
                {e.autor_portal_cliente_id ? (
                  <>
                    {clienteNombres[String(e.autor_portal_cliente_id)] || "Cliente"}
                    <Badge className="ml-1 bg-sky-100 text-sky-700 hover:bg-sky-100 text-[10px] px-1.5 py-0">
                      Cliente
                    </Badge>
                  </>
                ) : (
                  autorNombres[String(e.autor_id)] || "Usuario"
                )}
              </p>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog Nueva Entrada — las entradas son inmutables, no hay edicion ni borrado */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookOpen className="w-4 h-4" />
              Nueva Entrada
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="tipo-evento">Tipo de evento</Label>
              <Select value={tipoEvento} onValueChange={setTipoEvento}>
                <SelectTrigger id="tipo-evento">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIPO_EVENTO_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="contenido-entrada">Contenido</Label>
              <Textarea
                id="contenido-entrada"
                value={contenido}
                onChange={(e) => setContenido(e.target.value)}
                placeholder="Describe el evento, avance o incidencia..."
                rows={5}
              />
              <p className="text-[10px] text-muted-foreground">
                Esta entrada quedará registrada de forma permanente y no podrá editarse ni eliminarse.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={submitting}>
              Cancelar
            </Button>
            <Button
              onClick={handleCrearEntrada}
              disabled={submitting}
              className="gap-1 bg-blue-600 hover:bg-blue-700 text-white"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Registrar Entrada"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
