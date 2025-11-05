-- Crear bucket "documents" si no existe
-- Nota: RLS ya está habilitado por defecto en storage.objects
-- El bucket se crea mejor desde el Dashboard: Storage > New Bucket > "documents"

-- Intentar crear el bucket (puede fallar si no tienes permisos, créalo desde el Dashboard)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documents',
  'documents',
  false, -- Privado
  52428800, -- 50MB límite (ajustar según necesidades)
  NULL -- Permitir todos los tipos MIME
)
ON CONFLICT (id) DO NOTHING;

-- Eliminar políticas existentes si las hay
DROP POLICY IF EXISTS "Users can read their own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can read global files" ON storage.objects;

-- Política 1: Los usuarios pueden leer sus propios archivos
-- Ruta: tenants/{userId}/{filename}
CREATE POLICY "Users can read their own files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'documents' 
  AND (auth.uid())::text = (storage.foldername(name))[1]
);

-- Política 2: Los usuarios pueden subir sus propios archivos
-- Ruta: tenants/{userId}/{filename}
CREATE POLICY "Users can upload their own files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'documents' 
  AND (auth.uid())::text = (storage.foldername(name))[1]
);

-- Política 3: Los usuarios pueden eliminar sus propios archivos
-- Ruta: tenants/{userId}/{filename}
CREATE POLICY "Users can delete their own files"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'documents' 
  AND (auth.uid())::text = (storage.foldername(name))[1]
);

-- Política 4: Los usuarios autenticados pueden leer archivos globales
-- Ruta: global/{filename}
CREATE POLICY "Authenticated users can read global files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'documents' 
  AND (storage.foldername(name))[1] = 'global'
);

-- Comentario: Los archivos globales son solo lectura
-- Solo usuarios con permisos administrativos pueden subir/eliminar archivos globales
-- Esto se puede configurar con políticas adicionales si es necesario

