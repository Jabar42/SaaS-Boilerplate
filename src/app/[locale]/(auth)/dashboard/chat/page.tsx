import { useTranslations } from 'next-intl';

import { ChatWindow } from '@/features/chat/components/ChatWindow';
import { TitleBar } from '@/features/dashboard/TitleBar';

const ChatPage = () => {
  const t = useTranslations('Chat');

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
