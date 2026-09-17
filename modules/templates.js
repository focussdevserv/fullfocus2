const templateEsc = (value) => escapeHtml(value ?? "");
const toast = (...args) => { if (location.hash === "#templates") ui.toast(...args); };
const templateTypes = { proposal: "Proposta", contract: "Contrato", project: "Projeto", task: "Tarefa", checklist: "Checklist", charge: "Cobrança", followup: "Follow-up", support: "Atendimento", ticket: "Resposta de ticket", briefing: "Briefing", delivery_term: "Termo de entrega", report: "Relatório", notification: "Notificação", email: "E-mail", message: "Mensagem", whatsapp: "WhatsApp" };
const templateFilter = { search: "", kind: "", request: 0 };
const templateFields = [
  { name: "name", label: "Nome", required: true, placeholder: "Ex.: Boas-vindas ao cliente…" },
  { name: "kind", label: "Tipo", type: "select", options: Object.entries(templateTypes), required: true },
  { name: "category", label: "Categoria", required: false, placeholder: "Ex.: Comercial…" },
  { name: "subject", label: "Assunto", required: false, placeholder: "Usado em e-mails e mensagens…" },
  { name: "body", label: "Conteúdo", type: "textarea", rows: 8, required: true, placeholder: "Escreva o conteúdo do template…" },
  { name: "variables", label: "Variáveis disponíveis", required: false, placeholder: "Ex.: {{cliente.nome}}, {{projeto.nome}}…", help: "Separe por vírgulas ou espaços." },
  { name: "language", label: "Idioma", required: false, value: "pt-BR" },
  { name: "internal_notes", label: "Notas internas", type: "textarea", rows: 3, required: false },
];

function templateForm(item = null) {
  const routeAtStart = location.hash;
  if (routeAtStart !== "#templates") return;
  const values = { language: "pt-BR", ...item };
  ui.form({ title: item ? "Editar template" : "Novo template", subtitle: "Automações · Templates", values, fields: templateFields, submitLabel: item ? "Salvar alterações" : "Criar template", onSubmit: async (data) => { await api(item ? `/api/templates/${item.id}` : "/api/templates", { method: item ? "PATCH" : "POST", body: data }); if (location.hash !== routeAtStart || location.hash !== "#templates") return; toast(item ? "Template atualizado." : "Template criado.", "success"); renderTemplatesScreen(); } });
}

function previewTemplate(item) {
  if (!item) return;
  ui.drawer({ title: item.name || "Template", subtitle: `${templateTypes[item.kind] || item.kind || "Modelo"}${item.category ? ` · ${item.category}` : ""}`, html: `<div class="template-drawer-content">${item.subject ? `<div class="template-subject"><small>Assunto</small><strong>${templateEsc(item.subject)}</strong></div>` : ""}<pre>${templateEsc(item.body || "Sem conteúdo")}</pre>${item.variables ? `<div class="template-variables"><small>Variáveis</small><p>${templateEsc(item.variables)}</p></div>` : ""}${ui.facts([["Versão", item.version || 1], ["Idioma", item.language || "pt-BR"], ["Padrão", item.is_default ? "Sim" : "Não"]])}</div>` });
}

async function runTemplateAction(button, { endpoint, loading, reset, success }) {
  const routeAtStart = location.hash;
  if (!button || routeAtStart !== "#templates" || button.dataset.busy === "1") return;
  const originalLabel = button.textContent;
  button.dataset.busy = "1";
  button.disabled = true;
  button.setAttribute("aria-busy", "true");
  button.textContent = loading;
  try {
    await api(endpoint, { method: endpoint.endsWith("/default") ? "PATCH" : "POST", body: {} });
    if (location.hash !== routeAtStart || !button.isConnected) return;
    toast(success, "success");
    renderTemplatesScreen();
  } catch (error) {
    if (location.hash !== routeAtStart || !button.isConnected) return;
    button.disabled = false;
    button.removeAttribute("aria-busy");
    button.textContent = reset || originalLabel;
    toast(error.message, "error");
  } finally {
    if (button.isConnected) {
      button.dataset.busy = "";
      button.disabled = false;
      button.removeAttribute("aria-busy");
    }
  }
}

