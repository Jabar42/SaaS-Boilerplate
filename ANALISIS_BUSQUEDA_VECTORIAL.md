# Análisis Profundo: Funcionalidad de Búsqueda Vectorial de Documentos

## 📋 Resumen Ejecutivo

Has implementado una **infraestructura sólida** para la vectorización de documentos, pero **falta la funcionalidad de búsqueda vectorial** (similarity search). El sistema actual puede:

- ✅ Vectorizar documentos (PDF, texto)
- ✅ Almacenar embeddings en PostgreSQL con pgvector
- ✅ Verificar si un documento está vectorizado
- ✅ Eliminar chunks vectorizados

**Lo que falta:**

- ❌ Función de búsqueda por similitud semántica
- ❌ API endpoint para realizar búsquedas
- ❌ UI para búsqueda de documentos
- ❌ Integración con el chat para RAG (Retrieval Augmented Generation)

---

## 🏗️ Arquitectura Actual

### 1. Base de Datos (pgvector)

**Migración:** `supabase/migrations/20251106164051_create_vector_store_documents.sql`

```sql
CREATE TABLE public.documents (
  id bigserial PRIMARY KEY,
  content text,
  metadata jsonb,
  embedding vector(1536)  -- Para text-embedding-3-small
);

-- Índice para búsqueda vectorial (IVFFlat)
CREATE INDEX documents_embedding_idx
ON public.documents
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Índice para metadata (GIN)
CREATE INDEX documents_metadata_idx
ON public.documents USING gin (metadata);
```

**✅ Fortalezas:**

- Índice IVFFlat optimizado para búsqueda por similitud coseno
- Índice GIN para búsquedas eficientes en metadata JSONB
- Compatible con el esquema de n8n Supabase Vector Store

**⚠️ Consideraciones:**

- El parámetro `lists = 100` es adecuado para datasets pequeños/medianos (< 1M vectores)
- Para datasets más grandes, considera aumentar `lists` (regla: `lists = rows / 1000`)

---

### 2. Procesamiento de Documentos

**Archivo:** `src/features/documents/utils/document-processor.ts`

#### Flujo de Procesamiento:

1. **Extracción de Texto**
   - PDF: Usa `pdf-parse` para extraer texto
   - Texto plano: Lee directamente
   - JSON: Lee como texto

2. **Chunking**
   - Usa `RecursiveCharacterTextSplitter` de LangChain
   - Configuración:
     - `chunkSize: 1000` caracteres
     - `chunkOverlap: 200` caracteres
   - ✅ Buena configuración para documentos medianos

3. **Generación de Embeddings**
   - Modelo: `text-embedding-3-small` (OpenAI)
   - Dimensión: 1536
   - Batch processing con `embedMany` de `ai` SDK
   - ✅ Eficiente para múltiples chunks

**✅ Fortalezas:**

- Importaciones dinámicas para evitar problemas en build
- Validación robusta de errores
- Manejo de diferentes tipos de archivo

**⚠️ Áreas de Mejora:**

- Solo soporta PDF y texto plano
- No hay soporte para Word, Excel, PowerPoint
- No hay extracción de metadatos del documento (autor, fecha, etc.)

---

### 3. Almacenamiento de Vectores

**Archivo:** `src/features/documents/utils/vector-store.ts`

#### Funciones Implementadas:

1. **`insertDocumentChunks()`**
   - Inserta chunks uno por uno (fallback robusto)
   - Maneja errores individuales sin detener el proceso completo
   - ✅ Buena estrategia de resiliencia

2. **`deleteDocumentChunksByFilePath()`**
   - Elimina todos los chunks de un documento
   - Útil para re-vectorizar documentos actualizados

3. **`checkDocumentVectorized()`**
   - Verifica si un documento tiene chunks en la BD
   - Retorna conteo de chunks

**✅ Fortalezas:**

- Manejo robusto de errores
- Logging detallado
- Compatible con pgvector

**⚠️ Problema Potencial:**

- Inserción uno por uno puede ser lenta para documentos grandes
- Considera inserción en batch para mejor rendimiento

---

### 4. API de Vectorización

**Archivo:** `src/app/[locale]/api/documents/vectorize/route.ts`

#### Flujo Completo:

1. Autenticación (Clerk)
2. Validación de `filePath`
3. Obtención de URL firmada desde Supabase Storage
4. Procesamiento del documento
5. Inserción en vector store

**✅ Fortalezas:**

- Logging exhaustivo en cada paso
- Manejo de errores específico por tipo
- Timeout configurado (60s)
- Importaciones dinámicas para evitar problemas en build

**⚠️ Consideraciones:**

- 60s puede no ser suficiente para documentos muy grandes
- No hay límite de tamaño de archivo (solo el de Next.js: 50MB)

---

### 5. Integración con Upload

**Archivo:** `src/features/documents/hooks/useVectorizeTrigger.ts`

