'use client';

import { useEffect, useMemo, useState } from 'react';
import Card from '@/components/ui/Card';
import Skeleton from '@/components/ui/Skeleton';
import EmptyState from '@/components/ui/EmptyState';
import ErrorBanner from '@/components/ui/ErrorBanner';
import StatsCard from '@/components/ui/StatsCard';
import Badge from '@/components/ui/Badge';
import { apiRequest } from '@/lib/api';

const CATEGORIES = [
  { id: 'all', label: 'Все категории' },
  { id: 'consultation', label: 'Консультации' },
  { id: 'vaccination', label: 'Вакцинации' },
  { id: 'imaging', label: 'Визуализация' },
  { id: 'lab', label: 'Лаборатория' },
  { id: 'surgery', label: 'Хирургия' },
  { id: 'inpatient', label: 'Стационар' },
  { id: 'telemedicine', label: 'Телемедицина' },
  { id: 'other', label: 'Прочее' },
];

const DEFAULT_FORM = {
  name: '',
  category: 'consultation',
  price_cents: 0,
  currency: 'RUB',
  duration_minutes: 30,
  is_active: true,
};

function localizeCategory(value) {
  const map = {
    consultation: 'Консультации',
    vaccination: 'Вакцинации',
    imaging: 'Визуализация',
    lab: 'Лаборатория',
    surgery: 'Хирургия',
    inpatient: 'Стационар',
    telemedicine: 'Телемедицина',
    other: 'Прочее',
  };
  return map[String(value || '').trim().toLowerCase()] || value || '—';
}

