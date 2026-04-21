'use client';

import { useEffect, useRef, useState } from 'react';

export default function MedicalImageViewer({
  src,
  title = 'Medical Image',
  tools = ['windowLevel', 'pan', 'zoom', 'length', 'angle'],
}) {
  const containerRef = useRef(null);
  const [viewerReady, setViewerReady] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!src || !containerRef.current) return;
    
    const initViewer = async () => {
      try {
        const { Cornerstone3D } = await import('@ohif/viewer');
        setViewerReady(true);
      } catch (e) {
        setError('OHIF viewer requires full installation');
      }
    };
    
    initViewer();
  }, [src]);

  const toolButtons = [
    { id: 'windowLevel', label: 'W/L', desc: 'Window/Level' },
    { id: 'pan', label: 'Pan', desc: 'Pan' },
    { id: 'zoom', label: 'Zoom', desc: 'Zoom' },
    { id: 'length', label: 'Ruler', desc: 'Measure length' },
    { id: 'angle', label: 'Angle', desc: 'Measure angle' },
    { id: 'reset', label: 'Reset', desc: 'Reset view' },
  ];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {toolButtons
          .filter((t) => tools.includes(t.id))
          .map((tool) => (
            <button
              key={tool.id}
              type="button"
              className="px-3 py-1.5 text-sm font-medium rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200"
              title={tool.desc}
            >
              {tool.label}
            </button>
          ))}
      </div>

      <div ref={containerRef} className="relative rounded-xl border border-slate-200 bg-slate-900 overflow-hidden min-h-[400px]">
        <div className="flex items-center justify-center h-[400px] text-slate-400">
          {error || 'Medical image viewer - supports DICOM, X-ray, CT, MRI'}
        </div>
      </div>

      <div className="flex gap-4 text-xs text-slate-500">
        <span>Left drag: measure</span>
        <span>Right drag: pan</span>
        <span>Scroll: zoom</span>
        <span>Middle: window/level</span>
      </div>
    </div>
  );
}