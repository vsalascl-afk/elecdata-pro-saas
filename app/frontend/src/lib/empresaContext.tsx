import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import type { Empresa } from "@/lib/types";
import { SUPABASE_URL, SUPABASE_KEY } from "@/lib/supabase";

interface EmpresaContextType {
  empresa: Empresa | null;
  setEmpresa: (e: Empresa | null) => void;
  fetchEmpresa: (empresaId: string, token: string) => Promise<Empresa | null>;
  colorPrimario: string;
  colorSecundario: string;
}

const defaultContext: EmpresaContextType = {
  empresa: null,
  setEmpresa: () => {},
  fetchEmpresa: async () => null,
  colorPrimario: "#2563eb",
  colorSecundario: "#0f172a",
};

const EmpresaContext = createContext<EmpresaContextType>(defaultContext);

export function EmpresaProvider({ children }: { children: ReactNode }) {
  const [empresa, setEmpresa] = useState<Empresa | null>(null);

  const fetchEmpresa = useCallback(async (empresaId: string, token: string): Promise<Empresa | null> => {
    try {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/empresas?id=eq.${empresaId}&limit=1`,
        {
          headers: {
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );
      if (!res.ok) return null;
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        const emp = data[0] as Empresa;
        setEmpresa(emp);
        return emp;
      }
      return null;
    } catch {
      return null;
    }
  }, []);

  const colorPrimario = empresa?.color_primario || "#2563eb";
  const colorSecundario = empresa?.color_secundario || "#0f172a";

  return (
    <EmpresaContext.Provider
      value={{ empresa, setEmpresa, fetchEmpresa, colorPrimario, colorSecundario }}
    >
      {children}
    </EmpresaContext.Provider>
  );
}

export function useEmpresa() {
  return useContext(EmpresaContext);
}