/* Envio de e-mails transacionais via Resend (https://resend.com).
   Configuração por variáveis de ambiente:
     RESEND_API_KEY   chave da API (obrigatória para enviar)
     MAIL_FROM        remetente, ex.: "FocusDev <no-reply@focussdev.space>" (o domínio precisa
                      estar verificado no Resend; sem isso use "onboarding@resend.dev", que só
                      entrega para o e-mail do dono da conta)
     APP_URL          base pública do app usada nos links (default: produção)
   Sem chave, os envios são apenas registrados no log e as rotas continuam funcionando. */

const RESEND_URL = "https://api.resend.com/emails";
const TIMEOUT_MS = 10000;

export const APP_URL = (process.env.APP_URL || "https://focussapp-focussapp-api.fcoipz.easypanel.host").replace(/\/+$/, "");

export function mailerStatus(env = process.env) {
  return { configured: Boolean(env.RESEND_API_KEY), from: env.MAIL_FROM || "FocusDev <onboarding@resend.dev>", provider: "resend" };
}

const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

/* Layout simples e responsivo para todos os e-mails do sistema. */
export function renderEmail({ title, intro, actionLabel, actionUrl, footer = "Se você não esperava este e-mail, pode ignorá-lo com segurança." }) {
  const button = actionUrl ? `<p style="margin:28px 0"><a href="${escapeHtml(actionUrl)}" style="display:inline-block;padding:14px 22px;border-radius:12px;background:#f3132d;color:#fff;font-weight:700;text-decoration:none">${escapeHtml(actionLabel || "Abrir")}</a></p><p style="font-size:12px;color:#6b7a99;word-break:break-all">Ou copie este link: ${escapeHtml(actionUrl)}</p>` : "";
  const html = `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#e9f0fb;font-family:Inter,Segoe UI,Arial,sans-serif;color:#0f1f45"><div style="max-width:520px;margin:32px auto;padding:32px;background:#fff;border-radius:22px"><p style="margin:0 0 20px;font-size:22px;font-weight:800;letter-spacing:-.04em"><span style="color:#0d4fc2">Focus</span><span style="color:#f3132d">Dev</span></p><h1 style="margin:0 0 12px;font-size:22px;letter-spacing:-.03em">${escapeHtml(title)}</h1><p style="margin:0;font-size:15px;line-height:1.55;color:#46557a">${escapeHtml(intro)}</p>${button}<p style="margin:24px 0 0;font-size:12px;color:#6b7a99">${escapeHtml(footer)}</p></div></body></html>`;
  const text = `${title}\n\n${intro}\n${actionUrl ? `\n${actionLabel || "Abrir"}: ${actionUrl}\n` : ""}\n${footer}`;
  return { html, text };
}

export async function sendEmail({ to, subject, html, text }, { fetchImpl = fetch, env = process.env, logger = console } = {}) {
  const status = mailerStatus(env);
  if (!status.configured) {
    logger.info?.(`[mail] (não configurado) para ${to}: ${subject}`);
    return { sent: false, reason: "unconfigured" };
  }
  const response = await fetchImpl(RESEND_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: status.from, to: Array.isArray(to) ? to : [to], subject, html, text }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data?.message || `Resend respondeu ${response.status}`;
    logger.error?.(`[mail] falha para ${to}: ${message}`);
    return { sent: false, reason: message, status: response.status };
  }
  return { sent: true, id: data?.id || null };
}
