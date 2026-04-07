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

  // ---------- Exit intent popup (desktop only) ----------
  function setupExitIntent() {
    if (document.body.dataset.noExitIntent === '1') return;
    if (window.matchMedia('(max-width:820px)').matches) return;
    try {
      if (sessionStorage.getItem('akro_exit_seen') === '1') return;
    } catch (e) {}

    var css = '\
#akro-exit{position:fixed;inset:0;background:rgba(5,12,24,.78);z-index:9999;display:none;\
align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(4px)}\
#akro-exit.open{display:flex;animation:akroFade .25s ease}\
@keyframes akroFade{from{opacity:0}to{opacity:1}}\
#akro-exit .akro-card{max-width:480px;width:100%;background:#0f1f3a;border:1px solid #1b3568;\
border-radius:18px;padding:28px 26px 24px;box-shadow:0 30px 80px rgba(0,0,0,.55);\
font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#fff;position:relative}\
#akro-exit h3{font-size:24px;font-weight:900;margin:0 0 10px;line-height:1.2}\
#akro-exit p{font-size:15px;line-height:1.55;color:#cfe0fa;margin:0 0 18px}\
#akro-exit .akro-cta{display:block;text-align:center;background:#E11D2E;color:#fff;\
padding:14px 18px;border-radius:12px;font-weight:800;text-decoration:none;\
box-shadow:0 12px 28px rgba(225,29,46,.35)}\
#akro-exit .akro-x{position:absolute;top:10px;right:14px;background:transparent;border:0;\
color:#7a8fa6;font-size:24px;cursor:pointer;line-height:1}\
#akro-exit small{display:block;text-align:center;margin-top:12px;color:#7a8fa6;font-size:12px}';
    var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

    var modal = document.createElement('div');
    modal.id = 'akro-exit';
    modal.innerHTML = '<div class="akro-card" role="dialog" aria-modal="true">' +
      '<button class="akro-x" aria-label="Zamknij">&times;</button>' +
      '<h3>Zanim odlecisz...</h3>' +
      '<p>Zapisz się na newsletter i pobierz darmowy PDF <strong>"10 rzeczy do wiedzy przed pierwszym lotem akrobacyjnym"</strong>. Bonus: kod -5% na voucher.</p>' +
      '<a class="akro-cta" href="/kalendarz?utm_source=exit_intent" data-akro-cta="exit_intent">✈️ Sprawdź dostępne terminy</a>' +
      '<small>Bez spamu. W każdej chwili możesz się wypisać.</small>' +
      '</div>';
    document.body.appendChild(modal);

    function open() {
      if (modal.classList.contains('open')) return;
      modal.classList.add('open');
      try { sessionStorage.setItem('akro_exit_seen', '1'); } catch (e) {}
      dl('exit_intent_show', { page_path: location.pathname });
    }
    function close() { modal.classList.remove('open'); }
    modal.querySelector('.akro-x').addEventListener('click', close);
    modal.addEventListener('click', function (e) { if (e.target === modal) close(); });
    document.addEventListener('keyup', function (e) { if (e.key === 'Escape') close(); });

    document.addEventListener('mouseout', function (e) {
      if (!e.toElement && !e.relatedTarget && e.clientY < 10) open();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupExitIntent);
  } else {
    setupExitIntent();
  }

  dl('page_view_enhanced', { page_path: location.pathname });
})();
