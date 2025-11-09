import { Buffer } from 'node:buffer';

import { logger } from '@/libs/Logger';

// Importaciones dinámicas para evitar problemas en el build
// Estas dependencias solo se cargarán cuando se necesiten
import {
  createTemporaryFileSearchStore,
  deleteFileSearchStore,
  extractChunksFromFileSearchStore,
  generateEmbeddingsWithGemini,
  uploadToFileSearchStore,
} from './gemini-service';

/**
 * Procesa un documento para vectorización usando Gemini File Search Store
 * Basado en el patrón robusto de RAC-gemini:
 * 1. Crea File Search Store temporal
 * 2. Sube archivo a Gemini (procesamiento automático)
 * 3. Extrae chunks usando búsquedas estratégicas
 * 4. Genera embeddings con Gemini REST API
 * 5. Limpia File Search Store temporal
 */
export async function processDocumentForVectorization(
  fileUrl: string,
  fileType: string,
): Promise<{ chunks: Array<{ content: string; embedding: number[] }> }> {
  // Validar que GEMINI_API_KEY esté configurada
  const geminiApiKey = process.env.GEMINI_API_KEY;
  if (!geminiApiKey) {
    throw new Error(
      'GEMINI_API_KEY no está configurada. Esta variable es requerida para procesar documentos con Gemini. '
      + 'Configúrala en las variables de entorno.',
    );
  }

  let fileSearchStoreName: string | null = null;

  try {
    // 1. Descargar archivo desde Supabase Storage
    logger.info({ fileUrl, fileType }, 'Downloading file for processing');
    const response = await fetch(fileUrl);
    if (!response.ok) {
      throw new Error(`Error al descargar archivo: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Determinar nombre de archivo y tipo MIME
    const fileName = fileUrl.split('/').pop() || 'document';
    const mimeType = fileType || 'application/pdf';

    // Convertir Buffer a File para Gemini
    const file = new File([buffer], fileName, { type: mimeType });

    // 2. Crear File Search Store temporal (como RAC-gemini)
    const storeDisplayName = `temp-${Date.now()}-${fileName}`;
    logger.info({ storeDisplayName }, 'Creating temporary File Search Store');
    fileSearchStoreName = await createTemporaryFileSearchStore(storeDisplayName);

    // 3. Subir archivo a Gemini File Search Store
    // Gemini procesa automáticamente: extrae texto, hace chunking, genera embeddings
    logger.info({ storeName: fileSearchStoreName, fileName }, 'Uploading file to Gemini File Search Store');
    await uploadToFileSearchStore(fileSearchStoreName, file);

    // 4. Extraer chunks del File Search Store
    // Usamos búsquedas estratégicas para obtener diferentes partes del documento
    logger.info({ storeName: fileSearchStoreName }, 'Extracting chunks from File Search Store');
    const extractedChunks = await extractChunksFromFileSearchStore(
      fileSearchStoreName,
      200, // Máximo de chunks a extraer
    );

    if (extractedChunks.length === 0) {
      throw new Error('No se pudieron extraer chunks del documento desde Gemini File Search Store');
    }

    logger.info(
      { storeName: fileSearchStoreName, chunksCount: extractedChunks.length },
      'Chunks extracted successfully',
    );

    // 5. Generar embeddings con Gemini REST API
    // Modelo: text-embedding-004 (768 dimensiones)
    const chunkTexts = extractedChunks.map(chunk => chunk.content);
    logger.info({ chunksCount: chunkTexts.length }, 'Generating embeddings with Gemini');
    const embeddings = await generateEmbeddingsWithGemini(chunkTexts);

    if (embeddings.length !== chunkTexts.length) {
      throw new Error(
        `Error: número de embeddings (${embeddings.length}) no coincide con número de chunks (${chunkTexts.length})`,
      );
    }

    // 6. Validar dimensiones de embeddings
    for (let i = 0; i < embeddings.length; i++) {
      const embedding = embeddings[i];
      if (!embedding || embedding.length !== 768) {
        throw new Error(
          `Invalid embedding at index ${i}: expected 768 dimensions, got ${embedding?.length || 0}`,
        );
      }
    }

    // 7. Retornar chunks con embeddings
    const result = {
      chunks: extractedChunks.map((chunk, i) => ({
        content: chunk.content,
        embedding: embeddings[i]!,
      })),
    };

    logger.info(
      { chunksCount: result.chunks.length },
      'Document processed successfully with Gemini',
    );

    return result;
  } catch (error) {
    logger.error(
      { error, fileUrl, fileType, storeName: fileSearchStoreName },
      'Error processing document with Gemini',
    );
    throw error;
  } finally {
    // 8. Limpiar File Search Store temporal (siempre, incluso si hay error)
    if (fileSearchStoreName) {
      try {
        await deleteFileSearchStore(fileSearchStoreName);
        logger.info({ storeName: fileSearchStoreName }, 'Temporary File Search Store cleaned up');
      } catch (cleanupError) {
        logger.warn(
          { error: cleanupError, storeName: fileSearchStoreName },
          'Error cleaning up File Search Store (non-critical)',
        );
        // No lanzar error, solo loggear (limpieza no es crítica)
      }
    }
  }
}
