'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import TopNavigation from '@/components/ui/TopNavigation';
import AuthDropdown from '@/components/auth/AuthDropdown';
import RoleGate from '@/components/auth/RoleGate';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Skeleton from '@/components/ui/Skeleton';
import EmptyState from '@/components/ui/EmptyState';
import ErrorBanner from '@/components/ui/ErrorBanner';
import ShowcasePanel from '@/components/ui/ShowcasePanel';
import { apiRequest } from '@/lib/api';

const topLinks = [
  { href: '/', label: 'Главная' },
  { href: '/owner/dashboard', label: 'Владелец' },
  { href: '/vet/dashboard', label: 'Врач' },
  { href: '/clinic/dashboard', label: 'Клиника' },
  { href: '/medical/diseases', label: 'Заболевания' },
  { href: '/clinical/protocols', label: 'Протоколы' },
  { href: '/security', label: 'Безопасность' },
];

function localizeCategory(value) {
  const map = {
    general: 'Общее',
    emergency: 'Экстренные',
    gastroenterology: 'ЖКТ',
    neurology: 'Неврология',
    trauma: 'Травмы',
    anesthesia: 'Анестезия',
    surgery: 'Хирургия',
    toxicology: 'Токсикология',
    inpatient: 'Стационар',
    diagnostics: 'Диагностика',
    cardiology: 'Кардиология',
    respiratory: 'Респираторные',
  };
  return map[String(value || '').toLowerCase()] || value || '—';
}

function localizeSpecies(items = []) {
  const map = {
    cat: 'Кошки',
    dog: 'Собаки',
    rabbit: 'Кролики',
    ferret: 'Хорьки',
    bird: 'Птицы',
  };
  if (!items.length) return ['Все виды'];
  return items.map((item) => map[String(item || '').toLowerCase()] || item).filter(Boolean);
}

function protocolIllustration(category) {
  const normalized = String(category || '').toLowerCase();
  if (normalized === 'inpatient') return '/assets/img/inpatient.svg';
  if (normalized === 'emergency' || normalized === 'trauma') return '/assets/img/inpatient-photo.svg';
  if (normalized === 'anesthesia' || normalized === 'surgery') return '/assets/img/clinic-ops.svg';
  return '/assets/img/vet-doctor.svg';
}

