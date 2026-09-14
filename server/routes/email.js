/* Rotas HTTP do domínio "email" — status e teste do envio transacional (Resend).
   Ownership: server/routes/email.js */

import { mailerStatus, sendEmail, renderEmail } from "../mailer.js";

export function register(app, ctx) {
  const { pool, tenant } = ctx;
  const roleOf = async (req, org) => { const q = await pool.query("select role from users where id=$1 and organization_id=$2", [req.user?.id, org]); return q.rows[0]?.role || "member"; };

  app.get("/api/email/status", async (req, res) => {
    const org = tenant(req, res); if (!org) return;
    res.json({ ...mailerStatus(), canManage: ["owner", "admin"].includes(await roleOf(req, org)) });
  });

  /* Envia um e-mail de teste para o próprio usuário (owner/admin). */
  app.post("/api/email/test", async (req, res) => {
    const org = tenant(req, res); if (!org) return;
    if (!["owner", "admin"].includes(await roleOf(req, org))) return res.status(403).json({ error: "Apenas proprietários e administradores testam o e-mail." });
    if (!mailerStatus().configured) return res.status(400).json({ error: "E-mail não configurado: defina RESEND_API_KEY no servidor." });
    const { html, text } = renderEmail({ title: "E-mail de teste", intro: `Este é um teste enviado pelo workspace em ${new Date().toLocaleString("pt-BR")}. Se chegou, o envio está funcionando.`, footer: "Enviado pelo FocusDev." });
    const result = await sendEmail({ to: req.user.email, subject: "Teste de e-mail · FocusDev", html, text }).catch((error) => ({ sent: false, reason: error?.message }));
    if (!result.sent) return res.status(502).json({ error: `Não foi possível enviar: ${result.reason || "erro desconhecido"}` });
    res.json({ ok: true, to: req.user.email, id: result.id });
  });
}
