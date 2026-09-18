/* ==========================================================================
   FocusDev — módulo "whatsapp"
   Tela: WhatsApp (conexão via Evolution API: QR code, status, envio, config)
   Ownership: modules/whatsapp.js, modules/whatsapp.css
   ========================================================================== */

const STATE_LABEL = { open: "Conectado", connecting: "Aguardando leitura do QR code", close: "Desconectado", absent: "Ainda não conectado", unconfigured: "Não configurado" };
const STATE_TONE = { open: "green", connecting: "orange", close: "pink", absent: "blue", unconfigured: "pink" };

function qrSource(value) {
  const raw = String(value || "");
  if (/^data:image\/(?:png|jpeg|jpg|webp);base64,[a-z0-9+/=]+$/i.test(raw)) return raw;
  if (/^[a-z0-9+/=]+$/i.test(raw) && raw.length > 40) return `data:image/png;base64,${raw}`;
  return "";
}

let pollTimer = null;
let qrTimer = null;
let whatsappRenderRequest = 0;
let pollInFlight = false;
let qrInFlight = false;
let activeChannel = "support";

function stopTimers() {
  window.clearInterval(pollTimer); window.clearInterval(qrTimer);
  pollTimer = null; qrTimer = null;
}

function statusBadge(state) {
  return `<span class="wa-badge ${STATE_TONE[state] || "blue"}"><i aria-hidden="true"></i>${escapeHtml(STATE_LABEL[state] || state)}</span>`;
}

async function renderWhatsapp() {
  if (location.hash !== "#whatsapp") return;
  const request = ++whatsappRenderRequest;
  stopTimers();
  dashboardGrid.setAttribute("aria-busy", "true");
  dashboardGrid.innerHTML = `<section class="page-intro"><div><p class="card-kicker">Automações</p><h2>WhatsApp</h2><p>Conecte o número da sua operação para enviar e receber mensagens direto do workspace.</p></div></section>${stateBlock.loading("Consultando a Evolution API…")}`;
  let status;
  try {
    status = await api("/api/whatsapp/status");
    if (request !== whatsappRenderRequest || location.hash !== "#whatsapp") return;
  } catch (error) {
    if (request !== whatsappRenderRequest || location.hash !== "#whatsapp") return;
    dashboardGrid.removeAttribute("aria-busy");
    dashboardGrid.innerHTML = `<section class="page-intro"><div><p class="card-kicker">Automações</p><h2>WhatsApp</h2></div></section>${stateBlock.error(error.message, "wa-retry")}`;
    dashboardGrid.querySelector(".wa-retry")?.addEventListener("click", renderWhatsapp);
    return;
  }
  draw(status);
}

