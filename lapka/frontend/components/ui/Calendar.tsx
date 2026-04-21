'use client';

import { useMemo } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';


export interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end?: string;
  allDay?: boolean;
  backgroundColor?: string;
  borderColor?: string;
  extendedProps?: Record<string, unknown>;
}

interface CalendarProps {
  events?: CalendarEvent[];
  initialView?: string;
  initialDate?: Date;
  editable?: boolean;
  selectable?: boolean;
  height?: number | string;
  locale?: string;
  headerToolbar?: object;
  onDateClick?: (date: Date) => void;
  onEventClick?: (event: CalendarEvent) => void;
  onEventDrop?: (event: CalendarEvent, oldStart: Date, newStart: Date) => void;
  onEventResize?: (event: CalendarEvent, newDurationMinutes: number) => void;
  onDateSelect?: (start: Date, end: Date) => void;
}

function resolveLocale(locale: string) {
  if (locale === 'ru') return 'ru';
  if (locale === 'en') return 'en';
  return locale;
}

export default function Calendar({
  events = [],
  initialView = 'dayGridMonth',
  initialDate = new Date(),
  editable = false,
  selectable = false,
  height = 'auto',
  locale = 'ru',
  headerToolbar = {
    left: 'prev,next today',
    center: 'title',
    right: 'dayGridMonth,timeGridWeek,timeGridDay,listWeek',
  },
  onDateClick,
  onEventClick,
  onEventDrop,
  onEventResize,
  onDateSelect,
}: CalendarProps) {
  const calendarLocale = resolveLocale(locale);

  const calendarOptions = useMemo(() => ({
    plugins: [dayGridPlugin, timeGridPlugin, interactionPlugin],
    initialView,
    initialDate,
    editable,
    selectable,
    height,
    locale: calendarLocale,
    headerToolbar,
    events,
    dateClick: onDateClick ? (info: { date: Date }) => onDateClick(info.date) : undefined,
    eventClick: onEventClick ? (info: { event: { id: string; title: string; start: Date | null; end: Date | null; allDay: boolean; extendedProps: Record<string, unknown> } }) => {
      const e = info.event;
      onEventClick({
        id: String(e.id),
        title: e.title,
        start: e.start?.toISOString() || '',
        end: e.end?.toISOString(),
        allDay: e.allDay,
        extendedProps: e.extendedProps,
      });
    } : undefined,
    eventDrop: onEventDrop ? (info: { event: { id: string; title: string; start: Date | null; end: Date | null; allDay: boolean; extendedProps: Record<string, unknown> }, revert: () => void }) => {
      const e = info.event;
      if (!e.start) { revert(); return; }
      const evt: CalendarEvent = {
        id: String(e.id),
        title: e.title,
        start: e.start.toISOString(),
        end: e.end?.toISOString(),
        allDay: e.allDay,
        extendedProps: e.extendedProps,
      };
      const oldStart = e.start;
      onEventDrop(evt, oldStart, e.start);
    } : undefined,
    eventResize: onEventResize ? (info: { event: { id: string; title: string; start: Date | null; end: Date | null; allDay: boolean; extendedProps: Record<string, unknown> }, revert: () => void }) => {
      const e = info.event;
      if (!e.start || !e.end) { revert(); return; }
      const durationMs = e.end.getTime() - e.start.getTime();
      const durationMinutes = Math.round(durationMs / 60000);
      onEventResize({
        id: String(e.id),
        title: e.title,
        start: e.start.toISOString(),
        end: e.end.toISOString(),
        allDay: e.allDay,
        extendedProps: e.extendedProps,
      }, durationMinutes);
    } : undefined,
    select: onDateSelect ? (info: { start: Date; end: Date; allDay: boolean }) => {
      onDateSelect(info.start, info.end);
    } : undefined,
    eventDisplay: 'block',
    slotMinTime: '07:00:00',
    slotMaxTime: '22:00:00',
    allDaySlot: false,
    nowIndicator: true,
    weekNumbers: true,
    weekText: 'Нед.',
    allText: 'Весь день',
    moreText: 'ещё',
    noEventsText: 'Нет событий',
    firstDay: 1,
    dayMaxEventRows: 3,
    moreLinkClick: 'popover',
    navLinkDayClick: 'week',
    slotDuration: '00:30:00',
    snapDuration: '00:15:00',
    className: 'lapka-calendar',
    validArcs: undefined,
    selectMirror: true,
  }), [events, initialView, initialDate, editable, selectable, height, calendarLocale, headerToolbar, onDateClick, onEventClick, onEventDrop, onEventResize, onDateSelect]);

  return <FullCalendar {...calendarOptions} />;
}