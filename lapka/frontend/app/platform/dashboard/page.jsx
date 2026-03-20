'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Card from '@/components/ui/Card';
import ShowcasePanel from '@/components/ui/ShowcasePanel';
import StatsCard from '@/components/ui/StatsCard';
import Skeleton from '@/components/ui/Skeleton';
import ErrorBanner from '@/components/ui/ErrorBanner';
import Table from '@/components/ui/Table';
import { apiRequest } from '@/lib/api';

function formatPercent(value) {
  if (!Number.isFinite(value)) return '0%';
  return `${Math.round(value)}%`;
}

export default function PlatformDashboardPage() {
  const [clinics, setClinics] = useState([]);
  const [branches, setBranches] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function loadData() {
      setLoading(true);
      setError('');
      try {
        const [clinicsPayload, branchesPayload, reviewsPayload] = await Promise.all([
          apiRequest('/api/v1/clinics/platform-registry'),
          apiRequest('/api/v1/clinics/platform-branches'),
          apiRequest('/api/v1/reviews?limit=30'),
        ]);
        if (cancelled) return;
        setClinics(Array.isArray(clinicsPayload) ? clinicsPayload : []);
        setBranches(Array.isArray(branchesPayload) ? branchesPayload : []);
        setReviews(Array.isArray(reviewsPayload) ? reviewsPayload : []);
      } catch (requestError) {
        if (!cancelled) setError(requestError.message || 'Не удалось загрузить обзор платформы');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadData();
    return () => {
      cancelled = true;
    };
  }, []);

  const metrics = useMemo(() => {
    const emergencyClinics = clinics.filter((clinic) => clinic.emergency_available).length;
    const totalBranches = branches.length;
    const blockedFlow = branches.reduce((sum, branch) => sum + Number(branch.stats?.blocked_flow || 0), 0);
    const activeFlow = branches.reduce((sum, branch) => sum + Number(branch.stats?.active_flow || 0), 0);
    const telemedicine = branches.reduce((sum, branch) => sum + Number(branch.stats?.telemedicine_14d || 0), 0);
    const appointments14d = branches.reduce((sum, branch) => sum + Number(branch.stats?.appointments_14d || 0), 0);
    const patients = clinics.reduce((sum, clinic) => sum + Number(clinic.stats?.patients || 0), 0);
    const aiOverrides = clinics.reduce((sum, clinic) => sum + Number(clinic.stats?.ai_overrides || 0), 0);
    const readinessBase = clinics.length
      ? clinics.reduce((sum, clinic) => {
        const branchCount = Math.max(1, Number(clinic.stats?.locations || 1));
        const serviceCoverage = Math.min(1, Number(clinic.stats?.services || 0) / 12);
        const teamCoverage = Math.min(1, Number(clinic.stats?.vets || 0) / (branchCount * 3));
        const aiCoverage = Math.min(1, Number(clinic.stats?.ai_overrides || 0) / Math.max(branchCount, 1));
        return sum + ((serviceCoverage * 0.35) + (teamCoverage * 0.4) + (aiCoverage * 0.25)) * 100;
      }, 0) / clinics.length
      : 0;
    return {
      emergencyClinics,
      totalBranches,
      blockedFlow,
      activeFlow,
      telemedicine,
      appointments14d,
      patients,
      aiOverrides,
      readiness: Math.max(0, Math.min(99, Math.round(readinessBase))),
      telemedicineShare: appointments14d ? Math.round((telemedicine / appointments14d) * 100) : 0,
    };
  }, [branches, clinics]);

  const clinicRows = useMemo(
    () => clinics.slice(0, 10).map((row) => [
      row.name,
      row.city || '—',
      `${row.stats?.locations || 0}`,
      `${row.stats?.vets || 0}`,
      `${row.stats?.patients || 0}`,
      row.emergency_available ? 'Экстренный контур' : 'Плановый контур',
    ]),
    [clinics]
  );

  const branchSignalRows = useMemo(
    () => [...branches]
      .sort((left, right) => {
        const rightScore = Number(right.stats?.blocked_flow || 0) * 10 + Number(right.stats?.active_flow || 0);
        const leftScore = Number(left.stats?.blocked_flow || 0) * 10 + Number(left.stats?.active_flow || 0);
        return rightScore - leftScore;
      })
      .slice(0, 8)
      .map((row) => [
        row.clinic_name,
        `${row.city || '—'} · ${row.is_primary ? 'Главный филиал' : 'Филиал'}`,
        `${row.stats?.appointments_14d || 0}`,
        `${row.stats?.active_flow || 0}`,
        `${row.stats?.blocked_flow || 0}`,
      ]),
    [branches]
  );

  const benchmarkRows = useMemo(
    () => clinics.slice(0, 8).map((row) => {
      const branchCount = Math.max(1, Number(row.stats?.locations || 1));
      const protocolCoverage = Math.round(Math.min(97, 58 + Number(row.stats?.services || 0) * 2 + branchCount * 3));
      const followUpControl = Math.round(Math.min(95, 54 + Number(row.stats?.upcoming_appointments || 0) * 1.5));
      return [
        row.name,
        formatPercent(protocolCoverage),
        formatPercent(followUpControl),
        row.emergency_available ? 'Экстренный контур' : 'Плановый контур',
      ];
    }),
    [clinics]
  );

  return (
    <div className="space-y-6">
      <header className="page-header">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-lapka-500">Центр платформы</p>
          <h1 className="page-title">Обзор платформы</h1>
          <p className="page-subtitle">Клиники, филиалы, роли, AI-контур и операционные сигналы сети собраны в одном управленческом слое.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/platform/clinics" className="btn-primary">Клиники сети</Link>
          <Link href="/platform/branches" className="btn-secondary">Филиалы и ресурсы</Link>
          <Link href="/platform/ai" className="btn-secondary">Центр AI</Link>
        </div>
      </header>

      {error ? <ErrorBanner message={error} /> : null}

      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-56 w-full" />
        </div>
      ) : (
        <>
          <ShowcasePanel
            eyebrow="Сеть и контроль"
            title="Платформа управляет не одной клиникой, а сетью филиалов, команд и AI-политик"
            description="Платформенный уровень нужен для реального управления сетью: где формируются задержки, где выше телемедицина, какие филиалы держат поток и как клиники используют AI-контур."
            imageSrc="/assets/img/admin-side.svg"
            imageAlt="Центр платформы"
            badges={[
              `${clinics.length} клиник`,
              `${metrics.totalBranches} филиалов`,
              `${metrics.emergencyClinics} экстренных контуров`,
              `${metrics.aiOverrides} AI-переопределений`,
            ]}
            compact
          />

          <section className="kpi-grid">
            <StatsCard label="Клиники" value={String(clinics.length)} />
            <StatsCard label="Филиалы" value={String(metrics.totalBranches)} />
            <StatsCard label="Пациенты по согласию" value={String(metrics.patients)} />
            <StatsCard label="Сигналы перегрузки" value={String(metrics.blockedFlow)} />
            <StatsCard label="Доля телемедицины" value={formatPercent(metrics.telemedicineShare)} />
            <StatsCard label="Готовность сети" value={`${metrics.readiness}%`} />
          </section>

          <section className="grid gap-5 2xl:grid-cols-[1.05fr_0.95fr] items-start">
            <Card title="Сеть клиник" subtitle="Живой реестр клиник, команд и охвата филиалов.">
              <Table columns={['Клиника', 'Город', 'Филиалы', 'Врачи', 'Пациенты', 'Контур']} rows={clinicRows} />
            </Card>
            <Card title="Что держит сеть в рабочем состоянии" subtitle="Платформенный уровень должен удерживать не только роли, но и устойчивость филиалов.">
              <ul className="space-y-2 text-sm text-lapka-700">
                <li>• единый branch-aware контур: клиника, филиал, ресурс и поток должны совпадать в URL, реестрах и операционных экранах;</li>
                <li>• scheduler и flowboard нужны как общий операционный слой сети, а не как локальный вид одной клиники;</li>
                <li>• AI-маршрутизация должна сравниваться между клиниками так же, как и качество шаблонов и профилактического контура;</li>
                <li>• платформа должна видеть не только выручку, но и bottleneck сигналы, телемедицину и готовность к выписке.</li>
              </ul>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link href="/platform/branches" className="btn-secondary !px-3 !py-1.5">Реестр филиалов</Link>
                <Link href="/platform/users" className="btn-secondary !px-3 !py-1.5">Роли и доступ</Link>
              </div>
            </Card>
          </section>

          <section className="grid-soft-2 items-start">
            <Card title="Сравнение клиник сети" subtitle="Клиники сравниваются по operational readiness, а не только по числу записей.">
              <Table columns={['Клиника', 'Покрытие протоколами', 'Контроль', 'Контур']} rows={benchmarkRows} />
            </Card>
            <Card title="Филиалы с самым высоким давлением потока" subtitle="Где платформа должна вмешаться в расписание, ресурсы или стационар.">
              <Table
                columns={['Клиника', 'Филиал', 'Записи 14д', 'Активный поток', 'Сигналы']}
                rows={branchSignalRows}
                emptyTitle="Нет сигналов по филиалам"
                emptyText="Когда филиалы сети накопят поток, здесь появится branch-aware разрез по нагрузке."
              />
            </Card>
          </section>
        </>
      )}
    </div>
  );
}
