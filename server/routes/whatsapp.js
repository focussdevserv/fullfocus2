/* Rotas HTTP do domínio "whatsapp" — conexão com a Evolution API (v2).
   Ownership: server/routes/whatsapp.js

   Credenciais, em ordem de prioridade:
     1. integrations (provider = 'whatsapp') da organização: config.baseUrl / config.apiKey
        — gravadas pela tela WhatsApp; a chave nunca volta ao navegador (só mascarada).
     2. variáveis de ambiente EVOLUTION_API_URL / EVOLUTION_API_KEY (padrão global).
   Cada organização usa uma instância própria na Evolution: focus-<8 primeiros chars do org id>. */

import crypto from "node:crypto";
import { assertSafeOutboundUrl, parseOutboundUrl } from "../outbound-url.js";
import { callFocussAgent, DEFAULT_AGENT_PROMPT } from "../focuss-agent.js";
import { availableAgentActions, evaluateAgentAction, executeAgentAction } from "../agent-actions.js";

const DEFAULT_BASE_URL = process.env.EVOLUTION_API_URL || "https://evolutions-evolution-api.fcoipz.easypanel.host";
const TIMEOUT_MS = 15000;

export const CHANNELS = { support: "Atendimento", assistant: "Auxiliar" };
export const normalizeChannel = (value) => String(value || "support").toLowerCase() === "assistant" ? "assistant" : "support";
export const instanceNameFor = (organizationId, channel = "support") => {
  const base = `focus-${String(organizationId).replace(/-/g, "").slice(0, 8)}`;
  return normalizeChannel(channel) === "assistant" ? `${base}-aux` : base;
};
export const maskKey = (key) => (key ? `••••${String(key).slice(-4)}` : "");
export const normalizeNumber = (value) => String(value || "").replace(/\D/g, "");
export const webhookTokenFor = (organizationId, secret = process.env.SESSION_SECRET || "development-only-change-me") =>
  crypto.createHmac("sha256", secret).update(`whatsapp-webhook:${organizationId}`).digest("base64url").slice(0, 32);

