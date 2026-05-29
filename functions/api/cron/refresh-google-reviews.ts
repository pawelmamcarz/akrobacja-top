// Pobranie najnowszych opinii Google z Places API i akumulacja w tabeli reviews.
//
// Google Places "Place Details" zwraca do 5 najnowszych opinii w polu reviews[].
// Stable ID nie jest dostarczane przez API, wiec dedupujemy po `time + author_name`
// (par jest praktycznie unikalna - autor nie pisze 2 opinii w tej samej sekundzie).
// Przy retry / update opinia jest aktualizowana (text, photo, relative_time) zamiast
// duplikowana.
//
// Throttle: GitHub Actions cron leci co godzine, ale ten endpoint nie wywoluje
// Google API jesli ostatnie pobranie bylo < 6h temu. To trzyma nas glaboko w
// darmowym tier ($200/mc kredytu = ~40k Atmosphere calls).
//
// Filter: nowe opinie z rating < 4 wpadaja jako visible=0 (nie wyswietlamy ich
// na stronie). Admin moze przelaczyc visible=1 z poziomu panelu, jezeli uznamy
// ze konkretna negatywna opinia warta jest pokazania (np. odpowiedz na nia).

import { type Env } from '../../../src/lib/types';
import { recordFailedDelivery } from '../../../src/lib/audit';

const REFRESH_THROTTLE_HOURS = 6;
const VISIBILITY_RATING_THRESHOLD = 4;
const PLACES_API_URL = 'https://maps.googleapis.com/maps/api/place/details/json';

interface PlaceReview {
  author_name: string;
  author_url?: string;
  profile_photo_url?: string;
  rating: number;
  text: string;
  language?: string;
  relative_time_description?: string;
  time: number;
}

interface PlaceDetailsResponse {
  status: string;
  result?: {
    reviews?: PlaceReview[];
    rating?: number;
    user_ratings_total?: number;
  };
  error_message?: string;
}

function stableGoogleId(time: number, authorName: string): string {
  const slug = authorName.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '_').slice(0, 60);
  return `g_${time}_${slug}`;
}

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  // Cron-only endpoint - same protocol jak inne crons (CRON_SECRET bearer).
  // Fail-closed: bez ustawionego sekretu nie wpuszczamy nikogo (inaczej
  // "Bearer undefined" przeszedlby przez porownanie ponizej).
  const expected = ctx.env.CRON_SECRET;
  if (!expected) {
    return Response.json({ error: 'Cron not configured' }, { status: 500 });
  }
  const auth = ctx.request.headers.get('Authorization') || '';
  if (auth !== `Bearer ${expected}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!ctx.env.GOOGLE_PLACES_API_KEY || !ctx.env.GOOGLE_PLACE_ID) {
    return Response.json({ skipped: 'not_configured' });
  }

  // Throttle - sprawdz kiedy ostatni raz Google odpowiedzialo (fetched_at na
  // wierszu z source='google'). Nawet jezeli zwrocone 0 opinii, fetched_at
  // wsmiast bumped przez UPDATE na seedach? Nie - seed ma source='google' ale
  // fetched_at = createed_at z migracji. Wiec pierwszy run zawsze wywola API.
  const last = await ctx.env.DB.prepare(
    "SELECT MAX(fetched_at) AS last_fetched FROM reviews WHERE source = 'google' AND google_review_id NOT LIKE 'seed_%'"
  ).first<{ last_fetched: string | null }>();
  if (last?.last_fetched) {
    const hoursSince = (Date.now() - new Date(last.last_fetched + 'Z').getTime()) / 3_600_000;
    if (hoursSince < REFRESH_THROTTLE_HOURS) {
      return Response.json({ skipped: 'throttle', hoursSinceLastFetch: Math.round(hoursSince * 10) / 10 });
    }
  }

  const url = new URL(PLACES_API_URL);
  url.searchParams.set('place_id', ctx.env.GOOGLE_PLACE_ID);
  url.searchParams.set('fields', 'reviews,rating,user_ratings_total');
  url.searchParams.set('language', 'pl');
  url.searchParams.set('reviews_sort', 'newest');
  url.searchParams.set('key', ctx.env.GOOGLE_PLACES_API_KEY);

  let placeData: PlaceDetailsResponse;
  try {
    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(10000) });
    placeData = await res.json();
  } catch (err) {
    ctx.waitUntil(recordFailedDelivery(ctx.env, {
      channel: 'google_places', refId: 'cron', recipient: ctx.env.GOOGLE_PLACE_ID, error: err,
    }));
    return Response.json({ error: 'fetch_failed' }, { status: 500 });
  }

  if (placeData.status !== 'OK') {
    ctx.waitUntil(recordFailedDelivery(ctx.env, {
      channel: 'google_places', refId: 'cron', recipient: ctx.env.GOOGLE_PLACE_ID,
      error: new Error(`Places API ${placeData.status}: ${placeData.error_message ?? 'no message'}`),
    }));
    return Response.json({ error: 'places_api_error', status: placeData.status }, { status: 500 });
  }

  const reviews = placeData.result?.reviews ?? [];
  let added = 0;
  let updated = 0;

  for (const r of reviews) {
    if (typeof r.rating !== 'number' || !r.author_name || !r.text || typeof r.time !== 'number') continue;
    const stableId = stableGoogleId(r.time, r.author_name);

    const existing = await ctx.env.DB.prepare(
      'SELECT id FROM reviews WHERE google_review_id = ?'
    ).bind(stableId).first<{ id: string }>();

    if (existing) {
      await ctx.env.DB.prepare(`
        UPDATE reviews
           SET text = ?, relative_time = ?, profile_photo_url = ?, author_url = ?,
               rating = ?, language = ?, fetched_at = datetime('now')
         WHERE id = ?
      `).bind(
        r.text,
        r.relative_time_description ?? null,
        r.profile_photo_url ?? null,
        r.author_url ?? null,
        r.rating,
        r.language ?? null,
        existing.id,
      ).run();
      updated++;
    } else {
      await ctx.env.DB.prepare(`
        INSERT INTO reviews
          (id, source, google_review_id, author_name, author_url, profile_photo_url,
           rating, text, language, relative_time, time, visible)
        VALUES (?, 'google', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        crypto.randomUUID(),
        stableId,
        r.author_name,
        r.author_url ?? null,
        r.profile_photo_url ?? null,
        r.rating,
        r.text,
        r.language ?? null,
        r.relative_time_description ?? null,
        r.time,
        r.rating >= VISIBILITY_RATING_THRESHOLD ? 1 : 0,
      ).run();
      added++;
    }
  }

  return Response.json({
    ok: true,
    fetched: reviews.length,
    added,
    updated,
    placeRating: placeData.result?.rating ?? null,
    placeTotalRatings: placeData.result?.user_ratings_total ?? null,
  });
};
