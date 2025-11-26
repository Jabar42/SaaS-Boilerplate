# Análisis Corregido: Adaptación de RAC-Gemini - Solo Procesamiento de Documentos

## 📋 Resumen Ejecutivo

**Flujo Actual de Búsqueda (NO TOCAR):**

```
Usuario pregunta
  → /api/chat
  → Webhook a n8n
  → n8n genera embeddings de query
  → Búsqueda en PostgreSQL (pgvector)
  → Recupera chunks relevantes
  → Genera respuesta
```

**Objetivo de Adaptación:**

- ✅ Usar Gemini **SOLO** para el procesamiento inicial de documentos (cuando se suben)
- ✅ Mantener archivos en Supabase Storage (como actualmente)
- ✅ Guardar chunks y embeddings en PostgreSQL (esquema actual)
- ✅ **NO modificar** el flujo de búsqueda/chat (n8n se mantiene)

---

## 🔍 Flujo Actual vs Flujo Propuesto

### Flujo Actual de Procesamiento de Documentos

```
1. Usuario sube archivo
   ↓
2. Upload a Supabase Storage
   ↓
3. /api/documents/vectorize
   ↓
4. document-processor.ts:
   - Extrae texto (pdf-parse)
   - Chunking (LangChain)
   - Embeddings (OpenAI text-embedding-3-small)
   ↓
5. vector-store.ts:
   - Inserta chunks en PostgreSQL
   - Tabla: documents (content, metadata, embedding)
   ↓
6. ✅ Listo para búsqueda
```

### Flujo Propuesto con Gemini

```
1. Usuario sube archivo
   ↓
2. Upload a Supabase Storage (MANTENER)
   ↓
3. /api/documents/vectorize (MANTENER)
   ↓
4. document-processor.ts (MODIFICAR):
   - Extrae texto (Gemini o mantener pdf-parse)
   - Chunking (LangChain - MANTENER)
   - Embeddings (Gemini text-embedding-004) ← CAMBIO
   ↓
5. vector-store.ts (MANTENER):
   - Inserta chunks en PostgreSQL
   - Tabla: documents (content, metadata, embedding)
   ↓
6. ✅ Listo para búsqueda (n8n sigue funcionando igual)
```

### Flujo de Búsqueda (NO SE TOCA)

```
Usuario pregunta
   ↓
/api/chat → Webhook a n8n
   ↓
n8n:
   - Genera embedding de query (OpenAI o Gemini)
   - Busca en PostgreSQL (pgvector)
   - Recupera chunks relevantes
   - Genera respuesta
   ↓
Retorna respuesta al usuario
```

---

## 🎯 Cambios Necesarios

### 1. Modificar `document-processor.ts`

**Cambio principal:** Reemplazar OpenAI embeddings con Gemini embeddings

**ANTES (OpenAI):**

```typescript
import { openai } from "@ai-sdk/openai";
import { embedMany } from "ai";

const { embeddings } = await embedMany({
  model: openai.embedding("text-embedding-3-small"),
  values: chunkedContent.map((chunk) => chunk.pageContent),
});
```

**DESPUÉS (Gemini):**

```typescript
// Usar Gemini REST API para embeddings
// NOTA: @google/genai SDK no tiene embeddings directos
// Necesitamos usar REST API

const embeddings = await generateEmbeddingsWithGemini(
  chunkedContent.map((chunk) => chunk.pageContent),
);
```

**Consideraciones:**

- Gemini `text-embedding-004` tiene **768 dimensiones** (no 1536)
- Necesitamos decidir:
  - Opción A: Cambiar esquema a `vector(768)`
  - Opción B: Mantener 1536 y usar OpenAI solo para embeddings
  - Opción C: Usar Gemini para extracción/chunking, OpenAI para embeddings

---

### 2. Implementar Función de Embeddings con Gemini

**Nueva función:** `src/features/documents/utils/gemini-embeddings.ts`

