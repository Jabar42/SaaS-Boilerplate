# Configuración del Service Role Key de Supabase

## Problema

El proyecto usa **Clerk** para autenticación, pero Supabase Storage RLS espera usuarios autenticados con **Supabase Auth**. Para resolver esto, usamos **Server Actions** con el **Service Role Key** que bypass las políticas RLS.

## Solución Implementada

Se crearon Server Actions en `src/app/[locale]/(auth)/dashboard/documentos/actions.ts` que:

- Verifican autenticación con Clerk
- Usan Service Role Key para operaciones en Supabase Storage
- Validan permisos manualmente (rutas de archivos)

## Paso 1: Obtener el Service Role Key

1. Ve a tu proyecto en Supabase Dashboard: https://app.supabase.com/project/vokmywtmmrmeryjukozr
2. Ve a **Settings** > **API** (en el menú lateral)
3. Busca la sección **"Project API keys"**
4. Copia el **"service_role" key** (⚠️ **MANTÉN ESTO SECRETO**)

## Paso 2: Agregar al .env.local

Agrega esta variable a tu archivo `.env.local`:

```bash
SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key_aqui
```

**⚠️ IMPORTANTE:**

- **NUNCA** commitees este key a Git
- **NUNCA** lo expongas en el cliente (frontend)
- Solo se usa en Server Actions (backend)

## Paso 3: Verificar

Después de agregar la variable, reinicia el servidor de desarrollo:

```bash
npm run dev
```

Ahora deberías poder:

- ✅ Subir archivos
- ✅ Descargar archivos
- ✅ Eliminar archivos
- ✅ Listar archivos

## ¿Por qué funciona?

Las Server Actions:

1. Se ejecutan en el servidor (Node.js)
2. Tienen acceso a variables de entorno del servidor
3. Pueden usar el Service Role Key de forma segura
4. Verifican autenticación con Clerk antes de operar
5. Bypass las políticas RLS usando el Service Role Key

## Seguridad

✅ **Seguro porque:**

- El Service Role Key solo se usa en el servidor
- Se valida autenticación con Clerk antes de cada operación
- Se verifican permisos manualmente (rutas de archivos)
- Las Server Actions están protegidas por el middleware de Next.js

## Nota sobre el Warning de Clerk

El warning `Clerk has been loaded with development keys` es solo informativo. Indica que estás usando keys de desarrollo. En producción, usarás keys de producción y el warning desaparecerá.
