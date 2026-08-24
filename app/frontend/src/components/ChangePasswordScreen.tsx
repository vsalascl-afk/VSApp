import { useState } from "react";
import { supabase, SUPABASE_URL, SUPABASE_SERVICE_KEY } from "@/lib/supabase";
import type { Usuario } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KeyRound, Loader2, ShieldCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ChangePasswordScreenProps {
  user: Usuario;
  token: string;
  onPasswordChanged: () => void;
}

export default function ChangePasswordScreen({
  user,
  token,
  onPasswordChanged,
}: ChangePasswordScreenProps) {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { toast } = useToast();

  const handleChangePassword = async () => {
    setError("");

    if (!newPassword || !confirmPassword) {
      setError("Completa ambos campos");
      return;
    }

    if (newPassword.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Las contraseñas no coinciden");
      return;
    }

    setLoading(true);

    try {
      // Update password in Supabase Auth
      const { error: authError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (authError) {
        setError(authError.message || "No se pudo cambiar la contraseña");
        setLoading(false);
        return;
      }

      // Update debe_cambiar_password flag to false in usuarios table
      const serviceKey = SUPABASE_SERVICE_KEY;
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/usuarios?id=eq.${user.id}`,
        {
          method: "PATCH",
          headers: {
            apikey: serviceKey || token,
            Authorization: `Bearer ${serviceKey || token}`,
            "Content-Type": "application/json",
            Prefer: "return=minimal",
          },
          body: JSON.stringify({ debe_cambiar_password: false }),
        }
      );

      if (!res.ok) {
        // Even if this fails, password was changed successfully
        console.error("Error updating debe_cambiar_password flag");
      }

      toast({
        title: "Contraseña actualizada",
        description: "Tu contraseña ha sido cambiada exitosamente",
      });

      onPasswordChanged();
    } catch {
      setError("Error de conexión");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 to-blue-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto w-14 h-14 bg-amber-500 rounded-full flex items-center justify-center">
            <KeyRound className="w-7 h-7 text-white" />
          </div>
          <CardTitle className="text-xl font-bold text-slate-800">
            Cambio de Contraseña Obligatorio
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Hola <strong>{user.nombre}</strong>, por seguridad debes cambiar tu
            contraseña en tu primer ingreso.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="new-pass">Nueva contraseña</Label>
            <Input
              id="new-pass"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Mínimo 6 caracteres"
              onKeyDown={(e) => e.key === "Enter" && handleChangePassword()}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirm-pass">Confirmar contraseña</Label>
            <Input
              id="confirm-pass"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repite la contraseña"
              onKeyDown={(e) => e.key === "Enter" && handleChangePassword()}
            />
          </div>
          {error && (
            <p className="text-sm text-red-500 text-center">{error}</p>
          )}
          <Button
            onClick={handleChangePassword}
            disabled={loading}
            className="w-full bg-amber-600 hover:bg-amber-700 gap-2"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <ShieldCheck className="w-4 h-4" />
            )}
            {loading ? "Cambiando..." : "Cambiar Contraseña"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}