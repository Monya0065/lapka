'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Card from '@/components/ui/Card';
import EmptyState from '@/components/ui/EmptyState';
import ErrorBanner from '@/components/ui/ErrorBanner';
import Skeleton from '@/components/ui/Skeleton';
import ShowcasePanel from '@/components/ui/ShowcasePanel';
import { loadOwnerBaseData, loadPetHealthBundle } from '@/lib/owner-data';
import { buildVetExportPack } from '@/lib/owner-workspace';
import { resolvePetPhoto } from '@/lib/pets';

export default function OwnerExportPackPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pets, setPets] = useState([]);
  const [selectedPetId, setSelectedPetId] = useState('');
  const [visits, setVisits] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [vaccines, setVaccines] = useState([]);
  const [prescriptions, setPrescriptions] = useState([]);

  const selectedPet = useMemo(() => pets.find((item) => item.id === selectedPetId) || null, [pets, selectedPetId]);
  const exportPack = useMemo(() => buildVetExportPack({ pet: selectedPet, visits, documents, prescriptions, vaccines }), [documents, prescriptions, selectedPet, vaccines, visits]);

  const loadPage = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const base = await loadOwnerBaseData();
      const petId = base.pets[0]?.id || '';
      setPets(base.pets);
      setSelectedPetId(petId);
      if (petId) {
        const bundle = await loadPetHealthBundle(petId);
        setVisits(bundle.visits);
        setDocuments(bundle.documents);
        setVaccines(bundle.vaccines);
        setPrescriptions(bundle.prescriptions);
      }
    } catch (requestError) {
      setError(requestError.message || 'Не удалось загрузить краткую сводку для врача');
      setPets([]);
      setVisits([]);
      setDocuments([]);
      setVaccines([]);
      setPrescriptions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPage();
  }, [loadPage]);

  useEffect(() => {
    if (!selectedPetId || loading) return;
    let active = true;
    async function loadPet() {
      try {
        const bundle = await loadPetHealthBundle(selectedPetId);
        if (!active) return;
        setVisits(bundle.visits);
        setDocuments(bundle.documents);
        setVaccines(bundle.vaccines);
        setPrescriptions(bundle.prescriptions);
      } catch {}
    }
    loadPet();
    return () => {
      active = false;
    };
  }, [loading, selectedPetId]);

  return (
    <div className="space-y-7">
      <header className="page-header">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-lapka-500">Сводка</p>
          <h1 className="page-title">Краткая медицинская сводка для врача</h1>
          <p className="page-subtitle">Один аккуратный пакет перед визитом: профиль питомца, недавние визиты, документы, профилактика и текущие назначения без ручной сборки по разным разделам.</p>
        </div>
      </header>

      {error ? <ErrorBanner message={error} onRetry={loadPage} /> : null}

      {loading ? (
        <section className="space-y-4">
          <Skeleton className="h-[340px] w-full" />
          <Skeleton className="h-[420px] w-full" />
        </section>
      ) : !selectedPet ? (
        <EmptyState title="Нет активного питомца" text="Добавьте питомца, чтобы собрать краткую сводку." />
      ) : (
        <>
          <ShowcasePanel
            eyebrow="Сводка"
            title={`${selectedPet.name}: краткая сводка перед визитом`}
            description="Краткая сводка собирает базовый профиль, документы, недавние визиты и назначения в один понятный контур подготовки к врачу."
            imageSrc={resolvePetPhoto(selectedPet)}
            imageAlt={selectedPet.name}
            badges={['PDF-сводка', 'Безопасная ссылка', 'Короткий бриф']}
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

          <section className="grid gap-5 xl:grid-cols-[1fr_1fr]">
            <Card title="Что войдёт в пакет" subtitle="Короткая безопасная сводка перед следующим визитом">
              <div className="space-y-3">
                {exportPack.summary.map((item) => (
                  <div key={item} className="rounded-[24px] border border-lapka-200 bg-white px-4 py-4 text-base leading-relaxed text-lapka-700">{item}</div>
                ))}
              </div>
            </Card>
            <Card title="Форматы" subtitle="Каким способом можно собрать краткую историю">
              <div className="grid gap-3">
                {exportPack.exportFormats.map((item) => (
                  <div key={item.id} className="rounded-[24px] border border-lapka-200 bg-white px-4 py-4">
                    <p className="text-lg font-bold text-lapka-900">{item.title}</p>
                    <p className="mt-1 text-sm text-lapka-600">{item.description}</p>
                  </div>
                ))}
              </div>
            </Card>
          </section>

          <section className="grid gap-5 2xl:grid-cols-[1.03fr_0.97fr]">
            <Card title="Последние визиты и документы" subtitle="То, что врач скорее всего спросит в первую очередь">
              <div className="grid gap-3 lg:grid-cols-2">
                {exportPack.recentVisits.map((item) => (
                  <Link key={item.id} href={`/owner/pet/${selectedPet.id}/records`} className="rounded-[24px] border border-lapka-200 bg-white px-4 py-4 transition hover:-translate-y-0.5 hover:shadow-soft">
                    <p className="text-lg font-bold text-lapka-900">{item.chief_complaint || 'Визит'}</p>
                    <p className="mt-1 text-sm text-lapka-600">Открыть медкарту и историю визитов.</p>
                  </Link>
                ))}
                {exportPack.documents.map((item) => (
                  <Link key={item.id} href={`/owner/pet/${selectedPet.id}/documents`} className="rounded-[24px] border border-lapka-200 bg-white px-4 py-4 transition hover:-translate-y-0.5 hover:shadow-soft">
                    <p className="text-lg font-bold text-lapka-900">{item.title || item.doc_type || 'Документ'}</p>
                    <p className="mt-1 text-sm text-lapka-600">Открыть архив документов питомца.</p>
                  </Link>
                ))}
              </div>
            </Card>
            <Card title="Следующие шаги" subtitle="Куда идти после сборки export pack">
              <div className="grid gap-3">
                <Link href="/owner/visits" className="action-grid-link">
                  <div>
                    <p className="text-lg font-bold text-lapka-900">Центр визитов</p>
                    <p className="mt-1 text-sm text-lapka-600">Подготовить список вопросов и открыть запись.</p>
                  </div>
                  <span className="pill !px-3 !py-1.5">Визиты</span>
                </Link>
                <Link href="/owner/documents" className="action-grid-link">
                  <div>
                    <p className="text-lg font-bold text-lapka-900">Архив документов</p>
                    <p className="mt-1 text-sm text-lapka-600">Проверить, что все исследования под рукой.</p>
                  </div>
                  <span className="pill !px-3 !py-1.5">Архив</span>
                </Link>
                <Link href="/owner/passport-center" className="action-grid-link">
                  <div>
                    <p className="text-lg font-bold text-lapka-900">Паспорт и чип</p>
                    <p className="mt-1 text-sm text-lapka-600">Сверить важные данные перед визитом и поездкой.</p>
                  </div>
                  <span className="pill !px-3 !py-1.5">Паспорт</span>
                </Link>
              </div>
            </Card>
          </section>
        </>
      )}
    </div>
  );
}
