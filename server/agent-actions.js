import { permissionAllows } from "./permissions.js";

const parsePayload = (value) => { try { const parsed = typeof value === "string" ? JSON.parse(value || "{}") : value || {}; return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {}; } catch { return {}; } };

const ACTION_ALIASES = Object.freeze({
  create_task: "create_task", criar_tarefa: "create_task", task_create: "create_task",
  create_event: "create_event", criar_compromisso: "create_event", agendar_reuniao: "create_event", calendar_create: "create_event",
  update_lead: "update_lead", atualizar_lead: "update_lead", crm_update: "update_lead",
  create_note: "create_note", criar_nota: "create_note", note_create: "create_note",
  create_followup: "create_followup", criar_followup: "create_followup", followup_create: "create_followup",
  create_proposal: "create_proposal", criar_proposta: "create_proposal", proposal_create: "create_proposal",
  draft_email: "draft_email", rascunho_email: "draft_email", email_draft: "draft_email",
  prepare_payment: "prepare_payment", preparar_cobranca: "prepare_payment", receivable_create: "prepare_payment",
});

export const AGENT_ACTION_POLICIES = Object.freeze({
  draft_email: { minLevel: 1, domain: "integrations", table: "email", permission: "create", label: "Rascunho de e-mail" },
  create_task: { minLevel: 2, domain: "operation", table: "tasks", permission: "create", label: "Tarefa" },
  create_event: { minLevel: 2, domain: "operation", table: "events", permission: "create", label: "Compromisso" },
  create_note: { minLevel: 2, domain: "integrations", table: "agent", permission: "create", label: "Nota interna" },
  create_followup: { minLevel: 2, domain: "crm", table: "followups", permission: "create", label: "Follow-up" },
  update_lead: { minLevel: 3, domain: "crm", table: "leads", permission: "edit", label: "Atualização de lead" },
  create_proposal: { minLevel: 3, domain: "crm", table: "proposals", permission: "create", label: "Proposta em rascunho" },
  prepare_payment: { minLevel: 4, domain: "finance", table: "receivables", permission: "create", label: "Conta a receber" },
});

export const normalizeAgentAction = (action) => ACTION_ALIASES[String(action || "").trim().toLowerCase()] || null;

export function evaluateAgentAction({ action, autonomyLevel = 0, role = "member", permissions = null }) {
  const requested = String(action || "").trim();
  if (!requested || ["none", "no_action"].includes(requested.toLowerCase())) return { attempted: false, allowed: false, action: null, reason: "none" };
  const canonical = normalizeAgentAction(requested), policy = canonical ? AGENT_ACTION_POLICIES[canonical] : null;
  if (!policy) return { attempted: true, allowed: false, action: requested.toLowerCase(), reason: "action_not_allowed" };
  const level = Math.min(4, Math.max(0, Number.parseInt(autonomyLevel, 10) || 0));
  if (level < policy.minLevel) return { attempted: true, allowed: false, action: canonical, policy, reason: level === 0 ? "response_only" : level === 1 ? "draft_only" : "autonomy_too_low" };
  const privileged = ["owner", "admin"].includes(String(role || "").toLowerCase());
  const permitted = privileged || permissionAllows(permissions, policy.domain, policy.table, policy.permission);
  if (!permitted) return { attempted: true, allowed: false, action: canonical, policy, reason: "permission_denied" };
  return { attempted: true, allowed: true, action: canonical, policy, reason: null };
}

export function availableAgentActions(actor) {
  return Object.keys(AGENT_ACTION_POLICIES).filter((action) => evaluateAgentAction({ ...actor, action }).allowed);
}

