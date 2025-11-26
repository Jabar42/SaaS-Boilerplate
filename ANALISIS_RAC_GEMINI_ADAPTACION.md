# Análisis: Adaptación de RAC-Gemini al Proyecto SaaS-Boilerplate

## 📋 Resumen Ejecutivo

El proyecto **RAC-gemini** utiliza la API de Google Gemini con **File Search Stores**, una funcionalidad nativa que maneja automáticamente:

- ✅ Almacenamiento de archivos en la nube de Google
- ✅ Extracción de texto
- ✅ Generación de embeddings
- ✅ Indexación para búsqueda
- ✅ Búsqueda semántica automática

**Objetivo de adaptación:**

- Usar la API de Gemini para procesamiento y búsqueda
- Mantener archivos en Supabase Storage (bucket actual)
- Guardar chunks y embeddings en nuestra base de datos PostgreSQL
- Compatibilidad con el esquema existente

---

## 🔍 Análisis Comparativo: RAC-gemini vs Proyecto Actual

### 1. Almacenamiento de Archivos

#### RAC-gemini (Actual)

```typescript
// Archivos se suben directamente a Gemini File Search Store
ai.fileSearchStores.uploadToFileSearchStore({
  fileSearchStoreName: ragStoreName,
  file, // File object directamente
});
```

- ✅ **Ventaja**: Procesamiento automático completo
- ❌ **Desventaja**: Archivos almacenados en la nube de Google (no control directo)
- ❌ **Desventaja**: No hay acceso directo a los archivos originales

#### Proyecto Actual (SaaS-Boilerplate)

```typescript
// Archivos en Supabase Storage
const { data, error } = await supabase.storage
  .from("documents")
  .upload(filePath, file);
```

- ✅ **Ventaja**: Control total sobre almacenamiento
- ✅ **Ventaja**: Integración con sistema existente
- ✅ **Ventaja**: Acceso directo a archivos originales

**Solución Híbrida Propuesta:**

1. Subir archivo a Supabase Storage (como actualmente)
2. Obtener URL firmada del archivo
3. Descargar archivo temporalmente
4. Enviar a Gemini para procesamiento
5. Guardar chunks y embeddings en nuestra BD

---

### 2. Procesamiento de Documentos

#### RAC-gemini (Actual)

```typescript
// Gemini procesa automáticamente:
// 1. Extrae texto
// 2. Genera chunks
// 3. Genera embeddings
// 4. Crea índice de búsqueda
// TODO automático, no hay control sobre el proceso
```

**Flujo automático:**

```
Archivo → Gemini API → Procesamiento automático → File Search Store
```

#### Proyecto Actual

```typescript
// Procesamiento manual:
// 1. Extraer texto (pdf-parse)
// 2. Chunking (LangChain)
// 3. Generar embeddings (OpenAI)
// 4. Insertar en BD (pgvector)
```

**Flujo manual:**

```
Archivo → Extracción → Chunking → Embeddings → PostgreSQL
```

**Solución Propuesta:**

- Usar Gemini para procesamiento (extracción, chunking, embeddings)
- Extraer los chunks y embeddings de la respuesta de Gemini
- Guardar en nuestra BD con el esquema actual

---

### 3. Búsqueda Vectorial

#### RAC-gemini (Actual)

```typescript
// Búsqueda automática con File Search Tool
const response = await ai.models.generateContent({
  model: "gemini-2.5-flash",
  contents: query,
  config: {
    tools: [
      {
        fileSearch: {
          fileSearchStoreNames: [ragStoreName],
        },
      },
    ],
  },
});
// Gemini automáticamente:
// 1. Genera embedding de la query
// 2. Busca en el store
// 3. Recupera chunks relevantes
// 4. Genera respuesta contextualizada
```

**Ventajas:**

- ✅ Búsqueda semántica automática
- ✅ Grounding chunks (fuentes) incluidos
- ✅ Respuesta contextualizada automática

#### Proyecto Actual

```typescript
// NO IMPLEMENTADO (falta función de búsqueda)
// Necesitaría:
// 1. Generar embedding de query
// 2. Buscar en PostgreSQL con pgvector
// 3. Recuperar chunks
// 4. Generar respuesta con LLM
```

**Solución Propuesta:**

