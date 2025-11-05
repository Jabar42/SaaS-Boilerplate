'use client';

import { useState } from 'react';

/**
 * Hook preparado para enviar petición a endpoint del backend
 * para iniciar el proceso de vectorización cuando se suba un archivo.
 */
export function useVectorizeTrigger() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const triggerVectorization = async (
    fileName: string,
    metadata?: Record<string, unknown>,
  ): Promise<{ success: boolean; error?: string }> => {
    setLoading(true);
    setError(null);

    try {
      // TODO: Implementar llamada al endpoint del backend
      // Ejemplo de estructura esperada:
      // const response = await fetch('/api/vectorize', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ fileName, metadata }),
      // });
      //
      // if (!response.ok) {
      //   throw new Error('Error al iniciar vectorización');
      // }
      //
      // const data = await response.json();
      // return { success: true };

      // Placeholder por ahora
      // eslint-disable-next-line no-console
      console.log('Vectorization trigger called:', { fileName, metadata });
      return { success: true };
    } catch (err) {
      const errorMessage
        = err instanceof Error ? err.message : 'Error al iniciar vectorización';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  return {
    triggerVectorization,
    loading,
    error,
  };
}
