'use client';

import { useTranslations } from 'next-intl';

import { TitleBar } from '@/features/dashboard/TitleBar';
import { FileManager } from '@/features/documents/components/FileManager';

const DocumentosPage = () => {
  const t = useTranslations('Documentos');

  return (
    <>
      <TitleBar
        title={t('title_bar')}
        description={t('title_bar_description')}
      />

      <FileManager />
    </>
  );
};

export default DocumentosPage;
