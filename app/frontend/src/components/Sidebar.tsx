import { ClipboardList, BarChart3, LogOut, X, Zap, Users, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEmpresa } from "@/lib/empresaContext";

type Section = "ordenes" | "dashboard" | "admin" | "empresas";

interface SidebarProps {
  open: boolean;
  onClose: () => void;
  activeSection: Section;
  onNavigate: (section: Section) => void;
  onLogout: () => void;
  userRole?: string;
}

export default function Sidebar({
  open,
  onClose,
  activeSection,
  onNavigate,
  onLogout,
  userRole,
}: SidebarProps) {
  const { empresa, colorSecundario } = useEmpresa();

  const menuItems: { id: Section; label: string; icon: React.ReactNode; roles?: string[] }[] = [
    {
      id: "ordenes",
      label: "Órdenes",
      icon: <ClipboardList className="w-5 h-5" />,
    },
    {
      id: "dashboard",
      label: "Dashboard",
      icon: <BarChart3 className="w-5 h-5" />,
    },
    {
      id: "admin",
      label: "Usuarios",
      icon: <Users className="w-5 h-5" />,
      roles: ["admin", "superadmin"],
    },
    {
      id: "empresas",
      label: "Empresas",
      icon: <Building2 className="w-5 h-5" />,
      roles: ["superadmin"],
    },
  ];

  const visibleItems = menuItems.filter(
    (item) => !item.roles || (userRole && item.roles.includes(userRole))
  );

  const sidebarBg = colorSecundario || "#0f172a";

  return (
    <>
      {/* Overlay */}
      {open && (
        <div
          className="fixed inset-0 bg-black/30 z-40 transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <div
        className={cn(
          "fixed top-0 left-0 h-full w-64 text-white z-50 transform transition-transform duration-300 ease-in-out flex flex-col"
        )}
        style={{
          backgroundColor: sidebarBg,
          transform: open ? "translateX(0)" : "translateX(-100%)",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <div className="flex items-center gap-2 min-w-0">
            {empresa?.logo_url ? (
              <img
                src={empresa.logo_url}
                alt={empresa.nombre}
                className="w-8 h-8 rounded object-contain bg-white/10 shrink-0"
              />
            ) : (
              <Zap className="w-5 h-5 text-blue-400 shrink-0" />
            )}
            <span className="font-bold text-lg truncate">
              {empresa?.nombre || "Menu OT"}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-white/10 transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1">
          {visibleItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                onNavigate(item.id);
                onClose();
              }}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors",
                activeSection === item.id
                  ? "bg-white/20 text-white"
                  : "text-white/70 hover:bg-white/10 hover:text-white"
              )}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </nav>

        {/* Logout */}
        <div className="p-3 border-t border-white/10">
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-white/70 hover:bg-white/10 hover:text-white transition-colors"
          >
            <LogOut className="w-5 h-5" />
            Salir
          </button>
        </div>
      </div>
    </>
  );
}