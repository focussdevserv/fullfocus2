const toast = (...args) => { if (location.hash === "#integracoes") ui.toast(...args); };
const integrationEsc = (value) => escapeHtml(value ?? "");
const integrationLabel = { whatsapp: "WhatsApp / Evolution API", email: "Gmail", smtp: "SMTP", google_calendar: "Google Calendar", google_drive: "Google Drive", github: "GitHub", n8n: "n8n", asaas: "Asaas", stripe: "Stripe", firebase: "Firebase", supabase: "Supabase", cnpj: "Consulta CNPJ", esign: "Assinatura eletrônica", webhook: "Webhook", api: "API própria" };
const integrationProviders = Object.entries(integrationLabel);
const integrationState = { search: "", status: "", offset: 0, request: 0 };
const integrationFields = [
  { name: "provider", label: "Provedor", type: "select", options: integrationProviders, required: true },
  { name: "account_name", label: "Nome da conta", required: false, placeholder: "Ex.: Conta comercial principal" },
  { name: "category", label: "Categoria", required: false, placeholder: "Ex.: Comunicação" },
  { name: "environment", label: "Ambiente", type: "select", options: [["production", "Produção"], ["sandbox", "Sandbox"], ["development", "Desenvolvimento"]], required: false },
  { name: "configText", label: "Configuração (JSON)", type: "textarea", rows: 6, required: false, placeholder: '{"url":"https://exemplo.com/webhook"}', help: "Chaves e tokens são armazenados com proteção e nunca aparecem completos na listagem." },
  { name: "enabled_events", label: "Eventos habilitados", required: false, placeholder: "Ex.: lead_created, payment_confirmed" },
  { name: "responsible", label: "Responsável", required: false },
];

integrationFields.forEach((field) => {
  if (field.placeholder && !field.placeholder.endsWith("…")) field.placeholder += "…";
});

function integrationDetails(item) {
  if (!item) return;
  const value = (entry) => entry === null || entry === undefined || entry === "" ? "—" : typeof entry === "object" ? JSON.stringify(entry, null, 2) : String(entry);
  ui.drawer({ title: integrationLabel[item.provider] || item.provider || "Integração", subtitle: item.account_name || "Configuração externa", html: `${ui.facts([["Status", item.status === "connected" ? "Conectada" : item.status === "error" ? "Com erro" : "Desconectada"], ["Ambiente", item.environment], ["Categoria", item.category], ["Responsável", item.responsible], ["Última sincronização", ui.dateTime(item.last_sync_at)], ["Eventos", item.enabled_events]])}<h3 class="drawer-section-title">Configuração protegida</h3><pre class="automation-json">${integrationEsc(value(item.config || {}))}</pre>` });
}

function integrationForm(item = null) {
  const routeAtStart = location.hash;
  if (routeAtStart !== "#integracoes") return;
  const values = { ...item, configText: item?.config ? JSON.stringify(item.config, null, 2) : "" };
  ui.form({ title: item ? "Configurar integração" : "Nova integração", subtitle: "Automações · Integrações", values, fields: integrationFields, submitLabel: item ? "Salvar configuração" : "Adicionar integração", onSubmit: async (data) => { let config = {}; if (data.configText) { try { config = JSON.parse(data.configText); } catch { throw new Error("A configuração precisa ser um JSON válido."); } } delete data.configText; data.config = config; await api(item ? `/api/integrations/${item.id}` : "/api/integrations", { method: item ? "PATCH" : "POST", body: data }); if (location.hash !== routeAtStart || location.hash !== "#integracoes") return; toast(item ? "Integração atualizada." : "Integração adicionada.", "success"); renderIntegrationsScreen(); } });
}

const statusInfo = (status) => status === "connected" ? ["Conectada", "positive"] : status === "error" ? ["Com erro", "warning"] : ["Desconectada", "neutral"];

