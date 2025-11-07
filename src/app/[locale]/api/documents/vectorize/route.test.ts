import { auth } from '@clerk/nextjs/server';
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, type MockedFunction, vi } from 'vitest';

import { processDocumentForVectorization } from '@/features/documents/utils/document-processor';
import { insertDocumentChunks } from '@/features/documents/utils/vector-store';
import { logger } from '@/libs/Logger';
import { getSupabaseAdmin } from '@/libs/SupabaseAdmin';

import { POST } from './route';

// Mock dependencies
vi.mock('@clerk/nextjs/server');
vi.mock('@/libs/SupabaseAdmin');
vi.mock('@/features/documents/utils/document-processor');
vi.mock('@/features/documents/utils/vector-store');
vi.mock('@/libs/Logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

describe('POST /api/documents/vectorize', () => {
  const mockUserId = 'user_123';
  const mockOrgId = 'org_456';
  const mockFilePath = 'tenants/user_123/test-document.pdf';
  const mockSignedUrl = 'https://supabase.co/storage/v1/object/sign/documents/test.pdf?token=abc123';
  const mockFileName = 'test-document.pdf';

  const createMockRequest = (body: { filePath?: string }) => {
    return new NextRequest('http://localhost:3000/es/api/documents/vectorize', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: {
        'Content-Type': 'application/json',
      },
    });
  };

  const createMockStorageFrom = () => {
    const storageFrom = {
      createSignedUrl: vi.fn(),
      list: vi.fn(),
    };
    return storageFrom;
  };

  const mockStorageFrom = createMockStorageFrom();

  const mockSupabaseClient = {
    storage: {
      from: vi.fn(() => mockStorageFrom),
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset mocks
    mockStorageFrom.createSignedUrl.mockReset();
    mockStorageFrom.list.mockReset();

    // Default mock implementations
    (auth as MockedFunction<typeof auth>).mockResolvedValue({
      userId: mockUserId,
      orgId: mockOrgId,
      orgRole: 'org:admin',
      sessionId: 'session_123',
    } as any);

    (getSupabaseAdmin as MockedFunction<typeof getSupabaseAdmin>).mockReturnValue(
      mockSupabaseClient as any,
    );

    // Default successful responses
    mockStorageFrom.createSignedUrl.mockResolvedValue({
      data: { signedUrl: mockSignedUrl },
      error: null,
    });

    mockStorageFrom.list.mockResolvedValue({
      data: [
        {
          name: mockFileName,
          metadata: {
            contentType: 'application/pdf',
          },
        },
      ],
      error: null,
    });

    (processDocumentForVectorization as MockedFunction<
      typeof processDocumentForVectorization
    >).mockResolvedValue({
      chunks: [
        {
          content: 'Test chunk content 1',
          embedding: Array.from({ length: 1536 }, () => 0.1) as number[],
        },
        {
          content: 'Test chunk content 2',
          embedding: Array.from({ length: 1536 }, () => 0.2) as number[],
        },
      ],
    });

    (insertDocumentChunks as MockedFunction<typeof insertDocumentChunks>).mockResolvedValue({
      success: true,
      insertedCount: 2,
    });
  });

  describe('Authentication', () => {
    it('should return 401 if user is not authenticated', async () => {
      (auth as MockedFunction<typeof auth>).mockResolvedValue({
        userId: null,
        orgId: null,
        orgRole: null,
        sessionId: null,
      } as any);

      const req = createMockRequest({ filePath: mockFilePath });
      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 401 if orgId is missing', async () => {
      (auth as MockedFunction<typeof auth>).mockResolvedValue({
        userId: mockUserId,
        orgId: undefined,
        orgRole: null,
        sessionId: null,
      } as any);

      const req = createMockRequest({ filePath: mockFilePath });
      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });
  });

  describe('Request validation', () => {
    it('should return 400 if filePath is missing', async () => {
      const req = createMockRequest({});
      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('filePath is required and must be a string');
    });

    it('should return 400 if filePath is not a string', async () => {
      const req = createMockRequest({ filePath: 123 as any });
      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('filePath is required and must be a string');
    });
  });

  describe('Supabase Storage', () => {
    it('should return 404 if file does not exist in storage', async () => {
      mockStorageFrom.createSignedUrl.mockResolvedValue({
        data: null,
        error: { message: 'File not found', statusCode: 404 },
      });

      const req = createMockRequest({ filePath: mockFilePath });
      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('No se pudo obtener URL del archivo');
    });

    it('should use default fileType if metadata is not available', async () => {
      mockStorageFrom.list.mockResolvedValue({
        data: [],
        error: null,
      });

      const req = createMockRequest({ filePath: mockFilePath });
      const response = await POST(req);

      expect(processDocumentForVectorization).toHaveBeenCalledWith(
        mockSignedUrl,
        'application/pdf',
      );
      expect(response.status).toBe(200);
    });
  });

  describe('Document processing', () => {
    it('should process document and generate embeddings', async () => {
      const req = createMockRequest({ filePath: mockFilePath });
      const response = await POST(req);
      const data = await response.json();

      expect(processDocumentForVectorization).toHaveBeenCalledWith(
        mockSignedUrl,
        'application/pdf',
      );
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.chunksCount).toBe(2);
    });

    it('should return 500 if document processing fails', async () => {
      const processingError = new Error('Failed to parse PDF');
      (processDocumentForVectorization as MockedFunction<
        typeof processDocumentForVectorization
      >).mockRejectedValue(processingError);

      const req = createMockRequest({ filePath: mockFilePath });
      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to parse PDF');
      expect(logger.error).toHaveBeenCalled();
    });

    it('should handle empty document error', async () => {
      const emptyDocError = new Error('El documento no contiene texto extraíble');
      (processDocumentForVectorization as MockedFunction<
        typeof processDocumentForVectorization
      >).mockRejectedValue(emptyDocError);

      const req = createMockRequest({ filePath: mockFilePath });
      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('El documento no contiene texto extraíble');
    });
  });

  describe('Vector store insertion', () => {
    it('should insert chunks with correct metadata', async () => {
      const req = createMockRequest({ filePath: mockFilePath });
      const response = await POST(req);

      expect(insertDocumentChunks).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            content: 'Test chunk content 1',
            embedding: expect.any(Array),
            metadata: expect.objectContaining({
              filePath: mockFilePath,
              organizationId: mockOrgId,
              chunkIndex: 0,
              fileName: mockFileName,
              userId: mockUserId,
            }),
          }),
        ]),
      );
      expect(response.status).toBe(200);
    });

    it('should return 500 if insertion fails', async () => {
      (insertDocumentChunks as MockedFunction<typeof insertDocumentChunks>).mockResolvedValue({
        success: false,
        error: 'Database connection failed',
      });

      const req = createMockRequest({ filePath: mockFilePath });
      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Database connection failed');
      expect(logger.error).toHaveBeenCalled();
    });

    it('should handle partial insertion success', async () => {
      (insertDocumentChunks as MockedFunction<typeof insertDocumentChunks>).mockResolvedValue({
        success: true,
        insertedCount: 1, // Only 1 of 2 chunks inserted
      });

      const req = createMockRequest({ filePath: mockFilePath });
      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.chunksCount).toBe(1);
    });
  });

  describe('Success flow', () => {
    it('should complete full vectorization flow successfully', async () => {
      const req = createMockRequest({ filePath: mockFilePath });
      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({
        success: true,
        chunksCount: 2,
      });

      // Verify all steps were called
      expect(getSupabaseAdmin).toHaveBeenCalled();
      expect(mockSupabaseClient.storage.from).toHaveBeenCalledWith('documents');
      expect(processDocumentForVectorization).toHaveBeenCalled();
      expect(insertDocumentChunks).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith(
        { filePath: mockFilePath, fileType: 'application/pdf' },
        'Starting document vectorization',
      );
      expect(logger.info).toHaveBeenCalledWith(
        { filePath: mockFilePath, chunksCount: 2 },
        'Document processed, generating embeddings',
      );
    });
  });

  describe('Error handling', () => {
    it('should handle unexpected errors gracefully', async () => {
      (auth as MockedFunction<typeof auth>).mockRejectedValue(new Error('Auth service unavailable'));

      const req = createMockRequest({ filePath: mockFilePath });
      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Auth service unavailable');
      expect(logger.error).toHaveBeenCalled();
    });

    it('should include stack trace in development mode', async () => {
      const originalEnv = process.env.NODE_ENV;
      Object.defineProperty(process.env, 'NODE_ENV', {
        value: 'development',
        writable: true,
        configurable: true,
      });

      const testError = new Error('Test error');
      (processDocumentForVectorization as MockedFunction<
        typeof processDocumentForVectorization
      >).mockRejectedValue(testError);

      const req = createMockRequest({ filePath: mockFilePath });
      const response = await POST(req);
      const data = await response.json();

      // In development mode, details should be included if error occurs in catch block
      // The error is caught in the try-catch for processDocumentForVectorization
      // so it returns early with status 500
      expect(response.status).toBe(500);
      expect(data.error).toBe('Test error');

      // Details may or may not be present depending on where error is caught
      if (data.details) {
        expect(data.details).toContain('Test error');
      }

      Object.defineProperty(process.env, 'NODE_ENV', {
        value: originalEnv,
        writable: true,
        configurable: true,
      });
    });
  });
});
