/* ==========================================================================
   FocusDev — módulo "inbox"
   Telas: Caixa de entrada (#caixa-de-entrada) e Conversas (#conversas —
   a mesma caixa, agrupada por contato). Dados de /api/conversations.
   Ownership: modules/inbox.js, modules/inbox.css
   ========================================================================== */

const toast = (...args) => { if (["#caixa-de-entrada", "#conversas"].includes(location.hash)) ui.toast(...args); };

const CHANNEL = { internal: ["Interno", "💬"], email: ["E-mail", "✉"], whatsapp: ["WhatsApp", "🟢"] };
const FILTERS = [["all", "Todas"], ["unread", "Não lidas"], ["whatsapp", "WhatsApp"], ["email", "E-mail"], ["internal", "Internas"], ["archived", "Arquivadas"]];

const box = { conversations: [], filter: "all", query: "", selected: null, messages: [], composing: false, byContact: false, routeKey: "caixa-de-entrada", contacts: null, clients: null, offset: 0, searchTimer: null, threadRequest: 0, loadRequest: 0 };

const esc = (v) => escapeHtml(v == null ? "" : String(v));
const inboxTimeFormatter = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" });
const inboxShortDateFormatter = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" });
const inboxDayFormatter = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long" });
const nameOf = (c) => c.contact_name || c.client_name || (c.remote_number ? `+${c.remote_number}` : "") || c.subject || "Sem nome";
const initials = (text) => text.replace(/^\+/, "").trim().split(/\s+/).slice(0, 2).map((p) => p[0] || "").join("").toUpperCase() || "?";
function when(value) {
  if (!value) return "";
  const d = new Date(value); if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return inboxTimeFormatter.format(d);
  const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return "ontem";
  return inboxShortDateFormatter.format(d);
}

/* ---------------------------------------------------------------------------
   Carregamento
   --------------------------------------------------------------------------- */

async function load() {
  const request = ++box.loadRequest;
  const routeKey = box.routeKey;
  const status = box.filter === "archived" ? "archived" : "all";
  const params = new URLSearchParams({ status, limit: "100", offset: String(box.offset) });
  if (box.query.trim()) params.set("search", box.query.trim()); if (["whatsapp", "email", "internal"].includes(box.filter)) params.set("channel", box.filter); if (box.filter === "unread") params.set("unread", "true");
  const data = await api(`/api/conversations?${params}`);
  if (request !== box.loadRequest || location.hash !== `#${routeKey}`) return false;
  box.conversations = (data.conversations || []).filter((c) => box.filter === "archived" ? c.status === "archived" : c.status !== "archived");
  return true;
}

function visible() {
  const q = box.query.trim().toLocaleLowerCase("pt-BR");
  let list = box.conversations.filter((c) => {
    if (box.filter === "unread" && !Number(c.unread_count)) return false;
    if (["whatsapp", "email", "internal"].includes(box.filter) && c.channel !== box.filter) return false;
    if (q && !`${nameOf(c)} ${c.subject} ${c.last_message || ""} ${c.remote_number || ""}`.toLocaleLowerCase("pt-BR").includes(q)) return false;
    return true;
  });
  if (box.byContact) list = [...list].sort((a, b) => nameOf(a).localeCompare(nameOf(b), "pt-BR") || new Date(b.last_message_at || 0) - new Date(a.last_message_at || 0));
  return list;
}

async function renderInbox(routeKey = "caixa-de-entrada") {
  box.byContact = routeKey === "conversas";
  box.routeKey = routeKey;
  if (!box.byContact) return renderInternalInbox();
  dashboardGrid.innerHTML = `<section class="page-intro"><div><p class="card-kicker">Comunicação</p><h2>${box.byContact ? "Conversas" : "Caixa de entrada"}</h2><p>Carregando…</p></div></section>${stateBlock.loading("Carregando conversas…")}`;
  try { if (await load() === false) return; }
  catch (error) { if (location.hash !== `#${routeKey}`) return; dashboardGrid.innerHTML = `<section class="page-intro"><div><p class="card-kicker">Comunicação</p><h2>Caixa de entrada</h2></div></section>${stateBlock.error(error.message, "inbox-retry")}`; dashboardGrid.querySelector(".inbox-retry")?.addEventListener("click", () => renderInbox(routeKey)); return; }
  if (box.selected && !box.conversations.some((c) => String(c.id) === String(box.selected))) box.selected = null;
  draw();
  if (box.selected) openThread(box.selected, { silent: true });
}

