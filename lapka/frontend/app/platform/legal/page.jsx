import LegalCenterPage from '@/components/legal/LegalCenterPage';

export default function PlatformLegalCenterPage() {
  return (
    <LegalCenterPage
      title="Юридический центр платформы"
      subtitle="Контур платформы требует подтверждения актуальных версий privacy/terms/consent/DPA."
      operationalTitle="Критичные юридические потоки платформы"
      operationalCards={[
        {
          title: 'Неподтверждённые версии',
          value: 'LEGAL',
          text: 'Контроль обязательных документов до входа в защищённые контуры системы.',
          href: '/platform/security',
          tone: 'text-amber-700 dark:text-amber-300',
        },
        {
          title: 'События аудита',
          value: 'AUDIT',
          text: 'Проверка событий по доступам и подтверждениям в масштабах всей платформы.',
          href: '/platform/inbox',
          tone: 'text-rose-700 dark:text-rose-300',
        },
        {
          title: 'Политики и AI',
          value: 'SAFE',
          text: 'Синхронизация legal-контуров с AI-политиками и системными ограничениями.',
          href: '/platform/ai',
          tone: 'text-violet-700 dark:text-violet-300',
        },
      ]}
    />
  );
}
