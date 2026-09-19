import { normalizeNumber, sendWhatsappText } from "./routes/whatsapp.js";
import { sendEmail } from "./mailer.js";
import { randomBytes } from "node:crypto";
import { assertSafeOutboundUrl } from "./outbound-url.js";

const SOURCE_TABLES = {
  lead_created: "leads",
  lead_stage_changed: "opportunities",
  proposal_approved: "proposals",
  proposal_sent: "proposals",
  proposal_viewed: "proposals",
  contract_signed: "contracts",
  meeting_scheduled: "events",
  project_created: "projects",
  task_due_soon: "tasks",
  receivable_due_soon: "receivables",
  task_overdue: "tasks",
  receivable_overdue: "receivables",
  ticket_created: "tickets",
  freelancer_project_finished: "projects",
  project_completed: "projects",
  team_member_invited: "team_invite_events",
  member_added_to_project: "project_members",
  project_member_added: "project_members",
  task_assigned: "tasks",
  member_overloaded: "users",
  absence_started: "absences",
  sale_won: "opportunities",
  user_deactivated: "team_access_events",
  client_created: "clients",
  delivery_published: "deliveries",
  payment_received: "payments",
  project_inactive: "projects",
  form_submitted: "forms",
  subscription_due: "subscriptions",
};

const sourceWhere = {
  lead_created: "created_at <= $2",
  lead_stage_changed: "updated_at <= $2",
  proposal_approved: "status = 'accepted' and updated_at <= $2",
  proposal_sent: "status = 'sent' and sent_at <= $2",
  proposal_viewed: "status = 'viewed' and updated_at <= $2",
  contract_signed: "status in ('active','signed') and updated_at <= $2",
  meeting_scheduled: "event_type = 'meeting' and created_at <= $2 and starts_at >= $2",
  project_created: "created_at <= $2",
  task_due_soon: "status not in ('done','cancelled') and due_at is not null and due_at > $2 and due_at <= ($2 + interval '1 day')",
  receivable_due_soon: "status = 'pending' and due_at >= $2::date and due_at <= ($2::date + 1)",
  task_overdue: "status <> 'done' and due_at is not null and due_at < $2",
  receivable_overdue: "status = 'pending' and due_at < $2::date",
  ticket_created: "created_at <= $2",
  freelancer_project_finished: "(status in ('done','completed','published') or completed_on is not null) and (completed_on is null or completed_on <= $2::date)",
  project_completed: "(status in ('done','completed','published') or completed_on is not null) and (completed_on is null or completed_on <= $2::date)",
  team_member_invited: "s.created_at <= $2",
  member_added_to_project: "added_at <= $2",
  project_member_added: "added_at <= $2",
  task_assigned: "assigned_at is not null and assigned_at <= $2 and assignee_id is not null",
  member_overloaded: "coalesce(s.access_status,'active') = 'active' and (select count(*) from tasks t where t.organization_id=s.organization_id and t.assignee_id=s.id and t.status not in ('done','cancelled')) > 5",
  absence_started: "s.starts_on = $2::date and lower(s.kind) in ('vacation','ferias','férias')",
  sale_won: "s.stage in ('won','closed_won','sale_won')",
  user_deactivated: "s.created_at <= $2",
  client_created: "s.created_at <= $2",
  delivery_published: "s.status in ('published','done','completed') and coalesce(s.published_at,s.updated_at) <= $2",
  payment_received: "s.paid_at is not null and s.paid_at <= $2",
  project_inactive: "s.status not in ('done','cancelled') and s.updated_at <= ($2 - interval '7 days')",
  form_submitted: "s.submitted_at is not null and s.submitted_at <= $2 and s.status in ('published','active')",
  subscription_due: "s.status = 'active' and s.next_billing_on between $2::date and ($2::date + 7)",
};

