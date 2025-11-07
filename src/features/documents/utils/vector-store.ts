import { db } from '@/libs/DB';
import { logger } from '@/libs/Logger';

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

    // Insertar uno por uno para mayor compatibilidad con pgvector
    // pgvector puede ser sensible al formato del array
    const insertedIds: bigint[] = [];

    for (const chunk of chunks) {
      try {
        // Formato del embedding para pgvector: pasar como array de PostgreSQL
        // pgvector espera el formato: '{0.123,0.456,...}' o usar casting directo
        const embeddingArray = `{${chunk.embedding.join(',')}}`;

        const result = await db.$queryRawUnsafe<Array<{ id: bigint }>>(
          `INSERT INTO public.documents (content, metadata, embedding)
           VALUES ($1::text, $2::jsonb, $3::vector)
           RETURNING id`,
          chunk.content,
          JSON.stringify(chunk.metadata),
          embeddingArray,
        );

        if (Array.isArray(result) && result.length > 0 && result[0]) {
          insertedIds.push(result[0].id);
        }
      } catch (error) {
        logger.error(
          { error, chunkIndex: chunk.metadata.chunkIndex, filePath: chunk.metadata.filePath },
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
    logger.error({ error }, 'Error inserting document chunks');
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Elimina chunks por filePath
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
    logger.error({ error, filePath }, 'Error deleting document chunks');
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Verifica si un documento está vectorizado (tiene chunks en la BD)
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
