import { UserButton } from '@clerk/nextjs';
import { useTranslations } from 'next-intl';
import { getTranslations } from 'next-intl/server';

import { AppSidebar } from '@/components/app-sidebar';
import { LocaleSwitcher } from '@/components/LocaleSwitcher';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { DashboardBreadcrumb } from '@/features/dashboard/DashboardBreadcrumb';

export async function generateMetadata(props: { params: { locale: string } }) {
  const t = await getTranslations({
    locale: props.params.locale,
    namespace: 'Dashboard',
  });

  return {
    title: t('meta_title'),
    description: t('meta_description'),
  };
}

export default function DashboardLayout(props: { children: React.ReactNode }) {
  const t = useTranslations('DashboardLayout');

  return (
    <SidebarProvider>
      <AppSidebar
        menu={[
          {
            href: '/dashboard/chat',
            label: t('chat'),
          },
          {
            href: '/dashboard/usuarios',
            label: t('usuarios'),
          },
          {
            href: '/dashboard/documentos',
            label: t('documentos'),
          },
          // {
          //   href: '/dashboard/organization-profile/organization-members',
          //   label: t('members'),
          // },
        ]}
      />

      <main className="flex flex-1 flex-col overflow-hidden">
        {/* Top Bar */}
        <div className="flex h-16 items-center justify-between border-b bg-background px-6">
          <div className="flex items-center gap-4">
            <SidebarTrigger />
            <DashboardBreadcrumb />
          </div>

          <div className="flex items-center gap-2">
            <LocaleSwitcher />
            <UserButton
              userProfileMode="navigation"
              userProfileUrl="/dashboard/user-profile"
              appearance={{
                elements: {
                  rootBox: 'px-2 py-1.5',
                },
              }}
            />
          </div>
        </div>

        {/* Page Content */}
        <div className="flex-1 overflow-auto bg-muted">
          <div className="mx-auto max-w-screen-xl px-6 pb-16 pt-6">
            {props.children}
          </div>
        </div>
      </main>
    </SidebarProvider>
  );
}

export const dynamic = 'force-dynamic';
