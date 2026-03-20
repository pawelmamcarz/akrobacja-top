// Radom-Piastów EPRP coordinates
const LAT = 51.3892;
const LON = 21.2133;

// Calculate sunrise/sunset for a given date at EPRP
// Returns { sunrise: "HH:MM", sunset: "HH:MM" } in local time (Europe/Warsaw)
export function getDaylight(dateStr: string): { sunrise: string; sunset: string; daylightMinutes: number } {
  const date = new Date(dateStr + 'T12:00:00Z');
  const dayOfYear = getDayOfYear(date);

  // Solar declination (simplified)
  const declination = 23.45 * Math.sin((2 * Math.PI / 365) * (dayOfYear - 81));
  const decRad = declination * Math.PI / 180;
  const latRad = LAT * Math.PI / 180;

  // Hour angle at sunrise/sunset
  const cosHourAngle = -Math.tan(latRad) * Math.tan(decRad);
  const hourAngle = Math.acos(Math.max(-1, Math.min(1, cosHourAngle))) * 180 / Math.PI;

  // Solar noon in UTC (approximate)
  const solarNoonUTC = 12 - LON / 15;

  const sunriseUTC = solarNoonUTC - hourAngle / 15;
  const sunsetUTC = solarNoonUTC + hourAngle / 15;

  // Convert to Warsaw time (CET +1 or CEST +2)
  const offset = isCEST(date) ? 2 : 1;
  const sunriseLocal = sunriseUTC + offset;
  const sunsetLocal = sunsetUTC + offset;

  const daylightMinutes = Math.round((sunsetLocal - sunriseLocal) * 60);

  return {
    sunrise: decimalToTime(sunriseLocal),
    sunset: decimalToTime(sunsetLocal),
    daylightMinutes,
  };
}

// Generate available time slots for a date
// Slots start 30 min after sunrise, end 30 min before sunset
// Each slot = 1 hour (flight + turnaround), max 8 per day
export function generateSlots(dateStr: string): Array<{ start: string; end: string }> {
  const { sunrise, sunset } = getDaylight(dateStr);

  const startMinutes = timeToMinutes(sunrise) + 30; // 30 min after sunrise
  const endMinutes = timeToMinutes(sunset) - 30; // 30 min before sunset
  const slotDuration = 60; // 1 hour per slot

  const slots: Array<{ start: string; end: string }> = [];
  let current = roundUpTo15(startMinutes);

  while (current + slotDuration <= endMinutes && slots.length < 8) {
    slots.push({
      start: minutesToTime(current),
      end: minutesToTime(current + slotDuration),
    });
    current += slotDuration;
  }

  return slots;
}

function getDayOfYear(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - start.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function isCEST(date: Date): boolean {
  const year = date.getFullYear();
  // CEST: last Sunday of March to last Sunday of October
  const marchLast = new Date(year, 2, 31);
  const cestStart = new Date(year, 2, 31 - marchLast.getDay());
  const octLast = new Date(year, 9, 31);
  const cestEnd = new Date(year, 9, 31 - octLast.getDay());
  return date >= cestStart && date < cestEnd;
}

function decimalToTime(decimal: number): string {
  const h = Math.floor(decimal);
  const m = Math.round((decimal - h) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function minutesToTime(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function roundUpTo15(mins: number): number {
  return Math.ceil(mins / 15) * 15;
}
