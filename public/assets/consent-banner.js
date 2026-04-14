/**
 * Cookie Consent Banner + Google Consent Mode v2
 * Style: match akrobacja.com — navy / cyan / white premium
 *
 * Kategorie (uproszczone do 2 — Niezbędne + Marketing):
 *   - Niezbędne: zawsze ON (techniczne, bez nich strona nie działa)
 *   - Marketing: analytics_storage, ad_storage, ad_user_data, ad_personalization
 *
 * Consent defaults są ustawione wcześniej (inline w <head> przez middleware) jako DENIED.
 * Ten skrypt aktualizuje je po interakcji użytkownika.
 *
 * Zgoda zapisana w localStorage (klucz "akro_consent_v2") na 180 dni.
 */
(function () {
  'use strict';

  var KEY = 'akro_consent_v2';
  var TTL_DAYS = 180;

  // Load saved consent
  function loadConsent() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return null;
      var obj = JSON.parse(raw);
      if (!obj || !obj.ts) return null;
      var age = (Date.now() - obj.ts) / (1000 * 60 * 60 * 24);
      if (age > TTL_DAYS) return null;
      return obj;
    } catch (e) { return null; }
  }

  function saveConsent(marketing) {
    try {
      localStorage.setItem(KEY, JSON.stringify({ marketing: !!marketing, ts: Date.now() }));
    } catch (e) {}
  }

  // Apply to gtag Consent Mode v2
  function applyConsent(marketing) {
    if (typeof window.gtag !== 'function') return;
    var state = marketing ? 'granted' : 'denied';
    window.gtag('consent', 'update', {
      ad_storage: state,
      ad_user_data: state,
      ad_personalization: state,
      analytics_storage: state,
    });
  }

  // Banner styles (inline, żadnych zewnętrznych zależności)
  var CSS = [
    '.akro-consent{position:fixed;left:20px;right:20px;bottom:20px;max-width:520px;margin:0 auto 0 auto;background:#0A1428;border:1px solid rgba(0,229,255,.2);color:#fff;font-family:"Inter",system-ui,sans-serif;box-shadow:0 20px 60px rgba(0,0,0,.6);z-index:99998;padding:24px 26px;animation:akro-slide .4s ease-out;border-left:3px solid #00E5FF}',
    '@media(min-width:768px){.akro-consent{left:24px;right:auto;bottom:24px;margin:0}}',
    '@keyframes akro-slide{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}',
    '.akro-consent h3{font-family:"Montserrat",system-ui,sans-serif;font-size:15px;font-weight:800;margin:0 0 8px;letter-spacing:-.01em}',
    '.akro-consent p{font-size:13px;line-height:1.55;color:rgba(255,255,255,.72);margin:0 0 16px}',
    '.akro-consent p a{color:#00E5FF;text-decoration:underline}',
    '.akro-consent-btns{display:flex;gap:8px;flex-wrap:wrap}',
    '.akro-consent button{font-family:"Montserrat",system-ui,sans-serif;font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;padding:12px 18px;border:none;cursor:pointer;transition:all .2s;flex:1 1 auto}',
    '.akro-consent .akro-btn-accept{background:#00E5FF;color:#0A1428}',
    '.akro-consent .akro-btn-accept:hover{background:#33eaff}',
    '.akro-consent .akro-btn-reject{background:transparent;color:rgba(255,255,255,.85);border:1px solid rgba(255,255,255,.25)}',
    '.akro-consent .akro-btn-reject:hover{border-color:#fff;color:#fff}',
    '.akro-consent .akro-btn-settings{background:transparent;color:rgba(255,255,255,.55);border:none;padding:12px 12px;font-size:11px}',
    '.akro-consent .akro-btn-settings:hover{color:#fff}',
    '.akro-consent-details{margin-top:14px;padding-top:14px;border-top:1px solid rgba(255,255,255,.08);display:none}',
    '.akro-consent-details.open{display:block}',
    '.akro-consent-row{display:flex;justify-content:space-between;align-items:flex-start;gap:14px;padding:10px 0;border-bottom:1px solid rgba(255,255,255,.05)}',
    '.akro-consent-row:last-child{border-bottom:none}',
    '.akro-consent-row-text{flex:1}',
    '.akro-consent-row-name{font-family:"Montserrat",system-ui,sans-serif;font-size:12px;font-weight:700;color:#fff}',
    '.akro-consent-row-desc{font-size:11px;color:rgba(255,255,255,.55);line-height:1.5;margin-top:2px}',
    '.akro-consent-row-locked{font-size:10px;color:#00E5FF;font-weight:700;text-transform:uppercase;letter-spacing:.1em}',
    '.akro-switch{position:relative;display:inline-block;width:36px;height:20px;flex-shrink:0;margin-top:2px}',
    '.akro-switch input{opacity:0;width:0;height:0}',
    '.akro-switch span{position:absolute;cursor:pointer;inset:0;background:rgba(255,255,255,.15);transition:.2s;border-radius:20px}',
    '.akro-switch span:before{position:absolute;content:"";height:14px;width:14px;left:3px;bottom:3px;background:#fff;transition:.2s;border-radius:50%}',
    '.akro-switch input:checked+span{background:#00E5FF}',
    '.akro-switch input:checked+span:before{transform:translateX(16px)}',
  ].join('');

  function injectStyles() {
    if (document.getElementById('akro-consent-styles')) return;
    var s = document.createElement('style');
    s.id = 'akro-consent-styles';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  function renderBanner() {
    injectStyles();
    var wrap = document.createElement('div');
    wrap.className = 'akro-consent';
    wrap.setAttribute('role', 'dialog');
    wrap.setAttribute('aria-label', 'Ustawienia cookies');
    wrap.innerHTML = [
      '<h3>🍪 Używamy plików cookies</h3>',
      '<p>Cookies pomagają nam mierzyć skuteczność reklam i poprawiać stronę. Możesz wybrać które zgadzasz się aktywować. Szczegóły w <a href="/polityka-prywatnosci">polityce prywatności</a>.</p>',
      '<div class="akro-consent-btns">',
        '<button class="akro-btn-accept" data-action="accept">Zgoda na wszystkie</button>',
        '<button class="akro-btn-reject" data-action="reject">Tylko niezbędne</button>',
        '<button class="akro-btn-settings" data-action="toggle">Ustawienia</button>',
      '</div>',
      '<div class="akro-consent-details" id="akroDetails">',
        '<div class="akro-consent-row">',
          '<div class="akro-consent-row-text">',
            '<div class="akro-consent-row-name">Niezbędne</div>',
            '<div class="akro-consent-row-desc">Potrzebne do działania strony (checkout, sesja). Zawsze aktywne.</div>',
          '</div>',
          '<span class="akro-consent-row-locked">Zawsze on</span>',
        '</div>',
        '<div class="akro-consent-row">',
          '<div class="akro-consent-row-text">',
            '<div class="akro-consent-row-name">Marketing i analityka</div>',
            '<div class="akro-consent-row-desc">Google Analytics, Google Ads, remarketing. Pomagają nam dotrzeć do osób takich jak Ty.</div>',
          '</div>',
          '<label class="akro-switch"><input type="checkbox" id="akroMarketing" checked><span></span></label>',
        '</div>',
        '<div class="akro-consent-btns" style="margin-top:12px">',
          '<button class="akro-btn-accept" data-action="save">Zapisz ustawienia</button>',
        '</div>',
      '</div>',
    ].join('');

    document.body.appendChild(wrap);

    wrap.addEventListener('click', function (e) {
      var action = e.target && e.target.getAttribute && e.target.getAttribute('data-action');
      if (!action) return;
      if (action === 'accept') { finish(true, wrap); }
      else if (action === 'reject') { finish(false, wrap); }
      else if (action === 'save') {
        var cb = document.getElementById('akroMarketing');
        finish(cb && cb.checked, wrap);
      }
      else if (action === 'toggle') {
        var d = document.getElementById('akroDetails');
        if (d) d.classList.toggle('open');
      }
    });
  }

  function finish(marketing, wrap) {
    saveConsent(marketing);
    applyConsent(marketing);
    if (wrap && wrap.parentNode) {
      wrap.style.transition = 'opacity .25s, transform .25s';
      wrap.style.opacity = '0';
      wrap.style.transform = 'translateY(10px)';
      setTimeout(function () { wrap.remove(); }, 260);
    }
  }

  // Expose global to re-open settings (linked from footer)
  window.akroConsent = {
    open: function () {
      var existing = document.querySelector('.akro-consent');
      if (existing) return;
      renderBanner();
      var d = document.getElementById('akroDetails');
      if (d) d.classList.add('open');
    },
    reset: function () {
      try { localStorage.removeItem(KEY); } catch (e) {}
      location.reload();
    },
  };

  // On page load
  var existing = loadConsent();
  if (existing) {
    applyConsent(existing.marketing);
  } else {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', renderBanner);
    } else {
      renderBanner();
    }
  }
})();
