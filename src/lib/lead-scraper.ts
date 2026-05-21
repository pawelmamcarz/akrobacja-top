// Cold-lead-scraper engine. Iteruje enabled scraper_sources, dla kazdego pobiera
// dane, dopasowuje slowa kluczowe z search_template, wpisuje hity jako leady
// kategoria source.category (zwykle 'scraped_tender').
//
// MVP: trzy typy zrodel:
//   - api  : ezamowienia.gov.pl (search query w URL params), TED (POST JSON).
//   - rss  : eGospodarka RSS - parsujemy XML i wyciagamy <item><title><link>.
//   - scrape: fallback HTML scrape (regex match w body) dla pages bez API.
//
// Idempotencja: UNIQUE(name, category) w leads zapobiega duplikatom z prior runs.

import { type Env } from './types';

export interface ScraperSource {
  id: string;
  name: string;
  url: string;
  source_type: string;
  search_template: string | null;
  category: string;
  enabled: number;
}

export interface ScrapeHit {
  title: string;
  url: string;
  description?: string;
  publishedAt?: string;
}

interface SearchTemplate {
  keywords?: string[];
  cpv?: string[];
  country?: string;
}

function parseTemplate(raw: string | null): SearchTemplate {
  if (!raw) return {};
  try { return JSON.parse(raw) as SearchTemplate; } catch { return {}; }
}

function matchesKeywords(text: string, keywords: string[]): boolean {
  if (keywords.length === 0) return true;
  const t = text.toLowerCase();
  return keywords.some(k => t.includes(k.toLowerCase()));
}

async function scrapeRss(source: ScraperSource): Promise<ScrapeHit[]> {
  const tpl = parseTemplate(source.search_template);
  const res = await fetch(source.url, { headers: { 'user-agent': 'akrobacja-lead-scraper/1.0' } });
  if (!res.ok) throw new Error(`RSS ${res.status}`);
  const xml = await res.text();

  const hits: ScrapeHit[] = [];
  const itemRe = /<item\b[^>]*>([\s\S]*?)<\/item>/gi;
  let m: RegExpExecArray | null;
  while ((m = itemRe.exec(xml)) !== null) {
    const block = m[1];
    const title = (block.match(/<title>([\s\S]*?)<\/title>/i)?.[1] || '').replace(/<!\[CDATA\[|\]\]>/g, '').trim();
    const link = (block.match(/<link>([\s\S]*?)<\/link>/i)?.[1] || '').trim();
    const desc = (block.match(/<description>([\s\S]*?)<\/description>/i)?.[1] || '').replace(/<!\[CDATA\[|\]\]>/g, '').trim();
    const pub = (block.match(/<pubDate>([\s\S]*?)<\/pubDate>/i)?.[1] || '').trim();
    if (!title || !link) continue;
    if (matchesKeywords(`${title} ${desc}`, tpl.keywords ?? [])) {
      hits.push({ title, url: link, description: desc.slice(0, 500), publishedAt: pub });
    }
  }
  return hits;
}

async function scrapeEZamowienia(source: ScraperSource): Promise<ScrapeHit[]> {
  // MVP: probujemy publiczny endpoint search. Format moze sie zmienic, kod jest defensywny.
  // Pelna integracja API wymaga OAuth (write); dla read-search jest ograniczony.
  const tpl = parseTemplate(source.search_template);
  const keyword = (tpl.keywords ?? [])[0] || 'pokaz lotniczy';
  const u = new URL(source.url);
  u.searchParams.set('searchPhrase', keyword);
  u.searchParams.set('pageSize', '20');
  u.searchParams.set('sortField', 'publicationDate');
  u.searchParams.set('sortDir', 'DESC');

  const res = await fetch(u.toString(), {
    headers: { Accept: 'application/json', 'user-agent': 'akrobacja-lead-scraper/1.0' },
  });
  if (!res.ok) throw new Error(`e-Zam ${res.status}`);
  let json: unknown;
  try { json = await res.json(); } catch { return []; }

  // Najczestszy format: { content: [{ title, publicationDate, ... }, ...] }
  const hits: ScrapeHit[] = [];
  const items = (json as { content?: unknown[] }).content || [];
  for (const it of items) {
    if (typeof it !== 'object' || !it) continue;
    const obj = it as Record<string, unknown>;
    const title = String(obj.subject || obj.title || obj.name || '').trim();
    const noticeId = String(obj.noticeId || obj.id || '');
    if (!title || !noticeId) continue;
    if (matchesKeywords(title, tpl.keywords ?? [])) {
      hits.push({
        title,
        url: `https://ezamowienia.gov.pl/mp-client/notices/${noticeId}`,
        publishedAt: String(obj.publicationDate || ''),
      });
    }
  }
  return hits;
}

