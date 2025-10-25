import { PricingTable } from '@clerk/nextjs';
import { useTranslations } from 'next-intl';

import { Section } from '@/features/landing/Section';

export const ClerkPricingTable = () => {
  const t = useTranslations('ClerkPricing');

  return (
    <Section
      subtitle={t('section_subtitle')}
      title={t('section_title')}
      description={t('section_description')}
    >
      <div className="flex justify-center">
        <div style={{ maxWidth: '1000px', width: '100%' }}>
          <PricingTable for="organization" />
        </div>
      </div>
    </Section>
  );
};
