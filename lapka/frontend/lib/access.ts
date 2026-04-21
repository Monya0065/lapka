export function localizeAccessScope(scope?: string | null, locale = 'ru'): string {
  const value = String(scope || '').trim().toUpperCase();
  const isRu = String(locale || 'ru').toLowerCase().startsWith('ru');

  const ruMap: Record<string, string> = {
    PRESCRIPTIONS_ONLY: 'Только назначения',
    BASIC_MEDICAL: 'Базовый доступ',
    FULL_RECORD: 'Полная карта',
    INPATIENT_VIEW: 'Стационар',
    CAMERA_VIEW: 'Камеры стационара',
  };

  const enMap: Record<string, string> = {
    PRESCRIPTIONS_ONLY: 'Prescriptions only',
    BASIC_MEDICAL: 'Basic medical',
    FULL_RECORD: 'Full record',
    INPATIENT_VIEW: 'Inpatient view',
    CAMERA_VIEW: 'Camera view',
  };

  if (!value) return isRu ? 'Не выдан' : 'Not granted';
  return (isRu ? ruMap : enMap)[value] || scope || '';
}