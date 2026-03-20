'use client';

import Card from '@/components/ui/Card';
import ShowcasePanel from '@/components/ui/ShowcasePanel';

export default function PlatformUsersPage() {
  return (
    <div className="space-y-6">
      <header className="page-header">
        <div>
          <h1 className="page-title">Пользователи и роли</h1>
          <p className="page-subtitle">Платформенный контур ролей, доступа, тарифов и включения модулей по клиникам и сетям.</p>
        </div>
      </header>
      <ShowcasePanel
        eyebrow="Контроль ролей"
        title="Роли платформы: владелец, врач, администратор клиники и суперпользователь"
        description="Этот слой нужен для управления доступами всей платформы, а не только одной демо-клиники. Здесь живут правила по ролям, доступу к модулям и запуску контуров по организациям."
        imageSrc="/assets/img/admin-side.svg"
        imageAlt="Роли платформы"
        badges={['RBAC', 'Организации', 'Активация', 'Аудит']}
        compact
      />
      <Card title="Глобальная модель доступа" subtitle="Следующий слой после владельца, врача и администратора клиники — это централизованное управление ролями всей платформы.">
        <div className="grid gap-3 md:grid-cols-2">
          {[
            ['Роль владельца', 'Владельцы и семьи'],
            ['Роль врача', 'Врачи и специалисты'],
            ['Роль клиники', 'Администраторы клиник'],
            ['Роль сети', 'Суперпользователь / управляющая компания'],
          ].map(([title, label]) => (
            <div key={title} className="rounded-[22px] border border-lapka-200 bg-white px-4 py-4">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-lapka-500">{title}</p>
              <p className="mt-2 text-lg font-bold text-lapka-900">{label}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
