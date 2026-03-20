'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import AppImage from '@/components/ui/AppImage';
import Card from '@/components/ui/Card';
import ErrorBanner from '@/components/ui/ErrorBanner';
import ShowcasePanel from '@/components/ui/ShowcasePanel';
import Skeleton from '@/components/ui/Skeleton';
import StatsCard from '@/components/ui/StatsCard';
import Table from '@/components/ui/Table';
import { apiRequest } from '@/lib/api';
import { resolveClinicGallery } from '@/lib/pets';

export default function PlatformBranchesPage() {
  const searchParams = useSearchParams();
  const selectedClinicId = searchParams?.get('clinic_id') || '';
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function loadRows() {
      setLoading(true);
      setError('');
      try {
        const query = selectedClinicId ? `?clinic_id=${encodeURIComponent(selectedClinicId)}` : '';
        const payload = await apiRequest(`/api/v1/clinics/platform-branches${query}`);
        if (!cancelled) setRows(Array.isArray(payload) ? payload : []);
      } catch (requestError) {
        if (!cancelled) setError(requestError.message || 'Не удалось загрузить филиалы сети');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadRows();
    return () => {
      cancelled = true;
    };
  }, [selectedClinicId]);

  const cities = useMemo(() => new Set(rows.map((row) => row.city).filter(Boolean)).size, [rows]);
  const primaryCount = useMemo(() => rows.filter((row) => row.is_primary).length, [rows]);
  const emergencyCount = useMemo(() => rows.filter((row) => row.emergency_available).length, [rows]);
  const flowPressure = useMemo(
    () => rows.reduce((sum, row) => sum + Number(row.stats?.blocked_flow || 0), 0),
    [rows]
  );

  return (
    <div className="space-y-6">
      <header className="page-header">
        <div>
          <p className="page-eyebrow">Платформенный контур</p>
          <h1 className="page-title">Филиалы и ресурсы сети</h1>
          <p className="page-subtitle">Операционный реестр филиалов, загрузки, телемедицины, комнат и узких мест на уровне сети клиник.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href="/platform/clinics" className="btn-secondary">Клиники</Link>
          <Link href="/platform/dashboard" className="btn-secondary">Платформенный обзор</Link>
        </div>
      </header>

      {error ? <ErrorBanner message={error} /> : null}

      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-72 w-full" />
        </div>
      ) : (
        <>
          <ShowcasePanel
            eyebrow="Операционный реестр"
            title="Филиалы сети как отдельный уровень управления"
            description={selectedClinicId
              ? 'Реестр отфильтрован по выбранной клинике: видно нагрузку филиалов, телемедицину, стационар и сигналы перегрузки.'
              : 'Здесь видно, какие филиалы тянут поток, где формируются задержки, где выше телемедицина и как распределяется операционная нагрузка по сети.'}
            imageSrc="/assets/img/clinic-ops.svg"
            imageAlt="Реестр филиалов"
            badges={[`${rows.length} филиалов`, `${cities} городов`, `${emergencyCount} экстренных`, `${flowPressure} сигналов перегрузки`]}
            compact
          />

          <section className="kpi-grid">
            <StatsCard label="Филиалы" value={String(rows.length)} />
            <StatsCard label="Главные филиалы" value={String(primaryCount)} />
            <StatsCard label="Городов" value={String(cities)} />
            <StatsCard label="Перегрузки потока" value={String(flowPressure)} />
          </section>

          <section className="grid gap-4 xl:grid-cols-2">
            {rows.slice(0, 8).map((branch) => {
              const gallery = resolveClinicGallery({ photos: branch.photos, photo_url: branch.cover_photo }).slice(0, 3);
              const branchDetailHref = `/platform/branches/${branch.id}`;
              const scopedSchedule = `/clinic/schedule?clinic_id=${encodeURIComponent(branch.clinic_id)}&branch_id=${encodeURIComponent(branch.id)}`;
              const scopedFlowboard = `/clinic/flowboard?clinic_id=${encodeURIComponent(branch.clinic_id)}&branch_id=${encodeURIComponent(branch.id)}`;
              const scopedInpatient = `/clinic/inpatient?clinic_id=${encodeURIComponent(branch.clinic_id)}&branch_id=${encodeURIComponent(branch.id)}`;
              return (
                <Card
                  key={branch.id}
                  className="overflow-hidden p-0"
                  title={branch.clinic_name}
                  subtitle={`${branch.city || 'Город'} · ${branch.address || 'Адрес уточняется'}`}
                  action={<span className={branch.emergency_available ? 'badge-red' : 'badge-blue'}>{branch.emergency_available ? 'Экстренный филиал' : 'Плановый филиал'}</span>}
                >
                  <div className="space-y-0">
                    <div className="relative h-40 w-full overflow-hidden border-b border-lapka-200">
                      <AppImage
                        src={branch.cover_photo || gallery[0] || '/assets/img/clinic-ops.svg'}
                        alt={branch.clinic_name}
                        fill
                        sizes="(max-width: 1280px) 100vw, 640px"
                        className="object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-lapka-900/45 via-lapka-900/10 to-transparent" />
                      <div className="absolute bottom-3 left-3 rounded-xl bg-white/92 px-3 py-2 backdrop-blur">
                        <p className="text-sm font-semibold text-lapka-900">{branch.is_primary ? 'Главный филиал' : 'Филиал'}</p>
                        <p className="text-xs text-lapka-600">{branch.phone || 'Контакт уточняется'}</p>
                      </div>
                    </div>
                    <div className="grid gap-3 p-4">
                      <div className="flex flex-wrap gap-2">
                        <span className="pill">{branch.hours || 'График уточняется'}</span>
                        <span className="pill">{branch.stats?.appointments_14d || 0} записей / 14 дней</span>
                        <span className="pill">{branch.stats?.clinic_vets || 0} врачей</span>
                      </div>
                      {gallery.length > 1 ? (
                        <div className="grid gap-2 sm:grid-cols-3">
                          {gallery.map((imageSrc, index) => (
                            <div key={`${branch.id}-${imageSrc}-${index}`} className="overflow-hidden rounded-2xl border border-lapka-200 bg-lapka-50">
                              <AppImage
                                src={imageSrc}
                                alt={`${branch.clinic_name} — фото ${index + 1}`}
                                width={480}
                                height={320}
                                sizes="(max-width: 768px) 100vw, 180px"
                                className="h-24 w-full object-cover"
                              />
                            </div>
                          ))}
                        </div>
                      ) : null}
                      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                        <div className="rounded-2xl border border-lapka-200 bg-lapka-50 px-3 py-3">
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-lapka-500">Поток сейчас</p>
                          <p className="mt-2 text-2xl font-extrabold text-lapka-900">{branch.stats?.active_flow || 0}</p>
                        </div>
                        <div className="rounded-2xl border border-lapka-200 bg-lapka-50 px-3 py-3">
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-lapka-500">Телемедицина</p>
                          <p className="mt-2 text-2xl font-extrabold text-lapka-900">{branch.stats?.telemedicine_14d || 0}</p>
                        </div>
                        <div className="rounded-2xl border border-lapka-200 bg-lapka-50 px-3 py-3">
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-lapka-500">Готовы к выписке</p>
                          <p className="mt-2 text-2xl font-extrabold text-lapka-900">{branch.stats?.ready_for_discharge || 0}</p>
                        </div>
                        <div className="rounded-2xl border border-lapka-200 bg-lapka-50 px-3 py-3">
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-lapka-500">Сигналы перегрузки</p>
                          <p className="mt-2 text-2xl font-extrabold text-lapka-900">{branch.stats?.blocked_flow || 0}</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Link className="btn-primary !px-3 !py-1.5" href={branchDetailHref}>Карточка филиала</Link>
                        <Link className="btn-secondary !px-3 !py-1.5" href={scopedSchedule}>Календарь филиала</Link>
                        <Link className="btn-secondary !px-3 !py-1.5" href={scopedFlowboard}>Поток филиала</Link>
                        <Link className="btn-secondary !px-3 !py-1.5" href={scopedInpatient}>Стационар филиала</Link>
                        <Link className="btn-secondary !px-3 !py-1.5" href={`/platform/clinics/${branch.clinic_id}`}>Карточка клиники</Link>
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </section>

          <Card title="Реестр филиалов" subtitle="Операционный разрез сети по адресам, потокам и сигналам">
            <Table
              columns={[
                { id: 'clinic', label: 'Клиника' },
                { id: 'city', label: 'Город' },
                { id: 'branch', label: 'Филиал' },
                { id: 'appointments', label: 'Записи' },
                { id: 'flow', label: 'Поток' },
                { id: 'signals', label: 'Сигналы' },
              ]}
              rows={rows.map((row) => ({
                id: row.id,
                clinic: row.clinic_name,
                city: row.city || '—',
                branch: row.is_primary ? 'Главный филиал' : 'Филиал',
                appointments: String(row.stats?.appointments_14d || 0),
                flow: String(row.stats?.active_flow || 0),
                signals: String(row.stats?.blocked_flow || 0),
              }))}
              rowActions={(row) => {
                const branch = rows.find((candidate) => candidate.id === row.id);
                if (!branch) return [];
                return [
                  { label: 'Карточка филиала', href: `/platform/branches/${branch.id}` },
                  { label: 'Календарь филиала', href: `/clinic/schedule?clinic_id=${branch.clinic_id}&branch_id=${branch.id}` },
                  { label: 'Карточка клиники', href: `/platform/clinics/${branch.clinic_id}` },
                ];
              }}
            />
          </Card>
        </>
      )}
    </div>
  );
}
