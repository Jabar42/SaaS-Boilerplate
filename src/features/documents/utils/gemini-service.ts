/**
 * Servicio para integración con Google Gemini API
 * Basado en el patrón de RAC-gemini para robustez
 */

import { GoogleGenAI } from '@google/genai';

import { logger } from '@/libs/Logger';

let ai: GoogleGenAI | null = null;

/**
 * Inicializa el cliente de Gemini
 */
export function initializeGemini(): void {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'GEMINI_API_KEY no está configurada. Esta variable es requerida para usar Gemini. '
      + 'Configúrala en las variables de entorno.',
    );
  }
  ai = new GoogleGenAI({ apiKey });
  logger.info({}, 'Gemini AI initialized');
}

/**
 * Delay helper para polling
 */
async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Crea un File Search Store temporal para procesar documentos
 * Similar a RAC-gemini createRagStore
 */
export async function createTemporaryFileSearchStore(
  displayName: string,
): Promise<string> {
  if (!ai) {
    initializeGemini();
  }
  if (!ai) {
    throw new Error('Gemini AI not initialized');
  }

  try {
    const ragStore = await ai.fileSearchStores.create({
      config: { displayName },
    });
    if (!ragStore.name) {
      throw new Error('Failed to create File Search Store: name is missing.');
    }
    logger.info({ storeName: ragStore.name, displayName }, 'File Search Store created');
    return ragStore.name;
  } catch (error) {
    logger.error({ error, displayName }, 'Error creating File Search Store');
    throw error;
  }
}

/**
 * Sube un archivo al File Search Store y espera a que se procese
 * Similar a RAC-gemini uploadToRagStore
 */
export async function uploadToFileSearchStore(
  ragStoreName: string,
  file: File,
): Promise<void> {
  if (!ai) {
    initializeGemini();
  }
  if (!ai) {
    throw new Error('Gemini AI not initialized');
  }

  try {
    logger.info({ storeName: ragStoreName, fileName: file.name }, 'Uploading file to File Search Store');

    let op = await ai.fileSearchStores.uploadToFileSearchStore({
      fileSearchStoreName: ragStoreName,
      file,
    });

    // Polling hasta que la operación termine (como en RAC-gemini)
    let attempts = 0;
    const maxAttempts = 60; // Máximo 3 minutos (60 * 3 segundos)

    while (!op.done) {
      attempts++;
      if (attempts > maxAttempts) {
        throw new Error('Timeout waiting for file processing to complete');
      }

      await delay(3000); // 3 segundos entre checks (como RAC-gemini)
      op = await ai.operations.get({ operation: op });

      logger.debug(
        { storeName: ragStoreName, attempts, done: op.done },
        'Polling file processing status',
      );
    }

    logger.info({ storeName: ragStoreName, fileName: file.name }, 'File processed successfully');
  } catch (error) {
    logger.error({ error, storeName: ragStoreName, fileName: file.name }, 'Error uploading file to File Search Store');
    throw error;
  }
}

/**
 * Realiza búsqueda en el File Search Store para extraer chunks
 * Usa queries estratégicas para obtener diferentes partes del documento
 */
export async function extractChunksFromFileSearchStore(
  ragStoreName: string,
  maxChunks: number = 100,
): Promise<Array<{ content: string; score?: number }>> {
  if (!ai) {
    initializeGemini();
  }
  if (!ai) {
    throw new Error('Gemini AI not initialized');
  }

  const chunks: Array<{ content: string; score?: number }> = [];
  const seenContents = new Set<string>();

  try {
    // Estrategia: Hacer múltiples búsquedas con queries diferentes
    // para cubrir diferentes partes del documento
    const searchQueries = [
      'introduction overview summary',
      'main content details information',
      'conclusion ending final',
      'key points important highlights',
      'examples use cases scenarios',
      'instructions steps procedures',
      'troubleshooting problems solutions',
      'references appendix additional',
    ];

    logger.info({ storeName: ragStoreName, queries: searchQueries.length }, 'Extracting chunks from File Search Store');

    for (const query of searchQueries) {
      try {
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: query,
          config: {
            tools: [
              {
                fileSearch: {
                  fileSearchStoreNames: [ragStoreName],
                },
              },
            ],
          },
        });

        const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];

        for (const chunk of groundingChunks) {
          const text = chunk.retrievedContext?.text;
          if (text && !seenContents.has(text)) {
            seenContents.add(text);
            chunks.push({
              content: text,
              // score is not available in GroundingChunk type
            });

            // Limitar número de chunks
            if (chunks.length >= maxChunks) {
              break;
            }
          }
        }

        if (chunks.length >= maxChunks) {
          break;
        }

        // Pequeño delay entre búsquedas
        await delay(500);
      } catch (error) {
        logger.warn({ error, query, storeName: ragStoreName }, 'Error in search query, continuing');
        // Continuar con siguiente query aunque una falle
      }
    }

    logger.info(
      { storeName: ragStoreName, chunksExtracted: chunks.length },
      'Chunks extracted from File Search Store',
    );

    return chunks;
  } catch (error) {
    logger.error({ error, storeName: ragStoreName }, 'Error extracting chunks from File Search Store');
    throw error;
  }
}

/**
 * Genera embeddings usando Gemini REST API
 * Modelo: text-embedding-004 (768 dimensiones)
 */
export async function generateEmbeddingsWithGemini(
  texts: string[],
): Promise<number[][]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY no está configurada');
  }

  if (texts.length === 0) {
    return [];
  }

  try {
    logger.info({ textsCount: texts.length }, 'Generating embeddings with Gemini');

    // Gemini REST API para batch embeddings
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:batchEmbedContents?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requests: texts.map(text => ({
            model: 'models/text-embedding-004',
            content: {
              parts: [{ text }],
            },
          })),
        }),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      logger.error(
        { status: response.status, error: errorText },
        'Gemini API error',
      );
      throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    if (!data.embeddings || data.embeddings.length !== texts.length) {
      throw new Error(
        `Error: número de embeddings (${data.embeddings?.length || 0}) no coincide con número de textos (${texts.length})`,
      );
    }

    const embeddings = data.embeddings.map((emb: any) => {
      if (!emb.values || !Array.isArray(emb.values)) {
        throw new Error('Invalid embedding format from Gemini API');
      }
      if (emb.values.length !== 768) {
        throw new Error(
          `Invalid embedding dimension: expected 768, got ${emb.values.length}`,
        );
      }
      return emb.values;
    });

    logger.info(
      { textsCount: texts.length, embeddingsCount: embeddings.length },
      'Embeddings generated successfully',
    );

    return embeddings;
  } catch (error) {
    logger.error({ error, textsCount: texts.length }, 'Error generating embeddings with Gemini');
    throw error;
  }
}

/**
 * Elimina un File Search Store
 * Similar a RAC-gemini deleteRagStore
 */
export async function deleteFileSearchStore(ragStoreName: string): Promise<void> {
  if (!ai) {
    initializeGemini();
  }
  if (!ai) {
    throw new Error('Gemini AI not initialized');
  }

  try {
    await ai.fileSearchStores.delete({
      name: ragStoreName,
      config: { force: true },
    });
    logger.info({ storeName: ragStoreName }, 'File Search Store deleted');
  } catch (error) {
    logger.error({ error, storeName: ragStoreName }, 'Error deleting File Search Store');
    // No lanzar error, solo loggear (puede que ya esté eliminado)
  }
}
