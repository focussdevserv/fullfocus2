export function registerPortalAdminRoutes(app, { pool, tenant, hashPassword }) {
  app.put("/api/clients/:id/portal-access", async (req, res) => {
    const org = tenant(req, res); if (!org) return;
    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = String(req.body?.password || "");
    if (!/^\S+@\S+\.\S+$/.test(email) || password.length < 8) return res.status(400).json({ error: "Informe e-mail válido e senha com pelo menos 8 caracteres." });
    try {
      const client = await pool.query("select id from clients where id=$1 and organization_id=$2", [req.params.id, org]);
      if (!client.rowCount) return res.status(404).json({ error: "Cliente não encontrado." });
      const link = await pool.query("select id from client_portal_links where client_id=$1 and organization_id=$2 order by created_at desc limit 1", [req.params.id, org]);
      if (!link.rowCount) return res.status(404).json({ error: "Gere um link do portal antes de configurar o acesso." });
      const { salt, hash } = hashPassword(password);
      await pool.query("update client_portal_links set login_email=$1,password_salt=$2,password_hash=$3,portal_auth_enabled=true where id=$4 and organization_id=$5", [email, salt, hash, link.rows[0].id, org]);
      return res.json({ configured: true, email });
    } catch { return res.status(503).json({ error: "Não foi possível configurar o acesso do portal." }); }
  });
}
