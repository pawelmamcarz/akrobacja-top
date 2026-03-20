// SEO middleware — injects canonical URLs and robots meta tags into HTML responses.
// Single source of truth for SEO directives — no need to hardcode them in each HTML file.

const NOINDEX_PATHS = new Set(['/admin', '/sukces', '/konto', '/seo-implementation']);

const SITE_ORIGIN = 'https://akrobacja.top';

export const onRequest: PagesFunction = async (context) => {
  const response = await context.next();

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/html')) {
    return response;
  }

  const url = new URL(context.request.url);
  // Skip API routes
  if (url.pathname.startsWith('/api/')) {
    return response;
  }

  const path = url.pathname.replace(/\.html$/, '').replace(/\/$/, '') || '/';
  const canonicalUrl = path === '/' ? `${SITE_ORIGIN}/` : `${SITE_ORIGIN}${path}`;
  const noindex = NOINDEX_PATHS.has(path);

  const canonicalTag = `<link rel="canonical" href="${canonicalUrl}">`;
  const robotsTag = noindex ? `<meta name="robots" content="noindex, nofollow">` : '';
  const inject = `${canonicalTag}\n${robotsTag}`.trim();

  const html = await response.text();

  // Remove existing canonical/robots tags to avoid duplicates
  const cleaned = html
    .replace(/<link\s+rel="canonical"[^>]*>\s*/gi, '')
    .replace(/<meta\s+name="robots"[^>]*>\s*/gi, '');

  // Inject after <head> or after first <meta charset>
  let injected: string;
  const charsetMatch = cleaned.match(/<meta\s+charset="[^"]*"\s*\/?>/i);
  if (charsetMatch) {
    const pos = cleaned.indexOf(charsetMatch[0]) + charsetMatch[0].length;
    injected = cleaned.slice(0, pos) + '\n' + inject + cleaned.slice(pos);
  } else {
    injected = cleaned.replace(/<head[^>]*>/i, (match) => match + '\n' + inject);
  }

  return new Response(injected, {
    status: response.status,
    headers: response.headers,
  });
};
