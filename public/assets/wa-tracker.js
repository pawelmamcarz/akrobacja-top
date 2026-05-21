// wa-tracker.js — fire-and-forget POST /api/wa-click on WhatsApp link clicks.
//
// Auto-attaches to wszystkich `<a href*="wa.me">` lub `<a href*="api.whatsapp.com">`
// na stronie. Nie blokuje otwarcia WhatsAppa (sendBeacon jest async + reliable
// nawet po unload).
//
// Lokacja CTA pochodzi z atrybutu `data-wa-track` jezeli ustawiony, w przeciwnym
// razie fallback do innerText pierwszych 40 znakow lub 'unknown'.
//
// Przyklad:
//   <a href="https://wa.me/48739158131?text=..." data-wa-track="hero-cta">Sprawdz dotacje</a>
//
// Admin podglada w /admin#wa-clicks (endpoint /api/admin/wa-clicks).

(function () {
  if (typeof window === 'undefined' || !document) return;

  // Parsuje href wa.me/{NUMBER} lub api.whatsapp.com/send?phone={NUMBER}
  // Zwraca cyfry numeru (bez '+', bez spacji) lub null jezeli nie da sie wyciagnac.
  function parseWaNumber(href) {
    try {
      const u = new URL(href, window.location.origin);
      let raw = null;
      if (u.hostname === 'wa.me') {
        // https://wa.me/48739158131 - numer w pathname (pierwszy segment bez '/')
        raw = u.pathname.replace(/^\//, '').split('/')[0];
      } else if (u.hostname === 'api.whatsapp.com') {
        // https://api.whatsapp.com/send?phone=48739158131
        raw = u.searchParams.get('phone');
      }
      if (!raw) return null;
      const digits = raw.replace(/\D/g, '');
      return digits.length >= 6 && digits.length <= 15 ? digits : null;
    } catch { return null; }
  }

  function track(el) {
    try {
      const href = el.getAttribute('href') || '';
      let prefilledText = null;
      let targetNumber = null;
      try {
        const u = new URL(href, window.location.origin);
        prefilledText = u.searchParams.get('text');
      } catch { /* malformed href - ignore */ }
      targetNumber = parseWaNumber(href);

      const data = {
        page: window.location.pathname,
        location: el.dataset.waTrack || (el.innerText || '').trim().slice(0, 40) || 'unknown',
        prefilledText: prefilledText ? decodeURIComponent(prefilledText).slice(0, 500) : null,
      };
      if (targetNumber) data.targetNumber = targetNumber;

      const payload = JSON.stringify(data);

      // sendBeacon dziala przy navigation away (page unload) - idealne dla CTA
      // ktore otwiera nowa karte WhatsApp web/app. Fallback do fetch keepalive.
      if (navigator.sendBeacon) {
        navigator.sendBeacon('/api/wa-click', new Blob([payload], { type: 'application/json' }));
      } else {
        fetch('/api/wa-click', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: payload,
          keepalive: true,
        }).catch(() => {});
      }
    } catch { /* never block click on tracking error */ }
  }

  function isWALink(a) {
    const h = a.getAttribute('href') || '';
    return h.includes('wa.me') || h.includes('api.whatsapp.com');
  }

  // Single delegated listener - lapie tez dynamicznie dodane linki (np. z chat-widget).
  document.addEventListener('click', function (e) {
    let el = e.target;
    while (el && el !== document.body) {
      if (el.tagName === 'A' && isWALink(el)) {
        track(el);
        return;
      }
      el = el.parentElement;
    }
  }, { capture: true, passive: true });
})();
