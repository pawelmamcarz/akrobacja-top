import { type Env } from './types';

const BL_URL = 'https://api.baselinker.com/connector.php';

async function bl(env: Env, method: string, params: Record<string, unknown>): Promise<unknown> {
  const token = (env.BASELINKER_TOKEN || '').trim();
  if (!token) throw new Error('BASELINKER_TOKEN not configured');

  const body = new URLSearchParams({
    method,
    parameters: JSON.stringify(params),
  });

  const res = await fetch(BL_URL, {
    method: 'POST',
    headers: {
      'X-BLToken': token,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });

  const data = (await res.json()) as { status: string; order_id?: number; error_message?: string };
  if (data.status !== 'SUCCESS') {
    throw new Error(`BaseLinker error: ${data.error_message || 'Unknown'}`);
  }
  return data;
}

// Create order in BaseLinker → routed to Snapwear via native BL integration.
// Returns BaseLinker order_id or null if token not configured.
export async function createBaseLinkerOrder(env: Env, order: {
  id: string;
  customer_name: string;
  customer_email: string;
  customer_phone?: string;
  shipping_address: string;
  shipping_city: string;
  shipping_zip: string;
  items: Array<{ product_id: string; name: string; variant?: string; quantity: number; price: number }>;
}): Promise<number | null> {
  if (!env.BASELINKER_TOKEN) return null;

  const statusId = parseInt(env.BASELINKER_STATUS_ID || '0', 10);

  const nameParts = order.customer_name.trim().split(' ');
  const firstName = nameParts[0] || '';
  const lastName = nameParts.slice(1).join(' ') || '';

  const products = order.items.map(item => ({
    storage: 'db',
    storage_id: 0,
    product_id: '',
    variant_id: '',
    name: item.variant ? `${item.name} — ${item.variant}` : item.name,
    sku: item.product_id,
    ean: '',
    location: '',
    attributes: item.variant || '',
    price_brutto: item.price / 100,
    tax_rate: 23,
    quantity: item.quantity,
    weight: 0,
  }));

  const result = (await bl(env, 'addOrder', {
    order_status_id: statusId,
    date_add: Math.floor(Date.now() / 1000),
    currency: 'PLN',
    payment_method: 'Stripe (karta/BLIK/P24)',
    payment_method_cod: false,
    paid: true,
    email: order.customer_email,
    phone: order.customer_phone || '',
    user_comments: `Zamówienie ${order.id}`,
    delivery_method: 'Kurier',
    delivery_price: 0,
    delivery_fullname: `${firstName} ${lastName}`.trim(),
    delivery_address: order.shipping_address,
    delivery_postcode: order.shipping_zip,
    delivery_city: order.shipping_city,
    delivery_country_code: 'PL',
    products,
  })) as { order_id: number };

  return result.order_id;
}
