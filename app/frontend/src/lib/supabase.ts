import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://wdkgogppdrjnwcviflrn.supabase.co";
const SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indka2dvZ3BwZHJqbndjdmlmbHJuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0NzkwNzgsImV4cCI6MjA5MDA1NTA3OH0.hy871eI297NaHtzz2fY__pFFJhqOVpD89TMFO2qF-3A";

// Service role key for admin operations (password reset, etc.)
// Set this in .env as VITE_SUPABASE_SERVICE_KEY
const SUPABASE_SERVICE_KEY = import.meta.env.VITE_SUPABASE_SERVICE_KEY || "";

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Admin client with service role - only use for admin operations
export const supabaseAdmin = SUPABASE_SERVICE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  : null;

export { SUPABASE_URL, SUPABASE_KEY, SUPABASE_SERVICE_KEY };