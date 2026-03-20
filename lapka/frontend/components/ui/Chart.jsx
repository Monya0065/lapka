'use client';

import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

export default function Chart({ points = [24, 36, 42, 33, 51, 44, 48], labels }) {
  const { i18n } = useTranslation();
  const lang = i18n.resolvedLanguage === 'en' ? 'en' : 'ru';
  const resolvedLabels = useMemo(() => {
    if (labels?.length) return labels;
    return lang === 'en' ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] : ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
  }, [labels, lang]);
  const max = Math.max(...points, 1);

  return (
    <div className="grid grid-cols-7 gap-2">
      {points.map((point, index) => (
        <div key={`${resolvedLabels[index]}-${point}`} className="rounded-xl border border-lapka-200 bg-white p-2">
          <div className="h-24 rounded-lg bg-lapka-100 p-1">
            <div className="flex h-full items-end">
              <div
                className="w-full rounded-md bg-lapka-gradient transition-all duration-300"
                style={{ height: `${Math.round((point / max) * 100)}%` }}
              />
            </div>
          </div>
          <p className="mt-2 text-center text-[11px] font-semibold text-lapka-700">{resolvedLabels[index]}</p>
        </div>
      ))}
    </div>
  );
}
