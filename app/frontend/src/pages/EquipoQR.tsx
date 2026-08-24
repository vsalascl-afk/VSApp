import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { SUPABASE_URL, SUPABASE_KEY } from "@/lib/supabase";
import { EmpresaProvider } from "@/lib/empresaContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, QrCode, LogIn, AlertTriangle } from "lucide-react";

interface EquipoBMS {
  id: string;
  empresa_id: string;
  codigo_activo: string;
  nombre: string;
  marca: string;
  modelo: string;
  numero_serie: string;
  ubicacion_edificio: string;
  ubicacion_piso: string;
  ubicacion_area: string;
  tipo_equipo: string;
  notas: string;
  created_at: string;
}

export default function EquipoQRPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [equipo, setEquipo] = useState<EquipoBMS | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (id) {
      fetchEquipo(id);
    }
  }, [id]);

  async function fetchEquipo(equipoId: string) {
    setLoading(true);
    try {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/equipos_bms?id=eq.${equipoId}&select=*`,
        {
          headers: {
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${SUPABASE_KEY}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (res.ok) {
        const data = await res.json();
        if (data && data.length > 0) {
          setEquipo(data[0]);
        } else {
          setError("Equipo no encontrado");
        }
      } else {
        setError("Error al consultar el equipo");
      }
    } catch {
      setError("Error de conexión");
    }
    setLoading(false);
  }

  function goToApp() {
    // Navegar a la app principal, pasando el ID del equipo como parámetro
    // para que se abra directamente en la ficha del activo
    const params = new URLSearchParams({ equipo_id: id || "" });
    navigate(`/?${params.toString()}`);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          <p className="text-sm text-muted-foreground">Cargando equipo...</p>
        </div>
      </div>
    );
  }

  if (error || !equipo) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-red-50 p-4">
        <Card className="max-w-sm w-full">
          <CardContent className="p-6 text-center space-y-4">
            <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto" />
            <h2 className="text-lg font-bold text-slate-800">
              {error || "Equipo no encontrado"}
            </h2>
            <p className="text-sm text-muted-foreground">
              El código QR escaneado no corresponde a un equipo registrado o no tiene permisos para verlo.
            </p>
            <Button onClick={() => navigate("/")} className="w-full gap-2">
              <LogIn className="w-4 h-4" />
              Ir al inicio
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-4">
      <div className="max-w-lg mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3 pt-4">
          <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center text-white">
            <QrCode className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-800">Ficha de Equipo</h1>
            <p className="text-xs text-muted-foreground">VSApp - QR Equipos</p>
          </div>
        </div>

        {/* Equipo info */}
        <Card className="border-l-4 border-l-blue-600">
          <CardContent className="p-4 space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-bold text-lg text-slate-800">{equipo.nombre}</h2>
              <Badge variant="outline">{equipo.codigo_activo}</Badge>
            </div>

            {equipo.tipo_equipo && (
              <Badge variant="secondary">{equipo.tipo_equipo}</Badge>
            )}

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase">Marca</p>
                <p className="text-slate-700">{equipo.marca || "—"}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase">Modelo</p>
                <p className="text-slate-700">{equipo.modelo || "—"}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase">N° Serie</p>
                <p className="text-slate-700">{equipo.numero_serie || "—"}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase">Ubicación</p>
                <p className="text-slate-700">
                  {equipo.ubicacion_edificio || "—"}
                  {equipo.ubicacion_piso ? ` P${equipo.ubicacion_piso}` : ""}
                  {equipo.ubicacion_area ? ` - ${equipo.ubicacion_area}` : ""}
                </p>
              </div>
            </div>

            {equipo.notas && (
              <div className="pt-3 border-t">
                <p className="text-xs font-medium text-muted-foreground uppercase mb-1">Notas</p>
                <p className="text-sm text-slate-700 whitespace-pre-wrap">{equipo.notas}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* CTA - Abrir en la app */}
        <Card>
          <CardContent className="p-4 text-center space-y-3">
            <p className="text-sm text-muted-foreground">
              Para ver el historial completo, crear OTs y acceder a todas las funciones, inicie sesión en la plataforma.
            </p>
            <Button onClick={goToApp} className="w-full gap-2 bg-blue-600 hover:bg-blue-700">
              <LogIn className="w-4 h-4" />
              Abrir en VSApp
            </Button>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground pb-4">
          © {new Date().getFullYear()} VSA - VSApp
        </p>
      </div>
    </div>
  );
}