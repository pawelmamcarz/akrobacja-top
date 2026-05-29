// GET /api/admin/finance/summary?from=YYYY-MM-DD&to=YYYY-MM-DD&groupBy=month
// Monthly (or daily) P&L: income (vouchers split by payment_method + merch + courses)
// minus expenses (from expenses table). Default: last 12 months grouped by month.
//
// Income sources:
//   orders.amount where status='paid' AND paid_at in period
//     split by payment_method: stripe (default + null) / cash / transfer / free (=0)
//   merch_orders.total_amount where status='paid'
//   courses.amount (NB: courses doesn't have a date column equivalent to paid_at;
//     plan keeps it simple - sum all courses in period via created_at)
//
// Expenses: expenses.gross_amount grouped by COALESCE(manual_category, category, 'inne').

import { type Env } from '../../../../src/lib/types';
import { checkAdminAuthAsync } from '../../../../src/lib/admin-auth';

type GroupBy = 'month' | 'day' | 'week';

interface IncomeRow {
  bucket: string;
  payment_method: string | null;
  status: string;
  total: number;
  cnt: number;
}
interface ExpenseRow {
  bucket: string;
  category: string;
  total: number;
  cnt: number;
}
interface MerchRow {
  bucket: string;
  total: number;
  cnt: number;
}
interface CoursesRow {
  bucket: string;
  total: number;
  cnt: number;
}
interface RedemptionRow {
  bucket: string;
  cnt: number;
}

// Defaulty stałych operacyjnych (Finance summary uzywa stalych, bo to ogolny widok
// wielomiesieczny. Per-voucher edycja w /api/admin/finance/voucher-split).
const AIRCRAFT_RATE_PER_MIN_GR = 3000;          // 30 zl/min
const MARKETING_MONTHLY_GR_DEFAULT = 200_000;   // 2000 zl
const HANGAR_MONTHLY_GR_DEFAULT = 100_000;      // 1000 zl
const FUEL_PER_FLIGHT_GR = 20_000;              // 200 zl