```typescript
import { GoogleGenAI } from "@google/genai";

/**
 * Genera embeddings usando Gemini REST API
 * Modelo: text-embedding-004 (768 dimensiones)
 */
export async function generateEmbeddingsWithGemini(
  texts: string[],
): Promise<number[][]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY no está configurada");
  }

  // Gemini REST API para batch embeddings
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:batchEmbedContents?key=${apiKey}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        requests: texts.map((text) => ({
          model: "models/text-embedding-004",
          content: {
            parts: [{ text }],
          },
        })),
      }),
    },
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Gemini API error: ${response.status} - ${error}`);
  }

  const data = await response.json();

  if (!data.embeddings || data.embeddings.length !== texts.length) {
    throw new Error(
      `Error: número de embeddings (${data.embeddings?.length || 0}) no coincide con número de textos (${texts.length})`,
    );
  }

  return data.embeddings.map((emb: any) => emb.values);
}
```

**Alternativa con SDK (si está disponible):**

```typescript
// Si @google/genai SDK soporta embeddings en el futuro
import { GoogleGenAI } from "@google/genai";

const gemini = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
// Nota: Actualmente el SDK no tiene método directo para embeddings
```

---

### 3. Modificar `document-processor.ts`

**Cambios mínimos necesarios:**

```typescript
// src/features/documents/utils/document-processor.ts

// ... código de extracción y chunking (MANTENER) ...

// 3. Generar embeddings con Gemini (CAMBIAR)
import { generateEmbeddingsWithGemini } from "./gemini-embeddings";

// Reemplazar esta sección:
const embeddings = await generateEmbeddingsWithGemini(
  chunkedContent.map((chunk: { pageContent: string }) => chunk.pageContent),
);

// El resto del código se mantiene igual
```

---

### 4. Decisión sobre Dimensiones de Embeddings

#### Opción A: Cambiar a 768 dimensiones (Gemini)

**Ventajas:**

- ✅ Usa Gemini completamente
- ✅ Embeddings más pequeños (menos almacenamiento)
- ✅ Más rápido (menos dimensiones)

**Desventajas:**

- ❌ Requiere migración de BD
- ❌ Incompatible con embeddings existentes
- ❌ n8n podría necesitar ajustes

**Migración SQL necesaria:**

```sql
-- 1. Crear nueva tabla temporal
CREATE TABLE documents_new (
  id bigserial PRIMARY KEY,
  content text,
  metadata jsonb,
  embedding vector(768)  -- Nueva dimensión
);

-- 2. Migrar datos (requiere re-vectorizar)
-- Los embeddings existentes no se pueden convertir directamente

-- 3. Reemplazar tabla
DROP TABLE documents;
ALTER TABLE documents_new RENAME TO documents;

-- 4. Recrear índices
CREATE INDEX documents_embedding_idx
ON documents USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);
```

#### Opción B: Mantener 1536 dimensiones (OpenAI)

**Ventajas:**

- ✅ Sin cambios en BD
- ✅ Compatible con datos existentes
- ✅ n8n sigue funcionando igual

**Desventajas:**

- ❌ No usa Gemini para embeddings
- ❌ Sigue dependiendo de OpenAI

**Implementación:**

```typescript
// Usar Gemini solo para extracción de texto (si es mejor)
// Mantener OpenAI para embeddings
const { embedMany } = await import("ai");
const { openai } = await import("@ai-sdk/openai");
// ... código actual ...
```

#### Opción C: Híbrida - Gemini para Extracción, OpenAI para Embeddings

**Ventajas:**

- ✅ Usa Gemini donde es mejor (extracción)
- ✅ Mantiene compatibilidad (1536 dimensiones)
- ✅ Sin cambios en BD

**Implementación:**

```typescript
// Usar Gemini File Search Store temporalmente para extracción
// Luego usar OpenAI para embeddings
// Mantener chunking con LangChain
```

---

## 🏗️ Arquitectura Propuesta (Opción Recomendada)

### Opción Recomendada: **Opción B o C**

**Razones:**

1. ✅ No requiere migración de BD
2. ✅ Compatible con n8n existente
3. ✅ No rompe funcionalidad actual
4. ✅ Puede migrar gradualmente

### Flujo Detallado

```
┌─────────────────────────────────────────────────────────────┐
│              Procesamiento de Documentos                    │
│                  (Cuando se sube archivo)                  │
└─────────────────────────────────────────────────────────────┘

