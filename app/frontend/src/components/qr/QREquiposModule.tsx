import { useState, useEffect, useCallback, useRef } from "react";
import { useEmpresa } from "@/lib/empresaContext";
import type { Usuario } from "@/lib/types";
import { SUPABASE_URL, SUPABASE_KEY, SUPABASE_SERVICE_KEY } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogFooter,
  DialogHeader,
  DialogDescription,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  QrCode,
  Plus,
  Pencil,
  Trash2,
  Download,
  Upload,
  Search,
  ScanLine,
  ShieldAlert,
  Loader2,
  History,
  X,
  Wrench,
  ClipboardList,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Clock,
  CalendarDays,
} from "lucide-react";
import QRCode from "qrcode";
import { Html5Qrcode } from "html5-qrcode";
import * as XLSX from "xlsx";

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

interface OTRecord {
  id: string;
  numero: string;
  descripcion: string;
  estado: string;
  prioridad: string;
  tipo_serv: string;
  fecha_inicio: string;
  fecha_cierre?: string;
  tecnico_nombre?: string;
  tecnico_id?: string;
  notas?: string;
}

interface Props {
  user: Usuario;
  token: string;
  onScanResult?: (equipo: EquipoBMS) => void;
  onNavigate?: (section: string) => void;
}

type SubView = "catalogo" | "escanear" | "ficha_activo";
type FichaTab = "caracteristicas" | "preventivo" | "correctivo" | "documentos";

interface ActivoDocumento {
  id: string;
  empresa_id: string;
  equipo_id: string;
  nombre: string;
  descripcion: string;
  tipo: string;
  archivo_url: string;
  archivo_nombre: string;
  archivo_size: number;
  subido_por: string;
  created_at: string;
}

const TIPOS_DOCUMENTO = [
  { value: "manual", label: "Manual" },
  { value: "ficha_tecnica", label: "Ficha Técnica" },
  { value: "plano", label: "Plano" },
  { value: "certificado", label: "Certificado" },
  { value: "otro", label: "Otro" },
];

const defaultEquipo: Omit<EquipoBMS, "id" | "empresa_id" | "created_at"> = {
  codigo_activo: "",
  nombre: "",
  marca: "",
  modelo: "",
  numero_serie: "",
  ubicacion_edificio: "",
  ubicacion_piso: "",
  ubicacion_area: "",
  tipo_equipo: "",
  notas: "",
};

const TIPOS_EQUIPO = [
  "Controlador BMS",
  "UMA (Unidad Manejadora de Aire)",
  "Chiller",
  "Bomba de Calor",
  "Fan Coil",
  "VAV",
  "Switch Industrial",
  "Servidor BMS",
  "Sensor",
  "Actuador",
  "UPS",
  "Generador",
  "Panel Eléctrico",
  "Otro",
];

