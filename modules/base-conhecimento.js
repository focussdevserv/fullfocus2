/* Biblioteca de conhecimento com leitura, busca e manutenção dos artigos reais. */
const toast = (...args) => { if (location.hash === "#base-de-conhecimento") ui.toast(...args); };
const kbEsc = (value) => escapeHtml(value ?? "");
const kbFilterState = { search: "", status: "", category: "", request: 0 };
const kbStatus = { draft: "Rascunho", published: "Publicado", archived: "Arquivado", active: "Ativo", inactive: "Inativo" };

const kbMetric = (label, value) => `<article class="data-card finance-metric"><span>${kbEsc(label)}</span><strong>${kbEsc(value)}</strong></article>`;
async function renderKnowledgeScreen() {
  if (location.hash !== "#base-de-conhecimento") return;
  const request = kbFilterState.request = (kbFilterState.request || 0) + 1;
  dashboardGrid.setAttribute("aria-busy", "true");
  const title = "Base de conhecimento", description = "Documentação interna, processos e respostas reutilizáveis para a equipe.";
  dashboardGrid.innerHTML = `<section class="page-intro"><div><p class="card-kicker">Operação</p><h2>${title}</h2><p>${description}</p></div><button class="button button-primary compact-action" data-kb-new type="button">+ Novo artigo</button></section>${stateBlock.loading("Carregando artigos…")}`;
  try {
    const params = new URLSearchParams(); if (kbFilterState.search) params.set("search", kbFilterState.search); if (kbFilterState.status) params.set("status", kbFilterState.status); if (kbFilterState.category) params.set("category", kbFilterState.category); const items = (await api(`/api/knowledge_articles?${params}`)).knowledge_articles || [];
    if (request !== kbFilterState.request || location.hash !== "#base-de-conhecimento") return;
    const categories = [...new Set(items.map((item) => item.category).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b), "pt-BR"));
    dashboardGrid.innerHTML = `<section class="page-intro"><div><p class="card-kicker">Operação</p><h2>${title}</h2><p>${description}</p></div><button class="button button-primary compact-action" data-kb-new type="button">+ Novo artigo</button></section><section class="data-card automation-list"><div class="finance-toolbar"><input type="search" data-kb-search value="${kbEsc(kbFilterState.search)}" placeholder="Buscar título, categoria ou conteúdo…" aria-label="Buscar artigo"><select data-kb-filter aria-label="Filtrar status"><option value="">Todos os status</option>${Object.entries(kbStatus).map(([key, label]) => `<option value="${key}"${kbFilterState.status === key ? " selected" : ""}>${label}</option>`).join("")}</select><select data-kb-category aria-label="Filtrar categoria"><option value="">Todas as categorias</option>${categories.map((category) => `<option value="${kbEsc(category)}"${kbFilterState.category === category ? " selected" : ""}>${kbEsc(category)}</option>`).join("")}</select></div><div class="template-grid">${items.length ? items.map((item) => `<article class="data-card template-card" data-kb-row data-status="${kbEsc(item.status || "draft")}" data-category="${kbEsc(item.category || "")}"><div class="section-heading"><div><h3>${kbEsc(item.title)}</h3><small>${kbEsc(item.category || "Sem categoria")}</small></div><span class="finance-status ${item.status === "published" || item.status === "active" ? "positive" : "neutral"}">${kbStatus[item.status] || kbEsc(item.status || "Rascunho")}</span></div><p class="template-preview-text">${kbEsc(item.body || "Sem conteúdo")}</p><div class="template-actions"><button class="compact-action" data-kb-read="${kbEsc(item.id)}" type="button">Ler artigo</button><button class="compact-action" data-kb-edit="${kbEsc(item.id)}" type="button">Editar</button><button class="compact-action" data-kb-delete="${kbEsc(item.id)}" type="button">Excluir</button></div></article>`).join("") : stateBlock.empty("Nenhum artigo", "Registre processos e respostas para a equipe.", "Criar artigo", "kb-empty")}</div></section>`;
    dashboardGrid.removeAttribute("aria-busy");
    dashboardGrid.querySelector(".automation-list")?.insertAdjacentHTML("beforebegin", ui.stats([{ label: "Artigos", value: ui.number(items.length) }, { label: "Publicados", value: ui.number(items.filter((item) => ["published", "active"].includes(item.status)).length), tone: "green" }, { label: "Rascunhos", value: ui.number(items.filter((item) => !item.status || item.status === "draft").length), tone: "orange" }, { label: "Categorias", value: ui.number(categories.length) }]));
    const openNew = () => openCreateDialog("knowledge_article"); dashboardGrid.querySelector("[data-kb-new]")?.addEventListener("click", openNew); dashboardGrid.querySelector(".kb-empty")?.addEventListener("click", openNew);
    const filter = () => { const query = dashboardGrid.querySelector("[data-kb-search]").value.toLocaleLowerCase("pt-BR"), status = dashboardGrid.querySelector("[data-kb-filter]").value, category = dashboardGrid.querySelector("[data-kb-category]").value; dashboardGrid.querySelectorAll("[data-kb-row]").forEach((row) => { row.hidden = (query && !row.textContent.toLocaleLowerCase("pt-BR").includes(query)) || (status && row.dataset.status !== status) || (category && row.dataset.category !== category); }); };
    const search = dashboardGrid.querySelector("[data-kb-search]"), status = dashboardGrid.querySelector("[data-kb-filter]"), category = dashboardGrid.querySelector("[data-kb-category]"); if (search) { search.placeholder = "Buscar título, categoria ou conteúdo…"; search.name = "search"; search.setAttribute("autocomplete", "off"); } if (status) { status.name = "status"; status.setAttribute("autocomplete", "off"); } if (category) { category.name = "category"; category.setAttribute("autocomplete", "off"); } search?.addEventListener("input", filter); status?.addEventListener("change", filter); category?.addEventListener("change", filter);
    dashboardGrid.querySelectorAll("[data-kb-read]").forEach((button) => button.addEventListener("click", () => { const item = items.find((entry) => String(entry.id) === String(button.dataset.kbRead)); if (!item) return; ui.drawer({ title: item.title, subtitle: item.category || "Base de conhecimento", html: `<article class="knowledge-reader"><div class="knowledge-body">${kbEsc(item.body || "Sem conteúdo")}</div>${item.tags ? `<small>Etiquetas: ${kbEsc(item.tags)}</small>` : ""}</article>` }); }));
    dashboardGrid.querySelectorAll("[data-kb-edit]").forEach((button) => button.addEventListener("click", () => { const item = items.find((entry) => String(entry.id) === String(button.dataset.kbEdit)); if (item) openEditDialog("knowledge_article", item, `/api/knowledge_articles/${item.id}`); }));
  } catch (error) { if (request !== kbFilterState.request || location.hash !== "#base-de-conhecimento") return; dashboardGrid.innerHTML = `<section class="page-intro"><div><p class="card-kicker">Operação</p><h2>${title}</h2></div></section>${stateBlock.error(error.message, "kb-retry")}`; dashboardGrid.querySelector(".kb-retry")?.addEventListener("click", renderKnowledgeScreen); }
}

