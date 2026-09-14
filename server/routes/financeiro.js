/* Rotas específicas do domínio financeiro. */
export function register(app, ctx) {
  const { pool, tenant, asText, classifyDbError, validateRelations } = ctx;
  const error = (res, e, fallback) => { const out = classifyDbError(e, fallback); res.status(out.status).json({ error: out.error }); };
  const recordReceivablePayment = async (req, res) => {
    const org = tenant(req, res); if (!org) return;
    const amount = Number(req.body?.amount), method = asText(req.body?.method) || "manual";
    if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ error: "Informe um valor de pagamento válido." });
    const db = pool.connect ? await pool.connect() : pool;
    try {
      await db.query("begin");
      const receivable = await db.query("select * from receivables where id=$1 and organization_id=$2 for update", [req.params.id, org]);
      if (!receivable.rowCount) { await db.query("rollback"); return res.status(404).json({ error: "Conta a receber não encontrada." }); }
      const source = receivable.rows[0];
      if (["paid", "cancelled"].includes(source.status)) { await db.query("rollback"); return res.status(400).json({ error: "Esta conta não aceita novos pagamentos." }); }
      const prior = await db.query("select coalesce(sum(amount),0)::float8 total from payments where receivable_id=$1 and organization_id=$2", [source.id, org]);
      const remaining = Math.max(0, Number(source.amount || 0) - Number(prior.rows[0]?.total || 0));
      if (amount > remaining + 0.005) { await db.query("rollback"); return res.status(400).json({ error: "O pagamento não pode exceder o saldo restante." }); }
      const payment = await db.query("insert into payments (organization_id,receivable_id,amount,paid_at,method) values ($1,$2,$3,now(),$4) returning *", [org, source.id, amount, method]);
      const totalPaid = Number(prior.rows[0]?.total || 0) + amount;
      const paid = totalPaid >= Number(source.amount || 0) - 0.005;
      const updated = await db.query("update receivables set status=$1,paid_at=case when $1='paid' then now() else paid_at end,updated_at=now() where id=$2 and organization_id=$3 returning *", [paid ? "paid" : "partially_paid", source.id, org]);
      const revenue = await db.query("insert into revenues (organization_id,description,client_id,project_id,contract_id,amount,net_amount,payment_method,paid_at,status) values ($1,$2,$3,$4,$5,$6,$6,$7,now(),'confirmed') returning *", [org, source.description, source.client_id, source.project_id, source.contract_id, amount, method]);
      await db.query("commit");
      res.status(201).json({ payment: payment.rows[0], receivable: updated.rows[0], revenue: revenue.rows[0], remaining: Math.max(0, Number(source.amount || 0) - totalPaid) });
    } catch (e) { await db.query("rollback").catch(() => {}); error(res, e, "Não foi possível registrar o pagamento."); }
    finally { db.release?.(); }
  };
  app.post("/api/receivables/:id/record-payment", recordReceivablePayment);
  app.post("/api/payables/:id/record-payment", async (req, res) => {
    const org = tenant(req, res); if (!org) return;
    const db = pool.connect ? await pool.connect() : pool;
    try {
      await db.query("begin");
      const source = await db.query("select * from payables where id=$1 and organization_id=$2 for update", [req.params.id, org]);
      if (!source.rowCount) { await db.query("rollback"); return res.status(404).json({ error: "Conta a pagar não encontrada." }); }
      const payable = source.rows[0];
      if (["paid", "cancelled"].includes(payable.status)) { await db.query("rollback"); return res.status(400).json({ error: "Esta conta não aceita nova baixa." }); }
      const expense = await db.query("insert into expenses (organization_id,description,project_id,client_id,amount,supplier,status,due_at,paid_at) values ($1,$2,$3,$4,$5,$6,'paid',$7,now()) returning *", [org, payable.description, payable.project_id, payable.client_id, payable.amount, payable.supplier, payable.due_at]);
      const updated = await db.query("update payables set status='paid',paid_at=now(),updated_at=now() where id=$1 and organization_id=$2 returning *", [payable.id, org]);
      await db.query("commit");
      res.status(201).json({ payable: updated.rows[0], expense: expense.rows[0] });
    } catch (e) { await db.query("rollback").catch(() => {}); error(res, e, "Não foi possível registrar o pagamento da conta."); }
    finally { db.release?.(); }
  });
  app.post("/api/receivables/:id/create-charge", async (req, res) => {
    const org = tenant(req, res); if (!org) return;
    const channel = ["pix", "boleto", "card", "link", "transfer"].includes(req.body?.channel) ? req.body.channel : "link";
    try {
      const receivable = await pool.query("select * from receivables where id=$1 and organization_id=$2", [req.params.id, org]);
      if (!receivable.rowCount) return res.status(404).json({ error: "Conta a receber não encontrada." });
      const source = receivable.rows[0];
      if (["paid", "cancelled"].includes(source.status)) return res.status(400).json({ error: "Esta conta não aceita novas cobranças." });
      const existing = await pool.query("select * from charges where receivable_id=$1 and organization_id=$2 and status in ('draft','generated','sent','pending') order by created_at desc limit 1", [source.id, org]);
      if (existing.rowCount) return res.json({ charge: existing.rows[0], created: false, provider_connected: false });
      const charge = await pool.query("insert into charges (organization_id,receivable_id,client_id,project_id,channel,status,amount,due_at,message) values ($1,$2,$3,$4,$5,'generated',$6,$7,$8) returning *", [org, source.id, source.client_id, source.project_id, channel, source.updated_amount ?? source.amount, source.due_at, asText(req.body?.message) || `Cobrança: ${source.description}`]);
      res.status(201).json({ charge: charge.rows[0], created: true, provider_connected: false, notice: "Cobrança registrada. Conecte um gateway para gerar Pix, boleto ou link de pagamento." });
    } catch (e) { error(res, e, "Não foi possível gerar a cobrança."); }
  });
  app.post("/api/contracts/:id/create-receivables", async (req, res) => {
    const org = tenant(req, res); if (!org) return;
    const db = pool.connect ? await pool.connect() : pool;
    try {
      await db.query("begin");
      const contract = await db.query("select * from contracts where id=$1 and organization_id=$2 for update", [req.params.id, org]);
      if (!contract.rowCount) { await db.query("rollback"); return res.status(404).json({ error: "Contrato não encontrado." }); }
      const source = contract.rows[0];
      if (!["signed", "active"].includes(source.status)) { await db.query("rollback"); return res.status(400).json({ error: "O contrato precisa estar assinado ou ativo para gerar parcelas." }); }
      const existing = await db.query("select id from receivables where contract_id=$1 and organization_id=$2 order by installment_number nulls last, id", [source.id, org]);
      if (existing.rowCount) { await db.query("commit"); return res.json({ receivables: existing.rows, created: false }); }
      const total = Number(source.total_value ?? source.value ?? 0), entry = Number(source.down_payment || 0), installments = Math.max(1, Number.parseInt(source.installments, 10) || 1);
      if (!Number.isFinite(total) || total <= 0 || !Number.isFinite(entry) || entry < 0 || entry > total) { await db.query("rollback"); return res.status(400).json({ error: "Valores do contrato inválidos para gerar parcelas." }); }
      const balance = total - entry, installmentValue = Number(source.installment_value) > 0 ? Number(source.installment_value) : balance / installments;
      const suppliedDates = String(source.payment_due_dates || "").split(",").map((value) => value.trim()).filter((value) => /^\d{4}-\d{2}-\d{2}$/.test(value));
      const dueDate = (index) => suppliedDates[index] || new Date(Date.now() + (index + 1) * 30 * 864e5).toISOString().slice(0, 10);
      const created = [];
      if (entry > 0) { const q = await db.query("insert into receivables (organization_id,client_id,project_id,contract_id,proposal_id,description,amount,original_amount,updated_amount,due_at,status,installment_number,payment_method) values ($1,$2,$3,$4,$5,$6,$7,$7,$7,current_date,'pending',0,$8) returning *", [org, source.client_id, source.project_id || null, source.id, source.proposal_id || null, `${source.name} · Entrada`, entry, source.payment_method || null]); created.push(q.rows[0]); }
      for (let index = 0; index < installments && balance > 0; index += 1) { const amount = index === installments - 1 ? Math.max(0, balance - installmentValue * (installments - 1)) : installmentValue; if (amount <= 0) continue; const q = await db.query("insert into receivables (organization_id,client_id,project_id,contract_id,proposal_id,description,amount,original_amount,updated_amount,due_at,status,installment_number,payment_method) values ($1,$2,$3,$4,$5,$6,$7,$7,$7,$8,'pending',$9,$10) returning *", [org, source.client_id, source.project_id || null, source.id, source.proposal_id || null, `${source.name} · Parcela ${index + 1}/${installments}`, amount, dueDate(index), index + 1, source.payment_method || null]); created.push(q.rows[0]); }
      await db.query("commit");
      res.status(201).json({ receivables: created, created: true });
    } catch (e) { await db.query("rollback").catch(() => {}); error(res, e, "Não foi possível gerar as parcelas do contrato."); }
    finally { db.release?.(); }
  });
  app.get("/api/finance/summary", async (req, res) => {
    const org = tenant(req, res); if (!org) return;
    const months = Math.min(24, Math.max(1, Number.parseInt(req.query.months, 10) || 6));
    try {
      const q = await pool.query(`with months as (select (date_trunc('month', now()) - make_interval(months => n))::date as month from generate_series(0, $2::int - 1) as n), rev as (select date_trunc('month', coalesce(paid_at, due_at))::date as month, sum(amount) as amount from revenues where organization_id=$1 and paid_at is not null group by 1), exp as (select date_trunc('month', coalesce(paid_at, due_at))::date as month, sum(amount) as amount from expenses where organization_id=$1 and paid_at is not null group by 1) select to_char(m.month, 'YYYY-MM') as month, coalesce(r.amount, 0)::float8 as revenue, coalesce(e.amount, 0)::float8 as expense, (coalesce(r.amount, 0) - coalesce(e.amount, 0))::float8 as result from months m left join rev r on r.month = m.month left join exp e on e.month = m.month order by m.month`, [org, months]);
      res.json({ summary: q.rows });
    } catch (e) { error(res, e, "Não foi possível carregar o resumo financeiro."); }
  });

  app.get("/api/subscriptions", async (req, res) => { const org = tenant(req, res); if (!org) return; try { const q = await pool.query("select s.*,c.name client_name from subscriptions s left join clients c on c.id=s.client_id and c.organization_id=s.organization_id where s.organization_id=$1 order by s.created_at desc", [org]); res.json({ subscriptions: q.rows }); } catch (e) { error(res,e,"Não foi possível carregar as assinaturas."); } });
  app.post("/api/subscriptions", async (req, res) => { const org = tenant(req, res); if (!org) return; const plan=asText(req.body?.plan), amount=Number(req.body?.amount), interval=["monthly","yearly"].includes(req.body?.interval)?req.body.interval:"monthly", clientId=req.body?.client_id || null; if (!plan || !Number.isFinite(amount) || amount < 0) return res.status(400).json({error:"Informe plano e valor válidos."}); try { await validateRelations({client_id:clientId},org); const q=await pool.query("insert into subscriptions (organization_id,client_id,plan,amount,interval,next_billing_on) values ($1,$2,$3,$4,$5,$6) returning *",[org,clientId,plan,amount,interval,req.body?.next_billing_on || null]); res.status(201).json({subscription:q.rows[0]}); } catch(e) { if(e.code==="invalid_relation") return res.status(400).json({error:e.message}); error(res,e,"Não foi possível criar a assinatura."); } });
  app.patch("/api/subscriptions/:id", async (req,res) => { const org=tenant(req,res); if(!org)return; const status=["active","paused","cancelled"].includes(req.body?.status)?req.body.status:null; if(!status)return res.status(400).json({error:"Status inválido."}); try { const q=await pool.query("update subscriptions set status=$1,updated_at=now() where id=$2 and organization_id=$3 returning *",[status,req.params.id,org]); if(!q.rowCount)return res.status(404).json({error:"Assinatura não encontrada."}); res.json({subscription:q.rows[0]}); }catch(e){error(res,e,"Não foi possível atualizar a assinatura.");} });
  app.delete("/api/subscriptions/:id", async (req,res) => { const org=tenant(req,res);if(!org)return;try{const q=await pool.query("delete from subscriptions where id=$1 and organization_id=$2 returning id",[req.params.id,org]);if(!q.rowCount)return res.status(404).json({error:"Assinatura não encontrada."});res.status(204).end();}catch(e){error(res,e,"Não foi possível excluir a assinatura.");} });
}
