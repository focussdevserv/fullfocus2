const toast = (...args) => { if (location.hash === "#auditoria") ui.toast(...args); };
const auditEsc = (value) => escapeHtml(value ?? "");
const auditActionLabels = { post: "Criou", patch: "Editou", put: "Editou", delete: "Excluiu", login: "Entrou", logout: "Saiu", get: "Consultou" };
const auditEntityLabels = { api: "API", contacts: "Contato", companies: "Empresa", clients: "Cliente", leads: "Lead", opportunities: "Oportunidade", campaigns: "Campanha", proposals: "Proposta", followups: "Follow-up", contracts: "Contrato", projects: "Projeto", tasks: "Tarefa", events: "Evento", briefings: "Briefing", change_requests: "Alteração de escopo", deliveries: "Entrega", infrastructure_assets: "Infraestrutura", vault: "Cofre", files: "Arquivo", knowledge_articles: "Artigo", tickets: "Ticket", revenues: "Receita", expenses: "Despesa", receivables: "Conta a receber", charges: "Cobrança", payments: "Pagamento", payables: "Conta a pagar", bank_accounts: "Conta bancária", invoices: "Nota fiscal", subscriptions: "Assinatura", "catalog-items": "Item do catálogo", catalog_items: "Item do catálogo", automations: "Automação", templates: "Template", integrations: "Integração", forms: "Formulário", conversations: "Conversa", notifications: "Notificação", team: "Equipe", team_roles: "Cargo", team_goals: "Meta", absences: "Ausência", commissions: "Comissão", time_entries: "Horas", "time-entry-timer": "Cronômetro", trash: "Lixeira", approvals: "Aprovação", whatsapp: "WhatsApp", profile: "Perfil", settings: "Configurações", organization: "Workspace", email: "E-mail" };
const auditDateFormatter = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });
const auditDate = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : auditDateFormatter.format(date);
};
const auditJson = (value) => { try { return JSON.stringify(typeof value === "string" ? JSON.parse(value) : value || {}, null, 2); } catch { return String(value ?? "{}"); } };
const auditState = { search: "", action: "", entity: "", from: "", to: "", offset: 0, request: 0 };
let auditTimer;

