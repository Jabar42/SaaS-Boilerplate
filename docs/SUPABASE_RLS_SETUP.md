# Configuración de Políticas RLS en Supabase Storage

Esta guía te ayudará a configurar las políticas de Row Level Security (RLS) para el bucket `documents` en Supabase Storage.

## Requisitos Previos

- Cuenta de Supabase creada
- Proyecto configurado con las variables de entorno
- Bucket `documents` creado en Supabase Storage

## Paso 1: Crear el Bucket "documents"

1. Ve a tu proyecto en [Supabase Dashboard](https://app.supabase.com)
2. Navega a **Storage** en el menú lateral
3. Haz clic en **"New bucket"** o **"Create bucket"**
4. Configura el bucket:
   - **Name**: `documents`
   - **Public bucket**: ❌ **NO** (debe ser privado)
   - **File size limit**: (opcional, ej: 50MB)
   - **Allowed MIME types**: (opcional, dejar vacío para permitir todos)

5. Haz clic en **"Create bucket"**

## Paso 2: Configurar Políticas RLS

### Opción A: Usando el Dashboard (Recomendado)

1. Ve a **Storage** > **Policies** en el menú lateral
2. Selecciona el bucket `documents`
3. Haz clic en **"New Policy"** o **"Create Policy"**

#### Política 1: Permitir lectura de archivos del usuario

**Nombre**: `Users can read their own files`

**Código SQL**:

```sql
(bucket_id = 'documents'::text) AND ((auth.uid())::text = (storage.foldername(name))[1])
```

**Descripción**: Permite que los usuarios lean sus propios archivos desde la carpeta `tenants/{userId}/`

#### Política 2: Permitir escritura de archivos del usuario

**Nombre**: `Users can upload their own files`

**Código SQL**:

```sql
(bucket_id = 'documents'::text) AND ((auth.uid())::text = (storage.foldername(name))[1])
```

**Descripción**: Permite que los usuarios suban archivos a su propia carpeta

#### Política 3: Permitir eliminación de archivos del usuario

**Nombre**: `Users can delete their own files`

**Código SQL**:

```sql
(bucket_id = 'documents'::text) AND ((auth.uid())::text = (storage.foldername(name))[1])
```

**Descripción**: Permite que los usuarios eliminen sus propios archivos

#### Política 4: Permitir lectura de archivos globales

**Nombre**: `Authenticated users can read global files`

**Código SQL**:

```sql
(bucket_id = 'documents'::text) AND ((storage.foldername(name))[1] = 'global'::text) AND (auth.role() = 'authenticated'::text)
```

**Descripción**: Permite que todos los usuarios autenticados lean archivos de la carpeta `global/`

### Opción B: Usando SQL Editor

Si prefieres usar SQL directamente:

1. Ve a **SQL Editor** en el menú lateral
2. Crea una nueva query y ejecuta el siguiente código:

```sql
-- Política 1: Lectura de archivos del usuario
CREATE POLICY "Users can read their own files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'documents'
  AND (auth.uid())::text = (storage.foldername(name))[1]
);

-- Política 2: Escritura de archivos del usuario
CREATE POLICY "Users can upload their own files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'documents'
  AND (auth.uid())::text = (storage.foldername(name))[1]
);

-- Política 3: Eliminación de archivos del usuario
CREATE POLICY "Users can delete their own files"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'documents'
  AND (auth.uid())::text = (storage.foldername(name))[1]
);

-- Política 4: Lectura de archivos globales
CREATE POLICY "Authenticated users can read global files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'documents'
  AND (storage.foldername(name))[1] = 'global'
);
```

## Paso 3: Configurar Autenticación con Clerk

Como el proyecto usa Clerk para autenticación, necesitas configurar Supabase para que reconozca los tokens de Clerk.

### Opción 1: Usar JWT de Clerk directamente

Necesitas crear un hook en Supabase que valide los tokens de Clerk. Esto requiere configuración adicional en Supabase.

### Opción 2: Usar Service Role Key (Solo para pruebas)

⚠️ **ADVERTENCIA**: Solo para desarrollo. En producción, usa autenticación adecuada.

Para pruebas, puedes usar el Service Role Key temporalmente:

```typescript
// src/libs/Supabase.ts (SOLO PARA DESARROLLO)
import { createClient } from "@supabase/supabase-js";

import { Env } from "./Env";

export const supabase = createClient(
  Env.NEXT_PUBLIC_SUPABASE_URL || "",
  Env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  },
);
```

### Opción 3: Integrar Clerk con Supabase (Recomendado para producción)

1. Instala el paquete necesario:

```bash
npm install @supabase/auth-helpers-nextjs
```

2. Crea un endpoint que valide el token de Clerk y cree una sesión en Supabase

3. Configura Supabase para aceptar tokens JWT de Clerk

## Paso 4: Verificar la Configuración

1. Ejecuta el script de prueba:

```bash
npx tsx scripts/test-supabase.ts
```

2. Prueba subir un archivo desde la interfaz
3. Verifica que los archivos aparecen en Supabase Storage
4. Prueba descargar y eliminar archivos

## Estructura de Carpetas Esperada

```
documents/
├── tenants/
│   └── {userId}/
│       ├── archivo1.pdf
│       ├── archivo2.docx
│       └── ...
└── global/
    ├── documento-compartido1.pdf
    └── documento-compartido2.pdf
```

## Troubleshooting

### Error: "new row violates row-level security policy"

- Verifica que las políticas RLS estén correctamente configuradas
- Asegúrate de que el usuario esté autenticado
- Verifica que la ruta del archivo coincida con el patrón esperado

### Error: "bucket not found"

- Verifica que el bucket `documents` existe
- Asegúrate de que el nombre del bucket sea exactamente `documents` (case-sensitive)

### Error: "permission denied"

- Verifica que las políticas RLS permitan la operación
- Revisa que el usuario tenga el rol `authenticated`
- Verifica que la estructura de carpetas sea correcta

## Referencias

- [Supabase Storage Policies](https://supabase.com/docs/guides/storage/security/access-control)
- [Supabase RLS Guide](https://supabase.com/docs/guides/auth/row-level-security)
- [Clerk Integration](https://clerk.com/docs)
