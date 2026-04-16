'use client';

import Image from 'next/image';
import Link from 'next/link';
import Card from '@/components/ui/Card';
import StatsCard from '@/components/ui/StatsCard';
import AuthDropdown from '@/components/auth/AuthDropdown';
import Alert from '@/components/ui/Alert';
import ThreeDHeroScene from '@/components/marketing/ThreeDHeroScene';
import StoreButtons from '@/components/marketing/StoreButtons';

const howItWorks = [
  {
    id: '01',
    title: 'Профиль питомца',
    text: 'Владелец создаёт цифровую карту и загружает документы в единое хранилище.',
    image: '/assets/img/step-register.svg',
  },
  {
    id: '02',
    title: 'Запись в клинику',
    text: 'Запись по расписанию с проверкой слотов врача и прозрачным статусом визита.',
    image: '/assets/img/step-search.svg',
  },
  {
    id: '03',
    title: 'Структурированный приём',
    text: 'Врач ведёт визит по клиническому протоколу, а данные сразу доступны владельцу.',
    image: '/assets/img/step-visit.svg',
  },
  {
    id: '04',
    title: 'Назначения по QR',
    text: 'Безопасная публичная ссылка показывает только назначения со сроком действия и возможностью мгновенного отзыва.',
    image: '/assets/img/step-qr.svg',
  },
];

const clinicReasons = [
  {
    title: 'Рост выручки без хаоса',
    subtitle: 'Быстрее приём, меньше потерь в расписании',
    text: 'Единая CRM для записей, визитов и шаблонов снижает операционные потери и повышает загрузку врачей.',
  },
  {
    title: 'Контроль качества',
    subtitle: 'Протоколы, полнота, аудит',
    text: 'Администратор видит узкие места по визитам, а команда работает по единым стандартам документации.',
  },
  {
    title: 'Сильная лояльность владельцев',
    subtitle: 'Прозрачность лечения в одном приложении',
    text: 'Владелец видит историю, документы, стационар и напоминания, поэтому реже уходит в другую клинику.',
  },
  {
    title: 'Безопасность как продукт',
    subtitle: 'RBAC + согласие владельца + журнал доступа',
    text: 'Правила доступа вшиты в процесс: кто, когда и зачем открыл данные, фиксируется автоматически.',
  },
];

const dataSecurity = [
  {
    title: 'RBAC по ролям',
    text: 'Владелец, врач и администратор клиники получают только нужные права, без лишнего доступа к медданным.',
  },
  {
    title: 'Согласие владельца',
    text: 'Межклинический доступ работает только при активном согласии владельца и нужном уровне доступа.',
  },
  {
    title: 'Журнал действий',
    text: 'Ключевые действия журналируются: просмотры, изменения, выдача и отзыв доступов.',
  },
  {
    title: 'Шифрование как стандарт',
    text: 'Данные защищаются при передаче и при хранении на уровне платформы.',
  },
];

const aiLimits = [
  'AI не ставит диагноз как факт ни в одном пользовательском сценарии.',
  'AI не назначает лечение и не выдаёт дозировки владельцу.',
  'AI работает как оценка срочности, объяснение документов и структурирование заметок для врача.',
  'При риске ошибки AI уходит в безопасный ответ: «обратитесь к ветеринарному врачу».',
];

const cameraSafety = [
  {
    title: 'Короткоживущие токены',
    text: 'Доступ к камере выдаётся только по коротким токенам на 10–30 минут и может быть одноразовым.',
  },
  {
    title: 'Только владелец и активный стационар',
    text: 'Камеры доступны владельцу только при активной госпитализации и выданном разрешении на просмотр.',
  },
  {
    title: 'Лог каждой попытки',
    text: 'Успешные и неуспешные просмотры камеры фиксируются в журнале доступа к камерам.',
  },
  {
    title: 'Мгновенный отзыв',
    text: 'После выписки или отзыва согласия доступ прекращается автоматически, без ручных операций.',
  },
];

