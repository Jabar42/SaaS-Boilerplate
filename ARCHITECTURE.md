# Arquitectura del Proyecto SaaS

## Resumen Ejecutivo

Este documento define la arquitectura, convenciones y patrones del proyecto para facilitar la integración de nuevas características de forma ordenada y escalable. Está diseñado para ser entendido por desarrolladores y agentes IA que trabajen en el proyecto.

## Estructura del Proyecto

```
src/
├── app/                    # Next.js App Router (rutas y páginas)
│   └── [locale]/          # Internacionalización
│       ├── (auth)/        # Rutas autenticadas
│       └── (unauth)/      # Rutas públicas
├── features/              # Componentes y lógica específica de features
│   ├── auth/
│   ├── billing/
│   ├── dashboard/
│   └── landing/
├── components/            # Componentes reutilizables
│   ├── ui/               # Componentes UI (shadcn/ui)
│   └── [otros]           # Componentes compartidos entre features
├── libs/                  # Configuración de librerías externas
├── utils/                 # Utilidades generales
├── types/                 # Tipos TypeScript compartidos
├── hooks/                 # Hooks personalizados compartidos
├── templates/             # Templates de landing page
└── locales/               # Traducciones (i18n)
```

## Principios de Organización

### 1. Separación por Responsabilidad

- **`features/`**: Código específico de una funcionalidad de negocio
- **`components/`**: Componentes reutilizables entre features
- **`components/ui/`**: Componentes UI base (shadcn/ui) - NO modificar
- **`libs/`**: Configuración de librerías (DB, Logger, i18n)
- **`utils/`**: Funciones utilitarias compartidas
- **`types/`**: Tipos compartidos entre múltiples features
- **`hooks/`**: Hooks compartidos (si es específico de una feature → `features/[nombre]/hooks/`)

### 2. Convención de Imports

```typescript
// ✅ Componentes de features
// ✅ Componentes compartidos
import { ActiveLink } from "@/components/ActiveLink";
// ✅ Componentes UI compartidos (shadcn)
import { Button } from "@/components/ui/button";
import { Component } from "@/features/[nombre-feature]/ComponentName";
// ✅ Hooks compartidos
import { useMenu } from "@/hooks/UseMenu";
// ✅ Configuración de librerías
import { db } from "@/libs/DB";
// ✅ Tipos compartidos
import type { User } from "@/types/Auth";
// ✅ Utilidades
import { cn } from "@/utils/Helpers";
```

## Patrón para Agregar Nuevas Features

### Estructura Base para Feature Simple

```
src/features/[nombre-feature]/
├── [ComponentName].tsx          # Componentes principales
├── [AnotherComponent].tsx
└── README.md                    # Documentación opcional de la feature
```

**Ejemplo: Feature simple (chat)**

```
src/features/chat/
├── ChatWindow.tsx
├── MessageBubble.tsx
└── ChatInput.tsx
```

### Estructura Completa para Feature Compleja

Cuando una feature tiene múltiples componentes, hooks, tipos, etc:

```
src/features/[nombre-feature]/
├── components/                  # Componentes React específicos
│   ├── FeatureList.tsx
│   ├── FeatureCard.tsx
│   └── FeatureForm.tsx
├── hooks/                      # Hooks específicos (opcional)
│   └── useFeature.ts
├── types/                      # Tipos específicos (opcional)
│   └── feature.types.ts
├── utils/                      # Utilidades específicas (opcional)
│   └── feature.helpers.ts
└── README.md                   # Documentación de la feature
```

**Ejemplo: Feature compleja (documentos)**

```
src/features/documents/
├── components/
│   ├── DocumentList.tsx
│   ├── DocumentCard.tsx
│   ├── DocumentUploader.tsx
│   └── DocumentViewer.tsx
├── hooks/
│   └── useDocuments.ts
├── types/
│   └── document.types.ts
└── utils/
    └── document.helpers.ts
```

### Cuándo Usar Subcarpetas

- **SÍ usar subcarpetas si:**
  - Tienes 5+ componentes relacionados
  - Necesitas múltiples hooks
  - Tienes tipos específicos complejos
  - La feature crecerá significativamente

