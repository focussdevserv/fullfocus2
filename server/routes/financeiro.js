/* Rotas específicas do domínio financeiro. */
import { cancelOrder, createCheckoutPreference, createPixOrder, createSubscription, getOrder, getPayment, getSubscription, mercadoPagoConfigured, mercadoPagoWebhookConfigured, newIdempotencyKey, paymentState, refundOrder, updateSubscription, validateMercadoPagoWebhook } from "../mercadopago.js";

async function processMercadoPagoPayment({ pool, dataId, type = "payment" }) {
  const payment = type === "order" ? await getOrder(dataId) : await getPayment(dataId);
  if (!payment.external_id) return;
  const db = pool.connect ? await pool.connect() : pool;
  try {
    await db.query("begin");
    const chargeResult = await db.query("select * from charges where provider='mercado_pago' and external_id=$1 for update", [payment.external_id]);
    if (!chargeResult.rowCount) { await db.query("rollback"); return; }
    const charge = chargeResult.rows[0];
    const state = paymentState(payment.status);
    await db.query("update charges set status=$1,provider_status=$2,provider_payload=$3::jsonb where id=$4", [state, payment.status, JSON.stringify(payment.raw || {}), charge.id]);
    if (state !== "paid") { await db.query("commit"); return; }
    const paymentExternalId = payment.payment_id || payment.external_id;
    const duplicate = await db.query("select id from payments where organization_id=$1 and external_id=$2 limit 1", [charge.organization_id, paymentExternalId]);
    if (!duplicate.rowCount) {
      const amount = Number(payment.amount || payment.raw?.transaction_amount || charge.amount || 0);
      const inserted = await db.query("insert into payments (organization_id,receivable_id,charge_id,amount,paid_at,method,external_id,provider_status) values ($1,$2,$3,$4,now(),'mercado_pago',$5,$6) returning *", [charge.organization_id, charge.receivable_id, charge.id, amount, paymentExternalId, payment.status]);
      const receivable = await db.query("select * from receivables where id=$1 and organization_id=$2 for update", [charge.receivable_id, charge.organization_id]);
      if (receivable.rowCount) {
        const prior = await db.query("select coalesce(sum(amount),0)::float8 total from payments where receivable_id=$1 and organization_id=$2", [charge.receivable_id, charge.organization_id]);
        const paid = Number(prior.rows[0]?.total || 0) >= Number(receivable.rows[0].amount || 0) - 0.005;
        await db.query("update receivables set status=$1,paid_at=case when $1='paid' then now() else paid_at end,updated_at=now() where id=$2 and organization_id=$3", [paid ? "paid" : "partially_paid", charge.receivable_id, charge.organization_id]);
        await db.query("insert into revenues (organization_id,description,client_id,project_id,contract_id,amount,net_amount,payment_method,paid_at,status) values ($1,$2,$3,$4,$5,$6,$6,'mercado_pago',now(),'confirmed')", [charge.organization_id, receivable.rows[0].description, receivable.rows[0].client_id, receivable.rows[0].project_id, receivable.rows[0].contract_id, amount]);
      }
      void inserted;
    }
    await db.query("commit");
  } catch (error) { await db.query("rollback").catch(() => {}); throw error; } finally { db.release?.(); }
}

async function processMercadoPagoSubscription({ pool, dataId }) {
  const provider = await getSubscription(dataId);
  const status = String(provider?.status || "pending").toLowerCase();
  const internal = status === "authorized" ? "active" : status === "paused" ? "paused" : ["cancelled", "canceled"].includes(status) ? "cancelled" : "active";
  await pool.query("update subscriptions set status=$1,provider_status=$2,provider_payload=$3::jsonb,updated_at=now() where provider='mercado_pago' and provider_id=$4", [internal, status, JSON.stringify(provider || {}), String(dataId)]);
}

