import { callFocussAgent, DEFAULT_AGENT_PROMPT } from "../focuss-agent.js";

export function register(app, ctx) {
  const { pool, tenant, classifyDbError } = ctx;
  const fail = (res, error, fallback) => { const out = classifyDbError(error, fallback); res.status(out.status).json({ error: out.error }); };
  const roleOf = async (req, org) => (await pool.query("select role from users where id=$1 and organization_id=$2", [req.user?.id, org])).rows[0]?.role || "member";
  const ensure = async (org) => {
    const current = await pool.query("select * from agent_configs where organization_id=$1", [org]);
    if (current.rowCount) return current.rows[0];
    return (await pool.query("insert into agent_configs (organization_id,system_prompt) values ($1,$2) returning *", [org, DEFAULT_AGENT_PROMPT])).rows[0];
  };
  app.get("/api/agent/config", async (req, res) => { const org = tenant(req, res); if (!org) return; try { const config = await ensure(org); res.json({ agent: { id: config.id, name: config.name, model: config.model, enabled: config.enabled, autonomy_level: config.autonomy_level, prompt_version: config.prompt_version, ai_configured: Boolean(process.env.OPENAI_API_KEY) } }); } catch (error) { fail(res, error, "Não foi possível carregar o agente."); } });
  app.patch("/api/agent/config", async (req, res) => { const org = tenant(req, res); if (!org) return; if (!["owner", "admin"].includes(await roleOf(req, org))) return res.status(403).json({ error: "Apenas proprietários e administradores configuram o agente." }); try { await ensure(org); const fields = ["name", "model", "enabled", "autonomy_level", "prompt_version"].filter((field) => req.body?.[field] !== undefined); if (!fields.length) return res.status(400).json({ error: "Informe uma configuração para atualizar." }); if (fields.includes("autonomy_level") && (!Number.isInteger(Number(req.body.autonomy_level)) || Number(req.body.autonomy_level) < 0 || Number(req.body.autonomy_level) > 4)) return res.status(400).json({ error: "Nível de autonomia inválido." }); const values = fields.map((field) => field === "autonomy_level" ? Number(req.body[field]) : req.body[field]); const q = await pool.query(`update agent_configs set ${fields.map((field, index) => `${field}=$${index + 1}`).join(",")},updated_at=now() where organization_id=$${fields.length + 1} returning id,name,model,enabled,autonomy_level,prompt_version`, [...values, org]); res.json({ agent: q.rows[0] }); } catch (error) { fail(res, error, "Não foi possível atualizar o agente."); } });
  app.post("/api/agent/respond", async (req, res) => {
    const org = tenant(req, res); if (!org) return;
    const message = String(req.body?.message || "").trim(); if (!message) return res.status(400).json({ error: "A mensagem não pode estar vazia." });
    try {
      const config = await ensure(org); if (!config.enabled) return res.status(409).json({ error: "O Agente Focussdev está desativado neste workspace." });
      let conversationId = req.body?.conversation_id ? Number(req.body.conversation_id) : null;
      if (conversationId) { const check = await pool.query("select id from conversations where id=$1 and organization_id=$2", [conversationId, org]); if (!check.rowCount) return res.status(404).json({ error: "Conversa não encontrada." }); }
      if (!conversationId) conversationId = (await pool.query("insert into conversations (organization_id,subject,channel) values ($1,$2,'internal') returning id", [org, "Agente Focussdev"])).rows[0].id;
      await pool.query("insert into messages (organization_id,conversation_id,author_user_id,direction,body) values ($1,$2,$3,'in',$4)", [org, conversationId, req.user?.id || null, message]);
      const history = (await pool.query("select direction,body from messages where conversation_id=$1 and organization_id=$2 order by created_at desc limit 20", [conversationId, org])).rows.reverse();
      const catalog = (await pool.query("select id,name,kind,price,unit,category,short_description,recurrence,billing_type from catalog_items where organization_id=$1 and active=true and public_visible=true order by highlighted desc,created_at desc limit 100", [org])).rows;
      const result = await callFocussAgent({ model: config.model, prompt: config.system_prompt || DEFAULT_AGENT_PROMPT, messages: history.slice(0, -1), currentMessage: message, context: { company: "Focussdev", catalog } });
      const saved = await pool.query("insert into messages (organization_id,conversation_id,direction,body,read_at) values ($1,$2,'out',$3,now()) returning id,created_at", [org, conversationId, result.reply]);
      await pool.query("update conversations set last_message_at=$1,updated_at=now(),unread_count=0 where id=$2 and organization_id=$3", [saved.rows[0].created_at, conversationId, org]);
      res.json({ conversation_id: conversationId, response: result, action_executed: false });
    } catch (error) { if (error.code === "AI_NOT_CONFIGURED") return res.status(503).json({ error: error.message, code: error.code }); fail(res, error, "Não foi possível responder com o agente."); }
  });
}
