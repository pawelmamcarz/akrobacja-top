import { type Env, PACKAGES, ADDONS, sumAddons, validAddonIds, type PackageId } from '../../src/lib/types';
import { generateVoucherCode } from '../../src/lib/voucher-code';
import { isValidEmail, isValidSendAt } from '../../src/lib/validate';

interface CheckoutBody {
  packageId: PackageId;
  videoAddon?: boolean;   // legacy - utrzymane dla starszych formularzy. Zostaje zmergowane z addons[].
  addons?: string[];      // nowe - lista AddonId (np. ['video','second_seat']). Walidowane przeciw ADDONS + applicablePackages.
  customerName: string;
  customerEmail: string;
  customerNip?: string;
  discountCode?: string;
  source?: string;        // page slug from where checkout was initiated (for cancel_url)
  // Personalizacja vouchera (prezent) - wszystkie opcjonalne, default = obecne zachowanie.
  recipientName?: string; // imię obdarowanego (max 80) - fallback do customerName
  dedication?: string;    // dedykacja na PDF (max 200)
  sendAt?: string;        // ISO date/datetime, planowana wysyłka maila (max +365 dni)
}

// Map source slug → cancel URL, Stripe "Back" button vraca user tam skąd przyszedł
const CANCEL_URLS: Record<string, string> = {
  'voucher-prezent': '/voucher-prezent',
  'lot-akrobacyjny': '/lot-akrobacyjny',
  'test-konwersji': '/test-konwersji',
  'index': '/',
};

// Valid discount codes, simple registry to avoid D1 lookup on every checkout.
//   pct                 - percentage off
//   fixed               - fixed amount off (grosze, 100 = 1 PLN)
//   applicablePackages  - optional whitelist; if set, the code is rejected for any other pkg
//   validFrom           - inclusive YYYY-MM-DD (UTC date) the code becomes active
//   validUntil          - inclusive YYYY-MM-DD the code stops being accepted
//   singleUse           - gdy true, kod może być wykorzystany tylko RAZ globalnie. Po pierwszym
//                         orderze ze statusem 'paid' / 'processing' jest odrzucany dla wszystkich
//                         kolejnych. Sprawdzane query do D1 przy próbie aplikacji.
// WRACAM5 = -5% recovery (abandoned cart). PIERWSZY100 = -100 PLN (welcome / first-time).
// IG10 / FB10 / MAJOWKA = -10% social campaigns.
// ATAM2205 = Pierwszy Lot 1999 → 1555 PLN (event partnership), ważny 15-30 maja 2026.
// KURS5OFF = -5% dla subskrybentów 5-day email course (lead magnet flow).
// ODLOTOWY = -33% pakiet Para (3777 PLN), jednorazowy, Dzień Matki 2026-05-25→05-26.
interface DiscountSpec {
  pct?: number;
  fixed?: number;
  applicablePackages?: PackageId[];
  validFrom?: string;
  validUntil?: string;
  singleUse?: boolean;
}
const DISCOUNTS: Record<string, DiscountSpec> = {
  WRACAM5: { pct: 5 },
  PIERWSZY100: { fixed: 10000 },
  IG10: { pct: 10 },
  FB10: { pct: 10 },
  MAJOWKA: { pct: 10 },
  ATAM2205: { fixed: 44400, applicablePackages: ['pierwszy_lot'], validFrom: '2026-05-15', validUntil: '2026-05-30' },
  KURS5OFF: { pct: 5 },
  MACIEJ10: { pct: 10 },   // Linktree akrobacja.com/maciej, ruch z IG @bullet.aerobatics
  PAWEL10: { pct: 10 },    // Linktree akrobacja.com/pawel, ruch z IG @xpoli
  URODZINY10: { pct: 10 }, // SEO landing /prezent-na-urodziny
  ODLOTOWY: { pct: 33, applicablePackages: ['para'], validFrom: '2026-05-25', validUntil: '2026-05-26', singleUse: true },
  LISTA10: { pct: 10, validUntil: '2026-06-09' },  // SMS blast 2026-05-26 do 10 subskrybentow SMS listy
};

