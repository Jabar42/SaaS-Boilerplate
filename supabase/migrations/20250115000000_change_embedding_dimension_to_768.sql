-- Migración: Cambiar dimensiones de embeddings de 1536 a 768 (Gemini text-embedding-004)
-- Esta migración permite usar embeddings de Gemini en lugar de OpenAI

-- Paso 1: Eliminar índices existentes
DROP INDEX IF EXISTS documents_embedding_idx;

-- Paso 2: Crear nueva tabla con vector(768)
CREATE TABLE IF NOT EXISTS public.documents_new (
  id bigserial NOT NULL,
  content text NULL,
  metadata jsonb NULL,
  embedding vector(768) NULL,  -- Cambio de 1536 a 768
  CONSTRAINT documents_new_pkey PRIMARY KEY (id)
) TABLESPACE pg_default;

-- Paso 3: Copiar datos existentes (los embeddings antiguos no se pueden convertir)
-- NOTA: Los embeddings de 1536 dimensiones no son compatibles con 768
-- Los documentos existentes necesitarán ser re-vectorizados
-- Por ahora, solo copiamos content y metadata
INSERT INTO public.documents_new (content, metadata)
SELECT content, metadata
FROM public.documents;

-- Paso 4: Eliminar tabla antigua
DROP TABLE IF EXISTS public.documents;

-- Paso 5: Renombrar nueva tabla
ALTER TABLE public.documents_new RENAME TO documents;

-- Paso 6: Recrear índices
CREATE INDEX IF NOT EXISTS documents_embedding_idx 
ON public.documents 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Índice para metadata (GIN)
CREATE INDEX IF NOT EXISTS documents_metadata_idx 
ON public.documents 
USING gin (metadata);

-- Comentarios actualizados
COMMENT ON TABLE public.documents IS 'Vector store para embeddings de documentos. Compatible con n8n Supabase Vector Store node. Usa Gemini text-embedding-004 (768 dimensiones).';
COMMENT ON COLUMN public.documents.content IS 'Contenido del chunk de texto';
COMMENT ON COLUMN public.documents.metadata IS 'Metadata en JSONB: filePath, organizationId, chunkIndex, fileName, uploadedAt, userId';
COMMENT ON COLUMN public.documents.embedding IS 'Vector embedding (768 dimensiones para Gemini text-embedding-004)';


