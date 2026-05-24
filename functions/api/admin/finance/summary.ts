// GET /api/admin/finance/summary?from=YYYY-MM-DD&to=YYYY-MM-DD&groupBy=month
// Monthly (or daily) P&L: income (vouchers split by payment_method + merch + courses)
// minus expenses (from expenses table). Default: last 12 months grouped by month.
//
// Income sources:
//   orders.amount where status='paid' AND paid_at in period
//     split by payment_method: stripe (default + null) / cash / transfer / free (=0)
//   merch_orders.total_amount where status='paid'
//   courses.amount (NB: courses doesn't have a date column equivalent to paid_at;
//     plan keeps it simple — sum all courses in period via created_at)
//
// Expenses: expenses.gross_amount grouped by COALESCE(manual_category, category, 'inne').

import { type Env } from '../../../../src/lib/types';
import { checkAdminAuthAsync } from '../../../../src/lib/admin-auth';

type GroupBy = 'month' | 'day';

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

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  if (!(await checkAdminAuthAsync(ctx.request, ctx.env))) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(ctx.request.url);
  const groupBy = (url.searchParams.get('groupBy') === 'day' ? 'day' : 'month') as GroupBy;
  const dateFmt = groupBy === 'day' ? '%Y-%m-%d' : '%Y-%m';

  // Default range: last 12 months ending today (or last 30 days if groupBy=day).
  const today = new Date();
  let from = url.searchParams.get('from');
  let to = url.searchParams.get('to');
  if (!from) {
    const fromDate = new Date(today);
    if (groupBy === 'day') fromDate.setDate(fromDate.getDate() - 30);
    else fromDate.setMonth(fromDate.getMonth() - 11);
    from = fromDate.toISOString().slice(0, 10);
  }
  if (!to) to = today.toISOString().slice(0, 10);

  // Income — vouchers (orders)
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

  // Courses revenue (uses created_at — courses table doesn't have paid_at)
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
    counts: { vouchers_sold: number; vouchers_redeemed: number; merch_orders: number; courses: number };
    net: number;
  }>();

  function getPeriod(bucket: string) {
    let p = periodsMap.get(bucket);
    if (!p) {
      p = {
        label: bucket,
        income: { vouchers_stripe: 0, vouchers_cash: 0, vouchers_transfer: 0, vouchers_free: 0, vouchers_refunded: 0, merch: 0, courses: 0, total: 0 },
        expenses: { by_category: {}, total: 0 },
        counts: { vouchers_sold: 0, vouchers_redeemed: 0, merch_orders: 0, courses: 0 },
        net: 0,
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

  // Finalize income.total + net per period
  for (const p of periodsMap.values()) {
    p.income.total = p.income.vouchers_stripe + p.income.vouchers_cash
      + p.income.vouchers_transfer + p.income.merch + p.income.courses;
    p.net = p.income.total - p.expenses.total;
  }

  const periods = Array.from(periodsMap.values()).sort((a, b) => a.label.localeCompare(b.label));

  // Totals across all periods
  const totals = {
    income: 0,
    expenses: 0,
    net: 0,
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
  }
  totals.net = totals.income - totals.expenses;

  return Response.json({
    range: { from, to, groupBy },
    periods,
    totals,
    income_by_source: incomeByMethod,
    expenses_by_category: expensesByCategory,
  });
};
