import "dotenv/config";
import express from "express";
import cors from "cors";
import pg from "pg";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expandRecurringEvents } from "./recurrence.js";
import { singular, classifyDbError, isValidAmount, TABLES_WITH_UPDATED_AT, normalizeIdentity } from "./http-helpers.js";
import { attachResetRoutes } from "./auth-reset.js";
import { runMigrations } from "./migrate.js";
import { registerDomainRoutes } from "./routes/index.js";
import { registerContractPublicRoutes } from "./routes/contract-public.js";
import { registerProposalPublicRoutes } from "./routes/proposal-public.js";
import { registerDeliveryPublicRoutes } from "./routes/delivery-public.js";
import { registerPortalPublicRoute } from "./routes/portal-public.js";
import { registerPortalAuthRoutes } from "./routes/portal-auth.js";
import { registerPortalAdminRoutes } from "./routes/portal-admin.js";
import { registerFormRoutes } from "./routes/forms.js";
import { registerCrmFollowupRoutes } from "./routes/crm-followups.js";
import { registerFinanceOverviewRoutes } from "./routes/finance-overview.js";
import { registerDeliveryWorkflowRoutes } from "./routes/delivery-workflow.js";
import { registerAutomationRunRoutes } from "./routes/automation-runs.js";
import { register as registerEventRoutes } from "./routes/events.js";
import { startAutomationRunner } from "./automations-runner.js";
import { ensureStarterLibrary } from "./starter-library.js";
const { Pool } = pg;
export const app = express();
// O tráfego de produção passa pelo proxy Cloudflare; isso preserva req.secure
// e a leitura correta dos cabeçalhos de encaminhamento sem confiar no Host.
app.set("trust proxy", 1);
const port = Number(process.env.PORT || 3000);
export const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined });
const DEFAULT_ORGANIZATION_ID = process.env.DEFAULT_ORGANIZATION_ID || "00000000-0000-0000-0000-000000000001";
const SESSION_SECRET = process.env.SESSION_SECRET || "development-only-change-me";
const SESSION_MAX_AGE = 60 * 60 * 24 * 7;
if (process.env.NODE_ENV === "production" && (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32)) throw new Error("SESSION_SECRET must be set to at least 32 characters in production.");
// Aceita UUIDs RFC 4122 e o UUID nulo usado pelo workspace padrão legado.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const organizationId = (req) => { const value = req.user?.organization_id || req.get("x-organization-id") || req.query.organizationId || DEFAULT_ORGANIZATION_ID; return UUID.test(String(value)) ? String(value) : null; };
const tenant = (req, res) => { const id = organizationId(req); if (!id) res.status(400).json({ error: "organization_id inválido." }); return id; };
const asText = (v) => typeof v === "string" ? v.trim() : "";
const allowedOrigins = new Set((process.env.CORS_ORIGINS || "").split(",").map((origin) => origin.trim()).filter(Boolean));
app.use(cors({ origin(origin, callback) {
  if (!origin || allowedOrigins.has(origin)) return callback(null, true);
  return callback(null, false);
} }));
app.use(express.json({ limit: "1mb" }));
app.use((_req, res, next) => { res.setHeader("X-Content-Type-Options", "nosniff"); res.setHeader("X-Frame-Options", "DENY"); res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin"); next(); });
app.use((req, _res, next) => { if (/^\/api\/(events|tasks)\/\d+-(?:[^/?]+)$/.test(req.path) || /^\/api\/(events|tasks)\/\d+\/(?:details|schedule)$/.test(req.path)) req.url = req.url.replace(/(\/api\/(?:events|tasks)\/\d+)(?:-[^/?]+|\/(?:details|schedule))/, "$1"); next(); });
const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
app.use((req, res, next) => {
  if (req.path === "/" || req.path === "/index.html" || req.path === "/service-worker.js") {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  }
  next();
});
app.use(express.static(frontendRoot));
app.use(async (req, res, next) => { const isBriefing = req.path.startsWith("/api/briefings/public/") || req.path.startsWith("/briefing/"); if (!isBriefing) return next(); const token = req.path.split("/").filter(Boolean).pop(); if (!token) return next(); try { const q = await pool.query("select status from briefings where public_token=$1", [token]); if (!q.rowCount || !["published", "sent"].includes(q.rows[0].status)) return res.status(404).json({ error: "Briefing indisponível." }); return next(); } catch { return res.status(503).json({ error: "Não foi possível validar o briefing." }); } });

/* Formulários públicos podem disparar somente registros explicitamente
   permitidos na configuração do próprio formulário. A operação é transacional
   para não salvar a resposta sem criar o registro de origem. */
app.use(async (req, res, next) => {
  if (req.method !== "POST" || !req.path.startsWith("/api/forms/public/")) return next();
  const responses = req.body?.responses;
  if (!responses || typeof responses !== "object" || Array.isArray(responses)) return res.status(400).json({ error: "Envie as respostas do formulário." });
  const token = req.path.slice("/api/forms/public/".length);
  if (!token || token.includes("/")) return next();
  const db = await pool.connect().catch(() => null);
  if (!db) return res.status(503).json({ error: "Serviço indisponível." });
  const textValue = (keys) => keys.map((key) => responses[key]).find((value) => value !== undefined && String(value).trim() !== "") || null;
  try {
    await db.query("begin");
    const formQuery = await db.query("select id,organization_id,name,status,schema,automation_config from forms where public_token=$1 and status in ('published','active') for update", [token]);
    if (!formQuery.rowCount) { await db.query("rollback"); return res.status(404).json({ error: "Formulário indisponível." }); }
    const form = formQuery.rows[0], schema = Array.isArray(form.schema) ? form.schema : Array.isArray(form.schema?.fields) ? form.schema.fields : [];
    const fields = schema.map((item, index) => typeof item === "string" ? { name: `field_${index}`, required: true } : { ...item, name: item?.name || `field_${index}` });
    if (!fields.length) { await db.query("rollback"); return res.status(400).json({ error: "Este formulário ainda não possui campos configurados." }); }
    const allowedNames = new Set(fields.map((field) => String(field.name)).filter(Boolean));
    const cleanResponses = Object.fromEntries(Object.entries(responses).filter(([key]) => allowedNames.has(key)).slice(0, 100).map(([key, value]) => [key, typeof value === "string" ? value.slice(0, 5000) : value]));
    const missing = fields.filter((field) => field.required !== false && (cleanResponses[field.name] === undefined || String(cleanResponses[field.name]).trim() === ""));
    if (missing.length) { await db.query("rollback"); return res.status(400).json({ error: `Preencha os campos obrigatórios: ${missing.map((field) => field.label || field.name).slice(0, 3).join(", ")}.` }); }
    const config = form.automation_config && typeof form.automation_config === "object" ? form.automation_config : {}, target = ["lead", "opportunity", "ticket", "task"].includes(config.create) ? config.create : null;
    const updated = await db.query("update forms set responses=coalesce(responses,'[]'::jsonb) || $1::jsonb,submitted_at=now(),updated_at=now() where id=$2 returning id,name,status,submitted_at", [JSON.stringify([cleanResponses]), form.id]);
    let createdRecord = null;
    const name = textValue(["name", "nome", "full_name"]) || `Envio: ${form.name}`;
    const email = textValue(["email", "e-mail"]), phone = textValue(["phone", "telefone", "whatsapp"]), details = JSON.stringify({ form_id: form.id, responses: cleanResponses });
    if (target === "lead") createdRecord = (await db.query("insert into leads (organization_id,name,email,phone,source,status,notes) values ($1,$2,$3,$4,'form','new',$5) returning id,name,status", [form.organization_id, name, email, phone, details])).rows[0];
    if (target === "opportunity") createdRecord = (await db.query("insert into opportunities (organization_id,name,stage,amount,notes) values ($1,$2,'qualification',0,$3) returning id,name,stage", [form.organization_id, name, details])).rows[0];
    if (target === "ticket") createdRecord = (await db.query("insert into tickets (organization_id,title,description,priority,status) values ($1,$2,$3,'medium','open') returning id,title,status", [form.organization_id, name, details])).rows[0];
    if (target === "task") createdRecord = (await db.query("insert into tasks (organization_id,title,description,priority,status) values ($1,$2,$3,'medium','todo') returning id,title,status", [form.organization_id, name, details])).rows[0];
    await db.query("commit");
    return res.json({ form: updated.rows[0], created_record: target ? { type: target, record: createdRecord } : null });
  } catch { await db.query("rollback").catch(() => {}); return res.status(503).json({ error: "Não foi possível salvar as respostas." }); }
  finally { db.release(); }
});

const hashPassword = (password, salt = crypto.randomBytes(16).toString("hex")) => ({ salt, hash: crypto.scryptSync(password, salt, 64).toString("hex") });
const verifyPassword = (password, salt, expected) => { try { return crypto.timingSafeEqual(Buffer.from(hashPassword(password, salt).hash, "hex"), Buffer.from(expected, "hex")); } catch { return false; } };
const signSession = (user) => { const payload = Buffer.from(JSON.stringify({ id: user.id, name: user.name, email: user.email, organization_id: user.organization_id, role: user.role || "member", iat: Date.now(), exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE })).toString("base64url"); const signature = crypto.createHmac("sha256", SESSION_SECRET).update(payload).digest("base64url"); return `${payload}.${signature}`; };
const parseCookies = (header = "") => Object.fromEntries(header.split(";").map((part) => part.trim().split("=")).filter(([key, value]) => key && value).map(([key, ...value]) => [key, value.join("=")]));
const readSession = (req) => { try { const [payload, signature] = (parseCookies(req.get("cookie")).focus_session || "").split("."); if (!payload || !signature) return null; const expected = crypto.createHmac("sha256", SESSION_SECRET).update(payload).digest("base64url"); if (signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null; const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")); return session.exp > Math.floor(Date.now() / 1000) ? session : null; } catch { return null; } };
const sessionCookie = (token, maxAge = SESSION_MAX_AGE) => `focus_session=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${maxAge}${process.env.NODE_ENV === "production" ? "; Secure" : ""}`;
const requireAuth = (req, res, next) => { const user = readSession(req); if (!user) return res.status(401).json({ error: "Autenticação necessária." }); req.user = user; return next(); };
app.post("/api/auth/register", async (req, res) => { const name = asText(req.body?.name), email = asText(req.body?.email).toLowerCase(), password = String(req.body?.password || ""); if (name.length < 2 || !/^\S+@\S+\.\S+$/.test(email) || password.length < 8) return res.status(400).json({ error: "Nome, e-mail e senha válidos são obrigatórios." }); const client = await pool.connect().catch(() => null); if (!client) return res.status(503).json({ error: "Serviço indisponível." }); try { const { salt, hash } = hashPassword(password); await client.query("begin"); const org = await client.query("insert into organizations (name) values ($1) returning id", [`Workspace de ${name}`]); const q = await client.query("insert into users (name,email,password_hash,organization_id,role) values ($1,$2,$3,$4,'owner') returning id,name,email,organization_id,role", [name, email, `${salt}:${hash}`, org.rows[0].id]); await client.query("commit"); res.status(201).json({ user: q.rows[0] }); } catch (e) { await client.query("rollback").catch(() => {}); res.status(e.code === "23505" ? 409 : 503).json({ error: e.code === "23505" ? "Este e-mail já está cadastrado." : "Não foi possível criar a conta." }); } finally { client.release(); } });
app.post("/api/auth/login", async (req, res) => { const email = asText(req.body?.email).toLowerCase(), password = String(req.body?.password || ""); try { const q = await pool.query("select id,name,email,password_hash,organization_id,role,access_status,access_expires_on from users where email=$1", [email]); const u = q.rows[0], [salt, hash] = u?.password_hash?.split(":") || []; if (!u || !salt || !verifyPassword(password, salt, hash)) return res.status(401).json({ error: "E-mail ou senha inválidos." }); if (["inactive", "blocked"].includes(u.access_status) || (u.access_expires_on && new Date(u.access_expires_on) < new Date())) return res.status(403).json({ error: "Seu acesso está encerrado ou expirado." }); const user = { id: u.id, name: u.name, email: u.email, organization_id: u.organization_id, role: u.role || "member" }; res.setHeader("Set-Cookie", sessionCookie(signSession(user))); res.json({ user }); } catch { res.status(503).json({ error: "Serviço indisponível." }); } });
app.get("/api/auth/me", requireAuth, async (req, res) => { try { const q = await pool.query("select access_status,access_expires_on,role from users where id=$1 and organization_id=$2", [req.user.id, req.user.organization_id]); const row = q.rows[0]; if (!row || ["inactive", "blocked"].includes(row.access_status) || (row.access_expires_on && new Date(row.access_expires_on) < new Date())) return res.status(401).json({ error: "Seu acesso está encerrado ou expirado." }); res.json({ user: { ...req.user, role: row.role || req.user.role || "member" } }); } catch { res.status(503).json({ error: "Não foi possível validar o acesso." }); } });
app.post("/api/auth/logout", (_req, res) => { res.setHeader("Set-Cookie", sessionCookie("", 0)); res.status(204).end(); });
attachResetRoutes(app, { pool, hashPassword });
app.get("/api/health", async (_req, res) => { try { const q = await pool.query("select now() as time"); res.json({ ok: true, database: "connected", time: q.rows[0].time }); } catch { res.status(503).json({ ok: false, database: "unavailable", error: "Database unavailable." }); } });
/* Rotas públicas (sem sessão): autenticação, health, portal do cliente (token) e webhook do WhatsApp (token). */
const PUBLIC_API_PREFIXES = ["/auth/", "/portal/", "/satisfaction/", "/whatsapp/webhook/", "/public/catalog/", "/forms/public/", "/contracts/public/", "/proposals/public/", "/deliveries/public/"];
registerContractPublicRoutes(app, { pool, tenant, requireAuth, classifyDbError });
registerProposalPublicRoutes(app, { pool, tenant, requireAuth, classifyDbError });
registerDeliveryPublicRoutes(app, { pool, tenant, requireAuth, classifyDbError });
registerPortalAuthRoutes(app, { pool, hashPassword, verifyPassword });
registerPortalPublicRoute(app, { pool });
const formPublicSafe = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[character]));
const publicFormField = (item, index) => {
  const field = typeof item === "string" ? { label: item } : item || {};
  const label = formPublicSafe(field.label || field.name || ("Campo " + (index + 1)));
  const name = formPublicSafe(field.name || ("field_" + index));
  const required = field.required === false ? "" : " required";
  const type = ["email", "number", "tel", "date"].includes(field.type) ? field.type : "text";
  const autocomplete = field.autocomplete || (type === "email" ? "email" : /(^|[_-])(full_?name|name|nome)([_-]|$)/i.test(String(field.name || "")) ? "name" : /(^|[_-])(phone|tel|telefone|whatsapp)([_-]|$)/i.test(String(field.name || "")) ? "tel" : "off");
  const inputmode = type === "number" ? "decimal" : type === "tel" ? "tel" : type === "email" ? "email" : "text";
  const attrs = " id='" + name + "' name='" + name + "' autocomplete='" + formPublicSafe(autocomplete) + "' inputmode='" + inputmode + "'" + required;
  if (field.type === "textarea") return "<label for='" + name + "'>" + label + "<textarea" + attrs + "></textarea></label>";
  if (field.type === "select" && Array.isArray(field.options)) return "<label for='" + name + "'>" + label + "<select" + attrs + "><option value=''>Selecione</option>" + field.options.map((option) => { const value = typeof option === "string" ? option : option?.value ?? ""; const text = typeof option === "string" ? option : option?.label ?? value; return "<option value='" + formPublicSafe(value) + "'>" + formPublicSafe(text) + "</option>"; }).join("") + "</select></label>";
  return "<label for='" + name + "'>" + label + "<input" + attrs + " type='" + type + "'></label>";
};
app.get("/api/public/catalog/:organizationId", async (req, res) => { if (!/^[0-9a-f-]{36}$/i.test(req.params.organizationId)) return res.status(400).json({ error: "Workspace inválido." }); try { const q = await pool.query("select id,name,kind,price,unit,description,short_description,full_description,category,image_url,tags,public_visible,highlighted,term_days,features,limits,recurrence,benefits,delivery_days,included_scope,excluded_scope,deliverables,modules_count,revisions_count,warranty_period,support_included from catalog_items where organization_id=$1 and active=true and public_visible=true and archived_at is null order by highlighted desc, created_at desc", [req.params.organizationId]); res.json({ catalog_items: q.rows }); } catch { res.status(503).json({ error: "Não foi possível carregar o catálogo público." }); } });
app.get("/catalog/:organizationId", async (req, res) => { if (!/^[0-9a-f-]{36}$/i.test(req.params.organizationId)) return res.status(400).send("Workspace inválido."); try { const q = await pool.query("select name,kind,price,unit,description,short_description,category,delivery_days from catalog_items where organization_id=$1 and active=true and public_visible=true and archived_at is null order by highlighted desc,created_at desc", [req.params.organizationId]); const items = q.rows; const card = (item) => "<article class=\"card\"><h2>" + html(item.name) + "</h2><p class=\"kind\">" + html(item.category || item.kind || "Serviço") + "</p><strong>R$ " + Number(item.price || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 }) + "</strong><p>" + html(item.short_description || item.description || "") + "</p>" + (item.delivery_days ? "<small>Prazo: " + html(item.delivery_days + " dias") + "</small>" : "") + "</article>"; res.type("html").send("<!doctype html><html lang=\"pt-BR\"><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>Catálogo FocusDev</title><style>:root{color-scheme:dark;font-family:system-ui,sans-serif;background:#070b14;color:#f8fafc}body{margin:0;padding:32px 18px;background:radial-gradient(circle at 80% 0,#153b77,#070b14 52%)}main{max-width:1050px;margin:auto}.brand{color:#e62429;font-size:24px;font-weight:800}.brand span{color:#f8fafc}.hero{margin:28px 0;padding:28px;border:1px solid #334766;border-radius:18px;background:#111b2e}.hero h1{margin:8px 0;font-size:clamp(28px,5vw,48px)}.muted,.kind,small{color:#94a3b8}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:16px}.card{padding:22px;border:1px solid #334766;border-radius:16px;background:#111b2e;box-shadow:0 12px 32px #0003}.card h2{margin:0 0 6px}.card strong{display:block;margin:14px 0;font-size:24px}@media(max-width:600px){body{padding:20px 12px}} </style><main><div class=\"brand\">Focus<span>Dev</span></div><section class=\"hero\"><div class=\"muted\">Catálogo público</div><h1>Soluções para fazer seu negócio avançar.</h1><p class=\"muted\">Conheça os serviços e produtos publicados pela FocusDev.</p></section><section class=\"grid\">" + (items.length ? items.map(card).join("") : "<p class=\"muted\">Nenhum item publicado no momento.</p>") + "</section></main></html>"); } catch { res.status(503).send("Não foi possível carregar o catálogo."); } });
app.get("/api/forms/public/:token", async (req, res) => { try { const q = await pool.query("select id,name,kind,schema,status from forms where public_token=$1 and status in ('published','active')", [req.params.token]); if (!q.rowCount) return res.status(404).json({ error: "Formulário indisponível." }); res.json({ form: q.rows[0] }); } catch { res.status(503).json({ error: "Não foi possível carregar o formulário." }); } });
app.post("/api/forms/public/:token", async (req, res) => { const responses = req.body?.responses; if (!responses || typeof responses !== "object" || Array.isArray(responses)) return res.status(400).json({ error: "Envie as respostas do formulário." }); try { const q = await pool.query("update forms set responses=coalesce(responses,'[]'::jsonb) || $1::jsonb,submitted_at=now(),updated_at=now() where public_token=$2 and status in ('published','active') returning id,name,status,submitted_at", [JSON.stringify([responses]), req.params.token]); if (!q.rowCount) return res.status(404).json({ error: "Formulário indisponível." }); res.json({ form: q.rows[0] }); } catch { res.status(503).json({ error: "Não foi possível salvar as respostas." }); } });
app.get("/api/satisfaction/:token", async (req, res) => { try { const q = await pool.query("select id,status,rating,comment,created_at,responded_at from satisfaction_requests where token=$1", [req.params.token]); if (!q.rowCount) return res.status(404).json({ error: "Pesquisa não encontrada." }); res.json({ satisfaction: q.rows[0] }); } catch { res.status(503).json({ error: "Não foi possível carregar a pesquisa." }); } });
app.get("/form/:token", async (req, res) => { try { const q = await pool.query("select name,schema,status from forms where public_token=$1 and status in ('published','active')", [req.params.token]); if (!q.rowCount) return res.status(404).send("Formulário não encontrado ou indisponível."); const form = q.rows[0], schema = Array.isArray(form.schema) ? form.schema : Array.isArray(form.schema?.fields) ? form.schema.fields : []; const fields = schema.map(publicFormField).join(""); res.type("html").send("<!doctype html><html lang='pt-BR'><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'><title>" + formPublicSafe(form.name) + "</title><style>:root{color-scheme:dark;font-family:system-ui,sans-serif;background:#070b14;color:#f8fafc}body{margin:0;padding:32px 16px;background:#070b14}main{max-width:720px;margin:auto}.brand{color:#e62429;font-weight:800;font-size:22px}.brand span{color:#f8fafc}.card{margin-top:24px;padding:28px;border:1px solid #334766;border-radius:16px;background:#111b2e}h1{margin:8px 0 24px}label{display:block;margin:20px 0;font-weight:600}input,textarea,select{box-sizing:border-box;display:block;width:100%;margin-top:8px;padding:12px;border:1px solid #526887;border-radius:10px;background:#0d1424;color:#f8fafc;font:inherit}textarea{min-height:110px;resize:vertical}button{margin-top:8px;border:0;border-radius:10px;padding:13px 18px;background:#e62429;color:white;font-weight:700;cursor:pointer}#status{margin-top:16px;color:#94a3b8}</style><main><div class='brand'>Focus<span>Dev</span></div><section class='card'><div>Formulário público</div><h1>" + formPublicSafe(form.name) + "</h1><form id='public-form'>" + (fields || "<p>Este formulário ainda não possui campos.</p>") + "<button type='submit'>Enviar respostas</button><div id='status' role='status'></div></form></section></main><script>const form=document.querySelector('#public-form'),status=document.querySelector('#status'),token=location.pathname.split('/').pop();form.addEventListener('submit',async(event)=>{event.preventDefault();status.textContent='Enviando...';try{const response=await fetch('/api/forms/public/'+token,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({responses:Object.fromEntries(new FormData(form))})});const data=await response.json();if(!response.ok)throw new Error(data.error||'Não foi possível enviar.');form.innerHTML='<h2>Respostas enviadas</h2><p>Obrigado. A equipe recebeu suas informações.</p>'}catch(error){status.textContent=error.message}});</script></html>"); } catch { res.status(503).send("Não foi possível carregar o formulário."); } });
app.get("/api/briefings/public/:token", async (req, res) => { try { const q = await pool.query("select id,name,questions,status from briefings where public_token=$1 and status in ('published','sent','draft')", [req.params.token]); if (!q.rowCount) return res.status(404).json({ error: "Briefing indisponível." }); res.json({ briefing: q.rows[0] }); } catch { res.status(503).json({ error: "Não foi possível carregar o briefing." }); } });
app.post("/api/briefings/public/:token", async (req, res) => { const responses = req.body?.responses; if (!responses || typeof responses !== "object" || Array.isArray(responses)) return res.status(400).json({ error: "Envie as respostas do briefing." }); try { const q = await pool.query("update briefings set responses=$1,status='answered',updated_at=now() where public_token=$2 and status in ('published','sent','draft') returning id,name,status,updated_at", [JSON.stringify(responses), req.params.token]); if (!q.rowCount) return res.status(404).json({ error: "Briefing indisponível." }); res.json({ briefing: q.rows[0] }); } catch { res.status(503).json({ error: "Não foi possível salvar as respostas." }); } });
app.get("/briefing/:token", async (req, res) => { const safe = (value) => String(value ?? "").replace(/[&<>\"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[character])); try { const q = await pool.query("select name,questions,status from briefings where public_token=$1 and status in ('published','sent','draft')", [req.params.token]); if (!q.rowCount) return res.status(404).send("Briefing não encontrado ou indisponível."); const briefing = q.rows[0], questions = Array.isArray(briefing.questions) ? briefing.questions : []; const fields = questions.map((question, index) => { const item = typeof question === "string" ? { label: question } : question || {}; return `<label>${safe(item.label || item.question || `Pergunta ${index + 1}`)}<textarea name="${index}" required>${safe(item.answer || "")}</textarea></label>`; }).join(""); res.type("html").send(`<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${safe(briefing.name)}</title><style>:root{color-scheme:dark;font-family:system-ui,sans-serif;background:#070b14;color:#f8fafc}body{margin:0;padding:32px 16px;background:radial-gradient(circle at 80% 0,#153b77,#070b14 55%)}main{max-width:720px;margin:auto}.brand{color:#e62429;font-weight:800;font-size:22px}.brand span{color:#f8fafc}.card{margin-top:24px;padding:28px;border:1px solid #334766;border-radius:16px;background:#111b2e}h1{margin:8px 0 24px}label{display:block;margin:20px 0;font-weight:600}textarea{box-sizing:border-box;display:block;width:100%;min-height:110px;margin-top:8px;padding:12px;border:1px solid #526887;border-radius:10px;background:#0d1424;color:#f8fafc;font:inherit}button{margin-top:8px;border:0;border-radius:10px;padding:13px 18px;background:#e62429;color:white;font-weight:700;cursor:pointer}#status{margin-top:16px;color:#94a3b8}</style><main><div class="brand">Focus<span>Dev</span></div><section class="card"><h1>${safe(briefing.name)}</h1><form id="briefing">${fields || "<p>Este briefing ainda não possui perguntas.</p>"}<button type="submit">Enviar respostas</button><div id="status" role="status"></div></form></section><script>const form=document.querySelector("#briefing"),status=document.querySelector("#status");form.addEventListener("submit",async(event)=>{event.preventDefault();const responses=Object.fromEntries(new FormData(form));status.textContent="Enviando...";try{const response=await fetch("/api/briefings/public/${safe(req.params.token)}",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({responses})});const data=await response.json();if(!response.ok)throw new Error(data.error||"Não foi possível enviar.");form.innerHTML="<h2>Respostas enviadas</h2><p>Obrigado. A equipe recebeu suas informações.</p>"}catch(error){status.textContent=error.message}});</script></html>`); } catch { res.status(503).send("Não foi possível carregar o briefing."); } });
app.use("/api", (req, res, next) => { if (req.path === "/health" || PUBLIC_API_PREFIXES.some((prefix) => req.path.startsWith(prefix)) || req.path.startsWith("/briefings/public/")) return next(); return requireAuth(req, res, next); });

app.use("/api", async (req, res, next) => { if (!req.user) return next(); try { const q = await pool.query("select u.access_status,u.access_revoked_at,u.role,o.sessions_revoked_at from users u join organizations o on o.id=u.organization_id where u.id=$1 and u.organization_id=$2", [req.user.id, req.user.organization_id]); const current = q.rows[0]; if (current?.role) req.user.role = current.role; /* papel sempre vem do banco: cookies antigos não o carregavam */ if (!current || ["inactive", "blocked"].includes(current.access_status) || (current.access_revoked_at && (!req.user.iat || new Date(req.user.iat) < new Date(current.access_revoked_at))) || (current.sessions_revoked_at && (!req.user.iat || new Date(req.user.iat) < new Date(current.sessions_revoked_at)))) return res.status(401).json({ error: "Seu acesso foi encerrado. Solicite a reativação ao administrador." }); return next(); } catch { return res.status(503).json({ error: "Não foi possível validar o acesso." }); } });
// Registra automaticamente mutações bem-sucedidas sem copiar credenciais ou conteúdo sensível.
app.use("/api", (req, res, next) => {
  if (!["POST", "PATCH", "PUT", "DELETE"].includes(req.method) || req.path.startsWith("/auth/")) return next();
  // Calculado antes do "finish": ao fim da resposta o Express restaura req.path para o caminho completo (/api/...).
  const parts = String(req.originalUrl || req.path).split("?")[0].split("/").filter(Boolean).filter((part, index) => !(index === 0 && part === "api"));
  const entityType = parts[0] || "api", entityId = /^\d+$/.test(parts[1] || "") ? parts[1] : null;
  res.on("finish", () => {
    if (res.statusCode < 200 || res.statusCode >= 300 || !req.user) return;
    const redactAudit = (value) => Array.isArray(value) ? value.map(redactAudit) : value && typeof value === "object" ? Object.fromEntries(Object.entries(value).filter(([key]) => !/(password|token|secret|api.?key|credential)/i.test(key)).map(([key, item]) => [key, redactAudit(item)])) : typeof value === "string" ? value.slice(0, 500) : value;
    const changes = redactAudit(req.body || {});
    pool.query("insert into audit_events (organization_id,actor_id,action,entity_type,entity_id,changes,ip_address,user_agent) values ($1,$2,$3,$4,$5,$6,$7,$8)", [req.user.organization_id, req.user.id, req.method.toLowerCase(), entityType, entityId, JSON.stringify(changes), req.ip || null, req.get("user-agent") || null]).catch(() => {});
  });
  next();
});
app.post("/api/briefings/:id/public-link", async (req, res) => { const org = tenant(req, res); if (!org) return; try { const token = crypto.randomBytes(32).toString("base64url"); const q = await pool.query("update briefings set public_token=$1,status='published',updated_at=now() where id=$2 and organization_id=$3 returning id,name,status", [token, req.params.id, org]); if (!q.rowCount) return res.status(404).json({ error: "Briefing não encontrado." }); res.status(201).json({ briefing: q.rows[0], token, path: `/briefing/${token}` }); } catch { res.status(503).json({ error: "Não foi possível gerar o link do briefing." }); } });
app.get("/api/activity", async (req, res) => {
  const org = tenant(req, res); if (!org) return;
  const limit = Math.min(Math.max(Number(req.query.limit) || 30, 1), 100);
  try {
    const q = await pool.query("select a.id,a.action,a.entity_type,a.entity_id,a.changes,a.created_at,u.name as actor_name from audit_events a left join users u on u.id=a.actor_id and u.organization_id=a.organization_id where a.organization_id=$1 order by a.created_at desc limit $2", [org, limit]);
    res.json({ activities: q.rows });
  } catch { res.status(503).json({ error: "Não foi possível carregar o histórico de atividades." }); }
});
const entities = {
  contacts: { fields: ["name", "email", "phone", "role", "notes", "department", "document", "birth_date", "city", "state", "preferred_channel", "contact_type", "source", "owner", "tags", "is_primary", "company_id"], required: ["name"] }, companies: { fields: ["name", "document", "email", "phone", "website", "address", "legal_name", "trade_name", "state_registration", "municipal_registration", "status", "founded_on", "size", "segment", "primary_activity", "whatsapp", "zip_code", "street", "street_number", "city", "state", "country", "internal_owner", "source", "last_cnpj_lookup_at"], required: ["name"] },
  leads: { fields: ["name", "company", "company_id", "contact_id", "email", "phone", "source", "status", "notes", "value", "campaign_id", "owner_id", "tags"], required: ["name"] }, opportunities: { fields: ["name", "lead_id", "company_id", "contact_id", "stage", "amount", "expected_close", "notes", "probability", "owner_id", "tags"], required: ["name"] },
  clients: { fields: ["name", "company_id", "contact_id", "email", "phone", "status", "legal_name", "trade_name", "person_type", "avatar_url", "document", "founded_on", "source", "responsible_name", "responsible_role", "whatsapp", "secondary_phone", "website", "instagram", "linkedin", "contact_hours", "preferred_channel", "zip_code", "street", "street_number", "complement", "neighborhood", "city", "state", "country", "segment", "company_size", "services_interest", "main_need", "estimated_budget", "urgency", "sales_owner", "funnel_stage", "lead_temperature", "closing_probability", "first_contact_at", "last_contact_at", "next_contact_at", "next_action", "commercial_notes", "default_payment_terms", "preferred_payment_method", "monthly_fee", "due_day", "financial_status", "pix_key", "invoice_data", "internal_notes"], required: ["name"] }, contracts: { fields: ["name", "client_id", "opportunity_id", "status", "value", "starts_on", "ends_on"], required: ["name", "client_id"] },
  projects: { fields: ["name", "contract_id", "client_id", "status", "progress"], required: ["name"] }, tasks: { fields: ["title", "project_id", "status", "priority", "due_at", "tags", "parent_id", "description", "client_id", "stage", "assignee", "assignee_id", "assigned_at", "participants", "starts_at", "category", "estimated_minutes", "worked_minutes", "hourly_cost", "checklist", "recurrence", "recurrence_until", "blocked_reason", "internal_notes"], required: ["title"] },
  revenues: { fields: ["description", "contract_id", "project_id", "amount", "gross_amount", "discount", "fees", "tax_estimate", "net_amount", "category", "payment_method", "account_name", "document_number", "receipt_url", "status", "due_at", "paid_at"], required: ["description", "amount"] }, expenses: { fields: ["description", "project_id", "client_id", "amount", "supplier", "category", "payment_method", "account_name", "recurrence", "cost_center", "status", "due_at", "paid_at"], required: ["description", "amount"] },
  receivables: { fields: ["description", "client_id", "contract_id", "proposal_id", "project_id", "amount", "original_amount", "discount", "interest", "fine", "updated_amount", "installment_number", "payment_method", "responsible", "due_at", "status", "paid_at"], required: ["description", "amount", "due_at"] }, charges: { fields: ["receivable_id", "client_id", "project_id", "provider", "external_id", "channel", "payment_url", "message", "status", "amount", "due_at"], required: ["amount"] }, payments: { fields: ["receivable_id", "charge_id", "amount", "paid_at", "method", "external_id"], required: ["amount"] },
  approvals: { fields: ["target_type", "target_id", "title", "client_id", "project_id", "status", "requested_at", "decided_at", "decision", "comment"], required: ["target_type", "title"] },
  briefings: { fields: ["name", "client_id", "project_id", "status", "questions", "responses", "public_token", "approved_at"], required: ["name"] },
  change_requests: { fields: ["project_id", "client_id", "title", "description", "status", "impact_days", "additional_cost", "approval_data"], required: ["title"] },
  deliveries: { fields: ["project_id", "version", "environment", "published_at", "responsible", "checklist", "backup_done", "tests", "published_url", "status", "client_approved"], required: ["version"] },
  infrastructure_assets: { fields: ["client_id", "project_id", "kind", "name", "provider", "expires_on", "cost", "client_price", "responsible", "status"], required: ["kind", "name"] },
  knowledge_articles: { fields: ["title", "body", "category", "visibility", "status", "created_by"], required: ["title"] },
  forms: { fields: ["name", "kind", "schema", "automation_config", "status", "public_token"], required: ["name", "kind"] },
  payables: { fields: ["description", "supplier", "project_id", "client_id", "amount", "due_at", "paid_at", "status", "recurrence", "proof_url", "approved_by"], required: ["description", "amount"] },
  bank_accounts: { fields: ["name", "kind", "opening_balance", "current_balance", "status"], required: ["name"] },
  invoices: { fields: ["number", "client_id", "project_id", "amount", "issued_on", "status", "pdf_url", "xml_url", "error"], required: ["amount"] },
  audit_events: { fields: ["actor_id", "action", "entity_type", "entity_id", "changes", "ip_address", "user_agent"], required: ["action", "entity_type"] },
  trash: { fields: ["entity_type", "entity_id", "payload", "deleted_by", "restore_until"], required: ["entity_type", "entity_id"] },
  team_goals: { fields: ["user_id", "name", "category", "period_start", "period_end", "target", "current_value", "notes"], required: ["name"] },
  absences: { fields: ["user_id", "kind", "starts_on", "ends_on", "notes", "status"], required: ["user_id", "kind", "starts_on", "ends_on"] },
  team_roles: { fields: ["name", "department", "permissions", "hidden_fields"], required: ["name"] },
  time_entries: { fields: ["user_id", "project_id", "task_id", "started_at", "ended_at", "minutes", "billable", "status", "notes"], required: ["user_id"] },
  team_messages: { fields: ["sender_id", "project_id", "body", "important", "read_by"], required: ["body"] }
  , project_members: { fields: ["project_id", "user_id", "access_level", "files_visible", "tasks_visible", "added_at"], required: ["project_id", "user_id"] }, commissions: { fields: ["project_id", "user_id", "responsible", "description", "base_amount", "rate", "amount", "status"], required: ["description", "amount"] }
};
const archiveSpecs = { proposals: { fields: ["opportunity_id", "lead_id", "title", "amount", "status", "valid_until", "notes", "sent_at", "decided_at", "client_id", "contact_id", "project_id", "sales_owner", "issued_on", "presentation", "identified_need", "objective", "proposed_solution", "benefits", "differentiators", "service_type", "scope_included", "modules", "integrations", "technologies", "revisions_included", "responsibilities_provider", "responsibilities_client", "scope_excluded", "optional_services", "discount", "additional_fees", "final_amount", "down_payment", "balance_remaining", "installments", "installment_amount", "payment_method", "payment_due_dates", "late_fee", "late_interest", "recurring_costs", "proposal_terms", "approver_name", "approver_document", "approver_email", "approved_at", "acceptance_comment", "acceptance_ip", "accepted_terms"] }, campaigns: { fields: ["name", "channel", "status", "budget", "starts_on", "ends_on"] }, followups: { fields: ["lead_id", "due_at", "channel", "note", "done_at"] } };
const permissionDomains = { contacts: "crm", companies: "crm", clients: "crm", leads: "crm", opportunities: "crm", projects: "operation", tasks: "operation", contracts: "operation", briefings: "operation", deliveries: "operation", infrastructure_assets: "operation", knowledge_articles: "operation", forms: "operation", revenues: "finance", expenses: "finance", receivables: "finance", charges: "finance", payments: "finance", payables: "finance", bank_accounts: "finance", invoices: "finance", team_roles: "team", team_goals: "team", absences: "team", time_entries: "team", team_messages: "team", project_members: "team", catalog_items: "catalog", automations: "integrations", templates: "integrations", integrations: "integrations", conversations: "conversations" };
archiveSpecs.vault = { fields: ["client_id", "project_id", "name", "service", "expires_on", "secret_ciphertext", "secret_iv", "secret_tag", "created_by"] };
permissionDomains.vault = "operation";
const permissionAction = (method) => ({ GET: "view", POST: "create", PATCH: "edit", PUT: "edit", DELETE: "delete" }[method]);
permissionDomains.events = "operation";
permissionDomains.commissions = "finance";
const permissionAllows = (permissions, domain, table, action) => {
  if (!permissions || typeof permissions !== "object") return true;
  for (const value of [permissions[table], permissions[domain], permissions[`${domain}.${action}`], permissions[`${table}.${action}`]]) {
    if (Array.isArray(value)) return value.includes(action) || value.includes("admin") || value.includes("administrate");
    if (typeof value === "boolean") return value;
    if (value && typeof value === "object" && Object.prototype.hasOwnProperty.call(value, action)) return Boolean(value[action]);
  }
  return true;
};
app.use("/api", (req, res, next) => {
  const [, table] = req.path.split("/");
  if (!["POST", "PATCH"].includes(req.method) || table !== "invoices") return next();
  for (const field of ["pdf_url", "xml_url"]) {
    const value = String(req.body?.[field] ?? "").trim();
    if (!value) continue;
    try {
      if (!["http:", "https:"].includes(new URL(value).protocol)) return res.status(400).json({ error: `${field} must use http or https.` });
    } catch { return res.status(400).json({ error: `${field} must be a valid URL.` }); }
  }
  return next();
});
app.use("/api", async (req, res, next) => {
  const [, table] = req.path.split("/"), domain = permissionDomains[table], action = permissionAction(req.method);
  if (!domain || !action || !req.user || ["owner", "admin"].includes(req.user.role)) return next();
  if (["team_roles", "audit_events", "trash"].includes(table)) return res.status(403).json({ error: "Apenas proprietários e administradores acessam este módulo." });
  try {
    const q = await pool.query("select tr.permissions from users u left join team_roles tr on tr.id=u.team_role_id and tr.organization_id=u.organization_id where u.id=$1 and u.organization_id=$2", [req.user.id, req.user.organization_id]);
    if (!permissionAllows(q.rows[0]?.permissions, domain, table, action)) return res.status(403).json({ error: "Seu cargo não permite esta ação." });
    return next();
  } catch { return res.status(503).json({ error: "Não foi possível validar as permissões." }); }
});
const normalize = (table, body) => { const spec = entities[table]; const values = {}; for (const key of spec.fields) if (body?.[key] !== undefined) values[key] = body[key]; for (const key of ["email", "document", "phone"]) if (values[key] !== undefined) values[key] = normalizeIdentity(key, values[key]); if (["tasks", "leads", "opportunities"].includes(table) && typeof values.tags === "string") values.tags = values.tags.split(",").map(asText).filter(Boolean).slice(0, 8); if (!["amount", "value"].every((k) => values[k] === undefined || isValidAmount(table, k, values[k]))) throw new Error("amount must be a positive number"); return values; };
const relations = { company_id: "companies", contact_id: "contacts", lead_id: "leads", opportunity_id: "opportunities", client_id: "clients", contract_id: "contracts", project_id: "projects", parent_id: "tasks", receivable_id: "receivables", charge_id: "charges", owner_id: "users", assignee_id: "users", user_id: "users" };
async function validateRelations(values, org) { for (const [field, table] of Object.entries(relations)) { if (values[field] === undefined || values[field] === null || values[field] === "") continue; const result = await pool.query(`select 1 from ${table} where id=$1 and organization_id=$2`, [values[field], org]); if (!result.rowCount) { const error = new Error(`${field} does not belong to this organization.`); error.code = "invalid_relation"; throw error; } } }
const createCrud = (table) => {
  const route = `/api/${table}`; app.post(route, async (req, res) => { const org = tenant(req, res); if (!org) return; let values; try { values = normalize(table, req.body); await validateRelations(values, org); } catch (e) { if (e.code === "invalid_relation" || e.message === "amount must be a positive number") return res.status(400).json({ error: e.message }); return res.status(503).json({ error: "Não foi possível validar o registro." }); } const missing = entities[table].required.find((k) => values[k] === undefined || values[k] === ""); if (missing) return res.status(400).json({ error: `${missing} is required.` }); const keys = Object.keys(values), cols = ["organization_id", ...keys], params = [org, ...keys.map((k) => values[k])], marks = cols.map((_, i) => `$${i + 1}`); try { const q = await pool.query(`insert into ${table} (${cols.join(",")}) values (${marks.join(",")}) returning *`, params); res.status(201).json({ [singular(table)]: q.rows[0] }); } catch (e) { const { status, error } = classifyDbError(e, "Não foi possível criar o registro."); res.status(status).json({ error }); } });
  app.get(route, async (req, res) => { const org = tenant(req, res); if (!org) return; try { const q = await pool.query(`select * from ${table} where organization_id=$1 order by created_at desc`, [org]); res.json({ [table]: q.rows }); } catch { res.status(503).json({ error: "Não foi possível carregar os registros." }); } });
  app.delete(`${route}/:id`, async (req, res) => { const org = tenant(req, res); if (!org) return; try { const q = await pool.query(`delete from ${table} where id=$1 and organization_id=$2 returning id`, [req.params.id, org]); if (!q.rowCount) return res.status(404).json({ error: "Registro não encontrado." }); res.status(204).end(); } catch { res.status(503).json({ error: "Não foi possível excluir o registro." }); } });
  app.patch(`${route}/:id`, async (req, res) => { const org = tenant(req, res); if (!org) return; let values; try { values = normalize(table, req.body); await validateRelations(values, org); } catch (e) { if (e.code === "invalid_relation" || e.message === "amount must be a positive number") return res.status(400).json({ error: e.message }); return res.status(503).json({ error: "Não foi possível validar o registro." }); } const keys = Object.keys(values); if (!keys.length) return res.status(400).json({ error: "Nenhum campo válido informado." }); try { const setClause = [...keys.map((k, i) => `${k}=$${i + 1}`), ...(TABLES_WITH_UPDATED_AT.has(table) ? ["updated_at=now()"] : [])].join(","); const q = await pool.query(`update ${table} set ${setClause} where id=$${keys.length + 1} and organization_id=$${keys.length + 2} returning *`, [...keys.map((k) => values[k]), req.params.id, org]); if (!q.rowCount) return res.status(404).json({ error: "Registro não encontrado." }); if (table === "opportunities" && ["won", "lost"].includes(values.stage) && q.rows[0].lead_id) await pool.query("update leads set status=$1, updated_at=now() where id=$2 and organization_id=$3", [values.stage, q.rows[0].lead_id, org]).catch(() => {}); res.json({ [singular(table)]: q.rows[0] }); } catch (e) { const { status, error } = classifyDbError(e, "Não foi possível atualizar o registro."); res.status(status).json({ error }); } });
};
// A auditoria é somente leitura para o cliente; os registros devem ser criados pelo servidor.
app.use("/api/audit_events", (req, res, next) => req.method === "GET" ? next() : res.status(405).json({ error: "A auditoria é somente leitura." }));
app.get("/api/audit_events", async (req, res) => {
  const org = tenant(req, res); if (!org) return;
  const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 250);
  const values = [org], where = ["a.organization_id=$1"];
  const add = (sql, value) => { values.push(value); where.push(sql.replace("$VALUE", `$${values.length}`)); };
  if (req.query.action) add("a.action=$VALUE", String(req.query.action).slice(0, 80));
  if (req.query.entity_type) add("a.entity_type=$VALUE", String(req.query.entity_type).slice(0, 80));
  if (req.query.actor_id && UUID.test(String(req.query.actor_id))) add("a.actor_id=$VALUE", String(req.query.actor_id));
  if (req.query.from && !Number.isNaN(Date.parse(String(req.query.from)))) add("a.created_at >= $VALUE::timestamptz", String(req.query.from));
  if (req.query.to && !Number.isNaN(Date.parse(String(req.query.to)))) add("a.created_at < ($VALUE::date + interval '1 day')", String(req.query.to));
  if (req.query.search) { values.push(`%${String(req.query.search).slice(0, 100)}%`); const index = values.length; where.push(`(a.action ilike $${index} or a.entity_type ilike $${index} or coalesce(u.name,'') ilike $${index})`); }
  const offset = Math.max(Number(req.query.offset) || 0, 0);
  values.push(limit, offset);
  try {
    const q = await pool.query(`select a.id,a.action,a.entity_type,a.entity_id,a.changes,a.ip_address,a.user_agent,a.created_at,u.name as actor_name from audit_events a left join users u on u.id=a.actor_id and u.organization_id=a.organization_id where ${where.join(" and ")} order by a.created_at desc limit $${values.length - 1} offset $${values.length}`, values);
    res.json({ audit_events: q.rows, pagination: { limit, offset, returned: q.rows.length } });
  } catch { res.status(503).json({ error: "Não foi possível carregar a auditoria." }); }
});
app.use("/api", async (req, res, next) => {
  const [, table] = req.path.split("/");
  if (req.method !== "POST" || !["contacts", "companies", "clients", "leads"].includes(table)) return next();
  const fields = table === "leads" ? ["email", "phone"] : ["document", "email", "phone"], values = fields.map((key) => normalizeIdentity(key, req.body?.[key]));
  if (!values.some(Boolean)) return next();
  const conditions = fields.map((key, index) => `${key}=$${index + 2}`).join(" or ");
  try {
    const q = await pool.query(`select id from ${table} where organization_id=$1 and (${conditions}) limit 1`, [req.user.organization_id, ...values.map((value) => value || null)]);
    if (q.rowCount) return res.status(409).json({ error: "Já existe um cadastro com este e-mail, telefone ou documento." });
    return next();
  } catch { return res.status(503).json({ error: "Não foi possível validar duplicidade." }); }
});
app.use("/api", async (req, res, next) => {
  if (!req.user || ["owner", "admin"].includes(req.user.role)) return next();
  try {
    const q = await pool.query("select tr.hidden_fields from users u left join team_roles tr on tr.id=u.team_role_id and tr.organization_id=u.organization_id where u.id=$1 and u.organization_id=$2", [req.user.id, req.user.organization_id]);
    const hidden = Array.isArray(q.rows[0]?.hidden_fields) ? new Set(q.rows[0].hidden_fields.map(String)) : new Set();
    if (!hidden.size) return next();
    const redact = (value) => Array.isArray(value) ? value.map(redact) : value && typeof value === "object" ? Object.fromEntries(Object.entries(value).filter(([key]) => !hidden.has(key)).map(([key, item]) => [key, redact(item)])) : value;
    const sendJson = res.json.bind(res); res.json = (payload) => sendJson(redact(payload));
    return next();
  } catch { return res.status(503).json({ error: "Não foi possível aplicar a visibilidade do cargo." }); }
});
app.use("/api", (req, res, next) => {
  if (!["POST", "PATCH"].includes(req.method)) return next();
  const [, table] = req.path.split("/");
  if (!["contacts", "companies", "clients"].includes(table)) return next();
  const email = normalizeIdentity("email", req.body?.email);
  if (email && !/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ error: "email is invalid." });
  const document = normalizeIdentity("document", req.body?.document);
  if (document && ((table === "companies" && document.length !== 14) || (table === "clients" && ![11, 14].includes(document.length)))) return res.status(400).json({ error: "document is invalid." });
  if (table === "clients" && req.body?.status !== undefined && !["lead", "prospecting", "active", "inactive", "blocked", "churned", "onboarding", "maintenance", "delinquent", "closed"].includes(String(req.body.status))) return res.status(400).json({ error: "status is invalid." });
  return next();
});
/* Antes de qualquer exclusão de entidade, guarda uma cópia recuperável na lixeira. */
app.use("/api", async (req, res, next) => {
  if (req.method !== "DELETE") return next();
  const [, table, id] = req.path.split("/");
  if (!(entities[table] || archiveSpecs[table]) || !/^\d+$/.test(id || "") || ["audit_events", "trash"].includes(table)) return next();
  const org = tenant(req, res); if (!org) return;
  try {
    const found = await pool.query(`select * from ${table} where id=$1 and organization_id=$2`, [id, org]);
    if (!found.rowCount) return res.status(404).json({ error: "Registro não encontrado." });
    const payload = { ...found.rows[0] };
    if (table === "proposals") payload.proposal_items = (await pool.query("select * from proposal_items where proposal_id=$1 and organization_id=$2 order by position,id", [id, org])).rows;
    await pool.query("insert into trash (organization_id,entity_type,entity_id,payload,deleted_by,restore_until) values ($1,$2,$3,$4,$5,now()+interval '30 days')", [org, table, id, JSON.stringify(payload), req.user?.id || null]);
    return next();
  } catch { return res.status(503).json({ error: "Não foi possível preparar a exclusão recuperável." }); }
});
const refreshProjectProgress = async (projectId, org) => {
  if (!projectId || !org) return;
  const totals = await pool.query("select count(*)::int total,count(*) filter (where status='done')::int completed from tasks where project_id=$1 and organization_id=$2", [projectId, org]);
  const total = Number(totals.rows[0]?.total || 0), completed = Number(totals.rows[0]?.completed || 0), progress = total ? Math.round((completed / total) * 100) : 0;
  await pool.query("update projects set progress=$1,updated_at=now() where id=$2 and organization_id=$3", [progress, projectId, org]);
};
app.use("/api/tasks", async (req, res, next) => {
  const org = tenant(req, res); if (!org) return;
  const projectIds = new Set();
  if (req.body?.project_id) projectIds.add(String(req.body.project_id));
  const taskId = req.path.split("/").filter(Boolean)[0];
  if (["PATCH", "DELETE"].includes(req.method) && /^\d+$/.test(taskId || "")) {
    const existing = await pool.query("select project_id from tasks where id=$1 and organization_id=$2", [taskId, org]).catch(() => ({ rows: [] }));
    if (existing.rows[0]?.project_id) projectIds.add(String(existing.rows[0].project_id));
  }
  res.on("finish", () => { if (res.statusCode >= 200 && res.statusCode < 300) for (const projectId of projectIds) refreshProjectProgress(projectId, org).catch(() => {}); });
  return next();
});
registerDomainRoutes(app, { pool, tenant, requireAuth, asText, classifyDbError, singular, validateRelations, normalize, entities, hashPassword, verifyPassword, signSession, sessionCookie });
registerEventRoutes(app, { pool, tenant, classifyDbError, validateRelations });
app.get("/api/tasks", async (req, res) => {
  const org = tenant(req, res); if (!org) return;
  const values = [org], where = ["t.organization_id=$1"];
  const add = (sql, value) => { values.push(value); where.push(sql.replace("$VALUE", `$${values.length}`)); };
  const search = String(req.query?.search || "").trim(); if (search) { values.push(search); const param = `$${values.length}`; where.push(`(t.title ilike '%' || ${param} || '%' or coalesce(t.description,'') ilike '%' || ${param} || '%' or array_to_string(t.tags,' ') ilike '%' || ${param} || '%' or coalesce(p.name,'') ilike '%' || ${param} || '%')`); }
  if (req.query?.status === "open") where.push("t.status <> 'done'"); else if (req.query?.status) add("t.status=$VALUE", String(req.query.status));
  for (const field of ["priority", "project_id", "client_id", "assignee_id"]) if (req.query?.[field]) add(`t.${field}=$VALUE`, String(req.query[field]));
  const limit = Math.min(Math.max(Number.parseInt(req.query?.limit, 10) || 250, 1), 250), offset = Math.max(Number.parseInt(req.query?.offset, 10) || 0, 0); values.push(limit, offset);
  try { const q = await pool.query(`select t.* from tasks t left join projects p on p.id=t.project_id and p.organization_id=t.organization_id where ${where.join(" and ")} order by t.due_at asc nulls last,t.created_at desc limit $${values.length - 1} offset $${values.length}`, values); res.json({ tasks: q.rows, pagination: { limit, offset, returned: q.rows.length } }); } catch { res.status(503).json({ error: "Não foi possível carregar as tarefas." }); }
});
for (const table of ["revenues", "expenses", "receivables"]) app.get(`/api/${table}`, async (req, res) => {
  const org = tenant(req, res); if (!org) return;
  const values = [org], where = [`${table}.organization_id=$1`];
  const add = (sql, value) => { values.push(value); where.push(sql.replace("$VALUE", `$${values.length}`)); };
  const search = String(req.query?.search || "").trim(); if (search) { values.push(search); const param = `$${values.length}`; where.push(`(${table}.description ilike '%' || ${param} || '%' or coalesce(${table}.category,'') ilike '%' || ${param} || '%')`); }
  if (req.query?.status) add(`${table}.status=$VALUE`, String(req.query.status));
  for (const field of ["client_id", "project_id", "contract_id"]) if (req.query?.[field]) add(`${table}.${field}=$VALUE`, String(req.query[field]));
  const limit = Math.min(Math.max(Number.parseInt(req.query?.limit, 10) || 250, 1), 250), offset = Math.max(Number.parseInt(req.query?.offset, 10) || 0, 0); values.push(limit, offset);
  try { const q = await pool.query(`select * from ${table} where ${where.join(" and ")} order by coalesce(due_at,paid_at,created_at) desc limit $${values.length - 1} offset $${values.length}`, values); res.json({ [table]: q.rows, pagination: { limit, offset, returned: q.rows.length } }); } catch { res.status(503).json({ error: "Não foi possível carregar os registros financeiros." }); }
});
app.get("/api/files", async (req, res) => {
  const org = tenant(req, res); if (!org) return;
  const values = [org], where = ["f.organization_id=$1"];
  const search = String(req.query?.search || "").trim(); if (search) { values.push(search); const p = `$${values.length}`; where.push(`(f.name ilike '%' || ${p} || '%' or coalesce(f.description,'') ilike '%' || ${p} || '%' or coalesce(p.name,'') ilike '%' || ${p} || '%' or coalesce(c.name,'') ilike '%' || ${p} || '%')`); }
  for (const field of ["project_id", "client_id", "kind"]) if (req.query?.[field]) { values.push(String(req.query[field])); where.push(`f.${field}=$${values.length}`); }
  const limit = Math.min(Math.max(Number.parseInt(req.query?.limit, 10) || 250, 1), 250), offset = Math.max(Number.parseInt(req.query?.offset, 10) || 0, 0); values.push(limit, offset);
  try { const q = await pool.query(`select f.*,p.name project_name,c.name client_name from files f left join projects p on p.id=f.project_id and p.organization_id=f.organization_id left join clients c on c.id=f.client_id and c.organization_id=f.organization_id where ${where.join(" and ")} order by f.created_at desc limit $${values.length - 1} offset $${values.length}`, values); res.json({ files: q.rows, pagination: { limit, offset, returned: q.rows.length } }); } catch { res.status(503).json({ error: "Nao foi possivel carregar os arquivos." }); }
});
app.get("/api/tickets", async (req, res) => {
  const org = tenant(req, res); if (!org) return;
  const values = [org], where = ["t.organization_id=$1"], search = String(req.query?.search || "").trim();
  if (search) { values.push(search); const p = `$${values.length}`; where.push(`(t.title ilike '%' || ${p} || '%' or coalesce(t.description,'') ilike '%' || ${p} || '%' or coalesce(c.name,'') ilike '%' || ${p} || '%' or coalesce(pr.name,'') ilike '%' || ${p} || '%')`); }
  for (const field of ["status", "priority", "client_id", "project_id", "assignee_id"]) if (req.query?.[field]) { values.push(String(req.query[field])); where.push(`t.${field}=$${values.length}`); }
  const limit = Math.min(Math.max(Number.parseInt(req.query?.limit, 10) || 250, 1), 250), offset = Math.max(Number.parseInt(req.query?.offset, 10) || 0, 0); values.push(limit, offset);
  try { const q = await pool.query(`select t.*,c.name client_name,pr.name project_name from tickets t left join clients c on c.id=t.client_id and c.organization_id=t.organization_id left join projects pr on pr.id=t.project_id and pr.organization_id=t.organization_id where ${where.join(" and ")} order by t.created_at desc limit $${values.length - 1} offset $${values.length}`, values); res.json({ tickets: q.rows, pagination: { limit, offset, returned: q.rows.length } }); } catch { res.status(503).json({ error: "Nao foi possivel carregar os tickets." }); }
});
app.get("/api/charges", async (req, res) => {
  const org = tenant(req, res); if (!org) return;
  const values = [org], where = ["ch.organization_id=$1"], search = String(req.query?.search || "").trim();
  if (search) { values.push(search); const p = `$${values.length}`; where.push(`(coalesce(ch.message,'') ilike '%' || ${p} || '%' or coalesce(c.name,'') ilike '%' || ${p} || '%' or coalesce(r.description,'') ilike '%' || ${p} || '%')`); }
  for (const field of ["status", "channel", "client_id", "project_id", "receivable_id"]) if (req.query?.[field]) { values.push(String(req.query[field])); where.push(`ch.${field}=$${values.length}`); }
  const limit = Math.min(Math.max(Number.parseInt(req.query?.limit, 10) || 250, 1), 250), offset = Math.max(Number.parseInt(req.query?.offset, 10) || 0, 0); values.push(limit, offset);
  try { const q = await pool.query(`select ch.*,c.name client_name,r.description receivable_description from charges ch left join clients c on c.id=ch.client_id and c.organization_id=ch.organization_id left join receivables r on r.id=ch.receivable_id and r.organization_id=ch.organization_id where ${where.join(" and ")} order by ch.created_at desc limit $${values.length - 1} offset $${values.length}`, values); res.json({ charges: q.rows, pagination: { limit, offset, returned: q.rows.length } }); } catch { res.status(503).json({ error: "Nao foi possivel carregar as cobrancas." }); }
});
app.get("/api/invoices", async (req, res) => {
  const org = tenant(req, res); if (!org) return;
  const values = [org], where = ["i.organization_id=$1"], search = String(req.query?.search || "").trim();
  if (search) { values.push(search); const p = `$${values.length}`; where.push(`(coalesce(i.number,'') ilike '%' || ${p} || '%' or coalesce(c.name,'') ilike '%' || ${p} || '%')`); }
  for (const field of ["status", "client_id", "project_id"]) if (req.query?.[field]) { values.push(String(req.query[field])); where.push(`i.${field}=$${values.length}`); }
  const limit = Math.min(Math.max(Number.parseInt(req.query?.limit, 10) || 250, 1), 250), offset = Math.max(Number.parseInt(req.query?.offset, 10) || 0, 0); values.push(limit, offset);
  try { const q = await pool.query(`select i.*,c.name client_name from invoices i left join clients c on c.id=i.client_id and c.organization_id=i.organization_id where ${where.join(" and ")} order by i.created_at desc limit $${values.length - 1} offset $${values.length}`, values); res.json({ invoices: q.rows, pagination: { limit, offset, returned: q.rows.length } }); } catch { res.status(503).json({ error: "Nao foi possivel carregar as notas fiscais." }); }
});
app.get("/api/briefings", async (req, res) => {
  const org = tenant(req, res); if (!org) return;
  const values = [org], where = ["b.organization_id=$1"], search = String(req.query?.search || "").trim();
  if (search) { values.push(search); const p = `$${values.length}`; where.push(`(b.name ilike '%' || ${p} || '%' or coalesce(c.name,'') ilike '%' || ${p} || '%' or coalesce(p.name,'') ilike '%' || ${p} || '%')`); }
  for (const field of ["status", "client_id", "project_id"]) if (req.query?.[field]) { values.push(String(req.query[field])); where.push(`b.${field}=$${values.length}`); }
  const limit = Math.min(Math.max(Number.parseInt(req.query?.limit, 10) || 250, 1), 250), offset = Math.max(Number.parseInt(req.query?.offset, 10) || 0, 0); values.push(limit, offset);
  try { const q = await pool.query(`select b.*,c.name client_name,p.name project_name from briefings b left join clients c on c.id=b.client_id and c.organization_id=b.organization_id left join projects p on p.id=b.project_id and p.organization_id=b.organization_id where ${where.join(" and ")} order by b.created_at desc limit $${values.length - 1} offset $${values.length}`, values); res.json({ briefings: q.rows, pagination: { limit, offset, returned: q.rows.length } }); } catch { res.status(503).json({ error: "Nao foi possivel carregar os briefings." }); }
});
app.get("/api/forms", async (req, res) => {
  const org = tenant(req, res); if (!org) return;
  try { await ensureStarterLibrary(pool, org); } catch { return res.status(503).json({ error: "Nao foi possivel preparar a biblioteca inicial." }); }
  const values = [org], where = ["f.organization_id=$1"], search = String(req.query?.search || "").trim();
  if (search) { values.push(search); const p = `$${values.length}`; where.push(`(f.name ilike '%' || ${p} || '%' or coalesce(f.kind,'') ilike '%' || ${p} || '%')`); }
  for (const field of ["status", "kind"]) if (req.query?.[field]) { values.push(String(req.query[field])); where.push(`f.${field}=$${values.length}`); }
  const limit = Math.min(Math.max(Number.parseInt(req.query?.limit, 10) || 250, 1), 250), offset = Math.max(Number.parseInt(req.query?.offset, 10) || 0, 0); values.push(limit, offset);
  try { const q = await pool.query(`select f.id,f.organization_id,f.name,f.kind,f.schema,f.automation_config,f.status,f.public_token,f.created_at,f.updated_at,f.submitted_at from forms f where ${where.join(" and ")} order by f.created_at desc limit $${values.length - 1} offset $${values.length}`, values); res.json({ forms: q.rows, pagination: { limit, offset, returned: q.rows.length } }); } catch { res.status(503).json({ error: "Nao foi possivel carregar os formularios." }); }
});
app.get("/api/knowledge_articles", async (req, res) => {
  const org = tenant(req, res); if (!org) return;
  const values = [org], where = ["k.organization_id=$1"], search = String(req.query?.search || "").trim();
  if (search) { values.push(search); const p = `$${values.length}`; where.push(`(k.title ilike '%' || ${p} || '%' or coalesce(k.category,'') ilike '%' || ${p} || '%' or coalesce(k.body,'') ilike '%' || ${p} || '%')`); }
  for (const field of ["status", "category"]) if (req.query?.[field]) { values.push(String(req.query[field])); where.push(`k.${field}=$${values.length}`); }
  const limit = Math.min(Math.max(Number.parseInt(req.query?.limit, 10) || 250, 1), 250), offset = Math.max(Number.parseInt(req.query?.offset, 10) || 0, 0); values.push(limit, offset);
  try { const q = await pool.query(`select k.* from knowledge_articles k where ${where.join(" and ")} order by k.created_at desc limit $${values.length - 1} offset $${values.length}`, values); res.json({ knowledge_articles: q.rows, pagination: { limit, offset, returned: q.rows.length } }); } catch { res.status(503).json({ error: "Nao foi possivel carregar os artigos." }); }
});
app.get("/api/infrastructure_assets", async (req, res) => {
  const org = tenant(req, res); if (!org) return;
  const values = [org], where = ["i.organization_id=$1"], search = String(req.query?.search || "").trim();
  if (search) { values.push(search); const p = `$${values.length}`; where.push(`(i.name ilike '%' || ${p} || '%' or coalesce(i.kind,'') ilike '%' || ${p} || '%' or coalesce(i.provider,'') ilike '%' || ${p} || '%' or coalesce(c.name,'') ilike '%' || ${p} || '%' or coalesce(p.name,'') ilike '%' || ${p} || '%')`); }
  if (req.query?.kind) { values.push(String(req.query.kind)); where.push(`i.kind=$${values.length}`); }
  if (req.query?.status) { const status = String(req.query.status); if (status === "expired") where.push("i.expires_on < current_date"); else { values.push(status); where.push(`i.status=$${values.length}`); } }
  const limit = Math.min(Math.max(Number.parseInt(req.query?.limit, 10) || 250, 1), 250), offset = Math.max(Number.parseInt(req.query?.offset, 10) || 0, 0); values.push(limit, offset);
  try { const q = await pool.query(`select i.*,c.name as client_name,p.name as project_name from infrastructure_assets i left join clients c on c.id=i.client_id and c.organization_id=i.organization_id left join projects p on p.id=i.project_id and p.organization_id=i.organization_id where ${where.join(" and ")} order by i.expires_on nulls last,i.created_at desc limit $${values.length - 1} offset $${values.length}`, values); res.json({ infrastructure_assets: q.rows, pagination: { limit, offset, returned: q.rows.length } }); } catch { res.status(503).json({ error: "Não foi possível carregar a infraestrutura." }); }
});
const managementSearch = { team_goals: ["name", "category", "notes"], commissions: ["description", "responsible", "status"], absences: ["kind", "notes"], time_entries: ["notes"] };
Object.entries(managementSearch).forEach(([table, fields]) => app.get(`/api/${table}`, async (req, res) => {
  const org = tenant(req, res); if (!org) return;
  const values = [org], where = [`m.organization_id=$1`], search = String(req.query?.search || "").trim();
  if (search) { values.push(search); const p = `$${values.length}`; where.push(`(${fields.map((field) => `coalesce(cast(m.${field} as text),'') ilike '%' || ${p} || '%'`).join(" or ")})`); }
  if (req.query?.status) { values.push(String(req.query.status)); where.push(`m.status=$${values.length}`); }
  const limit = Math.min(Math.max(Number.parseInt(req.query?.limit, 10) || 250, 1), 250), offset = Math.max(Number.parseInt(req.query?.offset, 10) || 0, 0); values.push(limit, offset);
  try { const q = await pool.query(`select m.* from ${table} m where ${where.join(" and ")} order by m.created_at desc limit $${values.length - 1} offset $${values.length}`, values); res.json({ [table]: q.rows, pagination: { limit, offset, returned: q.rows.length } }); } catch { res.status(503).json({ error: "Não foi possível carregar os registros de gestão." }); }
}));
app.get("/api/payables", async (req, res) => {
  const org = tenant(req, res); if (!org) return;
  const values = [org], where = ["p.organization_id=$1"], search = String(req.query?.search || "").trim();
  if (search) { values.push(search); const q = `$${values.length}`; where.push(`(p.description ilike '%' || ${q} || '%' or coalesce(p.supplier,'') ilike '%' || ${q} || '%' or coalesce(c.name,'') ilike '%' || ${q} || '%' or coalesce(pr.name,'') ilike '%' || ${q} || '%')`); }
  for (const field of ["status", "client_id", "project_id"]) if (req.query?.[field]) { values.push(String(req.query[field])); where.push(`p.${field}=$${values.length}`); }
  const limit = Math.min(Math.max(Number.parseInt(req.query?.limit, 10) || 250, 1), 250), offset = Math.max(Number.parseInt(req.query?.offset, 10) || 0, 0); values.push(limit, offset);
  try { const q = await pool.query(`select p.*,c.name as client_name,pr.name as project_name from payables p left join clients c on c.id=p.client_id and c.organization_id=p.organization_id left join projects pr on pr.id=p.project_id and pr.organization_id=p.organization_id where ${where.join(" and ")} order by p.due_at nulls last,p.created_at desc limit $${values.length - 1} offset $${values.length}`, values); res.json({ payables: q.rows, pagination: { limit, offset, returned: q.rows.length } }); } catch { res.status(503).json({ error: "Não foi possível carregar as contas a pagar." }); }
});
app.get("/api/trash", async (req, res) => {
  const org = tenant(req, res); if (!org) return;
  const values = [org], where = ["t.organization_id=$1"], search = String(req.query?.search || "").trim();
  if (search) { values.push(search); const p = `$${values.length}`; where.push(`(t.entity_type ilike '%' || ${p} || '%' or cast(t.entity_id as text) ilike '%' || ${p} || '%' or coalesce(t.payload->>'name','') ilike '%' || ${p} || '%' or coalesce(t.payload->>'title','') ilike '%' || ${p} || '%')`); }
  if (req.query?.entity_type) { values.push(String(req.query.entity_type)); where.push(`t.entity_type=$${values.length}`); }
  if (req.query?.active === "true") where.push("(t.restore_until is null or t.restore_until > now())");
  const limit = Math.min(Math.max(Number.parseInt(req.query?.limit, 10) || 250, 1), 250), offset = Math.max(Number.parseInt(req.query?.offset, 10) || 0, 0); values.push(limit, offset);
  try { const q = await pool.query(`select t.id,t.entity_type,t.entity_id,t.deleted_by,t.restore_until,t.created_at,u.name as deleted_by_name from trash t left join users u on u.id=t.deleted_by and u.organization_id=t.organization_id where ${where.join(" and ")} order by t.created_at desc limit $${values.length - 1} offset $${values.length}`, values); res.json({ trash: q.rows, pagination: { limit, offset, returned: q.rows.length } }); } catch { res.status(503).json({ error: "Não foi possível carregar a lixeira." }); }
});
const genericListSearch = {
  approvals: ["title", "target_type", "status"], briefings: ["name", "status"],
  change_requests: ["title", "status"], deliveries: ["version", "environment", "status"],
  infrastructure_assets: ["name", "kind", "provider", "status"], knowledge_articles: ["title", "category", "status"],
  forms: ["name", "kind", "status"], payables: ["description", "supplier", "status"],
  bank_accounts: ["name", "kind", "status"], invoices: ["number", "status"],
  team_goals: ["name", "status"], commissions: ["description", "responsible", "status"],
  absences: ["kind", "status"], time_entries: ["notes", "status"],
};
app.get("/api/:table", async (req, res, next) => {
  const table = req.params.table, fields = genericListSearch[table];
  if (!fields) return next();
  const org = tenant(req, res); if (!org) return;
  const values = [org], where = ["organization_id=$1"], search = String(req.query.search || "").trim().slice(0, 100);
  if (search) { values.push(`%${search}%`); const p = `$${values.length}`; where.push(`(${fields.map((field) => `coalesce(${field}::text,'') ilike ${p}`).join(" or ")})`); }
  if (req.query.status && fields.includes("status")) { values.push(String(req.query.status).slice(0, 40)); where.push(`status=$${values.length}`); }
  const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 100, 1), 250), offset = Math.max(Number.parseInt(req.query.offset, 10) || 0, 0); values.push(limit, offset);
  try { const q = await pool.query(`select * from ${table} where ${where.join(" and ")} order by created_at desc limit $${values.length - 1} offset $${values.length}`, values); res.json({ [table]: q.rows, pagination: { limit, offset, returned: q.rows.length } }); } catch { res.status(503).json({ error: "Não foi possível carregar os registros." }); }
});
Object.keys(entities).forEach(createCrud);

app.post("/api/trash/:id/restore", async (req, res) => {
  const org = tenant(req, res); if (!org) return;
  if (!(["owner", "admin"].includes(req.user?.role))) return res.status(403).json({ error: "Apenas proprietários e administradores restauram registros." });
  const client = await pool.connect().catch(() => null); if (!client) return res.status(503).json({ error: "Serviço indisponível." });
  try {
    await client.query("begin");
    const deleted = await client.query("select * from trash where id=$1 and organization_id=$2 and (restore_until is null or restore_until > now()) for update", [req.params.id, org]);
    if (!deleted.rowCount) { await client.query("rollback"); return res.status(404).json({ error: "Registro não encontrado ou prazo de restauração encerrado." }); }
    const item = deleted.rows[0], table = item.entity_type, spec = entities[table] || archiveSpecs[table];
    if (!spec) { await client.query("rollback"); return res.status(400).json({ error: "Tipo de registro não restaurável." }); }
    const payload = typeof item.payload === "string" ? JSON.parse(item.payload) : item.payload || {};
    const keys = ["id", ...spec.fields, "created_at", "updated_at"].filter((key, index, all) => all.indexOf(key) === index && payload[key] !== undefined);
    const columns = ["organization_id", ...keys], values = [org, ...keys.map((key) => payload[key])];
    await client.query(`insert into ${table} (${columns.join(",")}) values (${columns.map((_, index) => `$${index + 1}`).join(",")})`, values);
    if (table === "proposals" && Array.isArray(payload.proposal_items)) for (const item of payload.proposal_items) await client.query("insert into proposal_items (id,organization_id,proposal_id,catalog_item_id,description,quantity,unit_price,position) values ($1,$2,$3,$4,$5,$6,$7,$8)", [item.id, org, payload.id, item.catalog_item_id || null, item.description, item.quantity, item.unit_price, item.position || 0]);
    await client.query("delete from trash where id=$1 and organization_id=$2", [req.params.id, org]);
    await client.query("commit");
    res.status(201).json({ ok: true, entity_type: table, entity_id: payload.id || null });
  } catch (error) { await client.query("rollback").catch(() => {}); const out = classifyDbError(error, "Não foi possível restaurar o registro."); res.status(out.status).json({ error: out.error }); }
  finally { client.release(); }
});


app.post("/api/events", async (req, res) => { const org = tenant(req, res); if (!org) return; const body = req.body || {}, title = asText(body.title), startsAt = body.startsAt; if (!title || !startsAt || Number.isNaN(Date.parse(startsAt))) return res.status(400).json({ error: "Informe título e horário válidos." }); const recurrence = ["none", "daily", "weekly", "monthly"].includes(body.recurrence) ? body.recurrence : "none"; const fields = ["title", "starts_at", "description", "recurrence", "reminder_minutes", "event_type", "status", "ends_at", "all_day", "client_id", "project_id", "contract_id", "location", "color", "participants", "meeting_notes", "reminder_channels", "recurrence_until"], values = [title, startsAt, asText(body.description) || null, recurrence, Math.max(0, Number(body.reminderMinutes) || 0), asText(body.event_type) || "other", asText(body.status) || "pending", body.endsAt || null, Boolean(body.all_day), body.client_id || null, body.project_id || null, body.contract_id || null, asText(body.location) || null, asText(body.color) || null, asText(body.participants) || null, asText(body.meeting_notes) || null, asText(body.reminder_channels) || null, body.recurrenceUntil || null]; try { const q = await pool.query(`insert into events (organization_id,${fields.join(",")}) values ($1,${fields.map((_, index) => `$${index + 2}`).join(",")}) returning *`, [org, ...values]); res.status(201).json({ event: q.rows[0] }); } catch (e) { const { status, error } = classifyDbError(e, "Não foi possível criar o evento."); res.status(status).json({ error }); } });
app.get("/api/events", async (req, res) => { const org = tenant(req, res); if (!org) return; try { const q = await pool.query("select * from events where organization_id=$1 order by starts_at", [org]); res.json({ events: expandRecurringEvents(q.rows) }); } catch { res.status(503).json({ error: "Não foi possível carregar os eventos." }); } });
app.patch("/api/events/:id", async (req, res) => { const org = tenant(req, res); if (!org) return; const body = req.body || {}, fields = {}, map = { startsAt: "starts_at", endsAt: "ends_at", allDay: "all_day", clientId: "client_id", projectId: "project_id", contractId: "contract_id", eventType: "event_type", reminderMinutes: "reminder_minutes", reminderChannels: "reminder_channels", recurrenceUntil: "recurrence_until", meetingNotes: "meeting_notes" }; for (const [input, column] of Object.entries(map)) if (body[input] !== undefined) fields[column] = input === "reminderMinutes" ? Math.max(0, Number(body[input]) || 0) : input === "allDay" ? Boolean(body[input]) : body[input]; if (body.title !== undefined) fields.title = asText(body.title); if (body.description !== undefined) fields.description = asText(body.description) || null; if (body.recurrence !== undefined) fields.recurrence = ["none", "daily", "weekly", "monthly"].includes(body.recurrence) ? body.recurrence : null; for (const key of ["location", "color", "participants", "status"]) if (body[key] !== undefined) fields[key] = asText(body[key]) || null; if (fields.title === "" || (fields.starts_at !== undefined && Number.isNaN(Date.parse(fields.starts_at))) || fields.recurrence === null) return res.status(400).json({ error: "Dados do evento inválidos." }); const keys = Object.keys(fields); if (!keys.length) return res.status(400).json({ error: "Nenhum campo válido informado." }); try { const q = await pool.query(`update events set ${keys.map((key, index) => `${key}=$${index + 1}`).join(",")} where id=$${keys.length + 1} and organization_id=$${keys.length + 2} returning *`, [...keys.map((key) => fields[key]), req.params.id, org]); if (!q.rowCount) return res.status(404).json({ error: "Evento não encontrado." }); res.json({ event: q.rows[0] }); } catch (e) { const { status, error } = classifyDbError(e, "Não foi possível atualizar o evento."); res.status(status).json({ error }); } });
app.delete("/api/events/:id", async (req, res) => { const org = tenant(req, res); if (!org) return; try { const q = await pool.query("delete from events where id=$1 and organization_id=$2 returning id", [req.params.id, org]); if (!q.rowCount) return res.status(404).json({ error: "Evento não encontrado." }); res.status(204).end(); } catch { res.status(503).json({ error: "Não foi possível excluir o evento." }); } });

registerCrmFollowupRoutes(app, { pool, tenant, validateRelations, classifyDbError });
registerFinanceOverviewRoutes(app, { pool, tenant, classifyDbError });
registerDeliveryWorkflowRoutes(app, { pool, tenant, classifyDbError });
registerAutomationRunRoutes(app, { pool, tenant, classifyDbError });
registerPortalAdminRoutes(app, { pool, tenant, hashPassword });
registerFormRoutes(app, { pool, tenant });

app.post("/api/forms/:id/public-link", async (req, res) => { const org = tenant(req, res); if (!org) return; try { const token = crypto.randomBytes(32).toString("base64url"); const q = await pool.query("update forms set public_token=$1,status='published',updated_at=now() where id=$2 and organization_id=$3 returning id,name,status", [token, req.params.id, org]); if (!q.rowCount) return res.status(404).json({ error: "Formulário não encontrado." }); res.status(201).json({ form: q.rows[0], token, path: "/form/" + token }); } catch { res.status(503).json({ error: "Não foi possível gerar o link do formulário." }); } });
async function start() { try { await runMigrations(pool); app.listen(port, "0.0.0.0", () => { console.log(`FocusApp API listening on ${port}`); startAutomationRunner(pool); }); } catch (e) { console.error("FocusApp API could not connect to PostgreSQL:", e.message); process.exitCode = 1; } }
if (process.env.NODE_ENV !== "test") start();