async function renderTemplatesScreen() {
  if (location.hash !== "#templates") return;
  const request = templateFilter.request = (templateFilter.request || 0) + 1;
  dashboardGrid.setAttribute("aria-busy", "true");
  const title = "Templates", description = "Modelos reutilizáveis para propostas, contratos, mensagens e operação.";
  dashboardGrid.innerHTML = `${ui.header({ kicker: "Automações", title, description, actions: ui.button({ label: "+ Novo template", attr: "data-template-new" }) })}${stateBlock.loading("Carregando templates…")}`;
  try {
    const params = new URLSearchParams(); if (templateFilter.search) params.set("search", templateFilter.search); if (templateFilter.kind) params.set("kind", templateFilter.kind); const items = (await api(`/api/templates?${params}`)).templates || [];
    if (request !== templateFilter.request || location.hash !== "#templates") return;
    const available = items.filter((item) => item.active !== false).length, defaults = items.filter((item) => item.is_default).length;
    dashboardGrid.innerHTML = `${ui.header({ kicker: "Automações", title, description, actions: ui.button({ label: "+ Novo template", attr: "data-template-new" }) })}${ui.stats([{ label: "Templates", value: ui.number(items.length) }, { label: "Disponíveis", value: ui.number(available), tone: "green" }, { label: "Definidos como padrão", value: ui.number(defaults) }, { label: "Com categoria", value: ui.number(items.filter((item) => item.category).length) }])}<section class="data-card automation-list"><div class="ui-toolbar"><input class="ui-search" type="search" data-template-search value="${templateEsc(templateFilter.search)}" placeholder="Buscar nome, categoria ou conteúdo…" aria-label="Buscar template"><select class="ui-select" data-template-filter aria-label="Filtrar tipo"><option value="">Todos os tipos</option>${Object.entries(templateTypes).map(([key, label]) => `<option value="${key}">${label}</option>`).join("")}</select></div><div class="template-grid">${items.length ? items.map((item) => `<article class="data-card template-card"><div class="section-heading"><div><h3>${templateEsc(item.name || "Sem nome")}</h3><small>${templateEsc(templateTypes[item.kind] || item.kind || "Modelo")}${item.category ? ` · ${templateEsc(item.category)}` : ""}</small></div><span class="finance-status ${item.is_default ? "positive" : item.active === false ? "neutral" : "positive"}">${item.is_default ? "Padrão" : item.active === false ? "Inativo" : "Disponível"}</span></div>${item.subject ? `<p class="template-subject-line"><strong>Assunto:</strong> ${templateEsc(item.subject)}</p>` : ""}<p class="template-preview-text">${templateEsc(item.body || "Sem conteúdo")}</p><small class="template-version">Versão ${templateEsc(item.version || 1)}${item.variables ? ` · ${templateEsc(item.variables)}` : ""}</small><div class="template-actions"><button class="compact-action" data-template-preview="${templateEsc(item.id)}" type="button">Visualizar</button><button class="compact-action" data-template-edit="${templateEsc(item.id)}" type="button">Editar</button><button class="compact-action" data-template-duplicate="${templateEsc(item.id)}" type="button">Duplicar</button>${item.is_default ? "" : `<button class="compact-action" data-template-default="${templateEsc(item.id)}" type="button">Definir padrão</button>`}<button class="compact-action" data-template-delete="${templateEsc(item.id)}" type="button">Excluir</button></div></article>`).join("") : ui.empty({ title: "Nenhum template encontrado", text: "Crie um modelo para reutilizar em seus fluxos de trabalho.", cta: "Criar template", attr: "data-template-empty" })}</div></section>`;
    dashboardGrid.removeAttribute("aria-busy");
    const search = dashboardGrid.querySelector("[data-template-search]"), kind = dashboardGrid.querySelector("[data-template-filter]"); kind.value = templateFilter.kind; let timer; search?.addEventListener("input", () => { clearTimeout(timer); templateFilter.search = search.value.trim(); timer = setTimeout(renderTemplatesScreen, 250); }); kind?.addEventListener("change", () => { templateFilter.kind = kind.value; renderTemplatesScreen(); });
    dashboardGrid.querySelector("[data-template-new]")?.addEventListener("click", () => templateForm()); dashboardGrid.querySelector("[data-template-empty]")?.addEventListener("click", () => templateForm());
    dashboardGrid.querySelectorAll("[data-template-preview]").forEach((button) => button.addEventListener("click", () => previewTemplate(items.find((item) => String(item.id) === String(button.dataset.templatePreview)))));
    dashboardGrid.querySelectorAll("[data-template-edit]").forEach((button) => button.addEventListener("click", () => { const item = items.find((entry) => String(entry.id) === String(button.dataset.templateEdit)); if (item) Promise.resolve(templateForm(item)).catch((error) => toast(error.message, "error")); }));
    dashboardGrid.querySelectorAll("[data-template-duplicate]").forEach((button) => button.addEventListener("click", () => runTemplateAction(button, { endpoint: `/api/templates/${button.dataset.templateDuplicate}/duplicate`, loading: "Duplicando…", reset: "Duplicar", success: "Template duplicado." })));
    dashboardGrid.querySelectorAll("[data-template-default]").forEach((button) => button.addEventListener("click", () => runTemplateAction(button, { endpoint: `/api/templates/${button.dataset.templateDefault}/default`, loading: "Salvando…", reset: "Definir padrão", success: "Template padrão definido." })));
    dashboardGrid.querySelectorAll("[data-template-delete]").forEach((button) => button.addEventListener("click", () => ui.confirmInline(button, { text: "Excluir template?", onConfirm: async () => { if (button.disabled) return; const routeAtStart = location.hash, originalLabel = button.textContent; button.disabled = true; button.setAttribute("aria-busy", "true"); button.textContent = "Excluindo…"; try { await api(`/api/templates/${button.dataset.templateDelete}`, { method: "DELETE" }); if (location.hash !== routeAtStart || routeAtStart !== "#templates" || !button.isConnected) return; toast("Template excluído.", "success"); renderTemplatesScreen(); } catch (error) { if (location.hash !== routeAtStart || !button.isConnected) return; button.disabled = false; button.removeAttribute("aria-busy"); button.textContent = originalLabel; toast(error.message, "error"); } finally { if (button.isConnected) { button.disabled = false; button.removeAttribute("aria-busy"); } } } })));
  } catch (error) { if (request !== templateFilter.request || location.hash !== "#templates") return; dashboardGrid.removeAttribute("aria-busy"); dashboardGrid.innerHTML = `${ui.header({ kicker: "Automações", title, description })}${stateBlock.error(error.message, "template-retry")}`; dashboardGrid.querySelector(".template-retry")?.addEventListener("click", renderTemplatesScreen); }
}

