// Minimalny parser iCal (ICS) - komplementarny do generatora w src/lib/ics.ts.
// Używany przez cron sync-google-calendar do zaciągania publicznego kalendarza
// Google. Zwraca eventy z czasami w ISO UTC (gotowe do calendar_events).
//
// Obsługa: rozwijanie złożonych linii (folding), VEVENT, UID/SUMMARY/STATUS,
// DTSTART/DTEND w formatach: '...Z' (UTC), 'YYYYMMDD' (all-day, VALUE=DATE),
// 'YYYYMMDDTHHMMSS' (floating/TZID - traktowane jako czas Europe/Warsaw, bo
// wspólny kalendarz lotów jest w tej strefie).

export interface IcsEvent {
  uid: string;
  summary: string;
  status: string;     // CONFIRMED | TENTATIVE | CANCELLED
  startUtc: string;   // ISO UTC
  endUtc: string;     // ISO UTC
  allDay: boolean;
}

// '20260615T080000' -> '2026-06-15T08:00:00'
function compactToIso(v: string): string {
  const y = v.slice(0, 4), mo = v.slice(4, 6), d = v.slice(6, 8);
  const h = v.slice(9, 11) || '00', mi = v.slice(11, 13) || '00', s = v.slice(13, 15) || '00';
  return `${y}-${mo}-${d}T${h}:${mi}:${s}`;
}

// Czas ścienny Europe/Warsaw -> ISO UTC (offset z Intl, z DST). Mirror warsawWallToUTC
// z functions/api/admin/calendar.ts.
function warsawWallToUtc(dateIso: string, timeIso: string): string {
  const sample = new Date(`${dateIso}T12:00:00Z`);
  const wsHour = parseInt(sample.toLocaleString('en-US', { timeZone: 'Europe/Warsaw', hour: '2-digit', hour12: false }), 10);
  const offset = wsHour - 12; // 1 zima, 2 lato
  const utc = new Date(`${dateIso}T${timeIso}Z`);
  utc.setUTCHours(utc.getUTCHours() - offset);
  return utc.toISOString();
}

function dtToUtc(value: string, params: Record<string, string>): { iso: string; allDay: boolean } {
  const v = value.trim();
  // All-day: VALUE=DATE lub czysta data YYYYMMDD
  if (params.VALUE === 'DATE' || /^\d{8}$/.test(v)) {
    const iso = compactToIso(v.slice(0, 8));        // T00:00:00
    return { iso: new Date(`${iso}Z`).toISOString(), allDay: true };
  }
  if (v.endsWith('Z')) {
    return { iso: new Date(`${compactToIso(v.replace('Z', ''))}Z`).toISOString(), allDay: false };
  }
  // Floating / TZID -> czas warszawski
  const isoLocal = compactToIso(v);
  return { iso: warsawWallToUtc(isoLocal.slice(0, 10), isoLocal.slice(11)), allDay: false };
}

export function parseIcs(text: string): IcsEvent[] {
  // Rozwinięcie złożonych linii: linia zaczynająca się od spacji/tab jest
  // kontynuacją poprzedniej.
  const raw = text.replace(/\r\n/g, '\n').split('\n');
  const lines: string[] = [];
  for (const line of raw) {
    if ((line.startsWith(' ') || line.startsWith('\t')) && lines.length) {
      lines[lines.length - 1] += line.slice(1);
    } else {
      lines.push(line);
    }
  }

  const events: IcsEvent[] = [];
  let cur: Partial<IcsEvent> & { _start?: { iso: string; allDay: boolean }; _end?: { iso: string; allDay: boolean } } | null = null;

  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') { cur = { status: 'CONFIRMED' }; continue; }
    if (line === 'END:VEVENT') {
      if (cur && cur.uid && cur._start) {
        const allDay = cur._start.allDay;
        const startUtc = cur._start.iso;
        // Brak DTEND: all-day -> +1 dzień, czasowe -> +1h.
        let endUtc = cur._end?.iso;
        if (!endUtc) {
          const d = new Date(startUtc);
          d.setUTCHours(d.getUTCHours() + (allDay ? 24 : 1));
          endUtc = d.toISOString();
        }
        events.push({ uid: cur.uid, summary: cur.summary || '', status: (cur.status || 'CONFIRMED').toUpperCase(), startUtc, endUtc, allDay });
      }
      cur = null; continue;
    }
    if (!cur) continue;

    const colon = line.indexOf(':');
    if (colon === -1) continue;
    const left = line.slice(0, colon);
    const value = line.slice(colon + 1);
    const segs = left.split(';');
    const name = segs[0].toUpperCase();
    const params: Record<string, string> = {};
    for (let i = 1; i < segs.length; i++) {
      const [k, val] = segs[i].split('=');
      if (k) params[k.toUpperCase()] = val;
    }

    switch (name) {
      case 'UID': cur.uid = value.trim(); break;
      case 'SUMMARY': cur.summary = value.replace(/\\([,;\\nN])/g, (_, c) => (c === 'n' || c === 'N' ? '\n' : c)).trim(); break;
      case 'STATUS': cur.status = value.trim(); break;
      case 'DTSTART': cur._start = dtToUtc(value, params); break;
      case 'DTEND': cur._end = dtToUtc(value, params); break;
    }
  }

  return events;
}
