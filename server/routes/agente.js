import { callFocussAgent, DEFAULT_AGENT_PROMPT } from "../focuss-agent.js";
import { availableAgentActions, evaluateAgentAction, executeAgentAction } from "../agent-actions.js";

const FAILURE_MESSAGES = Object.freeze({
  response_only: "A ação não foi executada: a autonomia está no nível 0 e permite somente respostas, sem alterar dados.",
  draft_only: "A ação não foi executada: a autonomia está no nível 1 e permite apenas preparar rascunhos.",
  autonomy_too_low: "A ação não foi executada porque exige um nível de autonomia maior.",
  permission_denied: "A ação não foi executada porque seu cargo não possui a permissão necessária.",
  action_not_allowed: "A ação solicitada não faz parte das capacidades permitidas do agente.",
  missing_title: "A ação não foi executada porque falta o título da tarefa.",
  missing_event_data: "A ação não foi executada porque faltam título ou horário válido para o compromisso.",
  missing_lead_id: "A ação não foi executada porque falta identificar o lead.",
  invalid_stage: "A ação não foi executada porque a etapa informada não é válida.",
  lead_not_found: "A ação não foi executada porque o lead não foi encontrado neste workspace.",
  missing_note: "A ação não foi executada porque a nota está vazia.",
  missing_followup_data: "A ação não foi executada porque faltam vínculo e data válida para o follow-up.",
  missing_proposal_data: "A ação não foi executada porque faltam título ou valor válido para a proposta.",
  missing_email_data: "O rascunho não foi salvo porque destinatário, assunto ou mensagem estão incompletos.",
  missing_payment_data: "A cobrança não foi preparada porque cliente, descrição, valor ou vencimento estão incompletos.",
  execution_error: "A ação falhou no servidor e não foi confirmada. Sua mensagem foi preservada para nova tentativa.",
});

const failureStatus = (reason) => reason === "permission_denied" ? 403
  : reason === "lead_not_found" ? 404
    : reason === "execution_error" ? 503
    : ["response_only", "draft_only", "autonomy_too_low"].includes(reason) ? 409
      : 422;

const actionConfirmation = (decision, result) => `${decision.policy?.label || "Ação"} confirmada${result.id ? ` (registro ${result.id})` : ""}.`;

