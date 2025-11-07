'use client';

import { FileText, Info, Loader2, Upload } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { useFiles } from '@/features/documents/hooks/useFiles';
import { useFileUpload } from '@/features/documents/hooks/useFileUpload';
import { useToast } from '@/hooks/use-toast';

import { DocumentCheckbox } from './DocumentCheckbox';

type DocumentSelectorProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDocuments: string[];
  onToggleDocument: (path: string) => void;
};

export function DocumentSelector({
  open,
  onOpenChange,
  selectedDocuments,
  onToggleDocument,
}: DocumentSelectorProps) {
  const t = useTranslations('Chat');
  const { toast } = useToast();
  const { userFiles, loading, error, refetch } = useFiles();
  const { uploadFile, uploadProgress } = useFileUpload();
  const [uploadingFiles, setUploadingFiles] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setUploadingFiles(prev => new Set(prev).add(file.name));

    try {
      const result = await uploadFile(file);

      if (result.success && result.path) {
        toast({
          title: t('upload_success_title'),
          description: t('upload_success_description', { count: 1 }),
        });
        await refetch();
      } else {
        throw new Error(result.error || 'Error al subir el archivo');
      }
    } catch (error) {
      toast({
        title: t('upload_error_title'),
        description:
          error instanceof Error
            ? error.message
            : t('upload_error_description', { count: 1 }),
        variant: 'destructive',
      });
    } finally {
      setUploadingFiles((prev) => {
        const next = new Set(prev);
        next.delete(file.name);
        return next;
      });
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const allFiles = userFiles;
  const selectedCount = selectedDocuments.length;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex h-full flex-col rounded-l-lg sm:max-w-md"
      >
        <SheetHeader>
          <SheetTitle>{t('manage_documents')}</SheetTitle>
          <SheetDescription>{t('select_documents_description')}</SheetDescription>
        </SheetHeader>

        <div className="mt-4 flex-1 overflow-y-auto">
          {/* Upload Button */}
          <div className="mb-4 flex justify-end">
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={handleFileSelect}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleUploadClick}
              disabled={uploadingFiles.size > 0}
            >
              <Upload className="mr-2 size-4" />
              {t('upload_document')}
            </Button>
          </div>

          {/* Loading State */}
          {loading && (
            <div className="space-y-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="flex items-center gap-4 p-2">
                  <Skeleton className="size-4" />
                  <Skeleton className="h-4 flex-1" />
                </div>
              ))}
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
              <Info className="mb-2 size-8" />
              <p className="text-sm">{error}</p>
            </div>
          )}

          {/* Empty State */}
          {!loading
          && !error
          && allFiles.length === 0
          && uploadingFiles.size === 0 && (
            <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
              <FileText className="mb-2 size-12" />
              <p className="text-sm">{t('no_files_available')}</p>
            </div>
          )}

          {/* Files List */}
          {!loading && !error && (
            <div className="space-y-1">
              {allFiles.map((file) => {
                const isSelected = selectedDocuments.includes(file.path);
                const isUploading = uploadingFiles.has(file.name);
                const uploadItem = uploadProgress.find(
                  item => item.fileName === file.name,
                );

                const handleToggle = (e?: React.MouseEvent | React.KeyboardEvent) => {
                  if (e) {
                    e.preventDefault();
                    e.stopPropagation();
                  }
                  if (!isUploading) {
                    onToggleDocument(file.path);
                  }
                };

                return (
                  <div
                    key={file.path}
                    role="button"
                    tabIndex={0}
                    className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-all hover:shadow-sm ${
                      isSelected
                        ? 'border-primary bg-primary/10 shadow-sm'
                        : 'border-border hover:border-primary/50 hover:bg-muted/50'
                    }`}
                    onClick={handleToggle}
                    onKeyDown={(e) => {
                      if ((e.key === 'Enter' || e.key === ' ') && !isUploading) {
                        handleToggle(e);
                      }
                    }}
                  >
                    <DocumentCheckbox
                      checked={isSelected}
                      loading={isUploading}
                      onToggle={handleToggle}
                    />

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <FileText className="size-4 shrink-0 text-muted-foreground" />
                        <span className="truncate text-sm font-medium">
                          {file.name}
                        </span>
                      </div>
                      {uploadItem && uploadItem.status === 'uploading' && (
                        <div className="mt-1 text-xs text-muted-foreground">
                          {t('uploading')}
                          {' '}
                          {uploadItem.progress}
                          %
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Upload Queue */}
              {Array.from(uploadingFiles)
                .filter(
                  fileName => !allFiles.some(file => file.name === fileName),
                )
                .map(fileName => (
                  <div
                    key={fileName}
                    className="flex items-center gap-3 rounded-lg border border-border bg-muted/50 p-3"
                  >
                    <Loader2 className="size-4 animate-spin text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <FileText className="size-4 shrink-0 text-muted-foreground" />
                        <span className="truncate text-sm font-medium">
                          {fileName}
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {t('uploading')}
                        ...
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>

        <SheetFooter className="mt-4 flex-row items-center justify-between border-t pt-4">
          <div className="text-sm text-muted-foreground">
            {selectedCount > 0
              ? t('documents_selected', { count: selectedCount })
              : t('no_documents_selected')}
          </div>
          <Button onClick={() => onOpenChange(false)} variant="outline">
            {t('close')}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
