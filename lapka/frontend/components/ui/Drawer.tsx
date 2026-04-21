'use client';

import { useEffect } from 'react';

function sideClass(side) {
  if (side === 'left') return 'left-0 border-r';
  return 'right-0 border-l';
}

export default function Drawer({
  open = false,
  onClose,
  title = '',
  side = 'right',
  width = 'max-w-[520px]',
  children,
  footer = null,
}) {
  useEffect(() => {
    if (!open) return undefined;
    function onKeyDown(event) {
      if (event.key === 'Escape') onClose?.();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90]">
      <button
        type="button"
        className="absolute inset-0 bg-lapka-900/40 backdrop-blur-[2px]"
        aria-label="Закрыть панель"
        onClick={onClose}
      />
      <aside
        className={`absolute bottom-0 top-0 ${sideClass(side)} ${width} w-full border-lapka-200 bg-white/98 shadow-float animate-fade-in-up`}
      >
        <div className="flex h-full flex-col">
          <header className="flex items-center justify-between border-b border-lapka-200 px-5 py-4">
            <h3 className="text-xl font-extrabold tracking-tight text-lapka-900">{title}</h3>
            <button type="button" className="btn-secondary !px-3 !py-1.5 text-xs" onClick={onClose}>
              Закрыть
            </button>
          </header>
          <div className="flex-1 overflow-y-auto p-5">{children}</div>
          {footer ? <footer className="border-t border-lapka-200 p-4">{footer}</footer> : null}
        </div>
      </aside>
    </div>
  );
}
