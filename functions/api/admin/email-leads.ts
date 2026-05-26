// GET /api/admin/email-leads
// Zwraca liste zapisanych na lead magnet email newsletter (PDF "Przewodnik
// po locie akrobacyjnym") + ile krokow nurture sequence juz wyslane.

import { type Env } from '../../../src/lib/types';
import { checkAdminAuthAsync } from '../../../src/lib/admin-auth';

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  if (!(await checkAdminAuthAsync(ctx.request, ctx.env))) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { results } = await ctx.env.DB.prepare(`
    SELECT
      el.id, el.email, el.name, el.source, el.active,
      el.utm_source, el.utm_medium, el.utm_campaign,
      el.created_at,
      COALESCE(COUNT(les.id), 0) AS steps_sent,
      MAX(les.sent_at) AS last_sent_at
    FROM email_leads el
    LEFT JOIN lead_emails_sent les ON les.lead_id = el.id
    GROUP BY el.id
    ORDER BY el.created_at DESC
    LIMIT 500
  `).all();

  return Response.json({ leads: results });
};
