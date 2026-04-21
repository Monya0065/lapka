'use client';

import { useEffect, useMemo, useState } from 'react';
import Card from '@/components/ui/Card';
import AIWidget from '@/components/ui/AIWidget';
import Table from '@/components/ui/Table';
import ErrorBanner from '@/components/ui/ErrorBanner';

function formatTimer(seconds) {
  const m = String(Math.floor(seconds / 60)).padStart(2, '0');
  const s = String(seconds % 60).padStart(2, '0');
  return `00:${m}:${s}`;
}

export default function VetAssistantPage() {
  const [isRecording, setIsRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [transcript, setTranscript] = useState('Пациент: Барсик. Жалобы: снижение аппетита, единичная рвота...');
  const [structured, setStructured] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isRecording) return undefined;
    const timer = setInterval(() => setSeconds((prev) => prev + 1), 1000);
    return () => clearInterval(timer);
  }, [isRecording]);

  const timerText = useMemo(() => formatTimer(seconds), [seconds]);

  function startRecording() {
    setError('');
    setIsRecording(true);
  }

  function stopRecording() {
    setIsRecording(false);
    if (!transcript.trim()) {
      setTranscript('Запись завершена. Демо-расшифровка: владелец описывает динамику симптомов за последние сутки.');
    }
  }

  function buildProtocol() {
    setError('');
    if (!transcript.trim()) {
      setError('Добавьте текст расшифровки, чтобы сформировать структуру визита.');
      return;
    }
    setStructured([
      'Жалобы: снижение аппетита, единичная рвота, вялость.',
      'Анамнез: симптомы появились в течение 24 часов, контакт с токсинами отрицается.',
      'Осмотр: требуется заполнить жизненные показатели и срочные сигналы в карточке визита.',
      'План: лабораторная диагностика и контроль у лечащего врача.',
    ].join('\n'));
  }

  return (
    <>
      <header className="page-header">
        <div>
          <h1 className="page-title">AI ассистент врача</h1>
          <p className="page-subtitle">Помощь врачу: структурирование заметок и проверка полноты протокола.</p>
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
              <span className="label">Расшифровка</span>
              <textarea className="input min-h-[120px]" value={transcript} onChange={(event) => setTranscript(event.target.value)} />
            </label>
            <button className="btn-secondary" type="button" onClick={buildProtocol}>
              Создать протокол из разговора
            </button>
            <div className="rounded-xl border border-lapka-200 bg-lapka-50 p-3 text-sm text-lapka-700 whitespace-pre-line">
              {structured || 'Структурированная заметка появится здесь.'}
            </div>
          </div>
        </Card>
      </section>

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
