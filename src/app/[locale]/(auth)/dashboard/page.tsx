import { auth } from '@clerk/nextjs/server';
import { FileText, MessageSquare, Users } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

import { StatCard } from '@/features/dashboard/StatCard';
import { TitleBar } from '@/features/dashboard/TitleBar';
import { db } from '@/libs/DB';

async function getStats(userId: string, orgId: string | null) {
  try {
    // Contar todos del usuario
    const todosCount = await db.todo.count({
      where: { ownerId: userId },
    });

    // Contar documentos de la organización
    let documentsCount = 0;
    if (orgId) {
      const result = await db.$queryRawUnsafe<Array<{ count: bigint }>>(
        `SELECT COUNT(DISTINCT metadata->>'filePath') as count 
         FROM public.documents 
         WHERE metadata->>'organizationId' = $1`,
        orgId,
      );
      documentsCount = result[0]?.count ? Number(result[0].count) : 0;
    }

    return {
      todosCount,
      documentsCount,
    };
  } catch (error) {
    console.error('Error getting stats:', error);
    return {
      todosCount: 0,
      documentsCount: 0,
    };
  }
}

const DashboardIndexPage = async () => {
  const t = await getTranslations('DashboardIndex');
  const { userId, orgId } = await auth();

  if (!userId) {
    return null;
  }

  const stats = await getStats(userId, orgId ?? null);

  return (
    <>
      <TitleBar
        title={t('title_bar')}
        description={t('title_bar_description')}
      />

      <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <StatCard
          title={t('stat_todos_title')}
          value={stats.todosCount}
          description={t('stat_todos_description')}
          icon={<MessageSquare className="size-4" />}
        />
        <StatCard
          title={t('stat_documents_title')}
          value={stats.documentsCount}
          description={t('stat_documents_description')}
          icon={<FileText className="size-4" />}
        />
        <StatCard
          title={t('stat_patients_title')}
          value={0}
          description={t('stat_patients_description')}
          icon={<Users className="size-4" />}
        />
      </div>
    </>
  );
};

export default DashboardIndexPage;