function draw(allStatus, qr = null) {
  const status = { ...allStatus, ...(allStatus.channels?.[activeChannel] || {}) };
  dashboardGrid.removeAttribute("aria-busy");
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
         <div class="wa-qr" data-wa-qr ${qrSource(qr?.base64) || qr?.pairingCode ? "" : "hidden"}>
           ${qrSource(qr?.base64) ? `<img width="256" height="256" src="${escapeHtml(qrSource(qr?.base64))}" alt="QR code para conectar o WhatsApp" />` : ""}
          <p>Abra o WhatsApp no celular → <strong>Aparelhos conectados</strong> → <strong>Conectar aparelho</strong> e aponte a câmera. O código é renovado automaticamente a cada 30 segundos.</p>
          ${qr?.pairingCode ? `<p class="wa-pairing">Ou use o código de pareamento: <code>${escapeHtml(qr.pairingCode)}</code></p>` : ""}
        </div>
        ${connected ? `<div class="wa-connected"><strong>Tudo pronto.</strong> Mensagens recebidas aparecem na <a href="#caixa-de-entrada">Caixa de entrada</a> e as automações podem responder por este número.</div>` : ""}
        <p class="wa-feedback" data-wa-feedback role="status"></p>
      </article>

      <article class="data-card wa-send-card">
        <div class="section-heading"><div><p class="card-kicker">Teste rápido</p><h2>Enviar mensagem</h2></div></div>
        <form class="wa-form" data-wa-send>
          <label>Número (DDI + DDD + número)<input name="number" type="tel" inputmode="numeric" autocomplete="off" placeholder="5511999990000…" ${connected ? "" : "disabled"} required /></label>
          <label>Mensagem<textarea name="text" autocomplete="off" rows="3" placeholder="Olá! Esta é uma mensagem de teste do FocusDev…" ${connected ? "" : "disabled"} required></textarea></label>
          <button class="button button-primary compact-action" type="submit" ${connected ? "" : "disabled"}>Enviar pelo WhatsApp</button>
          <p class="wa-feedback" data-wa-send-feedback role="status">${connected ? "" : "Conecte o número para habilitar o envio."}</p>
        </form>
      </article>

      ${status.canManage && !status.configured ? `<article class="data-card wa-config-card">
        <div class="section-heading"><div><p class="card-kicker">Configuração</p><h2>Evolution API</h2></div></div>
        <p class="wa-config-note">A conexão deste workspace ainda não foi habilitada. Informe a configuração uma única vez; depois disso, a operação será feita somente pelo botão de conexão.</p>
        <form class="wa-form" data-wa-config>
          <label>URL do servidor<input name="baseUrl" type="url" autocomplete="off" value="${escapeHtml(status.baseUrl || "")}" placeholder="https://sua-evolution.exemplo.com…" required /></label>
          <label>Chave da API (apikey)<input name="apiKey" type="password" autocomplete="off" placeholder="${status.configured ? "Manter a chave atual…" : "Cole a chave global da Evolution…"}" /></label>
          <button class="button button-secondary compact-action" type="submit">Salvar configuração</button>
          <p class="wa-feedback" data-wa-config-feedback role="status">A chave fica guardada no servidor e nunca é exibida de novo. Você também pode defini-la como variável de ambiente <code>EVOLUTION_API_KEY</code>.</p>
        </form>
      </article>` : ""}
    </section>`;
  bind(status);
  dashboardGrid.querySelector(".page-intro")?.insertAdjacentHTML("beforeend", `<label class="wa-channel-picker">Canal<select data-wa-channel><option value="support" ${activeChannel === "support" ? "selected" : ""}>Atendimento</option><option value="assistant" ${activeChannel === "assistant" ? "selected" : ""}>Auxiliar</option></select></label>`);
  dashboardGrid.querySelector("[data-wa-channel]")?.addEventListener("change", (event) => { activeChannel = event.currentTarget.value; draw(allStatus); });
  const qrImage = dashboardGrid.querySelector("[data-wa-qr] img");
  if (qrImage) { qrImage.width = 256; qrImage.height = 256; }
  if (pending) startPolling();
}

function bind(status) {
  const feedback = dashboardGrid.querySelector("[data-wa-feedback]");
  const say = (element, message, isError = false) => { if (!element) return; element.textContent = message; element.setAttribute("role", isError ? "alert" : "status"); element.setAttribute("aria-live", "polite"); element.classList.toggle("is-error", isError); };
  dashboardGrid.querySelectorAll(".wa-feedback, .wa-badge").forEach((element) => element.setAttribute("aria-live", "polite"));
  dashboardGrid.querySelectorAll(".wa-badge").forEach((element) => element.setAttribute("role", "status"));

  dashboardGrid.querySelector("[data-wa-connect]")?.addEventListener("click", async (event) => {
    const button = event.currentTarget; if (button.disabled) return; const request = whatsappRenderRequest, originalLabel = button.textContent; button.disabled = true; button.setAttribute("aria-busy", "true"); button.textContent = "Gerando QR code…"; say(feedback, "Gerando QR code…");
    try {
      const result = await api("/api/whatsapp/connect", { method: "POST", body: { channel: status.channel } });
      if (location.hash !== "#whatsapp" || request !== whatsappRenderRequest || !button.isConnected) return;
      if (result.state === "open") { renderWhatsapp(); return; }
      draw({ ...status, state: result.state || "connecting" }, result.qr || null);
    } catch (error) { if (location.hash === "#whatsapp" && request === whatsappRenderRequest && button.isConnected) { say(feedback, error.message, true); button.disabled = false; button.removeAttribute("aria-busy"); button.textContent = originalLabel; } }
  });

  dashboardGrid.querySelector("[data-wa-disconnect]")?.addEventListener("click", async (event) => {
    const button = event.currentTarget;
    if (button.dataset.confirm !== "1") { button.dataset.confirm = "1"; button.textContent = "Confirmar desconexão"; return; }
    const request = whatsappRenderRequest;
    button.disabled = true;
    button.setAttribute("aria-busy", "true");
    button.textContent = "Desconectando…";
    try { await api("/api/whatsapp/disconnect", { method: "POST", body: { channel: status.channel } }); if (location.hash === "#whatsapp" && request === whatsappRenderRequest) renderWhatsapp(); }
    catch (error) { if (location.hash === "#whatsapp" && request === whatsappRenderRequest && button.isConnected) { say(feedback, error.message, true); button.disabled = false; button.removeAttribute("aria-busy"); button.textContent = "Confirmar desconexão"; } }
  });

  dashboardGrid.querySelector("[data-wa-send]")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget, out = form.querySelector("[data-wa-send-feedback]"), submit = form.querySelector("[type=submit]"), number = form.number.value.replace(/\D/g, ""), text = form.text.value.trim();
    out?.setAttribute("aria-live", "polite");
    if (number.length < 10 || number.length > 15) { say(out, "Informe um número com DDI, DDD e telefone (10 a 15 dígitos).", true); form.number.focus(); return; }
    if (!text) { say(out, "Digite uma mensagem antes de enviar.", true); form.text.focus(); return; }
    submit.disabled = true; submit.setAttribute("aria-busy", "true"); say(out, "Enviando…");
    try {
      await api("/api/whatsapp/send", { method: "POST", body: { number, text, channel: status.channel } });
      if (location.hash !== "#whatsapp" || !form.isConnected) return;
      say(out, "Mensagem enviada."); form.text.value = "";
      document.dispatchEvent(new Event("focus-inbox-changed"));
    } catch (error) { if (location.hash === "#whatsapp" && form.isConnected) say(out, error.message, true); }
    finally { if (form.isConnected) { submit.disabled = false; submit.removeAttribute("aria-busy"); } }
  });

  dashboardGrid.querySelector("[data-wa-config]")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget, out = form.querySelector("[data-wa-config-feedback]"), submit = form.querySelector("[type=submit]"), request = whatsappRenderRequest;
    out?.setAttribute("aria-live", "polite");
    submit.disabled = true; submit.setAttribute("aria-busy", "true"); say(out, "Salvando…");
    try {
      await api("/api/whatsapp/config", { method: "POST", body: { baseUrl: form.baseUrl.value, apiKey: form.apiKey.value } });
      const next = await api("/api/whatsapp/status");
      const connection = await api("/api/whatsapp/connect", { method: "POST", body: { channel: activeChannel } });
      if (location.hash !== "#whatsapp" || request !== whatsappRenderRequest || !form.isConnected) return;
      if (connection.state === "open") renderWhatsapp();
      else draw({ ...next, state: connection.state || "connecting" }, connection.qr);
    } catch (error) { if (location.hash === "#whatsapp" && request === whatsappRenderRequest && form.isConnected) { say(out, error.message, true); submit.disabled = false; submit.removeAttribute("aria-busy"); } }
  });
}

/* Enquanto o QR está na tela: consulta o estado a cada 3 s e renova o QR a cada 30 s. */
function startPolling() {
  stopTimers();
  const pollingRequest = whatsappRenderRequest;
  pollTimer = window.setInterval(async () => {
    if (pollInFlight) return;
    if (location.hash !== "#whatsapp" || pollingRequest !== whatsappRenderRequest || !dashboardGrid.querySelector("[data-wa-qr]")) { stopTimers(); return; }
    pollInFlight = true;
    try {
      const status = await api("/api/whatsapp/status");
      if (location.hash === "#whatsapp" && pollingRequest === whatsappRenderRequest && status.state === "open") { stopTimers(); renderWhatsapp(); }
    } catch { /* tenta de novo no próximo ciclo */ }
    finally { pollInFlight = false; }
  }, 3000);
  qrTimer = window.setInterval(async () => {
    if (qrInFlight) return;
    if (location.hash !== "#whatsapp" || pollingRequest !== whatsappRenderRequest) { stopTimers(); return; }
    const holder = dashboardGrid.querySelector("[data-wa-qr]");
    if (!holder) { stopTimers(); return; }
    qrInFlight = true;
    try {
      const result = await api("/api/whatsapp/connect", { method: "POST", body: { channel: activeChannel } });
      if (location.hash !== "#whatsapp" || pollingRequest !== whatsappRenderRequest || !holder.isConnected) return;
      const img = holder.querySelector("img");
      const nextQr = qrSource(result.qr?.base64);
      if (nextQr && img) img.src = nextQr;
      if (location.hash === "#whatsapp" && pollingRequest === whatsappRenderRequest && result.state === "open") { stopTimers(); renderWhatsapp(); }
    } catch { /* mantém o QR atual */ }
    finally { qrInFlight = false; }
  }, 30000);
}

window.addEventListener("hashchange", () => { if (window.location.hash !== "#whatsapp") { stopTimers(); whatsappRenderRequest += 1; } });

registerRoutes({ whatsapp: renderWhatsapp }, { parent: "#whatsapp", titles: { whatsapp: "WhatsApp" } });
