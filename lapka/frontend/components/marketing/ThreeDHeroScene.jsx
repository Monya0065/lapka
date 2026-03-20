import Image from 'next/image';

export default function ThreeDHeroScene() {
  return (
    <div className="hero-canvas p-4 md:p-5">
      <div className="space-y-3 md:hidden">
        <div className="rounded-3xl border border-lapka-200 bg-white/90 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-lapka-500">Единая карта питомца</p>
          <div className="mt-3 flex items-start gap-3">
            <div className="relative h-14 w-14 overflow-hidden rounded-2xl border border-lapka-200 bg-white">
              <Image src="/assets/illustrations/pets/cat-british-3d.svg" alt="Барсик" fill sizes="56px" className="object-cover" />
            </div>
            <div>
              <p className="text-2xl font-black text-lapka-900">Барсик</p>
              <p className="text-sm text-lapka-600">Единая карта питомца, кабинет владельца и архив документов.</p>
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-3xl border border-lapka-200 bg-white/90 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-lapka-500">Рабочее место врача</p>
            <p className="mt-2 text-lg font-black text-lapka-900">Структурированный визит</p>
            <p className="mt-1 text-sm text-lapka-600">Протокол, красные флаги и безопасная сводка для владельца.</p>
          </div>
          <div className="rounded-3xl border border-lapka-200 bg-white/90 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-lapka-500">Клиника и стационар</p>
            <p className="mt-2 text-lg font-black text-lapka-900">CRM и стационар</p>
            <p className="mt-1 text-sm text-lapka-600">KPI, камеры по токенам и полный журнал аудита.</p>
          </div>
        </div>
      </div>

      <div className="hero-3d-stage hidden md:block">
        <div className="hero-glow left-[12%] top-[9%] h-32 w-32" />
        <div className="hero-glow bottom-[10%] right-[14%] h-40 w-40" />
        <div className="hero-orb left-[10%] top-[12%] h-4 w-4 bg-cyan-400/90 shadow-[0_0_0_12px_rgba(61,147,220,0.14)]" />
        <div className="hero-orb right-[20%] top-[8%] h-5 w-5 bg-emerald-400/90 shadow-[0_0_0_14px_rgba(66,186,160,0.14)]" />
        <div className="hero-orb bottom-[20%] right-[8%] h-3 w-3 bg-amber-300/90 shadow-[0_0_0_10px_rgba(245,181,69,0.16)]" />

        <div className="hero-ring left-[12%] top-[52%] h-[220px] w-[220px]" />
        <div className="hero-ring right-[4%] top-[46%] h-[280px] w-[280px]" />
        <div className="hero-3d-grid" />

        <div className="hero-panel hero-stack-card left-[6%] top-[14%] w-[44%] p-4 md:p-5" style={{ transform: 'translateZ(72px) rotateY(-10deg)' }}>
          <div className="flex items-start gap-3">
            <div className="relative h-16 w-16 overflow-hidden rounded-2xl border border-lapka-200 bg-white">
              <Image src="/assets/illustrations/pets/cat-british-3d.svg" alt="Барсик" fill sizes="64px" className="object-cover" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-lapka-500">Единая карта питомца</p>
              <h3 className="mt-1 text-2xl font-black text-lapka-900">Барсик</h3>
              <p className="mt-1 text-sm text-lapka-600">Единая карта питомца с визитами, анализами и документами.</p>
            </div>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <div className="rounded-2xl border border-lapka-200 bg-white/90 p-3">
              <p className="text-xs uppercase tracking-wide text-lapka-500">Статус</p>
              <p className="mt-1 text-sm font-bold text-emerald-700">Стабильно · кабинет владельца активен</p>
            </div>
            <div className="rounded-2xl border border-lapka-200 bg-white/90 p-3">
              <p className="text-xs uppercase tracking-wide text-lapka-500">Уровень доступа</p>
              <p className="mt-1 text-sm font-bold text-lapka-900">Полная карта · доступ к стационару</p>
            </div>
          </div>
        </div>

        <div className="hero-panel hero-stack-card hero-stack-card-delayed right-[9%] top-[10%] w-[34%] p-4" style={{ transform: 'translateZ(104px) rotateY(8deg)' }}>
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-lapka-500">Рабочее место врача</p>
              <p className="mt-1 text-lg font-black text-lapka-900">Приём без хаоса</p>
            </div>
            <span className="badge-yellow">Красные флаги</span>
          </div>
          <div className="mt-4 space-y-2">
            <div className="rounded-2xl border border-lapka-200 bg-white px-3 py-2 text-sm text-lapka-700">Жалобы → Осмотр → Диагностика → Итог</div>
            <div className="rounded-2xl border border-lapka-200 bg-white px-3 py-2 text-sm text-lapka-700">Автосохранение и шаблоны протоколов</div>
            <div className="rounded-2xl border border-lapka-200 bg-white px-3 py-2 text-sm text-lapka-700">QR-назначения со сроком действия и отзывом доступа</div>
          </div>
        </div>

        <div className="hero-panel hero-stack-card hero-stack-card-late left-[22%] bottom-[10%] w-[38%] p-4" style={{ transform: 'translateZ(54px) rotateY(5deg)' }}>
          <p className="text-xs uppercase tracking-[0.16em] text-lapka-500">Кабинет владельца</p>
          <div className="mt-3 flex items-center gap-3">
            <div className="rounded-2xl bg-gradient-to-br from-cyan-100 to-white p-3">
              <Image src="/assets/img/ai-assistant.svg" alt="AI assistant" width={48} height={48} className="h-12 w-12 object-contain" />
            </div>
            <div>
              <p className="text-lg font-black text-lapka-900">Напоминания, документы, дневники</p>
              <p className="text-sm text-lapka-600">Питание, вес, безопасные продукты и карта мест рядом с питомцем.</p>
            </div>
          </div>
        </div>

        <div className="hero-panel right-[12%] bottom-[9%] w-[24%] p-4" style={{ transform: 'translateZ(26px) rotateY(-8deg)' }}>
          <p className="text-xs uppercase tracking-[0.16em] text-lapka-500">Клиника и стационар</p>
          <div className="mt-3 space-y-2">
            <div className="flex items-center justify-between rounded-2xl border border-lapka-200 bg-white px-3 py-2">
              <span className="text-sm text-lapka-700">Стационар</span>
              <span className="text-sm font-bold text-lapka-900">8/12</span>
            </div>
            <div className="flex items-center justify-between rounded-2xl border border-lapka-200 bg-white px-3 py-2">
              <span className="text-sm text-lapka-700">KPI дня</span>
              <span className="text-sm font-bold text-lapka-900">82%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
