'use client';

import { useEffect, useMemo, useState } from 'react';
import Card from '@/components/ui/Card';
import EmptyState from '@/components/ui/EmptyState';
import ErrorBanner from '@/components/ui/ErrorBanner';
import Skeleton from '@/components/ui/Skeleton';
import Badge from '@/components/ui/Badge';
import SearchInput from '@/components/ui/SearchInput';
import { apiRequest } from '@/lib/api';
import { useClinicScope } from '@/lib/clinic-scope';
import { useSearchParams } from 'next/navigation';

function formatDateTimeRU(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function parseMaybeISO(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function statusForExpiration(expiresAt, now, warnDays) {
  const d = parseMaybeISO(expiresAt);
  if (!d) return { tone: 'info', label: 'Без срока' };
  if (d.getTime() < now.getTime()) return { tone: 'danger', label: 'Просрочено' };
  if (warnDays != null) {
    const ms = d.getTime() - now.getTime();
    const days = ms / (1000 * 60 * 60 * 24);
    if (days <= warnDays) return { tone: 'warning', label: `Срок до ${warnDays} дн.` };
  }
  return { tone: 'success', label: 'Ок' };
}

export default function ClinicPharmacyPage() {
  const { clinicId } = useClinicScope();
  const searchParams = useSearchParams();

  const [locations, setLocations] = useState([]);
  const [locationsLoading, setLocationsLoading] = useState(true);

  const [selectedLocationId, setSelectedLocationId] = useState('');
  const [q, setQ] = useState('');
  const [expiresMode, setExpiresMode] = useState('30'); // 'all' disables
  const [inStockMode, setInStockMode] = useState('any'); // any | true | false

  const [inventory, setInventory] = useState([]);
  const [inventoryLoading, setInventoryLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [editingId, setEditingId] = useState('');
  const [editInStock, setEditInStock] = useState(false);
  const [editExpiresLocal, setEditExpiresLocal] = useState(''); // YYYY-MM-DD
  const [editPriceText, setEditPriceText] = useState('');
  const [savingRow, setSavingRow] = useState(false);

  const expiresDays = useMemo(() => (expiresMode === 'all' ? null : Number(expiresMode)), [expiresMode]);
  const now = useMemo(() => new Date(), []);

  useEffect(() => {
    const within = searchParams?.get('expires_within_days');
    if (!within) return;
    if (within === 'all') {
      setExpiresMode('all');
      return;
    }
    // Keep dashboard links stable: only map common presets to the select options.
    if (within === '7' || within === '30' || within === '90') {
      setExpiresMode(within);
      return;
    }
    const n = Number(within);
    if (!Number.isFinite(n) || n <= 0) return;
    if (n <= 7) setExpiresMode('7');
    else if (n <= 30) setExpiresMode('30');
    else if (n <= 90) setExpiresMode('90');
  }, [searchParams]);

  async function loadLocations() {
    setLocationsLoading(true);
    setError('');
    try {
      const payload = await apiRequest(`/api/v1/clinic/pharmacy/locations?clinic_id=${encodeURIComponent(clinicId)}`);
      setLocations(Array.isArray(payload) ? payload : []);
      if (!selectedLocationId) {
        setSelectedLocationId(payload?.[0]?.id || '');
      }
    } catch (requestError) {
      setError(requestError.message || 'Не удалось загрузить локации аптеки');
      setLocations([]);
      setSelectedLocationId('');
    } finally {
      setLocationsLoading(false);
    }
  }

  async function loadInventory() {
    if (!clinicId) return;
    setInventoryLoading(true);
    setError('');
    try {
      const query = new URLSearchParams({ clinic_id: clinicId });
      if (selectedLocationId) query.set('location_id', selectedLocationId);
      if (q.trim()) query.set('q', q.trim());
      if (inStockMode !== 'any') query.set('in_stock', inStockMode);
      if (expiresDays != null) query.set('expires_within_days', String(expiresDays));

      const payload = await apiRequest(`/api/v1/clinic/pharmacy/inventory?${query.toString()}`);
      setInventory(Array.isArray(payload) ? payload : []);
    } catch (requestError) {
      setError(requestError.message || 'Не удалось загрузить склад');
      setInventory([]);
    } finally {
      setInventoryLoading(false);
    }
  }

  useEffect(() => {
    if (!clinicId) return;
    loadLocations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clinicId]);

  useEffect(() => {
    if (!clinicId) return;
    if (locationsLoading) return;
    const t = setTimeout(() => loadInventory(), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clinicId, selectedLocationId, expiresMode, inStockMode, q]);

  const filteredInventory = useMemo(() => {
    // server-side filtering already applied; keep only client highlight ordering.
    return inventory;
  }, [inventory]);

  const warnDays = expiresDays;

  function toLocalDateInputValue(value) {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    // Use UTC date component to keep stable value across timezones.
    return d.toISOString().slice(0, 10);
  }

  function startEdit(row) {
    setEditingId(row.id);
    setEditInStock(Boolean(row.in_stock));
    setEditExpiresLocal(toLocalDateInputValue(row.expires_at));
    setEditPriceText(String(row.price_text || ''));
    setError('');
    setSuccess('');
  }

  function cancelEdit() {
    setEditingId('');
    setSavingRow(false);
    setEditInStock(false);
    setEditExpiresLocal('');
    setEditPriceText('');
  }

  async function saveEdit() {
    if (!editingId) return;
    setSavingRow(true);
    setError('');
    setSuccess('');
    try {
      const expires_at = editExpiresLocal
        ? new Date(`${editExpiresLocal}T00:00:00.000Z`).toISOString()
        : null;

      await apiRequest(`/api/v1/clinic/pharmacy/inventory/${editingId}`, {
        method: 'PATCH',
        body: {
          in_stock: Boolean(editInStock),
          expires_at,
          price_text: editPriceText.trim() || '0',
        },
      });

      setSuccess('Остаток обновлён.');
      await loadInventory();
      cancelEdit();
    } catch (requestError) {
      setError(requestError.message || 'Не удалось обновить остаток');
    } finally {
      setSavingRow(false);
    }
  }

  return (
    <div className="space-y-5">
      <header className="page-header">
        <div>
          <h1 className="page-title">Склад и сроки годности</h1>
          <p className="page-subtitle">Смотрите наличие по локациям и выделяйте позиции, которые приближаются к сроку.</p>
        </div>
      </header>

      {error ? <ErrorBanner message={error} onRetry={loadInventory} /> : null}
      {success ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {success}
        </div>
      ) : null}

      <Card>
        <div className="grid gap-3 md:grid-cols-[1fr_240px] lg:grid-cols-[1fr_220px_240px_auto] lg:items-end">
          <label className="block">
            <span className="label">Локация</span>
            <select
              className="input"
              value={selectedLocationId}
              onChange={(e) => setSelectedLocationId(e.target.value)}
              disabled={locationsLoading || !locations.length}
            >
              {(locations || []).map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.pharmacy_name} · {loc.address}
                </option>
              ))}
            </select>
          </label>

          <SearchInput
            label="Поиск по препарату"
            placeholder="Например: амоксициллин"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />

          <label className="block">
            <span className="label">Срок</span>
            <select className="input" value={expiresMode} onChange={(e) => setExpiresMode(e.target.value)}>
              <option value="7">до 7 дней</option>
              <option value="30">до 30 дней</option>
              <option value="90">до 90 дней</option>
              <option value="all">все</option>
            </select>
          </label>

          <label className="block">
            <span className="label">Наличие</span>
            <select className="input" value={inStockMode} onChange={(e) => setInStockMode(e.target.value)}>
              <option value="any">любое</option>
              <option value="true">в наличии</option>
              <option value="false">нет на складе</option>
            </select>
          </label>

          <div className="hidden lg:block" />

          <button className="btn-primary" type="button" onClick={loadInventory} disabled={inventoryLoading}>
            Обновить
          </button>
        </div>
      </Card>

      <Card title="Остатки">
        {inventoryLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        ) : filteredInventory.length === 0 ? (
          <EmptyState title="Склад пуст" text="Попробуйте изменить фильтры или выберите другую локацию." />
        ) : (
          <div className="table-shell">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Препарат</th>
                  <th>Наличие</th>
                  <th>Срок</th>
                  <th>Цена</th>
                  <th>Обновлено</th>
                  <th>Действия</th>
                </tr>
              </thead>
              <tbody>
                {filteredInventory.map((row) => {
                  const exp = statusForExpiration(row.expires_at, now, warnDays);
                  return (
                    <tr key={row.id} className="hover:bg-lapka-50/70 transition">
                      <td>
                        <div className="min-w-[220px]">
                          <div className="font-bold text-lapka-900">{row.drug_name}</div>
                          {row.variant_text ? <div className="mt-1 text-sm text-lapka-600">{row.variant_text}</div> : null}
                        </div>
                      </td>
                      <td>
                        {row.in_stock ? <Badge tone="success">В наличии</Badge> : <Badge tone="warning">Нет на складе</Badge>}
                      </td>
                      <td>
                        <Badge tone={exp.tone}>{exp.label}</Badge>
                      </td>
                      <td>{row.price_text || '—'}</td>
                      <td>{formatDateTimeRU(row.updated_at)}</td>
                      <td className="whitespace-nowrap">
                        {editingId !== row.id ? (
                          <button
                            type="button"
                            className="btn-secondary !py-1 !px-3 text-xs"
                            onClick={() => startEdit(row)}
                            disabled={savingRow}
                          >
                            Редактировать
                          </button>
                        ) : (
                          <div className="flex flex-col gap-2 min-w-[260px]">
                            <div className="flex items-center gap-2">
                              <select
                                className="input !py-1 !px-2"
                                value={String(editInStock)}
                                onChange={(e) => setEditInStock(e.target.value === 'true')}
                                disabled={savingRow}
                              >
                                <option value="true">в наличии</option>
                                <option value="false">нет на складе</option>
                              </select>
                            </div>
                            <div className="flex items-center gap-2">
                              <input
                                className="input !py-1 !px-2"
                                type="date"
                                value={editExpiresLocal}
                                onChange={(e) => setEditExpiresLocal(e.target.value)}
                                disabled={savingRow}
                              />
                              <input
                                className="input !py-1 !px-2"
                                placeholder="Цена"
                                value={editPriceText}
                                onChange={(e) => setEditPriceText(e.target.value)}
                                disabled={savingRow}
                              />
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <button type="button" className="btn-primary !py-1 !px-3 text-xs" onClick={saveEdit} disabled={savingRow}>
                                Сохранить
                              </button>
                              <button type="button" className="btn-secondary !py-1 !px-3 text-xs" onClick={cancelEdit} disabled={savingRow}>
                                Отмена
                              </button>
                            </div>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

