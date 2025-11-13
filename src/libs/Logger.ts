import 'server-only';

import pino, { type DestinationStream } from 'pino';
import pretty from 'pino-pretty';

let stream: DestinationStream;
let loggerInstance: pino.Logger | null = null;

// Inicializar logger de forma segura
function initializeLogger() {
  if (loggerInstance) {
    return loggerInstance;
  }

  try {
    // Usar pretty para consola
    // Nota: Logtail se deshabilitó temporalmente debido a problemas de build
    // con módulos de Node.js. Si necesitas Logtail, configura una solución
    // alternativa o usa una versión que no requiera worker_threads
    stream = pretty({
      colorize: true,
    });
    loggerInstance = pino({ base: undefined }, stream);
  } catch (error) {
    // Fallback completo si todo falla
    console.error('Failed to initialize logger:', error);
    stream = pretty({ colorize: true });
    loggerInstance = pino({ base: undefined }, stream);
  }

  return loggerInstance;
}

// Inicializar logger inmediatamente
export const logger = initializeLogger();

/**
 * Helper para loguear errores con contexto completo
 */
export function logError(
  context: string,
  error: unknown,
  additionalContext?: Record<string, unknown>,
) {
  try {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    const errorName = error instanceof Error ? error.name : 'UnknownError';

    logger.error(
      {
        error: {
          name: errorName,
          message: errorMessage,
          stack: errorStack,
          ...(error instanceof Error && { cause: error.cause }),
        },
        context,
        ...additionalContext,
        timestamp: new Date().toISOString(),
      },
      `[${context}] Error occurred`,
    );
  } catch (logError) {
    // Fallback a console si el logger falla
    console.error(`[${context}] Error occurred:`, {
      error,
      additionalContext,
      loggerError: logError,
    });
  }
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

/**
 * Helper para loguear errores de Server Components
 */
export function logServerComponentError(
  componentName: string,
  error: unknown,
  props?: Record<string, unknown>,
) {
  logError(`SERVER_COMPONENT:${componentName}`, error, {
    componentProps: props,
  });
}

/**
 * Helper para loguear errores de Server Actions
 */
export function logServerActionError(
  actionName: string,
  error: unknown,
  input?: unknown,
) {
  logError(`SERVER_ACTION:${actionName}`, error, {
    input: input ? JSON.stringify(input, null, 2) : undefined,
  });
}
