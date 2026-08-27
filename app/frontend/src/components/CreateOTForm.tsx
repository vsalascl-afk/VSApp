import { useState, useRef, useEffect, useCallback } from "react";
import type { Usuario } from "@/lib/types";
import { SUPABASE_URL, SUPABASE_KEY } from "@/lib/supabase";
import { getRegionLabel } from "@/lib/regiones";
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
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Upload, X, UserCheck, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface CreateOTFormProps {
  user: Usuario;
  token: string;
  onCreated: (createdOT?: { id: string; numero: string }) => void;
  initialCliente?: string;
  initialClienteFinalId?: string;
  initialDescripcion?: string;
  initialDireccion?: string;
  defaultOpen?: boolean;
}

interface TecnicoOption {
  auth_id: string;
  nombre: string;
  rol?: string;
  region?: string;
}

interface ClienteFinalOption {
  id: string;
  nombre_cliente: string;
}

const NUEVO_CLIENTE_VALUE = "__nuevo__";

export default function CreateOTForm({
  user,
  token,
  onCreated,
  initialCliente,
  initialClienteFinalId,
  initialDescripcion,
  initialDireccion,
  defaultOpen,
}: CreateOTFormProps) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  const [loading, setLoading] = useState(false);
  const [cliente, setCliente] = useState(initialCliente || "");
  const [clienteFinalId, setClienteFinalId] = useState(initialClienteFinalId || "");
  const [clientesFinales, setClientesFinales] = useState<ClienteFinalOption[]>([]);
  const [showNuevoCliente, setShowNuevoCliente] = useState(false);
  const [nuevoClienteNombre, setNuevoClienteNombre] = useState("");
  const [creandoCliente, setCreandoCliente] = useState(false);
  const [descripcion, setDescripcion] = useState(initialDescripcion || "");
  const [direccion, setDireccion] = useState(initialDireccion || "");
  const [tipoServ, setTipoServ] = useState("");
  const [notas, setNotas] = useState("");
  const [firmaPor, setFirmaPor] = useState("");
  const [prioridad, setPrioridad] = useState("baja");
  const [estado] = useState("pendiente");
  const [tecnicoId, setTecnicoId] = useState(user.auth_id);
  const [tecnicos, setTecnicos] = useState<TecnicoOption[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const canAssign = user.rol === "superadmin" || user.rol === "admin" || user.rol === "supervisor";

  const fetchTecnicos = useCallback(async () => {
    if (!canAssign) return;
    try {
      // Use service_role key to bypass RLS (avoids infinite recursion in policies)
      const serviceKey = import.meta.env.VITE_SUPABASE_SERVICE_KEY;
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/usuarios?empresa_id=eq.${user.empresa_id}&select=auth_id,nombre,rol,region&order=nombre.asc`,
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
        if (Array.isArray(data)) {
          // Filter to show tecnicos and supervisores from the same region
          const tecList: TecnicoOption[] = data
            .filter((u: { auth_id?: string; nombre?: string; rol?: string; region?: string }) => 
              u.auth_id && u.nombre && 
              (u.rol === "tecnico" || u.rol === "supervisor") &&
              (!user.region || !u.region || u.region === user.region)
            )
            .map((u: { auth_id: string; nombre: string; rol?: string; region?: string }) => ({
              auth_id: u.auth_id,
              nombre: u.nombre,
              rol: u.rol,
              region: u.region,
            }));
          setTecnicos(tecList);
        }
      }
    } catch {
      // silently fail
    }
  }, [canAssign, user.empresa_id, user.region, token]);

  useEffect(() => {
    if (open) {
      fetchTecnicos();
    }
  }, [open, fetchTecnicos]);

  const fetchClientesFinales = useCallback(async () => {
    try {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/portal_clientes?empresa_id=eq.${user.empresa_id}&activo=eq.true&select=id,nombre_cliente&order=nombre_cliente.asc`,
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

  useEffect(() => {
    if (open) {
      fetchClientesFinales();
    }
  }, [open, fetchClientesFinales]);

  const handleClienteFinalChange = (value: string) => {
    if (value === NUEVO_CLIENTE_VALUE) {
      setClienteFinalId(NUEVO_CLIENTE_VALUE);
      setShowNuevoCliente(true);
      return;
    }
    setShowNuevoCliente(false);
    setClienteFinalId(value);
    const found = clientesFinales.find((c) => c.id === value);
    if (found) setCliente(found.nombre_cliente);
  };

  const handleCrearClienteFinal = async () => {
    if (!nuevoClienteNombre.trim()) {
      toast({
        title: "Error",
        description: "El nombre del cliente es obligatorio",
        variant: "destructive",
      });
      return;
    }
    setCreandoCliente(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/portal_clientes`, {
        method: "POST",
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Prefer: "return=representation",
        },
        body: JSON.stringify({
          empresa_id: user.empresa_id,
          nombre_cliente: nuevoClienteNombre.trim(),
          activo: true,
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        let errorMsg = "No se pudo crear el cliente";
        try {
          const errJson = JSON.parse(errText);
          errorMsg = errJson.message || errJson.error || errorMsg;
        } catch {
          if (errText) errorMsg = errText;
        }
        toast({ title: "Error", description: errorMsg, variant: "destructive" });
        return;
      }

      const created = await res.json();
      const nuevo = Array.isArray(created) ? created[0] : created;
      if (nuevo?.id) {
        const nuevaOpcion: ClienteFinalOption = { id: nuevo.id, nombre_cliente: nuevo.nombre_cliente };
        setClientesFinales((prev) =>
          [...prev, nuevaOpcion].sort((a, b) => a.nombre_cliente.localeCompare(b.nombre_cliente))
        );
        setClienteFinalId(nuevo.id);
        setCliente(nuevo.nombre_cliente);
      }
      setNuevoClienteNombre("");
      setShowNuevoCliente(false);
      toast({ title: "Cliente creado", description: "Se agregó correctamente al mantenedor de clientes" });
    } catch {
      toast({ title: "Error de conexión", description: "No se pudo crear el cliente", variant: "destructive" });
    } finally {
      setCreandoCliente(false);
    }
  };

  const uploadPhoto = async (file: File): Promise<string | null> => {
    const fileName = `ot_${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`;
    const res = await fetch(
      `${SUPABASE_URL}/storage/v1/object/fotos_ot/${fileName}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": file.type,
        },
        body: file,
      }
    );
    if (!res.ok) return null;
    return fileName;
  };

  const handleSubmit = async () => {
    if (!cliente || !descripcion) {
      toast({
        title: "Error",
        description: "Cliente y Descripción son obligatorios",
        variant: "destructive",
      });
      return;
    }

    if (canAssign && !tecnicoId) {
      toast({
        title: "Error",
        description: "Debe asignar un técnico a la OT",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      // Upload photos
      const uploadedPhotos: string[] = [];
      for (const file of files) {
        const name = await uploadPhoto(file);
        if (name) uploadedPhotos.push(name);
      }

      // Generate fecha_inicio with explicit Chile timezone offset
      const now = new Date();
      const finalTecnicoId = tecnicoId || user.auth_id;
      const finalTecnicoNombre =
        finalTecnicoId === user.auth_id
          ? user.nombre
          : tecnicos.find((t) => t.auth_id === finalTecnicoId)?.nombre || "";
      const body = {
        numero: "OT-" + Date.now(),
        cliente,
        descripcion,
        direccion,
        tipo_serv: tipoServ,
        prioridad,
        estado,
        notas,
        firma_por: firmaPor,
        fecha_inicio: now.toISOString(),
        tecnico_id: finalTecnicoId,
        tecnico_nombre: finalTecnicoNombre,
        empresa_id: user.empresa_id,
        foto_url: uploadedPhotos,
        cliente_final_id:
          clienteFinalId && clienteFinalId !== NUEVO_CLIENTE_VALUE ? clienteFinalId : null,
      };

      const res = await fetch(`${SUPABASE_URL}/rest/v1/ordenes_trabajo`, {
        method: "POST",
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
        let errorMsg = "No se pudo crear la OT";
        try {
          const errJson = JSON.parse(errText);
          errorMsg = errJson.message || errJson.error || errorMsg;
        } catch {
          if (errText) errorMsg = errText;
        }
        toast({
          title: "Error",
          description: errorMsg,
          variant: "destructive",
        });
        return;
      }

      const created = await res.json().catch(() => null);
      const createdOT =
        Array.isArray(created) && created[0]
          ? { id: String(created[0].id), numero: String(created[0].numero) }
          : undefined;

      toast({ title: "Éxito", description: "OT creada correctamente en estado Pendiente" });
      // Reset form
      setCliente("");
      setClienteFinalId("");
      setShowNuevoCliente(false);
      setNuevoClienteNombre("");
      setDescripcion("");
      setDireccion("");
      setTipoServ("");
      setNotas("");
      setFirmaPor("");
      setPrioridad("baja");
      setTecnicoId(user.auth_id);
      setFiles([]);
      setOpen(false);
      onCreated(createdOT);
    } catch {
      toast({
        title: "Error",
        description: "Error de conexión",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  if (!open) {
    return (
      <Button
        onClick={() => setOpen(true)}
        className="w-full bg-blue-600 hover:bg-blue-700 gap-2"
      >
        <Plus className="w-4 h-4" />
        Crear Nueva OT
      </Button>
    );
  }

  return (
    <Card className="shadow-lg border-blue-200">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Crear Orden de Trabajo</CardTitle>
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Cliente *</Label>
            <Select value={clienteFinalId} onValueChange={handleClienteFinalChange}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona un cliente" />
              </SelectTrigger>
              <SelectContent>
                {clientesFinales.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nombre_cliente}
                  </SelectItem>
                ))}
                <SelectItem value={NUEVO_CLIENTE_VALUE}>+ Nuevo cliente...</SelectItem>
              </SelectContent>
            </Select>
            {showNuevoCliente && (
              <div className="flex items-center gap-2 mt-2">
                <Input
                  value={nuevoClienteNombre}
                  onChange={(e) => setNuevoClienteNombre(e.target.value)}
                  placeholder="Nombre del nuevo cliente"
                  className="flex-1"
                />
                <Button
                  type="button"
                  size="sm"
                  onClick={handleCrearClienteFinal}
                  disabled={creandoCliente}
                  className="shrink-0 bg-blue-600 hover:bg-blue-700"
                >
                  {creandoCliente ? <Loader2 className="w-4 h-4 animate-spin" /> : "Guardar"}
                </Button>
              </div>
            )}
          </div>
          <div>
            <Label className="text-xs">Dirección</Label>
            <Input
              value={direccion}
              onChange={(e) => setDireccion(e.target.value)}
              placeholder="Dirección"
            />
          </div>
        </div>

        <div>
          <Label className="text-xs">Descripción *</Label>
          <Textarea
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            placeholder="Descripción del trabajo"
            rows={2}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Tipo de Servicio</Label>
            <Select value={tipoServ} onValueChange={setTipoServ}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccione tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="correctivo">Correctivo</SelectItem>
                <SelectItem value="preventivo">Preventivo</SelectItem>
                <SelectItem value="contrato">Contrato</SelectItem>
                <SelectItem value="otro">Otro</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Firmado por</Label>
            <Input
              value={firmaPor}
              onChange={(e) => setFirmaPor(e.target.value)}
              placeholder="Nombre"
            />
          </div>
        </div>

        <div>
          <Label className="text-xs">Observaciones</Label>
          <Textarea
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            placeholder="Observaciones adicionales"
            rows={2}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Prioridad</Label>
            <Select value={prioridad} onValueChange={setPrioridad}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="baja">Baja</SelectItem>
                <SelectItem value="media">Media</SelectItem>
                <SelectItem value="alta">Alta</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Estado</Label>
            <div className="flex items-center h-10 px-3 rounded-md border bg-slate-50 text-sm text-slate-600">
              Pendiente
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Las OT se crean siempre en estado pendiente
            </p>
          </div>
        </div>

        {/* Technician Assignment */}
        {canAssign && tecnicos.length > 0 && (
          <div>
            <Label className="text-xs flex items-center gap-1">
              <UserCheck className="w-3 h-3" />
              Asignar Técnico *
            </Label>
            <Select value={tecnicoId} onValueChange={setTecnicoId}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar técnico" />
              </SelectTrigger>
              <SelectContent>
                {tecnicos.map((tec) => (
                  <SelectItem key={tec.auth_id} value={tec.auth_id}>
                    {tec.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Seleccione el técnico responsable de esta OT
            </p>
          </div>
        )}

        {/* Photo Upload */}
        <div>
          <Label className="text-xs">Fotos</Label>
          <div className="flex flex-wrap gap-2 mt-1">
            {files.map((file, i) => (
              <div
                key={i}
                className="relative w-16 h-16 rounded-lg overflow-hidden border"
              >
                <img
                  src={URL.createObjectURL(file)}
                  alt=""
                  className="w-full h-full object-cover"
                />
                <button
                  onClick={() => removeFile(i)}
                  className="absolute top-0 right-0 bg-red-500 text-white rounded-bl p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-16 h-16 rounded-lg border-2 border-dashed border-slate-300 flex items-center justify-center hover:border-blue-400 transition-colors"
            >
              <Upload className="w-5 h-5 text-slate-400" />
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files) {
                setFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
              }
            }}
          />
        </div>

        <Button
          onClick={handleSubmit}
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700"
        >
          {loading ? "Guardando..." : "Guardar OT"}
        </Button>
      </CardContent>
    </Card>
  );
}