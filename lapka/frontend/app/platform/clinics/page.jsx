'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import AppImage from '@/components/ui/AppImage';
import Card from '@/components/ui/Card';
import ShowcasePanel from '@/components/ui/ShowcasePanel';
import Table from '@/components/ui/Table';
import Skeleton from '@/components/ui/Skeleton';
import ErrorBanner from '@/components/ui/ErrorBanner';
import { apiRequest } from '@/lib/api';
import { resolveClinicGallery, resolveClinicPhoto } from '@/lib/pets';

export default function PlatformClinicsPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function loadRows() {
      setLoading(true);
      setError('');
      try {
        const payload = await apiRequest('/api/v1/clinics/platform-registry');
        if (!cancelled) setRows(Array.isArray(payload) ? payload : []);
      } catch (requestError) {
        if (!cancelled) setError(requestError.message || 'Не удалось загрузить клиники');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadRows();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-6">
      <header className="page-header">
        <div>
          <h1 className="page-title">Клиники и филиалы</h1>
          <p className="page-subtitle">Платформенный реестр организаций, брендов и филиалов, на который опираются переключение клиник, AI-политики и шаблоны.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href="/platform/branches" className="btn-secondary">Реестр филиалов</Link>
          <Link href="/platform/ai" className="btn-primary">Центр AI</Link>
        </div>
      </header>
      {error ? <ErrorBanner message={error} /> : null}
      {loading ? <Skeleton className="h-56 w-full" /> : (
        <>
          <ShowcasePanel
            eyebrow="Реестр организаций"
            title="Клиники и филиалы, готовые к централизованному управлению"
            description="Реестр теперь показывает не только обложки клиник, но и живые сетевые сигналы: филиалы, состав команды, активный стационар, сервисы и AI-переопределения."
            imageSrc="/assets/img/clinic-ops.svg"
            imageAlt="Реестр клиник"
            badges={[`${rows.length} клиник`, 'Сетевой контур', 'Филиалы и команды']}
            compact
          />
          <section className="kpi-grid">
            <Card title="Клиники">
              <p className="text-4xl font-semibold text-lapka-900">{rows.length}</p>
            </Card>
            <Card title="Филиалы">
              <p className="text-4xl font-semibold text-lapka-900">{rows.reduce((sum, row) => sum + (row.stats?.branches || 0), 0)}</p>
            </Card>
            <Card title="Врачи">
              <p className="text-4xl font-semibold text-lapka-900">{rows.reduce((sum, row) => sum + (row.stats?.vets || 0), 0)}</p>
            </Card>
            <Card title="Активный стационар">
              <p className="text-4xl font-semibold text-lapka-900">{rows.reduce((sum, row) => sum + (row.stats?.active_inpatient || 0), 0)}</p>
            </Card>
          </section>
          <section className="grid gap-4 xl:grid-cols-2">
            {rows.map((clinic) => {
              const gallery = resolveClinicGallery(clinic).slice(0, 3);
              return (
                <Card
                  key={clinic.id}
                  className="overflow-hidden p-0"
                  title={clinic.name}
                  subtitle={`${clinic.city || 'Локация'} · ${clinic.address || 'Адрес уточняется'}`}
                  action={<span className={clinic.emergency_available ? 'badge-red' : 'badge-green'}>{clinic.emergency_available ? 'Экстренный контур' : 'Плановый контур'}</span>}
                >
                  <div className="space-y-0">
                    <div className="relative h-48 w-full overflow-hidden border-b border-lapka-200">
                      <AppImage
                        src={resolveClinicPhoto(clinic)}
                        alt={clinic.name}
                        fill
                        sizes="(max-width: 1280px) 100vw, 640px"
                        className="object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-lapka-900/45 via-lapka-900/10 to-transparent" />
                      <div className="absolute bottom-3 left-3 rounded-xl bg-white/92 px-3 py-2 backdrop-blur">
                        <p className="text-sm font-semibold text-lapka-900">{clinic.name}</p>
                        <p className="text-xs text-lapka-600">{clinic.phone || 'Контакты уточняются'}</p>
                      </div>
                    </div>
                      <div className="grid gap-3 p-4">
                        <div className="flex flex-wrap gap-2">
                          <span className="pill">{clinic.city || 'Город'}</span>
                          <span className="pill">{clinic.hours || 'График уточняется'}</span>
                          <span className="pill">{Array.isArray(clinic.photos) ? clinic.photos.length : gallery.length} фото</span>
                          <span className="pill">{clinic.stats?.branches || 0} филиалов</span>
                        </div>
                      {gallery.length > 1 ? (
                        <div className="grid gap-2 sm:grid-cols-3">
                          {gallery.map((imageSrc, index) => (
                            <div key={`${clinic.id}-${imageSrc}-${index}`} className="overflow-hidden rounded-2xl border border-lapka-200 bg-lapka-50">
                              <AppImage
                                src={imageSrc}
                                alt={`${clinic.name} — фото ${index + 1}`}
                                width={480}
                                height={320}
                                sizes="(max-width: 768px) 100vw, 180px"
                                className="h-24 w-full object-cover"
                              />
                            </div>
                          ))}
                        </div>
                      ) : null}
                      <div className="grid gap-2 text-sm text-lapka-700 sm:grid-cols-2 xl:grid-cols-3">
                        <div className="rounded-2xl border border-lapka-200 bg-white px-3 py-3">
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-lapka-500">Контур организации</p>
                          <p className="mt-2 font-semibold text-lapka-900">{clinic.emergency_available ? 'Экстренный и плановый поток' : 'Плановый поток'}</p>
                        </div>
                        <div className="rounded-2xl border border-lapka-200 bg-white px-3 py-3">
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-lapka-500">Команда</p>
                          <p className="mt-2 font-semibold text-lapka-900">{clinic.stats?.vets || 0} врачей и {clinic.stats?.admins || 0} администраторов</p>
                        </div>
                        <div className="rounded-2xl border border-lapka-200 bg-white px-3 py-3">
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-lapka-500">Операционный слой</p>
                          <p className="mt-2 font-semibold text-lapka-900">{clinic.stats?.upcoming_appointments || 0} записей · {clinic.stats?.active_inpatient || 0} в стационаре</p>
                        </div>
                        <div className="rounded-2xl border border-lapka-200 bg-white px-3 py-3">
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-lapka-500">Пациенты по согласию</p>
                          <p className="mt-2 font-semibold text-lapka-900">{clinic.stats?.patients || 0} питомцев в активном контуре</p>
                        </div>
                        <div className="rounded-2xl border border-lapka-200 bg-white px-3 py-3">
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-lapka-500">Сервисы и шаблоны</p>
                          <p className="mt-2 font-semibold text-lapka-900">{clinic.stats?.services || 0} активных сервисов</p>
                        </div>
                        <div className="rounded-2xl border border-lapka-200 bg-white px-3 py-3">
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-lapka-500">AI-контур</p>
                          <p className="mt-2 font-semibold text-lapka-900">{clinic.stats?.ai_overrides || 0} переопределений для клиники</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Link className="btn-secondary !px-3 !py-1.5" href={`/platform/clinics/${clinic.id}`}>Карточка клиники</Link>
                        <Link className="btn-secondary !px-3 !py-1.5" href="/platform/security">Безопасность</Link>
                        <Link className="btn-primary !px-3 !py-1.5" href="/platform/ai">Центр AI</Link>
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </section>
          <Card title="Реестр клиник">
            <Table
              columns={[
                { id: 'name', label: 'Название' },
                { id: 'city', label: 'Город' },
                { id: 'branches', label: 'Филиалы' },
                { id: 'vets', label: 'Врачи' },
                { id: 'patients', label: 'Пациенты' },
                { id: 'inpatient', label: 'Стационар' },
                { id: 'ai', label: 'AI' },
              ]}
              rows={rows.map((row) => ({
                id: row.id,
                name: row.name,
                city: row.city || '—',
                branches: String(row.stats?.branches || 0),
                vets: String(row.stats?.vets || 0),
                patients: String(row.stats?.patients || 0),
                inpatient: String(row.stats?.active_inpatient || 0),
                ai: String(row.stats?.ai_overrides || 0),
              }))}
              rowActions={(row) => [
                { label: 'Карточка клиники', href: `/platform/clinics/${row.id}` },
              ]}
            />
          </Card>
        </>
      )}
    </div>
  );
}
