// SEO middleware — injects canonical URLs and robots meta tags into HTML responses.
// Single source of truth for SEO directives — no need to hardcode them in each HTML file.
// Uses HTMLRewriter for streaming transformation (zero-copy, no buffering).

const NOINDEX_PATHS = new Set(['/admin', '/sukces', '/konto', '/seo-implementation']);

const PRIMARY_HOST = 'akrobacja.com';
const SITE_ORIGIN = `https://${PRIMARY_HOST}`;

// Old/legacy URLs → redirect to correct pages (cleanup from old WordPress/WFS site)
const LEGACY_REDIRECTS: Record<string, string> = {
  '/flota': '/blog/extra-300l-samolot-akrobacyjny',
  '/flota/': '/blog/extra-300l-samolot-akrobacyjny',
  '/szkolenia': '/blog/kurs-akrobacji-fcl800',
  '/szkolenia/': '/blog/kurs-akrobacji-fcl800',
  '/product-category/uncategorized': '/',
  '/product-category/uncategorized/': '/',
  '/product/warsaw-voucher': '/lot-akrobacyjny',
  '/product/warsaw-voucher/': '/lot-akrobacyjny',
  '/szkolenia/akrobacja': '/blog/kurs-akrobacji-fcl800',
  '/szkolenia/akrobacja/': '/blog/kurs-akrobacji-fcl800',
  '/szkolenia/uprt': '/blog/uprt-szkolenie-upset-recovery',
  '/szkolenia/uprt/': '/blog/uprt-szkolenie-upset-recovery',
};

export const onRequest: PagesFunction = async (context) => {
  const url = new URL(context.request.url);

  // 301 redirect non-primary domains (akrobacja.top, *.pages.dev) → akrobacja.com
  if (url.hostname !== PRIMARY_HOST) {
    return new Response(null, {
      status: 301,
      headers: { Location: `${SITE_ORIGIN}${url.pathname}${url.search}` },
    });
  }

  // 301 redirect legacy URLs from old site
  const legacyTarget = LEGACY_REDIRECTS[url.pathname];
  if (legacyTarget) {
    return new Response(null, {
      status: 301,
      headers: { Location: `${SITE_ORIGIN}${legacyTarget}` },
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

  // Cloudflare Web Analytics — inject beacon if token is configured
  const env = context.env as unknown as Record<string, string>;
  const cfAnalyticsToken = env.CF_ANALYTICS_TOKEN;
  const gaId = env.GA_MEASUREMENT_ID;              // e.g. "G-XXXXXXXXXX"
  const adsId = env.GOOGLE_ADS_ID || 'AW-928813824'; // Google Ads tag (hardcoded fallback)
  const adsPurchaseLabel = env.GOOGLE_ADS_PURCHASE_LABEL; // conversion label for purchase

  const rewriter = new HTMLRewriter()
    // Remove existing canonical tags
    .on('link[rel="canonical"]', { element(el) { el.remove(); } })
    // Remove existing robots meta tags
    .on('meta[name="robots"]', { element(el) { el.remove(); } })
    // Inject after <head>
    .on('head', {
      element(el) {
        let headInject =
          `<link rel="canonical" href="${canonicalUrl}">` +
          (noindex ? `<meta name="robots" content="noindex, nofollow">` : '');

        // Global gtag.js loader — GA4 + Google Ads
        if (gaId || adsId) {
          const tagId = gaId || adsId;
          headInject +=
            `<script async src="https://www.googletagmanager.com/gtag/js?id=${tagId}"></script>` +
            `<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());` +
            (gaId ? `gtag('config','${gaId}');` : '') +
            (adsId ? `gtag('config','${adsId}');` : '') +
            `</script>`;
        }

        el.prepend(headInject, { html: true });
      },
    });

  // /sukces — fire purchase event with value from URL (?amount=…&code=…&pkg=…)
  if (path === '/sukces' && (gaId || adsId)) {
    rewriter.on('body', {
      element(el) {
        el.append(
          `<script>(function(){var p=new URLSearchParams(location.search);var a=parseFloat(p.get('amount'))||0;var c=p.get('code')||'';var pk=p.get('pkg')||'';if(!a||!window.gtag)return;` +
          (gaId ? `gtag('event','purchase',{transaction_id:c,value:a,currency:'PLN',items:[{item_id:pk,item_name:'Voucher '+pk,price:a,quantity:1}]});` : '') +
          (adsId && adsPurchaseLabel ? `gtag('event','conversion',{send_to:'${adsId}/${adsPurchaseLabel}',value:a,currency:'PLN',transaction_id:c});` : '') +
          `})();</script>`,
          { html: true },
        );
      },
    });
  }

  // Inject Cloudflare Web Analytics beacon before </body>
  if (cfAnalyticsToken) {
    rewriter.on('body', {
      element(el) {
        el.append(
          `<script defer src='https://static.cloudflareinsights.com/beacon.min.js' data-cf-beacon='{"token": "${cfAnalyticsToken}"}'></script>`,
          { html: true },
        );
      },
    });
  }

  return rewriter.transform(response);
};
