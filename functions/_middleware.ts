// SEO middleware — injects canonical URLs and robots meta tags into HTML responses.
// Single source of truth for SEO directives — no need to hardcode them in each HTML file.
// Uses HTMLRewriter for streaming transformation (zero-copy, no buffering).

const NOINDEX_PATHS = new Set(['/admin', '/sukces', '/konto', '/seo-implementation', '/test-konwersji', '/maciej', '/pawel', '/unsubscribe', '/404.html']);

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
  // Short URL for Google Reviews — used in SMS follow-up messages where every
  // character costs money. /opinia → full Google Search write-review URL.
  '/opinia': 'https://www.google.com/search?q=akrobacja.com+%E2%80%94+Loty+akrobacyjne+Extra+300L&stick=H4sIAAAAAAAA_-NgU1I1qDAxN7RIMzc1NTYwtDAzMLK0MqhItrA0NTAzTLY0MDI1S00xWcSqm5hdlJ-UmJyVqJecn6vwqGGKgk9-SaUCVLgyKy9VwbWipChRwdjAwAcAB12ArlkAAAA&hl=pl&authuser=0',
  '/opinia/': 'https://www.google.com/search?q=akrobacja.com+%E2%80%94+Loty+akrobacyjne+Extra+300L&stick=H4sIAAAAAAAA_-NgU1I1qDAxN7RIMzc1NTYwtDAzMLK0MqhItrA0NTAzTLY0MDI1S00xWcSqm5hdlJ-UmJyVqJecn6vwqGGKgk9-SaUCVLgyKy9VwbWipChRwdjAwAcAB12ArlkAAAA&hl=pl&authuser=0',
  // Anchor links can't be indexed by Google as standalone pages — redirect to the
  // canonical page that hosts the section instead (Google Search Console reported
  // these as "Page with redirect" pointing nowhere).
  '/szkolenia/faq': '/lot-akrobacyjny',
  '/szkolenia/faq/': '/lot-akrobacyjny',
  '/szkolenia/obozy-treningowo-szkoleniowe': '/camp-akrobacyjny',
  '/szkolenia/obozy-treningowo-szkoleniowe/': '/camp-akrobacyjny',
  '/kontakt': '/',
  '/kontakt/': '/',
  '/shop': '/sklep-merch',
  '/shop/': '/sklep-merch',
  '/samoloty-do-filmow-i-reklam': '/pokazy-lotnicze',
  '/samoloty-do-filmow-i-reklam/': '/pokazy-lotnicze',
  '/product/szkolenie-do-uprawnienia-akrobacja-samolotowa': '/blog/kurs-akrobacji-fcl800',
  '/product/szkolenie-do-uprawnienia-akrobacja-samolotowa/': '/blog/kurs-akrobacji-fcl800',
  '/uprawnienia-akrobacji-szkolenie-uprt-loty-zapoznawcze-z-akrobacja-pilotaz-akrobacyjny-bezpieczenstwo-lotow': '/blog/uprt-szkolenie-upset-recovery',
  '/uprawnienia-akrobacji-szkolenie-uprt-loty-zapoznawcze-z-akrobacja-pilotaz-akrobacyjny-bezpieczenstwo-lotow/': '/blog/uprt-szkolenie-upset-recovery',
};

