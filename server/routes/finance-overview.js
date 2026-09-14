export function registerFinanceOverviewRoutes(app, { pool, tenant, classifyDbError }) {
  app.get("/api/finance/overview", async (req, res) => {
    const org = tenant(req, res); if (!org) return;
    try {
      const [revenues, expenses, receivables, payables, banks, subscriptions] = await Promise.all([
        pool.query("select coalesce(sum(amount) filter (where paid_at is not null and date_trunc('month',paid_at)=date_trunc('month',current_date)),0)::float8 as month from revenues where organization_id=$1", [org]),
        pool.query("select coalesce(sum(amount) filter (where paid_at is not null and date_trunc('month',paid_at)=date_trunc('month',current_date)),0)::float8 as month from expenses where organization_id=$1", [org]),
        pool.query("select coalesce(sum(amount) filter (where status in ('pending','overdue','partially_paid')),0)::float8 as open,coalesce(sum(amount) filter (where status='overdue'),0)::float8 as overdue from receivables where organization_id=$1", [org]),
        pool.query("select coalesce(sum(amount) filter (where status in ('pending','overdue')),0)::float8 as open,coalesce(sum(amount) filter (where status='overdue'),0)::float8 as overdue from payables where organization_id=$1", [org]),
        pool.query("select coalesce(sum(current_balance),0)::float8 as balance from bank_accounts where organization_id=$1 and status='active'", [org]),
        pool.query("select count(*)::int as active,coalesce(sum(amount) filter (where status='active'),0)::float8 as mrr from subscriptions where organization_id=$1", [org]),
      ]);
      const revenue = Number(revenues.rows[0]?.month || 0), expense = Number(expenses.rows[0]?.month || 0);
      res.json({ metrics: { current_balance: Number(banks.rows[0]?.balance || 0), month_revenue: revenue, month_expense: expense, month_result: revenue - expense, receivables_open: Number(receivables.rows[0]?.open || 0), receivables_overdue: Number(receivables.rows[0]?.overdue || 0), payables_open: Number(payables.rows[0]?.open || 0), payables_overdue: Number(payables.rows[0]?.overdue || 0), active_subscriptions: Number(subscriptions.rows[0]?.active || 0), monthly_recurring_revenue: Number(subscriptions.rows[0]?.mrr || 0) } });
    } catch (error) { const out = classifyDbError(error, "Não foi possível carregar a visão financeira."); res.status(out.status).json({ error: out.error }); }
  });
}
