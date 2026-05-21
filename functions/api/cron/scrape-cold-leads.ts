// Cron endpoint: uruchamia cold-lead-scraper dla wszystkich enabled sources.
// HTTP-triggered przez zewnetrzny scheduler (codziennie). Auth: Bearer CRON_SECRET.
//
// POST/GET /api/cron/scrape-cold-leads

import { type Env } from '../../../src/lib/types';
import { runScraper } from '../../../src/lib/lead-scraper';

function checkCronAuth(request: Request, env: Env): boolean {
  const auth = request.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return false;
  const token = auth.slice(7);
  return Boolean(env.CRON_SECRET) && token === env.CRON_SECRET;
}

async function handle(ctx: { request: Request; env: Env }): Promise<Response> {
  if (!checkCronAuth(ctx.request, ctx.env)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const results = await runScraper(ctx.env);
    const totalHits = results.reduce((s, r) => s + r.hits, 0);
    const totalNew = results.reduce((s, r) => s + r.leadsCreated, 0);
    return Response.json({ ok: true, sourcesRun: results.length, totalHits, totalNew, results });
  } catch (err) {
    console.error('[cron/scrape-cold-leads]', err);
    return Response.json({ error: 'scrape failed', message: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

export const onRequestGet: PagesFunction<Env> = handle;
export const onRequestPost: PagesFunction<Env> = handle;
