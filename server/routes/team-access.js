export function register(app, ctx) {
  const { pool, tenant } = ctx;
  const text = (value) => typeof value === "string" ? value.trim() : "";
  const roleOf = async (req, org) => (await pool.query("select role from users where id=$1 and organization_id=$2", [req.user?.id, org])).rows[0]?.role || null;
  const authorized = async (req, org) => ["owner", "admin"].includes(await roleOf(req, org));
  app.get("/api/team/access-status", async (req, res) => { const org = tenant(req, res); if (!org) return; try { const q = await pool.query("select id,name,email,role,access_status,created_at from users where organization_id=$1 order by created_at", [org]); res.json({ users: q.rows }); } catch { res.status(503).json({ error: "Não foi possível carregar a equipe." }); } });
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
      res.json({ user: q.rows[0] });
    } catch { res.status(503).json({ error: "Não foi possível atualizar o acesso." }); }
  });
}
