-- Función stored procedure para insertar chunks de documentos
-- Esta función permite insertar chunks usando Supabase RPC, evitando problemas con el pooler
-- y las restricciones de autenticación de tenant

CREATE OR REPLACE FUNCTION insert_document_chunk(
  p_content text,
  p_metadata jsonb,
  p_embedding vector(768)
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_id bigint;
BEGIN
  INSERT INTO public.documents (content, metadata, embedding)
  VALUES (p_content, p_metadata, p_embedding)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- Comentario para documentación
COMMENT ON FUNCTION insert_document_chunk IS 'Inserta un chunk de documento en la tabla documents. Usa SECURITY DEFINER para permitir ejecución con Service Role Key.';


