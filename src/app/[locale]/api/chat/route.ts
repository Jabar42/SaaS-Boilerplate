import { auth, currentUser } from '@clerk/nextjs/server';
import { createUIMessageStreamResponse } from 'ai';
import type { NextRequest } from 'next/server';

import { createN8nStream } from '@/features/chat/utils/n8n-stream';
import { Env } from '@/libs/Env';
import { logger } from '@/libs/Logger';

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  let userId: string | undefined;
  let orgId: string | null | undefined;

  try {
    logger.debug({
      url: req.url,
      timestamp: new Date().toISOString(),
    }, '[API:chat] Starting request');

    // Obtener datos de autenticación del usuario
    logger.debug({}, '[API:chat] Authenticating user');
    let authResult;
    let user;
    try {
      authResult = await auth();
      user = await currentUser();
      userId = authResult.userId || undefined;
      orgId = authResult.orgId;
    } catch (authError) {
      const errorMessage = authError instanceof Error ? authError.message : 'Error desconocido en autenticación';
      const errorStack = authError instanceof Error ? authError.stack : undefined;
      logger.error(
        {
          error: authError,
          errorMessage,
          errorStack,
          timestamp: new Date().toISOString(),
        },
        '[API:chat] Error en autenticación',
      );
      return new Response(
        JSON.stringify({ error: 'Authentication error', details: errorMessage }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }

    // Verificar que el usuario esté autenticado
    if (!userId || !user) {
      logger.warn({
        hasUserId: !!userId,
        hasUser: !!user,
        timestamp: new Date().toISOString(),
      }, '[API:chat] Usuario no autenticado');
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }

    logger.debug({
      userId,
      orgId: orgId || 'none',
      email: user.emailAddresses[0]?.emailAddress || 'none',
      timestamp: new Date().toISOString(),
    }, '[API:chat] Usuario autenticado');

    // Parse request body
    logger.debug({}, '[API:chat] Parsing request body');
    let body;
    try {
      body = await req.json();
    } catch (parseError) {
      const errorMessage = parseError instanceof Error ? parseError.message : 'Error desconocido al parsear body';
      const errorStack = parseError instanceof Error ? parseError.stack : undefined;
      logger.error(
        {
          error: parseError,
          errorMessage,
          errorStack,
          userId,
          timestamp: new Date().toISOString(),
        },
        '[API:chat] Error parseando request body',
      );
      return new Response(
        JSON.stringify({ error: 'Invalid request body', details: errorMessage }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }

    const { messages, documents } = body;

    if (!messages || !Array.isArray(messages)) {
      logger.error(
        {
          messagesType: typeof messages,
          isArray: Array.isArray(messages),
          userId,
          timestamp: new Date().toISOString(),
        },
        '[API:chat] Messages no es un array',
      );
      throw new Error('Messages must be an array');
    }

    logger.debug({
      messagesCount: messages.length,
      documentsCount: documents?.length || 0,
      userId,
      timestamp: new Date().toISOString(),
    }, '[API:chat] Request body parsed');

    // documents es opcional: array de filePaths de documentos seleccionados
    const documentPaths = documents && Array.isArray(documents) ? documents : [];

    // Convert messages to the format expected by the model
    const modelMessages = messages.map((msg: any) => ({
      role: msg.role,
      content:
        msg.content
        || (msg.parts
          && msg.parts.find((p: any) => p.type === 'text')?.text)
        || '',
    }));

    // Extraer el último mensaje del usuario para enviar a n8n
    const lastUserMessage = modelMessages
      .filter(msg => msg.role === 'user')
      .pop()?.content || '';

    if (!lastUserMessage) {
      logger.error(
        {
          messagesCount: messages.length,
          modelMessagesCount: modelMessages.length,
          userId,
          timestamp: new Date().toISOString(),
        },
        '[API:chat] No se encontró mensaje del usuario',
      );
      throw new Error('No user message found');
    }

    logger.debug({
      messageLength: lastUserMessage.length,
      documentsCount: documentPaths.length,
      userId,
      timestamp: new Date().toISOString(),
    }, '[API:chat] Mensaje del usuario extraído');

    // Preparar datos del usuario para enviar al webhook
    const userData = {
      userId: userId || null,
      email: user.emailAddresses[0]?.emailAddress || null,
      firstName: user.firstName || null,
      orgId: orgId || null,
      orgRole: authResult.orgRole || null,
      sessionId: authResult.sessionId || null,
    };

    logger.debug({
      n8nEndpoint: Env.N8N_ENDPOINT || 'not configured',
      userId,
      timestamp: new Date().toISOString(),
    }, '[API:chat] Creando stream desde n8n');

    // Crear stream directamente desde n8n con datos del usuario y documentos
    let n8nTextStream;
    try {
      n8nTextStream = await createN8nStream(
        {
          prompt: lastUserMessage,
          documents: documentPaths,
          user: userData,
        },
        Env.N8N_ENDPOINT,
      );
      logger.debug({
        userId,
        timestamp: new Date().toISOString(),
      }, '[API:chat] Stream de n8n creado exitosamente');
    } catch (n8nError) {
      const errorMessage = n8nError instanceof Error ? n8nError.message : 'Error desconocido al crear stream de n8n';
      const errorStack = n8nError instanceof Error ? n8nError.stack : undefined;
      logger.error(
        {
          error: n8nError,
          errorMessage,
          errorStack,
          userId,
          orgId: orgId || 'none',
          n8nEndpoint: Env.N8N_ENDPOINT || 'not configured',
          documentsCount: documentPaths.length,
          timestamp: new Date().toISOString(),
        },
        '[API:chat] Error creando stream de n8n',
      );
      throw n8nError;
    }

    // Convertir texto en stream de UIMessageChunk para @ai-sdk/react useChat
    const uiMessageStream = new ReadableStream({
      start(controller) {
        const reader = n8nTextStream.getReader();
        const messageId = `n8n-${Date.now()}`;

        async function pump() {
          try {
            // Enviar text-start
            controller.enqueue({
              type: 'text-start',
              id: messageId,
            });

            while (true) {
              const { done, value } = await reader.read();
              if (done) {
                // Enviar text-end para finalizar
                controller.enqueue({
                  type: 'text-end',
                  id: messageId,
                });
                controller.close();
                const duration = Date.now() - startTime;
                logger.debug({
                  userId,
                  messageId,
                  durationMs: duration,
                  timestamp: new Date().toISOString(),
                }, '[API:chat] Stream completado exitosamente');
                break;
              }
              if (value) {
                // Enviar text-delta
                controller.enqueue({
                  type: 'text-delta',
                  id: messageId,
                  delta: value,
                });
              }
            }
          } catch (streamError) {
            const errorMessage = streamError instanceof Error ? streamError.message : 'Error desconocido en stream';
            const errorStack = streamError instanceof Error ? streamError.stack : undefined;
            logger.error(
              {
                error: streamError,
                errorMessage,
                errorStack,
                userId,
                messageId,
                timestamp: new Date().toISOString(),
              },
              '[API:chat] Error en stream de mensajes',
            );
            controller.error(streamError);
          }
        }

        pump();
      },
    });

    return createUIMessageStreamResponse({ stream: uiMessageStream });
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    const errorName = error instanceof Error ? error.name : 'UnknownError';

    logger.error(
      {
        error,
        errorMessage,
        errorStack,
        errorName,
        userId: userId || 'unknown',
        orgId: orgId || 'unknown',
        durationMs: duration,
        timestamp: new Date().toISOString(),
      },
      '[API:chat] Error no manejado en API route',
    );

    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        details: errorMessage,
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }
}
