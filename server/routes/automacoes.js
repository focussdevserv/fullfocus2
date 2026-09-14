import { assertSafeOutboundUrl, parseOutboundUrl } from "../outbound-url.js";

const AUTOMATION_TRIGGERS = [
  "lead_created", "lead_stage_changed", "lead_no_response", "meeting_scheduled",
  "proposal_created", "proposal_sent", "proposal_viewed", "proposal_approved",
  "contract_signed", "project_created", "task_due_soon", "task_overdue",
  "project_overdue", "receivable_due_soon", "receivable_overdue", "payment_confirmed",
  "payment_overdue", "ticket_created", "ticket_no_response", "customer_message",
  "scheduled_datetime", "webhook_received", "freelancer_project_finished", "sale_won", "team_member_invited", "member_added_to_project", "project_member_added", "task_assigned", "member_overloaded", "absence_started", "user_deactivated",
];
const AUTOMATION_ACTIONS = [
  "notify", "notify_responsible", "create_task", "send_message", "send_email", "send_onboarding", "create_followup",
  "create_charge", "generate_contract", "create_project", "update_status",
  "move_pipeline", "assign_owner", "add_tag", "webhook", "n8n_flow", "wait",
  "end", "calculate_commission", "reassign_support", "create_calendar_event",
  "request_satisfaction", "generate_document", "grant_project_access", "revoke_access",
];
const TEMPLATE_KINDS = [
  "proposal", "contract", "project", "task", "checklist", "charge", "followup",
  "support", "ticket", "briefing", "delivery_term", "report", "notification",
  "email", "message", "whatsapp",
];
const INTEGRATION_PROVIDERS = [
  "whatsapp", "email", "smtp", "google_calendar", "google_drive", "github", "n8n",
  "mercado_pago", "asaas", "stripe", "firebase", "supabase", "cnpj", "esign",
  "webhook", "api",
];

const maskIntegration = (row) => {
  if (!row || !row.config || typeof row.config !== "object") return row;
  const config = { ...row.config };
  for (const key of ["apiKey", "token", "secret", "password"]) {
    if (config[key]) config[key] = `••••${String(config[key]).slice(-4)}`;
  }
  return { ...row, config };
};
const text = (value) => String(value ?? "").trim();
const checkOneOf = (value, values, name) => value === undefined || values.includes(value) ? null : `Valor inválido para ${name}.`;
const jsonValue = (value, fallback) => value === undefined ? fallback : value;

