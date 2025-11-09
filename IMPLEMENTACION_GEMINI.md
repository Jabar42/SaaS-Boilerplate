# Implementación: Integración de Gemini para Procesamiento de Documentos

## 📋 Resumen

Se ha implementado la integración con Google Gemini para el procesamiento de documentos, basándose en el patrón robusto de RAC-gemini. El sistema ahora usa:

- ✅ **Gemini File Search Store** para procesamiento automático de documentos
- ✅ **Gemini REST API** para generación de embeddings (text-embedding-004, 768 dimensiones)
- ✅ **Esquema actualizado** a `vector(768)` en PostgreSQL

---

## 🔄 Cambios Realizados

### 1. Migración de Base de Datos

**Archivo:** `supabase/migrations/20250115000000_change_embedding_dimension_to_768.sql`

- Cambia el esquema de `vector(1536)` a `vector(768)`
- Compatible con Gemini `text-embedding-004`
- **Nota:** Los documentos existentes necesitarán ser re-vectorizados

### 2. Nuevo Servicio Gemini

**Archivo:** `src/features/documents/utils/gemini-service.ts`

Funciones implementadas:

- `createTemporaryFileSearchStore()` - Crea store temporal
- `uploadToFileSearchStore()` - Sube archivo con polling (como RAC-gemini)
- `extractChunksFromFileSearchStore()` - Extrae chunks usando búsquedas estratégicas
- `generateEmbeddingsWithGemini()` - Genera embeddings con REST API
- `deleteFileSearchStore()` - Limpia store temporal

### 3. Procesador de Documentos Actualizado

**Archivo:** `src/features/documents/utils/document-processor.ts`

**Flujo nuevo:**

1. Descarga archivo desde Supabase Storage
2. Crea File Search Store temporal
3. Sube archivo a Gemini (procesamiento automático)
4. Extrae chunks usando búsquedas estratégicas
5. Genera embeddings con Gemini REST API
6. Valida dimensiones (768)
7. Limpia File Search Store temporal

### 4. Vector Store Actualizado

**Archivo:** `src/features/documents/utils/vector-store.ts`

- Validación de dimensiones (768)
- Actualización de queries SQL para `vector(768)`

### 5. Dependencias

**Archivo:** `package.json`

- Agregado `@google/genai: ^1.29.0`

### 6. Variables de Entorno

**Archivo:** `src/libs/Env.ts`

- Agregado `GEMINI_API_KEY` (requerido)

---

## 🚀 Configuración Requerida

### 1. Instalar Dependencias

```bash
npm install
```

### 2. Configurar Variable de Entorno

Agregar a `.env.local`:

```bash
GEMINI_API_KEY=tu_api_key_aqui
```

Obtener API key en: https://aistudio.google.com/apikey

### 3. Ejecutar Migración

```bash
# Si usas Supabase CLI
supabase migration up

# O ejecutar manualmente en tu base de datos
psql $DATABASE_URL -f supabase/migrations/20250115000000_change_embedding_dimension_to_768.sql
```

---

## 🔍 Flujo de Procesamiento

```
Usuario sube archivo
   ↓
Upload a Supabase Storage
   ↓
/api/documents/vectorize
   ↓
document-processor.ts:
   1. Descarga archivo
   2. Crea File Search Store temporal
   3. Sube a Gemini (procesamiento automático)
   4. Extrae chunks (búsquedas estratégicas)
   5. Genera embeddings (Gemini REST API)
   6. Limpia store temporal
   ↓
vector-store.ts:
   - Inserta chunks en PostgreSQL (vector(768))
   ↓
✅ Listo para búsqueda (n8n sigue funcionando igual)
```

---

## ⚠️ Consideraciones Importantes

### 1. Re-vectorización de Documentos Existentes

Los documentos que fueron vectorizados con OpenAI (1536 dimensiones) **no son compatibles** con el nuevo esquema (768 dimensiones).

**Solución:**

- Re-subir los documentos para re-vectorizarlos con Gemini
- O mantener una migración gradual

### 2. Límites de Gemini File Search Store

- Máximo 20 archivos por store
- Máximo 10MB por archivo
- Stores temporales (se eliminan automáticamente)

**Impacto:** No es problema porque usamos stores temporales que se limpian después del procesamiento.

### 3. Extracción de Chunks

La extracción de chunks usa búsquedas estratégicas con múltiples queries para cubrir diferentes partes del documento. Esto puede:

- Tomar más tiempo que el chunking directo
- No capturar todos los chunks (depende de las búsquedas)

**Alternativa futura:** Si Gemini expone una API para obtener todos los chunks, se puede mejorar.

### 4. Costos

**Gemini:**

- File Search: Gratis (hasta cierto límite)
- Embeddings: $0.0001 por 1K tokens
- Generación (para extracción): Incluido en File Search

**Comparación con OpenAI:**

- Similar costo para embeddings
- File Search es gratis (ventaja)

---

## 🧪 Testing

### Probar Procesamiento

1. Subir un documento PDF
2. Verificar logs para ver el flujo:
   - Creación de File Search Store
   - Upload y procesamiento
   - Extracción de chunks
   - Generación de embeddings
   - Limpieza de store

### Verificar Base de Datos

```sql
-- Verificar dimensiones de embeddings
SELECT
  id,
  length(embedding::text) as embedding_length,
  array_length(embedding::float[], 1) as dimensions
FROM public.documents
LIMIT 5;

-- Debe mostrar 768 dimensiones
```

---

## 🔧 Troubleshooting

### Error: "GEMINI_API_KEY no está configurada"

**Solución:** Agregar `GEMINI_API_KEY` a `.env.local`

### Error: "Invalid embedding dimension: expected 768, got X"

**Causa:** El embedding no tiene 768 dimensiones

**Solución:** Verificar que `generateEmbeddingsWithGemini()` esté usando `text-embedding-004`

### Error: "No se pudieron extraer chunks"

**Causa:** Las búsquedas estratégicas no encontraron chunks

**Solución:**

- Verificar que el archivo se procesó correctamente
- Aumentar número de queries en `extractChunksFromFileSearchStore()`

### Error: "Timeout waiting for file processing"

**Causa:** El archivo es muy grande o hay problemas de red

**Solución:**

- Aumentar `maxAttempts` en `uploadToFileSearchStore()`
- Verificar tamaño del archivo (máximo 10MB)

---

## 📝 Próximos Pasos

### Mejoras Futuras

1. **Optimizar extracción de chunks**
   - Si Gemini expone API para obtener todos los chunks
   - O usar estrategia diferente

2. **Caché de embeddings**
   - Para documentos que ya fueron procesados

3. **Procesamiento en batch**
   - Para múltiples documentos simultáneamente

4. **Métricas y monitoreo**
   - Tiempo de procesamiento
   - Número de chunks extraídos
   - Costos de API

---

## ✅ Checklist de Implementación

- [x] Migración de BD (vector(1536) → vector(768))
- [x] Servicio Gemini (gemini-service.ts)
- [x] Procesador de documentos actualizado
- [x] Vector store actualizado
- [x] Dependencias agregadas
- [x] Variables de entorno configuradas
- [ ] Testing en desarrollo
- [ ] Re-vectorización de documentos existentes (si aplica)
- [ ] Documentación para usuarios

---

**Última actualización**: Enero 2025
**Versión**: 1.0
