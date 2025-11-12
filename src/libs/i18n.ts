import { notFound } from 'next/navigation';
import { getRequestConfig } from 'next-intl/server';

import { AllLocales } from '@/utils/AppConfig';

// NextJS Boilerplate uses Crowdin as the localization software.
// As a developer, you only need to take care of the English (or another default language) version.
// Other languages are automatically generated and handled by Crowdin.

// The localisation files are synced with Crowdin using GitHub Actions.
// By default, there are 3 ways to sync the message files:
// 1. Automatically sync on push to the `main` branch
// 2. Run manually the workflow on GitHub Actions
// 3. Every 24 hours at 5am, the workflow will run automatically

// Using internationalization in Server Components
// Note: `locale` parameter is deprecated in next-intl 3.22+, but still works in 3.21.1
// When upgrading to 3.22+, use `await requestLocale()` instead
export default getRequestConfig(async ({ locale }) => {
  // Validate that the incoming `locale` parameter is valid
  if (!AllLocales.includes(locale)) {
    notFound();
  }

  return {
    locale, // Required to avoid warning in next-intl 3.21.1+
    messages: (await import(`../locales/${locale}.json`)).default,
  };
});
