/**
 * E-commerce events dla Google Ads remarketing + GA4 audiences.
 * Wstrzykiwany automatycznie na każdej stronie przez middleware.
 *
 * Fires:
 *   - view_item_list — na /voucher-prezent i /lot-akrobacyjny (widok 3 pakietów)
 *   - page_view (auto przez gtag config) z custom page_type dla audience segmentation
 *   - begin_checkout — gdy user kliknie [data-package=…]
 *
 * Wszystkie eventy respektują Consent Mode v2 — gtag sam zdecyduje co wysłać.
 */
(function () {
  'use strict';

  if (typeof window.gtag !== 'function') return;

  var path = location.pathname.replace(/\/$/, '') || '/';

  var PKGS = {
    pierwszy_lot: { name: 'Voucher — Pierwszy Lot', price: 1999, id: 'AKRO-V-PIERWSZY' },
    adrenalina:   { name: 'Voucher — Adrenalina',  price: 2999, id: 'AKRO-V-ADRENALINA' },
    masterclass:  { name: 'Voucher — Masterclass', price: 4999, id: 'AKRO-V-MASTERCLASS' },
  };

  // Page type classification for audience segmentation in Google Ads / GA4
  var pageType = 'other';
  if (path === '/' || path === '') pageType = 'home';
  else if (path === '/voucher-prezent') pageType = 'voucher_landing';
  else if (path === '/lot-akrobacyjny') pageType = 'product_page';
  else if (path === '/sukces') pageType = 'purchase_confirmation';
  else if (path.indexOf('/blog/') === 0) pageType = 'blog';
  else if (path === '/kalendarz') pageType = 'calendar';
  else if (path === '/pokazy-lotnicze') pageType = 'shows';
  else if (path === '/sklep-merch') pageType = 'merch';
  else if (path === '/camp-akrobacyjny') pageType = 'camp';

  // Send page_type as user property (used for building audience lists)
  window.gtag('set', 'user_properties', { page_type: pageType });

  // view_item_list — pages showing the 3 voucher packages
  if (pageType === 'voucher_landing' || pageType === 'product_page') {
    var items = Object.keys(PKGS).map(function (key, i) {
      var p = PKGS[key];
      return {
        item_id: p.id,
        item_name: p.name,
        item_category: 'Voucher',
        price: p.price,
        index: i,
        quantity: 1,
      };
    });
    window.gtag('event', 'view_item_list', {
      item_list_id: pageType === 'voucher_landing' ? 'voucher_prezent_landing' : 'lot_akrobacyjny_page',
      item_list_name: 'Vouchery akrobacyjne',
      currency: 'PLN',
      value: 2999,
      items: items,
    });
  }

  // Fire begin_checkout when any [data-package] button is clicked
  document.addEventListener('click', function (e) {
    var btn = e.target && e.target.closest ? e.target.closest('[data-package]') : null;
    if (!btn) return;
    var pkgKey = btn.getAttribute('data-package');
    var pkg = PKGS[pkgKey];
    if (!pkg) return;

    window.gtag('event', 'begin_checkout', {
      currency: 'PLN',
      value: pkg.price,
      items: [{
        item_id: pkg.id,
        item_name: pkg.name,
        item_category: 'Voucher',
        price: pkg.price,
        quantity: 1,
      }],
    });
  }, true);

  // Enhanced Conversions — capture checkout form submit and stash customer data
  // for purchase event on /sukces (improves attribution by 10–15%).
  document.addEventListener('submit', function (e) {
    var form = e.target;
    if (!form || form.id !== 'checkoutForm') return;
    try {
      var emailEl = document.getElementById('checkoutEmail');
      var nameEl = document.getElementById('checkoutName');
      if (!emailEl || !emailEl.value) return;
      var parts = (nameEl && nameEl.value || '').trim().split(/\s+/);
      sessionStorage.setItem('akro_checkout_info', JSON.stringify({
        email: emailEl.value.trim().toLowerCase(),
        firstName: (parts[0] || '').toLowerCase(),
        lastName: (parts.slice(1).join(' ') || '').toLowerCase(),
        ts: Date.now(),
      }));
    } catch (err) {}
  }, true); // capture phase — runs before the page's own submit handler redirects

  // Expose manually fireable events
  window.akroEvents = {
    viewItem: function (pkgKey) {
      var pkg = PKGS[pkgKey];
      if (!pkg) return;
      window.gtag('event', 'view_item', {
        currency: 'PLN',
        value: pkg.price,
        items: [{ item_id: pkg.id, item_name: pkg.name, item_category: 'Voucher', price: pkg.price, quantity: 1 }],
      });
    },
  };
})();
