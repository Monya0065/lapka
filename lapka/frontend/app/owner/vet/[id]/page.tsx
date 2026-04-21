'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import AppImage from '@/components/ui/AppImage';
import Card from '@/components/ui/Card';
import EntityVisualGallery from '@/components/ui/EntityVisualGallery';
import EmptyState from '@/components/ui/EmptyState';
import ErrorBanner from '@/components/ui/ErrorBanner';
import Skeleton from '@/components/ui/Skeleton';
import ShowcasePanel from '@/components/ui/ShowcasePanel';
import { apiRequest } from '@/lib/api';
import { buildVetVisualGallery, resolveClinicGallery, resolveClinicPhoto, resolveVetPhoto } from '@/lib/pets';

function stars(avg) {
  const value = Math.round(Number(avg || 0));
  return `${'★'.repeat(value)}${'☆'.repeat(Math.max(0, 5 - value))}`;
}

export default function OwnerVetDetailsPage({ params }) {
  const vetId = params.id;
  const [vet, setVet] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [sortBy, setSortBy] = useState('newest');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');

  const loadVet = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [vetPayload, reviewsPayload] = await Promise.all([
        apiRequest(`/api/v1/market/vets/${encodeURIComponent(vetId)}`),
        apiRequest(`/api/v1/market/vets/${encodeURIComponent(vetId)}/reviews?limit=20`),
      ]);
      setVet(vetPayload || null);
      setReviews(Array.isArray(reviewsPayload?.items) ? reviewsPayload.items : []);
      setCursor(reviewsPayload?.next_cursor || null);
    } catch (requestError) {
      setError(requestError.message || 'Не удалось загрузить профиль врача');
      setVet(null);
      setReviews([]);
      setCursor(null);
    } finally {
      setLoading(false);
    }
  }, [vetId]);

  useEffect(() => {
    loadVet();
  }, [loadVet]);

  async function loadMore() {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const payload = await apiRequest(
        `/api/v1/market/vets/${encodeURIComponent(vetId)}/reviews?limit=20&cursor=${encodeURIComponent(cursor)}`
      );
      const items = Array.isArray(payload?.items) ? payload.items : [];
      setReviews((prev) => [...prev, ...items]);
      setCursor(payload?.next_cursor || null);
    } catch (requestError) {
      setError(requestError.message || 'Не удалось загрузить отзывы');
    } finally {
      setLoadingMore(false);
    }
  }

  const sortedReviews = useMemo(() => {
    const next = [...reviews];
    if (sortBy === 'highest') {
      next.sort((a, b) => b.rating - a.rating || new Date(b.created_at) - new Date(a.created_at));
      return next;
    }
    next.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    return next;
  }, [reviews, sortBy]);

  const clinicGallery = useMemo(() => resolveClinicGallery(vet?.clinic), [vet?.clinic]);
  const vetVisualGallery = useMemo(() => buildVetVisualGallery(vet), [vet]);

  if (loading) {
    return (
      <section className="space-y-3">
        <Skeleton className="h-56 w-full" />
        <Skeleton className="h-72 w-full" />
      </section>
    );
  }

  if (!vet) {
    return <ErrorBanner message={error || 'Врач не найден'} onRetry={loadVet} />;
  }

  return (
    <>
      <header className="page-header">
        <div>
          <h1 className="page-title">{vet.full_name}</h1>
          <p className="page-subtitle">{vet.specialty || 'Ветеринарный врач'} · {vet.experience_years || 0} лет опыта</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link className="btn-secondary" href="/owner/market">Назад к выбору врача</Link>
          <Link className="btn-primary" href={`/owner/appointments?clinic_id=${vet.clinic?.id || ''}&vet_id=${vet.id}`}>
            Записаться
          </Link>
        </div>
      </header>

      {error ? <ErrorBanner message={error} onRetry={loadVet} /> : null}

      <ShowcasePanel
        eyebrow="Профиль врача"
        title={`${vet.full_name}: специализация, график и отзывы`}
        description="Карточка врача показывает главное без перегруза: направление, клинику, рейтинг, доступные окна и понятный переход к записи. Задача экрана — помочь владельцу быстро понять, подходит ли этот специалист под текущий сценарий."
        imageSrc="/assets/img/vet-doctor.svg"
        imageAlt="Профиль врача"
        badges={[
          vet.specialty || 'Ветеринарный врач',
          `${vet.experience_years || 0} лет опыта`,
          `${vet.rating_summary?.count || 0} отзывов`,
        ]}
      />

      <section className="kpi-grid">
        <Card title="Рейтинг" subtitle="Средняя оценка владельцев">
          <p className="text-4xl font-black tracking-tight text-lapka-900">{vet.rating_summary?.avg_rating?.toFixed?.(1) || '0.0'}</p>
        </Card>
        <Card title="Отзывы" subtitle="Подтверждённые и публичные">
          <p className="text-4xl font-black tracking-tight text-lapka-900">{vet.rating_summary?.count || 0}</p>
        </Card>
        <Card title="Опыт" subtitle="Лет клинической практики">
          <p className="text-4xl font-black tracking-tight text-lapka-900">{vet.experience_years || 0}</p>
        </Card>
        <Card title="Языки" subtitle="Коммуникация на приёме">
          <p className="text-4xl font-black tracking-tight text-lapka-900">{(vet.languages || []).length || 1}</p>
        </Card>
      </section>

      <section className="grid items-start gap-4 2xl:grid-cols-[1.15fr_0.85fr]">
        <EntityVisualGallery
          items={vetVisualGallery}
          title="Врач и среда приёма"
          subtitle="Портрет врача и пространство клиники помогают оценить, как выглядит реальный маршрут приёма."
        />

        <Card title="Клиника и график">
          {vet.clinic ? (
            <div className="mb-3 overflow-hidden rounded-2xl border border-lapka-200 bg-white">
              <div className="relative h-40 w-full">
                <AppImage
                  src={resolveClinicPhoto(vet.clinic)}
                  alt={vet.clinic?.name || 'Клиника'}
                  fill
                  sizes="(max-width: 1280px) 100vw, 360px"
                  className="h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-lapka-900/45 via-lapka-900/10 to-transparent" />
                <div className="absolute bottom-3 left-3 rounded-xl bg-white/90 px-3 py-2 backdrop-blur">
                  <p className="text-sm font-semibold text-lapka-900">{vet.clinic?.name}</p>
                  <p className="text-xs text-lapka-600">{vet.clinic?.city || 'Локация'}</p>
                </div>
              </div>
            </div>
          ) : null}
          <div className="space-y-2 text-sm text-lapka-700">
            <p><span className="font-semibold text-lapka-900">Клиника:</span> {vet.clinic?.name || '—'}</p>
            <p><span className="font-semibold text-lapka-900">Адрес:</span> {vet.clinic?.address || '—'}</p>
            <p><span className="font-semibold text-lapka-900">Телефон:</span> {vet.clinic?.phone || '—'}</p>
          </div>
          <div className="mt-3 space-y-2">
            {(vet.schedule_preview || []).length ? (
              vet.schedule_preview.map((row, index) => (
                <div key={`${row.weekday}-${index}`} className="rounded-xl border border-lapka-200 bg-white px-3 py-2 text-sm">
                  День {row.weekday}: {row.start_time} - {row.end_time} · слот {row.slot_duration} мин
                </div>
              ))
            ) : (
              <EmptyState title="График уточняется" text="Расписание врача будет опубликовано администратором." />
            )}
          </div>
          <div className="mt-3">
            <Link className="btn-primary w-full" href={`/owner/appointments?clinic_id=${vet.clinic?.id || ''}&vet_id=${vet.id}`}>
              Записаться к врачу
            </Link>
          </div>
          {clinicGallery.length > 1 ? (
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {clinicGallery.slice(0, 3).map((imageSrc, index) => (
                <div key={`${imageSrc}-${index}`} className="overflow-hidden rounded-2xl border border-lapka-200 bg-lapka-50">
                  <AppImage
                    src={imageSrc}
                    alt={`${vet.clinic?.name || 'Клиника'} — фото ${index + 1}`}
                    width={480}
                    height={320}
                    sizes="(max-width: 768px) 100vw, 160px"
                    className="h-20 w-full object-cover"
                  />
                </div>
              ))}
            </div>
          ) : null}
        </Card>
      </section>

      <Card className="mt-4 overflow-hidden p-0">
        <div className="grid gap-0 md:grid-cols-[240px_1fr]">
          <AppImage
            src={resolveVetPhoto(vet)}
            alt={vet.full_name}
            width={960}
            height={960}
            sizes="240px"
            className="h-64 w-full object-cover"
          />
          <div className="space-y-3 p-4">
            <div>
              <p className="text-sm text-lapka-600">{vet.specialty || 'Ветеринарный врач'}</p>
              <p className="text-2xl font-extrabold text-lapka-900">{vet.full_name}</p>
              <p className="text-sm text-amber-600">
                {stars(vet.rating_summary?.avg_rating)} {vet.rating_summary?.avg_rating?.toFixed?.(1) || '0.0'} · {vet.rating_summary?.count || 0} отзывов
              </p>
            </div>
            <p className="text-sm text-lapka-700">{vet.bio || 'Работает по клиническим стандартам и ведёт подробные цифровые протоколы.'}</p>
            <div className="flex flex-wrap gap-1.5">
              {(vet.languages || []).map((lang) => (
                <span key={`${vet.id}-${lang}`} className="pill !text-[11px]">{lang}</span>
              ))}
              {vet.working_hours ? <span className="pill !text-[11px]">{vet.working_hours}</span> : null}
            </div>
          </div>
        </div>
      </Card>

      <section className="grid-soft-2">
        <Card title="Почему выбирают этого врача" subtitle="Краткий профиль без перегруженной медицинской терминологии">
          <div className="grid gap-2 text-sm text-lapka-700">
            <div className="rounded-2xl border border-lapka-200 bg-white px-4 py-3">
              <p className="font-semibold text-lapka-900">Понятный маршрут приёма</p>
              <p className="mt-1">Владелец видит протокол визита, документы и защищённые ссылки на назначения без лишней сложности.</p>
            </div>
            <div className="rounded-2xl border border-lapka-200 bg-white px-4 py-3">
              <p className="font-semibold text-lapka-900">Цифровая коммуникация</p>
              <p className="mt-1">Поддержка записи, напоминаний, анализа документов и безопасной сводки для владельца.</p>
            </div>
          </div>
        </Card>

        <Card title="Подходит для сценариев" subtitle="Самые частые задачи владельца у этого врача">
          <div className="grid gap-2 text-sm text-lapka-700">
            <div className="rounded-2xl border border-lapka-200 bg-lapka-50 px-4 py-3">
              <p className="font-semibold text-lapka-900">Первичный осмотр и симптомы</p>
              <p className="mt-1">Подходит для случаев, когда нужно быстро перейти от оценки симптомов к структурированному приёму.</p>
            </div>
            <div className="rounded-2xl border border-lapka-200 bg-white px-4 py-3">
              <p className="font-semibold text-lapka-900">Контроль документов и анализов</p>
              <p className="mt-1">Удобен, если нужно загрузить исследования и обсудить результаты уже в контексте визита.</p>
            </div>
            <div className="rounded-2xl border border-lapka-200 bg-white px-4 py-3">
              <p className="font-semibold text-lapka-900">Плановый контрольный визит</p>
              <p className="mt-1">Подходит для повторного визита, контроля динамики и обновления единой карты питомца.</p>
            </div>
          </div>
        </Card>
      </section>

      <section className="grid items-start gap-4 2xl:grid-cols-2">
        {[
          {
            title: 'Когда нужен первый осмотр',
            text: 'Подходит, если вы только начинаете маршрут и хотите быстро перейти от симптомов к полноценному приёму.',
          },
          {
            title: 'Когда есть документы и анализы',
            text: 'Удобно, если нужно прийти уже с результатами исследований и обсудить их в рамках структурированного визита.',
          },
          {
            title: 'Когда нужен контроль динамики',
            text: 'Повторный визит помогает обновить карту питомца, посмотреть историю и сохранить единый маршрут наблюдения.',
          },
        ].map((item) => (
          <Card key={item.title} title={item.title}>
            <p className="text-sm leading-7 text-lapka-700">{item.text}</p>
          </Card>
        ))}
      </section>

      <Card
        title="Отзывы о враче"
        action={
          <select className="input !w-auto !py-1.5" value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
            <option value="newest">Сначала новые</option>
            <option value="highest">Сначала высокий рейтинг</option>
          </select>
        }
      >
        {sortedReviews.length ? (
          <div className="space-y-2">
            {sortedReviews.map((row) => (
              <article key={row.id} className="rounded-xl border border-lapka-200 bg-white p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold text-lapka-900">{row.title || 'Отзыв'}</p>
                  <p className="text-sm font-semibold text-amber-600">{'★'.repeat(row.rating)}{'☆'.repeat(Math.max(0, 5 - row.rating))}</p>
                </div>
                <p className="mt-1 text-sm text-lapka-700">{row.text}</p>
                <div className="mt-2 flex flex-wrap gap-2 text-xs text-lapka-600">
                  <span>{new Date(row.created_at).toLocaleString('ru-RU')}</span>
                  {row.verified ? <span className="badge-green">Проверенный визит</span> : null}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState title="Нет отзывов" text="Станьте первым, кто оставит отзыв после визита." />
        )}
        {cursor ? (
          <div className="mt-3">
            <button className="btn-secondary" type="button" onClick={loadMore} disabled={loadingMore}>
              {loadingMore ? 'Загружаем...' : 'Показать ещё'}
            </button>
          </div>
        ) : null}
      </Card>

      <Card title="Следующие действия" subtitle="Переходы, которые чаще всего нужны владельцу после выбора врача" tone="mint">
        <div className="grid gap-2 sm:grid-cols-3">
          <Link className="action-grid-link" href={`/owner/appointments?clinic_id=${vet.clinic?.id || ''}&vet_id=${vet.id}`}>
            Записаться к врачу
          </Link>
          <Link className="action-grid-link" href="/owner/documents">
            Открыть документы питомца
          </Link>
          <Link className="action-grid-link" href="/owner/triage">
            Оценить срочность симптомов
          </Link>
        </div>
      </Card>
    </>
  );
}
