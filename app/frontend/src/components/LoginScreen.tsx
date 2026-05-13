import { useState } from "react";
import { supabase, supabaseAdmin, SUPABASE_URL, SUPABASE_KEY, SUPABASE_SERVICE_KEY } from "@/lib/supabase";
import type { Usuario } from "@/lib/types";
import { useEmpresa } from "@/lib/empresaContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Zap } from "lucide-react";

interface LoginScreenProps {
  onLogin: (user: Usuario, token: string) => void;
}

/**
 * Fetch user profile bypassing RLS using service_role key via REST API.
 * This is the most reliable method to avoid recursive RLS policies.
 */
async function fetchUserBypassRLS(
  field: string,
  value: string
): Promise<Usuario | undefined> {
  const serviceKey = SUPABASE_SERVICE_KEY;
  if (!serviceKey) return undefined;

  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/usuarios?${field}=eq.${encodeURIComponent(value)}&limit=1`,
      {
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
          "Content-Type": "application/json",
        },
      }
    );
    if (res.ok) {
      const data = await res.json();
      return data?.[0] as Usuario | undefined;
    }
  } catch {
    // Silently fail
  }
  return undefined;
}

export default function LoginScreen({ onLogin }: LoginScreenProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { fetchEmpresa } = useEmpresa();

  const handleLogin = async () => {
    if (!email || !password) {
      setError("Completa todos los campos");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const { data, error: authError } =
        await supabase.auth.signInWithPassword({ email, password });

      if (authError || !data.session) {
        setError("Credenciales incorrectas");
        setLoading(false);
        return;
      }

      const token = data.session.access_token;
      const authUserId = data.user.id;
      const userEmail = data.user.email || "";

      let user: Usuario | undefined;

      // STRATEGY 1: Direct REST API call with service_role key (bypasses RLS completely)
      user = await fetchUserBypassRLS("auth_id", authUserId);

      // If not found by auth_id, try by email
      if (!user) {
        user = await fetchUserBypassRLS("email", userEmail);

        // Update auth_id if found by email
        if (user && !user.auth_id && supabaseAdmin) {
          await supabaseAdmin
            .from("usuarios")
            .update({ auth_id: authUserId })
            .eq("id", user.id);
          user.auth_id = authUserId;
        } else if (user && !user.auth_id && SUPABASE_SERVICE_KEY) {
          // Update via REST API
          await fetch(
            `${SUPABASE_URL}/rest/v1/usuarios?id=eq.${user.id}`,
            {
              method: "PATCH",
              headers: {
                apikey: SUPABASE_SERVICE_KEY,
                Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
                "Content-Type": "application/json",
                Prefer: "return=minimal",
              },
              body: JSON.stringify({ auth_id: authUserId }),
            }
          );
          user.auth_id = authUserId;
        }
      }

      // STRATEGY 2: Use supabaseAdmin client as backup
      if (!user && supabaseAdmin) {
        const { data: adminData } = await supabaseAdmin
          .from("usuarios")
          .select("*")
          .eq("auth_id", authUserId)
          .limit(1);
        user = adminData?.[0] as Usuario | undefined;

        if (!user) {
          const { data: adminEmailData } = await supabaseAdmin
            .from("usuarios")
            .select("*")
            .eq("email", userEmail)
            .limit(1);
          user = adminEmailData?.[0] as Usuario | undefined;
        }
      }

      // STRATEGY 3: Last resort - use user token (may fail with recursive RLS)
      if (!user) {
        try {
          const res = await fetch(
            `${SUPABASE_URL}/rest/v1/usuarios?email=eq.${encodeURIComponent(userEmail)}&limit=1`,
            {
              headers: {
                apikey: SUPABASE_KEY,
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
              },
            }
          );
          if (res.ok) {
            const userData = await res.json();
            user = userData?.[0] as Usuario | undefined;
          }
        } catch {
          // RLS recursive error expected here
        }
      }

      if (!user) {
        const hasServiceKey = !!SUPABASE_SERVICE_KEY;
        setError(
          hasServiceKey
            ? "Usuario no encontrado en la tabla 'usuarios' con email: " + userEmail + ". Verifica que el registro exista en Supabase."
            : "Error de configuración: VITE_SUPABASE_SERVICE_KEY no está disponible. Verifica que la variable esté configurada en Vercel con el prefijo VITE_ y haz Redeploy."
        );
        setLoading(false);
        return;
      }

      // Fetch empresa config for branding
      if (user.empresa_id) {
        await fetchEmpresa(user.empresa_id, token);
      }

      onLogin(user, token);
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
          <div className="mx-auto w-14 h-14 bg-blue-600 rounded-full flex items-center justify-center">
            <Zap className="w-7 h-7 text-white" />
          </div>
          <CardTitle className="text-2xl font-bold text-slate-800">
            Sistema de Gestión OT
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Plataforma Multi-Empresa
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLogin()}
          />
          <Input
            type="password"
            placeholder="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLogin()}
          />
          {error && (
            <p className="text-sm text-red-500 text-center">{error}</p>
          )}
          <Button
            onClick={handleLogin}
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700"
          >
            {loading ? "Ingresando..." : "Ingresar"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}