async function renderIntegrationsScreen() {
  if (location.hash !== "#integracoes") return;
  const request = integrationState.request = (integrationState.request || 0) + 1;
  dashboardGrid.setAttribute("aria-busy", "true");
  const title = "Integrações", description = "Configure serviços externos e acompanhe o estado confirmado pelo sistema.";
  dashboardGrid.innerHTML = `${ui.header({ kicker: "Automações", title, description, actions: ui.button({ label: "+ Nova integração", attr: "data-integration-new" }) })}${stateBlock.loading("Carregando integrações…")}`;
  try {
    const params = new URLSearchParams({ limit: "100", offset: String(integrationState.offset) }); if (integrationState.search) params.set("search", integrationState.search); if (integrationState.status) params.set("status", integrationState.status); const response = await api(`/api/integrations?${params}`), items = response.integrations || [], pagination = response.pagination || {};
     if (request !== integrationState.request || location.hash !== "#integracoes") return;
    const connected = items.filter((item) => item.status === "connected").length, errors = items.filter((item) => item.status === "error").length;
    dashboardGrid.innerHTML = `${ui.header({ kicker: "Automações", title, description, actions: ui.button({ label: "+ Nova integração", attr: "data-integration-new" }) })}${ui.stats([{ label: "Integrações", value: ui.number(items.length) }, { label: "Conectadas", value: ui.number(connected), tone: "green" }, { label: "Desconectadas", value: ui.number(items.length - connected - errors) }, { label: "Com erro", value: ui.number(errors), tone: "red" }])}<section class="data-card automation-list"><div class="integration-notice"><span aria-hidden="true">ⓘ</span><p>Uma configuração cadastrada não significa conexão ativa. O status só deve ser marcado pelo provedor ou por um teste confirmado.</p></div>${ui.toolbar({ search: { value: integrationState.search, placeholder: "Buscar provedor, categoria ou conta…" }, filters: [{ key: "status", label: "Filtrar status", value: integrationState.status, options: [["", "Todos os status"], ["connected", "Conectadas"], ["disconnected", "Desconectadas"], ["error", "Com erro"]] }] })}<div class="integration-grid">${items.length ? items.map((item) => { const [status, tone] = statusInfo(item.status); return `<article class="data-card integration-card"><div class="section-heading"><div><h3>${integrationEsc(integrationLabel[item.provider] || item.provider || "Provedor")}</h3><small>${integrationEsc(item.account_name || "Conta não informada")}${item.environment ? ` · ${integrationEsc(item.environment)}` : ""}</small></div><span class="finance-status ${tone}">${status}</span></div>${item.last_sync_at ? `<small class="integration-sync">Última sincronização: ${integrationEsc(ui.relative(item.last_sync_at))}</small>` : `<small class="integration-sync">Ainda não sincronizada</small>`}<div class="template-actions"><button class="compact-action" data-integration-details="${integrationEsc(item.id)}" type="button">Detalhes</button><button class="compact-action" data-integration-edit="${integrationEsc(item.id)}" type="button">Configurar</button>${item.provider === "webhook" ? `<button class="compact-action" data-integration-test="${integrationEsc(item.id)}" type="button">Testar webhook</button>` : ""}<button class="compact-action" data-integration-delete="${integrationEsc(item.id)}" type="button">Excluir</button></div><small data-integration-result="${integrationEsc(item.id)}" class="integration-result" role="status" aria-live="polite"></small></article>`; }).join("") : ui.empty({ title: "Nenhuma integração encontrada", text: "Adicione um provedor para conectar seus fluxos de trabalho.", cta: "Adicionar integração", attr: "data-integration-empty" })}</div><div class="table-pagination"><button type="button" class="compact-action" data-integration-prev ${integrationState.offset === 0 ? "disabled" : ""}>Anterior</button><span>Página ${Math.floor(integrationState.offset / 100) + 1}</span><button type="button" class="compact-action" data-integration-next ${(pagination.returned ?? items.length) < 100 ? "disabled" : ""}>Próxima</button></div></section>`;
    dashboardGrid.removeAttribute("aria-busy");
    dashboardGrid.querySelector("[data-integration-new]")?.addEventListener("click", () => integrationForm()); dashboardGrid.querySelector("[data-integration-empty]")?.addEventListener("click", () => integrationForm());
    const search = dashboardGrid.querySelector("[data-search]"), status = dashboardGrid.querySelector('[data-filter="status"]'); let timer; search?.addEventListener("input", () => { clearTimeout(timer); integrationState.search = search.value.trim(); integrationState.offset = 0; timer = setTimeout(renderIntegrationsScreen, 250); }); status?.addEventListener("change", () => { integrationState.status = status.value; integrationState.offset = 0; renderIntegrationsScreen(); });
    dashboardGrid.querySelector("[data-integration-prev]")?.addEventListener("click", () => { integrationState.offset = Math.max(0, integrationState.offset - 100); renderIntegrationsScreen(); }); dashboardGrid.querySelector("[data-integration-next]")?.addEventListener("click", () => { integrationState.offset += 100; renderIntegrationsScreen(); });
    dashboardGrid.querySelectorAll("[data-integration-details]").forEach((button) => button.addEventListener("click", () => integrationDetails(items.find((item) => String(item.id) === String(button.dataset.integrationDetails)))));
    dashboardGrid.querySelectorAll("[data-integration-edit]").forEach((button) => button.addEventListener("click", () => { const item = items.find((entry) => String(entry.id) === String(button.dataset.integrationEdit)); if (item) Promise.resolve(integrationForm(item)).catch((error) => toast(error.message, "error")); }));
    dashboardGrid.querySelectorAll("[data-integration-delete]").forEach((button) => button.addEventListener("click", () => ui.confirmInline(button, { text: "Excluir integração?", onConfirm: async () => { const originalLabel = button.textContent; button.disabled = true; button.setAttribute("aria-busy", "true"); button.textContent = "Excluindo…"; try { await api(`/api/integrations/${button.dataset.integrationDelete}`, { method: "DELETE" }); toast("Integração excluída.", "success"); if (location.hash === "#integracoes") renderIntegrationsScreen(); } catch (error) { button.disabled = false; button.removeAttribute("aria-busy"); button.textContent = originalLabel; toast(error.message, "error"); } } })));
  } catch (error) { if (request !== integrationState.request || location.hash !== "#integracoes") return; dashboardGrid.removeAttribute("aria-busy"); dashboardGrid.innerHTML = `${ui.header({ kicker: "Automações", title, description })}${stateBlock.error(error.message, "integration-retry")}`; dashboardGrid.querySelector(".integration-retry")?.addEventListener("click", renderIntegrationsScreen); }
}

