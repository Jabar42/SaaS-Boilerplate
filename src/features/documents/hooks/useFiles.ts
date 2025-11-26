'use client';

import { useUser } from '@clerk/nextjs';
import { useEffect, useState } from 'react';

import { listFiles } from '@/app/[locale]/(auth)/dashboard/documentos/actions';
import { logError } from '@/libs/Logger.client';

import type { FileItem } from '../types/file.types';

export function useFiles() {
  const { user } = useUser();
  const [userFiles, setUserFiles] = useState<FileItem[]>([]);
  const [globalFiles, setGlobalFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFiles = async () => {
    if (!user?.id) {
      if (process.env.NODE_ENV === 'development') {
        // eslint-disable-next-line no-console
        console.log('[useFiles] No user ID, skipping file fetch');
      }
      setLoading(false);
      return;
    }

    try {
      setError(null);
      setLoading(true);

      if (process.env.NODE_ENV === 'development') {
        // eslint-disable-next-line no-console
        console.log('[useFiles] Starting file fetch', {
          userId: user.id,
          orgId: user.organizationMemberships?.[0]?.organization?.id || 'none',
          timestamp: new Date().toISOString(),
        });
      }

      // Usar Server Action para listar archivos
      const result = await listFiles();

      if (!result.success) {
        const errorMessage = result.error || 'Error al cargar los archivos';
        logError('useFiles:listFiles_failed', new Error(errorMessage), {
          userId: user.id,
          orgId: user.organizationMemberships?.[0]?.organization?.id || 'none',
          serverError: result.error,
          timestamp: new Date().toISOString(),
        });
        throw new Error(errorMessage);
      }

      const userFilesCount = result.userFiles?.length || 0;
      const globalFilesCount = result.globalFiles?.length || 0;

      if (process.env.NODE_ENV === 'development') {
        // eslint-disable-next-line no-console
        console.log('[useFiles] Files loaded successfully', {
          userId: user.id,
          userFilesCount,
          globalFilesCount,
          timestamp: new Date().toISOString(),
        });
      }

      setUserFiles(result.userFiles || []);
      setGlobalFiles(result.globalFiles || []);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error al cargar los archivos';
      const errorStack = err instanceof Error ? err.stack : undefined;
      const errorName = err instanceof Error ? err.name : 'UnknownError';

      logError('useFiles:fetchFiles_exception', err, {
        userId: user?.id || 'unknown',
        orgId: user?.organizationMemberships?.[0]?.organization?.id || 'none',
        errorMessage,
        errorStack,
        errorName,
        timestamp: new Date().toISOString(),
      });

      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchFiles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  return {
    userFiles,
    globalFiles,
    loading,
    error,
    refetch: fetchFiles,
  };
}
