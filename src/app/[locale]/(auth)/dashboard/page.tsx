import { useTranslations } from 'next-intl';

import { ChatWindow } from '@/features/chat/components/ChatWindow';
import { TitleBar } from '@/features/dashboard/TitleBar';

const DashboardIndexPage = () => {
  const t = useTranslations('Chat');

  return (
    <div className="flex h-full flex-col">
      <div className="sticky top-0 z-10 bg-muted pb-6">
        <TitleBar
          title={t('title_bar')}
          description={t('title_bar_description')}
        />
      </div>
      <div className="min-h-0 flex-1">
        <ChatWindow />
      </div>
    </div>
  );
};

export default DashboardIndexPage;
