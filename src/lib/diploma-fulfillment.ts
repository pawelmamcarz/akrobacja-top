import { type Env, type PackageId, PACKAGES } from './types';
import { generateDiplomaPdf } from './diploma-pdf';
import { sendDiplomaEmail } from './email';

interface DiplomaOrderRow {
  voucher_code: string;
  package_id: string;
  customer_name: string;
  customer_email: string;
  recipient_name: string | null;
  redeemed_at: string | null;
  status: string;
  diploma_sent_at: string | null;
}

// Generuje dyplom uczestnika -> R2 (diplomas/{code}.pdf) -> mail do klienta -> stempel
// diploma_sent_at. Best-effort: zwraca {ok:false,error} zamiast rzucac, zeby nie
// blokowac flow 'Wykorzystaj'. force=true pozwala na regeneracje juz wyslanego dyplomu.
export async function fulfillDiploma(
  env: Env,
  voucherCode: string,
  opts: { force?: boolean } = {},
): Promise<{ ok: boolean; error?: string }> {
  try {
    const order = await env.DB.prepare(
      `SELECT voucher_code, package_id, customer_name, customer_email, recipient_name,
              redeemed_at, status, diploma_sent_at
       FROM orders WHERE voucher_code = ?`,
    ).bind(voucherCode).first<DiplomaOrderRow>();

    if (!order) return { ok: false, error: 'Voucher nie znaleziony' };
    if (order.status !== 'paid') return { ok: false, error: 'Voucher nie jest oplacony' };
    if (!order.redeemed_at) return { ok: false, error: 'Lot nie jest oznaczony jako zrealizowany' };
    if (!(order.package_id in PACKAGES)) return { ok: false, error: `Nieznany pakiet: ${order.package_id}` };
    if (order.diploma_sent_at && !opts.force) return { ok: true }; // juz wyslany, idempotentnie

    // Pilot prowadzacy - best-effort join przez rezerwacje -> event -> pilot.
    // Domyslnie Maciej Kulaszewski (mistrz za sterami = USP); inny pilot -> neutralny tytul.
    let pilotName: string | undefined;
    let pilotTitle: string | undefined;
    try {
      const p = await env.DB.prepare(
        `SELECT p.name AS name FROM bookings b
         JOIN calendar_events ce ON ce.booking_id = b.id
         JOIN pilots p ON p.id = ce.pilot_id
         WHERE b.voucher_code = ? AND p.name IS NOT NULL AND TRIM(p.name) <> ''
         LIMIT 1`,
      ).bind(voucherCode).first<{ name: string }>();
      if (p?.name && !p.name.includes('Maciej')) {
        pilotName = p.name;
        pilotTitle = 'Pilot instruktor akrobacji';
      }
    } catch { /* brak joinu - default Maciej */ }

    const participantName = order.recipient_name?.trim() || order.customer_name;
    const pdfBytes = await generateDiplomaPdf({
      participantName,
      packageId: order.package_id as PackageId,
      flightDate: order.redeemed_at,
      voucherCode: order.voucher_code,
      pilotName,
      pilotTitle,
    });

    await env.VOUCHER_BUCKET.put(`diplomas/${voucherCode}.pdf`, pdfBytes, {
      httpMetadata: { contentType: 'application/pdf' },
    });

    if (order.customer_email) {
      await sendDiplomaEmail(env, {
        to: order.customer_email,
        participantName,
        voucherCode: order.voucher_code,
        packageId: order.package_id as PackageId,
        pdfBytes,
      });
    }

    await env.DB.prepare(
      "UPDATE orders SET diploma_sent_at = datetime('now') WHERE voucher_code = ?",
    ).bind(voucherCode).run();

    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
