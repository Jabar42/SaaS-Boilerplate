export type FileMetadata = {
  name: string;
  id: string;
  created_at: string;
  updated_at: string;
  last_accessed_at: string;
  metadata: {
    size?: number;
    mimetype?: string;
    [key: string]: unknown;
  } | null;
  user_metadata: Record<string, unknown> | null;
};

export type FileItem = {
  name: string;
  path: string;
  size: number;
  createdAt: Date;
  updatedAt: Date;
  isGlobal: boolean;
  mimetype?: string;
};

export type UploadProgress = {
  fileName: string;
  progress: number;
  status: 'uploading' | 'success' | 'error';
  error?: string;
};