1. Upload a Supabase Storage
   ✅ MANTENER (sin cambios)

2. /api/documents/vectorize
   ✅ MANTENER (sin cambios)

3. document-processor.ts
   ├─ Extracción de texto:
   │  ├─ Opción B: Mantener pdf-parse
   │  └─ Opción C: Usar Gemini File Search Store temporal
   │
   ├─ Chunking:
   │  └─ LangChain (MANTENER)
   │
   └─ Embeddings:
      ├─ Opción B: OpenAI (MANTENER)
      └─ Opción C: Gemini REST API (si cambiamos a 768)

4. vector-store.ts
   └─ Insertar en PostgreSQL
      ✅ MANTENER (sin cambios)

5. Esquema de BD
   ├─ Opción B: vector(1536) - MANTENER
   └─ Opción C: vector(768) - REQUIERE MIGRACIÓN
```

```
┌─────────────────────────────────────────────────────────────┐
│                  Búsqueda (NO SE TOCA)                      │
│              (Mantener flujo actual con n8n)                │
└─────────────────────────────────────────────────────────────┘

Usuario pregunta
   ↓
/api/chat
   ↓
Webhook a n8n
   ↓
n8n procesa:
   ├─ Genera embedding de query
   ├─ Busca en PostgreSQL (pgvector)
   ├─ Recupera chunks relevantes
   └─ Genera respuesta
   ↓
Retorna al usuario
```

---

## 🔧 Implementación Práctica

### Opción B: Mantener OpenAI (Más Segura)

**Cambios mínimos:**

- ✅ No requiere cambios en BD
- ✅ No requiere cambios en n8n
- ✅ Compatible con todo existente

**Implementación:**

```typescript
// document-processor.ts - NO CAMBIAR NADA
// Mantener código actual con OpenAI
```

**Ventaja:** Cero riesgo, cero cambios

---

### Opción C: Gemini para Extracción Mejorada

**Cambios:**

1. Usar Gemini File Search Store temporalmente para extracción
2. Mantener chunking con LangChain
3. Mantener embeddings con OpenAI (1536 dimensiones)

**Implementación:**

```typescript
// document-processor.ts - MODIFICAR SOLO EXTRACCIÓN

