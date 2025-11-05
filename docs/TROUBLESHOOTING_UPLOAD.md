# Troubleshooting: Problemas con Subida de Archivos

## Problema: Los archivos no se suben

### Posibles Causas y Soluciones

#### 1. Verificar Service Role Key

Asegúrate de que `SUPABASE_SERVICE_ROLE_KEY` esté en `.env.local`:

```bash
cat .env.local | grep SUPABASE_SERVICE_ROLE_KEY
```

Si no está, obténlo de:

- https://app.supabase.com/project/vokmywtmmrmeryjukozr/settings/api
- Busca "service_role" key

#### 2. Verificar Límite de Tamaño

Next.js tiene un límite por defecto para Server Actions. Si el archivo es muy grande (>1MB), puede fallar.

**Solución**: Ya configurado en `next.config.mjs` con `bodySizeLimit: '50mb'`

#### 3. Verificar Consola del Navegador

Abre la consola del navegador (F12) y busca:

- `[Client] Iniciando subida:` - Indica que se está intentando subir
- `[Client] Error en Server Action:` - Muestra el error específico

#### 4. Verificar Logs del Servidor

En la terminal donde corre `npm run dev`, busca:

- `[Server Action] Subiendo archivo:` - Indica que llegó al servidor
- `[Server Action] Error uploading file:` - Muestra el error de Supabase

#### 5. Verificar Autenticación

Asegúrate de estar autenticado con Clerk. El error "No autenticado" aparece si:

- No hay sesión activa
- El token de Clerk expiró

#### 6. Verificar Formato del Archivo

Algunos tipos de archivo pueden causar problemas. Prueba con:

- Un archivo de texto simple (.txt)
- Una imagen pequeña (.jpg, .png)
- Un PDF pequeño

#### 7. Verificar Permisos del Bucket

Aunque usamos Service Role Key, verifica que:

- El bucket "documents" existe
- No hay políticas RLS conflictivas

## Debugging Paso a Paso

### Paso 1: Verificar que el archivo se detecta

En la consola del navegador deberías ver:

```
[Client] Iniciando subida: { fileName: "...", size: ..., type: "..." }
```

Si no aparece, el problema está en el componente `FileUploader`.

### Paso 2: Verificar que llega al servidor

En los logs del servidor deberías ver:

```
[Server Action] Subiendo archivo: tenants/.../... (XXX KB)
```

Si no aparece, el problema está en la comunicación cliente-servidor.

### Paso 3: Verificar error de Supabase

Si aparece el log pero falla, verás:

```
[Server Action] Error uploading file: { message: "...", ... }
```

Esto indica el problema específico de Supabase.

## Errores Comunes

### Error: "Archivo no encontrado en FormData"

**Causa**: El FormData no se está pasando correctamente.

**Solución**: Verifica que el hook `useFileUpload` esté creando el FormData correctamente.

### Error: "Error al subir el archivo"

**Causa**: Puede ser múltiple. Revisa los logs del servidor para más detalles.

### Error: "new row violates row-level security policy"

**Causa**: Aunque usamos Service Role Key, puede haber un problema con las políticas.

**Solución**: Verifica que el Service Role Key esté correctamente configurado.

### Error: "Bucket not found"

**Causa**: El bucket "documents" no existe.

**Solución**: Créalo desde el Dashboard de Supabase.

## Prueba Manual

Ejecuta el script de prueba:

```bash
npm run test:supabase
```

Esto verifica:

- ✅ Conexión con Supabase
- ✅ Existencia del bucket
- ✅ Capacidad de subir/descargar archivos

## Si Nada Funciona

1. **Reinicia el servidor de desarrollo**:

   ```bash
   npm run dev
   ```

2. **Limpia el caché de Next.js**:

   ```bash
   rm -rf .next
   npm run dev
   ```

3. **Verifica que todas las variables de entorno estén cargadas**:
   - Reinicia el servidor después de agregar/modificar `.env.local`
   - Verifica que no haya errores al iniciar el servidor

4. **Revisa los logs completos**:
   - Consola del navegador (F12 > Console)
   - Terminal del servidor (donde corre `npm run dev`)
