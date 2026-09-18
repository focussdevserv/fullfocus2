/* Workspace de briefings: cadastro, leitura de respostas e link público real. */
const toast = (...args) => { if (location.hash === "#briefings") ui.toast(...args); };
const briefingEsc = (value) => escapeHtml(value ?? "");
const briefingStatus = { draft: "Rascunho", published: "Publicado", sent: "Enviado", answered: "Respondido", approved: "Aprovado", archived: "Arquivado" };
const briefingFilter = { search: "", status: "", request: 0 };
const briefingMetric = (label, value) => `<article class="data-card finance-metric"><span>${briefingEsc(label)}</span><strong>${briefingEsc(value)}</strong></article>`;
const briefingConfig = {
  title: "Novo briefing",
  endpoint: "/api/briefings",
  fields: [
    { name: "name", label: "Nome do briefing" },
    { name: "client_id", label: "Cliente (ID)", required: false },
    { name: "project_id", label: "Projeto (ID)", required: false },
    { name: "status", label: "Status", type: "select", options: Object.entries(briefingStatus).map(([value, label]) => [value, label]), required: false },
    { name: "questions", label: "Perguntas (JSON)", type: "textarea", rows: 8, placeholder: '[{"label":"Qual é o objetivo do projeto?"}]', required: false }
  ]
};
Object.assign(createConfig, { briefing: briefingConfig });

const briefingQuestions = (value) => {
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    return Array.isArray(parsed) ? parsed : Array.isArray(parsed?.questions) ? parsed.questions : [];
  } catch { return []; }
};
const briefingResponses = (value) => {
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    if (Array.isArray(parsed)) return Object.fromEntries(parsed.filter((entry) => entry && typeof entry === "object" && !Array.isArray(entry)).map((entry, index) => [`Envio ${index + 1}`, entry]));
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch { return {}; }
};

async function prepareBriefingCreate() {
  const routeAtStart = location.hash;
  if (routeAtStart !== "#briefings") return;
  try {
    const [clientsData, projectsData] = await Promise.all([api("/api/clients"), api("/api/projects")]);
    if (location.hash !== routeAtStart || routeAtStart !== "#briefings") return;
    const clientField = briefingConfig.fields.find((field) => field.name === "client_id");
    const projectField = briefingConfig.fields.find((field) => field.name === "project_id");
    if (!clientField || !projectField) throw new Error("O formulário de briefing está incompleto. Atualize a tela e tente novamente.");
    clientField.type = "select";
    clientField.options = [["", "Sem cliente"], ...(clientsData.clients || []).map((item) => [item.id, item.name])];
    projectField.type = "select";
    projectField.options = [["", "Sem projeto"], ...(projectsData.projects || []).map((item) => [item.id, item.name])];
    openCreateDialog("briefing");
  } catch (error) { if (location.hash === routeAtStart && routeAtStart === "#briefings") toast(error.message || "Não foi possível carregar clientes e projetos. Tente novamente.", "error"); }
}

