'use client';

import { useUser } from '@clerk/nextjs';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect } from 'react';

import { ChatWindow } from '@/features/chat/components/ChatWindow';
import { TitleBar } from '@/features/dashboard/TitleBar';

const ChatPage = () => {
  const params = useParams();
  const { user } = useUser();
  const locale = params?.locale as string | undefined;
  const t = useTranslations('Chat');

  useEffect(() => {
    // Log initialization (only in development)
    if (process.env.NODE_ENV === 'development') {
      // eslint-disable-next-line no-console
      console.log('[ChatPage] Component mounted', {
        locale: locale || 'unknown',
        userId: user?.id || 'unknown',
        orgId: user?.organizationMemberships?.[0]?.organization?.id || 'none',
        timestamp: new Date().toISOString(),
      });
    }
  }, [locale, user]);

  return (
    <>
      <TitleBar
        title={t('title_bar')}
        description={t('title_bar_description')}
      />

      <ChatWindow />
    </>
  );
};

export default ChatPage;