/* Envia texto pelo WhatsApp da organização (usado pela caixa de entrada e automações). */
export async function sendWhatsappText(pool, org, number, text, channel = "support") {
  const q = await pool.query("select id, status, config from integrations where organization_id=$1 and provider='whatsapp' limit 1", [org]);
  const config = q.rows[0]?.config || {};
  const cfg = { baseUrl: String(config.baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, ""), apiKey: config.apiKey || process.env.EVOLUTION_API_KEY || "" };
  if (!cfg.apiKey) throw Object.assign(new Error("WhatsApp não configurado nesta organização."), { status: 400 });
  await assertSafeOutboundUrl(cfg.baseUrl);
  const response = await fetch(`${cfg.baseUrl}/message/sendText/${encodeURIComponent(instanceNameFor(org, channel))}`, { method: "POST", headers: { apikey: cfg.apiKey, "Content-Type": "application/json" }, body: JSON.stringify({ number: normalizeNumber(number), text }), redirect: "manual", signal: AbortSignal.timeout(TIMEOUT_MS) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(data?.response?.message?.[0] || data?.message || `WhatsApp respondeu ${response.status}`), { status: 502 });
  return { id: data?.key?.id || null };
}

export function register(app, ctx) {
  const { pool, tenant, classifyDbError } = ctx;
  const callAgent = ctx.callFocussAgent || callFocussAgent;
  const executeAction = ctx.executeAgentAction || executeAgentAction;
  const fail = (res, status, error) => res.status(status).json({ error });

  async function loadConfig(org) {
    const q = await pool.query("select id, status, config from integrations where organization_id=$1 and provider='whatsapp' limit 1", [org]);
    const row = q.rows[0];
    const config = row?.config || {};
    return {
      row,
      baseUrl: String(config.baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, ""),
      apiKey: config.apiKey || process.env.EVOLUTION_API_KEY || "",
      source: config.apiKey ? "organization" : process.env.EVOLUTION_API_KEY ? "environment" : "none",
    };
  }

  async function evo(cfg, method, path, body, { fetchImpl = fetch } = {}) {
    if (!cfg.apiKey) throw Object.assign(new Error("A Evolution API ainda não está configurada: informe a chave da API."), { status: 400 });
    // Revalida o destino a cada chamada (a URL salva pode ter sido alterada) e não segue redirecionamentos.
    try { await assertSafeOutboundUrl(cfg.baseUrl); } catch (error) { throw Object.assign(new Error(`URL da Evolution API rejeitada: ${error.message}`), { status: 400 }); }
    const response = await fetchImpl(`${cfg.baseUrl}${path}`, {
      method,
      headers: { apikey: cfg.apiKey, "Content-Type": "application/json" },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      redirect: "manual",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (response.status >= 300 && response.status < 400) throw Object.assign(new Error("A Evolution API tentou redirecionar a requisição; verifique a URL configurada."), { status: 502 });
    const text = await response.text();
    let data = {};
    try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text.slice(0, 200) }; }
    if (!response.ok) {
      const message = data?.response?.message?.[0] || data?.message || data?.error || `Evolution API respondeu ${response.status}`;
      throw Object.assign(new Error(typeof message === "string" ? message : JSON.stringify(message).slice(0, 200)), { status: response.status === 401 ? 400 : 502, evolutionStatus: response.status });
    }
    return data;
  }

  async function roleOf(req, org) {
    const q = await pool.query("select role from users where id=$1 and organization_id=$2", [req.user?.id, org]);
    return q.rows[0]?.role || "member";
  }

  async function assistantActor(org, number) {
    const q = await pool.query("select u.id,u.role,tr.permissions from users u left join team_roles tr on tr.id=u.team_role_id and tr.organization_id=u.organization_id where u.organization_id=$1 and coalesce(u.access_status,'active') not in ('inactive','blocked') and (u.access_expires_on is null or u.access_expires_on>=current_date) and (regexp_replace(coalesce(u.whatsapp,''), '\\D', '', 'g')=$2 or regexp_replace(coalesce(u.phone,''), '\\D', '', 'g')=$2)", [org, number]);
    if (q.rows.length !== 1) return { id: null, role: "member", permissions: null };
    return { id: q.rows[0].id, role: q.rows[0].role || "member", permissions: q.rows[0].permissions || null };
  }

  async function instanceState(cfg, name) {
    try {
      const data = await evo(cfg, "GET", `/instance/connectionState/${encodeURIComponent(name)}`);
      return data?.instance?.state || data?.state || "close";
    } catch (error) {
      if (error.evolutionStatus === 404) return "absent";
      throw error;
    }
  }

  async function instanceInfo(cfg, name) {
    try {
      const list = await evo(cfg, "GET", `/instance/fetchInstances?instanceName=${encodeURIComponent(name)}`);
      const item = Array.isArray(list) ? list.find((entry) => (entry.name || entry.instance?.instanceName) === name) || list[0] : list;
      if (!item) return null;
      const raw = item.instance || item;
      return { number: raw.number || (raw.ownerJid ? raw.ownerJid.split("@")[0] : null), profileName: raw.profileName || null, status: raw.connectionStatus || raw.status || null };
    } catch { return null; }
  }

  async function listInstances(cfg) {
    if (!cfg.apiKey) return [];
    try {
      const list = await evo(cfg, "GET", "/instance/fetchInstances");
      const rows = Array.isArray(list) ? list : Array.isArray(list?.instances) ? list.instances : [];
      return rows.map((entry) => {
        const raw = entry?.instance || entry || {};
        const name = raw.instanceName || raw.name || entry?.name || "";
        const state = raw.connectionStatus || raw.state || entry?.connectionStatus || entry?.state || "close";
        return { name, state, number: raw.number || (raw.ownerJid ? String(raw.ownerJid).split("@")[0] : null), profileName: raw.profileName || raw.profile || null };
      }).filter((entry) => entry.name);
    } catch { return []; }
  }

  // URL pública do app vem de configuração, nunca do cabeçalho Host (evita redirecionar webhooks para terceiros).
    const PUBLIC_APP_URL = (process.env.APP_URL || "https://focussdev.space").replace(/\/+$/, "");
  function publicWebhookUrl(_req, org) {
    return `${PUBLIC_APP_URL}/api/whatsapp/webhook/${webhookTokenFor(org)}`;
  }

  /* Status geral: configuração + estado da instância. */
  app.get("/api/whatsapp/status", async (req, res) => {
    const org = tenant(req, res); if (!org) return;
    try {
      const cfg = await loadConfig(org);
      const out = { configured: Boolean(cfg.apiKey), source: cfg.source, baseUrl: cfg.baseUrl, apiKeyMasked: maskKey(cfg.apiKey), canManage: ["owner", "admin"].includes(await roleOf(req, org)), channels: {} };
      for (const channel of Object.keys(CHANNELS)) {
        const name = instanceNameFor(org, channel);
        const item = { channel, label: CHANNELS[channel], instance: name, state: cfg.apiKey ? await instanceState(cfg, name) : "unconfigured", number: null, profileName: null };
        if (cfg.apiKey && item.state !== "absent") Object.assign(item, await instanceInfo(cfg, name) || {});
        out.channels[channel] = item;
      }
      out.instances = await listInstances(cfg);
      Object.assign(out, out.channels.support);
      res.json(out);
    } catch (error) { fail(res, error.status || 502, error.message || "Não foi possível consultar a Evolution API."); }
  });

  /* Salva URL/chave da organização (owner/admin). A chave nunca é devolvida. */
  app.post("/api/whatsapp/config", async (req, res) => {
    const org = tenant(req, res); if (!org) return;
    if (!["owner", "admin"].includes(await roleOf(req, org))) return fail(res, 403, "Apenas proprietários e administradores configuram o WhatsApp.");
    const baseUrl = String(req.body?.baseUrl || "").trim().replace(/\/+$/, "");
    const apiKey = String(req.body?.apiKey || "").trim();
    if (baseUrl) {
      const check = parseOutboundUrl(baseUrl);
      if (!check.ok) return fail(res, 400, check.error);
      if (check.url.protocol !== "https:") return fail(res, 400, "A URL da Evolution API precisa usar https.");
      try { await assertSafeOutboundUrl(baseUrl); } catch (error) { return fail(res, 400, error.message); }
    }
    try {
      const current = await loadConfig(org);
      const config = { ...(current.row?.config || {}), ...(baseUrl ? { baseUrl } : {}), ...(apiKey ? { apiKey } : {}) };
      if (current.row) await pool.query("update integrations set config=$1, updated_at=now() where id=$2 and organization_id=$3", [config, current.row.id, org]);
      else await pool.query("insert into integrations (organization_id, provider, status, config) values ($1, 'whatsapp', 'disconnected', $2)", [org, config]);
      const cfg = await loadConfig(org);
      res.json({ ok: true, baseUrl: cfg.baseUrl, apiKeyMasked: maskKey(cfg.apiKey), source: cfg.source });
    } catch (error) { const out = classifyDbError(error, "Não foi possível salvar a configuração."); fail(res, out.status, out.error); }
  });

  /* Garante a instância, registra o webhook de entrada e devolve o QR code. */
  app.post("/api/whatsapp/connect", async (req, res) => {
    const org = tenant(req, res); if (!org) return;
    if (!["owner", "admin"].includes(await roleOf(req, org))) return fail(res, 403, "Apenas proprietários e administradores gerenciam a conexão do WhatsApp.");
    try {
      const cfg = await loadConfig(org);
      const channel = normalizeChannel(req.body?.channel || req.query?.channel);
      const name = instanceNameFor(org, channel);
      let state = await instanceState(cfg, name);
      let qr = null;
      if (state === "absent") {
        const created = await evo(cfg, "POST", "/instance/create", { instanceName: name, qrcode: true, integration: "WHATSAPP-BAILEYS" });
        qr = created?.qrcode || null;
        state = "connecting";
      }
      try {
        await evo(cfg, "POST", `/webhook/set/${encodeURIComponent(name)}`, { webhook: { enabled: true, url: publicWebhookUrl(req, org), byEvents: false, base64: false, events: ["MESSAGES_UPSERT", "CONNECTION_UPDATE"] } });
      } catch { /* webhook é opcional: a conexão continua sem ele */ }
      if (state !== "open") {
        const data = await evo(cfg, "GET", `/instance/connect/${encodeURIComponent(name)}`);
        qr = { base64: data?.base64 || qr?.base64 || null, code: data?.code || qr?.code || null, pairingCode: data?.pairingCode || null };
        state = await instanceState(cfg, name);
      }
      await pool.query("update integrations set status=$1, updated_at=now() where organization_id=$2 and provider='whatsapp'", [state === "open" ? "connected" : "disconnected", org]).catch(() => {});
      res.json({ channel, label: CHANNELS[channel], instance: name, state, qr });
    } catch (error) { fail(res, error.status || 502, error.message || "Não foi possível iniciar a conexão."); }
  });

  app.post("/api/whatsapp/disconnect", async (req, res) => {
    const org = tenant(req, res); if (!org) return;
    if (!["owner", "admin"].includes(await roleOf(req, org))) return fail(res, 403, "Apenas proprietários e administradores gerenciam a conexão do WhatsApp.");
    try {
      const cfg = await loadConfig(org);
      const channel = normalizeChannel(req.body?.channel || req.query?.channel);
      const name = instanceNameFor(org, channel);
      await evo(cfg, "DELETE", `/instance/logout/${encodeURIComponent(name)}`).catch((error) => { if (error.evolutionStatus !== 404) throw error; });
      await pool.query("update integrations set status='disconnected', updated_at=now() where organization_id=$1 and provider='whatsapp'", [org]).catch(() => {});
      res.json({ ok: true, state: "close" });
    } catch (error) { fail(res, error.status || 502, error.message || "Não foi possível desconectar."); }
  });

  app.post("/api/whatsapp/send", async (req, res) => {
    const org = tenant(req, res); if (!org) return;
    const number = normalizeNumber(req.body?.number);
    const text = String(req.body?.text || "").trim();
    if (number.length < 10 || number.length > 15) return fail(res, 400, "Informe o número com DDI e DDD, só dígitos (ex.: 5511999990000).");
    if (!text) return fail(res, 400, "Escreva a mensagem.");
    try {
      const cfg = await loadConfig(org);
    const channel = normalizeChannel(req.body?.channel || req.query?.channel);
    const name = instanceNameFor(org, channel);
      const data = await evo(cfg, "POST", `/message/sendText/${encodeURIComponent(name)}`, { number, text });
      // Registra na caixa de entrada como mensagem enviada.
      try {
        const conv = await upsertConversation(org, number, null);
        await pool.query("insert into messages (organization_id, conversation_id, author_user_id, direction, body, read_at) values ($1,$2,$3,'out',$4,now())", [org, conv.id, req.user?.id || null, text]);
        await pool.query("update conversations set last_message_at=now(), updated_at=now() where id=$1", [conv.id]);
      } catch { /* inbox é complementar */ }
      res.json({ ok: true, channel, id: data?.key?.id || null, status: data?.status || "sent" });
    } catch (error) { fail(res, error.status || 502, error.message || "Não foi possível enviar a mensagem."); }
  });

  async function upsertConversation(org, number, pushName, channel = "support") {
    channel = normalizeChannel(channel);
    const subject = `${CHANNELS[channel]} · ${pushName ? `${pushName} (${number})` : number}`;
    const existing = await pool.query("select id from conversations where organization_id=$1 and channel='whatsapp' and whatsapp_channel=$2 and (remote_number=$3 or subject like $4) order by created_at desc limit 1", [org, channel, number, `%${number}%`]);
    if (existing.rows[0]) { await pool.query("update conversations set remote_number=coalesce(remote_number,$2) where id=$1", [existing.rows[0].id, number]).catch(() => {}); return existing.rows[0]; }
    // Vincula automaticamente a um contato com este telefone, se existir.
    const contact = await pool.query("select id from contacts where organization_id=$1 and regexp_replace(coalesce(phone,''), '\\D', '', 'g') like '%' || $2 limit 1", [org, number.slice(-8)]).catch(() => ({ rows: [] }));
    const created = await pool.query("insert into conversations (organization_id, subject, channel, whatsapp_channel, status, last_message_at, remote_number, contact_id) values ($1,$2,'whatsapp',$3,'open',now(),$4,$5) returning id", [org, subject, channel, number, contact.rows[0]?.id || null]);
    return created.rows[0];
  }

  /* Webhook público da Evolution: mensagens recebidas viram conversas na caixa de entrada.
     Autenticado pelo token derivado da organização (HMAC do SESSION_SECRET). */
  app.post("/api/whatsapp/webhook/:token", async (req, res) => {
    const token = String(req.params.token || "");
    const instance = String(req.body?.instance || "");
    const orgQ = await pool.query("select organization_id from integrations where provider='whatsapp'").catch(() => ({ rows: [] }));
    const org = orgQ.rows.map((row) => row.organization_id).find((id) => webhookTokenFor(id) === token && Object.keys(CHANNELS).some((channel) => instanceNameFor(id, channel) === instance));
    if (!org) return res.status(404).end();
    const channel = Object.keys(CHANNELS).find((item) => instanceNameFor(org, item) === instance) || "support";
    try {
      const event = String(req.body?.event || "").toLowerCase().replace(/_/g, ".");
      if (event === "connection.update") {
        const state = req.body?.data?.state || req.body?.data?.status;
        if (state) await pool.query("update integrations set status=$1, updated_at=now() where organization_id=$2 and provider='whatsapp'", [state === "open" ? "connected" : "disconnected", org]);
        return res.status(204).end();
      }
      if (event !== "messages.upsert") return res.status(204).end();
      const data = req.body?.data || {};
      if (data?.key?.fromMe) return res.status(204).end();
      const number = normalizeNumber(String(data?.key?.remoteJid || "").split("@")[0]);
      const body = data?.message?.conversation || data?.message?.extendedTextMessage?.text || data?.message?.imageMessage?.caption || "[mídia recebida]";
      const providerMessageId = String(data?.key?.id || "").trim();
      if (!number || !providerMessageId) return res.status(204).end();
      const conv = await upsertConversation(org, number, data?.pushName, channel);
      const accepted = await pool.query("insert into messages (organization_id, conversation_id, direction, body, provider_message_id) values ($1,$2,'in',$3,$4) on conflict do nothing returning id", [org, conv.id, String(body).slice(0, 4000), providerMessageId]);
      if (!accepted.rowCount) return res.status(204).end();
      await pool.query("update conversations set last_message_at=now(), unread_count=unread_count+1, status='open', updated_at=now() where id=$1 and organization_id=$2", [conv.id, org]);
      if (channel === "assistant") {
        const allowed = String(process.env.ASSISTANT_WHATSAPP_NUMBER || "").replace(/\D/g, "");
        if (!allowed || allowed !== number) return res.status(204).end();
        const agent = (await pool.query("select enabled,model,system_prompt,autonomy_level from agent_configs where organization_id=$1", [org])).rows[0];
        if (agent?.enabled && process.env.OPENAI_API_KEY) {
          const actor = await assistantActor(org, number);
          const history = (await pool.query("select direction,body from messages where conversation_id=$1 and organization_id=$2 order by created_at desc limit 20", [conv.id, org])).rows.reverse();
          const catalog = (await pool.query("select id,name,kind,price,unit,category,short_description,recurrence,billing_type from catalog_items where organization_id=$1 and active=true and public_visible=true order by highlighted desc,created_at desc limit 100", [org])).rows;
          const allowedActions = availableAgentActions({ autonomyLevel: agent.autonomy_level, role: actor.role, permissions: actor.permissions });
          const result = await callAgent({ model: agent.model, prompt: agent.system_prompt || DEFAULT_AGENT_PROMPT, messages: history.slice(0, -1), currentMessage: String(body).slice(0, 4000), context: { company: "Focussdev", channel: "assistant", user_role: actor.role, catalog, agent_policy: { autonomy_level: Number(agent.autonomy_level), allowed_actions: allowedActions, user_role: actor.role } } });
          const decision = evaluateAgentAction({ action: result.action, autonomyLevel: agent.autonomy_level, role: actor.role, permissions: actor.permissions });
          if (decision.attempted && !decision.allowed) {
            result.reply = "A ação solicitada não foi executada porque a autonomia ou as permissões do agente não permitem essa alteração.";
          } else if (decision.allowed) {
            let actionResult;
            try {
              actionResult = await executeAction({ pool, action: decision.action, payload: result.action_payload, org, userId: actor.id, authorized: true });
            } catch {
              actionResult = { executed: false, reason: "execution_error" };
            }
            if (!actionResult.executed) result.reply = "A ação solicitada falhou e não foi confirmada. A mensagem foi preservada para acompanhamento.";
          }
          const cfg = await loadConfig(org);
          const sent = await evo(cfg, "POST", `/message/sendText/${encodeURIComponent(instanceNameFor(org, channel))}`, { number, text: result.reply });
          await pool.query("insert into messages (organization_id, conversation_id, direction, body, read_at) values ($1,$2,'out',$3,now())", [org, conv.id, result.reply]);
          await pool.query("update conversations set last_message_at=now(), updated_at=now(), unread_count=0 where id=$1 and organization_id=$2", [conv.id, org]);
          void sent;
        }
      }
      res.status(204).end();
    } catch { res.status(204).end(); }
  });
}
