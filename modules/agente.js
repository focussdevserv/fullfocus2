const esc = (value) => escapeHtml(value ?? "");
let agentState = { config: null, conversationId: null, messages: [], capabilities: null, capabilitiesStatus: "idle", capabilitiesError: "", sending: false, requestError: "", lastFailedMessage: "" };

const autonomyLabel = (level) => ({ 0: "Somente responder", 1: "Somente rascunhos", 2: "Ações simples autorizadas", 3: "CRM autorizado", 4: "Financeiro autorizado" }[Number(level)] || "Somente rascunhos");
const autonomyDetail = (level) => ({
  0: "Nenhuma ação altera dados.",
  1: "Pode salvar apenas rascunhos de e-mail.",
  2: "Pode criar tarefa, compromisso, nota e follow-up com permissão.",
  3: "Também pode atualizar leads e criar propostas em rascunho com permissão.",
  4: "Também pode preparar contas a receber com permissão financeira.",
}[Number(level)] || "Ações dependem das permissões do cargo.");
const capabilityLabel = (state) => ({ disabled: "Desabilitada", missing_secret: "Configuração ausente", unverified: "Não verificada", ready: "Pronta", error: "Com erro" }[state] || "Indisponível");
const capabilityClass = (state) => state === "ready" ? "is-ready" : state === "error" ? "is-error" : state === "unverified" ? "is-warning" : "";
const actionOutcome = (result) => {
  if (!result || result.reason === "none") return "";
  if (result.executed) return `<span class="agent-action-result is-success">Ação confirmada${result.type ? ` · ${esc(result.type)}` : ""}${result.id ? ` #${esc(result.id)}` : ""}</span>`;
  return `<span class="agent-action-result is-error">Ação não executada · ${esc(result.reason || "falha")}</span>`;
};

function integrationsBlock() {
  if (agentState.capabilitiesStatus === "loading") return `<div class="agent-integrations-state" aria-busy="true"><strong>Verificando integrações…</strong><small>Consultando apenas o estado salvo no servidor.</small></div>`;
  if (agentState.capabilitiesStatus === "error") return `<div class="agent-integrations-state is-error"><div><strong>Não foi possível verificar as integrações</strong><small>${esc(agentState.capabilitiesError)}</small></div><button class="compact-action" data-agent-capabilities-retry type="button">Tentar novamente</button></div>`;
  const providers = agentState.capabilities || {}, featured = ["openai", "whatsapp", "email", "mercado_pago"].map((key) => [key, providers[key]]).filter(([, value]) => value);
  if (!featured.length) return `<div class="agent-integrations-state"><strong>Sem informações de integração</strong><small>Tente atualizar o estado.</small></div>`;
  return `<div class="agent-capability-list" aria-label="Estado das integrações">${featured.map(([, item]) => `<div class="agent-capability ${capabilityClass(item.state)}"><span class="agent-connection-dot"></span><div><strong>${esc(item.label)}</strong><small>${esc(capabilityLabel(item.state))}</small></div></div>`).join("")}</div>`;
}

function bindAgentEvents() {
  dashboardGrid.querySelector("[data-agent-capabilities-retry]")?.addEventListener("click", loadAgentCapabilities);
  dashboardGrid.querySelector("[data-agent-clear]")?.addEventListener("click", () => { if (agentState.sending) return; agentState.conversationId = null; agentState.messages = []; agentState.requestError = ""; agentState.lastFailedMessage = ""; renderAgent(); });
  dashboardGrid.querySelectorAll("[data-agent-prompt]").forEach((button) => button.addEventListener("click", () => { const field = dashboardGrid.querySelector("[name=message]"); if (!field || agentState.sending) return; field.value = button.dataset.agentPrompt; field.focus(); }));
  dashboardGrid.querySelector("[data-agent-retry-message]")?.addEventListener("click", () => { const field = dashboardGrid.querySelector("[name=message]"); if (!field || agentState.sending) return; field.value = agentState.lastFailedMessage; field.focus(); });
  dashboardGrid.querySelector("[data-agent-config]")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (form.dataset.busy === "1") return;
    const status = form.querySelector("[data-agent-config-status]"), submit = form.querySelector("button[type=submit]"), data = Object.fromEntries(new FormData(form));
    data.enabled = form.enabled.checked; data.autonomy_level = Number(data.autonomy_level); form.dataset.busy = "1"; submit.disabled = true; status.textContent = "Salvando…";
    try { const response = await api("/api/agent/config", { method: "PATCH", body: data }); agentState.config = { ...agentState.config, ...response.agent }; agentState.requestError = ""; renderAgent(); }
    catch (error) { status.textContent = error.message; submit.disabled = false; delete form.dataset.busy; }
  });
  dashboardGrid.querySelector("[data-agent-compose]")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (agentState.sending) return;
    const form = event.currentTarget, message = form.message.value.trim();
    if (!message) return;
    agentState.sending = true; agentState.requestError = ""; agentState.lastFailedMessage = ""; agentState.messages.push({ role: "user", text: message }); renderAgent();
    try {
      const response = await api("/api/agent/respond", { method: "POST", body: { conversation_id: agentState.conversationId, message } });
      agentState.conversationId = response.conversation_id;
      agentState.messages.push({ role: "assistant", text: response.response.reply, action: response.action_result });
    } catch (error) {
      const payload = error.data || {};
      if (payload.conversation_id) agentState.conversationId = payload.conversation_id;
      if (payload.response?.reply) agentState.messages.push({ role: "assistant", text: payload.response.reply, action: payload.action_result });
      agentState.requestError = error.message;
      agentState.lastFailedMessage = message;
    } finally { agentState.sending = false; renderAgent(); }
  });
}

