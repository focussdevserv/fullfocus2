import crypto from "node:crypto";

const digitsOnly = (value) => String(value ?? "").replace(/\D/g, "");
export function isValidCnpj(value) {
  const cnpj = digitsOnly(value);
  if (cnpj.length !== 14 || /^([0-9])\1+$/.test(cnpj)) return false;
  const calc = (length) => { let sum = 0, pos = length - 7; for (let i = length; i >= 1; i -= 1) { sum += Number(cnpj[length - i]) * pos--; if (pos < 2) pos = 9; } const digit = sum % 11 < 2 ? 0 : 11 - (sum % 11); return digit; };
  return calc(12) === Number(cnpj[12]) && calc(13) === Number(cnpj[13]);
}
const cache = new Map();
export const pickCnpj = (data, cnpj) => ({
  cnpj,
  razao_social: data?.razao_social ?? data?.razaoSocial ?? null,
  nome_fantasia: data?.nome_fantasia ?? data?.nomeFantasia ?? null,
  situacao: data?.situacao ?? data?.situacao_cadastral ?? null,
  abertura: data?.abertura ?? data?.data_inicio_atividade ?? null,
  cnae: data?.cnae ?? data?.cnae_fiscal ?? null,
  municipio: data?.municipio ?? null,
  uf: data?.uf ?? null,
  telefone: data?.telefone ?? data?.ddd_telefone_1 ?? data?.telefone_1 ?? null,
  email: data?.email ?? null,
  logradouro: data?.logradouro ?? null,
  numero: data?.numero ?? null,
  complemento: data?.complemento ?? null,
  bairro: data?.bairro ?? null,
  cep: data?.cep ?? null,
  natureza_juridica: data?.natureza_juridica ?? null,
  porte: data?.porte ?? null,
  capital_social: data?.capital_social ?? null,
});
const html = (value) => String(value ?? "").replace(/[&<>\"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[character]));
const portalPage = ({ client, contracts, receivables, projects = [], tickets = [] }) => `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Portal · ${html(client.name)}</title><style>:root{color-scheme:dark;font-family:system-ui,sans-serif;background:#07111f;color:#edf4ff}body{margin:0;padding:32px 18px;background:radial-gradient(circle at 80% 0,#123b77,#07111f 48%)}main{max-width:900px;margin:auto}.brand{color:#ff2844;font-weight:800}.brand span{color:#fff}.hero,.card{border:1px solid #27466d;background:#0d1c31dd;border-radius:18px;padding:24px}.hero{margin:22px 0;display:flex;justify-content:space-between;gap:20px;align-items:end}.hero h1{margin:8px 0;font-size:clamp(26px,5vw,42px)}.muted{color:#9eb1cc}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px}.card h2{margin-top:0;font-size:18px}.row{padding:14px 0;border-top:1px solid #27466d;display:flex;justify-content:space-between;gap:12px}.row:first-of-type{border-top:0}.pill{color:#7ce5b2;font-size:12px}.amount{font-weight:700}.empty{color:#9eb1cc;padding:8px 0}@media(max-width:600px){body{padding:20px 12px}.hero{display:block}}</style></head><body><main><div class="brand">Focus<span>Dev</span></div><section class="hero"><div><div class="muted">Portal do cliente</div><h1>Olá, ${html(client.name)}.</h1><div class="muted">Acompanhe seus contratos e próximos pagamentos.</div></div><div class="muted">Atualizado agora</div></section><div class="grid"><section class="card"><h2>Contratos ativos</h2>${contracts.length ? contracts.map((contract) => `<div class="row"><div><strong>${html(contract.name)}</strong><div class="muted">${html(contract.starts_on || "")} ${contract.ends_on ? `até ${html(contract.ends_on)}` : ""}</div></div><div class="pill">Ativo</div></div>`).join("") : '<div class="empty">Nenhum contrato ativo.</div>'}</section><section class="card"><h2>Próximos pagamentos</h2>${receivables.length ? receivables.map((receivable) => `<div class="row"><div><strong>${html(receivable.description)}</strong><div class="muted">Vencimento: ${html(receivable.due_at)}</div></div><div class="amount">R$ ${Number(receivable.amount || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</div></div>`).join("") : '<div class="empty">Nenhum pagamento pendente.</div>'}</section><section class="card"><h2>Projetos</h2>${projects.length ? projects.map((project) => `<div class="row"><div><strong>${html(project.name)}</strong><div class="muted">${html(project.status || "Em andamento")} · ${Number(project.progress || 0)}%${project.due_on ? ` · prazo ${html(project.due_on)}` : ""}</div></div><div class="pill">${Number(project.progress || 0)}%</div></div>`).join("") : '<div class="empty">Nenhum projeto disponível.</div>'}</section><section class="card"><h2>Tickets de suporte</h2>${tickets.length ? tickets.map((ticket) => `<div class="row"><div><strong>${html(ticket.title)}</strong><div class="muted">${html(ticket.status || "Aberto")} · ${html(ticket.priority || "Normal")}</div></div></div>`).join("") : '<div class="empty">Nenhum ticket aberto.</div>'}</section></div></main></body></html>`;
function tokenHash(token) { return crypto.createHash("sha256").update(token).digest("hex"); }
export function register(app, ctx) {
  const { pool, tenant, asText, classifyDbError } = ctx;
  const relationOverview = async (req, res, table) => {
    const org = tenant(req, res); if (!org) return;
    const id = req.params.id;
    try {
      const entity = table === "contacts"
        ? await pool.query("select c.*,co.name company_name from contacts c left join companies co on co.id=c.company_id and co.organization_id=c.organization_id where c.id=$1 and c.organization_id=$2", [id, org])
        : await pool.query("select * from companies where id=$1 and organization_id=$2", [id, org]);
      if (!entity.rowCount) return res.status(404).json({ error: table === "contacts" ? "Contato não encontrado." : "Empresa não encontrada." });
      const related = table === "contacts"
        ? await Promise.all([
          pool.query("select id,name,status,company_id,contact_id from clients where organization_id=$1 and contact_id=$2", [org, id]),
          pool.query("select id,name,status,next_action_at from leads where organization_id=$1 and contact_id=$2 order by created_at desc", [org, id]),
          pool.query("select id,name,stage,amount,status from opportunities where organization_id=$1 and contact_id=$2 order by created_at desc", [org, id]),
          pool.query("select id,subject,channel,status,last_message_at from conversations where organization_id=$1 and contact_id=$2 order by last_message_at desc nulls last limit 20", [org, id]),
          pool.query("select id,action,entity_type,entity_id,changes,created_at from audit_events where organization_id=$1 and ((entity_type='contacts' and entity_id=$2) or (entity_type='leads' and entity_id in (select id from leads where organization_id=$1 and contact_id=$2))) order by created_at desc limit 30", [org, id]),
        ])
        : await Promise.all([
          pool.query("select id,name,email,phone,role,is_primary from contacts where organization_id=$1 and company_id=$2 order by is_primary desc nulls last,name", [org, id]),
          pool.query("select id,name,status,amount,stage from opportunities where organization_id=$1 and company_id=$2 order by created_at desc", [org, id]),
          pool.query("select id,title,status,amount from proposals where organization_id=$1 and opportunity_id in (select id from opportunities where organization_id=$1 and company_id=$2) order by created_at desc", [org, id]),
          pool.query("select id,name,status,value from contracts where organization_id=$1 and client_id in (select id from clients where organization_id=$1 and company_id=$2) order by created_at desc", [org, id]),
          pool.query("select id,name,status,progress from projects where organization_id=$1 and client_id in (select id from clients where organization_id=$1 and company_id=$2) order by created_at desc", [org, id]),
          pool.query("select id,action,entity_type,entity_id,changes,created_at from audit_events where organization_id=$1 and ((entity_type='companies' and entity_id=$2) or (entity_type='contacts' and entity_id in (select id from contacts where organization_id=$1 and company_id=$2))) order by created_at desc limit 30", [org, id]),
        ]);
      const keys = table === "contacts" ? ["clients", "leads", "opportunities", "conversations", "activities"] : ["contacts", "opportunities", "proposals", "contracts", "projects", "activities"];
      res.json({ [table === "contacts" ? "contact" : "company"]: entity.rows[0], ...Object.fromEntries(keys.map((key, index) => [key, related[index].rows])) });
    } catch (error) { const out = classifyDbError(error, "Não foi possível carregar os relacionamentos."); res.status(out.status).json({ error: out.error }); }
  };
  app.get("/api/contacts/:id/overview", (req, res) => relationOverview(req, res, "contacts"));
  app.get("/api/companies/:id/overview", (req, res) => relationOverview(req, res, "companies"));
  app.get("/api/cnpj/:cnpj", async (req, res) => {
    const org = tenant(req, res); if (!org) return;
    const cnpj = digitsOnly(req.params.cnpj);
    if (!isValidCnpj(cnpj)) return res.status(400).json({ error: "CNPJ inválido." });
    const found = cache.get(cnpj); if (found && found.expires > Date.now()) return res.json(found.data);
    const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 8000);
    try { const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`, { signal: controller.signal }); if (!response.ok) return res.status(response.status === 404 ? 404 : 503).json({ error: "Não foi possível consultar o CNPJ." }); const data = pickCnpj(await response.json(), cnpj); cache.set(cnpj, { data, expires: Date.now() + 600000 }); res.json(data); } catch { res.status(503).json({ error: "Não foi possível consultar o CNPJ." }); } finally { clearTimeout(timer); }
  });
  app.get("/api/cep/:cep", async (req, res) => {
    const org = tenant(req, res); if (!org) return;
    const cep = digitsOnly(req.params.cep); if (cep.length !== 8) return res.status(400).json({ error: "CEP inválido." });
    try { const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`, { signal: AbortSignal.timeout(8000) }); if (!response.ok) return res.status(503).json({ error: "Não foi possível consultar o CEP." }); const data = await response.json(); if (data.erro) return res.status(404).json({ error: "CEP não encontrado." }); res.json({ zip_code: cep, street: data.logradouro || "", neighborhood: data.bairro || "", city: data.localidade || "", state: data.uf || "", country: "Brasil" }); } catch { res.status(503).json({ error: "Não foi possível consultar o CEP." }); }
  });
  app.get("/api/clients/:id/overview", async (req, res) => {
    const org = tenant(req, res); if (!org) return;
    try {
      const client = await pool.query("select c.*,co.name company_name,co.phone company_phone,ct.name contact_name,ct.phone contact_phone from clients c left join companies co on co.id=c.company_id and co.organization_id=c.organization_id left join contacts ct on ct.id=c.contact_id and ct.organization_id=c.organization_id where c.id=$1 and c.organization_id=$2", [req.params.id, org]);
      if (!client.rowCount) return res.status(404).json({ error: "Cliente não encontrado." });
      const row = client.rows[0];
      const [contacts, conversations, contracts, proposals, receivables, projects, tasks, activities] = await Promise.all([
        pool.query("select id,name,email,phone,role from contacts where organization_id=$1 and (id=$2 or company_id=$3) order by name", [org, row.contact_id || 0, row.company_id || 0]),
        pool.query("select c.id,c.subject,c.channel,c.status,c.remote_number,c.unread_count,c.last_message_at,(select body from messages m where m.conversation_id=c.id order by m.created_at desc limit 1) last_message from conversations c where c.organization_id=$1 and (c.client_id=$2 or c.contact_id=$3) order by c.last_message_at desc nulls last,c.created_at desc limit 20", [org, row.id, row.contact_id || 0]),
        pool.query("select id,name,status,value,starts_on,ends_on from contracts where organization_id=$1 and client_id=$2 order by created_at desc", [org, row.id]),
        pool.query("select p.id,p.title,p.status,p.amount,p.valid_until from proposals p left join opportunities o on o.id=p.opportunity_id and o.organization_id=p.organization_id left join leads l on l.id=p.lead_id and l.organization_id=p.organization_id where p.organization_id=$1 and ((o.company_id=$2 and $2 is not null) or (l.contact_id=$3 and $3 is not null)) order by p.created_at desc limit 20", [org, row.company_id || null, row.contact_id || null]),
        pool.query("select id,description,amount,due_at,status,paid_at from receivables where organization_id=$1 and client_id=$2 order by due_at desc limit 20", [org, row.id]),
        pool.query("select id,name,status,progress,due_on,production_url,repository_url from projects where organization_id=$1 and client_id=$2 order by created_at desc", [org, row.id]),
        pool.query("select id,title,status,priority,due_at,project_id from tasks where organization_id=$1 and (client_id=$2 or project_id in (select id from projects where organization_id=$1 and client_id=$2)) order by due_at nulls last,created_at desc limit 30", [org, row.id]),
        pool.query("select id,actor_id,action,entity_type,entity_id,changes,created_at from audit_events where organization_id=$1 and ((entity_type='clients' and entity_id=$2) or (entity_type='projects' and entity_id in (select id from projects where organization_id=$1 and client_id=$2)) or (entity_type='contracts' and entity_id in (select id from contracts where organization_id=$1 and client_id=$2)) or (entity_type='receivables' and entity_id in (select id from receivables where organization_id=$1 and client_id=$2))) order by created_at desc limit 30", [org, row.id]),
      ]);
      const unpaid = receivables.rows.filter((item) => !item.paid_at).reduce((sum, item) => sum + Number(item.amount || 0), 0);
      res.json({ client: row, contacts: contacts.rows, conversations: conversations.rows, contracts: contracts.rows, proposals: proposals.rows, receivables: receivables.rows, projects: projects.rows, tasks: tasks.rows, activities: activities.rows, summary: { active_projects: projects.rows.filter((item) => !["done", "published", "cancelled"].includes(item.status)).length, completed_projects: projects.rows.filter((item) => ["done", "published"].includes(item.status)).length, balance_open: unpaid, recurring_monthly: Number(row.monthly_fee || 0) } });
    } catch (e) { const { status, error } = classifyDbError(e, "Não foi possível carregar o resumo do cliente."); res.status(status).json({ error }); }
  });
  const portal = async (req, res) => {
    const wantsHtml = req.path.startsWith("/portal/") || (req.get("accept") || "").includes("text/html");
    if (wantsHtml) {
      const sendJson = res.json.bind(res);
      res.json = (payload) => payload?.client ? res.type("html").send(portalPage(payload)) : sendJson(payload);
    }
    const token = asText(req.params.token); if (!token) return res.status(404).json({ error: "Portal não encontrado." });
    try { const link = await pool.query("select client_id, organization_id from client_portal_links where token_hash=$1 and (expires_at is null or expires_at > now())", [tokenHash(token)]); if (!link.rowCount) return res.status(404).json({ error: "Portal não encontrado." }); const { client_id: clientId, organization_id: org } = link.rows[0]; const client = await pool.query("select name from clients where id=$1 and organization_id=$2", [clientId, org]); if (!client.rowCount) return res.status(404).json({ error: "Portal não encontrado." }); const [contracts, receivables, projects, tickets] = await Promise.all([pool.query("select id,name,status,value,starts_on,ends_on from contracts where client_id=$1 and organization_id=$2 and status in ('active','signed')", [clientId, org]), pool.query("select id,description,amount,due_at,status from receivables where client_id=$1 and organization_id=$2 and status in ('pending','overdue','partially_paid')", [clientId, org]), pool.query("select id,name,status,progress,due_on,production_url from projects where client_id=$1 and organization_id=$2 order by created_at desc", [clientId, org]), pool.query("select id,title,status,priority,project_id from tickets where client_id=$1 and organization_id=$2 and status not in ('closed','cancelled') order by created_at desc", [clientId, org])]); res.json({ client: client.rows[0], contracts: contracts.rows, receivables: receivables.rows, projects: projects.rows, tickets: tickets.rows }); } catch (e) { const { status, error } = classifyDbError(e, "Não foi possível carregar o portal."); res.status(status).json({ error }); }
  };
  // Public handler; move it ahead of the /api requireAuth middleware installed by
  // server/index.js (the domain registry itself runs after that middleware).
  app.get("/api/portal/:token", portal);
  const stack = app.router?.stack;
  const portalLayer = stack?.[stack.length - 1];
  const authIndex = stack?.findIndex((layer) => !layer.route && layer.handle?.name === "requireAuth");
  if (portalLayer && authIndex >= 0 && authIndex < stack.length - 1) { stack.splice(stack.indexOf(portalLayer), 1); stack.splice(authIndex, 0, portalLayer); }
  app.post("/api/clients/:id/portal-link", async (req, res) => { const org = tenant(req, res); if (!org) return; try { const client = await pool.query("select id from clients where id=$1 and organization_id=$2", [req.params.id, org]); if (!client.rowCount) return res.status(404).json({ error: "Cliente não encontrado." }); const token = crypto.randomBytes(32).toString("base64url"); await pool.query("insert into client_portal_links (organization_id,client_id,token_hash) values ($1,$2,$3)", [org, req.params.id, tokenHash(token)]); res.status(201).json({ token }); } catch (e) { const { status, error } = classifyDbError(e, "Não foi possível gerar o link do portal."); res.status(status).json({ error }); } });
}
