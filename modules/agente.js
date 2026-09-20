const esc = (value) => escapeHtml(value ?? "");
let agentState = {
  config: null,
  conversationId: null,
  messages: [],
  capabilities: null,
  capabilitiesStatus: "idle",
  capabilitiesError: "",
  sending: false,
  saving: false,
  requestError: "",
  lastFailedMessage: "",
};

const autonomyLabel = (level) => ({ 0: "Somente responder", 1: "Somente rascunhos", 2: "Ações simples autorizadas", 3: "CRM autorizado", 4: "Financeiro autorizado" }[Number(level)] || "Somente rascunhos");
const autonomyDetail = (level) => ({
  0: "Nenhuma ação altera dados.",
  1: "Pode salvar apenas rascunhos de e-mail.",
  2: "Pode criar tarefa, compromisso, nota e follow-up com permissão.",
  3: "Também pode atualizar leads e criar propostas em rascunho com permissão.",
  4: "Também pode preparar contas a receber com permissão financeira.",
}[Number(level)] || "Ações dependem das permissões do cargo.");
const capabilityLabel = (state) => ({ disabled: "Desabilitada", missing_secret: "Configuração ausente", unverified: "Não verificada", ready: "Pronta", error: "Com erro" }[state] || "Indisponível");
const capabilityClass = (state) => state === "ready" ? "is-ready" : state === "error" ? "is-error" : state === "unverified" || state === "missing_secret" ? "is-warning" : "";
const timeLabel = (value) => value ? new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(new Date(value)) : "agora";

const actionOutcome = (result) => {
  if (!result || result.reason === "none") return "";
  if (result.executed) return `<span class="agent-action-result is-success">Ação confirmada${result.type ? ` · ${esc(result.type)}` : ""}${result.id ? ` #${esc(result.id)}` : ""}</span>`;
  return `<span class="agent-action-result is-error">Ação não executada · ${esc(result.reason || "falha")}</span>`;
};

function integrationsBlock() {
  if (agentState.capabilitiesStatus === "loading") return `<div class="agent-integrations-state" aria-busy="true"><span class="agent-state-icon is-loading" aria-hidden="true"></span><div><strong>Verificando integrações…</strong><small>Consultando o estado salvo no servidor.</small></div></div>`;
  if (agentState.capabilitiesStatus === "error") return `<div class="agent-integrations-state is-error"><span class="agent-state-icon" aria-hidden="true">!</span><div><strong>Não foi possível verificar as integrações</strong><small>${esc(agentState.capabilitiesError || "Tente novamente.")}</small></div><button class="compact-action" data-agent-capabilities-retry type="button">Tentar novamente</button></div>`;
  const providers = agentState.capabilities || {};
  const featured = ["openai", "whatsapp", "email", "mercado_pago"].map((key) => [key, providers[key]]).filter(([, value]) => value);
  if (!featured.length) return `<div class="agent-integrations-state is-warning"><span class="agent-state-icon" aria-hidden="true">!</span><div><strong>Integrações ainda não verificadas</strong><small>Abra Integrações para conectar a IA e os canais usados pelo agente.</small></div><a class="compact-action" href="#integracoes">Abrir integrações</a></div>`;
  return `<div class="agent-capability-list" aria-label="Estado das integrações">${featured.map(([, item]) => `<div class="agent-capability ${capabilityClass(item.state)}"><span class="agent-connection-dot" aria-hidden="true"></span><div><strong>${esc(item.label)}</strong><small>${esc(capabilityLabel(item.state))}</small></div></div>`).join("")}</div>`;
}

function setupNotice({ enabled, aiReady }) {
  if (!aiReady) return `<div class="agent-setup-notice is-warning" role="status"><strong>Falta configurar a IA</strong><p>O agente permanece bloqueado até a chave da IA estar disponível no servidor.</p><a href="#integracoes" class="compact-action">Configurar integração</a></div>`;
  if (!enabled) return `<div class="agent-setup-notice" role="status"><strong>O agente está desativado</strong><p>Revise o nível de autonomia e salve a ativação quando estiver pronto para testar.</p></div>`;
  return `<div class="agent-setup-notice is-ready" role="status"><strong>Pronto para teste controlado</strong><p>O agente só executa ações com ferramenta, permissão e autonomia compatíveis.</p></div>`;
}