function renderAgent() {
  if (location.hash !== "#agente") return;
  const config = agentState.config || {}, enabled = Boolean(config.enabled), openai = agentState.capabilities?.openai;
  const aiReady = openai ? openai.state === "ready" : Boolean(config.ai_configured), canChat = enabled && aiReady, messages = agentState.messages, autonomy = Number(config.autonomy_level ?? 1);
  dashboardGrid.innerHTML = `<section class="agent-hero">
    <div class="agent-hero-copy"><div class="agent-eyebrow"><span class="agent-pulse ${enabled ? "is-on" : ""}"></span> Atendimento inteligente</div><h2>${esc(config.name || "Agente Focussdev")}</h2><p>Um espaço seguro para testar o atendimento comercial e os comandos autorizados do seu agente.</p><div class="agent-hero-actions"><span class="agent-status-pill ${enabled ? "is-on" : ""}">${enabled ? "Agente ativo" : "Agente desativado"}</span><span class="agent-status-pill ${aiReady ? "is-on" : ""}">${aiReady ? "IA pronta" : "IA sem configuração"}</span><span class="agent-status-pill">Autonomia ${autonomy}</span></div></div>
    <div class="agent-hero-mark" aria-hidden="true">✦</div>
  </section>
  <section class="agent-stats-grid" aria-label="Resumo do agente">
    <article class="agent-stat"><span>Status</span><strong>${enabled ? "Ativo" : "Desativado"}</strong><small>${enabled ? "Respeitando cargo e tenant" : "Ative para iniciar"}</small></article>
    <article class="agent-stat"><span>Modelo</span><strong>${esc(config.model || "Não definido")}</strong><small>Configuração atual</small></article>
    <article class="agent-stat"><span>Autonomia</span><strong>Nível ${autonomy}</strong><small>${esc(autonomyLabel(autonomy))}</small></article>
    <article class="agent-stat"><span>Sessão atual</span><strong>${ui.number(messages.length)}</strong><small>mensagens trocadas</small></article>
  </section>
  <section class="agent-workspace">
    <article class="data-card agent-config-card">
      <div class="agent-panel-heading"><div><p class="card-kicker">Configuração</p><h3>Como o agente deve operar</h3><p class="agent-help">O nível limita ações, e as permissões do cargo continuam obrigatórias.</p></div><span class="agent-panel-icon" aria-hidden="true">⚙</span></div>
      <div class="agent-autonomy-notice"><strong>${esc(autonomyLabel(autonomy))}</strong><small>${esc(autonomyDetail(autonomy))}</small></div>
      ${integrationsBlock()}
      <div class="agent-connection ${canChat ? "is-ready" : ""}"><span class="agent-connection-dot"></span><div><strong>${canChat ? "Agente pronto para teste" : aiReady ? "Ative o agente para testar" : "Chave de IA não configurada"}</strong><small>${canChat ? "As respostas usam apenas o contexto autorizado do workspace." : aiReady ? "Salve a configuração com o agente ativo para liberar a conversa." : "Configure OPENAI_API_KEY no servidor para habilitar respostas."}</small></div></div>
      <form class="agent-form" data-agent-config>
        <label>Nome do agente<input name="name" value="${esc(config.name || "Agente Focussdev")}" required></label>
        <label>Modelo<input name="model" value="${esc(config.model || "gpt-5")}" required></label>
        <label>Nível de autonomia<select name="autonomy_level"><option value="0">0 — Somente responder</option><option value="1">1 — Somente rascunhos</option><option value="2">2 — Ações simples autorizadas</option><option value="3">3 — CRM autorizado</option><option value="4">4 — Financeiro autorizado</option></select></label>
        <label class="agent-check"><input name="enabled" type="checkbox" ${enabled ? "checked" : ""}><span><strong>Ativar agente</strong><small>Permitir testes nesta área conforme as permissões da conta.</small></span></label>
        <div class="agent-actions"><button class="button button-primary" type="submit">Salvar configuração</button><output data-agent-config-status role="status"></output></div>
      </form>
    </article>
    <article class="data-card agent-chat-card">
      <div class="agent-panel-heading"><div><p class="card-kicker">Teste controlado</p><h3>Converse com o agente</h3><p class="agent-help">O chat mostra a resposta e a confirmação real de cada ação.</p></div><button class="compact-action" data-agent-clear type="button" ${agentState.sending ? "disabled" : ""}>Nova conversa</button></div>
      <div class="agent-suggestions"><span>Experimente:</span><button type="button" data-agent-prompt="Quero um site para minha clínica. O que você recomenda?" ${canChat && !agentState.sending ? "" : "disabled"}>Recomendar serviço</button><button type="button" data-agent-prompt="Quais informações você precisa para preparar uma proposta?" ${canChat && !agentState.sending ? "" : "disabled"}>Preparar proposta</button></div>
      <div class="agent-messages" data-agent-messages>${messages.map((item) => `<div class="agent-message ${item.role === "assistant" ? "is-agent" : "is-user"}"><span class="agent-message-label">${item.role === "assistant" ? "Agente" : "Você"}</span>${esc(item.text)}${item.role === "assistant" ? actionOutcome(item.action) : ""}</div>`).join("") || `<div class="agent-empty"><span class="agent-empty-icon" aria-hidden="true">✦</span><strong>${canChat ? "A conversa começa aqui" : "Conversa bloqueada até concluir a configuração"}</strong><p>${canChat ? "Envie uma mensagem para testar o agente com segurança." : "Ative o agente e configure a integração de IA para liberar o teste."}</p></div>`}</div>
      <form class="agent-compose" data-agent-compose><textarea name="message" rows="3" placeholder="Ex.: Quero um site para minha clínica. O que você recomenda?" aria-label="Mensagem para o agente" ${canChat && !agentState.sending ? "required" : "disabled"}></textarea><div class="agent-compose-footer"><span class="agent-compose-note">As ações só são executadas com autonomia, ferramenta e permissão.</span><button class="button button-primary" type="submit" ${canChat && !agentState.sending ? "" : "disabled"}>${agentState.sending ? "Consultando…" : canChat ? "Enviar mensagem" : "Configuração necessária"}</button></div><output data-agent-status role="${agentState.requestError ? "alert" : "status"}">${agentState.sending ? "Consultando agente…" : agentState.requestError ? `${esc(agentState.requestError)}${agentState.lastFailedMessage ? ` <button class="compact-action" data-agent-retry-message type="button">Repetir mensagem</button>` : ""}` : ""}</output></form>
    </article>
  </section>`;
  dashboardGrid.querySelector("[name=autonomy_level]").value = String(autonomy);
  bindAgentEvents();
}

