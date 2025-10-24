'use client';

import { OrganizationSwitcher } from '@clerk/nextjs';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import { useEffect, useState } from 'react';

import { ActiveLink } from '@/components/ActiveLink';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Logo } from '@/templates/Logo';
import { getI18nPath } from '@/utils/Helpers';

// Icon components moved to top level
const HomeIcon = () => (
  <svg className="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
  </svg>
);

const ChatIcon = () => (
  <svg className="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
  </svg>
);

const UsersIcon = () => (
  <svg className="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
  </svg>
);

const DocumentsIcon = () => (
  <svg className="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);

const MembersIcon = () => (
  <svg className="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
  </svg>
);

const SettingsIcon = () => (
  <svg className="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

type SidebarItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
};

type SidebarContentProps = {
  menu: SidebarItem[];
  isCollapsed?: boolean;
  isMobile?: boolean;
};

const SidebarContent = ({ menu, isCollapsed = false, isMobile = false }: SidebarContentProps) => {
  const locale = useLocale();

  // Map menu items to icons
  const getIconForHref = (href: string) => {
    if (href.includes('/dashboard') && !href.includes('/organization-profile') && !href.includes('/user-profile') && !href.includes('/chat') && !href.includes('/usuarios') && !href.includes('/documentos')) {
      return <HomeIcon />;
    }
    if (href.includes('/chat')) {
      return <ChatIcon />;
    }
    if (href.includes('/usuarios')) {
      return <UsersIcon />;
    }
    if (href.includes('/documentos')) {
      return <DocumentsIcon />;
    }
    if (href.includes('/organization-members')) {
      return <MembersIcon />;
    }
    if (href.includes('/organization-profile') && !href.includes('/organization-members')) {
      return <SettingsIcon />;
    }
    return <HomeIcon />;
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'} p-4`}>
        {!isCollapsed && (
          <Link href="/dashboard" className="flex items-center">
            <Logo />
          </Link>
        )}
        {!isMobile && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              // This will be handled by the parent component
            }}
            className="size-8"
          >
            <svg className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            </svg>
          </Button>
        )}
      </div>

      <Separator />

      {/* Organization Switcher */}
      <div className={`${isCollapsed ? 'flex justify-center' : ''} p-4`}>
        <OrganizationSwitcher
          afterCreateOrganizationUrl={getI18nPath('/dashboard', locale)}
          afterSelectOrganizationUrl={getI18nPath('/dashboard', locale)}
          afterSelectPersonalUrl={getI18nPath('/dashboard', locale)}
          appearance={{
            elements: {
              organizationSwitcherTrigger: isCollapsed
                ? 'w-8 h-8 p-0 rounded-md flex items-center justify-center'
                : 'w-full justify-start px-3 py-2 rounded-md',
              organizationSwitcherTriggerIcon: isCollapsed ? 'size-4' : 'size-4',
              organizationSwitcherTriggerText: isCollapsed ? 'hidden' : 'block',
            },
          }}
        />
      </div>

      <Separator />

      {/* Navigation */}
      <ScrollArea className="flex-1 px-4">
        <nav className="space-y-2">
          {menu.map((item) => {
            const icon = getIconForHref(item.href);

            if (isCollapsed) {
              return (
                <Tooltip key={item.href}>
                  <TooltipTrigger asChild>
                    <ActiveLink href={item.href}>
                      <div className="flex h-10 w-12 items-center justify-center rounded-md text-sm font-medium transition-colors hover:bg-muted hover:text-foreground">
                        {icon}
                      </div>
                    </ActiveLink>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    {item.label}
                  </TooltipContent>
                </Tooltip>
              );
            }

            return (
              <ActiveLink key={item.href} href={item.href}>
                <div className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-muted hover:text-foreground">
                  <span className="shrink-0">{icon}</span>
                  <span className="truncate">{item.label}</span>
                </div>
              </ActiveLink>
            );
          })}
        </nav>
      </ScrollArea>
    </div>
  );
};

type DashboardSidebarProps = {
  menu: SidebarItem[];
};

export const DashboardSidebar = ({ menu }: DashboardSidebarProps) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    // Check if we're on mobile
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    // Load collapsed state from localStorage
    const saved = localStorage.getItem('sidebar-collapsed');
    if (saved !== null) {
      setIsCollapsed(JSON.parse(saved));
    }
  }, []);

  if (isMobile) {
    return (
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="outline" size="icon" className="md:hidden">
            <svg className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-64 p-0">
          <TooltipProvider>
            <SidebarContent menu={menu} isCollapsed={false} isMobile />
          </TooltipProvider>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <div className={`hidden transition-all duration-300 md:flex md:w-64 md:flex-col md:border-r md:bg-background ${isCollapsed ? 'md:w-16' : 'md:w-64'}`}>
      <TooltipProvider>
        <SidebarContent menu={menu} isCollapsed={isCollapsed} isMobile={false} />
      </TooltipProvider>
    </div>
  );
};
