// GET /api/admin/seo-snapshot
// Zwraca migawke stanu SEO:
//  - liczba URL-i w sitemap-pages.xml i sitemap-blog.xml
//  - lista NOINDEX_PATHS (kanonicznych sciezek bez indeksowania)
//  - tablica LEGACY_REDIRECTS z health-checkiem destynacji (HEAD)
//  - liczba klikniec WA i wpisow newslettera dla kontekstu
//
// Header: Authorization: Bearer ${ADMIN_PASSWORD}

import { type Env } from '../../../src/lib/types';
import { checkAdminAuthAsync } from '../../../src/lib/admin-auth';
import { NOINDEX_PATHS, LEGACY_REDIRECTS, SITE_ORIGIN } from '../../../src/lib/seo-config';

function parseLocs(xml: string): string[] {
  const out: string[] = [];
  const re = /<loc>\s*([^<\s]+)\s*<\/loc>/g;
  let m;
  while ((m = re.exec(xml)) !== null) out.push(m[1]);
  return out;
}

interface RedirectHealth {
  from: string;
  to: string;
  external: boolean;
  status: number | null;
  finalUrl: string | null;
  error?: string;
}

async function checkRedirectDestination(to: string): Promise<RedirectHealth> {
  const external = /^https?:\/\//i.test(to);
  const url = external ? to : `${SITE_ORIGIN}${to}`;
  try {
    const res = await fetch(url, {
      method: 'HEAD',
      redirect: 'follow',
      headers: { 'user-agent': 'akrobacja-seo-snapshot/1.0' },
    });
    return {
      from: '',
      to,
      external,
      status: res.status,
      finalUrl: res.url || null,
    };
  } catch (err) {
    return {
      from: '',
      to,
      external,
      status: null,
      finalUrl: null,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  if (!(await checkAdminAuthAsync(ctx.request, ctx.env))) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const origin = new URL(ctx.request.url).origin;

  const [pagesXml, blogXml] = await Promise.all([
    fetch(`${origin}/sitemap-pages.xml`).then(r => r.ok ? r.text() : ''),
    fetch(`${origin}/sitemap-blog.xml`).then(r => r.ok ? r.text() : ''),
  ]);

  const sitemapPages = parseLocs(pagesXml);
  const sitemapBlog = parseLocs(blogXml);

  // Unikalne destynacje (wiele wejsc legacy moze celowac w ten sam URL)
  // sprawdzamy raz na destynacje, potem rozsylamy wynik do kazdego from->to.
  const uniqueDests = Array.from(new Set(Object.values(LEGACY_REDIRECTS)));
  const healthChecks = await Promise.all(uniqueDests.map(checkRedirectDestination));
  const healthByDest = new Map(healthChecks.map(h => [h.to, h]));

  const redirects: RedirectHealth[] = Object.entries(LEGACY_REDIRECTS).map(([from, to]) => {
    const health = healthByDest.get(to);
    return {
      from,
      to,
      external: health?.external ?? false,
      status: health?.status ?? null,
      finalUrl: health?.finalUrl ?? null,
      error: health?.error,
    };
  });

  // Statystyki ruchu z naszej D1 (kontekst, nie sam SEO, ale przydatne na panelu)
  const [waLast7d, subsCount] = await Promise.all([
    ctx.env.DB.prepare(
      "SELECT COUNT(*) AS cnt FROM wa_clicks WHERE created_at >= datetime('now', '-7 days')",
    ).first<{ cnt: number }>().catch(() => null),
    ctx.env.DB.prepare(
      "SELECT COUNT(*) AS cnt FROM subscribers WHERE active = 1",
    ).first<{ cnt: number }>().catch(() => null),
  ]);

  return Response.json({
    generatedAt: new Date().toISOString(),
    sitemap: {
      pages: { count: sitemapPages.length, urls: sitemapPages },
      blog: { count: sitemapBlog.length, urls: sitemapBlog },
    },
    noindexPaths: Array.from(NOINDEX_PATHS).sort(),
    redirects,
    context: {
      waClicksLast7d: waLast7d?.cnt ?? 0,
      subscribersActive: subsCount?.cnt ?? 0,
    },
  });
};
