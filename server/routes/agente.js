import { callFocussAgent, DEFAULT_AGENT_PROMPT } from "../focuss-agent.js";

export function register(app, ctx) {
  const { pool, tenant, classifyDbError } = ctx;
  const fail = (res, error, fallback) => { const out = classifyDbError(error, fallback); res.status(out.status).json({ error: out.error }); };
  const roleOf = async (req, org) => (await pool.query("select role from users where id=$1 and organization_id=$2", [req.user?.id, org])).rows[0]?.role || "member";
  const parseActionPayload = (value) => { try { const parsed = typeof value === "string" ? JSON.parse(value || "{}") : value || {}; return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {}; } catch { return {}; } };
  const executeAction = async ({ action, payload, org, userId, authorized }) => {
    if (!authorized || !action || action === "none" || action === "NO_ACTION") return { executed: false, reason: authorized ? "none" : "unauthorized" };
    const data = parseActionPayload(payload), name = String(action).toLowerCase();
    if (["create_task", "criar_tarefa", "task_create"].includes(name)) {
      const title = String(data.title || data.titulo || "").trim(); if (!title) return { executed: false, reason: "missing_title" };
      const q = await pool.query("insert into tasks (organization_id,title,description,due_at,priority,status,internal_notes) values ($1,$2,$3,$4,$5,'todo',$6) returning id,title,status,due_at", [org, title, data.description || data.descricao || null, data.due_at || data.data || null, ["low", "medium", "high"].includes(data.priority) ? data.priority : "medium", "created_by:focuss_agent"]);
      return { executed: true, type: "task", id: q.rows[0].id, record: q.rows[0] };
    }
    if (["create_event", "criar_compromisso", "agendar_reuniao", "calendar_create"].includes(name)) {
      const title = String(data.title || data.titulo || "").trim(), startsAt = data.starts_at || data.startsAt || data.data_hora; if (!title || !startsAt || Number.isNaN(Date.parse(startsAt))) return { executed: false, reason: "missing_event_data" };
      const q = await pool.query("insert into events (organization_id,title,starts_at,description,reminder_minutes) values ($1,$2,$3,$4,$5) returning id,title,starts_at", [org, title, startsAt, data.description || data.descricao || null, Number.isFinite(Number(data.reminder_minutes)) ? Math.max(0, Number(data.reminder_minutes)) : 30]);
      return { executed: true, type: "event", id: q.rows[0].id, record: q.rows[0] };
    }
    if (["update_lead", "atualizar_lead", "crm_update"].includes(name)) {
      const leadId = data.lead_id || data.id; if (!leadId) return { executed: false, reason: "missing_lead_id" };
      const allowed = ["new", "contacted", "qualified", "proposal", "negotiation", "won", "lost"]; if (data.status && !allowed.includes(String(data.status))) return { executed: false, reason: "invalid_stage" };
      const q = await pool.query("update leads set status=coalesce($1,status),notes=coalesce($2,notes),updated_at=now() where id=$3 and organization_id=$4 returning id,name,status", [data.status || null, data.notes || data.observacoes || null, leadId, org]);
      return q.rowCount ? { executed: true, type: "lead", id: q.rows[0].id, record: q.rows[0] } : { executed: false, reason: "lead_not_found" };
    }
    if (["create_note", "criar_nota", "note_create"].includes(name)) {
      const body = String(data.body || data.note || data.nota || "").trim(); if (!body) return { executed: false, reason: "missing_note" };
      const q = await pool.query("insert into agent_notes (organization_id,author_user_id,entity_type,entity_id,body) values ($1,$2,$3,$4,$5) returning id,body,created_at", [org, userId || null, data.entity_type || data.tipo || null, data.entity_id || data.id || null, body]);
      return { executed: true, type: "note", id: q.rows[0].id, record: q.rows[0] };
    }
    if (["create_followup", "criar_followup", "followup_create"].includes(name)) {
      const dueAt = data.due_at || data.data || data.date, leadId = data.lead_id || null, clientId = data.client_id || null; if ((!leadId && !clientId) || !dueAt || Number.isNaN(Date.parse(dueAt))) return { executed: false, reason: "missing_followup_data" };
      const q = await pool.query("insert into followups (organization_id,lead_id,client_id,title,due_at,channel,note,priority,next_action) values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning id,title,due_at", [org, leadId, clientId, data.title || data.titulo || "Retorno comercial", dueAt, data.channel || "whatsapp", data.note || data.nota || null, ["low", "medium", "high", "urgent"].includes(data.priority) ? data.priority : "medium", data.next_action || null]);
      return { executed: true, type: "followup", id: q.rows[0].id, record: q.rows[0] };
    }
    if (["create_proposal", "criar_proposta", "proposal_create"].includes(name)) {
      const title = String(data.title || data.titulo || "").trim(), amount = Number(data.amount || data.valor); if (!title || !Number.isFinite(amount) || amount < 0) return { executed: false, reason: "missing_proposal_data" };
      const q = await pool.query("insert into proposals (organization_id,lead_id,client_id,title,amount,status,notes) values ($1,$2,$3,$4,$5,'draft',$6) returning id,title,amount,status", [org, data.lead_id || null, data.client_id || null, title, amount, data.notes || data.observacoes || null]);
      return { executed: true, type: "proposal", id: q.rows[0].id, record: q.rows[0] };
    }
    if (["draft_email", "rascunho_email", "email_draft"].includes(name)) {
      const to = String(data.to || data.destinatario || "").trim(), subject = String(data.subject || data.assunto || "").trim(), body = String(data.body || data.mensagem || "").trim(); if (!/^\S+@\S+\.\S+$/.test(to) || !subject || !body) return { executed: false, reason: "missing_email_data" };
      const q = await pool.query("insert into agent_notes (organization_id,author_user_id,entity_type,body) values ($1,$2,'email_draft',$3) returning id,created_at", [org, userId || null, JSON.stringify({ to, subject, body })]);
      return { executed: true, type: "email_draft", id: q.rows[0].id, record: q.rows[0] };
    }
    if (["prepare_payment", "preparar_cobranca", "receivable_create"].includes(name)) {
      const clientId = data.client_id || data.cliente_id, description = String(data.description || data.descricao || "").trim(), amount = Number(data.amount || data.valor), dueAt = data.due_at || data.vencimento; if (!clientId || !description || !Number.isFinite(amount) || amount <= 0 || !dueAt) return { executed: false, reason: "missing_payment_data" };
      const q = await pool.query("insert into receivables (organization_id,client_id,description,amount,due_at,status) values ($1,$2,$3,$4,$5,'pending') returning id,description,amount,due_at,status", [org, clientId, description, amount, dueAt]);
      return { executed: true, type: "receivable", id: q.rows[0].id, record: q.rows[0] };
    }
    return { executed: false, reason: "action_not_allowed" };
  };
  const ensure = async (org) => {
    const current = await pool.query("select * from agent_configs where organization_id=$1", [org]);
    if (current.rowCount) return current.rows[0];
    return (await pool.query("insert into agent_configs (organization_id,system_prompt) values ($1,$2) returning *", [org, DEFAULT_AGENT_PROMPT])).rows[0];
  };
  app.get("/api/agent/config", async (req, res) => { const org = tenant(req, res); if (!org) return; try { const config = await ensure(org); res.json({ agent: { id: config.id, name: config.name, model: config.model, enabled: config.enabled, autonomy_level: config.autonomy_level, prompt_version: config.prompt_version, ai_configured: Boolean(process.env.OPENAI_API_KEY) } }); } catch (error) { fail(res, error, "Não foi possível carregar o agente."); } });
  app.patch("/api/agent/config", async (req, res) => { const org = tenant(req, res); if (!org) return; if (!["owner", "admin"].includes(await roleOf(req, org))) return res.status(403).json({ error: "Apenas proprietários e administradores configuram o agente." }); try { await ensure(org); const fields = ["name", "model", "enabled", "autonomy_level", "prompt_version"].filter((field) => req.body?.[field] !== undefined); if (!fields.length) return res.status(400).json({ error: "Informe uma configuração para atualizar." }); if (fields.includes("autonomy_level") && (!Number.isInteger(Number(req.body.autonomy_level)) || Number(req.body.autonomy_level) < 0 || Number(req.body.autonomy_level) > 4)) return res.status(400).json({ error: "Nível de autonomia inválido." }); const values = fields.map((field) => field === "autonomy_level" ? Number(req.body[field]) : req.body[field]); const q = await pool.query(`update agent_configs set ${fields.map((field, index) => `${field}=$${index + 1}`).join(",")},updated_at=now() where organization_id=$${fields.length + 1} returning id,name,model,enabled,autonomy_level,prompt_version`, [...values, org]); res.json({ agent: q.rows[0] }); } catch (error) { fail(res, error, "Não foi possível atualizar o agente."); } });
  app.post("/api/agent/respond", async (req, res) => {
    const org = tenant(req, res); if (!org) return;
    const message = String(req.body?.message || "").trim(); if (!message) return res.status(400).json({ error: "A mensagem não pode estar vazia." });
    try {
      const config = await ensure(org); if (!config.enabled) return res.status(409).json({ error: "O Agente Focussdev está desativado neste workspace." });
      let conversationId = req.body?.conversation_id ? Number(req.body.conversation_id) : null;
      if (conversationId) { const check = await pool.query("select id from conversations where id=$1 and organization_id=$2", [conversationId, org]); if (!check.rowCount) return res.status(404).json({ error: "Conversa não encontrada." }); }
      if (!conversationId) conversationId = (await pool.query("insert into conversations (organization_id,subject,channel) values ($1,$2,'internal') returning id", [org, "Agente Focussdev"])).rows[0].id;
      await pool.query("insert into messages (organization_id,conversation_id,author_user_id,direction,body) values ($1,$2,$3,'in',$4)", [org, conversationId, req.user?.id || null, message]);
      const history = (await pool.query("select direction,body from messages where conversation_id=$1 and organization_id=$2 order by created_at desc limit 20", [conversationId, org])).rows.reverse();
      const catalog = (await pool.query("select id,name,kind,price,unit,category,short_description,recurrence,billing_type from catalog_items where organization_id=$1 and active=true and public_visible=true order by highlighted desc,created_at desc limit 100", [org])).rows;
      const result = await callFocussAgent({ model: config.model, prompt: config.system_prompt || DEFAULT_AGENT_PROMPT, messages: history.slice(0, -1), currentMessage: message, context: { company: "Focussdev", catalog } });
      const actionResult = await executeAction({ action: result.action, payload: result.action_payload, org, userId: req.user?.id, authorized: ["owner", "admin"].includes(await roleOf(req, org)) });
      if (result.action && result.action !== "none" && !actionResult.executed) result.reply = "Não consegui executar essa ação automaticamente agora. A solicitação foi preservada para acompanhamento.";
      const saved = await pool.query("insert into messages (organization_id,conversation_id,direction,body,read_at) values ($1,$2,'out',$3,now()) returning id,created_at", [org, conversationId, result.reply]);
      await pool.query("update conversations set last_message_at=$1,updated_at=now(),unread_count=0 where id=$2 and organization_id=$3", [saved.rows[0].created_at, conversationId, org]);
      res.json({ conversation_id: conversationId, response: result, action_executed: actionResult.executed, action_result: actionResult });
    } catch (error) { if (error.code === "AI_NOT_CONFIGURED") return res.status(503).json({ error: error.message, code: error.code }); fail(res, error, "Não foi possível responder com o agente."); }
  });
}
