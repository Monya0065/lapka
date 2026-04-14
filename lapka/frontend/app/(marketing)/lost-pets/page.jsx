'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import AppImage from '@/components/ui/AppImage';
import Card from '@/components/ui/Card';
import Skeleton from '@/components/ui/Skeleton';
import EmptyState from '@/components/ui/EmptyState';
import ErrorBanner from '@/components/ui/ErrorBanner';
import ShowcasePanel from '@/components/ui/ShowcasePanel';
import { apiRequest } from '@/lib/api';
import { getStoredSession } from '@/lib/auth';
import { resolvePetPhoto } from '@/lib/pets';

function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString('ru-RU');
}

export default function LostPetsPage() {
  const [reports, setReports] = useState([]);
  const [selectedReport, setSelectedReport] = useState(null);
  const [cityFilter, setCityFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [pets, setPets] = useState([]);
  const session = useMemo(() => getStoredSession(), []);
  const ownerMode = session?.role === 'owner';

  const [lostForm, setLostForm] = useState({
    pet_id: '',
    city: 'Санкт-Петербург',
    last_seen_location: '',
    last_seen_time: '',
    description: '',
    photo_url: '',
  });
  const [sightingForm, setSightingForm] = useState({
    reporter_name: '',
    reporter_contact: '',
    location_note: '',
    message: '',
  });

  const loadReports = useCallback(async (city = cityFilter) => {
    setLoading(true);
    setError('');
    try {
      const query = city?.trim() ? `?city=${encodeURIComponent(city.trim())}` : '';
      const payload = await apiRequest(`/api/v1/lost-pets${query}`, { auth: false });
      setReports(Array.isArray(payload) ? payload : []);
    } catch (requestError) {
      setError(requestError.message || 'Не удалось загрузить объявления о потерянных питомцах');
      setReports([]);
    } finally {
      setLoading(false);
    }
  }, [cityFilter]);

  const loadOwnerPets = useCallback(async () => {
    if (!ownerMode) return;
    try {
      const payload = await apiRequest('/api/v1/pets');
      const rows = Array.isArray(payload) ? payload : [];
      setPets(rows);
      if (rows[0] && !lostForm.pet_id) {
        setLostForm((prev) => ({ ...prev, pet_id: rows[0].id }));
      }
    } catch {
      setPets([]);
    }
  }, [lostForm.pet_id, ownerMode]);

  useEffect(() => {
    loadReports('');
    loadOwnerPets();
  }, [loadOwnerPets, loadReports]);

  async function openReport(id) {
    setLoadingDetail(true);
    setError('');
    try {
      const payload = ownerMode
        ? await apiRequest(`/api/v1/owner/lost-pets/${id}`)
        : await apiRequest(`/api/v1/lost-pets/${id}`, { auth: false });
      setSelectedReport(payload || null);
    } catch (requestError) {
      setError(requestError.message || 'Не удалось открыть карточку');
      setSelectedReport(null);
    } finally {
      setLoadingDetail(false);
    }
  }

  async function submitLostReport(event) {
    event.preventDefault();
    if (!ownerMode) return;
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await apiRequest('/api/v1/owner/lost-pets', {
        method: 'POST',
        body: {
          ...lostForm,
          last_seen_time: new Date(lostForm.last_seen_time).toISOString(),
          photo_url: lostForm.photo_url || null,
        },
      });
      setSuccess('Объявление опубликовано. Оно уже отображается на публичной странице.');
      setLostForm((prev) => ({
        ...prev,
        last_seen_location: '',
        last_seen_time: '',
        description: '',
        photo_url: '',
      }));
      await loadReports();
    } catch (requestError) {
      setError(requestError.message || 'Не удалось создать объявление');
    } finally {
      setSaving(false);
    }
  }

  async function submitSighting(event) {
    event.preventDefault();
    if (!selectedReport?.id) return;
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await apiRequest(`/api/v1/lost-pets/${selectedReport.id}/sightings`, {
        method: 'POST',
        auth: false,
        body: sightingForm,
      });
      setSuccess('Спасибо. Сообщение отправлено владельцу.');
      setSightingForm({ reporter_name: '', reporter_contact: '', location_note: '', message: '' });
      await openReport(selectedReport.id);
    } catch (requestError) {
      setError(requestError.message || 'Не удалось отправить сообщение');
    } finally {
      setSaving(false);
    }
  }

  async function copyShareLink(reportId) {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/lost-pets#${reportId}`);
      setSuccess('Ссылка на объявление скопирована.');
    } catch {
      setError('Не удалось скопировать ссылку.');
    }
  }

  return (
    <main className="page-wrap py-6">
      <section className="space-y-4">
        <header className="page-header">
          <div>
            <h1 className="page-title">Потерявшиеся питомцы</h1>
            <p className="page-subtitle">Публичный раздел поиска питомцев. Личные медданные не раскрываются.</p>
          </div>
          <button className="btn-secondary" type="button" onClick={() => loadReports(cityFilter)}>
            Обновить
          </button>
        </header>

        {error ? <ErrorBanner message={error} onRetry={() => loadReports(cityFilter)} /> : null}
        {success ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{success}</div>
        ) : null}

        <ShowcasePanel
          eyebrow="Публичный поиск"
          title="Поиск потерявшегося питомца без раскрытия медкарты"
          description="Объявление показывает только безопасные публичные данные, а связь с владельцем идёт через защищённое сообщение. Так интерфейс остаётся понятным для людей и безопасным для владельца."
          imageSrc="/assets/img/owner-banner.svg"
          imageAlt="Публичный поиск потерявшегося питомца"
          badges={[
            `${reports.length} объявлений`,
            ownerMode ? 'Можно добавить объявление' : 'Просмотр открыт всем',
            'Безопасные публичные данные',
          ]}
        />

        <section className="grid gap-4 xl:grid-cols-[248px_minmax(0,1fr)] 2xl:grid-cols-[248px_minmax(0,1fr)_360px]">
          <aside className="space-y-4 xl:sticky xl:top-[96px] xl:self-start">
            <Card title="Навигация" subtitle="Быстрые переходы по публичным сервисам">
              <div className="grid gap-2">
                <Link href="/" className="sidebar-link">← На главную</Link>
                <Link href="/owner/map" className="sidebar-link">Карта рядом</Link>
                <Link href="/owner/passport-center" className="sidebar-link">QR-паспорт</Link>
                <Link href="/owner/dashboard" className="sidebar-link">Кабинет владельца</Link>
              </div>
            </Card>
            <Card title="Что доступно здесь" subtitle="Только безопасные публичные данные">
              <ul className="space-y-2 text-sm text-lapka-700">
                <li>• Объявления о пропаже</li>
                <li>• Фото и приметы питомца</li>
                <li>• Связь с владельцем без раскрытия медкарты</li>
              </ul>
            </Card>
          </aside>

          <div className="space-y-4">
            <Card title="Поиск" subtitle="Фильтр по городу и карта-заглушка">
              <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
                <label className="block">
                  <span className="label">Город</span>
                  <input
                    className="input"
                    value={cityFilter}
                    onChange={(event) => setCityFilter(event.target.value)}
                    placeholder="Санкт-Петербург"
                  />
                </label>
                <button className="btn-primary" type="button" onClick={() => loadReports(cityFilter)}>
                  Применить
                </button>
              </div>

              <div className="mt-4 rounded-3xl border border-lapka-200 bg-lapka-gradient-soft p-4">
                <div className="grid grid-cols-2 gap-2 text-xs text-lapka-700 md:grid-cols-4">
                  <div className="rounded-xl bg-white/80 px-3 py-2">Пин-карта</div>
                  <div className="rounded-xl bg-white/80 px-3 py-2">Фото-first карточки</div>
                  <div className="rounded-xl bg-white/80 px-3 py-2">Связь с владельцем</div>
                  <div className="rounded-xl bg-white/80 px-3 py-2">Только безопасные публичные данные</div>
                </div>
              </div>
            </Card>

            {loading ? (
              <div className="space-y-3">
                <Skeleton className="h-56 w-full" />
                <Skeleton className="h-56 w-full" />
              </div>
            ) : reports.length ? (
              <div className="grid gap-4 md:grid-cols-2">
                {reports.map((report) => (
                  <article
                    key={report.id}
                    className="group rounded-3xl border border-lapka-200 bg-white p-3 shadow-card transition hover:-translate-y-0.5 hover:shadow-float"
                  >
                    <AppImage
                      src={resolvePetPhoto({ photo_url: report.photo_url, species: report.species, breed: report.breed })}
                      alt={report.pet_name}
                      width={880}
                      height={660}
                      sizes="(max-width: 768px) 100vw, 420px"
                      className="h-44 w-full rounded-2xl object-cover"
                    />
                    <div className="mt-3 space-y-1">
                      <p className="text-xl font-black text-lapka-900">{report.pet_name}</p>
                      <p className="text-sm text-lapka-600">{report.species} · {report.breed || '—'}</p>
                      <p className="text-sm text-lapka-700">Город: {report.city}</p>
                      <p className="text-sm text-lapka-700">Последний раз: {report.last_seen_location}</p>
                      <p className="text-xs text-lapka-500">{formatDate(report.last_seen_time)}</p>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button className="btn-primary" type="button" onClick={() => openReport(report.id)}>
                        Карточка
                      </button>
                      <button className="btn-secondary" type="button" onClick={() => copyShareLink(report.id)}>
                        Поделиться
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState title="Объявлений не найдено" text="Попробуйте изменить город или обновить страницу позже." />
            )}
          </div>

          <aside className="space-y-4">
            {ownerMode ? (
              <Card title="Сообщить о пропаже" subtitle="Форма владельца для публикации объявления">
                <form className="space-y-3" onSubmit={submitLostReport}>
                  <label className="block">
                    <span className="label">Питомец</span>
                    <select
                      className="input"
                      value={lostForm.pet_id}
                      onChange={(event) => setLostForm((prev) => ({ ...prev, pet_id: event.target.value }))}
                    >
                      {pets.length ? (
                        pets.map((pet) => (
                          <option key={pet.id} value={pet.id}>
                            {pet.name} · {pet.species}
                          </option>
                        ))
                      ) : (
                        <option value="">Нет доступных питомцев</option>
                      )}
                    </select>
                  </label>

                  <label className="block">
                    <span className="label">Город</span>
                    <input
                      className="input"
                      value={lostForm.city}
                      onChange={(event) => setLostForm((prev) => ({ ...prev, city: event.target.value }))}
                    />
                  </label>

                  <label className="block">
                    <span className="label">Последнее место</span>
                    <input
                      className="input"
                      value={lostForm.last_seen_location}
                      onChange={(event) => setLostForm((prev) => ({ ...prev, last_seen_location: event.target.value }))}
                      required
                    />
                  </label>

                  <label className="block">
                    <span className="label">Время</span>
                    <input
                      className="input"
                      type="datetime-local"
                      value={lostForm.last_seen_time}
                      onChange={(event) => setLostForm((prev) => ({ ...prev, last_seen_time: event.target.value }))}
                      required
                    />
                  </label>

                  <label className="block">
                    <span className="label">Описание</span>
                    <textarea
                      className="input min-h-[100px] resize-y"
                      value={lostForm.description}
                      onChange={(event) => setLostForm((prev) => ({ ...prev, description: event.target.value }))}
                      required
                    />
                  </label>

                  <label className="block">
                    <span className="label">Фото URL (опционально)</span>
                    <input
                      className="input"
                      value={lostForm.photo_url}
                      onChange={(event) => setLostForm((prev) => ({ ...prev, photo_url: event.target.value }))}
                      placeholder="https://..."
                    />
                  </label>

                  <button className="btn-primary w-full" disabled={saving} type="submit">
                    {saving ? 'Публикуем...' : 'Опубликовать объявление'}
                  </button>
                </form>
              </Card>
            ) : (
              <Card title="Для владельцев" subtitle="Войдите как owner, чтобы создать объявление">
                <p className="text-sm text-lapka-700">
                  Публичная страница доступна всем, но добавление объявления о пропаже доступно только владельцу питомца.
                </p>
              </Card>
            )}

            <Card title="Карточка объявления" subtitle="Контакт с владельцем через безопасное сообщение">
              {loadingDetail ? (
                <div className="space-y-2">
                  <Skeleton className="h-24 w-full" />
                  <Skeleton className="h-24 w-full" />
                </div>
              ) : selectedReport ? (
                <>
                  <div className="rounded-2xl border border-lapka-200 bg-lapka-50 px-3 py-2 text-sm text-lapka-700">
                    <p className="font-semibold text-lapka-900">{selectedReport.pet_name}</p>
                    <p>{selectedReport.description}</p>
                  </div>

                  <form className="mt-3 space-y-2" onSubmit={submitSighting}>
                    <input
                      className="input"
                      value={sightingForm.reporter_name}
                      onChange={(event) => setSightingForm((prev) => ({ ...prev, reporter_name: event.target.value }))}
                      placeholder="Ваше имя"
                    />
                    <input
                      className="input"
                      value={sightingForm.reporter_contact}
                      onChange={(event) => setSightingForm((prev) => ({ ...prev, reporter_contact: event.target.value }))}
                      placeholder="Телефон/email для обратной связи"
                    />
                    <input
                      className="input"
                      value={sightingForm.location_note}
                      onChange={(event) => setSightingForm((prev) => ({ ...prev, location_note: event.target.value }))}
                      placeholder="Где видели питомца"
                    />
                    <textarea
                      className="input min-h-[88px] resize-y"
                      value={sightingForm.message}
                      onChange={(event) => setSightingForm((prev) => ({ ...prev, message: event.target.value }))}
                      placeholder="Сообщение владельцу"
                      required
                    />
                    <button className="btn-primary w-full" type="submit" disabled={saving}>
                      {saving ? 'Отправляем...' : 'Отправить владельцу'}
                    </button>
                  </form>

                  {selectedReport.sightings?.length ? (
                    <div className="mt-3 space-y-2">
                      {selectedReport.sightings.slice(0, 4).map((item) => (
                        <div key={item.id} className="rounded-xl border border-lapka-200 bg-white px-3 py-2 text-xs text-lapka-700">
                          <p className="font-semibold">{item.reporter_name || 'Аноним'}</p>
                          {ownerMode ? (
                            <>
                              <p>{item.message || 'Сообщение скрыто'}</p>
                              {item.reporter_contact_masked ? (
                                <p className="mt-1 text-[11px] text-lapka-500">Контакт (privacy-safe): {item.reporter_contact_masked}</p>
                              ) : null}
                            </>
                          ) : (
                            <p className="text-lapka-600">Публичный сигнал получен. Полный текст виден только владельцу.</p>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </>
              ) : (
                <EmptyState title="Выберите объявление" text="Откройте карточку питомца, чтобы отправить сообщение владельцу." />
              )}
            </Card>
          </aside>
        </section>
      </section>
    </main>
  );
}