registerRoutes({ "base-de-conhecimento": renderKnowledgeScreen });
dashboardGrid.addEventListener("click", (event) => {
  const button = event.target.closest?.("[data-kb-delete]");
  if (!button || button.dataset.kbDeleteGuarded === "1" || location.hash !== "#base-de-conhecimento") return;
  event.preventDefault();
  event.stopImmediatePropagation();
  button.dataset.kbDeleteGuarded = "1";
  const routeAtStart = location.hash;
  const requestAtStart = kbFilterState.request;
  ui.confirmInline(button, {
    text: "Excluir artigo?",
    onConfirm: async () => {
      const originalLabel = button.textContent;
      button.disabled = true;
      button.setAttribute("aria-busy", "true");
      button.textContent = "Excluindo…";
      try {
        await api(`/api/knowledge_articles/${button.dataset.kbDelete}`, { method: "DELETE" });
        if (location.hash === routeAtStart && routeAtStart === "#base-de-conhecimento" && requestAtStart === kbFilterState.request && button.isConnected) { toast("Artigo removido.", "success"); renderKnowledgeScreen(); }
      } catch (error) {
        button.disabled = false;
        button.removeAttribute("aria-busy");
        button.textContent = originalLabel;
        if (location.hash === routeAtStart && routeAtStart === "#base-de-conhecimento" && requestAtStart === kbFilterState.request && button.isConnected) toast(error.message, "error");
      } finally {
        delete button.dataset.kbDeleteGuarded;
      }
    },
    onCancel: () => { delete button.dataset.kbDeleteGuarded; }
  });
}, true);
let kbSearchSnapshot = null;
dashboardGrid.addEventListener("input", (event) => {
  if (!event.target.matches("[data-kb-search]")) return;
  kbSearchSnapshot = { value: event.target.value, start: event.target.selectionStart, end: event.target.selectionEnd };
}, true);
new MutationObserver(() => {
  const input = dashboardGrid.querySelector("[data-kb-search]");
  if (!input) return;
  input.type = "search";
  input.setAttribute("name", "search");
  input.setAttribute("autocomplete", "off");
  if (!kbSearchSnapshot) return;
  input.focus(); input.setSelectionRange(kbSearchSnapshot.start, kbSearchSnapshot.end); kbSearchSnapshot = null;
}).observe(dashboardGrid, { childList: true });
let kbReloadTimer;
dashboardGrid.addEventListener("input", (event) => { if (!event.target.matches("[data-kb-search]")) return; kbFilterState.search = event.target.value.trim(); clearTimeout(kbReloadTimer); kbReloadTimer = setTimeout(renderKnowledgeScreen, 250); });
dashboardGrid.addEventListener("change", (event) => { if (event.target.matches("[data-kb-filter]")) kbFilterState.status = event.target.value; if (event.target.matches("[data-kb-category]")) kbFilterState.category = event.target.value; if (event.target.matches("[data-kb-filter], [data-kb-category]")) renderKnowledgeScreen(); });