async function renderInternalInbox() {
  if (location.hash !== "#caixa-de-entrada") return;
  let filter = "all";
  let internalLoadRequest = 0;
  const drawInternal = (items = [], unread = 0, error = "") => {
    if (location.hash !== "#caixa-de-entrada") return;
    dashboardGrid.removeAttribute("aria-busy");
    const rows = items.length ? items.map((item) => `<article class="notification-inbox-row ${item.read_at ? "is-read" : "is-unread"}"><div><strong>${esc(item.read_at ? "Notificação interna" : "Nova notificação")}</strong><p>${esc(item.message)}</p><time>${esc(when(item.created_at))}</time>${item.automation_id ? ` <a class="text-action" href="#automacoes">Abrir automação</a>` : item.entity_type === "tickets" ? ` <a class="text-action" href="#tickets">Abrir ticket</a>` : item.entity_type === "files" ? ` <a class="text-action" href="#arquivos">Abrir arquivo</a>` : ""}</div><div class="notification-inbox-actions">${item.read_at ? "" : `<button class="text-action" type="button" data-notification-read="${esc(item.id)}">Marcar lida</button>`}<button class="text-action" type="button" data-notification-archive="${esc(item.id)}" data-notification-archived="${item.archived_at ? "true" : "false"}">${item.archived_at ? "Restaurar" : "Arquivar"}</button></div></article>`).join("") : `<div class="inbox-empty"><p>${error || (filter === "unread" ? "Nenhuma notificação não lida." : filter === "archived" ? "Nenhuma notificação arquivada." : "Tudo em dia.")}</p>${error ? `<button class="text-action" type="button" data-notification-retry>Tentar novamente</button>` : ""}</div>`;
    dashboardGrid.innerHTML = `<section class="page-intro"><div><p class="card-kicker">Meu dia</p><h2>Caixa de entrada</h2><p>${unread ? `<strong>${unread}</strong> ${unread === 1 ? "notificação não lida" : "notificações não lidas"}` : "Tudo lido"} · alertas internos do workspace</p></div><button class="button button-secondary compact-action" type="button" data-notification-read-all>Marcar todas como lidas</button></section><section class="data-card notification-inbox"><div class="inbox-filters"><button class="filter-button ${filter === "all" ? "is-active" : ""}" data-notification-filter="all" type="button">Todas</button><button class="filter-button ${filter === "unread" ? "is-active" : ""}" data-notification-filter="unread" type="button">Não lidas</button><button class="filter-button ${filter === "archived" ? "is-active" : ""}" data-notification-filter="archived" type="button">Arquivadas</button></div><div class="notification-inbox-list">${rows}</div></section>`;
    dashboardGrid.querySelectorAll("[data-notification-filter]").forEach((button) => button.addEventListener("click", () => { filter = button.dataset.notificationFilter; loadInternal(); }));
    dashboardGrid.querySelector("[data-notification-retry]")?.addEventListener("click", loadInternal);
    dashboardGrid.querySelector(".notification-inbox")?.insertAdjacentHTML("beforebegin", ui.stats([{ label: "NotificaÃ§Ãµes na lista", value: ui.number(items.length) }, { label: "NÃ£o lidas", value: ui.number(unread), tone: unread ? "orange" : "green" }, { label: "Filtro atual", value: filter === "all" ? "Todas" : filter === "unread" ? "NÃ£o lidas" : "Arquivadas" }]));
    const runNotificationAction = async (button, work) => {
      if (button.disabled) return;
      button.disabled = true;
      button.setAttribute("aria-busy", "true");
      try {
        await work();
        if (location.hash !== "#caixa-de-entrada" || !button.isConnected) return;
        await loadInternal();
        if (location.hash === "#caixa-de-entrada") document.dispatchEvent(new Event("focus-inbox-changed"));
      } catch (error) {
        if (location.hash === "#caixa-de-entrada") toast(error.message, "error");
        button.disabled = false;
        button.removeAttribute("aria-busy");
      }
    };
    dashboardGrid.querySelector("[data-notification-read-all]")?.addEventListener("click", (event) => runNotificationAction(event.currentTarget, () => api("/api/notifications/read-all", { method: "POST" })));
    dashboardGrid.querySelectorAll("[data-notification-read]").forEach((button) => button.addEventListener("click", () => runNotificationAction(button, () => api(`/api/notifications/${button.dataset.notificationRead}`, { method: "PATCH", body: { read: true } }))));
    dashboardGrid.querySelectorAll("[data-notification-archive]").forEach((button) => button.addEventListener("click", () => { const archived = button.dataset.notificationArchived !== "true"; return runNotificationAction(button, () => api(`/api/notifications/${button.dataset.notificationArchive}`, { method: "PATCH", body: { archived } })); }));
  };
  const loadInternal = async () => { const request = ++internalLoadRequest; dashboardGrid.innerHTML = `<section class="page-intro"><div><p class="card-kicker">Meu dia</p><h2>Caixa de entrada</h2><p>Carregando notificações…</p></div></section>${stateBlock.loading("Carregando alertas internos…")}`; try { const data = await api(`/api/notifications?status=${filter}`); if (request !== internalLoadRequest || location.hash !== "#caixa-de-entrada") return; drawInternal(data.notifications || [], Number(data.unread_count || 0)); } catch (error) { if (request !== internalLoadRequest || location.hash !== "#caixa-de-entrada") return; drawInternal([], 0, error.message); } };
  await loadInternal();
}

