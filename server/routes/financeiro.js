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
