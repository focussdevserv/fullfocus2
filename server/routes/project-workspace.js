/* Contexto completo de um projeto, sempre limitado ao workspace autenticado. */
export function register(app, ctx) {
  const { pool, tenant, classifyDbError } = ctx;
  const portalFields = ["show_overview", "show_tasks", "show_files", "show_deliveries", "show_approvals", "show_changes", "show_infrastructure", "show_repository", "show_hosting", "show_finance", "show_support"];
  const portalDefaults = { show_overview: true, show_tasks: true, show_files: true, show_deliveries: true, show_approvals: true, show_changes: false, show_infrastructure: false, show_repository: false, show_hosting: false, show_finance: true, show_support: true };
  app.get("/api/projects/:id/portal-settings", async (req, res) => {
    const org = tenant(req, res); if (!org) return;
    try {
      const project = await pool.query("select id from projects where id=$1 and organization_id=$2", [req.params.id, org]);
      if (!project.rowCount) return res.status(404).json({ error: "Projeto não encontrado." });
      const current = await pool.query("select * from project_portal_settings where project_id=$1 and organization_id=$2", [req.params.id, org]);
      res.json({ settings: { ...portalDefaults, ...(current.rows[0] || {}) } });
    } catch (error) { const out = classifyDbError(error, "Não foi possível carregar a visibilidade do portal."); res.status(out.status).json({ error: out.error }); }
  });
  app.patch("/api/projects/:id/portal-settings", async (req, res) => {
    const org = tenant(req, res); if (!org) return;
    const body = req.body && typeof req.body === "object" ? req.body : {};
    try {
      const project = await pool.query("select id from projects where id=$1 and organization_id=$2", [req.params.id, org]);
      if (!project.rowCount) return res.status(404).json({ error: "Projeto não encontrado." });
      const values = portalFields.map((field) => body[field] === undefined ? portalDefaults[field] : Boolean(body[field]));
      const columns = portalFields.join(",");
      const placeholders = portalFields.map((_, index) => `$${index + 3}`).join(",");
      const updates = portalFields.map((field) => `${field}=excluded.${field}`).join(",");
      const result = await pool.query(`insert into project_portal_settings (project_id,organization_id,${columns}) values ($1,$2,${placeholders}) on conflict (project_id) do update set ${updates},organization_id=excluded.organization_id,updated_at=now() returning *`, [req.params.id, org, ...values]);
      res.json({ settings: { ...portalDefaults, ...result.rows[0] } });
    } catch (error) { const out = classifyDbError(error, "Não foi possível salvar a visibilidade do portal."); res.status(out.status).json({ error: out.error }); }
  });
  app.get("/api/projects/:id/workspace", async (req, res) => {
    const org = tenant(req, res); if (!org) return;
    const scoped = (sql, params = [req.params.id, org]) => pool.query(sql, params);
    try {
      const project = await scoped("select p.*, c.name client_name from projects p left join clients c on c.id=p.client_id and c.organization_id=p.organization_id where p.id=$1 and p.organization_id=$2");
      if (!project.rowCount) return res.status(404).json({ error: "Projeto não encontrado." });
      const [tasks, files, deliveries, approvals, changes, infrastructure, tickets, timeEntries, portalSettings] = await Promise.all([
        scoped("select id,title,status,priority,due_at,assignee_id from tasks where project_id=$1 and organization_id=$2 order by due_at asc nulls last,created_at desc"),
        scoped("select id,name,kind,url,size_bytes,created_at from files where project_id=$1 and organization_id=$2 order by created_at desc"),
        scoped("select id,version,environment,status,published_at,published_url,client_approved,backup_done from deliveries where project_id=$1 and organization_id=$2 order by created_at desc"),
        scoped("select id,target_type,title,status,requested_at,decided_at,decision,comment from approvals where project_id=$1 and organization_id=$2 order by created_at desc"),
        scoped("select id,title,status,impact_days,additional_cost,created_at from change_requests where project_id=$1 and organization_id=$2 order by created_at desc"),
        scoped("select id,kind,name,provider,expires_on,status,cost,client_price from infrastructure_assets where project_id=$1 and organization_id=$2 order by expires_on nulls last"),
        scoped("select id,title,status,priority,created_at from tickets where project_id=$1 and organization_id=$2 order by created_at desc"),
        scoped("select id,user_id,minutes,billable,status,started_at,ended_at,created_at from time_entries where project_id=$1 and organization_id=$2 order by created_at desc"),
        pool.query("select * from project_portal_settings where project_id=$1 and organization_id=$2", [req.params.id, org]),
      ]);
      res.json({ project: project.rows[0], tasks: tasks.rows, files: files.rows, deliveries: deliveries.rows, approvals: approvals.rows, changes: changes.rows, infrastructure: infrastructure.rows, tickets: tickets.rows, time_entries: timeEntries.rows, portal_settings: { ...portalDefaults, ...(portalSettings.rows[0] || {}) } });
    } catch (error) {
      const out = classifyDbError(error, "Não foi possível carregar o workspace do projeto.");
      res.status(out.status).json({ error: out.error });
    }
  });
}
