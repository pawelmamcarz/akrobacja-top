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
