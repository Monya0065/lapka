'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Card from '@/components/ui/Card';
import StatsCard from '@/components/ui/StatsCard';
import SearchInput from '@/components/ui/SearchInput';
import EmptyState from '@/components/ui/EmptyState';
import Skeleton from '@/components/ui/Skeleton';
import ErrorBanner from '@/components/ui/ErrorBanner';
import PetVisualGallery from '@/components/ui/PetVisualGallery';
import ShowcasePanel from '@/components/ui/ShowcasePanel';
import { apiRequest } from '@/lib/api';
import { localizePetBreed, localizePetSpecies } from '@/lib/pets';

export default function OwnerPetsPage() {
  const { t } = useTranslation();
  const [pets, setPets] = useState([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [photoUploadingFor, setPhotoUploadingFor] = useState('');
  const [photoUploadError, setPhotoUploadError] = useState('');
  const [photoTargetPetId, setPhotoTargetPetId] = useState('');
  const fileInputRef = useRef(null);
  const [newPet, setNewPet] = useState({
    name: '',
    species: 'cat',
    breed: '',
    sex: 'male',
    chip_id: '',
    passport_id: '',
  });

  const loadPets = useCallback(async () => {
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const rows = await apiRequest('/api/v1/pets');
      setPets(Array.isArray(rows) ? rows : []);
    } catch (e) {
      setError(e.message || t('petsPage.errorLoad'));
      setPets([]);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadPets();
  }, [loadPets]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('add') === '1') {
      setShowModal(true);
    }
  }, []);

  async function createPet(event) {
    event.preventDefault();
    setError('');
    setSuccess('');
    if (!newPet.name.trim()) {
      setError(t('petsPage.nameLabel') + '.');
      return;
    }
    if (!newPet.species.trim()) {
      setError(t('petsPage.speciesLabel') + '.');
      return;
    }
    setSubmitting(true);
    try {
      await apiRequest('/api/v1/pets', {
        method: 'POST',
        body: {
          name: newPet.name.trim(),
          species: newPet.species.trim(),
          breed: newPet.breed.trim() || null,
          sex: newPet.sex.trim() || null,
          chip_id: newPet.chip_id.trim() || null,
          passport_id: newPet.passport_id.trim() || null,
        },
      });
      setSuccess(t('petsPage.successAdd'));
      setShowModal(false);
      setNewPet({ name: '', species: 'cat', breed: '', sex: 'male', chip_id: '', passport_id: '' });
      await loadPets();
    } catch (e) {
      setError(e.message || t('petsPage.errorAdd'));
    } finally {
      setSubmitting(false);
    }
  }

  const filteredPets = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return pets;
    return pets.filter((pet) =>
      [pet.name, pet.species, pet.breed, pet.chip_id, pet.passport_id]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q))
    );
  }, [pets, query]);

  const handlePhotoButtonClick = useCallback((petId) => {
    setPhotoUploadError('');
    setPhotoTargetPetId(petId);
    fileInputRef.current?.click();
  }, []);

  const handlePhotoSelected = useCallback(async (event) => {
    const file = event.target?.files?.[0];
    if (!file || !photoTargetPetId) return;

    setPhotoUploadingFor(photoTargetPetId);
    setPhotoUploadError('');

    try {
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('Не удалось прочитать файл'));
        reader.readAsDataURL(file);
      });

      const updatedPet = await apiRequest(`/api/v1/pets/${photoTargetPetId}`, {
        method: 'PATCH',
        body: { photo_url: dataUrl },
      });

      setPets((current) => current.map((pet) => (
        pet.id === photoTargetPetId
          ? { ...pet, ...(updatedPet || {}), photo_url: updatedPet?.photo_url || dataUrl }
          : pet
      )));
      setSuccess('Фото питомца обновлено.');
    } catch (requestError) {
      setPhotoUploadError(requestError.message || 'Не удалось сохранить фото');
    } finally {
      setPhotoUploadingFor('');
      setPhotoTargetPetId('');
      if (event.target) event.target.value = '';
    }
  }, [photoTargetPetId]);

  const catCount = pets.filter((p) => String(p.species || '').toLowerCase().includes('cat') || String(p.species || '').toLowerCase().includes('кот')).length;
  const dogCount = pets.filter((p) => String(p.species || '').toLowerCase().includes('dog') || String(p.species || '').toLowerCase().includes('собак')).length;

  function resolveStatus(pet) {
    if (pet?.inpatient_status === 'active' || pet?.active_inpatient) return t('status.inpatient');
    if (pet?.last_visit_at) return t('status.control');
    return t('status.stable');
  }

  return (
    <>
      <header className="page-header">
        <div>
          <h1 className="page-title">{t('petsPage.title')}</h1>
          <p className="page-subtitle">{t('petsPage.subtitle')}</p>
        </div>
      </header>

      {error ? <ErrorBanner message={error} onRetry={loadPets} /> : null}
      {success ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{success}</div>
      ) : null}

      <ShowcasePanel
        eyebrow={t('owner.petWorkspace.title')}
        title={t('petsPage.title')}
        description={t('petsPage.subtitle')}
        imageSrc="/assets/img/pet-cat.svg"
        imageAlt={t('petsPage.title')}
        badges={[
          `${pets.length} ${t('petsPage.total').toLowerCase()}`,
          `${catCount} ${t('petsPage.cats').toLowerCase()}`,
          `${dogCount} ${t('petsPage.dogs').toLowerCase()}`,
        ]}
      />

      <section className="grid gap-4 lg:grid-cols-2">
        <Card title="Вторичные инструменты профиля" subtitle="Breed ID больше не живёт как самостоятельный первый раздел. Это вторичный инструмент рядом с карточкой питомца.">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-lg font-bold text-lapka-900">Определить породу по фото</p>
              <p className="mt-1 text-sm text-lapka-600">Используйте как вспомогательный инструмент при добавлении питомца или уточнении профиля.</p>
            </div>
            <Link href="/owner/breed-id" className="btn-secondary">
              Открыть инструмент
            </Link>
          </div>
        </Card>
        <Card title="Где дальше искать нужное" subtitle="Профиль, медкарта, документы и уход теперь собраны в одном логичном контуре.">
          <div className="flex flex-wrap gap-2">
            <Link href="/owner/records" className="btn-secondary">Медкарта</Link>
            <Link href="/owner/documents" className="btn-secondary">Документы</Link>
            <Link href="/owner/care" className="btn-secondary">Уход и питание</Link>
            <Link href="/owner/timeline" className="btn-secondary">Лента здоровья</Link>
          </div>
        </Card>
      </section>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handlePhotoSelected}
      />

      <Card dense tone="tinted">
        <div className="grid gap-3 md:grid-cols-[1fr_auto_auto] md:items-end">
          <SearchInput
            label={t('petsPage.searchLabel')}
            placeholder={t('petsPage.searchPlaceholder')}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <button className="btn-secondary" type="button" onClick={() => setQuery('')}>
            {t('common.reset')}
          </button>
          <span className="pill self-center justify-self-start md:justify-self-end">
            {t('petsPage.found')}: {filteredPets.length}
          </span>
        </div>
      </Card>

      <section className="kpi-grid">
        <StatsCard label={t('petsPage.total')} value={String(pets.length)} />
        <StatsCard label={t('petsPage.cats')} value={String(catCount)} />
        <StatsCard label={t('petsPage.dogs')} value={String(dogCount)} />
        <StatsCard label={t('petsPage.found')} value={String(filteredPets.length)} />
      </section>

      {loading ? (
        <section className="grid gap-4">
          <Skeleton className="h-44 w-full" />
          <Skeleton className="h-44 w-full" />
          <Skeleton className="h-44 w-full" />
        </section>
      ) : filteredPets.length === 0 ? (
        <div className="space-y-3">
          <EmptyState title={t('petsPage.empty')} text={t('petsPage.emptyDesc')} />
          <div className="flex flex-wrap gap-2">
            <button className="btn-primary" type="button" onClick={() => setShowModal(true)}>
              {t('petsPage.add')}
            </button>
            <button className="btn-secondary" type="button" onClick={loadPets}>
              {t('petsPage.refresh')}
            </button>
          </div>
        </div>
      ) : (
        <section className="grid gap-4">
          {filteredPets.map((pet) => (
            <Card key={pet.id} className="overflow-hidden p-0">
              <div className="grid gap-0 md:grid-cols-[220px_minmax(0,1fr)]">
                <div className="relative overflow-hidden border-b border-lapka-200 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.96),transparent_25%),linear-gradient(180deg,#f8fbff_0%,#edf7ff_100%)] p-4 md:border-b-0 md:border-r">
                  <PetVisualGallery
                    pet={pet}
                    language="ru"
                    title="Визуальный профиль"
                    subtitle="Фото из карты, породный ориентир и 3D-визуал."
                    compact
                    imageClassName="object-cover"
                  />
                </div>
                <div className="space-y-4 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="text-[2rem] font-black tracking-tight text-lapka-900">{pet.name || t('common.noName')}</h2>
                      <p className="mt-1 text-base text-lapka-600">
                        {localizePetSpecies(pet.species, 'ru')} · {localizePetBreed(pet.breed, 'ru')}
                      </p>
                    </div>
                    <span
                      className={`inline-flex rounded-full border px-3 py-1.5 text-sm font-semibold ${
                        resolveStatus(pet) === t('status.inpatient')
                          ? 'border-rose-200 bg-rose-100 text-rose-700'
                          : resolveStatus(pet) === t('status.control')
                            ? 'border-amber-200 bg-amber-100 text-amber-700'
                            : 'border-emerald-200 bg-emerald-100 text-emerald-700'
                      }`}
                    >
                      {resolveStatus(pet)}
                    </span>
                  </div>

                  <div className="grid gap-2 text-sm text-lapka-700 lg:grid-cols-2">
                    <div className="rounded-2xl border border-lapka-200 bg-lapka-50 px-4 py-3">
                      <span className="font-semibold text-lapka-900">Чип:</span> {pet.chip_id || 'не указан'}
                    </div>
                    <div className="rounded-2xl border border-lapka-200 bg-white px-4 py-3">
                      <span className="font-semibold text-lapka-900">Паспорт:</span> {pet.passport_id || 'не указан'}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Link href={`/owner/pet/${pet.id}`} className="btn-primary">
                      Открыть профиль
                    </Link>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => handlePhotoButtonClick(pet.id)}
                      disabled={photoUploadingFor === pet.id}
                    >
                      {photoUploadingFor === pet.id ? 'Сохраняю фото…' : 'Загрузить фото'}
                    </button>
                    <Link href={`/owner/pet/${pet.id}/records`} className="btn-secondary">
                      Медкарта
                    </Link>
                    <Link href={`/owner/pet/${pet.id}/passport`} className="btn-secondary">
                      QR-паспорт
                    </Link>
                  </div>
                  {photoUploadError && photoTargetPetId === pet.id ? (
                    <p className="text-sm font-medium text-rose-600">{photoUploadError}</p>
                  ) : null}
                </div>
              </div>
            </Card>
          ))}
        </section>
      )}

      {showModal ? (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-lapka-900/45 p-4 backdrop-blur-sm">
          <div className="surface-card w-full max-w-2xl p-5">
            <div className="mb-4 flex items-center justify-between gap-2">
              <h2 className="text-2xl font-black tracking-tight text-lapka-900">{t('petsPage.addModalTitle')}</h2>
              <button className="btn-secondary" type="button" onClick={() => setShowModal(false)}>
                {t('common.close')}
              </button>
            </div>
            <form className="grid gap-3 sm:grid-cols-2" onSubmit={createPet}>
              <label className="block">
                <span className="label">{t('petsPage.nameLabel')} *</span>
                <input className="input" value={newPet.name} onChange={(event) => setNewPet((prev) => ({ ...prev, name: event.target.value }))} />
              </label>
              <label className="block">
                <span className="label">{t('petsPage.speciesLabel')} *</span>
                <select className="input" value={newPet.species} onChange={(event) => setNewPet((prev) => ({ ...prev, species: event.target.value }))}>
                  <option value="cat">{t('common.cat')}</option>
                  <option value="dog">{t('common.dog')}</option>
                  <option value="rabbit">{t('common.rabbit')}</option>
                </select>
              </label>
              <label className="block">
                <span className="label">{t('petsPage.breedLabel')}</span>
                <input className="input" value={newPet.breed} onChange={(event) => setNewPet((prev) => ({ ...prev, breed: event.target.value }))} />
              </label>
              <label className="block">
                <span className="label">{t('petsPage.sexLabel')}</span>
                <select className="input" value={newPet.sex} onChange={(event) => setNewPet((prev) => ({ ...prev, sex: event.target.value }))}>
                  <option value="male">{t('common.male')}</option>
                  <option value="female">{t('common.female')}</option>
                </select>
              </label>
              <label className="block">
                <span className="label">{t('petsPage.chipLabel')}</span>
                <input className="input" value={newPet.chip_id} onChange={(event) => setNewPet((prev) => ({ ...prev, chip_id: event.target.value }))} />
              </label>
              <label className="block">
                <span className="label">{t('petsPage.passportLabel')}</span>
                <input className="input" value={newPet.passport_id} onChange={(event) => setNewPet((prev) => ({ ...prev, passport_id: event.target.value }))} />
              </label>
              <div className="flex flex-wrap gap-2 sm:col-span-2">
                <button className="btn-primary" type="submit" disabled={submitting}>
                  {submitting ? t('common.saving') : t('common.save')}
                </button>
                <button className="btn-secondary" type="button" onClick={() => setShowModal(false)}>
                  {t('common.cancel')}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