- Hook que dispara vectorización después de upload
- Integrado con `useFileUpload`
- ✅ Automatización correcta

---

## ❌ Lo que Falta: Búsqueda Vectorial

### Problema Principal

**No existe ninguna función para realizar búsquedas por similitud semántica.** Tienes toda la infraestructura para almacenar vectores, pero no hay forma de consultarlos.

### Funcionalidad Requerida

#### 1. Función de Búsqueda en `vector-store.ts`

```typescript
// Función que debería existir:
export async function searchSimilarDocuments(
  queryEmbedding: number[],
  organizationId: string,
  options?: {
    limit?: number;
    threshold?: number;
    filePaths?: string[];
  },
): Promise<
  Array<{
    content: string;
    metadata: DocumentChunkMetadata;
    similarity: number;
  }>
>;
```

**Query SQL necesaria:**

```sql
SELECT
  content,
  metadata,
  1 - (embedding <=> $1::vector) as similarity
FROM public.documents
WHERE metadata->>'organizationId' = $2
  AND (1 - (embedding <=> $1::vector)) >= $3  -- threshold
ORDER BY embedding <=> $1::vector
LIMIT $4;
```

**Operador `<=>`**: Distancia coseno en pgvector

- Menor valor = más similar
- `1 - distancia` = similitud (0-1)

#### 2. API Endpoint para Búsqueda

**Ruta sugerida:** `src/app/[locale]/api/documents/search/route.ts`

```typescript
POST /api/documents/search
Body: {
  query: string;
  limit?: number;
  threshold?: number;
  filePaths?: string[];
}
```

**Flujo:**

1. Generar embedding de la query
2. Buscar documentos similares
3. Retornar resultados con similitud

#### 3. UI para Búsqueda

**Componente sugerido:** `src/features/documents/components/DocumentSearch.tsx`

- Input de búsqueda
- Lista de resultados con score de similitud
- Filtros (por archivo, fecha, etc.)

#### 4. Integración con Chat (RAG)

**Archivo actual:** `src/app/[locale]/api/chat/route.ts`

Actualmente el chat envía `documentPaths` a n8n, pero no realiza búsqueda vectorial en el backend.

**Mejora sugerida:**

- Si no se especifican `documentPaths`, realizar búsqueda vectorial automática
- Incluir chunks relevantes en el contexto del chat

---

## 🔍 Análisis de Problemas Potenciales

### 1. Rendimiento del Índice IVFFlat

**Problema:** El índice IVFFlat requiere un número mínimo de vectores para ser efectivo.

**Regla general:**

- Mínimo recomendado: `lists * 10` vectores
- Con `lists = 100`, necesitas al menos 1,000 vectores

**Solución:**

- Para datasets pequeños, considera usar búsqueda secuencial (sin índice)
- O ajustar `lists` según el tamaño del dataset

### 2. Inserción Uno por Uno

**Problema:** `insertDocumentChunks()` inserta chunks individualmente, lo cual es lento.

**Solución sugerida:**

```typescript
// Inserción en batch (más eficiente)
await db.$executeRawUnsafe(
  `INSERT INTO public.documents (content, metadata, embedding)
   SELECT * FROM UNNEST($1::text[], $2::jsonb[], $3::vector[])`,
  chunks.map((c) => c.content),
  chunks.map((c) => JSON.stringify(c.metadata)),
  chunks.map((c) => c.embedding),
);
```

### 3. Falta de Validación de Dimensiones

**Problema:** No hay validación de que los embeddings tengan exactamente 1536 dimensiones.

**Solución:**

```typescript
if (chunk.embedding.length !== 1536) {
  throw new Error(`Invalid embedding dimension: ${chunk.embedding.length}`);
}
```

### 4. Manejo de Chunks Duplicados

**Problema:** Si se vectoriza el mismo documento dos veces, se crean chunks duplicados.

**Solución:**

- Opción A: Eliminar chunks existentes antes de insertar (ya implementado en `deleteDocumentChunksByFilePath`)
- Opción B: Usar `ON CONFLICT` en la inserción

---

## 📊 Métricas y Monitoreo

### Lo que Falta Monitorear

1. **Tiempo de vectorización por documento**
2. **Número de chunks generados por documento**
3. **Tiempo de búsqueda vectorial**
4. **Precisión de búsquedas** (feedback de usuarios)

### Sugerencias

- Agregar métricas en `vector-store.ts` y `document-processor.ts`
- Logging estructurado (ya implementado ✅)
- Dashboard de métricas (opcional)

---

## 🚀 Recomendaciones de Implementación

### Prioridad Alta

1. **Implementar función de búsqueda vectorial**
   - Archivo: `src/features/documents/utils/vector-store.ts`
   - Función: `searchSimilarDocuments()`

2. **Crear API endpoint de búsqueda**
   - Archivo: `src/app/[locale]/api/documents/search/route.ts`
   - Método: POST
   - Input: query (texto)
   - Output: documentos similares con scores

