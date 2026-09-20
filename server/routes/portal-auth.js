import crypto from "node:crypto";

const PORTAL_SESSION = "focus_portal_session";
const MAX_AGE = 60 * 60 * 8;
const secret = () => process.env.SESSION_SECRET || "development-only-change-me";
const parseCookies = (header = "") => Object.fromEntries(header.split(";").map((part) => part.trim().split("=")).filter(([key, value]) => key && value).map(([key, ...value]) => [key, value.join("=")]));
const sign = (payload) => crypto.createHmac("sha256", secret()).update(payload).digest("base64url");
const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
const decode = (value) => JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
const cookie = (value, maxAge = MAX_AGE) => `${PORTAL_SESSION}=${value}; HttpOnly; Path=/api/portal; SameSite=Lax; Max-Age=${maxAge}${process.env.NODE_ENV === "production" ? "; Secure" : ""}`;
const tokenHash = (token) => crypto.createHash("sha256").update(String(token)).digest("hex");
const audit = (pool, organizationId, actorId, action, entityId, changes = {}) => pool.query("insert into audit_events (organization_id,actor_id,action,entity_type,entity_id,changes,ip_address,user_agent) values ($1,$2,$3,'portal_link',$4,$5::jsonb,$6,$7)", [organizationId || null, actorId || null, action, entityId || null, JSON.stringify(changes), null, null]).catch(() => {});
const html = (value) => String(value ?? "").replace(/[&<>\"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[character]));

const portalLoginPage = (token, error = "") => `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Acesso ao portal FocusDev</title><style>:root{color-scheme:dark;font-family:Inter,system-ui,sans-serif;background:#070b14;color:#f8fafc}body{margin:0;padding:32px 16px;background:radial-gradient(circle at 80% 0,#153b77,#070b14 52%)}main{max-width:440px;margin:10vh auto}.brand{color:#e62429;font-size:24px;font-weight:800}.brand span{color:#fff}.card{margin-top:24px;padding:28px;border:1px solid #334766;border-radius:16px;background:#111b2e;box-shadow:0 16px 42px #0005}h1{margin:8px 0 24px}label{display:block;margin:18px 0 8px;color:#cbd5e1}input{width:100%;box-sizing:border-box;padding:13px;border-radius:10px;border:1px solid #466084;background:#0d1424;color:#fff}button{margin-top:18px;width:100%;padding:13px;border:0;border-radius:10px;background:#e62429;color:#fff;font-weight:700;cursor:pointer}.error{color:#fca5a5;margin:12px 0}</style><main><div class="brand">Focus<span>Dev</span></div><section class="card"><div>Acesso seguro</div><h1>Portal do cliente</h1>${error ? `<div class="error" role="alert">${html(error)}</div>` : ""}<form method="post" action="/api/portal/${encodeURIComponent(token)}/login"><label for="email">E-mail</label><input id="email" name="email" type="email" autocomplete="username" required><label for="password">Senha</label><input id="password" name="password" type="password" autocomplete="current-password" required><button type="submit">Entrar no portal</button></form></section></main></html>`;

const readSession = (req) => {
  try {
    const raw = parseCookies(req.get("cookie"))[PORTAL_SESSION] || "";
    const [payload, signature] = raw.split(".");
    if (!payload || !signature || signature !== sign(payload)) return null;
    const session = decode(payload);
    return session.exp > Math.floor(Date.now() / 1000) ? session : null;
  } catch { return null; }
};

export function registerPortalAuthRoutes(app, { pool, hashPassword, verifyPassword }) {
  app.post("/api/portal/:token/login", async (req, res) => {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = String(req.body?.password || "");
    try {
      const q = await pool.query("select id,client_id,organization_id,password_salt,password_hash from client_portal_links where token_hash=$1 and portal_auth_enabled=true and lower(login_email)=lower($2) and (expires_at is null or expires_at > now())", [tokenHash(req.params.token), email]);
      const link = q.rows[0];
      if (!link || !verifyPassword(password, link.password_salt, link.password_hash)) return res.status(401).json({ error: "E-mail ou senha inválidos." });
      const payload = encode({ link_id: link.id, client_id: link.client_id, organization_id: link.organization_id, exp: Math.floor(Date.now() / 1000) + MAX_AGE });
      await pool.query("update client_portal_links set last_login_at=now() where id=$1", [link.id]);
      audit(pool, link.organization_id, null, "portal_login_succeeded", link.id, { client_id: link.client_id });
      res.setHeader("Set-Cookie", cookie(`${payload}.${sign(payload)}`));
      if ((req.get("accept") || "").includes("text/html")) return res.redirect(`/api/portal/${encodeURIComponent(req.params.token)}`);
      return res.json({ authenticated: true });
    } catch { return res.status(503).json({ error: "Não foi possível autenticar no portal." }); }
  });
  app.post("/api/portal/logout", (_req, res) => { res.setHeader("Set-Cookie", cookie("", 0)); res.status(204).end(); });
}

export function createPortalAccessGuard({ pool }) {
  return async (req, res, next) => {
    if (req.path.endsWith("/login") || req.path === "/logout") return next();
    try {
      const q = await pool.query("select id,client_id,organization_id,portal_auth_enabled,expires_at from client_portal_links where token_hash=$1 and (expires_at is null or expires_at > now())", [tokenHash(req.params.token)]);
      const link = q.rows[0];
      if (!link) return res.status(404).json({ error: "Portal não encontrado." });
      if (!link.portal_auth_enabled) return next();
      const session = readSession(req);
      if (!session || session.link_id !== link.id || session.client_id !== link.client_id || session.organization_id !== link.organization_id) {
        if ((req.get("accept") || "").includes("text/html") && req.path === "/") return res.type("html").send(portalLoginPage(req.params.token));
        return res.status(401).json({ error: "Autenticação do portal necessária." });
      }
      req.portal = { client_id: link.client_id, organization_id: link.organization_id };
      audit(pool, link.organization_id, null, "portal_access_granted", link.id, { authenticated: Boolean(link.portal_auth_enabled) });
      return next();
    } catch { return res.status(503).json({ error: "Não foi possível validar o acesso ao portal." }); }
  };
}
