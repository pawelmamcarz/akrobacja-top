import { type Env } from '../../../src/lib/types';

interface MerchCheckoutBody {
  items: Array<{ product_id: string; variant?: string; quantity: number }>;
  customer_name: string;
  customer_email: string;
  customer_phone?: string;
  shipping_address: string;
  shipping_city: string;
  shipping_zip: string;
}

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  try {
    const body = (await ctx.request.json()) as MerchCheckoutBody;

    if (!body.items?.length) return Response.json({ error: 'Koszyk jest pusty' }, { status: 400 });
    if (!body.customer_name || !body.customer_email) return Response.json({ error: 'Imie i email wymagane' }, { status: 400 });
    if (!body.shipping_address || !body.shipping_city || !body.shipping_zip) return Response.json({ error: 'Adres dostawy wymagany' }, { status: 400 });

    // Fetch products and calculate total
    const productIds = body.items.map(i => i.product_id);
    const placeholders = productIds.map(() => '?').join(',');
    const { results: products } = await ctx.env.DB.prepare(
      `SELECT id, name, price, variants FROM products WHERE id IN (${placeholders}) AND active = 1`
    ).bind(...productIds).all<{ id: string; name: string; price: number; variants: string }>();

    const productMap = new Map(products.map(p => [p.id, p]));

    let totalAmount = 0;
    const lineItems: Array<Record<string, unknown>> = [];
    const orderItems: Array<Record<string, unknown>> = [];

    for (const item of body.items) {
      const product = productMap.get(item.product_id);
      if (!product) return Response.json({ error: `Produkt ${item.product_id} nie znaleziony` }, { status: 400 });

      const variants = JSON.parse(product.variants || '[]') as string[];
      if (variants.length > 0 && (!item.variant || !variants.includes(item.variant))) {
        return Response.json({ error: `Wybierz rozmiar dla ${product.name}` }, { status: 400 });
      }

      const subtotal = product.price * item.quantity;
      totalAmount += subtotal;

      const itemName = item.variant ? `${product.name} (${item.variant})` : product.name;
      orderItems.push({ product_id: product.id, name: itemName, variant: item.variant, quantity: item.quantity, price: product.price });

      lineItems.push({
        product_id: product.id,
        name: itemName,
        price: product.price,
        quantity: item.quantity,
      });
    }

    // Add shipping (flat rate 15 PLN, free over 200 PLN)
    const shippingCost = totalAmount >= 20000 ? 0 : 1500;
    totalAmount += shippingCost;

    // Create order in DB
    const orderId = crypto.randomUUID();
    await ctx.env.DB.prepare(`
      INSERT INTO merch_orders (id, customer_name, customer_email, customer_phone, shipping_address, shipping_city, shipping_zip, items, total_amount, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
    `).bind(
      orderId, body.customer_name, body.customer_email, body.customer_phone || null,
      body.shipping_address, body.shipping_city, body.shipping_zip,
      JSON.stringify(orderItems), totalAmount,
    ).run();

    // Create Stripe Checkout
    const params = new URLSearchParams();
    params.append('mode', 'payment');
    params.append('customer_email', body.customer_email);
    params.append('metadata[merch_order_id]', orderId);
    params.append('success_url', `${ctx.env.SITE_URL || 'https://akrobacja.com'}/sklep-merch?success=1&order=${orderId}`);
    params.append('cancel_url', `${ctx.env.SITE_URL || 'https://akrobacja.com'}/sklep-merch`);
    params.append('locale', 'pl');
    params.append('payment_method_types[0]', 'card');
    params.append('payment_method_types[1]', 'p24');
    params.append('payment_method_types[2]', 'blik');

    lineItems.forEach((item, i) => {
      params.append(`line_items[${i}][price_data][currency]`, 'pln');
      params.append(`line_items[${i}][price_data][product_data][name]`, item.name as string);
      params.append(`line_items[${i}][price_data][unit_amount]`, String(item.price));
      params.append(`line_items[${i}][quantity]`, String(item.quantity));
    });

    if (shippingCost > 0) {
      const si = lineItems.length;
      params.append(`line_items[${si}][price_data][currency]`, 'pln');
      params.append(`line_items[${si}][price_data][product_data][name]`, 'Dostawa');
      params.append(`line_items[${si}][price_data][unit_amount]`, String(shippingCost));
      params.append(`line_items[${si}][quantity]`, '1');
    }

    const stripeRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${(ctx.env.STRIPE_SECRET_KEY || '').replace(/\s/g, '')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    const session = (await stripeRes.json()) as { id?: string; url?: string; error?: { message?: string } };
    if (!stripeRes.ok || !session.url) {
      return Response.json({ error: session.error?.message || 'Stripe error' }, { status: 500 });
    }

    await ctx.env.DB.prepare(
      'UPDATE merch_orders SET stripe_session_id = ? WHERE id = ?'
    ).bind(session.id, orderId).run();

    return Response.json({ url: session.url });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : 'Błąd' }, { status: 500 });
  }
};
