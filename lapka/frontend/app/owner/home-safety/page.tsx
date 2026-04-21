'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Card from '@/components/ui/Card';
import EmptyState from '@/components/ui/EmptyState';
import ErrorBanner from '@/components/ui/ErrorBanner';
import Skeleton from '@/components/ui/Skeleton';
import ShowcasePanel from '@/components/ui/ShowcasePanel';
import { loadOwnerBaseData } from '@/lib/owner-data';
import { buildHomeSafetyMap } from '@/lib/owner-workspace';
import { resolvePetPhoto } from '@/lib/pets';

function priorityLabel(priority) {
  if (priority === 'critical') return 'Критично';
  if (priority === 'high') return 'Высокий риск';
  return 'Проверить';
}

export default function OwnerHomeSafetyPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pets, setPets] = useState([]);
  const [selectedPetId, setSelectedPetId] = useState('');

  const selectedPet = useMemo(() => pets.find((item) => item.id === selectedPetId) || null, [pets, selectedPetId]);
  const safety = useMemo(() => buildHomeSafetyMap({ pet: selectedPet }), [selectedPet]);

  const loadPage = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const base = await loadOwnerBaseData();
      setPets(base.pets);
      setSelectedPetId(base.pets[0]?.id || '');
    } catch (requestError) {
      setError(requestError.message || 'Не удалось загрузить карту домашних рисков');
      setPets([]);
      setSelectedPetId('');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPage();
  }, [loadPage]);

  return (
    <div className="space-y-7">
      <header className="page-header">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-lapka-500">Безопасность</p>
          <h1 className="page-title">Карта домашних рисков</h1>
          <p className="page-subtitle">Домашняя безопасность — это часть повседневного ухода. Токсичные продукты, лекарства человека и бытовая химия должны быть видны в одном понятном сценарии.</p>
        </div>
      </header>

      {error ? <ErrorBanner message={error} onRetry={loadPage} /> : null}

      {loading ? (
        <section className="space-y-4">
          <Skeleton className="h-[340px] w-full" />
          <Skeleton className="h-[380px] w-full" />
        </section>
      ) : !selectedPet ? (
        <EmptyState title="Нет активного питомца" text="Добавьте питомца, чтобы собрать домашнюю карту рисков." />
      ) : (
        <>
          <ShowcasePanel
            eyebrow="Безопасность"
            title={`${selectedPet.name}: домашняя карта рисков`}
            description="Проверьте зоны риска дома заранее: растения, химия, лекарства человека, провода и мелкие предметы. Это продолжение центра знаний и emergency-слоя."
            imageSrc={resolvePetPhoto(selectedPet)}
            imageAlt={selectedPet.name}
            badges={['Дом', 'Токсичные продукты', 'Профилактика']}
            compact
          />

          <Card title="Питомец">
            <div className="flex flex-wrap gap-2">
              {pets.map((pet) => (
                <button key={pet.id} type="button" className={selectedPetId === pet.id ? 'btn-primary !min-h-[42px] !px-4 !py-2 text-sm' : 'btn-secondary !min-h-[42px] !px-4 !py-2 text-sm'} onClick={() => setSelectedPetId(pet.id)}>
                  {pet.name}
                </button>
              ))}
            </div>
          </Card>

          <section className="grid items-start gap-5 2xl:grid-cols-[1.06fr_0.94fr]">
            <Card title="Зоны риска" subtitle="Что проверить дома в первую очередь">
              <div className="space-y-3">
                {safety.hazards.map((item) => (
                  <div key={item.id} className="rounded-[24px] border border-lapka-200 bg-white px-4 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-lg font-bold text-lapka-900">{item.title}</p>
                        <p className="mt-1 text-sm text-lapka-600">{item.zone}</p>
                      </div>
                      <span className={item.priority === 'critical' ? 'badge-red' : item.priority === 'high' ? 'badge-yellow' : 'pill !px-3 !py-1.5'}>{priorityLabel(item.priority)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
            <Card title="Домашний чек-лист" subtitle="Короткая еженедельная проверка без перегруза">
              <div className="space-y-3">
                {safety.checks.map((item) => (
                  <div key={item} className="rounded-[24px] border border-lapka-200 bg-white px-4 py-4 text-sm leading-relaxed text-lapka-700">{item}</div>
                ))}
              </div>
            </Card>
          </section>

          <section className="grid items-start gap-5 2xl:grid-cols-[1.03fr_0.97fr]">
            <Card title="Частые опасные продукты" subtitle="Быстрый слой поверх большой базы знаний">
              <div className="grid gap-3 md:grid-cols-2">
                {safety.quickProducts.map((item) => (
                  <div key={item.id} className="rounded-[24px] border border-lapka-200 bg-white px-4 py-4">
                    <p className="text-lg font-bold text-lapka-900">{item.name}</p>
                    <p className="mt-1 text-sm text-lapka-600">{item.why}</p>
                  </div>
                ))}
              </div>
            </Card>
            <Card title="Куда идти дальше" subtitle="Карта рисков связана с базой знаний и экстренным сценарием">
              <div className="grid gap-3">
                <Link href="/owner/knowledge?tab=danger" className="action-grid-link">
                  <div>
                    <p className="text-lg font-bold text-lapka-900">Опасные продукты</p>
                    <p className="mt-1 text-sm text-lapka-600">Открыть центр знаний по бытовым рискам.</p>
                  </div>
                  <span className="pill !px-3 !py-1.5">Знания</span>
                </Link>
                <Link href="/owner/quick-triage" className="action-grid-link">
                  <div>
                    <p className="text-lg font-bold text-lapka-900">SOS-сценарий</p>
                    <p className="mt-1 text-sm text-lapka-600">Если есть риск отравления или тяжёлой реакции.</p>
                  </div>
                  <span className="pill !px-3 !py-1.5">SOS</span>
                </Link>
              </div>
            </Card>
          </section>
        </>
      )}
    </div>
  );
}
