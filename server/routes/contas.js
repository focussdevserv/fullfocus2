import crypto from "node:crypto";

const digitsOnly = (value) => String(value ?? "").replace(/\D/g, "");
export function isValidCnpj(value) {
  const cnpj = digitsOnly(value);
  if (cnpj.length !== 14 || /^([0-9])\1+$/.test(cnpj)) return false;
  const calc = (length) => { let sum = 0, pos = length - 7; for (let i = length; i >= 1; i -= 1) { sum += Number(cnpj[length - i]) * pos--; if (pos < 2) pos = 9; } const digit = sum % 11 < 2 ? 0 : 11 - (sum % 11); return digit; };
  return calc(12) === Number(cnpj[12]) && calc(13) === Number(cnpj[13]);
}
const cache = new Map();
const publicFields = ["cnpj", "razao_social", "nome_fantasia", "situacao", "abertura", "cnae", "municipio", "uf", "telefone", "email"];
const pickCnpj = (data, cnpj) => Object.fromEntries(publicFields.map((key) => [key, key === "cnpj" ? cnpj : data?.[key] ?? null]));
const html = (value) => String(value ?? "").replace(/[&<>\"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[character]));
const portalPage = ({ client, contracts, receivables }) => `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Portal · ${html(client.name)}</title><style>:root{color-scheme:dark;font-family:system-ui,sans-serif;background:#07111f;color:#edf4ff}body{margin:0;padding:32px 18px;background:radial-gradient(circle at 80% 0,#123b77,#07111f 48%)}main{max-width:900px;margin:auto}.brand{color:#ff2844;font-weight:800}.brand span{color:#fff}.hero,.card{border:1px solid #27466d;background:#0d1c31dd;border-radius:18px;padding:24px}.hero{margin:22px 0;display:flex;justify-content:space-between;gap:20px;align-items:end}.hero h1{margin:8px 0;font-size:clamp(26px,5vw,42px)}.muted{color:#9eb1cc}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px}.card h2{margin-top:0;font-size:18px}.row{padding:14px 0;border-top:1px solid #27466d;display:flex;justify-content:space-between;gap:12px}.row:first-of-type{border-top:0}.pill{color:#7ce5b2;font-size:12px}.amount{font-weight:700}.empty{color:#9eb1cc;padding:8px 0}@media(max-width:600px){body{padding:20px 12px}.hero{display:block}}</style></head><body><main><div class="brand">Focus<span>Dev</span></div><section class="hero"><div><div class="muted">Portal do cliente</div><h1>Olá, ${html(client.name)}.</h1><div class="muted">Acompanhe seus contratos e próximos pagamentos.</div></div><div class="muted">Atualizado agora</div></section><div class="grid"><section class="card"><h2>Contratos ativos</h2>${contracts.length ? contracts.map((contract) => `<div class="row"><div><strong>${html(contract.name)}</strong><div class="muted">${html(contract.starts_on || "")} ${contract.ends_on ? `até ${html(contract.ends_on)}` : ""}</div></div><div class="pill">Ativo</div></div>`).join("") : '<div class="empty">Nenhum contrato ativo.</div>'}</section><section class="card"><h2>Próximos pagamentos</h2>${receivables.length ? receivables.map((receivable) => `<div class="row"><div><strong>${html(receivable.description)}</strong><div class="muted">Vencimento: ${html(receivable.due_at)}</div></div><div class="amount">R$ ${Number(receivable.amount || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</div></div>`).join("") : '<div class="empty">Nenhum pagamento pendente.</div>'}</section></div></main></body></html>`;
function tokenHash(token) { return crypto.createHash("sha256").update(token).digest("hex"); }
export function register(app, ctx) {
  const { pool, tenant, asText, classifyDbError } = ctx;
  app.get("/api/cnpj/:cnpj", async (req, res) => {
    const org = tenant(req, res); if (!org) return;
    const cnpj = digitsOnly(req.params.cnpj);
    if (!isValidCnpj(cnpj)) return res.status(400).json({ error: "CNPJ inválido." });
    const found = cache.get(cnpj); if (found && found.expires > Date.now()) return res.json(found.data);
    const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 8000);
    try { const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`, { signal: controller.signal }); if (!response.ok) return res.status(response.status === 404 ? 404 : 503).json({ error: "Não foi possível consultar o CNPJ." }); const data = pickCnpj(await response.json(), cnpj); cache.set(cnpj, { data, expires: Date.now() + 600000 }); res.json(data); } catch { res.status(503).json({ error: "Não foi possível consultar o CNPJ." }); } finally { clearTimeout(timer); }
  });
  const portal = async (req, res) => {
    const wantsHtml = req.path.startsWith("/portal/") || (req.get("accept") || "").includes("text/html");
    if (wantsHtml) {
      res.json = (payload) => res.type("html").send(portalPage(payload));
    }
    const token = asText(req.params.token); if (!token) return res.status(404).json({ error: "Portal não encontrado." });
    try { const link = await pool.query("select client_id, organization_id from client_portal_links where token_hash=$1 and (expires_at is null or expires_at > now())", [tokenHash(token)]); if (!link.rowCount) return res.status(404).json({ error: "Portal não encontrado." }); const { client_id: clientId, organization_id: org } = link.rows[0]; const client = await pool.query("select name from clients where id=$1 and organization_id=$2", [clientId, org]); if (!client.rowCount) return res.status(404).json({ error: "Portal não encontrado." }); const [contracts, receivables] = await Promise.all([pool.query("select id,name,status,value,starts_on,ends_on from contracts where client_id=$1 and organization_id=$2 and status='active'", [clientId, org]), pool.query("select id,description,amount,due_at,status from receivables where client_id=$1 and organization_id=$2 and status in ('pending','overdue')", [clientId, org])]); res.json({ client: client.rows[0], contracts: contracts.rows, receivables: receivables.rows }); } catch (e) { const { status, error } = classifyDbError(e, "Não foi possível carregar o portal."); res.status(status).json({ error }); }
  };
  // Public handler; move it ahead of the /api requireAuth middleware installed by
  // server/index.js (the domain registry itself runs after that middleware).
  app.get("/api/portal/:token", portal);
  app.get("/portal/:token", portal);
  const stack = app.router?.stack;
  const portalLayer = stack?.[stack.length - 1];
  const authIndex = stack?.findIndex((layer) => !layer.route && layer.handle?.name === "requireAuth");
  if (portalLayer && authIndex >= 0 && authIndex < stack.length - 1) { stack.splice(stack.indexOf(portalLayer), 1); stack.splice(authIndex, 0, portalLayer); }
  app.post("/api/clients/:id/portal-link", async (req, res) => { const org = tenant(req, res); if (!org) return; try { const client = await pool.query("select id from clients where id=$1 and organization_id=$2", [req.params.id, org]); if (!client.rowCount) return res.status(404).json({ error: "Cliente não encontrado." }); const token = crypto.randomBytes(32).toString("base64url"); await pool.query("insert into client_portal_links (organization_id,client_id,token_hash) values ($1,$2,$3)", [org, req.params.id, tokenHash(token)]); res.status(201).json({ token }); } catch (e) { const { status, error } = classifyDbError(e, "Não foi possível gerar o link do portal."); res.status(status).json({ error }); } });
}