async function renderBriefingsScreen() {
  if (location.hash !== "#briefings") return;
  const request = briefingFilter.request = (briefingFilter.request || 0) + 1;
  dashboardGrid.setAttribute("aria-busy", "true");
  const restoreSearchFocus = ui.keepSearchFocus(dashboardGrid, "[data-briefing-search]");
  const title = "Briefings", description = "Colete informações, arquivos e decisões do cliente antes de fechar o escopo.";
  dashboardGrid.innerHTML = `<section class="page-intro"><div><p class="card-kicker">Operação</p><h2>${title}</h2><p>${description}</p></div><button class="button button-primary compact-action" data-briefing-new type="button">+ Novo briefing</button></section>${stateBlock.loading("Carregando briefings…")}`;
  try {
    const params = new URLSearchParams(); if (briefingFilter.search) params.set("search", briefingFilter.search); if (briefingFilter.status) params.set("status", briefingFilter.status); const items = (await api(`/api/briefings?${params}`)).briefings || [];
    if (request !== briefingFilter.request || location.hash !== "#briefings") return;
    dashboardGrid.innerHTML = `<section class="page-intro"><div><p class="card-kicker">Operação</p><h2>${title}</h2><p>${description}</p></div><button class="button button-primary compact-action" data-briefing-new type="button">+ Novo briefing</button></section><section class="data-card automation-list"><div class="finance-toolbar"><input type="search" data-briefing-search value="${briefingEsc(briefingFilter.search)}" placeholder="Buscar briefing…" aria-label="Buscar briefing"><select data-briefing-filter aria-label="Filtrar status"><option value="">Todos os status</option>${Object.entries(briefingStatus).map(([key, label]) => `<option value="${key}"${briefingFilter.status === key ? " selected" : ""}>${label}</option>`).join("")}</select></div><div class="template-grid">${items.length ? items.map((item) => { const questions = briefingQuestions(item.questions), responses = briefingResponses(item.responses), responseCount = Object.keys(responses).length; return `<article class="data-card template-card" data-briefing-row data-status="${briefingEsc(item.status || "draft")}"><div class="section-heading"><div><h3>${briefingEsc(item.name)}</h3><small>${questions.length} pergunta(s) · ${responseCount} resposta(s) · ${item.client_id ? `Cliente #${briefingEsc(item.client_id)}` : "Sem cliente"}</small></div><span class="finance-status ${item.status === "answered" || item.status === "approved" ? "positive" : "neutral"}">${briefingStatus[item.status] || briefingEsc(item.status || "Rascunho")}</span></div><div class="template-actions"><button class="compact-action" data-briefing-preview="${item.id}" type="button">Ver briefing</button>${responseCount ? `<button class="compact-action" data-briefing-responses="${item.id}" type="button">Ver respostas</button>` : ""}<button class="compact-action" data-briefing-link="${item.id}" type="button">${item.public_token ? "Copiar link" : "Gerar link"}</button><button class="compact-action" data-briefing-edit="${item.id}" type="button">Editar</button><button class="compact-action" data-briefing-delete="${item.id}" type="button">Excluir</button></div></article>`; }).join("") : stateBlock.empty("Nenhum briefing", "Crie um questionário para iniciar o levantamento do projeto.", "Criar briefing", "briefing-empty")}</div></section>`;
    dashboardGrid.removeAttribute("aria-busy");
    const briefingList = dashboardGrid.querySelector(".automation-list");
    restoreSearchFocus();
    // O observer compartilhado de estrutura também injeta link público; manter
    // uma única ação evita duplicidade e preserva o handler deste workspace.
    if (briefingList) {
      briefingList.dataset.briefingLinks = "1";
      briefingList.querySelectorAll(".template-actions button:not([data-briefing-preview]):not([data-briefing-responses]):not([data-briefing-link]):not([data-briefing-edit]):not([data-briefing-delete])").forEach((button) => {
        if (["Gerar link", "Copiar link"].includes(button.textContent.trim())) button.remove();
      });
    }
    briefingList?.insertAdjacentHTML("beforebegin", `<section class="finance-metrics">${briefingMetric("Total", items.length)}${briefingMetric("Publicados", items.filter((item) => ["published", "sent"].includes(item.status)).length)}${briefingMetric("Respondidos", items.filter((item) => item.status === "answered").length)}${briefingMetric("Rascunhos", items.filter((item) => !item.status || item.status === "draft").length)}</section>`);
    const openNew = () => prepareBriefingCreate();
    dashboardGrid.querySelector("[data-briefing-new]")?.addEventListener("click", openNew);
    dashboardGrid.querySelector(".briefing-empty")?.addEventListener("click", openNew);
    const filter = () => { const query = dashboardGrid.querySelector("[data-briefing-search]").value.toLocaleLowerCase("pt-BR"), status = dashboardGrid.querySelector("[data-briefing-filter]").value; dashboardGrid.querySelectorAll("[data-briefing-row]").forEach((row) => { row.hidden = (query && !row.textContent.toLocaleLowerCase("pt-BR").includes(query)) || (status && row.dataset.status !== status); }); };
    dashboardGrid.querySelector("[data-briefing-search]")?.addEventListener("input", filter);
    dashboardGrid.querySelector("[data-briefing-filter]")?.addEventListener("change", filter);
    const briefingSearch = dashboardGrid.querySelector("[data-briefing-search]"), briefingStatusFilter = dashboardGrid.querySelector("[data-briefing-filter]"); if (briefingSearch) briefingSearch.value = briefingFilter.search; if (briefingStatusFilter) briefingStatusFilter.value = briefingFilter.status; let briefingTimer; briefingSearch?.addEventListener("input", () => { clearTimeout(briefingTimer); briefingFilter.search = briefingSearch.value.trim(); briefingTimer = setTimeout(renderBriefingsScreen, 250); }); briefingStatusFilter?.addEventListener("change", () => { briefingFilter.status = briefingStatusFilter.value; renderBriefingsScreen(); });
    dashboardGrid.querySelectorAll("[data-briefing-preview]").forEach((button) => button.addEventListener("click", () => { const item = items.find((entry) => String(entry.id) === String(button.dataset.briefingPreview)); if (!item) return; const questions = briefingQuestions(item.questions); ui.drawer({ title: item.name, subtitle: "Perguntas do briefing", html: questions.length ? `<ol>${questions.map((question) => `<li>${briefingEsc(typeof question === "string" ? question : question?.label || question?.question || "Pergunta")}</li>`).join("")}</ol>` : "<p>Nenhuma pergunta cadastrada.</p>" }); }));
    dashboardGrid.querySelectorAll("[data-briefing-responses]").forEach((button) => button.addEventListener("click", () => { const item = items.find((entry) => String(entry.id) === String(button.dataset.briefingResponses)); if (!item) return; const responses = briefingResponses(item.responses); ui.drawer({ title: `Respostas · ${item.name}`, subtitle: "Dados enviados pelo cliente", html: Object.keys(responses).length ? Object.entries(responses).map(([key, value]) => `<p><strong>${briefingEsc(key)}</strong><br>${briefingEsc(typeof value === "object" ? JSON.stringify(value) : value)}</p>`).join("") : "<p>Nenhuma resposta registrada.</p>" }); }));
    dashboardGrid.querySelectorAll("[data-briefing-link]").forEach((button) => button.addEventListener("click", async () => { const item = items.find((entry) => String(entry.id) === String(button.dataset.briefingLink)); if (!item || button.dataset.busy === "1") return; const routeAtStart = location.hash, originalLabel = button.textContent; button.dataset.busy = "1"; button.disabled = true; button.setAttribute("aria-busy", "true"); button.textContent = "Gerando link…"; try { const data = item.public_token ? { path: `/briefing/${item.public_token}` } : await api(`/api/briefings/${item.id}/public-link`, { method: "POST", body: {} }); const link = `${location.origin}${data.path}`; await ui.copyText(link); if (location.hash !== routeAtStart || routeAtStart !== "#briefings" || !button.isConnected) return; button.textContent = "Link copiado"; toast("Link do briefing copiado.", "success"); } catch (error) { if (location.hash !== routeAtStart || !button.isConnected) return; button.textContent = originalLabel; toast(error.message, "error"); } finally { if (button.isConnected) { button.dataset.busy = ""; button.disabled = false; button.removeAttribute("aria-busy"); } } }));
    dashboardGrid.querySelectorAll("[data-briefing-edit]").forEach((button) => button.addEventListener("click", () => { const item = items.find((entry) => String(entry.id) === String(button.dataset.briefingEdit)); if (item) openEditDialog("briefing", { ...item, questions: JSON.stringify(briefingQuestions(item.questions), null, 2) }, `/api/briefings/${item.id}`); }));
    dashboardGrid.querySelectorAll("[data-briefing-delete]").forEach((button) => button.addEventListener("click", () => ui.confirmInline(button, { text: "Excluir briefing?", onConfirm: async () => { if (button.dataset.busy === "1") return; const routeAtStart = location.hash, originalLabel = button.textContent; button.dataset.busy = "1"; button.disabled = true; button.setAttribute("aria-busy", "true"); button.textContent = "Excluindo…"; try { await api(`/api/briefings/${button.dataset.briefingDelete}`, { method: "DELETE" }); if (location.hash !== routeAtStart || routeAtStart !== "#briefings" || !button.isConnected) return; toast("Briefing excluído.", "success"); renderBriefingsScreen(); } catch (error) { if (location.hash !== routeAtStart || !button.isConnected) return; button.textContent = originalLabel; toast(error.message, "error"); } finally { if (button.isConnected) { button.dataset.busy = ""; button.disabled = false; button.removeAttribute("aria-busy"); } } } })));
  } catch (error) { if (request !== briefingFilter.request || location.hash !== "#briefings") return; dashboardGrid.removeAttribute("aria-busy"); dashboardGrid.innerHTML = `<section class="page-intro"><div><p class="card-kicker">Operação</p><h2>${title}</h2></div></section>${stateBlock.error(error.message, "briefing-retry")}`; dashboardGrid.querySelector(".briefing-retry")?.addEventListener("click", renderBriefingsScreen); }
}