- Opción A: Usar Gemini File Search (más simple, pero requiere almacenar en Gemini)
- Opción B: Usar Gemini para generar embedding de query, buscar en nuestra BD, usar Gemini para respuesta
- Opción C: Híbrida - Usar Gemini para todo pero guardar también en nuestra BD

---

## 🏗️ Arquitectura Propuesta: Solución Híbrida

### Diagrama de Flujo

```
┌─────────────────────────────────────────────────────────────┐
│                    Usuario Sube Archivo                      │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│          1. Upload a Supabase Storage                       │
│          (Mantener control de archivos)                     │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│          2. Obtener URL Firmada                              │
│          (Acceso temporal al archivo)                       │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│          3. Procesar con Gemini                            │
│          - Extraer texto                                   │
│          - Generar chunks                                  │
│          - Generar embeddings                              │
│          (Usar File Search Store temporalmente)            │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│          4. Extraer Chunks y Embeddings                      │
│          (De la respuesta de Gemini)                        │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│          5. Guardar en PostgreSQL                          │
│          - Tabla: documents (esquema actual)                │
│          - Campos: content, metadata, embedding              │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│          6. Eliminar File Search Store Temporal             │
│          (Ya tenemos todo en nuestra BD)                    │
└─────────────────────────────────────────────────────────────┘
```

### Flujo de Búsqueda

```
┌─────────────────────────────────────────────────────────────┐
│                    Usuario Hace Pregunta                     │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│          Opción A: Búsqueda en Nuestra BD                   │
│          1. Generar embedding de query (Gemini)            │
│          2. Buscar en PostgreSQL (pgvector)                 │
│          3. Recuperar chunks relevantes                     │
│          4. Generar respuesta (Gemini)                      │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│          Opción B: Usar Gemini File Search                  │
│          (Requiere mantener File Search Store)               │
│          1. Crear File Search Store temporal               │
│          2. Subir archivos a Gemini                         │
│          3. Usar fileSearch tool                            │
│          4. Eliminar store después                          │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔧 Implementación Propuesta

### 1. Modificar `document-processor.ts`

**Cambio principal:** Usar Gemini en lugar de OpenAI

```typescript
// ANTES (OpenAI):
import { openai } from "@ai-sdk/openai";
// DESPUÉS (Gemini):
import { GoogleGenAI } from "@google/genai";
import { embedMany } from "ai";

