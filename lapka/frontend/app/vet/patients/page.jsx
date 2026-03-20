'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import AppImage from '@/components/ui/AppImage';
import Card from '@/components/ui/Card';
import StatsCard from '@/components/ui/StatsCard';
import SearchInput from '@/components/ui/SearchInput';
import EmptyState from '@/components/ui/EmptyState';
import Skeleton from '@/components/ui/Skeleton';
import ErrorBanner from '@/components/ui/ErrorBanner';
import ShowcasePanel from '@/components/ui/ShowcasePanel';
import PetVisualGallery from '@/components/ui/PetVisualGallery';
import { apiRequest } from '@/lib/api';
import { localizeAccessScope } from '@/lib/access';
import { useClinicScope } from '@/lib/clinic-scope';
import { localizePetBreed, localizePetSpecies, resolvePetPhoto } from '@/lib/pets';

const MODES = [
  { value: 'name', label: 'Имя питомца' },
  { value: 'owner_phone', label: 'Телефон владельца' },
  { value: 'owner_email', label: 'Эл. почта владельца' },
  { value: 'chip_id', label: 'Чип ID' },
  { value: 'lapka_id', label: 'Lapka ID' },
];

export default function VetPatientsPage() {
  const { clinicId, selectedClinic, selectedBranch } = useClinicScope();
  const [mode, setMode] = useState('name');
  const [query, setQuery] = useState('');
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [requestingId, setRequestingId] = useState('');

  const maskedCount = useMemo(
    () => patients.filter((row) => row.consent_status === 'none').length,
    [patients]
  );

  const featuredPatient = useMemo(
    () => patients.find((row) => row.consent_status !== 'none') || patients[0] || null,
    [patients]
  );

  async function runSearch() {
    const q = query.trim();
    if (!q) {
      setPatients([]);
      setError('');
      return;
    }
    if (!clinicId) {
      setError('Сначала выберите клинику в рабочем контуре.');
      setPatients([]);
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const payload = await apiRequest(
        `/api/v1/clinic/search/patients?mode=${encodeURIComponent(mode)}&q=${encodeURIComponent(q)}&clinic_id=${encodeURIComponent(clinicId)}&limit=40`
      );
      setPatients(Array.isArray(payload) ? payload : []);
    } catch (requestError) {
      setError(requestError.message || 'Не удалось выполнить поиск');
      setPatients([]);
    } finally {
      setLoading(false);
    }
  }

  async function requestConsent(row) {
    setError('');
    setSuccess('');
    setRequestingId(row.pet_id);
    try {
      const payload = await apiRequest('/api/v1/consent-requests', {
        method: 'POST',
        body: {
          master_pet_id: row.pet_id,
          clinic_id: clinicId,
          message: 'Нужен доступ к карте для приёма и безопасного продолжения визита.',
          requested_scope: 'BASIC_MEDICAL',
        },
      });
      setSuccess(`Запрос доступа отправлен (ID: ${payload.id}).`);
    } catch (requestError) {
      setError(requestError.message || 'Не удалось отправить запрос доступа');
    } finally {
      setRequestingId('');
    }
  }

  return (
    <div className="space-y-7">
      <header className="page-header">
        <div>
          <h1 className="text-sm font-semibold uppercase tracking-[0.18em] text-lapka-500">Пациенты</h1>
          <h1 className="page-title">Поиск пациента и доступ к карте</h1>
          <p className="page-subtitle">Сначала поиск и уровень доступа, затем открытие карты, запрос согласия и перевод пациента в клинический контур.</p>
        </div>
      </header>

      {error ? <ErrorBanner message={error} onRetry={runSearch} /> : null}
      {success ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{success}</div>
      ) : null}

      <ShowcasePanel
        eyebrow="Рабочее место врача"
        title="Быстрый поиск пациента до начала приёма"
        description="Врач находит пациента по нескольким идентификаторам, видит уровень доступа и открывает карту только там, где согласие владельца уже подтверждено."
        imageSrc="/assets/img/vet-side.svg"
        imageAlt="Поиск пациента для врача"
        badges={[
          `${patients.length} найдено`,
          `${maskedCount} без доступа`,
          `${patients.length - maskedCount} с доступом`,
        ]}
      />

      <section className="grid items-start gap-5 2xl:grid-cols-[1.08fr_0.92fr]">
        <Card title="Найти пациента" subtitle="Один вход для имени питомца, контактов владельца, чипа и Lapka ID.">
          <div className="grid gap-3 md:grid-cols-[220px_minmax(0,1fr)_auto] md:items-end">
            <label className="block">
              <span className="label">Режим поиска</span>
              <select className="input" value={mode} onChange={(event) => setMode(event.target.value)}>
                {MODES.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>

            <SearchInput
              label="Запрос"
              placeholder="Имя питомца, телефон, email, чип или Lapka ID"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  runSearch();
                }
              }}
            />

            <div className="flex gap-2">
              <button className="btn-primary" type="button" onClick={runSearch}>
                Найти
              </button>
              <button
                className="btn-secondary"
                type="button"
                onClick={() => {
                  setQuery('');
                  setPatients([]);
                  setError('');
                }}
              >
                Сбросить
              </button>
            </div>
          </div>
        </Card>

        <Card title="Что важно в этом экране" subtitle="Поиск не раскрывает лишние персональные данные до выдачи согласия.">
          <div className="grid gap-3">
            {[
              'Результаты без согласия владельца остаются скрытыми.',
              'Lapka ID и чип доступны как быстрые clinic-grade идентификаторы.',
              'Если доступа нет, врач отправляет запрос и не получает медицинские данные заранее.',
            ].map((item) => (
              <div key={item} className="rounded-[22px] border border-lapka-200 bg-white px-4 py-4 text-sm leading-7 text-lapka-700">
                {item}
              </div>
            ))}
          </div>
        </Card>
      </section>

      <section className="kpi-grid">
        <StatsCard label="Найдено" value={String(patients.length)} />
        <StatsCard label="Скрыто" value={String(maskedCount)} />
        <StatsCard label="С доступом" value={String(patients.length - maskedCount)} />
        <StatsCard label="Клиника" value={selectedClinic?.name || 'Не выбрана'} />
        <StatsCard label="Филиал" value={selectedBranch?.address || 'Главный филиал'} />
      </section>

      {featuredPatient ? (
        <section className="grid-soft-2">
          <Card title="Пациент в фокусе" subtitle="Фото из карты, породный ориентир и 3D-визуал доступны прямо в поисковом контуре.">
            <div className="grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)] xl:items-start">
              <PetVisualGallery
                pet={featuredPatient}
                language="ru"
                title="Визуальный профиль"
                subtitle="Сначала реальное фото, затем породный JPG и 3D-визуал."
                compact
                className="border-0 bg-transparent p-0 shadow-none"
                imageClassName="object-cover"
              />
              <div className="space-y-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-lapka-500">Пациент</p>
                  <h2 className="mt-2 text-[2rem] font-black tracking-tight text-lapka-900">{featuredPatient.pet_name}</h2>
                  <p className="mt-1 text-base text-lapka-600">
                    {localizePetSpecies(featuredPatient.species)} {featuredPatient.breed ? `· ${localizePetBreed(featuredPatient.breed)}` : ''}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 text-sm">
                  <span
                    className={`rounded-full px-3 py-1 font-semibold ${
                      featuredPatient.consent_status === 'none' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
                    }`}
                  >
                    {featuredPatient.consent_status === 'none'
                      ? 'Доступ не выдан'
                      : localizeAccessScope(featuredPatient.consent_scope)}
                  </span>
                  {featuredPatient.lapka_id ? (
                    <span className="rounded-full bg-lapka-100 px-3 py-1 font-semibold text-lapka-700">{featuredPatient.lapka_id}</span>
                  ) : null}
                  {featuredPatient.chip_id && featuredPatient.consent_status !== 'none' ? (
                    <span className="rounded-full bg-lapka-100 px-3 py-1 font-semibold text-lapka-700">{featuredPatient.chip_id}</span>
                  ) : null}
                </div>
                <p className="text-base leading-7 text-lapka-700">
                  {featuredPatient.consent_status === 'none'
                    ? 'Контакты владельца остаются скрытыми до подтверждения доступа. Врач видит только безопасный профиль пациента.'
                    : `${featuredPatient.owner_name || 'Владелец'} · ${featuredPatient.owner_email || '—'}`}
                </p>
                <div className="flex flex-wrap gap-2">
                  {featuredPatient.consent_status === 'none' ? (
                    <button
                      className="btn-secondary"
                      type="button"
                      onClick={() => requestConsent(featuredPatient)}
                      disabled={requestingId === featuredPatient.pet_id}
                    >
                      {requestingId === featuredPatient.pet_id ? 'Отправка...' : 'Запросить согласие владельца'}
                    </button>
                  ) : (
                    <Link href={`/vet/patient/${featuredPatient.pet_id}`} className="btn-primary">
                      Карточка пациента
                    </Link>
                  )}
                  <Link href="/vet/appointments" className="btn-secondary">
                    Открыть поток приёма
                  </Link>
                </div>
              </div>
            </div>
          </Card>

          <Card title="Что важно до открытия карты" subtitle="Короткий clinic-grade ориентир для врача и ассистента.">
            <div className="grid gap-3">
              {[
                'Сначала проверяйте уровень доступа, затем переходите к истории визитов и документам.',
                'Lapka ID и чип удобны для повторного поиска без раскрытия лишних данных владельца.',
                'Если согласия нет, экран поиска остаётся рабочим: можно отправить запрос и продолжить логистику приёма.',
              ].map((item) => (
                <div key={item} className="rounded-[22px] border border-lapka-200 bg-white px-4 py-4 text-sm leading-7 text-lapka-700">
                  {item}
                </div>
              ))}
            </div>
          </Card>
        </section>
      ) : null}

      {loading ? (
        <section className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </section>
      ) : patients.length === 0 ? (
        <EmptyState
          title="Нет результатов"
          text="Запустите поиск: результаты без доступа будут скрыты и откроются только после подтверждения владельца."
        />
      ) : (
        <section className="grid gap-4">
          {patients.map((row) => {
            const masked = row.consent_status === 'none';
            return (
              <Card key={row.pet_id} className="overflow-hidden">
                <div className="grid gap-4 md:grid-cols-[132px_minmax(0,1fr)_auto] md:items-center">
                  <div className="relative h-[132px] overflow-hidden rounded-[30px] border border-lapka-200 bg-gradient-to-br from-white to-lapka-50 shadow-[0_16px_40px_rgba(15,23,42,0.08)]">
                    <AppImage
                      src={resolvePetPhoto(row)}
                      alt={row.pet_name || 'Пациент'}
                      fill
                      sizes="132px"
                      className="object-cover"
                    />
                  </div>

                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-lapka-500">Пациент</p>
                    <h3 className="mt-2 text-[1.75rem] font-black tracking-tight text-lapka-900">{row.pet_name}</h3>
                    <p className="mt-1 text-base text-lapka-600">
                      {localizePetSpecies(row.species)} {row.breed ? `· ${localizePetBreed(row.breed)}` : ''}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2 text-sm">
                      <span className={`rounded-full px-3 py-1 font-semibold ${masked ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                        {masked ? 'Доступ не выдан' : localizeAccessScope(row.consent_scope)}
                      </span>
                      {row.lapka_id ? <span className="rounded-full bg-lapka-100 px-3 py-1 font-semibold text-lapka-700">{row.lapka_id}</span> : null}
                      {!masked && row.chip_id ? <span className="rounded-full bg-lapka-100 px-3 py-1 font-semibold text-lapka-700">{row.chip_id}</span> : null}
                    </div>
                    <p className="mt-3 text-base text-lapka-700">
                      {masked ? 'Владелец: скрыто до подтверждения доступа' : `${row.owner_name || 'Владелец'} · ${row.owner_email || '—'}`}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2 md:justify-end">
                    {masked ? (
                      <button
                        className="btn-secondary"
                        type="button"
                        onClick={() => requestConsent(row)}
                        disabled={requestingId === row.pet_id}
                      >
                          {requestingId === row.pet_id ? 'Отправка...' : 'Запросить согласие владельца'}
                      </button>
                    ) : (
                      <Link href={`/vet/patient/${row.pet_id}`} className="btn-primary">
                        Карточка пациента
                      </Link>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </section>
      )}
    </div>
  );
}
