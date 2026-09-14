/* ==========================================================================
   FocusDev — módulo "whatsapp"
   Tela: WhatsApp (conexão via Evolution API: QR code, status, envio, config)
   Ownership: modules/whatsapp.js, modules/whatsapp.css
   ========================================================================== */

const STATE_LABEL = { open: "Conectado", connecting: "Aguardando leitura do QR code", close: "Desconectado", absent: "Ainda não conectado", unconfigured: "Não configurado" };
const STATE_TONE = { open: "green", connecting: "orange", close: "pink", absent: "blue", unconfigured: "pink" };

let pollTimer = null;
let qrTimer = null;

function stopTimers() {
  window.clearInterval(pollTimer); window.clearInterval(qrTimer);
  pollTimer = null; qrTimer = null;
}

function statusBadge(state) {
  return `<span class="wa-badge ${STATE_TONE[state] || "blue"}"><i></i>${escapeHtml(STATE_LABEL[state] || state)}</span>`;
}

async function renderWhatsapp() {
  stopTimers();
  dashboardGrid.innerHTML = `<section class="page-intro"><div><p class="card-kicker">Automações</p><h2>WhatsApp</h2><p>Conecte o número da sua operação para enviar e receber mensagens direto do workspace.</p></div></section>${stateBlock.loading("Consultando a Evolution API…")}`;
  let status;
  try {
    status = await api("/api/whatsapp/status");
  } catch (error) {
    dashboardGrid.innerHTML = `<section class="page-intro"><div><p class="card-kicker">Automações</p><h2>WhatsApp</h2></div></section>${stateBlock.error(error.message, "wa-retry")}`;
    dashboardGrid.querySelector(".wa-retry")?.addEventListener("click", renderWhatsapp);
    return;
  }
  draw(status);
}

function draw(status, qr = null) {
  const connected = status.state === "open";
  const pending = status.state === "connecting";
  dashboardGrid.innerHTML = `
    <section class="page-intro"><div><p class="card-kicker">Automações</p><h2>WhatsApp</h2><p>Conecte o número da sua operação para enviar e receber mensagens direto do workspace.</p></div>${status.configured ? (connected ? `<button class="button button-secondary compact-action" data-wa-disconnect type="button">Desconectar</button>` : `<button class="button button-primary compact-action" data-wa-connect type="button">${pending ? "Gerar novo QR code" : "Conectar WhatsApp"}</button>`) : ""}</section>
    <section class="wa-grid">
      <article class="data-card wa-status-card">
        <div class="section-heading"><div><p class="card-kicker">Conexão</p><h2>Status da instância</h2></div>${statusBadge(status.state)}</div>
        <dl class="wa-facts">
          <div><dt>Instância</dt><dd>${escapeHtml(status.instance || "—")}</dd></div>
          <div><dt>Número</dt><dd>${status.number ? `+${escapeHtml(status.number)}` : "—"}</dd></div>
          <div><dt>Perfil</dt><dd>${escapeHtml(status.profileName || "—")}</dd></div>
        </dl>
        <div class="wa-qr" data-wa-qr ${qr?.base64 ? "" : "hidden"}>
          ${qr?.base64 ? `<img src="${escapeHtml(qr.base64.startsWith("data:") ? qr.base64 : `data:image/png;base64,${qr.base64}`)}" alt="QR code para conectar o WhatsApp" />` : ""}
          <p>Abra o WhatsApp no celular → <strong>Aparelhos conectados</strong> → <strong>Conectar aparelho</strong> e aponte a câmera. O código é renovado automaticamente a cada 30 segundos.</p>
          ${qr?.pairingCode ? `<p class="wa-pairing">Ou use o código de pareamento: <code>${escapeHtml(qr.pairingCode)}</code></p>` : ""}
        </div>
        ${connected ? `<div class="wa-connected"><strong>Tudo pronto.</strong> Mensagens recebidas aparecem na <a href="#caixa-de-entrada">Caixa de entrada</a> e as automações podem responder por este número.</div>` : ""}
        <p class="wa-feedback" data-wa-feedback role="status"></p>
      </article>

      <article class="data-card wa-send-card">
        <div class="section-heading"><div><p class="card-kicker">Teste rápido</p><h2>Enviar mensagem</h2></div></div>
        <form class="wa-form" data-wa-send>
          <label>Número (DDI + DDD + número)<input name="number" type="tel" inputmode="numeric" placeholder="5511999990000" ${connected ? "" : "disabled"} required /></label>
          <label>Mensagem<textarea name="text" rows="3" placeholder="Olá! Esta é uma mensagem de teste do FocusDev." ${connected ? "" : "disabled"} required></textarea></label>
          <button class="button button-primary compact-action" type="submit" ${connected ? "" : "disabled"}>Enviar pelo WhatsApp</button>
          <p class="wa-feedback" data-wa-send-feedback role="status">${connected ? "" : "Conecte o número para habilitar o envio."}</p>
        </form>
      </article>

      ${status.canManage && !status.configured ? `<article class="data-card wa-config-card">
        <div class="section-heading"><div><p class="card-kicker">Configuração</p><h2>Evolution API</h2></div></div>
        <p class="wa-config-note">A conexão deste workspace ainda não foi habilitada. Informe a configuração uma única vez; depois disso, a operação será feita somente pelo botão de conexão.</p>
        <form class="wa-form" data-wa-config>
          <label>URL do servidor<input name="baseUrl" type="url" value="${escapeHtml(status.baseUrl || "")}" placeholder="https://sua-evolution.exemplo.com" required /></label>
          <label>Chave da API (apikey)<input name="apiKey" type="password" autocomplete="off" placeholder="${status.configured ? "Manter a chave atual" : "Cole a chave global da Evolution"}" /></label>
          <button class="button button-secondary compact-action" type="submit">Salvar configuração</button>
          <p class="wa-feedback" data-wa-config-feedback role="status">A chave fica guardada no servidor e nunca é exibida de novo. Você também pode defini-la como variável de ambiente <code>EVOLUTION_API_KEY</code>.</p>
        </form>
      </article>` : ""}
    </section>`;
  bind(status);
  if (pending) startPolling();
}

