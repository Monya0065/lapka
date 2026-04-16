'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import AppImage from '@/components/ui/AppImage';
import Card from '@/components/ui/Card';
import ErrorBanner from '@/components/ui/ErrorBanner';
import ShowcasePanel from '@/components/ui/ShowcasePanel';
import Skeleton from '@/components/ui/Skeleton';
import Table from '@/components/ui/Table';
import { apiRequest } from '@/lib/api';
import { resolveClinicGallery } from '@/lib/pets';

function formatVisitType(value) {
  const map = {
    in_person: 'Очный визит',
    video_consultation: 'Телемедицина',
    telemedicine: 'Телемедицина',
  };
  return map[value] || value || '—';
}

export default function PlatformBranchDetailPage() {
  const params = useParams();
  const branchId = params?.id;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadDetail = useCallback(async () => {
    if (!branchId) return;
    setLoading(true);
    setError('');
    try {
      const payload = await apiRequest(`/api/v1/clinics/platform-branches/${branchId}`);
      setData(payload);
    } catch (requestError) {
      setError(requestError.message || 'Не удалось загрузить карточку филиала');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [branchId]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  const branch = data?.branch || null;
  const clinic = data?.clinic || null;
  const stats = data?.stats || {};
  const signals = data?.signals || {};
  const scheduler = data?.scheduler_settings || null;
  const resources = data?.resources || [];
  const staff = useMemo(() => data?.staff || [], [data?.staff]);
  const appointments = useMemo(() => data?.upcoming_appointments || [], [data?.upcoming_appointments]);
  const gallery = useMemo(
    () => resolveClinicGallery({ photos: branch?.photos || clinic?.photos || [], photo_url: branch?.cover_photo || clinic?.photos?.[0] }).slice(0, 4),
    [branch, clinic]
  );
  const appointmentRows = useMemo(
    () =>
      appointments.map((row) => ({
        id: row.id,
        time: row.start_at
          ? new Date(row.start_at).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
          : '—',
        patient: row.pet_name || 'Пациент',
        vet: row.vet_name || 'Врач',
        service: row.service_name || formatVisitType(row.visit_type),
        status: row.status_label || '—',
        room: row.room_label || 'Назначится автоматически',
        pet_id: row.pet_id,
      })),
    [appointments]
  );
  const todayAppointmentsCount = useMemo(
    () =>
      appointments.filter((row) => {
        if (!row.start_at) return false;
        const date = new Date(row.start_at);
        const now = new Date();
        return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate();
      }).length,
    [appointments]
  );
  const vetsCount = useMemo(() => staff.filter((member) => member.role === 'vet').length, [staff]);
  const adminsCount = useMemo(() => staff.filter((member) => member.role === 'clinic_admin').length, [staff]);
  const highLoadSignal = useMemo(
    () => Number(stats.blocked_flow || 0) > 0 || Boolean(signals.bottleneck) || Number(signals.resource_pressure || 0) >= 80,
    [signals.bottleneck, signals.resource_pressure, stats.blocked_flow]
  );

  const scopedSchedule = useMemo(() => {
    if (!branch?.id || !clinic?.id) return '/platform/branches';
    return `/clinic/schedule?clinic_id=${encodeURIComponent(clinic.id)}&branch_id=${encodeURIComponent(branch.id)}`;
  }, [branch, clinic]);
  const scopedFlowboard = useMemo(() => {
    if (!branch?.id || !clinic?.id) return '/platform/branches';
    return `/clinic/flowboard?clinic_id=${encodeURIComponent(clinic.id)}&branch_id=${encodeURIComponent(branch.id)}`;
  }, [branch, clinic]);
  const scopedInpatient = useMemo(() => {
    if (!branch?.id || !clinic?.id) return '/platform/branches';
    return `/clinic/inpatient?clinic_id=${encodeURIComponent(clinic.id)}&branch_id=${encodeURIComponent(branch.id)}`;
  }, [branch, clinic]);

  const ready = Boolean(!loading && !error && branch && clinic);

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-teal-400/14 via-surface-muted to-sky-400/12 p-5 shadow-card md:p-8 dark:from-teal-500/10 dark:to-sky-500/10">
        <Link className="btn-secondary mb-5 inline-flex !px-4 !py-2" href="/platform/branches">
          ← К реестру филиалов
        </Link>
        {loading ? (
          <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr] lg:items-start">
            <div className="space-y-3">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-12 w-full max-w-xl" />
              <Skeleton className="h-16 w-full max-w-2xl" />
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-24 w-full rounded-2xl" />
              ))}
            </div>
          </div>
        ) : error ? (
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-theme-muted">Платформенный контур</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-theme md:text-4xl" data-testid="platform-branch-detail-title">
              Карточка филиала
            </h1>
            <p className="mt-3 max-w-2xl text-theme-muted">Не удалось загрузить филиал. Проверьте идентификатор и доступ к API.</p>
          </div>
        ) : !branch || !clinic ? (
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-theme-muted">Платформенный контур</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-theme md:text-4xl" data-testid="platform-branch-detail-title">
              Филиал не найден
            </h1>
            <p className="mt-3 text-theme-muted">В реестре нет карточки с таким идентификатором.</p>
          </div>
        ) : (
          <div className="relative grid gap-6 lg:grid-cols-[1fr_1.2fr] lg:items-start">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-theme-muted">
                {branch.clinic_name || 'Клиника'}
              </p>
              <h1 className="mt-2 text-3xl font-black tracking-tight text-theme md:text-4xl" data-testid="platform-branch-detail-title">
                {branch.is_primary ? 'Главный филиал' : 'Филиал'} · {branch.city}
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-theme-muted md:text-base">
                Нагрузка, ресурсы, расписание и сигналы потока — сразу крупным блоком, затем детали и ближайшие записи.
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <Link href={`/platform/clinics/${clinic.id}`} className="btn-secondary">
                  Карточка клиники
                </Link>
                <Link href={scopedSchedule} className="btn-secondary">
                  Календарь филиала
                </Link>
                <Link href={scopedFlowboard} className="btn-secondary">
                  Поток филиала
                </Link>
                <Link href={scopedInpatient} className="btn-primary">
                  Стационар филиала
                </Link>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {[
                { label: 'Записи 14д', value: stats.appointments_14d || 0, tone: 'text-sky-700 dark:text-sky-300' },
                { label: 'Поток', value: stats.active_flow || 0, tone: 'text-violet-700 dark:text-violet-300' },
                { label: 'Телемед. 14д', value: stats.telemedicine_14d || 0, tone: 'text-amber-700 dark:text-amber-300' },
                { label: 'Перегрузки', value: stats.blocked_flow || 0, tone: (stats.blocked_flow || 0) > 0 ? 'text-rose-700 dark:text-rose-300' : 'text-emerald-700 dark:text-emerald-300' },
                { label: 'Ресурсы', value: stats.active_resources || 0, tone: 'text-emerald-700 dark:text-emerald-300' },
                { label: 'Общие', value: stats.shared_resources || 0, tone: '' },
              ].map((cell) => (
                <div key={cell.label} className="rounded-2xl border border-border bg-surface/90 px-3 py-4 shadow-sm">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-theme-muted">{cell.label}</p>
                  <p className={`mt-1 text-2xl font-black tabular-nums sm:text-3xl ${cell.tone || 'text-theme'}`}>{cell.value}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {error ? <ErrorBanner message={error} onRetry={loadDetail} /> : null}

      {loading ? (
        <section className="space-y-4">
          <Skeleton className="h-52 w-full rounded-3xl" />
          <Skeleton className="h-96 w-full rounded-3xl" />
        </section>
      ) : null}

      {ready ? (
        <>
      <section className="rounded-3xl border border-border bg-surface-muted/65 p-4 md:p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-theme-muted">Операционный срез</p>
            <h2 className="mt-1 text-xl font-black tracking-tight text-theme md:text-2xl">Сигналы филиала на текущую смену</h2>
          </div>
          <span className="rounded-full border border-border bg-surface px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-theme-muted">
            branch ops
          </span>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {[
            {
              title: 'Приёмы сегодня',
              value: todayAppointmentsCount,
              text: 'Текущая плотность расписания на день с быстрым переходом в branch-aware календарь.',
              href: scopedSchedule,
              tone: 'text-sky-700 dark:text-sky-300',
            },
            {
              title: 'Команда смены',
              value: `${vetsCount}/${adminsCount}`,
              text: 'Соотношение врачей и администраторов, которые держат поток и сервис на филиале.',
              href: '#branch-team',
              tone: 'text-violet-700 dark:text-violet-300',
            },
            {
              title: 'Риск перегрузки',
              value: highLoadSignal ? 'HIGH' : 'OK',
              text: 'Сигнал по bottleneck, blocked flow и давлению на ресурсы для быстрого реагирования.',
              href: scopedFlowboard,
              tone: highLoadSignal ? 'text-rose-700 dark:text-rose-300' : 'text-emerald-700 dark:text-emerald-300',
            },
          ].map((item) => (
            <Link
              key={item.title}
              href={item.href}
              className="rounded-2xl border border-border bg-surface/85 px-4 py-4 transition hover:-translate-y-0.5 hover:shadow-soft"
            >
              <p className={`text-base font-black ${item.tone}`}>{item.title}</p>
              <p className="mt-2 text-3xl font-black tabular-nums text-theme">{item.value}</p>
              <p className="mt-2 text-sm leading-relaxed text-theme">{item.text}</p>
              <p className="mt-3 text-xs font-semibold uppercase tracking-[0.14em] text-theme-muted">Открыть контур</p>
            </Link>
          ))}
        </div>
      </section>

      <ShowcasePanel
        eyebrow="Филиал и ресурсы"
        title={`${branch.clinic_name} · ${branch.city}`}
        description={`${branch.address}${branch.phone ? ` · ${branch.phone}` : ''}${branch.website ? ` · ${branch.website}` : ''}`}
        imageSrc={branch.cover_photo || gallery[0] || '/assets/img/clinic-ops.svg'}
        imageAlt={branch.clinic_name}
        badges={[
          branch.is_primary ? 'Главный филиал' : 'Рабочий филиал',
          branch.emergency_available ? 'Экстренный поток' : 'Плановый поток',
          `${stats.appointments_14d || 0} записей / 14 дней`,
          `${stats.active_resources || 0} ресурсов филиала`,
        ]}
        compact
      />

      {gallery.length > 1 ? (
        <section className="grid gap-3 md:grid-cols-2 2xl:grid-cols-4">
          {gallery.map((imageSrc, index) => (
            <div key={`${imageSrc}-${index}`} className="overflow-hidden rounded-[24px] border border-border bg-surface-muted/70 shadow-soft">
              <AppImage
                src={imageSrc}
                alt={`${branch.clinic_name} — фото ${index + 1}`}
                width={960}
                height={640}
                sizes="(max-width: 1280px) 100vw, 25vw"
                className="h-40 w-full object-cover"
              />
            </div>
          ))}
        </section>
      ) : null}

      <section className="grid-soft-3 items-start">
        <Card title="Операционный профиль" subtitle="Контакты филиала и сигналы смены">
          <div className="space-y-3">
            <div className="rounded-[22px] border border-border bg-surface-muted/70 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-theme-muted">Адрес филиала</p>
              <p className="mt-2 text-base font-semibold text-theme">{branch.address}</p>
              <p className="mt-1 text-sm text-theme-muted">{branch.hours || 'График уточняется'}{branch.phone ? ` · ${branch.phone}` : ''}</p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-[22px] border border-border bg-surface-muted/65 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-theme-muted">Доля телемедицины</p>
                <p className="mt-2 text-2xl font-extrabold text-theme">{signals.telemedicine_share || 0}%</p>
              </div>
              <div className="rounded-[22px] border border-border bg-surface-muted/65 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-theme-muted">Нагрузка на ресурсы</p>
                <p className="mt-2 text-2xl font-extrabold text-theme">{signals.resource_pressure || 0}</p>
              </div>
            </div>
            <div className={`rounded-[22px] border px-4 py-4 ${signals.bottleneck ? 'surface-accent-warning' : 'surface-accent-success'}`}>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-theme-muted">Сигнал потока</p>
              <p className="mt-2 text-base font-semibold text-theme">
                {signals.bottleneck ? 'В филиале есть признаки перегрузки потока и ожидания.' : 'Поток филиала выглядит ровным, критичных перегрузок не видно.'}
              </p>
            </div>
          </div>
        </Card>

        <Card title="Настройки расписания" subtitle="Рабочее окно, буфер и сетка слотов">
          {scheduler ? (
            <div className="space-y-3">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-[22px] border border-border bg-surface-muted/65 px-4 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-theme-muted">Рабочий день</p>
                  <p className="mt-2 text-2xl font-extrabold text-theme">
                    {scheduler.day_start_hour}:00 – {scheduler.day_end_hour}:00
                  </p>
                </div>
                <div className="rounded-[22px] border border-border bg-surface-muted/65 px-4 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-theme-muted">Интервал слота</p>
                  <p className="mt-2 text-2xl font-extrabold text-theme">{scheduler.slot_interval_minutes} мин</p>
                </div>
                <div className="rounded-[22px] border border-border bg-surface-muted/65 px-4 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-theme-muted">Буфер</p>
                  <p className="mt-2 text-2xl font-extrabold text-theme">{scheduler.default_buffer_minutes} мин</p>
                </div>
                <div className="rounded-[22px] border border-border bg-surface-muted/65 px-4 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-theme-muted">Источник настроек</p>
                  <p className="mt-2 text-lg font-semibold text-theme">
                    {scheduler.source === 'branch_override' ? 'Переопределение филиала' : scheduler.source === 'clinic_default' ? 'Стандарт клиники' : 'Системные значения'}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link href={scopedSchedule} className="btn-secondary !px-3 !py-1.5">Открыть календарь</Link>
                <Link href={scopedFlowboard} className="btn-secondary !px-3 !py-1.5">Открыть поток</Link>
              </div>
            </div>
          ) : (
            <p className="text-sm text-theme-muted">Настройки расписания для филиала пока не заданы.</p>
          )}
        </Card>

        <Card title="Ресурсы филиала" subtitle="Кабинеты, телемедицина и общие ресурсы клиники">
          <div className="space-y-3">
            {resources.length ? resources.map((resource) => (
              <div key={resource.id} className="rounded-[22px] border border-border bg-surface-muted/70 px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-base font-semibold text-theme">{resource.name}</p>
                    <p className="text-sm text-theme-muted">{resource.resource_type_label}{resource.code ? ` · ${resource.code}` : ''}</p>
                  </div>
                  <span className="pill">{resource.scope_label}</span>
                </div>
                <p className="mt-2 text-sm text-theme-muted">Вместимость: {resource.capacity || 1}</p>
              </div>
            )) : (
              <p className="text-sm text-theme-muted">Для филиала пока не зарегистрированы ресурсы.</p>
            )}
          </div>
        </Card>
      </section>

      <section className="grid gap-6 2xl:grid-cols-[1.15fr_0.85fr]">
        <Card title="Ближайшие записи филиала" subtitle="Поток ближайших 14 дней по филиалу">
          <Table
            columns={[
              { id: 'time', label: 'Дата и время' },
              { id: 'patient', label: 'Пациент' },
              { id: 'vet', label: 'Врач' },
              { id: 'service', label: 'Услуга' },
              { id: 'status', label: 'Статус' },
              { id: 'room', label: 'Кабинет' },
            ]}
            rows={appointmentRows}
            rowActions={(row) => {
              if (!row?.pet_id) return [];
              return [
                { label: 'Карточка пациента', href: `/clinic/patients/${row.pet_id}?clinic_id=${clinic.id}&branch_id=${branch.id}` },
                { label: 'Календарь филиала', href: scopedSchedule },
              ];
            }}
            emptyTitle="Нет ближайших записей"
            emptyText="Когда расписание филиала наполнится, здесь появится ближайший поток."
          />
        </Card>

        <Card title="Команда и сигналы" subtitle="Врачи и администраторы, которые держат поток филиала">
          <div id="branch-team" />
          <div className="space-y-3">
            {staff.slice(0, 8).map((member) => (
              <div key={member.membership_id} className="rounded-[22px] border border-border bg-surface-muted/70 px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-base font-semibold text-theme">{member.full_name}</p>
                    <p className="text-sm text-theme-muted">{member.role_label}{member.specialty ? ` · ${member.specialty}` : ''}</p>
                  </div>
                  <span className="pill">{member.experience_years ? `${member.experience_years} лет` : 'Команда'}</span>
                </div>
                {member.email ? <p className="mt-2 text-sm text-theme-muted">{member.email}</p> : null}
              </div>
            ))}
          </div>
        </Card>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {[
          {
            title: 'Календарь филиала',
            text: 'Плотный график, окна и загрузка команды в разрезе branch-aware потока.',
            href: scopedSchedule,
            tone: 'text-sky-700 dark:text-sky-300',
          },
          {
            title: 'Flowboard',
            text: 'Очередь, задержки и bottleneck-сигналы для оперативного вмешательства.',
            href: scopedFlowboard,
            tone: 'text-rose-700 dark:text-rose-300',
          },
          {
            title: 'Стационар',
            text: 'Текущие кейсы, выписки и контроль нагрузки на inpatient-контур филиала.',
            href: scopedInpatient,
            tone: 'text-emerald-700 dark:text-emerald-300',
          },
        ].map((item) => (
          <Link
            key={item.title}
            href={item.href}
            className="rounded-2xl border border-border bg-surface-muted/70 px-4 py-4 transition hover:-translate-y-0.5 hover:shadow-soft"
          >
            <p className={`text-base font-black ${item.tone}`}>{item.title}</p>
            <p className="mt-2 text-sm leading-relaxed text-theme">{item.text}</p>
            <p className="mt-3 text-xs font-semibold uppercase tracking-[0.14em] text-theme-muted">Открыть контур</p>
          </Link>
        ))}
      </section>
        </>
      ) : null}
    </div>
  );
}
