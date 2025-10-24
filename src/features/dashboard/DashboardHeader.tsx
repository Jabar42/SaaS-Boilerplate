'use client';

import { UserButton } from '@clerk/nextjs';

import { LocaleSwitcher } from '@/components/LocaleSwitcher';

export const DashboardTopBar = () => {
  return (
    <div className="flex h-16 items-center justify-between border-b bg-background px-6">
      <div className="flex items-center gap-4">
        {/* Breadcrumb or page title can go here */}
      </div>

      <div className="flex items-center gap-2">
        <LocaleSwitcher />
        <UserButton
          userProfileMode="navigation"
          userProfileUrl="/dashboard/user-profile"
          appearance={{
            elements: {
              rootBox: 'px-2 py-1.5',
              footer: 'hidden',
              footerAction: 'hidden',
            },
          }}
        />
      </div>
    </div>
  );
};
