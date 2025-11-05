'use client';

import { Upload } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useState } from 'react';

import { Progress } from '@/components/ui/progress';

import type { UploadProgress } from '../types/file.types';

type FileUploaderProps = {
  onFilesSelected: (files: File[]) => void | Promise<void>;
  uploadProgress: UploadProgress[];
  disabled?: boolean;
};

export function FileUploader({
  onFilesSelected,
  uploadProgress,
  disabled = false,
}: FileUploaderProps) {
  const t = useTranslations('Documentos');
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) {
        await onFilesSelected(files);
      }
    },
    [onFilesSelected],
  );

  const handleFileInput = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      if (files.length > 0) {
        await onFilesSelected(files);
      }
      // Reset input
      e.target.value = '';
    },
    [onFilesSelected],
  );

  return (
    <div className="space-y-4">
      {/* Drag & Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors
          ${isDragging
      ? 'border-primary bg-primary/5'
      : 'border-muted-foreground/25 bg-muted/50'}
          ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:border-primary/50'}
        `}
      >
        <input
          type="file"
          id="file-upload"
          multiple
          onChange={handleFileInput}
          disabled={disabled}
          className="absolute inset-0 size-full cursor-pointer opacity-0"
        />
        <div className="flex flex-col items-center gap-2 text-center">
          <Upload
            className={`size-10 ${isDragging ? 'text-primary' : 'text-muted-foreground'}`}
          />
          <div className="text-sm font-medium">
            {isDragging
              ? t('upload_drop_here')
              : t('upload_drag_drop')}
          </div>
          <div className="text-xs text-muted-foreground">
            {t('upload_click_or_drag')}
          </div>
        </div>
      </div>

      {/* Upload Progress */}
      {uploadProgress.length > 0 && (
        <div className="space-y-2">
          {uploadProgress.map(item => (
            <div key={item.fileName} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="truncate font-medium">{item.fileName}</span>
                <span className="text-xs text-muted-foreground">
                  {item.status === 'uploading' && `${item.progress}%`}
                  {item.status === 'success' && t('upload_success')}
                  {item.status === 'error' && (
                    <span className="text-destructive">
                      {t('upload_error')}
                    </span>
                  )}
                </span>
              </div>
              {item.status === 'uploading' && (
                <Progress value={item.progress} className="h-2" />
              )}
              {item.status === 'error' && item.error && (
                <div className="text-xs text-destructive">{item.error}</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
