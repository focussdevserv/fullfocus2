/* ==========================================================================
   FocusDev — módulo "crm"
   Telas: CRM comercial (hub), Leads, Funil, Oportunidades, Campanhas,
   Propostas, Follow-ups. Dados reais de /api/leads, /api/opportunities,
   /api/campaigns, /api/proposals, /api/followups, /api/crm/summary.
   Ownership: modules/crm.js, modules/crm.css
   ========================================================================== */

const LEAD_STATUS = { new: ["Novo", "blue"], contacted: ["Em contato", "purple"], qualified: ["Qualificado", "orange"], proposal: ["Em proposta", "orange"], won: ["Convertido", "green"], lost: ["Descartado", "red"] };
const STAGES = { prospecting: ["Prospecção", "blue"], qualification: ["Qualificação", "purple"], proposal: ["Proposta", "orange"], negotiation: ["Negociação", "orange"], won: ["Ganho", "green"], lost: ["Perdido", "red"] };
const CHANNELS = { email: "E-mail", whatsapp: "WhatsApp", ads: "Anúncios", social: "Redes sociais", other: "Outro" };
const CAMPAIGN_STATUS = { draft: ["Rascunho", "gray"], active: ["Ativa", "green"], paused: ["Pausada", "orange"], done: ["Concluída", "blue"] };
const PROPOSAL_STATUS = { draft: ["Rascunho", "gray"], sent: ["Enviada", "blue"], viewed: ["Visualizada", "purple"], negotiation: ["Em negociação", "orange"], accepted: ["Aprovada", "green"], rejected: ["Recusada", "red"], expired: ["Expirada", "gray"], cancelled: ["Cancelada", "red"] };
const SOURCES = [["site", "Site"], ["indicacao", "Indicação"], ["instagram", "Instagram"], ["whatsapp", "WhatsApp"], ["google", "Google"], ["evento", "Evento"], ["outro", "Outro"]];

const { esc, money, date, dateTime, relative, badge, avatar, header, button, stats, toolbar, table, empty, rowActions, confirmInline, toast, form, drawer, facts, keepSearchFocus, downloadCsv } = ui;
const label = (map, key) => map[key]?.[0] || key || "—";
const tone = (map, key) => map[key]?.[1] || "gray";
const pageStatus = (text, isError = false) => { const p = dashboardGrid.querySelector("[data-page-status]"); if (p) { p.textContent = text; p.classList.toggle("crm-error", isError); } };
const wrap = (title, kicker, promise) => promise.catch((error) => { dashboardGrid.innerHTML = header({ kicker, title }) + stateBlock.error(error.message, "crm-retry"); dashboardGrid.querySelector(".crm-retry")?.addEventListener("click", () => renderHashRoute(window.location.hash)); });

/* Cache leve de listas usadas em selects. */
const cache = { leads: null, clients: null, opportunities: null, campaigns: null, catalog: null };
async function options(kind) {
  if (!cache[kind]) {
    const path = { leads: "/api/leads", clients: "/api/clients", opportunities: "/api/opportunities", campaigns: "/api/campaigns", catalog: "/api/catalog-items" }[kind];
    try { cache[kind] = (await api(path))[kind === "catalog" ? "catalog_items" : kind] || []; } catch { cache[kind] = []; }
  }
  return cache[kind];
}
const invalidate = () => { Object.keys(cache).forEach((k) => (cache[k] = null)); };

/* ==========================================================================
   Hub
   ========================================================================== */

async function renderHub() {
  dashboardGrid.innerHTML = header({ kicker: "CRM", title: "CRM comercial", description: "Carregando…" }) + stateBlock.loading("Carregando resumo…");
  await wrap("CRM comercial", "CRM", (async () => {
    const [summary, followups] = await Promise.all([api("/api/crm/summary"), api("/api/followups")]);
    const leadsTotal = summary.leads.reduce((n, r) => n + r.total, 0), leadsOpen = summary.leads.filter((r) => !["won", "lost"].includes(r.status)).reduce((n, r) => n + r.total, 0);
    const won = summary.opportunities.find((r) => r.stage === "won"), lost = summary.opportunities.find((r) => r.stage === "lost");
    const openOpps = summary.opportunities.filter((r) => !["won", "lost"].includes(r.stage));
    const pipeline = openOpps.reduce((n, r) => n + r.amount, 0), pipelineCount = openOpps.reduce((n, r) => n + r.total, 0);
    const conversion = (won?.total || 0) + (lost?.total || 0) ? Math.round(((won?.total || 0) / ((won?.total || 0) + (lost?.total || 0))) * 100) : null;
    const pending = (followups.followups || []).filter((f) => !f.done_at).sort((a, b) => new Date(a.due_at) - new Date(b.due_at)).slice(0, 6);
    const proposalsSent = summary.proposals.find((r) => r.status === "sent");
    dashboardGrid.innerHTML = header({ kicker: "CRM", title: "CRM comercial", description: `${leadsOpen} leads ativos · ${pipelineCount} oportunidades em aberto · ${money(pipeline)} no funil`, actions: button({ label: "+ Novo lead", attr: 'data-new-lead' }) + button({ label: "+ Oportunidade", kind: "secondary", attr: 'data-new-opp' }) })
      + stats([
        { label: "Leads ativos", value: String(leadsOpen), note: `${leadsTotal} no total`, attr: 'data-go="#leads"' },
        { label: "Funil em aberto", value: money(pipeline), note: `${pipelineCount} oportunidades`, attr: 'data-go="#funil"' },
        { label: "Conversão", value: conversion === null ? "—" : `${conversion}%`, note: `${won?.total || 0} ganhas · ${lost?.total || 0} perdidas`, tone: conversion !== null && conversion >= 50 ? "green" : undefined, attr: 'data-go="#oportunidades"' },
        { label: "Follow-ups pendentes", value: String(summary.followups.open || 0), note: summary.followups.late ? `${summary.followups.late} atrasados` : `${summary.followups.today || 0} para hoje`, tone: summary.followups.late ? "red" : undefined, attr: 'data-go="#follow-ups"' },
      ])
      + `<section class="crm-hub-grid">
        <article class="data-card"><div class="section-heading"><div><p class="card-kicker">Funil</p><h2>Valor por estágio</h2></div><a class="text-action" href="#funil">Abrir funil →</a></div>${funnelBars(summary.opportunities)}</article>
        <article class="data-card"><div class="section-heading"><div><p class="card-kicker">Leads</p><h2>Por situação</h2></div><a class="text-action" href="#leads">Ver leads →</a></div><div class="crm-status-list">${Object.keys(LEAD_STATUS).map((k) => { const r = summary.leads.find((x) => x.status === k); return `<div><span>${badge(label(LEAD_STATUS, k), tone(LEAD_STATUS, k))}</span><strong>${r?.total || 0}</strong></div>`; }).join("")}</div></article>
        <article class="data-card crm-hub-wide"><div class="section-heading"><div><p class="card-kicker">Próximos follow-ups</p><h2>Não deixe esfriar</h2></div><a class="text-action" href="#follow-ups">Todos →</a></div>${pending.length ? `<div class="crm-followup-list">${pending.map((f) => `<div class="crm-followup ${new Date(f.due_at) < new Date() ? "is-late" : ""}"><time>${esc(dateTime(f.due_at))}</time><div><strong>${esc(f.lead_name || "Lead")}</strong><small>${esc(f.note || f.channel || "Retomar contato")}</small></div><button class="text-action" type="button" data-done="${esc(f.id)}">Concluir</button></div>`).join("")}</div>` : empty({ title: "Nenhum follow-up pendente.", text: "Agende retornos a partir de um lead para nunca perder o momento certo." })}</article>
        <article class="data-card"><div class="section-heading"><div><p class="card-kicker">Propostas</p><h2>Situação</h2></div><a class="text-action" href="#propostas">Ver propostas →</a></div><div class="crm-status-list">${Object.keys(PROPOSAL_STATUS).map((k) => { const r = summary.proposals.find((x) => x.status === k); return `<div><span>${badge(label(PROPOSAL_STATUS, k), tone(PROPOSAL_STATUS, k))}</span><strong>${r?.total || 0}</strong><small>${money(r?.amount || 0)}</small></div>`; }).join("")}</div>${proposalsSent?.total ? `<p class="crm-hint">${proposalsSent.total} proposta${proposalsSent.total === 1 ? "" : "s"} aguardando resposta (${money(proposalsSent.amount)}).</p>` : ""}</article>
      </section>`;
    dashboardGrid.querySelectorAll("[data-go]").forEach((b) => b.addEventListener("click", () => { location.hash = b.dataset.go; }));
    dashboardGrid.querySelector("[data-new-lead]").addEventListener("click", () => leadForm(null, renderHub));
    dashboardGrid.querySelector("[data-new-opp]").addEventListener("click", () => opportunityForm(null, renderHub));
    dashboardGrid.querySelectorAll("[data-done]").forEach((b) => b.addEventListener("click", async () => { try { await api(`/api/followups/${b.dataset.done}`, { method: "PATCH", body: { done: true } }); toast("Follow-up concluído.", "success"); renderHub(); } catch (error) { toast(error.message, "error"); } }));
  })());
}

