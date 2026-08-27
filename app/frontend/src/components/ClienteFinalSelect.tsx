import { useState, useEffect, useCallback } from "react";
import type { Usuario } from "@/lib/types";
import { SUPABASE_URL, SUPABASE_KEY } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export const NUEVO_CLIENTE_VALUE = "__nuevo__";

interface ClienteFinalOption {
  id: string;
  nombre_cliente: string;
}

interface ClienteFinalSelectProps {
  user: Usuario;
  token: string;
  /** clienteFinalId seleccionado: "" = ninguno, NUEVO_CLIENTE_VALUE = creando uno nuevo */
  value: string;
  /** Se llama con (id, nombre_cliente) cada vez que cambia la seleccion o se crea un cliente nuevo */
  onChange: (clienteFinalId: string, nombreCliente: string) => void;
  placeholder?: string;
}

/**
 * Select reutilizable de "Cliente" conectado al mantenedor real (portal_clientes),
 * con opcion "+ Nuevo cliente..." que crea el registro inline. Usado por
 * CreateOTForm, QREquiposModule y ProgramacionModule al crear una OT.
 */
export default function ClienteFinalSelect({ user, token, value, onChange, placeholder }: ClienteFinalSelectProps) {
  const { toast } = useToast();
  const [clientesFinales, setClientesFinales] = useState<ClienteFinalOption[]>([]);
  const [showNuevoCliente, setShowNuevoCliente] = useState(false);
  const [nuevoClienteNombre, setNuevoClienteNombre] = useState("");
  const [creandoCliente, setCreandoCliente] = useState(false);

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
    fetchClientesFinales();
  }, [fetchClientesFinales]);

  const handleValueChange = (v: string) => {
    if (v === NUEVO_CLIENTE_VALUE) {
      setShowNuevoCliente(true);
      onChange(NUEVO_CLIENTE_VALUE, "");
      return;
    }
    setShowNuevoCliente(false);
    const found = clientesFinales.find((c) => c.id === v);
    onChange(v, found?.nombre_cliente || "");
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
        setShowNuevoCliente(false);
        setNuevoClienteNombre("");
        onChange(nuevo.id, nuevo.nombre_cliente);
        toast({ title: "Cliente creado", description: "Se agregó correctamente al mantenedor de clientes" });
      }
    } catch {
      toast({ title: "Error de conexión", description: "No se pudo crear el cliente", variant: "destructive" });
    } finally {
      setCreandoCliente(false);
    }
  };

  return (
    <div>
      <Select value={value} onValueChange={handleValueChange}>
        <SelectTrigger>
          <SelectValue placeholder={placeholder || "Selecciona un cliente"} />
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
  );
}
