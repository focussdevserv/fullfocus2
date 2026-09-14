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
  const projectFields = ["name", "client_id", "contract_id", "status", "progress", "internal_code", "project_type", "description", "responsible", "team", "priority", "current_stage", "starts_on", "due_on", "completed_on", "block_reason", "next_action", "next_action_at", "objective", "audience", "features", "modules", "integrations", "visual_identity", "technologies", "requirements", "out_of_scope", "technical_notes", "completion_criteria", "domain", "domain_provider", "hosting_provider", "repository_url", "development_url", "staging_url", "production_url", "database_provider", "external_apis", "access_storage_reference", "total_value", "down_payment", "payment_status", "payment_method", "installments", "installment_value", "payment_due_dates", "discount", "additional_costs", "server_monthly_cost", "maintenance_monthly_value", "api_service_costs", "financial_notes", "pending_items", "observations", "published_at", "delivered", "acceptance_signed", "training_done", "warranty_until", "support_period", "maintenance_plan", "recurring_value", "next_renewal_on", "backup_done", "source_delivered", "accesses_transferred", "final_notes"];
  const projectStatuses = ["lead", "quote", "awaiting_approval", "planning", "active", "in_review", "awaiting_client", "testing", "done", "published", "maintenance", "cancelled", "paused"];
  const projectPriorities = ["low", "medium", "high", "urgent"];
  run("projects", "project", projectFields, (b, p) => {
    const statusIssue = oneOf("status", projectStatuses)(b);
    const priorityIssue = oneOf("priority", projectPriorities)(b);
    const progressIssue = b.progress !== undefined && (!Number.isFinite(Number(b.progress)) || Number(b.progress) < 0 || Number(b.progress) > 100) ? "O progresso deve estar entre 0 e 100." : null;
    const urlIssue = ["repository_url", "development_url", "staging_url", "production_url"].some((key) => b[key] !== undefined && b[key] !== "" && !/^https?:\/\//i.test(String(b[key]))) ? "Os links do projeto devem começar com http:// ou https://." : null;
    return statusIssue || priorityIssue || progressIssue || urlIssue || (!p && !asText(b.name) ? "Informe o nome do projeto." : null);
  });
  app.get("/api/projects/github-preview", async (req, res) => {
    const org = tenant(req, res); if (!org) return;
    const raw = String(req.query.url || "").trim();
    let parsed;
    try { parsed = new URL(raw); } catch { return res.status(400).json({ error: "Informe uma URL válida do GitHub." }); }
    if (parsed.protocol !== "https:" || !["github.com", "www.github.com"].includes(parsed.hostname.toLowerCase())) return res.status(400).json({ error: "Apenas repositórios públicos do github.com são aceitos." });
    const parts = parsed.pathname.split("/").filter(Boolean);
    if (parts.length < 2) return res.status(400).json({ error: "Informe o link completo do repositório GitHub." });
    const apiUrl = `https://api.github.com/repos/${encodeURIComponent(parts[0])}/${encodeURIComponent(parts[1].replace(/\.git$/, ""))}`;
    try {
      const response = await fetch(apiUrl, { headers: { accept: "application/vnd.github+json", "user-agent": "FocusDev-CRM" }, signal: AbortSignal.timeout(8000) });
      if (!response.ok) return res.status(response.status === 404 ? 404 : 502).json({ error: response.status === 404 ? "Repositório não encontrado ou privado." : "O GitHub não respondeu agora." });
      const repo = await response.json();
      res.json({ name: repo.name, description: repo.description || "", repository_url: repo.html_url, production_url: repo.homepage || "", technologies: (repo.language ? [repo.language] : []).concat(repo.topics || []).filter(Boolean).join(", "), project_type: repo.language ? "web_system" : "other", domain: repo.homepage || "", observations: repo.license?.name ? `Licença: ${repo.license.name}` : "", github: { owner: repo.owner?.login, stars: repo.stargazers_count, forks: repo.forks_count, private: repo.private, updated_at: repo.updated_at } });
    } catch { res.status(502).json({ error: "Não foi possível consultar o GitHub agora." }); }
  });
  app.get("/api/projects/:id/overview", async (req, res) => { const org = tenant(req, res); if (!org) return; try { const project = await pool.query("select p.*, c.name client_name from projects p left join clients c on c.id=p.client_id and c.organization_id=p.organization_id where p.id=$1 and p.organization_id=$2", [req.params.id, org]); if (!project.rowCount) return res.status(404).json({ error: "Projeto não encontrado." }); const [tasks, files, receivables] = await Promise.all([pool.query("select * from tasks where project_id=$1 and organization_id=$2 order by due_at asc nulls last", [req.params.id, org]), pool.query("select * from files where project_id=$1 and organization_id=$2 order by created_at desc", [req.params.id, org]), pool.query("select coalesce(sum(amount),0) total from receivables where project_id=$1 and organization_id=$2 and paid_at is null", [req.params.id, org]).catch(() => ({ rows: [{ total: 0 }] }))]); res.json({ project: project.rows[0], tasks: tasks.rows, files: files.rows, balance_receivable: receivables.rows[0]?.total || 0, overdue_tasks: tasks.rows.filter((task) => task.status !== "done" && task.due_at && new Date(task.due_at) < new Date()).length }); } catch (e) { fail(res, e, "Não foi possível carregar o resumo do projeto."); } });
  run("files", "file", ["name", "url", "kind", "size_bytes", "project_id", "client_id"], (b, p) => !p && (!asText(b.name) || !asText(b.url) ? "Informe nome e URL válidos." : null));
  run("tickets", "ticket", ["title", "description", "client_id", "priority", "status", "due_at"], (b, p) => { const a = oneOf("priority", ["low", "medium", "high", "urgent"])(b) || oneOf("status", ["open", "in_progress", "waiting", "done"])(b); return a || (!p && !asText(b.title) ? "Informe o título do ticket." : null); });
}
