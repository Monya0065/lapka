'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

function resolveAlignClass(align) {
  if (align === 'left') return 'left-0';
  if (align === 'center') return 'left-1/2 -translate-x-1/2';
  return 'right-0';
}

export default function DropdownMenu({
  items = [],
  align = 'right',
  trigger = null,
  label = 'Открыть меню',
  className = '',
  menuClassName = '',
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    function handlePointerDown(event) {
      if (!rootRef.current?.contains(event.target)) {
        setOpen(false);
      }
    }
    function handleKeyDown(event) {
      if (event.key === 'Escape') setOpen(false);
    }
    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const alignClass = resolveAlignClass(align);
  const triggerNode = trigger || (
    <button
      type="button"
      className="btn-secondary !h-10 !w-10 !rounded-full !px-0 !py-0 text-lg"
      aria-label={label}
      title={label}
      onClick={() => setOpen((prev) => !prev)}
    >
      ⋯
    </button>
  );

  return (
    <div className={`relative ${className}`} ref={rootRef}>
      {trigger ? (
        <button
          type="button"
          className="rounded-xl transition focus:outline-none focus-visible:ring-2 focus-visible:ring-lapka-400"
          aria-label={label}
          title={label}
          onClick={() => setOpen((prev) => !prev)}
        >
          {triggerNode}
        </button>
      ) : (
        triggerNode
      )}

      {open ? (
        <div
          className={`absolute ${alignClass} top-[calc(100%+8px)] z-[60] min-w-[220px] rounded-2xl border border-lapka-200 bg-white/98 p-1.5 shadow-float backdrop-blur ${menuClassName}`}
        >
          {items.length ? (
            items.map((item) => {
              const key = `${item.label}-${item.href || 'action'}`;
              const baseClass = `flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm font-medium transition ${
                item.disabled
                  ? 'cursor-not-allowed text-lapka-400'
                  : item.danger
                    ? 'text-rose-700 hover:bg-rose-50'
                    : 'text-lapka-700 hover:bg-lapka-50'
              }`;

              if (item.href) {
                if (item.disabled) {
                  return (
                    <span key={key} className={baseClass} title={item.tooltip || ''}>
                      <span>{item.label}</span>
                      {item.meta ? <span className="text-xs text-lapka-500">{item.meta}</span> : null}
                    </span>
                  );
                }
                return (
                  <Link
                    key={key}
                    href={item.href}
                    className={baseClass}
                    title={item.tooltip || ''}
                    onClick={() => setOpen(false)}
                  >
                    <span>{item.label}</span>
                    {item.meta ? <span className="text-xs text-lapka-500">{item.meta}</span> : null}
                  </Link>
                );
              }

              return (
                <button
                  key={key}
                  type="button"
                  className={baseClass}
                  title={item.tooltip || ''}
                  disabled={item.disabled}
                  onClick={() => {
                    if (item.disabled) return;
                    item.onClick?.();
                    setOpen(false);
                  }}
                >
                  <span>{item.label}</span>
                  {item.meta ? <span className="text-xs text-lapka-500">{item.meta}</span> : null}
                </button>
              );
            })
          ) : (
            <div className="rounded-xl px-3 py-2 text-sm text-lapka-500">Нет действий</div>
          )}
        </div>
      ) : null}
    </div>
  );
}