/* ---------------------------------------------------------------------------
   Layout
   --------------------------------------------------------------------------- */

function draw() {
  const list = visible();
  const unread = box.conversations.reduce((n, c) => n + Number(c.unread_count || 0), 0);
  dashboardGrid.innerHTML = `
    <section class="page-intro"><div><p class="card-kicker">Comunicação</p><h2>${box.byContact ? "Conversas" : "Caixa de entrada"}</h2><p>${unread ? `<strong>${unread}</strong> ${unread === 1 ? "mensagem não lida" : "mensagens não lidas"}` : "Tudo lido"} · ${box.conversations.length} ${box.conversations.length === 1 ? "conversa" : "conversas"}${box.byContact ? " · agrupadas por contato" : ""}</p></div><button class="button button-primary compact-action" type="button" data-inbox-new>+ Nova conversa</button></section>
    <section class="inbox-layout">
      <aside class="data-card inbox-list-card">
        <div class="inbox-filters" role="tablist" aria-label="Filtrar conversas">${FILTERS.map(([k, label]) => `<button class="filter-button ${box.filter === k ? "is-active" : ""}" type="button" role="tab" data-filter="${k}">${label}${k === "unread" && unread ? ` <b>${unread}</b>` : ""}</button>`).join("")}</div>
        <input class="inbox-search" type="search" placeholder="Buscar por nome, assunto ou mensagem…" value="${esc(box.query)}" aria-label="Buscar conversa" />
        <div class="inbox-list">${list.length ? list.map(rowMarkup).join("") : `<div class="inbox-empty"><p>${box.conversations.length ? "Nenhuma conversa com esse filtro." : "Nenhuma conversa ainda."}</p>${box.conversations.length ? "" : `<button class="text-action" type="button" data-inbox-new>Iniciar a primeira →</button>`}</div>`}</div>
      </aside>
      <section class="data-card inbox-thread" data-thread>${box.composing ? composerMarkup() : box.selected ? "" : `<div class="inbox-placeholder"><span class="inbox-placeholder-icon">✉</span><h3>Selecione uma conversa</h3><p>Mensagens do WhatsApp conectado, e-mails registrados e notas internas ficam aqui, com resposta direto pelo canal certo.</p></div>`}</section>
    </section>`;
  dashboardGrid.querySelector(".inbox-layout")?.insertAdjacentHTML("beforebegin", ui.stats([{ label: "Conversas", value: ui.number(box.conversations.length) }, { label: "NÃ£o lidas", value: ui.number(unread), tone: unread ? "orange" : "green" }, { label: "WhatsApp", value: ui.number(box.conversations.filter((item) => item.channel === "whatsapp").length) }, { label: "E-mail", value: ui.number(box.conversations.filter((item) => item.channel === "email").length) }]));
  bind();
}

function rowMarkup(c) {
  const [channelLabel, icon] = CHANNEL[c.channel] || CHANNEL.internal;
  const unread = Number(c.unread_count || 0);
  return `<button class="inbox-row ${String(c.id) === String(box.selected) ? "is-selected" : ""} ${unread ? "is-unread" : ""}" type="button" data-open="${esc(c.id)}">
    <span class="inbox-avatar inbox-avatar-${esc(c.channel)}">${esc(initials(nameOf(c)))}</span>
    <span class="inbox-row-main"><span class="inbox-row-top"><strong>${esc(nameOf(c))}</strong><time>${esc(when(c.last_message_at || c.created_at))}</time></span><span class="inbox-row-subject">${esc(c.subject)}</span><span class="inbox-row-preview">${esc(c.last_message || "Sem mensagens")}</span></span>
    <span class="inbox-row-side"><span class="inbox-channel" role="img" aria-label="${esc(channelLabel)}">${icon}</span>${unread ? `<b class="inbox-unread">${unread}</b>` : ""}</span>
  </button>`;
}

/* ---------------------------------------------------------------------------
   Thread
   --------------------------------------------------------------------------- */

