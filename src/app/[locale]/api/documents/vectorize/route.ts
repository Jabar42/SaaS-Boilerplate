import { auth } from '@clerk/nextjs/server';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

// Configuración para evitar que Next.js intente pre-renderizar esta ruta
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const dynamicParams = true;
// Evitar que Next.js intente analizar esta ruta durante el build
export const revalidate = 0;

// Importaciones dinámicas para evitar que Next.js las analice durante el build
// Estas se cargarán solo en runtime

export async function POST(req: NextRequest) {
  let logger: any = null;
  let filePath: string | undefined;
  try {
    // Importaciones dinámicas en runtime para evitar análisis durante el build
    try {
      const loggerModule = await import('@/libs/Logger');
      logger = loggerModule.logger;
    } catch (loggerError) {
      // Continuar sin logger, usar console como fallback

      console.error('Error importing logger:', loggerError);
      logger = {
        // eslint-disable-next-line no-console
        info: (...args: any[]) => console.log('[INFO]', ...args),

        error: (...args: any[]) => console.error('[ERROR]', ...args),
      };
    }

    const { getSupabaseAdmin } = await import('@/libs/SupabaseAdmin');

    const { userId, orgId } = await auth();

    if (!userId || !orgId) {
      logger?.error('Unauthorized request - missing userId or orgId');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 },
      );
    }

    let body: any;
    try {
      body = await req.json();
      filePath = body?.filePath;
    } catch (parseError) {
      logger?.error('Error parsing request body:', parseError);
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 },
      );
    }

    if (!filePath || typeof filePath !== 'string') {
      logger?.error('Invalid filePath:', { filePath, type: typeof filePath });
      return NextResponse.json(
        { error: 'filePath is required and must be a string' },
        { status: 400 },
      );
    }

    logger?.info('Starting vectorization for file:', filePath);

    // 1. Obtener URL firmada del archivo desde Supabase Storage
    let supabase;
    try {
      supabase = getSupabaseAdmin();
    } catch (supabaseError) {
      logger?.error('Error getting Supabase admin client:', supabaseError);
      return NextResponse.json(
        {
          error: 'Error al inicializar cliente de Supabase',
          details: process.env.NODE_ENV === 'development'
            ? (supabaseError instanceof Error ? supabaseError.message : String(supabaseError))
            : undefined,
        },
        { status: 500 },
      );
    }
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
      // Importación dinámica para evitar análisis durante el build
      const { processDocumentForVectorization } = await import('@/features/documents/utils/document-processor');
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
    // filePath ya está validado arriba, así que es seguro usarlo como string
    const validatedFilePath = filePath as string;
    const chunksWithMetadata = chunks.map((chunk, index) => ({
      content: chunk.content,
      embedding: chunk.embedding,
      metadata: {
        filePath: validatedFilePath,
        organizationId: orgId,
        chunkIndex: index,
        fileName,
        uploadedAt: new Date().toISOString(),
        userId,
      },
    }));

    // 5. Insertar en tabla documents (esquema de n8n)
    logger.info(
      { filePath, chunksToInsert: chunksWithMetadata.length },
      'Starting insertion of chunks into vector store',
    );

    let insertResult;
    try {
      // Importación dinámica para evitar análisis durante el build
      const { insertDocumentChunks } = await import('@/features/documents/utils/vector-store');
      insertResult = await insertDocumentChunks(chunksWithMetadata);
    } catch (insertError) {
      logger.error(
        {
          error: insertError,
          errorMessage: insertError instanceof Error ? insertError.message : String(insertError),
          errorStack: insertError instanceof Error ? insertError.stack : undefined,
          filePath,
          chunksCount: chunksWithMetadata.length,
        },
        'Error calling insertDocumentChunks',
      );
      return NextResponse.json(
        {
          error: insertError instanceof Error
            ? insertError.message
            : 'Error al insertar chunks en la base de datos',
        },
        { status: 500 },
      );
    }

    if (!insertResult.success) {
      logger.error(
        {
          error: insertResult.error,
          filePath,
          chunksCount: chunksWithMetadata.length,
        },
        'Error inserting chunks into vector store',
      );
      return NextResponse.json(
        {
          error: insertResult.error || 'Error al insertar chunks',
          details: process.env.NODE_ENV === 'development'
            ? `Failed to insert ${chunksWithMetadata.length} chunks`
            : undefined,
        },
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

    // Usar logger si está disponible, sino usar console.error
    if (logger) {
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
    } else {
      // Si no hay logger, intentar importarlo
      try {
        const { logger: errorLogger } = await import('@/libs/Logger');
        errorLogger.error(
          {
            error,
            errorMessage,
            errorStack,
            errorName,
            filePath: (error as any)?.filePath,
          },
          'Error in vectorize API route',
        );
      } catch {
        // Si no se puede importar logger, al menos loggear en consola

        console.error('[ERROR] Error in vectorize API route:', {
          errorMessage,
          errorStack,
          errorName,
        });
      }
    }

    return NextResponse.json(
      {
        error: errorMessage || 'Unknown error',
        details: process.env.NODE_ENV === 'development' ? errorStack : undefined,
      },
      { status: 500 },
    );
  }
}