- **NO usar subcarpetas si:**
  - Solo 1-3 componentes simples
  - No hay hooks o tipos específicos
  - Es una feature pequeña que no crecerá

## Ejemplo Completo: Agregar Feature "Gestión de Documentos"

### Paso 1: Definir Estructura

```
src/features/documents/
├── components/
│   ├── DocumentList.tsx
│   ├── DocumentCard.tsx
│   └── DocumentUploader.tsx
├── types/
│   └── document.types.ts
└── hooks/
    └── useDocuments.ts
```

### Paso 2: Crear Tipos

```typescript
// src/features/documents/types/document.types.ts

export type Document = {
  id: string;
  name: string;
  type: string;
  size: number;
  organizationId: string;
  uploadedById: string;
  createdAt: Date;
  updatedAt: Date;
};

export type CreateDocumentDto = {
  name: string;
  file: File;
  organizationId: string;
};

export type DocumentFilters = {
  type?: string;
  search?: string;
};
```

### Paso 3: Crear Hook (si es necesario)

```typescript
// src/features/documents/hooks/useDocuments.ts

import { useEffect, useState } from "react";

import { Document } from "../types/document.types";

export function useDocuments(organizationId: string) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Lógica para cargar documentos
  }, [organizationId]);

  return { documents, loading };
}
```

### Paso 4: Crear Componentes

```typescript
// src/features/documents/components/DocumentList.tsx

import { Document } from '../types/document.types';
import { useDocuments } from '../hooks/useDocuments';
import { Button } from '@/components/ui/button'; // Usar UI compartida
import { DocumentCard } from './DocumentCard';

export function DocumentList({ organizationId }: { organizationId: string }) {
  const { documents, loading } = useDocuments(organizationId);

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      {documents.map(doc => (
        <DocumentCard key={doc.id} document={doc} />
      ))}
    </div>
  );
}
```

```typescript
// src/features/documents/components/DocumentCard.tsx

import { Document } from '../types/document.types';
import { Button } from '@/components/ui/button';

export function DocumentCard({ document }: { document: Document }) {
  return (
    <div>
      <h3>{document.name}</h3>
      <p>{document.type}</p>
      <Button>Download</Button>
    </div>
  );
}
```

### Paso 5: Crear Página en App Router

```typescript
// src/app/[locale]/(auth)/dashboard/documentos/page.tsx

import { DocumentList } from '@/features/documents/components/DocumentList';
import { TitleBar } from '@/features/dashboard/TitleBar'; // Reusar componentes existentes

export default function DocumentosPage() {
  // Obtener organizationId desde Clerk
  const organizationId = '...';

  return (
    <>
      <TitleBar title="Documentos" description="Gestiona tus documentos" />
      <DocumentList organizationId={organizationId} />
    </>
  );
}
```

## Reglas de Organización

### Regla 1: Independencia de Features

Cada feature debe ser independiente:

- ✅ Puede importar desde `components/ui/`, `components/`, `libs/`, `utils/`, `types/`
- ✅ Puede importar desde otras features SOLO si es necesario
- ❌ NO debe crear dependencias circulares

### Regla 2: Reutilización de Componentes

- ✅ **SIEMPRE** usar componentes de `components/ui/` (shadcn)
- ✅ Reusar componentes de `components/` cuando sea posible
- ✅ Reusar componentes de otras features cuando tenga sentido
- ❌ NO duplicar componentes que ya existen

**Ejemplo:**

```typescript
// ✅ Correcto - reusar componentes existentes
import { Button } from "@/components/ui/button";
import { MessageState } from "@/features/dashboard/MessageState";
import { TitleBar } from "@/features/dashboard/TitleBar";

// ❌ Incorrecto - crear nuevo componente cuando existe uno similar
// NO crear DocumentTitleBar cuando existe TitleBar
```

### Regla 3: Acceso a Datos

Para acceso a base de datos:

**Opción A: Usar Prisma directamente en componentes**

```typescript
// src/features/documents/components/DocumentList.tsx
import { db } from "@/libs/DB";

const documents = await db.document.findMany({ where: { organizationId } });
```