function recentActionsBlock() {
  const actions = agentState.messages.filter((item) => item.role === "assistant" && item.action && item.action.reason !== "none").slice(-5).reverse();
  return `<section class="agent-history" aria-labelledby="agent-history-title"><div class="agent-history-heading"><div><p class="card-kicker">Histórico da sessão</p><h4 id="agent-history-title">Ações e confirmações</h4></div><span>${ui.number(actions.length)} ${actions.length === 1 ? "ação" : "ações"}</span></div>${actions.length ? `<ul class="agent-action-list">${actions.map((item) => `<li><span class="agent-history-dot ${item.action.executed ? "is-success" : "is-error"}" aria-hidden="true"></span><div><strong>${item.action.executed ? "Executada" : "Não executada"}</strong><small>${esc(item.action.type || item.action.reason || "Ação do agente")} · ${timeLabel(item.time)}</small></div></li>`).join("")}</ul>` : `<p class="agent-history-empty">As ações executadas nesta conversa aparecerão aqui.</p>`}</section>`;
}

function bindAgentEvents() {
  dashboardGrid.querySelector("[data-agent-capabilities-retry]")?.addEventListener("click", loadAgentCapabilities);
  dashboardGrid.querySelector("[data-agent-clear]")?.addEventListener("click", () => { if (agentState.sending) return; agentState.conversationId = null; agentState.messages = []; agentState.requestError = ""; agentState.lastFailedMessage = ""; renderAgent(); });
  dashboardGrid.querySelectorAll("[data-agent-prompt]").forEach((button) => button.addEventListener("click", () => { const field = dashboardGrid.querySelector("[name=message]"); if (!field || agentState.sending) return; field.value = button.dataset.agentPrompt; field.focus(); }));
  dashboardGrid.querySelector("[data-agent-retry-message]")?.addEventListener("click", () => { const field = dashboardGrid.querySelector("[name=message]"); if (!field || agentState.sending) return; field.value = agentState.lastFailedMessage; field.focus(); });
  dashboardGrid.querySelector("[data-agent-config]")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (agentState.saving) return;
    const status = form.querySelector("[data-agent-config-status]"), submit = form.querySelector("button[type=submit]"), data = Object.fromEntries(new FormData(form));
    data.enabled = form.enabled.checked; data.autonomy_level = Number(data.autonomy_level);
    const wasEnabled = Boolean(agentState.config?.enabled);
    if (data.enabled && !wasEnabled && !aiReadyForAgent()) { form.enabled.checked = false; status.textContent = "Configure a IA antes de ativar o agente."; status.className = "is-error"; return; }
    if (data.enabled && !wasEnabled && typeof window.confirm === "function" && !window.confirm("Ativar o Agente Focussdev para este workspace? Ele seguirá as permissões e o nível de autonomia escolhidos.")) { form.enabled.checked = false; status.textContent = "Ativação cancelada."; status.className = "is-muted"; return; }
    agentState.saving = true; submit.disabled = true; submit.textContent = "Salvando…"; form.setAttribute("aria-busy", "true"); status.textContent = "Salvando configuração…"; status.className = "is-muted";
    try { const response = await api("/api/agent/config", { method: "PATCH", body: data }); agentState.config = { ...agentState.config, ...response.agent }; agentState.requestError = ""; renderAgent(); }
    catch (error) { status.textContent = error.message || "Não foi possível salvar a configuração."; status.className = "is-error"; submit.disabled = false; submit.textContent = "Salvar configuração"; form.removeAttribute("aria-busy"); }
    finally { agentState.saving = false; }
  });
  dashboardGrid.querySelector("[data-agent-compose]")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (agentState.sending || !aiReadyForAgent() || !agentState.config?.enabled) return;
    const form = event.currentTarget, message = form.message.value.trim();
    if (!message) return;
    agentState.sending = true; agentState.requestError = ""; agentState.lastFailedMessage = ""; agentState.messages.push({ role: "user", text: message, time: new Date().toISOString() }); renderAgent();
    try { const response = await api("/api/agent/respond", { method: "POST", body: { conversation_id: agentState.conversationId, message } }); agentState.conversationId = response.conversation_id; agentState.messages.push({ role: "assistant", text: response.response.reply, action: response.action_result, time: new Date().toISOString() }); }
    catch (error) { const payload = error.data || {}; if (payload.conversation_id) agentState.conversationId = payload.conversation_id; if (payload.response?.reply) agentState.messages.push({ role: "assistant", text: payload.response.reply, action: payload.action_result, time: new Date().toISOString() }); agentState.requestError = error.message || "Não foi possível responder agora."; agentState.lastFailedMessage = message; }
    finally { agentState.sending = false; renderAgent(); }
  });
}

