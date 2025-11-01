import { logger } from '@/libs/Logger';

export async function createN8nStream(prompt: string, endpoint: string) {
  // Construir URL con chatInput como query parameter
  const url = new URL(endpoint);
  url.searchParams.set('chatInput', prompt);

  // Hacer POST al webhook de n8n
  const response = await fetch(url.toString(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'text/event-stream',
    },
    body: JSON.stringify({}), // n8n espera un body vacío en POST
  });

  if (!response.ok) {
    throw new Error(`n8n webhook error: ${response.status} ${response.statusText}`);
  }

  if (!response.body) {
    throw new Error('No response body from n8n webhook');
  }

  // Crear un stream de texto que convierte la respuesta de n8n
  const textStream = new ReadableStream<string>({
    start(controller) {
      const reader = response.body!.getReader();
      const decoder = new TextDecoder();

      async function pump(): Promise<void> {
        try {
          while (true) {
            const { done, value } = await reader.read();

            if (done) {
              controller.close();
              break;
            }

            // Decodificar chunk
            const chunk = decoder.decode(value, { stream: true });

            // n8n envía chunks en formato JSON con streaming
            // Cada línea es un JSON con type, content y metadata
            const lines = chunk.split('\n');

            for (const line of lines) {
              if (line.trim()) {
                try {
                  const data = JSON.parse(line);

                  // Solo procesar items con contenido de texto
                  if (data.type === 'item' && data.content) {
                    controller.enqueue(data.content);
                  }
                } catch {
                  // Si no es JSON válido, ignorar
                }
              }
            }
          }
        } catch (error) {
          logger.error({ error }, 'Error reading n8n stream');
          controller.error(error);
        }
      }

      pump();
    },
  });

  return textStream;
}
