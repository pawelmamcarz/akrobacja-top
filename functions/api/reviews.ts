// Public GET /api/reviews — zwraca posortowane visible=1 opinie z paginacja.
//
// Frontend (public/index.html) wywoluje to przy zaladowaniu strony i po klikniecu
// "Pokaz wiecej". Edge cache 1h zmniejsza obciazenie D1.
//
// Sortowanie: time DESC (najnowsze pierwsze). Po pierwszym cron run nowe Google
// opinie z 2026+ beda u gory, seed-001..seed-008 (czasy 2025) na koncu.
//
// Liczba opinii ogolem + srednia rating zwracane razem zeby frontend mogl
// odswiezac proof-bar (5.0 / 187 opinii) bez drugiego query.

import { type Env } from '../../src/lib/types';
import { rateLimit, clientIp } from '../../src/lib/rate-limit';

interface ReviewRow {
  id: string;
  source: string;
  author_name: string;
  author_url: string | null;
  profile_photo_url: string | null;
  rating: number;
  text: string;
  relative_time: string | null;
  time: number;
}

const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 20;

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const ip = clientIp(ctx.request);
  const rl = await rateLimit(ctx.env, `reviews:${ip}`, 30, 60);
  if (!rl.ok) {
    return Response.json({ ok: false, error: 'rate-limited' }, { status: 429 });
  }

  const url = new URL(ctx.request.url);
  const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10) || 1);
  const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(url.searchParams.get('limit') ?? String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT));
  const offset = (page - 1) * limit;

  const [rowsRes, statsRes] = await Promise.all([
    ctx.env.DB.prepare(`
      SELECT id, source, author_name, author_url, profile_photo_url, rating, text, relative_time, time
        FROM reviews
       WHERE visible = 1
       ORDER BY time DESC
       LIMIT ? OFFSET ?
    `).bind(limit, offset).all<ReviewRow>(),
    ctx.env.DB.prepare(
      'SELECT COUNT(*) AS total, AVG(rating) AS avg_rating FROM reviews WHERE visible = 1'
    ).first<{ total: number; avg_rating: number | null }>(),
  ]);

  const rows = rowsRes.results ?? [];
  const total = statsRes?.total ?? 0;
  const avgRating = statsRes?.avg_rating != null ? Math.round(statsRes.avg_rating * 10) / 10 : null;

  return Response.json(
    {
      reviews: rows.map(r => ({
        id: r.id,
        source: r.source,
        authorName: r.author_name,
        authorUrl: r.author_url,
        profilePhotoUrl: r.profile_photo_url,
        rating: r.rating,
        text: r.text,
        relativeTime: r.relative_time,
        time: r.time,
      })),
      page,
      limit,
      total,
      avgRating,
      hasMore: offset + rows.length < total,
    },
    {
      headers: {
        'Cache-Control': 'public, max-age=3600',
      },
    },
  );
};
