import crypto from "node:crypto";

export const hashResetToken = (token) => crypto.createHash("sha256").update(String(token)).digest("hex");

export const createResetToken = () => {
  const token = crypto.randomBytes(32).toString("base64url");
  return { token, tokenHash: hashResetToken(token) };
};

export const isExpired = (expiresAt, now = Date.now()) => {
  const timestamp = expiresAt instanceof Date ? expiresAt.getTime() : new Date(expiresAt).getTime();
  return !Number.isFinite(timestamp) || timestamp <= now;
};

export function attachResetRoutes(app, { pool, hashPassword, ttlMinutes = 60, logger = console }) {
  app.post("/api/auth/reset-request", async (req, res) => {
    const email = String(req.body?.email || "").trim().toLowerCase();
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
            logger.info(`[reset] link para ${email}: /#reset=${token}`);
          }
          await client.query("commit");
        } catch (error) {
          await client.query("rollback").catch(() => {});
          logger.error?.("[reset] falha ao criar link", error);
        } finally {
          client.release();
        }
      }
    } catch (error) {
      logger.error?.("[reset] falha ao conectar", error);
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
      const reset = await client.query("select user_id from password_resets where token_hash=$1 and used_at is null and expires_at > now() for update", [hashResetToken(token)]);
      if (!reset.rows[0]) {
        await client.query("rollback");
        return res.status(400).json({ error: "Link invalido ou expirado." });
      }
      const result = await hashPassword(password);
      const passwordHash = `${result.salt}:${result.hash}`;
      await client.query("update users set password_hash=$1 where id=$2", [passwordHash, reset.rows[0].user_id]);
      await client.query("update password_resets set used_at=now() where token_hash=$1", [hashResetToken(token)]);
      await client.query("commit");
      return res.status(204).send();
    } catch (error) {
      await client?.query("rollback").catch(() => {});
      logger.error?.("[reset] falha ao confirmar senha", error);
      return res.status(503).json({ error: "Serviço indisponível." });
    } finally {
      client?.release();
    }
  });
  return app;
}
