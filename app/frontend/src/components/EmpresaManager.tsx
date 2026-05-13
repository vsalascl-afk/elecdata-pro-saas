import { useState, useEffect, useCallback, useRef } from "react";
import type { Empresa, Usuario } from "@/lib/types";
import { SUPABASE_URL, SUPABASE_KEY } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogFooter,
  DialogHeader,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Building2,
  Loader2,
  Plus,
  Pencil,
  Trash2,
  Upload,
  Users,
  Palette,
} from "lucide-react";

interface EmpresaManagerProps {
  user: Usuario;
  token: string;
}

const defaultEmpresa: Omit<Empresa, "id" | "created_at"> = {
  nombre: "",
  logo_url: "",
  color_primario: "#2563eb",
  color_secundario: "#0f172a",
  rut: "",
  direccion: "",
  telefono: "",
  email: "",
  activa: true,
};

export default function EmpresaManager({ user, token }: EmpresaManagerProps) {
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingEmpresa, setEditingEmpresa] = useState<Empresa | null>(null);
  const [form, setForm] = useState(defaultEmpresa);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [userCounts, setUserCounts] = useState<Record<string, number>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const fetchEmpresas = useCallback(async () => {
    setLoading(true);
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
      toast({
        title: "Error",
        description: "No se pudieron cargar las empresas",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [token, toast]);

  const fetchUserCounts = useCallback(async () => {
    try {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/usuarios?select=empresa_id`,
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
        const counts: Record<string, number> = {};
        if (Array.isArray(data)) {
          for (const u of data) {
            if (u.empresa_id) {
              counts[u.empresa_id] = (counts[u.empresa_id] || 0) + 1;
            }
          }
        }
        setUserCounts(counts);
      }
    } catch {
      // silently fail
    }
  }, [token]);

  useEffect(() => {
    fetchEmpresas();
    fetchUserCounts();
  }, [fetchEmpresas, fetchUserCounts]);

  const openCreateDialog = () => {
    setEditingEmpresa(null);
    setForm(defaultEmpresa);
    setShowDialog(true);
  };

  const openEditDialog = (emp: Empresa) => {
    setEditingEmpresa(emp);
    setForm({
      nombre: emp.nombre,
      logo_url: emp.logo_url || "",
      color_primario: emp.color_primario || "#2563eb",
      color_secundario: emp.color_secundario || "#0f172a",
      rut: emp.rut || "",
      direccion: emp.direccion || "",
      telefono: emp.telefono || "",
      email: emp.email || "",
      activa: emp.activa,
    });
    setShowDialog(true);
  };

  const handleLogoUpload = async (file: File) => {
    setUploading(true);
    try {
      const fileName = `logo_${Date.now()}_${Math.random().toString(36).slice(2)}.${file.name.split(".").pop()}`;
      const res = await fetch(
        `${SUPABASE_URL}/storage/v1/object/logos_empresa/${fileName}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": file.type,
          },
          body: file,
        }
      );

      if (!res.ok) {
        toast({
          title: "Error",
          description: "No se pudo subir el logo. Verifica que el bucket 'logos_empresa' exista en Supabase Storage.",
          variant: "destructive",
        });
        return;
      }

      const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/logos_empresa/${fileName}`;
      setForm((f) => ({ ...f, logo_url: publicUrl }));
      toast({ title: "Logo subido correctamente" });
    } catch {
      toast({
        title: "Error",
        description: "Error de conexión al subir logo",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!form.nombre.trim()) {
      toast({
        title: "Campo requerido",
        description: "El nombre de la empresa es obligatorio",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);

    try {
      const body = {
        nombre: form.nombre.trim(),
        logo_url: form.logo_url || null,
        color_primario: form.color_primario,
        color_secundario: form.color_secundario,
        rut: form.rut || null,
        direccion: form.direccion || null,
        telefono: form.telefono || null,
        email: form.email || null,
        activa: form.activa,
      };

      let url = `${SUPABASE_URL}/rest/v1/empresas`;
      let method = "POST";

      if (editingEmpresa) {
        url += `?id=eq.${editingEmpresa.id}`;
        method = "PATCH";
      }

      const res = await fetch(url, {
        method,
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
        let errorMsg = "No se pudo guardar la empresa";
        try {
          const errJson = JSON.parse(errText);
          errorMsg = errJson.message || errJson.error || errorMsg;
        } catch {
          if (errText) errorMsg = errText;
        }
        toast({ title: "Error", description: errorMsg, variant: "destructive" });
        return;
      }

      toast({
        title: editingEmpresa ? "Empresa actualizada" : "Empresa creada",
        description: `${form.nombre} se ha ${editingEmpresa ? "actualizado" : "creado"} correctamente`,
      });

      setShowDialog(false);
      fetchEmpresas();
      fetchUserCounts();
    } catch {
      toast({
        title: "Error",
        description: "Error de conexión",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (emp: Empresa) => {
    const count = userCounts[emp.id] || 0;
    if (count > 0) {
      toast({
        title: "No se puede eliminar",
        description: `La empresa "${emp.nombre}" tiene ${count} usuario(s) asociado(s). Elimine o reasigne los usuarios primero.`,
        variant: "destructive",
      });
      return;
    }

    setDeleting(emp.id);

    try {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/empresas?id=eq.${emp.id}`,
        {
          method: "DELETE",
          headers: {
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!res.ok) {
        toast({
          title: "Error",
          description: "No se pudo eliminar la empresa",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Empresa eliminada",
        description: `${emp.nombre} ha sido eliminada`,
      });
      fetchEmpresas();
    } catch {
      toast({
        title: "Error",
        description: "Error de conexión",
        variant: "destructive",
      });
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Building2 className="w-5 h-5 text-slate-600" />
          <h2 className="text-lg font-bold text-slate-800">
            Gestión de Empresas
          </h2>
        </div>
        <Button
          onClick={openCreateDialog}
          className="gap-2 bg-blue-600 hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          Nueva Empresa
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="text-center py-3">
          <div className="flex flex-col items-center gap-1">
            <Building2 className="w-6 h-6 text-blue-500" />
            <p className="text-2xl font-bold text-slate-800">{empresas.length}</p>
            <p className="text-xs text-muted-foreground">Empresas</p>
          </div>
        </Card>
        <Card className="text-center py-3">
          <div className="flex flex-col items-center gap-1">
            <Building2 className="w-6 h-6 text-green-500" />
            <p className="text-2xl font-bold text-slate-800">
              {empresas.filter((e) => e.activa).length}
            </p>
            <p className="text-xs text-muted-foreground">Activas</p>
          </div>
        </Card>
      </div>

      {/* Empresa List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
        </div>
      ) : empresas.length === 0 ? (
        <Card className="p-8 text-center">
          <Building2 className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <p className="text-muted-foreground">No hay empresas registradas</p>
          <p className="text-xs text-muted-foreground mt-1">
            Crea la primera empresa para comenzar
          </p>
        </Card>
      ) : (
        <div className="space-y-2">
          {empresas.map((emp) => (
            <Card
              key={emp.id}
              className="p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  {/* Logo / Color swatch */}
                  {emp.logo_url ? (
                    <img
                      src={emp.logo_url}
                      alt={emp.nombre}
                      className="w-10 h-10 rounded object-contain bg-slate-50 border shrink-0"
                    />
                  ) : (
                    <div
                      className="w-10 h-10 rounded flex items-center justify-center shrink-0 text-white font-bold text-sm"
                      style={{ backgroundColor: emp.color_primario }}
                    >
                      {emp.nombre.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-slate-800 truncate">
                        {emp.nombre}
                      </p>
                      {!emp.activa && (
                        <Badge variant="outline" className="text-[10px] text-red-500 border-red-200">
                          Inactiva
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {emp.rut && <span>{emp.rut}</span>}
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {userCounts[emp.id] || 0} usuarios
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {/* Color preview */}
                  <div className="flex gap-0.5 mr-2">
                    <div
                      className="w-4 h-4 rounded-full border"
                      style={{ backgroundColor: emp.color_primario }}
                      title="Color primario"
                    />
                    <div
                      className="w-4 h-4 rounded-full border"
                      style={{ backgroundColor: emp.color_secundario }}
                      title="Color secundario"
                    />
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openEditDialog(emp)}
                    className="h-8 w-8 p-0 text-blue-500 hover:text-blue-700 hover:bg-blue-50"
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(emp)}
                    disabled={deleting === emp.id}
                    className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                  >
                    {deleting === emp.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5" />
              {editingEmpresa ? "Editar Empresa" : "Nueva Empresa"}
            </DialogTitle>
            <DialogDescription>
              {editingEmpresa
                ? "Modifica los datos de la empresa"
                : "Ingresa los datos de la nueva empresa"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Nombre de la empresa *</Label>
              <Input
                value={form.nombre}
                onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
                placeholder="Nombre de la empresa"
              />
            </div>

            <div className="space-y-1.5">
              <Label>RUT</Label>
              <Input
                value={form.rut || ""}
                onChange={(e) => setForm((f) => ({ ...f, rut: e.target.value }))}
                placeholder="12.345.678-9"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Teléfono</Label>
                <Input
                  value={form.telefono || ""}
                  onChange={(e) => setForm((f) => ({ ...f, telefono: e.target.value }))}
                  placeholder="+56 9 1234 5678"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={form.email || ""}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="empresa@email.com"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Dirección</Label>
              <Input
                value={form.direccion || ""}
                onChange={(e) => setForm((f) => ({ ...f, direccion: e.target.value }))}
                placeholder="Dirección de la empresa"
              />
            </div>

            {/* Logo Upload */}
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1">
                <Upload className="w-3.5 h-3.5" /> Logo
              </Label>
              <div className="flex items-center gap-3">
                {form.logo_url ? (
                  <img
                    src={form.logo_url}
                    alt="Logo"
                    className="w-12 h-12 rounded border object-contain bg-slate-50"
                  />
                ) : (
                  <div className="w-12 h-12 rounded border border-dashed border-slate-300 flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-slate-300" />
                  </div>
                )}
                <div className="flex flex-col gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="gap-1 text-xs"
                  >
                    {uploading ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Upload className="w-3 h-3" />
                    )}
                    {uploading ? "Subiendo..." : "Subir logo"}
                  </Button>
                  {form.logo_url && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setForm((f) => ({ ...f, logo_url: "" }))}
                      className="text-xs text-red-500 h-6 px-1"
                    >
                      Quitar logo
                    </Button>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleLogoUpload(file);
                    e.target.value = "";
                  }}
                />
              </div>
            </div>

            {/* Colors */}
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1">
                <Palette className="w-3.5 h-3.5" /> Colores de marca
              </Label>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">Primario (botones)</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={form.color_primario}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, color_primario: e.target.value }))
                      }
                      className="w-8 h-8 rounded cursor-pointer border-0"
                    />
                    <Input
                      value={form.color_primario}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, color_primario: e.target.value }))
                      }
                      className="h-8 text-xs font-mono"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">Secundario (header)</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={form.color_secundario}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, color_secundario: e.target.value }))
                      }
                      className="w-8 h-8 rounded cursor-pointer border-0"
                    />
                    <Input
                      value={form.color_secundario}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, color_secundario: e.target.value }))
                      }
                      className="h-8 text-xs font-mono"
                    />
                  </div>
                </div>
              </div>
              {/* Preview */}
              <div className="mt-2 rounded-lg overflow-hidden border">
                <div
                  className="h-8 flex items-center px-3"
                  style={{ backgroundColor: form.color_secundario }}
                >
                  <span className="text-white text-xs font-medium truncate">
                    {form.nombre || "Vista previa header"}
                  </span>
                </div>
                <div className="p-3 bg-slate-50 flex items-center gap-2">
                  <div
                    className="px-3 py-1 rounded text-white text-xs font-medium"
                    style={{ backgroundColor: form.color_primario }}
                  >
                    Botón ejemplo
                  </div>
                </div>
              </div>
            </div>

            {/* Active toggle */}
            <div className="flex items-center justify-between">
              <div>
                <Label>Empresa activa</Label>
                <p className="text-xs text-muted-foreground">
                  Las empresas inactivas no pueden acceder al sistema
                </p>
              </div>
              <Switch
                checked={form.activa}
                onCheckedChange={(v) => setForm((f) => ({ ...f, activa: v }))}
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setShowDialog(false)}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="gap-1 bg-blue-600 hover:bg-blue-700 text-white"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Building2 className="w-4 h-4" />
              )}
              {saving ? "Guardando..." : editingEmpresa ? "Guardar cambios" : "Crear Empresa"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}