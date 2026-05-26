import { type Env } from './types';

const PRINTFUL_API = 'https://api.printful.com';

interface PrintfulData {
  store_product_id: number;
  variants: Record<string, number>; // size label -> Printful variant_id; use "" key for no-size products
}

async function pf(env: Env, method: string, path: string, body?: unknown): Promise<unknown> {
  const token = (env.PRINTFUL_TOKEN || '').replace(/\s/g, '');
  const res = await fetch(`${PRINTFUL_API}${path}`, {
    method,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = (await res.json()) as { code: number; result: unknown; error?: { message?: string } };
  if (data.code !== 200) {
    throw new Error(`Printful error ${data.code}: ${data.error?.message || 'Unknown'}`);
  }
  return data.result;
}

async function loadPrintfulData(env: Env, productIds: string[]): Promise<Map<string, PrintfulData>> {
  const placeholders = productIds.map(() => '?').join(',');
  const { results } = await env.DB.prepare(
    `SELECT id, printful_data FROM products WHERE id IN (${placeholders}) AND printful_data IS NOT NULL`
  ).bind(...productIds).all<{ id: string; printful_data: string }>();

  return new Map(results.map(r => [r.id, JSON.parse(r.printful_data) as PrintfulData]));
}

// Create order in Printful when merch order is paid.
// Returns Printful order ID or null if no products have printful_data configured yet.
export async function createPrintfulOrder(env: Env, order: {
  id: string;
  customer_name: string;
  customer_email: string;
  shipping_address: string;
  shipping_city: string;
  shipping_zip: string;
  items: Array<{ product_id: string; name: string; variant?: string; quantity: number }>;
}): Promise<string | null> {
  const productIds = [...new Set(order.items.map(i => i.product_id))];
  const pfMap = await loadPrintfulData(env, productIds);
  if (pfMap.size === 0) return null;

  const nameParts = order.customer_name.split(' ');
  const firstName = nameParts[0] || '';
  const lastName = nameParts.slice(1).join(' ') || '';

  const items = order.items
    .filter(item => pfMap.has(item.product_id))
    .map(item => {
      const data = pfMap.get(item.product_id)!;
      const variantId = item.variant
        ? data.variants[item.variant]
        : (data.variants[''] ?? Object.values(data.variants)[0]);
      return { variant_id: variantId, quantity: item.quantity };
    })
    .filter(i => i.variant_id);

  if (items.length === 0) return null;

  const result = (await pf(env, 'POST', '/orders', {
    external_id: order.id,
    recipient: {
      name: order.customer_name,
      first_name: firstName,
      last_name: lastName,
      address1: order.shipping_address,
      city: order.shipping_city,
      zip: order.shipping_zip,
      country_code: 'PL',
      email: order.customer_email,
    },
    items,
  })) as { id: number };

  return String(result.id);
}

// Confirm (pay for) a Printful order - sends to production
export async function confirmPrintfulOrder(env: Env, printfulOrderId: string): Promise<void> {
  await pf(env, 'POST', `/orders/${printfulOrderId}/confirm`);
}

// List all products in the connected Printful store (for admin mapping setup)
export async function listPrintfulStoreProducts(env: Env): Promise<unknown[]> {
  const result = await pf(env, 'GET', '/store/products?limit=100');
  return Array.isArray(result) ? result : [];
}

// Get full variant list for a Printful store product
export async function getPrintfulStoreProduct(env: Env, storeProductId: number): Promise<unknown> {
  return pf(env, 'GET', `/store/products/${storeProductId}`);
}