function funnelBars(rows) {
  const stages = Object.keys(STAGES).filter((k) => !["won", "lost"].includes(k));
  const max = Math.max(1, ...stages.map((k) => rows.find((r) => r.stage === k)?.amount || 0));
  return `<div class="crm-funnel">${stages.map((k) => { const r = rows.find((x) => x.stage === k); const amount = r?.amount || 0; return `<div class="crm-funnel-row"><span>${label(STAGES, k)}</span><div class="crm-funnel-bar"><i style="width:${Math.max(3, Math.round((amount / max) * 100))}%"></i></div><b>${money(amount)}</b><small>${r?.total || 0}</small></div>`; }).join("")}</div>`;
}

/* ==========================================================================
   Leads
   ========================================================================== */

const leadsState = { query: "", status: "open", source: "all", sort: "recent" };

async function renderLeads() {
  dashboardGrid.innerHTML = header({ kicker: "CRM", title: "Leads", description: "Carregando…" }) + stateBlock.loading("Carregando leads…");
  await wrap("Leads", "CRM", (async () => {
    const params = new URLSearchParams(); if (leadsState.query.trim()) params.set("search", leadsState.query.trim()); if (leadsState.status !== "all") params.set("status", leadsState.status); if (leadsState.source !== "all") params.set("source", leadsState.source);
    const [leadsRes, campaignsRes] = await Promise.allSettled([api(`/api/leads?${params}`), api("/api/campaigns")]);
    if (leadsRes.status === "rejected") throw leadsRes.reason;
    const leads = leadsRes.value.leads || [], campaigns = campaignsRes.status === "fulfilled" ? campaignsRes.value.campaigns || [] : [];
    cache.campaigns = campaigns; cache.leads = leads;
    drawLeads(leads, campaigns);
  })());
}

function drawLeads(leads, campaigns) {
  const s = leadsState;
  const q = s.query.trim().toLocaleLowerCase("pt-BR");
  const list = leads.filter((l) => (s.status === "all" || (s.status === "open" ? !["won", "lost"].includes(l.status) : l.status === s.status)) && (s.source === "all" || (l.source || "outro") === s.source) && (!q || `${l.name} ${l.company || ""} ${l.email || ""} ${l.phone || ""}`.toLocaleLowerCase("pt-BR").includes(q)))
    .sort((a, b) => s.sort === "name" ? a.name.localeCompare(b.name, "pt-BR") : s.sort === "value" ? Number(b.value || 0) - Number(a.value || 0) : new Date(b.created_at) - new Date(a.created_at));
  const open = leads.filter((l) => !["won", "lost"].includes(l.status));
  const weekAgo = Date.now() - 7 * 86400e3;
  dashboardGrid.innerHTML = header({ kicker: "CRM", title: "Leads", description: `${open.length} ativos de ${leads.length}`, actions: button({ label: "Exportar CSV", kind: "secondary", attr: "data-export" }) + button({ label: "+ Novo lead", attr: "data-new" }) })
    + stats([
      { label: "Ativos", value: String(open.length), attr: 'data-quick="open"', active: s.status === "open" },
      { label: "Novos (7 dias)", value: String(leads.filter((l) => new Date(l.created_at).getTime() >= weekAgo).length), attr: 'data-quick="new"' },
      { label: "Ganhos", value: String(leads.filter((l) => l.status === "won").length), tone: "green", attr: 'data-quick="won"' },
      { label: "Valor estimado", value: money(open.reduce((n, l) => n + Number(l.value || 0), 0)), note: "leads ativos" },
    ])
    + `<section class="data-card crm-card">${toolbar({ search: { value: s.query, placeholder: "Buscar por nome, empresa, e-mail ou telefone…" }, filters: [
      { key: "status", value: s.status, options: [["open", "Ativos"], ["all", "Todos"], ...Object.entries(LEAD_STATUS).map(([k, [v]]) => [k, v])] },
      { key: "source", value: s.source, options: [["all", "Toda origem"], ...SOURCES] },
      { key: "sort", value: s.sort, options: [["recent", "Mais recentes"], ["name", "Por nome"], ["value", "Maior valor"]] },
    ] })}
    ${list.length ? table({ columns: [
      { key: "name", label: "Lead", render: (l) => `<div class="crm-cell-person">${avatar(l.name, tone(LEAD_STATUS, l.status))}<div><strong>${esc(l.name)}</strong><small>${esc(l.company || "Sem empresa")}${l.email ? ` · ${esc(l.email)}` : ""}</small></div></div>` },
      { key: "status", label: "Situação", render: (l) => `<select class="ui-select crm-inline-select" data-status="${esc(l.id)}">${Object.entries(LEAD_STATUS).map(([k, [v]]) => `<option value="${k}" ${l.status === k ? "selected" : ""}>${v}</option>`).join("")}</select>` },
      { key: "source", label: "Origem", hideOnNarrow: true, render: (l) => esc(SOURCES.find(([k]) => k === l.source)?.[1] || l.source || "—") },
      { key: "value", label: "Valor", align: "right", hideOnNarrow: true, render: (l) => (l.value ? money(l.value) : "—") },
      { key: "created_at", label: "Criado", hideOnNarrow: true, render: (l) => `<span title="${esc(dateTime(l.created_at))}">${esc(relative(l.created_at))}</span>` },
      { key: "actions", label: "", align: "right", render: (l) => rowActions([{ label: "↗", title: "Converter em oportunidade", attr: `data-convert="${esc(l.id)}"` }, { label: "✓", title: "Converter em cliente", attr: `data-convert-client="${esc(l.id)}"` }, { label: "⏰", title: "Agendar follow-up", attr: `data-followup="${esc(l.id)}"` }, { label: "✎", title: "Editar", attr: `data-edit="${esc(l.id)}"` }, { label: "×", title: "Excluir", danger: true, attr: `data-delete="${esc(l.id)}"` }]) },
    ], rows: list, rowClass: () => "is-clickable", rowAttr: (l) => `data-open="${esc(l.id)}"` }) : empty({ title: leads.length ? "Nenhum lead com esses filtros." : "Nenhum lead ainda.", text: leads.length ? "Ajuste a busca ou os filtros." : "Cadastre quem demonstrou interesse e acompanhe até o fechamento.", cta: leads.length ? "" : "Criar primeiro lead", attr: "data-new" })}
    </section>`;
  const refocus = keepSearchFocus(dashboardGrid);
  const redraw = () => { drawLeads(leads, campaigns); };
  dashboardGrid.querySelector("[data-search]")?.addEventListener("input", (e) => { s.query = e.target.value; clearTimeout(s.timer); s.timer = setTimeout(() => renderLeads(), 250); });
  dashboardGrid.querySelectorAll("[data-filter]").forEach((el) => el.addEventListener("change", () => { s[el.dataset.filter] = el.value; renderLeads(); }));
  dashboardGrid.querySelectorAll("[data-quick]").forEach((b) => b.addEventListener("click", () => { const k = b.dataset.quick; if (k === "new") { s.status = "all"; s.sort = "recent"; } else s.status = k; redraw(); }));
  dashboardGrid.querySelectorAll("[data-new]").forEach((b) => b.addEventListener("click", () => leadForm(null, renderLeads)));
  dashboardGrid.querySelector("[data-export]")?.addEventListener("click", () => downloadCsv("leads.csv", ["Nome", "Empresa", "E-mail", "Telefone", "Origem", "Situação", "Valor", "Criado em"], list.map((l) => [l.name, l.company || "", l.email || "", l.phone || "", l.source || "", label(LEAD_STATUS, l.status), l.value || "", dateTime(l.created_at)])));
  dashboardGrid.querySelectorAll("[data-status]").forEach((sel) => sel.addEventListener("change", async () => { try { await api(`/api/leads/${sel.dataset.status}`, { method: "PATCH", body: { status: sel.value } }); const l = leads.find((x) => String(x.id) === sel.dataset.status); if (l) l.status = sel.value; toast("Situação atualizada.", "success"); redraw(); } catch (error) { toast(error.message, "error"); redraw(); } }));
  dashboardGrid.querySelectorAll("tr[data-open]").forEach((row) => row.addEventListener("click", (event) => { if (event.target.closest("button, select, a")) return; leadDrawer(leads.find((l) => String(l.id) === row.dataset.open), campaigns, renderLeads); }));
  dashboardGrid.querySelectorAll("[data-edit]").forEach((b) => b.addEventListener("click", () => leadForm(leads.find((l) => String(l.id) === b.dataset.edit), renderLeads)));
  dashboardGrid.querySelectorAll("[data-convert]").forEach((b) => b.addEventListener("click", () => convertLead(leads.find((l) => String(l.id) === b.dataset.convert), renderLeads)));
  dashboardGrid.querySelectorAll("[data-convert-client]").forEach((b) => b.addEventListener("click", () => convertLeadToClient(leads.find((l) => String(l.id) === b.dataset.convertClient), renderLeads)));
  dashboardGrid.querySelectorAll("[data-followup]").forEach((b) => b.addEventListener("click", () => followupForm({ lead_id: b.dataset.followup }, renderLeads)));
  dashboardGrid.querySelectorAll("[data-delete]").forEach((b) => b.addEventListener("click", () => confirmInline(b, { onConfirm: async () => { await api(`/api/leads/${b.dataset.delete}`, { method: "DELETE" }); toast("Lead excluído."); renderLeads(); } })));
}

