import crypto from "node:crypto";

const signatureParts = (value = "") => Object.fromEntries(String(value).split(",").map((part) => part.trim().split("=")).filter(([key, item]) => key && item));
export function verifyMercadoPagoSignature({ signature, requestId, dataId, secret, now = Date.now() }) {
  const parts = signatureParts(signature);
  if (!parts.ts || !parts.v1 || !requestId || !dataId || !secret) return false;
  const timestamp = Number(parts.ts);
  if (!Number.isFinite(timestamp) || Math.abs(now - timestamp * 1000) > 5 * 60 * 1000) return false;
  const manifest = `id:${String(dataId).toLowerCase()};request-id:${requestId};ts:${parts.ts};`;
  const expected = crypto.createHmac("sha256", secret).update(manifest).digest("hex");
  return expected.length === parts.v1.length && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(parts.v1));
}

export function registerMercadoPagoWebhookRoutes(app, { pool, defaultOrganizationId, classifyDbError }) {
  app.post("/api/webhooks/mercadopago", async (req, res) => {
    const notification = req.body || {}, dataId = notification.data?.id || req.query["data.id"] || req.query.id;
    if (notification.type !== "payment" || !dataId) return res.status(202).json({ received: true, ignored: true });
    const secret = process.env.MERCADO_PAGO_WEBHOOK_SECRET;
    if (!secret) return res.status(503).json({ error: "Webhook do Mercado Pago ainda não está configurado no servidor." });
    if (!verifyMercadoPagoSignature({ signature: req.get("x-signature"), requestId: req.get("x-request-id"), dataId, secret })) return res.status(401).json({ error: "Assinatura do webhook inválida." });
    const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN;
    if (!accessToken) return res.status(503).json({ error: "Access Token do Mercado Pago ainda não está configurado no servidor." });
    try {
      const response = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(dataId)}`, { headers: { Authorization: `Bearer ${accessToken}` } });
      if (!response.ok) return res.status(502).json({ error: "Não foi possível consultar o pagamento no Mercado Pago." });
      const payment = await response.json(), reference = String(payment.external_reference || ""), referenceId = reference.match(/(?:focusdev-charge-|charge:)(\d+)/i)?.[1] || null;
      const organizationId = req.query.organization_id || defaultOrganizationId;
      const charge = await pool.query("select c.*,r.amount receivable_amount,r.client_id,r.project_id,r.contract_id from charges c left join receivables r on r.id=c.receivable_id and r.organization_id=c.organization_id where c.organization_id=$1 and (c.external_id=$2 or ($3 is not null and c.id=$3)) limit 1", [organizationId, String(dataId), referenceId]);
      if (!charge.rowCount) return res.json({ received: true, matched: false });
      const source = charge.rows[0], status = payment.status === "approved" ? "paid" : ["rejected", "cancelled", "refunded", "charged_back"].includes(payment.status) ? "cancelled" : "pending";
      const db = pool.connect ? await pool.connect() : pool;
      try {
        await db.query("begin");
        await db.query("update charges set provider='mercado_pago',external_id=$1,status=$2 where id=$3 and organization_id=$4", [String(dataId), status, source.id, organizationId]);
        if (status === "paid") {
          const already = await db.query("select id from payments where organization_id=$1 and (external_id=$2 or charge_id=$3) limit 1", [organizationId, String(dataId), source.id]);
          if (!already.rowCount) {
            const amount = Number(payment.transaction_amount || source.receivable_amount || source.amount || 0);
            if (amount > 0) {
              await db.query("insert into payments (organization_id,receivable_id,charge_id,amount,paid_at,method,external_id) values ($1,$2,$3,$4,now(),'mercado_pago',$5)", [organizationId, source.receivable_id, source.id, amount, String(dataId)]);
              await db.query("update receivables set status='paid',paid_at=now(),updated_at=now() where id=$1 and organization_id=$2", [source.receivable_id, organizationId]);
              await db.query("insert into revenues (organization_id,description,client_id,project_id,contract_id,amount,net_amount,payment_method,paid_at,status) values ($1,$2,$3,$4,$5,$6,$6,'mercado_pago',now(),'confirmed')", [organizationId, `Pagamento Mercado Pago · ${source.id}`, source.client_id, source.project_id, source.contract_id, amount]);
            }
          }
        }
        await db.query("commit");
      } catch (error) { await db.query("rollback").catch(() => {}); throw error; } finally { db.release?.(); }
      return res.json({ received: true, matched: true, status });
    } catch (error) { const out = classifyDbError(error, "Não foi possível processar o webhook do Mercado Pago."); return res.status(out.status).json({ error: out.error }); }
  });
}
