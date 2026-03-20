'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Card from '@/components/ui/Card';
import EmptyState from '@/components/ui/EmptyState';
import ErrorBanner from '@/components/ui/ErrorBanner';
import Skeleton from '@/components/ui/Skeleton';
import { loadOwnerBaseData } from '@/lib/owner-data';
import { buildExpenseCenter } from '@/lib/owner-workspace';

function money(cents) {
  return `${(Number(cents || 0) / 100).toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} ₽`;
}

export default function OwnerExpensesPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [appointments, setAppointments] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [reminders, setReminders] = useState([]);

  const center = useMemo(() => buildExpenseCenter({ invoices, appointments, reminders }), [appointments, invoices, reminders]);

  const loadPage = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const base = await loadOwnerBaseData();
      setAppointments(base.appointments);
      setInvoices(base.invoices);
      setReminders(base.reminders);
    } catch (requestError) {
      setError(requestError.message || 'Не удалось загрузить центр расходов');
      setAppointments([]);
      setInvoices([]);
      setReminders([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPage();
  }, [loadPage]);

  return (
    <div className="space-y-7">
      <header className="page-header">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-lapka-500">Центр расходов</p>
          <h1 className="page-title">Расходы по питомцу</h1>
          <p className="page-subtitle">Лекарства, визиты, профилактика и сервисы собраны в один бытовой финансовый экран, чтобы владелец видел реальную картину затрат.</p>
        </div>
      </header>
      {error ? <ErrorBanner message={error} onRetry={loadPage} /> : null}
      {loading ? (
        <section className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-72 w-full" />
        </section>
      ) : !center.categories.length ? (
        <EmptyState title="Расходов пока нет" text="Когда появятся счета, записи и профилактические задачи, Lapka соберёт центр расходов." />
      ) : (
        <>
          <section className="kpi-grid">
            <Card title="Всего расходов"><p className="text-4xl font-black text-lapka-900">{money(center.total)}</p></Card>
            <Card title="Средний чек"><p className="text-4xl font-black text-lapka-900">{money(center.avgCheck)}</p></Card>
            <Card title="Счета"><p className="text-4xl font-black text-lapka-900">{invoices.length}</p></Card>
            <Card title="Будущие записи"><p className="text-4xl font-black text-lapka-900">{appointments.length}</p></Card>
          </section>

          <Card title="Расходы по категориям" subtitle="Практичный бытовой срез без бухгалтерского шума">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {center.categories.map((item) => (
                <div key={item.id} className="rounded-[24px] border border-lapka-200 bg-white px-4 py-4">
                  <p className="text-sm font-semibold uppercase tracking-[0.16em] text-lapka-500">{item.title}</p>
                  <p className="mt-3 text-3xl font-black text-lapka-900">{money(item.amount)}</p>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
