import crypto from "node:crypto";

const hashToken = (token) => crypto.createHash("sha256").update(String(token)).digest("hex");
const escapeHtml = (value) => String(value ?? "").replace(/[&<>\"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[character]));

export function registerContractPublicRoutes(app, { pool, tenant, requireAuth, classifyDbError }) {
  app.post("/api/contracts/:id/public-link", requireAuth, async (req, res) => {
    const org = tenant(req, res); if (!org) return;
    try {
      const token = crypto.randomBytes(32).toString("base64url");
      const q = await pool.query("update contracts set public_token_hash=$1,public_token_created_at=now(),status=case when status='draft' then 'awaiting_signature' else status end,updated_at=now() where id=$2 and organization_id=$3 returning id,name,status", [hashToken(token), req.params.id, org]);
      if (!q.rowCount) return res.status(404).json({ error: "Contrato não encontrado." });
      res.status(201).json({ contract: q.rows[0], token, path: `/contract/${token}` });
    } catch (error) { const out = classifyDbError(error, "Não foi possível gerar o link do contrato."); res.status(out.status).json({ error: out.error }); }
  });

  app.get("/api/contracts/public/:token", async (req, res) => {
    try {
      const q = await pool.query("select c.id,c.name,c.contract_number,c.contract_type,c.description,c.scope_included,c.scope_excluded,c.deliverables,c.technologies,c.milestones,c.value,c.total_value,c.down_payment,c.discount,c.installments,c.installment_value,c.payment_method,c.starts_on,c.ends_on,c.status,cl.name client_name from contracts c left join clients cl on cl.id=c.client_id and cl.organization_id=c.organization_id where c.public_token_hash=$1 and c.status in ('sent','viewed','awaiting_signature','signed','active')", [hashToken(req.params.token)]);
      if (!q.rowCount) return res.status(404).json({ error: "Contrato não encontrado ou indisponível." });
      const contract = q.rows[0];
      if (contract.status === "sent") await pool.query("update contracts set status='viewed',updated_at=now() where id=$1", [contract.id]);
      res.json({ contract: { ...contract, status: contract.status === "sent" ? "viewed" : contract.status }, can_sign: ["sent", "viewed", "awaiting_signature"].includes(contract.status) });
    } catch { res.status(503).json({ error: "Não foi possível carregar o contrato." }); }
  });

  app.post("/api/contracts/public/:token/sign", async (req, res) => {
    const name = String(req.body?.name || "").trim(), document = String(req.body?.document || "").trim(), email = String(req.body?.email || "").trim().toLowerCase(), comment = String(req.body?.comment || "").trim();
    if (name.length < 2 || !/^\S+@\S+\.\S+$/.test(email) || req.body?.accepted_terms !== true) return res.status(400).json({ error: "Informe nome, e-mail e aceite as condições do contrato." });
    try {
      const signature = { name, document: document || null, email, comment: comment || null, accepted_terms: true, signed_at: new Date().toISOString(), ip: req.ip || null, user_agent: req.get("user-agent") || null };
      const q = await pool.query("update contracts set status='signed',signature_data=$1::jsonb,updated_at=now() where public_token_hash=$2 and status in ('sent','viewed','awaiting_signature') returning id,name,status,signature_data", [JSON.stringify(signature), hashToken(req.params.token)]);
      if (!q.rowCount) return res.status(404).json({ error: "Contrato não encontrado, já assinado ou indisponível." });
      res.json({ contract: { ...q.rows[0], signature_data: { ...signature, ip: undefined, user_agent: undefined } }, signed: true });
    } catch (error) { const out = classifyDbError(error, "Não foi possível registrar a assinatura."); res.status(out.status).json({ error: out.error }); }
  });

  app.get("/contract/:token", async (req, res) => {
    try {
      const q = await pool.query("select c.name,c.contract_number,c.description,c.scope_included,c.value,c.total_value,c.starts_on,c.ends_on,c.status,cl.name client_name from contracts c left join clients cl on cl.id=c.client_id and cl.organization_id=c.organization_id where c.public_token_hash=$1 and c.status in ('sent','viewed','awaiting_signature','signed','active')", [hashToken(req.params.token)]);
      if (!q.rowCount) return res.status(404).send("Contrato não encontrado ou indisponível.");
      const c = q.rows[0], canSign = ["sent", "viewed", "awaiting_signature"].includes(c.status), token = escapeHtml(req.params.token);
      const form = canSign ? `<form id="sign"><label>Nome completo<input name="name" required></label><label>CPF/CNPJ<input name="document"></label><label>E-mail<input name="email" type="email" required></label><label>Comentário<textarea name="comment"></textarea></label><label><input name="accepted_terms" type="checkbox" value="true" required> Li e aceito as condições deste contrato.</label><button type="submit">Assinar contrato</button><div id="status" role="status"></div></form>` : `<p class="success">Este contrato já foi assinado ou está ativo.</p>`;
      res.type("html").send(`<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(c.name)}</title><style>:root{color-scheme:dark;font-family:system-ui,sans-serif;background:#070b14;color:#f8fafc}body{margin:0;padding:24px 16px;background:radial-gradient(circle at 80% 0,#153b77,#070b14 55%)}main{max-width:760px;margin:auto}.brand{color:#e62429;font-weight:800;font-size:22px}.brand span{color:#f8fafc}.card{margin-top:20px;padding:24px;border:1px solid #334766;border-radius:16px;background:#111b2e}.muted{color:#94a3b8}.value{font-size:28px;font-weight:800}label{display:block;margin:14px 0;font-weight:600}input,textarea{box-sizing:border-box;width:100%;margin-top:7px;padding:12px;border:1px solid #526887;border-radius:10px;background:#0d1424;color:#f8fafc;font:inherit}textarea{min-height:90px}button{border:0;border-radius:10px;padding:13px 18px;background:#e62429;color:white;font-weight:700;cursor:pointer}#status{margin-top:14px;color:#94a3b8}.success{color:#86efac}</style><main><div class="brand">Focus<span>Dev</span></div><section class="card"><p class="muted">Contrato ${escapeHtml(c.contract_number || "")}</p><h1>${escapeHtml(c.name)}</h1><p class="muted">Contratante: ${escapeHtml(c.client_name || "")}</p><p>${escapeHtml(c.description || "")}</p><p class="value">R$ ${Number(c.total_value || c.value || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p><p>${escapeHtml(c.scope_included || "")}</p>${form}</section><script>const form=document.querySelector("#sign"),status=document.querySelector("#status");form?.addEventListener("submit",async(event)=>{event.preventDefault();status.textContent="Registrando assinatura...";const values=Object.fromEntries(new FormData(form));values.accepted_terms=true;try{const response=await fetch("/api/contracts/public/${token}/sign",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(values)});const data=await response.json();if(!response.ok)throw new Error(data.error||"Não foi possível assinar.");form.outerHTML="<p class='success'>Contrato assinado com sucesso.</p>"}catch(error){status.textContent=error.message}});</script></section></main></html>`);
    } catch { res.status(503).send("Não foi possível carregar o contrato."); }
  });
}
