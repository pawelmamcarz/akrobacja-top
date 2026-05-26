// Cloudflare Turnstile - explicit rendering with named tokens per form.
// Middleware injects window.TURNSTILE_SITE_KEY and the loader script
// (challenges.cloudflare.com/turnstile/v0/api.js?onload=onloadTurnstileCallback&render=explicit).
// Each form on the page declares <div class="cf-turnstile" data-name="<form>"></div>.
// In the submit handler the form reads the token via window.getTurnstileToken('<form>').
(function () {
  window._turnstileTokens = window._turnstileTokens || {};

  function renderAll() {
    if (!window.turnstile || !window.TURNSTILE_SITE_KEY) return;
    document.querySelectorAll('.cf-turnstile').forEach(function (el) {
      if (el.dataset.rendered) return;
      el.dataset.rendered = '1';
      var name = el.dataset.name || 'default';
      var widgetId = window.turnstile.render(el, {
        sitekey: window.TURNSTILE_SITE_KEY,
        callback: function (token) { window._turnstileTokens[name] = token; },
        'error-callback': function () { window._turnstileTokens[name] = ''; },
        'expired-callback': function () { window._turnstileTokens[name] = ''; },
        theme: el.dataset.theme || 'auto',
        size: el.dataset.size || 'normal',
      });
      el.dataset.widgetId = widgetId;
    });
  }

  // Turnstile API.js calls window.onloadTurnstileCallback once ready.
  window.onloadTurnstileCallback = renderAll;
  // If the API.js already loaded (e.g. on cached navigations), render immediately.
  if (window.turnstile) renderAll();

  window.getTurnstileToken = function (name) {
    return (window._turnstileTokens || {})[name || 'default'] || '';
  };

  window.resetTurnstileToken = function (name) {
    var key = name || 'default';
    window._turnstileTokens[key] = '';
    var el = document.querySelector('.cf-turnstile[data-name="' + key + '"]');
    if (el && el.dataset.widgetId && window.turnstile) {
      try { window.turnstile.reset(el.dataset.widgetId); } catch (e) { /* noop */ }
    }
  };
})();
