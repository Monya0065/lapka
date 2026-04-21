'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { useParams } from 'next/navigation';
import Card from '@/components/ui/Card';
import EmptyState from '@/components/ui/EmptyState';
import ErrorBanner from '@/components/ui/ErrorBanner';
import Skeleton from '@/components/ui/Skeleton';
import Table from '@/components/ui/Table';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import ShowcasePanel from '@/components/ui/ShowcasePanel';
import { apiRequest } from '@/lib/api';

function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString('ru-RU');
}

function localizePublicStatus(status) {
  const map = {
    stable: 'Стабильно',
    monitoring: 'Под наблюдением',
    needs_attention: 'Нужно внимание',
  };
  return map[status] || status || 'Под наблюдением';
}

const QUICK_CHECKLIST = [
  { type: 'feeding', title: 'Кормление выполнено', description: 'Отметка о выполненном кормлении.' },
  { type: 'vitals_check', title: 'Витальные показатели проверены', description: 'Плановый контроль жизненных показателей.' },
  { type: 'procedure', title: 'Процедура завершена', description: 'Плановая процедура завершена по внутреннему протоколу.' },
];

export default function VetInpatientDetailPage() {
  const params = useParams();
  const stayId = useMemo(() => params?.stayId || '', [params]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [stay, setStay] = useState(null);
  const [events, setEvents] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [plans, setPlans] = useState([]);
  const [eventForm, setEventForm] = useState({
    event_type: 'note',
    owner_visible: true,
    title: '',
    description_safe: '',
  });
  const [photoCaption, setPhotoCaption] = useState('Фото-отчёт дежурства');
  const [photoFile, setPhotoFile] = useState(null);
  const [docType, setDocType] = useState('lab_result');
  const [docRef, setDocRef] = useState('https://files.demo.lapka.local/inpatient/result.pdf');
  const [savingEvent, setSavingEvent] = useState(false);
  const [savingPhoto, setSavingPhoto] = useState(false);
  const [savingDoc, setSavingDoc] = useState(false);
  const [discharging, setDischarging] = useState(false);
  const [confirmDischargeOpen, setConfirmDischargeOpen] = useState(false);

  const loadData = useCallback(async () => {
    if (!stayId) return;
    setLoading(true);
    setError('');
    try {
      const [stayPayload, eventsPayload, photosPayload, plansPayload] = await Promise.all([
        apiRequest(`/api/v1/inpatient/stays/${stayId}`),
        apiRequest(`/api/v1/inpatient/stays/${stayId}/events`),
        apiRequest(`/api/v1/inpatient/stays/${stayId}/photos`),
        apiRequest(`/api/v1/inpatient/stays/${stayId}/plans`),
      ]);
      setStay(stayPayload || null);
      setEvents(Array.isArray(eventsPayload) ? eventsPayload : []);
      setPhotos(Array.isArray(photosPayload) ? photosPayload : []);
      setPlans(Array.isArray(plansPayload) ? plansPayload : []);
    } catch (requestError) {
      setError(requestError.message || 'Не удалось загрузить стационарный кейс');
      setStay(null);
      setEvents([]);
      setPhotos([]);
      setPlans([]);
    } finally {
      setLoading(false);
    }
  }, [stayId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function submitEvent(event) {
    event.preventDefault();
    setSuccess('');
    setError('');
    if (!eventForm.title.trim() || !eventForm.description_safe.trim()) {
      setError('Заполните заголовок и описание обновления.');
      return;
    }

    setSavingEvent(true);
    try {
      await apiRequest(`/api/v1/inpatient/stays/${stayId}/events`, {
        method: 'POST',
        body: {
          event_type: eventForm.event_type,
          owner_visible: eventForm.owner_visible,
          title: eventForm.title.trim(),
          description_safe: eventForm.description_safe.trim(),
        },
      });
      setEventForm({ event_type: 'note', owner_visible: true, title: '', description_safe: '' });
      setSuccess('Обновление добавлено в ленту стационара.');
      await loadData();
    } catch (requestError) {
      setError(requestError.message || 'Не удалось добавить событие');
    } finally {
      setSavingEvent(false);
    }
  }

  async function addQuickEvent(item) {
    setSuccess('');
    setError('');
    try {
      await apiRequest(`/api/v1/inpatient/stays/${stayId}/events`, {
        method: 'POST',
        body: {
          event_type: item.type,
          owner_visible: true,
          title: item.title,
          description_safe: item.description,
        },
      });
      setSuccess('Событие чек-листа добавлено.');
      await loadData();
    } catch (requestError) {
      setError(requestError.message || 'Не удалось добавить событие чек-листа');
    }
  }

  async function uploadPhoto(event) {
    event.preventDefault();
    setSuccess('');
    setError('');
    if (!photoCaption.trim() || !photoFile) {
      setError('Для фото-отчёта нужны подпись и файл.');
      return;
    }

    setSavingPhoto(true);
    try {
      const formData = new FormData();
      formData.append('caption', photoCaption.trim());
      formData.append('owner_visible', 'true');
      formData.append('photo_file', photoFile);
      await apiRequest(`/api/v1/inpatient/stays/${stayId}/photos`, {
        method: 'POST',
        body: { __formData: formData },
      });
      setPhotoFile(null);
      const input = document.getElementById('vet-inpatient-photo-file');
      if (input) input.value = '';
      setSuccess('Фото-отчёт добавлен.');
      await loadData();
    } catch (requestError) {
      setError(requestError.message || 'Не удалось загрузить фото-отчёт');
    } finally {
      setSavingPhoto(false);
    }
  }

  async function dischargeStay() {
    setError('');
    setSuccess('');
    setConfirmDischargeOpen(false);
    setDischarging(true);
    try {
      await apiRequest(`/api/v1/inpatient/stays/${stayId}/discharge`, { method: 'POST' });
      setSuccess('Пациент выписан из стационара.');
      await loadData();
    } catch (requestError) {
      setError(requestError.message || 'Не удалось завершить стационар');
    } finally {
      setDischarging(false);
    }
  }

  async function uploadDocumentResult(event) {
    event.preventDefault();
    setError('');
    setSuccess('');
    if (!docType.trim() || !docRef.trim()) {
      setError('Заполните тип и ссылку документа.');
      return;
    }
    if (!stay) return;

    setSavingDoc(true);
    try {
      await apiRequest('/api/v1/documents/upload', {
        method: 'POST',
        body: {
          pet_id: stay.pet_id,
          clinic_id: stay.clinic_id,
          doc_type: docType.trim(),
          file_ref: docRef.trim(),
        },
      });
      await apiRequest(`/api/v1/inpatient/stays/${stayId}/events`, {
        method: 'POST',
        body: {
          event_type: 'document_added',
          owner_visible: true,
          title: 'Добавлен результат обследования',
          description_safe: 'В карточку стационара добавлен новый документ. Обсудите детали на следующем контакте с врачом.',
        },
      });
      setSuccess('Документ добавлен и опубликован в ленте стационара.');
      await loadData();
    } catch (requestError) {
      setError(requestError.message || 'Не удалось добавить документ');
    } finally {
      setSavingDoc(false);
    }
  }

  const lastUpdateAt = events[0]?.created_at ? new Date(events[0].created_at) : null;
  const hoursSinceLastUpdate = lastUpdateAt ? (Date.now() - lastUpdateAt.getTime()) / (1000 * 60 * 60) : null;
  const showUpdateWarning = Number.isFinite(hoursSinceLastUpdate) && hoursSinceLastUpdate > 6;

  return (
    <>
      <header className="page-header">
        <div>
          <h1 className="page-title">Карточка стационара</h1>
          <p className="page-subtitle">Рабочая зона врача: обновления смены, фото-отчёты, чек-листы и прозрачная коммуникация с владельцем.</p>
        </div>
        <button className="btn-secondary" type="button" onClick={loadData}>
          Обновить
        </button>
      </header>

      {error ? <ErrorBanner message={error} onRetry={loadData} /> : null}
      {success ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-base text-emerald-700">{success}</div> : null}
      {showUpdateWarning ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-base text-amber-700">
          Последнее обновление старше 6 часов. Добавьте новую заметку для владельца.
        </div>
      ) : null}

      {loading ? (
        <section className="space-y-4">
          <Skeleton className="h-44 w-full" />
          <Skeleton className="h-72 w-full" />
        </section>
      ) : !stay ? (
        <EmptyState title="Стационарный кейс не найден" text="Проверьте ID стационара или обновите страницу списка." />
      ) : (
        <>
          <ShowcasePanel
            eyebrow="Рабочее место стационара"
            title={`Стационар ${stay.ward}/${stay.bed}: быстрые обновления смены и прозрачная история пациента`}
            description="Врач добавляет события, видимые владельцу, фото-отчёты и документы без лишнего шума. Все действия складываются в единую спокойную карточку пациента."
            imageSrc="/assets/img/inpatient-photo.svg"
            imageAlt="Стационар для врача"
            badges={[
              stay.status === 'active' ? 'Активный случай' : 'Завершён',
              `${events.length} событий`,
              `${photos.length} фото`,
            ]}
            compact
          />

          <section className="grid gap-4 xl:grid-cols-[minmax(0,1.16fr)_0.84fr]">
            <div className="showcase-shell min-w-0 p-6 md:p-7">
              <div className="showcase-grid" />
              <div className="showcase-orb left-[9%] top-[16%] h-5 w-5 bg-cyan-400/85 shadow-[0_0_0_14px_rgba(61,147,220,0.12)]" />
              <div className="showcase-orb right-[8%] top-[12%] h-6 w-6 bg-emerald-400/80 shadow-[0_0_0_16px_rgba(66,186,160,0.14)]" />

              <div className="relative z-[1] grid gap-5 xl:grid-cols-[280px_minmax(0,1fr)] xl:items-center">
                <div className="showcase-panel showcase-floating overflow-hidden p-4">
                  <div className="relative h-64 w-full overflow-hidden rounded-[24px]">
                    <Image src="/assets/img/inpatient-photo.svg" alt="Стационар" fill sizes="280px" className="object-cover" />
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <span className="rounded-full border border-lapka-200 bg-white px-3 py-1.5 text-sm font-semibold text-lapka-700">
                      Стационарный контур
                    </span>
                    <span className={stay.status === 'active' ? 'badge-yellow' : 'badge-green'}>
                      {stay.status === 'active' ? 'Активный случай' : 'Завершён'}
                    </span>
                  </div>
                </div>

                <div className="min-w-0">
                  <span className="pill">Палата {stay.ward}/{stay.bed}</span>
                  <h2 className="mt-4 text-[2rem] font-black tracking-tight text-lapka-900 md:text-[2.65rem]">
                    {localizePublicStatus(stay.public_status_label)}
                  </h2>
                  <p className="mt-3 max-w-3xl text-base leading-8 text-lapka-700">{stay.owner_visible_summary}</p>

                  <div className="mt-5 flex flex-wrap gap-2 text-base text-lapka-700">
                    <span className="dense-chip"><span className="font-semibold text-lapka-900">Питомец:</span> {stay.pet_id}</span>
                    <span className="dense-chip"><span className="font-semibold text-lapka-900">Клиника:</span> {stay.clinic_id}</span>
                    <span className="dense-chip"><span className="font-semibold text-lapka-900">Поступление:</span> {formatDate(stay.admission_at)}</span>
                    <span className="dense-chip"><span className="font-semibold text-lapka-900">Врач:</span> {stay.attending_vet_id || 'Назначается'}</span>
                  </div>

                  <div className="mt-5 flex flex-wrap gap-3">
                    {stay.status === 'active' ? (
                      <button className="btn-danger" type="button" onClick={() => setConfirmDischargeOpen(true)} disabled={discharging}>
                        {discharging ? 'Оформляем выписку...' : 'Выписать пациента'}
                      </button>
                    ) : (
                      <span className="badge-green">Выписан</span>
                    )}
                    <span className="pill">Последнее обновление: {formatDate(events[0]?.created_at)}</span>
                  </div>
                </div>
              </div>
            </div>

            <Card title="Чек-лист дежурства" subtitle="Быстрые действия текущей смены" tone="mint">
              <div className="grid gap-2">
                {QUICK_CHECKLIST.map((item) => (
                  <button key={item.title} className="btn-secondary justify-start" type="button" onClick={() => addQuickEvent(item)}>
                    + {item.title}
                  </button>
                ))}
              </div>
            </Card>
          </section>

          <section className="grid gap-4 2xl:grid-cols-[1.05fr_0.95fr]">
            <Card title="Добавить обновление" subtitle="Только безопасный статус, наблюдения и прогресс без лечебных схем">
              <form className="space-y-3" onSubmit={submitEvent}>
                <label className="block">
                  <span className="label">Тип события</span>
                  <select
                    className="input"
                    value={eventForm.event_type}
                    onChange={(event) => setEventForm((prev) => ({ ...prev, event_type: event.target.value }))}
                  >
                    <option value="note">Заметка</option>
                    <option value="status_update">Статус</option>
                    <option value="vitals_check">Проверка состояния</option>
                    <option value="feeding">Кормление</option>
                    <option value="procedure">Процедура</option>
                    <option value="document_added">Документ</option>
                  </select>
                </label>

                <label className="block">
                  <span className="label">Заголовок</span>
                  <input
                    className="input"
                    value={eventForm.title}
                    onChange={(event) => setEventForm((prev) => ({ ...prev, title: event.target.value }))}
                    placeholder="Например: Контроль показателей"
                  />
                </label>

                <label className="block">
                  <span className="label">Безопасное описание</span>
                  <textarea
                    className="input min-h-[100px]"
                    value={eventForm.description_safe}
                    onChange={(event) => setEventForm((prev) => ({ ...prev, description_safe: event.target.value }))}
                    placeholder="Только безопасное обновление для владельца: что произошло и что обсудить с врачом."
                  />
                </label>

                <label className="inline-flex items-center gap-2 text-sm text-lapka-700">
                  <input
                    type="checkbox"
                    checked={eventForm.owner_visible}
                    onChange={(event) => setEventForm((prev) => ({ ...prev, owner_visible: event.target.checked }))}
                  />
                  Показать владельцу
                </label>

                <button className="btn-primary" type="submit" disabled={savingEvent}>
                  {savingEvent ? 'Сохранение...' : 'Добавить обновление'}
                </button>
              </form>
            </Card>

            <Card title="Фото-отчёт" subtitle="Загрузка файла с подписью">
              <form className="space-y-3" onSubmit={uploadPhoto}>
                <label className="block">
                  <span className="label">Подпись</span>
                  <input className="input" value={photoCaption} onChange={(event) => setPhotoCaption(event.target.value)} />
                </label>
                <label className="block">
                  <span className="label">Фото</span>
                  <input
                    id="vet-inpatient-photo-file"
                    className="input"
                    type="file"
                    accept=".jpg,.jpeg,.png,.webp,image/*"
                    onChange={(event) => setPhotoFile(event.target.files?.[0] || null)}
                  />
                </label>
                <button className="btn-primary" type="submit" disabled={savingPhoto}>
                  {savingPhoto ? 'Загрузка...' : 'Загрузить фото-отчёт'}
                </button>
              </form>

              <div className="mt-4 rounded-xl border border-lapka-200 bg-lapka-50 p-4 text-base text-lapka-700">
                Фото-отчёт автоматически добавляется в ленту стационара и может быть отправлен владельцу как уведомление.
              </div>
            </Card>
          </section>

          <Card title="Результаты обследований" subtitle="Загрузка документа в карту питомца и публикация безопасного события">
            <form className="grid gap-3 md:grid-cols-[0.7fr_1.3fr_auto] md:items-end" onSubmit={uploadDocumentResult}>
              <label className="block">
                <span className="label">Тип документа</span>
                <select className="input" value={docType} onChange={(event) => setDocType(event.target.value)}>
                  <option value="lab_result">Лабораторный результат</option>
                  <option value="xray">Рентген</option>
                  <option value="ultrasound">УЗИ</option>
                  <option value="discharge">Выписка</option>
                </select>
              </label>
              <label className="block">
                <span className="label">Ссылка / заглушка</span>
                <input
                  className="input"
                  value={docRef}
                  onChange={(event) => setDocRef(event.target.value)}
                  placeholder="https://..."
                />
              </label>
              <button className="btn-primary" type="submit" disabled={savingDoc}>
                {savingDoc ? 'Сохранение...' : 'Добавить документ'}
              </button>
            </form>
          </Card>

          <section className="grid items-start gap-4 2xl:grid-cols-2">
            <Card title="Лента событий" subtitle="Последние обновления смены">
              {events.length ? (
                <Table
                  columns={['Время', 'Тип', 'Заголовок', 'Видно владельцу']}
                  rows={events.slice(0, 20).map((row) => [
                    formatDate(row.created_at),
                    row.event_type,
                    row.title,
                    row.owner_visible ? 'Да' : 'Нет',
                  ])}
                />
              ) : (
                <EmptyState title="Событий нет" text="Добавьте первое обновление по стационару." />
              )}
            </Card>

            <Card title="План и фото" subtitle="Оперативный контроль по текущему стационару">
              <div className="space-y-3">
                <div className="showcase-panel p-4">
                  <p className="text-base font-semibold text-lapka-900">Планов на сегодня: {plans.length}</p>
                  <p className="mt-1 text-sm text-lapka-600">Последняя задача: {plans[0]?.task_text || '—'}</p>
                </div>
                <div className="showcase-panel p-4">
                  <p className="text-base font-semibold text-lapka-900">Фото-отчётов: {photos.length}</p>
                  <p className="mt-1 text-sm text-lapka-600">Последнее фото: {formatDate(photos[0]?.taken_at)}</p>
                </div>
              </div>
            </Card>
          </section>
        </>
      )}

      <ConfirmDialog
        open={confirmDischargeOpen}
        title="Подтвердите выписку пациента"
        message="Статус стационара сменится на «выписан». Проверьте, что отчёт для владельца заполнен и безопасен."
        confirmLabel="Выписать"
        cancelLabel="Отмена"
        danger
        loading={discharging}
        onCancel={() => setConfirmDischargeOpen(false)}
        onConfirm={dischargeStay}
      />
    </>
  );
}
