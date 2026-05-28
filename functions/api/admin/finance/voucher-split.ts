// GET /api/admin/finance/voucher-split?month=YYYY-MM&marketing_gr=NNN&hangar_gr=NNN
//
// Liczy podzial kasy per voucher sprzedany w danym miesiacu:
//   samolot (Pawel)      = 30 zl/min * flight_minutes(pakiet)  (Extra 300L - Pawel wlasciciel)
//   marketing (Pawel)    = MARKETING_GR / N_total                (FB Ads, dynamicznie zmienne)
//   paliwo (Maciej)      = 200 zl per lot
//   hangar (Maciej)      = HANGAR_GR / N_total
//   marza                = cena - samolot - marketing_share - paliwo - hangar_share
//   marza dzielona 50/50 miedzy Pawla i Macieja (umowa).
//
// N_total = voucherow_sprzedanych + kursow_rozpoczetych w miesiacu.
// Kursy tez konsumuja share marketingu i hangaru (kursanci tez przychodza z FB),
// ale ich rozliczenie jest poza ta tabela.
//
// marketing_gr i hangar_gr mozna nadpisac w URL (UI pozwala wpisac kwote
// faktycznie zainwestowana w danym miesiacu - bo do konca miesiaca nie znamy).
// Default fallback: 2000 zl marketing, 1000 zl hangar.

import { type Env, PACKAGES, type PackageId } from '../../../../src/lib/types';
import { checkAdminAuthAsync } from '../../../../src/lib/admin-auth';

const AIRCRAFT_RATE_PER_MIN_GR = 3000;          // 30 zl/min amortyzacja Extra 300L
const MARKETING_MONTHLY_GR_DEFAULT = 200_000;   // 2000 zl - fallback gdy brak override
const HANGAR_MONTHLY_GR_DEFAULT = 100_000;      // 1000 zl - fallback
const FUEL_PER_FLIGHT_GR = 20_000;              // 200 zl

const PACKAGE_FLIGHT_MINUTES: Record<PackageId, number> = {
  pierwszy_lot: 15,
  adrenalina: 20,
  para: 30,           // 2x 15 min (blok lotu = warmup + lot 10-12 + kolowanie)
  para_adrenalina: 40, // 2x 20 min
  masterclass: 50,
  test_naklejka: 0,
};

// Mnoznik paliwa per pakiet. Para / Para Adrenalina = 2 osobne loty. Masterclass = 50 min,
// wymaga dotankowania w trakcie (zasieg ~30 min na pelnym baku akrobacji).
const PACKAGE_FLIGHT_COUNT: Record<PackageId, number> = {
  pierwszy_lot: 1,
  adrenalina: 1,
  para: 2,
  para_adrenalina: 2,
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
  fuel_override_gr: number | null;
  minutes_override: number | null;
  cost_notes: string | null;
}

interface VoucherSplit {
  voucher_code: string;
  customer: string | null;
  package: PackageId;
  package_name: string;
  flight_minutes: number;
  fuel_overridden: boolean;
  minutes_overridden: boolean;
  cost_notes: string | null;
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

  const marketingParam = url.searchParams.get('marketing_gr');
  const hangarParam = url.searchParams.get('hangar_gr');
  const marketingMonthlyGr = marketingParam && /^\d+$/.test(marketingParam)
    ? parseInt(marketingParam, 10)
    : MARKETING_MONTHLY_GR_DEFAULT;
  const hangarMonthlyGr = hangarParam && /^\d+$/.test(hangarParam)
    ? parseInt(hangarParam, 10)
    : HANGAR_MONTHLY_GR_DEFAULT;

  // Pomijamy: testowe naklejki, vouchery free/barter (klient nic nie zaplacil),
  // wewnetrzne TEST za 0 zl. Te nie generuja rozliczenia miedzy Pawlem a Maciejem.
  // LEFT JOIN voucher_costs: per-voucher override paliwa i czasu lotu.
  const orders = await ctx.env.DB.prepare(`
    SELECT o.id, o.voucher_code, o.package_id, o.amount, o.paid_at, o.customer_name,
           o.recipient_name, o.addons, o.payment_method, o.status,
           vc.fuel_gr AS fuel_override_gr,
           vc.aircraft_minutes_actual AS minutes_override,
           vc.notes AS cost_notes
    FROM orders o
    LEFT JOIN voucher_costs vc ON vc.voucher_code = o.voucher_code
    WHERE o.status = 'paid'
      AND o.paid_at IS NOT NULL
      AND strftime('%Y-%m', o.paid_at) = ?
      AND o.package_id != 'test_naklejka'
      AND o.amount > 0
      AND COALESCE(o.payment_method, 'stripe') != 'free'
    ORDER BY o.paid_at
  `).bind(month).all<OrderRow>();

  const rows = orders.results || [];
  const vouchersCount = rows.length;

  // Kursy rozpoczete w miesiacu - tez konsumuja share marketingu/hangaru
  // bo kursanci tez przychodza z FB Ads i samolot stoi w tym samym hangarze.
  const coursesRow = await ctx.env.DB.prepare(`
    SELECT COUNT(*) AS cnt FROM courses
    WHERE strftime('%Y-%m', created_at) = ?
  `).bind(month).first<{ cnt: number }>();
  const coursesCount = coursesRow?.cnt || 0;

  const nTotal = vouchersCount + coursesCount;
  const hangarShare = nTotal > 0 ? Math.round(hangarMonthlyGr / nTotal) : 0;
  const marketingShare = nTotal > 0 ? Math.round(marketingMonthlyGr / nTotal) : 0;

  const splits: VoucherSplit[] = rows.map((o) => {
    const pkg = PACKAGES[o.package_id] || PACKAGES.pierwszy_lot;
    const minutesDefault = PACKAGE_FLIGHT_MINUTES[o.package_id] || 0;
    const flights = PACKAGE_FLIGHT_COUNT[o.package_id] || 1;
    const minutes = o.minutes_override != null ? o.minutes_override : minutesDefault;
    const costAircraft = minutes * AIRCRAFT_RATE_PER_MIN_GR;
    const costFuel = o.fuel_override_gr != null ? o.fuel_override_gr : (FUEL_PER_FLIGHT_GR * flights);
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
      fuel_overridden: o.fuel_override_gr != null,
      minutes_overridden: o.minutes_override != null,
      cost_notes: o.cost_notes,
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
      marketing_monthly_gr: marketingMonthlyGr,
      hangar_monthly_gr: hangarMonthlyGr,
      fuel_per_flight_gr: FUEL_PER_FLIGHT_GR,
      marketing_overridden: marketingParam !== null,
      hangar_overridden: hangarParam !== null,
    },
    counts: {
      vouchers_sold: vouchersCount,
      courses_started: coursesCount,
      n_total: nTotal,
      hangar_share_gr: hangarShare,
      marketing_share_gr: marketingShare,
    },
    splits,
    totals,
  });
};
