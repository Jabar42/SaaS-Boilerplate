'use client';

import { useParams } from 'next/navigation';
import { useState } from 'react';

/**
 * Hook para enviar petición al endpoint del backend
 * para iniciar el proceso de vectorización cuando se suba un archivo.
 */
export function useVectorizeTrigger() {
  const params = useParams();
  const locale = params?.locale as string | undefined;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const triggerVectorization = async (
    filePath: string,
    metadata?: Record<string, unknown>,
  ): Promise<{ success: boolean; error?: string; chunksCount?: number }> => {
    setLoading(true);
    setError(null);

    try {
      const apiEndpoint = `/${locale || 'en'}/api/documents/vectorize`;
      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath, metadata }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({
          error: `Error ${response.status}: ${response.statusText}`,
        }));
        throw new Error(errorData.error || 'Error al vectorizar documento');
      }

      const data = await response.json();
      return { success: true, chunksCount: data.chunksCount };
    } catch (err) {
      const errorMessage
        = err instanceof Error ? err.message : 'Error al vectorizar documento';
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
