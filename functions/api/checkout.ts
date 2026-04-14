import { type Env, PACKAGES, VIDEO_ADDON_PRICE, type PackageId } from '../../src/lib/types';
import { generateVoucherCode } from '../../src/lib/voucher-code';

interface CheckoutBody {
  packageId: PackageId;
  videoAddon: boolean;
  customerName: string;
  customerEmail: string;
  customerNip?: string;
}

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  try {
    const body = (await ctx.request.json()) as CheckoutBody;

    const pkg = PACKAGES[body.packageId];
    if (!pkg) {
      return Response.json({ error: 'Nieprawidłowy pakiet' }, { status: 400 });
    }
    if (!body.customerName || !body.customerEmail) {
      return Response.json({ error: 'Imię i email są wymagane' }, { status: 400 });
    }

    const voucherCode = generateVoucherCode();
    const totalAmount = pkg.price + (body.videoAddon ? VIDEO_ADDON_PRICE : 0);

    // Create order in D1
    const orderId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();

    await ctx.env.DB.prepare(`
      INSERT INTO orders (id, voucher_code, package_id, video_addon, customer_name, customer_email, customer_nip, amount, status, created_at, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', datetime('now'), ?)
    `).bind(
      orderId, voucherCode, body.packageId,
      body.videoAddon ? 1 : 0,
      body.customerName, body.customerEmail, body.customerNip || null,
      totalAmount, expiresAt,
    ).run();

    // Create Stripe Checkout session via fetch
    const lineItems: Array<Record<string, unknown>> = [
      {
        price_data: {
          currency: 'pln',
          product_data: { name: `Voucher "${pkg.name}" — lot akrobacyjny Extra 300L` },
          unit_amount: pkg.price,
        },
        quantity: 1,
      },
    ];

    if (body.videoAddon) {
      lineItems.push({
        price_data: {
          currency: 'pln',
          product_data: { name: 'Video 360° z lotu akrobacyjnego' },
          unit_amount: VIDEO_ADDON_PRICE,
        },
        quantity: 1,
      });
    }

    const params = new URLSearchParams();
    params.append('mode', 'payment');
    params.append('customer_email', body.customerEmail);
    params.append('metadata[order_id]', orderId);
    params.append('metadata[voucher_code]', voucherCode);
    const siteUrl = ctx.env.SITE_URL || 'https://akrobacja.com';
    params.append('success_url', `${siteUrl}/sukces?code=${voucherCode}&pkg=${body.packageId}&amount=${totalAmount / 100}`);
    params.append('cancel_url', `${siteUrl}/#sklep`);
    params.append('locale', 'pl');
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
    });

    const session = (await stripeRes.json()) as { id?: string; url?: string; error?: { message?: string } };

    if (!stripeRes.ok || !session.url) {
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
