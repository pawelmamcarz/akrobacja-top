import { type Env } from '../../../src/lib/types';
import { generateSlots, getDaylight } from '../../../src/lib/daylight';
import { getWeatherForecast } from '../../../src/lib/weather';

// GET /api/calendar/slots?date=2026-04-15
// Returns available slots for a given date with weather info
export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  try {
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

    // Check for blocks
    const block = await ctx.env.DB.prepare(
      'SELECT reason FROM availability_blocks WHERE date_from <= ? AND date_to >= ?'
    ).bind(dateStr, dateStr).first<{ reason: string }>();

    if (block) {
      return Response.json({
        date: dateStr,
        available: false,
        reason: block.reason,
        slots: [],
      });
    }

    // Get daylight info
    const daylight = getDaylight(dateStr);

    // Generate potential slots
    const potentialSlots = generateSlots(dateStr);

    // Get existing bookings for this date
    const { results: existingBookings } = await ctx.env.DB.prepare(
      "SELECT start_time FROM slots WHERE date = ? AND status != 'available'"
    ).bind(dateStr).all<{ start_time: string }>();
    const bookedTimes = new Set(existingBookings.map(b => b.start_time));

    // Get weather (only for dates within 7 days)
    const daysAhead = Math.floor((new Date(dateStr).getTime() - new Date(today).getTime()) / (1000 * 60 * 60 * 24));
    let weatherHourly: Awaited<ReturnType<typeof getWeatherForecast>> = [];
    let weatherAvailable = false;
    if (daysAhead <= 7) {
      weatherHourly = await getWeatherForecast(dateStr);
      weatherAvailable = true;
    }

    // Build slots with availability and weather
    const slots = potentialSlots.map(slot => {
      const hour = parseInt(slot.start.split(':')[0]);
      const weather = weatherAvailable && weatherHourly[hour] ? weatherHourly[hour] : null;
      const booked = bookedTimes.has(slot.start);

      return {
        start: slot.start,
        end: slot.end,
        available: !booked && (!weather || weather.flyable),
        booked,
        weather: weather ? {
          flyable: weather.flyable,
          reason: weather.reason,
          temp_c: Math.round(weather.temp_c),
          wind_kmh: Math.round(weather.wind_kmh),
          visibility_km: Math.round(weather.visibility_km),
        } : null,
      };
    });

    return Response.json({
      date: dateStr,
      available: slots.some(s => s.available),
      daylight,
      weather_available: weatherAvailable,
      slots,
    });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
  }
};
