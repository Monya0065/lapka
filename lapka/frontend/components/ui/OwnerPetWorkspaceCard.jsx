'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Card from '@/components/ui/Card';
import Skeleton from '@/components/ui/Skeleton';
import EmptyState from '@/components/ui/EmptyState';
import AppImage from '@/components/ui/AppImage';
import { apiRequest } from '@/lib/api';
import { localizePetBreed, localizePetSpecies, resolvePetPhoto } from '@/lib/pets';

export default function OwnerPetWorkspaceCard() {
  const { t, i18n } = useTranslation();
  const [pets, setPets] = useState([]);
  const [activePetId, setActivePetId] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadPets() {
      try {
        const rows = await apiRequest('/api/v1/pets');
        if (cancelled) return;
        const nextPets = Array.isArray(rows) ? rows : [];
        setPets(nextPets);
        setActivePetId((current) => current || nextPets[0]?.id || '');
      } catch {
        if (!cancelled) {
          setPets([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadPets();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return <Skeleton className="h-44 w-full" />;
  }

  if (!pets.length || !activePetId) {
    return (
      <Card title={t('owner.petWorkspace.title')} subtitle={t('owner.petWorkspace.subtitle')}>
        <EmptyState
          title={t('owner.petWorkspace.emptyTitle')}
          text={t('owner.petWorkspace.emptyDesc')}
          action={
            <Link href="/owner/pets?add=1" className="btn-primary">
              + {t('nav.addPet')}
            </Link>
          }
        />
      </Card>
    );
  }

  const activePet = pets.find((pet) => pet.id === activePetId) || pets[0];
  const quickLinks = [
    { href: `/owner/pet/${activePet.id}`, label: t('owner.petWorkspace.profile') },
    { href: `/owner/pet/${activePet.id}/records`, label: t('owner.petWorkspace.records') },
    { href: `/owner/pet/${activePet.id}/documents`, label: t('owner.petWorkspace.documents') },
    { href: `/owner/pet/${activePet.id}/calendar`, label: t('owner.petWorkspace.calendar') },
  ];

  return (
    <Card title={t('owner.petWorkspace.title')} subtitle={t('owner.petWorkspace.subtitle')}>
      <div className="space-y-3">
        <label className="block">
          <span className="label">{t('owner.petWorkspace.selectLabel')}</span>
          <select
            className="input"
            value={activePet.id}
            onChange={(event) => setActivePetId(event.target.value)}
          >
            {pets.map((pet) => (
              <option key={pet.id} value={pet.id}>
                {pet.name || t('common.noName')}
              </option>
            ))}
          </select>
        </label>

        <div className="grid gap-3 rounded-2xl border border-lapka-200 bg-white px-3 py-3 sm:grid-cols-[72px_1fr] sm:items-center">
          <AppImage
            src={resolvePetPhoto(activePet)}
            alt={activePet.name || t('common.noName')}
            width={320}
            height={320}
            sizes="80px"
            className="h-16 w-16 rounded-2xl border border-lapka-200 bg-[radial-gradient(circle_at_50%_35%,rgba(255,255,255,0.92),rgba(233,244,255,0.96)_70%)] object-cover"
          />
          <div>
            <p className="text-lg font-extrabold text-lapka-900">{activePet.name || t('common.noName')}</p>
            <p className="mt-1 text-sm text-lapka-600">
              {localizePetSpecies(activePet.species, i18n.language)}
              {' · '}
              {localizePetBreed(activePet.breed, i18n.language)}
            </p>
          </div>
        </div>

        <div className="grid gap-2">
          {quickLinks.map((item) => (
            <Link key={item.href} href={item.href} className="action-grid-link">
              <span>{item.label}</span>
              <span className="h-2 w-2 rounded-full bg-lapka-300" />
            </Link>
          ))}
        </div>
      </div>
    </Card>
  );
}
