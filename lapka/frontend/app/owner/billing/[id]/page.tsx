'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Card from '@/components/ui/Card';
import Skeleton from '@/components/ui/Skeleton';
import EmptyState from '@/components/ui/EmptyState';
import ErrorBanner from '@/components/ui/ErrorBanner';
import Badge from '@/components/ui/Badge';
import ShowcasePanel from '@/components/ui/ShowcasePanel';
import { apiRequest } from '@/lib/api';

function money(cents, currency = 'RUB') {
  return `${(Number(cents || 0) / 100).toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
}

function statusBadge(status) {
  if (status === 'paid') return <Badge tone="success">Оплачен</Badge>;
  if (status === 'issued') return <Badge tone="warning">К оплате</Badge>;
  if (status === 'void') return <Badge tone="danger">Аннулирован</Badge>;
  return <Badge tone="info">Черновик</Badge>;
}

export default function OwnerInvoiceDetailsPage() {
  const params = useParams();
  const invoiceId = useMemo(() => params?.id || '', [params]);
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [paying, setPaying] = useState(false);
  const [payResult, setPayResult] = useState('');

  const loadInvoice = useCallback(async () => {
    if (!invoiceId) return;
    setLoading(true);
    setError('');
    try {
      const payload = await apiRequest(`/api/v1/owner/invoices/${invoiceId}`);
      setInvoice(payload || null);
    } catch (requestError) {
      setError(requestError.message || 'Не удалось загрузить счёт');
      setInvoice(null);
    } finally {
      setLoading(false);
    }
  }, [invoiceId]);

  useEffect(() => {
    loadInvoice();
  }, [loadInvoice]);

  async function payInvoice(simulateResult) {
    setPaying(true);
    setError('');
    setPayResult('');
    try {
      const payload = await apiRequest(`/api/v1/owner/invoices/${invoiceId}/pay`, {
        method: 'POST',
        body: { simulate_result: simulateResult },
      });
      setInvoice(payload.invoice);
      setPayResult(payload.payment?.status === 'succeeded' ? 'Оплата прошла успешно.' : 'Оплата не прошла, попробуйте снова.');
      await loadInvoice();
    } catch (requestError) {
      setError(requestError.message || 'Не удалось провести оплату');
    } finally {
      setPaying(false);
    }
  }

  return (
    <>
      <header className="page-header">
        <div>
          <h1 className="page-title">Детали счета</h1>
          <p className="page-subtitle">Сумма, позиции и история оплаты без медицинских назначений.</p>
        </div>
        <Link className="btn-secondary" href="/owner/billing">
          ← К списку
        </Link>
      </header>

      <ShowcasePanel
        eyebrow="Счета и оплата"
        title="Прозрачная финансовая карточка владельца"
        description="Смотрите состав счёта, статус оплаты и историю транзакций в отдельном разделе без клинических деталей."
        imageSrc="/assets/img/clinic.svg"
        imageAlt="Счета и оплата владельца"
      />

      {error ? <ErrorBanner message={error} onRetry={loadInvoice} /> : null}
      {payResult ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{payResult}</div> : null}

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-56 w-full" />
        </div>
      ) : !invoice ? (
        <EmptyState title="Счет не найден" text="Проверьте ссылку или откройте счёт из раздела billing." />
      ) : (
        <>
          <Card
            title={`Счёт ${invoice.id.slice(0, 8)}...`}
            subtitle={`Создан ${new Date(invoice.created_at).toLocaleString('ru-RU')}`}
            action={statusBadge(invoice.status)}
          >
            <div className="grid gap-2 text-sm text-lapka-700 md:grid-cols-2">
              <div className="rounded-xl border border-lapka-200 bg-lapka-50 px-3 py-2">Сумма: {money(invoice.total_cents, invoice.currency)}</div>
              <div className="rounded-xl border border-lapka-200 bg-lapka-50 px-3 py-2">
                Статус: {invoice.status === 'paid' ? 'Оплачен' : invoice.status === 'issued' ? 'К оплате' : invoice.status === 'void' ? 'Аннулирован' : 'Черновик'}
              </div>
              <div className="rounded-xl border border-lapka-200 bg-lapka-50 px-3 py-2">Питомец: {invoice.pet_name || invoice.pet_id}</div>
              <div className="rounded-xl border border-lapka-200 bg-lapka-50 px-3 py-2">Клиника: {invoice.clinic_name || invoice.clinic_id}</div>
            </div>

            {invoice.status === 'issued' || invoice.status === 'draft' ? (
              <div className="mt-4 flex flex-wrap gap-2">
                <button className="btn-primary" type="button" disabled={paying} onClick={() => payInvoice('succeeded')}>
                  Оплатить в демо-режиме
                </button>
                <button className="btn-secondary" type="button" disabled={paying} onClick={() => payInvoice('failed')}>
                  Показать ошибку оплаты
                </button>
              </div>
            ) : null}
          </Card>

          <Card title="Позиции">
            {invoice.items?.length ? (
              <div className="table-shell">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Название</th>
                      <th>Количество</th>
                      <th>Цена</th>
                      <th>Сумма</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoice.items.map((item) => (
                      <tr key={item.id}>
                        <td>{item.name}</td>
                        <td>{item.qty}</td>
                        <td>{money(item.unit_price_cents, invoice.currency)}</td>
                        <td>{money(item.total_cents, invoice.currency)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState title="Позиции пока не добавлены" text="Клиника ещё не заполнила состав счёта." />
            )}
          </Card>

          <Card title="История платежей">
            {invoice.payments?.length ? (
              <div className="table-shell">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Дата</th>
                      <th>Провайдер</th>
                      <th>Статус</th>
                      <th>Сумма</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoice.payments.map((payment) => (
                      <tr key={payment.id}>
                        <td>{new Date(payment.created_at).toLocaleString('ru-RU')}</td>
                        <td>{payment.provider === 'demo' ? 'Демо-провайдер' : payment.provider}</td>
                        <td>{payment.status === 'succeeded' ? 'Успешно' : payment.status === 'pending' ? 'В обработке' : payment.status === 'failed' ? 'Ошибка' : payment.status === 'refunded' ? 'Возврат' : payment.status}</td>
                        <td>{money(payment.amount_cents, payment.currency)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState title="Оплат пока нет" text="После оплаты здесь появится квитанция демо-провайдера." />
            )}
          </Card>
        </>
      )}
    </>
  );
}