async function loadAgentCapabilities() {
  agentState.capabilitiesStatus = "loading"; agentState.capabilitiesError = ""; if (agentState.config) renderAgent();
  try { agentState.capabilities = (await api("/api/integrations/capabilities")).providers || {}; agentState.capabilitiesStatus = "ready"; }
  catch (error) { agentState.capabilitiesStatus = "error"; agentState.capabilitiesError = error.message; }
  if (agentState.config) renderAgent();
}

async function loadAgent() {
  if (location.hash !== "#agente") return;
  dashboardGrid.innerHTML = stateBlock.loading("Carregando agente…"); agentState.capabilitiesStatus = "loading"; agentState.capabilitiesError = "";
  const [configResult, capabilitiesResult] = await Promise.allSettled([api("/api/agent/config"), api("/api/integrations/capabilities")]);
  if (configResult.status === "rejected") { dashboardGrid.innerHTML = stateBlock.error(configResult.reason.message, "agent-retry"); dashboardGrid.querySelector(".agent-retry")?.addEventListener("click", loadAgent); return; }
  agentState.config = configResult.value.agent;
  if (capabilitiesResult.status === "fulfilled") { agentState.capabilities = capabilitiesResult.value.providers || {}; agentState.capabilitiesStatus = "ready"; }
  else { agentState.capabilitiesStatus = "error"; agentState.capabilitiesError = capabilitiesResult.reason.message; }
  renderAgent();
}
registerRoutes({ agente: loadAgent }, { parent: "#agente", titles: { agente: "Agente Focussdev" } });
