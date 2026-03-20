'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import AppImage from '@/components/ui/AppImage';
import Card from '@/components/ui/Card';
import ErrorBanner from '@/components/ui/ErrorBanner';
import ShowcasePanel from '@/components/ui/ShowcasePanel';
import Skeleton from '@/components/ui/Skeleton';
import StatsCard from '@/components/ui/StatsCard';
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

  useEffect(() => {
    let cancelled = false;
    async function loadDetail() {
      if (!branchId) return;
      setLoading(true);
      setError('');
      try {
        const payload = await apiRequest(`/api/v1/clinics/platform-branches/${branchId}`);
        if (!cancelled) setData(payload);
      } catch (requestError) {
        if (!cancelled) setError(requestError.message || 'Не удалось загрузить карточку филиала');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadDetail();
    return () => {
      cancelled = true;
    };
  }, [branchId]);

  const branch = data?.branch || null;
  const clinic = data?.clinic || null;
  const stats = data?.stats || {};
  const signals = data?.signals || {};
  const scheduler = data?.scheduler_settings || null;
  const resources = data?.resources || [];
  const staff = data?.staff || [];
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

  if (loading) return <Skeleton className="h-[540px] w-full" />;
  if (error) return <ErrorBanner message={error} />;
  if (!branch || !clinic) return <ErrorBanner message="Карточка филиала недоступна" />;

  const scopedSchedule = `/clinic/schedule?clinic_id=${encodeURIComponent(clinic.id)}&branch_id=${encodeURIComponent(branch.id)}`;
  const scopedFlowboard = `/clinic/flowboard?clinic_id=${encodeURIComponent(clinic.id)}&branch_id=${encodeURIComponent(branch.id)}`;
  const scopedInpatient = `/clinic/inpatient?clinic_id=${encodeURIComponent(clinic.id)}&branch_id=${encodeURIComponent(branch.id)}`;

  return (
    <div className="space-y-6">
      <header className="page-header">
        <div>
          <p className="page-eyebrow">Платформенный контур</p>
          <h1 className="page-title">{branch.is_primary ? 'Главный филиал' : 'Филиал'} · {branch.city}</h1>
          <p className="page-subtitle">
            Адрес, ресурсы, расписание, сигналы потока и ближайшая нагрузка филиала в одном разрезе.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href="/platform/branches" className="btn-secondary">К реестру филиалов</Link>
          <Link href={`/platform/clinics/${clinic.id}`} className="btn-secondary">Карточка клиники</Link>
          <Link href={scopedSchedule} className="btn-secondary">Календарь филиала</Link>
          <Link href={scopedFlowboard} className="btn-secondary">Поток филиала</Link>
          <Link href={scopedInpatient} className="btn-primary">Стационар филиала</Link>
        </div>
      </header>

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
      />

      {gallery.length > 1 ? (
        <section className="grid gap-3 md:grid-cols-2 2xl:grid-cols-4">
          {gallery.map((imageSrc, index) => (
            <div key={`${imageSrc}-${index}`} className="overflow-hidden rounded-[24px] border border-lapka-200 bg-white shadow-soft">
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

      <section className="kpi-grid">
        <StatsCard label="Записи на 14 дней" value={String(stats.appointments_14d || 0)} />
        <StatsCard label="Активный поток" value={String(stats.active_flow || 0)} />
        <StatsCard label="Телемедицина" value={String(stats.telemedicine_14d || 0)} />
        <StatsCard label="Сигналы перегрузки" value={String(stats.blocked_flow || 0)} />
        <StatsCard label="Ресурсы филиала" value={String(stats.active_resources || 0)} />
        <StatsCard label="Общие ресурсы" value={String(stats.shared_resources || 0)} />
      </section>

      <section className="grid-soft-3 items-start">
        <Card title="Операционный профиль" subtitle="Контакты филиала и сигналы смены">
          <div className="space-y-3">
            <div className="rounded-[22px] border border-lapka-200 bg-white px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-lapka-500">Адрес филиала</p>
              <p className="mt-2 text-base font-semibold text-lapka-900">{branch.address}</p>
              <p className="mt-1 text-sm text-lapka-600">{branch.hours || 'График уточняется'}{branch.phone ? ` · ${branch.phone}` : ''}</p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-[22px] border border-lapka-200 bg-lapka-50 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-lapka-500">Доля телемедицины</p>
                <p className="mt-2 text-2xl font-extrabold text-lapka-900">{signals.telemedicine_share || 0}%</p>
              </div>
              <div className="rounded-[22px] border border-lapka-200 bg-lapka-50 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-lapka-500">Нагрузка на ресурсы</p>
                <p className="mt-2 text-2xl font-extrabold text-lapka-900">{signals.resource_pressure || 0}</p>
              </div>
            </div>
            <div className={`rounded-[22px] border px-4 py-4 ${signals.bottleneck ? 'border-amber-200 bg-amber-50' : 'border-emerald-200 bg-emerald-50'}`}>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-lapka-500">Сигнал потока</p>
              <p className="mt-2 text-base font-semibold text-lapka-900">
                {signals.bottleneck ? 'В филиале есть признаки перегрузки потока и ожидания.' : 'Поток филиала выглядит ровным, критичных перегрузок не видно.'}
              </p>
            </div>
          </div>
        </Card>

        <Card title="Настройки расписания" subtitle="Рабочее окно, буфер и сетка слотов">
          {scheduler ? (
            <div className="space-y-3">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-[22px] border border-lapka-200 bg-lapka-50 px-4 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-lapka-500">Рабочий день</p>
                  <p className="mt-2 text-2xl font-extrabold text-lapka-900">
                    {scheduler.day_start_hour}:00 – {scheduler.day_end_hour}:00
                  </p>
                </div>
                <div className="rounded-[22px] border border-lapka-200 bg-lapka-50 px-4 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-lapka-500">Интервал слота</p>
                  <p className="mt-2 text-2xl font-extrabold text-lapka-900">{scheduler.slot_interval_minutes} мин</p>
                </div>
                <div className="rounded-[22px] border border-lapka-200 bg-lapka-50 px-4 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-lapka-500">Буфер</p>
                  <p className="mt-2 text-2xl font-extrabold text-lapka-900">{scheduler.default_buffer_minutes} мин</p>
                </div>
                <div className="rounded-[22px] border border-lapka-200 bg-lapka-50 px-4 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-lapka-500">Источник настроек</p>
                  <p className="mt-2 text-lg font-semibold text-lapka-900">
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
            <p className="text-sm text-lapka-600">Настройки расписания для филиала пока не заданы.</p>
          )}
        </Card>

        <Card title="Ресурсы филиала" subtitle="Кабинеты, телемедицина и общие ресурсы клиники">
          <div className="space-y-3">
            {resources.length ? resources.map((resource) => (
              <div key={resource.id} className="rounded-[22px] border border-lapka-200 bg-white px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-base font-semibold text-lapka-900">{resource.name}</p>
                    <p className="text-sm text-lapka-600">{resource.resource_type_label}{resource.code ? ` · ${resource.code}` : ''}</p>
                  </div>
                  <span className="pill">{resource.scope_label}</span>
                </div>
                <p className="mt-2 text-sm text-lapka-500">Вместимость: {resource.capacity || 1}</p>
              </div>
            )) : (
              <p className="text-sm text-lapka-600">Для филиала пока не зарегистрированы ресурсы.</p>
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
          <div className="space-y-3">
            {staff.slice(0, 8).map((member) => (
              <div key={member.membership_id} className="rounded-[22px] border border-lapka-200 bg-white px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-base font-semibold text-lapka-900">{member.full_name}</p>
                    <p className="text-sm text-lapka-600">{member.role_label}{member.specialty ? ` · ${member.specialty}` : ''}</p>
                  </div>
                  <span className="pill">{member.experience_years ? `${member.experience_years} лет` : 'Команда'}</span>
                </div>
                {member.email ? <p className="mt-2 text-sm text-lapka-500">{member.email}</p> : null}
              </div>
            ))}
          </div>
        </Card>
      </section>
    </div>
  );
}