function leadForm(lead, after) {
  const campaigns = cache.campaigns || [];
  form({ title: lead ? "Editar lead" : "Novo lead", subtitle: "CRM", submitLabel: lead ? "Salvar" : "Criar lead", values: lead || { status: "new", source: "site" }, fields: [
    { name: "name", label: "Nome", placeholder: "Nome do contato" },
    { name: "company", label: "Empresa", placeholder: "Empresa (opcional)", required: false, half: true },
    { name: "value", label: "Valor estimado (R$)", type: "number", required: false, half: true },
    { name: "email", label: "E-mail", type: "email", required: false, half: true },
    { name: "phone", label: "Telefone / WhatsApp", type: "tel", placeholder: "5511999990000", required: false, half: true },
    { name: "source", label: "Origem", type: "select", options: SOURCES, half: true },
    { name: "status", label: "Situação", type: "select", options: Object.entries(LEAD_STATUS).map(([k, [v]]) => [k, v]), half: true },
    ...(campaigns.length ? [{ name: "campaign_id", label: "Campanha", type: "select", required: false, options: [["", "Sem campanha"], ...campaigns.map((c) => [String(c.id), c.name])] }] : []),
    { name: "notes", label: "Observações", type: "textarea", required: false, rows: 3 },
  ], onSubmit: async (values) => { if (lead) await api(`/api/leads/${lead.id}`, { method: "PATCH", body: values }); else await api("/api/leads", { method: "POST", body: values }); invalidate(); toast(lead ? "Lead atualizado." : "Lead criado.", "success"); after(); },
  danger: lead ? { label: "Excluir lead", onClick: async () => { await api(`/api/leads/${lead.id}`, { method: "DELETE" }); invalidate(); toast("Lead excluído."); after(); } } : null });
}

function leadDrawer(lead, campaigns, after) {
  if (!lead) return;
  const campaign = campaigns.find((c) => String(c.id) === String(lead.campaign_id));
  const d = drawer({ title: lead.name, subtitle: "Lead", html: `
    <div class="crm-drawer-head">${badge(label(LEAD_STATUS, lead.status), tone(LEAD_STATUS, lead.status))}${lead.value ? `<strong>${money(lead.value)}</strong>` : ""}</div>
    ${facts([["Empresa", lead.company], ["E-mail", lead.email], ["Telefone", lead.phone], ["Origem", SOURCES.find(([k]) => k === lead.source)?.[1] || lead.source], ["Campanha", campaign?.name], ["Criado em", dateTime(lead.created_at)], ["Atualizado", relative(lead.updated_at)]])}
    ${lead.notes ? `<div><h3>Observações</h3><p class="crm-notes">${esc(lead.notes)}</p></div>` : ""}
    <div class="crm-drawer-actions">${button({ label: "Converter em oportunidade", attr: "data-convert" })}${button({ label: "Converter em cliente", kind: "secondary", attr: "data-convert-client" })}${button({ label: "Agendar follow-up", kind: "secondary", attr: "data-followup" })}${button({ label: "Editar", kind: "secondary", attr: "data-edit" })}${lead.phone ? button({ label: "WhatsApp", kind: "secondary", attr: "data-whatsapp" }) : ""}</div>
    <div><h3>Follow-ups</h3><div data-followups>${stateBlock.loading("Carregando…")}</div></div>`,
    onOpen: async (body, close) => {
      body.querySelector("[data-convert]").addEventListener("click", () => { close(); convertLead(lead, after); });
      body.querySelector("[data-convert-client]").addEventListener("click", () => { close(); convertLeadToClient(lead, after); });
      body.querySelector("[data-followup]").addEventListener("click", () => { close(); followupForm({ lead_id: lead.id }, after); });
      body.querySelector("[data-edit]").addEventListener("click", () => { close(); leadForm(lead, after); });
      body.querySelector("[data-whatsapp]")?.addEventListener("click", async () => { close(); location.hash = "#caixa-de-entrada"; try { await window.FocusInbox?.openNumber(lead.phone); } catch (error) { toast(error.message, "error"); } });
      try { const all = (await api("/api/followups")).followups || []; const mine = all.filter((f) => String(f.lead_id) === String(lead.id)); body.querySelector("[data-followups]").innerHTML = mine.length ? `<div class="crm-followup-list">${mine.map((f) => `<div class="crm-followup ${f.done_at ? "is-done" : new Date(f.due_at) < new Date() ? "is-late" : ""}"><time>${esc(dateTime(f.due_at))}</time><div><strong>${esc(f.channel || "Contato")}</strong><small>${esc(f.note || "")}</small></div><span>${f.done_at ? badge("Feito", "green") : badge("Pendente", "orange")}</span></div>`).join("")}</div>` : `<p class="crm-hint">Nenhum follow-up para este lead.</p>`; } catch (error) { body.querySelector("[data-followups]").innerHTML = `<p class="crm-hint">${esc(error.message)}</p>`; }
    } });
  void d;
}

function convertLead(lead, after) {
  if (!lead) return;
  form({ title: "Converter em oportunidade", subtitle: lead.name, submitLabel: "Converter", values: { name: `${lead.name}${lead.company ? ` · ${lead.company}` : ""}`, amount: lead.value || "", createContact: true, createCompany: Boolean(lead.company) }, fields: [
    { name: "name", label: "Nome da oportunidade" },
    { name: "amount", label: "Valor (R$)", type: "number", required: false, half: true },
    { name: "expected_close", label: "Previsão de fechamento", type: "date", required: false, half: true },
    { name: "createContact", label: "", type: "checkbox", text: "Criar contato com os dados do lead" },
    { name: "createCompany", label: "", type: "checkbox", text: lead.company ? `Criar empresa "${lead.company}"` : "Criar empresa (lead sem empresa)" },
  ], onSubmit: async (values) => { await api(`/api/leads/${lead.id}/convert`, { method: "POST", body: values }); invalidate(); toast("Oportunidade criada no funil.", "success"); after(); } });
}

function convertLeadToClient(lead, after) {
  if (!lead) return;
  const proceed = async () => {
    action.disabled = true; action.textContent = "Convertendo...";
    try { await api(`/api/leads/${lead.id}/convert-to-client`, { method: "POST", body: {} }); invalidate(); toast("Cliente criado e histórico preservado.", "success"); after(); }
    catch (error) { action.disabled = false; action.textContent = "Converter em cliente"; toast(error.message, "error"); }
  };
  const action = document.createElement("button"); action.type = "button"; action.className = "ui-button"; action.textContent = "Converter em cliente"; action.addEventListener("click", proceed);
  drawer({ title: "Converter lead", subtitle: lead.name, html: `<p>O lead será vinculado a um contato, empresa e cliente existentes quando possível.</p>`, onOpen: (body, close) => { body.append(action); action.addEventListener("click", close, { once: true }); } });
}

/* ==========================================================================
   Funil e Oportunidades
   ========================================================================== */

async function renderFunnel() {
  dashboardGrid.innerHTML = header({ kicker: "CRM", title: "Funil de vendas", description: "Carregando…" }) + stateBlock.loading("Carregando funil…");
  await wrap("Funil de vendas", "CRM", (async () => {
    const opps = (await api("/api/opportunities")).opportunities || []; cache.opportunities = opps;
    const open = opps.filter((o) => !["won", "lost"].includes(o.stage));
    dashboardGrid.innerHTML = header({ kicker: "CRM", title: "Funil de vendas", description: `${open.length} em aberto · ${money(open.reduce((n, o) => n + Number(o.amount || 0), 0))} · arraste os cards entre os estágios`, actions: button({ label: "+ Oportunidade", attr: "data-new" }) })
      + `<section class="crm-kanban">${Object.entries(STAGES).map(([stage, [name, t]]) => { const list = opps.filter((o) => o.stage === stage); return `<section class="crm-column crm-column-${t}" data-column="${stage}"><h3>${name}<span>${list.length} · ${money(list.reduce((n, o) => n + Number(o.amount || 0), 0))}</span></h3><div class="crm-column-body">${list.map((o) => `<article class="crm-opp-card" draggable="true" data-opp="${esc(o.id)}"><strong>${esc(o.name)}</strong><b>${money(o.amount)}</b><small>${o.expected_close ? `Fecha em ${esc(date(o.expected_close))}` : "Sem previsão"}${o.probability != null ? ` · ${esc(o.probability)}%` : ""}</small></article>`).join("") || `<p class="crm-column-empty">Solte aqui</p>`}</div></section>`; }).join("")}</section>`;
    dashboardGrid.querySelector("[data-new]").addEventListener("click", () => opportunityForm(null, renderFunnel));
    dashboardGrid.querySelectorAll("[data-opp]").forEach((card) => { card.addEventListener("dragstart", (e) => { e.dataTransfer.setData("text/plain", card.dataset.opp); card.classList.add("is-dragging"); }); card.addEventListener("click", () => opportunityDrawer(opps.find((o) => String(o.id) === card.dataset.opp), renderFunnel)); });
    dashboardGrid.querySelectorAll("[data-column]").forEach((col) => {
      col.addEventListener("dragover", (e) => { e.preventDefault(); col.classList.add("is-drop-target"); });
      col.addEventListener("dragleave", () => col.classList.remove("is-drop-target"));
      col.addEventListener("drop", async (e) => { e.preventDefault(); col.classList.remove("is-drop-target"); const id = e.dataTransfer.getData("text/plain"); const o = opps.find((x) => String(x.id) === id); if (!o || o.stage === col.dataset.column) return; try { await api(`/api/opportunities/${id}`, { method: "PATCH", body: { stage: col.dataset.column } }); toast(`Movida para ${label(STAGES, col.dataset.column)}.`, "success"); renderFunnel(); } catch (error) { toast(error.message, "error"); } });
    });
  })());
}