function aiReadyForAgent() { const openai = agentState.capabilities?.openai; return openai ? openai.state === "ready" : Boolean(agentState.config?.ai_configured); }

function renderAgent() {
  if (location.hash !== "#agente") return;
  const config = agentState.config || {}, enabled = Boolean(config.enabled), aiReady = aiReadyForAgent(), canChat = enabled && aiReady, messages = agentState.messages, autonomy = Number(config.autonomy_level ?? 1);
  dashboardGrid.innerHTML = `<section class="agent-hero"><div class="agent-hero-copy"><div class="agent-eyebrow"><span class="agent-pulse ${enabled ? "is-on" : ""}" aria-hidden="true"></span> Atendimento inteligente</div><h2>${esc(config.name || "Agente Focussdev")}</h2><p>Configure, valide e acompanhe o agente com segurança antes de colocá-lo em uso no atendimento.</p><div class="agent-hero-actions"><span class="agent-status-pill ${enabled ? "is-on" : ""}">${enabled ? "Agente ativo" : "Agente desativado"}</span><span class="agent-status-pill ${aiReady ? "is-on" : ""}">${aiReady ? "IA pronta" : "IA sem configuração"}</span><span class="agent-status-pill">Autonomia ${autonomy}</span></div></div><div class="agent-hero-mark" aria-hidden="true">✦</div></section><section class="agent-stats-grid" aria-label="Resumo do agente"><article class="agent-stat"><span>Status</span><strong>${enabled ? "Ativo" : "Desativado"}</strong><small>${enabled ? "Respeitando cargo e workspace" : "Ative depois de revisar a configuração"}</small></article><article class="agent-stat"><span>Modelo</span><strong>${esc(config.model || "Não definido")}</strong><small>Configuração atual</small></article><article class="agent-stat"><span>Autonomia</span><strong>Nível ${autonomy}</strong><small>${esc(autonomyLabel(autonomy))}</small></article><article class="agent-stat"><span>Sessão atual</span><strong>${ui.number(messages.length)}</strong><small>${messages.length ? "mensagens nesta conversa" : "nenhuma mensagem ainda"}</small></article></section><section class="agent-workspace"><article class="data-card agent-config-card"><div class="agent-panel-heading"><div><p class="card-kicker">1 · Configuração</p><h3>Defina os limites do agente</h3><p class="agent-help">A autonomia nunca substitui as permissões do seu cargo.</p></div><span class="agent-panel-icon" aria-hidden="true">⚙</span></div>${setupNotice({ enabled, aiReady })}<div class="agent-autonomy-notice"><div><strong>${esc(autonomyLabel(autonomy))}</strong><small>${esc(autonomyDetail(autonomy))}</small></div><span class="agent-level-badge">Nível ${autonomy}</span></div>${integrationsBlock()}<form class="agent-form" data-agent-config><label for="agent-name">Nome do agente<input id="agent-name" name="name" autocomplete="off" value="${esc(config.name || "Agente Focussdev")}" required></label><label for="agent-model">Modelo<input id="agent-model" name="model" autocomplete="off" value="${esc(config.model || "gpt-5")}" required></label><label for="agent-autonomy">Nível de autonomia<select id="agent-autonomy" name="autonomy_level">${[[0, "Somente responder"], [1, "Somente rascunhos"], [2, "Ações simples autorizadas"], [3, "CRM autorizado"], [4, "Financeiro autorizado"]].map(([value, label]) => `<option value="${value}">${value} — ${label}</option>`).join("")}</select></label><label class="agent-check" for="agent-enabled"><input id="agent-enabled" name="enabled" type="checkbox" ${enabled ? "checked" : ""}><span><strong>Ativar agente</strong><small>A ativação será confirmada antes de liberar o teste.</small></span></label><div class="agent-actions"><button class="button button-primary" type="submit">Salvar configuração</button><output data-agent-config-status role="status" aria-live="polite"></output></div></form></article><article class="data-card agent-chat-card"><div class="agent-panel-heading"><div><p class="card-kicker">2 · Teste controlado</p><h3>Converse com o agente</h3><p class="agent-help">Comece com uma pergunta comercial. A tela informa o resultado real de cada ação.</p></div><button class="compact-action" data-agent-clear type="button" ${agentState.sending ? "disabled" : ""}>Nova conversa</button></div><div class="agent-suggestions" aria-label="Sugestões de teste"><span>Comece por:</span><button type="button" data-agent-prompt="Quero um site para minha clínica. O que você recomenda?" ${canChat && !agentState.sending ? "" : "disabled"}>Recomendar serviço</button><button type="button" data-agent-prompt="Quais informações você precisa para preparar uma proposta?" ${canChat && !agentState.sending ? "" : "disabled"}>Preparar proposta</button></div><div class="agent-messages" data-agent-messages aria-live="polite" aria-label="Histórico da conversa">${messages.map((item) => `<div class="agent-message ${item.role === "assistant" ? "is-agent" : "is-user"}"><div class="agent-message-meta"><span class="agent-message-label">${item.role === "assistant" ? "Agente" : "Você"}</span><time>${timeLabel(item.time)}</time></div>${esc(item.text)}${item.role === "assistant" ? actionOutcome(item.action) : ""}</div>`).join("") || `<div class="agent-empty"><span class="agent-empty-icon" aria-hidden="true">✦</span><strong>${canChat ? "A conversa começa aqui" : "Conversa bloqueada"}</strong><p>${canChat ? "Envie uma mensagem para testar o agente com segurança." : aiReady ? "Ative o agente na etapa 1 para liberar o teste." : "Conclua a configuração da IA antes de ativar o agente."}</p></div>`}</div>${recentActionsBlock()}<form class="agent-compose" data-agent-compose><label class="sr-only" for="agent-message">Mensagem para o agente</label><textarea id="agent-message" name="message" rows="3" placeholder="Ex.: Quero um site para minha clínica…" autocomplete="off" ${canChat && !agentState.sending ? "required" : "disabled"}></textarea><div class="agent-compose-footer"><span class="agent-compose-note">As ações só são executadas com autonomia, ferramenta e permissão.</span><button class="button button-primary" type="submit" ${canChat && !agentState.sending ? "" : "disabled"}>${agentState.sending ? "Consultando…" : canChat ? "Enviar mensagem" : "Configuração necessária"}</button></div><output data-agent-status role="${agentState.requestError ? "alert" : "status"}" aria-live="polite">${agentState.sending ? "Consultando o agente…" : agentState.requestError ? `${esc(agentState.requestError)}${agentState.lastFailedMessage ? ` <button class="compact-action" data-agent-retry-message type="button">Repetir mensagem</button>` : ""}` : ""}</output></form></article></section>`;
  dashboardGrid.querySelector("[name=autonomy_level]").value = String(autonomy);
  bindAgentEvents();
  const messagesBox = dashboardGrid.querySelector("[data-agent-messages]"); if (messagesBox && messages.length) messagesBox.scrollTop = messagesBox.scrollHeight;
}

