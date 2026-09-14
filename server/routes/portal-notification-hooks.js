import crypto from "node:crypto";

const tokenHash = (token) => crypto.createHash("sha256").update(String(token)).digest("hex");

export function register(app, { pool }) {
  app.use("/api/portal/:token", (req, res, next) => {
    if (req.method !== "POST" || !["/tickets", "/files"].includes(req.path) && !/^\/tickets\/\d+\/comments$/.test(req.path)) return next();
    const send = res.json.bind(res), entity = req.path === "/files" ? "files" : req.path.endsWith("/comments") ? "tickets" : "tickets", message = entity === "files" ? "Novo arquivo enviado pelo cliente" : entity === "tickets" ? (req.path.endsWith("/comments") ? "Novo comentário do cliente em um ticket" : "Novo ticket aberto pelo cliente") : "Nova atualização do portal";
    res.json = (payload) => { if (res.statusCode >= 200 && res.statusCode < 300) { const entityId = Number(payload?.file?.id || payload?.ticket?.id || req.params.id) || null; pool.query("insert into notifications (organization_id,user_id,message,entity_type,entity_id) select l.organization_id,u.id,$2,$3,$4 from client_portal_links l join users u on u.organization_id=l.organization_id and u.access_status not in ('inactive','blocked') where l.token_hash=$1 and (l.expires_at is null or l.expires_at > now())", [tokenHash(req.params.token), message, entity, entityId]).catch(() => {}); } return send(payload); };
    next();
  });
}
