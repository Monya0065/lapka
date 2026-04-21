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
import { trackOwnerFunnelStep } from '@/lib/owner-funnel';
import { buildClinicVisualGallery, resolveClinicGallery, resolveClinicPhoto, resolveVetPhoto } from '@/lib/pets';

function stars(avg) {
  const value = Math.round(Number(avg || 0));
  return `${'★'.repeat(value)}${'☆'.repeat(Math.max(0, 5 - value))}`;
}

function ReviewList({ reviews }) {
  if (!reviews.length) {
    return <EmptyState title="Пока нет отзывов" text="Оставьте первый отзыв после визита." />;
  }
  return (
    <div className="space-y-2">
      {reviews.map((row) => (
        <article key={row.id} className="rounded-xl border border-lapka-200 bg-white p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-bold text-lapka-900">{row.title || 'Отзыв'}</p>
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
  );
}

export default function OwnerClinicDetailsPage({ params }) {
  const clinicId = params.id;
  const [clinic, setClinic] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [reviewsCursor, setReviewsCursor] = useState(null);
  const [reviewSort, setReviewSort] = useState('newest');
  const [visits, setVisits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [visitId, setVisitId] = useState('');

  useEffect(() => {
    trackOwnerFunnelStep('clinic_open', { source: 'clinic_profile', clinicId });
  }, [clinicId]);

  const loadClinicData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [clinicPayload, reviewsPayload, visitsPayload] = await Promise.all([
        apiRequest(`/api/v1/market/clinics/${encodeURIComponent(clinicId)}`),
        apiRequest(`/api/v1/market/clinics/${encodeURIComponent(clinicId)}/reviews?limit=20`),
        apiRequest('/api/v1/visits?limit=200'),
      ]);
      setClinic(clinicPayload || null);
      setReviews(Array.isArray(reviewsPayload?.items) ? reviewsPayload.items : []);
      setReviewsCursor(reviewsPayload?.next_cursor || null);
      const allVisits = Array.isArray(visitsPayload) ? visitsPayload : [];
      setVisits(allVisits.filter((row) => row.clinic_id === clinicId));
    } catch (requestError) {
      setError(requestError.message || 'Не удалось загрузить профиль клиники');
      setClinic(null);
      setReviews([]);
      setVisits([]);
      setReviewsCursor(null);
    } finally {
      setLoading(false);
    }
  }, [clinicId]);

  useEffect(() => {
    loadClinicData();
  }, [loadClinicData]);

  async function loadMoreReviews() {
    if (!reviewsCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const payload = await apiRequest(
        `/api/v1/market/clinics/${encodeURIComponent(clinicId)}/reviews?limit=20&cursor=${encodeURIComponent(reviewsCursor)}`
      );
      const nextItems = Array.isArray(payload?.items) ? payload.items : [];
      setReviews((prev) => [...prev, ...nextItems]);
      setReviewsCursor(payload?.next_cursor || null);
    } catch (requestError) {
      setError(requestError.message || 'Не удалось загрузить дополнительные отзывы');
    } finally {
      setLoadingMore(false);
    }
  }

  async function submitReview(event) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    setSuccess('');
    try {
      const payload = await apiRequest('/api/v1/reviews', {
        method: 'POST',
        body: {
          target_type: 'clinic',
          target_id: clinicId,
          rating,
          title: title || null,
          text,
          visit_id: visitId || null,
        },
      });
      setSuccess(payload?.message || 'Отзыв отправлен.');
      setModalOpen(false);
      setTitle('');
      setText('');
      setVisitId('');
      setRating(5);
      await loadClinicData();
    } catch (requestError) {
      setError(requestError.message || 'Не удалось отправить отзыв');
    } finally {
      setSubmitting(false);
    }
  }

  const sortedReviews = useMemo(() => {
    const next = [...reviews];
    if (reviewSort === 'highest') {
      next.sort((a, b) => b.rating - a.rating || new Date(b.created_at) - new Date(a.created_at));
      return next;
    }
    next.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    return next;
  }, [reviews, reviewSort]);

  const clinicGallery = useMemo(() => resolveClinicGallery(clinic), [clinic]);
  const clinicVisualGallery = useMemo(() => buildClinicVisualGallery(clinic), [clinic]);

  if (loading) {
    return (
      <section className="space-y-3">
        <Skeleton className="h-56 w-full" />
        <Skeleton className="h-72 w-full" />
        <Skeleton className="h-72 w-full" />
      </section>
    );
  }

  if (!clinic) {
    return <ErrorBanner message={error || 'Клиника не найдена'} onRetry={loadClinicData} />;
  }

  return (
    <>
      <header className="page-header">
        <div>
          <h1 className="page-title">{clinic.name}</h1>
          <p className="page-subtitle">{clinic.description || 'Профиль клиники с услугами, врачами и быстрым переходом к записи.'}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link className="btn-secondary" href="/owner/market">Назад к поиску</Link>
          <Link
            className="btn-primary"
            href={`/owner/appointments?clinic_id=${clinic.id}`}
            onClick={() => trackOwnerFunnelStep('booking_open', { source: 'clinic_header_cta', clinicId: clinic.id })}
          >
            Записаться
          </Link>
        </div>
      </header>

      {error ? <ErrorBanner message={error} onRetry={loadClinicData} /> : null}
      {success ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{success}</div> : null}

      <ShowcasePanel
        eyebrow="Профиль клиники"
        title={`${clinic.name}: услуги, врачи и запись в одном окне`}
        description="Карточка помогает быстро оценить формат клиники, команду, расписание и перейти к записи без лишнего переключения между экранами. Приоритет — быстро понять, подходит ли клиника именно вашему питомцу."
        imageSrc="/assets/img/clinic-ops.svg"
        imageAlt="Профиль клиники"
        badges={[
          clinic.city || 'Город не указан',
          `${clinic.rating_summary?.count || 0} отзывов`,
          clinic.emergency_available ? 'Экстренный приём доступен' : 'Плановый формат',
        ]}
      />

      <section className="kpi-grid">
        <Card title="Рейтинг" subtitle="Средняя оценка владельцев">
          <p className="text-4xl font-black tracking-tight text-lapka-900">{clinic.rating_summary?.avg_rating?.toFixed?.(1) || '0.0'}</p>
        </Card>
        <Card title="Отзывы" subtitle="Все опубликованные отзывы">
          <p className="text-4xl font-black tracking-tight text-lapka-900">{clinic.rating_summary?.count || 0}</p>
        </Card>
        <Card title="Услуги" subtitle="Доступные сценарии записи">
          <p className="text-4xl font-black tracking-tight text-lapka-900">{clinic.services?.length || 0}</p>
        </Card>
        <Card title="Врачи" subtitle="Команда клиники">
          <p className="text-4xl font-black tracking-tight text-lapka-900">{clinic.vets?.length || 0}</p>
        </Card>
      </section>

      <section className="grid-soft-2">
        <Card title="Коротко о клинике" subtitle="То, что важно владельцу до записи">
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="rounded-2xl border border-lapka-200 bg-lapka-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-lapka-500">Формат</p>
              <p className="mt-2 text-xl font-black text-lapka-900">
                {clinic.emergency_available ? 'Экстренный и плановый приём' : 'Плановый и повторный приём'}
              </p>
              <p className="mt-2 text-sm text-lapka-700">
                Клиника подходит для регулярных визитов, анализов, вакцинации и связанного цифрового маршрута питомца.
              </p>
            </div>
            <div className="rounded-2xl border border-lapka-200 bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-lapka-500">Время и логистика</p>
              <div className="mt-2 space-y-2 text-sm text-lapka-700">
                <p><span className="font-semibold text-lapka-900">Часы работы:</span> {clinic.hours || 'Уточняются'}</p>
                <p><span className="font-semibold text-lapka-900">Адрес:</span> {clinic.address || 'Уточняется'}</p>
                <p><span className="font-semibold text-lapka-900">Город:</span> {clinic.city || 'Не указан'}</p>
                <p><span className="font-semibold text-lapka-900">Телефон:</span> {clinic.phone || 'Уточняется'}</p>
              </div>
            </div>
          </div>
        </Card>

        <Card title="Сценарии записи" subtitle="Самые частые маршруты владельца внутри клиники">
          <div className="grid gap-2 text-sm text-lapka-700">
            <div className="rounded-2xl border border-lapka-200 bg-white px-4 py-3">
              <p className="font-semibold text-lapka-900">Первичный приём</p>
              <p className="mt-1">Подходит для нового обращения, оценки симптомов и загрузки документов перед визитом.</p>
            </div>
            <div className="rounded-2xl border border-lapka-200 bg-white px-4 py-3">
              <p className="font-semibold text-lapka-900">Контрольный визит</p>
              <p className="mt-1">Удобен для повторной оценки состояния, просмотра анализов, вакцинации и контрольного осмотра после приёма.</p>
            </div>
            <div className="rounded-2xl border border-lapka-200 bg-white px-4 py-3">
              <p className="font-semibold text-lapka-900">Стационар и наблюдение</p>
              <p className="mt-1">Если в клинике есть стационар, владелец получает фото-отчёты, события и камеры по выданному уровню доступа.</p>
            </div>
          </div>
        </Card>
      </section>

      <section className="grid items-start gap-4 2xl:grid-cols-2">
        {[
          {
            title: 'Подходит для первого визита',
            text: 'Если нужно быстро выбрать клинику для нового обращения, здесь уже видно рейтинг, врачей и основные услуги.',
          },
          {
            title: 'Подходит для контроля лечения',
            text: 'Удобно, если нужно загрузить документы, прийти на повторный визит и сохранить всю историю в одной карте питомца.',
          },
          {
            title: 'Подходит для стационара',
            text: 'Если у клиники есть стационар, владелец получает понятные обновления, фото-отчёты и камеры по выданному уровню доступа.',
          },
        ].map((item) => (
          <Card key={item.title} title={item.title}>
            <p className="text-sm leading-7 text-lapka-700">{item.text}</p>
          </Card>
        ))}
      </section>

      <section className="grid items-start gap-4 2xl:grid-cols-[1.08fr_0.92fr]">
        <EntityVisualGallery
          items={clinicVisualGallery}
          title="Фото и пространство клиники"
          subtitle="Фасад, интерьер и зона приёма помогают понять формат клиники до записи."
        />
        <Card className="overflow-hidden p-0">
          <div className="relative h-64 w-full">
            <AppImage
              src={resolveClinicPhoto(clinic)}
              alt={`Клиника ${clinic.name}`}
              fill
              sizes="(max-width: 1280px) 100vw, 640px"
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-lapka-900/55 via-lapka-900/10 to-transparent" />
            <div className="absolute bottom-4 left-4 right-4 flex flex-wrap items-end justify-between gap-3">
              <div className="rounded-xl bg-white/90 px-3 py-2 backdrop-blur">
                <p className="text-lg font-extrabold text-lapka-900">{clinic.name}</p>
                <p className="text-sm text-lapka-700">{clinic.city} · {clinic.address}</p>
              </div>
              <div className="rounded-xl bg-white/90 px-3 py-2 text-right backdrop-blur">
                <p className="text-sm font-semibold text-amber-600">
                  {stars(clinic.rating_summary?.avg_rating)} {clinic.rating_summary?.avg_rating?.toFixed?.(1) || '0.0'}
                </p>
                <p className="text-xs text-lapka-600">{clinic.rating_summary?.count || 0} отзывов</p>
              </div>
            </div>
          </div>
          <div className="grid gap-2 border-t border-lapka-200 bg-white p-4 md:grid-cols-4">
            <span className="pill">⏰ {clinic.hours || 'График уточняется'}</span>
            <span className="pill">📍 {clinic.address}</span>
            <span className="pill">☎ {clinic.phone || 'телефон уточняется'}</span>
            <span className={clinic.emergency_available ? 'badge-red' : 'badge-green'}>
              {clinic.emergency_available ? 'Экстренный приём доступен' : 'Плановый формат'}
            </span>
          </div>
          {clinicGallery.length > 1 ? (
            <div className="grid gap-3 border-t border-lapka-200 bg-lapka-50 p-4 md:grid-cols-3">
              {clinicGallery.slice(0, 3).map((imageSrc, index) => (
                <div key={`${imageSrc}-${index}`} className="overflow-hidden rounded-2xl border border-lapka-200 bg-white">
                  <AppImage
                    src={imageSrc}
                    alt={`${clinic.name} — фото ${index + 1}`}
                    width={960}
                    height={640}
                    sizes="(max-width: 1024px) 100vw, 320px"
                    className="h-36 w-full object-cover"
                  />
                </div>
              ))}
            </div>
          ) : null}
        </Card>
      </section>

      <section className="grid items-start gap-4 2xl:grid-cols-[1.05fr_0.95fr]">
        <Card title="Услуги клиники">
          {clinic.services?.length ? (
            <div className="grid gap-2">
              {clinic.services.map((row) => (
                <div key={row.id} className="rounded-xl border border-lapka-200 bg-white p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold text-lapka-900">{row.name}</p>
                    <p className="text-sm text-lapka-600">{row.duration_min} мин · {row.price} ₽</p>
                  </div>
                  <div className="mt-2">
                    <Link
                      className="btn-secondary !px-3 !py-1.5"
                      href={`/owner/appointments?clinic_id=${clinic.id}&service=${encodeURIComponent(row.name)}`}
                      onClick={() => trackOwnerFunnelStep('booking_open', { source: 'clinic_service_card', clinicId: clinic.id })}
                    >
                      Записаться на услугу
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="Каталог услуг пока пуст" text="Клиника ещё не заполнила список услуг для этого профиля." />
          )}
        </Card>

        <Card title="Врачи клиники">
          {clinic.vets?.length ? (
            <div className="grid gap-2">
              {clinic.vets.map((row) => (
                <article key={row.id} className="rounded-xl border border-lapka-200 bg-white p-3">
                  <div className="flex items-start gap-3">
                    <AppImage
                      src={resolveVetPhoto(row)}
                      alt={row.full_name}
                      width={224}
                      height={224}
                      sizes="56px"
                      className="h-14 w-14 rounded-xl object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-lapka-900">{row.full_name}</p>
                      <p className="text-sm text-lapka-600">{row.specialty || 'Ветеринарный врач'}</p>
                      <p className="text-xs text-lapka-600">
                        {stars(row.rating_summary?.avg_rating)} {row.rating_summary?.avg_rating?.toFixed?.(1) || '0.0'}
                      </p>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Link className="btn-secondary !px-3 !py-1.5" href={`/owner/vet/${row.id}`}>Профиль врача</Link>
                    <Link
                      className="btn-primary !px-3 !py-1.5"
                      href={`/owner/appointments?clinic_id=${clinic.id}&vet_id=${row.id}`}
                      onClick={() => trackOwnerFunnelStep('booking_open', { source: 'clinic_vet_card', clinicId: clinic.id })}
                    >
                      Записаться
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState title="Врачи загружаются" text="Проверьте позже или выберите другую клинику." />
          )}
        </Card>
      </section>

      <section className="grid-soft-2">
        <Card title="Почему удобно владельцу" subtitle="Ключевые преимущества без перегруза лишними шагами">
          <div className="grid gap-2 text-sm text-lapka-700">
            <div className="rounded-xl border border-lapka-200 bg-white px-3 py-2">Единая цифровая карта питомца и история визитов.</div>
            <div className="rounded-xl border border-lapka-200 bg-white px-3 py-2">Переход к записи в один клик с уже выбранной клиникой.</div>
            <div className="rounded-xl border border-lapka-200 bg-white px-3 py-2">Отзывы владельцев и прозрачный рейтинг врачей.</div>
            <div className="rounded-xl border border-lapka-200 bg-white px-3 py-2">Связка с анализами, стационаром и защищёнными ссылками на назначения.</div>
          </div>
        </Card>

        <Card title="Быстрые действия" subtitle="Самые частые сценарии владельца в контексте клиники">
          <div className="grid gap-2 sm:grid-cols-2">
            <Link
              className="action-grid-link"
              href={`/owner/appointments?clinic_id=${clinic.id}`}
              onClick={() => trackOwnerFunnelStep('booking_open', { source: 'clinic_quick_actions', clinicId: clinic.id })}
            >
              Записаться в клинику
            </Link>
            <Link className="action-grid-link" href="/owner/map">Открыть на карте</Link>
            <Link className="action-grid-link" href="/owner/pharmacy">Найти препараты рядом</Link>
            <Link className="action-grid-link" href="/owner/insurance">Страхование и документы</Link>
          </div>
        </Card>
      </section>

      <Card
        title="Отзывы владельцев"
        subtitle="Сортировка: новые или с высоким рейтингом"
        action={
          <div className="flex flex-wrap gap-2">
            <select className="input !w-auto !py-1.5" value={reviewSort} onChange={(event) => setReviewSort(event.target.value)}>
              <option value="newest">Сначала новые</option>
              <option value="highest">Сначала высокий рейтинг</option>
            </select>
            <button className="btn-primary !px-3 !py-1.5" type="button" onClick={() => setModalOpen(true)}>
              Оставить отзыв
            </button>
          </div>
        }
      >
        <ReviewList reviews={sortedReviews} />
        {reviewsCursor ? (
          <div className="mt-3">
            <button className="btn-secondary" type="button" onClick={loadMoreReviews} disabled={loadingMore}>
              {loadingMore ? 'Загружаем...' : 'Показать ещё'}
            </button>
          </div>
        ) : null}
      </Card>

      {modalOpen ? (
        <div className="fixed inset-0 z-[90] bg-lapka-900/45 p-4 backdrop-blur-sm">
          <div className="mx-auto mt-8 w-full max-w-xl animate-fade-in-up">
            <Card
              title="Новый отзыв"
              subtitle="Проверенный отзыв можно связать с ID визита"
              action={<button className="btn-secondary" onClick={() => setModalOpen(false)} type="button">Закрыть</button>}
            >
              <form className="space-y-3" onSubmit={submitReview}>
                <label className="block">
                  <span className="label">Рейтинг</span>
                  <div className="flex flex-wrap gap-2">
                    {[5, 4, 3, 2, 1].map((value) => (
                      <button
                        key={value}
                        type="button"
                        className={rating === value ? 'btn-primary !px-3 !py-1.5' : 'btn-secondary !px-3 !py-1.5'}
                        onClick={() => setRating(value)}
                      >
                        {value} ★
                      </button>
                    ))}
                  </div>
                </label>
                <label className="block">
                  <span className="label">Заголовок</span>
                  <input className="input" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={255} />
                </label>
                <label className="block">
                  <span className="label">Текст отзыва</span>
                  <textarea className="input min-h-28" value={text} onChange={(event) => setText(event.target.value)} required />
                </label>
                <label className="block">
                  <span className="label">ID визита (опционально, для verified)</span>
                  <select className="input" value={visitId} onChange={(event) => setVisitId(event.target.value)}>
                    <option value="">Без привязки</option>
                    {visits.map((row) => (
                      <option key={row.id} value={row.id}>
                        {row.id} · {new Date(row.created_at).toLocaleDateString('ru-RU')}
                      </option>
                    ))}
                  </select>
                </label>
                <button className="btn-primary" type="submit" disabled={submitting}>
                  {submitting ? 'Сохраняем...' : 'Отправить отзыв'}
                </button>
              </form>
            </Card>
          </div>
        </div>
      ) : null}
    </>
  );
}
