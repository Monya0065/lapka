'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import AuthDropdown from '@/components/auth/AuthDropdown';
import StoreButtons from '@/components/marketing/StoreButtons';

const steps = [
  {
    n: '1',
    title: { ru: 'Профиль и согласия', en: 'Profile and consent' },
    text: {
      ru: 'Владелец ведёт питомцев, документы и явные разрешения на доступ для клиник.',
      en: 'Owners manage pets, records, and explicit clinic access permissions.',
    },
    img: '/assets/img/step-register.svg',
  },
  {
    n: '2',
    title: { ru: 'Запись и визит', en: 'Booking and visit' },
    text: {
      ru: 'Слоты, статусы визита и протокол врача в одном контуре без «разрозненных таблиц».',
      en: 'Slots, visit statuses, and vet protocol in one flow instead of fragmented tables.',
    },
    img: '/assets/img/step-visit.svg',
  },
  {
    n: '3',
    title: { ru: 'Прозрачность для владельца', en: 'Owner transparency' },
    text: {
      ru: 'История, стационар, назначения и безопасные ссылки — только в рамках политики продукта.',
      en: 'History, inpatient, prescriptions, and secure links within strict product policy.',
    },
    img: '/assets/img/step-qr.svg',
  },
];

const pillars = [
  {
    title: { ru: 'Медкарта и документы', en: 'Medical records and documents' },
    text: {
      ru: 'Единое хранилище анализов, выписки и визуализации без лишнего шума в интерфейсе.',
      en: 'Single storage for labs, discharge papers, and visuals without interface noise.',
    },
    tone: 'landing-pillar-sky',
  },
  {
    title: { ru: 'Клиника как система', en: 'Clinic as a system' },
    text: {
      ru: 'Расписание, финансы, стационар и контроль качества завязаны на роли и аудит.',
      en: 'Scheduling, finance, inpatient, and quality control tied to roles and audit.',
    },
    tone: 'landing-pillar-primary',
  },
  {
    title: { ru: 'Безопасный AI', en: 'Safe AI' },
    text: {
      ru: 'Только триаж, объяснение документов и черновики для врача — без доз и назначений владельцу.',
      en: 'Triage, document explanation, and vet drafts only — no dosing for owners.',
    },
    tone: 'landing-pillar-caution',
  },
  {
    title: { ru: 'Карта сервисов', en: 'Service map' },
    text: {
      ru: 'Яндекс.Карты и каталог точек: клиники, аптеки и площадки рядом с владельцем.',
      en: 'Yandex Maps and places catalog: clinics, pharmacies, and nearby pet spots.',
    },
    tone: 'landing-pillar-geo',
  },
];

