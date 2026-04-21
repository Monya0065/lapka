'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Card from '@/components/ui/Card';
import AppImage from '@/components/ui/AppImage';
import EmptyState from '@/components/ui/EmptyState';
import ErrorBanner from '@/components/ui/ErrorBanner';
import ShowcasePanel from '@/components/ui/ShowcasePanel';
import Skeleton from '@/components/ui/Skeleton';
import Table from '@/components/ui/Table';
import PetVisualGallery from '@/components/ui/PetVisualGallery';
import { apiRequest } from '@/lib/api';
import { useClinicScope } from '@/lib/clinic-scope';
import { localizePetBreed, localizePetSpecies, resolvePetPhoto } from '@/lib/pets';

function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString('ru-RU');
}

function statusBadge(code) {
  if (code === 'stable') return <span className="badge-green">Стабильно</span>;
  if (code === 'needs_attention') return <span className="badge-red">Приоритет</span>;
  return <span className="badge-yellow">Мониторинг</span>;
}

function localizeAuditResult(result) {
  if (result === 'ok') return 'Успешно';
  if (result === 'denied') return 'Доступ отклонён';
  if (result === 'expired') return 'Истёк срок';
  return result || '—';
}

function shortValue(value) {
  if (!value) return '—';
  return `${String(value).slice(0, 8)}…`;
}

