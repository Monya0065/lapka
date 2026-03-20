'use client';

import Card from '@/components/ui/Card';
import ShowcasePanel from '@/components/ui/ShowcasePanel';

export default function PlatformSettingsPage() {
  return (
    <div className="space-y-6">
      <header className="page-header">
        <div>
          <h1 className="page-title">Системные настройки</h1>
          <p className="page-subtitle">Бренд платформы, модульные флаги, демо-данные и общие параметры сети клиник.</p>
        </div>
      </header>

      <ShowcasePanel
        eyebrow="Параметры платформы"
        title="Единый контур настроек для сети клиник, филиалов и модулей"
        description="Этот экран задаёт правила бренда, включение модулей и поведение продуктовых контуров для всех клиник в платформе. Он нужен не отдельной клинике, а центру управления."
        imageSrc="/assets/img/clinic-ops.svg"
        imageAlt="Системные настройки платформы"
        badges={['Сеть клиник', 'Филиалы', 'Модульные флаги']}
      />

      <Card title="Системный слой" subtitle="Настройки управляющей компании и центра платформы">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-[22px] border border-lapka-200 bg-white px-4 py-4">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-lapka-500">Базовый бренд</p>
            <p className="mt-2 text-lg font-bold text-lapka-900">Логотипы, палитра и базовые сценарии онбординга для сети клиник.</p>
          </div>
          <div className="rounded-[22px] border border-lapka-200 bg-white px-4 py-4">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-lapka-500">Модульные флаги</p>
            <p className="mt-2 text-lg font-bold text-lapka-900">Включение модулей по платформе, клинике и филиалу.</p>
          </div>
        </div>
      </Card>
    </div>
  );
}
