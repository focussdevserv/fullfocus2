const toast = (...args) => { if (location.hash === "#integracoes") ui.toast(...args); };
const integrationEsc = (value) => escapeHtml(value ?? "");
const integrationLabel = { whatsapp: "WhatsApp / Evolution API", mercado_pago: "Mercado Pago", email: "E-mail", smtp: "SMTP", google_calendar: "Google Calendar", google_drive: "Google Drive", github: "GitHub", n8n: "n8n", asaas: "Asaas", stripe: "Stripe", firebase: "Firebase", supabase: "Supabase", cnpj: "Consulta CNPJ", esign: "Assinatura eletrônica", webhook: "Webhook", api: "API própria" };
const integrationProviders = [["webhook", "Webhook"], ["n8n", "n8n"]];
const integrationState = { search: "", status: "", offset: 0, request: 0 };
const providerCategory = { whatsapp: "Comunicação", email: "Comunicação", smtp: "Comunicação", google_calendar: "Produtividade", google_drive: "Arquivos", github: "Desenvolvimento", n8n: "Automação", asaas: "Pagamentos", stripe: "Pagamentos", firebase: "Infraestrutura", supabase: "Infraestrutura", cnpj: "Dados", esign: "Documentos", webhook: "Automação", api: "Automação" };
const integrationFields = [
  { name: "provider", label: "Serviço", type: "select", options: integrationProviders, required: true, help: "Escolha o serviço que será conectado." },
  { name: "account_name", label: "Nome da conexão", required: true, placeholder: "Ex.: Atendimento principal" },
  { name: "environment", label: "Ambiente", type: "select", options: [["production", "Produção"], ["sandbox", "Sandbox"], ["development", "Desenvolvimento"]], required: true },
  { name: "baseUrl", label: "URL base", type: "url", required: false, placeholder: "https://…", help: "Use para API própria, n8n, WhatsApp ou provedor com endpoint." },
  { name: "apiKey", label: "API key", type: "password", required: false, placeholder: "Chave secreta do serviço", help: "A chave fica protegida e não aparece novamente." },
  { name: "token", label: "Token", type: "password", required: false, placeholder: "Token de acesso, se houver" },
  { name: "clientId", label: "Client ID", required: false },
  { name: "clientSecret", label: "Client secret", type: "password", required: false },
  { name: "instanceName", label: "Instância WhatsApp", required: false, placeholder: "Ex.: focussdev-atendimento" },
  { name: "projectId", label: "ID do projeto", required: false, placeholder: "Firebase, Supabase ou outro" },
  { name: "webhookUrl", label: "URL do webhook", type: "url", required: false, placeholder: "https://…" },
  { name: "redirectUri", label: "URL de retorno OAuth", type: "url", required: false, placeholder: "https://…" },
  { name: "enabled_events", label: "Eventos habilitados", required: false, placeholder: "lead_created, payment_confirmed" },
  { name: "responsible", label: "Responsável", required: false },
];

function integrationDetails(item) {
  if (!item) return;
  const value = (entry) => entry === null || entry === undefined || entry === "" ? "—" : typeof entry === "object" ? JSON.stringify(entry, null, 2) : String(entry);
  ui.drawer({ title: integrationLabel[item.provider] || item.provider || "Integração", subtitle: item.account_name || "Conexão externa", html: `${ui.facts([["Status", item.status === "connected" ? "Conectada" : item.status === "error" ? "Com erro" : "Desconectada"], ["Ambiente", item.environment], ["Categoria", item.category], ["Responsável", item.responsible], ["Última verificação", ui.dateTime(item.last_sync_at)], ["Eventos", item.enabled_events]])}<h3 class="drawer-section-title">Configuração protegida</h3><pre class="automation-json">${integrationEsc(value(item.config || {}))}</pre>` });
}

function integrationForm(item = null, presetProvider = "") {
  if (location.hash !== "#integracoes") return;
  const protectedConfig = item?.config && typeof item.config === "object" ? item.config : {};
  const values = { provider: presetProvider, environment: "production", ...item, ...protectedConfig, webhookUrl: protectedConfig.webhookUrl || protectedConfig.url || "" };
  ui.form({ title: item ? "Editar conexão" : "Nova conexão", subtitle: "Integrações guiadas", values, fields: integrationFields, submitLabel: item ? "Salvar conexão" : "Conectar serviço", onSubmit: async (data) => {
    const config = { ...protectedConfig };
    const map = { baseUrl: "baseUrl", apiKey: "apiKey", token: "token", clientId: "clientId", clientSecret: "clientSecret", instanceName: "instanceName", projectId: "projectId", redirectUri: "redirectUri" };
    Object.entries(map).forEach(([field, key]) => { if (data[field]) config[key] = data[field]; });
    if (data.webhookUrl) { config.webhookUrl = data.webhookUrl; config.url = data.webhookUrl; }
    ["baseUrl", "apiKey", "token", "clientId", "clientSecret", "instanceName", "projectId", "redirectUri", "webhookUrl"].forEach((field) => delete data[field]);
    data.config = config;
    data.category = providerCategory[data.provider] || data.category || "Outros";
    await api(item ? `/api/integrations/${item.id}` : "/api/integrations", { method: item ? "PATCH" : "POST", body: data });
    toast(item ? "Conexão atualizada." : "Conexão cadastrada.", "success");
    renderIntegrationsScreen();
  } });
}

