declare global {
  interface Window {
    ymaps?: {
      ready: (callback: () => void) => void;
      [key: string]: unknown;
    };
  }
}

let loadPromise: Promise<unknown> | null = null;

export function getYandexMapsApiKey(): string {
  return typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_YANDEX_MAPS_API_KEY || '' : '';
}

export function loadYandexMaps(): Promise<unknown> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Yandex Maps: window is undefined'));
  }

  if (window.ymaps) {
    const ymapsRef = window.ymaps;
    return new Promise((resolve, reject) => {
      try {
        ymapsRef.ready(() => resolve(ymapsRef));
      } catch (e) {
        reject(e);
      }
    });
  }

  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-lapka-yandex="1"]');
    if (existing) {
      const done = () => {
        try {
          window.ymaps?.ready(() => resolve(window.ymaps));
        } catch (e) {
          reject(e);
        }
      };
      if (window.ymaps) {
        done();
        return;
      }
      existing.addEventListener('load', done);
      existing.addEventListener('error', () => reject(new Error('Не удалось загрузить Яндекс.Карты')));
      return;
    }

    const key = getYandexMapsApiKey();
    const script = document.createElement('script');
    script.dataset.lapkaYandex = '1';
    script.async = true;
    script.src = key
      ? `https://api-maps.yandex.ru/2.1/?apikey=${encodeURIComponent(key)}&lang=ru_RU`
      : 'https://api-maps.yandex.ru/2.1/?lang=ru_RU';
    script.onload = () => {
      try {
        window.ymaps?.ready(() => resolve(window.ymaps));
      } catch (e) {
        reject(e);
      }
    };
    script.onerror = () => reject(new Error('Не удалось загрузить скрипт api-maps.yandex.ru'));
    document.head.appendChild(script);
  });

  return loadPromise;
}

export const DEFAULT_MAP_CENTER: [number, number] = [59.93428, 30.3351];