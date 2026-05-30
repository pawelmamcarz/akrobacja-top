import { type Env } from '../../../src/lib/types';
import { getDaylight } from '../../../src/lib/daylight';
import { getDayAvailability } from '../../../src/lib/calendar-availability';
import { getWeatherForecast } from '../../../src/lib/weather';
import { rateLimit, clientIp } from '../../../src/lib/rate-limit';

// GET /api/calendar/slots?date=2026-04-15
// Returns available slots for a given date with weather info
export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  try {
    const ip = clientIp(ctx.request);
    const rl = await rateLimit(ctx.env, `slots:${ip}`, 60, 60);
    if (!rl.ok) {
      return Response.json({ error: 'Zbyt wiele zapytań, spróbuj za chwilę' }, { status: 429 });
    }

    const url = new URL(ctx.request.url);
    const dateStr = url.searchParams.get('date');
    if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return Response.json({ error: 'Podaj date w formacie YYYY-MM-DD' }, { status: 400 });
    }

    // Don't allow past dates
    const today = new Date().toISOString().split('T')[0];
    if (dateStr < today) {
      return Response.json({ error: 'Nie można rezerwować w przeszłości' }, { status: 400 });
    }

    // Realna dostępność: sloty − rezerwacje − availability_blocks − calendar_events
    // (loty z Google, serwis mechanika, treningi, pokazy). Jedno źródło prawdy.
    const day = await getDayAvailability(ctx.env, dateStr);
    if (day.blocked) {
      return Response.json({
        date: dateStr,
        available: false,
        reason: day.reason,
        slots: [],
      });
    }

    // Get daylight info
    const daylight = getDaylight(dateStr);

    // Get weather (only for dates within 7 days)
    const daysAhead = Math.floor((new Date(dateStr).getTime() - new Date(today).getTime()) / (1000 * 60 * 60 * 24));
    let weatherHourly: Awaited<ReturnType<typeof getWeatherForecast>> = [];
    let weatherAvailable = false;
    if (daysAhead <= 7) {
      weatherHourly = await getWeatherForecast(dateStr);
      weatherAvailable = true;
    }

    // Build slots with availability and weather
    const slots = day.slots.map(slot => {
      const hour = parseInt(slot.start.split(':')[0]);
      const weather = weatherAvailable && weatherHourly[hour] ? weatherHourly[hour] : null;
      const booked = slot.booked;

      return {
        start: slot.start,
        end: slot.end,
        available: !booked && (!weather || weather.flyable),
        booked,
        blocked_reason: slot.blockedBy ?? null,
        weather: weather ? {
          flyable: weather.flyable,
          reason: weather.reason,
          temp_c: Math.round(weather.temp_c),
          wind_kmh: Math.round(weather.wind_kmh),
          visibility_km: Math.round(weather.visibility_km),
        } : null,
      };
    });

    // Cache slots-for-a-day at the edge. Bookings rarely change for any single day in any
    // single minute, so a short cache (60s for today's date, 5 min beyond) cuts D1 + Open-
    // Meteo round-trips dramatically when a visitor browses the calendar across multiple
    // dates. POST /api/calendar/book does NOT need to invalidate - partial UNIQUE on slots
    // means the booker wins or loses atomically, and the next viewer sees fresh data within
    // the TTL.
    const isToday = dateStr === today;
    const maxAge = isToday ? 60 : 300;
    return new Response(JSON.stringify({
      date: dateStr,
      available: slots.some(s => s.available),
      daylight,
      weather_available: weatherAvailable,
      slots,
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': `public, s-maxage=${maxAge}, max-age=30`,
      },
    });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
  }
};
