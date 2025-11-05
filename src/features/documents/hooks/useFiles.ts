'use client';

import { useUser } from '@clerk/nextjs';
import { useEffect, useState } from 'react';

import { listFiles } from '@/app/[locale]/(auth)/dashboard/documentos/actions';

import type { FileItem } from '../types/file.types';

export function useFiles() {
  const { user } = useUser();
  const [userFiles, setUserFiles] = useState<FileItem[]>([]);
  const [globalFiles, setGlobalFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFiles = async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    try {
      setError(null);
      setLoading(true);

      // Usar Server Action para listar archivos
      const result = await listFiles();

      if (!result.success) {
        throw new Error(result.error || 'Error al cargar los archivos');
      }

      setUserFiles(result.userFiles || []);
      setGlobalFiles(result.globalFiles || []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Error al cargar los archivos',
      );
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
