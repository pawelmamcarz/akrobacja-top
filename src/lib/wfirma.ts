import { type Env, PACKAGES, VIDEO_ADDON_PRICE, type PackageId } from './types';

interface InvoiceParams {
  customerName: string;
  customerEmail: string;
  customerNip?: string;
  packageId: PackageId;
  videoAddon: boolean;
  voucherCode: string;
}

// wFirma API v2 — https://doc.wfirma.pl/
// Auth: Basic (login:password) + header x-company-id
export async function createInvoice(env: Env, params: InvoiceParams): Promise<string> {
  const pkg = PACKAGES[params.packageId];
  const isCompany = !!params.customerNip;
  const totalBrutto = (pkg.price + (params.videoAddon ? VIDEO_ADDON_PRICE : 0)) / 100;

  const items: object[] = [
    {
      invoicecontent: {
        name: `Voucher akrobacyjny "${pkg.name}" — lot Extra 300L (${pkg.duration})`,
        unit: 'szt.',
        count: 1,
        price: pkg.price / 100, // PLN
        vat: '23',
      },
    },
  ];

  if (params.videoAddon) {
    items.push({
      invoicecontent: {
        name: 'Video 360° z lotu akrobacyjnego (montaż + MP4)',
        unit: 'szt.',
        count: 1,
        price: VIDEO_ADDON_PRICE / 100,
        vat: '23',
      },
    });
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
  });

  const text = await res.text();

  if (!res.ok) {
    throw new Error(`wFirma API error ${res.status} [ak:${accessKey.length}ch sk:${secretKey.length}ch co:${companyId}]: ${text}`);
  }

  // wFirma may return JSON or XML — extract invoice ID from either
  let invoiceId: string | undefined;

  // Try JSON first
  try {
    const data = JSON.parse(text) as { invoices?: Array<{ invoice?: { id?: string } }> };
    invoiceId = data.invoices?.[0]?.invoice?.id;
  } catch {
    // Parse XML — look for <id>NUMBER</id>
    const match = text.match(/<id>(\d+)<\/id>/);
    invoiceId = match?.[1];
  }

  if (!invoiceId) throw new Error(`wFirma: no invoice ID in response: ${text.substring(0, 200)}`);

  return String(invoiceId);
}
