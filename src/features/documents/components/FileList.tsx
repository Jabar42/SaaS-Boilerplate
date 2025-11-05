'use client';

import { formatDistanceToNow } from 'date-fns';
import { FileText } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import type { FileItem } from '../types/file.types';
import { FileActions } from './FileActions';

type FileListProps = {
  files: FileItem[];
  loading?: boolean;
  onDownload: (file: FileItem) => void | Promise<void>;
  onDelete?: (file: FileItem) => void | Promise<void>;
};

function formatFileSize(bytes: number): string {
  if (bytes === 0) {
    return '0 Bytes';
  }
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${Math.round(bytes / k ** i * 100) / 100} ${sizes[i]}`;
}

export function FileList({
  files,
  loading = false,
  onDownload,
  onDelete,
}: FileListProps) {
  const t = useTranslations('Documentos');

  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map(i => (
          <div key={i} className="flex items-center gap-4">
            <Skeleton className="h-12 flex-1" />
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-8 w-32" />
          </div>
        ))}
      </div>
    );
  }

  if (files.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
        <FileText className="mb-4 size-12 text-muted-foreground" />
        <div className="text-sm font-medium text-muted-foreground">
          {t('no_files')}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('file_name')}</TableHead>
            <TableHead>{t('file_size')}</TableHead>
            <TableHead>{t('file_date')}</TableHead>
            <TableHead className="text-right">{t('file_actions')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {files.map(file => (
            <TableRow key={file.path}>
              <TableCell className="font-medium">
                <div className="flex items-center gap-2">
                  <FileText className="size-4 text-muted-foreground" />
                  <span className="truncate">{file.name}</span>
                  {file.isGlobal && (
                    <Badge variant="secondary" className="text-xs">
                      {t('global_badge')}
                    </Badge>
                  )}
                </div>
              </TableCell>
              <TableCell>{formatFileSize(file.size)}</TableCell>
              <TableCell>
                {formatDistanceToNow(file.createdAt, {
                  addSuffix: true,
                })}
              </TableCell>
              <TableCell className="text-right">
                <FileActions
                  file={file}
                  onDownload={onDownload}
                  onDelete={onDelete}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
