import { db } from '@/libs/DB';
import { logger } from '@/libs/Logger';
import { getSupabaseAdmin } from '@/libs/SupabaseAdmin';

export type DocumentChunkMetadata = {
  filePath: string;
  organizationId: string;
  chunkIndex: number;
  fileName: string;
  uploadedAt: string;
  userId?: string;
};

/**
 * Inserta chunks en la tabla documents del vector store
 * Compatible con el esquema de n8n Supabase Vector Store
 *
 * Usa Supabase Admin con Service Role Key para evitar problemas con el pooler
 * y las restricciones de autenticación de tenant. La inserción se hace a través
 * de una función stored procedure (insert_document_chunk) que se ejecuta con
 * SECURITY DEFINER, permitiendo bypass de RLS.
 */
export async function insertDocumentChunks(
  chunks: Array<{
    content: string;
    embedding: number[];
    metadata: DocumentChunkMetadata;
  }>,
): Promise<{ success: boolean; insertedCount?: number; error?: string }> {
  try {
    if (chunks.length === 0) {
      return { success: true, insertedCount: 0 };
    }

    const supabase = getSupabaseAdmin();
    const insertedIds: bigint[] = [];

    for (const chunk of chunks) {
      try {
        // Validar que el embedding tenga 768 dimensiones (Gemini text-embedding-004)
        if (chunk.embedding.length !== 768) {
          throw new Error(
            `Invalid embedding dimension: expected 768, got ${chunk.embedding.length}`,
          );
        }

        // Convertir embedding a formato string para pgvector
        // pgvector acepta el formato: [1.0, 2.0, 3.0, ...]
        const embeddingString = `[${chunk.embedding.join(',')}]`;

        // Usar Supabase RPC para llamar a la función stored procedure
        // Esto evita problemas con el pooler y las restricciones de tenant
        const { data, error } = await supabase.rpc('insert_document_chunk', {
          p_content: chunk.content,
          p_metadata: chunk.metadata,
          p_embedding: embeddingString,
        });

        if (error) {
          throw error;
        }

        if (data !== null && data !== undefined) {
          insertedIds.push(BigInt(data));
        }
      } catch (error) {
        logger.error(
          {
            error,
            errorMessage: error instanceof Error ? error.message : String(error),
            errorStack: error instanceof Error ? error.stack : undefined,
            chunkIndex: chunk.metadata.chunkIndex,
            filePath: chunk.metadata.filePath,
            embeddingLength: chunk.embedding.length,
            embeddingSample: chunk.embedding.slice(0, 3), // Primeros 3 valores para debug
          },
          'Error inserting individual chunk',
        );
        // Continuar con los siguientes chunks aunque uno falle
      }
    }

    return {
      success: true,
      insertedCount: insertedIds.length,
    };
  } catch (error) {
    logger.error(
      {
        error,
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
        errorName: error instanceof Error ? error.name : 'UnknownError',
        chunksCount: chunks.length,
      },
      'Error inserting document chunks',
    );
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Elimina chunks por filePath
 * Usa Prisma para ejecutar la consulta SQL
 * Maneja errores de conexión de forma resiliente
 */
export async function deleteDocumentChunksByFilePath(
  filePath: string,
): Promise<{ success: boolean; deletedCount?: number; error?: string }> {
  try {
    const result = await db.$executeRawUnsafe(
      `DELETE FROM public.documents WHERE metadata->>'filePath' = $1`,
      filePath,
    );

    return {
      success: true,
      deletedCount: result as number,
    };
  } catch (error) {
    // Manejar errores de conexión de forma más específica
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorName = error instanceof Error ? error.name : 'UnknownError';

    // Si es un error de conexión, no es crítico (el archivo ya fue eliminado)
    if (
      errorName === 'PrismaClientInitializationError'
      || errorMessage.includes('Can\'t reach database server')
      || errorMessage.includes('connection')
      || errorMessage.includes('timeout')
    ) {
      logger.warn(
        { error, filePath, errorName, errorMessage },
        'Error de conexión al eliminar chunks (no crítico - archivo ya eliminado)',
      );
      // Retornar success: false pero con un mensaje claro
      return {
        success: false,
        error: 'Error de conexión con la base de datos. Los chunks se limpiarán automáticamente más tarde.',
      };
    }

    // Para otros errores, loggear como error
    logger.error({ error, filePath, errorName, errorMessage }, 'Error deleting document chunks');
    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Verifica si un documento está vectorizado (tiene chunks en la BD)
 * Usa Prisma para ejecutar la consulta SQL
 */
export async function checkDocumentVectorized(
  filePath: string,
  organizationId: string,
): Promise<{ isVectorized: boolean; chunksCount?: number }> {
  try {
    const result = await db.$queryRawUnsafe<Array<{ count: bigint }>>(
      `SELECT COUNT(*) as count 
       FROM public.documents 
       WHERE metadata->>'filePath' = $1 
       AND metadata->>'organizationId' = $2`,
      filePath,
      organizationId,
    );

    const count = result[0]?.count ? Number(result[0].count) : 0;

    return {
      isVectorized: count > 0,
      chunksCount: count,
    };
  } catch (error) {
    logger.error(
      { error, filePath, organizationId },
      'Error checking document vectorization status',
    );
    return {
      isVectorized: false,
    };
  }
}
