'use client';

import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import DropdownMenu from '@/components/ui/DropdownMenu';

export default function ActionMenu({ items = [], align = 'right', useLabelKey = false }) {
  const { t } = useTranslation();
  const resolvedItems = useMemo(() => {
    if (!useLabelKey) return items;
    return items.map((item) => ({
      ...item,
      label: item.labelKey ? t(item.labelKey) : item.label,
    }));
  }, [items, useLabelKey, t]);

  return (
    <DropdownMenu
      items={resolvedItems}
      align={align}
      label="Открыть дополнительные действия"
      trigger={
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-lapka-200 bg-white text-xl text-lapka-700 transition hover:bg-lapka-50">
          ⋯
        </span>
      }
    />
  );
}