export default function ClinicalProtocolDetailsPage({ params }) {
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadProtocol = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const payload = await apiRequest(`/api/v1/protocols/${params.id}`);
      setItem(payload || null);
    } catch (requestError) {
      setError(requestError.message || 'Не удалось загрузить клинический протокол');
      setItem(null);
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    loadProtocol();
  }, [loadProtocol]);

  const species = useMemo(() => localizeSpecies(item?.species || []), [item?.species]);
  const category = localizeCategory(item?.category);

  return (
    <RoleGate allowedRoles={['vet', 'clinic_admin']}>
      <>
        <TopNavigation links={topLinks} actions={<AuthDropdown mode="menu" />} />
        <main className="page-wrap space-y-4 py-6">
          <header className="page-header">
            <div className="space-y-3">
              <Link href="/clinical/protocols" className="btn-secondary inline-flex !px-4 !py-2">
                ← Назад к библиотеке протоколов
              </Link>
              <div>
                <h1 className="page-title">Карточка клинического протокола</h1>
                <p className="page-subtitle">Структура действий, шаги и emergency-маркеры для команды клиники.</p>
              </div>
            </div>
          </header>

          {error ? <ErrorBanner message={error} onRetry={loadProtocol} /> : null}

          <section className="grid gap-4 2xl:grid-cols-[248px_minmax(0,1fr)]">
            <aside className="space-y-4 xl:sticky xl:top-[96px] xl:self-start">
              <Card title="Навигация" subtitle="Связанные клинические разделы">
                <div className="grid gap-2">
                  <Link href="/clinical/protocols" className="sidebar-link">Протоколы</Link>
                  <Link href="/diseases" className="sidebar-link">Заболевания</Link>
                  <Link href="/tools/calculators" className="sidebar-link">Калькуляторы</Link>
                  <Link href="/vet/visit/66666666-6666-6666-6666-666666666666" className="sidebar-link">Открыть в визите</Link>
                </div>
              </Card>
              <Card title="Подсказка" subtitle="Как использовать протокол">
                <ul className="space-y-2 text-sm text-lapka-700">
                  <li>• Протокол структурирует приём, но не заменяет клиническое решение</li>
                  <li>• Экстренные протоколы поднимаются выше в рабочем процессе</li>
                  <li>• Шаги адаптируются врачом под пациента и клиническую картину</li>
                </ul>
              </Card>
            </aside>

            <div className="space-y-4">
              {loading ? (
                <>
                  <Skeleton className="h-[320px] w-full rounded-[32px]" />
                  <div className="grid gap-4 2xl:grid-cols-2">
                    <Skeleton className="h-64 w-full rounded-[28px]" />
                    <Skeleton className="h-64 w-full rounded-[28px]" />
                  </div>
                </>
              ) : !item ? (
                <Card>
                  <EmptyState title="Протокол не найден" text="Проверьте идентификатор или вернитесь к списку." />
                </Card>
              ) : (
                <>
                  <ShowcasePanel
                    eyebrow={category}
                    title={item.name}
                    description={item.description || '—'}
                    imageSrc={protocolIllustration(item.category)}
                    imageAlt={item.name}
                    badges={[
                      `Виды животных: ${species.join(', ')}`,
                      item.emergency_flag ? 'Экстренный протокол' : 'Плановый протокол',
                      `ID: ${item.id}`,
                    ]}
                    compact
                  />

                  <div className="grid gap-4 2xl:grid-cols-[minmax(0,1fr)_340px]">
                    <Card title="Шаги протокола" subtitle={`Всего шагов: ${(item.steps || []).length}`}>
                      {(item.steps || []).length ? (
                        <ol className="space-y-3">
                          {item.steps.map((step, index) => (
                            <li key={`${item.id}-step-${index}`} className="flex gap-3 rounded-2xl border border-lapka-200 bg-lapka-50 px-4 py-3">
                              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-sm font-black text-lapka-700 shadow-sm">
                                {index + 1}
                              </span>
                              <span className="pt-1 text-base leading-7 text-lapka-800">{step}</span>
                            </li>
                          ))}
                        </ol>
                      ) : (
                        <p className="text-base text-lapka-600">Шаги не указаны.</p>
                      )}
                    </Card>

                    <div className="space-y-4">
                      <Card title="Контекст" subtitle="Быстрая сводка">
                        <div className="space-y-3 text-[1.02rem] text-lapka-700">
                          <div className="flex flex-wrap gap-2">
                            {item.emergency_flag ? <Badge tone="danger">EMERGENCY</Badge> : <Badge tone="success">STANDARD</Badge>}
                            <span className="pill">{category}</span>
                          </div>
                          <p><strong>Виды животных:</strong> {species.join(', ')}</p>
                          <p><strong>Описание:</strong> {item.description || '—'}</p>
                        </div>
                      </Card>

                      <Card title="Действия" subtitle="Переходы по рабочему контуру">
                        <div className="grid gap-2">
                          <Link href={`/vet/visit/66666666-6666-6666-6666-666666666666`} className="btn-primary text-center">
                            Открыть в визите
                          </Link>
                          <Link href="/diseases" className="btn-secondary text-center">
                            Открыть справочник заболеваний
                          </Link>
                          <Link href="/tools/calculators" className="btn-secondary text-center">
                            Открыть калькуляторы
                          </Link>
                        </div>
                      </Card>
                    </div>
                  </div>
                </>
              )}
            </div>
          </section>
        </main>
      </>
    </RoleGate>
  );
}
