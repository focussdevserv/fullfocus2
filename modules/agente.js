const esc = (value) => escapeHtml(value ?? "");
let agentState = { config: null, conversationId: null, messages: [] };

const autonomyLabel = (level) => ({ 0: "Somente responder", 1: "Preparar", 2: "Ações simples", 3: "Fluxos autorizados", 4: "Automações configuradas" }[Number(level)] || "Preparar");

function renderAgent() {
  if (location.hash !== "#agente") return;
  const config = agentState.config || {};
  const enabled = Boolean(config.enabled);
  const aiReady = Boolean(config.ai_configured);
  const messages = agentState.messages;
  dashboardGrid.innerHTML = `<section class="agent-hero">
    <div class="agent-hero-copy"><div class="agent-eyebrow"><span class="agent-pulse ${enabled ? "is-on" : ""}"></span> Atendimento inteligente</div><h2>${esc(config.name || "Agente Focussdev")}</h2><p>Um espaço seguro para testar o atendimento comercial e os comandos autorizados do seu agente.</p><div class="agent-hero-actions"><span class="agent-status-pill ${enabled ? "is-on" : ""}">${enabled ? "Agente ativo" : "Agente desativado"}</span><span class="agent-status-pill ${aiReady ? "is-on" : ""}">${aiReady ? "IA conectada" : "IA aguardando configuração"}</span></div></div>
    <div class="agent-hero-mark" aria-hidden="true">✦</div>
  </section>
  <section class="agent-stats-grid" aria-label="Resumo do agente">
    <article class="agent-stat"><span>Status</span><strong>${enabled ? "Ativo" : "Desativado"}</strong><small>${enabled ? "Pronto para testes autorizados" : "Ative para iniciar"}</small></article>
    <article class="agent-stat"><span>Modelo</span><strong>${esc(config.model || "Não definido")}</strong><small>Configuração atual</small></article>
    <article class="agent-stat"><span>Autonomia</span><strong>Nível ${Number(config.autonomy_level ?? 1)}</strong><small>${esc(autonomyLabel(config.autonomy_level ?? 1))}</small></article>
    <article class="agent-stat"><span>Sessão atual</span><strong>${ui.number(messages.length)}</strong><small>mensagens trocadas</small></article>
  </section>
  <section class="agent-workspace">
    <article class="data-card agent-config-card">
      <div class="agent-panel-heading"><div><p class="card-kicker">Configuração</p><h3>Como o agente deve operar</h3><p class="agent-help">Defina a identidade e o nível de autonomia. Ações externas continuam condicionadas às permissões do sistema.</p></div><span class="agent-panel-icon" aria-hidden="true">⚙</span></div>
      <div class="agent-connection ${aiReady ? "is-ready" : ""}"><span class="agent-connection-dot"></span><div><strong>${aiReady ? "Serviço de IA conectado" : "Chave de IA não configurada"}</strong><small>${aiReady ? "O servidor está pronto para processar mensagens." : "Configure a chave no ambiente do servidor para habilitar respostas."}</small></div></div>
      <form class="agent-form" data-agent-config>
        <label>Nome do agente<input name="name" value="${esc(config.name || "Agente Focussdev")}" required></label>
        <label>Modelo<input name="model" value="${esc(config.model || "gpt-5")}" required></label>
        <label>Nível de autonomia<select name="autonomy_level"><option value="0">0 — Somente responder</option><option value="1">1 — Preparar</option><option value="2">2 — Ações simples</option><option value="3">3 — Fluxos autorizados</option><option value="4">4 — Automações configuradas</option></select></label>
        <label class="agent-check"><input name="enabled" type="checkbox" ${enabled ? "checked" : ""}><span><strong>Ativar agente</strong><small>Permitir testes nesta área conforme as permissões da conta.</small></span></label>
        <div class="agent-actions"><button class="button button-primary" type="submit">Salvar configuração</button><output data-agent-config-status role="status"></output></div>
      </form>
    </article>
    <article class="data-card agent-chat-card">
      <div class="agent-panel-heading"><div><p class="card-kicker">Teste controlado</p><h3>Converse com o agente</h3><p class="agent-help">Use uma pergunta comercial ou simule um comando administrativo autorizado.</p></div><button class="compact-action" data-agent-clear type="button">Nova conversa</button></div>
      <div class="agent-suggestions"><span>Experimente:</span><button type="button" data-agent-prompt="Quero um site para minha clínica. O que você recomenda?">Recomendar serviço</button><button type="button" data-agent-prompt="Quais informações você precisa para preparar uma proposta?">Preparar proposta</button></div>
      <div class="agent-messages" data-agent-messages>${messages.map((item) => `<div class="agent-message ${item.role === "assistant" ? "is-agent" : "is-user"}"><span class="agent-message-label">${item.role === "assistant" ? "Agente" : "Você"}</span>${esc(item.text)}</div>`).join("") || `<div class="agent-empty"><span class="agent-empty-icon" aria-hidden="true">✦</span><strong>A conversa começa aqui</strong><p>Envie uma mensagem para testar o agente com segurança.</p></div>`}</div>
      <form class="agent-compose" data-agent-compose><textarea name="message" rows="3" placeholder="Ex.: Quero um site para minha clínica. O que você recomenda?" aria-label="Mensagem para o agente" required></textarea><div class="agent-compose-footer"><span class="agent-compose-note">As ações só são executadas com ferramenta e autorização.</span><button class="button button-primary" type="submit">Enviar mensagem</button></div><output data-agent-status role="status"></output></form>
    </article>
  </section>`;
  dashboardGrid.querySelector("[name=autonomy_level]").value = String(config.autonomy_level ?? 1);
  dashboardGrid.querySelector("[data-agent-clear]")?.addEventListener("click", () => { agentState.conversationId = null; agentState.messages = []; renderAgent(); });
  dashboardGrid.querySelectorAll("[data-agent-prompt]").forEach((button) => button.addEventListener("click", () => { const field = dashboardGrid.querySelector("[name=message]"); field.value = button.dataset.agentPrompt; field.focus(); }));
  dashboardGrid.querySelector("[data-agent-config]")?.addEventListener("submit", async (event) => { event.preventDefault(); const form = event.currentTarget, status = form.querySelector("[data-agent-config-status]"), data = Object.fromEntries(new FormData(form)); data.enabled = form.enabled.checked; data.autonomy_level = Number(data.autonomy_level); status.textContent = "Salvando…"; try { const response = await api("/api/agent/config", { method: "PATCH", body: data }); agentState.config = { ...agentState.config, ...response.agent }; status.textContent = "Configuração salva."; renderAgent(); } catch (error) { status.textContent = error.message; } });
  dashboardGrid.querySelector("[data-agent-compose]")?.addEventListener("submit", async (event) => { event.preventDefault(); const form = event.currentTarget, message = form.message.value.trim(); if (!message) return; agentState.messages.push({ role: "user", text: message }); renderAgent(); const nextForm = dashboardGrid.querySelector("[data-agent-compose]"), nextStatus = nextForm?.querySelector("[data-agent-status]"), nextButton = nextForm?.querySelector("button[type=submit]"); if (nextStatus) nextStatus.textContent = "Consultando agente…"; if (nextButton) nextButton.disabled = true; try { const response = await api("/api/agent/respond", { method: "POST", body: { conversation_id: agentState.conversationId, message } }); agentState.conversationId = response.conversation_id; agentState.messages.push({ role: "assistant", text: response.response.reply }); renderAgent(); } catch (error) { if (nextStatus) nextStatus.textContent = error.message; } finally { const currentButton = dashboardGrid.querySelector("[data-agent-compose] button[type=submit]"); if (currentButton) currentButton.disabled = false; } });
}

async function loadAgent() { if (location.hash !== "#agente") return; dashboardGrid.innerHTML = stateBlock.loading("Carregando agente…"); try { agentState.config = (await api("/api/agent/config")).agent; renderAgent(); } catch (error) { dashboardGrid.innerHTML = stateBlock.error(error.message, "agent-retry"); dashboardGrid.querySelector(".agent-retry")?.addEventListener("click", loadAgent); } }
registerRoutes({ agente: loadAgent }, { parent: "#agente", titles: { agente: "Agente Focussdev" } });
