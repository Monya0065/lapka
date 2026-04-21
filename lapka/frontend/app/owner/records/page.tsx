'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import AppImage from '@/components/ui/AppImage';
import Card from '@/components/ui/Card';
import EmptyState from '@/components/ui/EmptyState';
import ErrorBanner from '@/components/ui/ErrorBanner';
import ShowcasePanel from '@/components/ui/ShowcasePanel';
import Skeleton from '@/components/ui/Skeleton';
import StatsCard from '@/components/ui/StatsCard';
import PetVisualGallery from '@/components/ui/PetVisualGallery';
import { apiRequest } from '@/lib/api';
import { localizePetBreed, localizePetSpecies, resolvePetPhoto } from '@/lib/pets';

export default function OwnerRecordsEntryPage() {
  const { i18n } = useTranslation();
  const langCode = i18n.resolvedLanguage || i18n.language || 'ru';
  const isEn = langCode.startsWith('en');
  const dateLocale = isEn ? 'en-US' : 'ru-RU';

  const [pets, setPets] = useState([]);
  const [visits, setVisits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadRecordsHub = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [petsPayload, visitsPayload] = await Promise.all([
        apiRequest('/api/v1/pets'),
        apiRequest('/api/v1/visits?limit=200'),
      ]);
      setPets(Array.isArray(petsPayload) ? petsPayload : []);
      setVisits(Array.isArray(visitsPayload) ? visitsPayload : []);
    } catch (requestError) {
      setError(requestError.message || (isEn ? 'Failed to load medical records' : 'Не удалось загрузить медкарту'));
      setPets([]);
      setVisits([]);
    } finally {
      setLoading(false);
    }
  }, [isEn]);

  useEffect(() => {
    loadRecordsHub();
  }, [loadRecordsHub]);

  const visitCountByPet = useMemo(() => {
    const map = new Map();
    visits.forEach((row) => {
      map.set(row.pet_id, (map.get(row.pet_id) || 0) + 1);
    });
    return map;
  }, [visits]);

  return (
    <>
      <header className="page-header">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-lapka-500">{isEn ? 'Medical record' : 'Медкарта'}</p>
          <h1 className="page-title">{isEn ? 'Health history for all pets' : 'История здоровья по всем питомцам'}</h1>
          <p className="page-subtitle">{isEn ? 'Pick a pet and open their card: visits, discharge notes, labs and a clear owner-facing history.' : 'Выберите питомца и откройте его карточку: визиты, выписки, анализы и понятную историю лечения для владельца.'}</p>
        </div>
      </header>

      {error ? <ErrorBanner message={error} onRetry={loadRecordsHub} /> : null}

      {loading ? (
        <section className="space-y-4">
          <Skeleton className="h-56 w-full" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
        </section>
      ) : pets.length === 0 ? (
        <EmptyState title={isEn ? 'No pets yet' : 'Питомцев пока нет'} text={isEn ? 'Add a pet to open medical records and visit history.' : 'Добавьте питомца, чтобы открыть медкарту и историю визитов.'} />
      ) : (
        <>
          <ShowcasePanel
            eyebrow={isEn ? 'Unified map' : 'Единая карта'}
            title={isEn ? 'All pet history in one place' : 'Вся история по питомцам собрана в одном месте'}
            description={isEn ? 'Owners see visits, studies and safe discharge notes without internal vet notes or treatment protocols.' : 'Владелец видит визиты, исследования и безопасные выписки без служебных врачебных заметок и без лечебных схем.'}
            imageSrc={resolvePetPhoto(pets[0])}
            imageAlt={pets[0]?.name || (isEn ? 'Pet' : 'Питомец')}
            badges={[
              isEn ? `${pets.length} pets` : `${pets.length} питомца`,
              isEn ? `${visits.length} visits` : `${visits.length} визитов`,
              isEn ? 'Safe summary' : 'Безопасная сводка',
            ]}
            compact
          />

          <section className="kpi-grid">
            <StatsCard label={isEn ? 'Pets' : 'Питомцы'} value={String(pets.length)} />
            <StatsCard label={isEn ? 'Visits' : 'Визиты'} value={String(visits.length)} />
            <StatsCard label={isEn ? 'Active cards' : 'Активные карты'} value={String(pets.length)} />
            <StatsCard label={isEn ? 'Last update' : 'Последнее обновление'} value={visits.length ? (isEn ? 'Yes' : 'Есть') : (isEn ? 'No' : 'Нет')} />
          </section>

          <section className="grid gap-4">
            {pets.map((pet) => (
              <Card key={pet.id} className="overflow-hidden p-0">
                <div className="grid gap-0 md:grid-cols-[220px_minmax(0,1fr)]">
                  <div className="border-b border-lapka-200 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.96),transparent_25%),linear-gradient(180deg,#f8fbff_0%,#edf7ff_100%)] p-4 md:border-b-0 md:border-r">
                    <PetVisualGallery
                      pet={pet}
                      language={isEn ? 'en' : 'ru'}
                      title={isEn ? 'Pet visual' : 'Визуал питомца'}
                      subtitle={isEn ? 'Photo from the card and extra viewing modes.' : 'Реальное фото из карты и дополнительные режимы просмотра.'}
                      compact
                      imageClassName="object-cover"
                    />
                  </div>
                  <div className="space-y-4 p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h2 className="text-[1.9rem] font-black tracking-tight text-lapka-900">{pet.name || (isEn ? 'Unnamed' : 'Без имени')}</h2>
                        <p className="mt-1 text-base text-lapka-600">
                          {localizePetSpecies(pet.species, isEn ? 'en' : 'ru')} · {localizePetBreed(pet.breed, isEn ? 'en' : 'ru')}
                        </p>
                      </div>
                      <span className="pill">{visitCountByPet.get(pet.id) || 0} {isEn ? 'visits' : 'визитов'}</span>
                    </div>

                    <div className="grid gap-2 text-sm text-lapka-700 md:grid-cols-3">
                      <div className="rounded-2xl border border-lapka-200 bg-lapka-50 px-4 py-3">
                        <span className="font-semibold text-lapka-900">{isEn ? 'Chip:' : 'Чип:'}</span> {pet.chip_id || (isEn ? 'not set' : 'не указан')}
                      </div>
                      <div className="rounded-2xl border border-lapka-200 bg-white px-4 py-3">
                        <span className="font-semibold text-lapka-900">Lapka ID:</span> {pet.lapka_id || '—'}
                      </div>
                      <div className="rounded-2xl border border-lapka-200 bg-white px-4 py-3">
                        <span className="font-semibold text-lapka-900">{isEn ? 'Last visit:' : 'Последний визит:'}</span> {pet.last_visit_at ? new Date(pet.last_visit_at).toLocaleDateString(dateLocale) : (isEn ? 'none yet' : 'ещё не было')}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Link href={`/owner/pet/${pet.id}/records`} className="btn-primary">{isEn ? 'Open medical record' : 'Открыть медкарту'}</Link>
                      <Link href={`/owner/pet/${pet.id}`} className="btn-secondary">{isEn ? 'Pet profile' : 'Карточка питомца'}</Link>
                      <Link href={`/owner/pet/${pet.id}/documents`} className="btn-secondary">{isEn ? 'Documents' : 'Документы'}</Link>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </section>
        </>
      )}
    </>
  );
}
