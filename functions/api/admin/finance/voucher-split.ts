// GET /api/admin/finance/voucher-split?month=YYYY-MM
//
// Liczy podzial kasy per voucher sprzedany w danym miesiacu:
//   samolot (Pawel)      = 30 zl/min * flight_minutes(pakiet)  (Extra 300L - Pawel wlasciciel)
//   marketing (Pawel)    = 2000 zl/mies / N voucherow miesiaca  (FB Ads)
//   paliwo (Maciej)      = 200 zl per lot
//   hangar (Maciej)      = 1000 zl/mies / N voucherow miesiaca
//   marza                = cena - samolot - marketing_share - paliwo - hangar_share
//   marza dzielona 50/50 miedzy Pawla i Macieja (umowa).
//
// Pawel dostaje: samolot + marketing_share + 50% marzy.
// Maciej dostaje: paliwo + hangar_share + 50% marzy.

import { type Env, PACKAGES, type PackageId } from '../../../../src/lib/types';
import { checkAdminAuthAsync } from '../../../../src/lib/admin-auth';

const AIRCRAFT_RATE_PER_MIN_GR = 3000;       // 30 zl/min amortyzacja Extra 300L
const MARKETING_MONTHLY_GR = 200_000;        // 2000 zl
const HANGAR_MONTHLY_GR = 100_000;           // 1000 zl
const FUEL_PER_FLIGHT_GR = 20_000;           // 200 zl

const PACKAGE_FLIGHT_MINUTES: Record<PackageId, number> = {
  pierwszy_lot: 15,
  adrenalina: 20,
  para: 30,           // 2x 15 min
  masterclass: 50,
  test_naklejka: 0,
};

// Mnoznik paliwa per pakiet. Para = 2 osobne loty. Masterclass = 50 min,
// wymaga dotankowania w trakcie (zasieg ~30 min na pelnym baku akrobacji).
const PACKAGE_FLIGHT_COUNT: Record<PackageId, number> = {
  pierwszy_lot: 1,
  adrenalina: 1,
  para: 2,
  masterclass: 2,
  test_naklejka: 0,
};

interface OrderRow {
  id: string;
  voucher_code: string;
  package_id: PackageId;
  amount: number;
  paid_at: string;
  customer_name: string | null;
  recipient_name: string | null;
  addons: string | null;
  payment_method: string | null;
  status: string;
}

interface VoucherSplit {
  voucher_code: string;
  customer: string | null;
  package: PackageId;
  package_name: string;
  flight_minutes: number;
  price_gr: number;
  cost_aircraft_gr: number;
  cost_fuel_gr: number;
  cost_hangar_share_gr: number;
  cost_marketing_share_gr: number;
  cost_total_gr: number;
  margin_gr: number;
  pawel_total_gr: number;     // samolot + marketing_share (przepuszczone) + marza/2
  maciej_total_gr: number;    // paliwo + hangar_share (przepuszczone) + marza/2
}

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  if (!(await checkAdminAuthAsync(ctx.request, ctx.env))) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(ctx.request.url);
  const month = url.searchParams.get('month') || new Date().toISOString().slice(0, 7); // 'YYYY-MM'
  if (!/^\d{4}-\d{2}$/.test(month)) {
    return Response.json({ error: 'Format: YYYY-MM' }, { status: 400 });
  }

  // Pomijamy: testowe naklejki, vouchery free/barter (klient nic nie zaplacil),
  // wewnetrzne TEST za 0 zl. Te nie generuja rozliczenia miedzy Pawlem a Maciejem.
  const orders = await ctx.env.DB.prepare(`
    SELECT id, voucher_code, package_id, amount, paid_at, customer_name, recipient_name, addons, payment_method, status
    FROM orders
    WHERE status = 'paid'
      AND paid_at IS NOT NULL
      AND strftime('%Y-%m', paid_at) = ?
      AND package_id != 'test_naklejka'
      AND amount > 0
      AND COALESCE(payment_method, 'stripe') != 'free'
    ORDER BY paid_at
  `).bind(month).all<OrderRow>();

  const rows = orders.results || [];
  const N = rows.length;

  const hangarShare = N > 0 ? Math.round(HANGAR_MONTHLY_GR / N) : 0;
  const marketingShare = N > 0 ? Math.round(MARKETING_MONTHLY_GR / N) : 0;

  const splits: VoucherSplit[] = rows.map((o) => {
    const pkg = PACKAGES[o.package_id] || PACKAGES.pierwszy_lot;
    const minutes = PACKAGE_FLIGHT_MINUTES[o.package_id] || 0;
    const flights = PACKAGE_FLIGHT_COUNT[o.package_id] || 1;
    const costAircraft = minutes * AIRCRAFT_RATE_PER_MIN_GR;
    const costFuel = FUEL_PER_FLIGHT_GR * flights;
    const costTotal = costAircraft + costFuel + hangarShare + marketingShare;
    // Marza moze byc ujemna (voucher promocyjny ze znizka ponizej kosztow):
    // wtedy obaj dziela strate po polowie zeby suma pawel+maciej = cena vouchera.
    const margin = o.amount - costTotal;
    const marginHalf = Math.round(margin / 2);
    return {
      voucher_code: o.voucher_code,
      customer: o.recipient_name || o.customer_name,
      package: o.package_id,
      package_name: pkg.name,
      flight_minutes: minutes,
      price_gr: o.amount,
      cost_aircraft_gr: costAircraft,
      cost_fuel_gr: costFuel,
      cost_hangar_share_gr: hangarShare,
      cost_marketing_share_gr: marketingShare,
      cost_total_gr: costTotal,
      margin_gr: margin,
      pawel_total_gr: costAircraft + marketingShare + marginHalf,
      maciej_total_gr: costFuel + hangarShare + marginHalf,
    };
  });

  const totals = splits.reduce(
    (acc, s) => {
      acc.revenue_gr += s.price_gr;
      acc.cost_total_gr += s.cost_total_gr;
      acc.margin_gr += s.margin_gr;
      acc.pawel_gr += s.pawel_total_gr;
      acc.maciej_gr += s.maciej_total_gr;
      return acc;
    },
    { revenue_gr: 0, cost_total_gr: 0, margin_gr: 0, pawel_gr: 0, maciej_gr: 0 },
  );

  return Response.json({
    month,
    constants: {
      aircraft_rate_per_min_gr: AIRCRAFT_RATE_PER_MIN_GR,
      marketing_monthly_gr: MARKETING_MONTHLY_GR,
      hangar_monthly_gr: HANGAR_MONTHLY_GR,
      fuel_per_flight_gr: FUEL_PER_FLIGHT_GR,
    },
    counts: { vouchers_sold: N, hangar_share_gr: hangarShare, marketing_share_gr: marketingShare },
    splits,
    totals,
  });
};