new MutationObserver(() => {
  if (dashboardGrid.querySelector(".state-loading")) dashboardGrid.setAttribute("aria-busy", "true");
  else dashboardGrid.removeAttribute("aria-busy");
  dashboardGrid.querySelectorAll("[data-kb-search], [data-kb-filter], [data-kb-category]").forEach((control) => {
    if (!control.name) control.name = control.matches("[data-kb-search]") ? "search" : control.matches("[data-kb-filter]") ? "status" : "category";
    control.setAttribute("autocomplete", "off");
  });
  dashboardGrid.querySelectorAll("[data-kb-new], [data-kb-read], [data-kb-edit], [data-kb-delete]").forEach((button) => {
    if (button.disabled) button.setAttribute("aria-busy", "true");
    else button.removeAttribute("aria-busy");
  });
  dashboardGrid.querySelectorAll(".automation-list .finance-status").forEach((status) => { status.setAttribute("role", "status"); status.setAttribute("aria-live", "polite"); });
  dashboardGrid.querySelectorAll(".state-loading p").forEach((label) => { label.textContent = label.textContent.replaceAll("...", "…"); });
}).observe(dashboardGrid, { childList: true, subtree: true, attributes: true, attributeFilter: ["disabled"] });

const kbResultsObserver = new MutationObserver(() => {
  const list = dashboardGrid.querySelector(".automation-list");
  const grid = list?.querySelector(".template-grid");
  if (!list || !grid) return;
  let status = list.querySelector("[data-kb-results]");
  if (!status) {
    status = document.createElement("p");
    status.className = "ui-filter-status";
    status.dataset.kbResults = "true";
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    list.insertBefore(status, grid);
  }
  const visible = [...grid.querySelectorAll("[data-kb-row]")].filter((row) => !row.hidden).length;
  status.textContent = `${ui.number(visible)} ${visible === 1 ? "artigo encontrado" : "artigos encontrados"}.`;
});
kbResultsObserver.observe(dashboardGrid, { childList: true, subtree: true, attributes: true, attributeFilter: ["hidden"] });
