-- Habilitar extensión pgvector si no está habilitada
CREATE EXTENSION IF NOT EXISTS vector;

-- Crear tabla documents con el esquema exacto que requiere n8n Supabase Vector Store
CREATE TABLE IF NOT EXISTS public.documents (
  id bigserial NOT NULL,
  content text NULL,
  metadata jsonb NULL,
  embedding vector(1536) NULL,
  CONSTRAINT documents_pkey PRIMARY KEY (id)
) TABLESPACE pg_default;

-- Crear índice para búsqueda vectorial (opcional pero recomendado para mejor rendimiento)
CREATE INDEX IF NOT EXISTS documents_embedding_idx 
ON public.documents 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Índice para búsqueda por metadata (filePath, organizationId)
CREATE INDEX IF NOT EXISTS documents_metadata_idx 
ON public.documents 
USING gin (metadata);

-- Comentarios para documentación
COMMENT ON TABLE public.documents IS 'Vector store para embeddings de documentos. Compatible con n8n Supabase Vector Store node.';
COMMENT ON COLUMN public.documents.content IS 'Contenido del chunk de texto';
COMMENT ON COLUMN public.documents.metadata IS 'Metadata en JSONB: filePath, organizationId, chunkIndex, fileName, uploadedAt, userId';
COMMENT ON COLUMN public.documents.embedding IS 'Vector embedding (1536 dimensiones para text-embedding-3-small)';

