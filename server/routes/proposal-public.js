import crypto from "node:crypto";
import { authorizeSensitiveAction } from "../permissions.js";

const hashToken = (token) => crypto.createHash("sha256").update(String(token)).digest("hex");
const safe = (value) => String(value ?? "").replace(/[&<>\"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[character]));
const publicLinkTtlSeconds = () => Math.min(Math.max(Number(process.env.PUBLIC_LINK_TTL_SECONDS) || 60 * 60 * 24 * 30, 60), 60 * 60 * 24 * 365);
const audit = (pool, organizationId, actorId, action, entityId, changes = {}) => pool.query("insert into audit_events (organization_id,actor_id,action,entity_type,entity_id,changes,ip_address,user_agent) values ($1,$2,$3,'public_link',$4,$5::jsonb,$6,$7)", [organizationId, actorId || null, action, entityId || null, JSON.stringify(changes), null, null]).catch(() => {});
const publicProposalQuery = "select p.id,p.organization_id,p.client_id,p.opportunity_id,p.lead_id,p.title,p.amount,p.final_amount,p.discount,p.additional_fees,p.down_payment,p.balance_remaining,p.installments,p.installment_amount,p.valid_until,p.payment_method,p.notes,p.presentation,p.scope_included,p.modules,p.integrations,p.technologies,p.status,c.name client_name from proposals p left join clients c on c.id=p.client_id and c.organization_id=p.organization_id where p.public_token_hash=$1 and (p.public_token_created_at is null or p.public_token_created_at > now() - ($2 * interval '1 second')) and p.status in ('sent','viewed','negotiation','accepted')";

// Public acceptance creates only the durable contract draft. Billing remains a
// later, explicit operation and no payment gateway is called from this route.
const ensureAcceptedContract = async (db, proposal, organizationId) => {
  if (!proposal.client_id) return { contract: null, created: false };
  const name = proposal.title || "Contrato de prestação de serviços";
  const amount = Number(proposal.final_amount ?? proposal.amount ?? 0);
  const downPayment = Number(proposal.down_payment ?? 0);
  const installments = Number.isInteger(Number(proposal.installments)) && Number(proposal.installments) > 0 ? Number(proposal.installments) : 1;
  const installmentValue = proposal.installment_amount ?? Math.max(0, amount - downPayment) / installments;
  const inserted = await db.query("insert into contracts (organization_id,client_id,opportunity_id,proposal_id,name,status,value,total_value,down_payment,discount,installments,installment_value,payment_method,scope_included,description) values ($1,$2,$3,$4,$5,'draft',$6,$6,$7,$8,$9,$10,$11,$12,$13) on conflict (organization_id,proposal_id) where proposal_id is not null do nothing returning *", [organizationId, proposal.client_id, proposal.opportunity_id || null, proposal.id, name, amount, downPayment, proposal.discount ?? 0, installments, installmentValue, proposal.payment_method || null, proposal.scope_included || null, proposal.notes || null]);
  if (inserted.rowCount) return { contract: inserted.rows[0], created: true };
  const existing = await db.query("select * from contracts where organization_id=$1 and proposal_id=$2", [organizationId, proposal.id]);
  return { contract: existing.rows[0] || null, created: false };
};

export function registerProposalPublicRoutes(app, { pool, tenant, requireAuth, classifyDbError }) {
  app.post("/api/proposals/:id/public-link", requireAuth, async (req, res) => {
    const org = tenant(req, res); if (!org) return;
    if (!await authorizeSensitiveAction({ req, res, pool, domain: "crm", table: "proposals", action: "public_link.create" })) return;
    try {
      const token = crypto.randomBytes(32).toString("base64url");
      const q = await pool.query("update proposals set public_token_hash=$1,public_token_created_at=now(),status=case when status='draft' then 'sent' else status end,updated_at=now() where id=$2 and organization_id=$3 returning id,title,status", [hashToken(token), req.params.id, org]);
      if (!q.rowCount) return res.status(404).json({ error: "Proposta não encontrada." });
      audit(pool, org, req.user?.id, "public_link_created", q.rows[0].id, { resource: "proposal", ttl_seconds: publicLinkTtlSeconds() });
      return res.status(201).json({ proposal: q.rows[0], token, path: `/proposal/${token}` });
    } catch (error) { const out = classifyDbError(error, "Não foi possível gerar o link da proposta."); return res.status(out.status).json({ error: out.error }); }
  });

  app.delete("/api/proposals/:id/public-link", requireAuth, async (req, res) => {
    const org = tenant(req, res); if (!org) return;
    if (!await authorizeSensitiveAction({ req, res, pool, domain: "crm", table: "proposals", action: "public_link.revoke" })) return;
    try {
      const q = await pool.query("update proposals set public_token_hash=null,public_token_created_at=null,updated_at=now() where id=$1 and organization_id=$2 returning id", [req.params.id, org]);
      if (!q.rowCount) return res.status(404).json({ error: "Proposta não encontrada." });
      audit(pool, org, req.user?.id, "public_link_revoked", q.rows[0].id, { resource: "proposal" });
      return res.json({ revoked: true, proposal_id: q.rows[0].id });
    } catch (error) { const out = classifyDbError(error, "Não foi possível revogar o link da proposta."); return res.status(out.status).json({ error: out.error }); }
  });

  app.get("/api/proposals/public/:token", async (req, res) => {
    try {
      const q = await pool.query(publicProposalQuery, [hashToken(req.params.token), publicLinkTtlSeconds()]);
      if (!q.rowCount) return res.status(404).json({ error: "Proposta não encontrada ou indisponível." });
      const proposal = q.rows[0];
      if (proposal.status === "sent") await pool.query("update proposals set status='viewed',updated_at=now() where id=$1", [proposal.id]);
      audit(pool, proposal.organization_id, null, "public_link_viewed", proposal.id, { resource: "proposal" });
      return res.json({ proposal: { ...proposal, status: proposal.status === "sent" ? "viewed" : proposal.status }, can_decide: ["sent", "viewed", "negotiation"].includes(proposal.status) });
    } catch { return res.status(503).json({ error: "Não foi possível carregar a proposta." }); }
  });

  app.post("/api/proposals/public/:token/decision", async (req, res) => {
    const decision = String(req.body?.decision || "").trim();
    const name = String(req.body?.name || "").trim();
    const email = String(req.body?.email || "").trim().toLowerCase();
    const comment = String(req.body?.comment || "").trim();
    const acceptedTerms = req.body?.accepted_terms === true;
    if (!["accepted", "rejected"].includes(decision) || name.length < 2 || !/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ error: "Informe decisão, nome e e-mail válidos." });
    if (decision === "accepted" && !acceptedTerms) return res.status(400).json({ error: "Aceite as condições da proposta para aprová-la." });
    const db = await pool.connect().catch(() => null);
    if (!db) return res.status(503).json({ error: "Serviço indisponível." });
    try {
      await db.query("begin");
      const current = await db.query("select id,organization_id,client_id,opportunity_id,lead_id,title,status,amount,final_amount,discount,down_payment,installments,installment_amount,payment_method,scope_included,notes from proposals where public_token_hash=$1 and (public_token_created_at is null or public_token_created_at > now() - ($2 * interval '1 second')) and status in ('sent','viewed','negotiation','accepted') for update", [hashToken(req.params.token), publicLinkTtlSeconds()]);
      if (!current.rowCount) { await db.query("rollback"); return res.status(404).json({ error: "Proposta não encontrada, já decidida ou indisponível." }); }
      const existingProposal = current.rows[0];
      if (existingProposal.status === "accepted") {
        if (decision !== "accepted") { await db.query("rollback"); return res.status(409).json({ error: "A proposta já foi aceita." }); }
        const onboarding = await ensureAcceptedContract(db, existingProposal, existingProposal.organization_id);
        await db.query("commit");
        return res.json({ proposal: { id: existingProposal.id, title: existingProposal.title, status: existingProposal.status }, contract: onboarding.contract, contract_created: onboarding.created, onboarding: { status: onboarding.contract ? "contract_draft_ready" : "awaiting_client_or_scope" }, decided: true, replayed: true });
      }
      const updated = await db.query("update proposals set status=$1,decided_at=now(),approver_name=$2,approver_email=$3,acceptance_comment=$4,accepted_terms=$5,acceptance_ip=$6,updated_at=now() where id=$7 and organization_id=$8 and status in ('sent','viewed','negotiation') returning id,title,status,organization_id,client_id,opportunity_id,lead_id,amount,final_amount,discount,down_payment,installments,installment_amount,payment_method,scope_included,notes", [decision, name, email, comment || null, acceptedTerms, req.ip || null, existingProposal.id, existingProposal.organization_id]);
      if (!updated.rowCount) { await db.query("rollback"); return res.status(404).json({ error: "Proposta não encontrada, já decidida ou indisponível." }); }
      const proposal = updated.rows[0];
      if (proposal.opportunity_id) await db.query("update opportunities set stage=$1,updated_at=now() where id=$2 and organization_id=$3", [decision === "accepted" ? "won" : "lost", proposal.opportunity_id, proposal.organization_id]);
      if (decision === "accepted" && proposal.lead_id) await db.query("update leads set status='won',updated_at=now() where id=$1 and organization_id=$2", [proposal.lead_id, proposal.organization_id]);
      const onboarding = decision === "accepted" ? await ensureAcceptedContract(db, proposal, proposal.organization_id) : { contract: null, created: false };
      await db.query("commit");
      audit(pool, proposal.organization_id, null, decision === "accepted" ? "public_proposal_accepted" : "public_proposal_rejected", proposal.id, { resource: "proposal" });
      return res.json({ proposal: { id: proposal.id, title: proposal.title, status: proposal.status }, contract: onboarding.contract, contract_created: onboarding.created, onboarding: { status: onboarding.contract ? "contract_draft_ready" : "awaiting_client_or_scope" }, decided: true, replayed: false });
    } catch (error) { await db.query("rollback").catch(() => {}); const out = classifyDbError(error, "Não foi possível registrar a decisão."); return res.status(out.status).json({ error: out.error }); } finally { db.release(); }
  });

  app.get("/proposal/:token", async (req, res) => {
    try {
      const q = await pool.query(publicProposalQuery.replace("p.id,p.organization_id,", ""), [hashToken(req.params.token), publicLinkTtlSeconds()]);
      if (!q.rowCount) return res.status(404).send("Proposta não encontrada ou indisponível.");
      const p = q.rows[0], canDecide = ["sent", "viewed", "negotiation"].includes(p.status), token = safe(req.params.token);
      const form = canDecide ? `<form id="decision"><label>Nome completo<input name="name" required></label><label>E-mail<input name="email" type="email" required></label><label>Comentário<textarea name="comment"></textarea></label><label><input name="accepted_terms" type="checkbox"> Li e aceito as condições desta proposta.</label><div><button name="decision" value="accepted" type="submit">Aprovar proposta</button> <button name="decision" value="rejected" type="submit" class="secondary">Recusar</button></div><div id="status" role="status"></div></form>` : `<p class="success">Esta proposta já foi decidida.</p>`;
      res.type("html").send(`<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${safe(p.title)}</title><style>body{font-family:system-ui,sans-serif;max-width:760px;margin:32px auto;padding:0 16px;background:#070b14;color:#f8fafc}.card{padding:24px;border:1px solid #334766;border-radius:16px;background:#111b2e}label{display:block;margin:14px 0}input,textarea{box-sizing:border-box;width:100%;margin-top:7px;padding:12px;background:#0d1424;color:#fff}button{padding:13px 18px;background:#e62429;color:#fff;border:0;border-radius:10px}.secondary{background:#334766}</style><main><section class="card"><p>Proposta comercial</p><h1>${safe(p.title)}</h1><p>Cliente: ${safe(p.client_name || "")}</p><p>${safe(p.presentation || p.notes || "")}</p><p><strong>R$ ${Number(p.final_amount || p.amount || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</strong></p><p>${safe(p.scope_included || "")}</p>${form}</section><script>const form=document.querySelector("#decision"),status=document.querySelector("#status");form?.addEventListener("submit",async(event)=>{event.preventDefault();const values=Object.fromEntries(new FormData(form));values.decision=event.submitter.value;values.accepted_terms=form.accepted_terms?.checked===true;if(values.decision==="accepted"&&!values.accepted_terms){status.textContent="Aceite as condições para aprovar a proposta.";return;}status.textContent="Registrando decisão...";try{const response=await fetch("/api/proposals/public/${token}/decision",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(values)});const data=await response.json();if(!response.ok)throw new Error(data.error||"Não foi possível registrar.");form.outerHTML="<p>Decisão registrada com sucesso.</p>"}catch(error){status.textContent=error.message}});</script></main></html>`);
    } catch { res.status(503).send("Não foi possível carregar a proposta."); }
  });
}
