'use client';

import { UserButton, useUser } from '@clerk/nextjs';
import Link from 'next/link';
import { useTranslations } from 'next-intl';

import { LocaleSwitcher } from '@/components/LocaleSwitcher';
import { buttonVariants } from '@/components/ui/buttonVariants';
import { CenteredMenu } from '@/features/landing/CenteredMenu';
import { Section } from '@/features/landing/Section';

import { Logo } from './Logo';

export const Navbar = () => {
  const t = useTranslations('Navbar');
  const { isSignedIn } = useUser();

  return (
    <Section className="px-3 py-6">
      <CenteredMenu
        logo={<Logo />}
        rightMenu={(
          <>
            {/* PRO: Dark mode toggle button */}
            <li data-fade>
              <LocaleSwitcher />
            </li>
            {isSignedIn
              ? (
                  <>
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
                )
              : (
                  <>
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
          </>
        )}
      >
        <li>
          <Link href="/sign-up">{t('product')}</Link>
        </li>

        <li>
          <Link href="/sign-up">{t('docs')}</Link>
        </li>

        <li>
          <Link href="/sign-up">{t('blog')}</Link>
        </li>

        <li>
          <Link href="/sign-up">{t('community')}</Link>
        </li>

        <li>
          <Link href="/sign-up">{t('company')}</Link>
        </li>
      </CenteredMenu>
    </Section>
  );
};
