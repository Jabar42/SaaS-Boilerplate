'use client';

import { useUser } from '@clerk/nextjs';
import { useParams } from 'next/navigation';
import { useEffect } from 'react';

import { logRouteError } from '@/libs/Logger.client';

export default function ChatError(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const params = useParams();
  const locale = params?.locale as string | undefined;
  const { user } = useUser();

  useEffect(() => {
    // Log error with detailed context
    logRouteError('dashboard/chat', props.error, {
      method: 'GET',
      url: typeof window !== 'undefined' ? window.location.href : 'unknown',
      headers: typeof window !== 'undefined'
        ? {
            'user-agent': window.navigator.userAgent,
          }
        : undefined,
      userId: user?.id || 'unknown',
      orgId: user?.organizationMemberships?.[0]?.organization?.id || 'unknown',
    });
  }, [props.error, user]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="max-w-md space-y-4 text-center">
        <h1 className="text-2xl font-bold text-destructive">
          Error en el Chat
        </h1>
        <p className="text-muted-foreground">
          Ha ocurrido un error inesperado al cargar el chat. Esto puede deberse
          a un problema con la conexión, la autenticación o la carga de
          documentos.
        </p>
        {process.env.NODE_ENV === 'development' && (
          <div className="rounded-lg bg-muted p-4 text-left">
            <p className="text-sm font-semibold">Detalles del error:</p>
            <p className="mt-2 text-xs text-muted-foreground">
              {props.error.message}
            </p>
            {props.error.digest && (
              <p className="mt-1 text-xs text-muted-foreground">
                Digest:
                {' '}
                {props.error.digest}
              </p>
            )}
            {props.error.stack && (
              <details className="mt-2">
                <summary className="cursor-pointer text-xs text-muted-foreground">
                  Stack trace
                </summary>
                <pre className="mt-2 overflow-auto text-xs">
                  {props.error.stack}
                </pre>
              </details>
            )}
            <div className="mt-2 text-xs text-muted-foreground">
              <p>
                <strong>Locale:</strong>
                {' '}
                {locale || 'unknown'}
              </p>
              <p>
                <strong>User ID:</strong>
                {' '}
                {user?.id || 'unknown'}
              </p>
              <p>
                <strong>Organization ID:</strong>
                {' '}
                {user?.organizationMemberships?.[0]?.organization?.id || 'unknown'}
              </p>
            </div>
          </div>
        )}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={props.reset}
            className="rounded-md bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90"
          >
            Intentar de nuevo
          </button>
          <button
            type="button"
            onClick={() => {
              window.location.href = '/dashboard';
            }}
            className="rounded-md border border-input bg-background px-4 py-2 hover:bg-accent"
          >
            Ir al inicio
          </button>
        </div>
      </div>
    </div>
  );
}
