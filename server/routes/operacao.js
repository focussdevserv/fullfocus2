/* Rotas específicas da operação: contratos, projetos, arquivos e tickets. */
export function register(app, ctx) {
  const { pool, tenant, asText, classifyDbError, validateRelations } = ctx;
  const fail = (res, err, fallback) => { const out = classifyDbError(err, fallback); res.status(out.status).json({ error: out.error }); };
  const run = (table, singular, fields, validate = () => null) => {
    app.get(`/api/${table}`, async (req, res) => { const org = tenant(req, res); if (!org) return; try {
      const joins = fields.includes("client_id") ? ` left join clients c on c.id=${table}.client_id and c.organization_id=${table}.organization_id` : "";
      const contractJoin = fields.includes("contract_id") ? ` left join contracts co on co.id=${table}.contract_id and co.organization_id=${table}.organization_id` : "";
      const projectJoin = fields.includes("project_id") ? ` left join projects pr on pr.id=${table}.project_id and pr.organization_id=${table}.organization_id` : "";
      const select = `${table}.*${fields.includes("client_id") ? ", c.name client_name" : ""}${fields.includes("contract_id") ? ", co.name contract_name" : ""}${fields.includes("project_id") ? ", pr.name project_name" : ""}`;
      const q = await pool.query(`select ${select} from ${table}${joins}${contractJoin}${projectJoin} where ${table}.organization_id=$1 order by ${table}.created_at desc`, [org]); res.json({ [table]: q.rows });
    } catch (e) { fail(res, e, `Não foi possível carregar ${table}.`); } });
    app.post(`/api/${table}`, async (req, res) => { const org = tenant(req, res); if (!org) return; const issue = validate(req.body || {}); if (issue) return res.status(400).json({ error: issue }); try {
      await validateRelations?.(Object.fromEntries(fields.filter((f) => f.endsWith("_id")).map((f) => [f, req.body[f] || null])), org);
      const defaults = table === "contracts" ? { status: "draft" } : table === "projects" ? { status: "active", progress: 0 } : table === "tickets" ? { priority: "medium", status: "open" } : {};
      const vals = fields.map((f) => req.body[f] === undefined || req.body[f] === "" ? (defaults[f] ?? null) : req.body[f]); const q = await pool.query(`insert into ${table} (organization_id,${fields.join(",")}) values ($1,${fields.map((_, i) => `$${i + 2}`).join(",")}) returning *`, [org, ...vals]); res.status(201).json({ [singular]: q.rows[0] });
    } catch (e) { if (e.code === "invalid_relation") return res.status(400).json({ error: e.message }); fail(res, e, `Não foi possível criar ${singular}.`); } });
    app.patch(`/api/${table}/:id`, async (req, res) => { const org = tenant(req, res); if (!org) return; const issue = validate(req.body || {}, true); if (issue) return res.status(400).json({ error: issue }); const update = fields.filter((f) => Object.prototype.hasOwnProperty.call(req.body || {}, f)); if (!update.length) return res.status(400).json({ error: "Informe ao menos um campo para atualizar." }); try {
      const vals = update.map((f) => req.body[f] === "" ? null : req.body[f]); const q = await pool.query(`update ${table} set ${update.map((f, i) => `${f}=$${i + 1}`).join(",")},updated_at=now() where id=$${update.length + 1} and organization_id=$${update.length + 2} returning *`, [...vals, req.params.id, org]); if (!q.rowCount) return res.status(404).json({ error: `${singular} não encontrado.` }); res.json({ [singular]: q.rows[0] });
    } catch (e) { fail(res, e, `Não foi possível atualizar ${singular}.`); } });
    app.delete(`/api/${table}/:id`, async (req, res) => { const org = tenant(req, res); if (!org) return; try { const q = await pool.query(`delete from ${table} where id=$1 and organization_id=$2 returning id`, [req.params.id, org]); if (!q.rowCount) return res.status(404).json({ error: `${singular} não encontrado.` }); res.status(204).end(); } catch (e) { fail(res, e, `Não foi possível excluir ${singular}.`); } });
  };
  const oneOf = (key, values) => (body) => (body[key] !== undefined && body[key] !== "" && !values.includes(body[key]) ? `Valor inválido para ${key}.` : null);
  run("contracts", "contract", ["name", "client_id", "value", "starts_on", "ends_on", "status"], (b, p) => oneOf("status", ["draft", "active", "expired", "cancelled"])(b) || (!p && (!asText(b.name) || !b.client_id || !Number.isFinite(Number(b.value)) || Number(b.value) < 0) ? "Informe nome, cliente e valor válidos." : null));
  run("projects", "project", ["name", "client_id", "contract_id", "status", "progress"], (b, p) => oneOf("status", ["planning", "active", "paused", "done"])(b) || (b.progress !== undefined && (!Number.isFinite(Number(b.progress)) || Number(b.progress) < 0 || Number(b.progress) > 100) ? "O progresso deve estar entre 0 e 100." : (!p && !asText(b.name) ? "Informe o nome do projeto." : null)));
  run("files", "file", ["name", "url", "kind", "size_bytes", "project_id", "client_id"], (b, p) => !p && (!asText(b.name) || !asText(b.url) ? "Informe nome e URL válidos." : null));
  run("tickets", "ticket", ["title", "description", "client_id", "priority", "status", "due_at"], (b, p) => { const a = oneOf("priority", ["low", "medium", "high", "urgent"])(b) || oneOf("status", ["open", "in_progress", "waiting", "done"])(b); return a || (!p && !asText(b.title) ? "Informe o título do ticket." : null); });
}
