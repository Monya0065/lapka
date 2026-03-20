'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import AppImage from '@/components/ui/AppImage';
import Card from '@/components/ui/Card';
import ErrorBanner from '@/components/ui/ErrorBanner';
import ShowcasePanel from '@/components/ui/ShowcasePanel';
import Skeleton from '@/components/ui/Skeleton';
import Table from '@/components/ui/Table';
import { apiRequest } from '@/lib/api';
import { resolveClinicGallery, resolveClinicPhoto } from '@/lib/pets';

function localizeScope(scope) {
  const map = {
    prescriptions_only: 'Только назначения',
    basic_medical: 'Базовая карта',
    full_record: 'Полная карта',
    inpatient_view: 'Стационар',
    camera_view: 'Камеры',
  };
  return map[scope] || scope || '—';
}

export default function PlatformClinicDetailPage() {
  const params = useParams();
  const clinicId = params?.id;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function loadDetail() {
      if (!clinicId) return;
      setLoading(true);
      setError('');
      try {
        const payload = await apiRequest(`/api/v1/clinics/platform-registry/${clinicId}`);
        if (!cancelled) setData(payload);
      } catch (requestError) {
        if (!cancelled) setError(requestError.message || 'Не удалось загрузить карточку клиники');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadDetail();
    return () => {
      cancelled = true;
    };
  }, [clinicId]);

  const clinic = data?.clinic || null;
  const gallery = useMemo(() => resolveClinicGallery(clinic).slice(0, 4), [clinic]);
  const primaryLocation = useMemo(
    () => (data?.locations || []).find((location) => location.is_primary) || data?.locations?.[0] || null,
    [data]
  );
  const buildClinicWorkspaceHref = (pathname) => {
    if (!clinic?.id) return pathname;
    const query = new URLSearchParams({ clinic_id: clinic.id });
    if (primaryLocation?.id) query.set('branch_id', primaryLocation.id);
    return `${pathname}?${query.toString()}`;
  };
  const consentRows = useMemo(() => {
    const source = data?.stats?.consents_by_scope || {};
    return Object.entries(source).map(([scope, count]) => [localizeScope(scope), String(count || 0)]);
  }, [data]);
  const locationSummaries = useMemo(() => {
    const source = data?.location_summaries || [];
    return new Map(source.map((row) => [row.location_id, row]));
  }, [data]);

  if (loading) {
    return <Skeleton className="h-[520px] w-full" />;
  }

  if (error) {
    return <ErrorBanner message={error} />;
  }

  if (!clinic) {
    return <ErrorBanner message="Карточка клиники недоступна" />;
  }

  return (
    <div className="space-y-6">
      <header className="page-header">
        <div>
          <p className="page-eyebrow">Платформенный контур</p>
          <h1 className="page-title">{clinic.name}</h1>
          <p className="page-subtitle">
            Карточка организации, филиалов, команды, шаблонов, AI-настроек и операционного состояния клиники.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link className="btn-secondary" href="/platform/clinics">К реестру клиник</Link>
          <Link className="btn-secondary" href={`/platform/branches?clinic_id=${clinic.id}`}>Филиалы клиники</Link>
          <Link className="btn-secondary" href={buildClinicWorkspaceHref('/clinic/schedule')}>Открыть календарь клиники</Link>
          <Link className="btn-secondary" href={buildClinicWorkspaceHref('/clinic/flowboard')}>Открыть поток дня</Link>
          <Link className="btn-secondary" href={buildClinicWorkspaceHref('/clinic/inpatient')}>Открыть стационар</Link>
          <Link className="btn-secondary" href="/platform/ai">Центр AI</Link>
          <Link className="btn-primary" href="/platform/security">Безопасность</Link>
        </div>
      </header>

      <ShowcasePanel
        eyebrow="Карточка организации"
        title={`${clinic.name}${clinic.city ? ` · ${clinic.city}` : ''}`}
        description={`${clinic.address || 'Адрес уточняется'}${clinic.phone ? ` · ${clinic.phone}` : ''}${clinic.website ? ` · ${clinic.website}` : ''}`}
        imageSrc={resolveClinicPhoto(clinic)}
        imageAlt={clinic.name}
        badges={[
          clinic.emergency_available ? 'Экстренный поток' : 'Плановый поток',
          `${data?.stats?.branches || 0} филиалов`,
          `${data?.stats?.vets || 0} врачей`,
          `${data?.stats?.active_inpatient || 0} в стационаре`,
        ]}
      />

      {gallery.length > 1 ? (
        <section className="grid gap-3 md:grid-cols-2 2xl:grid-cols-4">
          {gallery.map((imageSrc, index) => (
            <div key={`${imageSrc}-${index}`} className="overflow-hidden rounded-[24px] border border-lapka-200 bg-white shadow-soft">
              <AppImage
                src={imageSrc}
                alt={`${clinic.name} — фото ${index + 1}`}
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
        <Card title="Филиалы"><p className="text-4xl font-semibold text-lapka-900">{data?.stats?.branches || 0}</p></Card>
        <Card title="Команда"><p className="text-4xl font-semibold text-lapka-900">{data?.stats?.staff || 0}</p></Card>
        <Card title="Пациенты по согласию"><p className="text-4xl font-semibold text-lapka-900">{data?.stats?.patients || 0}</p></Card>
        <Card title="AI-переопределения"><p className="text-4xl font-semibold text-lapka-900">{data?.stats?.ai_overrides || 0}</p></Card>
      </section>

      <section className="grid-soft-3 items-start">
        <Card title="Локации и филиалы" subtitle="Главный адрес и рабочие точки клиники">
          <div className="space-y-3">
            {(data?.locations || []).map((location) => (
              <div key={location.id} className="rounded-[22px] border border-lapka-200 bg-white px-4 py-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-base font-semibold text-lapka-900">{location.city}</p>
                  <span className={location.is_primary ? 'badge-green' : 'badge-blue'}>
                    {location.is_primary ? 'Главный филиал' : 'Филиал'}
                  </span>
                </div>
                <p className="mt-2 text-sm text-lapka-600">{location.address}</p>
                <p className="mt-1 text-sm text-lapka-500">{location.hours || 'График уточняется'}{location.phone ? ` · ${location.phone}` : ''}</p>
                <div className="mt-4 grid gap-2 md:grid-cols-2">
                  <div className="rounded-2xl border border-lapka-200 bg-lapka-50 px-3 py-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-lapka-500">Записи на 14 дней</p>
                    <p className="mt-2 text-2xl font-extrabold text-lapka-900">{locationSummaries.get(location.id)?.appointments_14d || 0}</p>
                  </div>
                  <div className="rounded-2xl border border-lapka-200 bg-lapka-50 px-3 py-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-lapka-500">Активный поток</p>
                    <p className="mt-2 text-2xl font-extrabold text-lapka-900">{locationSummaries.get(location.id)?.active_flow || 0}</p>
                  </div>
                  <div className="rounded-2xl border border-lapka-200 bg-lapka-50 px-3 py-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-lapka-500">Телемедицина</p>
                    <p className="mt-2 text-2xl font-extrabold text-lapka-900">{locationSummaries.get(location.id)?.telemedicine_14d || 0}</p>
                  </div>
                  <div className="rounded-2xl border border-lapka-200 bg-lapka-50 px-3 py-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-lapka-500">Готовы к выписке</p>
                    <p className="mt-2 text-2xl font-extrabold text-lapka-900">{locationSummaries.get(location.id)?.ready_for_discharge || 0}</p>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link
                    className="btn-primary !px-3 !py-1.5"
                    href={`/platform/branches/${encodeURIComponent(location.id)}`}
                  >
                    Карточка филиала
                  </Link>
                  <Link
                    className="btn-secondary !px-3 !py-1.5"
                    href={`/clinic/schedule?clinic_id=${encodeURIComponent(clinic.id)}&branch_id=${encodeURIComponent(location.id)}`}
                  >
                    Календарь филиала
                  </Link>
                  <Link
                    className="btn-secondary !px-3 !py-1.5"
                    href={`/clinic/flowboard?clinic_id=${encodeURIComponent(clinic.id)}&branch_id=${encodeURIComponent(location.id)}`}
                  >
                    Поток филиала
                  </Link>
                  <Link
                    className="btn-secondary !px-3 !py-1.5"
                    href={`/clinic/inpatient?clinic_id=${encodeURIComponent(clinic.id)}&branch_id=${encodeURIComponent(location.id)}`}
                  >
                    Стационар филиала
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Команда клиники" subtitle="Врачи, администраторы и ролевой состав">
          <div className="space-y-3">
            {(data?.staff || []).slice(0, 8).map((member) => (
              <div key={member.membership_id} className="rounded-[22px] border border-lapka-200 bg-white px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-base font-semibold text-lapka-900">{member.full_name}</p>
                    <p className="text-sm text-lapka-600">{member.role_label}{member.specialty ? ` · ${member.specialty}` : ''}</p>
                  </div>
                  <span className="pill">{member.languages?.[0] || 'Команда'}</span>
                </div>
                {member.bio ? <p className="mt-2 text-sm leading-6 text-lapka-600">{member.bio}</p> : null}
              </div>
            ))}
          </div>
        </Card>

        <Card title="Состояние контура" subtitle="Согласия, стационар и ближайшая операционная нагрузка">
          <div className="space-y-3">
            <div className="rounded-[22px] border border-lapka-200 bg-white px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-lapka-500">Согласия владельцев</p>
              <p className="mt-2 text-sm text-lapka-600">Распределение активных доступов по уровням карты.</p>
            </div>
            <Table
              searchable={false}
              paginated={false}
              columns={['Уровень доступа', 'Количество']}
              rows={consentRows}
              emptyTitle="Нет активных согласий"
              emptyText="Когда владельцы выдадут доступ клинике, здесь появится распределение по уровням."
            />
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-[22px] border border-lapka-200 bg-white px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-lapka-500">Активный стационар</p>
                <p className="mt-2 text-2xl font-semibold text-lapka-900">{data?.stats?.active_inpatient || 0}</p>
              </div>
              <div className="rounded-[22px] border border-lapka-200 bg-white px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-lapka-500">Ближайшие записи</p>
                <p className="mt-2 text-2xl font-semibold text-lapka-900">{data?.stats?.upcoming_appointments || 0}</p>
              </div>
            </div>
          </div>
        </Card>
      </section>

      <section className="grid gap-6 2xl:grid-cols-2">
        <Card title="Шаблоны и протоколы" subtitle="Контентный слой клиники">
          <Table
            columns={['Название', 'Уровень', 'Статус', 'Версия', 'Использований']}
            rows={(data?.templates || []).map((template) => [
              template.name,
              template.scope_label || template.scope || '—',
              template.status_label || template.status || '—',
              String(template.version || 1),
              String(template.usage_count || 0),
            ])}
            rowActions={(row) => [
              { label: 'Шаблоны платформы', href: '/platform/templates' },
            ]}
          />
        </Card>

        <Card title="AI-переопределения и сигналы" subtitle="Локальные настройки маршрутов и моделей">
          <div className="space-y-3">
            {(data?.ai_overrides || []).length ? (data.ai_overrides.map((override) => (
              <div key={override.id} className="rounded-[22px] border border-lapka-200 bg-white px-4 py-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-base font-semibold text-lapka-900">{override.route_label || override.route_slug || 'Маршрут AI'}</p>
                  <span className="pill">{override.provider_label || override.provider_slug || 'Провайдер'}</span>
                </div>
                <p className="mt-2 text-sm text-lapka-600">{override.mode_label || 'Переопределение для клиники'}</p>
                <p className="mt-1 text-sm text-lapka-500">{override.model_key || 'Модель не указана'}</p>
              </div>
            ))) : (
              <div className="rounded-[22px] border border-lapka-200 bg-lapka-50 px-4 py-6 text-sm text-lapka-600">
                Для клиники пока нет локальных AI-переопределений. Используется платформенный контур.
              </div>
            )}
          </div>
        </Card>
      </section>

      <section className="grid gap-6 2xl:grid-cols-2">
        <Card title="Отзывы и доверие" subtitle="Последние сигналы качества по клинике и врачам">
          <Table
            columns={['Цель', 'Рейтинг', 'Заголовок', 'Статус']}
            rows={(data?.reviews?.items || []).map((review) => [
              review.target_label || 'Клиника',
              String(review.rating || 0),
              review.title || 'Без заголовка',
              review.status_label || review.status || '—',
            ])}
          />
        </Card>
        <Card title="Аудит и операционный журнал" subtitle="Последние события, связанные с клиникой">
          <Table
            columns={['Событие', 'Пользователь', 'Когда']}
            rows={(data?.audit || []).map((event) => [
              event.action_label || event.action || 'Событие',
              event.actor_name || 'Система',
              event.created_at_label || '—',
            ])}
          />
        </Card>
      </section>
    </div>
  );
}