const caseStudies = [
  {
    title: 'Кейс 1 · VetCity',
    challenge: 'Разрозненные карты и пропуски в протоколах.',
    result: 'За 30 дней: +18% завершённых протоколов и на 27% меньше повторных звонков владельцев.',
  },
  {
    title: 'Кейс 2 · AnimalCare Network',
    challenge: 'Филиалы не видели полную историю питомца.',
    result: 'После связки клиник через согласие владельца: время на первичный сбор анамнеза сократилось на 35%.',
  },
  {
    title: 'Кейс 3 · Ветеринарная клиника Ветус',
    challenge: 'Непрозрачный стационар и тревога владельцев.',
    result: 'Фото-отчёты + камеры по токенам снизили эскалации в поддержку на 42%.',
  },
];

const funnel = [
  {
    title: 'Попробовать демо',
    text: 'Посмотрите owner/vet/admin сценарии на живом стенде.',
    href: '/login?role=owner',
    cta: 'Открыть демо',
    tone: 'btn-secondary',
  },
  {
    title: 'Запросить демо для клиники',
    text: 'Покажем CRM, контроль качества и стационар под ваш процесс.',
    href: '/for-clinics',
    cta: 'Запросить демо',
    tone: 'btn-primary',
  },
  {
    title: 'Создать профиль питомца',
    text: 'Запустите личный кабинет владельца и медкарту уже сегодня.',
    href: '/login?role=owner',
    cta: 'Создать профиль питомца',
    tone: 'btn-secondary',
  },
];

const faq = [
  {
    q: 'Можно ли использовать Лапку как единую карту между клиниками?',
    a: 'Да. История лечения доступна между клиниками только по согласию владельца и с ролевым контролем доступа.',
  },
  {
    q: 'AI может выписать лечение владельцу?',
    a: 'Нет. AI в Лапке ограничен безопасными сценариями и не выдаёт назначения/дозировки владельцу.',
  },
  {
    q: 'Как быстро клиника может запуститься?',
    a: 'Демо-онбординг занимает от 1 дня, рабочий запуск обычно укладывается в 1–2 недели.',
  },
];

const heroFeatures = [
  {
    title: 'Полная медкарта питомца',
    text: 'Вес, прививки, анализы, документы и история посещений в одном окне.',
  },
  {
    title: 'Напоминания и календарь',
    text: 'Автосценарии для вакцинаций, контрольных осмотров и повторных визитов.',
  },
  {
    title: 'Архив документов',
    text: 'PDF, снимки, выписки и фото-отчёты стационара с безопасным доступом.',
  },
  {
    title: 'Карта сервисов рядом',
    text: 'Клиники, аптеки, площадки и полезные точки рядом с владельцем.',
  },
];