export async function processDocumentForVectorization(
  fileUrl: string,
  fileType: string,
): Promise<{ chunks: Array<{ content: string; embedding: number[] }> }> {
  const gemini = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  // Opción 1: Usar File Search Store temporal
  const storeName = await gemini.fileSearchStores.create({
    config: { displayName: `temp-${Date.now()}` },
  });

  // Descargar archivo temporalmente
  const response = await fetch(fileUrl);
  const blob = await response.blob();
  const file = new File([blob], "document.pdf", { type: fileType });

  // Subir a Gemini
  let op = await gemini.fileSearchStores.uploadToFileSearchStore({
    fileSearchStoreName: storeName.name,
    file,
  });

  // Polling hasta completar
  while (!op.done) {
    await delay(3000);
    op = await gemini.operations.get({ operation: op });
  }

  // Extraer chunks y embeddings
  // NOTA: Gemini no expone directamente los chunks/embeddings
  // Necesitamos usar la API de búsqueda para obtenerlos

  // Limpiar store temporal
  await gemini.fileSearchStores.delete({
    name: storeName.name,
    config: { force: true },
  });

  return { chunks };
}
```

**⚠️ PROBLEMA IDENTIFICADO:**
Gemini File Search Store **NO expone directamente** los chunks y embeddings generados. Solo permite:

- Subir archivos
- Buscar en ellos
- Obtener respuestas con grounding chunks

**Solución Alternativa:**
Usar Gemini para extracción de texto y generación de embeddings, pero mantener control del chunking.

---

### 2. Solución Alternativa: Procesamiento Híbrido

```typescript
export async function processDocumentForVectorization(
  fileUrl: string,
  fileType: string,
): Promise<{ chunks: Array<{ content: string; embedding: number[] }> }> {
  const gemini = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  // 1. Extraer texto (usar Gemini o mantener pdf-parse)
  let text: string;
  if (fileType === "application/pdf") {
    // Opción A: Usar pdf-parse (actual)
    const response = await fetch(fileUrl);
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const pdfParse = require("pdf-parse");
    const data = await pdfParse(buffer);
    text = data.text;

    // Opción B: Usar Gemini para extracción (si soporta)
    // NOTA: Gemini File Search no expone texto extraído directamente
  }

  // 2. Chunking (mantener LangChain)
  const { RecursiveCharacterTextSplitter } = await import(
    "@langchain/textsplitters"
  );
  const textSplitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 200,
  });
  const chunkedContent = await textSplitter.createDocuments([text]);

  // 3. Generar embeddings con Gemini
  // NOTA: Gemini no tiene API directa de embeddings
  // Necesitamos usar el modelo de embeddings de Gemini

  // Alternativa: Usar Gemini para generar embeddings
  // Gemini tiene text-embedding-004 pero no está en @google/genai SDK
  // Necesitaríamos usar REST API directamente

  return { chunks };
}
```

---

### 3. Análisis de APIs de Gemini

#### APIs Disponibles en `@google/genai`:

1. **File Search Stores**
   - `create()` - Crear store
   - `uploadToFileSearchStore()` - Subir archivo
   - `delete()` - Eliminar store
   - `list()` - Listar stores

2. **Models API**
   - `generateContent()` - Generar texto
   - `generateContentStream()` - Streaming
   - Con `fileSearch` tool para búsqueda

3. **Embeddings API**
   - ❌ **NO disponible directamente en el SDK**
   - Gemini tiene `text-embedding-004` pero requiere REST API

#### APIs REST de Gemini (no en SDK):

1. **Text Embeddings**

   ```
   POST https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent
   ```

2. **Batch Embeddings**
   ```
   POST https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:batchEmbedContents
   ```

---

## 🎯 Estrategias de Implementación

### Estrategia 1: Usar Gemini Solo para Búsqueda (Recomendada)

**Flujo:**

1. Mantener procesamiento actual (pdf-parse + LangChain + OpenAI embeddings)
2. Usar Gemini para búsqueda y generación de respuestas
3. Guardar chunks y embeddings en nuestra BD

**Ventajas:**

- ✅ Control total sobre chunks y embeddings
- ✅ Compatibilidad con esquema actual
- ✅ Usa Gemini para lo que mejor hace (búsqueda + generación)

**Implementación:**

```typescript
// Búsqueda usando nuestra BD + Gemini para respuesta
export async function searchDocuments(
  query: string,
  organizationId: string,
  options?: SearchOptions,
) {
  // 1. Generar embedding de query (OpenAI o Gemini REST API)
  const queryEmbedding = await generateQueryEmbedding(query);

  // 2. Buscar en nuestra BD (pgvector)
  const chunks = await searchSimilarDocuments(
    queryEmbedding,
    organizationId,
    options,
  );

  // 3. Generar respuesta con Gemini usando chunks como contexto
  const gemini = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const context = chunks.map((c) => c.content).join("\n\n");

  const response = await gemini.models.generateContent({
    model: "gemini-2.5-flash",
    contents: `Context:\n${context}\n\nQuestion: ${query}\n\nAnswer:`,
  });

  return {
    text: response.text,
    sources: chunks.map((c) => ({
      content: c.content,
      metadata: c.metadata,
      similarity: c.similarity,
    })),
  };
}
```

---

### Estrategia 2: Usar Gemini File Search Store Temporal

**Flujo:**

1. Subir archivo a Supabase Storage
2. Crear File Search Store temporal en Gemini
3. Subir archivo a Gemini
4. Usar File Search para búsquedas
5. Guardar también en nuestra BD (opcional, para persistencia)

**Ventajas:**

- ✅ Búsqueda automática de Gemini
- ✅ Grounding chunks incluidos
- ✅ Menos código de búsqueda

**Desventajas:**

- ❌ Requiere mantener File Search Store
- ❌ Archivos duplicados (Supabase + Gemini)
- ❌ Dependencia de servicio externo

**Implementación:**

```typescript
// Crear store por organización
export async function createOrganizationStore(organizationId: string) {
  const gemini = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const store = await gemini.fileSearchStores.create({
    config: { displayName: `org-${organizationId}` },
  });

  // Guardar store name en BD
  await db.organization.update({
    where: { id: organizationId },
    data: { geminiStoreName: store.name },
  });

  return store.name;
}

