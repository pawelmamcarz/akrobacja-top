import { type Env } from '../../../src/lib/types';
import { getNextAvailableSlots } from '../../../src/lib/calendar-availability';
import { rateLimit, clientIp } from '../../../src/lib/rate-limit';

// GET /api/calendar/next-slots?count=3
// Najbliższe realnie wolne terminy - do propozycji po zakupie vouchera
// (strona /sukces) oraz w mailu z voucherem.
export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const ip = clientIp(ctx.request);
  const rl = await rateLimit(ctx.env, `nextslots:${ip}`, 30, 60);
  if (!rl.ok) {
    return Response.json({ error: 'Zbyt wiele zapytań' }, { status: 429 });
  }

  const url = new URL(ctx.request.url);
  const count = Math.min(Math.max(parseInt(url.searchParams.get('count') || '3', 10) || 3, 1), 6);

  try {
    const slots = await getNextAvailableSlots(ctx.env, count);
    return new Response(JSON.stringify({ slots }), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, s-maxage=300, max-age=60',
      },
    });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
  }
};