export default function ClinicInpatientPage() {
  const { clinicId, selectedClinic, selectedBranch } = useClinicScope();
  const [stays, setStays] = useState([]);
  const [petMap, setPetMap] = useState({});
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [staysPayload, petsPayload, logsPayload] = await Promise.all([
        apiRequest(`/api/v1/inpatient/stays?status=active${clinicId ? `&clinic_id=${encodeURIComponent(clinicId)}` : ''}`),
        apiRequest('/api/v1/pets?limit=300'),
        apiRequest('/api/v1/inpatient/camera-access-logs'),
      ]);
      const rows = Array.isArray(staysPayload) ? staysPayload : [];
      const pets = Array.isArray(petsPayload) ? petsPayload : [];
      const map = {};
      pets.forEach((pet) => {
        map[pet.id] = pet;
      });
      setStays(rows);
      setPetMap(map);
      setLogs(Array.isArray(logsPayload) ? logsPayload : []);
    } catch (requestError) {
      setError(requestError.message || 'Не удалось загрузить стационарную панель');
      setStays([]);
      setLogs([]);
      setPetMap({});
    } finally {
      setLoading(false);
    }
  }, [clinicId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const occupancyPercent = useMemo(() => {
    const maxBedsDemo = 12;
    return Math.min(100, Math.round((stays.length / maxBedsDemo) * 100));
  }, [stays]);

  const avgStayLength = useMemo(() => {
    if (!stays.length) return 0;
    const totalDays = stays.reduce((acc, row) => {
      const admitted = new Date(row.admitted_at).getTime();
      return acc + (Date.now() - admitted) / (1000 * 60 * 60 * 24);
    }, 0);
    return (totalDays / stays.length).toFixed(1);
  }, [stays]);

  const attentionCount = useMemo(
    () => stays.filter((row) => row.public_status_label === 'needs_attention').length,
    [stays]
  );

  const staleUpdateCount = useMemo(() => {
    const now = Date.now();
    return stays.filter((row) => {
      const updatedAt = row.updated_at || row.created_at || row.admitted_at;
      if (!updatedAt) return false;
      return now - new Date(updatedAt).getTime() > 1000 * 60 * 60 * 8;
    }).length;
  }, [stays]);

  const featuredStay = stays[0] || null;
  const featuredPet = featuredStay ? petMap[featuredStay.pet_id] : null;

  return (
    <>
      <header className="page-header">
        <div>
          <h1 className="page-title">Стационар клиники</h1>
          <p className="page-subtitle">
            Картина отделения на сегодня: занятость коек, ответственные врачи и прозрачный журнал просмотров камер.
          </p>
        </div>
        <button className="btn-secondary" type="button" onClick={loadData}>
          Обновить
        </button>
      </header>

      {error ? <ErrorBanner message={error} onRetry={loadData} /> : null}

          <ShowcasePanel
            eyebrow="Стационар и доверие"
            title={`Загрузка отделения ${selectedClinic?.name || 'клиники'}${selectedBranch ? ` · ${selectedBranch.address}` : ''}, прозрачные обновления и контроль доступа к камерам`}
            description="Операционный экран стационара показывает только ключевые сигналы: сколько коек занято, какие пациенты требуют внимания и кто открывал камеры. Без перегруженного интерфейса и лишнего шума."
            imageSrc="/assets/img/inpatient.svg"
            imageAlt="Стационар клиники"
        badges={[
          `${stays.length} активных пациентов`,
          `${occupancyPercent}% загрузка`,
          `${logs.filter((row) => row.result === 'ok').length} просмотров камер`,
        ]}
        compact
      />

      <section className="kpi-grid">
        <Card title="Занято коек">
          <p className="text-4xl font-black text-lapka-900">{stays.length}</p>
        </Card>
        <Card title="Загрузка отделения">
          <p className="text-4xl font-black text-lapka-900">{occupancyPercent}%</p>
        </Card>
        <Card title="Средняя длительность пребывания">
          <p className="text-4xl font-black text-lapka-900">{avgStayLength} дн.</p>
        </Card>
        <Card title="Просмотры камер (последние)">
          <p className="text-4xl font-black text-lapka-900">{logs.filter((row) => row.result === 'ok').length}</p>
        </Card>
      </section>

      <section className="grid-soft-2">
        <Card title="Что важно сейчас" subtitle="Короткий срез по рискам и организационным действиям">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-[24px] border border-lapka-200 bg-lapka-50 px-4 py-4">
              <p className="text-sm uppercase tracking-[0.24em] text-lapka-500">Нуждаются во внимании</p>
              <p className="mt-2 text-3xl font-black tracking-tight text-lapka-900">{attentionCount}</p>
            </div>
            <div className="rounded-[24px] border border-lapka-200 bg-lapka-50 px-4 py-4">
              <p className="text-sm uppercase tracking-[0.24em] text-lapka-500">Без свежего апдейта</p>
              <p className="mt-2 text-3xl font-black tracking-tight text-lapka-900">{staleUpdateCount}</p>
            </div>
            <div className="rounded-[24px] border border-lapka-200 bg-lapka-50 px-4 py-4">
              <p className="text-sm uppercase tracking-[0.24em] text-lapka-500">Записей аудита</p>
              <p className="mt-2 text-3xl font-black tracking-tight text-lapka-900">{logs.length}</p>
            </div>
          </div>
        </Card>

        <Card title="Операционные переходы" subtitle="Ключевые действия по стационару без лишних переходов">
          <div className="grid gap-3 md:grid-cols-2">
            <Link href="/clinic/schedule" className="rounded-[24px] border border-lapka-200 bg-white px-5 py-4 text-base font-semibold text-lapka-800 transition hover:-translate-y-0.5 hover:shadow-card">
              Расписание и приём
            </Link>
            <Link href="/clinic/inbox" className="rounded-[24px] border border-lapka-200 bg-white px-5 py-4 text-base font-semibold text-lapka-800 transition hover:-translate-y-0.5 hover:shadow-card">
              Входящие и сигналы
            </Link>
            <Link href="/clinic/patients" className="rounded-[24px] border border-lapka-200 bg-white px-5 py-4 text-base font-semibold text-lapka-800 transition hover:-translate-y-0.5 hover:shadow-card">
              Реестр пациентов
            </Link>
            <Link href="/clinic/audit" className="rounded-[24px] border border-lapka-200 bg-white px-5 py-4 text-base font-semibold text-lapka-800 transition hover:-translate-y-0.5 hover:shadow-card">
              Аудит доступа
            </Link>
          </div>
        </Card>
      </section>

      {featuredStay && featuredPet ? (
        <section className="grid-soft-2">
          <Card title="Кейс в фокусе" subtitle="Фото пациента, породный JPG и 3D-визуал доступны прямо в панели отделения.">
            <div className="grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)] xl:items-start">
              <PetVisualGallery
                pet={featuredPet}
                language="ru"
                title="Визуальный профиль"
                subtitle="Сначала фото из карты, затем породный ориентир и 3D-визуал."
                compact
                className="border-0 bg-transparent p-0 shadow-none"
                imageClassName="object-cover"
              />
              <div className="space-y-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-lapka-500">Стационарный кейс</p>
                  <h2 className="mt-2 text-[2rem] font-black tracking-tight text-lapka-900">{featuredPet.name}</h2>
                  <p className="mt-1 text-base text-lapka-600">
                    {localizePetSpecies(featuredPet.species, 'ru')} {featuredPet.breed ? `· ${localizePetBreed(featuredPet.breed, 'ru')}` : ''} · Палата {featuredStay.ward}/{featuredStay.bed}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 text-sm">
                  <span className="dense-chip">Поступление: {formatDate(featuredStay.admitted_at)}</span>
                  {featuredPet.chip_id ? <span className="dense-chip">Чип: {featuredPet.chip_id}</span> : null}
                  {featuredPet.lapka_id ? <span className="dense-chip">Lapka ID: {featuredPet.lapka_id}</span> : null}
                </div>
                <p className="text-base leading-7 text-lapka-700">{featuredStay.owner_visible_summary}</p>
                <div className="flex flex-wrap gap-2">
                  <Link href={`/clinic/inpatient/${featuredStay.id}`} className="btn-primary">
                    Открыть карточку
                  </Link>
                  <Link href={`/clinic/patients/${featuredPet.id}`} className="btn-secondary">
                    Открыть пациента
                  </Link>
                </div>
              </div>
            </div>
          </Card>

          <Card title="Контур отделения" subtitle="Что важно для администратора и старшей смены.">
            <div className="grid gap-3">
              {[
                'Сначала проверяйте кейсы со статусом приоритета и без свежего обновления.',
                'Переход в карточку стационара нужен для событий, фото и owner-visible обновлений.',
                'Переход в карточку пациента нужен для полного реестра визитов, документов и маршрута ресепшн.',
              ].map((item) => (
                <div key={item} className="rounded-[22px] border border-lapka-200 bg-white px-4 py-4 text-sm leading-7 text-lapka-700">
                  {item}
                </div>
              ))}
            </div>
          </Card>
        </section>
      ) : null}

      <section className="grid items-start gap-5 xl:grid-cols-2 2xl:grid-cols-[1.08fr_0.92fr]">
        <Card title="Активные пациенты" subtitle="Переход в детальную карточку стационара с командой, событиями и фото-отчётами">
          {loading ? (
            <div className="grid gap-4 lg:grid-cols-2">
              <Skeleton className="h-52 w-full" />
              <Skeleton className="h-52 w-full" />
            </div>
          ) : stays.length ? (
            <div className="grid gap-4 lg:grid-cols-2">
              {stays.map((stay) => {
                const pet = petMap[stay.pet_id];
                return (
                  <article key={stay.id} className="overflow-hidden rounded-[2rem] border border-lapka-200 bg-white shadow-soft">
                    <div className="grid gap-0 md:grid-cols-[180px_minmax(0,1fr)]">
                      <div
                        className="relative min-h-[220px] overflow-hidden border-b border-lapka-200 bg-[radial-gradient(circle_at_top_left,rgba(92,166,237,0.22),transparent_38%),radial-gradient(circle_at_bottom_right,rgba(64,211,154,0.22),transparent_34%),linear-gradient(180deg,#fafdff_0%,#eef7ff_100%)] p-4 md:border-b-0 md:border-r"
                        style={{ transformStyle: 'preserve-3d' }}
                      >
                        <div className="showcase-orb left-4 top-4 h-16 w-16 bg-cyan-300/25" />
                        <div className="showcase-orb right-6 top-6 h-12 w-12 bg-emerald-300/25" />
                        <div className="showcase-floating left-4 top-4">Стационар</div>
                        <AppImage
                          src={resolvePetPhoto(pet)}
                          alt={pet?.name || 'Пациент'}
                          width={640}
                          height={640}
                          sizes="180px"
                          className="relative mt-8 h-40 w-full rounded-[1.5rem] border border-white/80 object-cover shadow-[0_22px_44px_rgba(21,58,97,0.18)]"
                          style={{ transform: 'translateZ(18px)' }}
                        />
                      </div>

                      <div className="p-5">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <h3 className="text-[2rem] font-black tracking-tight text-lapka-900">{pet?.name || stay.pet_id}</h3>
                            <p className="mt-1 text-base text-lapka-600">
                              {localizePetSpecies(pet?.species, 'ru')} · Палата {stay.ward}/{stay.bed}
                            </p>
                          </div>
                          {statusBadge(stay.public_status_label)}
                        </div>

                        <p className="mt-4 text-base leading-7 text-lapka-700">{stay.owner_visible_summary}</p>

                        <div className="mt-4 flex flex-wrap gap-2 text-base text-lapka-700">
                          <span className="dense-chip">Поступление: {formatDate(stay.admitted_at)}</span>
                          <span className="dense-chip">Кейс: {stay.status === 'active' ? 'активный' : 'завершён'}</span>
                          <span className="dense-chip">Врач: {stay.attending_vet_id || 'назначается'}</span>
                        </div>

                        <div className="mt-5 flex gap-2">
                          <Link href={`/clinic/inpatient/${stay.id}`} className="btn-primary">
                            Открыть карточку
                          </Link>
                          {pet?.id ? (
                            <Link href={`/clinic/patients/${pet.id}`} className="btn-secondary">
                              Открыть пациента
                            </Link>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <EmptyState title="Стационар сейчас пуст" text="В клинике нет активных стационарных кейсов." />
          )}
        </Card>

        <div className="space-y-4">
          <Card title="Журнал просмотров камер" subtitle="Каждое открытие камеры попадает в аудит приватности">
            {logs.length ? (
              <Table
                columns={['Время', 'Пользователь', 'Результат', 'Токен']}
                rows={logs.slice(0, 25).map((row) => [
                  formatDate(row.created_at),
                  shortValue(row.user_id),
                  localizeAuditResult(row.result),
                  shortValue(row.token_id),
                ])}
              />
            ) : (
              <EmptyState title="Логи камер пусты" text="После первых просмотров записи появятся в таблице аудита." />
            )}
          </Card>

          <Card title="Что проверить по отделению" subtitle="Короткий операционный чек-лист для администраторов">
            <div className="grid gap-3">
              {[
                'У каждого активного кейса должен быть назначенный врач и понятный следующий шаг.',
                'Фото-отчёты и обновления для владельца не должны выпадать из SLA.',
                'Просмотры камер и запросы доступа должны оставаться прозрачными и контролируемыми.',
              ].map((item) => (
                <div key={item} className="rounded-[22px] border border-lapka-200 bg-white px-4 py-4 text-sm leading-7 text-lapka-700">
                  {item}
                </div>
              ))}
            </div>
          </Card>
        </div>
      </section>
    </>
  );
}
