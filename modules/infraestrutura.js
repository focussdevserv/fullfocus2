/* Infraestrutura operacional: recursos reais, vencimentos e custos vinculados. */
const toast = (...args) => { if (location.hash === "#infraestrutura") ui.toast(...args); };
const infraEsc = (value) => escapeHtml(value ?? "");
const infraMoneyFormatter = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const infraDateFormatter = new Intl.DateTimeFormat("pt-BR");
const infraMoney = (value) => infraMoneyFormatter.format(Number(value || 0));
const infraDate = (value) => { if (!value) return "Sem vencimento"; const date = new Date(value); return Number.isNaN(date.getTime()) ? "—" : infraDateFormatter.format(date); };
const infraState = { search: "", kind: "", status: "", offset: 0, request: 0 };
const infrastructureKinds = ["Domínio", "Hospedagem", "Servidor", "API", "Licença", "E-mail", "SSL", "Outro"];
let infraTimer;
const infraDetails = (item, clientName, projectName) => { if (!item) return; ui.drawer({ title: item.name || "Recurso", subtitle: item.kind || "Infraestrutura", html: ui.facts([["Provedor", item.provider], ["Cliente", item.client_name || clientName.get(String(item.client_id))], ["Projeto", item.project_name || projectName.get(String(item.project_id))], ["Vencimento", infraDate(item.expires_on)], ["Custo", infraMoney(item.cost)], ["Valor cobrado", infraMoney(item.client_price)], ["Responsável", item.responsible], ["Status", item.status === "active" ? "Ativo" : "Inativo"]]) }); };

