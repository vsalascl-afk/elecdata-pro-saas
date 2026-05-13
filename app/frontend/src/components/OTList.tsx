import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import type { OrdenTrabajo, Usuario } from "@/lib/types";
import { SUPABASE_URL, SUPABASE_KEY, supabase } from "@/lib/supabase";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card } from "@/components/ui/card";
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
  ArrowRight,
  CheckCircle,
  Image as ImageIcon,
  Pen,
  Eraser,
  Save,
  FileDown,
  Loader2,
  Search,
  X,
  Edit,
  Camera,
} from "lucide-react";
import SignaturePad from "signature_pad";
import { exportOTPDF } from "@/lib/exportPDF";

interface OTListProps {
  user: Usuario;
  token: string;
  refreshKey: number;
}

interface EditFormData {
  cliente: string;
  descripcion: string;
  direccion: string;
  tipo_serv: string;
  prioridad: "baja" | "media" | "alta";
  estado: "pendiente" | "en_curso" | "completada";
  notas: string;
}

const estadoColors: Record<string, string> = {
  pendiente: "bg-amber-500 hover:bg-amber-600",
  en_curso: "bg-sky-500 hover:bg-sky-600",
  completada: "bg-green-500 hover:bg-green-600",
};

const estadoLabels: Record<string, string> = {
  pendiente: "Pendiente",
  en_curso: "En Curso",
  completada: "Completada",
};

const prioridadColors: Record<string, string> = {
  baja: "bg-slate-400",
  media: "bg-orange-400",
  alta: "bg-red-500",
};

