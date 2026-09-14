/* Contexto completo de um projeto, sempre limitado ao workspace autenticado. */
export function register(app, ctx) {
  const { pool, tenant, classifyDbError } = ctx;
  app.get("/api/projects/:id/workspace", async (req, res) => {
    const org = tenant(req, res); if (!org) return;
    const scoped = (sql, params = [req.params.id, org]) => pool.query(sql, params);
    try {
      const project = await scoped("select p.*, c.name client_name from projects p left join clients c on c.id=p.client_id and c.organization_id=p.organization_id where p.id=$1 and p.organization_id=$2");
      if (!project.rowCount) return res.status(404).json({ error: "Projeto não encontrado." });
      const [tasks, files, deliveries, approvals, changes, infrastructure, tickets, timeEntries] = await Promise.all([
        scoped("select id,title,status,priority,due_at,assignee_id from tasks where project_id=$1 and organization_id=$2 order by due_at asc nulls last,created_at desc"),
        scoped("select id,name,kind,url,size_bytes,created_at from files where project_id=$1 and organization_id=$2 order by created_at desc"),
        scoped("select id,version,environment,status,published_at,published_url,client_approved,backup_done from deliveries where project_id=$1 and organization_id=$2 order by created_at desc"),
        scoped("select id,target_type,title,status,requested_at,decided_at,decision,comment from approvals where project_id=$1 and organization_id=$2 order by created_at desc"),
        scoped("select id,title,status,impact_days,additional_cost,created_at from change_requests where project_id=$1 and organization_id=$2 order by created_at desc"),
        scoped("select id,kind,name,provider,expires_on,status,cost,client_price from infrastructure_assets where project_id=$1 and organization_id=$2 order by expires_on nulls last"),
        scoped("select id,title,status,priority,created_at from tickets where project_id=$1 and organization_id=$2 order by created_at desc"),
        scoped("select id,user_id,minutes,billable,status,started_at,ended_at,created_at from time_entries where project_id=$1 and organization_id=$2 order by created_at desc"),
      ]);
      res.json({ project: project.rows[0], tasks: tasks.rows, files: files.rows, deliveries: deliveries.rows, approvals: approvals.rows, changes: changes.rows, infrastructure: infrastructure.rows, tickets: tickets.rows, time_entries: timeEntries.rows });
    } catch (error) {
      const out = classifyDbError(error, "Não foi possível carregar o workspace do projeto.");
      res.status(out.status).json({ error: out.error });
    }
  });
}
