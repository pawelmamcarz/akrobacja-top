import { type Env } from './types';

const PRINTFUL_API = 'https://api.printful.com';

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

// Product mapping: our product IDs -> Printful catalog variant IDs
// These need to be set up after uploading designs to Printful
export const PRINTFUL_PRODUCTS: Record<string, {
  printful_product_id: number;
  variant_map: Record<string, number>; // size -> printful variant ID
  placement: string;
}> = {
  // Will be populated after product setup
};

// Create order in Printful when merch order is paid
export async function createPrintfulOrder(env: Env, order: {
  id: string;
  customer_name: string;
  customer_email: string;
  shipping_address: string;
  shipping_city: string;
  shipping_zip: string;
  items: Array<{ product_id: string; name: string; variant?: string; quantity: number }>;
}): Promise<string> {
  const nameParts = order.customer_name.split(' ');
  const firstName = nameParts[0] || '';
  const lastName = nameParts.slice(1).join(' ') || '';

  const items = order.items
    .filter(item => PRINTFUL_PRODUCTS[item.product_id])
    .map(item => {
      const pf = PRINTFUL_PRODUCTS[item.product_id];
      const variantId = item.variant ? pf.variant_map[item.variant] : Object.values(pf.variant_map)[0];
      return {
        variant_id: variantId,
        quantity: item.quantity,
        // Files will be pre-configured in Printful store products
      };
    });

  if (items.length === 0) {
    throw new Error('No Printful-eligible items in order');
  }

  const result = (await pf(env, 'POST', '/orders', {
    external_id: order.id,
    recipient: {
      name: order.customer_name,
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

// Confirm (pay for) a Printful order — sends to production
export async function confirmPrintfulOrder(env: Env, printfulOrderId: string): Promise<void> {
  await pf(env, 'POST', `/orders/${printfulOrderId}/confirm`);
}

// Get catalog product details (for mockup URLs)
export async function getCatalogProduct(env: Env, productId: number): Promise<unknown> {
  return pf(env, 'GET', `/catalog/products/${productId}`);
}