async function renderInfrastructureScreen() {
  if (location.hash !== "#infraestrutura") return;
  const request = infraState.request = (infraState.request || 0) + 1;
  dashboardGrid.setAttribute("aria-busy", "true");
  const title = "Infraestrutura", description = "Domínios, hospedagem, servidores, APIs e licenças vinculados aos seus projetos.";
  dashboardGrid.innerHTML = `<section class="page-intro"><div><p class="card-kicker">Operação</p><h2>${title}</h2><p>${description}</p></div></section>${stateBlock.loading("Carregando recursos…")}`;
  try {
    const assetParams = new URLSearchParams({ limit: "100", offset: String(infraState.offset) });
    for (const [key, value] of Object.entries(infraState)) if (!["offset", "request"].includes(key) && value) assetParams.set(key, value);
    const [assetResult, clientResult, projectResult] = await Promise.allSettled([api(`/api/infrastructure_assets?${assetParams}`), api("/api/clients?limit=250"), api("/api/projects?limit=250")]);
    if (assetResult.status === "rejected") throw assetResult.reason;
    const assetData = assetResult.value, clientData = clientResult.status === "fulfilled" ? clientResult.value : {}, projectData = projectResult.status === "fulfilled" ? projectResult.value : {};
    if (request !== infraState.request || location.hash !== "#infraestrutura") return;
    const assets = assetData.infrastructure_assets || [], clients = clientData.clients || [], projects = projectData.projects || [], pagination = assetData.pagination || {};
    const clientName = new Map(clients.map((item) => [String(item.id), item.name]));
    const projectName = new Map(projects.map((item) => [String(item.id), item.name]));
    dashboardGrid.innerHTML = `<section class="page-intro"><div><p class="card-kicker">Operação</p><h2>${title}</h2><p>${description}</p></div><button type="button" class="button button-primary compact-action" data-infra-new>+ Novo recurso</button></section><section class="finance-metrics"><article class="data-card finance-metric"><span>Recursos ativos</span><strong>${assets.filter((item) => item.status === "active").length}</strong></article><article class="data-card finance-metric"><span>Vencendo em 30 dias</span><strong>${assets.filter((item) => item.expires_on && (new Date(item.expires_on) - Date.now()) >= 0 && (new Date(item.expires_on) - Date.now()) <= 30 * 864e5).length}</strong></article><article class="data-card finance-metric"><span>Custo mensal/registrado</span><strong>${infraMoney(assets.reduce((sum, item) => sum + Number(item.cost || 0), 0))}</strong></article></section><section class="data-card"><div class="finance-toolbar"><input type="search" data-infra-search value="${infraEsc(infraState.search)}" placeholder="Buscar recurso, provedor, cliente ou projeto…" aria-label="Buscar infraestrutura"><select data-infra-kind aria-label="Filtrar tipo"><option value="">Todos os tipos</option>${[...new Set(assets.map((item) => item.kind).filter(Boolean))].sort().map((kind) => `<option value="${infraEsc(kind)}"${infraState.kind === kind ? " selected" : ""}>${infraEsc(kind)}</option>`).join("")}</select><select data-infra-status aria-label="Filtrar status"><option value="">Todos os status</option><option value="active"${infraState.status === "active" ? " selected" : ""}>Ativo</option><option value="inactive"${infraState.status === "inactive" ? " selected" : ""}>Inativo</option><option value="expired"${infraState.status === "expired" ? " selected" : ""}>Vencido</option></select></div>${assets.length ? `<div class="table-wrap"><table class="finance-table"><thead><tr><th>Recurso</th><th>Tipo</th><th>Vínculos</th><th>Provedor</th><th>Vencimento</th><th>Custo</th><th>Status</th><th>Ações</th></tr></thead><tbody>${assets.map((item) => { const expired = item.expires_on && new Date(item.expires_on) < new Date(); const status = expired ? "expired" : item.status || "active"; return `<tr data-infra-row data-kind="${infraEsc(item.kind)}" data-status="${infraEsc(status)}"><td><strong>${infraEsc(item.name)}</strong></td><td>${infraEsc(item.kind)}</td><td>${infraEsc(item.client_name || clientName.get(String(item.client_id)) || "")}${item.project_id ? ` · ${infraEsc(item.project_name || projectName.get(String(item.project_id)) || `Projeto #${item.project_id}`)}` : ""}</td><td>${infraEsc(item.provider || "—")}</td><td>${infraEsc(infraDate(item.expires_on))}</td><td>${infraMoney(item.cost)}</td><td><span class="finance-status ${status === "active" ? "success" : "warning"}">${status === "active" ? "Ativo" : status === "expired" ? "Vencido" : "Inativo"}</span></td><td><button type="button" class="compact-action" data-infra-edit="${item.id}">Editar</button><button type="button" class="compact-action" data-infra-delete="${item.id}">Excluir</button></td></tr>`; }).join("")}</tbody></table></div>` : stateBlock.empty("Nenhum recurso cadastrado", "Adicione o primeiro domínio, servidor ou serviço externo.", "Novo recurso", "infra-empty-new")}<div class="table-pagination"><button type="button" class="compact-action" data-infra-prev ${infraState.offset === 0 ? "disabled" : ""}>Anterior</button><span>Página ${Math.floor(infraState.offset / 100) + 1}</span><button type="button" class="compact-action" data-infra-next ${(pagination.returned ?? assets.length) < 100 ? "disabled" : ""}>Próxima</button></div></section>`;
    dashboardGrid.removeAttribute("aria-busy");
    const legacyMetrics = dashboardGrid.querySelector(".finance-metrics"); if (legacyMetrics) { legacyMetrics.insertAdjacentHTML("afterend", ui.stats([{ label: "Recursos ativos", value: ui.number(assets.filter((item) => item.status === "active").length), tone: "green" }, { label: "Vencem em 30 dias", value: ui.number(assets.filter((item) => item.expires_on && new Date(item.expires_on) >= new Date() && new Date(item.expires_on) <= new Date(Date.now() + 30 * 864e5)).length), tone: "orange" }, { label: "Custo registrado", value: infraMoney(assets.reduce((sum, item) => sum + Number(item.cost || 0), 0)) }])); legacyMetrics.remove(); }
    dashboardGrid.querySelectorAll("[data-infra-row]").forEach((row, index) => { const details = document.createElement("button"); details.type = "button"; details.className = "compact-action"; details.textContent = "Detalhes"; details.addEventListener("click", () => infraDetails(assets[index], clientName, projectName)); row.querySelector("td:last-child")?.prepend(details); });
    const reload = () => { infraState.search = dashboardGrid.querySelector("[data-infra-search]").value.trim(); infraState.kind = dashboardGrid.querySelector("[data-infra-kind]").value; infraState.status = dashboardGrid.querySelector("[data-infra-status]").value; infraState.offset = 0; clearTimeout(infraTimer); infraTimer = setTimeout(renderInfrastructureScreen, 250); };
    dashboardGrid.querySelector("[data-infra-search]")?.addEventListener("input", reload); ["[data-infra-kind]", "[data-infra-status]"].forEach((selector) => dashboardGrid.querySelector(selector)?.addEventListener("change", reload));
    dashboardGrid.querySelector("[data-infra-prev]")?.addEventListener("click", () => { infraState.offset = Math.max(0, infraState.offset - 100); renderInfrastructureScreen(); });
    dashboardGrid.querySelector("[data-infra-next]")?.addEventListener("click", () => { infraState.offset += 100; renderInfrastructureScreen(); });
    const openForm = (item = {}) => ui.form({ title: item.id ? "Editar recurso" : "Novo recurso", subtitle: "Infraestrutura", fields: [{ name: "kind", label: "Tipo", value: item.kind || "Domínio" }, { name: "name", label: "Nome", value: item.name || "" }, { name: "provider", label: "Provedor", value: item.provider || "", required: false }, { name: "client_id", label: "Cliente", type: "select", value: item.client_id || "", options: [["", "Sem cliente"], ...clients.map((client) => [client.id, client.name])], required: false }, { name: "project_id", label: "Projeto", type: "select", value: item.project_id || "", options: [["", "Sem projeto"], ...projects.map((project) => [project.id, project.name])], required: false }, { name: "expires_on", label: "Vencimento", type: "date", value: item.expires_on || "", required: false }, { name: "cost", label: "Custo", type: "number", min: 0, step: 0.01, value: item.cost || 0, required: false }, { name: "client_price", label: "Valor cobrado do cliente", type: "number", min: 0, step: 0.01, value: item.client_price || 0, required: false }, { name: "responsible", label: "Responsável", value: item.responsible || "", required: false }, { name: "status", label: "Status", type: "select", value: item.status || "active", options: [["active", "Ativo"], ["inactive", "Inativo"]], required: false }], submitLabel: item.id ? "Salvar alterações" : "Cadastrar recurso", onSubmit: async (values) => { await api(item.id ? `/api/infrastructure_assets/${item.id}` : "/api/infrastructure_assets", { method: item.id ? "PATCH" : "POST", body: values }); if (location.hash !== "#infraestrutura" || request !== infraState.request) return; toast("Recurso salvo.", "success"); renderInfrastructureScreen(); } });
    dashboardGrid.querySelector("[data-infra-new], .infra-empty-new")?.addEventListener("click", () => openForm());
    dashboardGrid.querySelectorAll("[data-infra-edit]").forEach((button) => button.addEventListener("click", () => openForm(assets.find((item) => String(item.id) === button.dataset.infraEdit))));
    dashboardGrid.querySelectorAll("[data-infra-delete]").forEach((button) => button.addEventListener("click", () => ui.confirmInline(button, { text: "Excluir este recurso?", onConfirm: async () => { const routeAtStart = location.hash; const originalLabel = button.textContent; button.disabled = true; button.setAttribute("aria-busy", "true"); button.textContent = "Excluindo…"; try { await api(`/api/infrastructure_assets/${button.dataset.infraDelete}`, { method: "DELETE" }); if (location.hash !== routeAtStart || location.hash !== "#infraestrutura" || request !== infraState.request || !button.isConnected) return; toast("Recurso movido para a lixeira.", "success"); renderInfrastructureScreen(); } catch (error) { if (location.hash !== routeAtStart || !button.isConnected) return; button.disabled = false; button.removeAttribute("aria-busy"); button.textContent = originalLabel; toast(error.message, "error"); } } })));
  } catch (error) { if (request !== infraState.request || location.hash !== "#infraestrutura") return; dashboardGrid.removeAttribute("aria-busy"); dashboardGrid.innerHTML = `<section class="page-intro"><div><p class="card-kicker">Operação</p><h2>${title}</h2></div></section>${stateBlock.error(error.message, "infra-retry")}`; dashboardGrid.querySelector(".infra-retry")?.addEventListener("click", renderInfrastructureScreen); }
}
registerRoutes({ infraestrutura: renderInfrastructureScreen });
window.addEventListener("hashchange", () => {
  if (location.hash === "#infraestrutura") return;
  infraState.request += 1;
  clearTimeout(infraTimer);
  infraTimer = null;
});
const infraResultsObserver = new MutationObserver(() => {
  if (location.hash !== "#infraestrutura") return;
  const list = dashboardGrid.querySelector("section.data-card");
  const toolbar = list?.querySelector(".finance-toolbar");
  if (!list || !toolbar) return;
  let status = list.querySelector("[data-infra-results]");
  if (!status) {
    status = document.createElement("p");
    status.className = "ui-filter-status";
    status.dataset.infraResults = "1";
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    toolbar.insertAdjacentElement("afterend", status);
  }
  const count = dashboardGrid.querySelectorAll("[data-infra-row]").length;
  const message = `${ui.number(count)} ${count === 1 ? "recurso encontrado" : "recursos encontrados"}.`;
  if (status.textContent !== message) status.textContent = message;
});
infraResultsObserver.observe(dashboardGrid, { childList: true, subtree: true });
let infraSearchSnapshot = null;
dashboardGrid.addEventListener("input", (event) => {
  if (!event.target.matches("[data-infra-search]")) return;
  infraSearchSnapshot = { value: event.target.value, start: event.target.selectionStart, end: event.target.selectionEnd };
}, true);
new MutationObserver(() => {
  if (!infraSearchSnapshot) return;
  const input = dashboardGrid.querySelector("[data-infra-search]");
  if (!input) return;
  input.focus(); input.setSelectionRange(infraSearchSnapshot.start, infraSearchSnapshot.end); infraSearchSnapshot = null;
}).observe(dashboardGrid, { childList: true });

