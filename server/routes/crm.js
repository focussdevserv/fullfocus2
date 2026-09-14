/* Rotas HTTP do domínio "crm" — campanhas, propostas (com itens), follow-ups e
   complementos de leads/oportunidades. O CRUD genérico de /api/leads e
   /api/opportunities continua em server/index.js.
   Ownership: server/routes/crm.js (+ migrations 02x) */

export const CAMPAIGN_CHANNELS = ["email", "whatsapp", "ads", "social", "other"];
export const CAMPAIGN_STATUSES = ["draft", "active", "paused", "done"];
export const PROPOSAL_STATUSES = ["draft", "sent", "viewed", "negotiation", "accepted", "rejected", "expired", "cancelled"];
export const OPPORTUNITY_STAGES = ["prospecting", "qualification", "proposal", "negotiation", "won", "lost"];

const toNumber = (value, fallback = null) => { if (value === undefined || value === null || value === "") return fallback; const n = Number(String(value).replace(",", ".")); return Number.isFinite(n) ? n : NaN; };
const dateOrNull = (value) => (value ? (Number.isNaN(Date.parse(value)) ? NaN : value) : null);

export function register(app, ctx) {
  const { pool, tenant, asText, classifyDbError, validateRelations } = ctx;
  const fail = (res, e, msg) => { const out = classifyDbError(e, msg); res.status(out.status).json({ error: out.error }); };
  const bad = (res, msg) => res.status(400).json({ error: msg });

  /* ---------------------------------------------------------------- resumo */
  app.get("/api/crm/summary", async (req, res) => {
    const org = tenant(req, res); if (!org) return;
    try {
      const [leads, opps, followups, proposals] = await Promise.all([
        pool.query("select status, count(*)::int total from leads where organization_id=$1 group by status", [org]),
        pool.query("select stage, count(*)::int total, coalesce(sum(amount),0)::float8 amount from opportunities where organization_id=$1 group by stage", [org]),
        pool.query("select count(*) filter (where done_at is null and due_at < now())::int late, count(*) filter (where done_at is null and due_at::date = current_date)::int today, count(*) filter (where done_at is null)::int open from followups where organization_id=$1", [org]),
        pool.query("select status, count(*)::int total, coalesce(sum(amount),0)::float8 amount from proposals where organization_id=$1 group by status", [org]),
      ]);
      res.json({ leads: leads.rows, opportunities: opps.rows, followups: followups.rows[0], proposals: proposals.rows });
    } catch (e) { fail(res, e, "Não foi possível carregar o resumo do CRM."); }
  });

  /* Converter lead em oportunidade (e opcionalmente em contato/empresa). */
  app.post("/api/leads/:id/convert", async (req, res) => {
    const org = tenant(req, res); if (!org) return;
    const client = await pool.connect().catch(() => null);
    if (!client) return res.status(503).json({ error: "Serviço indisponível." });
    try {
      await client.query("begin");
      const lead = (await client.query("select * from leads where id=$1 and organization_id=$2", [req.params.id, org])).rows[0];
      if (!lead) { await client.query("rollback"); return res.status(404).json({ error: "Lead não encontrado." }); }
      let contactId = lead.contact_id, companyId = lead.company_id;
      if (!companyId && lead.company && req.body?.createCompany !== false) companyId = (await client.query("insert into companies (organization_id,name) values ($1,$2) returning id", [org, lead.company])).rows[0].id;
      if (!contactId && req.body?.createContact !== false) contactId = (await client.query("insert into contacts (organization_id,name,email,phone,company_id) values ($1,$2,$3,$4,$5) returning id", [org, lead.name, lead.email || null, lead.phone || null, companyId || null])).rows[0].id;
      const amount = toNumber(req.body?.amount, toNumber(lead.value, 0));
      if (Number.isNaN(amount) || amount < 0) { await client.query("rollback"); return bad(res, "Valor inválido."); }
      const opp = (await client.query("insert into opportunities (organization_id,name,lead_id,company_id,contact_id,stage,amount,expected_close) values ($1,$2,$3,$4,$5,'prospecting',$6,$7) returning *", [org, asText(req.body?.name) || `${lead.name}${lead.company ? ` · ${lead.company}` : ""}`, lead.id, companyId || null, contactId || null, amount, dateOrNull(req.body?.expected_close) || null])).rows[0];
      await client.query("update leads set status='qualified', contact_id=coalesce(contact_id,$2), company_id=coalesce(company_id,$3), updated_at=now() where id=$1", [lead.id, contactId || null, companyId || null]);
      await client.query("commit");
      res.status(201).json({ opportunity: opp, contact_id: contactId || null, company_id: companyId || null });
    } catch (e) { await client.query("rollback").catch(() => {}); fail(res, e, "Não foi possível converter o lead."); }
    finally { client.release(); }
  });

  /* Converter lead em cliente sem duplicar registros e preservando vínculos. */
  app.post("/api/leads/:id/convert-to-client", async (req, res) => {
    const org = tenant(req, res); if (!org) return;
    const client = await pool.connect().catch(() => null);
    if (!client) return res.status(503).json({ error: "Serviço indisponível." });
    try {
      await client.query("begin");
      const leadResult = await client.query("select * from leads where id=$1 and organization_id=$2 for update", [req.params.id, org]);
      const lead = leadResult.rows[0];
      if (!lead) { await client.query("rollback"); return res.status(404).json({ error: "Lead não encontrado." }); }

      if (lead.converted_client_id) {
        const existing = await client.query("select * from clients where id=$1 and organization_id=$2", [lead.converted_client_id, org]);
        if (existing.rowCount) {
          await client.query("commit");
          return res.json({ client: existing.rows[0], contact_id: lead.contact_id, company_id: lead.company_id, converted: true });
        }
      }

      let companyId = lead.company_id || null;
      if (companyId) {
        const company = await client.query("select id from companies where id=$1 and organization_id=$2", [companyId, org]);
        if (!company.rowCount) { await client.query("rollback"); return res.status(400).json({ error: "Empresa do lead não pertence ao workspace." }); }
      } else if (asText(lead.company)) {
        const company = await client.query("select id from companies where organization_id=$1 and lower(trim(name))=lower(trim($2)) order by id limit 1", [org, asText(lead.company)]);
        companyId = company.rows[0]?.id || (await client.query("insert into companies (organization_id,name) values ($1,$2) returning id", [org, asText(lead.company)])).rows[0].id;
      }

      let contactId = lead.contact_id || null;
      if (contactId) {
        const contact = await client.query("select id from contacts where id=$1 and organization_id=$2", [contactId, org]);
        if (!contact.rowCount) { await client.query("rollback"); return res.status(400).json({ error: "Contato do lead não pertence ao workspace." }); }
      } else if (asText(lead.email) || asText(lead.phone)) {
        const contact = await client.query("select id from contacts where organization_id=$1 and (($2<>'' and lower(trim(email))=lower(trim($2))) or ($3<>'' and regexp_replace(phone,'\\D','','g')=regexp_replace($3,'\\D','','g'))) order by id limit 1", [org, asText(lead.email), asText(lead.phone)]);
        contactId = contact.rows[0]?.id || (await client.query("insert into contacts (organization_id,name,email,phone,company_id) values ($1,$2,$3,$4,$5) returning id", [org, lead.name, asText(lead.email) || null, asText(lead.phone) || null, companyId])).rows[0].id;
      }

      const matched = await client.query("select * from clients where organization_id=$1 and (($2<>'' and lower(trim(email))=lower(trim($2))) or ($3<>'' and regexp_replace(phone,'\\D','','g')=regexp_replace($3,'\\D','','g'))) order by id limit 1", [org, asText(lead.email), asText(lead.phone)]);
      let clientRow;
      if (matched.rowCount) {
        clientRow = (await client.query("update clients set company_id=coalesce(company_id,$2), contact_id=coalesce(contact_id,$3), updated_at=now() where id=$1 and organization_id=$4 returning *", [matched.rows[0].id, companyId, contactId, org])).rows[0];
      } else {
        clientRow = (await client.query("insert into clients (organization_id,company_id,contact_id,name,email,phone,status) values ($1,$2,$3,$4,$5,$6,'active') returning *", [org, companyId, contactId, lead.name, asText(lead.email) || null, asText(lead.phone) || null])).rows[0];
      }
      await client.query("update leads set status='won', contact_id=coalesce(contact_id,$2), company_id=coalesce(company_id,$3), converted_client_id=$4, updated_at=now() where id=$1 and organization_id=$5", [lead.id, contactId, companyId, clientRow.id, org]);
      await client.query("commit");
      res.status(201).json({ client: clientRow, contact_id: contactId, company_id: companyId, converted: false });
    } catch (e) { await client.query("rollback").catch(() => {}); fail(res, e, "Não foi possível converter o lead em cliente."); }
    finally { client.release(); }
  });

  /* ------------------------------------------------------------ campanhas */
  app.get("/api/campaigns", async (req, res) => { const org = tenant(req, res); if (!org) return; try { const q = await pool.query("select c.*, (select count(*)::int from leads l where l.organization_id=c.organization_id and l.campaign_id=c.id) leads_count from campaigns c where c.organization_id=$1 order by c.created_at desc", [org]); res.json({ campaigns: q.rows }); } catch (e) { fail(res, e, "Não foi possível carregar campanhas."); } });
  app.post("/api/campaigns", async (req, res) => {
    const org = tenant(req, res); if (!org) return;
    const name = asText(req.body?.name), channel = asText(req.body?.channel) || "other", budget = toNumber(req.body?.budget, 0), status = req.body?.status || "draft";
    if (!name || !CAMPAIGN_CHANNELS.includes(channel) || Number.isNaN(budget) || budget < 0 || !CAMPAIGN_STATUSES.includes(status)) return bad(res, "Informe nome, canal, orçamento e situação válidos.");
    const starts = dateOrNull(req.body?.starts_on), ends = dateOrNull(req.body?.ends_on); if (Number.isNaN(starts) || Number.isNaN(ends)) return bad(res, "Datas inválidas.");
    try { const q = await pool.query("insert into campaigns (organization_id,name,channel,budget,status,starts_on,ends_on) values ($1,$2,$3,$4,$5,$6,$7) returning *", [org, name, channel, budget, status, starts, ends]); res.status(201).json({ campaign: q.rows[0] }); } catch (e) { fail(res, e, "Não foi possível criar a campanha."); }
  });
  app.patch("/api/campaigns/:id", async (req, res) => {
    const org = tenant(req, res); if (!org) return;
    const set = [], params = [];
    const push = (col, val) => { params.push(val); set.push(`${col}=$${params.length}`); };
    if (req.body?.name !== undefined) { const v = asText(req.body.name); if (!v) return bad(res, "Nome inválido."); push("name", v); }
    if (req.body?.channel !== undefined) { if (!CAMPAIGN_CHANNELS.includes(req.body.channel)) return bad(res, "Canal inválido."); push("channel", req.body.channel); }
    if (req.body?.status !== undefined) { if (!CAMPAIGN_STATUSES.includes(req.body.status)) return bad(res, "Situação inválida."); push("status", req.body.status); }
    if (req.body?.budget !== undefined) { const v = toNumber(req.body.budget, 0); if (Number.isNaN(v) || v < 0) return bad(res, "Orçamento inválido."); push("budget", v); }
    if (req.body?.starts_on !== undefined) { const v = dateOrNull(req.body.starts_on); if (Number.isNaN(v)) return bad(res, "Data inválida."); push("starts_on", v); }
    if (req.body?.ends_on !== undefined) { const v = dateOrNull(req.body.ends_on); if (Number.isNaN(v)) return bad(res, "Data inválida."); push("ends_on", v); }
    if (!set.length) return bad(res, "Nenhum campo válido informado.");
    params.push(req.params.id, org);
    try { const q = await pool.query(`update campaigns set ${set.join(",")}, updated_at=now() where id=$${params.length - 1} and organization_id=$${params.length} returning *`, params); if (!q.rowCount) return res.status(404).json({ error: "Campanha não encontrada." }); res.json({ campaign: q.rows[0] }); } catch (e) { fail(res, e, "Não foi possível atualizar a campanha."); }
  });
  app.delete("/api/campaigns/:id", async (req, res) => { const org = tenant(req, res); if (!org) return; try { const q = await pool.query("delete from campaigns where id=$1 and organization_id=$2 returning id", [req.params.id, org]); if (!q.rowCount) return res.status(404).json({ error: "Campanha não encontrada." }); res.status(204).end(); } catch (e) { fail(res, e, "Não foi possível excluir a campanha."); } });

  /* ------------------------------------------------------------ propostas */
  const proposalTotal = async (id, org) => Number((await pool.query("select coalesce(sum(quantity*unit_price),0)::float8 total from proposal_items where proposal_id=$1 and organization_id=$2", [id, org])).rows[0].total);
  app.get("/api/proposals", async (req, res) => { const org = tenant(req, res); if (!org) return; try { const q = await pool.query("select p.*, o.name opportunity_name, l.name lead_name, (select coalesce(sum(quantity*unit_price),0)::float8 from proposal_items i where i.proposal_id=p.id) items_total, (select count(*)::int from proposal_items i where i.proposal_id=p.id) items_count from proposals p left join opportunities o on o.id=p.opportunity_id and o.organization_id=p.organization_id left join leads l on l.id=p.lead_id and l.organization_id=p.organization_id where p.organization_id=$1 order by p.created_at desc", [org]); res.json({ proposals: q.rows }); } catch (e) { fail(res, e, "Não foi possível carregar propostas."); } });
  app.get("/api/proposals/:id", async (req, res) => { const org = tenant(req, res); if (!org) return; try { const p = await pool.query("select p.*, o.name opportunity_name, l.name lead_name, l.email lead_email, l.phone lead_phone from proposals p left join opportunities o on o.id=p.opportunity_id and o.organization_id=p.organization_id left join leads l on l.id=p.lead_id and l.organization_id=p.organization_id where p.id=$1 and p.organization_id=$2", [req.params.id, org]); if (!p.rowCount) return res.status(404).json({ error: "Proposta não encontrada." }); const items = await pool.query("select * from proposal_items where proposal_id=$1 and organization_id=$2 order by position, id", [req.params.id, org]); res.json({ proposal: { ...p.rows[0], items: items.rows, items_total: items.rows.reduce((a, i) => a + Number(i.quantity) * Number(i.unit_price), 0) } }); } catch (e) { fail(res, e, "Não foi possível carregar a proposta."); } });
  app.post("/api/proposals", async (req, res) => {
    const org = tenant(req, res); if (!org) return;
    const title = asText(req.body?.title), amount = toNumber(req.body?.amount, 0), oid = req.body?.opportunity_id || null, lid = req.body?.lead_id || null;
    if (!title || Number.isNaN(amount) || amount < 0) return bad(res, "Informe título e valor válidos.");
    const valid = dateOrNull(req.body?.valid_until); if (Number.isNaN(valid)) return bad(res, "Validade inválida.");
    try { if (oid) await validateRelations({ opportunity_id: oid }, org); if (lid) await validateRelations({ lead_id: lid }, org); const q = await pool.query("insert into proposals (organization_id,opportunity_id,lead_id,title,amount,valid_until,notes) values ($1,$2,$3,$4,$5,$6,$7) returning *", [org, oid, lid, title, amount, valid, asText(req.body?.notes) || null]); res.status(201).json({ proposal: q.rows[0] }); }
    catch (e) { if (e.code === "invalid_relation") return bad(res, e.message); fail(res, e, "Não foi possível criar a proposta."); }
  });
  app.patch("/api/proposals/:id", async (req, res) => {
    const org = tenant(req, res); if (!org) return;
    const set = [], params = []; const push = (col, val) => { params.push(val); set.push(`${col}=$${params.length}`); };
    if (req.body?.title !== undefined) { const v = asText(req.body.title); if (!v) return bad(res, "Título inválido."); push("title", v); }
    if (req.body?.amount !== undefined) { const v = toNumber(req.body.amount, 0); if (Number.isNaN(v) || v < 0) return bad(res, "Valor inválido."); push("amount", v); }
    if (req.body?.valid_until !== undefined) { const v = dateOrNull(req.body.valid_until); if (Number.isNaN(v)) return bad(res, "Validade inválida."); push("valid_until", v); }
    if (req.body?.notes !== undefined) push("notes", asText(req.body.notes) || null);
    if (req.body?.opportunity_id !== undefined) { const v = req.body.opportunity_id || null; if (v) { try { await validateRelations({ opportunity_id: v }, org); } catch (e) { return bad(res, e.message); } } push("opportunity_id", v); }
    const status = req.body?.status;
    if (status !== undefined) { if (!PROPOSAL_STATUSES.includes(status)) return bad(res, "Situação inválida."); push("status", status); if (status === "sent") set.push("sent_at=coalesce(sent_at, now())"); if (status === "accepted" || status === "rejected") set.push("decided_at=now()"); }
    if (!set.length) return bad(res, "Nenhum campo válido informado.");
    params.push(req.params.id, org);
    try {
      const q = await pool.query(`update proposals set ${set.join(",")}, updated_at=now() where id=$${params.length - 1} and organization_id=$${params.length} returning *`, params);
      if (!q.rowCount) return res.status(404).json({ error: "Proposta não encontrada." });
      const row = q.rows[0];
      if (status === "accepted" && row.opportunity_id) await pool.query("update opportunities set stage='won', updated_at=now() where id=$1 and organization_id=$2", [row.opportunity_id, org]);
      if (status === "rejected" && row.opportunity_id) await pool.query("update opportunities set stage='lost', updated_at=now() where id=$1 and organization_id=$2 and stage <> 'won'", [row.opportunity_id, org]);
      if (status === "accepted") await pool.query("update leads set status='won', updated_at=now() where organization_id=$2 and (id=$1 or id=(select lead_id from opportunities where id=$3 and organization_id=$2))", [row.lead_id || null, org, row.opportunity_id || null]);
      res.json({ proposal: row });
    } catch (e) { fail(res, e, "Não foi possível atualizar a proposta."); }
  });
  app.put("/api/proposals/:id/items", async (req, res) => {
    const org = tenant(req, res); if (!org) return;
    const items = Array.isArray(req.body?.items) ? req.body.items : null;
    if (!items) return bad(res, "Envie a lista de itens.");
    for (const item of items) { const qty = toNumber(item.quantity, 1), price = toNumber(item.unit_price, 0); if (!asText(item.description) || Number.isNaN(qty) || qty <= 0 || Number.isNaN(price) || price < 0) return bad(res, "Cada item precisa de descrição, quantidade maior que zero e preço válido."); }
    const client = await pool.connect().catch(() => null); if (!client) return res.status(503).json({ error: "Serviço indisponível." });
    try {
      await client.query("begin");
      const p = await client.query("select id from proposals where id=$1 and organization_id=$2", [req.params.id, org]); if (!p.rowCount) { await client.query("rollback"); return res.status(404).json({ error: "Proposta não encontrada." }); }
      await client.query("delete from proposal_items where proposal_id=$1 and organization_id=$2", [req.params.id, org]);
      let position = 0;
      for (const item of items) await client.query("insert into proposal_items (organization_id,proposal_id,catalog_item_id,description,quantity,unit_price,position) values ($1,$2,$3,$4,$5,$6,$7)", [org, req.params.id, item.catalog_item_id || null, asText(item.description), toNumber(item.quantity, 1), toNumber(item.unit_price, 0), position++]);
      const total = Number((await client.query("select coalesce(sum(quantity*unit_price),0)::float8 total from proposal_items where proposal_id=$1", [req.params.id])).rows[0].total);
      const updated = await client.query("update proposals set amount=$1, updated_at=now() where id=$2 and organization_id=$3 returning *", [total, req.params.id, org]);
      await client.query("commit");
      res.json({ proposal: { ...updated.rows[0], items_total: total } });
    } catch (e) { await client.query("rollback").catch(() => {}); fail(res, e, "Não foi possível salvar os itens."); }
    finally { client.release(); }
  });
  app.delete("/api/proposals/:id", async (req, res) => { const org = tenant(req, res); if (!org) return; try { const q = await pool.query("delete from proposals where id=$1 and organization_id=$2 returning id", [req.params.id, org]); if (!q.rowCount) return res.status(404).json({ error: "Proposta não encontrada." }); res.status(204).end(); } catch (e) { fail(res, e, "Não foi possível excluir a proposta."); } });
  void proposalTotal;

  /* ----------------------------------------------------------- follow-ups */
  app.get("/api/followups", async (req, res) => { const org = tenant(req, res); if (!org) return; try { const q = await pool.query("select f.*, l.name lead_name, l.phone lead_phone, l.email lead_email, l.status lead_status from followups f left join leads l on l.id=f.lead_id and l.organization_id=f.organization_id where f.organization_id=$1 order by f.done_at nulls first, f.due_at", [org]); res.json({ followups: q.rows }); } catch (e) { fail(res, e, "Não foi possível carregar follow-ups."); } });
  app.post("/api/followups", async (req, res) => {
    const org = tenant(req, res); if (!org) return; const lead = req.body?.lead_id, due = req.body?.due_at;
    if (!lead || !due || Number.isNaN(Date.parse(due))) return bad(res, "Informe lead e data válidos.");
    try { await validateRelations({ lead_id: lead }, org); const q = await pool.query("insert into followups (organization_id,lead_id,due_at,channel,note) values ($1,$2,$3,$4,$5) returning *", [org, lead, due, asText(req.body?.channel) || null, asText(req.body?.note) || null]); await pool.query("update leads set status=case when status='new' then 'contacted' else status end, updated_at=now() where id=$1 and organization_id=$2", [lead, org]); res.status(201).json({ followup: q.rows[0] }); }
    catch (e) { if (e.code === "invalid_relation") return bad(res, e.message); fail(res, e, "Não foi possível criar o follow-up."); }
  });
  app.patch("/api/followups/:id", async (req, res) => {
    const org = tenant(req, res); if (!org) return;
    const set = [], params = []; const push = (col, val) => { params.push(val); set.push(`${col}=$${params.length}`); };
    if (req.body?.done !== undefined) push("done_at", req.body.done ? new Date().toISOString() : null);
    if (req.body?.done_at !== undefined) push("done_at", req.body.done_at || null);
    if (req.body?.due_at !== undefined) { if (!req.body.due_at || Number.isNaN(Date.parse(req.body.due_at))) return bad(res, "Data inválida."); push("due_at", req.body.due_at); }
    if (req.body?.channel !== undefined) push("channel", asText(req.body.channel) || null);
    if (req.body?.note !== undefined) push("note", asText(req.body.note) || null);
    if (!set.length) return bad(res, "Nenhum campo válido informado.");
    params.push(req.params.id, org);
    try { const q = await pool.query(`update followups set ${set.join(",")} where id=$${params.length - 1} and organization_id=$${params.length} returning *`, params); if (!q.rowCount) return res.status(404).json({ error: "Follow-up não encontrado." }); res.json({ followup: q.rows[0] }); } catch (e) { fail(res, e, "Não foi possível atualizar o follow-up."); }
  });
  app.delete("/api/followups/:id", async (req, res) => { const org = tenant(req, res); if (!org) return; try { const q = await pool.query("delete from followups where id=$1 and organization_id=$2 returning id", [req.params.id, org]); if (!q.rowCount) return res.status(404).json({ error: "Follow-up não encontrado." }); res.status(204).end(); } catch (e) { fail(res, e, "Não foi possível excluir o follow-up."); } });
}
