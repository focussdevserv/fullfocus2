import crypto from "node:crypto";
import { authorizeSensitiveAction } from "../permissions.js";

const hashToken = (token) => crypto.createHash("sha256").update(String(token)).digest("hex");
const publicLinkTtlSeconds = () => Math.min(Math.max(Number(process.env.PUBLIC_LINK_TTL_SECONDS) || 60 * 60 * 24 * 30, 60), 60 * 60 * 24 * 365);
const audit = (pool, organizationId, actorId, action, entityId, changes = {}) => pool.query("insert into audit_events (organization_id,actor_id,action,entity_type,entity_id,changes,ip_address,user_agent) values ($1,$2,$3,'public_link',$4,$5::jsonb,$6,$7)", [organizationId, actorId || null, action, entityId || null, JSON.stringify(changes), null, null]).catch(() => {});
const escapeHtml = (value) => String(value ?? "").replace(/[&<>\"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[character]));
const publicContract = (contract) => ({ id: contract.id, status: contract.status });
const publicProject = (project) => project ? { id: project.id, name: project.name, status: project.status } : null;
const publicContractDetails = (contract) => ({
  id: contract.id, name: contract.name, contract_number: contract.contract_number, contract_type: contract.contract_type,
  description: contract.description, scope_included: contract.scope_included, scope_excluded: contract.scope_excluded,
  deliverables: contract.deliverables, technologies: contract.technologies, milestones: contract.milestones,
  value: contract.value, total_value: contract.total_value, down_payment: contract.down_payment, discount: contract.discount,
  installments: contract.installments, installment_value: contract.installment_value, payment_method: contract.payment_method,
  starts_on: contract.starts_on, ends_on: contract.ends_on, status: contract.status, client_name: contract.client_name,
});

export function registerContractPublicRoutes(app, { pool, tenant, requireAuth, classifyDbError }) {
  app.post("/api/contracts/:id/public-link", requireAuth, async (req, res) => {
    const org = tenant(req, res); if (!org) return;
    if (!await authorizeSensitiveAction({ req, res, pool, domain: "operation", table: "contracts", action: "public_link.create" })) return;
    try {
      const token = crypto.randomBytes(32).toString("base64url");
      const q = await pool.query("update contracts set public_token_hash=$1,public_token_created_at=now(),status=case when status='draft' then 'awaiting_signature' else status end,updated_at=now() where id=$2 and organization_id=$3 returning id,name,status", [hashToken(token), req.params.id, org]);
      if (!q.rowCount) return res.status(404).json({ error: "Contrato não encontrado." });
      audit(pool, org, req.user?.id, "public_link_created", q.rows[0].id, { resource: "contract", ttl_seconds: publicLinkTtlSeconds() });
      res.status(201).json({ contract: q.rows[0], token, path: `/contract/${token}` });
    } catch (error) { const out = classifyDbError(error, "Não foi possível gerar o link do contrato."); res.status(out.status).json({ error: out.error }); }
  });

  app.delete("/api/contracts/:id/public-link", requireAuth, async (req, res) => {
    const org = tenant(req, res); if (!org) return;
    if (!await authorizeSensitiveAction({ req, res, pool, domain: "operation", table: "contracts", action: "public_link.revoke" })) return;
    try {
      const q = await pool.query("update contracts set public_token_hash=null,public_token_created_at=null,updated_at=now() where id=$1 and organization_id=$2 returning id", [req.params.id, org]);
      if (!q.rowCount) return res.status(404).json({ error: "Contrato não encontrado." });
      audit(pool, org, req.user?.id, "public_link_revoked", q.rows[0].id, { resource: "contract" });
      return res.json({ revoked: true, contract_id: q.rows[0].id });
    } catch (error) { const out = classifyDbError(error, "Não foi possível revogar o link do contrato."); return res.status(out.status).json({ error: out.error }); }
  });

  app.get("/api/contracts/public/:token", async (req, res) => {
    try {
      const q = await pool.query("select c.id,c.organization_id,c.name,c.contract_number,c.contract_type,c.description,c.scope_included,c.scope_excluded,c.deliverables,c.technologies,c.milestones,c.value,c.total_value,c.down_payment,c.discount,c.installments,c.installment_value,c.payment_method,c.starts_on,c.ends_on,c.status,cl.name client_name from contracts c left join clients cl on cl.id=c.client_id and cl.organization_id=c.organization_id where c.public_token_hash=$1 and (c.public_token_created_at is null or c.public_token_created_at > now() - ($2 * interval '1 second')) and c.status in ('sent','viewed','awaiting_signature','signed','active')", [hashToken(req.params.token), publicLinkTtlSeconds()]);
      if (!q.rowCount) return res.status(404).json({ error: "Contrato não encontrado ou indisponível." });
      const contract = q.rows[0];
      if (contract.status === "sent") await pool.query("update contracts set status='viewed',updated_at=now() where id=$1", [contract.id]);
      audit(pool, contract.organization_id, null, "public_link_viewed", contract.id, { resource: "contract" });
      res.json({ contract: publicContractDetails({ ...contract, status: contract.status === "sent" ? "viewed" : contract.status }), can_sign: ["sent", "viewed", "awaiting_signature"].includes(contract.status) });
    } catch { res.status(503).json({ error: "Não foi possível carregar o contrato." }); }
  });

  app.post("/api/contracts/public/:token/sign", async (req, res) => {
    const name = String(req.body?.name || "").trim(), document = String(req.body?.document || "").trim(), email = String(req.body?.email || "").trim().toLowerCase(), comment = String(req.body?.comment || "").trim();
    if (name.length < 2 || !/^\S+@\S+\.\S+$/.test(email) || req.body?.accepted_terms !== true) return res.status(400).json({ error: "Informe nome, e-mail e aceite as condições do contrato." });
    const db = pool.connect ? await pool.connect().catch(() => null) : pool;
    if (!db) return res.status(503).json({ error: "Serviço indisponível." });
    try {
      await db.query("begin");
      const signature = { name, document: document || null, email, comment: comment || null, accepted_terms: true, signed_at: new Date().toISOString(), ip: req.ip || null, user_agent: req.get("user-agent") || null };
      const locked = await db.query("select * from contracts where public_token_hash=$1 and (public_token_created_at is null or public_token_created_at > now() - ($2 * interval '1 second')) for update", [hashToken(req.params.token), publicLinkTtlSeconds()]);
      if (!locked.rowCount || !["sent", "viewed", "awaiting_signature", "signed", "active"].includes(locked.rows[0].status)) { await db.query("rollback"); return res.status(404).json({ error: "Contrato não encontrado ou indisponível." }); }
      const source = locked.rows[0];
      let contract = source, replayed = ["signed", "active"].includes(source.status);
      if (!replayed) {
        const q = await db.query("update contracts set status='signed',signature_data=$1::jsonb,updated_at=now() where id=$2 and organization_id=$3 and status in ('sent','viewed','awaiting_signature') returning *", [JSON.stringify(signature), source.id, source.organization_id]);
        if (!q.rowCount) { await db.query("rollback"); return res.status(409).json({ error: "O contrato foi alterado durante a assinatura. Tente novamente." }); }
        contract = q.rows[0];
      }
      let project = null, projectCreated = false;
      if (contract.project_id) {
        const existing = await db.query("select * from projects where id=$1 and organization_id=$2", [contract.project_id, contract.organization_id]);
        project = existing.rows[0] || null;
      }
      if (!project) {
        const existing = await db.query("select * from projects where contract_id=$1 and organization_id=$2 order by id limit 1", [contract.id, contract.organization_id]);
        project = existing.rows[0] || null;
      }
      if (!project) {
        const code = `PROJ-${new Date().getFullYear()}-${String(contract.id).padStart(6, "0")}`;
        const created = await db.query("insert into projects (organization_id,contract_id,client_id,name,status,progress,internal_code,total_value,down_payment,payment_method,installments,installment_value,payment_due_dates,discount,maintenance_monthly_value,support_period,observations) values ($1,$2,$3,$4,'planning',0,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) returning *", [contract.organization_id, contract.id, contract.client_id, contract.name, code, contract.total_value ?? contract.value ?? 0, contract.down_payment ?? 0, contract.payment_method, contract.installments ?? 1, contract.installment_value ?? 0, contract.payment_due_dates, contract.discount ?? 0, contract.maintenance_monthly ?? 0, contract.support_period, "Projeto criado automaticamente a partir da assinatura do contrato."]);
        project = created.rows[0]; projectCreated = true;
      }
      if (!project) throw new Error("A assinatura não gerou um projeto persistido.");
      const linked = await db.query("update contracts set project_id=$1,updated_at=now() where id=$2 and organization_id=$3 returning *", [project.id, contract.id, contract.organization_id]);
      if (!linked.rowCount) throw new Error("O projeto não pôde ser vinculado ao contrato.");
      await db.query("commit");
      audit(pool, contract.organization_id, null, replayed ? "public_contract_sign_replayed" : "public_contract_signed", contract.id, { resource: "contract", replayed });
      res.json({ contract: publicContract(linked.rows[0]), project: publicProject(project), signed: true, replayed, project_created: projectCreated });
    } catch (error) { await db.query("rollback").catch(() => {}); const out = classifyDbError(error, "Não foi possível registrar a assinatura."); res.status(out.status).json({ error: out.error }); }
    finally { db.release?.(); }
  });

  app.get("/contract/:token", async (req, res) => {
    try {
      const q = await pool.query("select c.name,c.contract_number,c.description,c.scope_included,c.value,c.total_value,c.starts_on,c.ends_on,c.status,cl.name client_name from contracts c left join clients cl on cl.id=c.client_id and cl.organization_id=c.organization_id where c.public_token_hash=$1 and (c.public_token_created_at is null or c.public_token_created_at > now() - ($2 * interval '1 second')) and c.status in ('sent','viewed','awaiting_signature','signed','active')", [hashToken(req.params.token), publicLinkTtlSeconds()]);
      if (!q.rowCount) return res.status(404).send("Contrato não encontrado ou indisponível.");
      const c = q.rows[0], canSign = ["sent", "viewed", "awaiting_signature"].includes(c.status), token = escapeHtml(req.params.token);
      const form = canSign ? `<form id="sign"><label>Nome completo<input name="name" required></label><label>CPF/CNPJ<input name="document"></label><label>E-mail<input name="email" type="email" required></label><label>Comentário<textarea name="comment"></textarea></label><label><input name="accepted_terms" type="checkbox" value="true" required> Li e aceito as condições deste contrato.</label><button type="submit">Assinar contrato</button><div id="status" role="status"></div></form>` : `<p class="success">Este contrato já foi assinado ou está ativo.</p>`;
      res.type("html").send(`<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(c.name)}</title><style>:root{color-scheme:dark;font-family:system-ui,sans-serif;background:#070b14;color:#f8fafc}body{margin:0;padding:24px 16px;background:radial-gradient(circle at 80% 0,#153b77,#070b14 55%)}main{max-width:760px;margin:auto}.brand{color:#e62429;font-weight:800;font-size:22px}.brand span{color:#f8fafc}.card{margin-top:20px;padding:24px;border:1px solid #334766;border-radius:16px;background:#111b2e}.muted{color:#94a3b8}.value{font-size:28px;font-weight:800}label{display:block;margin:14px 0;font-weight:600}input,textarea{box-sizing:border-box;width:100%;margin-top:7px;padding:12px;border:1px solid #526887;border-radius:10px;background:#0d1424;color:#f8fafc;font:inherit}textarea{min-height:90px}button{border:0;border-radius:10px;padding:13px 18px;background:#e62429;color:white;font-weight:700;cursor:pointer}#status{margin-top:14px;color:#94a3b8}.success{color:#86efac}</style><main><div class="brand">Focus<span>Dev</span></div><section class="card"><p class="muted">Contrato ${escapeHtml(c.contract_number || "")}</p><h1>${escapeHtml(c.name)}</h1><p class="muted">Contratante: ${escapeHtml(c.client_name || "")}</p><p>${escapeHtml(c.description || "")}</p><p class="value">R$ ${Number(c.total_value || c.value || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p><p>${escapeHtml(c.scope_included || "")}</p>${form}</section><script>const form=document.querySelector("#sign"),status=document.querySelector("#status");form?.addEventListener("submit",async(event)=>{event.preventDefault();status.textContent="Registrando assinatura...";const values=Object.fromEntries(new FormData(form));values.accepted_terms=true;try{const response=await fetch("/api/contracts/public/${token}/sign",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(values)});const data=await response.json();if(!response.ok)throw new Error(data.error||"Não foi possível assinar.");form.outerHTML="<p class='success'>Contrato assinado com sucesso.</p>"}catch(error){status.textContent=error.message}});</script></section></main></html>`);
    } catch { res.status(503).send("Não foi possível carregar o contrato."); }
  });
}