export default function LandingPage({ searchParams }) {
  const denied = searchParams?.access === 'denied';

  return (
    <main className="page-wrap space-y-10 py-6 pb-12 md:space-y-12 md:py-8">
      {denied ? (
        <Alert tone="warning">Нет доступа к этому разделу. Выберите роль в блоке входа и войдите в систему.</Alert>
      ) : null}

      <section className="grid gap-5 xl:grid-cols-[1.02fr_0.98fr]">
        <Card className="overflow-hidden p-6 md:p-8">
          <div className="flex flex-wrap items-center gap-2">
            <p className="pill">Лапка · цифровая экосистема · 2026</p>
            <span className="rounded-full bg-cyan-50 px-3 py-1 text-xs font-semibold text-cyan-700">
              Владелец + врач + клиника
            </span>
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
              Безопасный AI + доступ по согласию
            </span>
          </div>
          <h1 className="mt-4 text-4xl font-black leading-tight tracking-tight text-lapka-900 md:text-6xl">
            Единая медицинская карта
            <br />
            для домашних животных
          </h1>
          <p className="mt-4 max-w-3xl text-lg text-lapka-700 md:text-xl">
            История лечения, анализы, визиты и AI-помощник в одной системе для владельцев и ветеринарных клиник.
            Без перегруза интерфейса. С прозрачными правами доступа. С владельческими сервисами, врачебными
            калькуляторами и клиническими протоколами в одном продукте.
          </p>

          <div className="mt-6 flex flex-wrap gap-2">
            <Link href="/login?role=owner" className="btn-primary">Создать профиль питомца</Link>
            <Link href="/for-clinics" className="btn-secondary">Запросить демо</Link>
            <Link href="/login?role=vet" className="btn-secondary">Открыть демо</Link>
          </div>

          <div className="mt-5">
            <StoreButtons />
          </div>

          <div className="mt-6 grid gap-2 sm:grid-cols-3">
            <div className="rounded-2xl border border-lapka-200 bg-white p-3">
              <p className="text-4xl font-black text-lapka-900">1 база</p>
              <p className="text-sm text-lapka-600">единые данные для владельца, врача и клиники</p>
            </div>
            <div className="rounded-2xl border border-lapka-200 bg-white p-3">
              <p className="text-4xl font-black text-lapka-900">99.9%</p>
              <p className="text-sm text-lapka-600">доступность демо-инфраструктуры</p>
            </div>
            <div className="rounded-2xl border border-lapka-200 bg-white p-3">
              <p className="text-4xl font-black text-lapka-900">Безопасный AI</p>
              <p className="text-sm text-lapka-600">оценка срочности и объяснения без назначения лечения</p>
            </div>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-2">
            {heroFeatures.map((item) => (
              <article key={item.title} className="rounded-2xl border border-lapka-200 bg-white/90 p-4">
                <p className="text-lg font-black text-lapka-900">{item.title}</p>
                <p className="mt-2 text-sm text-lapka-700">{item.text}</p>
              </article>
            ))}
          </div>
        </Card>

        <div className="space-y-4">
          <ThreeDHeroScene />
          <AuthDropdown mode="card" />
        </div>
      </section>

      <section>
        <h2 className="section-title">Как это работает</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {howItWorks.map((step) => (
            <Card key={step.id} title={`${step.id} · ${step.title}`}>
              <div className="relative h-44 w-full overflow-hidden rounded-2xl border border-lapka-200 bg-white">
                <Image src={step.image} alt={step.title} fill sizes="(max-width: 1280px) 50vw, 25vw" className="object-cover" />
              </div>
              <p className="mt-3 text-sm text-lapka-700">{step.text}</p>
            </Card>
          ))}
        </div>
      </section>

      <section>
        <h2 className="section-title">Почему клиники выбирают Лапку</h2>
        <p className="mt-2 max-w-4xl text-lg text-lapka-700">
          Лапка объединяет клиническую работу врача, операционный контур клиники и доверие владельца в едином продукте.
          Это не «ещё одна CRM», а рабочая медицинская экосистема.
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {clinicReasons.map((item) => (
            <Card key={item.title} title={item.title} subtitle={item.subtitle}>
              <p className="text-sm text-lapka-700">{item.text}</p>
            </Card>
          ))}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.02fr_0.98fr]">
        <Card title="Безопасность данных" subtitle="RBAC, согласие владельца, аудит и защита данных">
          <div className="grid gap-3 sm:grid-cols-2">
            {dataSecurity.map((item) => (
              <article key={item.title} className="rounded-2xl border border-lapka-200 bg-white p-4">
                <p className="text-lg font-black text-lapka-900">{item.title}</p>
                <p className="mt-2 text-sm text-lapka-700">{item.text}</p>
              </article>
            ))}
          </div>
        </Card>

        <Card title="AI ограничения" subtitle="Безопасные границы AI в медицинском продукте">
          <ul className="space-y-2">
            {aiLimits.map((item) => (
              <li key={item} className="rounded-xl border border-lapka-200 bg-white px-3 py-2 text-sm text-lapka-700">
                {item}
              </li>
            ))}
          </ul>
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            Важно: AI в Лапке не заменяет ветеринарного врача и не предназначен для самостоятельного лечения владельцем.
          </div>
        </Card>
      </section>

      <section>
        <h2 className="section-title">Как мы защищаем стационар и камеры</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {cameraSafety.map((item) => (
            <Card key={item.title} title={item.title}>
              <p className="text-sm text-lapka-700">{item.text}</p>
            </Card>
          ))}
        </div>
      </section>

      <section>
        <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 className="section-title">Кейсы внедрения</h2>
          <span className="pill">Короткие истории внедрения</span>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {caseStudies.map((item) => (
            <Card key={item.title} title={item.title}>
              <p className="text-sm font-semibold text-lapka-800">Проблема</p>
              <p className="mt-1 text-sm text-lapka-700">{item.challenge}</p>
              <p className="mt-3 text-sm font-semibold text-lapka-800">Результат</p>
              <p className="mt-1 text-sm text-lapka-700">{item.result}</p>
            </Card>
          ))}
        </div>
      </section>

      <section>
        <h2 className="section-title">Платформа в цифрах</h2>
        <div className="mt-4 kpi-grid">
          <StatsCard label="Клиники" value="120+" />
          <StatsCard label="Питомцы" value="8 500+" />
          <StatsCard label="Врачи" value="1 100+" />
          <StatsCard label="Средний NPS" value="72" />
        </div>
      </section>

      <section className="surface-card p-6 md:p-8">
        <h2 className="section-title">Сценарии запуска</h2>
        <p className="mt-2 max-w-3xl text-lg text-lapka-700">
          Выберите следующий шаг. Мы сделали три коротких сценария, чтобы привести вас от интереса к внедрению.
        </p>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          {funnel.map((item) => (
            <article key={item.title} className="rounded-2xl border border-lapka-200 bg-white p-4">
              <p className="text-xl font-black text-lapka-900">{item.title}</p>
              <p className="mt-2 text-sm text-lapka-700">{item.text}</p>
              <Link href={item.href} className={`${item.tone} mt-4 w-full`}>{item.cta}</Link>
            </article>
          ))}
        </div>
      </section>

      <section className="surface-card p-6 md:p-8">
        <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div>
            <h2 className="section-title">Мобильный доступ для владельца и клиники</h2>
            <p className="mt-2 max-w-3xl text-lg text-lapka-700">
              Используйте Лапку как единый веб-кабинет или откройте мобильный сценарий: быстрый вход, уведомления,
              карта мест рядом с питомцем и удобный доступ к медкарте в дороге.
            </p>
          </div>
          <div className="flex flex-wrap justify-start gap-3 lg:justify-end">
            <StoreButtons />
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <Card title="FAQ">
          <div className="space-y-2">
            {faq.map((item) => (
              <details key={item.q} className="rounded-2xl border border-lapka-200 bg-white p-4">
                <summary className="cursor-pointer list-none text-sm font-bold text-lapka-900">{item.q}</summary>
                <p className="mt-2 text-sm text-lapka-700">{item.a}</p>
              </details>
            ))}
          </div>
        </Card>

        <Card title="Готовы к запуску?" subtitle="Владелец, врач и администратор уже работают в едином продукте">
          <div className="space-y-2">
            <Link href="/login?role=owner" className="btn-primary w-full">Создать профиль питомца</Link>
            <Link href="/for-clinics" className="btn-secondary w-full">Запросить демо для клиники</Link>
            <Link href="/login?role=vet" className="btn-secondary w-full">Открыть врачебный демо-кабинет</Link>
          </div>
        </Card>
      </section>

      <footer className="surface-card p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xl font-black text-lapka-900">Лапка</p>
            <p className="text-sm text-lapka-600">Единая медицинская экосистема для домашних животных.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/security" className="btn-secondary">Безопасность</Link>
            <Link href="/pricing" className="btn-secondary">Тарифы</Link>
            <Link href="/faq" className="btn-secondary">FAQ</Link>
            <Link href="/for-clinics" className="btn-primary">Запросить демо для клиники</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
