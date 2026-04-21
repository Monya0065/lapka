'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import AppImage from '@/components/ui/AppImage';
import Card from '@/components/ui/Card';
import EmptyState from '@/components/ui/EmptyState';
import ErrorBanner from '@/components/ui/ErrorBanner';
import Skeleton from '@/components/ui/Skeleton';
import ShowcasePanel from '@/components/ui/ShowcasePanel';
import PetVisualGallery from '@/components/ui/PetVisualGallery';
import { apiRequest } from '@/lib/api';
import { resolvePetPhoto } from '@/lib/pets';

function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString('ru-RU');
}

function groupEventsByDay(events) {
  const groups = {};
  events.forEach((event) => {
    const key = new Date(event.created_at).toLocaleDateString('ru-RU');
    if (!groups[key]) groups[key] = [];
    groups[key].push(event);
  });
  return Object.entries(groups).map(([day, items]) => ({ day, items }));
}

function statusBadge(stay) {
  if (!stay) return null;
  if (stay.public_status_label === 'stable') {
    return <span className="badge-green">Стабильно</span>;
  }
  if (stay.public_status_label === 'needs_attention') {
    return <span className="badge-red">Нужно внимание команды</span>;
  }
  return <span className="badge-yellow">Под наблюдением</span>;
}

function visualPhotoSource(fileRef) {
  if (!fileRef) return '/assets/img/inpatient-photo.svg';
  if (fileRef.startsWith('http://') || fileRef.startsWith('https://') || fileRef.startsWith('/assets/')) {
    return fileRef;
  }
  if (fileRef.startsWith('storage/') || fileRef.startsWith('/storage/')) {
    const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    return `${base}/${fileRef.replace(/^\//, '')}`;
  }
  return '/assets/img/inpatient-photo.svg';
}

