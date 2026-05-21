// /api/admin/scraper
// GET: lista scraper_sources + ostatnie scraper_runs (ostatnie 20)
// POST: multi-action
//   - { action: 'run', sourceId?: string } - uruchom scrape (wszystkie enabled lub jedno)
//   - { action: 'toggle', sourceId: string, enabled: 0|1 }
//   - { action: 'create', name, url, source_type, search_template, category }

import { type Env } from '../../../src/lib/types';
import { checkAdminAuth } from '../../../src/lib/admin-auth';
import { runScraper } from '../../../src/lib/lead-scraper';

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  if (!checkAdminAuth(ctx.request, ctx.env)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const [sourcesRes, recentRunsRes] = await Promise.all([
    ctx.env.DB.prepare(
      `SELECT id, name, url, source_type, search_template, category, enabled,
              last_run_at, last_hit_count, last_error, created_at
         FROM scraper_sources
        ORDER BY created_at DESC`
    ).all(),
    ctx.env.DB.prepare(
      `SELECT r.id, r.source_id, s.name AS source_name, r.ran_at, r.hits_found,
              r.leads_created, r.error, r.duration_ms
         FROM scraper_runs r
         LEFT JOIN scraper_sources s ON s.id = r.source_id
        ORDER BY r.ran_at DESC
        LIMIT 20`
    ).all(),
  ]);

  return Response.json({
    sources: sourcesRes.results ?? [],
    recentRuns: recentRunsRes.results ?? [],
  });
};

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  if (!checkAdminAuth(ctx.request, ctx.env)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { action?: string; sourceId?: string; enabled?: number;
              name?: string; url?: string; source_type?: string;
              search_template?: string; category?: string };
  try {
    body = await ctx.request.json();
  } catch {
    return Response.json({ error: 'invalid_body' }, { status: 400 });
  }

  if (body.action === 'run') {
    const results = await runScraper(ctx.env, body.sourceId);
    return Response.json({ ok: true, results });
  }

  if (body.action === 'toggle') {
    if (!body.sourceId) return Response.json({ error: 'sourceId required' }, { status: 400 });
    const enabled = body.enabled ? 1 : 0;
    await ctx.env.DB.prepare(
      `UPDATE scraper_sources SET enabled = ? WHERE id = ?`
    ).bind(enabled, body.sourceId).run();
    return Response.json({ ok: true });
  }

  if (body.action === 'create') {
    if (!body.name || !body.url || !body.source_type) {
      return Response.json({ error: 'name, url, source_type required' }, { status: 400 });
    }
    if (!['api', 'rss', 'scrape'].includes(body.source_type)) {
      return Response.json({ error: 'source_type must be api/rss/scrape' }, { status: 400 });
    }
    const id = `src-${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 6)}`;
    await ctx.env.DB.prepare(
      `INSERT INTO scraper_sources (id, name, url, source_type, search_template, category, enabled)
       VALUES (?, ?, ?, ?, ?, ?, 1)`
    ).bind(
      id,
      body.name.slice(0, 200),
      body.url.slice(0, 500),
      body.source_type,
      body.search_template?.slice(0, 2000) || null,
      body.category?.slice(0, 40) || 'scraped_tender',
    ).run();
    return Response.json({ ok: true, id });
  }

  return Response.json({ error: 'unknown action' }, { status: 400 });
};
