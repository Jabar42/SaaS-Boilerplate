'use client';

import { useUser } from '@clerk/nextjs';
import { useState } from 'react';

import { uploadFile as uploadFileAction } from '@/app/[locale]/(auth)/dashboard/documentos/actions';

import type { UploadProgress } from '../types/file.types';

export function useFileUpload() {
  const { user } = useUser();
  const [uploadProgress, setUploadProgress] = useState<UploadProgress[]>([]);

  const uploadFile = async (
    file: File,
    onProgress?: (progress: number) => void,
  ): Promise<{ success: boolean; error?: string; path?: string }> => {
    if (!user?.id) {
      return { success: false, error: 'Usuario no autenticado' };
    }

    // Enviar el nombre original al servidor
    // El servidor se encargará de sanitizarlo y agregar el timestamp si es necesario
    const fileName = file.name;

    // Inicializar progreso
    setUploadProgress(prev => [
      ...prev,
      { fileName: file.name, progress: 0, status: 'uploading' },
    ]);

    // Simular progreso (Server Actions no soportan progreso real)
    // Actualizar progreso a 50% al iniciar
    setUploadProgress(prev =>
      prev.map(item =>
        item.fileName === file.name
          ? { ...item, progress: 50, status: 'uploading' }
          : item,
      ),
    );

    if (onProgress) {
      onProgress(50);
    }

    try {
      // Verificar tamaño del archivo antes de intentar subir
      const maxSize = 50 * 1024 * 1024; // 50MB
      if (file.size > maxSize) {
        throw new Error(
          `El archivo excede el tamaño máximo de 50MB (tamaño actual: ${(file.size / 1024 / 1024).toFixed(2)}MB)`,
        );
      }

      // Crear FormData para pasar el archivo a la Server Action
      const formData = new FormData();
      formData.append('file', file);
      formData.append('fileName', fileName);

      // Usar Server Action para subir archivo
      const result = await uploadFileAction(formData);

      if (!result.success) {
        throw new Error(result.error || 'Error al subir el archivo');
      }

      // Actualizar progreso a éxito
      setUploadProgress(prev =>
        prev.map(item =>
          item.fileName === file.name
            ? { ...item, progress: 100, status: 'success' }
            : item,
        ),
      );

      if (onProgress) {
        onProgress(100);
      }

      return { success: true, path: result.path };
    } catch (err) {
      const errorMessage
        = err instanceof Error ? err.message : 'Error al subir el archivo';

      // Actualizar progreso a error
      setUploadProgress(prev =>
        prev.map(item =>
          item.fileName === file.name
            ? { ...item, status: 'error', error: errorMessage }
            : item,
        ),
      );

      return { success: false, error: errorMessage };
    }
  };

  const uploadMultipleFiles = async (
    files: File[],
    onComplete?: (results: Array<{ success: boolean; error?: string; fileName: string }>) => void,
  ): Promise<Array<{ success: boolean; error?: string; fileName: string }>> => {
    const uploadPromises = files.map(async (file) => {
      const result = await uploadFile(file);
      return {
        success: result.success,
        error: result.error,
        fileName: file.name,
      };
    });

    const results = await Promise.all(uploadPromises);

    // Limpiar progreso después de un delay
    setTimeout(() => {
      setUploadProgress([]);
      if (onComplete) {
        onComplete(results);
      }
    }, 2000);

    return results;
  };

  const clearProgress = () => {
    setUploadProgress([]);
  };

  return {
    uploadFile,
    uploadMultipleFiles,
    uploadProgress,
    clearProgress,
  };
}