async function renderAuditScreen() {
  if (location.hash !== "#auditoria") return;
  const request = auditState.request = (auditState.request || 0) + 1;
  dashboardGrid.setAttribute("aria-busy", "true");
  const restoreSearchFocus = ui.keepSearchFocus(dashboardGrid, "[data-audit-search]");
  const title = "Auditoria", description = "Acompanhe alterações, acessos e ações administrativas do workspace.";
  dashboardGrid.innerHTML = `<section class="page-intro"><div><p class="card-kicker">Segurança e controle</p><h2>${title}</h2><p>${description}</p></div></section>${stateBlock.loading("Carregando registros…")}`;
  const params = new URLSearchParams({ limit: "100", offset: String(auditState.offset) });
  for (const [key, value] of Object.entries(auditState)) if (!["offset", "request"].includes(key) && value) params.set(key, value);
  try {
    const response = await api(`/api/audit_events?${params}`), rows = response.audit_events || [], pagination = response.pagination || {};
    if (request !== auditState.request || location.hash !== "#auditoria") return;
    const actions = [...new Set([...Object.keys(auditActionLabels), ...rows.map((row) => row.action).filter(Boolean)])].sort();
    const entities = [...new Set([...Object.keys(auditEntityLabels), ...rows.map((row) => row.entity_type).filter(Boolean)])].sort();
    const option = (value, label, selected) => { const displayLabel = label === value ? auditActionLabels[value] || auditEntityLabels[value] || label : label; return `<option value="${auditEsc(value)}"${selected === value ? " selected" : ""}>${auditEsc(displayLabel)}</option>`; };
    dashboardGrid.innerHTML = `<section class="page-intro"><div><p class="card-kicker">Segurança e controle</p><h2>${title}</h2><p>${description}</p></div><span class="finance-status neutral" data-audit-results role="status" aria-live="polite">${pagination.returned ?? rows.length} registro(s)</span></section><section class="data-card audit-panel"><div class="finance-toolbar"><input type="search" data-audit-search value="${auditEsc(auditState.search)}" placeholder="Buscar ação, entidade ou usuário…" aria-label="Buscar na auditoria"><select data-audit-action aria-label="Filtrar ação">${option("", "Todas as ações", auditState.action)}${actions.map((item) => option(item, item, auditState.action)).join("")}</select><select data-audit-entity aria-label="Filtrar entidade">${option("", "Todas as entidades", auditState.entity)}${entities.map((item) => option(item, item, auditState.entity)).join("")}</select><input type="date" data-audit-from value="${auditEsc(auditState.from)}" aria-label="Data inicial"><input type="date" data-audit-to value="${auditEsc(auditState.to)}" aria-label="Data final"></div>${rows.length ? `<div class="table-wrap"><table class="finance-table"><thead><tr><th>Data</th><th>Usuário</th><th>Ação</th><th>Entidade</th><th>ID</th><th>Origem</th><th>Ações</th></tr></thead><tbody>${rows.map((row, index) => `<tr><td>${auditEsc(auditDate(row.created_at))}</td><td>${auditEsc(row.actor_name || "Sistema")}</td><td>${ui.badge(auditActionLabels[row.action] || row.action || "—", { post: "green", patch: "blue", put: "blue", delete: "red" }[row.action] || "gray")}</td><td>${auditEsc(auditEntityLabels[row.entity_type] || row.entity_type || "—")}</td><td>${auditEsc(row.entity_id || "—")}</td><td>${auditEsc(row.ip_address || "—")}</td><td><button type="button" class="compact-action" data-audit-details="${index}">Detalhes</button></td></tr>`).join("")}</tbody></table></div>` : stateBlock.empty("Nenhum evento registrado", "As ações administrativas aparecerão aqui automaticamente.")}<div class="table-pagination"><button type="button" class="compact-action" data-audit-prev ${auditState.offset === 0 ? "disabled" : ""}>Anterior</button><span>Página ${Math.floor(auditState.offset / 100) + 1}</span><button type="button" class="compact-action" data-audit-next ${(pagination.returned ?? rows.length) < 100 ? "disabled" : ""}>Próxima</button></div></section>`;
    const auditPanel = dashboardGrid.querySelector(".audit-panel"); auditPanel?.insertAdjacentHTML("beforebegin", ui.stats([{ label: "Registros exibidos", value: ui.number(rows.length) }, { label: "Criações", value: ui.number(rows.filter((row) => row.action === "post").length), tone: "green" }, { label: "Alterações", value: ui.number(rows.filter((row) => ["patch", "put"].includes(row.action)).length) }, { label: "Exclusões", value: ui.number(rows.filter((row) => row.action === "delete").length), tone: "red" }]));
    dashboardGrid.removeAttribute("aria-busy");
    restoreSearchFocus();
    const search = dashboardGrid.querySelector("[data-audit-search]"), from = dashboardGrid.querySelector("[data-audit-from]"), to = dashboardGrid.querySelector("[data-audit-to]");
    if (search) { search.name = "search"; search.placeholder = "Buscar ação, entidade ou usuário…"; search.setAttribute("autocomplete", "off"); }
    const action = dashboardGrid.querySelector("[data-audit-action]"), entity = dashboardGrid.querySelector("[data-audit-entity]");
    if (action) { action.name = "action"; action.setAttribute("autocomplete", "off"); }
    if (entity) { entity.name = "entity"; entity.setAttribute("autocomplete", "off"); }
    if (from) { from.name = "from"; from.setAttribute("autocomplete", "off"); }
    if (to) { to.name = "to"; to.setAttribute("autocomplete", "off"); }
    const reload = () => { if (from.value && to.value && to.value < from.value) { to.setAttribute("aria-invalid", "true"); toast("A data final deve ser igual ou posterior à data inicial.", "error"); to.focus(); return; } to.removeAttribute("aria-invalid"); auditState.search = search.value.trim(); auditState.action = dashboardGrid.querySelector("[data-audit-action]").value; auditState.entity = dashboardGrid.querySelector("[data-audit-entity]").value; auditState.from = from.value; auditState.to = to.value; auditState.offset = 0; clearTimeout(auditTimer); auditTimer = setTimeout(renderAuditScreen, 250); };
    dashboardGrid.querySelector("[data-audit-search]")?.addEventListener("input", reload);
    ["[data-audit-action]", "[data-audit-entity]", "[data-audit-from]", "[data-audit-to]"].forEach((selector) => dashboardGrid.querySelector(selector)?.addEventListener("change", reload));
    dashboardGrid.querySelector("[data-audit-prev]")?.addEventListener("click", () => { auditState.offset = Math.max(0, auditState.offset - 100); renderAuditScreen(); });
    dashboardGrid.querySelector("[data-audit-next]")?.addEventListener("click", () => { auditState.offset += 100; renderAuditScreen(); });
    dashboardGrid.querySelectorAll("[data-audit-details]").forEach((button) => button.addEventListener("click", () => { if (location.hash !== "#auditoria" || !button.isConnected) return; const row = rows[Number(button.dataset.auditDetails)]; if (!row) return; ui.drawer({ title: `${row.action || "Ação"} · ${row.entity_type || "registro"}`, subtitle: `${row.actor_name || "Sistema"} · ${auditDate(row.created_at)}`, html: ui.facts([["ID do registro", row.entity_id || "—"], ["IP", row.ip_address || "—"], ["Agente", row.user_agent || "—"]]) + `<h3>Alterações registradas</h3><pre class="audit-json">${auditEsc(auditJson(row.changes))}</pre>` }); }));
  } catch (error) { if (request !== auditState.request || location.hash !== "#auditoria") return; dashboardGrid.removeAttribute("aria-busy"); dashboardGrid.innerHTML = `<section class="page-intro"><div><p class="card-kicker">Segurança e controle</p><h2>${title}</h2></div></section>${stateBlock.error(error.message, "audit-retry")}`; dashboardGrid.querySelector(".audit-retry")?.addEventListener("click", renderAuditScreen); }
}
registerRoutes({ auditoria: renderAuditScreen });
window.addEventListener("hashchange", () => {
  if (location.hash !== "#auditoria") auditState.request += 1;
});

