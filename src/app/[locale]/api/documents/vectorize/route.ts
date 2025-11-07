import { auth } from '@clerk/nextjs/server';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { processDocumentForVectorization } from '@/features/documents/utils/document-processor';
import { insertDocumentChunks } from '@/features/documents/utils/vector-store';
import { logger } from '@/libs/Logger';
import { getSupabaseAdmin } from '@/libs/SupabaseAdmin';

export async function POST(req: NextRequest) {
  try {
    const { userId, orgId } = await auth();

    if (!userId || !orgId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 },
      );
    }

    const body = await req.json();
    const { filePath } = body;

    if (!filePath || typeof filePath !== 'string') {
      return NextResponse.json(
        { error: 'filePath is required and must be a string' },
        { status: 400 },
      );
    }

    // 1. Obtener URL firmada del archivo desde Supabase Storage
    const supabase = getSupabaseAdmin();
    const { data: fileData, error: urlError } = await supabase.storage
      .from('documents')
      .createSignedUrl(filePath, 3600);

    if (urlError || !fileData?.signedUrl) {
      logger.error(
        { error: urlError, filePath },
        'Error getting signed URL from Supabase Storage',
      );
      return NextResponse.json(
        { error: 'No se pudo obtener URL del archivo' },
        { status: 404 },
      );
    }

    // 2. Obtener metadata del archivo para saber el tipo
    const fileName = filePath.split('/').pop() || 'unknown';
    const folderPath = filePath.split('/').slice(0, -1).join('/');
    const { data: fileInfo } = await supabase.storage
      .from('documents')
      .list(folderPath, {
        search: fileName,
      });

    const fileType = fileInfo?.[0]?.metadata?.contentType
      || fileInfo?.[0]?.metadata?.mimetype
      || 'application/pdf';

    // 3. Procesar documento (extraer texto, chunking, embeddings)
    logger.info({ filePath, fileType }, 'Starting document vectorization');
    let chunks;
    try {
      const result = await processDocumentForVectorization(
        fileData.signedUrl,
        fileType,
      );
      chunks = result.chunks;
    } catch (processError) {
      logger.error(
        {
          error: processError,
          errorMessage: processError instanceof Error ? processError.message : String(processError),
          errorStack: processError instanceof Error ? processError.stack : undefined,
          filePath,
          fileType,
        },
        'Error processing document for vectorization',
      );
      return NextResponse.json(
        {
          error: processError instanceof Error
            ? processError.message
            : 'Error al procesar el documento',
        },
        { status: 500 },
      );
    }

    logger.info(
      { filePath, chunksCount: chunks.length },
      'Document processed, generating embeddings',
    );

    // 4. Preparar chunks con metadata para insertar en vector store
    const chunksWithMetadata = chunks.map((chunk, index) => ({
      content: chunk.content,
      embedding: chunk.embedding,
      metadata: {
        filePath,
        organizationId: orgId,
        chunkIndex: index,
        fileName,
        uploadedAt: new Date().toISOString(),
        userId,
      },
    }));

    // 5. Insertar en tabla documents (esquema de n8n)
    const insertResult = await insertDocumentChunks(chunksWithMetadata);

    if (!insertResult.success) {
      logger.error(
        { error: insertResult.error, filePath },
        'Error inserting chunks into vector store',
      );
      return NextResponse.json(
        { error: insertResult.error || 'Error al insertar chunks' },
        { status: 500 },
      );
    }

    logger.info(
      {
        filePath,
        chunksCount: insertResult.insertedCount,
        totalChunks: chunks.length,
      },
      'Document vectorization completed successfully',
    );

    return NextResponse.json({
      success: true,
      chunksCount: insertResult.insertedCount || chunks.length,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    const errorName = error instanceof Error ? error.name : 'UnknownError';

    logger.error(
      {
        error,
        errorMessage,
        errorStack,
        errorName,
        filePath: (error as any)?.filePath,
      },
      'Error in vectorize API route',
    );

    return NextResponse.json(
      {
        error: errorMessage || 'Unknown error',
        details: process.env.NODE_ENV === 'development' ? errorStack : undefined,
      },
      { status: 500 },
    );
  }
}
