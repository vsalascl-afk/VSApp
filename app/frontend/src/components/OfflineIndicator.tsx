import { useState, useEffect } from "react";
import { Wifi, WifiOff, CloudOff, RefreshCw, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { addSyncListener, processSyncQueue, getSyncQueueCount } from "@/lib/syncManager";
import { useToast } from "@/hooks/use-toast";

export default function OfflineIndicator() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncStatus, setSyncStatus] = useState<"syncing" | "idle" | "error">("idle");
  const [manualSyncing, setManualSyncing] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      toast({
        title: "🟢 Conexión restaurada",
        description: "Sincronizando datos pendientes...",
      });
    };
    const handleOffline = () => {
      setIsOnline(false);
      toast({
        title: "🔴 Sin conexión",
        description: "Los datos se guardarán localmente y se sincronizarán cuando vuelva la conexión.",
        variant: "destructive",
      });
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Listen to sync status changes
    const removeSyncListener = addSyncListener((count, status) => {
      setPendingCount(count);
      setSyncStatus(status);
    });

    // Get initial pending count
    getSyncQueueCount().then(setPendingCount);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      removeSyncListener();
    };
  }, [toast]);

  const handleManualSync = async () => {
    if (!navigator.onLine) {
      toast({
        title: "Sin conexión",
        description: "No se puede sincronizar sin internet",
        variant: "destructive",
      });
      return;
    }
    setManualSyncing(true);
    const result = await processSyncQueue();
    setManualSyncing(false);

    if (result.success > 0) {
      toast({
        title: "Sincronización completada",
        description: `${result.success} operación(es) sincronizada(s) exitosamente.`,
      });
    } else if (result.failed > 0) {
      toast({
        title: "Sincronización parcial",
        description: `${result.failed} operación(es) no pudieron sincronizarse. Se reintentará.`,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Todo sincronizado",
        description: "No hay operaciones pendientes.",
      });
    }
  };

  // Don't show anything if online and no pending items
  if (isOnline && pendingCount === 0 && syncStatus === "idle") {
    return null;
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className={`fixed bottom-4 right-4 z-50 flex items-center gap-2 px-3 py-2 rounded-full shadow-lg border transition-all ${
            !isOnline
              ? "bg-red-50 border-red-200 text-red-700"
              : syncStatus === "syncing"
              ? "bg-blue-50 border-blue-200 text-blue-700"
              : pendingCount > 0
              ? "bg-amber-50 border-amber-200 text-amber-700"
              : "bg-green-50 border-green-200 text-green-700"
          }`}
        >
          {!isOnline ? (
            <WifiOff className="w-4 h-4" />
          ) : syncStatus === "syncing" ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : pendingCount > 0 ? (
            <CloudOff className="w-4 h-4" />
          ) : (
            <Check className="w-4 h-4" />
          )}
          <span className="text-xs font-medium">
            {!isOnline
              ? "Offline"
              : syncStatus === "syncing"
              ? "Sincronizando..."
              : pendingCount > 0
              ? `${pendingCount} pendiente${pendingCount > 1 ? "s" : ""}`
              : "Sincronizado"}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72" side="top" align="end">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-sm">Estado de conexión</h4>
            <Badge
              variant="outline"
              className={isOnline ? "bg-green-50 text-green-700 border-green-200" : "bg-red-50 text-red-700 border-red-200"}
            >
              {isOnline ? (
                <><Wifi className="w-3 h-3 mr-1" /> Online</>
              ) : (
                <><WifiOff className="w-3 h-3 mr-1" /> Offline</>
              )}
            </Badge>
          </div>

          <div className="text-xs text-muted-foreground space-y-1">
            {!isOnline && (
              <p>
                📱 La app funciona sin conexión. Los datos se guardan localmente
                y se sincronizarán automáticamente cuando vuelva la señal.
              </p>
            )}
            {pendingCount > 0 && (
              <p className="flex items-center gap-1">
                <CloudOff className="w-3 h-3" />
                <strong>{pendingCount}</strong> operación(es) pendiente(s) de sincronizar.
              </p>
            )}
            {pendingCount === 0 && isOnline && (
              <p className="flex items-center gap-1">
                <Check className="w-3 h-3 text-green-600" />
                Todos los datos están sincronizados.
              </p>
            )}
          </div>

          {pendingCount > 0 && isOnline && (
            <Button
              size="sm"
              className="w-full gap-2"
              onClick={handleManualSync}
              disabled={manualSyncing}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${manualSyncing ? "animate-spin" : ""}`} />
              {manualSyncing ? "Sincronizando..." : "Sincronizar ahora"}
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}