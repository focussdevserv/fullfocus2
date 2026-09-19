import crypto from "node:crypto";
import { sendEmail, renderEmail, APP_URL } from "./mailer.js";

const RATE_LIMIT_MESSAGE = "Muitas tentativas. Tente novamente mais tarde.";

export const hashResetToken = (token) => crypto.createHash("sha256").update(String(token)).digest("hex");

export const createResetToken = () => {
  const token = crypto.randomBytes(32).toString("base64url");
  return { token, tokenHash: hashResetToken(token) };
};

export const isExpired = (expiresAt, now = Date.now()) => {
  const timestamp = expiresAt instanceof Date ? expiresAt.getTime() : new Date(expiresAt).getTime();
  return !Number.isFinite(timestamp) || timestamp <= now;
};

const normalizedIp = (req) => String(req.ip || req.socket?.remoteAddress || "unknown").trim();
const normalizedEmail = (req) => String(req.body?.email || "").trim().toLowerCase();
const opaqueKey = (namespace, value) => `${namespace}:${crypto.createHash("sha256").update(value).digest("hex")}`;

export function createRateLimiter({ windowMs = 15 * 60_000, max, key }) {
  const attempts = new Map();
  return (req, res, next) => {
    const now = Date.now();
    const id = key(req);
    const current = attempts.get(id);
    const entry = !current || current.resetAt <= now ? { count: 0, resetAt: now + windowMs } : current;
    entry.count += 1;
    attempts.set(id, entry);
    if (entry.count <= max) return next();
    res.setHeader("Retry-After", String(Math.max(1, Math.ceil((entry.resetAt - now) / 1000))));
    return res.status(429).json({ error: RATE_LIMIT_MESSAGE });
  };
}

const rateLimits = ({ ipMax, emailMax, windowMs }) => [
  createRateLimiter({ windowMs, max: ipMax, key: (req) => opaqueKey("ip", normalizedIp(req)) }),
  createRateLimiter({ windowMs, max: emailMax, key: (req) => opaqueKey("email", normalizedEmail(req)) }),
];

// O login e registrado antes deste modulo em server/index.js. Cria uma camada Express
// normal e a reposiciona antes da rota existente, evitando duplicar ou alterar seu contrato.
function protectExistingLoginRoute(app, handlers) {
  const stack = app.router?.stack;
  if (!Array.isArray(stack)) return;
  const loginIndex = stack.findIndex((layer) => layer.route?.path === "/api/auth/login" && layer.route?.methods?.post);
  if (loginIndex < 0) return;
  app.use("/api/auth/login", (req, res, next) => {
    if (req.method !== "POST") return next();
    let index = 0;
    const run = () => {
      const handler = handlers[index++];
      return handler ? handler(req, res, run) : next();
    };
    return run();
  });
  const limiterLayer = stack.pop();
  stack.splice(loginIndex, 0, limiterLayer);
}

const safeError = (error) => ({ name: String(error?.name || "Error"), code: String(error?.code || "unknown") });

export function attachResetRoutes(app, { pool, hashPassword, ttlMinutes = 60, logger = console, mail = sendEmail, rateLimitWindowMs = 15 * 60_000 }) {
  protectExistingLoginRoute(app, rateLimits({ ipMax: 10, emailMax: 5, windowMs: rateLimitWindowMs }));

  app.post("/api/auth/reset-request", ...rateLimits({ ipMax: 5, emailMax: 3, windowMs: rateLimitWindowMs }), async (req, res) => {
    const email = normalizedEmail(req);
    try {
      if (email && pool?.connect) {
        const client = await pool.connect();
        try {
          await client.query("begin");
          const user = await client.query("select id,email from users where email=$1", [email]);
          if (user.rows[0]) {
            const { token, tokenHash } = createResetToken();
            await client.query("update password_resets set used_at=now() where user_id=$1 and used_at is null", [user.rows[0].id]);
            await client.query("insert into password_resets (user_id,token_hash,expires_at) values ($1,$2,$3)", [user.rows[0].id, tokenHash, new Date(Date.now() + ttlMinutes * 60_000)]);
            const link = `${APP_URL}/#reset=${token}`;
            const { html, text } = renderEmail({ title: "Redefina sua senha", intro: `Recebemos um pedido para redefinir a senha da conta ${email}. O link vale por ${ttlMinutes} minutos.`, actionLabel: "Criar nova senha", actionUrl: link });
            mail({ to: email, subject: "Redefinição de senha · FocusDev", html, text }).catch((error) => logger.error?.("[reset] e-mail não enviado", safeError(error)));
          }
          await client.query("commit");
        } catch (error) {
          await client.query("rollback").catch(() => {});
          logger.error?.("[reset] falha ao criar solicitação", safeError(error));
        } finally {
          client.release();
        }
      }
    } catch (error) {
      logger.error?.("[reset] falha ao conectar", safeError(error));
    }
    res.status(202).json({ ok: true });
  });

  app.post("/api/auth/reset-confirm", async (req, res) => {
    const token = String(req.body?.token || "");
    const password = String(req.body?.password || "");
    if (password.length < 8) return res.status(400).json({ error: "A senha deve ter pelo menos 8 caracteres." });
    let client;
    try {
      client = await pool.connect();
      await client.query("begin");
      const tokenHash = hashResetToken(token);
      const reset = await client.query("select user_id from password_resets where token_hash=$1 and used_at is null and expires_at > now() for update", [tokenHash]);
      if (!reset.rows[0]) {
        await client.query("rollback");
        return res.status(400).json({ error: "Link invalido ou expirado." });
      }
      const result = await hashPassword(password);
      const userId = reset.rows[0].user_id;
      await client.query("update users set password_hash=$1,access_revoked_at=now() where id=$2", [`${result.salt}:${result.hash}`, userId]);
      // Consome todos os links ainda abertos do usuario, inclusive pedidos concorrentes antigos.
      await client.query("update password_resets set used_at=now() where user_id=$1 and used_at is null", [userId]);
      await client.query("commit");
      res.setHeader("Set-Cookie", "focus_session=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0");
      return res.status(204).send();
    } catch (error) {
      await client?.query("rollback").catch(() => {});
      logger.error?.("[reset] falha ao confirmar senha", safeError(error));
      return res.status(503).json({ error: "Serviço indisponível." });
    } finally {
      client?.release();
    }
  });
  return app;
}
