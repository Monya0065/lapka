'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import Card from '@/components/ui/Card';
import EmptyState from '@/components/ui/EmptyState';
import ErrorBanner from '@/components/ui/ErrorBanner';
import Skeleton from '@/components/ui/Skeleton';
import ShowcasePanel from '@/components/ui/ShowcasePanel';
import Table from '@/components/ui/Table';
import { apiRequest } from '@/lib/api';

function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString('ru-RU');
}

function localizeEventType(type) {
  const map = {
    status_update: 'Обновление статуса',
    photo_report: 'Фото-отчёт',
    note: 'Заметка',
    document_added: 'Документ',
    camera_viewed: 'Просмотр камеры',
    vitals_check: 'Контроль показателей',
    feeding: 'Кормление',
    procedure: 'Процедура',
  };
  return map[type] || type || '—';
}

function localizeStayStatus(status) {
  const map = {
    active: 'Активный',
    discharged: 'Выписан',
    transferred: 'Переведён',
  };
  return map[status] || status || '—';
}

function localizePublicStatus(status) {
  const map = {
    stable: 'Стабильно',
    monitoring: 'Под наблюдением',
    needs_attention: 'Нужно внимание',
  };
  return map[status] || status || '—';
}

export default function ClinicInpatientDetailPage() {
  const params = useParams();
  const stayId = useMemo(() => params?.stayId || '', [params]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [stay, setStay] = useState(null);
  const [events, setEvents] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [members, setMembers] = useState([]);
  const [selectedVetId, setSelectedVetId] = useState('');
  const [savingAssign, setSavingAssign] = useState(false);

  const loadData = useCallback(async () => {
    if (!stayId) return;
    setLoading(true);
    setError('');
    try {
      const [stayPayload, eventsPayload, photosPayload, membersPayload] = await Promise.all([
        apiRequest(`/api/v1/inpatient/stays/${stayId}`),
        apiRequest(`/api/v1/inpatient/stays/${stayId}/events`),
        apiRequest(`/api/v1/inpatient/stays/${stayId}/photos`),
        apiRequest('/api/v1/clinics/me/members'),
      ]);
      const vets = (Array.isArray(membersPayload) ? membersPayload : []).filter((row) => row.role_in_clinic === 'vet');
      setStay(stayPayload || null);
      setEvents(Array.isArray(eventsPayload) ? eventsPayload : []);
      setPhotos(Array.isArray(photosPayload) ? photosPayload : []);
      setMembers(vets);
      setSelectedVetId(stayPayload?.attending_vet_id || vets[0]?.user_id || '');
    } catch (requestError) {
      setError(requestError.message || 'Не удалось загрузить стационарную карточку');
      setStay(null);
      setEvents([]);
      setPhotos([]);
      setMembers([]);
    } finally {
      setLoading(false);
    }
  }, [stayId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function assignVet() {
    if (!selectedVetId) {
      setError('Выберите врача для назначения.');
      return;
    }
    setSavingAssign(true);
    setError('');
    setSuccess('');
    try {
      await apiRequest(`/api/v1/inpatient/stays/${stayId}/assign`, {
        method: 'POST',
        body: { vet_id: selectedVetId },
      });
      setSuccess('Ответственный врач обновлён.');
      await loadData();
    } catch (requestError) {
      setError(requestError.message || 'Не удалось назначить врача');
    } finally {
      setSavingAssign(false);
    }
  }

  const assignedVet = useMemo(
    () => members.find((member) => member.user_id === selectedVetId),
    [members, selectedVetId]
  );

  const lastPhoto = useMemo(() => photos[0] || null, [photos]);
  const lastOwnerVisibleEvent = useMemo(
    () => events.find((row) => row.owner_visible) || null,
    [events]
  );

  return (
    <>
      <header className="page-header">
        <div>
          <h1 className="page-title">Карточка стационара клиники</h1>
          <p className="page-subtitle">Кейс стационара: обновления, фото-отчёты, ответственный врач и прозрачная история доступа.</p>
        </div>
        <button className="btn-secondary" type="button" onClick={loadData}>
          Обновить
        </button>
      </header>

      {error ? <ErrorBanner message={error} onRetry={loadData} /> : null}
      {success ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{success}</div> : null}

      {loading ? (
        <section className="space-y-4">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-64 w-full" />
        </section>
      ) : !stay ? (
        <EmptyState title="Карточка стационара не найдена" text="Проверьте ссылку или выберите пациента из списка стационара." />
      ) : (
        <>
          <ShowcasePanel
            eyebrow="Стационар клиники"
            title={`Палата ${stay.ward}/${stay.bed}: контроль обновлений, SLA и ответственной команды`}
            description="Администратор контролирует фото-отчёты, ответственного врача и полноту стационарной карточки. Экран показывает только ключевые сигналы: обновления, то, что видит владелец, и соблюдение регламента."
            imageSrc="/assets/img/admin-side.svg"
            imageAlt="Стационар клиники"
            badges={[
              `Статус: ${localizeStayStatus(stay.status)}`,
              `Статус для владельца: ${localizePublicStatus(stay.public_status_label)}`,
              `${events.length} событий`,
            ]}
            compact
          />

          <section className="kpi-grid">
            <Card title="События" subtitle="Все обновления по кейсу">
              <p className="text-4xl font-black text-lapka-900">{events.length}</p>
            </Card>
            <Card title="Фото-отчёты" subtitle="Опубликованные визуальные обновления">
              <p className="text-4xl font-black text-lapka-900">{photos.length}</p>
            </Card>
            <Card title="Статус для владельца" subtitle="Как кейс выглядит во внешнем контуре">
              <p className="text-2xl font-black text-lapka-900">{localizePublicStatus(stay.public_status_label)}</p>
            </Card>
            <Card title="Ответственный врач" subtitle="Текущий куратор стационара">
              <p className="text-xl font-black text-lapka-900">{assignedVet?.full_name || assignedVet?.email || 'Не назначен'}</p>
            </Card>
          </section>

          <section className="grid items-start gap-4 2xl:grid-cols-[1.2fr_0.8fr]">
            <Card title={`Палата ${stay.ward}/${stay.bed}`} subtitle={`Статус: ${localizeStayStatus(stay.status)} · владельцу показывается: ${localizePublicStatus(stay.public_status_label)}`}>
              <p className="text-sm text-lapka-700">{stay.owner_visible_summary}</p>
              <div className="mt-3 rounded-xl border border-lapka-200 bg-lapka-50 px-3 py-2 text-sm text-lapka-700">
                Последнее обновление: {formatDate(events[0]?.created_at || stay.admitted_at)}
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <div className="rounded-[22px] border border-lapka-200 bg-white px-4 py-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-lapka-500">Последнее обновление для владельца</p>
                  <p className="mt-2 text-base font-semibold text-lapka-900">{lastOwnerVisibleEvent ? formatDate(lastOwnerVisibleEvent.created_at) : 'ещё не опубликовано'}</p>
                </div>
                <div className="rounded-[22px] border border-lapka-200 bg-white px-4 py-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-lapka-500">Последний фото-отчёт</p>
                  <p className="mt-2 text-base font-semibold text-lapka-900">{lastPhoto ? formatDate(lastPhoto.taken_at) : 'нет публикации'}</p>
                </div>
                <div className="rounded-[22px] border border-lapka-200 bg-white px-4 py-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-lapka-500">Ответственный врач</p>
                  <p className="mt-2 text-base font-semibold text-lapka-900">{assignedVet?.full_name || assignedVet?.email || 'не назначен'}</p>
                </div>
              </div>
            </Card>

            <Card title="Ответственный врач" subtitle="Организационное назначение для стационарного кейса">
              <label className="block">
                <span className="label">Врач стационара</span>
                <select className="input" value={selectedVetId} onChange={(event) => setSelectedVetId(event.target.value)}>
                  {members.map((member) => (
                    <option key={member.user_id} value={member.user_id}>
                      {member.full_name || member.user_full_name || member.email || member.user_id}
                    </option>
                  ))}
                </select>
              </label>
              <button className="btn-primary mt-3" type="button" onClick={assignVet} disabled={savingAssign}>
                {savingAssign ? 'Сохранение...' : 'Назначить'}
              </button>

              <div className="mt-4 grid gap-3">
                <Link href={`/clinic/patients/${stay.pet_id}`} className="rounded-[22px] border border-lapka-200 bg-white px-4 py-4 text-sm font-semibold text-lapka-800 transition hover:-translate-y-0.5 hover:shadow-card">
                  Открыть пациента в реестре
                </Link>
                <Link href="/clinic/schedule" className="rounded-[22px] border border-lapka-200 bg-white px-4 py-4 text-sm font-semibold text-lapka-800 transition hover:-translate-y-0.5 hover:shadow-card">
                  Проверить расписание команды
                </Link>
                <Link href="/clinic/inbox" className="rounded-[22px] border border-lapka-200 bg-white px-4 py-4 text-sm font-semibold text-lapka-800 transition hover:-translate-y-0.5 hover:shadow-card">
                  Открыть входящие клиники
                </Link>
              </div>
            </Card>
          </section>

          <section className="grid items-start gap-4 2xl:grid-cols-2">
            <Card title="События стационара" subtitle="Публикации, журнал обновлений и видимость для владельца">
              {events.length ? (
                <Table
                  columns={['Время', 'Тип', 'Заголовок', 'Видно владельцу']}
                  rows={events.slice(0, 30).map((row) => [
                    formatDate(row.created_at),
                    localizeEventType(row.event_type),
                    row.title,
                    row.owner_visible ? 'Да' : 'Нет',
                  ])}
                />
              ) : (
                <EmptyState title="События отсутствуют" text="После действий персонала события отобразятся в timeline." />
              )}
            </Card>

            <Card title="Фото-отчёты" subtitle="Визуальные обновления по кейсу и контроль частоты публикаций">
              {photos.length ? (
                <Table
                  columns={['Время', 'Подпись', 'Источник']}
                  rows={photos.slice(0, 20).map((row) => [formatDate(row.taken_at), row.caption, row.file_ref || 'Локальная загрузка'])}
                />
              ) : (
                <EmptyState title="Нет фото-отчётов" text="Проверьте выполнение SLA по фото-обновлениям." />
              )}
            </Card>
          </section>

          <section className="grid gap-4 2xl:grid-cols-2">
            {[
              {
                title: 'Сервисный поток',
                text: 'Проверьте, что последняя публикация, фото-отчёт и владелец-видимые обновления идут без провалов по времени.',
              },
              {
                title: 'Команда и ответственность',
                text: 'Убедитесь, что врач назначен, а карточка кейса не остаётся без куратора на длительное время.',
              },
              {
                title: 'Приватность',
                text: 'Камеры и карточка стационара должны открываться только по выданным правам доступа и фиксироваться в журнале.',
              },
            ].map((item) => (
              <Card key={item.title} title={item.title}>
                <p className="text-sm leading-7 text-lapka-700">{item.text}</p>
              </Card>
            ))}
          </section>
        </>
      )}
    </>
  );
}
