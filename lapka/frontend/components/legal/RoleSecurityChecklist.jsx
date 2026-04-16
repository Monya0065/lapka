'use client';

import Link from 'next/link';
import Card from '@/components/ui/Card';

const ROLE_CONFIG = {
  vet: {
    title: 'Security checklist врача',
    points: [
      'Проверяйте наличие согласия владельца перед открытием полной карты.',
      'Не передавайте персональные данные в свободном тексте вне защищенного контура.',
      'Используйте юридический центр при смене версий документов.',
    ],
    href: '/vet/legal',
  },
  clinic_admin: {
    title: 'Security checklist клиники',
    points: [
      'Администратор работает с медицинскими разделами только в режиме read-only.',
      'Доступ команды к данным должен опираться на активные согласия и роли.',
      'Контролируйте аудит критичных действий и инцидентов.',
    ],
    href: '/clinic/legal',
  },
  network_admin: {
    title: 'Security checklist платформы',
    points: [
      'Проверяйте ролевые политики и актуальность legal-версий по сети.',
      'Не допускайте расширения прав без явной операционной необходимости.',
      'Регулярно сверяйте инциденты и сигналы в security-контуре.',
    ],
    href: '/platform/legal',
  },
};

export default function RoleSecurityChecklist({ role }) {
  const config = ROLE_CONFIG[role];
  if (!config) return null;

  return (
    <Card title={config.title}>
      <ul className="space-y-2 text-sm text-theme">
        {config.points.map((item) => (
          <li key={item}>• {item}</li>
        ))}
      </ul>
      <Link href={config.href} className="btn-secondary mt-3 !min-h-[38px] !px-3 !py-1.5 text-xs">
        Открыть юрцентр
      </Link>
    </Card>
  );
}