// Búsqueda usando File Search
export async function searchWithGemini(query: string, organizationId: string) {
  const org = await db.organization.findUnique({
    where: { id: organizationId },
  });

  if (!org?.geminiStoreName) {
    throw new Error("Gemini store not found for organization");
  }

  const gemini = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const response = await gemini.models.generateContent({
    model: "gemini-2.5-flash",
    contents: query,
    config: {
      tools: [
        {
          fileSearch: {
            fileSearchStoreNames: [org.geminiStoreName],
          },
        },
      ],
    },
  });

  return {
    text: response.text,
    groundingChunks:
      response.candidates?.[0]?.groundingMetadata?.groundingChunks || [],
  };
}
```

---

### Estrategia 3: Híbrida (Recomendada para Producción)

**Flujo:**

1. Procesar documentos con Gemini (extracción + embeddings)
2. Guardar chunks y embeddings en nuestra BD
3. Usar nuestra BD para búsqueda
4. Usar Gemini para generación de respuestas

**Ventajas:**

- ✅ Control total de datos
- ✅ Búsqueda rápida (nuestra BD)
- ✅ Usa Gemini para generación (mejor calidad)
- ✅ Compatible con esquema actual

**Implementación:**

```typescript
// Procesamiento híbrido
export async function processDocumentWithGemini(
  fileUrl: string,
  fileType: string,
) {
  // 1. Extraer texto (pdf-parse o Gemini si disponible)
  const text = await extractText(fileUrl, fileType);

  // 2. Chunking (LangChain)
  const chunks = await createChunks(text);

  // 3. Embeddings con Gemini REST API
  const embeddings = await generateEmbeddingsWithGemini(
    chunks.map((c) => c.pageContent),
  );

  // 4. Guardar en nuestra BD
  await insertDocumentChunks(
    chunks.map((chunk, i) => ({
      content: chunk.pageContent,
      embedding: embeddings[i],
      metadata: {
        /* ... */
      },
    })),
  );

  return { chunksCount: chunks.length };
}

