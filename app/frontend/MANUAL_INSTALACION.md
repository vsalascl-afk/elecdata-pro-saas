# 📋 Manual de Instalación - Sistema de Gestión de Órdenes de Trabajo (OT)

## Guía completa para desplegar en dominios propios de clientes

---

## 📑 Índice

1. [Requisitos Previos](#1-requisitos-previos)
2. [Configurar Supabase (Backend)](#2-configurar-supabase-backend)
3. [Configurar el Proyecto Frontend](#3-configurar-el-proyecto-frontend)
4. [Compilar para Producción](#4-compilar-para-producción)
5. [Opciones de Despliegue](#5-opciones-de-despliegue)
6. [Configurar Dominio Personalizado](#6-configurar-dominio-personalizado)
7. [Crear el Primer Usuario (Super Admin)](#7-crear-el-primer-usuario-super-admin)
8. [Configuración Multi-Empresa](#8-configuración-multi-empresa)
9. [Mantenimiento y Actualizaciones](#9-mantenimiento-y-actualizaciones)
10. [Solución de Problemas](#10-solución-de-problemas)

---

## 1. Requisitos Previos

### En tu computador de desarrollo necesitas:

| Software | Versión mínima | Descarga |
|----------|---------------|----------|
| **Node.js** | 18.x o superior | [nodejs.org](https://nodejs.org) |
| **pnpm** | 8.x o superior | `npm install -g pnpm` |
| **Git** (opcional) | Cualquiera | [git-scm.com](https://git-scm.com) |

### Verificar instalación:
```bash
node --version    # Debe mostrar v18.x o superior
pnpm --version    # Debe mostrar 8.x o superior
```

---

## 2. Configurar Supabase (Backend)

Supabase es el backend que maneja la base de datos, autenticación y almacenamiento de archivos.

### 2.1 Crear proyecto en Supabase

1. Ve a [supabase.com](https://supabase.com) y crea una cuenta gratuita
2. Haz clic en **"New Project"**
3. Completa:
   - **Name**: Nombre del cliente (ej: "OT - Empresa ABC")
   - **Database Password**: Genera una contraseña segura y guárdala
   - **Region**: Selecciona la más cercana al cliente (ej: South America para Chile)
4. Espera a que se cree el proyecto (~2 minutos)

### 2.2 Obtener credenciales

1. En el panel de Supabase, ve a **Settings** → **API**
2. Copia estos dos valores:
   - **Project URL**: `https://xxxxx.supabase.co`
   - **anon public key**: `eyJhbGci...` (la clave larga)

> ⚠️ **IMPORTANTE**: Guarda estas credenciales, las necesitarás en el paso 3.

### 2.3 Crear las tablas de la base de datos

1. En Supabase, ve a **SQL Editor** (ícono de terminal en el menú lateral)
2. Haz clic en **"New Query"**
3. Copia y pega el siguiente SQL completo:

```sql
-- ============================================
-- SCRIPT DE INSTALACIÓN - Sistema OT
-- Ejecutar en Supabase SQL Editor
-- ============================================

BEGIN;

-- ============================================
-- 1. TABLA DE EMPRESAS
-- ============================================
CREATE TABLE IF NOT EXISTS empresas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  logo_url TEXT,
  color_primario TEXT DEFAULT '#2563eb',
  color_secundario TEXT DEFAULT '#0f172a',
  rut TEXT,
  direccion TEXT,
  telefono TEXT,
  email TEXT,
  activa BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE empresas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios autenticados pueden ver empresas"
  ON empresas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Usuarios autenticados pueden insertar empresas"
  ON empresas FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Usuarios autenticados pueden actualizar empresas"
  ON empresas FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Usuarios autenticados pueden eliminar empresas"
  ON empresas FOR DELETE TO authenticated USING (true);

-- ============================================
-- 2. TABLA DE USUARIOS
-- ============================================
CREATE TABLE IF NOT EXISTS usuarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_id UUID REFERENCES auth.users NOT NULL,
  nombre TEXT NOT NULL,
  email TEXT NOT NULL,
  rol TEXT NOT NULL DEFAULT 'tecnico'
    CHECK (rol IN ('superadmin', 'admin', 'tecnico', 'supervisor')),
  empresa_id UUID REFERENCES empresas(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios autenticados pueden ver usuarios"
  ON usuarios FOR SELECT TO authenticated USING (true);
CREATE POLICY "Usuarios autenticados pueden insertar usuarios"
  ON usuarios FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Usuarios autenticados pueden actualizar usuarios"
  ON usuarios FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Usuarios autenticados pueden eliminar usuarios"
  ON usuarios FOR DELETE TO authenticated USING (true);

-- ============================================
-- 3. TABLA DE ÓRDENES DE TRABAJO
-- ============================================
CREATE TABLE IF NOT EXISTS ordenes_trabajo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero TEXT NOT NULL,
  cliente TEXT NOT NULL,
  descripcion TEXT NOT NULL,
  direccion TEXT,
  tipo_serv TEXT,
  prioridad TEXT NOT NULL DEFAULT 'baja'
    CHECK (prioridad IN ('baja', 'media', 'alta')),
  estado TEXT NOT NULL DEFAULT 'pendiente'
    CHECK (estado IN ('pendiente', 'en_curso', 'completada')),
  notas TEXT,
  tecnico_id UUID,
  tecnico_nombre TEXT,
  empresa_id UUID REFERENCES empresas(id),
  foto_url JSONB DEFAULT '[]'::jsonb,
  firma_cliente_url TEXT,
  completado_por TEXT,
  fecha_inicio TIMESTAMPTZ DEFAULT now(),
  fecha_cierre TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE ordenes_trabajo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios autenticados pueden ver OTs"
  ON ordenes_trabajo FOR SELECT TO authenticated USING (true);
CREATE POLICY "Usuarios autenticados pueden insertar OTs"
  ON ordenes_trabajo FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Usuarios autenticados pueden actualizar OTs"
  ON ordenes_trabajo FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Usuarios autenticados pueden eliminar OTs"
  ON ordenes_trabajo FOR DELETE TO authenticated USING (true);

-- Índices para mejor rendimiento
CREATE INDEX IF NOT EXISTS idx_ot_empresa ON ordenes_trabajo(empresa_id);
CREATE INDEX IF NOT EXISTS idx_ot_tecnico ON ordenes_trabajo(tecnico_id);
CREATE INDEX IF NOT EXISTS idx_ot_estado ON ordenes_trabajo(estado);
CREATE INDEX IF NOT EXISTS idx_usuarios_empresa ON usuarios(empresa_id);
CREATE INDEX IF NOT EXISTS idx_usuarios_auth ON usuarios(auth_id);

-- ============================================
-- 4. STORAGE BUCKETS (Almacenamiento de archivos)
-- ============================================

-- Bucket para fotos de OT
INSERT INTO storage.buckets (id, name, public)
VALUES ('fotos_ot', 'fotos_ot', true)
ON CONFLICT (id) DO NOTHING;

-- Bucket para firmas
INSERT INTO storage.buckets (id, name, public)
VALUES ('firmas_ot', 'firmas_ot', true)
ON CONFLICT (id) DO NOTHING;

-- Bucket para logos de empresas
INSERT INTO storage.buckets (id, name, public)
VALUES ('logos_empresa', 'logos_empresa', true)
ON CONFLICT (id) DO NOTHING;

-- Políticas de storage
CREATE POLICY "Acceso público lectura fotos" ON storage.objects
  FOR SELECT TO public USING (bucket_id = 'fotos_ot');
CREATE POLICY "Usuarios suben fotos" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'fotos_ot');

CREATE POLICY "Acceso público lectura firmas" ON storage.objects
  FOR SELECT TO public USING (bucket_id = 'firmas_ot');
CREATE POLICY "Usuarios suben firmas" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'firmas_ot');
CREATE POLICY "Usuarios actualizan firmas" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'firmas_ot');

CREATE POLICY "Acceso público lectura logos" ON storage.objects
  FOR SELECT TO public USING (bucket_id = 'logos_empresa');
CREATE POLICY "Usuarios suben logos" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'logos_empresa');

COMMIT;
```

4. Haz clic en **"Run"** (o presiona Ctrl+Enter)
5. Deberías ver "Success. No rows returned" — esto es correcto

### 2.4 Configurar autenticación

1. En Supabase, ve a **Authentication** → **Providers**
2. Asegúrate de que **Email** esté habilitado
3. **IMPORTANTE**: Ve a **Authentication** → **Settings** → **Email**
4. Desactiva **"Confirm email"** (para evitar problemas de rate limit al crear usuarios)
   - Esto permite crear usuarios sin necesidad de confirmar por email

---

## 3. Configurar el Proyecto Frontend

### 3.1 Descomprimir el proyecto

```bash
# Descomprime el ZIP descargado
unzip proyecto-ot.zip -d sistema-ot
cd sistema-ot
```

### 3.2 Actualizar credenciales de Supabase

Edita el archivo `src/lib/supabase.ts` con las credenciales del paso 2.2:

```typescript
import { createClient } from "@supabase/supabase-js";

// ⬇️ REEMPLAZA con las credenciales de tu proyecto Supabase
export const SUPABASE_URL = "https://TU-PROYECTO.supabase.co";
export const SUPABASE_KEY = "eyJhbGci...TU-CLAVE-ANON-PUBLICA";

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
```

### 3.3 Instalar dependencias

```bash
pnpm install
```

### 3.4 Probar localmente (opcional)

```bash
pnpm run dev
```

Abre `http://localhost:5173` en tu navegador para verificar que todo funciona.

---

## 4. Compilar para Producción

```bash
pnpm run build
```

Esto genera la carpeta **`dist/`** con todos los archivos estáticos optimizados listos para desplegar.

---

## 5. Opciones de Despliegue

### Opción A: Vercel (Recomendado - Gratis)

**Ideal para**: Despliegue rápido, SSL automático, dominio personalizado fácil.

```bash
# Instalar Vercel CLI
npm install -g vercel

# Desplegar
vercel

# Para producción
vercel --prod
```

**Configuración en Vercel:**
- Framework Preset: **Vite**
- Build Command: `pnpm run build`
- Output Directory: `dist`

### Opción B: Netlify (Gratis)

1. Ve a [netlify.com](https://netlify.com) y crea una cuenta
2. Arrastra la carpeta `dist/` al panel de Netlify
3. ¡Listo! Te dará una URL automática

**O por CLI:**
```bash
npm install -g netlify-cli
netlify deploy --prod --dir=dist
```

### Opción C: VPS con Nginx (Control total)

**Ideal para**: Clientes que quieren control total del servidor.

1. **Subir archivos al servidor:**
```bash
# Desde tu computador
scp -r dist/* usuario@ip-servidor:/var/www/sistema-ot/
```

2. **Configurar Nginx:**
```nginx
server {
    listen 80;
    server_name dominio-cliente.com www.dominio-cliente.com;
    root /var/www/sistema-ot;
    index index.html;

    # Importante para SPA (Single Page Application)
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache de archivos estáticos
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Seguridad
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
}
```

3. **Habilitar el sitio:**
```bash
sudo ln -s /etc/nginx/sites-available/sistema-ot /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

4. **Agregar SSL con Let's Encrypt (HTTPS gratuito):**
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d dominio-cliente.com -d www.dominio-cliente.com
```

### Opción D: Cloudflare Pages (Gratis)

1. Sube el proyecto a un repositorio Git (GitHub/GitLab)
2. Ve a [pages.cloudflare.com](https://pages.cloudflare.com)
3. Conecta tu repositorio
4. Configura:
   - Build command: `pnpm run build`
   - Build output: `dist`

---

## 6. Configurar Dominio Personalizado

### En Vercel:
1. Ve a tu proyecto → **Settings** → **Domains**
2. Agrega el dominio del cliente (ej: `ot.empresa-abc.cl`)
3. Configura el DNS del cliente:
   - Tipo: **CNAME**
   - Nombre: `ot` (o `@` para dominio raíz)
   - Valor: `cname.vercel-dns.com`

### En Netlify:
1. Ve a tu sitio → **Domain settings** → **Add custom domain**
2. Configura DNS:
   - Tipo: **CNAME**
   - Valor: `tu-sitio.netlify.app`

### En VPS (Nginx):
- El dominio debe apuntar a la IP del servidor (registro tipo **A**)
- Ejemplo DNS:
  - Tipo: **A**
  - Nombre: `@`
  - Valor: `123.456.789.0` (IP del servidor)

---

## 7. Crear el Primer Usuario (Super Admin)

### 7.1 Registrar usuario en Supabase Auth

1. En Supabase Dashboard, ve a **Authentication** → **Users**
2. Haz clic en **"Add user"** → **"Create new user"**
3. Ingresa:
   - Email: `admin@empresa-cliente.com`
   - Password: Una contraseña segura
4. Haz clic en **"Create user"**
5. Copia el **User UID** que aparece

### 7.2 Crear la empresa del cliente

Ve a **SQL Editor** y ejecuta:

```sql
INSERT INTO empresas (nombre, rut, direccion, telefono, email, color_primario, color_secundario)
VALUES (
  'Empresa ABC',           -- Nombre de la empresa
  '76.123.456-7',          -- RUT
  'Av. Principal 123',     -- Dirección
  '+56 9 1234 5678',       -- Teléfono
  'contacto@empresa.cl',   -- Email
  '#2563eb',               -- Color primario (azul por defecto)
  '#0f172a'                -- Color secundario (oscuro por defecto)
);
```

### 7.3 Obtener el ID de la empresa

```sql
SELECT id, nombre FROM empresas;
```

Copia el **id** de la empresa creada.

### 7.4 Crear el usuario Super Admin

```sql
INSERT INTO usuarios (auth_id, nombre, email, rol, empresa_id)
VALUES (
  'PEGAR-USER-UID-AQUI',        -- El UID del paso 7.1
  'Administrador Principal',      -- Nombre
  'admin@empresa-cliente.com',    -- Email
  'superadmin',                   -- Rol
  'PEGAR-EMPRESA-ID-AQUI'        -- El ID del paso 7.3
);
```

### 7.5 Verificar

Abre la aplicación web e inicia sesión con las credenciales del paso 7.1. Deberías ver el panel completo con acceso a Empresas y Usuarios.

---

## 8. Configuración Multi-Empresa

### Escenario A: Una instancia por cliente
- Cada cliente tiene su propio Supabase y su propio despliegue
- **Ventaja**: Aislamiento total de datos
- **Desventaja**: Más trabajo de mantenimiento

### Escenario B: Una instancia compartida (recomendado)
- Un solo Supabase con múltiples empresas
- Cada empresa tiene sus propios usuarios y datos aislados
- **Ventaja**: Fácil de mantener, un solo despliegue
- **Desventaja**: Datos en la misma base de datos (pero aislados por empresa_id)

### Roles del sistema:

| Rol | Permisos |
|-----|----------|
| **superadmin** | Ve todo, crea empresas, gestiona todos los usuarios |
| **admin** | Gestiona usuarios y OTs de su empresa |
| **supervisor** | Ve todas las OTs de su empresa |
| **tecnico** | Solo ve y gestiona sus propias OTs |

---

## 9. Mantenimiento y Actualizaciones

### Actualizar el frontend:
```bash
# Editar código fuente
# ...

# Recompilar
pnpm run build

# Redesplegar según la opción elegida
vercel --prod          # Si usas Vercel
netlify deploy --prod  # Si usas Netlify
# O subir dist/ al VPS
```

### Backup de base de datos:
1. En Supabase → **Settings** → **Database**
2. Supabase hace backups automáticos diarios (plan Pro)
3. Para backup manual, usa `pg_dump` con las credenciales de conexión

### Monitoreo:
- Supabase Dashboard muestra métricas de uso
- Verifica regularmente el uso de storage y base de datos
- Plan gratuito de Supabase: 500MB DB, 1GB storage, 50K auth users

---

## 10. Solución de Problemas

### ❌ "Email rate limit exceeded" al crear usuarios
**Solución**: En Supabase → Authentication → Settings → Email → Desactivar "Confirm email"

### ❌ Pantalla en blanco al abrir la app
**Solución**: Verificar que las credenciales en `supabase.ts` sean correctas

### ❌ "Permission denied" o errores de RLS
**Solución**: Verificar que las políticas RLS se crearon correctamente ejecutando:
```sql
SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'public';
```

### ❌ Las imágenes/fotos no se suben
**Solución**: Verificar que los buckets de storage se crearon:
```sql
SELECT id, name, public FROM storage.buckets;
```

### ❌ Error al compilar (pnpm run build)
**Solución**:
```bash
# Limpiar cache
rm -rf node_modules
pnpm install
pnpm run build
```

### ❌ La app no carga en el dominio personalizado
**Solución**: 
- Verificar configuración DNS (puede tardar hasta 48h en propagarse)
- Verificar configuración de Nginx (`try_files $uri $uri/ /index.html`)
- Verificar SSL/HTTPS

---

## 📞 Soporte

Para consultas técnicas o soporte adicional, contactar al equipo de desarrollo.

---

*Documento generado el 10 de abril de 2026*
*Versión del sistema: 1.0.0*