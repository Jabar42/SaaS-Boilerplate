'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';

export const DashboardBreadcrumb = () => {
  const pathname = usePathname();

  // Split pathname and filter out empty segments
  const segments = pathname.split('/').filter(Boolean);

  // Remove locale if present
  const localeIndex = segments.findIndex(segment => ['en', 'fr'].includes(segment));
  const pathSegments = localeIndex !== -1 ? segments.slice(localeIndex + 1) : segments;

  // Skip if we're on the dashboard root
  if (pathSegments.length <= 1) {
    return null;
  }

  const breadcrumbItems = pathSegments.map((segment, index) => {
    const href = `/${pathSegments.slice(0, index + 1).join('/')}`;
    const isLast = index === pathSegments.length - 1;
    const label = segment
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');

    return {
      href,
      label,
      isLast,
    };
  });

  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link href="/dashboard">Dashboard</Link>
          </BreadcrumbLink>
        </BreadcrumbItem>
        {breadcrumbItems.map(item => (
          <div key={item.href} className="flex items-center">
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              {item.isLast
                ? (
                    <BreadcrumbPage>{item.label}</BreadcrumbPage>
                  )
                : (
                    <BreadcrumbLink asChild>
                      <Link href={item.href}>{item.label}</Link>
                    </BreadcrumbLink>
                  )}
            </BreadcrumbItem>
          </div>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
};
