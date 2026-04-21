interface IcsEvent {
  id: string;
  start: Date | string;
  summary: string;
  minutes?: number;
  description?: string;
}

function escapeIcsText(value: unknown): string {
  return String(value || '')
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,');
}

function formatUtc(date: Date | string | unknown): string | null {
  const d = date instanceof Date ? date : new Date(String(date));
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

export function buildIcsCalendar(events?: IcsEvent[], calendarName = 'Lapka'): string {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Lapka//Owner calendar//RU', `X-WR-CALNAME:${escapeIcsText(calendarName)}`];
  const stamp = formatUtc(new Date());
  const defaultMins = 60;

  (events || []).forEach((ev) => {
    const start = ev.start instanceof Date ? ev.start : new Date(ev.start);
    const startFmt = formatUtc(start);
    if (!startFmt || !ev.id) return;
    const mins = Number(ev.minutes) > 0 ? Number(ev.minutes) : defaultMins;
    const end = new Date(start.getTime() + mins * 60 * 1000);
    const endFmt = formatUtc(end);
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:lapka-${escapeIcsText(String(ev.id))}@lapka.calendar`);
    lines.push(`DTSTAMP:${stamp}`);
    lines.push(`DTSTART:${startFmt}`);
    lines.push(`DTEND:${endFmt}`);
    lines.push(`SUMMARY:${escapeIcsText(ev.summary || 'Событие Lapka')}`);
    if (ev.description) {
      lines.push(`DESCRIPTION:${escapeIcsText(ev.description)}`);
    }
    lines.push('END:VEVENT');
  });

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

export function downloadIcsFile(filename: string, icsBody: string): void {
  const blob = new Blob([icsBody], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.ics') ? filename : `${filename}.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}