function isDiscountActive(d: DiscountSpec | undefined, packageId: PackageId, today: string): boolean {
  if (!d) return false;
  if (d.validFrom && today < d.validFrom) return false;
  if (d.validUntil && today > d.validUntil) return false;
  if (d.applicablePackages && !d.applicablePackages.includes(packageId)) return false;
  return true;
}

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  try {
    const body = (await ctx.request.json()) as CheckoutBody;

    const pkg = PACKAGES[body.packageId];
    if (!pkg) {
      return Response.json({ error: 'Nieprawidłowy pakiet' }, { status: 400 });
    }
    // test_naklejka exists only for live-pixel verification - never accept it from any
    // surface other than the dedicated test page. Otherwise an attacker could blast cheap
    // 2-PLN purchases that fire Meta CAPI Purchase events and pollute ML optimisation data.
    if (body.packageId === 'test_naklejka' && body.source !== 'test-konwersji') {
      return Response.json({ error: 'Nieprawidłowy pakiet' }, { status: 400 });
    }
    if (!body.customerName || !body.customerEmail) {
      return Response.json({ error: 'Imię i email są wymagane' }, { status: 400 });
    }
    if (!isValidEmail(body.customerEmail)) {
      return Response.json({ error: 'Nieprawidłowy adres email' }, { status: 400 });
    }

    // Personalizacja prezentu - sanityzacja długości, walidacja sendAt.
    const recipientName = body.recipientName?.trim().slice(0, 80) || null;
    const dedication = body.dedication?.trim().slice(0, 200) || null;
    let sendAt: string | null = null;
    if (body.sendAt && body.sendAt.trim()) {
      sendAt = isValidSendAt(body.sendAt, 365);
      if (!sendAt) {
        return Response.json(
          { error: 'Data planowanej wysyłki musi być w przyszłości i nie dalej niż 365 dni' },
          { status: 400 },
        );
      }
    }

    const voucherCode = generateVoucherCode();

    // Backward-compat merge: starsze formularze (en/, lot-akrobacyjny.html bez cross-sellu)
    // wysyłają tylko `videoAddon: boolean`. Mergujemy do jednej listy `validatedAddons`,
    // potem cała logika ceny / Stripe / faktury / D1 idzie przez ten kanał.
    const requestedAddons: string[] = Array.isArray(body.addons) ? body.addons.filter(x => typeof x === 'string') : [];
    if (body.videoAddon === true && !requestedAddons.includes('video')) requestedAddons.push('video');
    const validatedAddons = validAddonIds(requestedAddons, body.packageId);
    const videoAddonFinal = validatedAddons.includes('video');
    const baseAmount = pkg.price + sumAddons(validatedAddons);

    // Apply discount if valid (also enforces validFrom / validUntil + applicablePackages).
    const normalizedCode = body.discountCode?.trim().toUpperCase() || '';
    const today = new Date().toISOString().split('T')[0];
    let discount: DiscountSpec | undefined = undefined;
    let personalCodeRow: { code: string; customer_email: string; pct: number | null; fixed_gr: number | null; expires_at: string | null; used_at: string | null } | null = null;

    // 1. Statyczny DISCOUNTS
    const candidate = normalizedCode ? DISCOUNTS[normalizedCode] : undefined;
    if (isDiscountActive(candidate, body.packageId, today)) {
      discount = candidate;
    } else if (normalizedCode) {
      // 2. Fallback: personal_discount_codes (per-email jednorazowe kody, np. PHOTO-XXXX)
      personalCodeRow = await ctx.env.DB.prepare(
        `SELECT code, customer_email, pct, fixed_gr, expires_at, used_at
         FROM personal_discount_codes WHERE code = ? LIMIT 1`
      ).bind(normalizedCode).first();
      if (personalCodeRow) {
        if (personalCodeRow.used_at) {
          return Response.json({ error: 'Ten kod został już wykorzystany.' }, { status: 400 });
        }
        if (personalCodeRow.expires_at && today > personalCodeRow.expires_at) {
          return Response.json({ error: 'Kod stracił ważność.' }, { status: 400 });
        }
        if (personalCodeRow.customer_email.toLowerCase() !== body.customerEmail.toLowerCase()) {
          return Response.json({ error: 'Ten kod jest przypisany do innego adresu email.' }, { status: 400 });
        }
        discount = {
          pct: personalCodeRow.pct ?? undefined,
          fixed: personalCodeRow.fixed_gr ?? undefined,
          singleUse: true,
        };
      }
    }

    // singleUse - kod ważny tylko do pierwszego udanego zakupu (statyczne DISCOUNTS).
    // Personal codes maja wlasny mechanizm (used_at sprawdzane wyzej).
    if (discount?.singleUse && !personalCodeRow) {
      const used = await ctx.env.DB.prepare(
        `SELECT 1 FROM orders WHERE discount_code = ? AND status IN ('paid','processing') LIMIT 1`,
      ).bind(normalizedCode).first();
      if (used) {
        return Response.json({ error: 'Ten kod został już wykorzystany.' }, { status: 400 });
      }
    }
    let totalAmount: number;
    if (discount?.fixed) {
      totalAmount = Math.max(200, baseAmount - discount.fixed); // Stripe min 2 PLN
    } else if (discount?.pct) {
      totalAmount = Math.round(baseAmount * (100 - discount.pct) / 100);
    } else {
      totalAmount = baseAmount;
    }
    const appliedDiscountCode = discount ? normalizedCode : null;

    // Create order in D1
    const orderId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();

    await ctx.env.DB.prepare(`
      INSERT INTO orders (id, voucher_code, package_id, video_addon, customer_name, customer_email, customer_nip, amount, status, created_at, expires_at, discount_code, recipient_name, dedication, send_at, addons)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', datetime('now'), ?, ?, ?, ?, ?, ?)
    `).bind(
      orderId, voucherCode, body.packageId,
      videoAddonFinal ? 1 : 0,
      body.customerName, body.customerEmail, body.customerNip || null,
      totalAmount, expiresAt, appliedDiscountCode,
      recipientName, dedication, sendAt,
      validatedAddons.length > 0 ? JSON.stringify(validatedAddons) : null,
    ).run();

    // Create Stripe Checkout session via fetch
    const lineItems: Array<Record<string, unknown>> = [];

    if (discount) {
      // Single line item with total after discount, simpler display, avoids negative line_items (unsupported).
      const parts = [`Voucher "${pkg.name}", lot akrobacyjny Extra 300L`];
      for (const id of validatedAddons) {
        const a = ADDONS[id];
        if (a) parts.push(`+ ${a.name}`);
      }
      const discountDesc = discount.fixed
        ? `rabat ${discount.fixed / 100} PLN kod ${appliedDiscountCode}`
        : `rabat ${discount.pct}% kod ${appliedDiscountCode}`;
      parts.push(`(${discountDesc})`);
      lineItems.push({
        price_data: {
          currency: 'pln',
          product_data: { name: parts.join(' ') },
          unit_amount: totalAmount,
        },
        quantity: 1,
      });
    } else {
      lineItems.push({
        price_data: {
          currency: 'pln',
          product_data: { name: `Voucher "${pkg.name}", lot akrobacyjny Extra 300L` },
          unit_amount: pkg.price,
        },
        quantity: 1,
      });

      for (const id of validatedAddons) {
        const a = ADDONS[id];
        if (!a) continue;
        lineItems.push({
          price_data: {
            currency: 'pln',
            product_data: { name: a.name },
            unit_amount: a.price,
          },
          quantity: 1,
        });
      }
    }

    const params = new URLSearchParams();
    params.append('mode', 'payment');
    params.append('customer_email', body.customerEmail);
    params.append('metadata[order_id]', orderId);
    params.append('metadata[voucher_code]', voucherCode);
    // Propagate IDs to the payment_intent so charge.refunded events (which only carry
    // the payment_intent's metadata, not the session's) can be matched back to the order.
    params.append('payment_intent_data[metadata][order_id]', orderId);
    params.append('payment_intent_data[metadata][voucher_code]', voucherCode);
    const siteUrl = ctx.env.SITE_URL || 'https://akrobacja.com';
    params.append('success_url', `${siteUrl}/sukces?code=${voucherCode}&pkg=${body.packageId}&amount=${totalAmount / 100}`);
    const cancelPath = CANCEL_URLS[body.source || ''] || '/voucher-prezent';
    params.append('cancel_url', `${siteUrl}${cancelPath}`);
    params.append('locale', 'pl');
    // Keep card/P24/BLIK explicit - Stripe Dashboard activation of P24/BLIK is per-account,
    // not guaranteed for new accounts, and we don't want to silently drop Polish payment
    // methods our customers actually use. Apple Pay / Google Pay piggyback on the 'card'
    // method on supported devices, so the conversion win is preserved.
    params.append('payment_method_types[0]', 'card');
    params.append('payment_method_types[1]', 'p24');
    params.append('payment_method_types[2]', 'blik');

    lineItems.forEach((item, i) => {
      const pd = item.price_data as Record<string, unknown>;
      const prodData = pd.product_data as Record<string, string>;
      params.append(`line_items[${i}][price_data][currency]`, pd.currency as string);
      params.append(`line_items[${i}][price_data][product_data][name]`, prodData.name);
      params.append(`line_items[${i}][price_data][unit_amount]`, String(pd.unit_amount));
      params.append(`line_items[${i}][quantity]`, String(item.quantity));
    });

    const stripeRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ctx.env.STRIPE_SECRET_KEY.replace(/\s/g, '')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
      signal: AbortSignal.timeout(10000),
    });

    const session = (await stripeRes.json()) as { id?: string; url?: string; error?: { message?: string } };

    if (!stripeRes.ok || !session.url) {
      // Oznacz order jako failed - inaczej zostaje 'pending' i łapie się do abandoned-cart.
      await ctx.env.DB.prepare(
        "UPDATE orders SET status = 'failed' WHERE id = ? AND status = 'pending'"
      ).bind(orderId).run();
      return Response.json({ error: session.error?.message || 'Stripe error' }, { status: 500 });
    }

    // Save stripe session id
    await ctx.env.DB.prepare(
      'UPDATE orders SET stripe_session_id = ? WHERE id = ?'
    ).bind(session.id, orderId).run();

    return Response.json({ url: session.url });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return Response.json({ error: message }, { status: 500 });
  }
};
