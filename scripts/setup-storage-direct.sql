-- Script SQL para ejecutar directamente en Supabase SQL Editor
-- Ve a: https://app.supabase.com/project/vokmywtmmrmeryjukozr/sql/new

-- ============================================
-- 1. CREAR BUCKET "documents"
-- ============================================
-- Nota: Los buckets se crean mejor desde el Dashboard o usando la API REST
-- Si necesitas crearlo desde SQL, ejecuta esto primero:

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documents',
  'documents',
  false, -- Privado
  52428800, -- 50MB límite
  NULL -- Permitir todos los tipos MIME
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ============================================
-- 2. HABILITAR RLS EN STORAGE.OBJECTS
-- ============================================
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 3. ELIMINAR POLÍTICAS EXISTENTES (SI HAY)
-- ============================================
DROP POLICY IF EXISTS "Users can read their own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can read global files" ON storage.objects;

-- ============================================
-- 4. CREAR POLÍTICAS RLS
-- ============================================

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

-- ============================================
-- VERIFICACIÓN
-- ============================================
-- Ejecuta esto para verificar que las políticas se crearon correctamente:
-- SELECT * FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects';

