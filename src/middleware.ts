import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import {
  type NextFetchEvent,
  type NextRequest,
  NextResponse,
} from 'next/server';
import createMiddleware from 'next-intl/middleware';

import { logError } from './libs/Logger.edge';
import { AllLocales, AppConfig } from './utils/AppConfig';

const intlMiddleware = createMiddleware({
  locales: AllLocales,
  localePrefix: AppConfig.localePrefix,
  defaultLocale: AppConfig.defaultLocale,
});

const isProtectedRoute = createRouteMatcher([
  '/dashboard(.*)',
  '/:locale/dashboard(.*)',
  '/onboarding(.*)',
  '/:locale/onboarding(.*)',
  '/api(.*)',
  '/:locale/api(.*)',
]);

export default function middleware(
  request: NextRequest,
  event: NextFetchEvent,
) {
  try {
    if (
      request.nextUrl.pathname.includes('/sign-in')
      || request.nextUrl.pathname.includes('/sign-up')
      || isProtectedRoute(request)
    ) {
      return clerkMiddleware(async (auth, req) => {
        try {
          if (isProtectedRoute(req)) {
            const locale
              = req.nextUrl.pathname.match(/(\/.*)\/dashboard/)?.at(1) ?? '';

            const signInUrl = new URL(`${locale}/sign-in`, req.url);

            await auth.protect({
              // `unauthenticatedUrl` is needed to avoid error: "Unable to find `next-intl` locale because the middleware didn't run on this request"
              unauthenticatedUrl: signInUrl.toString(),
            });
          }

          const authObj = await auth();

          if (
            authObj.userId
            && !authObj.orgId
            && req.nextUrl.pathname.includes('/dashboard')
            && !req.nextUrl.pathname.endsWith('/organization-selection')
          ) {
            const orgSelection = new URL(
              '/onboarding/organization-selection',
              req.url,
            );

            return NextResponse.redirect(orgSelection);
          }

          return intlMiddleware(req);
        } catch (error) {
          logError('MIDDLEWARE:clerk', error, {
            request: {
              method: req.method,
              url: req.url,
              pathname: req.nextUrl.pathname,
              headers: Object.fromEntries(req.headers.entries()),
            },
          });
          throw error;
        }
      })(request, event);
    }

    return intlMiddleware(request);
  } catch (error) {
    logError('MIDDLEWARE:main', error, {
      request: {
        method: request.method,
        url: request.url,
        pathname: request.nextUrl.pathname,
        headers: Object.fromEntries(request.headers.entries()),
      },
    });
    throw error;
  }
}

export const config = {
  matcher: ['/((?!.+\\.[\\w]+$|_next).*)', '/', '/(api|trpc)(.*)'],
};
