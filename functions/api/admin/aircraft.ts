import { type Env } from '../../../src/lib/types';

function checkAuth(request: Request, env: Env): boolean {
  const auth = request.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return false;
  return auth.slice(7) === (env.ADMIN_PASSWORD || '').replace(/\s/g, '');
}

// GET /api/admin/aircraft — get maintenance, documents, insurance pilots
export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  if (!checkAuth(ctx.request, ctx.env)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { results: maintenance } = await ctx.env.DB.prepare(
    'SELECT * FROM maintenance ORDER BY CASE status WHEN \'overdue\' THEN 0 WHEN \'upcoming\' THEN 1 WHEN \'completed\' THEN 2 END, due_date ASC'
  ).all();

  const { results: documents } = await ctx.env.DB.prepare(
    'SELECT * FROM documents ORDER BY valid_to ASC'
  ).all();

  const { results: insurancePilots } = await ctx.env.DB.prepare(`
    SELECT ip.*, p.name as pilot_name, p.phone as pilot_phone, p.email as pilot_email, p.license_type, p.license_number
    FROM insurance_pilots ip
    JOIN pilots p ON p.id = ip.pilot_id
    WHERE ip.removed_at IS NULL
    ORDER BY ip.requested_at DESC
  `).all();

  return Response.json({ maintenance, documents, insurancePilots });
};

// POST /api/admin/aircraft — manage maintenance, documents, insurance
export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  if (!checkAuth(ctx.request, ctx.env)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await ctx.request.json()) as Record<string, unknown>;

  switch (body.action) {
    // ── MAINTENANCE ──
    case 'add_maintenance': {
      const id = crypto.randomUUID();
      await ctx.env.DB.prepare(
        'INSERT INTO maintenance (id, type, description, due_date, due_hours, current_hours, notes) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).bind(id, body.type, body.description || null, body.due_date || null, body.due_hours || null, body.current_hours || null, body.notes || null).run();
      return Response.json({ ok: true, id });
    }

    case 'complete_maintenance': {
      await ctx.env.DB.prepare(
        "UPDATE maintenance SET status = 'completed', completed_at = datetime('now'), notes = COALESCE(?, notes) WHERE id = ?"
      ).bind(body.notes || null, body.id).run();
      return Response.json({ ok: true });
    }

    case 'delete_maintenance': {
      await ctx.env.DB.prepare('DELETE FROM maintenance WHERE id = ?').bind(body.id).run();
      return Response.json({ ok: true });
    }

    case 'update_hours': {
      await ctx.env.DB.prepare(
        'UPDATE maintenance SET current_hours = ? WHERE id = ?'
      ).bind(body.current_hours, body.id).run();
      return Response.json({ ok: true });
    }

    // ── DOCUMENTS ──
    case 'add_document': {
      const id = crypto.randomUUID();
      await ctx.env.DB.prepare(
        'INSERT INTO documents (id, name, type, valid_from, valid_to, notes) VALUES (?, ?, ?, ?, ?, ?)'
      ).bind(id, body.name, body.doc_type, body.valid_from || null, body.valid_to || null, body.notes || null).run();
      return Response.json({ ok: true, id });
    }

    case 'delete_document': {
      await ctx.env.DB.prepare('DELETE FROM documents WHERE id = ?').bind(body.id).run();
      return Response.json({ ok: true });
    }

    // ── INSURANCE PILOTS ──
    case 'approve_insurance': {
      await ctx.env.DB.prepare(
        "UPDATE insurance_pilots SET status = 'approved', approved_at = datetime('now') WHERE id = ?"
      ).bind(body.id).run();
      // Update pilot status
      const ip = await ctx.env.DB.prepare('SELECT pilot_id FROM insurance_pilots WHERE id = ?').bind(body.id).first<{ pilot_id: string }>();
      if (ip) await ctx.env.DB.prepare("UPDATE pilots SET insurance_status = 'approved' WHERE id = ?").bind(ip.pilot_id).run();
      return Response.json({ ok: true });
    }

    case 'reject_insurance': {
      await ctx.env.DB.prepare(
        "UPDATE insurance_pilots SET status = 'rejected' WHERE id = ?"
      ).bind(body.id).run();
      const ip2 = await ctx.env.DB.prepare('SELECT pilot_id FROM insurance_pilots WHERE id = ?').bind(body.id).first<{ pilot_id: string }>();
      if (ip2) await ctx.env.DB.prepare("UPDATE pilots SET insurance_status = 'none' WHERE id = ?").bind(ip2.pilot_id).run();
      return Response.json({ ok: true });
    }

    case 'remove_insurance': {
      await ctx.env.DB.prepare(
        "UPDATE insurance_pilots SET status = 'removed', removed_at = datetime('now') WHERE id = ?"
      ).bind(body.id).run();
      const ip3 = await ctx.env.DB.prepare('SELECT pilot_id FROM insurance_pilots WHERE id = ?').bind(body.id).first<{ pilot_id: string }>();
      if (ip3) await ctx.env.DB.prepare("UPDATE pilots SET insurance_status = 'none' WHERE id = ?").bind(ip3.pilot_id).run();
      return Response.json({ ok: true });
    }

    default:
      return Response.json({ error: 'Nieznana akcja' }, { status: 400 });
  }
};
