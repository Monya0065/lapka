'use client';

import { useState } from 'react';

export default function Tabs({ items = [], value, onChange, compact = false }) {
  const [internalActive, setInternalActive] = useState(items[0]?.id);
  const active = value ?? internalActive;
  const current = items.find((item) => item.id === active) || items[0];

  function switchTab(nextId) {
    if (!nextId) return;
    if (onChange) onChange(nextId);
    if (value === undefined) setInternalActive(nextId);
  }

  return (
    <div className={`space-y-3 ${compact ? '' : 'md:space-y-4'}`}>
      <div className="scrollbar-none flex gap-1.5 overflow-x-auto rounded-2xl border border-lapka-200 bg-white/90 p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`whitespace-nowrap rounded-xl px-3 py-2 text-sm font-semibold transition-all duration-200 ${
              active === item.id
                ? 'bg-lapka-gradient text-white shadow-soft'
                : 'text-lapka-700 hover:bg-lapka-100 hover:text-lapka-900'
            }`}
            onClick={() => switchTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="surface-card p-4 md:p-5 animate-fade-in-up">{current?.content}</div>
    </div>
  );
}
