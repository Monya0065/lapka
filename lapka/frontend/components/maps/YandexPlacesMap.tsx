'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DEFAULT_MAP_CENTER, getYandexMapsApiKey, loadYandexMaps } from '@/lib/yandexMaps';

/**
 * @param {Object} props
 * @param {Array<{ id: string, lat: number, lng: number, title: string, subtitle?: string, preset?: string, place: unknown }>} props.markers
 * @param {Array<{ id: string, lat: number, lng: number, radiusMeters?: number, fillColor?: string, strokeColor?: string, strokeWidth?: number }>} [props.heatCircles]
 * @param {(payload: { place: unknown }) => void} [props.onMarkerClick]
 * @param {number} [props.height]
 * @param {string} [props.className]
 * @param {boolean} [props.enableCluster]
 */
export default function YandexPlacesMap({
  markers = [],
  heatCircles = [],
  onMarkerClick,
  height = 440,
  className = '',
  enableCluster = false,
}) {
  const { i18n } = useTranslation();
  const isEn = i18n.resolvedLanguage === 'en';
  const containerRef = useRef(null);
  const clickRef = useRef(onMarkerClick);
  const [loadError, setLoadError] = useState('');
  clickRef.current = onMarkerClick;

  useEffect(() => {
    let cancelled = false;
    const container = containerRef.current;
    if (!container) return undefined;

    let mapInstance = null;

    (async () => {
      setLoadError('');
      try {
        const ymaps = await loadYandexMaps();
        if (cancelled || !containerRef.current) return;

        mapInstance = new ymaps.Map(container, {
          center: DEFAULT_MAP_CENTER,
          zoom: 11,
          controls: ['zoomControl', 'fullscreenControl', 'geolocationControl'],
        });
        if (cancelled) {
          mapInstance.destroy();
          return;
        }
        const collection = new ymaps.GeoObjectCollection();
        const placemarks = [];
        const valid = markers.filter((m) => Number.isFinite(m.lat) && Number.isFinite(m.lng));

        valid.forEach((m) => {
          const hint = [m.title, m.subtitle].filter(Boolean).join('\n');
          const placemark = new ymaps.Placemark(
            [m.lat, m.lng],
            { hintContent: m.title, balloonContent: hint.replace(/\n/g, '<br/>') },
            { preset: m.preset || 'islands#blueCircleDotIcon' }
          );
          placemark.events.add('click', () => {
            clickRef.current?.({ place: m.place });
          });
          collection.add(placemark);
          placemarks.push(placemark);
        });

        if (enableCluster && valid.length > 8) {
          const clusterer = new ymaps.Clusterer({
            preset: 'islands#invertedBlueClusterIcons',
            groupByCoordinates: false,
            clusterDisableClickZoom: false,
            clusterHideIconOnBalloonOpen: false,
            geoObjectHideIconOnBalloonOpen: false,
          });
          clusterer.add(placemarks);
          mapInstance.geoObjects.add(clusterer);
        } else {
          mapInstance.geoObjects.add(collection);
        }

        const circles = heatCircles.filter((c) => Number.isFinite(c.lat) && Number.isFinite(c.lng));
        circles.forEach((circle) => {
          const radius = Number(circle.radiusMeters || 500);
          const geoCircle = new ymaps.Circle(
            [[Number(circle.lat), Number(circle.lng)], radius],
            {},
            {
              fillColor: circle.fillColor || 'rgba(255, 127, 80, 0.25)',
              strokeColor: circle.strokeColor || '#ff8c42',
              strokeOpacity: 0.8,
              strokeWidth: Number(circle.strokeWidth || 2),
              interactivityModel: 'default#transparent',
            }
          );
          mapInstance.geoObjects.add(geoCircle);
        });

        if (valid.length > 1) {
          try {
            mapInstance.setBounds(collection.getBounds(), { checkZoomRange: true, zoomMargin: 48 });
          } catch {
            mapInstance.setCenter(DEFAULT_MAP_CENTER, 11);
          }
        } else if (valid.length === 1) {
          mapInstance.setCenter([valid[0].lat, valid[0].lng], 14);
        } else {
          mapInstance.setCenter(DEFAULT_MAP_CENTER, 11);
        }
      } catch (e) {
        if (!cancelled) {
          setLoadError(e?.message || (isEn ? 'Map is unavailable' : 'Карта недоступна'));
        }
      }
    })();

    return () => {
      cancelled = true;
      if (mapInstance) {
        try {
          mapInstance.destroy();
        } catch {
          // ignore
        }
        mapInstance = null;
      }
    };
  }, [enableCluster, heatCircles, isEn, markers]);

  const keyHint = !getYandexMapsApiKey();

  if (loadError) {
    return (
      <div
        className={`callout-warning flex flex-col items-center justify-center !rounded-2xl !px-4 text-center ${className}`}
        style={{ minHeight: height }}
      >
        <p className="font-semibold text-theme">{isEn ? 'Failed to load Yandex Maps' : 'Не удалось показать Яндекс.Карты'}</p>
        <p className="mt-2 max-w-lg text-theme-muted">{loadError}</p>
        {keyHint ? (
          <p className="mt-3 text-xs text-theme-muted">
            {isEn ? 'For production, set the variable ' : 'Для продакшена задайте переменную '}
            <code className="rounded bg-surface-muted/90 px-1">NEXT_PUBLIC_YANDEX_MAPS_API_KEY</code>
            {isEn ? ' when building the frontend.' : ' при сборке фронтенда.'}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className={`overflow-hidden rounded-2xl border border-border bg-surface-muted shadow-inner ${className}`}>
      <div ref={containerRef} style={{ width: '100%', height }} className="min-h-[320px]" />
      {keyHint ? (
        <p className="border-t border-border bg-surface/90 px-3 py-2 text-[11px] text-theme-muted">
          {isEn
            ? 'Yandex API key is recommended for stable map behavior in production.'
            : 'Рекомендуется API-ключ Яндекса для стабильной работы карт в продакшене.'}
        </p>
      ) : null}
    </div>
  );
}
