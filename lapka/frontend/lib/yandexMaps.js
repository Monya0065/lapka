/**
 * Yandex Maps JS API 2.1 loader (browser only).
 * Set NEXT_PUBLIC_YANDEX_MAPS_API_KEY for production quotas (https://developer.tech.yandex.ru/).
 */

let loadPromise = null;

export function getYandexMapsApiKey() {
  return typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_YANDEX_MAPS_API_KEY || '' : '';
}

export function loadYandexMaps() {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Yandex Maps: window is undefined'));
  }

  if (window.ymaps) {
    return new Promise((resolve, reject) => {
      try {
        window.ymaps.ready(() => resolve(window.ymaps));
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
          window.ymaps.ready(() => resolve(window.ymaps));
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
        window.ymaps.ready(() => resolve(window.ymaps));
      } catch (e) {
        reject(e);
      }
    };
    script.onerror = () => reject(new Error('Не удалось загрузить скрипт api-maps.yandex.ru'));
    document.head.appendChild(script);
  });

  return loadPromise;
}

/** Санкт-Петербург — центр демо-данных */
export const DEFAULT_MAP_CENTER = [59.93428, 30.3351];