let integrationSearchSnapshot;
window.addEventListener("hashchange", () => {
  if (location.hash !== "#integracoes") integrationState.request += 1;
});
dashboardGrid.addEventListener("input", (event) => {
  const input = event.target.closest?.("[data-search]");
  if (input) integrationSearchSnapshot = { value: input.value, position: input.selectionStart };
}, true);
const integrationSearchObserver = new MutationObserver(() => {
  const input = dashboardGrid.querySelector("[data-search]");
  if (!input) return;
  input.type = "search";
  input.name = "search";
  input.setAttribute("autocomplete", "off");
  if (!integrationSearchSnapshot) return;
  if (input.value === integrationSearchSnapshot.value) {
    input.focus();
    try { input.setSelectionRange(integrationSearchSnapshot.position, integrationSearchSnapshot.position); } catch { /* busca sem cursor em alguns navegadores */ }
  }
  integrationSearchSnapshot = null;
});
integrationSearchObserver.observe(dashboardGrid, { childList: true, subtree: true });

dashboardGrid.addEventListener("click", (event) => {
  const button = event.target.closest?.("[data-integration-test]");
  if (!button) return;
  const result = dashboardGrid.querySelector(`[data-integration-result="${button.dataset.integrationTest}"]`);
  result?.setAttribute("role", "status");
  result?.setAttribute("aria-live", "polite");
}, true);

registerRoutes({ integracoes: renderIntegrationsScreen });

async function testIntegrationSafely(button) {
  const routeAtStart = location.hash;
  if (routeAtStart !== "#integracoes" || !button || button.dataset.integrationTestBusy === "1") return;
  const originalLabel = button.textContent;
  const result = dashboardGrid.querySelector(`[data-integration-result="${button.dataset.integrationTest}"]`);
  button.dataset.integrationTestBusy = "1";
  button.disabled = true;
  button.setAttribute("aria-busy", "true");
  button.textContent = "Testando…";
  if (result) { result.textContent = "Testando conexão…"; result.setAttribute("role", "status"); result.setAttribute("aria-live", "polite"); }
  try {
    const data = await api(`/api/integrations/${button.dataset.integrationTest}/test`, { method: "POST" });
    if (location.hash !== routeAtStart || !button.isConnected) return;
    if (result) result.textContent = data.ok ? `Webhook respondeu HTTP ${data.status}.` : `Resposta HTTP ${data.status}.`;
  } catch (error) {
    if (location.hash === routeAtStart && result?.isConnected) { result.textContent = error.message; result.setAttribute("role", "alert"); }
  } finally {
    if (button.isConnected) { button.disabled = false; button.removeAttribute("aria-busy"); button.textContent = originalLabel; }
    delete button.dataset.integrationTestBusy;
  }
}

