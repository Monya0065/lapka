'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Card from '@/components/ui/Card';
import EmptyState from '@/components/ui/EmptyState';
import ErrorBanner from '@/components/ui/ErrorBanner';
import Skeleton from '@/components/ui/Skeleton';
import StatsCard from '@/components/ui/StatsCard';
import Badge from '@/components/ui/Badge';
import ShowcasePanel from '@/components/ui/ShowcasePanel';
import PetVisualGallery from '@/components/ui/PetVisualGallery';
import { apiRequest } from '@/lib/api';
import { localizePetSpecies } from '@/lib/pets';

export default function VetLabsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [orders, setOrders] = useState([]);
  const [patients, setPatients] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [creating, setCreating] = useState(false);
  const [actionLoading, setActionLoading] = useState('');
  const [form, setForm] = useState({ pet_id: '', visit_id: '' });
  const [statusFilter, setStatusFilter] = useState('all');

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const endpoint = statusFilter === 'all' ? '/api/v1/vet/labs/orders' : `/api/v1/vet/labs/orders?status=${statusFilter}`;
      const [ordersPayload, petsPayload] = await Promise.all([
        apiRequest(endpoint),
        apiRequest('/api/v1/pets'),
      ]);
      const orderRows = Array.isArray(ordersPayload) ? ordersPayload : [];
      setOrders(orderRows);
      setPatients(Array.isArray(petsPayload) ? petsPayload : []);
      setSelectedOrder((current) => current || orderRows[0] || null);
    } catch (requestError) {
      setError(requestError.message || 'Не удалось загрузить лабораторные заказы');
      setOrders([]);
      setPatients([]);
      setSelectedOrder(null);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const patientOptions = useMemo(
    () => patients.map((pet) => ({ id: pet.id, label: `${pet.name} · ${pet.species}${pet.breed ? ` · ${pet.breed}` : ''}` })),
    [patients]
  );

  const patientMap = useMemo(() => {
    const map = {};
    patients.forEach((pet) => {
      map[pet.id] = pet;
    });
    return map;
  }, [patients]);

  const selectedPatient = useMemo(
    () => patientMap[selectedOrder?.pet_id] || patientMap[form.pet_id] || null,
    [form.pet_id, patientMap, selectedOrder]
  );

  async function createOrder(event) {
    event.preventDefault();
    if (!form.pet_id) {
      setError('Выберите пациента');
      return;
    }
    setCreating(true);
    setError('');
    try {
      await apiRequest('/api/v1/vet/labs/orders', {
        method: 'POST',
        body: {
          pet_id: form.pet_id,
          visit_id: form.visit_id || null,
        },
      });
      setForm({ pet_id: '', visit_id: '' });
      await loadOrders();
    } catch (requestError) {
      setError(requestError.message || 'Не удалось создать лабораторный заказ');
    } finally {
      setCreating(false);
    }
  }

  async function openOrder(orderId) {
    setActionLoading(orderId);
    try {
      const payload = await apiRequest(`/api/v1/vet/labs/orders/${orderId}`);
      setSelectedOrder(payload || null);
    } catch (requestError) {
      setError(requestError.message || 'Не удалось открыть заказ');
      setSelectedOrder(null);
    } finally {
      setActionLoading('');
    }
  }

  async function sendOrder(orderId) {
    setActionLoading(orderId);
    setError('');
    try {
      await apiRequest(`/api/v1/vet/labs/orders/${orderId}/send`, { method: 'POST' });
      await loadOrders();
      await openOrder(orderId);
    } catch (requestError) {
      setError(requestError.message || 'Не удалось отправить заказ');
    } finally {
      setActionLoading('');
    }
  }

  async function importResult(orderId) {
    setActionLoading(orderId);
    setError('');
    try {
      await apiRequest(`/api/v1/vet/labs/orders/${orderId}/import-result`, {
        method: 'POST',
        body: { species: 'кошки/собаки' },
      });
      await loadOrders();
      await openOrder(orderId);
    } catch (requestError) {
      setError(requestError.message || 'Не удалось импортировать результат');
    } finally {
      setActionLoading('');
    }
  }

  return (
    <>
      <header className="page-header">
        <div>
          <h1 className="page-title">Лабораторные заказы</h1>
          <p className="page-subtitle">Создание, отправка и импорт демонстрационных результатов лаборатории в рабочем контуре врача.</p>
        </div>
      </header>

      {error ? <ErrorBanner message={error} onRetry={loadOrders} /> : null}

      <ShowcasePanel
        eyebrow="Лаборатория"
        title="Заказы и результаты лаборатории в одном клиническом контуре"
        description="Врач создаёт заказ, отправляет его в демо-провайдер и быстро получает результат обратно в рабочее пространство визита."
        imageSrc="/assets/img/card-labs.svg"
        imageAlt="Лабораторные заказы"
        badges={[
          `${orders.length} заказов`,
          `${orders.filter((row) => row.status === 'received').length} результатов получено`,
          `${patients.length} пациентов доступно`,
        ]}
      />

      <section className="kpi-grid">
        <StatsCard label="Заказы" value={String(orders.length)} />
        <StatsCard label="Получены" value={String(orders.filter((row) => row.status === 'received').length)} />
        <StatsCard label="Отправлены" value={String(orders.filter((row) => row.status === 'sent').length)} />
        <StatsCard label="Созданы" value={String(orders.filter((row) => row.status === 'created').length)} />
      </section>

      <section className="grid-soft-2">
        <Card title="Создать лабораторный заказ">
          <form className="grid gap-3" onSubmit={createOrder}>
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
                  <option key={row.id} value={row.id}>
                    {row.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="label">ID визита (опционально)</span>
              <input
                className="input"
                value={form.visit_id}
                onChange={(event) => setForm((prev) => ({ ...prev, visit_id: event.target.value }))}
                placeholder="UUID визита"
              />
            </label>
            <button className="btn-primary" type="submit" disabled={creating}>
              {creating ? 'Создание...' : 'Создать заказ'}
            </button>
          </form>
        </Card>

        <Card title="Фильтр статуса">
          <div className="flex flex-wrap gap-2">
            {['all', 'created', 'sent', 'received', 'cancelled'].map((status) => (
              <button
                key={status}
                type="button"
                className={statusFilter === status ? 'btn-primary !px-3 !py-1.5' : 'btn-secondary !px-3 !py-1.5'}
                onClick={() => setStatusFilter(status)}
              >
                {status === 'all' ? 'Все' : status === 'created' ? 'Созданы' : status === 'sent' ? 'Отправлены' : status === 'received' ? 'Получены' : 'Отменены'}
              </button>
            ))}
          </div>
        </Card>
      </section>

      <section className="grid gap-4 2xl:grid-cols-2">
        {[
          {
            title: 'Перед отправкой',
            text: 'Проверьте, что пациент выбран правильно и заказ связан с нужным визитом, если разбор результата должен попасть прямо в приём.',
          },
          {
            title: 'После отправки',
            text: 'Список заказов нужен для контроля статусов и быстрого перехода к результату без отдельного лабораторного интерфейса.',
          },
          {
            title: 'После получения',
            text: 'Результат остаётся в рабочем контуре врача и может быть использован в заметках визита и объяснении владельцу.',
          },
        ].map((item) => (
          <Card key={item.title} title={item.title}>
            <p className="text-sm leading-7 text-lapka-700">{item.text}</p>
          </Card>
        ))}
      </section>

      <section className="grid gap-4 2xl:grid-cols-[1.08fr_0.92fr]">
        <Card title="Список заказов">
          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </div>
          ) : orders.length === 0 ? (
            <EmptyState title="Лабораторных заказов пока нет" text="Создайте первый лабораторный заказ." />
          ) : (
            <>
              <div className="space-y-3 xl:hidden">
                {orders.map((order) => (
                  <article key={order.id} className="rounded-2xl border border-lapka-200 bg-white p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="text-base font-bold text-lapka-900">{order.pet_name || `${order.pet_id.slice(0, 8)}...`}</h3>
                        <p className="mt-1 text-sm text-lapka-600">{order.id.slice(0, 8)}... · {new Date(order.ordered_at).toLocaleString('ru-RU')}</p>
                      </div>
                      <Badge tone={order.status === 'received' ? 'success' : order.status === 'created' ? 'info' : 'warning'}>
                        {order.status === 'received' ? 'Получен' : order.status === 'created' ? 'Создан' : order.status === 'sent' ? 'Отправлен' : order.status}
                      </Badge>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button className="btn-secondary !py-1 !px-3 text-xs" type="button" onClick={() => openOrder(order.id)}>
                        Открыть заказ
                      </button>
                      {order.status === 'created' ? (
                        <button
                          className="btn-secondary !py-1 !px-3 text-xs"
                          type="button"
                          disabled={actionLoading === order.id}
                          onClick={() => sendOrder(order.id)}
                        >
                          Отправить
                        </button>
                      ) : null}
                      {order.status !== 'received' ? (
                        <button
                          className="btn-primary !py-1 !px-3 text-xs"
                          type="button"
                          disabled={actionLoading === order.id}
                          onClick={() => importResult(order.id)}
                        >
                          Импортировать результат
                        </button>
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>
              <div className="hidden xl:block table-shell">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Пациент</th>
                      <th>Статус</th>
                      <th>Создан</th>
                      <th>Действия</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((order) => (
                      <tr key={order.id}>
                        <td>{order.id.slice(0, 8)}...</td>
                        <td>{order.pet_name || `${order.pet_id.slice(0, 8)}...`}</td>
                        <td>
                          <Badge tone={order.status === 'received' ? 'success' : order.status === 'created' ? 'info' : 'warning'}>
                            {order.status === 'received' ? 'Получен' : order.status === 'created' ? 'Создан' : order.status === 'sent' ? 'Отправлен' : order.status}
                          </Badge>
                        </td>
                        <td>{new Date(order.ordered_at).toLocaleString('ru-RU')}</td>
                        <td>
                          <div className="flex flex-wrap gap-2">
                            <button className="btn-secondary !py-1 !px-3 text-xs" type="button" onClick={() => openOrder(order.id)}>
                              Открыть заказ
                            </button>
                            {order.status === 'created' ? (
                              <button
                                className="btn-secondary !py-1 !px-3 text-xs"
                                type="button"
                                disabled={actionLoading === order.id}
                                onClick={() => sendOrder(order.id)}
                              >
                                Отправить
                              </button>
                            ) : null}
                            {order.status !== 'received' ? (
                              <button
                                className="btn-primary !py-1 !px-3 text-xs"
                                type="button"
                                disabled={actionLoading === order.id}
                                onClick={() => importResult(order.id)}
                              >
                                Импортировать результат
                              </button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </Card>

        <div className="space-y-4">
          <Card title="Пациент лабораторного заказа" subtitle="Короткая клиническая карточка без выхода из лабораторного контура">
            {!selectedPatient ? (
              <EmptyState title="Пациент не выбран" text="Выберите пациента при создании заказа или откройте существующий заказ." />
            ) : (
              <div className="grid gap-0 xl:grid-cols-[180px_minmax(0,1fr)]">
                <div className="overflow-hidden border-b border-lapka-200 bg-[radial-gradient(circle_at_top_left,rgba(92,166,237,0.24),transparent_38%),radial-gradient(circle_at_bottom_right,rgba(64,211,154,0.2),transparent_34%),linear-gradient(180deg,#fafdff_0%,#eef7ff_100%)] p-4 md:border-b-0 md:border-r">
                  <PetVisualGallery
                    pet={selectedPatient}
                    language="ru"
                    title="Фото пациента"
                    subtitle="Реальное фото, породный JPG и 3D-визуал в одном лабораторном контуре."
                    compact
                    className="border-0 bg-transparent p-0 shadow-none"
                    imageClassName="object-cover"
                  />
                </div>
                <div className="p-5">
                  <h3 className="text-[1.8rem] font-black tracking-tight text-lapka-900">{selectedPatient.name}</h3>
                  <p className="mt-2 text-base leading-7 text-lapka-700">
                    {localizePetSpecies(selectedPatient.species, 'ru')}
                    {selectedPatient.breed ? ` · ${selectedPatient.breed}` : ''}
                    {selectedPatient.weight_kg ? ` · ${selectedPatient.weight_kg} кг` : ''}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {selectedPatient.chip_id ? <span className="dense-chip">Чип: {selectedPatient.chip_id}</span> : null}
                    {selectedPatient.lapka_id ? <span className="dense-chip">Lapka ID: {selectedPatient.lapka_id}</span> : null}
                  </div>
                  <div className="mt-5 flex flex-wrap gap-2">
                    <Link href={`/vet/patient/${selectedPatient.id}`} className="btn-primary">
                      Открыть карточку пациента
                    </Link>
                    {selectedOrder?.visit_id ? (
                      <Link href={`/vet/visit/${selectedOrder.visit_id}`} className="btn-secondary">
                        Открыть визит
                      </Link>
                    ) : null}
                  </div>
                </div>
              </div>
            )}
          </Card>

          <Card title="Детали заказа" subtitle="Откройте заказ, чтобы увидеть импортированный результат и вложения.">
            {!selectedOrder ? (
              <EmptyState title="Заказ не выбран" text="Выберите заказ из списка, чтобы увидеть импортированные результаты." />
            ) : (
              <div className="space-y-3">
                <div className="rounded-xl border border-lapka-200 bg-lapka-50 px-3 py-2 text-sm text-lapka-700">
                  <p><span className="font-semibold">Заказ:</span> {selectedOrder.id}</p>
                  <p><span className="font-semibold">Статус:</span> {selectedOrder.status === 'received' ? 'Получен' : selectedOrder.status === 'sent' ? 'Отправлен' : selectedOrder.status === 'created' ? 'Создан' : selectedOrder.status}</p>
                  <p><span className="font-semibold">Внешняя ссылка:</span> {selectedOrder.external_ref || '—'}</p>
                </div>

                {selectedOrder.results?.length ? (
                  selectedOrder.results.map((result) => (
                    <article key={result.id} className="rounded-xl border border-lapka-200 bg-white p-3">
                      <p className="text-sm font-semibold text-lapka-900">{new Date(result.created_at).toLocaleString('ru-RU')}</p>
                      <p className="mt-1 text-sm text-lapka-700">{result.result_text}</p>
                      {result.attachments?.length ? (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {result.attachments.map((url) => (
                            <a key={url} className="btn-secondary !px-3 !py-1 text-xs" href={url} target="_blank" rel="noreferrer">
                              Вложение
                            </a>
                          ))}
                        </div>
                      ) : null}
                    </article>
                  ))
                ) : (
                  <EmptyState title="Результаты не импортированы" text="Нажмите «Импортировать результат», чтобы загрузить демонстрационный ответ лаборатории." />
                )}

                <div className="grid gap-3">
                  {[
                    'Результаты сохраняются в клиническом контуре врача и не теряются после завершения визита.',
                    'Объяснение для владельца должно оставаться безопасным: без назначения лечения и дозировок.',
                  ].map((item) => (
                    <div key={item} className="rounded-xl border border-lapka-200 bg-white px-4 py-3 text-sm leading-7 text-lapka-700">
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>
        </div>
      </section>
    </>
  );
}
