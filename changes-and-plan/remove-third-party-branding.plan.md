<!-- d32cce53-d4ae-44b8-af85-d3229a150181 679b56e2-f486-450a-85db-1c10e8309282 -->

# Plan: Remover Third-Party Branding

commit: 3975035bef0329fca2ab67df47eb1d6efb31fc09

## Objetivo

Eliminar completamente los componentes y espacios de branding de terceros, manteniendo la funcionalidad de Clerk pero ocultando su branding mediante configuración de apariencia personalizada. Se respetará la atribución al autor indie (Creative Designs Guru).

## Componentes a Modificar

### 1. Remover DemoBadge Completamente

**Archivo**: `src/app/[locale]/layout.tsx`

- Eliminar la importación: `import { DemoBadge } from '@/components/DemoBadge';`
- Eliminar el componente del JSX: `<DemoBadge />` (línea 65)

**Archivo**: `src/components/DemoBadge.tsx`

- Eliminar el archivo completo (ya no se usará)

### 2. Remover SponsorLogos del Dashboard

**Archivo**: `src/app/[locale]/(auth)/dashboard/page.tsx`

- Eliminar la importación: `import { SponsorLogos } from '@/features/sponsors/SponsorLogos';`
- Eliminar el bloque completo `<div className="mt-7"><SponsorLogos /></div>` (líneas 53-55)

### 3. Ocultar Branding de Clerk

**Archivo**: `src/components/ClerkProvider.tsx`

- Agregar la prop `appearance` al `ClerkProviderBase` con configuración para ocultar el branding:

```tsx
appearance={{
  elements: {
    footer: 'hidden',
    footerAction: 'hidden',
  },
}}
```

**Archivo**: `src/components/app-sidebar.tsx`

- El `OrganizationSwitcher` ya tiene configuración de apariencia, verificar que no muestre branding adicional

**Archivo**: `src/features/dashboard/DashboardHeader.tsx`

- El `UserButton` ya tiene configuración de apariencia, agregar ocultamiento de footer si es necesario

### 4. Remover Enlaces Promocionales del Dashboard

**Archivo**: `src/app/[locale]/(auth)/dashboard/page.tsx`

- Eliminar el bloque div con el enlace a Next.js Boilerplate SaaS (líneas 40-51)
- Mantener solo el `MessageState` con su título y descripción

### 5. Mantener Footer Attribution

**Archivo**: `src/features/landing/CenteredFooter.tsx`

- NO modificar - mantener la atribución a Creative Designs Guru como está

## Archivos que se Pueden Eliminar (Opcional)

- `src/components/DemoBadge.tsx` - Ya no se usa
- `src/features/sponsors/SponsorLogos.tsx` - Ya no se usa
- `src/features/landing/LogoCloud.tsx` - Solo si no se usa en otro lugar

## Verificaciones Post-Cambios

1. El sistema de autenticación Clerk debe seguir funcionando normalmente
2. El layout no debe tener espacios vacíos extraños
3. El dashboard debe verse limpio sin logos de sponsors
4. La navegación y funcionalidad deben permanecer intactas
5. La atribución del autor debe seguir visible en el footer

### To-dos

- [ ] Remover DemoBadge del layout principal y eliminar el archivo del componente
- [ ] Eliminar SponsorLogos del dashboard y sus referencias
- [ ] Configurar appearance de Clerk para ocultar su branding en ClerkProvider y componentes de usuario
- [ ] Eliminar enlaces promocionales del dashboard manteniendo MessageState limpio
- [ ] Verificar que autenticación funciona y layout se ve correctamente sin espacios vacíos
