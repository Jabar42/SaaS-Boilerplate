import Link from 'next/link';

import { StickyBanner } from '@/features/landing/StickyBanner';

export const DemoBanner = () => (
  <StickyBanner>
    🐾 Try VSB-Tech Free Plan -
    {' '}
    <Link href="/sign-up">Start Your Free Trial Today</Link>
  </StickyBanner>
);