async function openThread(id, { silent = false } = {}) {
  const threadRequest = ++box.threadRequest;
  box.selected = id; box.composing = false;
  const c = box.conversations.find((x) => String(x.id) === String(id));
  const pane = dashboardGrid.querySelector("[data-thread]");
  if (!c || !pane) return;
  dashboardGrid.querySelectorAll(".inbox-row").forEach((r) => r.classList.toggle("is-selected", r.dataset.open === String(id)));
  pane.setAttribute("aria-busy", "true");
  pane.innerHTML = stateBlock.loading("Abrindo conversa…");
  try { box.messages = (await api(`/api/conversations/${id}/messages`)).messages || []; }
  catch (error) { if (threadRequest !== box.threadRequest || box.selected !== id || !pane.isConnected || location.hash !== `#${box.routeKey}`) return; pane.removeAttribute("aria-busy"); pane.innerHTML = stateBlock.error(error.message, "inbox-thread-retry"); pane.querySelector(".inbox-thread-retry")?.addEventListener("click", () => openThread(id)); return; }
  if (threadRequest !== box.threadRequest || box.selected !== id || !pane.isConnected || location.hash !== `#${box.routeKey}`) return;
  if (Number(c.unread_count) && !silent) { api(`/api/conversations/${id}`, { method: "PATCH", body: { read: true } }).then(() => { if (threadRequest !== box.threadRequest || box.selected !== id || location.hash !== `#${box.routeKey}`) return; c.unread_count = 0; document.dispatchEvent(new Event("focus-inbox-changed")); refreshRow(c); }).catch(() => {}); }
  const [channelLabel] = CHANNEL[c.channel] || CHANNEL.internal;
  const canReply = c.channel !== "whatsapp" || Boolean(c.remote_number);
  pane.innerHTML = `
    <header class="inbox-thread-head">
      <span class="inbox-avatar inbox-avatar-${esc(c.channel)}">${esc(initials(nameOf(c)))}</span>
      <div class="inbox-thread-title"><strong>${esc(nameOf(c))}</strong><small>${esc(c.subject)} · ${channelLabel}${c.remote_number ? ` · +${esc(c.remote_number)}` : ""}${c.client_name ? ` · cliente ${esc(c.client_name)}` : ""}</small></div>
      <div class="inbox-thread-actions">
        ${c.contact_id ? `<a class="text-action" href="#contatos">Ver contato</a>` : `<button class="text-action" type="button" data-link-contact>Vincular contato</button>`}
        <button class="text-action" type="button" data-unread>Marcar não lida</button>
        <button class="text-action" type="button" data-archive>${c.status === "archived" ? "Reabrir" : "Arquivar"}</button>
        <button class="text-action inbox-danger" type="button" data-delete>Excluir</button>
      </div>
      <div class="inbox-link-contact" data-link-form hidden></div>
    </header>
    <div class="inbox-messages" data-messages>${messagesMarkup()}</div>
    <form class="inbox-composer" data-composer>
      <textarea name="body" rows="2" placeholder="${canReply ? (c.channel === "whatsapp" ? "Responder pelo WhatsApp… (Enter envia, Shift+Enter quebra linha)" : c.channel === "email" ? "Registrar resposta por e-mail…" : "Escrever nota interna…") : "Esta conversa não tem número de WhatsApp para responder."}" ${canReply ? "" : "disabled"}></textarea>
      <div class="inbox-composer-foot"><small data-composer-status>${c.channel === "whatsapp" ? "A resposta é enviada pelo número conectado." : c.channel === "email" ? "A resposta será enviada ao e-mail vinculado." : "Visível só para a equipe."}</small><button class="button button-primary compact-action" type="submit" ${canReply ? "" : "disabled"}>Enviar</button></div>
    </form>`;
  pane.removeAttribute("aria-busy");
  bindThread(c);
  const scroller = pane.querySelector("[data-messages]"); if (scroller) scroller.scrollTop = scroller.scrollHeight;
}

function messagesMarkup() {
  if (!box.messages.length) return `<div class="inbox-empty"><p>Sem mensagens ainda. Escreva a primeira abaixo.</p></div>`;
  let lastDay = "";
  return box.messages.map((m) => {
    const created = new Date(m.created_at); if (Number.isNaN(created.getTime())) return `<div class="inbox-bubble ${m.direction === "out" ? "is-out" : "is-in"}"><p>${esc(m.body)}</p></div>`;
    const day = inboxDayFormatter.format(created);
    const sep = day !== lastDay ? `<div class="inbox-day">${esc(day)}</div>` : ""; lastDay = day;
    return `${sep}<div class="inbox-bubble ${m.direction === "out" ? "is-out" : "is-in"}"><p>${esc(m.body).replace(/\n/g, "<br>")}</p><time>${esc(inboxTimeFormatter.format(created))}${m.direction === "in" && !m.read_at ? " · nova" : ""}</time></div>`;
  }).join("");
}

