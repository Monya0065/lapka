import Link from 'next/link';
import Card from '@/components/ui/Card';
import PageHeader from '@/components/ui/PageHeader';
import StatsCard from '@/components/ui/StatsCard';
import Table from '@/components/ui/Table';
import Timeline from '@/components/ui/Timeline';
import AppImage from '@/components/ui/AppImage';

export default function VetDashboardPage() {
  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Сегодня"
        title="Клиническое рабочее пространство врача"
        subtitle="Сначала поток смены, затем пациенты, протоколы, лаборатория и ближайшие действия без лишней навигации."
        actions={(
          <Link href="/vet/patients" className="btn-primary">Найти пациента</Link>
        )}
      />

      <section className="grid items-start gap-5 2xl:grid-cols-[1.16fr_0.84fr]">
        <Card className="overflow-hidden p-0">
          <div className="grid gap-0 lg:grid-cols-[minmax(0,1.02fr)_340px]">
            <div className="bg-[radial-gradient(circle_at_18%_16%,rgba(255,255,255,0.92),transparent_28%),linear-gradient(180deg,#ffffff_0%,#eef7ff_92%)] p-6 md:p-7">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-lapka-500">Поток смены</p>
              <h2 className="mt-2 text-2xl font-black tracking-tight text-lapka-950 md:text-3xl">Пациенты, протоколы и критические сигналы в одном контуре</h2>
              <p className="mt-3 max-w-3xl text-base leading-7 text-lapka-700">
                Экран врача перестроен как рабочий слой: сначала то, что требует действий сейчас, потом очередь пациентов, лаборатория и подготовка к следующему визиту.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link href="/vet/appointments" className="btn-primary">Открыть поток приёма</Link>
                <Link href="/vet/patients" className="btn-secondary">Поиск пациента</Link>
                <Link href="/vet/labs" className="btn-secondary">Лаборатория</Link>
              </div>
            </div>

            <div className="grid gap-0 border-l border-lapka-200 bg-white/86">
              <div className="border-b border-lapka-200 p-5 md:p-6">
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-lapka-500">Сейчас на смене</p>
                <p className="mt-3 text-2xl font-black tracking-tight text-lapka-950 md:text-3xl">18 пациентов</p>
                <p className="mt-2 text-sm leading-relaxed text-lapka-600">6 ожидают, 3 уже на приёме, 9 завершены и переданы в архив медкарты.</p>
              </div>
              <div className="border-b border-lapka-200 p-5 md:p-6">
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-lapka-500">Сигналы внимания</p>
                <p className="mt-3 text-2xl font-black tracking-tight text-lapka-950 md:text-3xl">1 срочный сигнал</p>
                <p className="mt-2 text-sm leading-relaxed text-lapka-600">Срочный пациент отмечен в потоке и должен попасть в приоритетный маршрут без ручного поиска.</p>
              </div>
              <div className="p-5 md:p-6">
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-lapka-500">Документация</p>
                <p className="mt-3 text-2xl font-black tracking-tight text-lapka-950">92% протоколов закрыто</p>
                <p className="mt-2 text-sm leading-relaxed text-lapka-600">AI-ассистент помогает закрывать пробелы в заметках, но не заменяет врача.</p>
              </div>
            </div>
          </div>
        </Card>

        <Card className="overflow-hidden">
          <div className="p-5 md:p-6">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-lapka-500">AI-ассистент</p>
                <h3 className="mt-2 text-xl font-black tracking-tight text-lapka-950 md:text-2xl">Проверка полноты и структура протокола</h3>
                <p className="mt-2 text-sm leading-relaxed text-lapka-700">
                  Помогает врачу не упускать важные поля и быстрее закрывать визит.
                </p>
              </div>
              <div className="hidden w-[150px] shrink-0 md:block">
                <AppImage src="/assets/img/vet-doctor.svg" alt="Работа врача" width={300} height={300} sizes="150px" className="h-[150px] w-full object-contain" />
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-lapka-200 bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-lapka-500">Полнота протокола</p>
                <p className="mt-2 text-sm font-semibold text-lapka-900">Чек-лист ключевых полей</p>
              </div>
              <div className="rounded-2xl border border-lapka-200 bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-lapka-500">Лаборатория</p>
                <p className="mt-2 text-sm font-semibold text-lapka-900">Короткая расшифровка</p>
              </div>
            </div>

            <div className="mt-4">
              <Link href="/vet/assistant" className="btn-primary w-full">Открыть AI-ассистент</Link>
            </div>
          </div>
        </Card>
      </section>

      <section className="kpi-grid">
        <StatsCard label="Ожидают" value="6" trend="2 новых за час" />
        <StatsCard label="На приёме" value="3" trend="Средняя длительность 24 мин" />
        <StatsCard label="Закрыто" value="9" trend="92% протоколов заполнены" />
        <StatsCard label="Срочный сигнал" value="1" trend="Требует приоритета" />
      </section>

      <section className="grid items-start gap-5 xl:grid-cols-2 2xl:grid-cols-[1.04fr_0.96fr]">
        <Card title="Пациенты сегодня" subtitle="Фильтр: все / ожидает / на приёме / готово">
          <Table
            columns={['Время', 'Питомец', 'Владелец', 'Причина', 'Статус']}
            rows={[
              ['10:00', 'Барсик', 'Александра Иванова', 'Контроль', 'На приёме'],
              ['10:30', 'Макс', 'Сергей Петров', 'Хромота', 'Ожидает'],
              ['11:00', 'Луна', 'Анна Орлова', 'Кожный зуд', 'Ожидает'],
              ['11:30', 'Чарли', 'Виктор Ким', 'Кашель', 'Готово']
            ]}
          />
        </Card>

        <Card title="Сводка визита" subtitle="Автоматическая структура без диагноза от AI">
          <Timeline
            items={[
              { time: 'Жалобы', text: 'Снижение аппетита, вялость, единичная рвота' },
              { time: 'Осмотр', text: 'Состояние средней тяжести, дыхание без выраженной недостаточности' },
              { time: 'План', text: 'Лабораторные исследования + контроль через 24 часа' },
              { time: 'Назначения', text: 'Сформированы, QR ссылка создана' }
            ]}
          />
        </Card>
      </section>

      <section className="grid items-start gap-5 xl:grid-cols-2 2xl:grid-cols-[1fr_0.84fr]">
        <Card title="Поток документов и лаборатории" subtitle="То, что чаще всего ломает скорость смены, собрано в одном слое.">
          <div className="space-y-4">
            <div className="rounded-[22px] border border-lapka-200 bg-lapka-50 px-4 py-4">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-lapka-500">Документы</p>
              <p className="mt-2 text-lg font-bold text-lapka-900">3 новых файла по текущим пациентам</p>
              <p className="mt-2 text-sm leading-7 text-lapka-600">Анализы, УЗИ и вложения больше не теряются между разделами — они под рукой до завершения визита.</p>
              <Link href="/vet/documents" className="mt-4 btn-secondary">Открыть документы</Link>
            </div>
            <div className="rounded-[22px] border border-lapka-200 bg-white px-4 py-4">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-lapka-500">Лаборатория</p>
              <p className="mt-2 text-lg font-bold text-lapka-900">2 результата ожидают импорта в карту</p>
              <p className="mt-2 text-sm leading-7 text-lapka-600">Врач видит лабораторный поток рядом с пациентами и не теряет время на ручной обход разделов.</p>
              <Link href="/vet/labs" className="mt-4 btn-secondary">Открыть лабораторию</Link>
            </div>
          </div>
        </Card>

        <Card title="Следующие рабочие зоны" subtitle="Второй слой навигации теперь завязан на реальных клинических сценариях.">
          <div className="grid gap-3">
            {[
              { title: 'Поиск и пациенты', text: 'Быстрый поиск по имени, контактам владельца, чипу и Lapka ID.', href: '/vet/patients' },
              { title: 'Стационар', text: 'Активные случаи стационара, ежедневные обновления, фото и события, видимые владельцу.', href: '/vet/inpatient' },
              { title: 'Протоколы', text: 'Готовые клинические протоколы и шаблоны приёма.', href: '/clinical/protocols' },
            ].map((item) => (
              <Link key={item.href} href={item.href} className="rounded-[22px] border border-lapka-200 bg-white px-4 py-4 transition hover:-translate-y-0.5 hover:shadow-soft">
                <p className="text-lg font-bold text-lapka-900">{item.title}</p>
                <p className="mt-2 text-sm leading-7 text-lapka-600">{item.text}</p>
              </Link>
            ))}
          </div>
        </Card>
      </section>
    </div>
  );
}
