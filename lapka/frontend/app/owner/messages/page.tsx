import Link from 'next/link';
import SecureMessagesCenter from '@/components/inbox/SecureMessagesCenter';

export default function OwnerMessagesPage() {
  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-border bg-gradient-to-br from-sky-500/14 via-surface-muted to-violet-500/14 p-5 shadow-card md:p-6 dark:from-sky-500/10 dark:to-violet-500/10">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-theme-muted">Операционный срез</p>
            <h1 className="mt-1 text-2xl font-black tracking-tight text-theme md:text-3xl">Сигналы коммуникаций владельца</h1>
          </div>
          <span className="rounded-full border border-border bg-surface px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-theme-muted">
            owner comms ops
          </span>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {[
            {
              title: 'Входящие и ответы',
              value: 'LIVE',
              text: 'Все диалоги с клиникой в одном центре: уточнения, документы, follow-up и напоминания.',
              href: '/owner/inbox',
              tone: 'text-sky-700 dark:text-sky-300',
            },
            {
              title: 'Календарные задачи',
              value: 'SYNC',
              text: 'Синхронизируйте переписки с ближайшими визитами и семейным календарём ухода.',
              href: '/owner/calendar',
              tone: 'text-violet-700 dark:text-violet-300',
            },
            {
              title: 'История коммуникаций',
              value: '360',
              text: 'Переход к медкарте и ленте здоровья, чтобы контекст сообщений всегда был под рукой.',
              href: '/owner/records',
              tone: 'text-emerald-700 dark:text-emerald-300',
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

      <SecureMessagesCenter role="owner" />
    </div>
  );
}
