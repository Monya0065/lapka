'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { apiRequest } from '@/lib/api';

export default function OwnerPetSwitcher({ currentPetId }) {
  const { t } = useTranslation();
  const router = useRouter();
  const pathname = usePathname();
  const [pets, setPets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const rows = await apiRequest('/api/v1/pets');
        if (!cancelled) setPets(Array.isArray(rows) ? rows : []);
      } catch {
        if (!cancelled) setPets([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  function handleChange(e) {
    const id = e.target.value;
    if (!id) return;
    const base = '/owner/pet';
    const suffix = pathname.replace(/^\/owner\/pet\/[^/]+/, '') || '';
    router.push(`${base}/${id}${suffix}`);
  }

  if (loading || pets.length <= 1) return null;

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="pet-switcher" className="text-xs font-semibold text-lapka-600">
        {t('pet.switchPet')}:
      </label>
      <select
        id="pet-switcher"
        value={currentPetId || ''}
        onChange={handleChange}
        className="input min-w-0 max-w-[180px] py-1.5 text-sm"
      >
        {pets.map((pet) => (
          <option key={pet.id} value={pet.id}>
            {pet.name || t('common.noName')}
          </option>
        ))}
      </select>
    </div>
  );
}
