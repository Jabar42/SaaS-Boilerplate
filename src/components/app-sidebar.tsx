'use client';

import { OrganizationSwitcher } from '@clerk/nextjs';
import {
  FileText,
  Home,
  MessageSquare,
  Settings,
  UserCheck,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { useLocale } from 'next-intl';

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from '@/components/ui/sidebar';
import { Logo } from '@/templates/Logo';
import { getI18nPath } from '@/utils/Helpers';

type AppSidebarProps = {
  menu: {
    href: string;
    label: string;
  }[];
};

// Icon components
const HomeIcon = () => <Home className="size-4" />;
const ChatIcon = () => <MessageSquare className="size-4" />;
const UsersIcon = () => <Users className="size-4" />;
const DocumentsIcon = () => <FileText className="size-4" />;
const MembersIcon = () => <UserCheck className="size-4" />;
const SettingsIcon = () => <Settings className="size-4" />;

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
  if (href.includes('/organization-profile/organization-members')) {
    return <MembersIcon />;
  }
  if (href.includes('/organization-profile')) {
    return <SettingsIcon />;
  }
  return <HomeIcon />;
};

export function AppSidebar({ menu }: AppSidebarProps) {
  const locale = useLocale();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/dashboard">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                  <Logo />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">SaaS Template</span>
                  <span className="truncate text-xs">Dashboard</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Platform</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menu.map(item => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton asChild>
                    <Link href={item.href}>
                      {getIconForHref(item.href)}
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator />

        <SidebarGroup>
          <SidebarGroupLabel>Organization</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <OrganizationSwitcher
                  organizationProfileMode="navigation"
                  organizationProfileUrl={getI18nPath(
                    '/dashboard/organization-profile',
                    locale,
                  )}
                  afterCreateOrganizationUrl="/dashboard"
                  hidePersonal
                  skipInvitationScreen
                  appearance={{
                    elements: {
                      organizationSwitcherTrigger: 'w-full justify-start px-3 py-2 rounded-md',
                      organizationSwitcherTriggerIcon: 'size-4',
                      organizationSwitcherTriggerText: 'block',
                    },
                  }}
                />
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/dashboard/user-profile">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                  <div className="size-4 rounded-full bg-sidebar-primary-foreground" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">User Profile</span>
                  <span className="truncate text-xs">Manage your account</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
