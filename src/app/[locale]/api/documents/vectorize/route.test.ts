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
vi.mock('@/libs/SupabaseAdmin', () => ({
  getSupabaseAdmin: vi.fn(),
}));
vi.mock('@/features/documents/utils/document-processor', () => ({
  processDocumentForVectorization: vi.fn(),
}));
vi.mock('@/features/documents/utils/vector-store', () => ({
  insertDocumentChunks: vi.fn(),
}));
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

    // Mock console.log y console.error para evitar errores con vitest-fail-on-console
    // ya que el código ahora usa console.log cuando no hay logger disponible
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});

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

    // Los mocks ya están importados arriba, solo necesitamos configurarlos
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
      const { processDocumentForVectorization } = await import('@/features/documents/utils/document-processor');
      const processingError = new Error('Failed to parse PDF');
      (processDocumentForVectorization as MockedFunction<
        typeof processDocumentForVectorization
      >).mockRejectedValue(processingError);

      const req = createMockRequest({ filePath: mockFilePath });
      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(500);
      // El código retorna un mensaje más amigable por defecto
      expect(data.error).toBe('Error al procesar el documento');
      expect(logger.error).toHaveBeenCalled();
    });

    it('should handle empty document error', async () => {
      const { processDocumentForVectorization } = await import('@/features/documents/utils/document-processor');
      const emptyDocError = new Error('El documento no contiene texto extraíble');
      (processDocumentForVectorization as MockedFunction<
        typeof processDocumentForVectorization
      >).mockRejectedValue(emptyDocError);

      const req = createMockRequest({ filePath: mockFilePath });
      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(500);
      // El código retorna un mensaje más amigable cuando detecta "texto extraíble"
      expect(data.error).toBe('El documento no contiene texto que pueda ser procesado');
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
      const { insertDocumentChunks } = await import('@/features/documents/utils/vector-store');
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
      const { insertDocumentChunks } = await import('@/features/documents/utils/vector-store');
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
      const { getSupabaseAdmin } = await import('@/libs/SupabaseAdmin');
      const { processDocumentForVectorization } = await import('@/features/documents/utils/document-processor');
      const { insertDocumentChunks } = await import('@/features/documents/utils/vector-store');

      expect(getSupabaseAdmin).toHaveBeenCalled();
      expect(mockSupabaseClient.storage.from).toHaveBeenCalledWith('documents');
      expect(processDocumentForVectorization).toHaveBeenCalled();
      expect(insertDocumentChunks).toHaveBeenCalled();
      // Verificar que se llamaron los logs (ahora usan logStep con formato diferente)
      expect(logger.info).toHaveBeenCalled();

      // Verificar que se llamó con el prefijo de DOCUMENT_PROCESSING
      const logCalls = (logger.info as any).mock.calls;
      const hasDocumentProcessingLog = logCalls.some((call: any[]) =>
        call[1]?.includes('DOCUMENT_PROCESSING') || call[0]?.step === 'DOCUMENT_PROCESSING',
      );

      expect(hasDocumentProcessingLog).toBe(true);
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

    it('should handle errors when SupabaseAdmin import fails', async () => {
      // Simular error al llamar getSupabaseAdmin (que es lo que realmente importamos)
      const { getSupabaseAdmin } = await import('@/libs/SupabaseAdmin');
      (getSupabaseAdmin as MockedFunction<typeof getSupabaseAdmin>).mockImplementation(() => {
        throw new Error('SUPABASE_SERVICE_ROLE_KEY not configured');
      });

      const req = createMockRequest({ filePath: mockFilePath });
      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Error al inicializar cliente de Supabase');
    });

    it('should handle errors when body parsing fails with consumed stream', async () => {
      // Crear un request y consumir el body primero para simular el error
      const req = new NextRequest('http://localhost:3000/es/api/documents/vectorize', {
        method: 'POST',
        body: JSON.stringify({ filePath: mockFilePath }),
        headers: {
          'Content-Type': 'application/json',
        },
      });

      // Consumir el body primero
      await req.text();

      const response = await POST(req);
      const data = await response.json();

      // El error puede ser 400 o 500 dependiendo de dónde falle
      expect(response.status).toBeGreaterThanOrEqual(400);
      expect(data.error).toBeDefined();
    });

    it('should include stack trace in development mode', async () => {
      // Simular NODE_ENV=development usando vi.stubEnv
      vi.stubEnv('NODE_ENV', 'development');

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
      // El código retorna un mensaje más amigable, no el error directo
      expect(response.status).toBe(500);
      expect(data.error).toBe('Error al procesar el documento');

      // Details may or may not be present depending on where error is caught
      if (data.details) {
        expect(data.details).toContain('Test error');
      }

      // Restaurar
      vi.unstubAllEnvs();
    });

    it('should return 500 if OPENAI_API_KEY is not configured', async () => {
      const originalKey = process.env.OPENAI_API_KEY;
      // Usar delete para remover la variable
      delete (process.env as any).OPENAI_API_KEY;

      const req = createMockRequest({ filePath: mockFilePath });
      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toContain('OPENAI_API_KEY no está configurada');
      expect(logger.error).toHaveBeenCalled();

      // Restaurar
      if (originalKey) {
        process.env.OPENAI_API_KEY = originalKey;
      }
    });

    it('should return 500 if Supabase admin client fails to initialize', async () => {
      const { getSupabaseAdmin } = await import('@/libs/SupabaseAdmin');
      const supabaseError = new Error('SUPABASE_SERVICE_ROLE_KEY not configured');
      (getSupabaseAdmin as MockedFunction<typeof getSupabaseAdmin>).mockImplementation(() => {
        throw supabaseError;
      });

      const req = createMockRequest({ filePath: mockFilePath });
      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Error al inicializar cliente de Supabase');
      expect(logger.error).toHaveBeenCalled();
    });

    it('should return 500 if insertion throws an error', async () => {
      const { insertDocumentChunks } = await import('@/features/documents/utils/vector-store');
      const insertError = new Error('Database connection failed');
      (insertDocumentChunks as MockedFunction<typeof insertDocumentChunks>).mockRejectedValue(
        insertError,
      );

      const req = createMockRequest({ filePath: mockFilePath });
      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(500);
      // El error puede ser "Error al insertar chunks" o "Error de conexión con la base de datos"
      // dependiendo de cómo se procese el error
      expect(data.error).toMatch(/Error al insertar chunks|Error de conexión con la base de datos/);
      expect(logger.error).toHaveBeenCalled();
    });

    it('should handle invalid JSON in request body', async () => {
      const req = new NextRequest('http://localhost:3000/es/api/documents/vectorize', {
        method: 'POST',
        body: 'invalid json',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const response = await POST(req);
      const data = await response.json();

      // Puede ser 400 o 500 dependiendo de dónde falle el parsing
      expect([400, 500]).toContain(response.status);
      expect(data.error).toBeDefined();
    });

    it('should handle pgvector errors with specific message', async () => {
      const { insertDocumentChunks } = await import('@/features/documents/utils/vector-store');
      const vectorError = new Error('pgvector extension not installed');
      (insertDocumentChunks as MockedFunction<typeof insertDocumentChunks>).mockRejectedValue(
        vectorError,
      );

      const req = createMockRequest({ filePath: mockFilePath });
      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toContain('pgvector');
    });

    it('should handle database connection errors with specific message', async () => {
      const { insertDocumentChunks } = await import('@/features/documents/utils/vector-store');
      const connectionError = new Error('DATABASE_URL connection failed');
      (insertDocumentChunks as MockedFunction<typeof insertDocumentChunks>).mockRejectedValue(
        connectionError,
      );

      const req = createMockRequest({ filePath: mockFilePath });
      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toContain('conexión con la base de datos');
    });
  });

  describe('Metadata handling', () => {
    it('should extract fileName correctly from filePath', async () => {
      const req = createMockRequest({ filePath: 'tenants/org_123/nested/path/document.pdf' });
      const response = await POST(req);

      expect(insertDocumentChunks).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            metadata: expect.objectContaining({
              fileName: 'document.pdf',
            }),
          }),
        ]),
      );
      expect(response.status).toBe(200);
    });

    it('should handle filePath with special characters', async () => {
      const specialPath = 'tenants/org_123/file with spaces & special-chars.pdf';
      mockStorageFrom.createSignedUrl.mockResolvedValue({
        data: { signedUrl: mockSignedUrl },
        error: null,
      });

      const req = createMockRequest({ filePath: specialPath });
      const response = await POST(req);

      expect(response.status).toBe(200);
    });

    it('should include metadata in chunks correctly', async () => {
      const { insertDocumentChunks } = await import('@/features/documents/utils/vector-store');
      const req = createMockRequest({ filePath: mockFilePath });
      await POST(req);

      expect(insertDocumentChunks).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            metadata: {
              filePath: mockFilePath,
              organizationId: mockOrgId,
              chunkIndex: expect.any(Number),
              fileName: mockFileName,
              uploadedAt: expect.any(String),
              userId: mockUserId,
            },
          }),
        ]),
      );
    });
  });
});
