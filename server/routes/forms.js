export function registerFormRoutes(app, { pool, tenant }) {
  app.get("/api/forms/:id/responses", async (req, res) => {
    const org = tenant(req, res); if (!org) return;
    if (!/^\d+$/.test(String(req.params.id))) return res.status(400).json({ error: "Formulário inválido." });
    if (!["owner", "admin"].includes(req.user?.role)) return res.status(403).json({ error: "Apenas proprietários e administradores consultam respostas." });
    const limit = Math.min(Math.max(Number.parseInt(req.query?.limit, 10) || 50, 1), 100);
    const offset = Math.max(Number.parseInt(req.query?.offset, 10) || 0, 0);
    try {
      const q = await pool.query("select id,name,responses,submitted_at from forms where id=$1 and organization_id=$2", [req.params.id, org]);
      if (!q.rowCount) return res.status(404).json({ error: "Formulário não encontrado." });
      const raw = Array.isArray(q.rows[0].responses) ? q.rows[0].responses : [];
      const responses = raw.slice().reverse().slice(offset, offset + limit).map((entry) => {
        if (entry && typeof entry === "object" && entry.responses && typeof entry.responses === "object") return entry;
        return { responses: entry && typeof entry === "object" ? entry : {}, submitted_at: q.rows[0].submitted_at };
      });
      return res.json({ form: { id: q.rows[0].id, name: q.rows[0].name }, responses, pagination: { limit, offset, total: raw.length, returned: responses.length } });
    } catch { return res.status(503).json({ error: "Não foi possível carregar as respostas." }); }
  });
}