const sourceMessage = (trigger, row) => {
  if (trigger === "lead_created") return `Novo lead: ${row.name}`;
  if (trigger === "proposal_approved") return `Proposta aprovada: ${row.title}`;
  if (trigger === "proposal_sent") return `Proposta enviada: ${row.title}`;
  if (trigger === "proposal_viewed") return `Proposta visualizada: ${row.title}`;
  if (trigger === "contract_signed") return `Contrato assinado: ${row.name}`;
  if (trigger === "meeting_scheduled") return `Reunião agendada: ${row.title}`;
  if (trigger === "project_created") return `Projeto criado: ${row.name}`;
  if (trigger === "receivable_due_soon") return `Parcela próxima do vencimento: ${row.description}`;
  if (trigger === "task_due_soon") return `Tarefa próxima do prazo: ${row.title}`;
  if (trigger === "task_overdue") return `Tarefa atrasada: ${row.title}`;
  if (trigger === "receivable_overdue") return `Recebível vencido: ${row.description}`;
  if (trigger === "freelancer_project_finished" || trigger === "project_completed") return `Projeto finalizado: ${row.name}`;
  if (trigger === "team_member_invited") return `Bem-vindo ao FocusDev, ${row.member_name || row.name}`;
  if (trigger === "member_added_to_project" || trigger === "project_member_added") return `Você foi adicionado ao projeto ${row.project_name || row.project_id}.`;
  if (trigger === "task_assigned") return `Nova tarefa atribuída: ${row.title}`;
  if (trigger === "member_overloaded") return `Membro sobrecarregado: ${row.name} (${row.open_tasks} tarefas abertas)`;
  if (trigger === "absence_started") return `Férias iniciadas: ${row.member_name || row.user_id}`;
  if (trigger === "user_deactivated") return `Usuário desativado: ${row.member_name || row.user_id}`;
  return `Novo ticket: ${row.title}`;
};

async function assertOrganizationRelation(client, table, id, organizationId, label) {
  if (!id) return;
  const result = await client.query(`select id from ${table} where id=$1 and organization_id=$2`, [id, organizationId]);
  if (!result.rowCount) throw new Error(`${label} não pertence ao workspace.`);
}

async function findSources(client, automation, now) {
  const table = SOURCE_TABLES[automation.trigger];
  const where = sourceWhere[automation.trigger];
  if (!table || !where) return [];
  const select = table === "project_members" ? "select s.*,u.name member_name,u.email,p.name project_name" : automation.trigger === "task_assigned" ? "select s.*,u.name member_name,u.email" : automation.trigger === "member_overloaded" ? "select s.*,(select count(*)::int from tasks t where t.organization_id=s.organization_id and t.assignee_id=s.id and t.status not in ('done','cancelled')) open_tasks" : automation.trigger === "absence_started" ? "select s.*,u.name member_name,u.manager_id" : automation.trigger === "sale_won" ? "select s.*,(select c.id from clients c where c.organization_id=s.organization_id and ((s.contact_id is not null and c.contact_id=s.contact_id) or (s.company_id is not null and c.company_id=s.company_id)) order by c.id limit 1) client_id" : automation.trigger === "user_deactivated" ? "select s.*,u.name member_name,u.manager_id,u.email" : automation.trigger === "team_member_invited" ? "select s.*,u.name member_name,u.email" : automation.trigger === "proposal_approved" || automation.trigger === "proposal_sent" || automation.trigger === "proposal_viewed" ? "select s.*,coalesce(c.email,l.email) email,coalesce(c.phone,l.phone) phone" : "select s.*";
  const joins = table === "project_members" ? " join users u on u.id=s.user_id and u.organization_id=s.organization_id join projects p on p.id=s.project_id and p.organization_id=s.organization_id" : automation.trigger === "task_assigned" ? " join users u on u.id=s.assignee_id and u.organization_id=s.organization_id" : automation.trigger === "absence_started" ? " join users u on u.id=s.user_id and u.organization_id=s.organization_id" : automation.trigger === "user_deactivated" ? " join users u on u.id=s.user_id and u.organization_id=s.organization_id" : automation.trigger === "team_member_invited" ? " join users u on u.id=s.user_id and u.organization_id=s.organization_id" : automation.trigger === "proposal_approved" || automation.trigger === "proposal_sent" || automation.trigger === "proposal_viewed" ? " left join clients c on c.id=s.client_id and c.organization_id=s.organization_id left join leads l on l.id=s.lead_id and l.organization_id=s.organization_id" : "";
  const query = `${select} from ${table} s${joins} where s.organization_id=$1 and ${where}
    and not exists (select 1 from automation_runs r where r.automation_id=$3 and r.source_type=$4 and r.source_id=s.id and coalesce(r.result->>'error','')='')
    order by s.id limit 100`;
  const result = await client.query(query, [automation.organization_id, now, automation.id, automation.trigger]);
  return result.rows;
}