export default function OTList({ user, token, refreshKey }: OTListProps) {
  const [ordenes, setOrdenes] = useState<OrdenTrabajo[]>([]);
  const [filtroEstado, setFiltroEstado] = useState("todos");
  const [loading, setLoading] = useState(true);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingOT, setEditingOT] = useState<OrdenTrabajo | null>(null);
  const [editForm, setEditForm] = useState<EditFormData>({
    cliente: "",
    descripcion: "",
    direccion: "",
    tipo_serv: "",
    prioridad: "baja",
    estado: "pendiente",
    notas: "",
  });
  const [saving, setSaving] = useState(false);
  const [uploadingPhotoId, setUploadingPhotoId] = useState<string | null>(null);
  const photoInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const { toast } = useToast();
  const signatureRefs = useRef<Record<string, SignaturePad | null>>({});
  const canvasRefs = useRef<Record<string, HTMLCanvasElement | null>>({});

  const openEditDialog = (ot: OrdenTrabajo) => {
    setEditingOT(ot);
    setEditForm({
      cliente: ot.cliente || "",
      descripcion: ot.descripcion || "",
      direccion: ot.direccion || "",
      tipo_serv: ot.tipo_serv || "",
      prioridad: ot.prioridad,
      estado: ot.estado,
      notas: ot.notas || "",
    });
  };

  const closeEditDialog = () => {
    setEditingOT(null);
  };

  const handleEditSave = async () => {
    if (!editingOT) return;

    if (!editForm.cliente.trim() || !editForm.descripcion.trim()) {
      toast({
        title: "Campos requeridos",
        description: "Cliente y descripción son obligatorios",
        variant: "destructive",
      });
      return;
    }

    // Validate before completing via edit dialog
    if (
      editForm.estado === "completada" &&
      editingOT.estado !== "completada"
    ) {
      const error = validarCompletarOT(editingOT);
      if (error) {
        toast({
          title: "No se puede finalizar la OT",
          description: error,
          variant: "destructive",
        });
        return;
      }
    }

    setSaving(true);

    try {
      const body: Record<string, string> = {
        cliente: editForm.cliente,
        descripcion: editForm.descripcion,
        direccion: editForm.direccion,
        tipo_serv: editForm.tipo_serv,
        prioridad: editForm.prioridad,
        estado: editForm.estado,
        notas: editForm.notas,
      };

      // If changing to completada, add closure fields
      if (
        editForm.estado === "completada" &&
        editingOT.estado !== "completada"
      ) {
        body.fecha_cierre = new Date().toISOString();
        body.completado_por = user.nombre || "Usuario";
      }

      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/ordenes_trabajo?id=eq.${editingOT.id}`,
        {
          method: "PATCH",
          headers: {
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            Prefer: "return=representation",
          },
          body: JSON.stringify(body),
        }
      );

      if (!res.ok) {
        const errText = await res.text();
        let errorMsg = "No se pudo actualizar la OT";
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

      toast({
        title: "OT actualizada",
        description: `${editingOT.numero} se ha actualizado correctamente`,
      });
      closeEditDialog();
      fetchOrdenes();
    } catch {
      toast({
        title: "Error",
        description: "Error de conexión al guardar",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const fetchOrdenes = useCallback(async () => {
    setLoading(true);

    let filtro: string;
    if (user.rol === "tecnico") {
      filtro = `?tecnico_id=eq.${user.auth_id}`;
    } else if (user.rol === "superadmin") {
      filtro = `?empresa_id=eq.${user.empresa_id}`;
    } else {
      filtro = `?empresa_id=eq.${user.empresa_id}`;
    }

    if (filtroEstado !== "todos") {
      filtro += `&estado=eq.${filtroEstado}`;
    }

    filtro += "&order=fecha_inicio.desc";

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
      const rawOts: OrdenTrabajo[] = Array.isArray(data) ? data : [];
      // Ensure foto_url is always an array (Supabase may return string for jsonb/text[])
      const ots = rawOts.map((ot) => ({
        ...ot,
        foto_url: Array.isArray(ot.foto_url)
          ? ot.foto_url
          : typeof ot.foto_url === "string" && ot.foto_url
            ? [ot.foto_url]
            : [],
      }));

      // Fetch all technicians from the same company to resolve names
      const tecnicoMap: Record<string, string> = {};
      try {
        const tecRes = await fetch(
          `${SUPABASE_URL}/rest/v1/usuarios?empresa_id=eq.${user.empresa_id}&select=id,auth_id,nombre`,
          {
            headers: {
              apikey: SUPABASE_KEY,
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          }
        );
        const tecData = await tecRes.json();
        if (Array.isArray(tecData)) {
          for (const t of tecData) {
            if (t.auth_id) tecnicoMap[t.auth_id] = t.nombre;
            if (t.id) tecnicoMap[t.id] = t.nombre;
          }
        }
      } catch {
        // Silently ignore – RLS may block this query
        // At minimum, map the current user
      }
      // Always ensure current user is in the map
      if (user.auth_id) tecnicoMap[user.auth_id] = user.nombre;
      if (user.id) tecnicoMap[user.id] = user.nombre;

      // Enrich OTs with technician name from map
      const enriched = ots.map((ot) => ({
        ...ot,
        tecnico_nombre: ot.tecnico_nombre || tecnicoMap[ot.tecnico_id] || "",
      }));

      setOrdenes(enriched);
    } catch {
      toast({
        title: "Error",
        description: "No se pudieron cargar las OTs",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [user, token, filtroEstado, toast]);

  useEffect(() => {
    fetchOrdenes();
  }, [fetchOrdenes, refreshKey]);

  // Initialize signature pads after render
  useEffect(() => {
    ordenes.forEach((ot) => {
      if (!ot.firma_cliente_url && canvasRefs.current[ot.id] && !signatureRefs.current[ot.id]) {
        signatureRefs.current[ot.id] = new SignaturePad(
          canvasRefs.current[ot.id]!,
          {
            backgroundColor: "rgb(255, 255, 255)",
            penColor: "rgb(0, 0, 0)",
          }
        );
      }
    });
  }, [ordenes]);

  const validarCompletarOT = (ot: OrdenTrabajo): string | null => {
    const fotos = Array.isArray(ot.foto_url) ? ot.foto_url : [];
    const tieneFirma = !!ot.firma_cliente_url;
    const mensajes: string[] = [];

    if (fotos.length < 2) {
      mensajes.push(`Se requieren al menos 2 fotos (actualmente tiene ${fotos.length})`);
    }
    if (!tieneFirma) {
      mensajes.push("Se requiere la firma del cliente");
    }

    return mensajes.length > 0 ? mensajes.join(". ") : null;
  };

  const cambiarEstado = async (
    id: string,
    nuevoEstado: "en_curso" | "completada"
  ) => {
    // Validar requisitos antes de completar
    if (nuevoEstado === "completada") {
      const ot = ordenes.find((o) => o.id === id);
      if (ot) {
        const error = validarCompletarOT(ot);
        if (error) {
          toast({
            title: "No se puede finalizar la OT",
            description: error,
            variant: "destructive",
          });
          return;
        }
      }
    }

    const body: Record<string, string> = { estado: nuevoEstado };
    if (nuevoEstado === "completada") {
      body.fecha_cierre = new Date().toISOString();
      body.completado_por = user.nombre || "Usuario";
    }

    try {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/ordenes_trabajo?id=eq.${id}`,
        {
          method: "PATCH",
          headers: {
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            Prefer: "return=representation",
          },
          body: JSON.stringify(body),
        }
      );

      if (!res.ok) {
        toast({
          title: "Error",
          description: "No se pudo actualizar el estado",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Actualizado",
        description: `Estado cambiado a ${estadoLabels[nuevoEstado]}`,
      });
      fetchOrdenes();
    } catch {
      toast({
        title: "Error",
        description: "Error de conexión",
        variant: "destructive",
      });
    }
  };

  const guardarFirma = async (otId: string) => {
    const pad = signatureRefs.current[otId];
    if (!pad || pad.isEmpty()) {
      toast({
        title: "Firma vacía",
        description: "Debe firmar antes de guardar",
        variant: "destructive",
      });
      return;
    }

    try {
      const dataURL = pad.toDataURL();
      const blob = await (await fetch(dataURL)).blob();
      const fileName = `firma_${otId}.png`;

      const { error } = await supabase.storage
        .from("firmas_ot")
        .upload(fileName, blob, { upsert: true });

      if (error) {
        toast({
          title: "Error",
          description: "Error subiendo firma",
          variant: "destructive",
        });
        return;
      }

      const { data } = supabase.storage
        .from("firmas_ot")
        .getPublicUrl(fileName);

      await supabase
        .from("ordenes_trabajo")
        .update({ firma_cliente_url: data.publicUrl })
        .eq("id", otId);

      toast({ title: "Firma guardada" });
      // Clean up signature pad reference
      signatureRefs.current[otId] = null;
      fetchOrdenes();
    } catch {
      toast({
        title: "Error",
        description: "Error guardando firma",
        variant: "destructive",
      });
    }
  };

  const limpiarFirma = (otId: string) => {
    signatureRefs.current[otId]?.clear();
  };

  const handleUploadPhoto = async (otId: string, file: File) => {
    setUploadingPhotoId(otId);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const fileName = `ot_${otId}_${Date.now()}.${ext}`;

      const { error } = await supabase.storage
        .from("fotos_ot")
        .upload(fileName, file, { upsert: false });

      if (error) {
        toast({
          title: "Error",
          description: "Error subiendo la foto: " + (error.message || ""),
          variant: "destructive",
        });
        return;
      }

      // Get current foto_url array from the OT
      const ot = ordenes.find((o) => o.id === otId);
      const currentPhotos = Array.isArray(ot?.foto_url) ? ot.foto_url : [];
      const updatedPhotos = [...currentPhotos, fileName];

      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/ordenes_trabajo?id=eq.${otId}`,
        {
          method: "PATCH",
          headers: {
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            Prefer: "return=representation",
          },
          body: JSON.stringify({ foto_url: updatedPhotos }),
        }
      );

      if (!res.ok) {
        toast({
          title: "Error",
          description: "No se pudo actualizar la OT con la foto",
          variant: "destructive",
        });
        return;
      }

      toast({ title: "Foto subida", description: "La foto se agregó correctamente" });
      fetchOrdenes();
    } catch {
      toast({
        title: "Error",
        description: "Error de conexión al subir la foto",
        variant: "destructive",
      });
    } finally {
      setUploadingPhotoId(null);
      // Reset the file input
      const input = photoInputRefs.current[otId];
      if (input) input.value = "";
    }
  };

  const handleExportPDF = async (ot: OrdenTrabajo) => {
    setExportingId(ot.id);
    try {
      await exportOTPDF(ot);
      toast({ title: "PDF exportado", description: `${ot.numero} descargado` });
    } catch {
      toast({
        title: "Error",
        description: "No se pudo generar el PDF",
        variant: "destructive",
      });
    } finally {
      setExportingId(null);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString("es-CL", {
      timeZone: "America/Santiago",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Real-time search filtering
  const filteredOrdenes = useMemo(() => {
    if (!searchQuery.trim()) return ordenes;
    const q = searchQuery.toLowerCase().trim();
    return ordenes.filter(
      (ot) =>
        (ot.numero && ot.numero.toLowerCase().includes(q)) ||
        (ot.cliente && ot.cliente.toLowerCase().includes(q)) ||
        (ot.descripcion && ot.descripcion.toLowerCase().includes(q)) ||
        (ot.tecnico_nombre && ot.tecnico_nombre.toLowerCase().includes(q))
    );
  }, [ordenes, searchQuery]);

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Buscar por N° OT, cliente, técnico o descripción..."
          className="pl-9 pr-9"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Filter */}
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-slate-600">Filtrar:</span>
        <Select value={filtroEstado} onValueChange={setFiltroEstado}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="pendiente">Pendiente</SelectItem>
            <SelectItem value="en_curso">En Curso</SelectItem>
            <SelectItem value="completada">Completada</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground ml-auto">
          {filteredOrdenes.length} de {ordenes.length} orden(es)
        </span>
      </div>

      {loading ? (
        <div className="text-center py-10 text-muted-foreground">
          Cargando órdenes...
        </div>
      ) : filteredOrdenes.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground">
          {searchQuery
            ? `No se encontraron resultados para "${searchQuery}"`
            : "No hay órdenes de trabajo"}
        </div>
      ) : (
        filteredOrdenes.map((ot) => (
          <Card
            key={ot.id}
            className="p-4 hover:shadow-lg transition-all duration-200"
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-slate-800">
                  {ot.numero}
                </span>
                <Badge
                  className={`${prioridadColors[ot.prioridad]} text-white text-[10px] px-2`}
                >
                  {ot.prioridad}
                </Badge>
              </div>
              <Badge
                className={`${estadoColors[ot.estado]} text-white text-xs`}
              >
                {estadoLabels[ot.estado]}
              </Badge>
            </div>

            {/* Date */}
            <p className="text-xs text-muted-foreground mb-2">
              {ot.fecha_inicio ? formatDate(ot.fecha_inicio) : "Sin fecha"}
              {ot.fecha_cierre && (
                <span className="ml-2 text-green-600">
                  → Cerrada: {formatDate(ot.fecha_cierre)}
                </span>
              )}
            </p>

            {/* Details */}
            <div className="text-sm space-y-1 mb-3">
              <p>
                <span className="font-medium text-slate-700">Cliente:</span>{" "}
                {ot.cliente}
              </p>
              {ot.tecnico_nombre && (
                <p>
                  <span className="font-medium text-slate-700">Técnico:</span>{" "}
                  {ot.tecnico_nombre}
                </p>
              )}
              {ot.direccion && (
                <p>
                  <span className="font-medium text-slate-700">
                    Dirección:
                  </span>{" "}
                  {ot.direccion}
                </p>
              )}
              <p>
                <span className="font-medium text-slate-700">
                  Descripción:
                </span>{" "}
                {ot.descripcion}
              </p>
              {ot.tipo_serv && (
                <p>
                  <span className="font-medium text-slate-700">Servicio:</span>{" "}
                  {ot.tipo_serv}
                </p>
              )}
              {ot.notas && (
                <p className="text-xs text-slate-500 italic">
                  Obs: {ot.notas}
                </p>
              )}
            </div>

            {/* Photos */}
            {ot.foto_url && ot.foto_url.length > 0 && (
              <div className="flex gap-2 flex-wrap mb-2">
                {ot.foto_url.map((foto, i) => (
                  <img
                    key={i}
                    src={`${SUPABASE_URL}/storage/v1/object/public/fotos_ot/${foto}`}
                    alt={`Foto ${i + 1}`}
                    className="w-14 h-14 rounded-lg object-cover border cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={() =>
                      setPreviewImage(
                        `${SUPABASE_URL}/storage/v1/object/public/fotos_ot/${foto}`
                      )
                    }
                  />
                ))}
              </div>
            )}

            {/* Upload Photo Button */}
            {ot.estado !== "completada" && (
              <div className="mb-3">
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  ref={(el) => {
                    photoInputRefs.current[ot.id] = el;
                  }}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleUploadPhoto(ot.id, file);
                  }}
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => photoInputRefs.current[ot.id]?.click()}
                  disabled={uploadingPhotoId === ot.id}
                  className="gap-1.5 text-xs border-violet-300 text-violet-600 hover:bg-violet-50"
                >
                  {uploadingPhotoId === ot.id ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Camera className="w-3 h-3" />
                  )}
                  {uploadingPhotoId === ot.id ? "Subiendo..." : "Subir Foto"}
                </Button>
                <span className="text-xs text-muted-foreground ml-2">
                  {Array.isArray(ot.foto_url) ? ot.foto_url.length : 0} foto(s)
                </span>
              </div>
            )}

            {/* Signature */}
            {ot.firma_cliente_url ? (
              <div className="mb-3">
                <p className="text-xs font-medium text-slate-600 mb-1 flex items-center gap-1">
                  <Pen className="w-3 h-3" /> Firma del cliente:
                </p>
                <img
                  src={ot.firma_cliente_url}
                  alt="Firma"
                  className="w-60 h-20 border rounded-lg object-contain bg-white"
                />
              </div>
            ) : (
              <div className="mb-3">
                <p className="text-xs font-medium text-slate-600 mb-1 flex items-center gap-1">
                  <Pen className="w-3 h-3" /> Firma del cliente:
                </p>
                <canvas
                  ref={(el) => {
                    canvasRefs.current[ot.id] = el;
                  }}
                  width={280}
                  height={90}
                  className="border rounded-lg bg-white touch-none"
                />
                <div className="flex gap-2 mt-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => guardarFirma(ot.id)}
                    className="gap-1 text-xs"
                  >
                    <Save className="w-3 h-3" /> Guardar
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => limpiarFirma(ot.id)}
                    className="gap-1 text-xs"
                  >
                    <Eraser className="w-3 h-3" /> Borrar
                  </Button>
                </div>
              </div>
            )}

            {/* Completion Requirements Indicator */}
            {ot.estado !== "completada" && (() => {
              const fotos = Array.isArray(ot.foto_url) ? ot.foto_url : [];
              const faltanFotos = fotos.length < 2;
              const faltaFirma = !ot.firma_cliente_url;
              if (faltanFotos || faltaFirma) {
                return (
                  <div className="mb-3 p-2.5 bg-amber-50 border border-amber-200 rounded-lg">
                    <p className="text-xs font-semibold text-amber-700 mb-1">
                      ⚠️ Para finalizar esta OT se requiere:
                    </p>
                    <ul className="text-xs text-amber-600 list-disc list-inside space-y-0.5">
                      {faltanFotos && (
                        <li>
                          Al menos 2 fotos (actualmente: {fotos.length})
                        </li>
                      )}
                      {faltaFirma && <li>Firma del cliente</li>}
                    </ul>
                  </div>
                );
              }
              return null;
            })()}

            {/* Actions Row */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Status Actions */}
              {ot.estado !== "completada" && (
                <>
                  {ot.estado === "pendiente" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => cambiarEstado(ot.id, "en_curso")}
                      className="gap-1 text-xs border-sky-300 text-sky-600 hover:bg-sky-50"
                    >
                      <ArrowRight className="w-3 h-3" /> En Curso
                    </Button>
                  )}
                  <Button
                    size="sm"
                    onClick={() => cambiarEstado(ot.id, "completada")}
                    className="gap-1 text-xs bg-green-600 hover:bg-green-700 text-white"
                  >
                    <CheckCircle className="w-3 h-3" /> Completar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openEditDialog(ot)}
                    className="gap-1 text-xs border-blue-300 text-blue-600 hover:bg-blue-50"
                  >
                    <Edit className="w-3 h-3" /> Editar
                  </Button>
                </>
              )}

              {ot.estado === "completada" && (
                <p className="text-xs text-green-600 font-medium flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" /> Finalizada
                  {ot.completado_por && ` por ${ot.completado_por}`}
                </p>
              )}

              {/* PDF Export Button */}
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleExportPDF(ot)}
                disabled={exportingId === ot.id}
                className="gap-1 text-xs border-slate-300 text-slate-600 hover:bg-slate-50 ml-auto"
              >
                {exportingId === ot.id ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <FileDown className="w-3 h-3" />
                )}
                {exportingId === ot.id ? "Exportando..." : "Exportar PDF"}
              </Button>
            </div>
          </Card>
        ))
      )}

      {/* Image Preview Dialog */}
      <Dialog
        open={!!previewImage}
        onOpenChange={() => setPreviewImage(null)}
      >
        <DialogContent className="max-w-lg p-2">
          <DialogTitle className="flex items-center gap-2 px-2 pt-2 text-sm">
            <ImageIcon className="w-4 h-4" /> Vista previa
          </DialogTitle>
          {previewImage && (
            <img
              src={previewImage}
              alt="Preview"
              className="w-full rounded-lg"
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Edit OT Dialog */}
      <Dialog open={!!editingOT} onOpenChange={() => closeEditDialog()}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="w-4 h-4" /> Editar OT {editingOT?.numero}
            </DialogTitle>
            <DialogDescription>
              Modifica los campos y presiona Guardar para actualizar la orden de
              trabajo.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="edit-cliente">Cliente *</Label>
              <Input
                id="edit-cliente"
                value={editForm.cliente}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, cliente: e.target.value }))
                }
                placeholder="Nombre del cliente"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-descripcion">Descripción *</Label>
              <Textarea
                id="edit-descripcion"
                value={editForm.descripcion}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, descripcion: e.target.value }))
                }
                placeholder="Descripción del trabajo"
                rows={3}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-direccion">Dirección</Label>
              <Input
                id="edit-direccion"
                value={editForm.direccion}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, direccion: e.target.value }))
                }
                placeholder="Dirección"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-tipo_serv">Tipo de Servicio</Label>
              <Input
                id="edit-tipo_serv"
                value={editForm.tipo_serv}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, tipo_serv: e.target.value }))
                }
                placeholder="Tipo de servicio"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Prioridad</Label>
                <Select
                  value={editForm.prioridad}
                  onValueChange={(v) =>
                    setEditForm((f) => ({
                      ...f,
                      prioridad: v as "baja" | "media" | "alta",
                    }))
                  }
                >
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

              <div className="space-y-1.5">
                <Label>Estado</Label>
                <Select
                  value={editForm.estado}
                  onValueChange={(v) =>
                    setEditForm((f) => ({
                      ...f,
                      estado: v as "pendiente" | "en_curso" | "completada",
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pendiente">Pendiente</SelectItem>
                    <SelectItem value="en_curso">En Curso</SelectItem>
                    <SelectItem value="completada">Completada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-notas">Observaciones</Label>
              <Textarea
                id="edit-notas"
                value={editForm.notas}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, notas: e.target.value }))
                }
                placeholder="Observaciones adicionales"
                rows={2}
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={closeEditDialog} disabled={saving}>
              Cancelar
            </Button>
            <Button
              onClick={handleEditSave}
              disabled={saving}
              className="gap-1 bg-blue-600 hover:bg-blue-700 text-white"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {saving ? "Guardando..." : "Guardar cambios"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}