const statusInfo = (status) => status === "connected" ? ["Conectada", "positive"] : status === "error" ? ["Com erro", "warning"] : ["Não testada", "neutral"];
const capabilityInfo = (capability) => capability?.configuration === "dedicated" ? ["Tela dedicada", "positive"] : capability?.can_test ? ["Adapter disponível", "positive"] : ["Indisponível", "neutral"];

async function renderIntegrationsScreen() {
  if (location.hash !== "#integracoes") return;
  const request = integrationState.request = (integrationState.request || 0) + 1;
  dashboardGrid.setAttribute("aria-busy", "true");
  const title = "Integrações", description = "Conecte os serviços externos que alimentam o atendimento, financeiro, agenda e automações.";
  dashboardGrid.innerHTML = `${ui.header({ kicker: "Configuração", title, description, actions: ui.button({ label: "+ Nova conexão", attr: "data-integration-new" }) })}${stateBlock.loading("Carregando integrações…")}`;
  try {
    const params = new URLSearchParams({ limit: "100", offset: String(integrationState.offset) }); if (integrationState.search) params.set("search", integrationState.search); if (integrationState.status) params.set("status", integrationState.status);
    const [response, capabilityResponse] = await Promise.all([api(`/api/integrations?${params}`), api("/api/integrations/capabilities")]), items = response.integrations || [], pagination = response.pagination || {}, capabilities = capabilityResponse.providers || {};
    if (request !== integrationState.request || location.hash !== "#integracoes") return;
    const connected = items.filter((item) => item.status === "connected").length, errors = items.filter((item) => item.status === "error").length;
    const providerCatalog = Object.entries(capabilities).map(([provider, capability]) => { const [label, tone] = capabilityInfo(capability); const action = capability.configuration === "dedicated" ? `<button class="compact-action" type="button" data-integration-route="${integrationEsc(capability.route)}">Abrir</button>` : capability.can_test ? `<button class="compact-action" type="button" data-integration-create="${integrationEsc(provider)}">Configurar</button>` : ""; return `<article class="data-card integration-card"><div class="section-heading"><div><h3>${integrationEsc(capability.label || integrationLabel[provider] || provider)}</h3><small>${capability.configuration === "environment" ? "Configuração administrada no servidor" : capability.available ? "Integração disponível" : "Sem adapter disponível nesta versão"}</small></div><span class="finance-status ${tone}">${label}</span></div>${action ? `<div class="template-actions">${action}</div>` : ""}</article>`; }).join("");
    dashboardGrid.innerHTML = `${ui.header({ kicker: "Configuração", title, description, actions: ui.button({ label: "+ Nova conexão", attr: "data-integration-new" }) })}${ui.stats([{ label: "Conexões", value: ui.number(items.length) }, { label: "Ativas", value: ui.number(connected), tone: "green" }, { label: "Pendentes", value: ui.number(items.length - connected - errors) }, { label: "Com erro", value: ui.number(errors), tone: "red" }])}<section class="data-card automation-list"><div class="section-heading"><div><h2>Provedores</h2><small>Capacidades reais disponíveis nesta instalação.</small></div></div><div class="integration-grid">${providerCatalog}</div></section><section class="data-card automation-list"><div class="integration-notice"><span aria-hidden="true">ⓘ</span><p>Somente Webhook e n8n possuem adapter de teste nesta tela. WhatsApp e Mercado Pago são gerenciados nas telas dedicadas.</p></div>${ui.toolbar({ search: { value: integrationState.search, placeholder: "Buscar serviço ou conexão…" }, filters: [{ key: "status", label: "Filtrar status", value: integrationState.status, options: [["", "Todos"], ["connected", "Ativas"], ["disconnected", "Não testadas"], ["error", "Com erro"]] }] })}<div class="integration-grid">${items.length ? items.map((item) => { const [status, tone] = statusInfo(item.status), capability = capabilities[item.provider] || {}; const testAction = capability.can_test ? `<button class="compact-action" data-integration-test="${integrationEsc(item.id)}" type="button">Testar</button>` : capability.configuration === "dedicated" ? `<button class="compact-action" data-integration-route="${integrationEsc(capability.route)}" type="button">Abrir tela dedicada</button>` : `<span class="finance-status neutral">Sem adapter</span>`, manageActions = capability.configuration === "inline" ? `<button class="compact-action" data-integration-edit="${integrationEsc(item.id)}" type="button">Editar</button><button class="compact-action" data-integration-delete="${integrationEsc(item.id)}" type="button">Excluir</button>` : ""; return `<article class="data-card integration-card"><div class="section-heading"><div><h3>${integrationEsc(integrationLabel[item.provider] || item.provider || "Provedor")}</h3><small>${integrationEsc(item.account_name || "Conexão sem nome")}${item.environment ? ` · ${integrationEsc(item.environment)}` : ""}</small></div><span class="finance-status ${tone}">${status}</span></div><small class="integration-sync">${item.last_sync_at ? `Verificada ${integrationEsc(ui.relative(item.last_sync_at))}` : "Ainda não verificada"}${item.last_error ? ` · ${integrationEsc(item.last_error)}` : ""}</small><div class="template-actions"><button class="compact-action" data-integration-details="${integrationEsc(item.id)}" type="button">Detalhes</button>${testAction}${manageActions}</div><small data-integration-result="${integrationEsc(item.id)}" class="integration-result" role="status" aria-live="polite"></small></article>`; }).join("") : ui.empty({ title: "Nenhuma conexão cadastrada", text: "Configure Webhook ou n8n, ou abra uma das telas dedicadas acima.", cta: "Nova conexão", attr: "data-integration-empty" })}</div><div class="table-pagination"><button type="button" class="compact-action" data-integration-prev ${integrationState.offset === 0 ? "disabled" : ""}>Anterior</button><span>Página ${Math.floor(integrationState.offset / 100) + 1}</span><button type="button" class="compact-action" data-integration-next ${(pagination.returned ?? items.length) < 100 ? "disabled" : ""}>Próxima</button></div></section>`;
    dashboardGrid.removeAttribute("aria-busy");
    dashboardGrid.querySelector("[data-integration-new]")?.addEventListener("click", () => integrationForm()); dashboardGrid.querySelector("[data-integration-empty]")?.addEventListener("click", () => integrationForm());
    dashboardGrid.querySelectorAll("[data-integration-route]").forEach((button) => button.addEventListener("click", () => { location.hash = `#${button.dataset.integrationRoute}`; }));
    dashboardGrid.querySelectorAll("[data-integration-create]").forEach((button) => button.addEventListener("click", () => integrationForm(null, button.dataset.integrationCreate)));
    const search = dashboardGrid.querySelector("[data-search]"), status = dashboardGrid.querySelector('[data-filter="status"]'); let timer;
    search?.addEventListener("input", () => { clearTimeout(timer); integrationState.search = search.value.trim(); integrationState.offset = 0; timer = setTimeout(renderIntegrationsScreen, 250); }); status?.addEventListener("change", () => { integrationState.status = status.value; integrationState.offset = 0; renderIntegrationsScreen(); });
    dashboardGrid.querySelector("[data-integration-prev]")?.addEventListener("click", () => { integrationState.offset = Math.max(0, integrationState.offset - 100); renderIntegrationsScreen(); }); dashboardGrid.querySelector("[data-integration-next]")?.addEventListener("click", () => { integrationState.offset += 100; renderIntegrationsScreen(); });
    dashboardGrid.querySelectorAll("[data-integration-details]").forEach((button) => button.addEventListener("click", () => integrationDetails(items.find((item) => String(item.id) === String(button.dataset.integrationDetails)))));
    dashboardGrid.querySelectorAll("[data-integration-edit]").forEach((button) => button.addEventListener("click", () => integrationForm(items.find((item) => String(item.id) === String(button.dataset.integrationEdit)))));
    dashboardGrid.querySelectorAll("[data-integration-delete]").forEach((button) => button.addEventListener("click", () => ui.confirmInline(button, { text: "Excluir conexão?", onConfirm: async () => { await api(`/api/integrations/${button.dataset.integrationDelete}`, { method: "DELETE" }); toast("Conexão excluída.", "success"); renderIntegrationsScreen(); } })));
  } catch (error) { if (request !== integrationState.request || location.hash !== "#integracoes") return; dashboardGrid.removeAttribute("aria-busy"); dashboardGrid.innerHTML = `${ui.header({ kicker: "Configuração", title, description })}${stateBlock.error(error.message, "integration-retry")}`; dashboardGrid.querySelector(".integration-retry")?.addEventListener("click", renderIntegrationsScreen); }
}

async function testIntegration(button) {
  if (button.disabled) return;
  const result = dashboardGrid.querySelector(`[data-integration-result="${button.dataset.integrationTest}"]`), original = button.textContent;
  button.disabled = true; button.textContent = "Testando…"; if (result) result.textContent = "Validando conexão…";
  try { const data = await api(`/api/integrations/${button.dataset.integrationTest}/test`, { method: "POST" }); if (result) result.textContent = data.ok ? `Conexão confirmada (HTTP ${data.status}).` : `O serviço respondeu HTTP ${data.status}.`; renderIntegrationsScreen(); } catch (error) { if (result) { result.textContent = error.message; result.setAttribute("role", "alert"); } } finally { if (button.isConnected) { button.disabled = false; button.textContent = original; } }
}

dashboardGrid.addEventListener("click", (event) => { const button = event.target.closest?.("[data-integration-test]"); if (button && location.hash === "#integracoes") { event.preventDefault(); testIntegration(button); } }, true);
window.addEventListener("hashchange", () => { if (location.hash !== "#integracoes") integrationState.request += 1; });
registerRoutes({ integracoes: renderIntegrationsScreen });
