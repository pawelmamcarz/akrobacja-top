import { type Env } from '../../../src/lib/types';
import { checkAdminAuthAsync } from '../../../src/lib/admin-auth';
import { listPrintfulStoreProducts } from '../../../src/lib/printful';
import { createApaczkaOrder, getApaczkaWaybill, listApaczkaServices } from '../../../src/lib/apaczka';

interface MerchBody {
  action?: string;
  id?: string;
  tracking?: string;
  name?: string;
  slug?: string;
  category?: string;
  description?: string;
  price?: number;
  image_url?: string;
  variants?: string;
  sort_order?: number;
  printful_data?: string; // JSON: {store_product_id, variants:{size->id}}
  weight_g?: number;      // generate_label: waga paczki (gramy), domyślnie 1000
}

interface MerchOrderRow {
  status: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string | null;
  shipping_address: string | null;
  shipping_city: string | null;
  shipping_zip: string | null;
  delivery_method: string | null;
  inpost_point_code: string | null;
  apaczka_order_id: string | null;
}

// GET /api/admin/merch - list merch orders
export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  if (!(await checkAdminAuthAsync(ctx.request, ctx.env))) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { results: orders } = await ctx.env.DB.prepare(
    'SELECT * FROM merch_orders ORDER BY created_at DESC LIMIT 100'
  ).all();

  const { results: products } = await ctx.env.DB.prepare(
    'SELECT * FROM products ORDER BY sort_order'
  ).all();

  return Response.json({ orders, products });
};