new MutationObserver(() => {
  dashboardGrid.querySelectorAll("[data-audit-search], [data-audit-action], [data-audit-entity], [data-audit-from], [data-audit-to]").forEach((control) => {
    if (!control.name) control.name = control.matches("[data-audit-search]") ? "search" : control.matches("[data-audit-action]") ? "action" : control.matches("[data-audit-entity]") ? "entity" : control.matches("[data-audit-from]") ? "from" : "to";
    control.setAttribute("autocomplete", "off");
  });
  dashboardGrid.querySelectorAll(".audit-panel, .finance-status").forEach((region) => region.setAttribute("aria-live", "polite"));
  dashboardGrid.querySelectorAll("button:disabled").forEach((button) => button.setAttribute("aria-busy", "true"));
  dashboardGrid.querySelectorAll(".state-loading p").forEach((label) => { if (label.textContent?.includes("...")) label.textContent = label.textContent.replaceAll("...", "…"); });
}).observe(dashboardGrid, { childList: true, subtree: true });

new MutationObserver(() => {
  const panel = dashboardGrid.querySelector(".audit-panel");
  const heading = dashboardGrid.querySelector(".page-intro h2");
  if (heading && !heading.id) heading.id = "auditoria-titulo";
  if (panel && heading?.id) panel.setAttribute("aria-labelledby", heading.id);
  const table = panel?.querySelector(".finance-table");
  if (table && !table.caption) {
    const caption = document.createElement("caption");
    caption.className = "sr-only";
    caption.textContent = "Registros de auditoria do workspace";
    table.prepend(caption);
  }
  panel?.querySelectorAll(".finance-table thead th").forEach((header) => header.setAttribute("scope", "col"));
  panel?.querySelectorAll("[data-audit-details], [data-audit-prev], [data-audit-next]").forEach((button) => {
    button.style.touchAction = "manipulation";
    if (button.disabled) button.setAttribute("aria-busy", "true");
  });
}).observe(dashboardGrid, { childList: true, subtree: true, attributes: true, attributeFilter: ["disabled"] });
