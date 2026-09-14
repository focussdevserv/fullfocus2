/* Rotas HTTP do domínio "whatsapp" — conexão com a Evolution API (v2).
   Ownership: server/routes/whatsapp.js

   Credenciais, em ordem de prioridade:
     1. integrations (provider = 'whatsapp') da organização: config.baseUrl / config.apiKey
        — gravadas pela tela WhatsApp; a chave nunca volta ao navegador (só mascarada).
     2. variáveis de ambiente EVOLUTION_API_URL / EVOLUTION_API_KEY (padrão global).
   Cada organização usa uma instância própria na Evolution: focus-<8 primeiros chars do org id>. */

import crypto from "node:crypto";

const DEFAULT_BASE_URL = process.env.EVOLUTION_API_URL || "https://evolutions-evolution-api.fcoipz.easypanel.host";
const TIMEOUT_MS = 15000;

export const instanceNameFor = (organizationId) => `focus-${String(organizationId).replace(/-/g, "").slice(0, 8)}`;
export const maskKey = (key) => (key ? `••••${String(key).slice(-4)}` : "");
export const normalizeNumber = (value) => String(value || "").replace(/\D/g, "");
export const webhookTokenFor = (organizationId, secret = process.env.SESSION_SECRET || "development-only-change-me") =>
  crypto.createHmac("sha256", secret).update(`whatsapp-webhook:${organizationId}`).digest("base64url").slice(0, 32);

export function register(app, ctx) {
  const { pool, tenant, classifyDbError } = ctx;
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
    const response = await fetchImpl(`${cfg.baseUrl}${path}`, {
      method,
      headers: { apikey: cfg.apiKey, "Content-Type": "application/json" },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
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

  function publicWebhookUrl(req, org) {
    const base = (process.env.APP_URL || `${req.get("x-forwarded-proto") || req.protocol}://${req.get("x-forwarded-host") || req.get("host")}`).replace(/\/+$/, "");
    return `${base}/api/whatsapp/webhook/${webhookTokenFor(org)}`;
  }

  /* Status geral: configuração + estado da instância. */
  app.get("/api/whatsapp/status", async (req, res) => {
    const org = tenant(req, res); if (!org) return;
    try {
      const cfg = await loadConfig(org);
      const name = instanceNameFor(org);
      const out = { configured: Boolean(cfg.apiKey), source: cfg.source, baseUrl: cfg.baseUrl, apiKeyMasked: maskKey(cfg.apiKey), instance: name, state: "unconfigured", number: null, profileName: null, canManage: ["owner", "admin"].includes(await roleOf(req, org)) };
      if (cfg.apiKey) {
        out.state = await instanceState(cfg, name);
        if (out.state !== "absent") Object.assign(out, await instanceInfo(cfg, name) || {});
      }
      res.json(out);
    } catch (error) { fail(res, error.status || 502, error.message || "Não foi possível consultar a Evolution API."); }
  });

  /* Salva URL/chave da organização (owner/admin). A chave nunca é devolvida. */
  app.post("/api/whatsapp/config", async (req, res) => {
    const org = tenant(req, res); if (!org) return;
    if (!["owner", "admin"].includes(await roleOf(req, org))) return fail(res, 403, "Apenas proprietários e administradores configuram o WhatsApp.");
    const baseUrl = String(req.body?.baseUrl || "").trim().replace(/\/+$/, "");
    const apiKey = String(req.body?.apiKey || "").trim();
    if (baseUrl && !/^https?:\/\/[^\s/]+/.test(baseUrl)) return fail(res, 400, "Informe uma URL válida da Evolution API.");
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
    try {
      const cfg = await loadConfig(org);
      const name = instanceNameFor(org);
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
      res.json({ instance: name, state, qr });
    } catch (error) { fail(res, error.status || 502, error.message || "Não foi possível iniciar a conexão."); }
  });

  app.post("/api/whatsapp/disconnect", async (req, res) => {
    const org = tenant(req, res); if (!org) return;
    try {
      const cfg = await loadConfig(org);
      const name = instanceNameFor(org);
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
      const name = instanceNameFor(org);
      const data = await evo(cfg, "POST", `/message/sendText/${encodeURIComponent(name)}`, { number, text });
      // Registra na caixa de entrada como mensagem enviada.
      try {
        const conv = await upsertConversation(org, number, null);
        await pool.query("insert into messages (organization_id, conversation_id, author_user_id, direction, body, read_at) values ($1,$2,$3,'out',$4,now())", [org, conv.id, req.user?.id || null, text]);
        await pool.query("update conversations set last_message_at=now(), updated_at=now() where id=$1", [conv.id]);
      } catch { /* inbox é complementar */ }
      res.json({ ok: true, id: data?.key?.id || null, status: data?.status || "sent" });
    } catch (error) { fail(res, error.status || 502, error.message || "Não foi possível enviar a mensagem."); }
  });

  async function upsertConversation(org, number, pushName) {
    const subject = `WhatsApp · ${pushName ? `${pushName} (${number})` : number}`;
    const existing = await pool.query("select id from conversations where organization_id=$1 and channel='whatsapp' and subject like $2 order by created_at desc limit 1", [org, `%${number}%`]);
    if (existing.rows[0]) return existing.rows[0];
    const created = await pool.query("insert into conversations (organization_id, subject, channel, status, last_message_at) values ($1,$2,'whatsapp','open',now()) returning id", [org, subject]);
    return created.rows[0];
  }

  /* Webhook público da Evolution: mensagens recebidas viram conversas na caixa de entrada.
     Autenticado pelo token derivado da organização (HMAC do SESSION_SECRET). */
  app.post("/api/whatsapp/webhook/:token", async (req, res) => {
    const token = String(req.params.token || "");
    const instance = String(req.body?.instance || "");
    const orgQ = await pool.query("select organization_id from integrations where provider='whatsapp'").catch(() => ({ rows: [] }));
    const org = orgQ.rows.map((row) => row.organization_id).find((id) => webhookTokenFor(id) === token && instanceNameFor(id) === instance);
    if (!org) return res.status(404).end();
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
      if (!number) return res.status(204).end();
      const conv = await upsertConversation(org, number, data?.pushName);
      await pool.query("insert into messages (organization_id, conversation_id, direction, body) values ($1,$2,'in',$3)", [org, conv.id, String(body).slice(0, 4000)]);
      await pool.query("update conversations set last_message_at=now(), unread_count=unread_count+1, status='open', updated_at=now() where id=$1", [conv.id]);
      res.status(204).end();
    } catch { res.status(204).end(); }
  });
}
