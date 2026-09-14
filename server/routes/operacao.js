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
      if (table === "contracts") await validateContractLinks(req.body || {}, org);
      await validateRelations?.(Object.fromEntries(fields.filter((f) => f.endsWith("_id")).map((f) => [f, req.body[f] || null])), org);
      const defaults = table === "contracts" ? { status: "draft" } : table === "projects" ? { status: "active", progress: 0 } : table === "tickets" ? { priority: "medium", status: "open" } : {};
      if (table === "contracts" && !req.body.contract_number) { const seq = await pool.query("select count(*)::int total from contracts where organization_id=$1 and extract(year from created_at)=extract(year from current_date)", [org]); defaults.contract_number = `CONT-${new Date().getFullYear()}-${String(Number(seq.rows[0]?.total || 0) + 1).padStart(3, "0")}`; }
      const vals = fields.map((f) => req.body[f] === undefined || req.body[f] === "" ? (defaults[f] ?? null) : req.body[f]); const q = await pool.query(`insert into ${table} (organization_id,${fields.join(",")}) values ($1,${fields.map((_, i) => `$${i + 2}`).join(",")}) returning *`, [org, ...vals]); res.status(201).json({ [singular]: q.rows[0] });
    } catch (e) { if (e.code === "invalid_relation") return res.status(400).json({ error: e.message }); fail(res, e, `Não foi possível criar ${singular}.`); } });
    app.patch(`/api/${table}/:id`, async (req, res) => { const org = tenant(req, res); if (!org) return; const issue = validate(req.body || {}, true); if (issue) return res.status(400).json({ error: issue }); const update = fields.filter((f) => Object.prototype.hasOwnProperty.call(req.body || {}, f)); if (!update.length) return res.status(400).json({ error: "Informe ao menos um campo para atualizar." }); try {
      if (table === "contracts" && (update.includes("proposal_id") || update.includes("project_id") || update.includes("client_id"))) { const current = await pool.query("select proposal_id,project_id,client_id from contracts where id=$1 and organization_id=$2", [req.params.id, org]); if (!current.rowCount) return res.status(404).json({ error: `${singular} nÃ£o encontrado.` }); await validateContractLinks(req.body || {}, org, current.rows[0]); }
      const vals = update.map((f) => req.body[f] === "" ? null : req.body[f]); const q = await pool.query(`update ${table} set ${update.map((f, i) => `${f}=$${i + 1}`).join(",")},updated_at=now() where id=$${update.length + 1} and organization_id=$${update.length + 2} returning *`, [...vals, req.params.id, org]); if (!q.rowCount) return res.status(404).json({ error: `${singular} não encontrado.` }); res.json({ [singular]: q.rows[0] });
    } catch (e) { fail(res, e, `Não foi possível atualizar ${singular}.`); } });
    app.delete(`/api/${table}/:id`, async (req, res) => { const org = tenant(req, res); if (!org) return; try { const q = await pool.query(`delete from ${table} where id=$1 and organization_id=$2 returning id`, [req.params.id, org]); if (!q.rowCount) return res.status(404).json({ error: `${singular} não encontrado.` }); res.status(204).end(); } catch (e) { fail(res, e, `Não foi possível excluir ${singular}.`); } });
  };
  const oneOf = (key, values) => (body) => (body[key] !== undefined && body[key] !== "" && !values.includes(body[key]) ? `Valor inválido para ${key}.` : null);
  const validateContractLinks = async (body, org, current = {}) => {
    const proposalId = body.proposal_id ?? current.proposal_id;
    const projectId = body.project_id ?? current.project_id;
    const clientId = body.client_id ?? current.client_id;
    let proposal = null;
    if (proposalId) {
      const result = await pool.query("select id,status,client_id,project_id from proposals where id=$1 and organization_id=$2", [proposalId, org]);
      proposal = result.rows[0];
      if (!proposal) { const error = new Error("A proposta não pertence a este workspace."); error.code = "invalid_relation"; throw error; }
      if (proposal.status !== "accepted") { const error = new Error("A proposta precisa estar aprovada para gerar o contrato."); error.code = "invalid_relation"; throw error; }
      if (clientId && proposal.client_id && String(clientId) !== String(proposal.client_id)) { const error = new Error("O cliente do contrato deve ser o mesmo da proposta."); error.code = "invalid_relation"; throw error; }
    }
    if (projectId) {
      const result = await pool.query("select id,client_id from projects where id=$1 and organization_id=$2", [projectId, org]);
      const project = result.rows[0];
      if (!project) { const error = new Error("O projeto não pertence a este workspace."); error.code = "invalid_relation"; throw error; }
      if (clientId && project.client_id && String(clientId) !== String(project.client_id)) { const error = new Error("O cliente do contrato deve ser o mesmo do projeto."); error.code = "invalid_relation"; throw error; }
      if (proposal?.project_id && String(projectId) !== String(proposal.project_id)) { const error = new Error("O projeto do contrato deve ser o mesmo da proposta."); error.code = "invalid_relation"; throw error; }
    }
  };
  const contractFields = ["name", "client_id", "value", "starts_on", "ends_on", "status", "contract_number", "contract_type", "proposal_id", "project_id", "issued_on", "description", "scope_included", "scope_excluded", "deliverables", "technologies", "milestones", "client_approval_days", "client_responsibilities", "provider_responsibilities", "revisions_included", "change_policy", "additional_change_value", "total_value", "down_payment", "discount", "installments", "installment_value", "payment_method", "payment_due_dates", "late_fee", "late_interest", "payment_rules", "maintenance_monthly", "hosting_monthly", "server_monthly", "domain_monthly", "apis_monthly", "licenses_monthly", "recurring_due_on", "recurring_rules", "warranty_period", "support_period", "intellectual_property", "cancellation_terms", "data_protection_terms", "signature_data"];
  const contractStatuses = ["draft", "in_review", "sent", "viewed", "awaiting_signature", "signed", "active", "near_expiry", "closed", "cancelled", "expired"];
  app.get("/api/contracts", async (req, res) => { const org = tenant(req, res); if (!org) return; const filters = [["client_id", req.query.client_id], ["proposal_id", req.query.proposal_id], ["project_id", req.query.project_id], ["status", req.query.status]].filter(([, value]) => value !== undefined && value !== ""); const values = [org]; const where = ["c.organization_id=$1"]; for (const [field, value] of filters) { values.push(String(value)); where.push(`c.${field}=$${values.length}`); } try { const q = await pool.query(`select c.*, cl.name client_name from contracts c left join clients cl on cl.id=c.client_id and cl.organization_id=c.organization_id where ${where.join(" and ")} order by c.created_at desc`, values); res.json({ contracts: q.rows }); } catch (e) { fail(res, e, "NÃ£o foi possÃ­vel carregar contratos."); } });
  run("contracts", "contract", contractFields, (b, p) => oneOf("status", contractStatuses)(b) || (!p && (!asText(b.name) || !b.client_id || !Number.isFinite(Number(b.value ?? b.total_value ?? 0)) || Number(b.value ?? b.total_value ?? 0) < 0) ? "Informe nome, cliente e valor válidos." : null));
  app.get("/api/contracts/autofill", async (req, res) => { const org = tenant(req, res); if (!org) return; const proposalId = req.query.proposal_id, projectId = req.query.project_id, clientId = req.query.client_id; if (!proposalId && !projectId && !clientId) return res.status(400).json({ error: "Informe proposta, projeto ou cliente." }); try { const [proposal, project, clientResult] = await Promise.all([proposalId ? pool.query("select p.*,o.name opportunity_name,o.amount opportunity_amount from proposals p left join opportunities o on o.id=p.opportunity_id and o.organization_id=p.organization_id where p.id=$1 and p.organization_id=$2", [proposalId, org]) : { rows: [] }, projectId ? pool.query("select * from projects where id=$1 and organization_id=$2", [projectId, org]) : { rows: [] }, clientId ? pool.query("select * from clients where id=$1 and organization_id=$2", [clientId, org]) : { rows: [] }]); const p = proposal.rows[0], pr = project.rows[0]; let c = clientResult.rows[0]; if (!c && p?.client_id) { const linkedClient = await pool.query("select * from clients where id=$1 and organization_id=$2", [p.client_id, org]); c = linkedClient.rows[0]; } if (!c && pr?.client_id) { const linkedClient = await pool.query("select * from clients where id=$1 and organization_id=$2", [pr.client_id, org]); c = linkedClient.rows[0]; } if (p && p.status !== "accepted") return res.status(400).json({ error: "A proposta precisa estar aprovada para gerar o contrato." }); if (!p && !pr && !c) return res.status(404).json({ error: "Nenhum registro encontrado." }); const amount = Number(p?.final_amount || p?.amount || pr?.total_value || 0); res.json({ name: p?.title || pr?.name || "Contrato de prestação de serviços", client_id: c?.id || p?.client_id || pr?.client_id || null, proposal_id: p?.id || null, project_id: pr?.id || p?.project_id || null, value: amount, total_value: amount, down_payment: p?.down_payment || pr?.down_payment || 0, discount: p?.discount || pr?.discount || 0, installments: p?.installments || pr?.installments || 1, installment_value: p?.installment_amount || pr?.installment_value || 0, payment_method: p?.payment_method || c?.preferred_payment_method || "", payment_due_dates: p?.payment_due_dates || "", description: pr?.description || p?.objective || p?.notes || "", scope_included: p?.scope_included || pr?.features || pr?.requirements || "", scope_excluded: p?.scope_excluded || pr?.out_of_scope || "", deliverables: p?.modules || "", technologies: p?.technologies || pr?.technologies || "", milestones: pr?.current_stage || "", provider_responsibilities: p?.responsibilities_provider || "Desenvolver o escopo contratado e comunicar o andamento.", client_responsibilities: p?.responsibilities_client || "Fornecer materiais, aprovar etapas e efetuar pagamentos.", warranty_period: "", support_period: pr?.support_period || "", customer: c ? { name: c.name, legal_name: c.legal_name, document: c.document, email: c.email, phone: c.phone, address: [c.street, c.street_number, c.city, c.state].filter(Boolean).join(", ") } : null }); } catch (e) { fail(res, e, "Não foi possível preparar o contrato."); } });
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
  app.post("/api/contracts/:id/create-project", async (req, res) => {
    const org = tenant(req, res); if (!org) return;
    const db = pool.connect ? await pool.connect() : pool;
    try {
      await db.query("begin");
      const contract = await db.query("select * from contracts where id=$1 and organization_id=$2 for update", [req.params.id, org]);
      if (!contract.rowCount) { await db.query("rollback"); return res.status(404).json({ error: "Contrato não encontrado." }); }
      const source = contract.rows[0];
      if (!["signed", "active"].includes(source.status)) { await db.query("rollback"); return res.status(400).json({ error: "O contrato precisa estar assinado ou ativo para criar o projeto." }); }
      if (source.project_id) {
        const existing = await db.query("select * from projects where id=$1 and organization_id=$2", [source.project_id, org]);
        if (existing.rowCount) { await db.query("commit"); return res.status(200).json({ project: existing.rows[0], created: false }); }
      }
      const code = `PROJ-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
      const project = await db.query("insert into projects (organization_id,contract_id,client_id,name,status,progress,internal_code,total_value,down_payment,payment_method,installments,installment_value,payment_due_dates,discount,maintenance_monthly_value,support_period,observations) values ($1,$2,$3,$4,'planning',0,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) returning *", [org, source.id, source.client_id, source.name, code, source.total_value ?? source.value ?? 0, source.down_payment ?? 0, source.payment_method, source.installments ?? 1, source.installment_value ?? 0, source.payment_due_dates, source.discount ?? 0, source.maintenance_monthly ?? 0, source.support_period, "Projeto criado automaticamente a partir do contrato."]);
      await db.query("update contracts set project_id=$1, updated_at=now() where id=$2 and organization_id=$3", [project.rows[0].id, source.id, org]);
      await db.query("commit");
      res.status(201).json({ project: project.rows[0], created: true });
    } catch (e) { await db.query("rollback").catch(() => {}); fail(res, e, "Não foi possível criar o projeto a partir do contrato."); }
    finally { db.release?.(); }
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
  run("tickets", "ticket", ["title", "description", "client_id", "priority", "status", "due_at"], (b, p) => { const a = oneOf("priority", ["low", "medium", "high", "urgent"])(b) || oneOf("status", ["new", "open", "in_analysis", "in_progress", "waiting_client", "waiting_third_party", "resolved", "closed", "reopened", "cancelled"])(b); return a || (!p && !asText(b.title) ? "Informe o título do ticket." : null); });
}
