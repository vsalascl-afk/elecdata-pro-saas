import { useState, useCallback } from "react";
import type { Usuario } from "@/lib/types";
import { useEmpresa } from "@/lib/empresaContext";
import LoginScreen from "@/components/LoginScreen";
import Sidebar from "@/components/Sidebar";
import CreateOTForm from "@/components/CreateOTForm";
import OTList from "@/components/OTList";
import Dashboard from "@/components/Dashboard";
import AdminPanel from "@/components/AdminPanel";
import EmpresaManager from "@/components/EmpresaManager";
import { Toaster } from "@/components/ui/toaster";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Menu, LogOut, Zap } from "lucide-react";

type Section = "ordenes" | "dashboard" | "admin" | "empresas";

function getInitials(name: string | undefined | null): string {
  if (!name || typeof name !== "string") return "--";
  return name
    .split(" ")
    .filter(Boolean)
    .map((p) => p[0] || "")
    .join("")
    .toUpperCase()
    .slice(0, 2) || "--";
}

export default function IndexPage() {
  const [user, setUser] = useState<Usuario | null>(null);
  const [token, setToken] = useState<string>("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<Section>("ordenes");
  const [refreshKey, setRefreshKey] = useState(0);
  const { empresa, colorPrimario, colorSecundario, setEmpresa } = useEmpresa();

  const handleLogin = useCallback((u: Usuario, t: string) => {
    setUser(u);
    setToken(t);
    localStorage.setItem("token", t);
  }, []);

  const handleLogout = useCallback(() => {
    setUser(null);
    setToken("");
    setEmpresa(null);
    localStorage.removeItem("token");
  }, [setEmpresa]);

  const handleOTCreated = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  if (!user) {
    return (
      <>
        <LoginScreen onLogin={handleLogin} />
        <Toaster />
      </>
    );
  }

  const headerBg = colorSecundario;
  const accentColor = colorPrimario;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 to-blue-100">
      {/* Header */}
      <header
        className="text-white sticky top-0 z-30 shadow-lg"
        style={{ backgroundColor: headerBg }}
      >
        <div className="flex items-center justify-between px-4 py-3 max-w-5xl mx-auto">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2 min-w-0">
            {empresa?.logo_url ? (
              <img
                src={empresa.logo_url}
                alt={empresa.nombre}
                className="w-7 h-7 rounded object-contain bg-white/10 shrink-0"
              />
            ) : (
              <Zap className="w-5 h-5 shrink-0" style={{ color: accentColor }} />
            )}
            <h1 className="text-lg font-bold tracking-wide truncate">
              {empresa?.nombre || "Sistema OT"}
            </h1>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2">
                <Avatar className="w-8 h-8 shrink-0">
                  <AvatarFallback
                    className="text-white text-xs font-bold"
                    style={{ backgroundColor: accentColor }}
                  >
                    {getInitials(user.nombre)}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm font-medium text-white truncate max-w-[120px] hidden sm:inline">
                  {user.nombre}
                </span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem className="text-xs text-muted-foreground" disabled>
                {user.nombre} ({user.rol})
              </DropdownMenuItem>
              {empresa && (
                <DropdownMenuItem className="text-xs text-muted-foreground" disabled>
                  {empresa.nombre}
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={handleLogout} className="gap-2">
                <LogOut className="w-4 h-4" />
                Cerrar sesión
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Sidebar */}
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        activeSection={activeSection}
        onNavigate={setActiveSection}
        onLogout={handleLogout}
        userRole={user.rol}
      />

      {/* Content */}
      <main className="max-w-5xl mx-auto p-4 pb-20">
        {activeSection === "ordenes" && (
          <div className="space-y-4">
            <CreateOTForm
              user={user}
              token={token}
              onCreated={handleOTCreated}
            />
            <OTList user={user} token={token} refreshKey={refreshKey} />
          </div>
        )}

        {activeSection === "dashboard" && (
          <Dashboard user={user} token={token} refreshKey={refreshKey} />
        )}

        {activeSection === "admin" &&
          (user.rol === "admin" || user.rol === "superadmin") && (
            <AdminPanel user={user} token={token} />
          )}

        {activeSection === "empresas" && user.rol === "superadmin" && (
          <EmpresaManager user={user} token={token} />
        )}
      </main>

      <Toaster />
    </div>
  );
}