registerRoutes({ templates: renderTemplatesScreen });

let templateSearchSnapshot;
dashboardGrid.addEventListener("input", (event) => {
  const input = event.target.closest?.("[data-template-search]");
  if (input) templateSearchSnapshot = { value: input.value, position: input.selectionStart };
}, true);
const templateSearchObserver = new MutationObserver(() => {
  const input = dashboardGrid.querySelector("[data-template-search]");
  if (!input) return;
  input.type = "search";
  input.name = "search";
  input.setAttribute("autocomplete", "off");
  if (templateSearchSnapshot && input.value === templateSearchSnapshot.value) {
    input.focus();
    try { input.setSelectionRange(templateSearchSnapshot.position, templateSearchSnapshot.position); } catch { /* busca sem cursor em alguns navegadores */ }
  }
  templateSearchSnapshot = null;
});
templateSearchObserver.observe(dashboardGrid, { childList: true, subtree: true });

new MutationObserver(() => {
  const kind = dashboardGrid.querySelector("[data-template-filter]");
  if (kind) { kind.name = "kind"; kind.setAttribute("autocomplete", "off"); }
  dashboardGrid.querySelectorAll("[data-template-duplicate], [data-template-default]").forEach((button) => {
    if (button.disabled) button.setAttribute("aria-busy", "true");
    else button.removeAttribute("aria-busy");
  });
  dashboardGrid.querySelectorAll(".state-loading p").forEach((label) => { if (label.textContent?.includes("...")) label.textContent = label.textContent.replaceAll("...", "…"); });
  dashboardGrid.querySelectorAll(".automation-list .finance-status").forEach((status) => { status.setAttribute("role", "status"); status.setAttribute("aria-live", "polite"); });
  const list = dashboardGrid.querySelector(".automation-list"), grid = list?.querySelector(".template-grid");
  if (list && grid) {
    let status = list.querySelector("[data-template-results]");
    if (!status) { status = document.createElement("p"); status.className = "ui-filter-status"; status.dataset.templateResults = "true"; status.setAttribute("role", "status"); status.setAttribute("aria-live", "polite"); list.querySelector(".ui-toolbar")?.after(status); }
    const count = grid.querySelectorAll(".template-card").length;
    const label = count === 1 ? "1 template encontrado" : `${count} templates encontrados`;
    if (status.textContent !== label) status.textContent = label;
  }
}).observe(dashboardGrid, { childList: true, subtree: true, attributes: true, attributeFilter: ["disabled"] });