const oppState = { query: "", stage: "open", sort: "amount" };
async function renderOpportunities() {
  dashboardGrid.innerHTML = header({ kicker: "CRM", title: "Oportunidades", description: "Carregando…" }) + stateBlock.loading("Carregando oportunidades…");
  await wrap("Oportunidades", "CRM", (async () => { const params = new URLSearchParams(); if (oppState.query.trim()) params.set("search", oppState.query.trim()); if (oppState.stage !== "all") params.set("stage", oppState.stage); const opps = (await api(`/api/opportunities?${params}`)).opportunities || []; cache.opportunities = opps; drawOpportunities(opps); })());
}

function drawOpportunities(opps) {
  const s = oppState, q = s.query.trim().toLocaleLowerCase("pt-BR");
  const list = opps.filter((o) => (s.stage === "all" || (s.stage === "open" ? !["won", "lost"].includes(o.stage) : o.stage === s.stage)) && (!q || o.name.toLocaleLowerCase("pt-BR").includes(q)))
    .sort((a, b) => s.sort === "close" ? (a.expected_close ? new Date(a.expected_close) : Infinity) - (b.expected_close ? new Date(b.expected_close) : Infinity) : s.sort === "recent" ? new Date(b.created_at) - new Date(a.created_at) : Number(b.amount || 0) - Number(a.amount || 0));
  const open = opps.filter((o) => !["won", "lost"].includes(o.stage)), won = opps.filter((o) => o.stage === "won");
  const weighted = open.reduce((n, o) => n + Number(o.amount || 0) * (o.probability != null ? Number(o.probability) / 100 : 0.5), 0);
  dashboardGrid.innerHTML = header({ kicker: "CRM", title: "Oportunidades", description: `${open.length} em aberto`, actions: button({ label: "Exportar CSV", kind: "secondary", attr: "data-export" }) + button({ label: "+ Oportunidade", attr: "data-new" }) })
    + stats([
      { label: "Em aberto", value: money(open.reduce((n, o) => n + Number(o.amount || 0), 0)), note: `${open.length} oportunidades` },
      { label: "Previsão ponderada", value: money(weighted), note: "valor × probabilidade" },
      { label: "Ganhas", value: money(won.reduce((n, o) => n + Number(o.amount || 0), 0)), note: `${won.length} negócios`, tone: "green" },
      { label: "Fecham em 30 dias", value: String(open.filter((o) => o.expected_close && new Date(o.expected_close) - Date.now() < 30 * 86400e3).length), note: "com previsão" },
    ])
    + `<section class="data-card crm-card">${toolbar({ search: { value: s.query, placeholder: "Buscar oportunidade…" }, filters: [
      { key: "stage", value: s.stage, options: [["open", "Em aberto"], ["all", "Todas"], ...Object.entries(STAGES).map(([k, [v]]) => [k, v])] },
      { key: "sort", value: s.sort, options: [["amount", "Maior valor"], ["close", "Fechamento próximo"], ["recent", "Mais recentes"]] },
    ], actions: `<a class="filter-button" href="#funil">Ver como funil</a>` })}
    ${list.length ? table({ columns: [
      { key: "name", label: "Oportunidade", render: (o) => `<strong>${esc(o.name)}</strong><small>${o.notes ? esc(o.notes).slice(0, 80) : "Sem observações"}</small>` },
      { key: "stage", label: "Estágio", render: (o) => `<select class="ui-select crm-inline-select" data-stage="${esc(o.id)}">${Object.entries(STAGES).map(([k, [v]]) => `<option value="${k}" ${o.stage === k ? "selected" : ""}>${v}</option>`).join("")}</select>` },
      { key: "amount", label: "Valor", align: "right", render: (o) => `<strong>${money(o.amount)}</strong>` },
      { key: "probability", label: "Prob.", align: "center", hideOnNarrow: true, render: (o) => (o.probability != null ? `${esc(o.probability)}%` : "—") },
      { key: "expected_close", label: "Previsão", hideOnNarrow: true, render: (o) => esc(date(o.expected_close)) },
      { key: "actions", label: "", align: "right", render: (o) => rowActions([{ label: "📄", title: "Criar proposta", attr: `data-proposal="${esc(o.id)}"` }, { label: "✎", title: "Editar", attr: `data-edit="${esc(o.id)}"` }, { label: "×", title: "Excluir", danger: true, attr: `data-delete="${esc(o.id)}"` }]) },
    ], rows: list, rowClass: () => "is-clickable", rowAttr: (o) => `data-open="${esc(o.id)}"` }) : empty({ title: opps.length ? "Nada com esses filtros." : "Nenhuma oportunidade.", text: opps.length ? "" : "Converta um lead ou crie uma oportunidade direto aqui.", cta: opps.length ? "" : "Criar oportunidade", attr: "data-new" })}
    </section>`;
  const refocus = keepSearchFocus(dashboardGrid), redraw = () => drawOpportunities(opps);
  dashboardGrid.querySelector("[data-search]")?.addEventListener("input", (e) => { s.query = e.target.value; clearTimeout(s.timer); s.timer = setTimeout(() => renderOpportunities(), 250); });
  dashboardGrid.querySelectorAll("[data-filter]").forEach((el) => el.addEventListener("change", () => { s[el.dataset.filter] = el.value; renderOpportunities(); }));
  dashboardGrid.querySelectorAll("[data-new]").forEach((b) => b.addEventListener("click", () => opportunityForm(null, renderOpportunities)));
  dashboardGrid.querySelector("[data-export]")?.addEventListener("click", () => downloadCsv("oportunidades.csv", ["Nome", "Estágio", "Valor", "Probabilidade", "Previsão", "Criado em"], list.map((o) => [o.name, label(STAGES, o.stage), o.amount, o.probability ?? "", o.expected_close || "", dateTime(o.created_at)])));
  dashboardGrid.querySelectorAll("[data-stage]").forEach((sel) => sel.addEventListener("change", async () => { try { await api(`/api/opportunities/${sel.dataset.stage}`, { method: "PATCH", body: { stage: sel.value } }); const o = opps.find((x) => String(x.id) === sel.dataset.stage); if (o) o.stage = sel.value; toast("Estágio atualizado.", "success"); redraw(); } catch (error) { toast(error.message, "error"); redraw(); } }));
  dashboardGrid.querySelectorAll("tr[data-open]").forEach((row) => row.addEventListener("click", (event) => { if (event.target.closest("button, select, a")) return; opportunityDrawer(opps.find((o) => String(o.id) === row.dataset.open), renderOpportunities); }));
  dashboardGrid.querySelectorAll("[data-edit]").forEach((b) => b.addEventListener("click", () => opportunityForm(opps.find((o) => String(o.id) === b.dataset.edit), renderOpportunities)));
  dashboardGrid.querySelectorAll("[data-proposal]").forEach((b) => b.addEventListener("click", () => proposalForm({ opportunity_id: b.dataset.proposal, title: `Proposta · ${opps.find((o) => String(o.id) === b.dataset.proposal)?.name || ""}` }, () => { location.hash = "#propostas"; })));
  dashboardGrid.querySelectorAll("[data-delete]").forEach((b) => b.addEventListener("click", () => confirmInline(b, { onConfirm: async () => { await api(`/api/opportunities/${b.dataset.delete}`, { method: "DELETE" }); toast("Oportunidade excluída."); renderOpportunities(); } })));
}

async function opportunityForm(opp, after) {
  const leads = await options("leads");
  form({ title: opp ? "Editar oportunidade" : "Nova oportunidade", subtitle: "CRM", submitLabel: opp ? "Salvar" : "Criar", values: opp ? { ...opp, lead_id: opp.lead_id ? String(opp.lead_id) : "" } : { stage: "prospecting", probability: 50 }, fields: [
    { name: "name", label: "Nome" },
    { name: "amount", label: "Valor (R$)", type: "number", half: true },
    { name: "probability", label: "Probabilidade (%)", type: "number", step: 1, min: 0, max: 100, required: false, half: true },
    { name: "stage", label: "Estágio", type: "select", options: Object.entries(STAGES).map(([k, [v]]) => [k, v]), half: true },
    { name: "expected_close", label: "Previsão de fechamento", type: "date", required: false, half: true },
    { name: "lead_id", label: "Lead de origem", type: "select", required: false, options: [["", "Sem lead"], ...leads.map((l) => [String(l.id), l.name])] },
    { name: "notes", label: "Observações", type: "textarea", required: false },
  ], onSubmit: async (values) => { if (values.lead_id === null) values.lead_id = null; if (opp) await api(`/api/opportunities/${opp.id}`, { method: "PATCH", body: values }); else await api("/api/opportunities", { method: "POST", body: values }); invalidate(); toast(opp ? "Oportunidade atualizada." : "Oportunidade criada.", "success"); after(); },
  danger: opp ? { label: "Excluir", onClick: async () => { await api(`/api/opportunities/${opp.id}`, { method: "DELETE" }); invalidate(); toast("Excluída."); after(); } } : null });
}

