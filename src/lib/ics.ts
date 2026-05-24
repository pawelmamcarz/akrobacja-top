// Minimal RFC 5545 ICS generator dla Workers edge runtime.
// Bez npm package (zaden VTIMEZONE — wszystko UTC z 'Z' suffix; GCal/Apple/Outlook
// poprawnie tlumacza na Europe/Warsaw).

import type { CalendarEvent } from './types';

const PRODID = '-//akrobacja.com//Calendar//PL';

const TYPE_LABEL: Record<CalendarEvent['type'], string> = {
  flight: 'Lot',
  training: 'Szkolenie',
  maintenance: 'Maintenance',
  show: 'Pokaz',
  other: 'Inne',
};

export interface IcsEventInput {
  id: string;
  start_at: string;            // ISO UTC z 'Z'
  end_at: string;
  type: CalendarEvent['type'];
  title?: string | null;
  notes?: string | null;
  status?: CalendarEvent['status'];
  pilot_name?: string | null;
  aircraft_tail?: string | null;
  location?: string;
}

export interface BuildIcsOptions {
  calName: string;
  method?: 'PUBLISH' | 'REQUEST' | 'CANCEL';
  organizerEmail?: string;
  attendeeEmail?: string;
}

export function buildICS(events: IcsEventInput[], opts: BuildIcsOptions): string {
  const method = opts.method ?? 'PUBLISH';
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:${PRODID}`,
    'CALSCALE:GREGORIAN',
    `METHOD:${method}`,
    foldLine(`X-WR-CALNAME:${escapeICS(opts.calName)}`),
    'X-WR-TIMEZONE:Europe/Warsaw',
  ];
  for (const ev of events) {
    lines.push(...renderVEvent(ev, opts));
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n') + '\r\n';
}

export function buildSingleEventICS(event: IcsEventInput, calName: string, organizerEmail = 'maciej@akrobacja.com', attendeeEmail?: string): string {
  return buildICS([event], {
    calName,
    method: 'REQUEST',
    organizerEmail,
    attendeeEmail,
  });
}

function renderVEvent(ev: IcsEventInput, opts: BuildIcsOptions): string[] {
  const now = isoToICS(new Date().toISOString());
  const summaryParts: string[] = [TYPE_LABEL[ev.type] || ev.type];
  if (ev.aircraft_tail) summaryParts.push(ev.aircraft_tail);
  if (ev.pilot_name) summaryParts.push(ev.pilot_name);
  const summary = ev.title?.trim() || summaryParts.join(' · ');

  const descLines: string[] = [];
  if (ev.notes) descLines.push(ev.notes);
  if (ev.pilot_name) descLines.push(`Pilot: ${ev.pilot_name}`);
  if (ev.aircraft_tail) descLines.push(`Samolot: ${ev.aircraft_tail}`);
  const description = descLines.join('\\n');

  const lines: string[] = [
    'BEGIN:VEVENT',
    foldLine(`UID:${ev.id}@akrobacja.com`),
    `DTSTAMP:${now}`,
    `DTSTART:${isoToICS(ev.start_at)}`,
    `DTEND:${isoToICS(ev.end_at)}`,
    foldLine(`SUMMARY:${escapeICS(summary)}`),
  ];
  if (description) lines.push(foldLine(`DESCRIPTION:${escapeICS(description)}`));
  if (ev.location) lines.push(foldLine(`LOCATION:${escapeICS(ev.location)}`));
  else lines.push('LOCATION:Lotnisko Radom-Piastow (EPRP)');
  lines.push(`STATUS:${icsStatus(ev.status)}`);
  if (opts.organizerEmail) lines.push(foldLine(`ORGANIZER:mailto:${opts.organizerEmail}`));
  if (opts.attendeeEmail) lines.push(foldLine(`ATTENDEE;RSVP=TRUE:mailto:${opts.attendeeEmail}`));
  lines.push('END:VEVENT');
  return lines;
}

function icsStatus(s: CalendarEvent['status'] | undefined): string {
  switch (s) {
    case 'cancelled': return 'CANCELLED';
    case 'tentative': return 'TENTATIVE';
    default: return 'CONFIRMED';
  }
}

// '2026-06-01T08:30:00Z' -> '20260601T083000Z'
// '2026-06-01T08:30:00.123Z' -> '20260601T083000Z'
export function isoToICS(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) throw new Error(`isoToICS: invalid date ${iso}`);
  const pad = (n: number, w = 2) => String(n).padStart(w, '0');
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
}

// RFC 5545 §3.3.11 TEXT escape: backslash, comma, semicolon, newline
export function escapeICS(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/\r\n/g, '\\n')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}

// RFC 5545 §3.1: lines >75 octets wrap with CRLF + single space.
// W praktyce zawijamy po 73 charach z marginesem na multi-byte chars.
export function foldLine(line: string): string {
  if (line.length <= 75) return line;
  const chunks: string[] = [];
  let i = 0;
  chunks.push(line.slice(0, 75));
  i = 75;
  while (i < line.length) {
    chunks.push(' ' + line.slice(i, i + 74));
    i += 74;
  }
  return chunks.join('\r\n');
}
