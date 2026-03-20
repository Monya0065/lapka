'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Card from '@/components/ui/Card';
import EmptyState from '@/components/ui/EmptyState';
import ErrorBanner from '@/components/ui/ErrorBanner';
import Skeleton from '@/components/ui/Skeleton';
import StatsCard from '@/components/ui/StatsCard';
import Badge from '@/components/ui/Badge';
import { apiRequest } from '@/lib/api';

const INITIAL_FORM = {
  owner_id: '',
  pet_id: '',
  currency: 'RUB',
};

function formatMoney(cents, currency = 'RUB') {
  return `${(Number(cents || 0) / 100).toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
}

function statusBadge(status) {
  if (status === 'paid') return <Badge tone="success">Оплачен</Badge>;
  if (status === 'issued') return <Badge tone="warning">Выставлен</Badge>;
  if (status === 'void') return <Badge tone="danger">Аннулирован</Badge>;
  return <Badge tone="info">Черновик</Badge>;
}

export default function ClinicBillingPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [summary, setSummary] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [patients, setPatients] = useState([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(INITIAL_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [updatingId, setUpdatingId] = useState('');

  const loadBilling = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [summaryPayload, invoicesPayload, patientsPayload] = await Promise.all([
        apiRequest('/api/v1/clinic/analytics/summary?range=30d'),
        apiRequest('/api/v1/clinic/invoices'),
        apiRequest('/api/v1/clinics/me/patients?limit=500'),
      ]);
      setSummary(summaryPayload || null);
      setInvoices(Array.isArray(invoicesPayload) ? invoicesPayload : []);
      setPatients(Array.isArray(patientsPayload) ? patientsPayload : []);
    } catch (requestError) {
      setError(requestError.message || 'Не удалось загрузить биллинг');
      setSummary(null);
      setInvoices([]);
      setPatients([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBilling();
  }, [loadBilling]);

  const filteredInvoices = useMemo(() => {
    if (statusFilter === 'all') return invoices;
    return invoices.filter((row) => row.status === statusFilter);
  }, [invoices, statusFilter]);

  const patientOptions = useMemo(
    () =>
      patients
        .filter((row) => row.owner_user_id)
        .map((row) => ({
          pet_id: row.pet_id,
          owner_id: row.owner_user_id,
          label: `${row.pet_name} · ${row.owner_name || 'Владелец'} · ${row.owner_email || '—'}`,
        })),
    [patients]
  );

  const selectedPatient = useMemo(
    () => patientOptions.find((row) => row.pet_id === form.pet_id) || null,
    [form.pet_id, patientOptions]
  );

  async function createInvoice(event) {
    event.preventDefault();
    if (!form.pet_id || !selectedPatient?.owner_id) {
      setError('Выберите пациента с профилем владельца');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const created = await apiRequest('/api/v1/clinic/invoices', {
        method: 'POST',
        body: {
          owner_id: selectedPatient.owner_id,
          pet_id: form.pet_id,
          currency: form.currency || 'RUB',
        },
      });
      setModalOpen(false);
      setForm(INITIAL_FORM);
      await loadBilling();
      if (created?.id) {
        window.location.href = `/clinic/billing/${created.id}`;
      }
    } catch (requestError) {
      setError(requestError.message || 'Не удалось создать счет');
    } finally {
      setSubmitting(false);
    }
  }

  async function updateStatus(invoiceId, action) {
    setUpdatingId(invoiceId);
    setError('');
    try {
      await apiRequest(`/api/v1/clinic/invoices/${invoiceId}/${action}`, {
        method: 'POST',
        body: {},
      });
      await loadBilling();
    } catch (requestError) {
      setError(requestError.message || 'Не удалось изменить статус счета');
    } finally {
      setUpdatingId('');
    }
  }

  return (
    <>
      <header className="page-header">
        <div>
          <h1 className="page-title">Биллинг и счета</h1>
          <p className="page-subtitle">Управление счетами, оплатами и выручкой клиники.</p>
        </div>
        <button className="btn-primary" type="button" onClick={() => setModalOpen(true)}>
          Создать счёт
        </button>
      </header>

      {error ? <ErrorBanner message={error} onRetry={loadBilling} /> : null}

      <section className="showcase-shell p-6 md:p-7">
        <div className="showcase-grid" />
        <div className="showcase-orb left-[8%] top-[14%] h-5 w-5 bg-cyan-400/85 shadow-[0_0_0_14px_rgba(61,147,220,0.12)]" />
        <div className="showcase-orb right-[10%] top-[12%] h-6 w-6 bg-emerald-400/80 shadow-[0_0_0_16px_rgba(66,186,160,0.14)]" />
        <div className="relative z-[1] grid gap-5 2xl:grid-cols-[minmax(0,1fr)_320px] 2xl:items-center">
          <div className="min-w-0">
            <span className="pill">Финансовый контур клиники</span>
            <h2 className="mt-4 text-[2.05rem] font-black tracking-tight text-lapka-900 md:text-[2.7rem]">
              Счета, оплаты и экспорт финансовых документов
            </h2>
            <p className="mt-3 max-w-3xl text-base leading-8 text-lapka-700">
              Администратор создаёт счета, переводит их в выставленные и оплаченные, а владелец видит только финансовую часть без медицинских деталей.
            </p>
          </div>
          <div className="showcase-panel showcase-floating overflow-hidden p-4">
            <div className="relative h-64 w-full overflow-hidden rounded-[24px]">
              <Image src="/assets/img/clinic-ops.svg" alt="Биллинг клиники" fill sizes="320px" className="object-cover" />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="pill">Счета</span>
              <span className="pill">PDF</span>
              <span className="pill">Статусы оплаты</span>
            </div>
          </div>
        </div>
      </section>

      <section className="kpi-grid">
        <StatsCard label="Выручка (30 дней)" value={formatMoney(summary?.revenue_cents || 0)} />
        <StatsCard label="Оплачено" value={String(summary?.paid_invoices || 0)} />
        <StatsCard label="К оплате" value={String(summary?.outstanding_invoices || 0)} />
        <StatsCard label="Средняя длительность визита" value={`${summary?.avg_visit_duration_minutes || 0} мин`} />
        <StatsCard label="Доля неявок" value={`${summary?.no_show_rate || 0}%`} />
      </section>

      <Card title="Фильтры">
        <div className="flex flex-wrap gap-2">
          {['all', 'draft', 'issued', 'paid', 'void'].map((status) => (
            <button
              key={status}
              type="button"
              className={statusFilter === status ? 'btn-primary !px-3 !py-1.5' : 'btn-secondary !px-3 !py-1.5'}
              onClick={() => setStatusFilter(status)}
            >
              {{ all: 'Все', draft: 'Черновик', issued: 'Выставлен', paid: 'Оплачен', void: 'Аннулирован' }[status] || status}
            </button>
          ))}
        </div>
      </Card>

      <Card title="Счета клиники" subtitle="Выставление, отметка об оплате, аннулирование и экспорт PDF">
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : filteredInvoices.length === 0 ? (
          <EmptyState
            title="Счета не найдены"
            text="Создайте первый счёт для визита или записи."
            action={
              <button className="btn-primary" type="button" onClick={() => setModalOpen(true)}>
                Создать счёт
              </button>
            }
          />
        ) : (
          <div className="table-shell">
            <table className="data-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Статус</th>
                  <th>Сумма</th>
                  <th>Создан</th>
                  <th>Действия</th>
                </tr>
              </thead>
              <tbody>
                {filteredInvoices.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <Link className="font-semibold text-lapka-700 hover:text-lapka-900" href={`/clinic/billing/${row.id}`}>
                        {row.id.slice(0, 8)}...
                      </Link>
                    </td>
                    <td>{statusBadge(row.status)}</td>
                    <td>{formatMoney(row.total_cents, row.currency)}</td>
                    <td>{new Date(row.created_at).toLocaleString('ru-RU')}</td>
                    <td>
                      <div className="flex flex-wrap gap-2">
                        {row.status === 'draft' ? (
                          <button
                            className="btn-secondary !py-1 !px-3 text-xs"
                            type="button"
                            disabled={updatingId === row.id}
                            onClick={() => updateStatus(row.id, 'issue')}
                        >
                            Выставить
                          </button>
                        ) : null}
                        {row.status === 'issued' ? (
                          <button
                            className="btn-secondary !py-1 !px-3 text-xs"
                            type="button"
                            disabled={updatingId === row.id}
                            onClick={() => updateStatus(row.id, 'mark-paid')}
                        >
                            Отметить оплаченным
                          </button>
                        ) : null}
                        {row.status !== 'void' && row.status !== 'paid' ? (
                          <button
                            className="btn-danger !py-1 !px-3 text-xs"
                            type="button"
                            disabled={updatingId === row.id}
                            onClick={() => updateStatus(row.id, 'void')}
                        >
                            Аннулировать
                          </button>
                        ) : null}
                        <a
                          className="btn-secondary !py-1 !px-3 text-xs"
                          href={`${process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8000'}/api/v1/clinic/invoices/${row.id}/export/pdf`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          PDF
                        </a>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {modalOpen ? (
        <div className="fixed inset-0 z-[90] grid place-items-center bg-lapka-900/50 p-4 backdrop-blur-sm">
          <form className="surface-card w-full max-w-xl p-6" onSubmit={createInvoice}>
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-2xl font-bold text-lapka-900">Новый счёт</h2>
                <p className="text-sm text-lapka-600">Сначала создаётся черновик, затем в него добавляются позиции.</p>
              </div>
              <button className="btn-secondary" type="button" onClick={() => setModalOpen(false)}>
                Закрыть
              </button>
            </div>

            <label className="block">
              <span className="label">Пациент</span>
              <select
                className="input"
                value={form.pet_id}
                onChange={(event) => setForm((prev) => ({ ...prev, pet_id: event.target.value }))}
                required
              >
                <option value="">Выберите пациента</option>
                {patientOptions.map((row) => (
                  <option key={row.pet_id} value={row.pet_id}>
                    {row.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="mt-3 block">
              <span className="label">Валюта</span>
              <input
                className="input"
                value={form.currency}
                onChange={(event) => setForm((prev) => ({ ...prev, currency: event.target.value.toUpperCase() }))}
                maxLength={8}
              />
            </label>

            <div className="mt-5 flex justify-end gap-2">
              <button className="btn-secondary" type="button" onClick={() => setModalOpen(false)}>
                Отмена
              </button>
              <button className="btn-primary" type="submit" disabled={submitting}>
                {submitting ? 'Создаём...' : 'Создать счет'}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
}