function opportunityDrawer(opp, after) {
  if (!opp) return;
  drawer({ title: opp.name, subtitle: "Oportunidade", html: `
    <div class="crm-drawer-head">${badge(label(STAGES, opp.stage), tone(STAGES, opp.stage))}<strong>${money(opp.amount)}</strong></div>
    ${facts([["Probabilidade", opp.probability != null ? `${opp.probability}%` : null], ["Previsão", opp.expected_close ? date(opp.expected_close) : null], ["Criada em", dateTime(opp.created_at)], ["Atualizada", relative(opp.updated_at)]])}
    ${opp.notes ? `<div><h3>Observações</h3><p class="crm-notes">${esc(opp.notes)}</p></div>` : ""}
    <div class="crm-drawer-actions">${button({ label: "Criar proposta", attr: "data-proposal" })}${button({ label: "Editar", kind: "secondary", attr: "data-edit" })}${!["won", "lost"].includes(opp.stage) ? button({ label: "Marcar ganha", kind: "secondary", attr: "data-won" }) + button({ label: "Marcar perdida", kind: "secondary", attr: "data-lost" }) : ""}</div>
    <div><h3>Propostas</h3><div data-proposals>${stateBlock.loading("Carregando…")}</div></div>`,
    onOpen: async (body, close) => {
      body.querySelector("[data-proposal]").addEventListener("click", () => { close(); proposalForm({ opportunity_id: opp.id, title: `Proposta · ${opp.name}`, amount: opp.amount }, () => { location.hash = "#propostas"; }); });
      body.querySelector("[data-edit]").addEventListener("click", () => { close(); opportunityForm(opp, after); });
      body.querySelector("[data-won]")?.addEventListener("click", async () => { try { await api(`/api/opportunities/${opp.id}`, { method: "PATCH", body: { stage: "won" } }); close(); toast("Negócio ganho! 🎉", "success"); after(); } catch (error) { toast(error.message, "error"); } });
      body.querySelector("[data-lost]")?.addEventListener("click", async () => { try { await api(`/api/opportunities/${opp.id}`, { method: "PATCH", body: { stage: "lost" } }); close(); toast("Marcada como perdida."); after(); } catch (error) { toast(error.message, "error"); } });
      try { const all = (await api("/api/proposals")).proposals || []; const mine = all.filter((p) => String(p.opportunity_id) === String(opp.id)); body.querySelector("[data-proposals]").innerHTML = mine.length ? mine.map((p) => `<div class="crm-followup"><time>${esc(date(p.created_at))}</time><div><strong>${esc(p.title)}</strong><small>${money(p.amount)}</small></div><span>${badge(label(PROPOSAL_STATUS, p.status), tone(PROPOSAL_STATUS, p.status))}</span></div>`).join("") : `<p class="crm-hint">Nenhuma proposta ainda.</p>`; } catch (error) { body.querySelector("[data-proposals]").innerHTML = `<p class="crm-hint">${esc(error.message)}</p>`; }
    } });
}

/* ==========================================================================
   Campanhas
   ========================================================================== */

async function renderCampaigns() {
  dashboardGrid.innerHTML = header({ kicker: "Marketing", title: "Campanhas", description: "Carregando…" }) + stateBlock.loading("Carregando campanhas…");
  await wrap("Campanhas", "Marketing", (async () => {
    const campaigns = (await api("/api/campaigns")).campaigns || []; cache.campaigns = campaigns;
    const active = campaigns.filter((c) => c.status === "active");
    dashboardGrid.innerHTML = header({ kicker: "Marketing", title: "Campanhas", description: `${active.length} ativas · ${money(active.reduce((n, c) => n + Number(c.budget || 0), 0))} em orçamento ativo`, actions: button({ label: "+ Nova campanha", attr: "data-new" }) })
      + stats([{ label: "Ativas", value: String(active.length) }, { label: "Orçamento total", value: money(campaigns.reduce((n, c) => n + Number(c.budget || 0), 0)) }, { label: "Leads gerados", value: String(campaigns.reduce((n, c) => n + Number(c.leads_count || 0), 0)), note: "leads com campanha" }, { label: "Concluídas", value: String(campaigns.filter((c) => c.status === "done").length) }])
      + `<section class="data-card crm-card">${campaigns.length ? table({ columns: [
        { key: "name", label: "Campanha", render: (c) => `<strong>${esc(c.name)}</strong><small>${esc(CHANNELS[c.channel] || c.channel)}${c.starts_on ? ` · ${esc(date(c.starts_on))}${c.ends_on ? ` → ${esc(date(c.ends_on))}` : ""}` : ""}</small>` },
        { key: "status", label: "Situação", render: (c) => badge(label(CAMPAIGN_STATUS, c.status), tone(CAMPAIGN_STATUS, c.status)) },
        { key: "budget", label: "Orçamento", align: "right", render: (c) => money(c.budget) },
        { key: "leads_count", label: "Leads", align: "center", render: (c) => `<strong>${esc(c.leads_count || 0)}</strong>` },
        { key: "cpl", label: "Custo por lead", align: "right", hideOnNarrow: true, render: (c) => (Number(c.leads_count) ? money(Number(c.budget || 0) / Number(c.leads_count)) : "—") },
        { key: "actions", label: "", align: "right", render: (c) => rowActions([...(c.status === "active" ? [{ label: "⏸", title: "Pausar", attr: `data-set="${esc(c.id)}:paused"` }] : c.status !== "done" ? [{ label: "▶", title: "Ativar", attr: `data-set="${esc(c.id)}:active"` }] : []), ...(c.status !== "done" ? [{ label: "✔", title: "Concluir", attr: `data-set="${esc(c.id)}:done"` }] : []), { label: "✎", title: "Editar", attr: `data-edit="${esc(c.id)}"` }, { label: "×", title: "Excluir", danger: true, attr: `data-delete="${esc(c.id)}"` }]) },
      ], rows: campaigns }) : empty({ title: "Nenhuma campanha.", text: "Registre ações de marketing e associe leads a elas para medir o custo por lead.", cta: "Criar campanha", attr: "data-new" })}</section>`;
    dashboardGrid.querySelectorAll("[data-new]").forEach((b) => b.addEventListener("click", () => campaignForm(null, renderCampaigns)));
    dashboardGrid.querySelectorAll("[data-edit]").forEach((b) => b.addEventListener("click", () => campaignForm(campaigns.find((c) => String(c.id) === b.dataset.edit), renderCampaigns)));
    dashboardGrid.querySelectorAll("[data-set]").forEach((b) => b.addEventListener("click", async () => { const [id, status] = b.dataset.set.split(":"); try { await api(`/api/campaigns/${id}`, { method: "PATCH", body: { status } }); toast("Campanha atualizada.", "success"); renderCampaigns(); } catch (error) { toast(error.message, "error"); } }));
    dashboardGrid.querySelectorAll("[data-delete]").forEach((b) => b.addEventListener("click", () => confirmInline(b, { onConfirm: async () => { await api(`/api/campaigns/${b.dataset.delete}`, { method: "DELETE" }); toast("Campanha excluída."); renderCampaigns(); } })));
  })());
}

function campaignForm(c, after) {
  form({ title: c ? "Editar campanha" : "Nova campanha", subtitle: "Marketing", submitLabel: c ? "Salvar" : "Criar", values: c || { channel: "email", status: "draft", budget: 0 }, fields: [
    { name: "name", label: "Nome" },
    { name: "channel", label: "Canal", type: "select", options: Object.entries(CHANNELS), half: true },
    { name: "status", label: "Situação", type: "select", options: Object.entries(CAMPAIGN_STATUS).map(([k, [v]]) => [k, v]), half: true },
    { name: "budget", label: "Orçamento (R$)", type: "number", half: true },
    { name: "starts_on", label: "Início", type: "date", required: false, half: true },
    { name: "ends_on", label: "Fim", type: "date", required: false, half: true },
  ], onSubmit: async (values) => { if (c) await api(`/api/campaigns/${c.id}`, { method: "PATCH", body: values }); else await api("/api/campaigns", { method: "POST", body: values }); invalidate(); toast(c ? "Campanha atualizada." : "Campanha criada.", "success"); after(); } });
}

/* ==========================================================================
   Propostas
   ========================================================================== */

