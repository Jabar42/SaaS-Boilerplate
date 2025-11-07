import { Buffer } from 'node:buffer';

import { openai } from '@ai-sdk/openai';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { embedMany } from 'ai';

/**
 * Procesa un documento para vectorización:
 * 1. Extrae texto según el tipo de archivo
 * 2. Divide el texto en chunks
 * 3. Genera embeddings para cada chunk
 */
export async function processDocumentForVectorization(
  fileUrl: string,
  fileType: string,
): Promise<{ chunks: Array<{ content: string; embedding: number[] }> }> {
  // Validar que OPENAI_API_KEY esté configurada (validación estricta)
  const openaiApiKey = process.env.OPENAI_API_KEY;
  if (!openaiApiKey) {
    throw new Error(
      'OPENAI_API_KEY no está configurada. Esta variable es requerida para generar embeddings. '
      + 'Configúrala en las variables de entorno.',
    );
  }

  // 1. Extraer texto según tipo de archivo
  let text: string;

  if (fileType === 'application/pdf' || fileType.includes('pdf')) {
    const response = await fetch(fileUrl);
    if (!response.ok) {
      throw new Error(`Error al descargar PDF: ${response.statusText}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    // Importación dinámica de pdf-parse para evitar problemas en el build
    // pdf-parse es CommonJS, necesitamos usar require en runtime
    // eslint-disable-next-line ts/no-require-imports
    const pdfParse = require('pdf-parse');
    const data = await pdfParse(buffer);
    text = data.text;
  } else if (
    fileType === 'text/plain'
    || fileType.includes('text')
    || fileType === 'application/json'
  ) {
    const response = await fetch(fileUrl);
    if (!response.ok) {
      throw new Error(`Error al descargar archivo de texto: ${response.statusText}`);
    }
    text = await response.text();
  } else {
    throw new Error(`Tipo de archivo no soportado: ${fileType}`);
  }

  if (!text || text.trim().length === 0) {
    throw new Error('El documento no contiene texto extraíble');
  }

  // 2. Dividir en chunks
  const textSplitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 200,
  });

  const chunkedContent = await textSplitter.createDocuments([text]);

  if (chunkedContent.length === 0) {
    throw new Error('No se pudieron crear chunks del documento');
  }

  // 3. Generar embeddings en batch
  const { embeddings } = await embedMany({
    model: openai.embedding('text-embedding-3-small'),
    values: chunkedContent.map(chunk => chunk.pageContent),
  });

  if (embeddings.length !== chunkedContent.length) {
    throw new Error(
      `Error: número de embeddings (${embeddings.length}) no coincide con número de chunks (${chunkedContent.length})`,
    );
  }

  // 4. Retornar chunks con embeddings
  return {
    chunks: chunkedContent.map((chunk, i) => {
      const embedding = embeddings[i];
      if (!embedding) {
        throw new Error(`No embedding generated for chunk ${i}`);
      }
      // embedMany returns number[] for each embedding
      const embeddingArray = Array.isArray(embedding)
        ? embedding
        : (embedding as { embedding?: number[] }).embedding || [];
      if (embeddingArray.length === 0) {
        throw new Error(`Empty embedding for chunk ${i}`);
      }
      return {
        content: chunk.pageContent,
        embedding: embeddingArray,
      };
    }),
  };
}