export default function QREquiposModule({ user, token, onScanResult, onNavigate }: Props) {
  const { empresa, colorPrimario } = useEmpresa();
  const { toast } = useToast();
  const [moduleActive, setModuleActive] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [equipos, setEquipos] = useState<EquipoBMS[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [subView, setSubView] = useState<SubView>("catalogo");

  // Dialog state
  const [showDialog, setShowDialog] = useState(false);
  const [editingEquipo, setEditingEquipo] = useState<EquipoBMS | null>(null);
  const [form, setForm] = useState(defaultEquipo);
  const [saving, setSaving] = useState(false);

  // QR state
  const [showQRDialog, setShowQRDialog] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [qrEquipo, setQrEquipo] = useState<EquipoBMS | null>(null);

  // Scanner state
  const [scanning, setScanning] = useState(false);
  const [scannerRef, setScannerRef] = useState<Html5Qrcode | null>(null);

  // Ficha de Activo state
  const [selectedEquipo, setSelectedEquipo] = useState<EquipoBMS | null>(null);
  const [fichaTab, setFichaTab] = useState<FichaTab>("caracteristicas");
  const [historialPreventivo, setHistorialPreventivo] = useState<Record<string, unknown>[]>([]);
  const [historialCorrectivo, setHistorialCorrectivo] = useState<OTRecord[]>([]);
  const [loadingHistorial, setLoadingHistorial] = useState(false);

  // Create OT Dialog state
  const [showCreateOTDialog, setShowCreateOTDialog] = useState(false);
  const [otForm, setOtForm] = useState({
    descripcion: "",
    tipo_serv: "",
    prioridad: "media" as "baja" | "media" | "alta",
    notas: "",
    tecnico_id: "",
  });
  const [savingOT, setSavingOT] = useState(false);
  const [otTecnicos, setOtTecnicos] = useState<{ auth_id: string; nombre: string; rol?: string }[]>([]);
  const [loadingTecnicos, setLoadingTecnicos] = useState(false);

  // Documentos state
  const [documentos, setDocumentos] = useState<ActivoDocumento[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [showDocDialog, setShowDocDialog] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [docForm, setDocForm] = useState({
    nombre: "",
    descripcion: "",
    tipo: "manual",
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  useEffect(() => {
    checkModuleLicense();
  }, [empresa]);

  useEffect(() => {
    if (moduleActive) {
      fetchEquipos();
    }
  }, [moduleActive, empresa]);

  // Cleanup scanner on unmount
  useEffect(() => {
    return () => {
      if (scannerRef) {
        scannerRef.stop().catch(() => {});
      }
    };
  }, [scannerRef]);

  async function checkModuleLicense() {
    if (!empresa) {
      setModuleActive(false);
      setLoading(false);
      return;
    }

    const isPrivileged = user.rol === "superadmin" || user.rol === "admin";

    try {
      const authKey = SUPABASE_SERVICE_KEY || token;
      const apiKey = SUPABASE_SERVICE_KEY || SUPABASE_KEY;
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/company_modules?empresa_id=eq.${empresa.id}&module_name=eq.qr_equipos`,
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
      console.error("QR Module license check error:", err);
      setModuleActive(isPrivileged);
    }
    setLoading(false);
  }

  async function fetchEquipos() {
    if (!empresa) return;
    try {
      const authKey = SUPABASE_SERVICE_KEY || token;
      const apiKey = SUPABASE_SERVICE_KEY || SUPABASE_KEY;
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/equipos_bms?empresa_id=eq.${empresa.id}&order=nombre.asc`,
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
        setEquipos(data || []);
      }
    } catch (err) {
      console.error("Error fetching equipos:", err);
    }
  }

  async function handleSave() {
    if (!empresa) return;
    if (!form.codigo_activo.trim() || !form.nombre.trim()) {
      toast({
        title: "Campos requeridos",
        description: "El código activo y nombre son obligatorios",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const authKey = SUPABASE_SERVICE_KEY || token;
      const apiKey = SUPABASE_SERVICE_KEY || SUPABASE_KEY;
      const body = { ...form, empresa_id: empresa.id };

      let url = `${SUPABASE_URL}/rest/v1/equipos_bms`;
      let method = "POST";

      if (editingEquipo) {
        url += `?id=eq.${editingEquipo.id}`;
        method = "PATCH";
      }

      const res = await fetch(url, {
        method,
        headers: {
          apikey: apiKey,
          Authorization: `Bearer ${authKey}`,
          "Content-Type": "application/json",
          Prefer: "return=representation",
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        throw new Error("Error al guardar equipo");
      }

      toast({
        title: editingEquipo ? "Equipo actualizado" : "Equipo creado",
        description: `${form.nombre} se ha ${editingEquipo ? "actualizado" : "registrado"} correctamente`,
      });

      setShowDialog(false);
      setEditingEquipo(null);
      setForm(defaultEquipo);
      fetchEquipos();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error al guardar";
      toast({ title: "Error", description: msg, variant: "destructive" });
    }
    setSaving(false);
  }

  async function handleDelete(equipo: EquipoBMS) {
    if (!confirm(`¿Eliminar equipo "${equipo.nombre}"?`)) return;

    try {
      const authKey = SUPABASE_SERVICE_KEY || token;
      const apiKey = SUPABASE_SERVICE_KEY || SUPABASE_KEY;
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/equipos_bms?id=eq.${equipo.id}`,
        {
          method: "DELETE",
          headers: {
            apikey: apiKey,
            Authorization: `Bearer ${authKey}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!res.ok) throw new Error("Error al eliminar");

      toast({ title: "Equipo eliminado", description: equipo.nombre });
      fetchEquipos();
    } catch {
      toast({ title: "Error", description: "No se pudo eliminar", variant: "destructive" });
    }
  }

  async function generateQR(equipo: EquipoBMS) {
    try {
      // Generar URL que se pueda abrir desde cualquier lector QR
      const baseUrl = window.location.origin;
      const qrContent = `${baseUrl}/equipo/${equipo.id}`;

      const dataUrl = await QRCode.toDataURL(qrContent, {
        width: 300,
        margin: 2,
        color: { dark: "#000000", light: "#ffffff" },
      });

      setQrDataUrl(dataUrl);
      setQrEquipo(equipo);
      setShowQRDialog(true);
    } catch {
      toast({ title: "Error", description: "No se pudo generar el QR", variant: "destructive" });
    }
  }

  function downloadQR() {
    if (!qrDataUrl || !qrEquipo) return;
    const link = document.createElement("a");
    link.download = `QR_${qrEquipo.codigo_activo}_${qrEquipo.nombre.replace(/\s+/g, "_")}.png`;
    link.href = qrDataUrl;
    link.click();
  }

  async function startScanner() {
    setScanning(true);
    setSubView("escanear");

    setTimeout(async () => {
      try {
        const html5QrCode = new Html5Qrcode("qr-reader");
        setScannerRef(html5QrCode);

        await html5QrCode.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          async (decodedText) => {
            await html5QrCode.stop();
            setScannerRef(null);
            setScanning(false);
            handleScanResult(decodedText);
          },
          () => {}
        );
      } catch (err) {
        console.error("Scanner error:", err);
        setScanning(false);
        toast({
          title: "Error de cámara",
          description: "No se pudo acceder a la cámara. Verifique los permisos.",
          variant: "destructive",
        });
      }
    }, 300);
  }

  async function stopScanner() {
    if (scannerRef) {
      try {
        await scannerRef.stop();
      } catch {
        // ignore
      }
      setScannerRef(null);
    }
    setScanning(false);
  }

  async function handleScanResult(decodedText: string) {
    try {
      let equipoId: string | null = null;

      // Intentar extraer ID desde URL (nuevo formato: /equipo/{id})
      const urlMatch = decodedText.match(/\/equipo\/([a-f0-9-]+)/i);
      if (urlMatch) {
        equipoId = urlMatch[1];
      } else {
        // Fallback: intentar parsear como JSON (formato antiguo)
        try {
          const data = JSON.parse(decodedText);
          if (data.type === "equipo_bms" && data.id) {
            equipoId = data.id;
          }
        } catch {
          // No es JSON ni URL válida
        }
      }

      if (!equipoId) {
        toast({
          title: "QR no válido",
          description: "El código escaneado no es un QR de equipo válido.",
          variant: "destructive",
        });
        return;
      }

      // Buscar equipo por ID
      let equipo = equipos.find((e) => e.id === equipoId);
      if (!equipo) {
        const authKey = SUPABASE_SERVICE_KEY || token;
        const apiKey = SUPABASE_SERVICE_KEY || SUPABASE_KEY;
        const res = await fetch(
          `${SUPABASE_URL}/rest/v1/equipos_bms?id=eq.${equipoId}`,
          {
            headers: {
              apikey: apiKey,
              Authorization: `Bearer ${authKey}`,
              "Content-Type": "application/json",
            },
          }
        );
        if (res.ok) {
          const arr = await res.json();
          equipo = arr?.[0];
        }
      }

      if (equipo) {
        toast({
          title: "Equipo encontrado",
          description: `${equipo.nombre} (${equipo.codigo_activo})`,
        });

        if (onScanResult) {
          onScanResult(equipo);
        } else {
          openFichaActivo(equipo);
        }
      } else {
        toast({
          title: "Equipo no encontrado",
          description: "El código QR no corresponde a un equipo registrado en esta empresa.",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "QR no reconocido",
        description: "El código escaneado no tiene el formato esperado.",
        variant: "destructive",
      });
    }
  }

  function openFichaActivo(equipo: EquipoBMS) {
    setSelectedEquipo(equipo);
    setFichaTab("caracteristicas");
    setSubView("ficha_activo");
    fetchHistorialPreventivo(equipo);
    fetchHistorialCorrectivo(equipo);
    fetchDocumentos(equipo);
  }

  const fetchHistorialPreventivo = useCallback(async (equipo: EquipoBMS) => {
    if (!empresa) return;
    setLoadingHistorial(true);
    try {
      const authKey = SUPABASE_SERVICE_KEY || token;
      const apiKey = SUPABASE_SERVICE_KEY || SUPABASE_KEY;
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/checklist_bms?empresa_id=eq.${empresa.id}&informacion_general->>codigo_activo=eq.${encodeURIComponent(equipo.codigo_activo)}&order=created_at.desc&limit=50`,
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
        setHistorialPreventivo(data || []);
      }
    } catch (err) {
      console.error("Error fetching historial preventivo:", err);
    }
    setLoadingHistorial(false);
  }, [empresa, token]);

  const fetchHistorialCorrectivo = useCallback(async (equipo: EquipoBMS) => {
    if (!empresa) return;
    try {
      const authKey = SUPABASE_SERVICE_KEY || token;
      const apiKey = SUPABASE_SERVICE_KEY || SUPABASE_KEY;
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/ordenes_trabajo?empresa_id=eq.${empresa.id}&codigo_activo=eq.${encodeURIComponent(equipo.codigo_activo)}&order=fecha_inicio.desc&limit=50`,
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
        setHistorialCorrectivo(data || []);
      }
    } catch (err) {
      console.error("Error fetching historial correctivo:", err);
    }
  }, [empresa, token]);

  const fetchDocumentos = useCallback(async (equipo: EquipoBMS) => {
    if (!empresa) return;
    setLoadingDocs(true);
    try {
      const authKey = SUPABASE_SERVICE_KEY || token;
      const apiKey = SUPABASE_SERVICE_KEY || SUPABASE_KEY;
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/activo_documentos?empresa_id=eq.${empresa.id}&equipo_id=eq.${equipo.id}&order=created_at.desc`,
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
        setDocumentos(data || []);
      }
    } catch (err) {
      console.error("Error fetching documentos:", err);
    }
    setLoadingDocs(false);
  }, [empresa, token]);

  async function handleUploadDoc() {
    if (!empresa || !selectedEquipo || !selectedFile) {
      toast({
        title: "Error",
        description: "Seleccione un archivo para subir",
        variant: "destructive",
      });
      return;
    }

    if (!docForm.nombre.trim()) {
      toast({
        title: "Campo requerido",
        description: "El nombre del documento es obligatorio",
        variant: "destructive",
      });
      return;
    }

    setUploadingDoc(true);
    try {
      const authKey = SUPABASE_SERVICE_KEY || token;
      const apiKey = SUPABASE_SERVICE_KEY || SUPABASE_KEY;

      // Upload file to Supabase Storage
      const fileExt = selectedFile.name.split(".").pop() || "pdf";
      const fileName = `${empresa.id}/${selectedEquipo.id}/${Date.now()}_${selectedFile.name}`;

      const uploadRes = await fetch(
        `${SUPABASE_URL}/storage/v1/object/activo_documentos/${fileName}`,
        {
          method: "POST",
          headers: {
            apikey: apiKey,
            Authorization: `Bearer ${authKey}`,
            "Content-Type": selectedFile.type || "application/octet-stream",
            "x-upsert": "true",
          },
          body: selectedFile,
        }
      );

      if (!uploadRes.ok) {
        const errText = await uploadRes.text();
        throw new Error(`Error al subir archivo: ${errText}`);
      }

      // Get public URL
      const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/activo_documentos/${fileName}`;

      // Save document record
      const docBody = {
        empresa_id: empresa.id,
        equipo_id: selectedEquipo.id,
        nombre: docForm.nombre.trim(),
        descripcion: docForm.descripcion.trim(),
        tipo: docForm.tipo,
        archivo_url: publicUrl,
        archivo_nombre: selectedFile.name,
        archivo_size: selectedFile.size,
        subido_por: user.auth_id,
      };

      const res = await fetch(`${SUPABASE_URL}/rest/v1/activo_documentos`, {
        method: "POST",
        headers: {
          apikey: apiKey,
          Authorization: `Bearer ${authKey}`,
          "Content-Type": "application/json",
          Prefer: "return=representation",
        },
        body: JSON.stringify(docBody),
      });

      if (!res.ok) throw new Error("Error al registrar documento");

      toast({
        title: "Documento subido",
        description: `${docForm.nombre} se ha cargado correctamente`,
      });

      setShowDocDialog(false);
      setDocForm({ nombre: "", descripcion: "", tipo: "manual" });
      setSelectedFile(null);
      fetchDocumentos(selectedEquipo);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error al subir";
      toast({ title: "Error", description: msg, variant: "destructive" });
    }
    setUploadingDoc(false);
  }

  async function handleDeleteDoc(doc: ActivoDocumento) {
    if (!confirm(`¿Eliminar documento "${doc.nombre}"?`)) return;

    try {
      const authKey = SUPABASE_SERVICE_KEY || token;
      const apiKey = SUPABASE_SERVICE_KEY || SUPABASE_KEY;

      // Delete from storage
      const pathMatch = doc.archivo_url.match(/activo_documentos\/(.+)$/);
      if (pathMatch) {
        await fetch(
          `${SUPABASE_URL}/storage/v1/object/activo_documentos/${pathMatch[1]}`,
          {
            method: "DELETE",
            headers: {
              apikey: apiKey,
              Authorization: `Bearer ${authKey}`,
            },
          }
        );
      }

      // Delete record
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/activo_documentos?id=eq.${doc.id}`,
        {
          method: "DELETE",
          headers: {
            apikey: apiKey,
            Authorization: `Bearer ${authKey}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!res.ok) throw new Error("Error al eliminar");

      toast({ title: "Documento eliminado", description: doc.nombre });
      if (selectedEquipo) fetchDocumentos(selectedEquipo);
    } catch {
      toast({
        title: "Error",
        description: "No se pudo eliminar el documento",
        variant: "destructive",
      });
    }
  }

  function formatFileSize(bytes: number): string {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  }

  async function fetchOtTecnicos() {
    if (!empresa) return;
    setLoadingTecnicos(true);
    try {
      const serviceKey = import.meta.env.VITE_SUPABASE_SERVICE_KEY;
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/usuarios?empresa_id=eq.${empresa.id}&select=auth_id,nombre,rol,region&order=nombre.asc`,
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
          const tecList = data
            .filter((u: { auth_id?: string; nombre?: string; rol?: string }) =>
              u.auth_id && u.nombre && (u.rol === "tecnico" || u.rol === "supervisor")
            )
            .map((u: { auth_id: string; nombre: string; rol?: string }) => ({
              auth_id: u.auth_id,
              nombre: u.nombre,
              rol: u.rol,
            }));
          setOtTecnicos(tecList);
        }
      }
    } catch {
      // Silently ignore
    }
    setLoadingTecnicos(false);
  }

  function openCreateOTDialog() {
    if (!selectedEquipo) return;
    setOtForm({
      descripcion: `Mantención correctiva - ${selectedEquipo.nombre} (${selectedEquipo.codigo_activo})`,
      tipo_serv: "correctivo",
      prioridad: "media",
      notas: `Equipo: ${selectedEquipo.nombre}\nCódigo: ${selectedEquipo.codigo_activo}\nUbicación: ${selectedEquipo.ubicacion_edificio || ""} ${selectedEquipo.ubicacion_piso ? "P" + selectedEquipo.ubicacion_piso : ""} ${selectedEquipo.ubicacion_area || ""}`.trim(),
      tecnico_id: user.auth_id,
    });
    setShowCreateOTDialog(true);
    fetchOtTecnicos();
  }

  async function handleCreateOT() {
    if (!empresa || !selectedEquipo) return;
    if (!otForm.descripcion.trim()) {
      toast({
        title: "Error",
        description: "La descripción es obligatoria",
        variant: "destructive",
      });
      return;
    }

    setSavingOT(true);
    try {
      const authKey = SUPABASE_SERVICE_KEY || token;
      const apiKey = SUPABASE_SERVICE_KEY || SUPABASE_KEY;
      const now = new Date();

      const finalTecnicoId = otForm.tecnico_id || user.auth_id;
      const finalTecnicoNombre =
        finalTecnicoId === user.auth_id
          ? user.nombre
          : otTecnicos.find((t) => t.auth_id === finalTecnicoId)?.nombre || "";

      const body = {
        numero: "OT-" + Date.now(),
        cliente: empresa.nombre,
        descripcion: otForm.descripcion,
        direccion: `${selectedEquipo.ubicacion_edificio || ""} ${selectedEquipo.ubicacion_piso ? "P" + selectedEquipo.ubicacion_piso : ""} ${selectedEquipo.ubicacion_area || ""}`.trim(),
        tipo_serv: otForm.tipo_serv,
        prioridad: otForm.prioridad,
        estado: "pendiente",
        notas: otForm.notas,
        fecha_inicio: now.toISOString(),
        tecnico_id: finalTecnicoId,
        tecnico_nombre: finalTecnicoNombre,
        empresa_id: empresa.id,
        codigo_activo: selectedEquipo.codigo_activo,
      };

      const res = await fetch(`${SUPABASE_URL}/rest/v1/ordenes_trabajo`, {
        method: "POST",
        headers: {
          apikey: apiKey,
          Authorization: `Bearer ${authKey}`,
          "Content-Type": "application/json",
          Prefer: "return=representation",
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || "Error al crear OT");
      }

      toast({
        title: "OT Creada",
        description: `Orden de trabajo creada para ${selectedEquipo.nombre}`,
      });

      setShowCreateOTDialog(false);
      // Refresh historial correctivo
      fetchHistorialCorrectivo(selectedEquipo);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error al crear OT";
      toast({ title: "Error", description: msg, variant: "destructive" });
    }
    setSavingOT(false);
  }

  function openCreateDialog() {
    setEditingEquipo(null);
    setForm(defaultEquipo);
    setShowDialog(true);
  }

  function openEditDialog(equipo: EquipoBMS) {
    setEditingEquipo(equipo);
    setForm({
      codigo_activo: equipo.codigo_activo,
      nombre: equipo.nombre,
      marca: equipo.marca,
      modelo: equipo.modelo,
      numero_serie: equipo.numero_serie,
      ubicacion_edificio: equipo.ubicacion_edificio,
      ubicacion_piso: equipo.ubicacion_piso,
      ubicacion_area: equipo.ubicacion_area,
      tipo_equipo: equipo.tipo_equipo,
      notas: equipo.notas,
    });
    setShowDialog(true);
  }

  // Excel import/export
  const importFileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);

  function handleExportExcel() {
    if (equipos.length === 0) {
      toast({ title: "Sin datos", description: "No hay equipos para exportar", variant: "destructive" });
      return;
    }

    const data = equipos.map((e) => ({
      "Código Activo": e.codigo_activo,
      "Nombre": e.nombre,
      "Tipo Equipo": e.tipo_equipo,
      "Marca": e.marca,
      "Modelo": e.modelo,
      "Número de Serie": e.numero_serie,
      "Edificio": e.ubicacion_edificio,
      "Piso": e.ubicacion_piso,
      "Área": e.ubicacion_area,
      "Notas": e.notas,
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    // Ajustar ancho de columnas
    ws["!cols"] = [
      { wch: 15 }, { wch: 30 }, { wch: 25 }, { wch: 15 },
      { wch: 15 }, { wch: 20 }, { wch: 20 }, { wch: 8 },
      { wch: 15 }, { wch: 30 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Equipos");
    XLSX.writeFile(wb, `Equipos_${empresa?.nombre || "export"}_${new Date().toISOString().split("T")[0]}.xlsx`);

    toast({ title: "Exportado", description: `${equipos.length} equipos exportados a Excel` });
  }

  async function handleImportExcel(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !empresa) return;

    setImporting(true);
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, string>>(ws);

      if (rows.length === 0) {
        toast({ title: "Archivo vacío", description: "La planilla no contiene datos", variant: "destructive" });
        setImporting(false);
        return;
      }

      // Mapear columnas (soportar nombres en español e inglés)
      const mapRow = (row: Record<string, string>) => ({
        codigo_activo: (row["Código Activo"] || row["codigo_activo"] || row["Codigo Activo"] || row["CODIGO ACTIVO"] || "").toString().trim(),
        nombre: (row["Nombre"] || row["nombre"] || row["NOMBRE"] || "").toString().trim(),
        tipo_equipo: (row["Tipo Equipo"] || row["tipo_equipo"] || row["Tipo"] || row["TIPO EQUIPO"] || "").toString().trim(),
        marca: (row["Marca"] || row["marca"] || row["MARCA"] || "").toString().trim(),
        modelo: (row["Modelo"] || row["modelo"] || row["MODELO"] || "").toString().trim(),
        numero_serie: (row["Número de Serie"] || row["numero_serie"] || row["Numero de Serie"] || row["N° Serie"] || row["NUMERO DE SERIE"] || "").toString().trim(),
        ubicacion_edificio: (row["Edificio"] || row["ubicacion_edificio"] || row["EDIFICIO"] || "").toString().trim(),
        ubicacion_piso: (row["Piso"] || row["ubicacion_piso"] || row["PISO"] || "").toString().trim(),
        ubicacion_area: (row["Área"] || row["Area"] || row["ubicacion_area"] || row["AREA"] || "").toString().trim(),
        notas: (row["Notas"] || row["notas"] || row["NOTAS"] || "").toString().trim(),
        empresa_id: empresa.id,
      });

      const mapped = rows.map(mapRow).filter((r) => r.codigo_activo && r.nombre);

      if (mapped.length === 0) {
        toast({
          title: "Sin datos válidos",
          description: "No se encontraron filas con 'Código Activo' y 'Nombre' completos. Verifique los encabezados de la planilla.",
          variant: "destructive",
        });
        setImporting(false);
        return;
      }

      // Insertar en lotes de 50
      const authKey = SUPABASE_SERVICE_KEY || token;
      const apiKey = SUPABASE_SERVICE_KEY || SUPABASE_KEY;
      let insertados = 0;
      let errores = 0;

      for (let i = 0; i < mapped.length; i += 50) {
        const batch = mapped.slice(i, i + 50);
        const res = await fetch(`${SUPABASE_URL}/rest/v1/equipos_bms`, {
          method: "POST",
          headers: {
            apikey: apiKey,
            Authorization: `Bearer ${authKey}`,
            "Content-Type": "application/json",
            Prefer: "return=minimal",
          },
          body: JSON.stringify(batch),
        });

        if (res.ok) {
          insertados += batch.length;
        } else {
          errores += batch.length;
        }
      }

      toast({
        title: "Importación completada",
        description: `${insertados} equipos importados${errores > 0 ? `, ${errores} con error` : ""}`,
        variant: errores > 0 ? "destructive" : "default",
      });

      fetchEquipos();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error al importar";
      toast({ title: "Error de importación", description: msg, variant: "destructive" });
    }

    setImporting(false);
    // Reset input
    if (importFileRef.current) {
      importFileRef.current.value = "";
    }
  }

  // Filtered equipos
  const filteredEquipos = equipos.filter((e) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      e.nombre.toLowerCase().includes(term) ||
      e.codigo_activo.toLowerCase().includes(term) ||
      e.marca.toLowerCase().includes(term) ||
      e.modelo.toLowerCase().includes(term) ||
      e.ubicacion_edificio.toLowerCase().includes(term) ||
      e.tipo_equipo.toLowerCase().includes(term)
    );
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!moduleActive && user.rol !== "superadmin" && user.rol !== "admin") {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <ShieldAlert className="w-16 h-16 text-amber-500 mb-4" />
        <h2 className="text-xl font-bold text-gray-800 mb-2">Módulo No Disponible</h2>
        <p className="text-gray-600 max-w-md">
          El módulo de QR Equipos no está activado para su empresa.
          Contacte al administrador para solicitar la licencia.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <QrCode className="w-6 h-6" style={{ color: colorPrimario }} />
        <h2 className="text-xl font-bold text-gray-800">QR Equipos</h2>
      </div>

      {/* Sub-view selector */}
      <div className="flex gap-2 border-b pb-3 flex-wrap">
        <button
          type="button"
          onClick={() => { stopScanner(); setSelectedEquipo(null); setSubView("catalogo"); }}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            subView === "catalogo"
              ? "bg-blue-600 text-white shadow-md"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          <QrCode className="w-4 h-4" />
          Catálogo de Equipos
        </button>
        <button
          type="button"
          onClick={() => startScanner()}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            subView === "escanear"
              ? "bg-green-600 text-white shadow-md"
              : "bg-green-50 text-green-700 hover:bg-green-100"
          }`}
        >
          <ScanLine className="w-4 h-4" />
          Escanear QR
        </button>
        {selectedEquipo && subView === "ficha_activo" && (
          <button
            type="button"
            onClick={() => setSubView("ficha_activo")}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors bg-purple-600 text-white shadow-md"
          >
            <FileText className="w-4 h-4" />
            Ficha: {selectedEquipo.nombre}
          </button>
        )}
      </div>

      {/* CATALOGO VIEW */}
      {subView === "catalogo" && (
        <div className="space-y-4">
          {/* Search + Add + Import/Export */}
          <div className="flex gap-2 flex-wrap">
            <div className="flex-1 min-w-[200px] relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Buscar equipo por nombre, código, marca..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            {(user.rol === "superadmin" || user.rol === "admin" || user.rol === "supervisor") && (
              <>
                <Button
                  variant="outline"
                  onClick={handleExportExcel}
                  className="gap-2 text-green-700 border-green-300 hover:bg-green-50"
                >
                  <Download className="w-4 h-4" />
                  <span className="hidden sm:inline">Exportar</span>
                </Button>
                <Button
                  variant="outline"
                  onClick={() => importFileRef.current?.click()}
                  disabled={importing}
                  className="gap-2 text-purple-700 border-purple-300 hover:bg-purple-50"
                >
                  {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  <span className="hidden sm:inline">{importing ? "Importando..." : "Importar"}</span>
                </Button>
                <input
                  ref={importFileRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={handleImportExcel}
                />
                <Button onClick={openCreateDialog} className="gap-2 bg-blue-600 hover:bg-blue-700">
                  <Plus className="w-4 h-4" />
                  Nuevo Equipo
                </Button>
              </>
            )}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card className="text-center py-3">
              <div className="flex flex-col items-center gap-1">
                <QrCode className="w-5 h-5 text-blue-500" />
                <p className="text-xl font-bold text-slate-800">{equipos.length}</p>
                <p className="text-xs text-muted-foreground">Total Equipos</p>
              </div>
            </Card>
            <Card className="text-center py-3">
              <div className="flex flex-col items-center gap-1">
                <QrCode className="w-5 h-5 text-green-500" />
                <p className="text-xl font-bold text-slate-800">
                  {new Set(equipos.map((e) => e.tipo_equipo)).size}
                </p>
                <p className="text-xs text-muted-foreground">Tipos</p>
              </div>
            </Card>
            <Card className="text-center py-3">
              <div className="flex flex-col items-center gap-1">
                <QrCode className="w-5 h-5 text-amber-500" />
                <p className="text-xl font-bold text-slate-800">
                  {new Set(equipos.map((e) => e.ubicacion_edificio).filter(Boolean)).size}
                </p>
                <p className="text-xs text-muted-foreground">Edificios</p>
              </div>
            </Card>
            <Card className="text-center py-3">
              <div className="flex flex-col items-center gap-1">
                <QrCode className="w-5 h-5 text-purple-500" />
                <p className="text-xl font-bold text-slate-800">
                  {new Set(equipos.map((e) => e.marca).filter(Boolean)).size}
                </p>
                <p className="text-xs text-muted-foreground">Marcas</p>
              </div>
            </Card>
          </div>

          {/* Equipos list */}
          {filteredEquipos.length === 0 ? (
            <Card className="p-8 text-center">
              <QrCode className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-muted-foreground">
                {searchTerm ? "No se encontraron equipos" : "No hay equipos registrados"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {searchTerm ? "Intente con otro término de búsqueda" : "Registre el primer equipo para generar su código QR"}
              </p>
            </Card>
          ) : (
            <div className="space-y-2">
              {filteredEquipos.map((equipo) => (
                <Card key={equipo.id} className="p-3 hover:shadow-md transition-shadow cursor-pointer" onClick={() => openFichaActivo(equipo)}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 text-white font-bold text-xs"
                        style={{ backgroundColor: colorPrimario || "#3b82f6" }}
                      >
                        {equipo.codigo_activo.slice(0, 3).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-slate-800 text-sm truncate">
                            {equipo.nombre}
                          </p>
                          <Badge variant="outline" className="text-[10px]">
                            {equipo.codigo_activo}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                          {equipo.tipo_equipo && <span>{equipo.tipo_equipo}</span>}
                          {equipo.marca && <span>• {equipo.marca} {equipo.modelo}</span>}
                          {equipo.ubicacion_edificio && (
                            <span>• {equipo.ubicacion_edificio}{equipo.ubicacion_piso ? ` P${equipo.ubicacion_piso}` : ""}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => generateQR(equipo)}
                        className="h-8 w-8 p-0 text-green-600 hover:text-green-800 hover:bg-green-50"
                        title="Generar QR"
                      >
                        <QrCode className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openFichaActivo(equipo)}
                        className="h-8 w-8 p-0 text-purple-600 hover:text-purple-800 hover:bg-purple-50"
                        title="Ver ficha de activo"
                      >
                        <FileText className="w-4 h-4" />
                      </Button>
                      {(user.rol === "superadmin" || user.rol === "admin" || user.rol === "supervisor") && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditDialog(equipo)}
                            className="h-8 w-8 p-0 text-blue-500 hover:text-blue-700 hover:bg-blue-50"
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(equipo)}
                            className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SCANNER VIEW */}
      {subView === "escanear" && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <ScanLine className="w-5 h-5 text-green-600" />
                Escanear código QR de equipo
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center gap-4">
                <div
                  id="qr-reader"
                  className="w-full max-w-[350px] rounded-lg overflow-hidden border-2 border-green-200"
                  style={{ minHeight: scanning ? "300px" : "0" }}
                />
                {scanning && (
                  <p className="text-sm text-muted-foreground text-center">
                    Apunte la cámara al código QR del equipo...
                  </p>
                )}
                {!scanning && (
                  <div className="text-center space-y-3">
                    <p className="text-sm text-muted-foreground">
                      Presione el botón para activar la cámara y escanear el código QR del equipo.
                    </p>
                    <Button
                      onClick={startScanner}
                      className="gap-2 bg-green-600 hover:bg-green-700"
                    >
                      <ScanLine className="w-4 h-4" />
                      Activar Cámara
                    </Button>
                  </div>
                )}
                {scanning && (
                  <Button
                    variant="outline"
                    onClick={stopScanner}
                    className="gap-2"
                  >
                    <X className="w-4 h-4" />
                    Detener escaneo
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Manual code input */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Búsqueda manual por código</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Input
                  placeholder="Ingrese código de activo..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                <Button
                  variant="outline"
                  onClick={() => {
                    const equipo = equipos.find(
                      (e) => e.codigo_activo.toLowerCase() === searchTerm.toLowerCase()
                    );
                    if (equipo) {
                      openFichaActivo(equipo);
                    } else {
                      toast({
                        title: "No encontrado",
                        description: "No se encontró un equipo con ese código",
                        variant: "destructive",
                      });
                    }
                  }}
                >
                  <Search className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* FICHA DE ACTIVO VIEW */}
      {subView === "ficha_activo" && selectedEquipo && (
        <div className="space-y-4">
          {/* Equipo header card */}
          <Card className="border-l-4" style={{ borderLeftColor: colorPrimario || "#3b82f6" }}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-lg text-slate-800">{selectedEquipo.nombre}</h3>
                    <Badge variant="outline">{selectedEquipo.codigo_activo}</Badge>
                    {selectedEquipo.tipo_equipo && (
                      <Badge variant="secondary" className="text-xs">{selectedEquipo.tipo_equipo}</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {selectedEquipo.marca} {selectedEquipo.modelo} {selectedEquipo.numero_serie ? `• S/N: ${selectedEquipo.numero_serie}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0 flex-wrap">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => generateQR(selectedEquipo)}
                    className="gap-1"
                  >
                    <QrCode className="w-4 h-4" />
                    QR
                  </Button>
                  {onNavigate && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onNavigate("programacion")}
                      className="gap-1 text-blue-600 border-blue-200 hover:bg-blue-50"
                    >
                      <CalendarDays className="w-4 h-4" />
                      Programar
                    </Button>
                  )}
                  <Button
                    size="sm"
                    onClick={openCreateOTDialog}
                    className="gap-1 bg-orange-600 hover:bg-orange-700 text-white"
                  >
                    <Wrench className="w-4 h-4" />
                    Crear OT
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Ficha tabs */}
          <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
            <button
              type="button"
              onClick={() => setFichaTab("caracteristicas")}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition-colors ${
                fichaTab === "caracteristicas"
                  ? "bg-white shadow-sm text-slate-800"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <ClipboardList className="w-3.5 h-3.5" />
              Características
            </button>
            <button
              type="button"
              onClick={() => setFichaTab("preventivo")}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition-colors ${
                fichaTab === "preventivo"
                  ? "bg-white shadow-sm text-slate-800"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              Preventivo ({historialPreventivo.length})
            </button>
            <button
              type="button"
              onClick={() => setFichaTab("correctivo")}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition-colors ${
                fichaTab === "correctivo"
                  ? "bg-white shadow-sm text-slate-800"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <Wrench className="w-3.5 h-3.5" />
              Correctivo ({historialCorrectivo.length})
            </button>
            <button
              type="button"
              onClick={() => setFichaTab("documentos")}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition-colors ${
                fichaTab === "documentos"
                  ? "bg-white shadow-sm text-slate-800"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              Docs ({documentos.length})
            </button>
          </div>

          {/* TAB: Características */}
          {fichaTab === "caracteristicas" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <ClipboardList className="w-5 h-5" />
                  Ficha Técnica del Activo
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase">Código Activo</p>
                      <p className="text-sm font-semibold text-slate-800">{selectedEquipo.codigo_activo}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase">Nombre</p>
                      <p className="text-sm text-slate-700">{selectedEquipo.nombre}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase">Tipo de Equipo</p>
                      <p className="text-sm text-slate-700">{selectedEquipo.tipo_equipo || "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase">Marca</p>
                      <p className="text-sm text-slate-700">{selectedEquipo.marca || "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase">Modelo</p>
                      <p className="text-sm text-slate-700">{selectedEquipo.modelo || "—"}</p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase">Número de Serie</p>
                      <p className="text-sm text-slate-700">{selectedEquipo.numero_serie || "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase">Edificio</p>
                      <p className="text-sm text-slate-700">{selectedEquipo.ubicacion_edificio || "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase">Piso</p>
                      <p className="text-sm text-slate-700">{selectedEquipo.ubicacion_piso || "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase">Área</p>
                      <p className="text-sm text-slate-700">{selectedEquipo.ubicacion_area || "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase">Fecha de Registro</p>
                      <p className="text-sm text-slate-700">
                        {selectedEquipo.created_at ? new Date(selectedEquipo.created_at).toLocaleDateString("es-CL") : "—"}
                      </p>
                    </div>
                  </div>
                </div>
                {selectedEquipo.notas && (
                  <div className="mt-4 pt-4 border-t">
                    <p className="text-xs font-medium text-muted-foreground uppercase mb-1">Notas</p>
                    <p className="text-sm text-slate-700 whitespace-pre-wrap">{selectedEquipo.notas}</p>
                  </div>
                )}

                {/* Resumen rápido */}
                <div className="mt-4 pt-4 border-t grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="bg-green-50 rounded-lg p-3 text-center">
                    <p className="text-lg font-bold text-green-700">{historialPreventivo.length}</p>
                    <p className="text-xs text-green-600">Mantenciones Preventivas</p>
                  </div>
                  <div className="bg-orange-50 rounded-lg p-3 text-center">
                    <p className="text-lg font-bold text-orange-700">{historialCorrectivo.length}</p>
                    <p className="text-xs text-orange-600">OTs Correctivas</p>
                  </div>
                  <div className="bg-blue-50 rounded-lg p-3 text-center">
                    <p className="text-lg font-bold text-blue-700">
                      {historialCorrectivo.filter((ot) => ot.estado === "pendiente" || ot.estado === "en_curso").length}
                    </p>
                    <p className="text-xs text-blue-600">OTs Abiertas</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* TAB: Historial Preventivo */}
          {fichaTab === "preventivo" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                  Historial Preventivo - Checklists ({historialPreventivo.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loadingHistorial ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                  </div>
                ) : historialPreventivo.length === 0 ? (
                  <div className="text-center py-8">
                    <History className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">
                      No hay mantenciones preventivas registradas para este equipo
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Los checklists que incluyan el código &quot;{selectedEquipo.codigo_activo}&quot; aparecerán aquí
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {historialPreventivo.map((record: Record<string, unknown>, idx) => {
                      const estado = record.estado as string;
                      const tipo = record.tipo as string;
                      const horaCreacion = record.hora_creacion as string;
                      const horaCierre = record.hora_cierre as string;
                      const resultadoFinal = record.resultado_final as Record<string, string> | undefined;
                      const estadoGeneral = resultadoFinal?.estado_general;
                      const infoGeneral = record.informacion_general as Record<string, string> | undefined;
                      const tecnico = infoGeneral?.tecnico_responsable || infoGeneral?.operador || "—";
                      const numeroInterno = record.numero_interno as string;

                      return (
                        <div key={idx} className="border rounded-lg p-3 space-y-1 hover:bg-gray-50 transition-colors">
                          <div className="flex items-center justify-between flex-wrap gap-2">
                            <div className="flex items-center gap-2">
                              {numeroInterno && (
                                <Badge className="bg-slate-700 text-white text-[10px]">{numeroInterno}</Badge>
                              )}
                              <Badge
                                className={`text-[10px] ${
                                  estado === "finalizado"
                                    ? "bg-green-100 text-green-700"
                                    : estado === "borrador"
                                    ? "bg-gray-100 text-gray-600"
                                    : "bg-blue-100 text-blue-700"
                                }`}
                              >
                                {estado}
                              </Badge>
                              <Badge variant="outline" className="text-[10px]">
                                {tipo === "operacion_bms" ? "Operación" : tipo === "grupo_electrogeno" ? "Grupo Electrógeno" : "Mantención"}
                              </Badge>
                              {estadoGeneral && (
                                <Badge
                                  className={`text-[10px] ${
                                    estadoGeneral === "operativo"
                                      ? "bg-green-500 text-white"
                                      : estadoGeneral === "operativo_obs"
                                      ? "bg-amber-500 text-white"
                                      : estadoGeneral === "requiere_correctivo"
                                      ? "bg-orange-500 text-white"
                                      : "bg-red-500 text-white"
                                  }`}
                                >
                                  {estadoGeneral.replace(/_/g, " ")}
                                </Badge>
                              )}
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {horaCreacion || (record.created_at as string)?.split("T")[0]}
                            </span>
                          </div>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span>Técnico: {tecnico}</span>
                            {horaCierre && <span>Cierre: {horaCierre}</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* TAB: Historial Correctivo (OTs) */}
          {fichaTab === "correctivo" && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Wrench className="w-5 h-5 text-orange-600" />
                    Historial Correctivo - OTs ({historialCorrectivo.length})
                  </CardTitle>
                  <Button
                    size="sm"
                    onClick={openCreateOTDialog}
                    className="gap-1 bg-orange-600 hover:bg-orange-700 text-white"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Nueva OT
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {historialCorrectivo.length === 0 ? (
                  <div className="text-center py-8">
                    <Wrench className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">
                      No hay órdenes de trabajo correctivas para este equipo
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Cree una OT desde el botón &quot;Nueva OT&quot; para registrar trabajos correctivos
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {historialCorrectivo.map((ot, idx) => (
                      <div key={idx} className="border rounded-lg p-3 space-y-1 hover:bg-gray-50 transition-colors">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div className="flex items-center gap-2">
                            <Badge className="bg-slate-700 text-white text-[10px]">{ot.numero}</Badge>
                            <Badge
                              className={`text-[10px] ${
                                ot.estado === "completada"
                                  ? "bg-green-100 text-green-700"
                                  : ot.estado === "en_curso"
                                  ? "bg-blue-100 text-blue-700"
                                  : ot.estado === "en_revision"
                                  ? "bg-purple-100 text-purple-700"
                                  : "bg-amber-100 text-amber-700"
                              }`}
                            >
                              {ot.estado === "en_revision" ? "En Revisión" : ot.estado}
                            </Badge>
                            <Badge
                              variant="outline"
                              className={`text-[10px] ${
                                ot.prioridad === "alta"
                                  ? "border-red-300 text-red-600"
                                  : ot.prioridad === "media"
                                  ? "border-amber-300 text-amber-600"
                                  : "border-green-300 text-green-600"
                              }`}
                            >
                              {ot.prioridad === "alta" && <AlertTriangle className="w-3 h-3 mr-0.5" />}
                              {ot.prioridad}
                            </Badge>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {ot.fecha_inicio ? new Date(ot.fecha_inicio).toLocaleDateString("es-CL") : "—"}
                          </span>
                        </div>
                        <p className="text-sm text-slate-700 line-clamp-2">{ot.descripcion}</p>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          {ot.tipo_serv && <span>Tipo: {ot.tipo_serv}</span>}
                          {ot.fecha_cierre && (
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              Cerrada: {new Date(ot.fecha_cierre).toLocaleDateString("es-CL")}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
          {/* TAB: Documentos / Manuales */}
          {fichaTab === "documentos" && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <FileText className="w-5 h-5 text-teal-600" />
                    Manuales y Fichas Técnicas ({documentos.length})
                  </CardTitle>
                  {(user.rol === "superadmin" || user.rol === "admin" || user.rol === "supervisor") && (
                    <Button
                      size="sm"
                      onClick={() => setShowDocDialog(true)}
                      className="gap-1 bg-teal-600 hover:bg-teal-700 text-white"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Subir Documento
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {loadingDocs ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-teal-500" />
                  </div>
                ) : documentos.length === 0 ? (
                  <div className="text-center py-8">
                    <FileText className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">
                      No hay documentos cargados para este activo
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {(user.rol === "superadmin" || user.rol === "admin" || user.rol === "supervisor")
                        ? "Suba manuales, fichas técnicas o planos desde el botón \"Subir Documento\""
                        : "Los administradores pueden cargar documentación técnica aquí"}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {documentos.map((doc) => (
                      <div
                        key={doc.id}
                        className="flex items-center justify-between gap-3 border rounded-lg p-3 hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className="w-9 h-9 rounded-lg bg-teal-100 flex items-center justify-center shrink-0">
                            <FileText className="w-4 h-4 text-teal-700" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-medium text-slate-800 truncate">
                                {doc.nombre}
                              </p>
                              <Badge className="text-[10px] bg-teal-100 text-teal-700">
                                {TIPOS_DOCUMENTO.find((t) => t.value === doc.tipo)?.label || doc.tipo}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                              <span>{doc.archivo_nombre}</span>
                              <span>{formatFileSize(doc.archivo_size)}</span>
                              <span>{new Date(doc.created_at).toLocaleDateString("es-CL")}</span>
                            </div>
                            {doc.descripcion && (
                              <p className="text-xs text-muted-foreground mt-0.5 truncate">
                                {doc.descripcion}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => window.open(doc.archivo_url, "_blank")}
                            className="h-8 w-8 p-0 text-teal-600 hover:text-teal-800 hover:bg-teal-50"
                            title="Descargar / Ver"
                          >
                            <Download className="w-4 h-4" />
                          </Button>
                          {(user.rol === "superadmin" || user.rol === "admin" || user.rol === "supervisor") && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteDoc(doc)}
                              className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                              title="Eliminar"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* UPLOAD DOCUMENT DIALOG */}
      <Dialog open={showDocDialog} onOpenChange={setShowDocDialog}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-teal-600" />
              Subir Documento
            </DialogTitle>
            <DialogDescription>
              Cargue un manual, ficha técnica o documento para: {selectedEquipo?.nombre}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label className="text-xs">Nombre del documento *</Label>
              <Input
                value={docForm.nombre}
                onChange={(e) => setDocForm({ ...docForm, nombre: e.target.value })}
                placeholder="Ej: Manual de operación, Ficha técnica..."
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Tipo de documento</Label>
              <select
                className="w-full border rounded px-3 py-2 text-sm"
                value={docForm.tipo}
                onChange={(e) => setDocForm({ ...docForm, tipo: e.target.value })}
              >
                {TIPOS_DOCUMENTO.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Descripción (opcional)</Label>
              <Input
                value={docForm.descripcion}
                onChange={(e) => setDocForm({ ...docForm, descripcion: e.target.value })}
                placeholder="Breve descripción del documento..."
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Archivo *</Label>
              <Input
                type="file"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.dwg,.dxf"
                onChange={(e) => {
                  const file = e.target.files?.[0] || null;
                  setSelectedFile(file);
                  if (file && !docForm.nombre.trim()) {
                    setDocForm({ ...docForm, nombre: file.name.replace(/\.[^.]+$/, "") });
                  }
                }}
                className="text-sm"
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                Formatos: PDF, Word, Excel, Imágenes, DWG. Máx 50MB.
              </p>
            </div>

            {selectedFile && (
              <div className="bg-teal-50 border border-teal-200 rounded-lg p-2">
                <p className="text-xs text-teal-700">
                  📎 {selectedFile.name} ({formatFileSize(selectedFile.size)})
                </p>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => { setShowDocDialog(false); setSelectedFile(null); }} disabled={uploadingDoc}>
              Cancelar
            </Button>
            <Button
              onClick={handleUploadDoc}
              disabled={uploadingDoc || !selectedFile}
              className="gap-1 bg-teal-600 hover:bg-teal-700 text-white"
            >
              {uploadingDoc ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
              {uploadingDoc ? "Subiendo..." : "Subir Documento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CREATE/EDIT EQUIPO DIALOG */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <QrCode className="w-5 h-5" />
              {editingEquipo ? "Editar Equipo" : "Nuevo Equipo"}
            </DialogTitle>
            <DialogDescription>
              {editingEquipo
                ? "Modifique los datos del equipo"
                : "Registre un nuevo equipo para generar su código QR"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Código Activo *</Label>
                <Input
                  value={form.codigo_activo}
                  onChange={(e) => setForm({ ...form, codigo_activo: e.target.value })}
                  placeholder="Ej: CTRL-001"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Tipo de Equipo</Label>
                <select
                  className="w-full border rounded px-3 py-2 text-sm"
                  value={form.tipo_equipo}
                  onChange={(e) => setForm({ ...form, tipo_equipo: e.target.value })}
                >
                  <option value="">Seleccionar...</option>
                  {TIPOS_EQUIPO.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Nombre del Equipo *</Label>
              <Input
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                placeholder="Ej: Controlador BMS Piso 3"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Marca</Label>
                <Input
                  value={form.marca}
                  onChange={(e) => setForm({ ...form, marca: e.target.value })}
                  placeholder="Ej: Honeywell"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Modelo</Label>
                <Input
                  value={form.modelo}
                  onChange={(e) => setForm({ ...form, modelo: e.target.value })}
                  placeholder="Ej: Spyder"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Número de Serie</Label>
              <Input
                value={form.numero_serie}
                onChange={(e) => setForm({ ...form, numero_serie: e.target.value })}
                placeholder="Número de serie del equipo"
              />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Edificio</Label>
                <Input
                  value={form.ubicacion_edificio}
                  onChange={(e) => setForm({ ...form, ubicacion_edificio: e.target.value })}
                  placeholder="Edificio"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Piso</Label>
                <Input
                  value={form.ubicacion_piso}
                  onChange={(e) => setForm({ ...form, ubicacion_piso: e.target.value })}
                  placeholder="Piso"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Área</Label>
                <Input
                  value={form.ubicacion_area}
                  onChange={(e) => setForm({ ...form, ubicacion_area: e.target.value })}
                  placeholder="Área"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Notas</Label>
              <Textarea
                value={form.notas}
                onChange={(e) => setForm({ ...form, notas: e.target.value })}
                placeholder="Notas adicionales sobre el equipo..."
                rows={2}
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowDialog(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="gap-1 bg-blue-600 hover:bg-blue-700 text-white"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <QrCode className="w-4 h-4" />}
              {saving ? "Guardando..." : editingEquipo ? "Guardar cambios" : "Crear Equipo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* QR CODE DIALOG */}
      <Dialog open={showQRDialog} onOpenChange={setShowQRDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-center">
              <QrCode className="w-5 h-5" />
              Código QR
            </DialogTitle>
            <DialogDescription className="text-center">
              {qrEquipo?.nombre} ({qrEquipo?.codigo_activo})
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col items-center gap-4 py-4">
            {qrDataUrl && (
              <img
                src={qrDataUrl}
                alt={`QR ${qrEquipo?.codigo_activo}`}
                className="w-64 h-64 border rounded-lg"
              />
            )}
            <div className="text-center text-xs text-muted-foreground space-y-1">
              <p className="font-medium text-sm text-slate-700">{qrEquipo?.nombre}</p>
              <p>Código: {qrEquipo?.codigo_activo}</p>
              {qrEquipo?.marca && <p>{qrEquipo.marca} {qrEquipo.modelo}</p>}
              {qrEquipo?.ubicacion_edificio && (
                <p>
                  {qrEquipo.ubicacion_edificio}
                  {qrEquipo.ubicacion_piso ? ` - Piso ${qrEquipo.ubicacion_piso}` : ""}
                </p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button onClick={downloadQR} className="w-full gap-2 bg-green-600 hover:bg-green-700">
              <Download className="w-4 h-4" />
              Descargar QR (PNG)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CREATE OT DIALOG */}
      <Dialog open={showCreateOTDialog} onOpenChange={setShowCreateOTDialog}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wrench className="w-5 h-5 text-orange-600" />
              Crear Orden de Trabajo
            </DialogTitle>
            <DialogDescription>
              Nueva OT para: {selectedEquipo?.nombre} ({selectedEquipo?.codigo_activo})
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
              <div className="flex items-center gap-2 text-sm font-medium text-orange-800">
                <FileText className="w-4 h-4" />
                Equipo vinculado
              </div>
              <p className="text-xs text-orange-700 mt-1">
                {selectedEquipo?.nombre} • {selectedEquipo?.codigo_activo} • {selectedEquipo?.ubicacion_edificio || "Sin ubicación"}
              </p>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Descripción del trabajo *</Label>
              <Textarea
                value={otForm.descripcion}
                onChange={(e) => setOtForm({ ...otForm, descripcion: e.target.value })}
                placeholder="Describa el trabajo a realizar..."
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Tipo de Servicio</Label>
                <select
                  className="w-full border rounded px-3 py-2 text-sm"
                  value={otForm.tipo_serv}
                  onChange={(e) => setOtForm({ ...otForm, tipo_serv: e.target.value })}
                >
                  <option value="">Seleccionar...</option>
                  <option value="correctivo">Correctivo</option>
                  <option value="preventivo">Preventivo</option>
                  <option value="emergencia">Emergencia</option>
                  <option value="mejora">Mejora</option>
                  <option value="inspeccion">Inspección</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Prioridad</Label>
                <select
                  className="w-full border rounded px-3 py-2 text-sm"
                  value={otForm.prioridad}
                  onChange={(e) => setOtForm({ ...otForm, prioridad: e.target.value as "baja" | "media" | "alta" })}
                >
                  <option value="baja">Baja</option>
                  <option value="media">Media</option>
                  <option value="alta">Alta</option>
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Técnico asignado *</Label>
              {loadingTecnicos ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                  <Loader2 className="w-3 h-3 animate-spin" /> Cargando técnicos...
                </div>
              ) : (
                <select
                  className="w-full border rounded px-3 py-2 text-sm"
                  value={otForm.tecnico_id}
                  onChange={(e) => setOtForm({ ...otForm, tecnico_id: e.target.value })}
                >
                  <option value="">Seleccionar técnico...</option>
                  {otTecnicos.map((t) => (
                    <option key={t.auth_id} value={t.auth_id}>
                      {t.nombre} {t.rol === "supervisor" ? "(Supervisor)" : ""}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Notas adicionales</Label>
              <Textarea
                value={otForm.notas}
                onChange={(e) => setOtForm({ ...otForm, notas: e.target.value })}
                placeholder="Notas, observaciones..."
                rows={2}
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowCreateOTDialog(false)} disabled={savingOT}>
              Cancelar
            </Button>
            <Button
              onClick={handleCreateOT}
              disabled={savingOT}
              className="gap-1 bg-orange-600 hover:bg-orange-700 text-white"
            >
              {savingOT ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wrench className="w-4 h-4" />}
              {savingOT ? "Creando..." : "Crear OT"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}