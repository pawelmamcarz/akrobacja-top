import { type Env } from './types';

// Channels supported by the failed_deliveries audit table (matches the migration
// comment). Keep these strings stable — the admin view groups by exact match.
export type DeliveryChannel =
  | 'voucher_email'
  | 'owner_notify'
  | 'sms'
  | 'wfirma_invoice'
  | 'meta_capi'
  | 'abandoned_email'
  | 'welcome_email'
  | 'scheduled_voucher_email'
  | 'merch_owner_notify';

interface AuditOpts {
  channel: DeliveryChannel;
  refId?: string | null;
  recipient?: string | null;
  error: unknown;
}

// Best-effort insert into failed_deliveries. Never throws — this is itself an
// error path and we don't want a bad audit write to break the calling handler.
export async function recordFailedDelivery(env: Env, opts: AuditOpts): Promise<void> {
  try {
    const msg = opts.error instanceof Error ? opts.error.message : String(opts.error);
    await env.DB.prepare(
      `INSERT INTO failed_deliveries (id, channel, ref_id, recipient, error_message)
       VALUES (?, ?, ?, ?, ?)`
    ).bind(
      crypto.randomUUID(),
      opts.channel,
      opts.refId || null,
      opts.recipient || null,
      msg.slice(0, 1000), // cap to keep the column reasonable
    ).run();
  } catch (err) {
    console.error('[audit] failed to record failed_delivery:', err);
  }
}
