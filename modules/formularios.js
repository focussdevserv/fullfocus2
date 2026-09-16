/* Biblioteca de formulários com manutenção e acesso público real. */
const toast = (...args) => { if (location.hash === "#formularios") ui.toast(...args); };
const formEsc = (value) => escapeHtml(value ?? "");
const formFilterState = { search: "", status: "", request: 0 };
const formStatus = { draft: "Rascunho", published: "Publicado", active: "Ativo", inactive: "Inativo", archived: "Arquivado" };
const formKind = { capture: "Captação", quote: "Orçamento", briefing: "Briefing", support: "Suporte", satisfaction: "Pesquisa de satisfação", onboarding: "Onboarding" };

const formMetric = (label, value) => `<article class="data-card finance-metric"><span>${formEsc(label)}</span><strong>${formEsc(value)}</strong></article>`;
async function renderFormsScreen() {
  if (location.hash !== "#formularios") return;
  const request = formFilterState.request = (formFilterState.request || 0) + 1;
  dashboardGrid.setAttribute("aria-busy", "true");
  const title = "Formulários", description = "Capte informações e transforme respostas em leads, oportunidades, tickets ou tarefas.";
  dashboardGrid.innerHTML = `<section class="page-intro"><div><p class="card-kicker">Automações</p><h2>${title}</h2><p>${description}</p></div><button class="button button-primary compact-action" data-form-new type="button">+ Novo formulário</button></section>${stateBlock.loading("Carregando formulários…")}`;
  try {
    const params = new URLSearchParams(); if (formFilterState.search) params.set("search", formFilterState.search); if (formFilterState.status) params.set("status", formFilterState.status); const items = (await api(`/api/forms?${params}`)).forms || [];
    if (request !== formFilterState.request || location.hash !== "#formularios") return;
    dashboardGrid.innerHTML = `<section class="page-intro"><div><p class="card-kicker">Automações</p><h2>${title}</h2><p>${description}</p></div><button class="button button-primary compact-action" data-form-new type="button">+ Novo formulário</button></section><section class="data-card automation-list"><div class="finance-toolbar"><input type="search" data-form-search placeholder="Buscar nome ou tipo…" aria-label="Buscar formulário"><select data-form-filter aria-label="Filtrar status"><option value="">Todos os status</option>${Object.entries(formStatus).map(([key, label]) => `<option value="${key}">${label}</option>`).join("")}</select></div><div class="template-grid">${items.length ? items.map((item) => { const schema = Array.isArray(item.schema) ? item.schema : Array.isArray(item.schema?.fields) ? item.schema.fields : []; return `<article class="data-card template-card" data-form-row data-status="${formEsc(item.status || "draft")}"><div class="section-heading"><div><h3>${formEsc(item.name)}</h3><small>${formEsc(formKind[item.kind] || item.kind || "Formulário")} · ${schema.length} campo(s)</small></div><span class="finance-status ${item.status === "published" || item.status === "active" ? "positive" : "neutral"}">${formStatus[item.status] || formEsc(item.status || "Rascunho")}</span></div><p class="template-preview-text">${schema.length ? formEsc(schema.map((field) => typeof field === "string" ? field : field?.label || field?.name || "Campo").join(" · ")) : "Nenhum campo configurado"}</p><div class="template-actions"><button class="compact-action" data-form-preview="${item.id}" type="button">Ver campos</button>${item.public_token ? `<button class="compact-action" data-form-open="${formEsc(item.public_token)}" type="button">Abrir formulário</button>` : ""}<button class="compact-action" data-form-edit="${item.id}" type="button">Editar</button><button class="compact-action" data-form-delete="${item.id}" type="button">Excluir</button></div></article>`; }).join("") : stateBlock.empty("Nenhum formulário", "Crie um formulário para captar informações do cliente.", "Criar formulário", "form-empty")}</div></section>`;
    dashboardGrid.removeAttribute("aria-busy");
    dashboardGrid.querySelector(".automation-list")?.insertAdjacentHTML("beforebegin", ui.stats([{ label: "Formulários", value: ui.number(items.length) }, { label: "Publicados", value: ui.number(items.filter((item) => ["published", "active"].includes(item.status)).length), tone: "green" }, { label: "Rascunhos", value: ui.number(items.filter((item) => !item.status || item.status === "draft").length), tone: "orange" }, { label: "Com automação", value: ui.number(items.filter((item) => item.automation_config).length) }]));
    const openNew = () => openCreateDialog("form"); dashboardGrid.querySelector("[data-form-new]")?.addEventListener("click", openNew); dashboardGrid.querySelector(".form-empty")?.addEventListener("click", openNew);
    const filter = () => { const query = dashboardGrid.querySelector("[data-form-search]").value.toLocaleLowerCase("pt-BR"), status = dashboardGrid.querySelector("[data-form-filter]").value; dashboardGrid.querySelectorAll("[data-form-row]").forEach((row) => { row.hidden = (query && !row.textContent.toLocaleLowerCase("pt-BR").includes(query)) || (status && row.dataset.status !== status); }); };
    dashboardGrid.querySelector("[data-form-search]")?.addEventListener("input", filter); dashboardGrid.querySelector("[data-form-filter]")?.addEventListener("change", filter);
    dashboardGrid.querySelector("[data-form-search]")?.addEventListener("input", (event) => { formFilterState.search = event.currentTarget.value; });
    dashboardGrid.querySelector("[data-form-filter]")?.addEventListener("change", (event) => { formFilterState.status = event.currentTarget.value; });
    dashboardGrid.querySelectorAll("[data-form-preview]").forEach((button) => button.addEventListener("click", () => { const item = items.find((entry) => String(entry.id) === String(button.dataset.formPreview)); if (!item) return; const schema = Array.isArray(item.schema) ? item.schema : Array.isArray(item.schema?.fields) ? item.schema.fields : []; ui.drawer({ title: item.name, subtitle: formKind[item.kind] || item.kind || "Formulário", html: `<div class="template-drawer-content"><h3>Campos</h3>${schema.length ? `<ol>${schema.map((field) => `<li>${formEsc(typeof field === "string" ? field : field?.label || field?.name || "Campo")}</li>`).join("")}</ol>` : "<p>Nenhum campo configurado.</p>"}${item.automation_config ? `<h3>Automação</h3><pre>${formEsc(JSON.stringify(item.automation_config, null, 2))}</pre>` : ""}</div>` }); }));
    dashboardGrid.querySelectorAll("[data-form-responses]").forEach((button) => button.addEventListener("click", async () => { button.disabled = true; try { const data = await api(`/api/forms/${button.dataset.formResponses}/responses`), rows = data.responses || [], pagination = data.pagination || {}; const html = rows.length ? rows.map((entry, index) => `<article class="data-card"><h4>Envio ${Number(pagination.total || rows.length) - Number(pagination.offset || 0) - index}</h4><pre>${formEsc(JSON.stringify(entry.responses || {}, null, 2))}</pre></article>`).join("") : "<p>Nenhuma resposta recebida ainda.</p>"; ui.drawer({ title: data.form?.name || "Respostas", subtitle: `${pagination.total || rows.length || 0} envio(s)`, html: `<div class="template-drawer-content">${html}</div>` }); } catch (error) { toast(error.message, "error"); } finally { button.disabled = false; } }));
    dashboardGrid.querySelectorAll("[data-form-open]").forEach((button) => button.addEventListener("click", () => window.open(`${location.origin}/form/${encodeURIComponent(button.dataset.formOpen)}`, "_blank", "noopener,noreferrer")));
    dashboardGrid.querySelectorAll("[data-form-edit]").forEach((button) => button.addEventListener("click", () => { const item = items.find((entry) => String(entry.id) === String(button.dataset.formEdit)); if (item) { const editable = { ...item }; ["schema", "automation_config"].forEach((key) => { if (editable[key] && typeof editable[key] === "object") editable[key] = JSON.stringify(editable[key], null, 2); }); Promise.resolve(openEditDialog("form", editable, `/api/forms/${item.id}`)).catch((error) => toast(error.message, "error")); } }));
    dashboardGrid.querySelectorAll("[data-form-delete]").forEach((button) => button.addEventListener("click", () => ui.confirmInline(button, { text: "Excluir formulário?", onConfirm: async () => { const originalLabel = button.textContent; button.disabled = true; button.setAttribute("aria-busy", "true"); button.textContent = "Excluindo…"; try { await api(`/api/forms/${button.dataset.formDelete}`, { method: "DELETE" }); toast("Formulário excluído.", "success"); renderFormsScreen(); } catch (error) { button.disabled = false; button.removeAttribute("aria-busy"); button.textContent = originalLabel; toast(error.message, "error"); } } })));
  } catch (error) { if (request !== formFilterState.request || location.hash !== "#formularios") return; dashboardGrid.removeAttribute("aria-busy"); dashboardGrid.innerHTML = `<section class="page-intro"><div><p class="card-kicker">Automações</p><h2>${title}</h2></div></section>${stateBlock.error(error.message, "form-retry")}`; dashboardGrid.querySelector(".form-retry")?.addEventListener("click", renderFormsScreen); }
}

