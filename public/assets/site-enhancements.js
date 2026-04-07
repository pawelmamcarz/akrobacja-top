/* akrobacja.com — site enhancements
 * - Sticky mobile CTA "Zarezerwuj lot — od 1999 zł"
 * - Lazy-load any <img> still missing loading attr
 * - dataLayer init (GA4/GTM-ready; replace GTM_ID before go-live)
 * - Lightweight conversion event hooks
 */
(function () {
  'use strict';

  // ---------- dataLayer / GTM bootstrap ----------
  window.dataLayer = window.dataLayer || [];
  function dl(ev, params) {
    try { window.dataLayer.push(Object.assign({ event: ev }, params || {})); } catch (e) {}
  }
  // NOTE: Replace GTM-XXXXXXX with real container before production rollout.
  var GTM_ID = window.__GTM_ID__ || 'GTM-XXXXXXX';
  if (GTM_ID && GTM_ID.indexOf('XXXX') === -1) {
    (function (w, d, s, l, i) {
      w[l] = w[l] || []; w[l].push({ 'gtm.start': new Date().getTime(), event: 'gtm.js' });
      var f = d.getElementsByTagName(s)[0], j = d.createElement(s);
      j.async = true; j.src = 'https://www.googletagmanager.com/gtm.js?id=' + i;
      f.parentNode.insertBefore(j, f);
    })(window, document, 'script', 'dataLayer', GTM_ID);
  }

  // ---------- Lazy-load fallback ----------
  try {
    document.querySelectorAll('img:not([loading])').forEach(function (img) {
      img.loading = 'lazy';
      img.decoding = 'async';
    });
  } catch (e) {}

  // ---------- Sticky mobile CTA ----------
  function injectStickyCTA() {
    if (document.getElementById('akro-sticky-cta')) return;
    if (document.body.dataset.noStickyCta === '1') return;

    var css = '\
#akro-sticky-cta{position:fixed;left:0;right:0;bottom:0;z-index:9998;\
background:linear-gradient(180deg,rgba(10,22,40,.0),rgba(10,22,40,.92) 35%);\
padding:10px 12px 14px;display:none;pointer-events:none}\
@media (max-width:820px){#akro-sticky-cta{display:block}}\
#akro-sticky-cta a{pointer-events:auto;display:flex;align-items:center;justify-content:center;\
gap:10px;width:100%;max-width:560px;margin:0 auto;padding:14px 18px;border-radius:14px;\
background:#E11D2E;color:#fff;font-weight:800;font-size:16px;letter-spacing:.2px;\
text-decoration:none;box-shadow:0 10px 24px rgba(225,29,46,.35);\
font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif}\
#akro-sticky-cta a:active{transform:translateY(1px)}\
#akro-sticky-cta .akro-sub{font-weight:600;opacity:.92;font-size:12px;display:block}\
body.has-akro-sticky{padding-bottom:84px}';
    var st = document.createElement('style'); st.textContent = css;
    document.head.appendChild(st);

    var wrap = document.createElement('div');
    wrap.id = 'akro-sticky-cta';
    wrap.innerHTML = '<a href="/kalendarz" data-akro-cta="sticky">' +
      '✈️ Zarezerwuj lot <span class="akro-sub">— od 1 999 zł</span></a>';
    document.body.appendChild(wrap);
    document.body.classList.add('has-akro-sticky');

    wrap.querySelector('a').addEventListener('click', function () {
      dl('cta_click', { cta_location: 'sticky_mobile', cta_label: 'Zarezerwuj lot' });
    });
  }

  // ---------- Generic CTA tracking ----------
  function wireCtaTracking() {
    document.querySelectorAll('a[href*="/kalendarz"], a[href*="/lot-akrobacyjny"], a[href*="wa.me/"]').forEach(function (a) {
      a.addEventListener('click', function () {
        dl('cta_click', {
          cta_location: a.dataset.akroCta || 'inline',
          cta_label: (a.textContent || '').trim().slice(0, 60),
          cta_href: a.getAttribute('href')
        });
      }, { passive: true });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { injectStickyCTA(); wireCtaTracking(); });
  } else {
    injectStickyCTA(); wireCtaTracking();
  }

  dl('page_view_enhanced', { page_path: location.pathname });
})();
