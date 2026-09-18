const parsePayload = (value) => { try { const parsed = typeof value === "string" ? JSON.parse(value || "{}") : value || {}; return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {}; } catch { return {}; } };

export async function executeAgentAction({ pool, action, payload, org, userId = null, authorized = false }) {
  if (!authorized || !action || action === "none" || action === "NO_ACTION") return { executed: false, reason: authorized ? "none" : "unauthorized" };
  const data = parsePayload(payload), name = String(action).toLowerCase();
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
    const allowedStages = ["new", "contacted", "qualified", "proposal", "negotiation", "won", "lost"]; if (data.status && !allowedStages.includes(String(data.status))) return { executed: false, reason: "invalid_stage" };
    const q = await pool.query("update leads set status=coalesce($1,status),notes=coalesce($2,notes),updated_at=now() where id=$3 and organization_id=$4 returning id,name,status", [data.status || null, data.notes || data.observacoes || null, leadId, org]);
    return q.rowCount ? { executed: true, type: "lead", id: q.rows[0].id, record: q.rows[0] } : { executed: false, reason: "lead_not_found" };
  }
  if (["create_note", "criar_nota", "note_create"].includes(name)) {
    const body = String(data.body || data.note || data.nota || "").trim(); if (!body) return { executed: false, reason: "missing_note" };
    const q = await pool.query("insert into agent_notes (organization_id,author_user_id,entity_type,entity_id,body) values ($1,$2,$3,$4,$5) returning id,body,created_at", [org, userId, data.entity_type || data.tipo || null, data.entity_id || data.id || null, body]);
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
  return { executed: false, reason: "action_not_allowed" };
}
