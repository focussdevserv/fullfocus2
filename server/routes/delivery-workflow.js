export function registerDeliveryWorkflowRoutes(app, { pool, tenant, classifyDbError }) {
  const fail = (res, error, fallback) => { const out = classifyDbError(error, fallback); res.status(out.status).json({ error: out.error }); };
  app.post("/api/deliveries/:id/publish", async (req, res) => {
    const org = tenant(req, res); if (!org) return;
    let db;
    try {
      db = pool.connect ? await pool.connect() : pool; await db.query("begin");
      const current = await db.query("select * from deliveries where id=$1 and organization_id=$2 for update", [req.params.id, org]);
      if (!current.rowCount) { await db.query("rollback"); return res.status(404).json({ error: "Entrega não encontrada." }); }
      const source = current.rows[0];
      if (["cancelled", "approved"].includes(source.status)) { await db.query("rollback"); return res.status(400).json({ error: "Esta entrega não pode ser publicada novamente." }); }
      if (source.status === "published") { await db.query("commit"); db.release?.(); return res.json({ delivery: source, published: false }); }
      if (source.published_url && !/^https?:\/\//i.test(source.published_url)) { await db.query("rollback"); return res.status(400).json({ error: "O link publicado deve usar http:// ou https://." }); }
      if (source.status !== "draft" && source.status !== "ready") { await db.query("rollback"); return res.status(400).json({ error: "A entrega precisa estar em rascunho ou pronta para publicação." }); }
      await db.query("insert into delivery_publication_history (organization_id,delivery_id,version,environment,published_url,status,published_at) values ($1,$2,$3,$4,$5,$6,$7)", [org, source.id, source.version, source.environment, source.published_url, source.status, source.published_at]);
      const updated = await db.query("update deliveries set status='published',published_at=now(),updated_at=now() where id=$1 and organization_id=$2 returning *", [source.id, org]); await db.query("commit"); db.release?.(); res.status(201).json({ delivery: updated.rows[0], published: true });
    } catch (error) { await db?.query("rollback").catch(() => {}); db?.release?.(); fail(res, error, "Não foi possível publicar a entrega."); }
  });
  app.post("/api/deliveries/:id/rollback", async (req, res) => {
    const org = tenant(req, res); if (!org) return;
    let db;
    try { db = pool.connect ? await pool.connect() : pool; await db.query("begin"); const previous = await db.query("select * from delivery_publication_history where delivery_id=$1 and organization_id=$2 order by created_at desc,id desc limit 1", [req.params.id, org]); if (!previous.rowCount) { await db.query("rollback"); db.release?.(); return res.status(404).json({ error: "Nenhuma versão anterior encontrada." }); } const snapshot = previous.rows[0]; const updated = await db.query("update deliveries set version=$1,environment=$2,published_url=$3,status=$4,published_at=$5,client_approved=false,updated_at=now() where id=$6 and organization_id=$7 returning *", [snapshot.version, snapshot.environment, snapshot.published_url, snapshot.status, snapshot.published_at, req.params.id, org]); if (!updated.rowCount) { await db.query("rollback"); db.release?.(); return res.status(404).json({ error: "Entrega não encontrada." }); } await db.query("delete from delivery_publication_history where id=$1 and organization_id=$2", [snapshot.id, org]); await db.query("commit"); db.release?.(); res.json({ delivery: updated.rows[0], rolled_back: true }); } catch (error) { await db?.query("rollback").catch(() => {}); db?.release?.(); fail(res, error, "Não foi possível reverter a entrega."); }
  });
}
