'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import Card from '@/components/ui/Card';
import EmptyState from '@/components/ui/EmptyState';
import ErrorBanner from '@/components/ui/ErrorBanner';
import Skeleton from '@/components/ui/Skeleton';
import Badge from '@/components/ui/Badge';
import ShowcasePanel from '@/components/ui/ShowcasePanel';
import { apiRequest } from '@/lib/api';
import { getApiBase } from '@/lib/auth';

function money(cents, currency = 'RUB') {
  return `${(Number(cents || 0) / 100).toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
}

function statusBadge(status) {
  if (status === 'paid') return <Badge tone="success">Оплачен</Badge>;
  if (status === 'issued') return <Badge tone="warning">Выставлен</Badge>;
  if (status === 'void') return <Badge tone="danger">Аннулирован</Badge>;
  return <Badge tone="info">Черновик</Badge>;
}

function statusLabel(status) {
  if (status === 'paid') return 'Оплачен';
  if (status === 'issued') return 'Выставлен';
  if (status === 'void') return 'Аннулирован';
  return 'Черновик';
}

function shortId(value) {
  if (!value) return '—';
  return `${String(value).slice(0, 8)}…`;
}

function paymentStatusLabel(status) {
  if (status === 'succeeded') return 'Успешно';
  if (status === 'pending') return 'В обработке';
  if (status === 'failed') return 'Ошибка';
  if (status === 'refunded') return 'Возврат';
  return status || '—';
}

export default function ClinicInvoiceDetailsPage() {
  const params = useParams();
  const invoiceId = useMemo(() => params?.id || '', [params]);

  const [invoice, setInvoice] = useState(null);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [itemForm, setItemForm] = useState({
    service_id: '',
    name: '',
    qty: 1,
    unit_price_cents: 0,
  });

  const loadInvoice = useCallback(async () => {
    if (!invoiceId) return;
    setLoading(true);
    setError('');
    try {
      const [invoicePayload, servicesPayload] = await Promise.all([
        apiRequest(`/api/v1/clinic/invoices/${invoiceId}`),
        apiRequest('/api/v1/clinic/services'),
      ]);
      setInvoice(invoicePayload || null);
      setServices(Array.isArray(servicesPayload) ? servicesPayload : []);
    } catch (requestError) {
      setError(requestError.message || 'Не удалось загрузить счёт');
      setInvoice(null);
      setServices([]);
    } finally {
      setLoading(false);
    }
  }, [invoiceId]);

  useEffect(() => {
    loadInvoice();
  }, [loadInvoice]);

  const selectedService = useMemo(
    () => services.find((row) => row.id === itemForm.service_id) || null,
    [itemForm.service_id, services]
  );

  const publicPaymentUrl = useMemo(() => {
    if (!invoice?.public_token) return '';
    return `${getApiBase()}/api/v1/public/pay/${invoice.public_token}`;
  }, [invoice]);

  useEffect(() => {
    if (!selectedService) return;
    setItemForm((prev) => ({
      ...prev,
      name: selectedService.name,
      unit_price_cents: selectedService.price_cents,
    }));
  }, [selectedService]);

  async function addItem(event) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await apiRequest(`/api/v1/clinic/invoices/${invoiceId}/items`, {
        method: 'POST',
        body: {
          service_id: itemForm.service_id || null,
          name: itemForm.name.trim() || null,
          qty: Number(itemForm.qty || 1),
          unit_price_cents: Number(itemForm.unit_price_cents || 0),
        },
      });
      setItemForm({ service_id: '', name: '', qty: 1, unit_price_cents: 0 });
      await loadInvoice();
    } catch (requestError) {
      setError(requestError.message || 'Не удалось добавить позицию');
    } finally {
      setSubmitting(false);
    }
  }

  async function removeItem(itemId) {
    setSubmitting(true);
    setError('');
    try {
      await apiRequest(`/api/v1/clinic/invoices/${invoiceId}/items/${itemId}`, {
        method: 'DELETE',
      });
      await loadInvoice();
    } catch (requestError) {
      setError(requestError.message || 'Не удалось удалить позицию');
    } finally {
      setSubmitting(false);
    }
  }

  async function invoiceAction(action) {
    setSubmitting(true);
    setError('');
    try {
      await apiRequest(`/api/v1/clinic/invoices/${invoiceId}/${action}`, {
        method: 'POST',
        body: {},
      });
      await loadInvoice();
    } catch (requestError) {
      setError(requestError.message || 'Не удалось выполнить действие');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <header className="page-header">
        <div>
          <h1 className="page-title">Карточка счёта</h1>
          <p className="page-subtitle">Финансовый экран клиники: позиции, статус, история оплаты и экспорт счёта в PDF.</p>
        </div>
        <Link className="btn-secondary" href="/clinic/billing">
          ← К списку счетов
        </Link>
      </header>

      {error ? <ErrorBanner message={error} onRetry={loadInvoice} /> : null}

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-60 w-full" />
        </div>
      ) : !invoice ? (
        <EmptyState title="Счёт не найден" text="Проверьте URL или откройте счёт из billing." />
      ) : (
        <>
          <ShowcasePanel
            eyebrow="Финансовый контур клиники"
            title="Счёт, позиции и публичная платёжная ссылка в одном окне"
            description="Администратор клиники управляет составом счёта, выставлением, оплатой и экспортом PDF без переключения между разными экранами. Здесь должен быть виден текущий статус документа и следующее нужное действие."
            imageSrc="/assets/img/admin-side.svg"
            imageAlt="Биллинг клиники"
            badges={[
              `Статус: ${statusLabel(invoice.status)}`,
              `Позиции: ${invoice.items?.length || 0}`,
              `Оплаты: ${invoice.payments?.length || 0}`,
            ]}
          />

          <section className="kpi-grid">
            <Card title="Итоговая сумма" subtitle="Текущий объём счёта">
              <p className="text-4xl font-black text-lapka-900">{money(invoice.total_cents, invoice.currency)}</p>
            </Card>
            <Card title="Позиции" subtitle="Услуги и внутренние строки">
              <p className="text-4xl font-black text-lapka-900">{invoice.items?.length || 0}</p>
            </Card>
            <Card title="Платежи" subtitle="Фиксация оплаченных операций">
              <p className="text-4xl font-black text-lapka-900">{invoice.payments?.length || 0}</p>
            </Card>
            <Card title="Статус" subtitle="Текущее состояние документа">
              <p className="text-4xl font-black text-lapka-900">{statusLabel(invoice.status)}</p>
            </Card>
          </section>

          <Card
            title={`Счёт ${invoice.id.slice(0, 8)}...`}
            subtitle={`Создан ${new Date(invoice.created_at).toLocaleString('ru-RU')}`}
            action={statusBadge(invoice.status)}
          >
            <div className="grid gap-2 text-sm text-lapka-700 md:grid-cols-2">
              <div className="rounded-xl border border-lapka-200 bg-lapka-50 px-3 py-2">Владелец в системе: {shortId(invoice.owner_id)}</div>
              <div className="rounded-xl border border-lapka-200 bg-lapka-50 px-3 py-2">Питомец в системе: {shortId(invoice.pet_id)}</div>
              <div className="rounded-xl border border-lapka-200 bg-lapka-50 px-3 py-2">
                Сумма: <span className="font-semibold">{money(invoice.total_cents, invoice.currency)}</span>
              </div>
              <div className="rounded-xl border border-lapka-200 bg-lapka-50 px-3 py-2">
                Публичная ссылка оплаты: {invoice.public_token ? shortId(invoice.public_token) : 'будет сформирована после выставления'}
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {invoice.status === 'draft' ? (
                <button className="btn-primary" type="button" disabled={submitting} onClick={() => invoiceAction('issue')}>
                  Выставить счёт
                </button>
              ) : null}
              {invoice.status === 'issued' ? (
                <button className="btn-secondary" type="button" disabled={submitting} onClick={() => invoiceAction('mark-paid')}>
                  Отметить оплаченным
                </button>
              ) : null}
              {invoice.status !== 'void' && invoice.status !== 'paid' ? (
                <button className="btn-danger" type="button" disabled={submitting} onClick={() => invoiceAction('void')}>
                  Аннулировать
                </button>
              ) : null}
              <a
                className="btn-secondary"
                href={`${getApiBase()}/api/v1/clinic/invoices/${invoice.id}/export/pdf`}
                target="_blank"
                rel="noreferrer"
              >
                Экспорт PDF
              </a>
              {publicPaymentUrl ? (
                <a className="btn-secondary" href={publicPaymentUrl} target="_blank" rel="noreferrer">
                  Публичная ссылка оплаты
                </a>
              ) : null}
            </div>
          </Card>

          <section className="grid gap-4 2xl:grid-cols-2">
            {[
              {
                title: 'До выставления',
                text: 'Проверьте состав услуг, корректность сумм и привязку к питомцу и владельцу.',
              },
              {
                title: 'После выставления',
                text: 'Убедитесь, что ссылка на оплату готова и владелец видит корректный документ в своём контуре.',
              },
              {
                title: 'После оплаты',
                text: 'Сверьте платёж, статус документа и готовность к выгрузке PDF в финансовый архив клиники.',
              },
            ].map((item) => (
              <Card key={item.title} title={item.title}>
                <p className="text-sm leading-7 text-lapka-700">{item.text}</p>
              </Card>
            ))}
          </section>

          <section className="grid gap-4 2xl:grid-cols-[1.08fr_0.92fr]">
            <Card title="Позиции счёта" subtitle="Добавление и удаление услуг и внутренних позиций">
              {invoice.items?.length ? (
                <div className="table-shell">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Услуга</th>
                        <th>Кол-во</th>
                        <th>Цена</th>
                        <th>Итого</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {invoice.items.map((item) => (
                        <tr key={item.id}>
                          <td>{item.name}</td>
                          <td>{item.qty}</td>
                          <td>{money(item.unit_price_cents, invoice.currency)}</td>
                          <td>{money(item.total_cents, invoice.currency)}</td>
                          <td>
                            <button className="btn-danger !px-3 !py-1 text-xs" type="button" onClick={() => removeItem(item.id)}>
                              Удалить
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyState title="Позиции не добавлены" text="Добавьте хотя бы одну услугу, чтобы выставить счёт." />
              )}

              <form className="mt-4 grid gap-3 md:grid-cols-2" onSubmit={addItem}>
                <label className="block md:col-span-2">
                  <span className="label">Услуга из каталога</span>
                  <select
                    className="input"
                    value={itemForm.service_id}
                    onChange={(event) => setItemForm((prev) => ({ ...prev, service_id: event.target.value }))}
                  >
                    <option value="">Выбрать вручную</option>
                    {services.map((service) => (
                      <option key={service.id} value={service.id}>
                        {service.name} · {money(service.price_cents)}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="label">Название позиции</span>
                  <input
                    className="input"
                    value={itemForm.name}
                    onChange={(event) => setItemForm((prev) => ({ ...prev, name: event.target.value }))}
                    required
                  />
                </label>
                <label className="block">
                  <span className="label">Количество</span>
                  <input
                    type="number"
                    min="1"
                    className="input"
                    value={itemForm.qty}
                    onChange={(event) => setItemForm((prev) => ({ ...prev, qty: event.target.value }))}
                    required
                  />
                </label>
                <label className="block">
                  <span className="label">Цена за единицу, коп.</span>
                  <input
                    type="number"
                    min="0"
                    className="input"
                    value={itemForm.unit_price_cents}
                    onChange={(event) => setItemForm((prev) => ({ ...prev, unit_price_cents: event.target.value }))}
                    required
                  />
                </label>
                <div className="flex items-end">
                  <button className="btn-primary w-full" type="submit" disabled={submitting}>
                    {submitting ? 'Сохраняем...' : 'Добавить позицию'}
                  </button>
                </div>
              </form>
            </Card>

            <div className="space-y-4">
              <Card title="Публичный платёжный контур" subtitle="Владелец видит только сумму и статус, без медицинских деталей">
                <div className="rounded-[24px] border border-lapka-200 bg-lapka-50 px-4 py-4 text-sm leading-7 text-lapka-700">
                  {publicPaymentUrl ? (
                    <>
                      <p className="font-semibold text-lapka-900">Ссылка готова к отправке</p>
                      <p className="mt-1 break-all">{publicPaymentUrl}</p>
                    </>
                  ) : (
                    <>
                      <p className="font-semibold text-lapka-900">Ссылка появится после выставления</p>
                      <p className="mt-1">Когда счёт перейдёт в статус «Выставлен», владелец сможет открыть безопасную страницу оплаты без медицинских деталей.</p>
                    </>
                  )}
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <Link href="/clinic/services" className="rounded-[22px] border border-lapka-200 bg-white px-4 py-4 text-sm font-semibold text-lapka-800 transition hover:-translate-y-0.5 hover:shadow-card">
                    Каталог услуг
                  </Link>
                  <Link href="/clinic/billing" className="rounded-[22px] border border-lapka-200 bg-white px-4 py-4 text-sm font-semibold text-lapka-800 transition hover:-translate-y-0.5 hover:shadow-card">
                    Все счета
                  </Link>
                </div>
              </Card>

              <Card title="История платежей" subtitle="Фиксация всех операций по счёту">
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
                            <td>{paymentStatusLabel(payment.status)}</td>
                            <td>{money(payment.amount_cents, payment.currency)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <EmptyState title="Платежей пока нет" text="После оплаты владельцем или подтверждения оплаты появится запись." />
                )}
              </Card>

              <Card title="Что важно проверить" subtitle="Быстрый чеклист администратора клиники">
                <div className="grid gap-3">
                  {[
                    'Состав услуг и сумма должны совпадать с реальным маршрутом визита.',
                    'Публичная ссылка на оплату не должна раскрывать медицинские детали.',
                    'После оплаты PDF и статус счёта должны совпадать с владельческим контуром.',
                  ].map((item) => (
                    <div key={item} className="rounded-xl border border-lapka-200 bg-white px-4 py-3 text-sm leading-7 text-lapka-700">
                      {item}
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </section>
        </>
      )}
    </>
  );
}