3. **Generar embedding de query**
   - Reusar lógica de `document-processor.ts`
   - Crear función `generateQueryEmbedding(query: string)`

### Prioridad Media

4. **UI de búsqueda**
   - Componente: `DocumentSearch.tsx`
   - Integrar en `FileManager.tsx`

5. **Integración con Chat (RAG)**
   - Modificar `chat/route.ts` para usar búsqueda vectorial
   - Incluir chunks relevantes en el contexto

### Prioridad Baja

6. **Optimizaciones de rendimiento**
   - Inserción en batch
   - Caché de embeddings de queries frecuentes
   - Ajuste de parámetros del índice IVFFlat

7. **Soporte para más tipos de archivo**
   - Word (.docx)
   - Excel (.xlsx)
   - PowerPoint (.pptx)

---

## 📝 Ejemplo de Implementación Sugerida

### 1. Función de Búsqueda

```typescript
// src/features/documents/utils/vector-store.ts

export async function searchSimilarDocuments(
  queryEmbedding: number[],
  organizationId: string,
  options: {
    limit?: number;
    threshold?: number;
    filePaths?: string[];
  } = {},
): Promise<
  Array<{
    content: string;
    metadata: DocumentChunkMetadata;
    similarity: number;
    id: bigint;
  }>
> {
  const {
    limit = 10,
    threshold = 0.7, // 70% de similitud mínima
    filePaths = [],
  } = options;

  try {
    // Construir query SQL
    let query = `
      SELECT
        id,
        content,
        metadata,
        1 - (embedding <=> $1::vector) as similarity
      FROM public.documents
      WHERE metadata->>'organizationId' = $2
        AND (1 - (embedding <=> $1::vector)) >= $3
    `;

    const params: any[] = [
      `[${queryEmbedding.join(",")}]`, // embedding como string
      organizationId,
      threshold,
    ];

    // Filtrar por filePaths si se especifican
    if (filePaths.length > 0) {
      query += ` AND metadata->>'filePath' = ANY($4::text[])`;
      params.push(filePaths);
    }

    query += ` ORDER BY embedding <=> $1::vector LIMIT $5`;
    params.push(limit);

    const result = await db.$queryRawUnsafe<
      Array<{
        id: bigint;
        content: string;
        metadata: string;
        similarity: number;
      }>
    >(query, ...params);

    return result.map((row) => ({
      id: row.id,
      content: row.content,
      metadata: JSON.parse(row.metadata) as DocumentChunkMetadata,
      similarity: Number(row.similarity),
    }));
  } catch (error) {
    logger.error(
      { error, organizationId, queryLength: queryEmbedding.length },
      "Error searching similar documents",
    );
    throw error;
  }
}
```

### 2. API Endpoint

```typescript
// src/app/[locale]/api/documents/search/route.ts

import { openai } from "@ai-sdk/openai";
import { auth } from "@clerk/nextjs/server";
import { embed } from "ai";
import { NextRequest, NextResponse } from "next/server";

import { searchSimilarDocuments } from "@/features/documents/utils/vector-store";

export async function POST(req: NextRequest) {
  try {
    const { userId, orgId } = await auth();

    if (!userId || !orgId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { query, limit, threshold, filePaths } = body;

    if (!query || typeof query !== "string") {
      return NextResponse.json(
        { error: "query is required and must be a string" },
        { status: 400 },
      );
    }

    // Generar embedding de la query
    const { embedding } = await embed({
      model: openai.embedding("text-embedding-3-small"),
      value: query,
    });

    const embeddingArray = Array.isArray(embedding)
      ? embedding
      : (embedding as { embedding?: number[] }).embedding || [];

    if (embeddingArray.length === 0) {
      return NextResponse.json(
        { error: "Failed to generate query embedding" },
        { status: 500 },
      );
    }

    // Buscar documentos similares
    const results = await searchSimilarDocuments(embeddingArray, orgId, {
      limit,
      threshold,
      filePaths,
    });

    return NextResponse.json({
      success: true,
      results,
      query,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
```

---

## ✅ Conclusión

Has construido una **base sólida** para búsqueda vectorial, pero falta la pieza clave: **la funcionalidad de búsqueda en sí**.

**Estado actual:**

- ✅ Infraestructura de BD (pgvector)
- ✅ Procesamiento de documentos
- ✅ Almacenamiento de vectores
- ❌ Búsqueda por similitud
- ❌ UI de búsqueda
- ❌ Integración con chat (RAG)

**Próximos pasos recomendados:**

1. Implementar `searchSimilarDocuments()` en `vector-store.ts`
2. Crear API endpoint `/api/documents/search`
3. Agregar UI de búsqueda
4. Integrar con chat para RAG

La implementación es técnicamente sólida y sigue buenas prácticas. Solo necesitas agregar la funcionalidad de búsqueda para completar el sistema.