new MutationObserver(() => {
  const select = dashboardGrid.querySelector("[data-infra-kind]");
  if (!select) return;
  const available = new Set([...select.options].map((option) => option.value));
  infrastructureKinds.forEach((kind) => {
    if (available.has(kind)) return;
    select.add(new Option(kind, kind, false, infraState.kind === kind));
  });
}).observe(dashboardGrid, { childList: true });

new MutationObserver(() => {
  if (dashboardGrid.querySelector(".state-loading")) dashboardGrid.setAttribute("aria-busy", "true");
  else dashboardGrid.removeAttribute("aria-busy");
  dashboardGrid.querySelectorAll("[data-infra-search], [data-infra-kind], [data-infra-status]").forEach((control) => {
    if (!control.name) control.name = control.dataset.infraSearch !== undefined ? "search" : control.dataset.infraKind !== undefined ? "kind" : "status";
    control.setAttribute("autocomplete", "off");
    if (control.matches("[data-infra-search]")) control.placeholder = "Buscar recurso, provedor, cliente ou projeto…";
  });
  dashboardGrid.querySelectorAll("button:disabled").forEach((button) => button.setAttribute("aria-busy", "true"));
  dashboardGrid.querySelectorAll("th").forEach((cell) => cell.setAttribute("scope", "col"));
  dashboardGrid.querySelectorAll(".finance-status").forEach((status) => { status.setAttribute("role", "status"); status.setAttribute("aria-live", "polite"); });
  dashboardGrid.querySelectorAll(".state-loading p").forEach((label) => { label.textContent = label.textContent.replaceAll("...", "…"); });
  dashboardGrid.querySelectorAll(".state-error").forEach((status) => status.setAttribute("role", "alert"));
  dashboardGrid.querySelectorAll("button").forEach((button) => { button.style.touchAction = "manipulation"; });
}).observe(dashboardGrid, { childList: true, subtree: true });