export const onRequest: PagesFunction = async (context) => {
  const url = new URL(context.request.url);
  const env = context.env as unknown as Record<string, string>;

  // Cloudflare Pages preview deploys (hash-prefixed *.pages.dev URLs) must
  // remain reachable for QA. Production custom domain (akrobacja.com) keeps
  // canonical redirect; akrobacja.top etc. still get redirected.
  // Detection: any *.pages.dev hostname (preview hashes + project canonical)
  // skips redirect — canonical <link> tag in HTML handles SEO for crawlers.
  const isPagesDev = url.hostname.endsWith('.pages.dev');

  // 301 redirect non-primary domains (akrobacja.top etc.) → akrobacja.com
  if (!isPagesDev && url.hostname !== PRIMARY_HOST) {
    return new Response(null, {
      status: 301,
      headers: { Location: `${SITE_ORIGIN}${url.pathname}${url.search}` },
    });
  }

  // 301 redirect legacy URLs from old site. Targets that already start with http(s):
  // are external (e.g. /opinia → Google Search) and used as-is; relative paths get
  // the canonical origin prefixed.
  const legacyTarget = LEGACY_REDIRECTS[url.pathname];
  if (legacyTarget) {
    const location = /^https?:\/\//i.test(legacyTarget) ? legacyTarget : `${SITE_ORIGIN}${legacyTarget}`;
    return new Response(null, {
      status: 301,
      headers: { Location: location },
    });
  }

  // Explicit 301 trailing-slash strip. Cloudflare Pages otherwise returns 308 which
  // Google Search Console flags as "Page with redirect" for every indexed trailing-
  // slash URL. Done AFTER legacy lookup so '/flota/' still hits LEGACY_REDIRECTS.
  if (!isPagesDev && url.pathname.length > 1 && url.pathname.endsWith('/')) {
    const stripped = url.pathname.replace(/\/+$/, '');
    return new Response(null, {
      status: 301,
      headers: { Location: `${SITE_ORIGIN}${stripped}${url.search}` },
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
  // Admin and pilot portal must not load any third-party analytics tags — the DOM contains
  // customer PII (emails, names, voucher codes) that auto-tracking would otherwise leak.
  const isInternal = path === '/admin' || path === '/konto';

  // Cloudflare Web Analytics — inject beacon if token is configured
  const cfAnalyticsToken = env.CF_ANALYTICS_TOKEN;
  const gaId = isInternal ? undefined : env.GA_MEASUREMENT_ID;              // e.g. "G-XXXXXXXXXX"
  const adsId = isInternal ? undefined : env.GOOGLE_ADS_ID;                  // e.g. "AW-XXXXXXXXXX"
  const adsPurchaseLabel = env.GOOGLE_ADS_PURCHASE_LABEL; // conversion label
  const metaPixelId = isInternal ? undefined : env.META_PIXEL_ID;          // e.g. "1234567890123456"
  const turnstileSiteKey = env.TURNSTILE_SITE_KEY;

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

        // Preconnect to 3rd-party origins we load on every page. Saves the DNS+TLS
        // handshake (~50-200ms each) before the actual script <script> tag fires.
        // crossorigin needed for gstatic/connect.facebook.net which serve CORS resources.
        if (gaId || adsId) {
          headInject +=
            `<link rel="preconnect" href="https://www.googletagmanager.com" crossorigin>` +
            `<link rel="preconnect" href="https://www.google-analytics.com" crossorigin>`;
        }
        if (metaPixelId) {
          headInject += `<link rel="preconnect" href="https://connect.facebook.net" crossorigin>`;
        }
        // Stripe.js is loaded only on checkout pages, but the handshake to js.stripe.com
        // happens on every visit that lands on /lot-akrobacyjny etc. — warm it early.
        headInject += `<link rel="preconnect" href="https://js.stripe.com" crossorigin>`;

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
          // Restore saved consent synchronously — must run before any conversion events in <body>.
          // consent-banner.js is deferred so without this the conversion event fires before
          // consent is updated to 'granted', causing Consent Mode v2 to send a cookieless ping.
          headInject +=
            `<script>(function(){try{var r=localStorage.getItem('akro_consent_v2');` +
            `if(r){var o=JSON.parse(r);if(o&&o.ts&&(Date.now()-o.ts)/864e5<180){` +
            `var s=o.marketing?'granted':'denied';` +
            `gtag('consent','update',{ad_storage:s,ad_user_data:s,ad_personalization:s,analytics_storage:s});` +
            `}}}catch(e){}})();</script>`;
        }

        // Turnstile — expose the public site key for forms; the explicit-render loader
        // calls window.onloadTurnstileCallback (defined in /assets/turnstile.js) when ready.
        if (turnstileSiteKey) {
          headInject +=
            `<script>window.TURNSTILE_SITE_KEY=${JSON.stringify(turnstileSiteKey)};</script>` +
            `<script src="https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onloadTurnstileCallback&render=explicit" async defer></script>`;
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
  // Skip injection for the test_naklejka package — it exists only for live-pixel debugging
  // and we don't want it polluting GA4/Ads conversion data with PLN 1-2 events.
  if (path === '/sukces' && (gaId || adsId || metaPixelId)) {
    rewriter.on('body', {
      element(el) {
        el.append(
          `<script>(function(){` +
          `var p=new URLSearchParams(location.search);` +
          `var a=parseFloat(p.get('amount'))||0;` +
          `var c=p.get('code')||'';` +
          `var pk=p.get('pkg')||'';` +
          `if(!a||!c)return;` +
          // Skip test package — see comment above.
          `if(pk==='test_naklejka')return;` +
          // Dedup against page reload — eventID dedup only handles server-vs-client, not
          // double-fire from the same client. GA4 and Google Ads have no built-in dedup.
          `var dedupKey='akro_pf_'+c;` +
          `try{if(sessionStorage.getItem(dedupKey))return;sessionStorage.setItem(dedupKey,'1');}catch(e){}` +
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

  // Cookie consent banner + e-commerce events (remarketing, GA4 audiences) + Turnstile helper.
  rewriter.on('body', {
    element(el) {
      let bodyAppend =
        `<script src="/assets/consent-banner.js" defer></script>` +
        `<script src="/assets/ecommerce-events.js" defer></script>`;
      if (turnstileSiteKey) {
        bodyAppend += `<script src="/assets/turnstile.js" defer></script>`;
      }
      el.append(bodyAppend, { html: true });
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

  const transformed = rewriter.transform(response);

  // Security headers — applied to every HTML response.
  const secured = new Response(transformed.body, transformed);
  secured.headers.set('X-Content-Type-Options', 'nosniff');
  secured.headers.set('X-Frame-Options', 'DENY');
  secured.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  secured.headers.set('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  secured.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  // CSP — allowlist matches everything the public site loads today (Stripe, GA4/Ads, Meta).
  // 'unsafe-inline' on script and style is unavoidable here because inline tags are injected
  // by both middleware and the per-page HTML; tightening further would need nonces.
  secured.headers.set(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      // 'unsafe-eval' is needed by Google Tag Manager custom HTML tags / trigger evaluation.
      // unpkg.com — meta-capi-param-builder loaded by GTM tag; analytics.tiktok.com — TikTok pixel.
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://*.js.stripe.com https://www.googletagmanager.com https://*.googletagmanager.com https://www.google-analytics.com https://*.google-analytics.com https://connect.facebook.net https://challenges.cloudflare.com https://static.cloudflareinsights.com https://unpkg.com https://analytics.tiktok.com https://*.tiktok.com",
      // Stripe 3DS / SCA challenge redirects users into bank-owned iframes served via
      // subdomains of stripe.com (m.stripe.network for fingerprinting, *.stripe.com for ACS).
      // YouTube no-cookie embeds are used on landing pages; GTM noscript fallback iframe
      // is on every page even when JS is enabled.
      "frame-src https://js.stripe.com https://*.js.stripe.com https://hooks.stripe.com https://*.stripe.com https://*.stripe.network https://challenges.cloudflare.com https://www.youtube-nocookie.com https://www.youtube.com https://www.googletagmanager.com",
      "img-src 'self' data: https:",
      // Google Fonts CSS loaded from fonts.googleapis.com on every page (Montserrat + Inter).
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      // Google Fonts TTF/WOFF served from fonts.gstatic.com.
      "font-src 'self' data: https://fonts.gstatic.com",
      // analytics.tiktok.com — TikTok pixel beacon endpoint.
      "connect-src 'self' https://www.google-analytics.com https://*.google-analytics.com https://*.analytics.google.com https://*.facebook.com https://api.stripe.com https://*.stripe.com https://*.stripe.network https://challenges.cloudflare.com https://cloudflareinsights.com https://analytics.tiktok.com https://*.tiktok.com",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self' https://checkout.stripe.com https://*.stripe.com",
    ].join('; '),
  );
  // Sensitive paths must not be cached by Cloudflare or the browser — admin sees fresh
  // data after a deploy, /sukces never serves a stale conversion script.
  if (path === '/admin' || path === '/konto' || path === '/sukces') {
    secured.headers.set('Cache-Control', 'no-store');
  }
  return secured;
};
