// SEO middleware — injects canonical URLs and robots meta tags into HTML responses.
// Single source of truth for SEO directives — no need to hardcode them in each HTML file.
// Uses HTMLRewriter for streaming transformation (zero-copy, no buffering).

const NOINDEX_PATHS = new Set(['/admin', '/sukces', '/konto', '/seo-implementation']);

const PRIMARY_HOST = 'akrobacja.com';
const SITE_ORIGIN = `https://${PRIMARY_HOST}`;

export const onRequest: PagesFunction = async (context) => {
  const url = new URL(context.request.url);

  // 301 redirect non-primary domains (akrobacja.top, *.pages.dev) → akrobacja.com
  if (url.hostname !== PRIMARY_HOST) {
    return new Response(null, {
      status: 301,
      headers: { Location: `${SITE_ORIGIN}${url.pathname}${url.search}` },
    });
  }

  if (url.pathname.startsWith('/api/')) {
    return context.next();
  }

  const response = await context.next();

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/html')) {
    return response;
  }

  const path = url.pathname.replace(/\.html$/, '').replace(/\/$/, '') || '/';
  const canonicalUrl = path === '/' ? `${SITE_ORIGIN}/` : `${SITE_ORIGIN}${path}`;
  const noindex = NOINDEX_PATHS.has(path);

  return new HTMLRewriter()
    // Remove existing canonical tags
    .on('link[rel="canonical"]', { element(el) { el.remove(); } })
    // Remove existing robots meta tags
    .on('meta[name="robots"]', { element(el) { el.remove(); } })
    // Inject after <head>
    .on('head', {
      element(el) {
        el.prepend(
          `<link rel="canonical" href="${canonicalUrl}">` +
          (noindex ? `<meta name="robots" content="noindex, nofollow">` : ''),
          { html: true },
        );
      },
    })
    .transform(response);
};