registerRoutes({ briefings: renderBriefingsScreen });
window.addEventListener("hashchange", () => { briefingFilter.request += 1; });
dashboardGrid.addEventListener("click", (event) => { if (event.target.closest(".briefing-retry")) renderBriefingsScreen(); });

const briefingResultsObserver = new MutationObserver(() => {
  const list = dashboardGrid.querySelector(".automation-list");
  const toolbar = list?.querySelector(".finance-toolbar");
  const grid = list?.querySelector(".template-grid");
  if (!list || !toolbar || !grid) return;
  let status = list.querySelector("[data-briefing-results]");
  if (!status) {
    status = document.createElement("p");
    status.className = "ui-filter-status";
    status.dataset.briefingResults = "true";
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    toolbar.insertAdjacentElement("afterend", status);
  }
  const visible = [...grid.querySelectorAll("[data-briefing-row]")].filter((row) => !row.hidden).length;
  const message = `${ui.number(visible)} ${visible === 1 ? "briefing encontrado" : "briefings encontrados"}.`;
  if (status.textContent !== message) status.textContent = message;
});
briefingResultsObserver.observe(dashboardGrid, { childList: true, subtree: true, attributes: true, attributeFilter: ["hidden"] });

new MutationObserver(() => {
  const search = dashboardGrid.querySelector("[data-briefing-search]");
  if (search) { search.name = "search"; search.setAttribute("autocomplete", "off"); search.type = "search"; }
  const status = dashboardGrid.querySelector("[data-briefing-filter]");
  if (status) { status.name = "status"; status.setAttribute("autocomplete", "off"); }
  dashboardGrid.querySelectorAll("button, input, select").forEach((control) => { control.style.touchAction = "manipulation"; });
  dashboardGrid.querySelectorAll(".automation-list .finance-status").forEach((badge) => { badge.setAttribute("role", "status"); badge.setAttribute("aria-live", "polite"); });
  dashboardGrid.querySelectorAll(".state-loading p").forEach((label) => { if (label.textContent?.includes("...")) label.textContent = label.textContent.replaceAll("...", "…"); });
}).observe(dashboardGrid, { childList: true, subtree: true });

new MutationObserver(() => {
  dashboardGrid.querySelectorAll("[data-briefing-link], [data-briefing-delete]").forEach((button) => {
    if (button.disabled) button.setAttribute("aria-busy", "true");
    else button.removeAttribute("aria-busy");
  });
}).observe(dashboardGrid, { childList: true, subtree: true, attributes: true, attributeFilter: ["disabled"] });