export function register(app, ctx) {
  const { pool, tenant, asText, classifyDbError } = ctx;
  const fail = (res, error, fallback) => {
    const out = classifyDbError(error, fallback);
    res.status(out.status).json({ error: out.error });
  };
  const roleOf = async (req, org) => {
    const q = await pool.query("select role from users where id=$1 and organization_id=$2", [req.user?.id, org]);
    return q.rows[0]?.role || "member";
  };
  const canManageIntegrations = async (req, org) => ["owner", "admin"].includes(await roleOf(req, org));
  app.use("/api/templates", async (req, res, next) => {
    if (req.method !== "GET") return next();
    const org = tenant(req, res); if (!org) return;
    const search = text(req.query?.search || req.query?.q), kind = text(req.query?.kind); const params = [org], where = ["organization_id=$1"];
    if (search) { params.push(search); where.push(`(name ilike '%' || $${params.length} || '%' or coalesce(category,'') ilike '%' || $${params.length} || '%' or coalesce(body,'') ilike '%' || $${params.length} || '%')`); }
    if (TEMPLATE_KINDS.includes(kind)) { params.push(kind); where.push(`kind=$${params.length}`); }
    const limit = Math.min(Math.max(Number.parseInt(req.query?.limit, 10) || 250, 1), 250), offset = Math.max(Number.parseInt(req.query?.offset, 10) || 0, 0); params.push(limit, offset);
    try { const q = await pool.query(`select * from templates where ${where.join(" and ")} order by created_at desc limit $${params.length - 1} offset $${params.length}`, params); return res.json({ templates: q.rows, pagination: { limit, offset, returned: q.rows.length } }); } catch (error) { return fail(res, error, "Nao foi possivel carregar os templates."); }
  });

  const definitions = {
    automations: {
      path: "/api/automations", singular: "automation",
      fields: ["name", "trigger", "action", "config", "active", "description", "category", "responsible", "status", "conditions", "actions", "allowed_hours", "execution_limit", "starts_on", "ends_on", "avoid_duplicates"],
      checks: { trigger: AUTOMATION_TRIGGERS, action: AUTOMATION_ACTIONS, status: ["active", "paused", "draft", "error"] },
    },
    templates: {
      path: "/api/templates", singular: "template",
      fields: ["kind", "name", "body", "category", "subject", "language", "variables", "service_id", "favorite", "is_default", "version", "internal_notes"],
      checks: { kind: TEMPLATE_KINDS },
    },
    integrations: {
      path: "/api/integrations", singular: "integration",
      fields: ["provider", "status", "config", "category", "environment", "account_name", "last_sync_at", "enabled_events", "responsible", "granted_permissions"],
      checks: { provider: INTEGRATION_PROVIDERS, status: ["disconnected", "connected", "error"] },
    },
  };

  for (const [table, definition] of Object.entries(definitions)) {
    const { path, singular, fields, checks } = definition;
    app.get(path, async (req, res) => {
      const org = tenant(req, res); if (!org) return;
      try {
        const q = await pool.query(`select * from ${table} where organization_id=$1 order by created_at desc`, [org]);
        res.json({ [table]: table === "integrations" ? q.rows.map(maskIntegration) : q.rows });
      } catch (error) { fail(res, error, "Não foi possível carregar os registros."); }
    });
    app.post(path, async (req, res) => {
      const org = tenant(req, res); if (!org) return;
      if (table === "integrations" && !(await canManageIntegrations(req, org))) return res.status(403).json({ error: "Apenas proprietários e administradores gerenciam integrações." });
      const body = req.body || {};
      if ((table !== "integrations" && !asText(body.name)) || (table === "automations" && !asText(body.trigger) && !asText(body.action)) || (table === "templates" && !asText(body.body)) || (table === "integrations" && !asText(body.provider))) return res.status(400).json({ error: "Preencha os campos obrigatórios." });
      for (const [key, values] of Object.entries(checks)) { const issue = checkOneOf(body[key], values, key); if (issue) return res.status(400).json({ error: issue }); }
      if (table === "integrations") {
        for (const key of ["baseUrl", "url"]) if (body.config?.[key] !== undefined) { const parsed = parseOutboundUrl(body.config[key]); if (!parsed.ok) return res.status(400).json({ error: parsed.error }); }
      }
      try {
        const values = fields.map((field) => body[field] === undefined
          ? (field === "config" ? {} : field === "conditions" || field === "actions" ? []
            : field === "active" ? true : field === "avoid_duplicates" ? true
              : field === "status" ? (table === "integrations" ? "disconnected" : "draft")
                : field === "language" ? "pt-BR" : field === "version" ? 1 : null)
          : body[field]);
        const q = await pool.query(`insert into ${table} (organization_id,${fields.join(",")}) values ($1,${fields.map((_, i) => `$${i + 2}`).join(",")}) returning *`, [org, ...values]);
        res.status(201).json({ [singular]: table === "integrations" ? maskIntegration(q.rows[0]) : q.rows[0] });
      } catch (error) { fail(res, error, "Não foi possível criar o registro."); }
    });
    app.patch(`${path}/:id`, async (req, res) => {
      const org = tenant(req, res); if (!org) return;
      if (table === "integrations" && !(await canManageIntegrations(req, org))) return res.status(403).json({ error: "Apenas proprietários e administradores gerenciam integrações." });
      const body = req.body || {};
      for (const [key, values] of Object.entries(checks)) { const issue = checkOneOf(body[key], values, key); if (issue) return res.status(400).json({ error: issue }); }
      if (table === "integrations") for (const key of ["baseUrl", "url"]) if (body.config?.[key] !== undefined) { const parsed = parseOutboundUrl(body.config[key]); if (!parsed.ok) return res.status(400).json({ error: parsed.error }); }
      const update = fields.filter((field) => Object.prototype.hasOwnProperty.call(body, field));
      if (!update.length) return res.status(400).json({ error: "Informe um campo." });
      try {
        const q = await pool.query(`update ${table} set ${update.map((field, i) => `${field}=$${i + 1}`).join(",")},updated_at=now() where id=$${update.length + 1} and organization_id=$${update.length + 2} returning *`, [...update.map((field) => body[field]), req.params.id, org]);
        if (!q.rowCount) return res.status(404).json({ error: "Registro não encontrado." });
        res.json({ [singular]: table === "integrations" ? maskIntegration(q.rows[0]) : q.rows[0] });
      } catch (error) { fail(res, error, "Não foi possível atualizar."); }
    });
    app.delete(`${path}/:id`, async (req, res) => {
      const org = tenant(req, res); if (!org) return;
      if (table === "integrations" && !(await canManageIntegrations(req, org))) return res.status(403).json({ error: "Apenas proprietários e administradores gerenciam integrações." });
      try { await pool.query(`delete from ${table} where id=$1 and organization_id=$2`, [req.params.id, org]); res.status(204).end(); } catch (error) { fail(res, error, "Não foi possível excluir."); }
    });
  }

  app.post("/api/templates/:id/duplicate", async (req, res) => {
    const org = tenant(req, res); if (!org) return;
    try {
      const source = await pool.query("select kind,name,body,category,subject,language,variables,service_id,favorite,is_default,version,internal_notes from templates where id=$1 and organization_id=$2", [req.params.id, org]);
      if (!source.rowCount) return res.status(404).json({ error: "Template não encontrado." });
      const item = source.rows[0];
      const copy = await pool.query("insert into templates (organization_id,kind,name,body,category,subject,language,variables,service_id,favorite,is_default,version,internal_notes) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,false,false,$10,$11) returning *", [org, item.kind, `${item.name} (cópia)`, item.body, item.category, item.subject, item.language || "pt-BR", item.variables, item.service_id, Number(item.version || 1) + 1, item.internal_notes]);
      res.status(201).json({ template: copy.rows[0] });
    } catch (error) { fail(res, error, "Não foi possível duplicar o template."); }
  });
  app.patch("/api/templates/:id/default", async (req, res) => {
    const org = tenant(req, res); if (!org) return;
    const db = await pool.connect().catch(() => null); if (!db) return res.status(503).json({ error: "Serviço indisponível." });
    try {
      await db.query("begin");
      const source = await db.query("select id,kind from templates where id=$1 and organization_id=$2", [req.params.id, org]);
      if (!source.rowCount) { await db.query("rollback"); return res.status(404).json({ error: "Template não encontrado." }); }
      const item = source.rows[0];
      await db.query("update templates set is_default=false,updated_at=now() where organization_id=$1 and kind=$2", [org, item.kind]);
      const updated = await db.query("update templates set is_default=true,updated_at=now() where id=$1 and organization_id=$2 returning *", [item.id, org]);
      await db.query("commit"); res.json({ template: updated.rows[0] });
    } catch (error) { await db.query("rollback").catch(() => {}); fail(res, error, "Não foi possível definir o template padrão."); } finally { db.release(); }
  });

  app.get("/api/commissions", async (req, res) => {
    const org = tenant(req, res); if (!org) return;
    try { const q = await pool.query("select * from commissions where organization_id=$1 order by created_at desc", [org]); res.json({ commissions: q.rows }); } catch (error) { fail(res, error, "Não foi possível carregar as comissões."); }
  });
  app.post("/api/integrations/:id/test", async (req, res) => {
    const org = tenant(req, res); if (!org) return;
    try {
      const q = await pool.query("select * from integrations where id=$1 and organization_id=$2", [req.params.id, org]);
      if (!q.rowCount) return res.status(404).json({ error: "Integração não encontrada." });
      const integration = q.rows[0];
      if (integration.provider !== "webhook") return res.status(409).json({ error: "Este provedor ainda não possui um teste de conexão implementado." });
      let target; try { target = await assertSafeOutboundUrl(integration.config?.url); } catch (error) { return res.status(400).json({ error: error.message || "URL de webhook inválida." }); }
      const response = await fetch(target, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ event: "test" }), redirect: "manual", signal: AbortSignal.timeout(5000) });
      res.json({ ok: response.ok, status: response.status });
    } catch (error) { if (error.name === "TimeoutError") return res.status(400).json({ error: "Tempo esgotado ao testar webhook." }); fail(res, error, "Não foi possível testar a integração."); }
  });
}

export { AUTOMATION_ACTIONS, AUTOMATION_TRIGGERS, INTEGRATION_PROVIDERS, TEMPLATE_KINDS };
