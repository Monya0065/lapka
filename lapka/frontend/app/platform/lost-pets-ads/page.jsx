'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import Card from '@/components/ui/Card';
import Skeleton from '@/components/ui/Skeleton';
import ErrorBanner from '@/components/ui/ErrorBanner';
import { apiRequest } from '@/lib/api';

function money(cents) {
  return `${(Number(cents || 0) / 100).toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₽`;
}

export default function PlatformLostPetsAdsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [summary, setSummary] = useState(null);
  const [entries, setEntries] = useState([]);
  const [allocateForm, setAllocateForm] = useState({
    allocation_percent: 70,
    payment_id: '',
    note: '',
  });
  const [spendForm, setSpendForm] = useState({
    amount_cents: '',
    external_ref: '',
    note: '',
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [summaryPayload, entriesPayload] = await Promise.all([
        apiRequest('/api/v1/admin/lost-pets/ads-budget/summary'),
        apiRequest('/api/v1/admin/lost-pets/ads-budget/entries?limit=150'),
      ]);
      setSummary(summaryPayload || null);
      setEntries(Array.isArray(entriesPayload) ? entriesPayload : []);
    } catch (requestError) {
      setError(requestError.message || 'Не удалось загрузить бюджет рекламы потеряшек');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function submitAllocate(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await apiRequest('/api/v1/admin/lost-pets/ads-budget/allocate', {
        method: 'POST',
        body: {
          allocation_percent: Number(allocateForm.allocation_percent || 70),
          payment_id: allocateForm.payment_id.trim() || null,
          note: allocateForm.note.trim() || null,
        },
      });
      setSuccess('Аллокация в рекламный пул проведена.');
      setAllocateForm((prev) => ({ ...prev, payment_id: '', note: '' }));
      await loadData();
    } catch (requestError) {
      setError(requestError.message || 'Не удалось выполнить аллокацию');
    } finally {
      setSaving(false);
    }
  }

  async function submitSpend(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await apiRequest('/api/v1/admin/lost-pets/ads-budget/spend', {
        method: 'POST',
        body: {
          amount_cents: Number(spendForm.amount_cents || 0),
          external_ref: spendForm.external_ref.trim(),
          note: spendForm.note.trim() || null,
        },
      });
      setSuccess('Расход из рекламного пула зафиксирован.');
      setSpendForm({ amount_cents: '', external_ref: '', note: '' });
      await loadData();
    } catch (requestError) {
      setError(requestError.message || 'Не удалось зафиксировать расход');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-amber-500/14 via-surface-muted to-orange-500/12 p-5 shadow-card md:p-8">
        <div className="relative grid gap-6 lg:grid-cols-[1.05fr_1fr] lg:items-start">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-theme-muted">Monetization ops</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-theme md:text-4xl">Бюджет рекламы потеряшек</h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-theme-muted md:text-base">
              Доходы от платного продвижения объявлений отдельно учитываются и распределяются в рекламный пул. Контур учитывает маркировку
              рекламы и юридические требования.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Link href="/platform/dashboard" className="btn-secondary">Назад в обзор платформы</Link>
              <Link href="/platform/legal" className="btn-secondary">Юридический контур</Link>
            </div>
          </div>
          {loading ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-24 w-full rounded-2xl" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {[
                { label: 'Выручка продвижения', value: money(summary?.total_promotion_revenue_cents) },
                { label: 'Аллоцировано в пул', value: money(summary?.allocated_to_ads_pool_cents), tone: 'text-sky-700 dark:text-sky-300' },
                { label: 'Потрачено из пула', value: money(summary?.spent_from_ads_pool_cents), tone: 'text-rose-700 dark:text-rose-300' },
                { label: 'Доступный баланс', value: money(summary?.available_ads_pool_cents), tone: 'text-emerald-700 dark:text-emerald-300' },
                { label: 'Маркировка рекламы', value: summary?.ad_label_required ? 'Обязательна' : '—', tone: 'text-amber-700 dark:text-amber-300' },
                { label: 'Валюта', value: summary?.currency || 'RUB' },
              ].map((cell) => (
                <div key={cell.label} className="rounded-2xl border border-border bg-surface/90 px-3 py-4 shadow-sm">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-theme-muted">{cell.label}</p>
                  <p className={`mt-1 text-lg font-black tabular-nums ${cell.tone || 'text-theme'}`}>{cell.value}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {error ? <ErrorBanner message={error} onRetry={loadData} /> : null}
      {success ? <div className="callout-success">{success}</div> : null}

      <section className="grid gap-4 xl:grid-cols-2">
        <Card title="Аллокация в рекламный пул" subtitle="Перенос доли дохода от платных объявлений в budget pool">
          <form className="space-y-3" onSubmit={submitAllocate}>
            <label className="block">
              <span className="label">Процент аллокации</span>
              <input
                className="input"
                type="number"
                min={1}
                max={100}
                value={allocateForm.allocation_percent}
                onChange={(event) => setAllocateForm((prev) => ({ ...prev, allocation_percent: event.target.value }))}
              />
            </label>
            <label className="block">
              <span className="label">ID платежа (опционально)</span>
              <input
                className="input"
                value={allocateForm.payment_id}
                onChange={(event) => setAllocateForm((prev) => ({ ...prev, payment_id: event.target.value }))}
                placeholder="Если пусто — аллокация по всем новым платежам"
              />
            </label>
            <label className="block">
              <span className="label">Примечание</span>
              <textarea
                className="input min-h-[84px] resize-y"
                value={allocateForm.note}
                onChange={(event) => setAllocateForm((prev) => ({ ...prev, note: event.target.value }))}
              />
            </label>
            <button className="btn-primary w-full" type="submit" disabled={saving}>
              {saving ? 'Проводим...' : 'Аллоцировать в ads pool'}
            </button>
          </form>
        </Card>

        <Card title="Расход на рекламные кампании" subtitle="Фиксация расходов из ads pool (например, Яндекс.Директ)">
          <form className="space-y-3" onSubmit={submitSpend}>
            <label className="block">
              <span className="label">Сумма, коп.</span>
              <input
                className="input"
                type="number"
                min={1}
                value={spendForm.amount_cents}
                onChange={(event) => setSpendForm((prev) => ({ ...prev, amount_cents: event.target.value }))}
                required
              />
            </label>
            <label className="block">
              <span className="label">Внешний референс</span>
              <input
                className="input"
                value={spendForm.external_ref}
                onChange={(event) => setSpendForm((prev) => ({ ...prev, external_ref: event.target.value }))}
                placeholder="direct-campaign-..."
                required
              />
            </label>
            <label className="block">
              <span className="label">Примечание</span>
              <textarea
                className="input min-h-[84px] resize-y"
                value={spendForm.note}
                onChange={(event) => setSpendForm((prev) => ({ ...prev, note: event.target.value }))}
              />
            </label>
            <button className="btn-primary w-full" type="submit" disabled={saving}>
              {saving ? 'Фиксируем...' : 'Списать из ads pool'}
            </button>
          </form>
        </Card>
      </section>

      <Card title="Проводки рекламного пула" subtitle="Прозрачный журнал аллокаций и расходов">
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : entries.length ? (
          <div className="max-h-[420px] space-y-2 overflow-auto">
            {entries.map((entry) => (
              <div key={entry.id} className="rounded-2xl border border-border bg-surface-muted/70 px-3 py-2 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold text-theme">{entry.entry_type}</span>
                  <span className="font-black tabular-nums text-theme">{money(entry.amount_cents)}</span>
                </div>
                <p className="mt-1 text-xs text-theme-muted">
                  {entry.external_ref || entry.source_payment_id || 'manual'} · {new Date(entry.created_at).toLocaleString('ru-RU')}
                </p>
                {entry.note ? <p className="mt-1 text-xs text-theme">{entry.note}</p> : null}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-theme-muted">Пока нет проводок в рекламном пуле.</p>
        )}
      </Card>
    </div>
  );
}
