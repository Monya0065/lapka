'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import AppImage from '@/components/ui/AppImage';
import Card from '@/components/ui/Card';
import EmptyState from '@/components/ui/EmptyState';
import ErrorBanner from '@/components/ui/ErrorBanner';
import SearchInput from '@/components/ui/SearchInput';
import Skeleton from '@/components/ui/Skeleton';
import StatsCard from '@/components/ui/StatsCard';
import ShowcasePanel from '@/components/ui/ShowcasePanel';
import PetVisualGallery from '@/components/ui/PetVisualGallery';
import { apiRequest } from '@/lib/api';
import { useClinicScope } from '@/lib/clinic-scope';
import { localizeAccessScope } from '@/lib/access';
import { localizePetBreed, localizePetSpecies, resolvePetPhoto } from '@/lib/pets';

const MODES = [
  { value: 'name', label: 'Имя питомца' },
  { value: 'owner_phone', label: 'Телефон владельца' },
  { value: 'owner_email', label: 'Эл. почта владельца' },
  { value: 'chip_id', label: 'ID чипа' },
  { value: 'lapka_id', label: 'Lapka ID' },
];

export default function ClinicPatientsPage() {
  const { clinicId, selectedClinic } = useClinicScope();
  const [vetId, setVetId] = useState('');
  const [vets, setVets] = useState([]);

  const [mode, setMode] = useState('name');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);

  const [qrToken, setQrToken] = useState('');
  const [checkin, setCheckin] = useState(null);

  const [loadingMeta, setLoadingMeta] = useState(true);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [requestingId, setRequestingId] = useState('');
  const [creatingDraft, setCreatingDraft] = useState(false);

  const maskedCount = useMemo(
    () => results.filter((row) => row.consent_status === 'none').length,
    [results]
  );

  const featuredResult = useMemo(
    () => results.find((row) => row.consent_status !== 'none') || results[0] || null,
    [results]
  );

  useEffect(() => {
    let cancelled = false;
    async function loadMeta() {
      if (!clinicId) return;
      setLoadingMeta(true);
      setError('');
      try {
        const clinicPayload = await apiRequest(`/api/v1/clinics/me?clinic_id=${encodeURIComponent(clinicId)}`);
        if (cancelled) return;
        const resolvedClinicId = clinicPayload?.id || clinicId;

        const vetsPayload = await apiRequest(`/api/v1/clinics/${resolvedClinicId}/vets`);
        if (cancelled) return;
        const rows = Array.isArray(vetsPayload) ? vetsPayload : [];
        setVets(rows);
        if (rows.length) {
          setVetId(rows[0].id);
        }
      } catch (requestError) {
        if (!cancelled) {
          setError(requestError.message || 'Не удалось загрузить данные клиники');
        }
      } finally {
        if (!cancelled) {
          setLoadingMeta(false);
        }
      }
    }

    loadMeta();
    return () => {
      cancelled = true;
    };
  }, [clinicId]);

  async function runSearch() {
    const q = query.trim();
    if (!q) {
      setResults([]);
      return;
    }
    setLoadingSearch(true);
    setError('');
    setSuccess('');
    try {
      const payload = await apiRequest(
        `/api/v1/clinic/search/patients?mode=${encodeURIComponent(mode)}&q=${encodeURIComponent(q)}&clinic_id=${encodeURIComponent(clinicId)}&limit=50`
      );
      setResults(Array.isArray(payload) ? payload : []);
    } catch (requestError) {
      setError(requestError.message || 'Поиск не выполнен');
      setResults([]);
    } finally {
      setLoadingSearch(false);
    }
  }

  async function requestConsent(row) {
    setRequestingId(row.pet_id);
    setError('');
    setSuccess('');
    try {
      const payload = await apiRequest('/api/v1/consent-requests', {
        method: 'POST',
        body: {
          master_pet_id: row.pet_id,
          clinic_id: clinicId,
          requested_scope: 'BASIC_MEDICAL',
          message: 'Запрос доступа к медкарте для регистрации и приёма.',
        },
      });
      setSuccess(`Запрос отправлен владельцу (ID: ${payload.id}).`);
    } catch (requestError) {
      setError(requestError.message || 'Не удалось отправить запрос доступа');
    } finally {
      setRequestingId('');
    }
  }

  async function runQrCheckin() {
    const token = qrToken.trim();
    if (!token) return;
    setError('');
    setSuccess('');
    try {
      const payload = await apiRequest('/api/v1/clinic/checkin/qr', {
        method: 'POST',
        body: { token, clinic_id: clinicId },
      });
      setCheckin(payload);
      setSuccess('QR-регистрация выполнена. Доступ к медкарте зависит от подтверждённого доступа.');
    } catch (requestError) {
      setCheckin(null);
      setError(requestError.message || 'QR-токен невалиден');
    }
  }

  async function createDraftFromCheckin() {
    if (!checkin?.pet?.pet_id) return;
    if (!vetId) {
      setError('Выберите врача для записи.');
      return;
    }

    setCreatingDraft(true);
    setError('');
    setSuccess('');
    try {
      const scheduledAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
      const body = {
        clinic_id: clinicId,
        pet_id: checkin.pet.pet_id,
        vet_id: vetId,
        service_type: 'Консультация',
        scheduled_at: scheduledAt,
        status: 'new',
        notes: 'Черновик записи после QR-регистрации.',
      };
      if (checkin.owner_user_id) {
        body.owner_user_id = checkin.owner_user_id;
      }
      const payload = await apiRequest('/api/v1/appointments', { method: 'POST', body });
      setSuccess(`Черновик записи создан: ${payload.id}`);
    } catch (requestError) {
      setError(requestError.message || 'Не удалось создать черновик записи');
    } finally {
      setCreatingDraft(false);
    }
  }

  return (
    <div className="space-y-7">
      <header className="page-header">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-lapka-500">Пациенты</p>
          <h1 className="page-title">Поиск пациента, QR и доступ к карте</h1>
          <p className="page-subtitle">Ресепшн и администратор работают в одном экране: поиск, безопасное сокрытие данных, QR-регистрация и создание черновика визита.</p>
        </div>
      </header>

      {error ? <ErrorBanner message={error} onRetry={runSearch} /> : null}
      {success ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{success}</div>
      ) : null}

      {loadingMeta ? (
        <Skeleton className="h-36 w-full" />
      ) : (
        <>
          <ShowcasePanel
            eyebrow="Поиск пациентов"
            title="Продвинутый поиск по идентификаторам, QR и уровням доступа"
            description="Ресепшн и администратор клиники быстро находят пациента по имени, телефону, чипу или Lapka ID, не раскрывая лишние персональные данные до подтверждения доступа."
            imageSrc="/assets/img/admin-side.svg"
            imageAlt="Поиск пациентов клиники"
            badges={[
              `${results.length} найдено`,
              `${maskedCount} скрыто`,
              `${results.length - maskedCount} с доступом`,
            ]}
          />

        <section className="grid items-start gap-5 2xl:grid-cols-[1.08fr_0.92fr]">
          <Card title="Поиск пациентов" subtitle="Один вход для ресепшн и администратора: идентификаторы, контакты владельца и Lapka ID.">
            <div className="grid gap-3 md:grid-cols-[220px_minmax(0,1fr)_auto] md:items-end">
              <label className="block">
                <span className="label">Режим поиска</span>
                <select className="input" value={mode} onChange={(event) => setMode(event.target.value)}>
                  {MODES.map((item) => (
                    <option key={item.value} value={item.value}>{item.label}</option>
                  ))}
                </select>
              </label>

              <SearchInput
                label="Запрос"
                placeholder="Например: BARSIK-CHIP-001 или owner@lapka.local"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    runSearch();
                  }
                }}
              />

              <button className="btn-primary" type="button" onClick={runSearch}>
                Найти
              </button>
            </div>

            <section className="kpi-grid mt-4">
              <StatsCard label="Найдено" value={String(results.length)} />
              <StatsCard label="Скрыто" value={String(maskedCount)} />
              <StatsCard label="С доступом" value={String(results.length - maskedCount)} />
              <StatsCard label="Клиника" value={selectedClinic?.name || 'Клиника'} />
            </section>

            {loadingSearch ? (
              <section className="mt-4 space-y-3">
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
              </section>
            ) : results.length === 0 ? (
              <div className="mt-4">
                <EmptyState title="Нет результатов" text="Ищите по Lapka ID, ID чипа или контактам владельца." />
              </div>
            ) : (
              <section className="mt-4 space-y-3">
                {results.map((row) => {
                  const masked = row.consent_status === 'none';
                  return (
                    <Card key={row.pet_id}>
                      <div className="grid gap-3 md:grid-cols-[128px_minmax(0,1fr)_auto] md:items-center">
                        <div className="relative h-[128px] overflow-hidden rounded-[28px] border border-lapka-200 bg-gradient-to-br from-white to-lapka-50 shadow-[0_14px_36px_rgba(15,23,42,0.08)]">
                          <AppImage
                            src={resolvePetPhoto(row)}
                            alt={row.pet_name || 'Пациент'}
                            fill
                            sizes="128px"
                            className="object-cover"
                          />
                        </div>

                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-lapka-500">Пациент</p>
                          <h3 className="mt-2 text-[1.55rem] font-black tracking-tight text-lapka-900">{row.pet_name}</h3>
                          <p className="mt-1 text-base text-lapka-600">
                            {localizePetSpecies(row.species, 'ru')} {row.breed ? `· ${localizePetBreed(row.breed, 'ru')}` : ''}
                          </p>
                          <p className="mt-2 text-base text-lapka-700">
                            {masked ? 'Владелец: скрыто' : `${row.owner_name || '—'} · ${row.owner_email || '—'}`}
                          </p>
                          <div className="mt-3 flex flex-wrap gap-2 text-sm">
                            <span className={`rounded-full px-3 py-1 font-semibold ${masked ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                              {masked ? 'Доступ не выдан' : localizeAccessScope(row.consent_scope)}
                            </span>
                            {row.lapka_id ? <span className="rounded-full bg-lapka-100 px-3 py-1 font-semibold text-lapka-700">{row.lapka_id}</span> : null}
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2 md:justify-end">
                          {masked ? (
                            <button
                              className="btn-secondary"
                              type="button"
                              onClick={() => requestConsent(row)}
                              disabled={requestingId === row.pet_id}
                            >
                              {requestingId === row.pet_id ? 'Отправка...' : 'Запросить доступ'}
                            </button>
                          ) : (
                            <Link href={`/clinic/patients/${row.pet_id}`} className="btn-primary">Карточка пациента</Link>
                          )}
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </section>
            )}
          </Card>

          <Card title="QR-регистрация и быстрые сценарии" subtitle="Токен не открывает медкарту автоматически, а только запускает безопасный маршрут ресепшн.">
            <div className="grid gap-3">
              <label className="block">
                <span className="label">QR-токен</span>
                <input
                  className="input"
                  value={qrToken}
                  onChange={(event) => setQrToken(event.target.value)}
                  placeholder="Пример: QR-LPK-..."
                />
              </label>
              <div className="flex gap-2">
                <button className="btn-primary" type="button" onClick={runQrCheckin}>Проверить токен</button>
                <button className="btn-secondary" type="button" onClick={() => setQrToken('')}>Очистить</button>
              </div>

              <div className="grid gap-3">
                {[
                  'QR-токен нужен для быстрой регистрации, но не раскрывает всю карту без согласия владельца.',
                  'Черновик записи создаётся сразу после подтверждения токена и назначения врача.',
                  'Если доступа к карте нет, администратор всё равно не видит лишние данные пациента.',
                ].map((item) => (
                  <div key={item} className="rounded-[22px] border border-lapka-200 bg-white px-4 py-4 text-sm leading-7 text-lapka-700">
                    {item}
                  </div>
                ))}
              </div>

              {checkin ? (
                <div className="space-y-3 rounded-2xl border border-lapka-200 bg-white/80 p-4">
                  <h3 className="text-base font-bold text-lapka-900">{checkin.pet.pet_name}</h3>
                  <p className="text-sm text-lapka-600">{checkin.pet.species} · {checkin.pet.lapka_id}</p>
                  <p className="text-sm text-lapka-700">
                    Доступ к карте: {checkin.consent_status === 'active' ? localizeAccessScope(checkin.consent_scope) : 'не выдан'}
                  </p>

                  <label className="block">
                    <span className="label">Врач для черновика записи</span>
                    <select className="input" value={vetId} onChange={(event) => setVetId(event.target.value)}>
                      {vets.map((vet) => (
                        <option key={vet.id} value={vet.id}>{vet.full_name}</option>
                      ))}
                    </select>
                  </label>

                  <button className="btn-primary" type="button" onClick={createDraftFromCheckin} disabled={creatingDraft}>
                    {creatingDraft ? 'Создаём...' : 'Создать черновик записи'}
                  </button>
                </div>
              ) : null}
            </div>
          </Card>
        </section>

        {featuredResult ? (
          <section className="grid-soft-2 mt-5">
            <Card title="Пациент в фокусе" subtitle="Ресепшн видит визуальный профиль, уровень доступа и следующий шаг без перехода в отдельный контур.">
              <div className="grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)] xl:items-start">
                <PetVisualGallery
                  pet={featuredResult}
                  language="ru"
                  title="Визуальный профиль"
                  subtitle="Фото из карты, породный JPG и 3D-визуал собраны в одном блоке."
                  compact
                  className="border-0 bg-transparent p-0 shadow-none"
                  imageClassName="object-cover"
                />
                <div className="space-y-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-lapka-500">Пациент</p>
                    <h2 className="mt-2 text-[2rem] font-black tracking-tight text-lapka-900">{featuredResult.pet_name}</h2>
                    <p className="mt-1 text-base text-lapka-600">
                      {localizePetSpecies(featuredResult.species, 'ru')} {featuredResult.breed ? `· ${localizePetBreed(featuredResult.breed, 'ru')}` : ''}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 text-sm">
                    <span
                      className={`rounded-full px-3 py-1 font-semibold ${
                        featuredResult.consent_status === 'none' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
                      }`}
                    >
                      {featuredResult.consent_status === 'none'
                        ? 'Доступ не выдан'
                        : localizeAccessScope(featuredResult.consent_scope)}
                    </span>
                    {featuredResult.lapka_id ? (
                      <span className="rounded-full bg-lapka-100 px-3 py-1 font-semibold text-lapka-700">{featuredResult.lapka_id}</span>
                    ) : null}
                  </div>
                  <p className="text-base leading-7 text-lapka-700">
                    {featuredResult.consent_status === 'none'
                      ? 'Владелец остаётся скрыт до подтверждения согласия. Ресепшн видит только минимальный безопасный профиль.'
                      : `${featuredResult.owner_name || '—'} · ${featuredResult.owner_email || '—'}`}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {featuredResult.consent_status === 'none' ? (
                      <button
                        className="btn-secondary"
                        type="button"
                        onClick={() => requestConsent(featuredResult)}
                        disabled={requestingId === featuredResult.pet_id}
                      >
                        {requestingId === featuredResult.pet_id ? 'Отправка...' : 'Запросить доступ'}
                      </button>
                    ) : (
                      <Link href={`/clinic/patients/${featuredResult.pet_id}`} className="btn-primary">
                        Карточка пациента
                      </Link>
                    )}
                    <Link href="/clinic/checkin" className="btn-secondary">
                      Ресепшн и регистрация
                    </Link>
                  </div>
                </div>
              </div>
            </Card>

            <Card title="Что важно для ресепшн" subtitle="Безопасная рамка до открытия карты.">
              <div className="grid gap-3">
                {[
                  'QR-регистрация и поиск по идентификаторам не раскрывают карту автоматически.',
                  'Если согласия нет, администратор всё равно может создать черновик записи и запустить дальнейший маршрут.',
                  'После подтверждения доступа карточка пациента открывается без повторного поиска.',
                ].map((item) => (
                  <div key={item} className="rounded-[22px] border border-lapka-200 bg-white px-4 py-4 text-sm leading-7 text-lapka-700">
                    {item}
                  </div>
                ))}
              </div>
            </Card>
          </section>
        ) : null}
        </>
      )}
    </div>
  );
}
