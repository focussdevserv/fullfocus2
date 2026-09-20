import crypto from "node:crypto";

const digitsOnly = (value) => String(value ?? "").replace(/\D/g, "");
export function isValidCnpj(value) {
  const cnpj = digitsOnly(value);
  if (cnpj.length !== 14 || /^([0-9])\1+$/.test(cnpj)) return false;
  const calc = (length) => { let sum = 0, pos = length - 7; for (let i = length; i >= 1; i -= 1) { sum += Number(cnpj[length - i]) * pos--; if (pos < 2) pos = 9; } const digit = sum % 11 < 2 ? 0 : 11 - (sum % 11); return digit; };
  return calc(12) === Number(cnpj[12]) && calc(13) === Number(cnpj[13]);
}
const cache = new Map();
const publicClientFields = (client) => {
  if (!client || typeof client !== "object") return client;
  const safe = { ...client };
  delete safe.pix_key;
  delete safe.invoice_data;
  delete safe.internal_notes;
  return safe;
};
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
const html = (value) => String(value ?? "").replace(/[&<>\"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[character]));
const portalStatus = { active: "Ativo", signed: "Assinado", pending: "Pendente", overdue: "Em atraso", partially_paid: "Parcialmente pago", open: "Aberto", in_progress: "Em andamento", resolved: "Resolvido", new: "Novo", high: "Alta", urgent: "Urgente", normal: "Normal", low: "Baixa" };
const portalDate = (value) => value ? new Date(value).toLocaleDateString("pt-BR") : "—";
const portalMoney = (value) => Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const portalLabel = (value, fallback = "—") => html(portalStatus[value] || value || fallback);
const portalPage = ({ client, contracts, receivables, projects = [], tickets = [] }) => {
  const openAmount = receivables.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const progress = (value) => Math.min(100, Math.max(0, Number(value) || 0));
  const empty = (message) => `<p class="empty">${html(message)}</p>`;
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#081321"><title>Portal · ${html(client.name)}</title><style>:root{color-scheme:dark;font-family:Inter,ui-sans-serif,system-ui,sans-serif;background:#07111f;color:#edf4ff}*{box-sizing:border-box}body{margin:0;min-height:100vh;padding:28px 18px;background:radial-gradient(circle at 80% 0,#17467f 0,#07111f 46%,#050b14 100%)}main{max-width:980px;margin:auto}.brand{display:flex;align-items:center;gap:8px;color:#ff3d56;font-size:18px;font-weight:800;letter-spacing:-.03em}.brand span{color:#fff}.eyebrow,.muted{color:#9eb1cc}.eyebrow{font-size:12px;text-transform:uppercase;letter-spacing:.12em;font-weight:700}.hero,.summary,.card{border:1px solid #27466d;background:linear-gradient(145deg,#10243ddd,#0a1728ee);border-radius:20px;box-shadow:0 18px 50px #0003}.hero{margin:20px 0 16px;padding:28px;display:flex;justify-content:space-between;gap:24px;align-items:end}.hero h1{margin:8px 0;font-size:clamp(28px,5vw,46px);letter-spacing:-.045em}.hero p{margin:0;line-height:1.6}.updated{text-align:right;font-size:12px}.summary{display:grid;grid-template-columns:repeat(3,1fr);gap:1px;overflow:hidden;margin-bottom:16px}.summary div{padding:18px;background:#0d1b2d}.summary strong{display:block;margin-top:6px;font-size:21px}.summary .accent{color:#7ce5b2}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}.card{padding:22px}.card h2{margin:0 0 10px;font-size:18px;letter-spacing:-.02em}.row{padding:15px 0;border-top:1px solid #27466d;display:flex;justify-content:space-between;gap:16px}.row:first-of-type{border-top:0}.row strong{display:block;overflow-wrap:anywhere}.row .muted{margin-top:5px;font-size:13px;line-height:1.45}.pill{color:#7ce5b2;font-size:12px;font-weight:700;white-space:nowrap}.pill.warn{color:#ffbd69}.pill.danger{color:#ff7e8e}.amount{font-weight:700;white-space:nowrap}.progress{height:6px;margin-top:10px;border-radius:99px;background:#203958;overflow:hidden}.progress i{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,#4c9cff,#7ce5b2)}.empty{color:#9eb1cc;padding:10px 0;margin:0}.footer{padding:22px 0 8px;text-align:center;color:#7186a1;font-size:12px}@media(max-width:640px){body{padding:20px 12px}.hero{display:block;padding:22px}.updated{text-align:left;margin-top:16px}.summary{grid-template-columns:1fr}.grid{grid-template-columns:1fr}.card{padding:18px}.row{gap:10px;flex-direction:column}.amount,.pill{align-self:flex-start}}</style></head><body><main><div class="brand" aria-label="FocusDev">Focus<span>Dev</span></div><section class="hero"><div><div class="eyebrow">Portal do cliente</div><h1>Olá, ${html(client.name)}.</h1><p class="muted">Acompanhe contratos, projetos e próximos pagamentos em um só lugar.</p></div><div class="updated">Atualizado agora</div></section><section class="summary" aria-label="Resumo"><div><span class="muted">Contratos ativos</span><strong>${contracts.length}</strong></div><div><span class="muted">Em aberto</span><strong class="accent">${portalMoney(openAmount)}</strong></div><div><span class="muted">Projetos</span><strong>${projects.length}</strong></div></section><div class="grid"><section class="card"><h2>Contratos ativos</h2>${contracts.length ? contracts.map((contract) => `<div class="row"><div><strong>${html(contract.name)}</strong><div class="muted">${portalDate(contract.starts_on)}${contract.ends_on ? ` até ${portalDate(contract.ends_on)}` : ""}</div></div><div class="pill">${portalLabel(contract.status, "Ativo")}</div></div>`).join("") : empty("Nenhum contrato ativo.")}</section><section class="card"><h2>Próximos pagamentos</h2>${receivables.length ? receivables.map((receivable) => `<div class="row"><div><strong>${html(receivable.description)}</strong><div class="muted">Vencimento: ${portalDate(receivable.due_at)}</div></div><div><div class="amount">${portalMoney(receivable.amount)}</div><div class="pill ${receivable.status === "overdue" ? "danger" : "warn"}">${portalLabel(receivable.status, "Pendente")}</div></div></div>`).join("") : empty("Nenhum pagamento pendente.")}</section><section class="card"><h2>Projetos</h2>${projects.length ? projects.map((project) => { const value = progress(project.progress); return `<div class="row"><div><strong>${html(project.name)}</strong><div class="muted">${portalLabel(project.status, "Em andamento")}${project.due_on ? ` · prazo ${portalDate(project.due_on)}` : ""}</div><div class="progress" aria-label="${value}% concluído"><i style="width:${value}%"></i></div></div><div class="pill">${value}%</div></div>`; }).join("") : empty("Nenhum projeto disponível.")}</section><section class="card"><h2>Tickets de suporte</h2>${tickets.length ? tickets.map((ticket) => `<div class="row"><div><strong>${html(ticket.title)}</strong><div class="muted">Prioridade: ${portalLabel(ticket.priority, "Normal")}</div></div><div class="pill">${portalLabel(ticket.status, "Aberto")}</div></div>`).join("") : empty("Nenhum ticket aberto.")}</section></div><div class="footer">Este portal é privado e foi gerado pelo seu workspace FocusDev.</div></main></body></html>`;
};
function tokenHash(token) { return crypto.createHash("sha256").update(token).digest("hex"); }
export function register(app, ctx) {
  const { pool, tenant, asText, classifyDbError } = ctx;
  app.use("/api/clients", (req, res, next) => {
    if (req.method !== "GET" || req.path !== "/") return next();
    const sendJson = res.json.bind(res);
    res.json = (payload) => payload?.clients ? sendJson({ ...payload, clients: payload.clients.map(publicClientFields) }) : sendJson(payload);
    next();
  });
  const listEntity = (table, searchColumns, filterColumns = []) => app.get(`/api/${table}`, async (req, res) => {
    const org = tenant(req, res); if (!org) return;
    const values = [org], where = [`${table}.organization_id=$1`];
    const add = (sql, value) => { values.push(value); where.push(sql.replace("$VALUE", `$${values.length}`)); };
    const search = asText(req.query.search || req.query.q);
    if (search) { values.push(`%${search.slice(0, 100)}%`); const index = values.length; where.push(`(${searchColumns.map((column) => `coalesce(${table}.${column},'') ilike $${index}`).join(" or ")})`); }
    for (const field of filterColumns) if (req.query[field] !== undefined && req.query[field] !== "") add(`${table}.${field}=$VALUE`, String(req.query[field]));
    const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 250), offset = Math.max(Number(req.query.offset) || 0, 0); values.push(limit, offset);
    try { const q = await pool.query(`select ${table}.* from ${table} where ${where.join(" and ")} order by ${table}.created_at desc limit $${values.length - 1} offset $${values.length}`, values); res.json({ [table]: q.rows, pagination: { limit, offset, returned: q.rows.length } }); } catch (error) { const out = classifyDbError(error, "Não foi possível carregar os registros."); res.status(out.status).json({ error: out.error }); }
  });
  listEntity("contacts", ["name", "email", "phone", "document"], ["company_id", "is_primary"]);
  listEntity("companies", ["name", "trade_name", "document", "email", "phone"], ["status", "segment"]);
  listEntity("clients", ["name", "legal_name", "trade_name", "email", "phone", "whatsapp", "document"], ["status", "company_id", "contact_id", "financial_status"]);
  app.post("/api/clients/quick", async (req, res) => {
    const org = tenant(req, res); if (!org) return;
    const body = req.body || {}, name = asText(body.name), email = asText(body.email) || null, phone = asText(body.phone || body.whatsapp) || null, document = asText(body.document).replace(/\D/g, "") || null;
    if (!name) return res.status(400).json({ error: "Informe o nome do cliente." });
    const db = pool.connect ? await pool.connect().catch(() => null) : pool;
    if (!db) return res.status(503).json({ error: "Não foi possível iniciar o cadastro do cliente." });
    try {
      await db.query("begin");
      const identityLocks = [email && `email:${email.toLowerCase()}`, phone && `phone:${digitsOnly(phone)}`, document && `document:${document}`].filter(Boolean).sort();
      for (const identity of identityLocks) await db.query("select pg_advisory_xact_lock(hashtext($1),hashtext($2))", [String(org), identity]);
      const existing = await db.query("select id from clients where organization_id=$1 and (($2<>'' and lower(trim(email))=lower(trim($2))) or ($3<>'' and regexp_replace(coalesce(phone,''),'\\D','','g')=regexp_replace($3,'\\D','','g')) or ($4<>'' and regexp_replace(coalesce(document,''),'\\D','','g')=$4)) limit 1", [org, email || "", phone || "", document || ""]);
      if (existing.rowCount) { await db.query("commit"); return res.json({ id: existing.rows[0].id, client: existing.rows[0], created: false }); }
      let companyId = body.company_id || null, contactId = body.contact_id || null;
      if (companyId) { const company = await db.query("select id from companies where id=$1 and organization_id=$2", [companyId, org]); if (!company.rowCount) { await db.query("rollback"); return res.status(400).json({ error: "Empresa inválida para este workspace." }); } }
      if (!companyId && asText(body.company_name)) {
        const companyName = asText(body.company_name);
        await db.query("select pg_advisory_xact_lock(hashtext($1),hashtext($2))", [String(org), `company:${companyName.toLowerCase()}`]);
        const company = await db.query("select id from companies where organization_id=$1 and lower(trim(name))=lower(trim($2)) limit 1", [org, companyName]);
        companyId = company.rows[0]?.id || (await db.query("insert into companies (organization_id,name,document) values ($1,$2,$3) returning id", [org, companyName, asText(body.company_document) || null])).rows[0].id;
      }
      if (contactId) { const contact = await db.query("select id from contacts where id=$1 and organization_id=$2", [contactId, org]); if (!contact.rowCount) { await db.query("rollback"); return res.status(400).json({ error: "Contato inválido para este workspace." }); } }
      if (!contactId && (email || phone)) {
        const contact = await db.query("select id from contacts where organization_id=$1 and (($2<>'' and lower(trim(email))=lower(trim($2))) or ($3<>'' and regexp_replace(coalesce(phone,''),'\\D','','g')=regexp_replace($3,'\\D','','g'))) limit 1", [org, email || "", phone || ""]);
        contactId = contact.rows[0]?.id || (await db.query("insert into contacts (organization_id,name,email,phone,company_id) values ($1,$2,$3,$4,$5) returning id", [org, name, email, phone, companyId])).rows[0].id;
      }
      const status = ["active", "inactive", "blocked"].includes(body.status) ? body.status : "active";
      const client = await db.query("insert into clients (organization_id,company_id,contact_id,name,document,email,phone,status) values ($1,$2,$3,$4,$5,$6,$7,$8) returning *", [org, companyId, contactId, name, document, email, phone, status]);
      await db.query("commit");
      res.status(201).json({ id: client.rows[0].id, client: client.rows[0], company_id: companyId, contact_id: contactId, created: true });
    } catch (error) { await db.query("rollback").catch(() => {}); const out = classifyDbError(error, "Não foi possível cadastrar o cliente."); res.status(out.status).json({ error: out.error }); }
    finally { db.release?.(); }
  });
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
          pool.query("select id,name,status,created_at from leads where organization_id=$1 and contact_id=$2 order by created_at desc", [org, id]),
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
      const [contacts, conversations, contracts, proposals, opportunities, receivables, payments, revenues, projects, tasks, tickets, files, briefings, changeRequests, infrastructure, activities, financialSummary] = await Promise.all([
        pool.query("select id,name,email,phone,role from contacts where organization_id=$1 and (id=$2 or company_id=$3) order by name", [org, row.contact_id || 0, row.company_id || 0]),
        pool.query("select c.id,c.subject,c.channel,c.status,c.remote_number,c.unread_count,c.last_message_at,(select body from messages m where m.conversation_id=c.id order by m.created_at desc limit 1) last_message from conversations c where c.organization_id=$1 and (c.client_id=$2 or c.contact_id=$3) order by c.last_message_at desc nulls last,c.created_at desc limit 20", [org, row.id, row.contact_id || 0]),
        pool.query("select id,name,status,value,total_value,proposal_id,project_id,starts_on,ends_on from contracts where organization_id=$1 and client_id=$2 order by created_at desc", [org, row.id]),
        pool.query("select p.id,p.title,p.status,p.amount,p.valid_until,p.client_id,p.project_id from proposals p left join opportunities o on o.id=p.opportunity_id and o.organization_id=p.organization_id left join leads l on l.id=p.lead_id and l.organization_id=p.organization_id where p.organization_id=$1 and (p.client_id=$4 or (o.company_id=$2 and $2 is not null) or (l.contact_id=$3 and $3 is not null)) order by p.created_at desc limit 20", [org, row.company_id || null, row.contact_id || null, row.id]),
        pool.query("select id,name,stage,amount,probability,expected_close,client_id,created_at from opportunities where organization_id=$1 and client_id=$2 order by created_at desc", [org, row.id]),
        pool.query("select r.id,r.description,r.amount,r.due_at,r.status,r.paid_at,r.client_id,r.proposal_id,r.contract_id,r.project_id,coalesce((select sum(p.amount) from payments p where p.organization_id=r.organization_id and p.receivable_id=r.id),0)::float8 paid_amount,greatest(r.amount-coalesce((select sum(p.amount) from payments p where p.organization_id=r.organization_id and p.receivable_id=r.id),0),0)::float8 balance_remaining from receivables r where r.organization_id=$1 and r.client_id=$2 order by r.due_at desc limit 20", [org, row.id]),
        pool.query("select p.id,p.receivable_id,p.charge_id,p.amount,p.paid_at,p.method,p.external_id from payments p join receivables r on r.id=p.receivable_id and r.organization_id=p.organization_id where p.organization_id=$1 and r.client_id=$2 order by p.paid_at desc limit 30", [org, row.id]),
        pool.query("select id,description,amount,net_amount,status,paid_at,client_id,project_id,contract_id,payment_method from revenues where organization_id=$1 and client_id=$2 order by paid_at desc nulls last,created_at desc limit 30", [org, row.id]),
        pool.query("select id,name,status,progress,client_id,contract_id,due_on,production_url,repository_url from projects where organization_id=$1 and client_id=$2 order by created_at desc", [org, row.id]),
        pool.query("select id,title,status,priority,due_at,project_id from tasks where organization_id=$1 and (client_id=$2 or project_id in (select id from projects where organization_id=$1 and client_id=$2)) order by due_at nulls last,created_at desc limit 30", [org, row.id]),
        pool.query("select id,title,status,priority,due_at,project_id,description from tickets where organization_id=$1 and client_id=$2 order by created_at desc limit 30", [org, row.id]),
        pool.query("select id,name,url,kind,size_bytes,project_id,created_at from files where organization_id=$1 and client_id=$2 order by created_at desc limit 40", [org, row.id]),
        pool.query("select id,name,status,project_id,created_at,updated_at from briefings where organization_id=$1 and client_id=$2 order by updated_at desc limit 20", [org, row.id]),
        pool.query("select id,title,status,project_id,description,impact_days,additional_cost,created_at from change_requests where organization_id=$1 and client_id=$2 order by created_at desc limit 30", [org, row.id]),
        pool.query("select id,kind,name,provider,project_id,expires_on,cost,client_price,responsible,status from infrastructure_assets where organization_id=$1 and client_id=$2 order by expires_on nulls last,name limit 40", [org, row.id]),
        pool.query("select id,actor_id,action,entity_type,entity_id,changes,created_at from audit_events where organization_id=$1 and ((entity_type='clients' and entity_id=$2) or (entity_type='projects' and entity_id in (select id from projects where organization_id=$1 and client_id=$2)) or (entity_type='contracts' and entity_id in (select id from contracts where organization_id=$1 and client_id=$2)) or (entity_type='receivables' and entity_id in (select id from receivables where organization_id=$1 and client_id=$2))) order by created_at desc limit 30", [org, row.id]),
        pool.query("select coalesce((select sum(p.amount) from payments p join receivables r on r.id=p.receivable_id and r.organization_id=p.organization_id where p.organization_id=$1 and r.client_id=$2),0)::float8 received_total,coalesce((select sum(greatest(r.amount-coalesce(paid.amount,0),0)) from receivables r left join (select receivable_id,sum(amount) amount from payments where organization_id=$1 group by receivable_id) paid on paid.receivable_id=r.id where r.organization_id=$1 and r.client_id=$2),0)::float8 balance_open,coalesce((select sum(rv.amount) from revenues rv where rv.organization_id=$1 and rv.client_id=$2 and rv.status='confirmed'),0)::float8 confirmed_revenue,(select count(*)::int from tickets t where t.organization_id=$1 and t.client_id=$2 and (t.status is null or t.status not in ('done','closed','cancelled'))) open_tickets,(select count(*)::int from change_requests cr where cr.organization_id=$1 and cr.client_id=$2 and cr.status in ('pending','awaiting_approval')) pending_changes,(select count(*)::int from opportunities o where o.organization_id=$1 and o.client_id=$2) opportunities_total,(select count(*)::int from opportunities o where o.organization_id=$1 and o.client_id=$2 and o.stage not in ('won','lost')) open_opportunities", [org, row.id]),
      ]);
      const totals = financialSummary.rows[0] || {};
      res.json({ client: row, contacts: contacts.rows, conversations: conversations.rows, contracts: contracts.rows, proposals: proposals.rows, opportunities: opportunities.rows, receivables: receivables.rows, payments: payments.rows, revenues: revenues.rows, projects: projects.rows, tasks: tasks.rows, tickets: tickets.rows, files: files.rows, briefings: briefings.rows, change_requests: changeRequests.rows, infrastructure: infrastructure.rows, activities: activities.rows, summary: { active_projects: projects.rows.filter((item) => !["done", "published", "cancelled"].includes(item.status)).length, completed_projects: projects.rows.filter((item) => ["done", "published"].includes(item.status)).length, balance_open: Number(totals.balance_open || 0), received_total: Number(totals.received_total || 0), confirmed_revenue: Number(totals.confirmed_revenue || 0), recurring_monthly: Number(row.monthly_fee || 0), open_tickets: Number(totals.open_tickets || 0), pending_changes: Number(totals.pending_changes || 0), opportunities_total: Number(totals.opportunities_total || 0), open_opportunities: Number(totals.open_opportunities || 0) } });
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