**Opción B: Crear funciones helper en la feature (si es complejo)**

```typescript
// src/features/documents/utils/document.repository.ts
import { db } from "@/libs/DB";

import { Document } from "../types/document.types";

export async function getDocumentsByOrganization(
  orgId: string,
): Promise<Document[]> {
  return db.document.findMany({ where: { organizationId: orgId } });
}
```

### Regla 4: Tipos TypeScript

- **Tipos compartidos**: `src/types/` (usados por múltiples features)
- **Tipos específicos**: `src/features/[nombre]/types/` (solo para esa feature)
- **Tipos globales**: `src/types/global.d.ts` (declaraciones globales)

**Ejemplo:**

```typescript
// ✅ src/types/Auth.ts - compartido entre múltiples features
export type OrgRole = "org:admin" | "org:member";

// ✅ src/features/documents/types/document.types.ts - solo para documents
export type DocumentStatus = "draft" | "published" | "archived";

// ❌ NO poner tipos de documents en types/Auth.ts
```

### Regla 5: Internacionalización (i18n)

1. Agregar traducciones en `src/locales/[locale].json`
2. Usar `useTranslations('FeatureName')` en componentes

**Ejemplo:**

```json
// src/locales/es.json
{
  "Documentos": {
    "title": "Documentos",
    "description": "Gestiona tus documentos",
    "upload": "Subir documento"
  }
}
```

```typescript
// En el componente
const t = useTranslations('Documentos');
return <h1>{t('title')}</h1>;
```

### Regla 6: Navegación y Menús

Si la feature necesita aparecer en el menú:

1. Actualizar `src/features/dashboard/DashboardSidebar.tsx`
2. Agregar ruta en el array de menú

```typescript
// src/features/dashboard/DashboardSidebar.tsx
const menu = [
  { href: "/dashboard", label: t("home") },
  { href: "/dashboard/documentos", label: t("documentos") }, // Nueva feature
  // ...
];
```

## Checklist para Agregar Nueva Feature

Al agregar una nueva feature compleja, verificar:

- [ ] **Estructura**: Crear carpeta en `features/[nombre]/` con estructura apropiada
- [ ] **Tipos**: Definir tipos en `types/` (compartidos) o `features/[nombre]/types/` (específicos)
- [ ] **Componentes**: Crear componentes usando `components/ui/` para UI base
- [ ] **Reutilización**: Reusar componentes existentes cuando sea posible
- [ ] **Hooks**: Crear hooks solo si son necesarios y específicos de la feature
- [ ] **Rutas**: Agregar rutas en `app/[locale]/(auth)/dashboard/[ruta]/`
- [ ] **Traducciones**: Agregar keys en `locales/[locale].json`
- [ ] **Navegación**: Actualizar menú/sidebar si es necesario
- [ ] **Base de datos**: Actualizar `prisma/schema.prisma` si necesita nuevas tablas
- [ ] **Validación**: Usar Zod para validaciones si hay formularios
- [ ] **Imports**: Seguir convenciones de imports (`@/features/`, `@/components/`, etc.)

## Convenciones de Naming

### Archivos y Carpetas

- **Componentes**: PascalCase (`DocumentList.tsx`)
- **Hooks**: camelCase con prefijo `use` (`useDocuments.ts`)
- **Tipos**: camelCase con sufijo `.types.ts` (`document.types.ts`)
- **Utilidades**: camelCase con sufijo `.ts` o `.helpers.ts` (`document.helpers.ts`)
- **Características**: lowercase con guiones si es necesario (`feature-name/`)

### Exports

```typescript
// ✅ Export nombrado para componentes
export function DocumentList() {}

// ✅ Export nombrado para hooks
export function useDocuments() {}

// ✅ Export type para tipos
export type Document = {};

// ✅ Export const para constantes
export const DOCUMENT_TYPES = {};
```

## Manejo de Estado

### Estado Local (useState)

- Para estado simple dentro de un componente

### Estado Compartido (Context/Provider)

