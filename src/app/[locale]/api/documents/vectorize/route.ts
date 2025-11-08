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
  const startTime = Date.now();
  let logger: any = null;
  let filePath: string | undefined;

  // Helper para logging con prefijo
  const logStep = (step: string, data?: any) => {
    const timestamp = new Date().toISOString();
    const prefix = `[VECTORIZE:${step}]`;
    if (logger) {
      logger.info({ step, timestamp, ...data }, prefix);
    } else {
      // eslint-disable-next-line no-console
      console.log(prefix, timestamp, data || '');
    }
  };

  const logError = (step: string, error: any, data?: any) => {
    const timestamp = new Date().toISOString();
    const prefix = `[VECTORIZE:${step}:ERROR]`;
    const errorData = {
      step,
      timestamp,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      ...data,
    };
    if (logger) {
      logger.error(errorData, prefix);
    } else {
      console.error(prefix, timestamp, errorData);
    }
  };

  try {
    logStep('INIT', { message: 'Starting vectorization request' });

    // Importaciones dinámicas en runtime para evitar análisis durante el build
    try {
      logStep('LOGGER_INIT', { message: 'Initializing logger' });
      const loggerModule = await import('@/libs/Logger');
      logger = loggerModule.logger;
      logStep('LOGGER_INIT', { message: 'Logger initialized successfully' });
    } catch (loggerError) {
      // Continuar sin logger, usar console como fallback
      logError('LOGGER_INIT', loggerError, { message: 'Using console fallback' });
      logger = {
        // eslint-disable-next-line no-console
        info: (...args: any[]) => console.log('[INFO]', ...args),

        error: (...args: any[]) => console.error('[ERROR]', ...args),
      };
    }

    logStep('SUPABASE_IMPORT', { message: 'Importing SupabaseAdmin' });
    const { getSupabaseAdmin } = await import('@/libs/SupabaseAdmin');
    logStep('SUPABASE_IMPORT', { message: 'SupabaseAdmin imported successfully' });

    logStep('AUTH', { message: 'Checking authentication' });
    const { userId, orgId } = await auth();

    logStep('AUTH', { userId: userId || 'null', orgId: orgId || 'null' });

    if (!userId || !orgId) {
      logError('AUTH', new Error('Missing userId or orgId'), { userId, orgId });
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 },
      );
    }
    logStep('AUTH', { message: 'Authentication successful', userId, orgId });

    logStep('PARSE_BODY', { message: 'Parsing request body' });
    let body: any;
    try {
      body = await req.json();
      filePath = body?.filePath;
      logStep('PARSE_BODY', { message: 'Request body parsed', hasFilePath: !!filePath });
    } catch (parseError) {
      logError('PARSE_BODY', parseError, { message: 'Failed to parse JSON' });
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 },
      );
    }

    logStep('VALIDATE_FILEPATH', { filePath, type: typeof filePath });
    if (!filePath || typeof filePath !== 'string') {
      logError('VALIDATE_FILEPATH', new Error('Invalid filePath'), { filePath, type: typeof filePath });
      return NextResponse.json(
        { error: 'filePath is required and must be a string' },
        { status: 400 },
      );
    }
    logStep('VALIDATE_FILEPATH', { message: 'filePath validated', filePath });

    // 1. Obtener URL firmada del archivo desde Supabase Storage
    logStep('SUPABASE_CLIENT', { message: 'Initializing Supabase admin client' });
    let supabase;
    try {
      supabase = getSupabaseAdmin();
      logStep('SUPABASE_CLIENT', { message: 'Supabase admin client initialized' });
    } catch (supabaseError) {
      logError('SUPABASE_CLIENT', supabaseError, {
        message: 'Failed to initialize Supabase admin client',
        hasUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
        hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      });
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

    logStep('SUPABASE_STORAGE', { message: 'Creating signed URL', filePath });
    const { data: fileData, error: urlError } = await supabase.storage
      .from('documents')
      .createSignedUrl(filePath, 3600);

    if (urlError || !fileData?.signedUrl) {
      logError('SUPABASE_STORAGE', urlError || new Error('No signedUrl returned'), {
        filePath,
        hasError: !!urlError,
        hasSignedUrl: !!fileData?.signedUrl,
        errorDetails: urlError,
      });
      return NextResponse.json(
        { error: 'No se pudo obtener URL del archivo' },
        { status: 404 },
      );
    }
    logStep('SUPABASE_STORAGE', {
      message: 'Signed URL created successfully',
      signedUrlLength: fileData.signedUrl?.length || 0,
    });

    // 2. Obtener metadata del archivo para saber el tipo
    logStep('FILE_METADATA', { message: 'Getting file metadata', filePath });
    const fileName = filePath.split('/').pop() || 'unknown';
    const folderPath = filePath.split('/').slice(0, -1).join('/');
    logStep('FILE_METADATA', { fileName, folderPath });

    const { data: fileInfo, error: listError } = await supabase.storage
      .from('documents')
      .list(folderPath, {
        search: fileName,
      });

    if (listError) {
      logError('FILE_METADATA', listError, { folderPath, fileName });
    }

    const fileType = fileInfo?.[0]?.metadata?.contentType
      || fileInfo?.[0]?.metadata?.mimetype
      || 'application/pdf';
    logStep('FILE_METADATA', {
      message: 'File metadata retrieved',
      fileType,
      hasContentType: !!fileInfo?.[0]?.metadata?.contentType,
      hasMimetype: !!fileInfo?.[0]?.metadata?.mimetype,
    });

    // 3. Verificar que OPENAI_API_KEY esté configurada antes de procesar
    logStep('OPENAI_CHECK', {
      message: 'Checking OPENAI_API_KEY',
      hasKey: !!process.env.OPENAI_API_KEY,
      keyLength: process.env.OPENAI_API_KEY?.length || 0,
    });
    if (!process.env.OPENAI_API_KEY) {
      logError('OPENAI_CHECK', new Error('OPENAI_API_KEY not configured'), {
        message: 'OPENAI_API_KEY is missing',
      });
      return NextResponse.json(
        {
          error: 'OPENAI_API_KEY no está configurada. Esta variable es requerida para generar embeddings.',
          details: process.env.NODE_ENV === 'development'
            ? 'Configura OPENAI_API_KEY en las variables de entorno de Vercel.'
            : undefined,
        },
        { status: 500 },
      );
    }
    logStep('OPENAI_CHECK', { message: 'OPENAI_API_KEY is configured' });

    // 4. Procesar documento (extraer texto, chunking, embeddings)
    logStep('DOCUMENT_PROCESSING', {
      message: 'Starting document processing',
      filePath,
      fileType,
      signedUrlLength: fileData.signedUrl?.length || 0,
    });
    let chunks;
    try {
      // Importación dinámica para evitar análisis durante el build
      logStep('DOCUMENT_PROCESSING', { message: 'Importing document-processor' });
      const { processDocumentForVectorization } = await import('@/features/documents/utils/document-processor');
      logStep('DOCUMENT_PROCESSING', { message: 'Calling processDocumentForVectorization' });

      const result = await processDocumentForVectorization(
        fileData.signedUrl,
        fileType,
      );
      chunks = result.chunks;
      logStep('DOCUMENT_PROCESSING', {
        message: 'Document processed successfully',
        chunksCount: chunks.length,
      });
    } catch (processError) {
      const errorMessage = processError instanceof Error
        ? processError.message
        : String(processError);
      const errorStack = processError instanceof Error
        ? processError.stack
        : undefined;

      logError('DOCUMENT_PROCESSING', processError, {
        errorMessage,
        errorStack,
        filePath,
        fileType,
        signedUrl: `${fileData.signedUrl?.substring(0, 50) || ''}...`, // Solo primeros 50 chars
      });

      // Mensajes de error más específicos
      let userFriendlyError = 'Error al procesar el documento';
      if (errorMessage.includes('OPENAI_API_KEY')) {
        userFriendlyError = 'OPENAI_API_KEY no está configurada correctamente';
      } else if (errorMessage.includes('descargar')) {
        userFriendlyError = 'Error al descargar el archivo desde Supabase Storage';
      } else if (errorMessage.includes('texto extraíble')) {
        userFriendlyError = 'El documento no contiene texto que pueda ser procesado';
      }

      return NextResponse.json(
        {
          error: userFriendlyError,
          details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
        },
        { status: 500 },
      );
    }

    logStep('PREPARE_CHUNKS', {
      message: 'Preparing chunks with metadata',
      chunksCount: chunks.length,
      filePath,
    });

    // 5. Preparar chunks con metadata para insertar en vector store
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

    logStep('PREPARE_CHUNKS', {
      message: 'Chunks prepared with metadata',
      chunksWithMetadataCount: chunksWithMetadata.length,
      sampleChunk: {
        contentLength: chunksWithMetadata[0]?.content?.length || 0,
        embeddingLength: chunksWithMetadata[0]?.embedding?.length || 0,
        hasMetadata: !!chunksWithMetadata[0]?.metadata,
      },
    });

    // 6. Insertar en tabla documents (esquema de n8n)
    logStep('VECTOR_STORE_INSERT', {
      message: 'Starting insertion into vector store',
      filePath,
      chunksToInsert: chunksWithMetadata.length,
    });

    let insertResult;
    try {
      // Importación dinámica para evitar análisis durante el build
      logStep('VECTOR_STORE_INSERT', { message: 'Importing vector-store utils' });
      const { insertDocumentChunks } = await import('@/features/documents/utils/vector-store');
      logStep('VECTOR_STORE_INSERT', { message: 'Calling insertDocumentChunks' });
      insertResult = await insertDocumentChunks(chunksWithMetadata);
      logStep('VECTOR_STORE_INSERT', {
        message: 'insertDocumentChunks completed',
        success: insertResult.success,
        insertedCount: insertResult.insertedCount,
        hasError: !!insertResult.error,
      });
    } catch (insertError) {
      const errorMessage = insertError instanceof Error
        ? insertError.message
        : String(insertError);
      const errorStack = insertError instanceof Error
        ? insertError.stack
        : undefined;

      logError('VECTOR_STORE_INSERT', insertError, {
        errorMessage,
        errorStack,
        filePath,
        chunksCount: chunksWithMetadata.length,
        hasDatabaseUrl: !!process.env.DATABASE_URL,
      });

      // Mensajes de error más específicos para problemas de base de datos
      let userFriendlyError = 'Error al insertar chunks en la base de datos';
      if (errorMessage.includes('vector') || errorMessage.includes('pgvector')) {
        userFriendlyError = 'Error con la extensión pgvector. Verifica que esté instalada en la base de datos.';
      } else if (errorMessage.includes('connection') || errorMessage.includes('DATABASE_URL')) {
        userFriendlyError = 'Error de conexión con la base de datos. Verifica DATABASE_URL.';
      }

      return NextResponse.json(
        {
          error: userFriendlyError,
          details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
        },
        { status: 500 },
      );
    }

    if (!insertResult.success) {
      logError('VECTOR_STORE_INSERT', new Error(insertResult.error || 'Unknown error'), {
        error: insertResult.error,
        filePath,
        chunksCount: chunksWithMetadata.length,
        insertedCount: insertResult.insertedCount,
      });
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

    const duration = Date.now() - startTime;
    logStep('SUCCESS', {
      message: 'Document vectorization completed successfully',
      filePath,
      chunksCount: insertResult.insertedCount,
      totalChunks: chunks.length,
      durationMs: duration,
      durationSeconds: (duration / 1000).toFixed(2),
    });

    return NextResponse.json({
      success: true,
      chunksCount: insertResult.insertedCount || chunks.length,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    const errorName = error instanceof Error ? error.name : 'UnknownError';
    const duration = Date.now() - startTime;

    logError('UNHANDLED_ERROR', error, {
      errorMessage,
      errorStack,
      errorName,
      filePath: filePath || 'unknown',
      durationMs: duration,
    });

    // Usar logger si está disponible, sino usar console.error
    if (logger) {
      logger.error(
        {
          error,
          errorMessage,
          errorStack,
          errorName,
          filePath: filePath || (error as any)?.filePath,
          durationMs: duration,
        },
        '[VECTORIZE:UNHANDLED_ERROR] Error in vectorize API route',
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
            filePath: filePath || (error as any)?.filePath,
            durationMs: duration,
          },
          '[VECTORIZE:UNHANDLED_ERROR] Error in vectorize API route',
        );
      } catch {
        // Si no se puede importar logger, al menos loggear en consola
        console.error('[VECTORIZE:UNHANDLED_ERROR] Error in vectorize API route:', {
          errorMessage,
          errorStack,
          errorName,
          filePath: filePath || 'unknown',
          durationMs: duration,
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