export async function executeAgentAction({ pool, action, payload, org, userId = null, authorized = false }) {
  if (!authorized || !action || action === "none" || action === "NO_ACTION") return { executed: false, reason: authorized ? "none" : "unauthorized" };
  const data = parsePayload(payload), name = normalizeAgentAction(action) || String(action).toLowerCase();
  if (name === "create_task") {
    const title = String(data.title || data.titulo || "").trim(); if (!title) return { executed: false, reason: "missing_title" };
    const q = await pool.query("insert into tasks (organization_id,title,description,due_at,priority,status,internal_notes) values ($1,$2,$3,$4,$5,'todo',$6) returning id,title,status,due_at", [org, title, data.description || data.descricao || null, data.due_at || data.data || null, ["low", "medium", "high"].includes(data.priority) ? data.priority : "medium", "created_by:focuss_agent"]);
    return { executed: true, type: "task", id: q.rows[0].id, record: q.rows[0] };
  }
  if (name === "create_event") {
    const title = String(data.title || data.titulo || "").trim(), startsAt = data.starts_at || data.startsAt || data.data_hora; if (!title || !startsAt || Number.isNaN(Date.parse(startsAt))) return { executed: false, reason: "missing_event_data" };
    const q = await pool.query("insert into events (organization_id,title,starts_at,description,reminder_minutes) values ($1,$2,$3,$4,$5) returning id,title,starts_at", [org, title, startsAt, data.description || data.descricao || null, Number.isFinite(Number(data.reminder_minutes)) ? Math.max(0, Number(data.reminder_minutes)) : 30]);
    return { executed: true, type: "event", id: q.rows[0].id, record: q.rows[0] };
  }
  if (name === "update_lead") {
    const leadId = data.lead_id || data.id; if (!leadId) return { executed: false, reason: "missing_lead_id" };
    const allowedStages = ["new", "contacted", "qualified", "proposal", "negotiation", "won", "lost"]; if (data.status && !allowedStages.includes(String(data.status))) return { executed: false, reason: "invalid_stage" };
    const q = await pool.query("update leads set status=coalesce($1,status),notes=coalesce($2,notes),updated_at=now() where id=$3 and organization_id=$4 returning id,name,status", [data.status || null, data.notes || data.observacoes || null, leadId, org]);
    return q.rowCount ? { executed: true, type: "lead", id: q.rows[0].id, record: q.rows[0] } : { executed: false, reason: "lead_not_found" };
  }
  if (name === "create_note") {
    const body = String(data.body || data.note || data.nota || "").trim(); if (!body) return { executed: false, reason: "missing_note" };
    const q = await pool.query("insert into agent_notes (organization_id,author_user_id,entity_type,entity_id,body) values ($1,$2,$3,$4,$5) returning id,body,created_at", [org, userId, data.entity_type || data.tipo || null, data.entity_id || data.id || null, body]);
    return { executed: true, type: "note", id: q.rows[0].id, record: q.rows[0] };
  }
  if (name === "create_followup") {
    const dueAt = data.due_at || data.data || data.date, leadId = data.lead_id || null, clientId = data.client_id || null; if ((!leadId && !clientId) || !dueAt || Number.isNaN(Date.parse(dueAt))) return { executed: false, reason: "missing_followup_data" };
    const q = await pool.query("insert into followups (organization_id,lead_id,client_id,title,due_at,channel,note,priority,next_action) values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning id,title,due_at", [org, leadId, clientId, data.title || data.titulo || "Retorno comercial", dueAt, data.channel || "whatsapp", data.note || data.nota || null, ["low", "medium", "high", "urgent"].includes(data.priority) ? data.priority : "medium", data.next_action || null]);
    return { executed: true, type: "followup", id: q.rows[0].id, record: q.rows[0] };
  }
  if (name === "create_proposal") {
    const title = String(data.title || data.titulo || "").trim(), amount = Number(data.amount || data.valor); if (!title || !Number.isFinite(amount) || amount < 0) return { executed: false, reason: "missing_proposal_data" };
    const q = await pool.query("insert into proposals (organization_id,lead_id,client_id,title,amount,status,notes) values ($1,$2,$3,$4,$5,'draft',$6) returning id,title,amount,status", [org, data.lead_id || null, data.client_id || null, title, amount, data.notes || data.observacoes || null]);
    return { executed: true, type: "proposal", id: q.rows[0].id, record: q.rows[0] };
  }
  if (name === "draft_email") {
    const to = String(data.to || data.destinatario || "").trim(), subject = String(data.subject || data.assunto || "").trim(), body = String(data.body || data.mensagem || "").trim(); if (!/^\S+@\S+\.\S+$/.test(to) || !subject || !body) return { executed: false, reason: "missing_email_data" };
    const q = await pool.query("insert into agent_notes (organization_id,author_user_id,entity_type,body) values ($1,$2,'email_draft',$3) returning id,created_at", [org, userId, JSON.stringify({ to, subject, body })]);
    return { executed: true, type: "email_draft", id: q.rows[0].id, record: q.rows[0] };
  }
  if (name === "prepare_payment") {
    const clientId = data.client_id || data.cliente_id, description = String(data.description || data.descricao || "").trim(), amount = Number(data.amount || data.valor), dueAt = data.due_at || data.vencimento; if (!clientId || !description || !Number.isFinite(amount) || amount <= 0 || !dueAt) return { executed: false, reason: "missing_payment_data" };
    const q = await pool.query("insert into receivables (organization_id,client_id,description,amount,due_at,status) values ($1,$2,$3,$4,$5,'pending') returning id,description,amount,due_at,status", [org, clientId, description, amount, dueAt]);
    return { executed: true, type: "receivable", id: q.rows[0].id, record: q.rows[0] };
  }
  return { executed: false, reason: "action_not_allowed" };
}