function refreshRow(c) {
  const row = dashboardGrid.querySelector(`.inbox-row[data-open="${CSS.escape(String(c.id))}"]`);
  if (row) row.outerHTML = rowMarkup(c);
  dashboardGrid.querySelector(`.inbox-row[data-open="${CSS.escape(String(c.id))}"]`)?.addEventListener("click", () => openThread(c.id));
  const unread = box.conversations.reduce((n, x) => n + Number(x.unread_count || 0), 0);
  const p = dashboardGrid.querySelector(".page-intro p"); if (p) p.innerHTML = `${unread ? `<strong>${unread}</strong> ${unread === 1 ? "mensagem não lida" : "mensagens não lidas"}` : "Tudo lido"} · ${box.conversations.length} ${box.conversations.length === 1 ? "conversa" : "conversas"}`;
}

function bindThread(c) {
  const pane = dashboardGrid.querySelector("[data-thread]");
  const form = pane.querySelector("[data-composer]"), textarea = form.querySelector("textarea"), status = form.querySelector("[data-composer-status]");
  textarea.setAttribute("autocomplete", "off");
  status.setAttribute("aria-live", "polite");
  const send = async () => {
    const body = textarea.value.trim(); if (!body) { status.setAttribute("role", "alert"); status.setAttribute("aria-live", "polite"); status.classList.add("is-error"); status.textContent = "Escreva uma mensagem antes de enviar."; textarea.focus(); return; }
    const button = form.querySelector("[type=submit]"); button.disabled = true; button.setAttribute("aria-busy", "true"); textarea.disabled = true; status.setAttribute("role", "status"); status.classList.remove("is-error"); status.textContent = "Enviando…";
        try {
      const { message } = await api(`/api/conversations/${c.id}/messages`, { method: "POST", body: { body } });
      if (!pane.isConnected || location.hash !== `#${box.routeKey}` || box.selected !== c.id) return;
      box.messages.push(message); c.last_message = body; c.last_message_at = message.created_at; c.message_count = Number(c.message_count || 0) + 1;
      pane.querySelector("[data-messages]").innerHTML = messagesMarkup(); const scroller = pane.querySelector("[data-messages]"); scroller.scrollTop = scroller.scrollHeight;
      textarea.value = ""; status.textContent = c.channel === "whatsapp" ? "Enviado pelo WhatsApp." : c.channel === "email" ? "Enviado por e-mail." : "Registrado."; refreshRow(c);
    } catch (error) { status.setAttribute("role", "alert"); status.textContent = error.message || "Não foi possível enviar a mensagem. Tente novamente."; status.classList.add("is-error"); }
    finally { button.disabled = false; button.removeAttribute("aria-busy"); textarea.disabled = false; if (pane.isConnected && location.hash === `#${box.routeKey}` && box.selected === c.id) textarea.focus(); }
  };
  form.addEventListener("submit", (event) => { event.preventDefault(); send(); });
  textarea.addEventListener("keydown", (event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); send(); } });
  pane.querySelector("[data-link-contact]")?.addEventListener("click", async () => {
    const host = pane.querySelector("[data-link-form]"); host.hidden = false; host.innerHTML = `<small>Carregando contatos…</small>`;
    try {
      if (!box.contacts) box.contacts = (await api("/api/contacts")).contacts || [];
      host.innerHTML = box.contacts.length ? `<label>Vincular a um contato <select name="contact_id" autocomplete="off" aria-label="Selecionar contato">${box.contacts.map((x) => `<option value="${esc(x.id)}">${esc(x.name)}${x.phone ? ` · ${esc(x.phone)}` : ""}</option>`).join("")}</select></label><button class="button button-secondary compact-action" type="button" data-link-save>Vincular</button><button class="text-action" type="button" data-link-cancel>Cancelar</button>` : `<small>Nenhum contato cadastrado. <a href="#contatos">Criar contato →</a></small>`;
      host.querySelector("[data-link-cancel]")?.addEventListener("click", () => { host.hidden = true; });
      host.querySelector("[data-link-save]")?.addEventListener("click", async (event) => {
        const saveButton = event.currentTarget, routeAtStart = location.hash; if (saveButton.disabled) return; saveButton.disabled = true; saveButton.setAttribute("aria-busy", "true"); saveButton.textContent = "Vinculando…";
        const contactId = host.querySelector("select").value;
        try { await api(`/api/conversations/${c.id}`, { method: "PATCH", body: { contact_id: contactId } }); if (location.hash !== routeAtStart || routeAtStart !== `#${box.routeKey}` || !pane.isConnected || box.selected !== c.id) return; if (await load() === false) return; draw(); openThread(c.id, { silent: true }); }
        catch (error) { if (location.hash !== routeAtStart || !host.isConnected) return; host.insertAdjacentHTML("beforeend", `<small class="is-error" role="alert">${esc(error.message || "Não foi possível vincular o contato.")}</small>`); saveButton.disabled = false; saveButton.removeAttribute("aria-busy"); saveButton.textContent = "Vincular"; }
      });
    } catch (error) { if (location.hash === `#${box.routeKey}` && host.isConnected) host.innerHTML = `<small class="is-error" role="alert">${esc(error.message)}</small>`; }
  });
}

