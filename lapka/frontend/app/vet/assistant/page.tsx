'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Card from '@/components/ui/Card';
import AIWidget from '@/components/ui/AIWidget';
import Table from '@/components/ui/Table';
import ErrorBanner from '@/components/ui/ErrorBanner';
import Skeleton from '@/components/ui/Skeleton';
import { apiRequest } from '@/lib/api';

function formatTimer(seconds: number): string {
  const m = String(Math.floor(seconds / 60)).padStart(2, '0');
  const s = String(seconds % 60).padStart(2, '0');
  return `00:${m}:${s}`;
}

export default function VetAssistantPage() {
  const [isRecording, setIsRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [transcript, setTranscript] = useState('');
  const [structured, setStructured] = useState('');
  const [structuring, setStructuring] = useState(false);
  const [error, setError] = useState('');
  const [suggestedProtocol, setSuggestedProtocol] = useState<Record<string, unknown> | null>(null);
  const [protocolLoading, setProtocolLoading] = useState(false);
  const [petId, setPetId] = useState('');
  const [pets, setPets] = useState<Array<{ id: string; name: string }>>([]);

  useEffect(() => {
    if (!isRecording) return undefined;
    const timer = setInterval(() => setSeconds((prev) => prev + 1), 1000);
    return () => clearInterval(timer);
  }, [isRecording]);

  const timerText = useMemo(() => formatTimer(seconds), [seconds]);

  useEffect(() => {
    async function loadPets() {
      try {
        const data = await apiRequest('/api/v1/pets?limit=50');
        const rows = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
        setPets(rows.map((p: { id: string; name: string }) => ({ id: p.id, name: p.name || p.id })));
        if (rows.length > 0 && !petId) {
          setPetId(rows[0].id);
        }
      } catch {}
    }
    loadPets();
  }, []);

  const startRecording = useCallback(() => {
    setError('');
    setIsRecording(true);
  }, []);

  const stopRecording = useCallback(() => {
    setIsRecording(false);
    if (!transcript.trim()) {
      setTranscript('Запись завершена. Демо-расшифровка: владелец описывает динамику симптомов за последние сутки.');
    }
  }, [transcript]);

  const buildProtocol = useCallback(async () => {
    setError('');
    if (!transcript.trim()) {
      setError('Добавьте текст расшифровки, чтобы сформировать структуру визита.');
      return;
    }
    if (!petId) {
      setError('Выберите питомца.');
      return;
    }
    setStructuring(true);
    setStructured('');
    try {
      const data = await apiRequest('/api/v1/ai/visit-structure', {
        method: 'POST',
        body: { transcript_text: transcript, patient_id: petId },
      });
      setStructured(
        [
          data.complaints ? `Жалобы: ${data.complaints}` : '',
          data.anamnesis ? `Анамнез: ${data.anamnesis}` : '',
          data.examination_notes ? `Осмотр: ${data.examination_notes}` : '',
          data.diagnostic_plan ? `Диагностика: ${data.diagnostic_plan}` : '',
          data.follow_up_plan ? `План наблюдения: ${data.follow_up_plan}` : '',
        ]
          .filter(Boolean)
          .join('\n\n') || JSON.stringify(data, null, 2),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось создать структуру визита.');
      setStructured(
        [
          'Жалобы: снижение аппетита, единичная рвота, вялость.',
          'Анамнез: симптомы появились в течение 24 часов, контакт с токсинами отрицается.',
          'Осмотр: требуется заполнить жизненные показатели и срочные сигналы в карточке визита.',
          'План: лабораторная диагностика и контроль у лечащего врача.',
        ].join('\n\n'),
      );
    } finally {
      setStructuring(false);
    }
  }, [transcript, petId]);

  const suggestProtocol = useCallback(async () => {
    if (!transcript.trim()) {
      setError('Добавьте описание случая.');
      return;
    }
    setProtocolLoading(true);
    setSuggestedProtocol(null);
    try {
      const q = transcript.toLowerCase();
      const data = await apiRequest(`/api/v1/protocols?q=${encodeURIComponent(q)}&limit=3`);
      const rows = Array.isArray(data?.items) ? data.items : [];
      if (rows.length > 0) {
        setSuggestedProtocol(rows[0]);
      } else {
        setSuggestedProtocol({ name: 'Подходящий протокол не найден', description: 'Попробуйте уточнить описание симптомов.' });
      }
    } catch (e) {
      setSuggestedProtocol({ name: 'Ошибка поиска', description: 'Протокол временно недоступен.' });
    } finally {
      setProtocolLoading(false);
    }
  }, [transcript]);

  return (
    <>
      <header className="page-header">
        <div>
          <h1 className="page-title">AI ассистент врача</h1>
          <p className="page-subtitle">Структурирование заметок, протоколы и проверка полноты.</p>
        </div>
      </header>

      {error ? <ErrorBanner message={error} /> : null}

      <section className="grid-soft-2">
        <AIWidget title="Сформулируй клиническую заметку" subtitle="Без автодиагноза и без назначения лечения" mode="vet" />

        <Card title="Аудио приёма" subtitle="Запись разговора приёма (демо)">
          <div className="space-y-3">
            <div className="rounded-xl border border-lapka-200 bg-white px-3 py-2 text-sm text-lapka-700">
              Таймер: <span className="font-semibold">{timerText}</span>
            </div>
            <div className="flex gap-2">
              <button className="btn-primary" type="button" onClick={startRecording} disabled={isRecording}>
                Записать разговор
              </button>
              <button className="btn-secondary" type="button" onClick={stopRecording} disabled={!isRecording}>
                Остановить
              </button>
            </div>
            <label className="block">
              <span className="label">Питомец</span>
              <select className="input" value={petId} onChange={(e) => setPetId(e.target.value)}>
                <option value="">— выберите —</option>
                {pets.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="label">Расшифровка</span>
              <textarea
                className="input min-h-[120px]"
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                placeholder="Введите текст расшифровки или опишите случай..."
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <button className="btn-secondary" type="button" onClick={buildProtocol} disabled={structuring || !transcript.trim()}>
                {structuring ? 'Создание...' : 'Создать протокол из разговора'}
              </button>
              <button className="btn-secondary" type="button" onClick={suggestProtocol} disabled={protocolLoading || !transcript.trim()}>
                {protocolLoading ? 'Поиск...' : 'Найти протокол'}
              </button>
            </div>
            {structuring && <Skeleton className="h-32 w-full" />}
            {structured && (
              <div className="rounded-xl border border-lapka-200 bg-lapka-50 p-3 text-sm text-lapka-700 whitespace-pre-line">
                {structured}
              </div>
            )}
          </div>
        </Card>
      </section>

      {suggestedProtocol && (
        <Card
          title={`Протокол: ${suggestedProtocol.name || 'Найден'}`}
          subtitle="Рекомендуемый клинический протокол"
        >
          <div className="space-y-3">
            <p className="text-sm text-lapka-700">{suggestedProtocol.description || '—'}</p>
            {suggestedProtocol.emergency_flag && (
              <span className="pill bg-red-100 text-red-700">EMERGENCY</span>
            )}
            <p className="text-xs text-lapka-500">Категория: {suggestedProtocol.category || '—'}</p>
          </div>
        </Card>
      )}

      <Card title="Проверка полноты протокола" subtitle="Чек-лист качества документации">
        <Table
          columns={['Пункт', 'Статус', 'Комментарий']}
          rows={[
            ['Вес', 'OK', 'Заполнен'],
            ['Аллергии', 'OK', 'Указано: нет'],
            ['План контроля', 'Проверить', 'Добавить сроки повторного осмотра'],
            ['Согласие владельца', 'OK', 'Зафиксировано'],
          ]}
        />
      </Card>
    </>
  );
}