async function openFormResponsesSafely(button) {
  const routeAtStart = location.hash;
  if (routeAtStart !== "#formularios" || !button || button.dataset.formResponseBusy === "1") return;
  const originalLabel = button.textContent;
  button.dataset.formResponseBusy = "1";
  button.disabled = true;
  button.setAttribute("aria-busy", "true");
  button.textContent = "Carregando…";
  try {
    const data = await api(`/api/forms/${button.dataset.formResponses}/responses`);
    if (location.hash !== routeAtStart || !button.isConnected) return;
    const rows = data.responses || [], pagination = data.pagination || {};
    const html = rows.length ? rows.map((entry, index) => `<article class="data-card"><h4>Envio ${Number(pagination.total || rows.length) - Number(pagination.offset || 0) - index}</h4><pre>${formEsc(JSON.stringify(entry.responses || {}, null, 2))}</pre></article>`).join("") : "<p>Nenhuma resposta recebida ainda.</p>";
    ui.drawer({ title: data.form?.name || "Respostas", subtitle: `${pagination.total || rows.length || 0} envio(s)`, html: `<div class="template-drawer-content">${html}</div>` });
  } catch (error) {
    if (location.hash === routeAtStart) toast(error.message, "error");
  } finally {
    if (button.isConnected) {
      button.disabled = false;
      button.removeAttribute("aria-busy");
      button.textContent = originalLabel;
    }
    delete button.dataset.formResponseBusy;
  }
}