// POST /api/admin/merch - manage merch orders
export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  if (!(await checkAdminAuthAsync(ctx.request, ctx.env))) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await ctx.request.json()) as MerchBody;

  switch (body.action) {
    case 'mark_paid': {
      if (typeof body.id !== 'string' || !body.id) {
        return Response.json({ error: 'Pole "id" wymagane' }, { status: 400 });
      }
      await ctx.env.DB.prepare(
        "UPDATE merch_orders SET status = 'paid', paid_at = datetime('now') WHERE id = ?"
      ).bind(body.id).run();
      return Response.json({ ok: true });
    }
    case 'mark_shipped': {
      if (typeof body.id !== 'string' || !body.id) {
        return Response.json({ error: 'Pole "id" wymagane' }, { status: 400 });
      }
      await ctx.env.DB.prepare(
        "UPDATE merch_orders SET status = 'shipped', shipped_at = datetime('now'), tracking_number = ? WHERE id = ?"
      ).bind(body.tracking || null, body.id).run();
      return Response.json({ ok: true });
    }
    case 'generate_label': {
      if (typeof body.id !== 'string' || !body.id) {
        return Response.json({ error: 'Pole "id" wymagane' }, { status: 400 });
      }
      if (body.weight_g !== undefined && (!Number.isFinite(body.weight_g) || body.weight_g < 100 || body.weight_g > 30000)) {
        return Response.json({ error: 'Waga musi być w zakresie 100–30000 g' }, { status: 400 });
      }
      const order = await ctx.env.DB.prepare(
        `SELECT status, customer_name, customer_email, customer_phone,
                shipping_address, shipping_city, shipping_zip,
                delivery_method, inpost_point_code, apaczka_order_id
         FROM merch_orders WHERE id = ?`
      ).bind(body.id).first<MerchOrderRow>();
      if (!order) return Response.json({ error: 'Zamówienie nie znalezione' }, { status: 404 });
      if (order.apaczka_order_id) {
        return Response.json({ error: 'Etykieta już wygenerowana dla tego zamówienia' }, { status: 409 });
      }
      if (order.status !== 'paid') {
        return Response.json({ error: `Etykietę można wygenerować tylko dla zamówienia opłaconego (status: ${order.status})` }, { status: 400 });
      }

      const weightG = body.weight_g ?? 1000;
      const deliveryMethod = order.delivery_method === 'inpost_locker' ? 'inpost_locker' : 'courier';

      let apaczkaOrderId: string;
      let waybillNumber: string | null;
      let pdf: ArrayBuffer;
      try {
        const created = await createApaczkaOrder(ctx.env, {
          receiver: {
            name: order.customer_name,
            line1: order.shipping_address || '',
            postalCode: order.shipping_zip || '',
            city: order.shipping_city || '',
            phone: order.customer_phone || '',
            email: order.customer_email,
          },
          deliveryMethod,
          inpostPointCode: order.inpost_point_code,
          weightG,
        });
        apaczkaOrderId = created.apaczkaOrderId;
        waybillNumber = created.waybillNumber;
        pdf = await getApaczkaWaybill(ctx.env, apaczkaOrderId);
      } catch (err) {
        return Response.json({ error: err instanceof Error ? err.message : 'Błąd apaczka' }, { status: 502 });
      }

      const r2Key = `labels/merch/${body.id}.pdf`;
      await ctx.env.VOUCHER_BUCKET.put(r2Key, pdf, { httpMetadata: { contentType: 'application/pdf' } });

      // Guard przed dublem: zapisujemy tylko gdy apaczka_order_id jeszcze nie ustawione.
      await ctx.env.DB.prepare(
        `UPDATE merch_orders
         SET apaczka_order_id = ?, tracking_number = ?, apaczka_label_r2_key = ?,
             parcel_weight_g = ?, status = 'shipped', shipped_at = datetime('now')
         WHERE id = ? AND apaczka_order_id IS NULL`
      ).bind(apaczkaOrderId, waybillNumber, r2Key, weightG, body.id).run();

      return Response.json({ ok: true, tracking_number: waybillNumber, label_url: `/api/admin/merch/label/${body.id}` });
    }
    case 'mark_completed': {
      if (typeof body.id !== 'string' || !body.id) {
        return Response.json({ error: 'Pole "id" wymagane' }, { status: 400 });
      }
      await ctx.env.DB.prepare(
        "UPDATE merch_orders SET status = 'completed' WHERE id = ?"
      ).bind(body.id).run();
      return Response.json({ ok: true });
    }
    case 'cancel': {
      if (typeof body.id !== 'string' || !body.id) {
        return Response.json({ error: 'Pole "id" wymagane' }, { status: 400 });
      }
      await ctx.env.DB.prepare(
        "UPDATE merch_orders SET status = 'cancelled' WHERE id = ?"
      ).bind(body.id).run();
      return Response.json({ ok: true });
    }

    case 'create_product': {
      if (typeof body.name !== 'string' || !body.name) {
        return Response.json({ error: 'Podaj nazwę' }, { status: 400 });
      }
      if (typeof body.price !== 'number') {
        return Response.json({ error: 'Podaj cenę (w groszach) jako liczbę' }, { status: 400 });
      }
      if (body.sort_order !== undefined && typeof body.sort_order !== 'number') {
        return Response.json({ error: 'Pole "sort_order" musi być liczbą' }, { status: 400 });
      }
      const id = body.id || crypto.randomUUID();
      const slug = body.slug || body.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const variants = body.variants ? body.variants : '[]';
      try { JSON.parse(variants); } catch { return Response.json({ error: 'variants musi być JSON tablicą' }, { status: 400 }); }
      await ctx.env.DB.prepare(
        `INSERT INTO products (id, name, slug, category, description, price, image_url, variants, active, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`
      ).bind(
        id,
        body.name,
        slug,
        body.category || null,
        body.description || null,
        body.price,
        body.image_url || null,
        variants,
        body.sort_order ?? 100,
      ).run();
      return Response.json({ ok: true, id, slug });
    }

    case 'toggle_product_active': {
      if (typeof body.id !== 'string' || !body.id) return Response.json({ error: 'Podaj id produktu' }, { status: 400 });
      await ctx.env.DB.prepare(
        'UPDATE products SET active = CASE active WHEN 1 THEN 0 ELSE 1 END WHERE id = ?'
      ).bind(body.id).run();
      return Response.json({ ok: true });
    }

    case 'delete_product': {
      if (typeof body.id !== 'string' || !body.id) return Response.json({ error: 'Podaj id produktu' }, { status: 400 });
      await ctx.env.DB.prepare('DELETE FROM products WHERE id = ?').bind(body.id).run();
      return Response.json({ ok: true });
    }

    case 'set_printful_data': {
      if (typeof body.id !== 'string' || !body.id) return Response.json({ error: 'Podaj id produktu' }, { status: 400 });
      if (typeof body.printful_data !== 'string') return Response.json({ error: 'Podaj printful_data jako JSON string' }, { status: 400 });
      try { JSON.parse(body.printful_data); } catch { return Response.json({ error: 'printful_data musi być poprawnym JSON' }, { status: 400 }); }
      await ctx.env.DB.prepare('UPDATE products SET printful_data = ? WHERE id = ?').bind(body.printful_data, body.id).run();
      return Response.json({ ok: true });
    }

    case 'list_printful_products': {
      const products = await listPrintfulStoreProducts(ctx.env);
      return Response.json({ products });
    }

    case 'apaczka_services': {
      // Narzędzie odkrywcze: listuje service_id z apaczka do konfiguracji
      // APACZKA_SERVICE_ID_COURIER / _INPOST w wrangler.jsonc.
      try {
        const services = await listApaczkaServices(ctx.env);
        return Response.json({ ok: true, services });
      } catch (err) {
        return Response.json({ error: err instanceof Error ? err.message : 'Błąd apaczka' }, { status: 502 });
      }
    }

    default:
      return Response.json({ error: 'Nieznana akcja' }, { status: 400 });
  }
};
