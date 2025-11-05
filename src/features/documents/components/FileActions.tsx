'use client';

import { Download, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

import type { FileItem } from '../types/file.types';

type FileActionsProps = {
  file: FileItem;
  onDownload: (file: FileItem) => void | Promise<void>;
  onDelete?: (file: FileItem) => void | Promise<void>;
};

export function FileActions({
  file,
  onDownload,
  onDelete,
}: FileActionsProps) {
  const t = useTranslations('Documentos');

  return (
    <TooltipProvider>
      <div className="flex items-center gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onDownload(file)}
              className="size-8"
            >
              <Download className="size-4" />
              <span className="sr-only">{t('download_file')}</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{t('download_file')}</p>
          </TooltipContent>
        </Tooltip>

        {!file.isGlobal && onDelete && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onDelete(file)}
                className="size-8 text-destructive hover:text-destructive"
              >
                <Trash2 className="size-4" />
                <span className="sr-only">{t('delete_file')}</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{t('delete_file')}</p>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  );
}