export function register(app, ctx) {
  const { pool, tenant, asText, classifyDbError, validateRelations } = ctx;
  const error = (res, e, fallback) => { const out = classifyDbError(e, fallback); res.status(out.status).json({ error: out.error }); };
  app.get("/api/bank_accounts", async (req, res) => {
    const org = tenant(req, res); if (!org) return;
    const values = [org], where = ["b.organization_id=$1"], search = asText(req.query?.search || req.query?.q);
    if (search) { values.push(search); const p = `$${values.length}`; where.push(`(b.name ilike '%' || ${p} || '%' or coalesce(b.kind,'') ilike '%' || ${p} || '%' or exists (select 1 from bank_account_transactions bt where bt.bank_account_id=b.id and bt.organization_id=b.organization_id and bt.description ilike '%' || ${p} || '%'))`); }
    if (["active", "inactive"].includes(String(req.query?.status))) { values.push(String(req.query.status)); where.push(`b.status=$${values.length}`); }
    const limit = Math.min(Math.max(Number(req.query?.limit) || 250, 1), 250), offset = Math.max(Number(req.query?.offset) || 0, 0); values.push(limit, offset);
    try { const q = await pool.query(`select b.* from bank_accounts b where ${where.join(" and ")} order by b.created_at desc limit $${values.length - 1} offset $${values.length}`, values); return res.json({ bank_accounts: q.rows, pagination: { limit, offset, returned: q.rows.length } }); } catch (e) { return error(res, e, "Não foi possível carregar as contas bancárias."); }
  });
  app.use("/api/subscriptions", async (req, res, next) => {
    if (req.method !== "GET") return next();
    const org = tenant(req, res); if (!org) return;
    const search = asText(req.query?.search || req.query?.q), status = asText(req.query?.status); const params = [org], where = ["s.organization_id=$1"];
    if (search) { params.push(search); where.push(`(s.plan ilike '%' || $${params.length} || '%' or coalesce(c.name,'') ilike '%' || $${params.length} || '%')`); }
    if (["active", "paused", "cancelled", "pending"].includes(status)) { params.push(status); where.push(`s.status=$${params.length}`); }
    const limit = Math.min(Math.max(Number(req.query?.limit) || 250, 1), 250), offset = Math.max(Number(req.query?.offset) || 0, 0); params.push(limit, offset);
    try { const q = await pool.query(`select s.*,c.name client_name from subscriptions s left join clients c on c.id=s.client_id and c.organization_id=s.organization_id where ${where.join(" and ")} order by s.created_at desc limit $${params.length - 1} offset $${params.length}`, params); return res.json({ subscriptions: q.rows, pagination: { limit, offset, returned: q.rows.length } }); } catch (e) { return error(res, e, "Nao foi possivel carregar as assinaturas."); }
  });
  const recordReceivablePayment = async (req, res) => {
    const org = tenant(req, res); if (!org) return;
    const amount = Number(req.body?.amount), method = asText(req.body?.method) || "manual";
    if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ error: "Informe um valor de pagamento válido." });
    return res.status(409).json({ error: "As baixas de contas a receber são confirmadas exclusivamente pelo Mercado Pago." });
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
  app.get("/api/bank_accounts/:id/transactions", async (req, res) => { const org = tenant(req, res); if (!org) return; try { const q = await pool.query("select * from bank_account_transactions where bank_account_id=$1 and organization_id=$2 order by occurred_at desc,id desc", [req.params.id, org]); res.json({ transactions: q.rows }); } catch (e) { error(res, e, "Não foi possível carregar as movimentações da conta."); } });
  app.post("/api/bank_accounts/:id/transactions", async (req, res) => {
    const org = tenant(req, res); if (!org) return;
    const kind = asText(req.body?.kind), description = asText(req.body?.description), amount = Number(req.body?.amount);
    if (!['credit', 'debit'].includes(kind) || !description || !Number.isFinite(amount) || amount <= 0) return res.status(400).json({ error: "Informe tipo, descrição e valor válidos." });
    const db = pool.connect ? await pool.connect() : pool;
    try { await db.query("begin"); const account = await db.query("select * from bank_accounts where id=$1 and organization_id=$2 for update", [req.params.id, org]); if (!account.rowCount) { await db.query("rollback"); return res.status(404).json({ error: "Conta bancária não encontrada." }); } const transaction = await db.query("insert into bank_account_transactions (organization_id,bank_account_id,kind,amount,description) values ($1,$2,$3,$4,$5) returning *", [org, req.params.id, kind, amount, description]); const delta = kind === "credit" ? amount : -amount; const updated = await db.query("update bank_accounts set current_balance=coalesce(current_balance,0)+$1,updated_at=now() where id=$2 and organization_id=$3 returning *", [delta, req.params.id, org]); await db.query("commit"); res.status(201).json({ transaction: transaction.rows[0], bank_account: updated.rows[0] }); } catch (e) { await db.query("rollback").catch(() => {}); error(res, e, "Não foi possível registrar a movimentação."); } finally { db.release?.(); }
  });
  app.get("/api/integrations/mercadopago/status", (_req, res) => res.json({ configured: mercadoPagoConfigured(), webhook_configured: mercadoPagoWebhookConfigured(), provider: "mercado_pago", capabilities: ["pix", "checkout", "card", "boleto", "webhook"] }));
  app.post("/api/webhooks/mercadopago", (req, res) => {
    if (!mercadoPagoWebhookConfigured()) return res.status(503).json({ error: "Webhook do Mercado Pago ainda não foi configurado." });
    const dataId = asText(req.query?.["data.id"] || req.body?.data?.id);
    const type = asText(req.query?.type || req.body?.type || req.body?.topic) || "payment";
    if (!validateMercadoPagoWebhook({ signature: req.get("x-signature"), requestId: req.get("x-request-id"), dataId })) return res.status(401).json({ error: "Assinatura do webhook inválida." });
    res.status(200).json({ received: true });
    void (type === "subscription_preapproval" || type === "preapproval"
      ? processMercadoPagoSubscription({ pool, dataId })
      : processMercadoPagoPayment({ pool, dataId, type })).catch(() => {});
  });
  app.post("/api/receivables/:id/create-charge", async (req, res) => {
    const org = tenant(req, res); if (!org) return;
    const channel = ["pix", "boleto", "card", "link"].includes(req.body?.channel) ? req.body.channel : "link";
    try {
      const receivable = await pool.query("select * from receivables where id=$1 and organization_id=$2", [req.params.id, org]);
      if (!receivable.rowCount) return res.status(404).json({ error: "Conta a receber não encontrada." });
      const source = receivable.rows[0];
      if (["paid", "cancelled"].includes(source.status)) return res.status(400).json({ error: "Esta conta não aceita novas cobranças." });
      if (!mercadoPagoConfigured()) return res.status(503).json({ error: "Mercado Pago não está configurado. Configure o Access Token antes de gerar cobranças." });
      if (req.body?.channel === "transfer" || req.body?.provider === "manual") return res.status(400).json({ error: "A Focussdev utiliza exclusivamente o Mercado Pago para cobranças." });
      const existing = await pool.query("select * from charges where receivable_id=$1 and organization_id=$2 and status in ('draft','generated','sent','pending') order by created_at desc limit 1", [source.id, org]);
      if (existing.rowCount) return res.json({ charge: existing.rows[0], created: false, provider_connected: existing.rows[0].provider === "mercado_pago", pix: existing.rows[0].pix_payload ? { payload: existing.rows[0].pix_payload, qr_data_url: existing.rows[0].pix_qr_data_url, document_kind: existing.rows[0].document_kind } : null });
      const amount = Number(source.updated_amount ?? source.amount);
      if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ error: "A conta a receber não possui um valor válido." });
      const useMercadoPago = mercadoPagoConfigured() && channel !== "transfer" && req.body?.provider !== "manual";
      if (useMercadoPago) {
        const client = source.client_id ? await pool.query("select name,email,document from clients where id=$1 and organization_id=$2", [source.client_id, org]) : { rows: [] };
        const email = asText(client.rows[0]?.email);
        if (!email) return res.status(400).json({ error: "Cadastre o e-mail do cliente antes de gerar uma cobrança Mercado Pago." });
        const idempotencyKey = newIdempotencyKey();
        const externalReference = `focussdev:${org}:receivable:${source.id}`;
        let providerCharge;
        try {
          providerCharge = channel === "pix"
            ? await createPixOrder({ amount, description: source.description, email, externalReference, idempotencyKey })
            : await createCheckoutPreference({ amount, title: source.description, email, externalReference, idempotencyKey });
        } catch {
          return res.status(502).json({ error: "O Mercado Pago não conseguiu criar a cobrança. Verifique as credenciais e tente novamente." });
        }
        const documentKind = channel === "pix" ? "mercadopago_pix" : "mercadopago_checkout";
        const charge = await pool.query("insert into charges (organization_id,receivable_id,client_id,project_id,provider,external_id,provider_status,provider_payload,idempotency_key,channel,status,amount,due_at,message,payment_url,pix_payload,pix_qr_data_url,document_kind) values ($1,$2,$3,$4,'mercado_pago',$5,$6,$7::jsonb,$8,$9,'pending',$10,$11,$12,$13,$14,$15,$16) returning *", [org, source.id, source.client_id, source.project_id, providerCharge.external_id, providerCharge.status, JSON.stringify(providerCharge.raw || {}), idempotencyKey, channel, amount, source.due_at, asText(req.body?.message) || `Cobrança Mercado Pago: ${source.description}`, providerCharge.payment_url, providerCharge.pix_payload, providerCharge.pix_qr_data_url, documentKind]);
        return res.status(201).json({ charge: charge.rows[0], created: true, provider_connected: true, provider: "mercado_pago", payment_url: providerCharge.payment_url, pix: providerCharge.pix_payload ? { payload: providerCharge.pix_payload, qr_data_url: providerCharge.pix_qr_data_url, document_kind: documentKind } : null, notice: channel === "pix" ? "Cobrança Pix criada no Mercado Pago. Use o QR Code ou Pix copia e cola." : "Link de pagamento criado no Mercado Pago." });
      }
    } catch (e) { error(res, e, "Não foi possível gerar a cobrança."); }
  });
  app.post("/api/charges/:id/cancel", async (req, res) => {
    const org = tenant(req, res); if (!org) return;
    if (!mercadoPagoConfigured()) return res.status(503).json({ error: "Mercado Pago não está configurado." });
    try {
      const q = await pool.query("select * from charges where id=$1 and organization_id=$2 and provider='mercado_pago'", [req.params.id, org]);
      if (!q.rowCount) return res.status(404).json({ error: "Cobrança Mercado Pago não encontrada." });
      const charge = q.rows[0];
      const result = await cancelOrder(charge.external_id);
      const updated = await pool.query("update charges set status='cancelled',provider_status=$1,provider_payload=$2::jsonb where id=$3 and organization_id=$4 returning *", [result?.status || "cancelled", JSON.stringify(result || {}), charge.id, org]);
      return res.json({ charge: updated.rows[0], provider: result });
    } catch (e) { return error(res, e, "Não foi possível cancelar a cobrança no Mercado Pago."); }
  });
  app.post("/api/charges/:id/refund", async (req, res) => {
    const org = tenant(req, res); if (!org) return;
    if (!mercadoPagoConfigured()) return res.status(503).json({ error: "Mercado Pago não está configurado." });
    try {
      const q = await pool.query("select * from charges where id=$1 and organization_id=$2 and provider='mercado_pago'", [req.params.id, org]);
      if (!q.rowCount) return res.status(404).json({ error: "Cobrança Mercado Pago não encontrada." });
      const charge = q.rows[0], payload = charge.provider_payload || {};
      const paymentId = payload?.transactions?.payments?.[0]?.id || payload?.transaction?.payments?.[0]?.id;
      const amount = req.body?.amount == null ? undefined : Number(req.body.amount);
      if (amount !== undefined && (!Number.isFinite(amount) || amount <= 0 || amount > Number(charge.amount) + 0.005)) return res.status(400).json({ error: "Valor de reembolso inválido." });
      const result = await refundOrder(charge.external_id, { amount, paymentId });
      const updated = await pool.query("update charges set status='refunded',provider_status=$1,provider_payload=$2::jsonb where id=$3 and organization_id=$4 returning *", [result?.status || "refunded", JSON.stringify(result || {}), charge.id, org]);
      return res.json({ charge: updated.rows[0], provider: result });
    } catch (e) { return error(res, e, "Não foi possível reembolsar a cobrança no Mercado Pago."); }
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
    const values = [org, months], filters = [];
    for (const field of ["client_id", "project_id"]) if (req.query?.[field] && /^\d+$/.test(String(req.query[field]))) { values.push(String(req.query[field])); filters.push(`${field}=$${values.length}`); }
    const filterSql = filters.length ? ` and ${filters.join(" and ")}` : "";
    try {
      const q = await pool.query(`with months as (select (date_trunc('month', now()) - make_interval(months => n))::date as month from generate_series(0, $2::int - 1) as n), rev as (select date_trunc('month', coalesce(paid_at, due_at))::date as month, sum(amount) as amount from revenues where organization_id=$1 and paid_at is not null${filterSql} group by 1), exp as (select date_trunc('month', coalesce(paid_at, due_at))::date as month, sum(amount) as amount from expenses where organization_id=$1 and paid_at is not null${filterSql} group by 1) select to_char(m.month, 'YYYY-MM') as month, coalesce(r.amount, 0)::float8 as revenue, coalesce(e.amount, 0)::float8 as expense, (coalesce(r.amount, 0) - coalesce(e.amount, 0))::float8 as result from months m left join rev r on r.month = m.month left join exp e on e.month = m.month order by m.month`, values);
      res.json({ summary: q.rows });
    } catch (e) { error(res, e, "Não foi possível carregar o resumo financeiro."); }
  });

  app.get("/api/subscriptions", async (req, res) => { const org = tenant(req, res); if (!org) return; try { const q = await pool.query("select s.*,c.name client_name from subscriptions s left join clients c on c.id=s.client_id and c.organization_id=s.organization_id where s.organization_id=$1 order by s.created_at desc", [org]); res.json({ subscriptions: q.rows }); } catch (e) { error(res,e,"Não foi possível carregar as assinaturas."); } });
  app.post("/api/subscriptions", async (req, res) => { const org = tenant(req, res); if (!org) return; const plan=asText(req.body?.plan), amount=Number(req.body?.amount), interval=["monthly","yearly"].includes(req.body?.interval)?req.body.interval:"monthly", clientId=req.body?.client_id || null; if (!plan || !Number.isFinite(amount) || amount < 0) return res.status(400).json({error:"Informe plano e valor válidos."}); try { await validateRelations({client_id:clientId},org); const q=await pool.query("insert into subscriptions (organization_id,client_id,plan,amount,interval,next_billing_on,provider) values ($1,$2,$3,$4,$5,$6,'mercado_pago') returning *",[org,clientId,plan,amount,interval,req.body?.next_billing_on || null]); res.status(201).json({subscription:q.rows[0]}); } catch(e) { if(e.code==="invalid_relation") return res.status(400).json({error:e.message}); error(res,e,"Não foi possível criar a assinatura."); } });
  app.post("/api/subscriptions/:id/create-provider", async (req, res) => { const org=tenant(req,res); if(!org)return; if(!mercadoPagoConfigured()) return res.status(503).json({error:"Mercado Pago não está configurado."}); try { const q=await pool.query("select s.*,c.email client_email from subscriptions s left join clients c on c.id=s.client_id and c.organization_id=s.organization_id where s.id=$1 and s.organization_id=$2",[req.params.id,org]); if(!q.rowCount)return res.status(404).json({error:"Assinatura não encontrada."}); const source=q.rows[0]; const email=asText(source.client_email || req.body?.email); if(!email)return res.status(400).json({error:"Cadastre o e-mail do cliente antes de criar a autorização recorrente."}); const provider=await createSubscription({reason:source.plan,email,amount:source.amount,interval:source.interval,externalReference:`focussdev:${org}:subscription:${source.id}`}); const updated=await pool.query("update subscriptions set provider='mercado_pago',provider_id=$1,provider_status=$2,provider_url=$3,provider_payload=$4::jsonb,updated_at=now() where id=$5 and organization_id=$6 returning *",[provider?.id || null,provider?.status || "pending",provider?.init_point || provider?.sandbox_init_point || null,JSON.stringify(provider||{}),source.id,org]); res.status(201).json({subscription:updated.rows[0],authorization_url:provider?.init_point || provider?.sandbox_init_point || null}); } catch(e){error(res,e,"Não foi possível criar a autorização recorrente no Mercado Pago.");} });
  app.patch("/api/subscriptions/:id", async (req,res) => { const org=tenant(req,res); if(!org)return; const status=["active","paused","cancelled"].includes(req.body?.status)?req.body.status:null; if(!status)return res.status(400).json({error:"Status inválido."}); try { const current=await pool.query("select * from subscriptions where id=$1 and organization_id=$2",[req.params.id,org]); if(!current.rowCount)return res.status(404).json({error:"Assinatura não encontrada."}); const source=current.rows[0]; if(source.provider_id && mercadoPagoConfigured()) { const providerStatus = status === "cancelled" ? "cancelled" : status === "active" ? "authorized" : "paused"; await updateSubscription(source.provider_id,{status:providerStatus}); } const q=await pool.query("update subscriptions set status=$1,provider_status=$2,updated_at=now() where id=$3 and organization_id=$4 returning *",[status,status,req.params.id,org]); res.json({subscription:q.rows[0]}); }catch(e){error(res,e,"Não foi possível atualizar a assinatura.");} });
  app.delete("/api/subscriptions/:id", async (req,res) => { const org=tenant(req,res);if(!org)return;try{const q=await pool.query("delete from subscriptions where id=$1 and organization_id=$2 returning id",[req.params.id,org]);if(!q.rowCount)return res.status(404).json({error:"Assinatura não encontrada."});res.status(204).end();}catch(e){error(res,e,"Não foi possível excluir a assinatura.");} });
}