async function executeAction(client, automation, source, { sendWhatsApp = sendWhatsappText, pool } = {}) {
  const config = automation.config && typeof automation.config === "object" ? automation.config : {};
  const message = sourceMessage(automation.trigger, source);
  if (automation.action === "notify" || automation.action === "notify_responsible") {
    const targetId = source.manager_id || source.assignee_id;
    const users = targetId && automation.action === "notify_responsible"
      ? await client.query("select id from users where id=$1 and organization_id=$2", [targetId, automation.organization_id])
      : source.assignee_id
        ? await client.query("select id from users where id=$1 and organization_id=$2", [source.assignee_id, automation.organization_id])
        : await client.query("select id from users where organization_id=$1", [automation.organization_id]);
    const recipients = users.rowCount ? users : await client.query("select id from users where organization_id=$1", [automation.organization_id]);
    if (recipients.rowCount) {
      await Promise.all(recipients.rows.map((user) => client.query(
        "insert into notifications (organization_id,user_id,automation_id,message) values ($1,$2,$3,$4)",
        [automation.organization_id, user.id, automation.id, message],
      )));
    } else {
      await client.query("insert into notifications (organization_id,automation_id,message) values ($1,$2,$3)", [automation.organization_id, automation.id, message]);
    }
    return { action: automation.action, message, recipients: recipients.rowCount };
  }
  if (automation.action === "create_task") {
    const title = String(config.title || message).trim().slice(0, 240);
    const priority = ["low", "medium", "high", "urgent"].includes(config.priority) ? config.priority : "medium";
    const projectId = config.project_id || source.project_id || null;
    const clientId = config.client_id || source.client_id || null;
    const assigneeId = config.assignee_id || source.assignee_id || null;
    await assertOrganizationRelation(client, "projects", projectId, automation.organization_id, "O projeto");
    await assertOrganizationRelation(client, "clients", clientId, automation.organization_id, "O cliente");
    await assertOrganizationRelation(client, "users", assigneeId, automation.organization_id, "O responsável");
    const task = await client.query(
      "insert into tasks (organization_id,title,status,priority,project_id,client_id,assignee_id,due_at,tags) values ($1,$2,'todo',$3,$4,$5,$6,$7,$8) returning id",
      [automation.organization_id, title, priority, projectId, clientId, assigneeId, config.due_at || source.due_at || null, ["automation", automation.trigger]],
    );
    return { action: "create_task", task_id: task.rows[0].id, message: title };
  }
  if (automation.action === "create_followup") {
    const leadId = config.lead_id || source.lead_id || (automation.trigger === "lead_created" ? source.id : null);
    if (!leadId) throw new Error("O follow-up precisa estar vinculado a um lead.");
    const lead = await client.query("select id from leads where id=$1 and organization_id=$2", [leadId, automation.organization_id]);
    if (!lead.rowCount) throw new Error("O lead do follow-up não pertence ao workspace.");
    const dueAt = config.due_at || source.next_action_at || new Date(Date.now() + 2 * 86400000).toISOString();
    const followup = await client.query(
      "insert into followups (organization_id,lead_id,due_at,channel,note) values ($1,$2,$3,$4,$5) returning id",
      [automation.organization_id, leadId, dueAt, String(config.channel || "whatsapp").slice(0, 40), String(config.note || message).slice(0, 4000)],
    );
    return { action: "create_followup", followup_id: followup.rows[0].id, lead_id: leadId };
  }
  if (automation.action === "create_charge") {
    const amount = Number(config.amount ?? source.amount ?? source.value ?? source.total_value ?? 0);
    if (!Number.isFinite(amount) || amount <= 0) throw new Error("A cobrança precisa ter um valor válido.");
    const clientId = config.client_id || source.client_id || null;
    const projectId = config.project_id || source.project_id || null;
    const contractId = config.contract_id || source.contract_id || null;
    await assertOrganizationRelation(client, "clients", clientId, automation.organization_id, "O cliente");
    await assertOrganizationRelation(client, "projects", projectId, automation.organization_id, "O projeto");
    await assertOrganizationRelation(client, "contracts", contractId, automation.organization_id, "O contrato");
    const charge = await client.query(
      "insert into receivables (organization_id,client_id,project_id,contract_id,description,amount,due_at,status) values ($1,$2,$3,$4,$5,$6,$7,'pending') returning id",
      [automation.organization_id, clientId, projectId, contractId, String(config.description || message).slice(0, 240), amount, config.due_at || source.due_at || new Date().toISOString().slice(0, 10)],
    );
    return { action: "create_charge", receivable_id: charge.rows[0].id, amount };
  }
  if (automation.action === "generate_contract" && automation.trigger === "proposal_approved") {
    if (!source.client_id) throw new Error("A proposta aprovada precisa estar vinculada a um cliente.");
    await assertOrganizationRelation(client, "clients", source.client_id, automation.organization_id, "O cliente");
    const existing = await client.query(
      "select id from contracts where proposal_id=$1 and organization_id=$2 order by id limit 1",
      [source.id, automation.organization_id],
    );
    if (existing.rows[0]?.id) return { action: "generate_contract", contract_id: existing.rows[0].id, proposal_id: source.id, reused: true };
    const contract = await client.query(
      "insert into contracts (organization_id,client_id,opportunity_id,proposal_id,name,status,value) values ($1,$2,$3,$4,$5,'draft',$6) returning id",
      [automation.organization_id, source.client_id, source.opportunity_id || null, source.id, String(config.name || source.title || "Contrato de prestação de serviços").slice(0, 240), Number(source.final_amount ?? source.amount ?? 0)],
    );
    return { action: "generate_contract", contract_id: contract.rows[0].id, proposal_id: source.id };
  }
  if (automation.action === "create_project" && automation.trigger === "contract_signed") {
    if (!source.client_id) throw new Error("O contrato assinado precisa estar vinculado a um cliente.");
    await assertOrganizationRelation(client, "clients", source.client_id, automation.organization_id, "O cliente");
    const locked = await client.query("select id,project_id,client_id,name,value,total_value from contracts where id=$1 and organization_id=$2 for update", [source.id, automation.organization_id]);
    if (!locked.rowCount) throw new Error("O contrato assinado não pertence ao workspace.");
    const current = locked.rows[0];
    let existing = null;
    if (current.project_id) {
      const linked = await client.query("select id from projects where id=$1 and organization_id=$2", [current.project_id, automation.organization_id]);
      existing = linked.rows[0] || null;
    }
    if (!existing) {
      const byContract = await client.query("select id from projects where contract_id=$1 and organization_id=$2 order by id limit 1", [source.id, automation.organization_id]);
      existing = byContract.rows[0] || null;
    }
    if (existing) {
      await client.query("update contracts set project_id=$1,updated_at=now() where id=$2 and organization_id=$3", [existing.id, source.id, automation.organization_id]);
      return { action: "create_project", project_id: existing.id, contract_id: source.id, reused: true };
    }
    const project = await client.query(
      "insert into projects (organization_id,contract_id,client_id,name,status,progress,total_value) values ($1,$2,$3,$4,'active',0,$5) returning id",
      [automation.organization_id, source.id, current.client_id, String(config.name || current.name || "Novo projeto").slice(0, 240), Number(current.total_value ?? current.value ?? 0)],
    );
    await client.query("update contracts set project_id=$1,updated_at=now() where id=$2 and organization_id=$3", [project.rows[0].id, source.id, automation.organization_id]);
    return { action: "create_project", project_id: project.rows[0].id, contract_id: source.id };
  }
  if (automation.action === "generate_document") {
    const url = String(config.url || source.document_url || source.url || "").trim();
    if (!url) throw new Error("Informe a URL do documento para gerar e enviar.");
    const projectId = config.project_id || source.project_id || null;
    const clientId = config.client_id || source.client_id || null;
    await assertOrganizationRelation(client, "projects", projectId, automation.organization_id, "O projeto");
    await assertOrganizationRelation(client, "clients", clientId, automation.organization_id, "O cliente");
    const document = await client.query(
      "insert into files (organization_id,name,url,kind,project_id,client_id) values ($1,$2,$3,$4,$5,$6) returning id",
      [automation.organization_id, String(config.name || `${automation.name} · documento`).slice(0, 240), url.slice(0, 4000), String(config.kind || "document").slice(0, 40), projectId, clientId],
    );
    return { action: "generate_document", file_id: document.rows[0].id, project_id: projectId, client_id: clientId };
  }
  if (automation.action === "request_satisfaction") {
    const token = randomBytes(24).toString("base64url");
    const request = await client.query(
      "insert into satisfaction_requests (organization_id,project_id,client_id,token) values ($1,$2,$3,$4) returning id,token",
      [automation.organization_id, source.id || null, source.client_id || null, token],
    );
    return { action: "request_satisfaction", request_id: request.rows[0].id, token: request.rows[0].token, project_id: source.id || null };
  }
  if (automation.action === "request_approval") {
    const projectId = config.project_id || source.project_id || null;
    const clientId = config.client_id || source.client_id || null;
    await assertOrganizationRelation(client, "projects", projectId, automation.organization_id, "O projeto");
    await assertOrganizationRelation(client, "clients", clientId, automation.organization_id, "O cliente");
    const targetType = String(config.target_type || "delivery").slice(0, 80);
    const existing = await client.query("select id from approvals where organization_id=$1 and target_type=$2 and target_id=$3 and status='pending' order by id desc limit 1", [automation.organization_id, targetType, source.id]);
    if (existing.rowCount) return { action: "request_approval", approval_id: existing.rows[0].id, reused: true };
    const approval = await client.query("insert into approvals (organization_id,target_type,target_id,title,client_id,project_id,status) values ($1,$2,$3,$4,$5,$6,'pending') returning id", [automation.organization_id, targetType, source.id, String(config.title || message).slice(0, 240), clientId, projectId]);
    return { action: "request_approval", approval_id: approval.rows[0].id, target_id: source.id };
  }
  if (automation.action === "create_opportunity") {
    const latest = Array.isArray(source.responses) ? source.responses.at(-1) : source.responses;
    const data = latest?.responses && typeof latest.responses === "object" ? latest.responses : (latest && typeof latest === "object" ? latest : {});
    const value = Number(config.amount ?? data.amount ?? data.orcamento ?? 0) || 0;
    const name = String(config.name || data.name || data.nome || source.name || "Nova oportunidade").slice(0, 240);
    const email = data.email || data["e-mail"] || null;
    const phone = data.phone || data.telefone || data.whatsapp || null;
    const lead = await client.query("select id from leads where organization_id=$1 and ((email is not null and email=$2) or (phone is not null and phone=$3)) order by id desc limit 1", [automation.organization_id, email, phone]);
    const opportunity = await client.query("insert into opportunities (organization_id,name,lead_id,stage,amount,notes) values ($1,$2,$3,'new',$4,$5) returning id", [automation.organization_id, name, lead.rows[0]?.id || null, value, JSON.stringify({ form_id: source.id, responses: data })]);
    return { action: "create_opportunity", opportunity_id: opportunity.rows[0].id, lead_id: lead.rows[0]?.id || null };
  }
  if (automation.action === "create_calendar_event") {
    if (automation.trigger === "meeting_scheduled" && SOURCE_TABLES[automation.trigger] === "events") return { action: "create_calendar_event", event_id: source.id, reused: true };
    const startsAt = config.starts_at || source.starts_at || source.due_at || null;
    if (!startsAt || Number.isNaN(Date.parse(startsAt))) throw new Error("O evento precisa ter data e horário válidos.");
    const projectId = config.project_id || source.project_id || null;
    const clientId = config.client_id || source.client_id || null;
    await assertOrganizationRelation(client, "projects", projectId, automation.organization_id, "O projeto");
    await assertOrganizationRelation(client, "clients", clientId, automation.organization_id, "O cliente");
    const event = await client.query(
      "insert into events (organization_id,title,starts_at,description,event_type,client_id,project_id,reminder_minutes) values ($1,$2,$3,$4,$5,$6,$7,$8) returning id",
      [automation.organization_id, String(config.title || message).slice(0, 240), startsAt, String(config.description || message).slice(0, 4000), String(config.event_type || "other").slice(0, 40), clientId, projectId, Math.max(0, Number(config.reminder_minutes ?? 30) || 0)],
    );
    return { action: "create_calendar_event", event_id: event.rows[0].id, project_id: projectId, client_id: clientId };
  }
  if (automation.action === "update_status") {
    const tables = new Set(["leads", "opportunities", "proposals", "contracts", "projects", "tasks", "tickets", "clients", "receivables"]);
    const table = String(config.table || SOURCE_TABLES[automation.trigger] || "");
    const status = String(config.status || "").trim().slice(0, 40);
    if (!tables.has(table) || !source.id || !status) throw new Error("Informe uma tabela e um status válidos para a automação.");
    const updated = await client.query(`update ${table} set status=$1,updated_at=now() where id=$2 and organization_id=$3`, [status, source.id, automation.organization_id]);
    if (!updated.rowCount) throw new Error("O registro da automação não pertence ao workspace.");
    return { action: "update_status", table, id: source.id, status };
  }
  if (automation.action === "move_pipeline") {
    const stage = String(config.stage || "").trim().slice(0, 40);
    if (!source.id || !stage || !["opportunities", "leads"].includes(SOURCE_TABLES[automation.trigger])) throw new Error("Informe uma etapa válida do funil.");
    const table = SOURCE_TABLES[automation.trigger];
    const updated = await client.query(`update ${table} set ${table === "opportunities" ? "stage" : "status"}=$1,updated_at=now() where id=$2 and organization_id=$3`, [stage, source.id, automation.organization_id]);
    if (!updated.rowCount) throw new Error("O registro do funil não pertence ao workspace.");
    return { action: "move_pipeline", table, id: source.id, stage };
  }
  if (automation.action === "assign_owner") {
    const table = SOURCE_TABLES[automation.trigger];
    const targetId = config.user_id || config.owner_id || null;
    const columns = { leads: "owner_id", opportunities: "owner_id", tasks: "assignee_id" };
    if (!source.id || !targetId || !columns[table]) throw new Error("Informe um responsável e um registro compatíveis.");
    await assertOrganizationRelation(client, "users", targetId, automation.organization_id, "O responsável");
    const updated = await client.query(`update ${table} set ${columns[table]}=$1,updated_at=now() where id=$2 and organization_id=$3`, [targetId, source.id, automation.organization_id]);
    if (!updated.rowCount) throw new Error("O registro não pertence ao workspace.");
    return { action: "assign_owner", table, id: source.id, user_id: targetId };
  }
  if (automation.action === "add_tag") {
    const table = SOURCE_TABLES[automation.trigger];
    const tag = String(config.tag || "").trim().slice(0, 40);
    if (!source.id || !tag || !["leads", "opportunities", "tasks"].includes(table)) throw new Error("Informe uma etiqueta e um registro compatíveis.");
    const updated = await client.query(`update ${table} set tags=array_append(array_remove(coalesce(tags,'{}'),$1),$1),updated_at=now() where id=$2 and organization_id=$3`, [tag, source.id, automation.organization_id]);
    if (!updated.rowCount) throw new Error("O registro não pertence ao workspace.");
    return { action: "add_tag", table, id: source.id, tag };
  }
  if (automation.action === "webhook" || automation.action === "n8n_flow") {
    const target = await assertSafeOutboundUrl(config.url);
    const response = await fetch(target, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ automation_id: automation.id, trigger: automation.trigger, source }), redirect: "manual", signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error(`Webhook retornou HTTP ${response.status}.`);
    return { action: automation.action, url: target, status: response.status };
  }
  if (automation.action === "end") return { action: "end", stopped: true };
  if (automation.action === "send_message") {
    const subject = String(config.subject || `Automação: ${automation.name}`).trim().slice(0, 240);
    if (config.channel === "whatsapp") {
      const number = normalizeNumber(config.number || source.phone || source.remote_number);
      if (number.length < 10) throw new Error("A automação WhatsApp precisa de um número de destino válido.");
      await sendWhatsApp(pool, automation.organization_id, number, String(config.body || message).slice(0, 4000));
      return { action: "send_message", channel: "whatsapp", number, message };
    }
    let conversationId = Number(config.conversation_id);
    if (!Number.isSafeInteger(conversationId) || conversationId < 1) {
      const conversation = await client.query(
        "insert into conversations (organization_id,subject,channel) values ($1,$2,'internal') returning id",
        [automation.organization_id, subject],
      );
      conversationId = conversation.rows[0].id;
    }
    const conversation = await client.query("select id from conversations where id=$1 and organization_id=$2", [conversationId, automation.organization_id]);
    if (!conversation.rowCount) throw new Error("Conversa da automação não pertence à organização.");
    await client.query("insert into messages (organization_id,conversation_id,direction,body) values ($1,$2,'out',$3)", [automation.organization_id, conversationId, String(config.body || message).slice(0, 4000)]);
    await client.query("update conversations set last_message_at=now(),updated_at=now() where id=$1 and organization_id=$2", [conversationId, automation.organization_id]);
    return { action: "send_message", conversation_id: conversationId, message };
  }
  if (automation.action === "send_email" || automation.action === "send_onboarding") {
    const recipient = String(config.to || source.email || "").trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(recipient)) throw new Error("A automação de e-mail precisa de um destinatário válido.");
    const delivery = await sendEmail({ to: recipient, subject: String(config.subject || automation.name).slice(0, 240), html: String(config.body || message).slice(0, 10000), text: String(config.body || message).slice(0, 4000) });
    if (!delivery?.sent && automation.action === "send_onboarding" && source.user_id) {
      await client.query("insert into notifications (organization_id,user_id,automation_id,message) values ($1,$2,$3,$4)", [automation.organization_id, source.user_id, automation.id, `${message} · Orienta\u00e7\u00f5es dispon\u00edveis no app.`]);
      return { action: automation.action, to: recipient, email_sent: false, fallback: "internal_notification", message };
    }
    if (!delivery?.sent) throw new Error(delivery?.reason || "O e-mail não foi enviado.");
    if (automation.action === "send_onboarding" && source.user_id) {
      await client.query("insert into notifications (organization_id,user_id,automation_id,message) values ($1,$2,$3,$4)", [automation.organization_id, source.user_id, automation.id, `${message} · Orienta\u00e7\u00f5es dispon\u00edveis no app.`]);
    }
    return { action: automation.action, to: recipient, email_sent: Boolean(delivery.sent), message };
  }
  if (automation.action === "grant_project_access" && automation.trigger === "task_assigned") {
    if (!source.assignee_id || !source.project_id) throw new Error("A tarefa precisa estar vinculada a usuário e projeto.");
    await client.query("insert into project_members (organization_id,project_id,user_id,files_visible,tasks_visible) values ($1,$2,$3,true,true) on conflict (organization_id,project_id,user_id) do update set files_visible=true,tasks_visible=true", [automation.organization_id, source.project_id, source.assignee_id]);
    await client.query("insert into notifications (organization_id,user_id,automation_id,message) values ($1,$2,$3,$4)", [automation.organization_id, source.assignee_id, automation.id, message]);
    return { action: "grant_project_access", project_id: source.project_id, user_id: source.assignee_id };
  }
  if (automation.action === "grant_project_access") {
    if (!source.user_id || !source.project_id) throw new Error("O acesso precisa estar vinculado a usuário e projeto.");
    await client.query("update project_members set files_visible=true,tasks_visible=true where id=$1 and organization_id=$2", [source.id, automation.organization_id]);
    await client.query("insert into notifications (organization_id,user_id,automation_id,message) values ($1,$2,$3,$4)", [automation.organization_id, source.user_id, automation.id, message]);
    return { action: "grant_project_access", project_id: source.project_id, user_id: source.user_id };
  }
  if (automation.action === "reassign_support") {
    let targetId = config.user_id || source.responsible_id || null;
    if (!targetId) {
      const fallback = await client.query("select id from users where organization_id=$1 and coalesce(access_status,'active')='active' and role in ('owner','admin') order by case when role='owner' then 0 else 1 end,id limit 1", [automation.organization_id]);
      targetId = fallback.rows[0]?.id || null;
    }
    if (!targetId) throw new Error("Configure o usuário responsável pelo atendimento.");
    const target = await client.query("select id from users where id=$1 and organization_id=$2 and coalesce(access_status,'active')='active'", [targetId, automation.organization_id]);
    if (!target.rowCount) throw new Error("O responsável pelo atendimento não pertence ao workspace ou está inativo.");
    if (!source.client_id) return { action: "reassign_support", user_id: targetId, tickets: 0 };
    const updated = await client.query("update tickets set assignee_id=$1,updated_at=now() where organization_id=$2 and client_id=$3 and status not in ('done','cancelled')", [targetId, automation.organization_id, source.client_id]);
    return { action: "reassign_support", user_id: targetId, tickets: updated.rowCount || 0, client_id: source.client_id };
  }
  if (automation.action === "revoke_access") {
    if (!source.user_id) throw new Error("O evento de desativação não possui usuário vinculado.");
    const revoked = await client.query("update users set access_status='inactive',access_revoked_at=coalesce(access_revoked_at,now()),deactivated_at=coalesce(deactivated_at,now()) where id=$1 and organization_id=$2 returning id", [source.user_id, automation.organization_id]);
    if (!revoked.rowCount) throw new Error("Usuário desativado não pertence ao workspace.");
    return { action: "revoke_access", user_id: source.user_id };
  }
  if (automation.action === "calculate_commission") {
    const baseAmount = Math.max(0, Number(source.total_value || source.value || config.base_amount || 0));
    const rate = Math.max(0, Number(config.rate ?? config.commission_rate ?? 0));
    const fixedAmount = Math.max(0, Number(config.fixed_amount || 0));
    const amount = fixedAmount || Number((baseAmount * rate / 100).toFixed(2));
    if (!amount) throw new Error("Informe o percentual ou valor fixo da comissão.");
    let userId = config.user_id || null;
    if (userId) {
      const user = await client.query("select id from users where id=$1 and organization_id=$2", [userId, automation.organization_id]);
      if (!user.rowCount) throw new Error("O responsável da comissão não pertence à organização.");
      userId = user.rows[0].id;
    }
    const commission = await client.query(
      "insert into commissions (organization_id,project_id,user_id,responsible,description,base_amount,rate,amount,status,source_automation_id) values ($1,$2,$3,$4,$5,$6,$7,$8,'pending',$9) on conflict (source_automation_id,project_id) do nothing returning id,amount",
      [automation.organization_id, source.id, userId, source.responsible || config.responsible || null, `Comissão · ${source.name || source.id}`, baseAmount, rate, amount, automation.id],
    );
    return { action: "calculate_commission", commission_id: commission.rows[0]?.id || null, amount, base_amount: baseAmount, rate };
  }
  throw new Error(`Ação não suportada: ${automation.action}`);
}

