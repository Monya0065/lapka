import Image from 'next/image';
import { useTranslation } from 'react-i18next';

export default function ThreeDHeroScene() {
  const { i18n } = useTranslation();
  const langCode = i18n.resolvedLanguage || i18n.language || 'ru';
  const lang = langCode.startsWith('en') ? 'en' : 'ru';
  const tr = (ru, en) => (lang === 'en' ? en : ru);
  return (
    <div className="hero-canvas p-4 md:p-5">
      <div className="space-y-3 md:hidden">
        <div className="rounded-3xl border border-border bg-surface/90 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-theme-muted">{tr('Единая карта питомца', 'Unified pet profile')}</p>
          <div className="mt-3 flex items-start gap-3">
            <div className="relative h-14 w-14 overflow-hidden rounded-2xl border border-border bg-surface-muted/70">
              <Image src="/assets/illustrations/pets/cat-british-3d.svg" alt={tr('Барсик', 'Barsik')} fill sizes="56px" className="object-cover" />
            </div>
            <div>
              <p className="text-2xl font-black text-theme">{tr('Барсик', 'Barsik')}</p>
              <p className="text-sm text-theme-muted">{tr('Единая карта питомца, кабинет владельца и архив документов.', 'Unified pet profile, owner workspace, and document archive.')}</p>
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-3xl border border-border bg-surface/90 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-theme-muted">{tr('Рабочее место врача', 'Vet workspace')}</p>
            <p className="mt-2 text-lg font-black text-theme">{tr('Структурированный визит', 'Structured visit')}</p>
            <p className="mt-1 text-sm text-theme-muted">{tr('Протокол, красные флаги и безопасная сводка для владельца.', 'Protocol, red flags, and safe summary for owner.')}</p>
          </div>
          <div className="rounded-3xl border border-border bg-surface/90 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-theme-muted">{tr('Клиника и стационар', 'Clinic and inpatient')}</p>
            <p className="mt-2 text-lg font-black text-theme">{tr('CRM и стационар', 'CRM and inpatient')}</p>
            <p className="mt-1 text-sm text-theme-muted">{tr('KPI, камеры по токенам и полный журнал аудита.', 'KPIs, token-based cameras, and full audit log.')}</p>
          </div>
        </div>
      </div>

      <div className="hero-3d-stage hidden md:block">
        <div className="hero-glow left-[12%] top-[9%] h-32 w-32" />
        <div className="hero-glow bottom-[10%] right-[14%] h-40 w-40" />
        <div className="hero-orb left-[10%] top-[12%] h-4 w-4 bg-orb-sky-bright shadow-orb-sky-sm" />
        <div className="hero-orb right-[20%] top-[8%] h-5 w-5 bg-orb-mint-bright shadow-orb-mint-sm" />
        <div className="hero-orb bottom-[20%] right-[8%] h-3 w-3 bg-orb-warning shadow-orb-warning" />

        <div className="hero-ring left-[12%] top-[52%] h-[220px] w-[220px]" />
        <div className="hero-ring right-[4%] top-[46%] h-[280px] w-[280px]" />
        <div className="hero-3d-grid" />

        <div className="hero-panel hero-stack-card left-[6%] top-[14%] w-[44%] p-4 md:p-5" style={{ transform: 'translateZ(72px) rotateY(-10deg)' }}>
          <div className="flex items-start gap-3">
            <div className="relative h-16 w-16 overflow-hidden rounded-2xl border border-border bg-surface-muted/70">
              <Image src="/assets/illustrations/pets/cat-british-3d.svg" alt={tr('Барсик', 'Barsik')} fill sizes="64px" className="object-cover" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-theme-muted">{tr('Единая карта питомца', 'Unified pet profile')}</p>
              <h3 className="mt-1 text-2xl font-black text-theme">{tr('Барсик', 'Barsik')}</h3>
              <p className="mt-1 text-sm text-theme-muted">{tr('Единая карта питомца с визитами, анализами и документами.', 'Unified pet profile with visits, labs, and documents.')}</p>
            </div>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <div className="rounded-2xl border border-border bg-surface/90 p-3">
              <p className="text-xs uppercase tracking-wide text-theme-muted">{tr('Статус', 'Status')}</p>
              <p className="mt-1 text-sm font-bold text-success">{tr('Стабильно · кабинет владельца активен', 'Stable · owner workspace active')}</p>
            </div>
            <div className="rounded-2xl border border-border bg-surface/90 p-3">
              <p className="text-xs uppercase tracking-wide text-theme-muted">{tr('Уровень доступа', 'Access level')}</p>
              <p className="mt-1 text-sm font-bold text-theme">{tr('Полная карта · доступ к стационару', 'Full profile · inpatient access')}</p>
            </div>
          </div>
        </div>

        <div className="hero-panel hero-stack-card hero-stack-card-delayed right-[9%] top-[10%] w-[34%] p-4" style={{ transform: 'translateZ(104px) rotateY(8deg)' }}>
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-theme-muted">{tr('Рабочее место врача', 'Vet workspace')}</p>
              <p className="mt-1 text-lg font-black text-theme">{tr('Приём без хаоса', 'Visit flow without chaos')}</p>
            </div>
            <span className="badge-yellow">{tr('Красные флаги', 'Red flags')}</span>
          </div>
          <div className="mt-4 space-y-2">
            <div className="rounded-2xl border border-border bg-surface-muted/70 px-3 py-2 text-sm text-theme">{tr('Жалобы → Осмотр → Диагностика → Итог', 'Complaints → Exam → Diagnostics → Outcome')}</div>
            <div className="rounded-2xl border border-border bg-surface-muted/70 px-3 py-2 text-sm text-theme">{tr('Автосохранение и шаблоны протоколов', 'Autosave and protocol templates')}</div>
            <div className="rounded-2xl border border-border bg-surface-muted/70 px-3 py-2 text-sm text-theme">{tr('QR-назначения со сроком действия и отзывом доступа', 'QR prescriptions with expiry and access revocation')}</div>
          </div>
        </div>

        <div className="hero-panel hero-stack-card hero-stack-card-late left-[22%] bottom-[10%] w-[38%] p-4" style={{ transform: 'translateZ(54px) rotateY(5deg)' }}>
          <p className="text-xs uppercase tracking-[0.16em] text-theme-muted">{tr('Кабинет владельца', 'Owner workspace')}</p>
          <div className="mt-3 flex items-center gap-3">
            <div className="rounded-2xl bg-hero-scene-inset p-3">
              <Image src="/assets/img/ai-assistant.svg" alt="AI assistant" width={48} height={48} className="h-12 w-12 object-contain" />
            </div>
            <div>
              <p className="text-lg font-black text-theme">{tr('Напоминания, документы, дневники', 'Reminders, documents, journals')}</p>
              <p className="text-sm text-theme-muted">{tr('Питание, вес, безопасные продукты и карта мест рядом с питомцем.', 'Nutrition, weight, safe foods, and nearby places map.')}</p>
            </div>
          </div>
        </div>

        <div className="hero-panel right-[12%] bottom-[9%] w-[24%] p-4" style={{ transform: 'translateZ(26px) rotateY(-8deg)' }}>
          <p className="text-xs uppercase tracking-[0.16em] text-theme-muted">{tr('Клиника и стационар', 'Clinic and inpatient')}</p>
          <div className="mt-3 space-y-2">
            <div className="flex items-center justify-between rounded-2xl border border-border bg-surface-muted/70 px-3 py-2">
              <span className="text-sm text-theme">{tr('Стационар', 'Inpatient')}</span>
              <span className="text-sm font-bold text-theme">8/12</span>
            </div>
            <div className="flex items-center justify-between rounded-2xl border border-border bg-surface-muted/70 px-3 py-2">
              <span className="text-sm text-theme">{tr('KPI дня', 'Daily KPI')}</span>
              <span className="text-sm font-bold text-theme">82%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
