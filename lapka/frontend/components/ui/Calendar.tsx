'use client';

import { useMemo } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';

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
    right: 'dayGridMonth,timeGridWeek,timeGridDay',
  },
  onDateClick,
  onEventClick,
}) {
  const calendarOptions = useMemo(() => ({
    plugins: [dayGridPlugin, timeGridPlugin, interactionPlugin],
    initialView,
    initialDate,
    editable,
    selectable,
    height,
    locale,
    headerToolbar,
    events,
    dateClick: onDateClick ? (info) => onDateClick(info.date) : undefined,
    eventClick: onEventClick ? (info) => onEventClick(info.event) : undefined,
    eventDisplay: 'block',
    slotMinTime: '08:00:00',
    slotMaxTime: '21:00:00',
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
    navLinkWeekClick: 'week',
    slotDuration: '00:30:00',
    snapDuration: '00:15:00',
    className: 'lapka-calendar',
  }), [events, initialView, initialDate, editable, selectable, height, locale, headerToolbar, onDateClick, onEventClick]);

  return <FullCalendar {...calendarOptions} />;
}