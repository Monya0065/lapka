'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import Card from '@/components/ui/Card';
import Table from '@/components/ui/Table';
import DoctorCard from '@/components/ui/DoctorCard';
import EmptyState from '@/components/ui/EmptyState';
import Skeleton from '@/components/ui/Skeleton';
import ErrorBanner from '@/components/ui/ErrorBanner';
import { apiRequest } from '@/lib/api';

export default function ClinicDoctorsPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function loadDoctors() {
    setLoading(true);
    setError('');
    try {
      const payload = await apiRequest('/api/v1/clinics/me/members');
      const members = Array.isArray(payload) ? payload : [];
      setRows(members.filter((item) => item.role_in_clinic === 'vet' || item.role === 'vet'));
    } catch (requestError) {
      setError(requestError.message || 'Не удалось загрузить врачей клиники');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDoctors();
  }, []);

  const tableRows = useMemo(
    () =>
      rows.map((item) => [
        item.full_name || '—',
        item.email || '—',
        item.status || '—',
        item.created_at ? new Date(item.created_at).toLocaleDateString('ru-RU') : '—',
      ]),
    [rows]
  );

  return (
    <>
      <header className="page-header">
        <div>
          <h1 className="page-title">Врачи</h1>
          <p className="page-subtitle">Команда клиники, статусы смен и операционные показатели.</p>
        </div>
        <Link href="/clinic/invites" className="btn-primary">Добавить врача</Link>
      </header>

      {error ? <ErrorBanner message={error} onRetry={loadDoctors} /> : null}

      {loading ? (
        <section className="space-y-4">
          <Skeleton className="h-44 w-full" />
          <Skeleton className="h-56 w-full" />
        </section>
      ) : (
        <>
          {rows.length ? (
            <section className="grid gap-4 lg:grid-cols-3">
              {rows.slice(0, 3).map((row) => (
                <DoctorCard
                  key={row.id}
                  name={row.full_name || row.email}
                  specialty="Ветеринарный врач"
                  experience="Опыт уточняется"
                  rating="4.8"
                />
              ))}
            </section>
          ) : (
            <EmptyState title="Врачи не найдены" text="Добавьте врача через раздел приглашений." />
          )}

          <section className="grid-soft-2">
            <Card title="Список врачей клиники" subtitle="Источник: /api/v1/clinics/me/members">
              {rows.length ? (
                <Table columns={['ФИО', 'Email', 'Статус', 'В системе с']} rows={tableRows} />
              ) : (
                <EmptyState title="Нет данных" text="Список врачей появится после добавления сотрудников." />
              )}
            </Card>

            <Card title="Последние протоколы" subtitle="Просмотр без редактирования диагноза/назначений">
              <Table
                columns={['Дата', 'Пациент', 'Врач', 'Статус']}
                rows={[
                  ['06.03.2026', 'Барсик', 'Иванова', 'Готов'],
                  ['06.03.2026', 'Макс', 'Петров', 'Готов'],
                  ['05.03.2026', 'Луна', 'Соколова', 'Не готов'],
                ]}
              />
            </Card>
          </section>
        </>
      )}
    </>
  );
}