export async function processDocumentForVectorization(
  fileUrl: string,
  fileType: string,
): Promise<{ chunks: Array<{ content: string; embedding: number[] }> }> {
  // 1. Extracción de texto
  let text: string;

  if (fileType === "application/pdf" || fileType.includes("pdf")) {
    // OPCIÓN: Usar Gemini File Search Store para extracción
    // O mantener pdf-parse (más simple)

    // Opción A: Mantener pdf-parse (actual)
    const response = await fetch(fileUrl);
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const pdfParse = require("pdf-parse");
    const data = await pdfParse(buffer);
    text = data.text;

    // Opción B: Usar Gemini (más complejo, requiere store temporal)
    // const gemini = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    // ... crear store temporal, subir, extraer texto ...
  }

  // 2. Chunking (MANTENER)
  const { RecursiveCharacterTextSplitter } = await import(
    "@langchain/textsplitters"
  );
  const textSplitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 200,
  });
  const chunkedContent = await textSplitter.createDocuments([text]);

  // 3. Embeddings (MANTENER OpenAI)
  const { embedMany } = await import("ai");
  const { openai } = await import("@ai-sdk/openai");
  const { embeddings } = await embedMany({
    model: openai.embedding("text-embedding-3-small"),
    values: chunkedContent.map((chunk) => chunk.pageContent),
  });

  // 4. Retornar (MANTENER)
  return {
    chunks: chunkedContent.map((chunk, i) => ({
      content: chunk.pageContent,
      embedding: embeddings[i],
    })),
  };
}
```

---

## 📊 Comparación de Opciones

| Aspecto            | Opción A (768)        | Opción B (Mantener) | Opción C (Híbrida) |
| ------------------ | --------------------- | ------------------- | ------------------ |
| **Cambios en BD**  | ❌ Requiere migración | ✅ Ninguno          | ✅ Ninguno         |
| **Compatibilidad** | ❌ Rompe existente    | ✅ Total            | ✅ Total           |
| **Uso de Gemini**  | ✅ Completo           | ❌ Ninguno          | ⚠️ Parcial         |
| **Riesgo**         | 🔴 Alto               | 🟢 Bajo             | 🟡 Medio           |
| **Complejidad**    | 🔴 Alta               | 🟢 Baja             | 🟡 Media           |
| **Recomendación**  | ❌ No                 | ✅ **Sí**           | ⚠️ Opcional        |

---

## 🎯 Recomendación Final

### Opción B: Mantener Todo Como Está

**Razones:**

1. ✅ **Cero riesgo** - No rompe nada existente
2. ✅ **Cero cambios** - Funciona perfectamente como está
3. ✅ **n8n intacto** - No requiere modificaciones
4. ✅ **BD intacta** - No requiere migración

**Conclusión:**
Si el objetivo es usar Gemini pero **mantener el flujo de búsqueda intacto**, entonces:

- **NO necesitas cambiar nada** en el procesamiento actual
- El flujo actual ya funciona perfectamente
- Gemini se puede usar en n8n si lo deseas (pero eso es configuración de n8n)

---

### Si Realmente Quieres Usar Gemini

**Opción C (Híbrida) - Solo si hay beneficio real:**

1. **Usar Gemini para extracción de texto** (si es mejor que pdf-parse)
   - Requiere File Search Store temporal
   - Más complejo
   - Beneficio: Mejor extracción de texto

2. **Mantener OpenAI para embeddings**
   - Compatible con esquema actual
   - n8n sigue funcionando
   - Sin cambios en BD

**Implementación:**

- Crear función `extractTextWithGemini()` opcional
- Mantener `pdf-parse` como fallback
- Usar Gemini solo si hay beneficio medible

---

## 📝 Plan de Implementación (Si Procedes)

### Fase 1: Evaluación

1. ✅ Comparar calidad de extracción: pdf-parse vs Gemini
2. ✅ Medir costos: OpenAI vs Gemini
3. ✅ Decidir si hay beneficio real

### Fase 2: Implementación (Solo si hay beneficio)

1. ⚠️ Crear función `extractTextWithGemini()` opcional
2. ⚠️ Modificar `document-processor.ts` para usar Gemini opcionalmente
3. ⚠️ Mantener pdf-parse como fallback
4. ⚠️ Mantener OpenAI embeddings

### Fase 3: Testing

1. ⚠️ Probar con documentos reales
2. ⚠️ Comparar resultados
3. ⚠️ Decidir si mantener cambio

---

## ⚠️ Consideraciones Importantes

### 1. Gemini File Search Store es Temporal

**Problema:**

- File Search Stores se eliminan después de inactividad
- No es almacenamiento permanente
- Requiere recrear stores constantemente

**Impacto:**

- No es práctico para extracción de texto
- Mejor mantener pdf-parse

### 2. Embeddings de Gemini Requieren REST API

**Problema:**

- `@google/genai` SDK no tiene embeddings directos
- Requiere usar REST API manualmente
- Más complejo que OpenAI SDK

**Impacto:**

- OpenAI SDK es más simple
- Mantener OpenAI es más práctico

### 3. Dimensiones Diferentes

**Problema:**

- Gemini: 768 dimensiones
- OpenAI: 1536 dimensiones
- No son compatibles directamente

**Impacto:**

- Cambiar requiere migración completa
- Alto riesgo de romper funcionalidad

---

## ✅ Conclusión

### Recomendación: **NO CAMBIAR NADA**

**Razones:**

1. El flujo actual funciona perfectamente
2. n8n maneja la búsqueda correctamente
3. No hay beneficio claro de usar Gemini para procesamiento
4. Cambios introducen riesgo sin beneficio claro

### Si Insistes en Usar Gemini

**Opción más segura:**

- Usar Gemini **dentro de n8n** para generación de respuestas
- Mantener procesamiento actual (OpenAI embeddings)
- Mantener búsqueda actual (pgvector)

**Esto se hace en n8n, no en el código del proyecto.**

---

**Última actualización**: Enero 2025
**Versión del análisis**: 2.0 (Corregido)
