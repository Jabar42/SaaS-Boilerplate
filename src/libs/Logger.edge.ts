/**
 * Logger para Edge Runtime (middleware)
 * Solo usa console ya que Edge Runtime no soporta módulos de Node.js
 */

/**
 * Helper para loguear errores con contexto completo
 */
export function logError(
  context: string,
  error: unknown,
  additionalContext?: Record<string, unknown>,
) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorStack = error instanceof Error ? error.stack : undefined;
  const errorName = error instanceof Error ? error.name : 'UnknownError';

  console.error(`[${context}] Error occurred`, {
    error: {
      name: errorName,
      message: errorMessage,
      stack: errorStack,
      ...(error instanceof Error && { cause: error.cause }),
    },
    context,
    ...additionalContext,
    timestamp: new Date().toISOString(),
  });
}
