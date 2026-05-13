# Multi-Tenant OT Management System - Development Plan

## Overview
Transform the existing single-tenant OT app into a multi-tenant system where each company has its own configuration, logo, and isolated data.

## Database Changes

### New table: `empresas`
- id (UUID, PK)
- nombre (text)
- logo_url (text, nullable)
- color_primario (text, default '#2563eb')
- color_secundario (text, default '#0f172a')
- rut (text, nullable)
- direccion (text, nullable)
- telefono (text, nullable)
- email (text, nullable)
- activa (boolean, default true)
- created_at (timestamptz)

### Modified: `usuarios` table
- Add new role: "superadmin" (manages all companies)

## Files to Modify/Create

1. **src/lib/types.ts** — Add Empresa type, add "superadmin" to Usuario rol, add EmpresaConfig context type
2. **src/lib/empresaContext.tsx** — NEW: React context to provide empresa config (logo, colors, name) throughout the app
3. **src/components/LoginScreen.tsx** — Load empresa config after login, apply dynamic branding
4. **src/components/Sidebar.tsx** — Add "Empresas" menu for superadmin, show empresa logo
5. **src/components/EmpresaManager.tsx** — NEW: CRUD for empresas (superadmin only) - create, edit, delete companies, upload logo, configure colors
6. **src/components/AdminPanel.tsx** — Ensure empresa isolation, superadmin can switch between empresas
7. **src/pages/Index.tsx** — Integrate EmpresaContext, add empresas section, dynamic header branding
8. **src/components/Dashboard.tsx** — Add global view for superadmin with empresa filter

## Implementation Notes
- empresa_id already exists in usuarios and ordenes_trabajo tables
- All queries already filter by empresa_id — good isolation foundation
- Logo upload will use Supabase Storage bucket `logos_empresa`
- Dynamic CSS variables for empresa colors
- Superadmin sees all empresas, admin sees only their empresa