/* ---------------------------------------------------------------------------
   Nova conversa
   --------------------------------------------------------------------------- */

function composerMarkup() {
  return `<form class="inbox-new" data-new-form>
    <div class="section-heading"><div><p class="card-kicker">Nova conversa</p><h2>Começar uma conversa</h2></div><button class="icon-action" type="button" data-new-cancel aria-label="Fechar">×</button></div>
    <label>Canal<select name="channel">${Object.entries(CHANNEL).map(([k, [label]]) => `<option value="${k}">${label}</option>`).join("")}</select></label>
    <label data-remote hidden>Número do WhatsApp (DDI + DDD + número)<input name="remote_number" type="tel" inputmode="numeric" autocomplete="tel" placeholder="5511999990000…" /></label>
    <label>Assunto<input name="subject" type="text" autocomplete="off" placeholder="Ex.: Orçamento do site…" required /></label>
    <label>Contato<select name="contact_id" autocomplete="off"><option value="">Carregando…</option></select></label>
    <label>Cliente (opcional)<select name="client_id" autocomplete="off"><option value="">Nenhum</option></select></label>
    <label>Primeira mensagem (opcional)<textarea name="message" rows="3" placeholder="Escreva a mensagem inicial…"></textarea></label>
    <div class="inbox-composer-foot"><small data-new-status role="status" aria-live="polite"></small><button class="button button-primary compact-action" type="submit">Criar conversa</button></div>
  </form>`;
}

async function bindNewForm() {
  const form = dashboardGrid.querySelector("[data-new-form]"); if (!form) return;
  if (form.dataset.bound === "true") return;
  form.dataset.bound = "true";
  form.querySelectorAll("input, select, textarea").forEach((control) => { if (!control.getAttribute("autocomplete")) control.setAttribute("autocomplete", "off"); });
  const status = form.querySelector("[data-new-status]"), remote = form.querySelector("[data-remote]");
  form.querySelector("[data-new-cancel]").addEventListener("click", () => { box.composing = false; draw(); if (box.selected) openThread(box.selected, { silent: true }); });
  form.channel.addEventListener("change", () => { remote.hidden = form.channel.value !== "whatsapp"; });
  try {
    if (!box.contacts) box.contacts = (await api("/api/contacts")).contacts || [];
    if (!box.clients) box.clients = (await api("/api/clients")).clients || [];
    form.contact_id.innerHTML = `<option value="">Sem contato</option>${box.contacts.map((x) => `<option value="${esc(x.id)}" data-phone="${esc(x.phone || "")}">${esc(x.name)}</option>`).join("")}`;
    form.client_id.innerHTML = `<option value="">Nenhum</option>${box.clients.map((x) => `<option value="${esc(x.id)}">${esc(x.name)}</option>`).join("")}`;
    form.contact_id.addEventListener("change", () => { const phone = form.contact_id.selectedOptions[0]?.dataset.phone || ""; if (phone && !form.remote_number.value) form.remote_number.value = phone.replace(/\D/g, ""); });
  } catch (error) { status.textContent = error.message; status.setAttribute("role", "alert"); }
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const routeAtStart = location.hash, button = form.querySelector("[type=submit]"); button.disabled = true; button.setAttribute("aria-busy", "true"); status.setAttribute("role", "status"); status.classList.remove("is-error"); status.textContent = "Criando…";
    const initialMessage = form.message.value.trim();
    const payload = { subject: form.subject.value.trim(), channel: form.channel.value, contact_id: form.contact_id.value || null, client_id: form.client_id.value || null, remote_number: form.remote_number.value || undefined };
    try { const { conversation } = await api("/api/conversations", { method: "POST", body: payload }); if (initialMessage) await api(`/api/conversations/${conversation.id}/messages`, { method: "POST", body: { body: initialMessage } }); if (location.hash !== routeAtStart || routeAtStart !== `#${box.routeKey}` || !form.isConnected) return; box.composing = false; box.filter = "all"; if (await load() === false) return; box.selected = conversation.id; draw(); openThread(conversation.id, { silent: true }); }
    catch (error) { if (location.hash !== routeAtStart || !form.isConnected) return; status.textContent = error.message; status.setAttribute("role", "alert"); status.classList.add("is-error"); button.disabled = false; button.removeAttribute("aria-busy"); }
  });
}

