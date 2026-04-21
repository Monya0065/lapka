'use client';

import { useCallback, useRef, useState } from 'react';

const DICOM_VIEWER_MODES = {
  WINDOW_LEVEL: 'window_level',
  PAN: 'pan',
  ZOOM: 'zoom',
  MEASURE: 'measure',
  RESET: 'reset',
};

export default function DicomViewer({
  imageUrl,
  title = 'Medical Viewer',
  onMeasure,
}) {
  const canvasRef = useRef(null);
  const [mode, setMode] = useState(DICOM_VIEWER_MODES.WINDOW_LEVEL);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadImage = useCallback(async () => {
    if (!imageUrl) return;
    setLoading(true);
    setError('');
    try {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        canvas.width = img.width || 512;
        canvas.height = img.height || 512;
        ctx.drawImage(img, 0, 0);
        setLoading(false);
      };
      img.onerror = () => {
        setError('Failed to load image');
        setLoading(false);
      };
      img.src = imageUrl;
    } catch (e) {
      setError(e.message || 'Load failed');
      setLoading(false);
    }
  }, [imageUrl]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setMode(DICOM_VIEWER_MODES.WINDOW_LEVEL)}
          className={`px-3 py-1.5 text-sm rounded-lg ${
            mode === DICOM_VIEWER_MODES.WINDOW_LEVEL
              ? 'bg-slate-900 text-white'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          Window/Level
        </button>
        <button
          type="button"
          onClick={() => setMode(DICOM_VIEWER_MODES.PAN)}
          className={`px-3 py-1.5 text-sm rounded-lg ${
            mode === DICOM_VIEWER_MODES.PAN
              ? 'bg-slate-900 text-white'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          Pan
        </button>
        <button
          type="button"
          onClick={() => setMode(DICOM_VIEWER_MODES.ZOOM)}
          className={`px-3 py-1.5 text-sm rounded-lg ${
            mode === DICOM_VIEWER_MODES.ZOOM
              ? 'bg-slate-900 text-white'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          Zoom
        </button>
        <button
          type="button"
          onClick={loadImage}
          className="px-3 py-1.5 text-sm rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
        >
          Reload
        </button>
      </div>

      <div className="relative rounded-xl border border-slate-200 bg-slate-900 overflow-hidden">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80 z-10">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-white border-t-transparent" />
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center text-red-400">
            {error}
          </div>
        )}
        <canvas
          ref={canvasRef}
          className="w-full max-h-[500px] object-contain"
          style={{ background: '#0f172a' }}
        />
      </div>

      <div className="flex gap-4 text-xs text-slate-500">
        <span>Mouse: drag to {mode}</span>
        <span>Scroll: zoom</span>
        <span>Double-click: reset</span>
      </div>
    </div>
  );
}