export async function runSubscriptionBillingCycle(pool, today = new Date()) {
  const client = await pool.connect();
  let created = 0;
  try {
    const due = await client.query("select * from subscriptions where status='active' and next_billing_on is not null and next_billing_on <= $1::date order by id", [today]);
    for (const subscription of due.rows) {
      await client.query("begin");
      try {
        const inserted = await client.query(
          "insert into receivables (organization_id,client_id,description,amount,due_at,status,subscription_id,billing_period) values ($1,$2,$3,$4,$5,'pending',$6,$5) on conflict (subscription_id,billing_period) do nothing returning id",
          [subscription.organization_id, subscription.client_id, `Assinatura · ${subscription.plan}`, subscription.amount, subscription.next_billing_on, subscription.id],
        );
        const step = subscription.interval === "yearly" ? "1 year" : "1 month";
        await client.query(`update subscriptions set next_billing_on=(next_billing_on + interval '${step}')::date,updated_at=now() where id=$1 and organization_id=$2 and status='active'`, [subscription.id, subscription.organization_id]);
        await client.query("commit");
        created += inserted.rowCount;
      } catch (error) {
        await client.query("rollback").catch(() => {});
        console.error("Subscription billing error:", error.message);
      }
    }
  } finally {
    client.release();
  }
  return created;
}