async function scrapeTed(source: ScraperSource): Promise<ScrapeHit[]> {
  const tpl = parseTemplate(source.search_template);
  const keywords = tpl.keywords ?? [];
  const country = tpl.country || 'PL';
  // Prosty expert query: country + dowolne keyword z listy.
  const q = `${country} AND (${keywords.map(k => `"${k}"`).join(' OR ')})`;

  const res = await fetch(source.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'user-agent': 'akrobacja-lead-scraper/1.0' },
    body: JSON.stringify({
      query: q,
      page: 1, limit: 20,
      sortField: 'ND', sortOrder: 'DESC',
      fields: ['ND', 'TI', 'CY', 'PC', 'DT'],
    }),
  });
  if (!res.ok) throw new Error(`TED ${res.status}`);
  let json: unknown;
  try { json = await res.json(); } catch { return []; }

  const hits: ScrapeHit[] = [];
  const items = (json as { notices?: unknown[]; results?: unknown[] }).notices
    || (json as { notices?: unknown[]; results?: unknown[] }).results
    || [];
  for (const it of items) {
    if (typeof it !== 'object' || !it) continue;
    const obj = it as Record<string, unknown>;
    const title = String(obj.TI || obj.title || '').trim();
    const nd = String(obj.ND || obj.notice_id || '');
    if (!title || !nd) continue;
    hits.push({
      title,
      url: `https://ted.europa.eu/udl?uri=TED:NOTICE:${nd}`,
      publishedAt: String(obj.DT || ''),
    });
  }
  return hits;
}

async function runOneSource(source: ScraperSource): Promise<ScrapeHit[]> {
  if (source.source_type === 'rss') return scrapeRss(source);
  if (source.source_type === 'api') {
    if (source.url.includes('ezamowienia.gov.pl')) return scrapeEZamowienia(source);
    if (source.url.includes('ted.europa.eu')) return scrapeTed(source);
  }
  // Fallback: pobieramy strone, regex znajduje slowa kluczowe w widocznym tekscie.
  const tpl = parseTemplate(source.search_template);
  const res = await fetch(source.url, { headers: { 'user-agent': 'akrobacja-lead-scraper/1.0' } });
  if (!res.ok) throw new Error(`fetch ${res.status}`);
  const txt = await res.text();
  return matchesKeywords(txt, tpl.keywords ?? []) ? [{ title: source.name, url: source.url, description: 'keyword match w stronie' }] : [];
}

export interface ScrapeRunResult {
  sourceId: string;
  sourceName: string;
  ok: boolean;
  hits: number;
  leadsCreated: number;
  durationMs: number;
  error?: string;
}

export async function runScraper(env: Env, sourceId?: string): Promise<ScrapeRunResult[]> {
  const where = sourceId ? 'WHERE id = ? AND enabled = 1' : 'WHERE enabled = 1';
  const stmt = env.DB.prepare(`SELECT id, name, url, source_type, search_template, category, enabled FROM scraper_sources ${where}`);
  const bound = sourceId ? stmt.bind(sourceId) : stmt;
  const sourcesRes = await bound.all();
  const sources = (sourcesRes.results ?? []) as unknown as ScraperSource[];

  const out: ScrapeRunResult[] = [];

  for (const src of sources) {
    const t0 = Date.now();
    const runId = `sr-${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 6)}`;
    let hits: ScrapeHit[] = [];
    let errorMsg: string | undefined;
    try {
      hits = await runOneSource(src);
    } catch (err) {
      errorMsg = err instanceof Error ? err.message : String(err);
    }

    // Wstaw hity jako leady (idempotentnie przez UNIQUE(name, category)).
    let inserted = 0;
    for (const hit of hits) {
      const id = `l-scr-${runId.slice(3, 12)}-${inserted}`;
      try {
        const r = await env.DB.prepare(
          `INSERT OR IGNORE INTO leads (id, name, category, url, source, notes, status, priority, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, 'new', 'medium', datetime('now'), datetime('now'))`
        ).bind(
          id,
          hit.title.slice(0, 200),
          src.category,
          hit.url.slice(0, 500),
          `scraper:${src.name}`,
          (hit.description || hit.publishedAt || '').slice(0, 2000),
        ).run();
        if ((r.meta?.changes ?? 0) > 0) inserted++;
      } catch {
        // ignorujemy dublety i inne bledy per-hit, kontynuujemy
      }
    }

    const durationMs = Date.now() - t0;

    await env.DB.prepare(
      `INSERT INTO scraper_runs (id, source_id, hits_found, leads_created, error, duration_ms)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).bind(runId, src.id, hits.length, inserted, errorMsg ?? null, durationMs).run();

    await env.DB.prepare(
      `UPDATE scraper_sources
          SET last_run_at = datetime('now'),
              last_hit_count = ?,
              last_error = ?
        WHERE id = ?`
    ).bind(hits.length, errorMsg ?? null, src.id).run();

    out.push({
      sourceId: src.id,
      sourceName: src.name,
      ok: !errorMsg,
      hits: hits.length,
      leadsCreated: inserted,
      durationMs,
      error: errorMsg,
    });
  }

  return out;
}
