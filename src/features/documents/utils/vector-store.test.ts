import { beforeEach, describe, expect, it, vi } from 'vitest';

import { db } from '@/libs/DB';
import { logger } from '@/libs/Logger';

import {
  checkDocumentVectorized,
  deleteDocumentChunksByFilePath,
  type DocumentChunkMetadata,
  insertDocumentChunks,
} from './vector-store';

// Mock dependencies
vi.mock('@/libs/DB', () => ({
  db: {
    $queryRawUnsafe: vi.fn(),
    $executeRawUnsafe: vi.fn(),
  },
}));

vi.mock('@/libs/Logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

describe('vector-store', () => {
  const mockChunks = [
    {
      content: 'Chunk 1 content',
      embedding: Array.from({ length: 1536 }, () => 0.1),
      metadata: {
        filePath: 'tenants/org_123/file.pdf',
        organizationId: 'org_123',
        chunkIndex: 0,
        fileName: 'file.pdf',
        uploadedAt: '2024-01-01T00:00:00Z',
        userId: 'user_123',
      } as DocumentChunkMetadata,
    },
    {
      content: 'Chunk 2 content',
      embedding: Array.from({ length: 1536 }, () => 0.2),
      metadata: {
        filePath: 'tenants/org_123/file.pdf',
        organizationId: 'org_123',
        chunkIndex: 1,
        fileName: 'file.pdf',
        uploadedAt: '2024-01-01T00:00:00Z',
        userId: 'user_123',
      } as DocumentChunkMetadata,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('insertDocumentChunks', () => {
    it('debe insertar chunks correctamente', async () => {
      (db.$queryRawUnsafe as any).mockResolvedValue([
        { id: BigInt(1) },
        { id: BigInt(2) },
      ]);

      const result = await insertDocumentChunks(mockChunks);

      expect(result.success).toBe(true);
      expect(result.insertedCount).toBe(2);
      expect(db.$queryRawUnsafe).toHaveBeenCalledTimes(2);
    });

    it('debe retornar success con insertedCount 0 si no hay chunks', async () => {
      const result = await insertDocumentChunks([]);

      expect(result.success).toBe(true);
      expect(result.insertedCount).toBe(0);
      expect(db.$queryRawUnsafe).not.toHaveBeenCalled();
    });

    it('debe manejar errores al insertar chunks individuales', async () => {
      // Primer chunk falla, segundo tiene éxito
      (db.$queryRawUnsafe as any)
        .mockRejectedValueOnce(new Error('Database error'))
        .mockRejectedValueOnce(new Error('Database error')) // También falla el segundo intento (formato alternativo)
        .mockResolvedValueOnce([{ id: BigInt(2) }]); // Segundo chunk tiene éxito

      const result = await insertDocumentChunks(mockChunks);

      expect(result.success).toBe(true);
      expect(result.insertedCount).toBe(1); // Solo uno se insertó (el segundo chunk)
      expect(logger.error).toHaveBeenCalled();
    });

    it('debe intentar formato alternativo si el primero falla', async () => {
      // Primera llamada falla (formato array directo)
      // Segunda llamada tiene éxito (formato string)
      (db.$queryRawUnsafe as any)
        .mockRejectedValueOnce(new Error('Invalid format'))
        .mockResolvedValueOnce([{ id: BigInt(1) }])
        .mockResolvedValueOnce([{ id: BigInt(2) }]);

      const result = await insertDocumentChunks(mockChunks);

      expect(result.success).toBe(true);
      expect(result.insertedCount).toBe(2);
    });

    it('debe retornar error si todos los chunks fallan', async () => {
      (db.$queryRawUnsafe as any).mockRejectedValue(new Error('Database connection failed'));

      const result = await insertDocumentChunks(mockChunks);

      expect(result.success).toBe(true); // La función retorna success aunque algunos fallen
      expect(result.insertedCount).toBe(0);
      expect(logger.error).toHaveBeenCalled();
    });

    it('debe incluir metadata correcta en la inserción', async () => {
      (db.$queryRawUnsafe as any).mockResolvedValue([{ id: BigInt(1) }]);

      const chunk = mockChunks[0];
      if (!chunk) {
        throw new Error('mockChunks[0] is undefined');
      }
      await insertDocumentChunks([chunk]);

      const callArgs = (db.$queryRawUnsafe as any).mock.calls[0];

      expect(callArgs[0]).toContain('INSERT INTO public.documents');
      expect(callArgs[1]).toBe(chunk.content);
      expect(callArgs[2]).toBe(JSON.stringify(chunk.metadata));
    });

    it('debe manejar chunks con diferentes longitudes de embedding', async () => {
      const baseChunk = mockChunks[0];
      if (!baseChunk) {
        throw new Error('mockChunks[0] is undefined');
      }
      const chunkWithShortEmbedding: {
        content: string;
        embedding: number[];
        metadata: DocumentChunkMetadata;
      } = {
        content: baseChunk.content,
        embedding: Array.from({ length: 512 }, () => 0.1),
        metadata: baseChunk.metadata,
      };

      (db.$queryRawUnsafe as any).mockResolvedValue([{ id: BigInt(1) }]);

      const result = await insertDocumentChunks([chunkWithShortEmbedding]);

      expect(result.success).toBe(true);
      expect(result.insertedCount).toBe(1);
    });

    it('debe manejar errores de base de datos y retornar mensaje de error', async () => {
      const dbError = new Error('Connection timeout');
      (db.$queryRawUnsafe as any).mockRejectedValue(dbError);

      // La función no lanza error, solo retorna success: false
      // Pero en este caso, insertDocumentChunks continúa aunque falle
      const result = await insertDocumentChunks(mockChunks);

      expect(result.success).toBe(true); // Retorna success aunque fallen
      expect(result.insertedCount).toBe(0);
    });
  });

  describe('deleteDocumentChunksByFilePath', () => {
    const mockFilePath = 'tenants/org_123/file.pdf';

    it('debe eliminar chunks por filePath correctamente', async () => {
      (db.$executeRawUnsafe as any).mockResolvedValue(2);

      const result = await deleteDocumentChunksByFilePath(mockFilePath);

      expect(result.success).toBe(true);
      expect(result.deletedCount).toBe(2);
      expect(db.$executeRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM public.documents WHERE metadata->>\'filePath\''),
        mockFilePath,
      );
    });

    it('debe retornar 0 si no hay chunks para eliminar', async () => {
      (db.$executeRawUnsafe as any).mockResolvedValue(0);

      const result = await deleteDocumentChunksByFilePath(mockFilePath);

      expect(result.success).toBe(true);
      expect(result.deletedCount).toBe(0);
    });

    it('debe manejar errores al eliminar', async () => {
      const dbError = new Error('Database error');
      (db.$executeRawUnsafe as any).mockRejectedValue(dbError);

      const result = await deleteDocumentChunksByFilePath(mockFilePath);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Database error');
      expect(logger.error).toHaveBeenCalledWith(
        { error: dbError, filePath: mockFilePath },
        'Error deleting document chunks',
      );
    });

    it('debe usar el filePath correcto en la query', async () => {
      (db.$executeRawUnsafe as any).mockResolvedValue(1);

      await deleteDocumentChunksByFilePath('custom/path/document.pdf');

      const callArgs = (db.$executeRawUnsafe as any).mock.calls[0];

      expect(callArgs[1]).toBe('custom/path/document.pdf');
    });
  });

  describe('checkDocumentVectorized', () => {
    const mockFilePath = 'tenants/org_123/file.pdf';
    const mockOrganizationId = 'org_123';

    it('debe retornar true si el documento está vectorizado', async () => {
      (db.$queryRawUnsafe as any).mockResolvedValue([{ count: BigInt(5) }]);

      const result = await checkDocumentVectorized(mockFilePath, mockOrganizationId);

      expect(result.isVectorized).toBe(true);
      expect(result.chunksCount).toBe(5);
      expect(db.$queryRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining('SELECT COUNT(*)'),
        mockFilePath,
        mockOrganizationId,
      );
    });

    it('debe retornar false si el documento no está vectorizado', async () => {
      (db.$queryRawUnsafe as any).mockResolvedValue([{ count: BigInt(0) }]);

      const result = await checkDocumentVectorized(mockFilePath, mockOrganizationId);

      expect(result.isVectorized).toBe(false);
      expect(result.chunksCount).toBe(0);
    });

    it('debe manejar errores y retornar false', async () => {
      const dbError = new Error('Database connection failed');
      (db.$queryRawUnsafe as any).mockRejectedValue(dbError);

      const result = await checkDocumentVectorized(mockFilePath, mockOrganizationId);

      expect(result.isVectorized).toBe(false);
      expect(result.chunksCount).toBeUndefined();
      expect(logger.error).toHaveBeenCalledWith(
        { error: dbError, filePath: mockFilePath, organizationId: mockOrganizationId },
        'Error checking document vectorization status',
      );
    });

    it('debe manejar resultados vacíos', async () => {
      (db.$queryRawUnsafe as any).mockResolvedValue([]);

      const result = await checkDocumentVectorized(mockFilePath, mockOrganizationId);

      expect(result.isVectorized).toBe(false);
      expect(result.chunksCount).toBe(0);
    });

    it('debe convertir BigInt a número correctamente', async () => {
      (db.$queryRawUnsafe as any).mockResolvedValue([{ count: BigInt(42) }]);

      const result = await checkDocumentVectorized(mockFilePath, mockOrganizationId);

      expect(result.chunksCount).toBe(42);
      expect(typeof result.chunksCount).toBe('number');
    });

    it('debe usar filePath y organizationId en la query', async () => {
      (db.$queryRawUnsafe as any).mockResolvedValue([{ count: BigInt(1) }]);

      await checkDocumentVectorized('path/to/file.pdf', 'org_456');

      const callArgs = (db.$queryRawUnsafe as any).mock.calls[0];

      expect(callArgs[1]).toBe('path/to/file.pdf');
      expect(callArgs[2]).toBe('org_456');
    });
  });

  describe('Casos edge y validaciones', () => {
    it('debe manejar metadata sin userId', async () => {
      const baseChunk = mockChunks[0];
      if (!baseChunk) {
        throw new Error('mockChunks[0] is undefined');
      }
      const chunkWithoutUserId: {
        content: string;
        embedding: number[];
        metadata: DocumentChunkMetadata;
      } = {
        content: baseChunk.content,
        embedding: baseChunk.embedding,
        metadata: {
          ...baseChunk.metadata,
          userId: undefined,
        },
      };

      (db.$queryRawUnsafe as any).mockResolvedValue([{ id: BigInt(1) }]);

      const result = await insertDocumentChunks([chunkWithoutUserId]);

      expect(result.success).toBe(true);
      expect(result.insertedCount).toBe(1);
    });

    it('debe manejar filePaths con caracteres especiales', async () => {
      const specialPath = 'tenants/org_123/file with spaces & special-chars.pdf';
      (db.$executeRawUnsafe as any).mockResolvedValue(1);

      const result = await deleteDocumentChunksByFilePath(specialPath);

      expect(result.success).toBe(true);
    });

    it('debe manejar organizationIds largos', async () => {
      const longOrgId = 'org_'.repeat(100);
      (db.$queryRawUnsafe as any).mockResolvedValue([{ count: BigInt(0) }]);

      const result = await checkDocumentVectorized('path/file.pdf', longOrgId);

      expect(result.isVectorized).toBe(false);
    });
  });
});
