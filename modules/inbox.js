/* ==========================================================================
   FocusDev — módulo "inbox"
   Telas: Caixa de entrada (#caixa-de-entrada) e Conversas (#conversas —
   a mesma caixa, agrupada por contato). Dados de /api/conversations.
   Ownership: modules/inbox.js, modules/inbox.css
   ========================================================================== */

const CHANNEL = { internal: ["Interno", "💬"], email: ["E-mail", "✉"], whatsapp: ["WhatsApp", "🟢"] };
const FILTERS = [["all", "Todas"], ["unread", "Não lidas"], ["whatsapp", "WhatsApp"], ["email", "E-mail"], ["internal", "Internas"], ["archived", "Arquivadas"]];

const box = { conversations: [], filter: "all", query: "", selected: null, messages: [], composing: false, byContact: false, contacts: null, clients: null };

const esc = (v) => escapeHtml(v == null ? "" : String(v));
const nameOf = (c) => c.contact_name || c.client_name || (c.remote_number ? `+${c.remote_number}` : "") || c.subject || "Sem nome";
const initials = (text) => text.replace(/^\+/, "").trim().split(/\s+/).slice(0, 2).map((p) => p[0] || "").join("").toUpperCase() || "?";
function when(value) {
  if (!value) return "";
  const d = new Date(value), now = new Date();
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return "ontem";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

/* ---------------------------------------------------------------------------
   Carregamento
   --------------------------------------------------------------------------- */

async function load() {
  const status = box.filter === "archived" ? "archived" : "all";
  const data = await api(`/api/conversations?status=${status}`);
  box.conversations = (data.conversations || []).filter((c) => box.filter === "archived" ? c.status === "archived" : c.status !== "archived");
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
  dashboardGrid.innerHTML = `<section class="page-intro"><div><p class="card-kicker">Comunicação</p><h2>${box.byContact ? "Conversas" : "Caixa de entrada"}</h2><p>Carregando…</p></div></section>${stateBlock.loading("Carregando conversas…")}`;
  try { await load(); }
  catch (error) { dashboardGrid.innerHTML = `<section class="page-intro"><div><p class="card-kicker">Comunicação</p><h2>Caixa de entrada</h2></div></section>${stateBlock.error(error.message, "inbox-retry")}`; dashboardGrid.querySelector(".inbox-retry")?.addEventListener("click", () => renderInbox(routeKey)); return; }
  if (box.selected && !box.conversations.some((c) => String(c.id) === String(box.selected))) box.selected = null;
  draw();
  if (box.selected) openThread(box.selected, { silent: true });
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
        <div class="inbox-filters" role="tablist">${FILTERS.map(([k, label]) => `<button class="filter-button ${box.filter === k ? "is-active" : ""}" type="button" role="tab" data-filter="${k}">${label}${k === "unread" && unread ? ` <b>${unread}</b>` : ""}</button>`).join("")}</div>
        <input class="inbox-search" type="search" placeholder="Buscar por nome, assunto ou mensagem…" value="${esc(box.query)}" aria-label="Buscar conversa" />
        <div class="inbox-list">${list.length ? list.map(rowMarkup).join("") : `<div class="inbox-empty"><p>${box.conversations.length ? "Nenhuma conversa com esse filtro." : "Nenhuma conversa ainda."}</p>${box.conversations.length ? "" : `<button class="text-action" type="button" data-inbox-new>Iniciar a primeira →</button>`}</div>`}</div>
      </aside>
      <section class="data-card inbox-thread" data-thread>${box.composing ? composerMarkup() : box.selected ? "" : `<div class="inbox-placeholder"><span class="inbox-placeholder-icon">✉</span><h3>Selecione uma conversa</h3><p>Mensagens do WhatsApp conectado, e-mails registrados e notas internas ficam aqui, com resposta direto pelo canal certo.</p></div>`}</section>
    </section>`;
  bind();
}

function rowMarkup(c) {
  const [channelLabel, icon] = CHANNEL[c.channel] || CHANNEL.internal;
  const unread = Number(c.unread_count || 0);
  return `<button class="inbox-row ${String(c.id) === String(box.selected) ? "is-selected" : ""} ${unread ? "is-unread" : ""}" type="button" data-open="${esc(c.id)}">
    <span class="inbox-avatar inbox-avatar-${esc(c.channel)}">${esc(initials(nameOf(c)))}</span>
    <span class="inbox-row-main"><span class="inbox-row-top"><strong>${esc(nameOf(c))}</strong><time>${esc(when(c.last_message_at || c.created_at))}</time></span><span class="inbox-row-subject">${esc(c.subject)}</span><span class="inbox-row-preview">${esc(c.last_message || "Sem mensagens")}</span></span>
    <span class="inbox-row-side"><span class="inbox-channel" title="${channelLabel}">${icon}</span>${unread ? `<b class="inbox-unread">${unread}</b>` : ""}</span>
  </button>`;
}

/* ---------------------------------------------------------------------------
   Thread
   --------------------------------------------------------------------------- */

async function openThread(id, { silent = false } = {}) {
  box.selected = id; box.composing = false;
  const c = box.conversations.find((x) => String(x.id) === String(id));
  const pane = dashboardGrid.querySelector("[data-thread]");
  if (!c || !pane) return;
  dashboardGrid.querySelectorAll(".inbox-row").forEach((r) => r.classList.toggle("is-selected", r.dataset.open === String(id)));
  pane.innerHTML = stateBlock.loading("Abrindo conversa…");
  try { box.messages = (await api(`/api/conversations/${id}/messages`)).messages || []; }
  catch (error) { pane.innerHTML = stateBlock.error(error.message, "inbox-thread-retry"); pane.querySelector(".inbox-thread-retry")?.addEventListener("click", () => openThread(id)); return; }
  if (Number(c.unread_count) && !silent) { api(`/api/conversations/${id}`, { method: "PATCH", body: { read: true } }).then(() => { c.unread_count = 0; document.dispatchEvent(new Event("focus-inbox-changed")); refreshRow(c); }).catch(() => {}); }
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
      <div class="inbox-composer-foot"><small data-composer-status>${c.channel === "whatsapp" ? "A resposta é enviada pelo número conectado." : c.channel === "email" ? "Registro interno; o envio de e-mail ainda não está automatizado." : "Visível só para a equipe."}</small><button class="button button-primary compact-action" type="submit" ${canReply ? "" : "disabled"}>Enviar</button></div>
    </form>`;
  bindThread(c);
  const scroller = pane.querySelector("[data-messages]"); if (scroller) scroller.scrollTop = scroller.scrollHeight;
}

function messagesMarkup() {
  if (!box.messages.length) return `<div class="inbox-empty"><p>Sem mensagens ainda. Escreva a primeira abaixo.</p></div>`;
  let lastDay = "";
  return box.messages.map((m) => {
    const day = new Date(m.created_at).toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
    const sep = day !== lastDay ? `<div class="inbox-day">${esc(day)}</div>` : ""; lastDay = day;
    return `${sep}<div class="inbox-bubble ${m.direction === "out" ? "is-out" : "is-in"}"><p>${esc(m.body).replace(/\n/g, "<br>")}</p><time>${esc(new Date(m.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }))}${m.direction === "in" && !m.read_at ? " · nova" : ""}</time></div>`;
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
  const send = async () => {
    const body = textarea.value.trim(); if (!body) return;
    const button = form.querySelector("[type=submit]"); button.disabled = true; textarea.disabled = true; status.textContent = "Enviando…";
    try {
      const { message } = await api(`/api/conversations/${c.id}/messages`, { method: "POST", body: { body } });
      box.messages.push(message); c.last_message = body; c.last_message_at = message.created_at; c.message_count = Number(c.message_count || 0) + 1;
      pane.querySelector("[data-messages]").innerHTML = messagesMarkup(); const scroller = pane.querySelector("[data-messages]"); scroller.scrollTop = scroller.scrollHeight;
      textarea.value = ""; status.textContent = c.channel === "whatsapp" ? "Enviado pelo WhatsApp." : "Registrado."; refreshRow(c);
    } catch (error) { status.textContent = error.message; status.classList.add("is-error"); }
    finally { button.disabled = false; textarea.disabled = false; textarea.focus(); }
  };
  form.addEventListener("submit", (event) => { event.preventDefault(); send(); });
  textarea.addEventListener("keydown", (event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); send(); } });

  pane.querySelector("[data-archive]")?.addEventListener("click", async () => {
    try { await api(`/api/conversations/${c.id}`, { method: "PATCH", body: { status: c.status === "archived" ? "open" : "archived" } }); box.selected = null; await renderInbox(box.byContact ? "conversas" : "caixa-de-entrada"); }
    catch (error) { status.textContent = error.message; }
  });
  pane.querySelector("[data-unread]")?.addEventListener("click", async () => {
    try { await api(`/api/conversations/${c.id}`, { method: "PATCH", body: { unread: true } }); c.unread_count = Math.max(1, Number(c.unread_count || 0)); refreshRow(c); document.dispatchEvent(new Event("focus-inbox-changed")); status.textContent = "Marcada como não lida."; }
    catch (error) { status.textContent = error.message; }
  });
  pane.querySelector("[data-delete]")?.addEventListener("click", (event) => {
    const b = event.currentTarget;
    if (b.dataset.confirm !== "1") { b.dataset.confirm = "1"; b.textContent = "Confirmar exclusão"; return; }
    api(`/api/conversations/${c.id}`, { method: "DELETE" }).then(() => { box.selected = null; return renderInbox(box.byContact ? "conversas" : "caixa-de-entrada"); }).catch((error) => { status.textContent = error.message; });
  });
  pane.querySelector("[data-link-contact]")?.addEventListener("click", async () => {
    const host = pane.querySelector("[data-link-form]"); host.hidden = false; host.innerHTML = `<small>Carregando contatos…</small>`;
    try {
      if (!box.contacts) box.contacts = (await api("/api/contacts")).contacts || [];
      host.innerHTML = box.contacts.length ? `<label>Vincular a um contato <select>${box.contacts.map((x) => `<option value="${esc(x.id)}">${esc(x.name)}${x.phone ? ` · ${esc(x.phone)}` : ""}</option>`).join("")}</select></label><button class="button button-secondary compact-action" type="button" data-link-save>Vincular</button><button class="text-action" type="button" data-link-cancel>Cancelar</button>` : `<small>Nenhum contato cadastrado. <a href="#contatos">Criar contato →</a></small>`;
      host.querySelector("[data-link-cancel]")?.addEventListener("click", () => { host.hidden = true; });
      host.querySelector("[data-link-save]")?.addEventListener("click", async () => {
        const contactId = host.querySelector("select").value;
        try { await api(`/api/conversations/${c.id}`, { method: "PATCH", body: { contact_id: contactId } }); await load(); draw(); openThread(c.id, { silent: true }); }
        catch (error) { host.insertAdjacentHTML("beforeend", `<small class="is-error">${esc(error.message)}</small>`); }
      });
    } catch (error) { host.innerHTML = `<small class="is-error">${esc(error.message)}</small>`; }
  });
}

/* ---------------------------------------------------------------------------
   Nova conversa
   --------------------------------------------------------------------------- */

function composerMarkup() {
  return `<form class="inbox-new" data-new-form>
    <div class="section-heading"><div><p class="card-kicker">Nova conversa</p><h2>Começar uma conversa</h2></div><button class="icon-action" type="button" data-new-cancel aria-label="Fechar">×</button></div>
    <label>Canal<select name="channel">${Object.entries(CHANNEL).map(([k, [label]]) => `<option value="${k}">${label}</option>`).join("")}</select></label>
    <label data-remote hidden>Número do WhatsApp (DDI + DDD + número)<input name="remote_number" type="tel" inputmode="numeric" placeholder="5511999990000" /></label>
    <label>Assunto<input name="subject" type="text" placeholder="Ex.: Orçamento do site" required /></label>
    <label>Contato<select name="contact_id"><option value="">Carregando…</option></select></label>
    <label>Cliente (opcional)<select name="client_id"><option value="">Nenhum</option></select></label>
    <label>Primeira mensagem (opcional)<textarea name="message" rows="3" placeholder="Escreva a mensagem inicial…"></textarea></label>
    <div class="inbox-composer-foot"><small data-new-status></small><button class="button button-primary compact-action" type="submit">Criar conversa</button></div>
  </form>`;
}

async function bindNewForm() {
  const form = dashboardGrid.querySelector("[data-new-form]"); if (!form) return;
  const status = form.querySelector("[data-new-status]"), remote = form.querySelector("[data-remote]");
  form.querySelector("[data-new-cancel]").addEventListener("click", () => { box.composing = false; draw(); if (box.selected) openThread(box.selected, { silent: true }); });
  form.channel.addEventListener("change", () => { remote.hidden = form.channel.value !== "whatsapp"; });
  try {
    if (!box.contacts) box.contacts = (await api("/api/contacts")).contacts || [];
    if (!box.clients) box.clients = (await api("/api/clients")).clients || [];
    form.contact_id.innerHTML = `<option value="">Sem contato</option>${box.contacts.map((x) => `<option value="${esc(x.id)}" data-phone="${esc(x.phone || "")}">${esc(x.name)}</option>`).join("")}`;
    form.client_id.innerHTML = `<option value="">Nenhum</option>${box.clients.map((x) => `<option value="${esc(x.id)}">${esc(x.name)}</option>`).join("")}`;
    form.contact_id.addEventListener("change", () => { const phone = form.contact_id.selectedOptions[0]?.dataset.phone || ""; if (phone && !form.remote_number.value) form.remote_number.value = phone.replace(/\D/g, ""); });
  } catch (error) { status.textContent = error.message; }
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = form.querySelector("[type=submit]"); button.disabled = true; status.textContent = "Criando…";
    const payload = { subject: form.subject.value.trim(), channel: form.channel.value, contact_id: form.contact_id.value || null, client_id: form.client_id.value || null, message: form.message.value.trim() || undefined, remote_number: form.remote_number.value || undefined };
    try { const { conversation } = await api("/api/conversations", { method: "POST", body: payload }); box.composing = false; box.filter = "all"; await load(); box.selected = conversation.id; draw(); openThread(conversation.id, { silent: true }); }
    catch (error) { status.textContent = error.message; status.classList.add("is-error"); button.disabled = false; }
  });
}