- Si múltiples componentes de la misma feature necesitan compartir estado
- Crear `features/[nombre]/context/` si es necesario

### Estado Global

- Usar librerías como Zustand o Redux solo si es realmente necesario
- Preferir pasar props o usar Context API

## Acceso a Base de Datos

### Con Prisma

```typescript
// Importar DB
import { db } from "@/libs/DB";

// En Server Components o Server Actions
const documents = await db.document.findMany({
  where: { organizationId },
  orderBy: { createdAt: "desc" },
});
```

### Server Actions

Para mutaciones de datos, usar Server Actions de Next.js:

```typescript
// src/app/[locale]/(auth)/dashboard/documentos/actions.ts
"use server";

import { revalidatePath } from "next/cache";

import { db } from "@/libs/DB";

export async function deleteDocument(id: string) {
  await db.document.delete({ where: { id } });
  revalidatePath("/dashboard/documentos");
}
```

## Ejemplos de Patrones Comunes

### Patrón: Lista con CRUD

```
src/features/documents/
├── components/
│   ├── DocumentList.tsx       # Lista principal
│   ├── DocumentCard.tsx          # Item individual
│   ├── DocumentForm.tsx         # Formulario crear/editar
│   └── DocumentDeleteDialog.tsx # Confirmación eliminar
├── types/
│   └── document.types.ts
└── hooks/
    └── useDocuments.ts
```

### Patrón: Formulario Complejo

```
src/features/documents/
├── components/
│   ├── DocumentForm.tsx
│   └── DocumentFormFields.tsx
├── types/
│   └── document.types.ts
└── utils/
    └── document.validation.ts  # Schemas Zod
```

### Patrón: Feature con Múltiples Vistas

```
src/features/documents/
├── components/
│   ├── DocumentListView.tsx    # Vista de lista
│   ├── DocumentGridView.tsx    # Vista de grid
│   └── DocumentDetailView.tsx  # Vista de detalle
└── hooks/
    └── useDocumentView.ts      # Hook para cambiar vista
```

## Errores Comunes a Evitar

### ❌ NO Hacer

1. **Crear componentes duplicados**

   ```typescript
   // ❌ NO crear Button cuando existe @/components/ui/button
   // ✅ Usar: import { Button } from '@/components/ui/button';
   ```

2. **Mezclar responsabilidades**

   ```typescript
   // ❌ NO poner lógica de negocio en componentes UI
   // ✅ Separar en hooks o utilidades
   ```

3. **Crear dependencias circulares**

   ```typescript
   // ❌ Feature A importa Feature B que importa Feature A
   // ✅ Crear componente compartido en components/
   ```

4. **Usar paths incorrectos**

   ```typescript
   // ❌ import { Button } from '../../../components/ui/button'
   // ✅ import { Button } from '@/components/ui/button'
   ```

5. **Olvidar internacionalización**
   ```typescript
   // ❌ Texto hardcodeado
   // ✅ Usar useTranslations()
   ```

## Referencias Rápidas

### Path Aliases (tsconfig.json)

- `@/` → `src/`
- `@/public/` → `public/`

### Librerías Clave

- **UI**: shadcn/ui (`@/components/ui/`)
- **Base de datos**: Prisma (`@/libs/DB`)
- **Autenticación**: Clerk (configurado en middleware)
- **i18n**: next-intl (`@/libs/i18n`)
- **Logging**: Pino (`@/libs/Logger`)

### Archivos Importantes

- **Configuración**: `src/utils/AppConfig.ts`
- **Base de datos**: `prisma/schema.prisma`
- **Middleware**: `src/middleware.ts`
- **Tipos globales**: `src/types/global.d.ts`

## Conclusión

Esta arquitectura está diseñada para:

- ✅ Ser simple y fácil de entender
- ✅ Escalar con el proyecto
- ✅ Facilitar la colaboración
- ✅ Mantener el código organizado

Al seguir estos patrones, cualquier desarrollador o agente IA puede agregar nuevas features de forma consistente y mantenible.

---

**Última actualización**: Enero 2025
**Versión del proyecto**: 1.7.6
**Framework**: Next.js 14 (App Router)
