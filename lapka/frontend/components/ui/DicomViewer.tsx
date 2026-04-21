'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

const WINDOW_PRESETS = [
  { id: 'brain', label: 'Головной мозг', wl: 40, ww: 80 },
  { id: 'lung', label: 'Лёгкие', wl: -600, ww: 1500 },
  { id: 'liver', label: 'Печень', wl: 60, ww: 150 },
  { id: 'bone', label: 'Кости', wl: 400, ww: 1500 },
  { id: 'abdomen', label: 'Брюшная полость', wl: 40, ww: 350 },
];

interface DicomViewerProps {
  imageUrl?: string;
  title?: string;
  onMeasure?: (measurement: { type: string; value: number }) => void;
}

export default function DicomViewer({ imageUrl, title = 'Медицинский просмотр', onMeasure }: DicomViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imageDataRef = useRef<ImageData | null>(null);
  const originalDataRef = useRef<Uint8ClampedArray | null>(null);

  const [mode, setMode] = useState<'window_level' | 'pan' | 'zoom' | 'measure'>('window_level');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [windowCenter, setWindowCenter] = useState(40);
  const [windowWidth, setWindowWidth] = useState(400);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [measureStart, setMeasureStart] = useState<{ x: number; y: number } | null>(null);
  const [measureEnd, setMeasureEnd] = useState<{ x: number; y: number } | null>(null);

  const applyWindowLevel = useCallback((ctx: CanvasRenderingContext2D, width: number, height: number) => {
    if (!originalDataRef.current || !imageDataRef.current) return;

    const imgData = imageDataRef.current;
    const original = originalDataRef.current;
    const minOut = 0;
    const maxOut = 255;
    const minIn = windowCenter - windowWidth / 2;
    const maxIn = windowCenter + windowWidth / 2;

    for (let i = 0; i < imgData.data.length; i += 4) {
      const pixel = original[i];
      let val: number;
      if (pixel <= minIn) val = minOut;
      else if (pixel >= maxIn) val = maxOut;
      else {
        val = minOut + ((pixel - minIn) / (maxIn - minIn)) * (maxOut - minOut);
      }
      imgData.data[i] = val;
      imgData.data[i + 1] = val;
      imgData.data[i + 2] = val;
      imgData.data[i + 3] = original[i + 3];
    }

    ctx.putImageData(imgData, 0, 0);
  }, [windowCenter, windowWidth]);

  const loadImage = useCallback(async () => {
    if (!imageUrl || !canvasRef.current) return;
    setLoading(true);
    setError('');
    try {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const img = new window.Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const w = img.width || 512;
        const h = img.height || 512;
        canvas.width = w;
        canvas.height = h;

        ctx.drawImage(img, 0, 0);
        const imgData = ctx.getImageData(0, 0, w, h);
        const original = new Uint8ClampedArray(imgData.data);
        imageDataRef.current = imgData;
        originalDataRef.current = original;

        applyWindowLevel(ctx, w, h);
        setLoading(false);
      };
      img.onerror = () => {
        setError('Не удалось загрузить изображение');
        setLoading(false);
      };
      img.src = imageUrl;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка загрузки');
      setLoading(false);
    }
  }, [imageUrl, applyWindowLevel]);

  useEffect(() => {
    if (originalDataRef.current && canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
        applyWindowLevel(ctx, canvasRef.current.width, canvasRef.current.height);
      }
    }
  }, [windowCenter, windowWidth, applyWindowLevel]);

  useEffect(() => {
    loadImage();
  }, [loadImage]);

  const handlePresetClick = useCallback((preset: (typeof WINDOW_PRESETS)[0]) => {
    setWindowCenter(preset.wl);
    setWindowWidth(preset.ww);
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
    if (mode === 'pan') {
      setPanStart({ x: pan.x, y: pan.y });
    } else if (mode === 'measure') {
      setMeasureStart({ x, y });
      setMeasureEnd(null);
    }
  }, [mode, pan]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (mode === 'pan') {
      const dx = e.clientX - dragStart.x;
      const dy = e.clientY - dragStart.y;
      setPan({ x: panStart.x + dx, y: panStart.y + dy });
    } else if (mode === 'window_level') {
      const dx = e.clientX - dragStart.x;
      const dy = e.clientY - dragStart.y;
      setWindowCenter((c) => Math.max(-1024, Math.min(3072, c + dy * 2)));
      setWindowWidth((w) => Math.max(1, Math.min(4096, w + dx * 4)));
    } else if (mode === 'measure') {
      setMeasureEnd({ x, y });
    }
  }, [isDragging, mode, dragStart, panStart]);

  const handleMouseUp = useCallback(() => {
    if (mode === 'measure' && measureStart && measureEnd && canvasRef.current) {
      const dx = measureEnd.x - measureStart.x;
      const dy = measureEnd.y - measureStart.y;
      const pixelLength = Math.sqrt(dx * dx + dy * dy) / zoom;
      const mmPerPixel = 0.5;
      const lengthMm = pixelLength * mmPerPixel;
      onMeasure?.({ type: 'length', value: Math.round(lengthMm * 10) / 10 });
    }
    setIsDragging(false);
    if (mode !== 'measure') {
      setMeasureStart(null);
      setMeasureEnd(null);
    }
  }, [mode, measureStart, measureEnd, zoom, onMeasure]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setZoom((z) => Math.min(Math.max(z + delta, 0.1), 10));
  }, []);

  const handleReset = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setWindowCenter(40);
    setWindowWidth(400);
  }, []);

  return (
    <div className="space-y-4" role="region" aria-label={title}>
      <div className="flex flex-wrap gap-2" role="toolbar" aria-label="Инструменты просмотра">
        {[
          { id: 'window_level', label: 'Яркость' },
          { id: 'pan', label: 'Перемещение' },
          { id: 'zoom', label: 'Масштаб' },
          { id: 'measure', label: 'Измерение' },
        ].map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setMode(m.id as typeof mode)}
            aria-pressed={mode === m.id}
            aria-label={`Режим: ${m.label}`}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
              mode === m.id
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            {m.label}
          </button>
        ))}
        <button
          type="button"
          onClick={handleReset}
          aria-label="Сброс настроек"
          className="px-3 py-1.5 text-sm rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
        >
          Сброс
        </button>
      </div>

      <div className="flex flex-wrap gap-1" role="group" aria-label="Пресеты яркости">
        {WINDOW_PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => handlePresetClick(p)}
            aria-label={`Пресет: ${p.label} (WL ${p.wl}, WW ${p.ww})`}
            className="px-2 py-1 text-xs rounded bg-lapka-100 text-lapka-700 hover:bg-lapka-200 transition-colors"
          >
            {p.label}
          </button>
        ))}
      </div>

      <div
        ref={containerRef}
        className="relative rounded-xl border-2 border-slate-200 bg-slate-900 overflow-hidden"
        style={{
          cursor: mode === 'window_level' ? 'crosshair' : mode === 'pan' ? 'grab' : mode === 'measure' ? 'crosshair' : 'zoom-in',
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        role="img"
        aria-label={title}
        tabIndex={0}
      >
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80 z-10" aria-live="polite" aria-label="Загрузка">
            <div className="animate-spin rounded-full h-10 w-10 border-3 border-white border-t-transparent" />
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center text-red-400 z-10" role="alert">
            {error}
          </div>
        )}
        <canvas
          ref={canvasRef}
          className="w-full block"
          style={{
            maxHeight: '600px',
            objectFit: 'contain',
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: 'center center',
          }}
        />
        {measureStart && measureEnd && (
          <svg
            className="absolute inset-0 w-full h-full pointer-events-none"
            style={{ zIndex: 5 }}
          >
            <line
              x1={measureStart.x}
              y1={measureStart.y}
              x2={measureEnd.x}
              y2={measureEnd.y}
              stroke="#06b6d4"
              strokeWidth={2}
              strokeDasharray="4,4"
            />
            <circle cx={measureStart.x} cy={measureStart.y} r={4} fill="#06b6d4" />
            <circle cx={measureEnd.x} cy={measureEnd.y} r={4} fill="#06b6d4" />
          </svg>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 text-xs text-slate-500">
        <span>Масштаб: {Math.round(zoom * 100)}%</span>
        <span>WL: {Math.round(windowCenter)}</span>
        <span>WW: {Math.round(windowWidth)}</span>
      </div>

      <div className="text-xs text-slate-400">
        <span>Колесо мыши — масштаб</span>
        <span className="mx-2">|</span>
        <span>Перетаскивание — {mode === 'window_level' ? 'яркость/контраст' : 'перемещение'}</span>
        {mode === 'measure' && (
          <>
            <span className="mx-2">|</span>
            <span>Клик-drag — измерение расстояния</span>
          </>
        )}
      </div>
    </div>
  );
}