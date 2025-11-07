'use client';

import { useUser } from '@clerk/nextjs';
import { useState } from 'react';

import { uploadFile as uploadFileAction } from '@/app/[locale]/(auth)/dashboard/documentos/actions';

import type { UploadProgress } from '../types/file.types';
import { useVectorizeTrigger } from './useVectorizeTrigger';

export function useFileUpload() {
  const { user } = useUser();
  const [uploadProgress, setUploadProgress] = useState<UploadProgress[]>([]);
  const { triggerVectorization } = useVectorizeTrigger();

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

    // Función para animar el progreso gradualmente
    const animateProgress = (
      startProgress: number,
      endProgress: number,
      duration: number,
    ) => {
      return new Promise<void>((resolve) => {
        const startTime = Date.now();
        const updateProgress = () => {
          const elapsed = Date.now() - startTime;
          const progress = Math.min(
            startProgress + ((endProgress - startProgress) * elapsed) / duration,
            endProgress,
          );

          setUploadProgress(prev =>
            prev.map(item =>
              item.fileName === file.name
                ? { ...item, progress: Math.round(progress), status: 'uploading' }
                : item,
            ),
          );

          if (onProgress) {
            onProgress(Math.round(progress));
          }

          if (progress < endProgress) {
            requestAnimationFrame(updateProgress);
          } else {
            resolve();
          }
        };
        requestAnimationFrame(updateProgress);
      });
    };

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

      // Animar progreso de 0% a 70% mientras se prepara la subida
      await animateProgress(0, 70, 300);

      // Usar Server Action para subir archivo
      const uploadPromise = uploadFileAction(formData);

      // Animar progreso de 70% a 95% mientras se sube (estimación)
      const progressAnimation = animateProgress(70, 95, 1000);

      // Esperar a que termine la subida
      const result = await uploadPromise;

      // Esperar a que termine la animación de progreso
      await progressAnimation;

      if (!result.success) {
        throw new Error(result.error || 'Error al subir el archivo');
      }

      // Animar progreso de 95% a 100% al completar
      await animateProgress(95, 100, 200);

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

      // Trigger vectorización automáticamente después de upload exitoso
      // No bloquear si falla la vectorización (el archivo ya está subido)
      if (result.path) {
        triggerVectorization(result.path).catch((err) => {
          // Log error pero no bloquear el flujo
          console.warn('Error al vectorizar documento:', err);
        });
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
