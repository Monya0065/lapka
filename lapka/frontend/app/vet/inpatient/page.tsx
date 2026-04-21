'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import AppImage from '@/components/ui/AppImage';
import Card from '@/components/ui/Card';
import EmptyState from '@/components/ui/EmptyState';
import ErrorBanner from '@/components/ui/ErrorBanner';
import Skeleton from '@/components/ui/Skeleton';
import ShowcasePanel from '@/components/ui/ShowcasePanel';
import PetVisualGallery from '@/components/ui/PetVisualGallery';
import { apiRequest } from '@/lib/api';
import { localizePetBreed, localizePetSpecies, resolvePetPhoto } from '@/lib/pets';

function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString('ru-RU');
}

function publicStatusLabel(code) {
  if (code === 'stable') return <span className="badge-green">Стабильно</span>;
  if (code === 'needs_attention') return <span className="badge-red">Нужен приоритет</span>;
  return <span className="badge-yellow">Мониторинг</span>;
}

export default function VetInpatientPage() {
  const [rows, setRows] = useState([]);
  const [petMap, setPetMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function loadData() {
    setLoading(true);
    setError('');
    try {
      const [staysPayload, petsPayload] = await Promise.all([
        apiRequest('/api/v1/inpatient/stays?status=active'),
        apiRequest('/api/v1/pets?limit=300'),
      ]);
      const stays = Array.isArray(staysPayload) ? staysPayload : [];
      const pets = Array.isArray(petsPayload) ? petsPayload : [];
      const map = {};
      pets.forEach((pet) => {
        map[pet.id] = pet;
      });
      setRows(stays);
      setPetMap(map);
    } catch (requestError) {
      setError(requestError.message || 'Не удалось загрузить стационарное отделение');
      setRows([]);
      setPetMap({});
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const staleCount = useMemo(() => {
    const thresholdMs = 6 * 60 * 60 * 1000;
    return rows.filter((row) => Date.now() - new Date(row.admitted_at).getTime() > thresholdMs).length;
  }, [rows]);

  const featuredStay = rows[0] || null;
  const featuredPet = featuredStay ? petMap[featuredStay.pet_id] : null;

  return (
    <>
      <header className="page-header">
        <div>
          <h1 className="page-title">Стационар отделения</h1>
          <p className="page-subtitle">
            Актуальные кейсы стационара, быстрые обновления смены и прозрачная коммуникация с владельцем.
          </p>
        </div>
        <button className="btn-secondary" type="button" onClick={loadData}>
          Обновить
        </button>
      </header>

      {error ? <ErrorBanner message={error} onRetry={loadData} /> : null}

      <ShowcasePanel
        eyebrow="Стационар отделения"
        title="Пациенты смены, приоритеты и быстрый переход к обновлениям"
        description="Врач видит текущих стационарных пациентов, сразу отличает приоритетные кейсы и открывает нужную карточку без промежуточных таблиц."
        imageSrc="/assets/img/inpatient.svg"
        imageAlt="Стационар отделения"
        badges={[
          `${rows.length} активных пациентов`,
          `${rows.filter((row) => row.public_status_label === 'needs_attention').length} приоритетных`,
          `${staleCount} без свежего обновления`,
        ]}
      />

      <section className="kpi-grid">
        <Card title="Активные пациенты">
          <p className="text-4xl font-black text-lapka-900">{rows.length}</p>
        </Card>
        <Card title="Нужен приоритет">
          <p className="text-4xl font-black text-lapka-900">{rows.filter((row) => row.public_status_label === 'needs_attention').length}</p>
        </Card>
        <Card title="Давно без обновления">
          <p className="text-4xl font-black text-lapka-900">{staleCount}</p>
        </Card>
      </section>

      {featuredStay && featuredPet ? (
        <section className="grid-soft-2">
          <Card title="Пациент смены" subtitle="Фото из карты, породный JPG и 3D-визуал доступны прямо в стационарном контуре.">
            <div className="grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)] xl:items-start">
              <PetVisualGallery
                pet={featuredPet}
                language="ru"
                title="Визуальный профиль"
                subtitle="Сначала фото пациента, затем породный ориентир и 3D-визуал."
                compact
                className="border-0 bg-transparent p-0 shadow-none"
                imageClassName="object-cover"
              />
              <div className="space-y-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-lapka-500">Фокус смены</p>
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
                  <Link href={`/vet/inpatient/${featuredStay.id}`} className="btn-primary">
                    Карточка стационара
                  </Link>
                  <Link href={`/vet/patient/${featuredPet.id}`} className="btn-secondary">
                    Карточка пациента
                  </Link>
                </div>
              </div>
            </div>
          </Card>

          <Card title="Что важно по отделению" subtitle="Короткий срез для врача дежурной смены.">
            <div className="grid gap-3">
              {[
                'Сначала открывайте пациента с самым давним обновлением или приоритетным статусом.',
                'Фото и owner-visible summary помогают быстро восстановить контекст без лишнего просмотра таблиц.',
                'Переход в карточку пациента нужен для визитов и документов, переход в карточку стационара — для обновлений и фото-отчётов.',
              ].map((item) => (
                <div key={item} className="rounded-[22px] border border-lapka-200 bg-white px-4 py-4 text-sm leading-7 text-lapka-700">
                  {item}
                </div>
              ))}
            </div>
          </Card>
        </section>
      ) : null}

      <Card title="Пациенты стационара" subtitle="Откройте карточку, чтобы добавить обновление, события чек-листа и фото-отчёты">
        {loading ? (
          <div className="grid gap-4 md:grid-cols-2">
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        ) : rows.length ? (
          <div className="grid gap-4 md:grid-cols-2">
            {rows.map((row) => {
              const pet = petMap[row.pet_id];
              return (
                <article
                  key={row.id}
                  className="overflow-hidden rounded-[2rem] border border-lapka-200 bg-white shadow-soft transition hover:-translate-y-0.5 hover:shadow-card"
                >
                  <div className="grid gap-0 md:grid-cols-[132px_minmax(0,1fr)]">
                    <div className="relative min-h-[170px] overflow-hidden border-b border-lapka-200 bg-[radial-gradient(circle_at_top_left,rgba(92,166,237,0.2),transparent_38%),radial-gradient(circle_at_bottom_right,rgba(64,211,154,0.2),transparent_34%),linear-gradient(180deg,#fafdff_0%,#eef7ff_100%)] p-4 md:border-b-0 md:border-r">
                      <AppImage
                        src={resolvePetPhoto(pet)}
                        alt={pet?.name || 'Пациент стационара'}
                        width={520}
                        height={520}
                        sizes="132px"
                        className="mt-4 h-32 w-full rounded-[1.35rem] border border-white/80 object-cover shadow-[0_18px_40px_rgba(21,58,97,0.14)]"
                      />
                    </div>

                    <div className="p-4">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="text-2xl font-black tracking-tight text-lapka-900">{pet?.name || row.pet_id}</h3>
                        {publicStatusLabel(row.public_status_label)}
                      </div>

                      <p className="mt-1 text-sm text-lapka-600">
                        {localizePetSpecies(pet?.species, 'ru')} · Палата {row.ward}/{row.bed}
                      </p>
                      <p className="mt-2 text-sm text-lapka-700">{row.owner_visible_summary}</p>
                      <p className="mt-2 text-xs text-lapka-500">Поступление: {formatDate(row.admitted_at)}</p>

                      <div className="mt-4 flex flex-wrap gap-2">
                        <Link href={`/vet/inpatient/${row.id}`} className="btn-primary">
                          Карточка стационара
                        </Link>
                        <Link href={`/vet/inpatient/${row.id}`} className="btn-secondary">
                          Быстрое обновление
                        </Link>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <EmptyState title="Стационар пуст" text="Активные пациенты появятся здесь после поступления." />
        )}
      </Card>
    </>
  );
}
