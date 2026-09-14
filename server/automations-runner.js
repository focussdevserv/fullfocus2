const SOURCE_TABLES = {
  lead_created: "leads",
  task_overdue: "tasks",
  receivable_overdue: "receivables",
  ticket_created: "tickets",
};

const sourceWhere = {
  lead_created: "created_at <= $2",
  task_overdue: "status <> 'done' and due_at is not null and due_at < $2",
  receivable_overdue: "status = 'pending' and due_at < $2::date",
  ticket_created: "created_at <= $2",
};

const sourceMessage = (trigger, row) => {
  if (trigger === "lead_created") return `Novo lead: ${row.name}`;
  if (trigger === "task_overdue") return `Tarefa atrasada: ${row.title}`;
  if (trigger === "receivable_overdue") return `Recebível vencido: ${row.description}`;
  return `Novo ticket: ${row.title}`;
};

async function findSources(client, automation, now) {
  const table = SOURCE_TABLES[automation.trigger];
  const where = sourceWhere[automation.trigger];
  if (!table || !where) return [];
  const query = `select s.* from ${table} s where s.organization_id=$1 and ${where}
    and not exists (select 1 from automation_runs r where r.automation_id=$3 and r.source_type=$4 and r.source_id=s.id)
    order by s.id limit 100`;
  const result = await client.query(query, [automation.organization_id, now, automation.id, automation.trigger]);
  return result.rows;
}

async function executeAction(client, automation, source) {
  const config = automation.config && typeof automation.config === "object" ? automation.config : {};
  const message = sourceMessage(automation.trigger, source);
  if (automation.action === "notify") {
    const users = await client.query("select id from users where organization_id=$1", [automation.organization_id]);
    if (users.rowCount) {
      await Promise.all(users.rows.map((user) => client.query(
        "insert into notifications (organization_id,user_id,automation_id,message) values ($1,$2,$3,$4)",
        [automation.organization_id, user.id, automation.id, message],
      )));
    } else {
      await client.query("insert into notifications (organization_id,automation_id,message) values ($1,$2,$3)", [automation.organization_id, automation.id, message]);
    }
    return { action: "notify", message, recipients: users.rowCount };
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

export async function runAutomationCycle(pool, now = new Date()) {
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
          const result = await executeAction(client, automation, source);
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