const proposalState = { query: "", status: "all" };
async function renderProposals() {
  dashboardGrid.innerHTML = header({ kicker: "CRM", title: "Propostas", description: "Carregando…" }) + stateBlock.loading("Carregando propostas…");
  await wrap("Propostas", "CRM", (async () => {
    const params = new URLSearchParams();
    if (proposalState.query.trim()) params.set("search", proposalState.query.trim());
    if (proposalState.status !== "all") params.set("status", proposalState.status);
    const proposals = (await api(`/api/proposals?${params}`)).proposals || [];
    const sent = proposals.filter((p) => p.status === "sent"), accepted = proposals.filter((p) => p.status === "accepted");
    const rate = proposals.filter((p) => ["accepted", "rejected"].includes(p.status)).length ? Math.round((accepted.length / proposals.filter((p) => ["accepted", "rejected"].includes(p.status)).length) * 100) : null;
    dashboardGrid.innerHTML = header({ kicker: "CRM", title: "Propostas", description: `${sent.length} aguardando resposta · ${money(sent.reduce((n, p) => n + Number(p.amount || 0), 0))}`, actions: button({ label: "+ Nova proposta", attr: "data-new" }) })
      + stats([{ label: "Enviadas", value: String(sent.length), note: money(sent.reduce((n, p) => n + Number(p.amount || 0), 0)) }, { label: "Aceitas", value: String(accepted.length), note: money(accepted.reduce((n, p) => n + Number(p.amount || 0), 0)), tone: "green" }, { label: "Taxa de aceite", value: rate === null ? "—" : `${rate}%` }, { label: "Rascunhos", value: String(proposals.filter((p) => p.status === "draft").length) }])
      + `<section class="data-card crm-card">${toolbar({ search: { value: proposalState.query, placeholder: "Buscar proposta..." }, filters: [
        { key: "status", value: proposalState.status, options: [["all", "Todas"], ...Object.entries(PROPOSAL_STATUS).map(([k, [v]]) => [k, v])] },
      ] })}${proposals.length ? table({ columns: [
        { key: "title", label: "Proposta", render: (p) => `<strong>${esc(p.title)}</strong><small>${esc(p.opportunity_name || p.lead_name || "Sem vínculo")}${p.items_count ? ` · ${esc(p.items_count)} ${p.items_count === 1 ? "item" : "itens"}` : ""}</small>` },
        { key: "status", label: "Situação", render: (p) => badge(label(PROPOSAL_STATUS, p.status), tone(PROPOSAL_STATUS, p.status)) },
        { key: "amount", label: "Valor", align: "right", render: (p) => `<strong>${money(p.amount)}</strong>` },
        { key: "valid_until", label: "Validade", hideOnNarrow: true, render: (p) => (p.valid_until ? `<span class="${new Date(p.valid_until) < new Date() && p.status === "sent" ? "crm-error" : ""}">${esc(date(p.valid_until))}</span>` : "—") },
        { key: "sent_at", label: "Enviada", hideOnNarrow: true, render: (p) => esc(p.sent_at ? relative(p.sent_at) : "—") },
        { key: "actions", label: "", align: "right", render: (p) => rowActions([{ label: "🧾", title: "Itens e detalhes", attr: `data-open="${esc(p.id)}"` }, ...(p.status === "draft" ? [{ label: "📤", title: "Marcar como enviada", attr: `data-set="${esc(p.id)}:sent"` }] : []), ...(p.status === "sent" ? [{ label: "✔", title: "Aceita", attr: `data-set="${esc(p.id)}:accepted"` }, { label: "✖", title: "Recusada", attr: `data-set="${esc(p.id)}:rejected"` }] : []), { label: "✎", title: "Editar", attr: `data-edit="${esc(p.id)}"` }, { label: "×", title: "Excluir", danger: true, attr: `data-delete="${esc(p.id)}"` }]) },
      ], rows: proposals }) : empty({ title: "Nenhuma proposta.", text: "Monte propostas com itens do catálogo a partir de uma oportunidade.", cta: "Criar proposta", attr: "data-new" })}</section>`;
    dashboardGrid.querySelector("[data-search]")?.addEventListener("input", (e) => { proposalState.query = e.target.value; clearTimeout(proposalState.timer); proposalState.timer = setTimeout(() => renderProposals(), 250); });
    dashboardGrid.querySelectorAll("[data-filter]").forEach((el) => el.addEventListener("change", () => { proposalState[el.dataset.filter] = el.value; renderProposals(); }));
    dashboardGrid.querySelectorAll("[data-new]").forEach((b) => b.addEventListener("click", () => proposalForm(null, renderProposals)));
    dashboardGrid.querySelectorAll("[data-edit]").forEach((b) => b.addEventListener("click", () => proposalForm(proposals.find((p) => String(p.id) === b.dataset.edit), renderProposals)));
    dashboardGrid.querySelectorAll("[data-open]").forEach((b) => b.addEventListener("click", () => proposalDrawer(b.dataset.open, renderProposals)));
    dashboardGrid.querySelectorAll("[data-contract]").forEach((b) => b.addEventListener("click", () => { sessionStorage.setItem("focusdev.contractProposalId", b.dataset.contract); location.hash = "#contratos"; }));
    dashboardGrid.querySelectorAll("[data-set]").forEach((b) => b.addEventListener("click", async () => { const [id, status] = b.dataset.set.split(":"); try { await api(`/api/proposals/${id}`, { method: "PATCH", body: { status } }); toast(status === "accepted" ? "Proposta aceita — oportunidade marcada como ganha." : status === "sent" ? "Marcada como enviada." : "Proposta recusada.", status === "rejected" ? "info" : "success"); renderProposals(); } catch (error) { toast(error.message, "error"); } }));
    dashboardGrid.querySelectorAll("tbody tr").forEach((row, index) => { const proposal = proposals[index], cell = row.lastElementChild; if (!proposal || !cell) return; if (["sent", "viewed", "negotiation"].includes(proposal.status)) { const share = document.createElement("button"); share.type = "button"; share.className = "compact-action"; share.textContent = "Link para aprovação"; share.addEventListener("click", async () => { share.disabled = true; share.textContent = "Gerando..."; try { const data = await api(`/api/proposals/${proposal.id}/public-link`, { method: "POST", body: {} }); const link = `${location.origin}${data.path}`; await navigator.clipboard?.writeText(link); share.textContent = "Link copiado"; toast("Link de aprovação copiado.", "success"); } catch (error) { share.disabled = false; share.textContent = "Link para aprovação"; toast(error.message, "error"); } }); cell.append(" ", share); } if (proposal.status !== "accepted") return; const button = document.createElement("button"); button.type = "button"; button.className = "compact-action"; button.textContent = "Gerar contrato"; button.title = "Abrir contrato preenchido pela proposta"; button.addEventListener("click", () => { sessionStorage.setItem("focusdev.contractProposalId", proposal.id); location.hash = "#contratos"; }); cell.append(" ", button); });
    dashboardGrid.querySelectorAll("[data-delete]").forEach((b) => b.addEventListener("click", () => confirmInline(b, { onConfirm: async () => { await api(`/api/proposals/${b.dataset.delete}`, { method: "DELETE" }); toast("Proposta excluída."); renderProposals(); } })));
  })());
}

async function proposalForm(p, after) {
  const [opps, leads, clients, projects] = await Promise.all([options("opportunities"), options("leads"), options("clients"), options("projects")]);
  form({ title: p?.id ? "Editar proposta" : "Nova proposta", subtitle: "CRM", submitLabel: p?.id ? "Salvar" : "Criar", values: p ? { ...p, opportunity_id: p.opportunity_id ? String(p.opportunity_id) : "", lead_id: p.lead_id ? String(p.lead_id) : "", client_id: p.client_id ? String(p.client_id) : "", project_id: p.project_id ? String(p.project_id) : "" } : {}, fields: [
    { name: "title", label: "Título" },
    { name: "opportunity_id", label: "Oportunidade", type: "select", required: false, options: [["", "Sem oportunidade"], ...opps.map((o) => [String(o.id), `${o.name} · ${money(o.amount)}`])], half: true },
    { name: "lead_id", label: "Lead", type: "select", required: false, options: [["", "Sem lead"], ...leads.map((l) => [String(l.id), l.name])], half: true },
    { name: "client_id", label: "Cliente", type: "select", required: false, options: [["", "Sem cliente"], ...clients.map((c) => [String(c.id), c.name])], half: true },
    { name: "project_id", label: "Projeto", type: "select", required: false, options: [["", "Sem projeto"], ...projects.map((project) => [String(project.id), project.name])], half: true },
    { name: "amount", label: "Valor (R$)", type: "number", required: false, half: true, help: "Com itens, o valor é a soma deles." },
    { name: "valid_until", label: "Válida até", type: "date", required: false, half: true },
    { name: "payment_method", label: "Forma de pagamento", required: false, half: true },
    { name: "down_payment", label: "Entrada (R$)", type: "number", min: 0, required: false, half: true },
    { name: "installments", label: "Quantidade de parcelas", type: "number", min: 1, step: 1, required: false, half: true },
    { name: "service_type", label: "Tipo de serviço", required: false, half: true },
    { name: "scope_included", label: "Escopo incluído", type: "textarea", required: false, rows: 3 },
    { name: "proposal_terms", label: "Termos comerciais", type: "textarea", required: false, rows: 3 },
    { name: "notes", label: "Condições / observações", type: "textarea", required: false, rows: 4 },
  ], onSubmit: async (values) => { if (values.amount === null) values.amount = 0; if (p?.id) await api(`/api/proposals/${p.id}`, { method: "PATCH", body: values }); else { const { proposal } = await api("/api/proposals", { method: "POST", body: values }); toast("Proposta criada. Adicione os itens.", "success"); after(); proposalDrawer(proposal.id, after); return; } toast("Proposta atualizada.", "success"); after(); } });
}

