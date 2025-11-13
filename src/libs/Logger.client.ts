/**
 * Logger para componentes cliente
 * Solo usa console ya que pino/logtail requieren módulos de Node.js
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

/**
 * Helper para loguear errores de rutas con información de request
 */
export function logRouteError(
  route: string,
  error: unknown,
  requestInfo?: {
    method?: string;
    url?: string;
    headers?: Record<string, string>;
    userId?: string;
    orgId?: string;
  },
) {
  logError(`ROUTE:${route}`, error, {
    request: {
      method: requestInfo?.method || 'unknown',
      url: requestInfo?.url || 'unknown',
      pathname: requestInfo?.url
        ? new URL(requestInfo.url).pathname
        : 'unknown',
      userId: requestInfo?.userId || 'unknown',
      orgId: requestInfo?.orgId || 'unknown',
      userAgent: requestInfo?.headers?.['user-agent'] || 'unknown',
    },
  });
}