export default function OwnerInpatientDetailPage() {
  const params = useParams();
  const stayId = useMemo(() => params?.stayId || '', [params]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [payload, setPayload] = useState(null);
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [cameraError, setCameraError] = useState('');
  const [cameraLoadingId, setCameraLoadingId] = useState('');
  const [cameraStream, setCameraStream] = useState(null);

  const loadData = useCallback(async () => {
    if (!stayId) return;
    setLoading(true);
    setError('');
    try {
      const details = await apiRequest(`/api/v1/inpatient/owner/inpatient/${stayId}`);
      setPayload(details || null);
    } catch (requestError) {
      setError(requestError.message || 'Не удалось загрузить данные стационара');
      setPayload(null);
    } finally {
      setLoading(false);
    }
  }, [stayId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function openCamera(cameraId) {
    if (!payload?.stay?.id) return;
    setCameraError('');
    setCameraLoadingId(cameraId);
    setCameraStream(null);
    try {
      const tokenRow = await apiRequest(`/api/v1/inpatient/owner/inpatient/${payload.stay.id}/camera-token`, {
        method: 'POST',
        body: { camera_id: cameraId, one_time: false, ttl_minutes: 20 },
      });
      const stream = await apiRequest(
        `/api/v1/inpatient/owner/inpatient/camera-stream?token=${encodeURIComponent(tokenRow.token)}`
      );
      setCameraStream({ ...stream, camera_id: cameraId, expires_at: tokenRow.expires_in_minutes });
    } catch (requestError) {
      setCameraError(requestError.message || 'Не удалось открыть камеру');
    } finally {
      setCameraLoadingId('');
    }
  }

  const eventGroups = useMemo(() => groupEventsByDay(payload?.events || []), [payload]);

  return (
    <>
      <header className="page-header">
        <div>
          <h1 className="page-title">Стационар: {payload?.pet?.name || 'питомец'}</h1>
          <p className="page-subtitle">
            Понятный экран для владельца: ежедневные обновления, фото-отчёты, вопросы врачу и защищённый доступ к камерам.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/owner/inpatient" className="btn-secondary">
            Все стационары
          </Link>
          <button className="btn-secondary" type="button" onClick={loadData}>
            Обновить
          </button>
        </div>
      </header>

      {error ? <ErrorBanner message={error} onRetry={loadData} /> : null}

      {loading ? (
        <section className="space-y-4">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-72 w-full" />
        </section>
      ) : !payload ? (
        <EmptyState title="Стационар не найден" text="Проверьте корректность ссылки или обновите страницу." />
      ) : (
        <>
          <ShowcasePanel
            eyebrow="Прозрачный стационар"
            title={`Стационар ${payload?.pet?.name || 'питомца'}: понятные обновления и защищённый доступ`}
            description="Владелец видит безопасную ленту событий, фото-отчёты и камеры только при активной госпитализации и выданном уровне доступа. В центре экрана — спокойный статус и действия, которые реально нужны сейчас."
            imageSrc={resolvePetPhoto(payload?.pet)}
            imageAlt={payload?.pet?.name || 'Питомец в стационаре'}
            badges={[
              payload?.stay?.ward ? `Палата ${payload.stay.ward}` : 'Стационар',
              payload?.stay?.bed ? `Место ${payload.stay.bed}` : 'Под наблюдением',
              `${payload?.photo_reports?.length || 0} фото-отчётов`,
            ]}
            compact
          />

          <section className="kpi-grid">
            <Card title="Обновления" subtitle="Лента событий по кейсу">
              <p className="text-4xl font-black tracking-tight text-lapka-900">{payload.events?.length || 0}</p>
            </Card>
            <Card title="Фото-отчёты" subtitle="Визуальная динамика по стационару">
              <p className="text-4xl font-black tracking-tight text-lapka-900">{payload.photo_reports?.length || 0}</p>
            </Card>
            <Card title="Камеры" subtitle="Доступные точки наблюдения">
              <p className="text-4xl font-black tracking-tight text-lapka-900">{payload.cameras?.length || 0}</p>
            </Card>
            <Card title="Вопросы врачу" subtitle="Подготовлено для следующего контакта">
              <p className="text-4xl font-black tracking-tight text-lapka-900">{payload.questions_to_ask_doctor?.length || 0}</p>
            </Card>
          </section>

          <section className="grid items-start gap-4 2xl:grid-cols-[1.2fr_0.8fr]">
            <Card title="Текущий статус" subtitle={`Врач: ${payload.attending_vet?.full_name || 'дежурный специалист'}`}>
              <div className="grid gap-4 md:grid-cols-[180px_minmax(0,1fr)]">
                <PetVisualGallery
                  pet={payload?.pet}
                  language="ru"
                  title="Визуальный контур питомца"
                  subtitle="Фото из карты, породный референс и 3D-визуал доступны в одном блоке."
                  compact
                  imageClassName="object-contain p-3"
                />
                <div>
                  <div className="flex flex-wrap items-center gap-2">{statusBadge(payload.stay)}</div>
                  <p className="mt-3 text-base text-lapka-700">{payload.stay.owner_visible_summary}</p>

                  <div className="mt-4 grid gap-2 text-sm text-lapka-700 sm:grid-cols-2">
                    <div className="rounded-xl border border-lapka-200 bg-lapka-50 px-3 py-2">Палата: {payload.stay.ward}</div>
                    <div className="rounded-xl border border-lapka-200 bg-lapka-50 px-3 py-2">Место: {payload.stay.bed}</div>
                    <div className="rounded-xl border border-lapka-200 bg-lapka-50 px-3 py-2">
                      Последнее обновление: {formatDate(payload.events?.[0]?.created_at || payload.stay.admitted_at)}
                    </div>
                    <div className="rounded-xl border border-lapka-200 bg-lapka-50 px-3 py-2">
                      Фото-отчётов: {payload.photo_reports?.length || 0}
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            <Card title="Доверие и безопасность" subtitle="RBAC, выданный доступ и журнал просмотров">
              <ul className="space-y-2 text-sm text-lapka-700">
                <li>• Доступ к стационару ограничен владельцем питомца и ролью персонала.</li>
                <li>• Камеры доступны только при активной госпитализации и отдельно выданном доступе.</li>
                <li>• Просмотры камер и карты фиксируются в журнале аудита.</li>
                <li>• AI не назначает лечение владельцу, только безопасные обновления по статусу.</li>
              </ul>
            </Card>
          </section>

          <section className="grid items-start gap-4 2xl:grid-cols-2">
            {[
              {
                title: 'Связаться с клиникой',
                text: 'Уточните время следующего контакта и договоритесь, когда ждать новое обновление в карточке стационара.',
              },
              {
                title: 'Подготовить вопросы',
                text: 'Зафиксируйте вопросы к врачу заранее, чтобы следующий разговор был коротким и предметным.',
              },
              {
                title: 'Следить спокойно',
                text: 'Камеры и фото-отчёты нужны для прозрачности. Они не заменяют разговор с врачом, а помогают видеть динамику.',
              },
            ].map((item) => (
              <Card key={item.title} title={item.title}>
                <p className="text-sm leading-7 text-lapka-700">{item.text}</p>
              </Card>
            ))}
          </section>

          <section className="grid items-start gap-4 2xl:grid-cols-[1.05fr_0.95fr]">
            <Card title="План на сегодня" subtitle="Понятные владельцу задачи команды на день">
              {payload.today_plan?.length ? (
                <div className="space-y-2">
                  {payload.today_plan.slice(0, 10).map((task) => (
                    <div key={task.id} className="rounded-xl border border-lapka-200 bg-white px-3 py-2">
                      <p className="text-sm font-semibold text-lapka-900">{task.task_text}</p>
                      <p className="text-xs text-lapka-500">{formatDate(task.plan_date)}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState title="План не заполнен" text="Дежурный врач добавит задачи в ближайшее обновление." />
              )}
            </Card>

            <Card title="Вопросы врачу" subtitle="Подготовьте вопросы к следующему контакту">
              <div className="space-y-2">
                {(payload.questions_to_ask_doctor || []).map((item, index) => (
                  <div key={index} className="rounded-xl border border-lapka-200 bg-white px-3 py-2 text-sm text-lapka-700">
                    {item}
                  </div>
                ))}
              </div>
              <p className="mt-3 text-xs text-lapka-600">{payload.safety_note}</p>
              <div className="mt-3 grid gap-2">
                <Link href="/owner/inbox" className="btn-secondary w-full">
                  Открыть входящие
                </Link>
                <Link href={`/owner/pet/${payload?.pet?.id || ''}`} className="btn-primary w-full">
                  Вернуться в карту питомца
                </Link>
              </div>
            </Card>
          </section>

          <section className="grid gap-4 2xl:grid-cols-[1.05fr_0.95fr]">
            <Card title="Фото-отчёты" subtitle="Визуальные обновления по стационару">
              {payload.photo_reports?.length ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {payload.photo_reports.slice(0, 6).map((report) => (
                    <button
                      key={report.id}
                      type="button"
                      onClick={() => setSelectedPhoto(report)}
                      className="overflow-hidden rounded-[24px] border border-lapka-200 bg-white text-left transition hover:-translate-y-0.5 hover:shadow-soft"
                    >
                      <AppImage
                        src={visualPhotoSource(report.file_ref)}
                        alt={report.caption || 'Фото-отчёт'}
                        width={960}
                        height={720}
                        sizes="(max-width: 1280px) 100vw, 420px"
                        className="h-48 w-full object-cover"
                      />
                      <div className="p-4">
                        <p className="text-sm font-semibold text-lapka-900">{report.caption || 'Фото-отчёт'}</p>
                        <p className="mt-1 text-xs text-lapka-500">{formatDate(report.created_at)}</p>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <EmptyState title="Фото-отчётов пока нет" text="Когда команда добавит фото-обновления, они появятся здесь." />
              )}
            </Card>

            <Card title="Камеры" subtitle="Защищённый доступ только при активной госпитализации и выданном уровне доступа">
              {payload.cameras?.length ? (
                <div className="space-y-3">
                  {payload.cameras.map((camera) => (
                    <div key={camera.id} className="rounded-[24px] border border-lapka-200 bg-white p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-base font-bold text-lapka-900">{camera.name || 'Камера палаты'}</p>
                          <p className="text-sm text-lapka-600">
                            {camera.is_active ? 'Камера доступна для просмотра' : 'Камера временно недоступна'}
                          </p>
                        </div>
                        <button
                          className="btn-primary"
                          type="button"
                          disabled={!camera.is_active || cameraLoadingId === camera.id}
                          onClick={() => openCamera(camera.id)}
                        >
                          {cameraLoadingId === camera.id ? 'Открываем...' : 'Открыть камеру'}
                        </button>
                      </div>
                    </div>
                  ))}

                  {cameraError ? <ErrorBanner message={cameraError} /> : null}

                  {cameraStream ? (
                    <div className="overflow-hidden rounded-[24px] border border-lapka-200 bg-lapka-50">
                      <div className="aspect-[16/10] w-full overflow-hidden bg-lapka-100">
                        <AppImage
                          src="/assets/img/inpatient-camera.svg"
                          alt="Поток камеры"
                          width={1280}
                          height={800}
                          sizes="(max-width: 1280px) 100vw, 480px"
                          className="h-full w-full object-cover"
                        />
                      </div>
                      <div className="space-y-1 px-4 py-4 text-sm text-lapka-700">
                        <p className="font-semibold text-lapka-900">Демо-поток активен</p>
                        <p>Токен выдан на ограниченное время. Просмотр фиксируется в журнале аудита клиники.</p>
                        <p className="text-xs text-lapka-500">Ссылка действует: {cameraStream.expires_at || 20} минут</p>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : (
                <EmptyState title="Камер нет" text="Если клиника подключит камеру палаты, она появится в этом разделе." />
              )}
            </Card>
          </section>

          <Card title="Лента обновлений" subtitle="Хронология событий сгруппирована по дням">
            {eventGroups.length ? (
              <div className="space-y-4">
                {eventGroups.map((group) => (
                  <section key={group.day} className="rounded-2xl border border-lapka-200 bg-white p-3">
                    <h3 className="text-sm font-bold uppercase tracking-wide text-lapka-600">{group.day}</h3>
                    <div className="mt-2 space-y-2">
                      {group.items.map((event) => (
                        <article key={event.id} className="rounded-xl border border-lapka-100 bg-lapka-50 px-3 py-2">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-sm font-semibold text-lapka-900">{event.title}</p>
                            <span className="text-xs text-lapka-500">{formatDate(event.created_at)}</span>
                          </div>
                          <p className="mt-1 text-sm text-lapka-700">{event.description_safe}</p>
                        </article>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            ) : (
              <EmptyState title="Обновлений пока нет" text="Лента появится после первых записей команды стационара." />
            )}
          </Card>

        </>
      )}

      {selectedPhoto ? (
        <div className="fixed inset-0 z-[90] grid place-items-center bg-lapka-900/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-4xl rounded-3xl border border-lapka-200 bg-white p-4 shadow-float">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="text-xl font-black text-lapka-900">{selectedPhoto.caption || 'Фото-отчёт'}</h3>
              <button className="btn-secondary" type="button" onClick={() => setSelectedPhoto(null)}>
                Закрыть
              </button>
            </div>
            <AppImage
              src={visualPhotoSource(selectedPhoto.file_ref)}
              alt={selectedPhoto.caption || 'Фото'}
              width={1600}
              height={1200}
              sizes="(max-width: 1200px) 100vw, 960px"
              className="max-h-[70vh] w-full rounded-2xl object-cover"
            />
            <p className="mt-2 text-sm text-lapka-600">{formatDate(selectedPhoto.taken_at)}</p>
          </div>
        </div>
      ) : null}
    </>
  );
}