async function proposalDrawer(id, after) {
  const d = drawer({ title: "Proposta", subtitle: "Carregando…", html: stateBlock.loading("Carregando proposta…") });
  try {
    const { proposal: p } = await api(`/api/proposals/${id}`);
    const catalog = await options("catalog");
    let items = (p.items || []).map((i) => ({ ...i }));
    const pendingCatalogId = sessionStorage.getItem("focusdev.catalogItemId");
    const pendingCatalogItem = catalog.find((item) => String(item.id) === pendingCatalogId);
    if (pendingCatalogItem && !items.some((item) => String(item.catalog_item_id) === pendingCatalogId)) { items.push({ description: pendingCatalogItem.name, quantity: 1, unit_price: pendingCatalogItem.price, catalog_item_id: pendingCatalogItem.id }); sessionStorage.removeItem("focusdev.catalogItemId"); }
    const render = () => {
      const total = items.reduce((n, i) => n + Number(i.quantity || 0) * Number(i.unit_price || 0), 0);
      d.body.innerHTML = `
        <div class="crm-drawer-head">${badge(label(PROPOSAL_STATUS, p.status), tone(PROPOSAL_STATUS, p.status))}<strong>${money(total || p.amount)}</strong></div>
        <h2 class="crm-drawer-title">${esc(p.title)}</h2>
        ${facts([["Oportunidade", p.opportunity_name], ["Lead", p.lead_name], ["Validade", p.valid_until ? date(p.valid_until) : null], ["Enviada em", p.sent_at ? dateTime(p.sent_at) : null], ["Decidida em", p.decided_at ? dateTime(p.decided_at) : null]])}
        ${p.notes ? `<div><h3>Condições</h3><p class="crm-notes">${esc(p.notes)}</p></div>` : ""}
        <div><h3>Itens</h3>
          <div class="crm-items">${items.length ? items.map((i, index) => `<div class="crm-item"><input type="text" value="${esc(i.description)}" data-item="${index}" data-field="description" placeholder="Descrição" /><input type="number" step="0.01" min="0.01" value="${esc(i.quantity)}" data-item="${index}" data-field="quantity" aria-label="Quantidade" /><input type="number" step="0.01" min="0" value="${esc(i.unit_price)}" data-item="${index}" data-field="unit_price" aria-label="Preço unitário" /><b>${money(Number(i.quantity || 0) * Number(i.unit_price || 0))}</b><button class="ui-icon is-danger" type="button" data-remove="${index}" aria-label="Remover">×</button></div>`).join("") : `<p class="crm-hint">Nenhum item. Adicione do catálogo ou um item livre.</p>`}</div>
          <div class="crm-items-actions">${catalog.length ? `<select class="ui-select" data-catalog><option value="">Adicionar do catálogo…</option>${catalog.filter((c) => c.active !== false).map((c) => `<option value="${esc(c.id)}">${esc(c.name)} · ${money(c.price)}</option>`).join("")}</select>` : `<a class="text-action" href="#catalogo">Cadastrar itens no catálogo →</a>`}<button class="text-action" type="button" data-add>+ Item livre</button><span></span>${button({ label: "Salvar itens", kind: "secondary", attr: "data-save" })}</div>
          <p class="crm-items-total">Subtotal: <strong>${money(total)}</strong></p>
          <div class="crm-pricing"><label>Desconto<input type="number" min="0" step="0.01" data-price="discount" value="${esc(p.discount || 0)}"></label><label>Taxas adicionais<input type="number" min="0" step="0.01" data-price="additional_fees" value="${esc(p.additional_fees || 0)}"></label><label>Entrada<input type="number" min="0" step="0.01" data-price="down_payment" value="${esc(p.down_payment || 0)}"></label><label>Parcelas<input type="number" min="1" step="1" data-price="installments" value="${esc(p.installments || 1)}"></label><button class="compact-action" type="button" data-recalculate>Calcular valores</button><p data-price-summary>Valor final: ${money(p.final_amount ?? total)} · Saldo: ${money(p.balance_remaining ?? total)}</p></div>
        </div>
        <div class="crm-drawer-actions">${p.status === "draft" ? button({ label: "Marcar como enviada", attr: 'data-status="sent"' }) : ""}${p.status === "sent" ? button({ label: "Aceita", attr: 'data-status="accepted"' }) + button({ label: "Recusada", kind: "secondary", attr: 'data-status="rejected"' }) : ""}${button({ label: "Imprimir / PDF", kind: "secondary", attr: "data-print" })}${button({ label: "Editar", kind: "secondary", attr: "data-edit" })}</div>`;
      d.body.querySelectorAll("[data-item]").forEach((input) => input.addEventListener("input", () => { items[Number(input.dataset.item)][input.dataset.field] = input.value; if (input.dataset.field !== "description") render(); }));
      d.body.querySelectorAll("[data-remove]").forEach((b) => b.addEventListener("click", () => { items.splice(Number(b.dataset.remove), 1); render(); }));
      d.body.querySelector("[data-add]").addEventListener("click", () => { items.push({ description: "", quantity: 1, unit_price: 0 }); render(); d.body.querySelector(`[data-item="${items.length - 1}"][data-field="description"]`)?.focus(); });
      d.body.querySelector("[data-catalog]")?.addEventListener("change", (e) => { const c = catalog.find((x) => String(x.id) === e.target.value); if (c) { items.push({ description: c.name, quantity: 1, unit_price: c.price, catalog_item_id: c.id }); render(); } });
      const pricingValues = () => Object.fromEntries([...d.body.querySelectorAll("[data-price]")].map((input) => [input.dataset.price, input.value]));
      const updatePricingPreview = () => {
        const values = pricingValues(), discount = Number(values.discount || 0), fees = Number(values.additional_fees || 0), down = Number(values.down_payment || 0), installments = Math.max(1, Number(values.installments || 1));
        const finalAmount = Math.max(0, total - discount + fees), balance = Math.max(0, finalAmount - down), installmentAmount = balance / installments;
        const summary = d.body.querySelector("[data-price-summary]");
        if (summary) summary.textContent = `Valor final: ${money(finalAmount)} · Entrada: ${money(down)} · Saldo: ${money(balance)} · ${installments}x de ${money(installmentAmount)}`;
      };
      d.body.querySelectorAll("[data-price]").forEach((input) => input.addEventListener("input", updatePricingPreview));
      d.body.querySelector("[data-save]").addEventListener("click", async () => { try { const { proposal } = await api(`/api/proposals/${p.id}/items`, { method: "PUT", body: { items } }); p.amount = proposal.amount; const pricing = await api(`/api/proposals/${p.id}/recalculate`, { method: "POST", body: pricingValues() }); Object.assign(p, pricing.proposal); toast("Itens e valores salvos.", "success"); after(); render(); } catch (error) { toast(error.message, "error"); } });
      d.body.querySelectorAll("[data-status]").forEach((b) => b.addEventListener("click", async () => { try { await api(`/api/proposals/${p.id}`, { method: "PATCH", body: { status: b.dataset.status } }); d.close(); toast("Situação atualizada.", "success"); after(); } catch (error) { toast(error.message, "error"); } }));
      d.body.querySelector("[data-edit]").addEventListener("click", () => { d.close(); proposalForm(p, after); });
      d.body.querySelector("[data-print]").addEventListener("click", () => printProposal(p, items));
    };
    render();
    d.body.addEventListener("click", async (event) => { const button = event.target.closest?.("[data-recalculate]"); if (!button) return; const values = Object.fromEntries([...d.body.querySelectorAll("[data-price]")].map((input) => [input.dataset.price, input.value])); button.disabled = true; try { const data = await api(`/api/proposals/${p.id}/recalculate`, { method: "POST", body: values }); Object.assign(p, data.proposal); render(); toast("Valores da proposta recalculados.", "success"); } catch (error) { toast(error.message, "error"); } finally { button.disabled = false; } });
  } catch (error) { d.body.innerHTML = stateBlock.error(error.message, "crm-drawer-retry"); }
}

function printProposal(p, items) {
  const total = items.reduce((n, i) => n + Number(i.quantity || 0) * Number(i.unit_price || 0), 0);
  const win = window.open("", "_blank", "width=900,height=1000");
  if (!win) { toast("O navegador bloqueou a janela de impressão.", "error"); return; }
  win.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(p.title)}</title><style>body{font-family:Inter,Segoe UI,Arial,sans-serif;color:#0f1f45;margin:40px;max-width:800px}h1{font-size:26px;margin:0 0 4px}small{color:#6b7a99}table{width:100%;border-collapse:collapse;margin:24px 0}th,td{padding:10px 8px;border-bottom:1px solid #d7dfeb;text-align:left;font-size:14px}th{font-size:11px;text-transform:uppercase;color:#6b7a99}td.r,th.r{text-align:right}tfoot td{font-weight:800;font-size:16px}.brand{font-weight:800;font-size:22px;letter-spacing:-.04em;margin-bottom:24px}.brand span:first-child{color:#0d4fc2}.brand span:last-child{color:#f3132d}p.notes{white-space:pre-wrap;line-height:1.6}</style></head><body><div class="brand"><span>Focus</span><span>Dev</span></div><h1>${esc(p.title)}</h1><small>${esc(p.opportunity_name || p.lead_name || "")}${p.valid_until ? ` · válida até ${esc(date(p.valid_until))}` : ""} · emitida em ${esc(date(new Date()))}</small><table><thead><tr><th>Item</th><th class="r">Qtd.</th><th class="r">Unitário</th><th class="r">Subtotal</th></tr></thead><tbody>${items.map((i) => `<tr><td>${esc(i.description)}</td><td class="r">${esc(i.quantity)}</td><td class="r">${money(i.unit_price)}</td><td class="r">${money(Number(i.quantity) * Number(i.unit_price))}</td></tr>`).join("") || `<tr><td colspan="4">Valor fechado</td></tr>`}</tbody><tfoot><tr><td colspan="3">Total</td><td class="r">${money(total || p.amount)}</td></tr></tfoot></table>${p.notes ? `<h3>Condições</h3><p class="notes">${esc(p.notes)}</p>` : ""}<script>window.onload=()=>window.print()<\/script></body></html>`);
  win.document.close();
}

/* ==========================================================================
   Follow-ups
   ========================================================================== */

