import Link from 'next/link';
import LegalCenterPage from '@/components/legal/LegalCenterPage';

export default function ClinicLegalCenterPage() {
  return (
    <LegalCenterPage
      title="Юридический центр клиники"
      subtitle="Перед продолжением работы подтвердите актуальные версии юридических документов."
      operationalTitle="Критичные юридические сигналы клиники"
      operationalCards={[
        {
          title: 'Compliance readiness',
          value: 'LEGAL',
          text: 'Проверка актуальности документов перед работой с медицинским и финансовым контуром.',
          href: '/clinic/audit',
          tone: 'text-amber-700 dark:text-amber-300',
        },
        {
          title: 'Приватность и доступ',
          value: 'STRICT',
          text: 'Контроль согласий, доступа к карте и юридических ограничений по ролям команды.',
          href: '/clinic/patients',
          tone: 'text-rose-700 dark:text-rose-300',
        },
        {
          title: 'Операционные маршруты',
          value: 'LIVE',
          text: 'Синхронизация legal-потока с входящими сигналами и ежедневными клиническими процессами.',
          href: '/clinic/inbox',
          tone: 'text-violet-700 dark:text-violet-300',
        },
      ]}
      headerActions={
        <>
          <Link href="/clinic/dashboard" className="btn-secondary">
            Дашборд
          </Link>
          <Link href="/clinic/inbox" className="btn-secondary">
            Входящие
          </Link>
        </>
      }
    />
  );
}
