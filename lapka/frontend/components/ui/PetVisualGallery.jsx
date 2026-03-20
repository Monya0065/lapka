'use client';

import { useEffect, useMemo, useState } from 'react';
import AppImage from '@/components/ui/AppImage';
import { buildPetVisualGallery, resolvePetPhoto } from '@/lib/pets';

const DESCRIPTIONS = {
  ru: {
    photo: 'Основное фото питомца из карты. После загрузки здесь появляется ваше изображение.',
    'breed-photo': 'Породный референс помогает сверить визуальный тип питомца, если своего фото пока нет.',
    illustration: '3D-визуал остаётся декоративным ориентиром и не заменяет реальное фото.',
  },
  en: {
    photo: 'Primary pet photo from the profile. Uploaded photo appears here first.',
    'breed-photo': 'Breed reference helps compare visual type when no own photo is available yet.',
    illustration: '3D preview is decorative and does not replace the real pet photo.',
  },
};

export default function PetVisualGallery({
  pet,
  language = 'ru',
  title,
  subtitle,
  className = '',
  imageClassName = '',
  compact = false,
}) {
  const lang = String(language || 'ru').startsWith('ru') ? 'ru' : 'en';
  const gallery = useMemo(() => buildPetVisualGallery(pet, lang), [pet, lang]);
  const [selectedId, setSelectedId] = useState(gallery[0]?.id || 'photo');

  useEffect(() => {
    if (!gallery.length) {
      setSelectedId('photo');
      return;
    }
    if (!gallery.some((item) => item.id === selectedId)) {
      setSelectedId(gallery[0].id);
    }
  }, [gallery, selectedId]);

  const selectedItem = gallery.find((item) => item.id === selectedId) || gallery[0] || {
    id: 'photo',
    label: lang === 'ru' ? 'Фото питомца' : 'Pet photo',
    src: resolvePetPhoto(pet),
    type: 'photo',
  };

  const description = DESCRIPTIONS[lang][selectedItem.id] || '';

  return (
    <div className={`rounded-[30px] border border-lapka-200 bg-[radial-gradient(circle_at_18%_18%,rgba(96,170,255,0.16),transparent_36%),linear-gradient(180deg,#f8fbff_0%,#edf7ff_100%)] p-4 shadow-soft ${className}`}>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          {title ? <p className="text-xs font-semibold uppercase tracking-[0.18em] text-lapka-500">{title}</p> : null}
          {subtitle ? <p className="mt-1 text-sm leading-relaxed text-lapka-600">{subtitle}</p> : null}
        </div>
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        {gallery.map((item) => (
          <button
            key={item.id}
            type="button"
            className={selectedId === item.id
              ? 'rounded-full bg-lapka-950 px-3 py-1.5 text-sm font-semibold text-white'
              : 'rounded-full border border-lapka-200 bg-white px-3 py-1.5 text-sm font-semibold text-lapka-600'}
            onClick={() => setSelectedId(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <AppImage
        src={selectedItem.src}
        alt={pet?.name || title || 'Pet'}
        width={960}
        height={960}
        sizes={compact ? '280px' : '420px'}
        className={`w-full rounded-[24px] border border-white/80 object-cover shadow-[0_24px_52px_rgba(18,63,111,0.16)] ${compact ? 'h-[220px]' : 'h-[300px]'} ${imageClassName}`}
      />

      {gallery.length > 1 ? (
        <div className={`mt-3 grid gap-2 ${compact ? 'grid-cols-3' : 'grid-cols-3'}`}>
          {gallery.map((item) => (
            <button
              key={`${item.id}-thumb`}
              type="button"
              className={selectedId === item.id
                ? 'overflow-hidden rounded-[18px] border-2 border-lapka-600 bg-white shadow-soft'
                : 'overflow-hidden rounded-[18px] border border-lapka-200 bg-white'}
              onClick={() => setSelectedId(item.id)}
            >
              <AppImage
                src={item.src}
                alt={item.label}
                width={320}
                height={220}
                sizes="120px"
                className="h-20 w-full object-cover"
              />
              <span className="block px-2 py-2 text-center text-[11px] font-semibold text-lapka-700">{item.label}</span>
            </button>
          ))}
        </div>
      ) : null}

      {description ? (
        <div className="mt-3 rounded-[22px] border border-white/80 bg-white/88 px-4 py-3 backdrop-blur">
          <p className="text-sm leading-relaxed text-lapka-600">{description}</p>
        </div>
      ) : null}
    </div>
  );
}
