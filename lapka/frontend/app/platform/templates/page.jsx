'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Card from '@/components/ui/Card';
import EmptyState from '@/components/ui/EmptyState';
import ErrorBanner from '@/components/ui/ErrorBanner';
import ShowcasePanel from '@/components/ui/ShowcasePanel';
import Skeleton from '@/components/ui/Skeleton';
import Table from '@/components/ui/Table';
import { apiRequest } from '@/lib/api';

function localizeScope(scope) {
  const map = {
    system: 'Платформа',
    clinic: 'Клиника',
    branch: 'Филиал',
    personal: 'Личный врач',
  };
  return map[scope] || scope || '—';
}

function localizeStatus(value) {
  const map = {
    draft: 'Черновик',
    published: 'Опубликован',
    archived: 'Архив',
  };
  return map[value] || value || '—';
}

function localizeSpecialty(value) {
  const map = {
    general: 'Общая практика',
    therapy: 'Терапия',
    surgery: 'Хирургия',
    dermatology: 'Дерматология',
    cardiology: 'Кардиология',
    neurology: 'Неврология',
    anesthesia: 'Анестезиология',
    inpatient: 'Стационар',
  };
  return map[value] || value || '—';
}

export default function PlatformTemplatesPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function loadOverview() {
      setLoading(true);
      setError('');
      try {
        const payload = await apiRequest('/api/v1/platform/templates/overview');
        if (!cancelled) setData(payload);
      } catch (requestError) {
        if (!cancelled) setError(requestError.message || 'Не удалось загрузить контур шаблонов');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadOverview();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return <Skeleton className="h-[520px] w-full" />;
  }

  if (error) {
    return <ErrorBanner message={error} />;
  }

  const summary = data?.summary || {};
  const clinicUsage = data?.clinic_usage || [];
  const topTemplates = data?.top_templates || [];
  const recentUpdates = data?.recent_updates || [];
  const recommendedUpdates = data?.recommended_updates || [];

  return (
    <div className="space-y-6">
      <header className="page-header">
        <div>
          <h1 className="page-title">Шаблоны и контент</h1>
          <p className="page-subtitle">
            Платформенный контур шаблонов, личных протоколов врача и аналитики использования по клиникам.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link className="btn-secondary" href="/platform/ai">Центр AI</Link>
          <Link className="btn-primary" href="/platform/clinics">Клиники и филиалы</Link>
        </div>
      </header>

      <ShowcasePanel
        eyebrow="Контентный слой"
        title="Шаблоны, которые реально живут в клиниках и у врачей"
        description="Платформа видит, какие шаблоны опубликованы, какие используются чаще всего и где контент распадается по филиалам и личным наборам врачей."
        imageSrc="/assets/img/admin-side.svg"
        imageAlt="Контентный контур"
        badges={[
          `${summary.templates || 0} шаблонов`,
          `${summary.clinics || 0} клиник`,
          `${summary.published || 0} опубликовано`,
          `${summary.usage_total || 0} использований`,
        ]}
      />

      <section className="kpi-grid">
        <Card title="Всего шаблонов"><p className="text-4xl font-semibold text-lapka-900">{summary.templates || 0}</p></Card>
        <Card title="Клиник в контуре"><p className="text-4xl font-semibold text-lapka-900">{summary.clinics || 0}</p></Card>
        <Card title="Шаблонов по умолчанию"><p className="text-4xl font-semibold text-lapka-900">{summary.defaults || 0}</p></Card>
        <Card title="Всего использований"><p className="text-4xl font-semibold text-lapka-900">{summary.usage_total || 0}</p></Card>
        <Card title="Врачей используют"><p className="text-4xl font-semibold text-lapka-900">{summary.doctors_using || 0}</p></Card>
        <Card title="Нужно обновить"><p className="text-4xl font-semibold text-lapka-900">{summary.recommended_updates || 0}</p></Card>
      </section>

      <section className="grid-soft-3 items-start">
        <Card title="Уровни шаблонов" subtitle="Где живёт контент и как он распределён по слоям">
          <div className="space-y-3">
            {Object.entries(data?.scope_counts || {}).map(([scope, count]) => (
              <div key={scope} className="flex items-center justify-between rounded-[22px] border border-lapka-200 bg-white px-4 py-4">
                <div>
                  <p className="text-base font-semibold text-lapka-900">{localizeScope(scope)}</p>
                  <p className="text-sm text-lapka-500">Уровень контента</p>
                </div>
                <span className="text-2xl font-semibold text-lapka-900">{count || 0}</span>
              </div>
            ))}
          </div>
        </Card>
        <Card title="Статус шаблонов" subtitle="Черновики, публикации и архив">
          <div className="space-y-3">
            {Object.entries(data?.status_counts || {}).map(([statusKey, count]) => (
              <div key={statusKey} className="flex items-center justify-between rounded-[22px] border border-lapka-200 bg-white px-4 py-4">
                <div>
                  <p className="text-base font-semibold text-lapka-900">{localizeStatus(statusKey)}</p>
                  <p className="text-sm text-lapka-500">Состояние контента</p>
                </div>
                <span className="text-2xl font-semibold text-lapka-900">{count || 0}</span>
              </div>
            ))}
          </div>
        </Card>
        <Card title="Типы контента" subtitle="Что доминирует в базе знаний и протоколах">
          <div className="space-y-3">
            {Object.entries(data?.type_counts || {}).map(([type, count]) => (
              <div key={type} className="flex items-center justify-between rounded-[22px] border border-lapka-200 bg-white px-4 py-4">
                <div>
                  <p className="text-base font-semibold text-lapka-900">{type}</p>
                  <p className="text-sm text-lapka-500">Тип шаблона</p>
                </div>
                <span className="text-2xl font-semibold text-lapka-900">{count || 0}</span>
              </div>
            ))}
          </div>
        </Card>
      </section>

      <section className="grid gap-6 2xl:grid-cols-2">
        <Card title="Клиники и adoption" subtitle="Где контент реально работает и используется">
          {clinicUsage.length ? (
            <Table
              columns={[
                { id: 'clinic_name', label: 'Клиника' },
                { id: 'templates', label: 'Шаблоны' },
                { id: 'published', label: 'Опубликовано' },
                { id: 'defaults', label: 'По умолчанию' },
                { id: 'personal', label: 'Личные' },
                { id: 'branch', label: 'Филиал' },
                { id: 'doctors_using', label: 'Врачей' },
                { id: 'usage_count', label: 'Использований' },
              ]}
              rows={clinicUsage.map((row) => ({
                id: row.clinic_id,
                clinic_id: row.clinic_id,
                clinic_name: row.clinic_name,
                templates: String(row.templates || 0),
                published: String(row.published || 0),
                defaults: String(row.defaults || 0),
                personal: String(row.personal || 0),
                branch: String(row.branch || 0),
                doctors_using: String(row.doctors_using || 0),
                usage_count: String(row.usage_count || 0),
              }))}
              rowActions={(row) => [
                { label: 'Карточка клиники', href: `/platform/clinics/${row.clinic_id}` },
              ]}
            />
          ) : (
            <EmptyState title="Пока нет контента" text="После публикации шаблонов клиниками здесь появится аналитика adoption." />
          )}
        </Card>

        <Card title="Топ шаблонов" subtitle="Чаще всего используемые шаблоны в сети">
          {topTemplates.length ? (
            <Table
              columns={[
                { id: 'name', label: 'Шаблон' },
                { id: 'clinic_name', label: 'Клиника' },
                { id: 'scope_label', label: 'Уровень' },
                { id: 'specialty_label', label: 'Специализация' },
                { id: 'status_label', label: 'Статус' },
                { id: 'usage_count', label: 'Использований' },
                { id: 'recommended_updates', label: 'Обновить' },
              ]}
              rows={topTemplates.map((row) => ({
                id: row.id,
                name: row.name,
                clinic_name: row.clinic_name,
                scope_label: localizeScope(row.scope),
                specialty_label: localizeSpecialty(row.specialty),
                status_label: localizeStatus(row.status),
                usage_count: String(row.usage_count || 0),
                recommended_updates: row.recommended_updates || 'Нет',
              }))}
            />
          ) : (
            <EmptyState title="Пока нет активности" text="Использование шаблонов появится после первых визитов и протоколов." />
          )}
        </Card>
      </section>

      <Card title="Последние обновления" subtitle="Кто и где менял шаблоны в платформенном контуре">
        {recentUpdates.length ? (
          <Table
            columns={[
              { id: 'name', label: 'Шаблон' },
              { id: 'clinic_name', label: 'Клиника' },
              { id: 'scope_label', label: 'Уровень' },
              { id: 'status_label', label: 'Статус' },
              { id: 'author_name', label: 'Автор' },
            ]}
            rows={recentUpdates.map((row) => ({
              id: row.id,
              name: row.name,
              clinic_name: row.clinic_name,
              scope_label: localizeScope(row.scope),
              status_label: localizeStatus(row.status),
              author_name: row.author_name,
            }))}
          />
        ) : (
          <EmptyState title="Пока нет обновлений" text="История появится после правок и публикаций шаблонов." />
        )}
      </Card>

      <Card title="Рекомендованные обновления" subtitle="Шаблоны с высоким использованием или устаревшим содержимым">
        {recommendedUpdates.length ? (
          <Table
            columns={[
              { id: 'name', label: 'Шаблон' },
              { id: 'clinic_name', label: 'Клиника' },
              { id: 'scope_label', label: 'Уровень' },
              { id: 'usage_count', label: 'Использований' },
              { id: 'reason', label: 'Причина' },
            ]}
            rows={recommendedUpdates.map((row) => ({
              id: row.id,
              name: row.name,
              clinic_name: row.clinic_name,
              scope_label: localizeScope(row.scope),
              usage_count: String(row.usage_count || 0),
              reason: row.reason,
            }))}
          />
        ) : (
          <EmptyState title="Пока нет рекомендаций" text="Когда шаблоны накопят использование или устареют, здесь появятся подсказки на обновление." />
        )}
      </Card>
    </div>
  );
}