/* ---------------------------------------------------------------------------
   Ligações
   --------------------------------------------------------------------------- */

function bind() {
  dashboardGrid.querySelectorAll("[data-inbox-new]").forEach((b) => b.addEventListener("click", () => { box.composing = true; draw(); bindNewForm(); }));
  dashboardGrid.querySelectorAll("[data-filter]").forEach((b) => b.addEventListener("click", async () => { box.filter = b.dataset.filter; try { await load(); } catch (error) { dashboardGrid.querySelector(".page-intro p").textContent = error.message; } draw(); if (box.selected) openThread(box.selected, { silent: true }); }));
  const search = dashboardGrid.querySelector(".inbox-search");
  search?.addEventListener("input", () => { box.query = search.value; const pos = search.selectionStart; draw(); const again = dashboardGrid.querySelector(".inbox-search"); again?.focus(); again?.setSelectionRange(pos, pos); if (box.selected) openThread(box.selected, { silent: true }); });
  dashboardGrid.querySelectorAll("[data-open]").forEach((b) => b.addEventListener("click", () => openThread(b.dataset.open)));
  if (box.composing) bindNewForm();
}

/* Contador para o sino do núcleo. */
window.FocusInbox = {
  unreadCount: async () => { const data = await api("/api/conversations?status=open"); return (data.conversations || []).reduce((n, c) => n + Number(c.unread_count || 0), 0); },
  openNumber: async (number) => { box.filter = "whatsapp"; box.query = String(number || "").replace(/\D/g, ""); box.selected = null; await renderInbox("caixa-de-entrada"); },
};

registerRoutes({ "caixa-de-entrada": () => renderInbox("caixa-de-entrada"), conversas: () => renderInbox("conversas") });