const PKG_MINUTES: Record<string, number> = {
  pierwszy_lot: 15, adrenalina: 20, para: 30, masterclass: 50, test_naklejka: 0,
};
const PKG_FLIGHTS: Record<string, number> = {
  pierwszy_lot: 1, adrenalina: 1, para: 2, masterclass: 2, test_naklejka: 0,
};

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  if (!(await checkAdminAuthAsync(ctx.request, ctx.env))) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(ctx.request.url);
  const gbParam = url.searchParams.get('groupBy');
  const groupBy = (gbParam === 'day' ? 'day' : gbParam === 'week' ? 'week' : 'month') as GroupBy;
  // %W = numer tygodnia w roku (00-53), tydzień od poniedziałku. Bucket np. "2026-W21".
  const dateFmt = groupBy === 'day' ? '%Y-%m-%d' : groupBy === 'week' ? '%Y-W%W' : '%Y-%m';

  // Default range: last 12 months (month), last 12 weeks (week), or last 30 days (day).
  const today = new Date();
  let from = url.searchParams.get('from');
  let to = url.searchParams.get('to');
  if (!from) {
    const fromDate = new Date(today);
    if (groupBy === 'day') fromDate.setDate(fromDate.getDate() - 30);
    else if (groupBy === 'week') fromDate.setDate(fromDate.getDate() - 7 * 12);
    else fromDate.setMonth(fromDate.getMonth() - 11);
    from = fromDate.toISOString().slice(0, 10);
  }
  if (!to) to = today.toISOString().slice(0, 10);

  // Income - vouchers (orders)
  const income = await ctx.env.DB.prepare(`
    SELECT strftime('${dateFmt}', paid_at) AS bucket,
           COALESCE(payment_method, 'stripe') AS payment_method,
           status,
           SUM(amount) AS total,
           COUNT(*) AS cnt
    FROM orders
    WHERE status IN ('paid', 'refunded')
      AND paid_at IS NOT NULL
      AND date(paid_at) >= ? AND date(paid_at) <= ?
    GROUP BY bucket, payment_method, status
  `).bind(from, to).all<IncomeRow>();

  // Merch revenue
  const merch = await ctx.env.DB.prepare(`
    SELECT strftime('${dateFmt}', paid_at) AS bucket,
           SUM(total_amount) AS total,
           COUNT(*) AS cnt
    FROM merch_orders
    WHERE status = 'paid'
      AND paid_at IS NOT NULL
      AND date(paid_at) >= ? AND date(paid_at) <= ?
    GROUP BY bucket
  `).bind(from, to).all<MerchRow>();

  // Courses revenue (uses created_at - courses table doesn't have paid_at)
  const courses = await ctx.env.DB.prepare(`
    SELECT strftime('${dateFmt}', created_at) AS bucket,
           SUM(amount) AS total,
           COUNT(*) AS cnt
    FROM courses
    WHERE date(created_at) >= ? AND date(created_at) <= ?
    GROUP BY bucket
  `).bind(from, to).all<CoursesRow>();

  // Redemptions (vouchers used in period)
  const redemptions = await ctx.env.DB.prepare(`
    SELECT strftime('${dateFmt}', redeemed_at) AS bucket,
           COUNT(*) AS cnt
    FROM orders
    WHERE redeemed_at IS NOT NULL
      AND date(redeemed_at) >= ? AND date(redeemed_at) <= ?
    GROUP BY bucket
  `).bind(from, to).all<RedemptionRow>();

  // Koszty operacyjne (szacunkowe per voucher): aircraft (min × 30zl) + paliwo per lot.
  // Hangar i marketing - stale per miesiac, dodajemy w agregacji ponizej.
  // LEFT JOIN voucher_costs dla override paliwa/minut.
  const opcosts = await ctx.env.DB.prepare(`
    SELECT
      strftime('${dateFmt}', o.paid_at) AS bucket,
      o.package_id,
      COUNT(*) AS cnt,
      SUM(COALESCE(vc.fuel_gr, ?)) AS fuel_actual_or_default
    FROM orders o
    LEFT JOIN voucher_costs vc ON vc.voucher_code = o.voucher_code
    WHERE o.status = 'paid'
      AND o.paid_at IS NOT NULL
      AND date(o.paid_at) >= ? AND date(o.paid_at) <= ?
      AND o.package_id != 'test_naklejka'
      AND o.amount > 0
      AND COALESCE(o.payment_method, 'stripe') != 'free'
    GROUP BY bucket, o.package_id
  `).bind(FUEL_PER_FLIGHT_GR, from, to).all<{
    bucket: string; package_id: string; cnt: number; fuel_actual_or_default: number;
  }>();

  // Liczba kursow per miesiac (do dzielenia hangar/marketing)
  const coursesPerMonth = await ctx.env.DB.prepare(`
    SELECT strftime('${dateFmt}', created_at) AS bucket, COUNT(*) AS cnt
    FROM courses
    WHERE date(created_at) >= ? AND date(created_at) <= ?
    GROUP BY bucket
  `).bind(from, to).all<{ bucket: string; cnt: number }>();

  // Expenses
  const expenses = await ctx.env.DB.prepare(`
    SELECT strftime('${dateFmt}', issue_date) AS bucket,
           COALESCE(NULLIF(manual_category, ''), NULLIF(category, ''), 'inne') AS category,
           SUM(gross_amount) AS total,
           COUNT(*) AS cnt
    FROM expenses
    WHERE date(issue_date) >= ? AND date(issue_date) <= ?
    GROUP BY bucket, category
  `).bind(from, to).all<ExpenseRow>();

  // Build period buckets in order
  const periodsMap = new Map<string, {
    label: string;
    income: { vouchers_stripe: number; vouchers_cash: number; vouchers_transfer: number; vouchers_free: number; vouchers_refunded: number; merch: number; courses: number; total: number };
    expenses: { by_category: Record<string, number>; total: number };
    opcosts: { aircraft: number; fuel: number; hangar: number; marketing: number; total: number };
    counts: { vouchers_sold: number; vouchers_redeemed: number; merch_orders: number; courses: number };
    net: number;
    net_real: number;  // przychod - faktury - oper.
  }>();

  function getPeriod(bucket: string) {
    let p = periodsMap.get(bucket);
    if (!p) {
      p = {
        label: bucket,
        income: { vouchers_stripe: 0, vouchers_cash: 0, vouchers_transfer: 0, vouchers_free: 0, vouchers_refunded: 0, merch: 0, courses: 0, total: 0 },
        expenses: { by_category: {}, total: 0 },
        opcosts: { aircraft: 0, fuel: 0, hangar: 0, marketing: 0, total: 0 },
        counts: { vouchers_sold: 0, vouchers_redeemed: 0, merch_orders: 0, courses: 0 },
        net: 0,
        net_real: 0,
      };
      periodsMap.set(bucket, p);
    }
    return p;
  }

  for (const r of income.results || []) {
    if (!r.bucket) continue;
    const p = getPeriod(r.bucket);
    if (r.status === 'refunded') {
      p.income.vouchers_refunded += r.total;
      continue;
    }
    if (r.payment_method === 'cash') p.income.vouchers_cash += r.total;
    else if (r.payment_method === 'transfer') p.income.vouchers_transfer += r.total;
    else if (r.payment_method === 'free') p.income.vouchers_free += r.total;
    else p.income.vouchers_stripe += r.total;
    p.counts.vouchers_sold += r.cnt;
  }
  for (const r of merch.results || []) {
    if (!r.bucket) continue;
    const p = getPeriod(r.bucket);
    p.income.merch += r.total || 0;
    p.counts.merch_orders += r.cnt;
  }
  for (const r of courses.results || []) {
    if (!r.bucket) continue;
    const p = getPeriod(r.bucket);
    p.income.courses += r.total || 0;
    p.counts.courses += r.cnt;
  }
  for (const r of redemptions.results || []) {
    if (!r.bucket) continue;
    const p = getPeriod(r.bucket);
    p.counts.vouchers_redeemed += r.cnt;
  }
  for (const r of expenses.results || []) {
    if (!r.bucket) continue;
    const p = getPeriod(r.bucket);
    p.expenses.by_category[r.category] = (p.expenses.by_category[r.category] || 0) + r.total;
    p.expenses.total += r.total;
  }

  // Per-package koszty operacyjne (samolot + paliwo) per okres
  const fuelPerLot = FUEL_PER_FLIGHT_GR;
  for (const r of opcosts.results || []) {
    if (!r.bucket) continue;
    const p = getPeriod(r.bucket);
    const minutes = PKG_MINUTES[r.package_id] || 0;
    p.opcosts.aircraft += minutes * AIRCRAFT_RATE_PER_MIN_GR * r.cnt;
    // fuel_actual_or_default to suma per voucher (z override lub default per_lot).
    // Dla pakietow z 2 lotami (para/masterclass) - default FUEL_PER_FLIGHT_GR * flights
    // jest juz uwzgledniony tylko gdy nie ma override. Doliczam brakujace flights:
    const flights = PKG_FLIGHTS[r.package_id] || 1;
    const expectedDefault = fuelPerLot * flights * r.cnt;
    // r.fuel_actual_or_default zaklada 1 flight per voucher (FUEL_PER_FLIGHT_GR);
    // dla 2-lotowych pakietow dodaj brakujacy 2gi lot (jesli nie ma override).
    p.opcosts.fuel += r.fuel_actual_or_default + Math.max(0, expectedDefault - fuelPerLot * r.cnt);
  }

  // Hangar + Marketing - stale per miesiac (groupBy='month'), proporcjonalnie do dni (groupBy='day').
  // Liczba kursow tez konsumuje share (analog do voucher-split).
  for (const r of coursesPerMonth.results || []) {
    if (!r.bucket) continue;
    const p = getPeriod(r.bucket);
    p.counts.courses += r.cnt;
  }
  // Dla kazdego okresu z voucherami lub kursami - dodaj share hangar/marketing
  for (const p of periodsMap.values()) {
    const nTotal = p.counts.vouchers_sold + p.counts.courses;
    if (nTotal > 0) {
      // Hangar/Marketing dzielony per voucher+kurs. Suma per okres = stała (lub proporcjonalna do dni).
      // Dla monthly - pelna kwota; dla daily - kwota/dni_w_miesiacu * jednostki_w_okresie.
      // Najprosciej dla monthly: cala kwota miesięczna.
      // Dla daily - przyjmijmy ze koszty operacyjne nie sa dzielone na dni (tylko miesiace).
      if (groupBy === 'month') {
        p.opcosts.hangar = HANGAR_MONTHLY_GR_DEFAULT;
        p.opcosts.marketing = MARKETING_MONTHLY_GR_DEFAULT;
      } else if (groupBy === 'week') {
        // Tydzień = 7/30 miesiąca, żeby nie liczyć pełnego kosztu stałego na każdy tydzień.
        p.opcosts.hangar = Math.round(HANGAR_MONTHLY_GR_DEFAULT / 30 * 7);
        p.opcosts.marketing = Math.round(MARKETING_MONTHLY_GR_DEFAULT / 30 * 7);
      } else {
        p.opcosts.hangar = Math.round(HANGAR_MONTHLY_GR_DEFAULT / 30);
        p.opcosts.marketing = Math.round(MARKETING_MONTHLY_GR_DEFAULT / 30);
      }
    }
  }

  // Finalize income.total + net per period
  for (const p of periodsMap.values()) {
    p.income.total = p.income.vouchers_stripe + p.income.vouchers_cash
      + p.income.vouchers_transfer + p.income.merch + p.income.courses;
    p.opcosts.total = p.opcosts.aircraft + p.opcosts.fuel + p.opcosts.hangar + p.opcosts.marketing;
    p.net = p.income.total - p.expenses.total;
    p.net_real = p.income.total - p.expenses.total - p.opcosts.total;
  }

  const periods = Array.from(periodsMap.values()).sort((a, b) => a.label.localeCompare(b.label));

  // Totals across all periods
  const totals = {
    income: 0,
    expenses: 0,
    opcosts: 0,
    opcosts_breakdown: { aircraft: 0, fuel: 0, hangar: 0, marketing: 0 },
    net: 0,
    net_real: 0,
    vouchers_sold: 0,
    vouchers_redeemed: 0,
  };
  const incomeByMethod = { stripe: 0, cash: 0, transfer: 0, free: 0, refunded: 0, merch: 0, courses: 0 };
  const expensesByCategory: Record<string, number> = {};
  for (const p of periods) {
    totals.income += p.income.total;
    totals.expenses += p.expenses.total;
    totals.vouchers_sold += p.counts.vouchers_sold;
    totals.vouchers_redeemed += p.counts.vouchers_redeemed;
    incomeByMethod.stripe += p.income.vouchers_stripe;
    incomeByMethod.cash += p.income.vouchers_cash;
    incomeByMethod.transfer += p.income.vouchers_transfer;
    incomeByMethod.free += p.income.vouchers_free;
    incomeByMethod.refunded += p.income.vouchers_refunded;
    incomeByMethod.merch += p.income.merch;
    incomeByMethod.courses += p.income.courses;
    for (const [c, v] of Object.entries(p.expenses.by_category)) {
      expensesByCategory[c] = (expensesByCategory[c] || 0) + v;
    }
    totals.opcosts += p.opcosts.total;
    totals.opcosts_breakdown.aircraft += p.opcosts.aircraft;
    totals.opcosts_breakdown.fuel += p.opcosts.fuel;
    totals.opcosts_breakdown.hangar += p.opcosts.hangar;
    totals.opcosts_breakdown.marketing += p.opcosts.marketing;
  }
  totals.net = totals.income - totals.expenses;
  totals.net_real = totals.income - totals.expenses - totals.opcosts;

  return Response.json({
    range: { from, to, groupBy },
    periods,
    totals,
    income_by_source: incomeByMethod,
    expenses_by_category: expensesByCategory,
  });
};
