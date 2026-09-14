/* Complementos autenticados de agenda e tarefas. */
export function register(app, ctx) {
  const { pool, tenant, classifyDbError } = ctx;
  const fail = (res, error, fallback) => { const out = classifyDbError(error, fallback); res.status(out.status).json({ error: out.error }); };
  app.get("/api/tasks/summary", async (req, res) => { const org = tenant(req, res); if (!org) return; try { const q = await pool.query("select count(*) filter (where status <> 'done')::int open,count(*) filter (where status='done')::int done,count(*) filter (where status <> 'done' and due_at < now())::int overdue,count(*) filter (where status <> 'done' and due_at::date=current_date)::int \"dueToday\" from tasks where organization_id=$1", [org]); res.json(q.rows[0] || { open: 0, done: 0, overdue: 0, dueToday: 0 }); } catch (e) { fail(res, e, "Não foi possível carregar o resumo de tarefas."); } });
  app.get("/api/events/upcoming", async (req, res) => { const org = tenant(req, res); if (!org) return; const days = Math.min(31, Math.max(1, Number.parseInt(req.query.days, 10) || 7)); try { const q = await pool.query("select * from events where organization_id=$1 and starts_at >= now() and starts_at < now()+($2::int * interval '1 day') order by starts_at", [org, days]); res.json({ events: q.rows }); } catch (e) { fail(res, e, "Não foi possível carregar os próximos eventos."); } });
}
