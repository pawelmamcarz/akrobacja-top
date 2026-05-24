import { type Env, PACKAGES, ADDONS, type PackageId } from './types';

interface InvoiceParams {
  customerName: string;
  customerEmail: string;
  customerNip?: string;
  packageId: PackageId;
  videoAddon: boolean;          // legacy — utrzymane dla starych orderów (sprzed migracji 019), ignorowane gdy `addons` zawiera 'video'
  addons?: string[];            // lista AddonId z webhook.ts (parsed JSON z orders.addons)
  voucherCode: string;
  amount: number;               // faktycznie pobrana kwota (grosze) — po rabacie
  discountCode?: string | null;
}

// wFirma API v2 — https://doc.wfirma.pl/
// Auth: Basic (login:password) + header x-company-id
export async function createInvoice(env: Env, params: InvoiceParams): Promise<string> {
  const pkg = PACKAGES[params.packageId];
  const isCompany = !!params.customerNip;
  // Nowe ordery zawsze mają addons (może być []). Stare (sprzed migracji 019) tylko videoAddon.
  // Webhook robi już ten fallback przy parsowaniu (`videoAddon ? ['video'] : []`), więc tu
  // przyjmujemy `params.addons` jako autorytatywne źródło. Fallback poniżej zostaje na wypadek
  // gdyby createInvoice było kiedyś wywołane spoza webhooka bez addons.
  const effectiveAddons: string[] = params.addons ?? (params.videoAddon ? ['video'] : []);
  const addonTotal = effectiveAddons.reduce((s, id) => s + (ADDONS[id]?.price ?? 0), 0);
  const baseAmount = pkg.price + addonTotal;
  const hasDiscount = typeof params.amount === 'number' && params.amount !== baseAmount;
  const totalBrutto = (hasDiscount ? params.amount : baseAmount) / 100;

  const items: object[] = [];

  if (hasDiscount) {
    // Jeden wiersz z kwotą po rabacie — inaczej suma linii rozjedzie się z alreadypaid.
    const parts = [`Voucher akrobacyjny "${pkg.name}" — lot Extra 300L (${pkg.duration})`];
    for (const id of effectiveAddons) {
      const a = ADDONS[id];
      if (a) parts.push(`+ ${a.invoiceName}`);
    }
    if (params.discountCode) parts.push(`(rabat: kod ${params.discountCode})`);
    items.push({
      invoicecontent: {
        name: parts.join(' '),
        unit: 'szt.',
        count: 1,
        price: totalBrutto,
        vat: '23',
      },
    });
  } else {
    items.push({
      invoicecontent: {
        name: `Voucher akrobacyjny "${pkg.name}" — lot Extra 300L (${pkg.duration})`,
        unit: 'szt.',
        count: 1,
        price: pkg.price / 100,
        vat: '23',
      },
    });
    for (const id of effectiveAddons) {
      const a = ADDONS[id];
      if (!a) continue;
      items.push({
        invoicecontent: {
          name: a.invoiceName,
          unit: 'szt.',
          count: 1,
          price: a.price / 100,
          vat: '23',
        },
      });
    }
  }

  const body = {
    invoices: [
      {
        invoice: {
          type: 'normal', // faktura VAT — dla firm (z NIP) i osób fizycznych (bez NIP)
          price_type: 'brutto',
          paymentmethod: 'transfer',
          paymentstate: 'paid',
          alreadypaid: totalBrutto.toFixed(2),
          alreadypaid_initial: totalBrutto.toFixed(2),
          paymentdate: new Date().toISOString().split('T')[0],
          disposition: params.voucherCode,
          description: `Voucher ${params.voucherCode}`,
          contractor: {
            name: params.customerName,
            email: params.customerEmail,
            zip: '00-000',
            city: 'Warszawa',
            ...(isCompany ? { nip: params.customerNip } : {}),
          },
          invoicecontents: items,
        },
      },
    ],
  };

  const accessKey = (env.WFIRMA_ACCESS_KEY || '').replace(/\s/g, '');
  const secretKey = (env.WFIRMA_SECRET_KEY || '').replace(/\s/g, '');
  const companyId = (env.WFIRMA_COMPANY_ID || '').replace(/\s/g, '');
  const res = await fetch(`https://api2.wfirma.pl/invoices/add?company_id=${companyId}&inputFormat=json&outputFormat=json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'accessKey': accessKey,
      'secretKey': secretKey,
      'appKey': (env.WFIRMA_APP_KEY || '').replace(/\s/g, ''),
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });

  const text = await res.text();

  if (!res.ok) {
    // Log details (status, body, key lengths) for ops but never bubble them into the
    // user-visible Response — they would leak secret cardinalities and request bodies.
    console.error(`wFirma API HTTP ${res.status}`, { body: text.substring(0, 500), accessKeyLen: accessKey.length, secretKeyLen: secretKey.length, companyId });
    throw new Error('wFirma API request failed');
  }

  // wFirma returns HTTP 200 on app-level errors with status.code === 'ERROR' in the body.
  // Treating those as success would silently miss invoice issuance and leave invoice_id null.
  let parsed: { status?: { code?: string; messages?: unknown }; invoices?: Array<{ invoice?: { id?: string } }> } | null = null;
  try {
    parsed = JSON.parse(text);
  } catch {
    // Older wFirma endpoints sometimes return XML — fall through to regex below.
  }

  if (parsed && parsed.status && typeof parsed.status.code === 'string' && parsed.status.code !== 'OK') {
    console.error('wFirma API responded with error code', parsed.status);
    throw new Error('wFirma API returned error');
  }

  let invoiceId: string | undefined = parsed?.invoices?.[0]?.invoice?.id;
  if (!invoiceId) {
    const match = text.match(/<id>(\d+)<\/id>/);
    invoiceId = match?.[1];
  }

  if (!invoiceId) {
    console.error('wFirma: no invoice ID in response', text.substring(0, 200));
    throw new Error('wFirma: no invoice ID in response');
  }

  return String(invoiceId);
}

// Expense row pulled from wFirma /expenses/find — normalised shape that our cron
// can upsert into the local D1 expenses table.
export interface WfirmaExpenseRow {
  wfirma_id: string;
  invoice_number: string | null;
  contractor_name: string | null;
  contractor_nip: string | null;
  net_amount: number;     // grosze
  vat_amount: number;     // grosze
  gross_amount: number;   // grosze
  currency: string;
  issue_date: string;     // YYYY-MM-DD
  description: string | null;
  category: string | null;
}

interface WfirmaApiResponse {
  status?: { code?: string };
  expenses?: Array<{ expense?: Record<string, unknown> }>;
}

function pickString(o: Record<string, unknown>, ...keys: string[]): string | null {
  for (const k of keys) {
    const v = o[k];
    if (typeof v === 'string' && v.length > 0) return v;
    if (typeof v === 'number') return String(v);
  }
  return null;
}

function pickAmountGrosze(o: Record<string, unknown>, ...keys: string[]): number {
  for (const k of keys) {
    const v = o[k];
    if (typeof v === 'number' && Number.isFinite(v)) return Math.round(v * 100);
    if (typeof v === 'string') {
      const n = parseFloat(v.replace(',', '.'));
      if (Number.isFinite(n)) return Math.round(n * 100);
    }
  }
  return 0;
}

// Best-effort normaliser — wFirma's expense schema varies between accounts
// (some fields populated, some null). Cron upsert tolerates partials.
function normaliseExpense(raw: Record<string, unknown>): WfirmaExpenseRow | null {
  const id = pickString(raw, 'id');
  if (!id) return null;
  const contractor = (raw.contractor || raw.contractor_detail) as Record<string, unknown> | undefined;
  const gross = pickAmountGrosze(raw, 'total', 'gross_total', 'gross_amount');
  const net = pickAmountGrosze(raw, 'netto', 'net_total', 'net_amount');
  const vat = gross && net ? gross - net : pickAmountGrosze(raw, 'vat', 'vat_amount');
  return {
    wfirma_id: id,
    invoice_number: pickString(raw, 'number', 'fullnumber', 'name'),
    contractor_name: contractor ? pickString(contractor, 'name', 'altname') : null,
    contractor_nip: contractor ? pickString(contractor, 'nip', 'tax_id_type') : null,
    net_amount: net || (gross - vat),
    vat_amount: vat,
    gross_amount: gross,
    currency: pickString(raw, 'currency', 'currency_code') || 'PLN',
    issue_date: pickString(raw, 'date', 'paymentdate', 'issuedate') || new Date().toISOString().slice(0, 10),
    description: pickString(raw, 'description', 'comment'),
    category: pickString(raw, 'category', 'series_name', 'type'),
  };
}

// Pulls expenses (faktury kosztowe) from wFirma. Pagination handled by caller
// — pass page 1, 2, 3 until you get fewer than 50 rows. Date range optional;
// when both omitted, wFirma returns whatever its default window is (~last 30d).
export async function listWfirmaExpenses(
  env: Env,
  opts: { from?: string; to?: string; page?: number; limit?: number } = {},
): Promise<WfirmaExpenseRow[]> {
  const page = opts.page ?? 1;
  const limit = opts.limit ?? 50;
  const conditions: Array<Record<string, string>> = [];
  if (opts.from) conditions.push({ field: 'date', operator: 'ge', value: opts.from });
  if (opts.to) conditions.push({ field: 'date', operator: 'le', value: opts.to });

  const body = {
    expenses: [{
      parameters: {
        conditions,
        order: [{ field: 'date', order: 'DESC' }],
        limit,
        page,
      },
    }],
  };

  const accessKey = (env.WFIRMA_ACCESS_KEY || '').replace(/\s/g, '');
  const secretKey = (env.WFIRMA_SECRET_KEY || '').replace(/\s/g, '');
  const companyId = (env.WFIRMA_COMPANY_ID || '').replace(/\s/g, '');
  const res = await fetch(`https://api2.wfirma.pl/expenses/find?company_id=${companyId}&inputFormat=json&outputFormat=json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'accessKey': accessKey,
      'secretKey': secretKey,
      'appKey': (env.WFIRMA_APP_KEY || '').replace(/\s/g, ''),
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20000),
  });

  const text = await res.text();
  if (!res.ok) {
    console.error(`wFirma /expenses/find HTTP ${res.status}`, { body: text.substring(0, 500) });
    throw new Error('wFirma expenses fetch failed');
  }

  let parsed: WfirmaApiResponse | null = null;
  try {
    parsed = JSON.parse(text) as WfirmaApiResponse;
  } catch {
    console.error('wFirma /expenses/find: unparseable JSON', text.substring(0, 200));
    throw new Error('wFirma expenses: unparseable response');
  }
  if (parsed?.status?.code && parsed.status.code !== 'OK') {
    // 'OUT OF RANGE' = no results in window, treat as empty list rather than error.
    if (parsed.status.code === 'OUT OF RANGE' || parsed.status.code === 'NOT FOUND') return [];
    console.error('wFirma /expenses/find error', parsed.status);
    throw new Error(`wFirma error: ${parsed.status.code}`);
  }

  const rows = parsed?.expenses || [];
  return rows
    .map((r) => normaliseExpense((r.expense || {}) as Record<string, unknown>))
    .filter((r): r is WfirmaExpenseRow => r !== null);
}