dashboardGrid.addEventListener("click", (event) => {
  const button = event.target.closest?.("[data-integration-test]");
  if (!button || location.hash !== "#integracoes" || button.dataset.integrationTestGuarded === "1") return;
  event.preventDefault();
  event.stopImmediatePropagation();
  button.dataset.integrationTestGuarded = "1";
  testIntegrationSafely(button).finally(() => { delete button.dataset.integrationTestGuarded; });
}, true);

dashboardGrid.addEventListener("click", (event) => {
  const button = event.target.closest?.("[data-integration-delete]");
  if (!button || location.hash !== "#integracoes" || button.dataset.integrationDeleteGuarded === "1") return;
  event.preventDefault();
  event.stopImmediatePropagation();
  button.dataset.integrationDeleteGuarded = "1";
  const routeAtStart = location.hash;
  const requestAtStart = integrationState.request;
  ui.confirmInline(button, {
    text: "Excluir integração?",
    onConfirm: async () => {
      const originalLabel = button.textContent;
      button.disabled = true;
      button.setAttribute("aria-busy", "true");
      button.textContent = "Excluindo…";
      try {
        await api(`/api/integrations/${button.dataset.integrationDelete}`, { method: "DELETE" });
        if (location.hash !== routeAtStart || routeAtStart !== "#integracoes" || requestAtStart !== integrationState.request) return;
        toast("Integração excluída.", "success");
        renderIntegrationsScreen();
      } catch (error) {
        if (location.hash !== routeAtStart) return;
        if (button.isConnected) { button.disabled = false; button.removeAttribute("aria-busy"); button.textContent = originalLabel; }
        throw error;
      } finally {
        delete button.dataset.integrationDeleteGuarded;
      }
    },
    onCancel: () => { delete button.dataset.integrationDeleteGuarded; },
  });
}, true);

const integrationUiObserver = new MutationObserver(() => {
  const list = dashboardGrid.querySelector(".automation-list");
  const toolbar = list?.querySelector(".ui-toolbar");
  const grid = list?.querySelector(".integration-grid");
  if (!list || !toolbar || !grid) return;
  const search = toolbar.querySelector("[data-search]");
  if (search) search.placeholder = "Buscar provedor, categoria ou conta…";
  let status = list.querySelector("[data-integration-results]");
  if (!status) {
    status = document.createElement("p");
    status.className = "ui-filter-status";
    status.dataset.integrationResults = "true";
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    toolbar.insertAdjacentElement("afterend", status);
  }
  const visible = [...grid.querySelectorAll(".integration-card")].filter((card) => !card.hidden).length;
  const message = `${ui.number(visible)} ${visible === 1 ? "integração encontrada" : "integrações encontradas"}.`;
  if (status.textContent !== message) status.textContent = message;
  dashboardGrid.querySelectorAll("button, input, select").forEach((control) => {
    if (control.disabled) control.setAttribute("aria-busy", "true");
    else control.removeAttribute("aria-busy");
  });
});
integrationUiObserver.observe(dashboardGrid, { childList: true, subtree: true, attributes: true, attributeFilter: ["disabled", "hidden"] });

new MutationObserver(() => {
  const search = dashboardGrid.querySelector("[data-search]");
  if (search) { search.name = "search"; search.setAttribute("autocomplete", "off"); }
  const status = dashboardGrid.querySelector('[data-filter="status"]');
  if (status) { status.name = "status"; status.setAttribute("autocomplete", "off"); }
  dashboardGrid.querySelectorAll(".state-loading p").forEach((label) => { if (label.textContent?.includes("...")) label.textContent = label.textContent.replaceAll("...", "…"); });
}).observe(dashboardGrid, { childList: true, subtree: true });