const infraFormObserver = new MutationObserver(() => {
  document.querySelectorAll('.ui-modal[aria-label="Novo recurso"], .ui-modal[aria-label="Editar recurso"]').forEach((form) => {
    const input = form.elements.kind;
    if (!input || input.tagName === "SELECT") return;
    const select = document.createElement("select");
    select.name = "kind";
    select.autocomplete = "off";
    infrastructureKinds.forEach((kind) => {
      const option = new Option(kind, kind, false, kind === input.value);
      select.add(option);
    });
    input.replaceWith(select);
  });
});
infraFormObserver.observe(document.body, { childList: true, subtree: true });

new MutationObserver(() => {
  dashboardGrid.querySelectorAll("table.finance-table").forEach((table) => {
    if (!table.caption) {
      const caption = document.createElement("caption");
      caption.className = "sr-only";
      caption.textContent = "Recursos de infraestrutura";
      table.prepend(caption);
    }
  });
  dashboardGrid.querySelectorAll("[data-infra-row]").forEach((row) => {
    const name = row.querySelector("td:first-child")?.textContent?.trim() || "recurso";
    row.querySelectorAll("button").forEach((button) => {
      button.style.touchAction = "manipulation";
      if (!button.getAttribute("aria-label")) button.setAttribute("aria-label", `${button.textContent.trim()} ${name}`);
    });
  });
}).observe(dashboardGrid, { childList: true, subtree: true });