function bind(status) {
  const feedback = dashboardGrid.querySelector("[data-wa-feedback]");
  const say = (element, message, isError = false) => { if (!element) return; element.textContent = message; element.classList.toggle("is-error", isError); };

  dashboardGrid.querySelector("[data-wa-connect]")?.addEventListener("click", async (event) => {
    const button = event.currentTarget; button.disabled = true; say(feedback, "Gerando QR code…");
    try {
      const result = await api("/api/whatsapp/connect", { method: "POST", body: {} });
      if (result.state === "open") { renderWhatsapp(); return; }
      draw({ ...status, state: result.state || "connecting" }, result.qr || null);
    } catch (error) { say(feedback, error.message, true); button.disabled = false; }
  });

  dashboardGrid.querySelector("[data-wa-disconnect]")?.addEventListener("click", async (event) => {
    const button = event.currentTarget;
    if (button.dataset.confirm !== "1") { button.dataset.confirm = "1"; button.textContent = "Confirmar desconexão"; return; }
    button.disabled = true;
    try { await api("/api/whatsapp/disconnect", { method: "POST", body: {} }); renderWhatsapp(); }
    catch (error) { say(feedback, error.message, true); button.disabled = false; }
  });

  dashboardGrid.querySelector("[data-wa-send]")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget, out = form.querySelector("[data-wa-send-feedback]"), submit = form.querySelector("[type=submit]");
    submit.disabled = true; say(out, "Enviando…");
    try {
      await api("/api/whatsapp/send", { method: "POST", body: { number: form.number.value, text: form.text.value } });
      say(out, "Mensagem enviada."); form.text.value = "";
      document.dispatchEvent(new Event("focus-inbox-changed"));
    } catch (error) { say(out, error.message, true); }
    finally { submit.disabled = false; }
  });

  dashboardGrid.querySelector("[data-wa-config]")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget, out = form.querySelector("[data-wa-config-feedback]"), submit = form.querySelector("[type=submit]");
    submit.disabled = true; say(out, "Salvando…");
    try {
      await api("/api/whatsapp/config", { method: "POST", body: { baseUrl: form.baseUrl.value, apiKey: form.apiKey.value } });
      const next = await api("/api/whatsapp/status");
      const connection = await api("/api/whatsapp/connect", { method: "POST", body: {} });
      if (connection.state === "open") renderWhatsapp();
      else draw({ ...next, state: connection.state || "connecting" }, connection.qr);
    } catch (error) { say(out, error.message, true); submit.disabled = false; }
  });
}

/* Enquanto o QR está na tela: consulta o estado a cada 3 s e renova o QR a cada 30 s. */
function startPolling() {
  stopTimers();
  pollTimer = window.setInterval(async () => {
    if (!dashboardGrid.querySelector("[data-wa-qr]")) { stopTimers(); return; }
    try {
      const status = await api("/api/whatsapp/status");
      if (status.state === "open") { stopTimers(); renderWhatsapp(); }
    } catch { /* tenta de novo no próximo ciclo */ }
  }, 3000);
  qrTimer = window.setInterval(async () => {
    const holder = dashboardGrid.querySelector("[data-wa-qr]");
    if (!holder) { stopTimers(); return; }
    try {
      const result = await api("/api/whatsapp/connect", { method: "POST", body: {} });
      const img = holder.querySelector("img");
      if (result.qr?.base64 && img) img.src = result.qr.base64.startsWith("data:") ? result.qr.base64 : `data:image/png;base64,${result.qr.base64}`;
      if (result.state === "open") { stopTimers(); renderWhatsapp(); }
    } catch { /* mantém o QR atual */ }
  }, 30000);
}

window.addEventListener("hashchange", () => { if (window.location.hash !== "#whatsapp") stopTimers(); });

registerRoutes({ whatsapp: renderWhatsapp }, { parent: "#whatsapp", titles: { whatsapp: "WhatsApp" } });