export default function LandingHomePro({ showAccessDenied }) {
  const { i18n } = useTranslation();
  const langCode = i18n.resolvedLanguage || i18n.language || 'ru';
  const lang = langCode.startsWith('en') ? 'en' : 'ru';
  const tr = (ru, en) => (lang === 'en' ? en : ru);

  return (
    <div className="landing-pro">
      {showAccessDenied ? (
        <div className="page-wrap py-4">
          <div className="callout-warning !rounded-2xl !px-4 !py-3">
            {tr('Нет доступа к разделу. Войдите и выберите роль в меню входа.', 'No access to this section. Sign in and choose a role in the login menu.')}
          </div>
        </div>
      ) : null}

      <section className="landing-pro-hero">
        <div className="page-wrap relative z-[1] grid gap-10 py-14 md:grid-cols-[1.15fr_0.85fr] md:items-center md:py-20">
          <div>
            <p className="hero-on-dark-eyebrow text-xs font-bold uppercase tracking-[0.22em]">{tr('Lapka · ветеринарная платформа', 'Lapka · veterinary platform')}</p>
            <h1
              className="hero-on-dark-title mt-4 text-4xl font-black leading-[1.08] tracking-tight md:text-6xl lg:text-[3.5rem]"
              data-testid="marketing-hero-title"
            >
              {tr('Медкарта питомца, клиника и карта — в одном продукте', 'Pet medical record, clinic, and map — in one product')}
            </h1>
            <p className="hero-on-dark-lead mt-5 max-w-xl text-lg leading-relaxed md:text-xl">
              {tr(
                'Роли владелец · врач · администратор, согласия на доступ, журнал событий и готовность к пилоту в продакшене.',
                'Owner · vet · admin roles, access consent, audit trail, and production-ready pilot flows.',
              )}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/login?role=owner"
                className="hero-cta-solid px-6 py-3.5 text-base shadow-hero-solid-cta"
              >
                {tr('Кабинет владельца', 'Owner workspace')}
              </Link>
              <Link href="/login?role=vet" className="hero-btn-glass">
                {tr('Кабинет врача', 'Vet workspace')}
              </Link>
              <Link href="/for-clinics" className="hero-btn-ghost">
                {tr('Для клиник', 'For clinics')}
              </Link>
            </div>
            <div className="mt-8 flex flex-wrap items-center gap-4 text-sm hero-on-dark-subtle">
              <span className="hero-chip">{tr('RBAC и согласия', 'RBAC and consent')}</span>
              <span className="hero-chip">{tr('Аудит ключевых действий', 'Key action audit')}</span>
              <span className="hero-chip">{tr('Яндекс.Карты', 'Yandex Maps')}</span>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {[
                { label: tr('Роли', 'Roles'), value: '3', tone: '' },
                { label: tr('Клиника', 'Clinic'), value: 'Demo', tone: 'text-sky-700 dark:text-sky-300' },
                { label: 'Consent', value: 'Active', tone: 'text-emerald-700 dark:text-emerald-300' },
                { label: 'Audit', value: 'Live', tone: 'text-violet-700 dark:text-violet-300' },
                { label: 'AI', value: 'Safe', tone: 'text-amber-700 dark:text-amber-300' },
                { label: 'Map', value: 'Yandex', tone: 'text-rose-700 dark:text-rose-300' },
              ].map((cell) => (
                <div key={cell.label} className="rounded-xl border border-border bg-surface/88 px-3 py-2.5 shadow-sm backdrop-blur">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-theme-muted">{cell.label}</p>
                  <p className={`mt-1 text-sm font-black ${cell.tone || 'text-theme'}`}>{cell.value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <div className="landing-pro-glass rounded-3xl p-5 md:p-7">
              <p className="text-sm font-semibold uppercase tracking-wide text-theme-muted">{tr('Быстрый вход', 'Quick sign-in')}</p>
              <p className="mt-2 text-base text-theme-muted">{tr('Демо-учётные записи из сида: владелец, врач, админ клиники.', 'Seeded demo accounts: owner, vet, clinic admin.')}</p>
              <div className="mt-5">
                <AuthDropdown mode="card" />
              </div>
              <div className="mt-6 border-t border-border pt-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-theme-muted">{tr('Мобильный сценарий', 'Mobile flow')}</p>
                <div className="mt-3">
                  <StoreButtons />
                </div>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-2">
                {[
                  { label: 'Owner', value: 'Ready' },
                  { label: 'Vet', value: 'Ready' },
                  { label: 'Clinic', value: 'Ready' },
                  { label: 'Platform', value: 'Ready' },
                ].map((cell) => (
                  <div key={cell.label} className="rounded-xl border border-border bg-surface/88 px-3 py-2">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-theme-muted">{cell.label}</p>
                    <p className="mt-1 text-sm font-black text-emerald-700 dark:text-emerald-300">{cell.value}</p>
                  </div>
                ))}
              </div>
            </div>
            <Link href="/map" className="hero-map-tile">
              <span>
                <span className="block text-sm font-bold">{tr('Карта клиник и точек', 'Clinic and locations map')}</span>
                <span className="hero-on-dark-caption text-xs">{tr('Публичный просмотр на Яндекс.Картах', 'Public view on Yandex Maps')}</span>
              </span>
              <span className="text-xl" aria-hidden>
                →
              </span>
            </Link>
          </div>
        </div>
      </section>

      <section className="border-y border-border bg-gradient-to-br from-teal-500/12 via-surface-muted to-sky-500/10 py-14 dark:bg-slate-950 md:py-20">
        <div className="page-wrap">
          <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-theme-muted">{tr('Демо из сида базы', 'Seeded demo data')}</p>
              <h2 className="mt-3 text-3xl font-black tracking-tight text-theme md:text-4xl lg:text-[2.75rem]">
                {tr('Не пустой макет: клиника, питомец и сценарий уже в данных', 'Not a blank mockup: clinic, pet, and flow already exist in data')}
              </h2>
              <p className="mt-4 max-w-2xl text-base leading-relaxed text-theme-muted md:text-lg">
                {tr('После ', 'After ')}
                <code className="rounded-md bg-surface px-1.5 py-0.5 text-sm">docker compose up</code>
                {tr(
                  ' и сида в интерфейсе появляются реальные сущности — их видно в кабинетах, а не только название на заглушке.',
                  ' and seeding, real entities appear in UI — visible in workspaces, not just placeholder titles.',
                )}
              </p>
            </div>
            <div className="rounded-3xl border border-border bg-surface/95 p-6 shadow-lg backdrop-blur-sm dark:bg-slate-900/80 md:p-8">
              <p className="text-sm font-bold text-theme">{tr('Клиника «Lapka Demo Clinic»', 'Clinic "Lapka Demo Clinic"')}</p>
              <ul className="mt-4 space-y-3 text-sm leading-relaxed text-theme-muted">
                <li className="flex gap-2">
                  <span className="font-black text-teal-600 dark:text-teal-400">✓</span>
                  <span>
                    {tr('Питомец ', 'Pet ')}
                    <strong className="text-theme">{tr('Барсик', 'Barsik')}</strong>
                    {tr(', владелец и врач с активными ролями', ', owner and veterinarian with active roles')}
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="font-black text-teal-600 dark:text-teal-400">✓</span>
                  <span>{tr('Согласие на доступ клиники, визит, документ, стационар и публичная ссылка на назначение', 'Clinic consent, visit, document, inpatient stay, and public prescription link')}</span>
                </li>
                <li className="flex gap-2">
                  <span className="font-black text-teal-600 dark:text-teal-400">✓</span>
                  <span>{tr('Расписание, flowboard и дашборды подтягивают те же UUID и имена из API', 'Schedule, flowboard, and dashboards reuse the same UUIDs and names from API')}</span>
                </li>
              </ul>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link href="/login?role=owner" className="btn-primary !px-5 !py-2.5 text-sm">
                  {tr('Войти и увидеть кабинет', 'Sign in and open workspace')}
                </Link>
                <Link href="/login?role=vet" className="btn-secondary !px-5 !py-2.5 text-sm">
                  {tr('Кабинет врача', 'Vet workspace')}
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="page-wrap py-10 md:py-12">
        <div className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-violet-500/12 via-surface-muted to-amber-500/10 p-5 shadow-card dark:bg-slate-950 md:p-10">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-theme-muted">{tr('Снимок экосистемы', 'Ecosystem snapshot')}</p>
          <h2 className="mt-2 text-2xl font-black tracking-tight text-theme md:text-3xl">{tr('Интерфейс с опорой на данные, а не на пустой лендинг', 'Data-backed UI, not an empty marketing shell')}</h2>
          <p className="mt-2 max-w-2xl text-sm text-theme-muted md:text-base">
            {tr('Демо-клиника, питомец и сценарии из сида — те же сущности, что вы увидите в кабинетах после входа.', 'Demo clinic, pet, and seeded scenarios are the same entities you see after sign-in.')}
          </p>
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {[
              { label: tr('Роли в продукте', 'Product roles'), value: '3', tone: '' },
              { label: tr('Демо-питомец', 'Demo pet'), value: tr('Барсик', 'Barsik'), tone: 'text-sky-700 dark:text-sky-300' },
              { label: tr('Клиника в сиде', 'Seed clinic'), value: '1', tone: 'text-violet-700 dark:text-violet-300' },
              { label: tr('Публичные контуры', 'Public flows'), value: tr('Запись · RX · Паспорт', 'Booking · RX · Passport'), tone: 'text-amber-700 dark:text-amber-300' },
              { label: 'RBAC', value: 'On', tone: 'text-emerald-700 dark:text-emerald-300' },
              { label: tr('Аудит', 'Audit'), value: 'Live', tone: 'text-rose-700 dark:text-rose-300' },
            ].map((cell) => (
              <div key={cell.label} className="rounded-2xl border border-border bg-surface/90 px-3 py-4 shadow-sm">
                <p className="text-[10px] font-bold uppercase tracking-wider text-theme-muted">{cell.label}</p>
                <p className={`mt-1 break-words text-xl font-black leading-snug sm:text-2xl ${cell.tone || 'text-theme'}`}>{cell.value}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="page-wrap space-y-6 py-14 md:py-16">
        <div className="max-w-3xl">
          <h2 className="text-3xl font-black tracking-tight text-theme md:text-4xl">{tr('На чём держится Lapka', 'What Lapka is built on')}</h2>
          <p className="mt-3 text-lg text-theme-muted">
            {tr('Не маркетинговые «обещания в цифрах», а архитектура: безопасность, роли и реальные сценарии пилота.', 'Not marketing promises in numbers, but architecture: security, roles, and real pilot flows.')}
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {pillars.map((p) => (
            <article
              key={p.title.en}
              className={`rounded-3xl border border-border ${p.tone} p-5 shadow-sm dark:bg-slate-900/70`}
            >
              <h3 className="text-lg font-black text-theme">{p.title[lang]}</h3>
              <p className="mt-3 text-sm leading-relaxed text-theme">{p.text[lang]}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="border-y border-border bg-surface-muted/80 py-14 dark:bg-slate-950 md:py-16">
        <div className="page-wrap">
          <h2 className="text-3xl font-black tracking-tight text-theme md:text-4xl">{tr('Как проходит путь владельца', 'How the owner journey works')}</h2>
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            {steps.map((s) => (
              <article key={s.n} className="rounded-3xl border border-border bg-surface p-5 shadow-sm dark:bg-slate-900/80">
                <div className="relative mb-4 h-40 overflow-hidden rounded-2xl border border-border bg-surface-muted dark:bg-slate-800/70">
                  <Image src={s.img} alt={s.title[lang]} fill className="object-cover" sizes="(max-width: 768px) 100vw, 33vw" />
                </div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-theme-muted">{tr('Шаг', 'Step')} {s.n}</p>
                <h3 className="mt-2 text-xl font-black text-theme">{s.title[lang]}</h3>
                <p className="mt-2 text-sm leading-relaxed text-theme-muted">{s.text[lang]}</p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {[
                    { label: tr('Этап', 'Stage'), value: s.n, tone: '' },
                    { label: tr('Статус', 'Status'), value: 'Active', tone: 'text-emerald-700 dark:text-emerald-300' },
                    { label: tr('Контур', 'Flow'), value: s.n === '1' ? 'Consent' : s.n === '2' ? 'Visit' : 'History', tone: 'text-sky-700 dark:text-sky-300' },
                    { label: 'UX', value: 'Ready', tone: 'text-violet-700 dark:text-violet-300' },
                  ].map((cell) => (
                    <div key={`${s.n}-${cell.label}`} className="rounded-lg border border-border bg-surface-muted/70 px-2.5 py-1.5 dark:bg-slate-800/70">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-theme-muted">{cell.label}</p>
                      <p className={`mt-1 text-xs font-black ${cell.tone || 'text-theme'}`}>{cell.value}</p>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="page-wrap grid gap-6 py-14 md:grid-cols-2 md:py-16">
        <div className="rounded-3xl border border-border bg-surface p-8 shadow-sm dark:bg-slate-900/80">
          <h2 className="text-2xl font-black text-theme">{tr('AI — только в безопасных рамках', 'AI — only within safe boundaries')}</h2>
          <ul className="mt-4 list-inside list-disc space-y-3 text-sm text-theme">
            <li>{tr('Триаж срочности без диагноза «как факт»', 'Urgency triage without diagnosis presented as fact')}</li>
            <li>{tr('Объяснение документов и вопросы врачу', 'Document explanation and questions for the vet')}</li>
            <li className="font-semibold text-danger">{tr('Назначения и дозировки владельцу — запрещены политикой', 'Prescriptions and dosages for owners are blocked by policy')}</li>
          </ul>
          <p className="callout-warning mt-6 !rounded-2xl !px-4 !py-3">
            {tr('Lapka не заменяет ветеринара. При сомнениях интерфейс уводит к обращению в клинику.', 'Lapka does not replace a veterinarian. When in doubt, the UI directs users to clinic contact.')}
          </p>
        </div>
        <div className="hero-ink-panel rounded-3xl border border-border bg-ink p-8 shadow-lg dark:border-border">
          <h2 className="text-2xl font-black">{tr('Запуск в продакшене', 'Production launch')}</h2>
          <p className="hero-ink-panel-muted mt-3 text-sm leading-relaxed">
            {tr('Задайте сильный ', 'Set a strong ')}
            <code className="hero-code">JWT_SECRET</code>
            {tr(', URL API для фронта, ключ Яндекс.Карт и хранилище документов. Сборка: ', ', frontend API URL, Yandex Maps key, and document storage. Build: ')}
            <code className="hero-code">docker compose up --build</code>.
          </p>
          <div className="mt-6 flex flex-col gap-2">
            <Link href="/security" className="hero-cta-solid w-full px-4 py-3 text-center text-sm">
              {tr('Политика безопасности', 'Security policy')}
            </Link>
            <Link href="/pricing" className="hero-cta-outline inline-block w-full">
              {tr('Тарифы и пилоты', 'Pricing and pilots')}
            </Link>
          </div>
        </div>
      </section>

      <section className="page-wrap pb-16">
        <div className="hero-gradient-band rounded-3xl border border-border bg-lapka-gradient px-6 py-10 text-center shadow-lg md:px-12">
          <h2 className="text-2xl font-black md:text-3xl">{tr('Готовы открыть демо?', 'Ready to open the demo?')}</h2>
          <p className="hero-on-dark-subtle mx-auto mt-3 max-w-2xl text-sm md:text-base">
            {tr('Один стек для владельца, врача и клиники — с картой на Яндексе, счетами и контролем доступа.', 'One stack for owner, vet, and clinic — with Yandex map, billing, and access control.')}
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link href="/login?role=owner" className="hero-cta-solid px-6 py-3 text-sm">
              {tr('Войти как владелец', 'Sign in as owner')}
            </Link>
            <Link href="/faq" className="hero-cta-outline hero-cta-outline-strong px-6 py-3 text-sm font-semibold">
              FAQ
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-border bg-surface py-10 dark:bg-slate-950/80">
        <div className="page-wrap flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-lg font-black text-theme">{tr('Лапка', 'Lapka')}</p>
            <p className="text-sm text-theme-muted">{tr('Ветеринарная цифровая экосистема', 'Veterinary digital ecosystem')}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/about" className="rounded-xl border border-border px-3 py-2 text-sm font-semibold text-theme">
              {tr('О проекте', 'About')}
            </Link>
            <Link href="/for-owners" className="rounded-xl border border-border px-3 py-2 text-sm font-semibold text-theme">
              {tr('Владельцам', 'For owners')}
            </Link>
            <Link href="/for-clinics" className="hero-footer-pill">
              {tr('Клиникам', 'For clinics')}
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
