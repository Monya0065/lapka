'use client';

import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import Badge from '@/components/ui/Badge';
import ActionMenu from '@/components/ui/ActionMenu';
import AppImage from '@/components/ui/AppImage';
import { localizePetBreed, localizePetSpecies } from '@/lib/pets';

export default function PetCard({
  id = '',
  name = '',
  species = '',
  age = '—',
  breed = '',
  weight = '—',
  status = '',
  image = '/assets/photos/pets/cat-generic-photo.jpg',
  primaryHref,
  menuActions,
  hideActions = false,
}) {
  const { t, i18n } = useTranslation();
  const profileHref = primaryHref || `/owner/pet/${id}`;
  const actions =
    menuActions ||
    [
      { href: `/owner/pet/${id}/records`, labelKey: 'nav.medicalRecords' },
      { href: `/owner/pet/${id}/documents`, labelKey: 'nav.documents' },
      { href: `/owner/pet/${id}/calendar`, labelKey: 'pet.calendar' },
      { href: `/owner/pet/${id}/passport`, labelKey: 'pet.passport' },
      { href: `/owner/pet/${id}/inpatient`, labelKey: 'nav.inpatient' },
      { href: `/owner/pet/${id}/consents`, labelKey: 'pet.consents' },
    ];

  const localizedSpecies = localizePetSpecies(species, i18n.language);
  const localizedBreed = localizePetBreed(breed, i18n.language);
  const compactSpecies = String(localizedSpecies || '').replace(/^./, (char) => char.toUpperCase());
  const statusTone = status === t('status.inpatient') ? 'danger' : status === t('status.control') ? 'warning' : 'success';

  return (
    <article className="surface-card overflow-hidden p-0 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-float">
      <div className="grid min-w-0 gap-4 overflow-hidden p-4 lg:grid-cols-[136px_minmax(0,1fr)_auto] lg:items-center lg:gap-5 lg:p-5">
        <div className="relative shrink-0">
          <AppImage
            src={image}
            alt={name || t('common.noName')}
            width={640}
            height={640}
            sizes="160px"
            className="h-28 w-full rounded-2xl border border-lapka-200 object-cover lg:h-[124px]"
          />
          <div className="absolute bottom-2 left-2 rounded-full bg-white/90 px-2 py-0.5 text-[11px] font-semibold text-lapka-700 shadow-sm">
            {compactSpecies || t('common.notSpecified')}
          </div>
        </div>

        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="truncate text-2xl font-black tracking-tight text-lapka-900 lg:text-[1.75rem]">{name || t('common.noName')}</h3>
              <p className="mt-1 truncate text-xs font-medium text-lapka-500">{t('petCard.id')}: {id}</p>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <Badge tone={statusTone}>{status}</Badge>
              {species ? <Badge tone="info" compact>{compactSpecies}</Badge> : null}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 overflow-hidden text-sm text-lapka-700">
            <span className="shrink-0 rounded-full border border-lapka-200 bg-white px-3 py-1.5"><span className="font-semibold text-lapka-800">{t('petCard.status')}:</span> {status || '—'}</span>
            <span className="shrink-0 rounded-full border border-lapka-200 bg-white px-3 py-1.5"><span className="font-semibold text-lapka-800">{t('petCard.breed')}:</span> {localizedBreed || '—'}</span>
            <span className="shrink-0 rounded-full border border-lapka-200 bg-white px-3 py-1.5"><span className="font-semibold text-lapka-800">{t('petCard.age')}:</span> {age}</span>
            <span className="shrink-0 rounded-full border border-lapka-200 bg-white px-3 py-1.5"><span className="font-semibold text-lapka-800">{t('petCard.weight')}:</span> {weight}</span>
          </div>
        </div>

        {!hideActions ? (
          <div className="flex shrink-0 flex-col items-stretch gap-2 sm:flex-row sm:items-center lg:self-center">
            <Link href={profileHref} className="btn-primary min-w-[140px]">
              {t('petCard.openProfile')}
            </Link>
            <ActionMenu items={actions} useLabelKey />
          </div>
        ) : null}
      </div>
    </article>
  );
}