dashboardGrid.addEventListener("click", (event) => {
  const button = event.target.closest?.("[data-form-responses]");
  if (!button || location.hash !== "#formularios" || button.dataset.formResponseGuarded === "1") return;
  event.preventDefault();
  event.stopImmediatePropagation();
  button.dataset.formResponseGuarded = "1";
  openFormResponsesSafely(button).finally(() => { delete button.dataset.formResponseGuarded; });
}, true);

registerRoutes({ formularios: renderFormsScreen });
window.addEventListener("hashchange", () => {
  if (location.hash !== "#formularios") formFilterState.request += 1;
});

const formResultsObserver = new MutationObserver(() => {
  const list = dashboardGrid.querySelector(".automation-list");
  const toolbar = list?.querySelector(".finance-toolbar");
  const grid = list?.querySelector(".template-grid");
  if (!list || !toolbar || !grid) return;
  let status = list.querySelector("[data-form-results]");
  if (!status) {
    status = document.createElement("p");
    status.className = "ui-filter-status";
    status.dataset.formResults = "true";
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    toolbar.insertAdjacentElement("afterend", status);
  }
  const rows = [...grid.querySelectorAll("[data-form-row]")];
  const visible = rows.filter((row) => !row.hidden).length;
  const message = `${ui.number(visible)} ${visible === 1 ? "formulário encontrado" : "formulários encontrados"}.`;
  if (status.textContent !== message) status.textContent = message;
  dashboardGrid.querySelectorAll(".automation-list .finance-status").forEach((badge) => { badge.setAttribute("role", "status"); badge.setAttribute("aria-live", "polite"); });
  dashboardGrid.querySelectorAll("button, input, select").forEach((control) => {
    if (control.disabled) { control.setAttribute("aria-busy", "true"); if (control.textContent?.includes("...")) control.textContent = control.textContent.replaceAll("...", "…"); }
    else control.removeAttribute("aria-busy");
  });
});
formResultsObserver.observe(dashboardGrid, { childList: true, subtree: true, attributes: true, attributeFilter: ["disabled", "hidden"] });