const followupState = { query: "", status: "open", channel: "all" };
async function renderFollowups() {
  dashboardGrid.innerHTML = header({ kicker: "CRM", title: "Follow-ups", description: "Carregando…" }) + stateBlock.loading("Carregando follow-ups…");
  await wrap("Follow-ups", "CRM", (async () => {
    const params = new URLSearchParams();
    if (followupState.query.trim()) params.set("search", followupState.query.trim());
    if (followupState.status !== "all") params.set("status", followupState.status);
    if (followupState.channel !== "all") params.set("channel", followupState.channel);
    const items = (await api(`/api/followups?${params}`)).followups || [];
    const now = new Date(), today = now.toDateString();
    const pending = items.filter((f) => !f.done_at), done = items.filter((f) => f.done_at);
    const groups = [["late", "Atrasados", pending.filter((f) => new Date(f.due_at) < now && new Date(f.due_at).toDateString() !== today)], ["today", "Hoje", pending.filter((f) => new Date(f.due_at).toDateString() === today)], ["next", "Próximos", pending.filter((f) => new Date(f.due_at) > now && new Date(f.due_at).toDateString() !== today)], ["done", "Concluídos", done.slice(0, 15)]];
    const row = (f, isDone) => `<div class="crm-followup ${isDone ? "is-done" : new Date(f.due_at) < now && new Date(f.due_at).toDateString() !== today ? "is-late" : ""}"><label class="crm-check"><input type="checkbox" data-toggle="${esc(f.id)}" ${isDone ? "checked" : ""} aria-label="Concluir" /><span></span></label><time>${esc(dateTime(f.due_at))}</time><div><strong>${esc(f.lead_name || "Lead")}</strong><small>${esc(f.channel || "Contato")}${f.note ? ` · ${esc(f.note)}` : ""}</small></div><span>${badge(label(LEAD_STATUS, f.lead_status), tone(LEAD_STATUS, f.lead_status))}</span>${rowActions([...(f.lead_phone ? [{ label: "🟢", title: "Abrir WhatsApp", attr: `data-wa="${esc(String(f.lead_phone).replace(/\\D/g, ""))}"` }] : []), { label: "✎", title: "Editar", attr: `data-edit="${esc(f.id)}"` }, { label: "×", title: "Excluir", danger: true, attr: `data-delete="${esc(f.id)}"` }])}</div>`;
    dashboardGrid.innerHTML = header({ kicker: "CRM", title: "Follow-ups", description: `${pending.length} pendentes${groups[0][2].length ? ` · <span class="crm-error">${groups[0][2].length} atrasados</span>` : ""}`, actions: button({ label: "+ Novo follow-up", attr: "data-new" }) })
      + stats([{ label: "Atrasados", value: String(groups[0][2].length), tone: groups[0][2].length ? "red" : undefined }, { label: "Hoje", value: String(groups[1][2].length), tone: "orange" }, { label: "Próximos", value: String(groups[2][2].length) }, { label: "Concluídos", value: String(done.length), tone: "green" }])
      + `<section class="data-card crm-card">${pending.length || done.length ? groups.filter(([, , list]) => list.length).map(([k, name, list]) => `<section class="crm-group crm-group-${k}"><h3>${name} <span>${list.length}</span></h3><div class="crm-followup-list">${list.map((f) => row(f, k === "done")).join("")}</div></section>`).join("") : empty({ title: "Nenhum follow-up.", text: "Agende o próximo contato com cada lead e acompanhe por aqui.", cta: "Agendar follow-up", attr: "data-new" })}</section>`;
    const followupCard = dashboardGrid.querySelector(".crm-card");
    const followupToolbar = toolbar({ search: { value: followupState.query, placeholder: "Buscar follow-up..." }, filters: [{ key: "status", value: followupState.status, options: [["open", "Pendentes"], ["all", "Todos"], ["late", "Atrasados"], ["today", "Hoje"], ["done", "Concluídos"]] }, { key: "channel", value: followupState.channel, options: [["all", "Todos os canais"], ["whatsapp", "WhatsApp"], ["ligacao", "Ligação"], ["email", "E-mail"], ["reuniao", "Reunião"]] }] });
    if (followupCard) followupCard.insertAdjacentHTML("afterbegin", followupToolbar);
    dashboardGrid.querySelector("[data-search]")?.addEventListener("input", (e) => { followupState.query = e.target.value; clearTimeout(followupState.timer); followupState.timer = setTimeout(() => renderFollowups(), 250); });
    dashboardGrid.querySelectorAll("[data-filter]").forEach((el) => el.addEventListener("change", () => { followupState[el.dataset.filter] = el.value; renderFollowups(); }));
    dashboardGrid.querySelectorAll("[data-new]").forEach((b) => b.addEventListener("click", () => followupForm(null, renderFollowups)));
    dashboardGrid.querySelectorAll("[data-toggle]").forEach((input) => input.addEventListener("change", async () => { try { await api(`/api/followups/${input.dataset.toggle}`, { method: "PATCH", body: { done: input.checked } }); toast(input.checked ? "Follow-up concluído." : "Reaberto.", "success"); renderFollowups(); } catch (error) { toast(error.message, "error"); input.checked = !input.checked; } }));
    dashboardGrid.querySelectorAll("[data-edit]").forEach((b) => b.addEventListener("click", () => followupForm(items.find((f) => String(f.id) === b.dataset.edit), renderFollowups)));
    dashboardGrid.querySelectorAll("[data-wa]").forEach((b) => b.addEventListener("click", () => window.open(`https://wa.me/${b.dataset.wa}`, "_blank", "noopener")));
    dashboardGrid.querySelectorAll("[data-delete]").forEach((b) => b.addEventListener("click", () => confirmInline(b, { onConfirm: async () => { await api(`/api/followups/${b.dataset.delete}`, { method: "DELETE" }); toast("Follow-up excluído."); renderFollowups(); } })));
  })());
}

async function followupForm(f, after) {
  const leads = await options("leads");
  const editing = Boolean(f?.id);
  form({ title: editing ? "Editar follow-up" : "Novo follow-up", subtitle: "CRM", submitLabel: editing ? "Salvar" : "Agendar", values: { ...(f || {}), lead_id: f?.lead_id ? String(f.lead_id) : "", due_at: f?.due_at || new Date(Date.now() + 86400e3).toISOString(), channel: f?.channel || "whatsapp" }, fields: [
    { name: "lead_id", label: "Lead", type: "select", options: leads.length ? leads.map((l) => [String(l.id), `${l.name}${l.company ? ` · ${l.company}` : ""}`]) : [["", "Nenhum lead cadastrado"]] },
    { name: "due_at", label: "Quando", type: "datetime-local", half: true },
    { name: "channel", label: "Canal", type: "select", options: [["whatsapp", "WhatsApp"], ["ligacao", "Ligação"], ["email", "E-mail"], ["reuniao", "Reunião"], ["outro", "Outro"]], half: true },
    { name: "note", label: "O que fazer", type: "textarea", required: false, rows: 3, placeholder: "Ex.: enviar proposta revisada" },
  ], onSubmit: async (values) => { if (!values.lead_id) throw new Error("Cadastre um lead antes de agendar."); if (editing) await api(`/api/followups/${f.id}`, { method: "PATCH", body: values }); else await api("/api/followups", { method: "POST", body: values }); toast(editing ? "Follow-up atualizado." : "Follow-up agendado.", "success"); after(); } });
}

registerRoutes({ crm: renderHub, leads: renderLeads, funil: renderFunnel, oportunidades: renderOpportunities, campanhas: renderCampaigns, propostas: renderProposals, "follow-ups": renderFollowups }, { parent: "#crm", titles: { crm: "CRM comercial", leads: "Leads", funil: "Funil de vendas", oportunidades: "Oportunidades", campanhas: "Campanhas", propostas: "Propostas", "follow-ups": "Follow-ups" } });
followupForm = async function followupFormConnected(f, after) {
  const [leads, clients, opportunities] = await Promise.all([options("leads"), options("clients"), options("opportunities")]);
  const editing = Boolean(f?.id);
  form({ title: editing ? "Editar follow-up" : "Novo follow-up", subtitle: "CRM", submitLabel: editing ? "Salvar" : "Agendar", values: { ...(f || {}), lead_id: f?.lead_id ? String(f.lead_id) : "", client_id: f?.client_id ? String(f.client_id) : "", opportunity_id: f?.opportunity_id ? String(f.opportunity_id) : "", due_at: f?.due_at || new Date(Date.now() + 86400e3).toISOString(), channel: f?.channel || "whatsapp", priority: f?.priority || "medium" }, fields: [
    { name: "lead_id", label: "Lead", type: "select", required: false, options: [["", "Sem lead"], ...leads.map((l) => [String(l.id), l.name])] },
    { name: "client_id", label: "Cliente", type: "select", required: false, options: [["", "Sem cliente"], ...clients.map((c) => [String(c.id), c.name])] },
    { name: "opportunity_id", label: "Oportunidade", type: "select", required: false, options: [["", "Sem oportunidade"], ...opportunities.map((o) => [String(o.id), o.name])] },
    { name: "title", label: "Assunto", required: false }, { name: "due_at", label: "Quando", type: "datetime-local", half: true },
    { name: "channel", label: "Canal", type: "select", options: [["whatsapp", "WhatsApp"], ["ligacao", "Ligação"], ["email", "E-mail"], ["reuniao", "Reunião"], ["outro", "Outro"]], half: true },
    { name: "priority", label: "Prioridade", type: "select", options: [["low", "Baixa"], ["medium", "Média"], ["high", "Alta"], ["urgent", "Urgente"]], half: true },
    { name: "reminder_minutes", label: "Lembrete (minutos antes)", type: "number", required: false, half: true }, { name: "next_action", label: "Próxima ação", required: false }, { name: "note", label: "Observações", type: "textarea", required: false, rows: 3 }
  ], onSubmit: async (values) => { if (!values.lead_id && !values.client_id && !values.opportunity_id) throw new Error("Vincule um lead, cliente ou oportunidade."); if (editing) await api(`/api/followups/${f.id}`, { method: "PATCH", body: values }); else await api("/api/followups", { method: "POST", body: values }); toast(editing ? "Follow-up atualizado." : "Follow-up agendado.", "success"); after(); } });
};
