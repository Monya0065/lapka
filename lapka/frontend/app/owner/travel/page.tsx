'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Card from '@/components/ui/Card';
import EmptyState from '@/components/ui/EmptyState';
import ErrorBanner from '@/components/ui/ErrorBanner';
import Skeleton from '@/components/ui/Skeleton';
import ShowcasePanel from '@/components/ui/ShowcasePanel';
import { loadOwnerBaseData, loadPetHealthBundle } from '@/lib/owner-data';
import { buildMedicationCenter, buildTravelMode } from '@/lib/owner-workspace';
import { resolvePetPhoto } from '@/lib/pets';

export default function OwnerTravelPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pets, setPets] = useState([]);
  const [selectedPetId, setSelectedPetId] = useState('');
  const [reminders, setReminders] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [visits, setVisits] = useState([]);
  const [prescriptions, setPrescriptions] = useState([]);

  const selectedPet = useMemo(() => pets.find((item) => item.id === selectedPetId) || null, [pets, selectedPetId]);
  const medications = useMemo(() => buildMedicationCenter({ pet: selectedPet, reminders: reminders.filter((row) => row.pet_id === selectedPetId), prescriptions, visits }), [prescriptions, reminders, selectedPet, selectedPetId, visits]);
  const travel = useMemo(() => buildTravelMode({ pet: selectedPet, reminders: reminders.filter((row) => row.pet_id === selectedPetId), documents, medications }), [documents, medications, reminders, selectedPet, selectedPetId]);

  const loadPage = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const base = await loadOwnerBaseData();
      const petId = base.pets[0]?.id || '';
      setPets(base.pets);
      setSelectedPetId(petId);
      setReminders(base.reminders);
      if (petId) {
        const bundle = await loadPetHealthBundle(petId);
        setDocuments(bundle.documents);
        setVisits(bundle.visits);
        setPrescriptions(bundle.prescriptions);
      }
    } catch (requestError) {
      setError(requestError.message || 'Не удалось загрузить режим поездки');
      setPets([]);
      setReminders([]);
      setDocuments([]);
      setVisits([]);
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
        setDocuments(bundle.documents);
        setVisits(bundle.visits);
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
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-lapka-500">Поездка</p>
          <h1 className="page-title">Поездка с питомцем</h1>
          <p className="page-subtitle">Режим поездки собирает документы, домашний комплект, текущие лекарства и клиники по пути в один спокойный сценарий подготовки.</p>
        </div>
      </header>

      {error ? <ErrorBanner message={error} onRetry={loadPage} /> : null}

      {loading ? (
        <section className="space-y-4">
          <Skeleton className="h-[340px] w-full" />
          <Skeleton className="h-[380px] w-full" />
        </section>
      ) : !selectedPet ? (
        <EmptyState title="Нет активного питомца" text="Добавьте питомца, чтобы подготовить поездку." />
      ) : (
        <>
          <ShowcasePanel
            eyebrow="Поездка"
            title={`${selectedPet.name}: дорожный комплект и подготовка к дороге`}
            description="Документы, переноска, привычный корм, вода, лекарства и план на случай emergency должны собираться в одном месте, а не в заметках по разным чатам."
            imageSrc={resolvePetPhoto(selectedPet)}
            imageAlt={selectedPet.name}
            badges={[travel.travelStatus, 'Документы', 'Дорожный комплект']}
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

          <section className="grid items-start gap-5 2xl:grid-cols-[1fr_1fr]">
            <Card title="Чек-лист поездки" subtitle="То, что стоит проверить заранее">
              <div className="space-y-3">
                {travel.checklist.map((item) => (
                  <div key={item} className="rounded-[24px] border border-lapka-200 bg-white px-4 py-4 text-base leading-relaxed text-lapka-700">{item}</div>
                ))}
              </div>
            </Card>
            <Card title="Дорожный комплект" subtitle="Что должно быть под рукой">
              <div className="grid gap-3 sm:grid-cols-2">
                {travel.kit.map((item) => (
                  <div key={item} className="rounded-[24px] border border-lapka-200 bg-white px-4 py-4 text-sm font-semibold text-lapka-700">{item}</div>
                ))}
              </div>
            </Card>
          </section>

          <section className="grid items-start gap-5 2xl:grid-cols-[1.04fr_0.96fr]">
            <Card title="Документы в дорогу" subtitle="То, что может понадобиться на новом месте или в другой клинике">
              {travel.documents.length ? (
                <div className="space-y-3">
                  {travel.documents.map((item) => (
                    <Link key={item.id} href={`/owner/pet/${selectedPet.id}/documents`} className="block rounded-[24px] border border-lapka-200 bg-white px-4 py-4 transition hover:-translate-y-0.5 hover:shadow-soft">
                      <p className="text-lg font-bold text-lapka-900">{item.title || item.doc_type || 'Документ'}</p>
                      <p className="mt-1 text-sm text-lapka-600">Архив питомца и документы для поездки.</p>
                    </Link>
                  ))}
                </div>
              ) : (
                <EmptyState title="Документы пока не загружены" text="Добавьте важные выписки и анализы до поездки." />
              )}
            </Card>
            <Card title="Быстрые действия" subtitle="Сервисный контур вокруг поездки">
              <div className="grid gap-3">
                <Link href={`/owner/pet/${selectedPet.id}/passport`} className="action-grid-link">
                  <div>
                    <p className="text-lg font-bold text-lapka-900">QR-паспорт</p>
                    <p className="mt-1 text-sm text-lapka-600">Открыть публичный паспорт и проверить контакты.</p>
                  </div>
                  <span className="pill !px-3 !py-1.5">Паспорт</span>
                </Link>
                <Link href="/owner/map" className="action-grid-link">
                  <div>
                    <p className="text-lg font-bold text-lapka-900">Карта клиник и аптек</p>
                    <p className="mt-1 text-sm text-lapka-600">Сохранить ближайшую клинику по маршруту.</p>
                  </div>
                  <span className="pill !px-3 !py-1.5">Карта</span>
                </Link>
                <Link href="/owner/export-pack" className="action-grid-link">
                  <div>
                    <p className="text-lg font-bold text-lapka-900">Краткая сводка для врача</p>
                    <p className="mt-1 text-sm text-lapka-600">Собрать короткую медицинскую сводку перед дорогой.</p>
                  </div>
                  <span className="pill !px-3 !py-1.5">Экспорт</span>
                </Link>
              </div>
            </Card>
          </section>
        </>
      )}
    </div>
  );
}
