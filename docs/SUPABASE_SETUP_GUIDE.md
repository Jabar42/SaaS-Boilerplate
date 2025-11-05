# Guía Completa: Configuración de Supabase Storage para Documentos

## ✅ Estado Actual

Las variables de entorno están correctamente configuradas:

- ✅ `NEXT_PUBLIC_SUPABASE_URL`: https://vokmywtmmrmeryjukozr.supabase.co
- ✅ `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Configurado

**Próximo paso**: Crear el bucket y configurar las políticas RLS.

---

## Paso 1: Crear el Bucket "documents"

### En Supabase Dashboard:

1. **Accede a tu proyecto**: https://app.supabase.com/project/vokmywtmmrmeryjukozr
2. **Ve a Storage** (en el menú lateral izquierdo)
3. **Haz clic en "New bucket"** (botón en la parte superior)
4. **Configura el bucket**:
   ```
   Name: documents
   Public bucket: ❌ NO (debe estar desmarcado - privado)
   File size limit: 50 (MB) - o según necesites
   Allowed MIME types: (dejar vacío para permitir todos)
   ```
5. **Haz clic en "Create bucket"**

---

## Paso 2: Configurar Políticas RLS

### Opción A: Usando el Editor de Políticas (Recomendado)

1. **Ve a Storage > Policies**
2. **Selecciona el bucket "documents"**
3. **Crea las siguientes políticas una por una:**

#### Política 1: Lectura de archivos propios

**Nombre**: `Users can read their own files`

**Operación**: SELECT

**Target roles**: authenticated

**USING expression**:

```sql
bucket_id = 'documents' AND (auth.uid())::text = (storage.foldername(name))[1]
```

**Descripción**: Permite que los usuarios lean archivos de su carpeta `tenants/{userId}/`

---

#### Política 2: Subida de archivos propios

**Nombre**: `Users can upload their own files`

**Operación**: INSERT

**Target roles**: authenticated

**WITH CHECK expression**:

```sql
bucket_id = 'documents' AND (auth.uid())::text = (storage.foldername(name))[1]
```

**Descripción**: Permite que los usuarios suban archivos a su carpeta

---

#### Política 3: Eliminación de archivos propios

**Nombre**: `Users can delete their own files`

**Operación**: DELETE

**Target roles**: authenticated

**USING expression**:

```sql
bucket_id = 'documents' AND (auth.uid())::text = (storage.foldername(name))[1]
```

**Descripción**: Permite que los usuarios eliminen sus propios archivos

---

#### Política 4: Lectura de archivos globales

**Nombre**: `Authenticated users can read global files`

**Operación**: SELECT

**Target roles**: authenticated

**USING expression**:

```sql
bucket_id = 'documents' AND (storage.foldername(name))[1] = 'global'
```

**Descripción**: Permite que todos los usuarios autenticados lean archivos de `global/`

---

### Opción B: Usando SQL Editor (Más rápido)

1. **Ve a SQL Editor** en el menú lateral
2. **Haz clic en "New query"**
3. **Copia y pega este código**:

```sql
-- Eliminar políticas existentes si las hay (opcional)
DROP POLICY IF EXISTS "Users can read their own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can read global files" ON storage.objects;

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

4. **Haz clic en "Run"** o presiona `Ctrl+Enter`

---

## Paso 3: Importante - Autenticación con Clerk

⚠️ **PROBLEMA**: El proyecto usa Clerk para autenticación, pero Supabase RLS espera usuarios autenticados con Supabase Auth.

### Solución Temporal (Para Desarrollo)

Para hacer pruebas, puedes usar el **Service Role Key** temporalmente:

1. **Ve a Settings > API** en Supabase Dashboard
2. **Copia el "service_role" key** (mantén esto secreto, solo para desarrollo)
3. **Agrega a `.env.local`**:

   ```
   SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key_aqui
   ```

4. **Crea un cliente alternativo para pruebas**:

```typescript
// src/libs/SupabaseClient.ts (crear este archivo para pruebas)
import { createClient } from "@supabase/supabase-js";

import { Env } from "./Env";

// Cliente para desarrollo (usa service role)
export const supabaseAdmin = createClient(
  Env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "",
);
```

### Solución Definitiva (Para Producción)

Necesitas integrar Clerk con Supabase. Opciones:

1. **Usar Supabase Auth Helpers** para sincronizar usuarios
2. **Crear un endpoint API** que valide tokens de Clerk y cree sesiones en Supabase
3. **Usar un middleware** que convierta tokens de Clerk a tokens de Supabase

---

## Paso 4: Verificar la Configuración

### Ejecutar el script de prueba:

```bash
npx tsx scripts/test-supabase.ts
```

Deberías ver:

```
✅ Conexión exitosa con Supabase Storage
✅ Bucket "documents" existe
```

### Probar desde la interfaz:

1. Inicia el servidor de desarrollo:

   ```bash
   npm run dev
   ```

2. Ve a `/dashboard/documentos`
3. Intenta subir un archivo
4. Verifica que aparece en Supabase Storage > documents

---

## Estructura de Carpetas

Después de configurar, tus archivos deberían organizarse así:

```
documents/
├── tenants/
│   └── {userId-clerk}/
│       ├── 1234567890-archivo1.pdf
│       ├── 1234567891-archivo2.docx
│       └── ...
└── global/
    ├── documento-compartido1.pdf
    └── documento-compartido2.pdf
```

---

## Troubleshooting

### Error: "new row violates row-level security policy"

**Causa**: Las políticas RLS no permiten la operación.

**Solución**:

1. Verifica que las políticas estén creadas correctamente
2. Asegúrate de que el usuario esté autenticado
3. Verifica que la ruta del archivo sea `tenants/{userId}/filename`

### Error: "bucket not found"

**Causa**: El bucket no existe o tiene otro nombre.

**Solución**:

1. Ve a Storage > Buckets
2. Verifica que existe un bucket llamado exactamente `documents`
3. Si no existe, créalo siguiendo el Paso 1

### Error: "permission denied"

**Causa**: El usuario no tiene permisos o no está autenticado.

**Solución**:

1. Verifica que las políticas RLS permitan la operación
2. Revisa que el usuario tenga el rol `authenticated`
3. Para desarrollo, puedes usar el Service Role Key temporalmente

### Los archivos no aparecen en la lista

**Causa**: Posible problema con la autenticación o la estructura de carpetas.

**Solución**:

1. Verifica que los archivos se suban a `tenants/{userId}/`
2. Revisa la consola del navegador para errores
3. Verifica que el hook `useFiles` esté obteniendo el `userId` correcto

---

## Próximos Pasos

1. ✅ Crear el bucket `documents`
2. ✅ Configurar las políticas RLS
3. ⚠️ Resolver la integración Clerk ↔ Supabase Auth
4. ✅ Probar subir/descargar/eliminar archivos
5. ✅ Configurar archivos globales (carpeta `global/`)

---

## Referencias Útiles

- [Supabase Storage Docs](https://supabase.com/docs/guides/storage)
- [Supabase RLS Guide](https://supabase.com/docs/guides/auth/row-level-security)
- [Storage Policies](https://supabase.com/docs/guides/storage/security/access-control)
- [Clerk + Supabase Integration](https://clerk.com/docs/integrations/databases/supabase)
