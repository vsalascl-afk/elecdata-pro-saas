import { useState, useEffect, useCallback } from "react";
import type { OrdenTrabajo, Usuario, Empresa } from "@/lib/types";
import { SUPABASE_URL, SUPABASE_KEY } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { ClipboardList, Clock, PlayCircle, CheckCircle2, Building2 } from "lucide-react";

interface DashboardProps {
  user: Usuario;
  token: string;
  refreshKey: number;
}

const COLORS_STATUS = ["#f59e0b", "#0ea5e9", "#22c55e"];

export default function Dashboard({ user, token, refreshKey }: DashboardProps) {
  const [ordenes, setOrdenes] = useState<OrdenTrabajo[]>([]);
  const [loading, setLoading] = useState(true);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [selectedEmpresa, setSelectedEmpresa] = useState<string>(
    user.rol === "superadmin" ? "todas" : user.empresa_id
  );

  const isSuperAdmin = user.rol === "superadmin";

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

  const pendientes = ordenes.filter((o) => o.estado === "pendiente").length;
  const enCurso = ordenes.filter((o) => o.estado === "en_curso").length;
  const completadas = ordenes.filter((o) => o.estado === "completada").length;
  const total = ordenes.length;

  // Pie chart data
  const pieData = [
    { name: "Pendientes", value: pendientes },
    { name: "En Curso", value: enCurso },
    { name: "Completadas", value: completadas },
  ];

  // Bar chart: OTs by month
  const monthlyData = (() => {
    const months: Record<string, { pendiente: number; en_curso: number; completada: number }> = {};
    ordenes.forEach((ot) => {
      if (!ot.fecha_inicio) return;
      const date = new Date(ot.fecha_inicio);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      if (!months[key]) {
        months[key] = { pendiente: 0, en_curso: 0, completada: 0 };
      }
      months[key][ot.estado]++;
    });

    return Object.entries(months)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([month, counts]) => ({
        mes: month,
        Pendientes: counts.pendiente,
        "En Curso": counts.en_curso,
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

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
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
        <Card className="bg-gradient-to-br from-green-50 to-green-100">
          <CardContent className="p-4 text-center">
            <CheckCircle2 className="w-6 h-6 mx-auto text-green-500 mb-1" />
            <p className="text-2xl font-bold text-green-600">{completadas}</p>
            <p className="text-xs text-muted-foreground">Completadas</p>
          </CardContent>
        </Card>
      </div>

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