/* ---------------------------------------------------------------------------
   Ligações
   --------------------------------------------------------------------------- */

function bind() {
  dashboardGrid.querySelectorAll('[role="tab"][data-filter]').forEach((button) => button.setAttribute("aria-selected", String(button.dataset.filter === box.filter)));
  dashboardGrid.querySelectorAll("[data-inbox-new]").forEach((b) => b.addEventListener("click", () => { box.composing = true; draw(); bindNewForm(); }));
  dashboardGrid.querySelectorAll("[data-filter]").forEach((b) => b.addEventListener("click", async () => { const previousFilter = box.filter; box.filter = b.dataset.filter; box.offset = 0; try { if (await load() === false) return; } catch (error) { box.filter = previousFilter; if (location.hash === `#${box.routeKey}`) toast(error.message, "error"); return; } draw(); if (box.selected) openThread(box.selected, { silent: true }); }));
  const search = dashboardGrid.querySelector(".inbox-search");
  search?.setAttribute("name", "search");
  search?.setAttribute("autocomplete", "off");
  search?.addEventListener("input", () => { box.query = search.value; const pos = search.selectionStart; draw(); const again = dashboardGrid.querySelector(".inbox-search"); again?.focus(); again?.setSelectionRange(pos, pos); clearTimeout(box.searchTimer); box.searchTimer = setTimeout(async () => { try { if (await load() === false) return; draw(); if (box.selected) openThread(box.selected, { silent: true }); } catch (error) { if (location.hash === `#${box.routeKey}`) toast(error.message, "error"); } }, 250); });
  dashboardGrid.querySelectorAll("[data-open]").forEach((b) => b.addEventListener("click", () => openThread(b.dataset.open)));
  if (box.composing) bindNewForm();
}

/* Contador para o sino do núcleo. */
window.FocusInbox = {
  unreadCount: async () => { const [conversations, notifications] = await Promise.all([api("/api/conversations?status=open"), api("/api/notifications/unread-count")]); return (conversations.conversations || []).reduce((n, c) => n + Number(c.unread_count || 0), 0) + Number(notifications.count || 0); },
  openNumber: async (number) => { box.filter = "whatsapp"; box.query = String(number || "").replace(/\D/g, ""); box.selected = null; await renderInbox("caixa-de-entrada"); },
};

dashboardGrid.addEventListener("click", async (event) => {
  const action = event.target.closest?.("[data-archive], [data-unread], [data-delete]");
  if (!action || !box.selected) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  const conversation = box.conversations.find((item) => String(item.id) === String(box.selected));
  if (!conversation) return;
  const routeAtStart = location.hash;
  if (action.dataset.delete !== undefined) {
    ui.confirmInline(action, {
      text: "Excluir conversa?",
      onConfirm: async () => {
        if (location.hash !== routeAtStart || action.disabled) return;
        const originalLabel = action.textContent;
        action.disabled = true;
        action.setAttribute("aria-busy", "true");
        action.textContent = "Excluindo…";
        try {
          await api(`/api/conversations/${conversation.id}`, { method: "DELETE" });
          if (location.hash !== routeAtStart || location.hash !== `#${box.routeKey}`) return;
          box.selected = null;
          await renderInbox(box.byContact ? "conversas" : "caixa-de-entrada");
        } catch (error) {
          if (location.hash === routeAtStart) throw error;
        }
      }
    });
    return;
  }
  if (action.dataset.busy === "1") return;
  action.dataset.busy = "1";
  action.disabled = true;
  action.setAttribute("aria-busy", "true");
  const originalLabel = action.textContent;
  action.textContent = action.dataset.archive !== undefined ? "Atualizando…" : "Marcando…";
  const status = dashboardGrid.querySelector("[data-composer-status]");
  try {
    const body = action.dataset.archive !== undefined
      ? { status: conversation.status === "archived" ? "open" : "archived" }
      : { unread: true };
    await api(`/api/conversations/${conversation.id}`, { method: "PATCH", body });
    if (location.hash !== routeAtStart || !action.isConnected) return;
    if (action.dataset.archive !== undefined) {
      box.selected = null;
      await renderInbox(box.byContact ? "conversas" : "caixa-de-entrada");
    } else {
      conversation.unread_count = Math.max(1, Number(conversation.unread_count || 0));
      refreshRow(conversation);
      if (status) status.textContent = "Marcada como não lida.";
      document.dispatchEvent(new Event("focus-inbox-changed"));
    }
  } catch (error) {
    if (status && location.hash === routeAtStart) { status.textContent = error.message; status.setAttribute("role", "alert"); }
  } finally {
    if (action.isConnected && location.hash === routeAtStart) {
      if (action.dataset.archive === undefined) action.textContent = originalLabel;
      action.disabled = false;
      action.removeAttribute("aria-busy");
      action.dataset.busy = "";
    }
  }
}, true);

