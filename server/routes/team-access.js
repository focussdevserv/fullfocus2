export function register(app, ctx) {
  const { pool, tenant } = ctx;
  const text = (value) => typeof value === "string" ? value.trim() : "";
  const roleOf = async (req, org) => (await pool.query("select role from users where id=$1 and organization_id=$2", [req.user?.id, org])).rows[0]?.role || null;
  const authorized = async (req, org) => ["owner", "admin"].includes(await roleOf(req, org));
  app.get("/api/team/access-status", async (req, res) => { const org = tenant(req, res); if (!org) return; try { const q = await pool.query("select u.id,u.name,u.email,u.role,u.team_role_id,u.department,u.job_title,u.availability,u.access_status,u.access_expires_on,u.created_at,tr.name as team_role_name from users u left join team_roles tr on tr.id=u.team_role_id and tr.organization_id=u.organization_id where u.organization_id=$1 order by u.created_at", [org]); res.json({ users: q.rows }); } catch { res.status(503).json({ error: "Unable to load team members." }); } });
  app.post("/api/team/sessions/revoke-all", async (req, res) => {
    const org = tenant(req, res); if (!org) return;
    if (!(await authorized(req, org))) return res.status(403).json({ error: "Você não tem permissão para encerrar as sessões." });
    try {
      await pool.query("update organizations set sessions_revoked_at=now() where id=$1", [org]);
      await pool.query("insert into audit_events (organization_id,actor_id,action,entity_type,changes) values ($1,$2,'revoke_all_sessions','organization',$3)", [org, req.user.id, JSON.stringify({ reason: "manual_team_action" })]);
      res.setHeader("Set-Cookie", "focus_session=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0");
      res.json({ revoked: true });
    } catch { res.status(503).json({ error: "Não foi possível encerrar as sessões." }); }
  });
  app.post("/api/time-entry-timer/start", async (req, res) => {
    const org = tenant(req, res); if (!org) return;
    const userId = req.user?.id, projectId = req.body?.project_id || null, taskId = req.body?.task_id || null;
    try {
      const existing = await pool.query("select id from time_entries where organization_id=$1 and user_id=$2 and ended_at is null order by started_at desc limit 1", [org, userId]);
      if (existing.rowCount) return res.status(409).json({ error: "Já existe um cronômetro em andamento para este usuário." });
      if (projectId || taskId) await ctx.validateRelations({ ...(projectId ? { project_id: projectId } : {}), ...(taskId ? { task_id: taskId } : {}) }, org);
      const q = await pool.query("insert into time_entries (organization_id,user_id,project_id,task_id,started_at,billable,status,notes) values ($1,$2,$3,$4,now(),$5,'pending',$6) returning *", [org, userId, projectId, taskId, Boolean(req.body?.billable), text(req.body?.notes) || null]);
      res.status(201).json({ time_entry: q.rows[0] });
    } catch (error) { if (error.code === "invalid_relation") return res.status(400).json({ error: error.message }); res.status(503).json({ error: "Não foi possível iniciar o cronômetro." }); }
  });
  app.post("/api/time-entry-timer/:id/stop", async (req, res) => {
    const org = tenant(req, res); if (!org) return;
    try {
      const found = await pool.query("select id,user_id from time_entries where id=$1 and organization_id=$2 and ended_at is null", [req.params.id, org]);
      if (!found.rowCount) return res.status(404).json({ error: "Cronômetro não encontrado ou já finalizado." });
      if (String(found.rows[0].user_id) !== String(req.user?.id) && !(await authorized(req, org))) return res.status(403).json({ error: "Você não tem permissão para finalizar este cronômetro." });
      const q = await pool.query("update time_entries set ended_at=now(),minutes=greatest(0,floor(extract(epoch from (now()-started_at))/60)::int),updated_at=now() where id=$1 and organization_id=$2 returning *", [req.params.id, org]);
      res.json({ time_entry: q.rows[0] });
    } catch { res.status(503).json({ error: "Não foi possível finalizar o cronômetro." }); }
  });
  app.get("/api/team/dashboard", async (req, res) => {
    const org = tenant(req, res); if (!org) return;
    const query = (sql, params = [org]) => pool.query(sql, params).catch(() => ({ rows: [{ total: 0 }] }));
    try {
      const [members, tasks, projects, hours, tickets, events, absences] = await Promise.all([
        query("select count(*)::int total,count(*) filter (where coalesce(access_status,'active')='active')::int active,count(*) filter (where access_status in ('inactive','blocked'))::int inactive,count(*) filter (where availability='online')::int online,count(*) filter (where availability='available')::int available,count(*) filter (where availability='busy')::int busy from users where organization_id=$1"),
        query("select count(*) filter (where status <> 'done')::int pending,count(*) filter (where status <> 'done' and due_at < now())::int overdue from tasks where organization_id=$1"),
        query("select responsible,count(*)::int total from projects where organization_id=$1 group by responsible order by total desc"),
        query("select coalesce(sum(minutes),0)::int total_minutes from time_entries where organization_id=$1 and status <> 'rejected'"),
        query("select count(*)::int total from tickets where organization_id=$1 and status in ('new','open','in_analysis','in_progress')"),
        query("select id,title,starts_at from events where organization_id=$1 and starts_at >= now() order by starts_at limit 5"),
        query("select id,user_id,kind,starts_on,ends_on from absences where organization_id=$1 and ends_on >= current_date order by starts_on limit 10"),
      ]);
      res.json({ members: members.rows[0] || {}, tasks: tasks.rows[0] || {}, projects_by_responsible: projects.rows, hours: hours.rows[0] || {}, tickets: tickets.rows[0] || {}, upcoming_events: events.rows, absences: absences.rows });
    } catch { res.status(503).json({ error: "Não foi possível carregar o painel da equipe." }); }
  });
  app.use("/api/team/:id/profile", async (req, res, next) => {
    if (req.method !== "PATCH" || !req.body?.manager_id) return next();
    const org = tenant(req, res); if (!org) return;
    try { const q = await pool.query("select id from users where id=$1 and organization_id=$2", [req.body.manager_id, org]); if (!q.rowCount) return res.status(400).json({ error: "O gestor informado não pertence ao workspace." }); return next(); } catch { return res.status(503).json({ error: "Não foi possível validar o gestor." }); }
  });
  app.patch("/api/team/:id/profile", async (req, res) => {
    const org = tenant(req, res); if (!org) return;
    if (String(req.params.id) !== String(req.user?.id) && !(await authorized(req, org))) return res.status(403).json({ error: "Você não tem permissão." });
    const fields = ["avatar_url", "document", "birth_date", "phone", "whatsapp", "address", "emergency_contact", "job_title", "department", "employment_type", "started_on", "work_schedule", "hourly_rate", "monthly_rate", "commission_rate", "skills", "experience_level", "manager_id", "access_expires_on", "two_factor_enabled", "availability"];
    const update = fields.filter((field) => Object.prototype.hasOwnProperty.call(req.body || {}, field));
    if (!update.length) return res.status(400).json({ error: "Informe ao menos um campo profissional." });
    try { const q = await pool.query(`update users set ${update.map((field, i) => `${field}=$${i + 1}`).join(",")} where id=$${update.length + 1} and organization_id=$${update.length + 2} returning id,name,email,role,access_status,job_title,department,employment_type,started_on,work_schedule,hourly_rate,monthly_rate,commission_rate,skills,experience_level,availability`, [...update.map((field) => req.body[field]), req.params.id, org]); if (!q.rowCount) return res.status(404).json({ error: "Membro não encontrado." }); res.json({ user: q.rows[0] }); } catch { res.status(400).json({ error: "Não foi possível salvar os dados profissionais." }); }
  });
  app.patch("/api/team/:id/access", async (req, res) => {
    const org = tenant(req, res); if (!org) return;
    if (!(await authorized(req, org))) return res.status(403).json({ error: "Você não tem permissão." });
    if (String(req.params.id) === String(req.user?.id)) return res.status(400).json({ error: "Você não pode encerrar o próprio acesso." });
    const accessStatus = text(req.body?.access_status) || "inactive";
    if (!["active", "inactive", "blocked"].includes(accessStatus)) return res.status(400).json({ error: "Status de acesso inválido." });
    try {
      const target = await pool.query("select id,role from users where id=$1 and organization_id=$2", [req.params.id, org]);
      if (!target.rowCount) return res.status(404).json({ error: "Membro não encontrado." });
      if (target.rows[0].role === "owner" && (await roleOf(req, org)) !== "owner") return res.status(403).json({ error: "Apenas proprietários podem alterar o acesso de um proprietário." });
      const q = await pool.query("update users set access_status=$1,access_revoked_at=case when $1='active' then null else now() end,deactivated_at=case when $1='active' then null else now() end where id=$2 and organization_id=$3 returning id,name,email,role,access_status,created_at", [accessStatus, req.params.id, org]);
      if (accessStatus !== "active") await pool.query("insert into team_access_events (organization_id,user_id,access_status) values ($1,$2,$3)", [org, req.params.id, accessStatus]);
      res.json({ user: q.rows[0] });
    } catch { res.status(503).json({ error: "Não foi possível atualizar o acesso." }); }
  });
}
