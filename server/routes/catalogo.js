const FIELDS = ["name", "kind", "price", "unit", "description", "active", "sku", "short_description", "full_description", "category", "image_url", "tags", "public_visible", "highlighted", "term_days", "features", "limits", "recurrence", "benefits", "delivery_days", "included_scope", "excluded_scope", "deliverables", "modules_count", "revisions_count", "warranty_period", "support_included", "client_responsibilities", "technical_requirements", "internal_notes", "min_price", "promotional_price", "internal_cost", "billing_type", "entry_price", "max_installments", "max_discount", "sales_commission", "estimated_taxes"];
const KINDS = ["product", "service", "package", "plan", "subscription", "addon"];
const text = (value) => String(value ?? "").trim();
const validate = (body, partial = false) => {
  if (!partial && !text(body.name)) return "Informe o nome do item.";
  if (body.kind !== undefined && !KINDS.includes(body.kind)) return "Tipo inválido.";
  if (body.price !== undefined && (!Number.isFinite(Number(body.price)) || Number(body.price) < 0)) return "Preço inválido.";
  return null;
};

export function register(app, ctx) {
  const { pool, tenant, classifyDbError } = ctx;
  const fail = (res, error, message) => { const out = classifyDbError(error, message); res.status(out.status).json({ error: out.error }); };
  app.get("/api/catalog-items", async (req, res) => {
    const org = tenant(req, res); if (!org) return;
    try { const q = await pool.query("select * from catalog_items where organization_id=$1 order by created_at desc", [org]); res.json({ catalog_items: q.rows }); } catch (error) { fail(res, error, "Não foi possível carregar o catálogo."); }
  });
  app.post("/api/catalog-items", async (req, res) => {
    const org = tenant(req, res); if (!org) return;
    const issue = validate(req.body || {}); if (issue) return res.status(400).json({ error: issue });
    try {
      const body = req.body || {};
      const values = FIELDS.map((field) => body[field] === undefined ? (field === "kind" ? "service" : field === "price" ? 0 : ["active", "public_visible"].includes(field) ? true : ["archived", "highlighted"].includes(field) ? false : null) : body[field]);
      const q = await pool.query(`insert into catalog_items (organization_id,${FIELDS.join(",")}) values ($1,${FIELDS.map((_, i) => `$${i + 2}`).join(",")}) returning *`, [org, ...values]);
      res.status(201).json({ catalog_item: q.rows[0] });
    } catch (error) { fail(res, error, "Não foi possível criar o item."); }
  });
  app.patch("/api/catalog-items/:id", async (req, res) => {
    const org = tenant(req, res); if (!org) return;
    const issue = validate(req.body || {}, true); if (issue) return res.status(400).json({ error: issue });
    const update = FIELDS.filter((field) => req.body?.[field] !== undefined); if (!update.length) return res.status(400).json({ error: "Informe um campo para atualizar." });
    try { const q = await pool.query(`update catalog_items set ${update.map((field, i) => `${field}=$${i + 1}`).join(",")},updated_at=now() where id=$${update.length + 1} and organization_id=$${update.length + 2} returning *`, [...update.map((field) => req.body[field]), req.params.id, org]); if (!q.rowCount) return res.status(404).json({ error: "Item não encontrado." }); res.json({ catalog_item: q.rows[0] }); } catch (error) { fail(res, error, "Não foi possível atualizar o item."); }
  });
  app.delete("/api/catalog-items/:id", async (req, res) => {
    const org = tenant(req, res); if (!org) return;
    try { const q = await pool.query("delete from catalog_items where id=$1 and organization_id=$2 returning id", [req.params.id, org]); if (!q.rowCount) return res.status(404).json({ error: "Item não encontrado." }); res.status(204).end(); } catch (error) { fail(res, error, "Não foi possível excluir o item."); }
  });
}

export { FIELDS, KINDS };
