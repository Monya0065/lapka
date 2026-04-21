'use client';

import { useState } from 'react';
import Button from '@/components/ui/Button';

export default function Modal({
  buttonLabel = 'Открыть',
  title = 'Демо модалка',
  children,
  open: controlledOpen,
  onOpenChange,
  triggerClassName = '',
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;

  function setOpen(next) {
    if (onOpenChange) onOpenChange(next);
    if (controlledOpen === undefined) setInternalOpen(next);
  }

  return (
    <>
      <Button variant="secondary" className={triggerClassName} onClick={() => setOpen(true)}>{buttonLabel}</Button>
      {open ? (
        <div className="fixed inset-0 z-[90] grid place-items-center bg-lapka-900/45 p-4 backdrop-blur-sm">
          <button type="button" className="absolute inset-0" aria-label="Закрыть модалку" onClick={() => setOpen(false)} />
          <div className="relative w-full max-w-2xl rounded-3xl border border-lapka-200 bg-white p-5 shadow-float animate-fade-in-up md:p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h3 className="text-2xl font-bold tracking-tight text-lapka-900">{title}</h3>
              <Button variant="secondary" size="sm" onClick={() => setOpen(false)}>Закрыть</Button>
            </div>
            {children}
          </div>
        </div>
      ) : null}
    </>
  );
}