const formPublishObserver = new MutationObserver(() => {
  if (location.hash.replace(/^#/, "") !== "formularios") return;
  const list = dashboardGrid.querySelector(".automation-list");
  // A estrutura.js também oferece o link público; marcar a lista evita
  // duplicar a ação e mantém aqui a versão que abre o formulário.
  if (list) {
    list.dataset.formLinks = "1";
    list.querySelectorAll(".template-actions button:not([data-form-preview]):not([data-form-open]):not([data-form-edit]):not([data-form-delete]):not([data-form-responses]):not([data-form-publish])").forEach((button) => {
      if (["Gerar link", "Copiar link"].includes(button.textContent.trim())) button.remove();
    });
  }
  dashboardGrid.querySelectorAll("[data-form-row]").forEach((row) => {
    const actions = row.querySelector(".template-actions"); if (!actions || actions.querySelector("[data-form-publish]")) return;
    const edit = row.querySelector("[data-form-edit]"); if (!edit) return;
    const responseButton = document.createElement("button"); responseButton.type = "button"; responseButton.className = "compact-action"; responseButton.dataset.formResponses = edit.dataset.formEdit; responseButton.textContent = "Ver respostas";
    actions.append(responseButton);
    const button = document.createElement("button"); button.type = "button"; button.className = "compact-action"; button.dataset.formPublish = edit.dataset.formEdit; button.textContent = "Publicar e gerar link";
    actions.append(button);
  });
});
formPublishObserver.observe(dashboardGrid, { childList: true, subtree: true });
let formSearchSnapshot;
dashboardGrid.addEventListener("input", (event) => {
  const input = event.target.closest?.("[data-form-search]");
  if (input) formSearchSnapshot = { value: input.value, position: input.selectionStart };
}, true);
const formSearchObserver = new MutationObserver(() => {
  const input = dashboardGrid.querySelector("[data-form-search]");
  if (!input) return;
  input.type = "search";
  input.name = "search";
  input.setAttribute("autocomplete", "off");
  input.placeholder = "Buscar nome ou tipo…";
  const status = dashboardGrid.querySelector("[data-form-filter]");
  if (status) { status.name = "status"; status.setAttribute("autocomplete", "off"); }
  if (!formSearchSnapshot) {
    input.value = formFilterState.search;
    const status = dashboardGrid.querySelector("[data-form-filter]");
    if (status) status.value = formFilterState.status;
    return;
  }
  if (input.value === formSearchSnapshot.value) {
    input.focus();
    try { input.setSelectionRange(formSearchSnapshot.position, formSearchSnapshot.position); } catch { /* busca sem cursor em alguns navegadores */ }
  }
  formSearchSnapshot = null;
});
formSearchObserver.observe(dashboardGrid, { childList: true, subtree: true });

dashboardGrid.addEventListener("click", (event) => {
  const button = event.target.closest?.("[data-form-responses]");
  if (!button || button.dataset.formLoading === "1") return;
  button.dataset.formLoading = "1";
  button.dataset.formOriginalLabel = button.textContent;
  button.disabled = true;
  button.setAttribute("aria-busy", "true");
  button.textContent = "Carregando…";
}, true);

new MutationObserver(() => {
  dashboardGrid.querySelectorAll("[data-form-responses][data-form-loading=\"1\"]").forEach((button) => {
    if (button.disabled) return;
    button.textContent = button.dataset.formOriginalLabel || "Ver respostas";
    button.removeAttribute("aria-busy");
    delete button.dataset.formLoading;
    delete button.dataset.formOriginalLabel;
  });
}).observe(dashboardGrid, { childList: true, subtree: true, attributes: true, attributeFilter: ["disabled"] });

dashboardGrid.addEventListener("click", async (event) => {
  const button = event.target.closest?.("[data-form-publish]");
  if (!button || location.hash !== "#formularios") return;
  const routeAtStart = location.hash;
  event.preventDefault();
  event.stopImmediatePropagation();
  if (button.dataset.busy === "1") return;
  button.dataset.busy = "1";
  button.disabled = true;
  button.setAttribute("aria-busy", "true");
  button.textContent = "Publicando…";
  const popup = window.open("about:blank", "_blank", "noopener,noreferrer");
  try {
    const data = await api(`/api/forms/${button.dataset.formPublish}/public-link`, { method: "POST", body: {} });
    const link = `${location.origin}${data.path}`;
    await ui.copyText(link);
    if (location.hash !== routeAtStart || !button.isConnected) return;
    if (popup) popup.location.href = link;
    button.textContent = "Copiar link novamente";
    toast("Formulário publicado; link copiado.", "success");
  } catch (error) {
    popup?.close();
    if (location.hash === routeAtStart && button.isConnected) { button.textContent = "Publicar e gerar link"; toast(error.message, "error"); }
  } finally {
    if (button.isConnected) { button.disabled = false; button.removeAttribute("aria-busy"); button.dataset.busy = ""; }
  }
}, true);

let formReloadTimer;
dashboardGrid.addEventListener("input", (event) => { if (!event.target.matches("[data-form-search]")) return; formFilterState.search = event.target.value.trim(); clearTimeout(formReloadTimer); formReloadTimer = setTimeout(renderFormsScreen, 250); });
dashboardGrid.addEventListener("change", (event) => { if (!event.target.matches("[data-form-filter]")) return; formFilterState.status = event.target.value; renderFormsScreen(); });

new MutationObserver(() => {
  dashboardGrid.querySelectorAll("button, input, select").forEach((control) => { control.style.touchAction = "manipulation"; });
  dashboardGrid.querySelectorAll("[data-form-publish]").forEach((button) => {
    if (button.textContent?.includes("...")) button.textContent = button.textContent.replaceAll("...", "…");
  });
}).observe(dashboardGrid, { childList: true, subtree: true });
