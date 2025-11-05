'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';

import {
  deleteFile as deleteFileAction,
  downloadFile as downloadFileAction,
} from '@/app/[locale]/(auth)/dashboard/documentos/actions';
import { useToast } from '@/hooks/use-toast';

import { useFiles } from '../hooks/useFiles';
import { useFileUpload } from '../hooks/useFileUpload';
import { useVectorizeTrigger } from '../hooks/useVectorizeTrigger';
import type { FileItem } from '../types/file.types';
import { FileDeleteDialog } from './FileDeleteDialog';
import { FileList } from './FileList';
import { FileUploader } from './FileUploader';

export function FileManager() {
  const t = useTranslations('Documentos');
  const { toast } = useToast();
  const { userFiles, globalFiles, loading, refetch } = useFiles();
  const { uploadMultipleFiles, uploadProgress } = useFileUpload();
  const { triggerVectorization } = useVectorizeTrigger();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [fileToDelete, setFileToDelete] = useState<FileItem | null>(null);

  const handleFilesSelected = async (files: File[]) => {
    await uploadMultipleFiles(files, async (uploadResults) => {
      // Contar resultados exitosos y fallidos
      const successful = uploadResults.filter(r => r.success);
      const failed = uploadResults.filter(r => !r.success);

      // Refrescar lista de archivos después de subida
      await refetch();

      // Trigger vectorización solo para archivos exitosos (opcional)
      for (const result of successful) {
        const file = files.find(f => f.name === result.fileName);
        if (file) {
          await triggerVectorization(file.name, {
            size: file.size,
            type: file.type,
          });
        }
      }

      // Mostrar notificaciones según el resultado
      if (failed.length > 0 && successful.length > 0) {
        // Algunos exitosos, algunos fallidos
        toast({
          title: t('upload_partial_success_title'),
          description: t('upload_partial_success_description', {
            successful: successful.length,
            failed: failed.length,
            total: files.length,
          }),
          variant: 'default',
        });

        // Mostrar errores individuales
        failed.forEach((result) => {
          toast({
            title: t('upload_error_title'),
            description: t('upload_error_description_file', {
              fileName: result.fileName,
              error: result.error || t('upload_error_description'),
            }),
            variant: 'destructive',
          });
        });
      } else if (failed.length > 0) {
        // Todos fallaron
        toast({
          title: t('upload_error_title'),
          description: t('upload_error_description', {
            count: failed.length,
          }),
          variant: 'destructive',
        });

        // Mostrar errores individuales
        failed.forEach((result) => {
          toast({
            title: t('upload_error_title'),
            description: t('upload_error_description_file', {
              fileName: result.fileName,
              error: result.error || t('upload_error_description'),
            }),
            variant: 'destructive',
          });
        });
      } else {
        // Todos exitosos
        toast({
          title: t('upload_success_title'),
          description: t('upload_success_description', {
            count: successful.length,
          }),
        });
      }
    });
  };

  const handleDownload = async (file: FileItem) => {
    try {
      const result = await downloadFileAction(file.path);

      if (!result.success || !result.data) {
        throw new Error(result.error || 'Error al descargar el archivo');
      }

      // Crear enlace de descarga usando el nombre original del archivo
      const url = URL.createObjectURL(result.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name; // Usa el nombre original guardado en metadata
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: t('download_success_title'),
        description: t('download_success_description', {
          fileName: file.name,
        }),
      });
    } catch (error) {
      toast({
        title: t('download_error_title'),
        description:
          error instanceof Error
            ? error.message
            : t('download_error_description'),
        variant: 'destructive',
      });
    }
  };

  const handleDeleteClick = (file: FileItem) => {
    setFileToDelete(file);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!fileToDelete) {
      return;
    }

    try {
      const result = await deleteFileAction(fileToDelete.path);

      if (!result.success) {
        throw new Error(result.error || 'Error al eliminar el archivo');
      }

      toast({
        title: t('delete_success_title'),
        description: t('delete_success_description', {
          fileName: fileToDelete.name,
        }),
      });

      // Refrescar lista de archivos
      await refetch();
    } catch (error) {
      toast({
        title: t('delete_error_title'),
        description:
          error instanceof Error
            ? error.message
            : t('delete_error_description'),
        variant: 'destructive',
      });
    } finally {
      setDeleteDialogOpen(false);
      setFileToDelete(null);
    }
  };

  // Combinar archivos del usuario y globales
  const allFiles = [...userFiles, ...globalFiles];

  return (
    <div className="space-y-6">
      {/* Upload Section */}
      <FileUploader
        onFilesSelected={handleFilesSelected}
        uploadProgress={uploadProgress}
        disabled={loading}
      />

      {/* Files List */}
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold">{t('files_title')}</h3>
          <p className="text-sm text-muted-foreground">
            {t('files_description')}
          </p>
        </div>
        <FileList
          files={allFiles}
          loading={loading}
          onDownload={handleDownload}
          onDelete={handleDeleteClick}
        />
      </div>

      {/* Delete Dialog */}
      <FileDeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        fileName={fileToDelete?.name || ''}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
}
