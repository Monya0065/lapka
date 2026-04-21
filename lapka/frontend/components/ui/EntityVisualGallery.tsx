'use client';

import { useEffect, useMemo, useState } from 'react';
import AppImage from '@/components/ui/AppImage';

export default function EntityVisualGallery({
  items = [],
  title,
  subtitle,
  className = '',
  imageClassName = '',
  compact = false,
}) {
  const normalizedItems = useMemo(
    () => items.filter((item) => item && item.src).map((item, index) => ({
      id: item.id || `item-${index}`,
      label: item.label || `Фото ${index + 1}`,
      src: item.src,
      description: item.description || '',
      alt: item.alt || item.label || `Фото ${index + 1}`,
    })),
    [items]
  );

  const [selectedId, setSelectedId] = useState(normalizedItems[0]?.id || 'item-0');

  useEffect(() => {
    if (!normalizedItems.length) {
      setSelectedId('item-0');
      return;
    }
    if (!normalizedItems.some((item) => item.id === selectedId)) {
      setSelectedId(normalizedItems[0].id);
    }
  }, [normalizedItems, selectedId]);

  if (!normalizedItems.length) return null;

  const selectedItem = normalizedItems.find((item) => item.id === selectedId) || normalizedItems[0];

  return (
    <div className={`rounded-[30px] border border-lapka-200 bg-[radial-gradient(circle_at_18%_18%,rgba(96,170,255,0.16),transparent_36%),linear-gradient(180deg,#f8fbff_0%,#edf7ff_100%)] p-4 shadow-soft ${className}`}>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          {title ? <p className="text-xs font-semibold uppercase tracking-[0.18em] text-lapka-500">{title}</p> : null}
          {subtitle ? <p className="mt-1 text-sm leading-relaxed text-lapka-600">{subtitle}</p> : null}
        </div>
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        {normalizedItems.map((item) => (
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
        alt={selectedItem.alt}
        width={960}
        height={960}
        sizes={compact ? '280px' : '420px'}
        className={`w-full rounded-[24px] border border-white/80 object-cover shadow-[0_24px_52px_rgba(18,63,111,0.16)] ${compact ? 'h-[220px]' : 'h-[300px]'} ${imageClassName}`}
      />

      {normalizedItems.length > 1 ? (
        <div className="mt-3 grid grid-cols-3 gap-2">
          {normalizedItems.map((item) => (
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
                alt={item.alt}
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

      {selectedItem.description ? (
        <div className="mt-3 rounded-[22px] border border-white/80 bg-white/88 px-4 py-3 backdrop-blur">
          <p className="text-sm leading-relaxed text-lapka-600">{selectedItem.description}</p>
        </div>
      ) : null}
    </div>
  );
}
