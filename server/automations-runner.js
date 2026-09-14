import { normalizeNumber, sendWhatsappText } from "./routes/whatsapp.js";
import { sendEmail } from "./mailer.js";

const SOURCE_TABLES = {
  lead_created: "leads",
  task_due_soon: "tasks",
  task_overdue: "tasks",
  receivable_overdue: "receivables",
  ticket_created: "tickets",
  freelancer_project_finished: "projects",
  project_completed: "projects",
  team_member_invited: "users",
  member_added_to_project: "project_members",
  project_member_added: "project_members",
  task_assigned: "tasks",
  member_overloaded: "users",
  absence_started: "absences",
  sale_won: "opportunities",
  user_deactivated: "team_access_events",
};

const sourceWhere = {
  lead_created: "created_at <= $2",
  task_due_soon: "status not in ('done','cancelled') and due_at is not null and due_at > $2 and due_at <= ($2 + interval '1 day')",
  task_overdue: "status <> 'done' and due_at is not null and due_at < $2",
  receivable_overdue: "status = 'pending' and due_at < $2::date",
  ticket_created: "created_at <= $2",
  freelancer_project_finished: "(status in ('done','completed','published') or completed_on is not null) and (completed_on is null or completed_on <= $2::date)",
  project_completed: "(status in ('done','completed','published') or completed_on is not null) and (completed_on is null or completed_on <= $2::date)",
  team_member_invited: "created_at <= $2 and coalesce(access_status,'active') = 'active'",
  member_added_to_project: "added_at <= $2",
  project_member_added: "added_at <= $2",
  task_assigned: "assigned_at is not null and assigned_at <= $2 and assignee_id is not null",
  member_overloaded: "coalesce(s.access_status,'active') = 'active' and (select count(*) from tasks t where t.organization_id=s.organization_id and t.assignee_id=s.id and t.status not in ('done','cancelled')) > 5",
  absence_started: "s.starts_on = $2::date and lower(s.kind) in ('vacation','ferias','férias')",
  sale_won: "s.stage in ('won','closed_won','sale_won')",
  user_deactivated: "s.created_at <= $2",
};

const sourceMessage = (trigger, row) => {
  if (trigger === "lead_created") return `Novo lead: ${row.name}`;
  if (trigger === "task_due_soon") return `Tarefa próxima do prazo: ${row.title}`;
  if (trigger === "task_overdue") return `Tarefa atrasada: ${row.title}`;
  if (trigger === "receivable_overdue") return `Recebível vencido: ${row.description}`;
  if (trigger === "freelancer_project_finished" || trigger === "project_completed") return `Projeto finalizado: ${row.name}`;
  if (trigger === "team_member_invited") return `Bem-vindo ao FocusDev, ${row.name}`;
  if (trigger === "member_added_to_project" || trigger === "project_member_added") return `Você foi adicionado ao projeto ${row.project_name || row.project_id}.`;
  if (trigger === "task_assigned") return `Nova tarefa atribuída: ${row.title}`;
  if (trigger === "member_overloaded") return `Membro sobrecarregado: ${row.name} (${row.open_tasks} tarefas abertas)`;
  if (trigger === "absence_started") return `Férias iniciadas: ${row.member_name || row.user_id}`;
  if (trigger === "user_deactivated") return `Usuário desativado: ${row.member_name || row.user_id}`;
  return `Novo ticket: ${row.title}`;
};

async function findSources(client, automation, now) {
  const table = SOURCE_TABLES[automation.trigger];
  const where = sourceWhere[automation.trigger];
  if (!table || !where) return [];
  const select = table === "project_members" ? "select s.*,u.name member_name,u.email,p.name project_name" : automation.trigger === "task_assigned" ? "select s.*,u.name member_name,u.email" : automation.trigger === "member_overloaded" ? "select s.*,(select count(*)::int from tasks t where t.organization_id=s.organization_id and t.assignee_id=s.id and t.status not in ('done','cancelled')) open_tasks" : automation.trigger === "absence_started" ? "select s.*,u.name member_name,u.manager_id" : automation.trigger === "sale_won" ? "select s.*,(select c.id from clients c where c.organization_id=s.organization_id and ((s.contact_id is not null and c.contact_id=s.contact_id) or (s.company_id is not null and c.company_id=s.company_id)) order by c.id limit 1) client_id" : automation.trigger === "user_deactivated" ? "select s.*,u.name member_name,u.manager_id,u.email" : "select s.*";
  const joins = table === "project_members" ? " join users u on u.id=s.user_id and u.organization_id=s.organization_id join projects p on p.id=s.project_id and p.organization_id=s.organization_id" : automation.trigger === "task_assigned" ? " join users u on u.id=s.assignee_id and u.organization_id=s.organization_id" : automation.trigger === "absence_started" ? " join users u on u.id=s.user_id and u.organization_id=s.organization_id" : automation.trigger === "user_deactivated" ? " join users u on u.id=s.user_id and u.organization_id=s.organization_id" : "";
  const query = `${select} from ${table} s${joins} where s.organization_id=$1 and ${where}
    and not exists (select 1 from automation_runs r where r.automation_id=$3 and r.source_type=$4 and r.source_id=s.id)
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
    const priority = ["low", "medium", "high"].includes(config.priority) ? config.priority : "medium";
    const task = await client.query(
      "insert into tasks (organization_id,title,status,priority,tags) values ($1,$2,'todo',$3,$4) returning id",
      [automation.organization_id, title, priority, ["automation", automation.trigger]],
    );
    return { action: "create_task", task_id: task.rows[0].id, message: title };
  }
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
    if (!delivery?.sent) throw new Error(delivery?.reason || "O e-mail não foi enviado.");
    return { action: automation.action, to: recipient, message };
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