async function loadAgentCapabilities() {
  agentState.capabilitiesStatus = "loading"; agentState.capabilitiesError = ""; if (agentState.config) renderAgent();
  try { agentState.capabilities = (await api("/api/integrations/capabilities")).providers || {}; agentState.capabilitiesStatus = "ready"; }
  catch (error) { agentState.capabilitiesStatus = "error"; agentState.capabilitiesError = error.message; }
  if (agentState.config) renderAgent();
}

async function loadAgent() {
  if (location.hash !== "#agente") return;
  dashboardGrid.innerHTML = stateBlock.loading("Carregando agente…"); dashboardGrid.setAttribute("aria-busy", "true"); agentState.capabilitiesStatus = "loading"; agentState.capabilitiesError = "";
  const [configResult, capabilitiesResult] = await Promise.allSettled([api("/api/agent/config"), api("/api/integrations/capabilities")]);
  dashboardGrid.removeAttribute("aria-busy");
  if (configResult.status === "rejected") { dashboardGrid.innerHTML = stateBlock.error(configResult.reason.message, "agent-retry"); dashboardGrid.querySelector(".agent-retry")?.addEventListener("click", loadAgent); return; }
  agentState.config = configResult.value.agent;
  if (capabilitiesResult.status === "fulfilled") { agentState.capabilities = capabilitiesResult.value.providers || {}; agentState.capabilitiesStatus = "ready"; }
  else { agentState.capabilitiesStatus = "error"; agentState.capabilitiesError = capabilitiesResult.reason.message; }
  renderAgent();
}

registerRoutes({ agente: loadAgent }, { parent: "#agente", titles: { agente: "Agente Focussdev" } });
