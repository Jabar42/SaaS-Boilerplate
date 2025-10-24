'use client';

import { enUS, frFR } from '@clerk/localizations';
import { ClerkProvider as ClerkProviderBase } from '@clerk/nextjs';

import { AppConfig } from '@/utils/AppConfig';

type ClerkProviderProps = {
  children: React.ReactNode;
  locale: string;
};

export function ClerkProvider({ children, locale }: ClerkProviderProps) {
  let clerkLocale = enUS;
  let signInUrl = '/sign-in';
  let signUpUrl = '/sign-up';
  let dashboardUrl = '/dashboard';
  let afterSignOutUrl = '/';

  if (locale === 'fr') {
    clerkLocale = frFR;
  }

  if (locale !== AppConfig.defaultLocale) {
    signInUrl = `/${locale}${signInUrl}`;
    signUpUrl = `/${locale}${signUpUrl}`;
    dashboardUrl = `/${locale}${dashboardUrl}`;
    afterSignOutUrl = `/${locale}${afterSignOutUrl}`;
  }

  return (
    <ClerkProviderBase
      // PRO: Dark mode support for Clerk
      localization={clerkLocale}
      signInUrl={signInUrl}
      signUpUrl={signUpUrl}
      signInFallbackRedirectUrl={dashboardUrl}
      signUpFallbackRedirectUrl={dashboardUrl}
      afterSignOutUrl={afterSignOutUrl}
      appearance={{
        elements: {
          footer: 'hidden',
          footerAction: 'hidden',
        },
      }}
    >
      {children}
    </ClerkProviderBase>
  );
}
