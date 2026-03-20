'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import Card from '@/components/ui/Card';
import StatsCard from '@/components/ui/StatsCard';
import Skeleton from '@/components/ui/Skeleton';
import EmptyState from '@/components/ui/EmptyState';
import ErrorBanner from '@/components/ui/ErrorBanner';
import Badge from '@/components/ui/Badge';
import { apiRequest } from '@/lib/api';
import { loadOwnerBaseData } from '@/lib/owner-data';
import { buildExpenseCenter } from '@/lib/owner-workspace';

function money(cents, currency = 'RUB') {
  return `${(Number(cents || 0) / 100).toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
}

function statusBadge(status) {
  if (status === 'paid') return <Badge tone="success">Оплачен</Badge>;
  if (status === 'issued') return <Badge tone="warning">К оплате</Badge>;
  if (status === 'void') return <Badge tone="danger">Аннулирован</Badge>;
  return <Badge tone="info">Черновик</Badge>;
}

export default function OwnerBillingPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [invoices, setInvoices] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [reminders, setReminders] = useState([]);

  async function loadOwnerInvoices() {
    setLoading(true);
    setError('');
    try {
      const [payload, base] = await Promise.all([
        apiRequest('/api/v1/owner/invoices'),
        loadOwnerBaseData(),
      ]);
      setInvoices(Array.isArray(payload) ? payload : []);
      setAppointments(base.appointments || []);
      setReminders(base.reminders || []);
    } catch (requestError) {
      setError(requestError.message || 'Не удалось загрузить счета');
      setInvoices([]);
      setAppointments([]);
      setReminders([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadOwnerInvoices();
  }, []);

  const paidCount = useMemo(() => invoices.filter((row) => row.status === 'paid').length, [invoices]);
  const dueCount = useMemo(() => invoices.filter((row) => row.status === 'issued').length, [invoices]);
  const dueTotal = useMemo(
    () => invoices.filter((row) => row.status === 'issued').reduce((acc, row) => acc + Number(row.total_cents || 0), 0),
    [invoices]
  );
  const expenseCenter = useMemo(() => buildExpenseCenter({ invoices, appointments, reminders }), [appointments, invoices, reminders]);

  return (
    <div className="space-y-6">
      <header className="page-header">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-lapka-500">Финансы</p>
          <h1 className="page-title">Счета, оплаты и расход по питомцу</h1>
          <p className="page-subtitle">Финансовый слой больше не живёт отдельно от записей и профилактики: здесь видны счета, расход по категориям и то, что требует оплаты или планирования.</p>
        </div>
      </header>

      {error ? <ErrorBanner message={error} onRetry={loadOwnerInvoices} /> : null}

      <section className="kpi-grid">
        <StatsCard label="Всего счетов" value={String(invoices.length)} />
        <StatsCard label="К оплате" value={String(dueCount)} />
        <StatsCard label="Оплачено" value={String(paidCount)} />
        <StatsCard label="Сумма к оплате" value={money(dueTotal)} />
      </section>

      <section className="grid items-start gap-5 2xl:grid-cols-[1.06fr_0.94fr]">
        <Card title="Структура расходов" subtitle="Видно не только инвойсы, но и сам контур расхода по питомцу.">
          <div className="grid gap-3 sm:grid-cols-2">
            {expenseCenter.categories.map((item) => (
              <div key={item.id} className="rounded-[24px] border border-lapka-200 bg-white px-4 py-4">
                <p className="text-lg font-bold text-lapka-900">{item.title}</p>
                <p className="mt-2 text-2xl font-black tracking-tight text-lapka-950">{money(item.amount)}</p>
              </div>
            ))}
          </div>
        </Card>
        <Card title="Следующие шаги" subtitle="Финансы встроены в продуктовые сценарии, а не висят отдельной таблицей.">
          <div className="grid gap-3">
            <Link href="/owner/expenses" className="action-grid-link">
              <div>
                <p className="text-lg font-bold text-lapka-900">Центр расходов</p>
                <p className="mt-1 text-sm text-lapka-600">Посмотреть расход по категориям и питомцам.</p>
              </div>
              <span className="pill !px-3 !py-1.5">Расходы</span>
            </Link>
            <Link href="/owner/services" className="action-grid-link">
              <div>
                <p className="text-lg font-bold text-lapka-900">Сервисный центр</p>
                <p className="mt-1 text-sm text-lapka-600">Вернуться к клиникам, записям, страхованию и поездкам с питомцем.</p>
              </div>
              <span className="pill !px-3 !py-1.5">Сервисы</span>
            </Link>
          </div>
        </Card>
      </section>

      <Card title="История счетов">
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : invoices.length === 0 ? (
          <EmptyState title="Счета не найдены" text="После визитов и услуг клиники здесь появятся счета." />
        ) : (
          <div className="table-shell">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Счёт</th>
                  <th>Статус</th>
                  <th>Сумма</th>
                  <th>Дата</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {invoices.map((row) => (
                  <tr key={row.id}>
                    <td className="font-semibold">{row.id.slice(0, 8)}...</td>
                    <td>{statusBadge(row.status)}</td>
                    <td>{money(row.total_cents, row.currency)}</td>
                    <td>{new Date(row.created_at).toLocaleString('ru-RU')}</td>
                    <td>
                      <Link className="btn-secondary !px-3 !py-1 text-xs" href={`/owner/billing/${row.id}`}>
                        Открыть счёт
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
