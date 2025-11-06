---
description: Validación estricta de variables de entorno - Sin placeholders ni workarounds
globs:
  - src/**/*.{ts,tsx,js,jsx}
  - src/libs/**/*
  - src/app/**/*
alwaysApply: true
---

# Regla: Validación Estricta de Variables de Entorno

## Principio Fundamental

**Las variables de entorno requeridas SIEMPRE deben ser suministradas. El sistema NO debe intentar rodear el problema con placeholders, valores por defecto, o workarounds.**

## Reglas Estrictas

### ❌ PROHIBIDO - Nunca hacer esto:

1. **Placeholders o valores por defecto falsos:**

   ```typescript
   // ❌ PROHIBIDO
   const url = process.env.API_URL || "https://placeholder.com";
   const key = Env.API_KEY || "placeholder-key";
   const client = createClient(
     url || "https://fake.supabase.co",
     key || "fake-key",
   );
   ```

2. **Fallbacks que oculten el problema:**

   ```typescript
   // ❌ PROHIBIDO
   const config = {
     url: Env.API_URL || "",
     key: Env.API_KEY || "",
   };
   // Esto crea un cliente inválido que fallará silenciosamente
   ```

3. **Validación tardía o condicional:**

   ```typescript
   // ❌ PROHIBIDO
   if (!Env.API_KEY) {
     console.warn("API_KEY no configurada, usando modo desarrollo");
     // Continuar con valores por defecto
   }
   ```

4. **Try-catch que oculte errores de configuración:**
   ```typescript
   // ❌ PROHIBIDO
   try {
     const client = createClient(Env.API_URL || "", Env.API_KEY || "");
   } catch {
     // Continuar sin la configuración requerida
   }
   ```

### ✅ REQUERIDO - Siempre hacer esto:

1. **Validación estricta ANTES de usar variables:**

   ```typescript
   // ✅ CORRECTO
   const apiUrl = Env.API_URL;
   const apiKey = Env.API_KEY;

   if (!apiUrl || !apiKey) {
     const missing = [];
     if (!apiUrl) {
       missing.push("API_URL");
     }
     if (!apiKey) {
       missing.push("API_KEY");
     }

     throw new Error(
       `Variables de entorno requeridas no configuradas: ${missing.join(", ")}. ` +
         `Configura estas variables en tu entorno de producción.`,
     );
   }

   const client = createClient(apiUrl, apiKey);
   ```

2. **Fail Fast - Fallar en inicialización:**

   ```typescript
   // ✅ CORRECTO
   const supabaseUrl = Env.NEXT_PUBLIC_SUPABASE_URL;
   const supabaseKey = Env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

   if (!supabaseUrl || !supabaseKey) {
     throw new Error(
       "[Supabase] NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY " +
         "deben estar configuradas. Configúralas en las variables de entorno.",
     );
   }

   export const supabase = createClient(supabaseUrl, supabaseKey);
   ```

3. **Errores claros y accionables:**

   ```typescript
   // ✅ CORRECTO
   function getSupabaseAdmin() {
     const serviceRoleKey = Env.SUPABASE_SERVICE_ROLE_KEY;

     if (!serviceRoleKey) {
       throw new Error(
         "[Server Action] SUPABASE_SERVICE_ROLE_KEY no está configurada. " +
           "Esta key es necesaria para operaciones de administrador. " +
           "Configúrala en las variables de entorno de producción.",
       );
     }

     return createClient(Env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey);
   }
   ```

4. **Validación en el schema de Env cuando sea posible:**
   ```typescript
   // ✅ CORRECTO - En src/libs/Env.ts
   export const Env = createEnv({
     server: {
       // Si es requerida, NO usar .optional()
       SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
     },
     client: {
       // Si es requerida, NO usar .optional()
       NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
       NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
     },
   });
   ```

## Patrones Aprobados

### Patrón 1: Validación en función helper

```typescript
function getClient() {
  const url = Env.API_URL;
  const key = Env.API_KEY;

  if (!url || !key) {
    throw new Error(`API_URL y API_KEY deben estar configuradas`);
  }

  return createClient(url, key);
}
```

### Patrón 2: Validación en inicialización de módulo

```typescript
const requiredUrl = Env.API_URL;
const requiredKey = Env.API_KEY;

if (!requiredUrl || !requiredKey) {
  throw new Error(
    `Variables requeridas no configuradas: ${!requiredUrl ? "API_URL" : ""} ${!requiredKey ? "API_KEY" : ""}`,
  );
}

export const client = createClient(requiredUrl, requiredKey);
```

### Patrón 3: Singleton con validación

```typescript
let clientInstance: Client | null = null;

function getClient(): Client {
  if (clientInstance) {
    return clientInstance;
  }

  const url = Env.API_URL;
  const key = Env.API_KEY;

  if (!url || !key) {
    throw new Error(`API_URL y API_KEY deben estar configuradas`);
  }

  clientInstance = createClient(url, key);
  return clientInstance;
}
```

## Checklist de Validación

Al trabajar con variables de entorno, verificar:

- [ ] ¿Se valida que las variables existan ANTES de usarlas?
- [ ] ¿Se lanza un error claro si faltan variables?
- [ ] ¿El error indica qué variables faltan?
- [ ] ¿El error es accionable (dice cómo solucionarlo)?
- [ ] ¿NO hay placeholders o valores por defecto?
- [ ] ¿NO hay fallbacks que oculten el problema?
- [ ] ¿El sistema falla rápido (fail fast)?

## Excepciones

**NO hay excepciones.** Si una variable es necesaria para que el sistema funcione, debe estar configurada. Si es opcional, debe manejarse explícitamente como opcional en el código y documentarse.

## Ejemplos de Código Incorrecto vs Correcto

### ❌ Incorrecto:

```typescript
export const supabase = createClient(
  Env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
  Env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-key",
);
```

### ✅ Correcto:

```typescript
const supabaseUrl = Env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = Env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    "NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY deben estar configuradas",
  );
}

export const supabase = createClient(supabaseUrl, supabaseKey);
```

---

**Recordatorio**: En producción, las variables de entorno son responsabilidad del desarrollador/operador. El código debe fallar de forma clara y temprana si no están configuradas, no intentar "arreglar" el problema con placeholders.