export function register(app, ctx) {
  const { pool, tenant, classifyDbError } = ctx;
  const callAgent = ctx.callFocussAgent || callFocussAgent;
  const executeAction = ctx.executeAgentAction || executeAgentAction;
  const fail = (res, error, fallback) => { const out = classifyDbError(error, fallback); res.status(out.status).json({ error: out.error }); };
  const actorOf = async (req, org) => {
    const q = await pool.query("select u.role,tr.permissions from users u left join team_roles tr on tr.id=u.team_role_id and tr.organization_id=u.organization_id where u.id=$1 and u.organization_id=$2", [req.user?.id, org]);
    return { role: q.rows[0]?.role || "member", permissions: q.rows[0]?.permissions || null };
  };
  const roleOf = async (req, org) => (await actorOf(req, org)).role;
  const ensure = async (org) => {
    const current = await pool.query("select * from agent_configs where organization_id=$1", [org]);
    if (current.rowCount) return current.rows[0];
    return (await pool.query("insert into agent_configs (organization_id,system_prompt) values ($1,$2) returning *", [org, DEFAULT_AGENT_PROMPT])).rows[0];
  };
  const auditAction = async ({ org, userId, action, outcome, reason, autonomyLevel, entityId = null }) => {
    const changes = { action: String(action || "unknown").slice(0, 80), outcome, reason: reason || null, autonomy_level: Number(autonomyLevel) };
    await pool.query("insert into audit_events (organization_id,actor_id,action,entity_type,entity_id,changes) values ($1,$2,$3,'agent',$4,$5::jsonb)", [org, userId || null, outcome === "executed" ? "agent_action_executed" : "agent_action_failed", entityId || null, JSON.stringify(changes)]).catch(() => {});
  };
  const saveReply = async ({ org, conversationId, reply }) => {
    const saved = await pool.query("insert into messages (organization_id,conversation_id,direction,body,read_at) values ($1,$2,'out',$3,now()) returning id,created_at", [org, conversationId, reply]);
    await pool.query("update conversations set last_message_at=$1,updated_at=now(),unread_count=0 where id=$2 and organization_id=$3", [saved.rows[0].created_at, conversationId, org]);
  };

  app.get("/api/agent/config", async (req, res) => { const org = tenant(req, res); if (!org) return; try { const config = await ensure(org); res.json({ agent: { id: config.id, name: config.name, model: config.model, enabled: config.enabled, autonomy_level: config.autonomy_level, prompt_version: config.prompt_version, ai_configured: Boolean(process.env.OPENAI_API_KEY) } }); } catch (error) { fail(res, error, "Não foi possível carregar o agente."); } });
  app.patch("/api/agent/config", async (req, res) => { const org = tenant(req, res); if (!org) return; if (!["owner", "admin"].includes(await roleOf(req, org))) return res.status(403).json({ error: "Apenas proprietários e administradores configuram o agente." }); try { await ensure(org); const fields = ["name", "model", "enabled", "autonomy_level", "prompt_version"].filter((field) => req.body?.[field] !== undefined); if (!fields.length) return res.status(400).json({ error: "Informe uma configuração para atualizar." }); if (fields.includes("autonomy_level") && (!Number.isInteger(Number(req.body.autonomy_level)) || Number(req.body.autonomy_level) < 0 || Number(req.body.autonomy_level) > 4)) return res.status(400).json({ error: "Nível de autonomia inválido." }); const values = fields.map((field) => field === "autonomy_level" ? Number(req.body[field]) : req.body[field]); const q = await pool.query(`update agent_configs set ${fields.map((field, index) => `${field}=$${index + 1}`).join(",")},updated_at=now() where organization_id=$${fields.length + 1} returning id,name,model,enabled,autonomy_level,prompt_version`, [...values, org]); res.json({ agent: q.rows[0] }); } catch (error) { fail(res, error, "Não foi possível atualizar o agente."); } });
  app.post("/api/agent/respond", async (req, res) => {
    const org = tenant(req, res); if (!org) return;
    const message = String(req.body?.message || "").trim(); if (!message) return res.status(400).json({ error: "A mensagem não pode estar vazia." });
    try {
      const config = await ensure(org); if (!config.enabled) return res.status(409).json({ error: "O Agente Focussdev está desativado neste workspace." });
      const actor = await actorOf(req, org);
      let conversationId = req.body?.conversation_id ? Number(req.body.conversation_id) : null;
      if (conversationId) { const check = await pool.query("select id from conversations where id=$1 and organization_id=$2", [conversationId, org]); if (!check.rowCount) return res.status(404).json({ error: "Conversa não encontrada." }); }
      if (!conversationId) conversationId = (await pool.query("insert into conversations (organization_id,subject,channel) values ($1,$2,'internal') returning id", [org, "Agente Focussdev"])).rows[0].id;
      await pool.query("insert into messages (organization_id,conversation_id,author_user_id,direction,body) values ($1,$2,$3,'in',$4)", [org, conversationId, req.user?.id || null, message]);
      const history = (await pool.query("select direction,body from messages where conversation_id=$1 and organization_id=$2 order by created_at desc limit 20", [conversationId, org])).rows.reverse();
      const catalog = (await pool.query("select id,name,kind,price,unit,category,short_description,recurrence,billing_type from catalog_items where organization_id=$1 and active=true and public_visible=true order by highlighted desc,created_at desc limit 100", [org])).rows;
      const allowedActions = availableAgentActions({ autonomyLevel: config.autonomy_level, ...actor });
      const result = await callAgent({ model: config.model, prompt: config.system_prompt || DEFAULT_AGENT_PROMPT, messages: history.slice(0, -1), currentMessage: message, context: { company: "Focussdev", catalog, agent_policy: { autonomy_level: Number(config.autonomy_level), allowed_actions: allowedActions, user_role: actor.role } } });
      const decision = evaluateAgentAction({ action: result.action, autonomyLevel: config.autonomy_level, ...actor });
      if (decision.attempted && !decision.allowed) {
        const actionResult = { executed: false, reason: decision.reason, action: decision.action, required_level: decision.policy?.minLevel ?? null, required_permission: decision.policy ? `${decision.policy.table}.${decision.policy.permission}` : null };
        result.reply = FAILURE_MESSAGES[decision.reason] || FAILURE_MESSAGES.action_not_allowed;
        await auditAction({ org, userId: req.user?.id, action: result.action, outcome: "denied", reason: decision.reason, autonomyLevel: config.autonomy_level });
        await saveReply({ org, conversationId, reply: result.reply });
        return res.status(failureStatus(decision.reason)).json({ error: result.reply, conversation_id: conversationId, response: result, action_executed: false, action_result: actionResult });
      }
      let actionResult = { executed: false, reason: "none" };
      if (decision.allowed) {
        try {
          actionResult = await executeAction({ pool, action: decision.action, payload: result.action_payload, org, userId: req.user?.id, authorized: true });
        } catch {
          actionResult = { executed: false, reason: "execution_error", action: decision.action };
        }
        if (!actionResult.executed) {
          result.reply = FAILURE_MESSAGES[actionResult.reason] || FAILURE_MESSAGES.execution_error;
          await auditAction({ org, userId: req.user?.id, action: decision.action, outcome: "failed", reason: actionResult.reason, autonomyLevel: config.autonomy_level });
          await saveReply({ org, conversationId, reply: result.reply });
          return res.status(failureStatus(actionResult.reason)).json({ error: result.reply, conversation_id: conversationId, response: result, action_executed: false, action_result: actionResult });
        }
        result.reply = `${String(result.reply || "").trim()}\n\n${actionConfirmation(decision, actionResult)}`.trim();
        await auditAction({ org, userId: req.user?.id, action: decision.action, outcome: "executed", reason: null, autonomyLevel: config.autonomy_level, entityId: actionResult.id });
      }
      await saveReply({ org, conversationId, reply: result.reply });
      return res.json({ conversation_id: conversationId, response: result, action_executed: actionResult.executed, action_result: actionResult });
    } catch (error) { if (error.code === "AI_NOT_CONFIGURED") return res.status(503).json({ error: error.message, code: error.code }); fail(res, error, "Não foi possível responder com o agente."); }
  });
}
