<!-- 58104273-0934-409b-923b-9e10b456d5fe 6678f9a1-e830-4fc2-9e16-8a855d04ca5b -->

# Plan: Lógica Condicional de Autenticación en Navbar

commit: e501505fcb55951351dc8663507c2b992374894a

## Objetivo

Mejorar la UX del navbar en el home mostrando contenido apropiado según el estado de autenticación del usuario.

## Cambios a Implementar

### 1. Convertir Navbar a Client Component

**Archivo**: `src/templates/Navbar.tsx`

- Agregar directiva `'use client'` al inicio
- Importar `useUser` hook de `@clerk/nextjs`
- Importar `UserButton` de `@clerk/nextjs`

### 2. Implementar Lógica Condicional

**Archivo**: `src/templates/Navbar.tsx`

En el `rightMenu`, reemplazar los botones estáticos por:

```typescript
{isSignedIn ? (
  <>
    <li data-fade>
      <LocaleSwitcher />
    </li>
    <li className="ml-1 mr-2.5" data-fade>
      <Link href="/dashboard">{t('dashboard')}</Link>
    </li>
    <li>
      <UserButton
        userProfileMode="navigation"
        userProfileUrl="/dashboard/user-profile"
        appearance={{
          elements: {
            rootBox: 'px-2 py-1.5',
          },
        }}
      />
    </li>
  </>
) : (
  <>
    <li data-fade>
      <LocaleSwitcher />
    </li>
    <li className="ml-1 mr-2.5" data-fade>
      <Link href="/sign-in">{t('sign_in')}</Link>
    </li>
    <li>
      <Link className={buttonVariants()} href="/sign-up">
        {t('sign_up')}
      </Link>
    </li>
  </>
)}
```

### 3. Agregar Traducciones

**Archivos**:

- `src/locales/en.json`
- `src/locales/fr.json`

Agregar nueva clave `"dashboard": "Dashboard"` en la sección `Navbar`

### 4. Mantener Links del Menú Central

Los links Product, Docs, Blog, Community, Company se quedan sin cambios (todos apuntan a /sign-up actualmente)

## Resultado Esperado

**Usuario NO autenticado:**

- Ve: Sign In (link) + Sign Up (botón)

**Usuario autenticado:**

- Ve: Dashboard (link) + UserButton (avatar con menú desplegable)

## Beneficios

- Mejor UX: usuarios autenticados tienen acceso rápido al dashboard
- Interfaz más intuitiva y moderna
- Consistencia con el patrón usado en el dashboard layout

### To-dos

- [x] Convertir Navbar a Client Component y agregar imports necesarios (useUser, UserButton)
- [x] Implementar lógica condicional en rightMenu basada en estado de autenticación
- [x] Agregar traducciones para 'dashboard' en archivos de locale (en.json, fr.json)
- [x] Verificar funcionamiento con usuario autenticado y no autenticado