// Búsqueda híbrida
export async function searchHybrid(query: string, organizationId: string) {
  // 1. Embedding de query (Gemini REST API)
  const queryEmbedding = await generateQueryEmbedding(query);

  // 2. Búsqueda en nuestra BD
  const chunks = await searchSimilarDocuments(queryEmbedding, organizationId, {
    limit: 5,
  });

  // 3. Generar respuesta con Gemini
  const gemini = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const context = chunks.map((c) => c.content).join("\n\n---\n\n");

  const response = await gemini.models.generateContent({
    model: "gemini-2.5-flash",
    contents: `Based on the following context, answer the question. If the answer is not in the context, say so.\n\nContext:\n${context}\n\nQuestion: ${query}`,
  });

  return {
    text: response.text,
    sources: chunks,
  };
}
```

---

## 📊 Comparación de Estrategias

| Aspecto              | Estrategia 1 | Estrategia 2 | Estrategia 3 |
| -------------------- | ------------ | ------------ | ------------ |
| **Control de datos** | ✅ Total     | ❌ Parcial   | ✅ Total     |
| **Búsqueda**         | Nuestra BD   | Gemini Store | Nuestra BD   |
| **Generación**       | Gemini       | Gemini       | Gemini       |
| **Persistencia**     | ✅ Sí        | ⚠️ Depende   | ✅ Sí        |
| **Costo**            | Bajo         | Medio        | Bajo         |
| **Complejidad**      | Media        | Baja         | Alta         |
| **Rendimiento**      | Alto         | Medio        | Alto         |
| **Compatibilidad**   | ✅ Total     | ⚠️ Parcial   | ✅ Total     |

---

## 🔑 Puntos Clave para la Adaptación

### 1. Gemini NO Expone Chunks/Embeddings Directamente

**Problema:**

- File Search Store procesa archivos internamente
- No hay API para obtener chunks/embeddings generados
- Solo se puede buscar y obtener respuestas

**Solución:**

- Usar Gemini REST API para embeddings (`text-embedding-004`)
- Mantener control del chunking
- Guardar en nuestra BD

### 2. Esquema de Base de Datos

**Esquema Actual:**

```sql
CREATE TABLE public.documents (
  id bigserial PRIMARY KEY,
  content text,
  metadata jsonb,
  embedding vector(1536)  -- OpenAI text-embedding-3-small
);
```

**Consideraciones:**

- Gemini `text-embedding-004` tiene **768 dimensiones** (no 1536)
- Necesitamos decidir:
  - Opción A: Cambiar a 768 dimensiones
  - Opción B: Mantener 1536 (OpenAI) y usar Gemini solo para generación
  - Opción C: Soporte dual (ambas dimensiones)

### 3. Integración con Chat Actual

**Chat Actual:**

```typescript
// src/app/[locale]/api/chat/route.ts
// Envía a n8n con documentPaths
```

**Adaptación:**

- Opción A: Reemplazar n8n con Gemini directamente
- Opción B: Mantener n8n pero usar Gemini dentro de n8n
- Opción C: Híbrida - Gemini para RAG, n8n para otras funciones

---

## 🚀 Plan de Implementación Recomendado

### Fase 1: Integración Básica

1. ✅ Agregar `@google/genai` al proyecto
2. ✅ Crear servicio `geminiService.ts`
3. ✅ Modificar `document-processor.ts` para usar Gemini embeddings (REST API)
4. ✅ Mantener chunking actual (LangChain)
5. ✅ Guardar en BD actual (esquema compatible)

### Fase 2: Búsqueda Vectorial

1. ✅ Implementar `searchSimilarDocuments()` en `vector-store.ts`
2. ✅ Crear API endpoint `/api/documents/search`
3. ✅ Usar Gemini para generar embedding de query
4. ✅ Buscar en nuestra BD (pgvector)
5. ✅ Usar Gemini para generar respuesta

### Fase 3: Integración con Chat

1. ✅ Modificar `chat/route.ts` para usar búsqueda vectorial
2. ✅ Incluir chunks relevantes en contexto
3. ✅ Usar Gemini para generación de respuestas
4. ✅ Mantener compatibilidad con n8n (opcional)

### Fase 4: Optimizaciones

1. ⚠️ Caché de embeddings de queries frecuentes
2. ⚠️ Batch processing de documentos
3. ⚠️ Streaming de respuestas
4. ⚠️ Métricas y monitoreo

---

## ⚠️ Consideraciones Importantes

### 1. Dimensiones de Embeddings

**OpenAI `text-embedding-3-small`:** 1536 dimensiones
**Gemini `text-embedding-004`:** 768 dimensiones

**Decisión necesaria:**

- Si cambiamos a Gemini embeddings → cambiar esquema a `vector(768)`
- Si mantenemos OpenAI → usar Gemini solo para generación
- Si soportamos ambos → esquema flexible

### 2. Costos

**Gemini:**

- File Search: Gratis (hasta cierto límite)
- Embeddings: $0.0001 por 1K tokens
- Generación: $0.075 por 1M tokens (gemini-2.5-flash)

**Comparación con OpenAI:**

- Embeddings: Similar
- Generación: Más barato (Gemini)

### 3. Límites de Gemini File Search

- Máximo 20 archivos por store
- Máximo 10MB por archivo
- Stores temporales (se eliminan después de inactividad)

**Impacto:**

- No podemos usar File Search Store para almacenamiento permanente
- Necesitamos nuestra BD para persistencia

---

## 📝 Conclusión

### Recomendación Final: **Estrategia 3 (Híbrida)**

**Razones:**

1. ✅ Control total de datos (chunks y embeddings en nuestra BD)
2. ✅ Compatibilidad con esquema actual
3. ✅ Búsqueda rápida (nuestra BD con pgvector)
4. ✅ Usa Gemini para generación (mejor calidad y precio)
5. ✅ Persistencia garantizada
6. ✅ Flexibilidad para cambiar proveedores

**Implementación:**

- Mantener procesamiento actual (pdf-parse + LangChain)
- Usar Gemini REST API para embeddings (`text-embedding-004`)
- Guardar en BD actual (considerar cambio a 768 dimensiones)
- Usar Gemini para búsqueda y generación de respuestas
- Mantener archivos en Supabase Storage

**Próximos Pasos:**

1. Decidir dimensiones de embeddings (768 vs 1536)
2. Implementar servicio de Gemini
3. Modificar procesamiento de documentos
4. Implementar búsqueda vectorial
5. Integrar con chat

---

**Última actualización**: Enero 2025
**Versión del análisis**: 1.0
