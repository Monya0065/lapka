import Link from 'next/link';
import LegalCenterPage from '@/components/legal/LegalCenterPage';

export default function OwnerLegalCenterPage() {
  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-border bg-surface-muted/65 p-4 md:p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-theme-muted">Операционный срез</p>
            <h2 className="mt-1 text-xl font-black tracking-tight text-theme md:text-2xl">Сигналы юридического контура</h2>
          </div>
          <span className="rounded-full border border-border bg-surface px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-theme-muted">
            legal ops
          </span>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {[
            {
              title: 'Давление комплаенса',
              value: 'MED',
              text: 'Контроль обновлений юридических документов и подтверждений владельца в профиле.',
              href: '/owner/profile',
              tone: 'text-amber-700 dark:text-amber-300',
            },
            {
              title: 'Готовность акцептов',
              value: 'SYNC',
              text: 'Синхронизация пользовательских акцептов с privacy-пакетом и историей действий.',
              href: '/owner/privacy',
              tone: 'text-violet-700 dark:text-violet-300',
            },
            {
              title: 'Прозрачность прав',
              value: '360',
              text: 'Видимость юридических оснований, версий документов и каналов обратной связи.',
              href: '/owner/notifications',
              tone: 'text-sky-700 dark:text-sky-300',
            },
          ].map((item) => (
            <Link
              key={item.title}
              href={item.href}
              className="rounded-2xl border border-border bg-surface/85 px-4 py-4 transition hover:-translate-y-0.5 hover:shadow-soft"
            >
              <p className={`text-base font-black ${item.tone}`}>{item.title}</p>
              <p className="mt-2 text-3xl font-black tabular-nums text-theme">{item.value}</p>
              <p className="mt-2 text-sm leading-relaxed text-theme">{item.text}</p>
              <p className="mt-3 text-xs font-semibold uppercase tracking-[0.14em] text-theme-muted">Открыть контур</p>
            </Link>
          ))}
        </div>
      </section>
      <LegalCenterPage
        title="Юридический центр владельца"
        subtitle="Версии документов, контроль ознакомления и контакты по вопросам персональных данных."
      />
    </div>
  );
}