export async function runAutomationCycle(pool, now = new Date(), options = {}) {
  const client = await pool.connect();
  let processed = 0;
  try {
    const automations = await client.query("select * from automations where active=true order by id");
    for (const automation of automations.rows) {
      const sources = await findSources(client, automation, now);
      for (const source of sources) {
        await client.query("begin");
        try {
          const claim = await client.query(
            "insert into automation_runs (organization_id,automation_id,source_type,source_id) values ($1,$2,$3,$4) on conflict (automation_id,source_type,source_id) do nothing returning id",
            [automation.organization_id, automation.id, automation.trigger, source.id],
          );
          if (!claim.rowCount) { await client.query("rollback"); continue; }
          const result = await executeAction(client, automation, source, { ...options, pool });
          await client.query("update automation_runs set result=$1 where id=$2", [result, claim.rows[0].id]);
          await client.query("update automations set runs=coalesce(runs,0)+1,updated_at=now() where id=$1 and organization_id=$2", [automation.id, automation.organization_id]);
          await client.query("commit");
          processed += 1;
        } catch (error) {
          await client.query("rollback").catch(() => {});
          await client.query(
            "insert into automation_runs (organization_id,automation_id,source_type,source_id,result) values ($1,$2,$3,$4,$5) on conflict (automation_id,source_type,source_id) do update set result=excluded.result",
            [automation.organization_id, automation.id, automation.trigger, source.id, { error: error.message }],
          );
        }
      }
    }
  } finally {
    client.release();
  }
  await runSubscriptionBillingCycle(pool, now);
  return processed;
}

export function startAutomationRunner(pool, intervalMs = Number(process.env.AUTOMATIONS_INTERVAL_MS || 60000)) {
  const run = () => runAutomationCycle(pool).catch((error) => console.error("Automation runner error:", error.message));
  const timer = setInterval(run, Math.max(5000, intervalMs));
  timer.unref?.();
  run();
  return () => clearInterval(timer);
}