function formatMoney(cents, currency = 'RUB') {
  return `${(Number(cents || 0) / 100).toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
}

export default function ClinicServicesPage() {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [updatingId, setUpdatingId] = useState('');

  async function loadServices() {
    setLoading(true);
    setError('');
    try {
      const payload = await apiRequest('/api/v1/clinic/services?include_inactive=true');
      setServices(Array.isArray(payload) ? payload : []);
    } catch (requestError) {
      setError(requestError.message || 'Не удалось загрузить услуги клиники');
      setServices([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadServices();
  }, []);

  const filteredServices = useMemo(() => {
    if (activeCategory === 'all') return services;
    return services.filter((row) => row.category === activeCategory);
  }, [activeCategory, services]);

  const activeCount = useMemo(() => services.filter((row) => row.is_active).length, [services]);
  const avgPrice = useMemo(() => {
    if (!services.length) return 0;
    return Math.round(services.reduce((acc, row) => acc + Number(row.price_cents || 0), 0) / services.length);
  }, [services]);

  async function handleCreateService(event) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await apiRequest('/api/v1/clinic/services', {
        method: 'POST',
        body: {
          ...form,
          name: form.name.trim(),
          price_cents: Number(form.price_cents || 0),
          duration_minutes: Number(form.duration_minutes || 30),
        },
      });
      setModalOpen(false);
      setForm(DEFAULT_FORM);
      await loadServices();
    } catch (requestError) {
      setError(requestError.message || 'Не удалось создать услугу');
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleServiceActive(row) {
    setUpdatingId(row.id);
    setError('');
    try {
      await apiRequest(`/api/v1/clinic/services/${row.id}`, {
        method: 'PATCH',
        body: { is_active: !row.is_active },
      });
      await loadServices();
    } catch (requestError) {
      setError(requestError.message || 'Не удалось обновить услугу');
    } finally {
      setUpdatingId('');
    }
  }

  return (
    <>
      <header className="page-header">
        <div>
          <h1 className="page-title">Каталог услуг клиники</h1>
          <p className="page-subtitle">Единый прайс, длительность и категории для записи, счетов и аналитики.</p>
        </div>
        <button className="btn-primary" type="button" onClick={() => setModalOpen(true)}>
          Добавить услугу
        </button>
      </header>

      {error ? <ErrorBanner message={error} onRetry={loadServices} /> : null}

      <section className="kpi-grid">
        <StatsCard label="Всего услуг" value={String(services.length)} />
        <StatsCard label="Активные услуги" value={String(activeCount)} />
        <StatsCard label="Категорий" value={String(CATEGORIES.length - 1)} />
        <StatsCard label="Средний чек услуги" value={formatMoney(avgPrice)} />
      </section>

      <Card title="Категории">
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((category) => (
            <button
              key={category.id}
              type="button"
              className={activeCategory === category.id ? 'btn-primary !py-1.5 !px-3' : 'btn-secondary !py-1.5 !px-3'}
              onClick={() => setActiveCategory(category.id)}
            >
              {category.label}
            </button>
          ))}
        </div>
      </Card>

      <Card title="Справочник услуг" subtitle="Управление доступностью и параметрами услуг">
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        ) : filteredServices.length === 0 ? (
          <EmptyState
            title="Каталог пуст"
            text="Добавьте первую услугу, чтобы стандартизировать прайс и длительность приёма."
            action={
              <button className="btn-primary" type="button" onClick={() => setModalOpen(true)}>
                Добавить услугу
              </button>
            }
          />
        ) : (
          <div className="table-shell">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Название</th>
                  <th>Категория</th>
                  <th>Цена</th>
                  <th>Длительность</th>
                  <th>Статус</th>
                  <th>Действия</th>
                </tr>
              </thead>
              <tbody>
                {filteredServices.map((row) => (
                  <tr key={row.id} className="hover:bg-lapka-50/70 transition">
                    <td>{row.name}</td>
                    <td>{localizeCategory(row.category)}</td>
                    <td>{formatMoney(row.price_cents, row.currency)}</td>
                    <td>{row.duration_minutes} мин</td>
                    <td>{row.is_active ? <Badge tone="success">Активна</Badge> : <Badge tone="warning">Скрыта</Badge>}</td>
                    <td>
                      <button
                        className="btn-secondary !py-1 !px-3 text-xs"
                        type="button"
                        disabled={updatingId === row.id}
                        onClick={() => toggleServiceActive(row)}
                      >
                        {row.is_active ? 'Скрыть' : 'Активировать'}
                      </button>
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
          <form className="surface-card w-full max-w-2xl p-5 md:p-6" onSubmit={handleCreateService}>
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-2xl font-bold text-lapka-900">Добавить услугу</h2>
                <p className="text-sm text-lapka-600">Сразу появится в записи, счетах и аналитике клиники.</p>
              </div>
              <button className="btn-secondary" type="button" onClick={() => setModalOpen(false)}>
                Закрыть
              </button>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="block md:col-span-2">
                <span className="label">Название</span>
                <input
                  className="input"
                  value={form.name}
                  onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                  placeholder="Например, Консультация дерматолога"
                  required
                />
              </label>

              <label className="block">
                <span className="label">Категория</span>
                <select
                  className="input"
                  value={form.category}
                  onChange={(event) => setForm((prev) => ({ ...prev, category: event.target.value }))}
                >
                  {CATEGORIES.filter((row) => row.id !== 'all').map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="label">Цена (копейки)</span>
                <input
                  type="number"
                  min="0"
                  className="input"
                  value={form.price_cents}
                  onChange={(event) => setForm((prev) => ({ ...prev, price_cents: event.target.value }))}
                  required
                />
              </label>

              <label className="block">
                <span className="label">Длительность (мин)</span>
                <input
                  type="number"
                  min="5"
                  max="360"
                  className="input"
                  value={form.duration_minutes}
                  onChange={(event) => setForm((prev) => ({ ...prev, duration_minutes: event.target.value }))}
                  required
                />
              </label>

              <label className="block">
                <span className="label">Валюта</span>
                <input
                  className="input"
                  value={form.currency}
                  onChange={(event) => setForm((prev) => ({ ...prev, currency: event.target.value.toUpperCase() }))}
                  maxLength={8}
                />
              </label>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button className="btn-secondary" type="button" onClick={() => setModalOpen(false)}>
                Отмена
              </button>
              <button className="btn-primary" type="submit" disabled={submitting}>
                {submitting ? 'Сохраняем...' : 'Сохранить услугу'}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
}