registerRoutes({ "caixa-de-entrada": () => renderInbox("caixa-de-entrada"), conversas: () => renderInbox("conversas") });
window.addEventListener("hashchange", () => {
  if (["#caixa-de-entrada", "#conversas"].includes(location.hash)) return;
  box.loadRequest += 1;
  box.threadRequest += 1;
  clearTimeout(box.searchTimer);
  box.searchTimer = null;
});

let inboxSearchSnapshot;
dashboardGrid.addEventListener("input", (event) => {
  const input = event.target.closest?.(".inbox-search");
  if (input) inboxSearchSnapshot = { value: input.value, position: input.selectionStart };
}, true);
const inboxSearchObserver = new MutationObserver(() => {
  if (!inboxSearchSnapshot) return;
  const input = dashboardGrid.querySelector(".inbox-search");
  if (input && input.value === inboxSearchSnapshot.value) {
    input.focus();
    try { input.setSelectionRange(inboxSearchSnapshot.position, inboxSearchSnapshot.position); } catch { /* busca sem cursor em alguns navegadores */ }
  }
  inboxSearchSnapshot = null;
});
inboxSearchObserver.observe(dashboardGrid, { childList: true, subtree: true });

dashboardGrid.addEventListener("keydown", (event) => {
  const current = event.target.closest?.('[role="tab"][data-filter]');
  if (!current || !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
  const tabs = [...dashboardGrid.querySelectorAll('[role="tab"][data-filter]')];
  const index = tabs.indexOf(current);
  if (index < 0) return;
  event.preventDefault();
  const next = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : (index + (event.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length;
  tabs[next]?.focus();
});

new MutationObserver(() => {
  if (dashboardGrid.querySelector(".state-loading")) dashboardGrid.setAttribute("aria-busy", "true");
  else dashboardGrid.removeAttribute("aria-busy");
  dashboardGrid.querySelectorAll("button, a, input, textarea, select").forEach((control) => { control.style.touchAction = "manipulation"; });
  dashboardGrid.querySelectorAll("button:disabled, textarea:disabled, input:disabled, select:disabled").forEach((control) => control.setAttribute("aria-busy", "true"));
  dashboardGrid.querySelectorAll("[data-composer-status], [data-new-status]").forEach((status) => { status.setAttribute("role", status.classList.contains("is-error") ? "alert" : "status"); status.setAttribute("aria-live", "polite"); });
  const inboxList = dashboardGrid.querySelector(".inbox-list");
  if (inboxList && !inboxList.id) inboxList.id = "inbox-conversation-list";
  dashboardGrid.querySelectorAll('[role="tab"][data-filter]').forEach((tab) => tab.setAttribute("aria-controls", "inbox-conversation-list"));
  dashboardGrid.querySelectorAll(".state-error").forEach((status) => status.setAttribute("role", "alert"));
  const list = dashboardGrid.querySelector(".inbox-list");
  if (!list) return;
  let status = dashboardGrid.querySelector("[data-inbox-results]");
  if (!status) {
    status = document.createElement("p");
    status.className = "ui-filter-status";
    status.dataset.inboxResults = "true";
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    list.before(status);
  }
  const count = list.querySelectorAll("[data-open]").length;
  const label = count === 1 ? "1 conversa encontrada" : `${count} conversas encontradas`;
  if (status.textContent !== label) status.textContent = label;
}).observe(dashboardGrid, { childList: true, subtree: true, attributes: true, attributeFilter: ["disabled"] });

const conversationLeadObserver = new MutationObserver(() => {
  if (location.hash !== "#caixa-de-entrada" && location.hash !== "#conversas") return;
  const actions = dashboardGrid.querySelector("[data-thread] .inbox-thread-actions");
  if (!actions || actions.querySelector("[data-conversation-lead]")) return;
  const button = document.createElement("button"); button.type = "button"; button.className = "text-action"; button.dataset.conversationLead = box.selected; button.textContent = "Criar lead";
  button.addEventListener("click", async () => { button.disabled = true; button.textContent = "Criando…"; try { const result = await api(`/api/conversations/${box.selected}/create-lead`, { method: "POST", body: {} }); button.textContent = result.created === false ? "Lead já existe" : "Lead criado"; ui.toast(result.created === false ? "Este contato já possui um lead." : "Lead criado a partir da conversa.", "success"); } catch (error) { button.disabled = false; button.textContent = "Criar lead"; ui.toast(error.message, "error"); } });
  actions.append(button);
});
conversationLeadObserver.observe(dashboardGrid, { childList: true, subtree: true });
