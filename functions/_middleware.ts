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
  const metaPixelId = env.META_PIXEL_ID;           // e.g. "1234567890123456"

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

        // Global gtag.js loader — GA4 + Google Ads with Consent Mode v2
        if (gaId || adsId) {
          const tagId = gaId || adsId;
          headInject +=
            // Consent Mode v2 — defaults DENIED (EU region).
            // Must run BEFORE gtag.js loads. Banner updates via gtag('consent','update',…).
            `<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}` +
            `gtag('consent','default',{ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',analytics_storage:'denied',wait_for_update:500,region:['EU','EEA','PL']});` +
            `gtag('set','url_passthrough',true);` +
            `gtag('set','ads_data_redaction',true);` +
            `gtag('js',new Date());` +
            (gaId ? `gtag('config','${gaId}');` : '') +
            (adsId ? `gtag('config','${adsId}');` : '') +
            `</script>` +
            `<script async src="https://www.googletagmanager.com/gtag/js?id=${tagId}"></script>`;
        }

        // Meta Pixel (Facebook/Instagram) — respects consent (denied by default, banner grants)
        if (metaPixelId) {
          headInject +=
            `<script>!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');` +
            `fbq('consent','revoke');` +
            `fbq('init','${metaPixelId}');` +
            `fbq('track','PageView');` +
            `</script>` +
            `<noscript><img height="1" width="1" style="display:none" src="https://www.facebook.com/tr?id=${metaPixelId}&ev=PageView&noscript=1"/></noscript>`;
        }

        el.prepend(headInject, { html: true });
      },
    });

  // /sukces — fire purchase + Enhanced Conversions from URL (?amount=…&code=…&pkg=…)
  if (path === '/sukces' && (gaId || adsId || metaPixelId)) {
    rewriter.on('body', {
      element(el) {
        el.append(
          `<script>(function(){` +
          `var p=new URLSearchParams(location.search);` +
          `var a=parseFloat(p.get('amount'))||0;` +
          `var c=p.get('code')||'';` +
          `var pk=p.get('pkg')||'';` +
          `if(!a)return;` +
          // Enhanced Conversions — pull email/name from sessionStorage (set at checkout)
          `var ud=null;try{var raw=sessionStorage.getItem('akro_checkout_info');if(raw){var o=JSON.parse(raw);if(o&&o.email){ud={email:o.email,address:{first_name:o.firstName||'',last_name:o.lastName||''}}}}}catch(e){}` +
          (gaId || adsId ? (
            `if(window.gtag){` +
            `if(ud){gtag('set','user_data',ud);}` +
            (gaId ? `gtag('event','purchase',{transaction_id:c,value:a,currency:'PLN',items:[{item_id:pk,item_name:'Voucher '+pk,price:a,quantity:1}]});` : '') +
            (adsId && adsPurchaseLabel ? `gtag('event','conversion',{send_to:'${adsId}/${adsPurchaseLabel}',value:a,currency:'PLN',transaction_id:c});` : '') +
            `}`
          ) : '') +
          (metaPixelId ? (
            // Meta Pixel Purchase — eventID matches CAPI for dedup
            `if(window.fbq){fbq('track','Purchase',{value:a,currency:'PLN',content_ids:[pk],content_type:'product',content_name:'Voucher '+pk,num_items:1},{eventID:'purchase_'+c});}`
          ) : '') +
          `try{sessionStorage.removeItem('akro_checkout_info');}catch(e){}` +
          `})();</script>`,
          { html: true },
        );
      },
    });
  }

  // Cookie consent banner + e-commerce events (remarketing, GA4 audiences)
  rewriter.on('body', {
    element(el) {
      el.append(
        `<script src="/assets/consent-banner.js" defer></script>` +
        `<script src="/assets/ecommerce-events.js" defer></script>`,
        { html: true },
      );
    },
  });

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
