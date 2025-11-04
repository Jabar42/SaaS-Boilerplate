import { auth, currentUser } from '@clerk/nextjs/server';
import { createUIMessageStreamResponse } from 'ai';
import type { NextRequest } from 'next/server';

import { createN8nStream } from '@/features/chat/utils/n8n-stream';
import { Env } from '@/libs/Env';
import { logger } from '@/libs/Logger';

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    // Obtener datos de autenticación del usuario
    const { userId, orgId, orgRole, sessionId } = await auth();
    const user = await currentUser();

    // Verificar que el usuario esté autenticado
    if (!userId || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }

    const body = await req.json();

    const { messages } = body;

    if (!messages || !Array.isArray(messages)) {
      throw new Error('Messages must be an array');
    }

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
      throw new Error('No user message found');
    }

    // Preparar datos del usuario para enviar al webhook
    const userData = {
      userId: userId || null,
      email: user.emailAddresses[0]?.emailAddress || null,
      firstName: user.firstName || null,
      orgId: orgId || null,
      orgRole: orgRole || null,
      sessionId: sessionId || null,
    };

    // Crear stream directamente desde n8n con datos del usuario
    const n8nTextStream = await createN8nStream(
      lastUserMessage,
      Env.N8N_ENDPOINT,
      userData,
    );

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
          } catch (error) {
            controller.error(error);
          }
        }

        pump();
      },
    });

    return createUIMessageStreamResponse({ stream: uiMessageStream });
  } catch (error) {
    logger.error({ error }, 'Error in API route');
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        details:
          error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }
}
