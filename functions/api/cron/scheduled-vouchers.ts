// Scheduled voucher email delivery.
//
// Kontekst: kupujący zaplanował wysyłkę vouchera prezentowego na konkretną datę
// (np. dzień urodzin obdarowanego). Webhook po opłacie generuje PDF + wrzuca do R2,
// ale POMIJA sendVoucherEmail jeśli order.send_at jest w przyszłości. Ten cron
// przelatuje co godzinę i wysyła zaplanowane maile gdy nadejdzie ich termin.
//
// Cron: wywoływać co 1h (zewnętrzny scheduler — GH Actions / cron-job.org / CF Worker
// cron-trigger). Nagłówek `Authorization: Bearer ${CRON_SECRET}` jeśli CRON_SECRET
// jest ustawiony. POST i GET działają identycznie (flexibility dla różnych schedulerów).
//
// Idempotency: email_sent_at IS NULL w WHERE + UPDATE po każdej wysyłce. Limit 50
// per-run żeby nie zablokować Resend rate-limit przy backfillu.

import { type Env, type PackageId, PACKAGES } from '../../../src/lib/types';
import { sendVoucherEmail } from '../../../src/lib/email';

interface ScheduledRow {
  id: string;
  voucher_code: string;
  package_id: string;
  customer_name: string;
  customer_email: string;
  recipient_name: string | null;
  send_at: string;
}

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  if (ctx.env.CRON_SECRET) {
    const auth = ctx.request.headers.get('Authorization') || '';
    if (auth !== `Bearer ${ctx.env.CRON_SECRET}`) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  let sent = 0;
  let failed = 0;
  const results: Array<{ order: string; voucher: string; status: string }> = [];

  try {
    const rows = await ctx.env.DB.prepare(`
      SELECT id, voucher_code, package_id, customer_name, customer_email, recipient_name, send_at
      FROM orders
      WHERE status = 'paid'
        AND send_at IS NOT NULL
        AND send_at <= datetime('now')
        AND email_sent_at IS NULL
        AND customer_email IS NOT NULL
        AND customer_email != ''
      LIMIT 50
    `).all<ScheduledRow>();

    if (!rows.results || rows.results.length === 0) {
      return Response.json({ ok: true, sent: 0, failed: 0, timestamp: new Date().toISOString() });
    }

    const siteUrl = ctx.env.SITE_URL || 'https://akrobacja.com';

    for (const row of rows.results) {
      const pkg = PACKAGES[row.package_id as PackageId];
      if (!pkg) {
        failed++;
        results.push({ order: row.id, voucher: row.voucher_code, status: `skipped: unknown package ${row.package_id}` });
        continue;
      }

      try {
        // Pobierz PDF z R2 — webhook już go tam wrzucił przy paid.
        const obj = await ctx.env.VOUCHER_BUCKET.get(`vouchers/${row.voucher_code}.pdf`);
        if (!obj) {
          failed++;
          results.push({ order: row.id, voucher: row.voucher_code, status: 'pdf_missing_in_r2' });
          continue;
        }
        const pdfBytes = new Uint8Array(await obj.arrayBuffer());

        // W mailu używamy customer_name (kupujący widzi "Cześć Marta!"), nie recipient_name —
        // mail leci na customer_email (chyba że kupujący podał maila obdarowanego).
        await sendVoucherEmail(ctx.env, {
          to: row.customer_email,
          customerName: row.customer_name,
          voucherCode: row.voucher_code,
          packageId: row.package_id as PackageId,
          pdfBytes,
          siteUrl,
        });

        // Atomic guard — UPDATE only sets email_sent_at jeśli jeszcze NULL (defense in depth).
        await ctx.env.DB.prepare(
          `UPDATE orders SET email_sent_at = datetime('now') WHERE id = ? AND email_sent_at IS NULL`
        ).bind(row.id).run();

        sent++;
        results.push({ order: row.id, voucher: row.voucher_code, status: 'sent' });
      } catch (err) {
        failed++;
        const msg = err instanceof Error ? err.message : 'unknown';
        results.push({ order: row.id, voucher: row.voucher_code, status: `error: ${msg}` });
        console.error(`scheduled-voucher send failed for ${row.voucher_code}:`, err);
      }
    }

    return Response.json({
      ok: true,
      sent,
      failed,
      results,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : 'Unknown error', sent, failed, results },
      { status: 500 },
    );
  }
};

export const onRequestGet = onRequestPost;
