/* ==========================================================================
   FocusDev — módulo "inbox"
   Telas: Caixa de entrada, Conversas
   Carregado depois de app.js; usa os helpers globais do núcleo
   (dashboardGrid, escapeHtml, openCreateDialog, api, stateBlock, registerRoutes).
   Ownership: modules/inbox.js
   ========================================================================== */

function renderInboxLegacyView() {
  const messages = [
    { sender: "Marina Lopes", subject: "Aprovacao do briefing", preview: "O cliente respondeu e pediu apenas dois ajustes no escopo.", time: "09:42", tag: "Cliente", unread: true },
    { sender: "Equipe FocusDev", subject: "Resumo da semana", preview: "Confira os principais avanços e os proximos marcos do time.", time: "Ontem", tag: "Interno", unread: false },
    { sender: "Alex Martins", subject: "Reuniao confirmada", preview: "Deixei o convite na agenda para quarta-feira as 14h.", time: "12 set", tag: "Agenda", unread: false },
    { sender: "Nexum", subject: "Documentos do projeto", preview: "Os arquivos atualizados ja estao disponiveis para revisao.", time: "10 set", tag: "Projeto", unread: false }
  ];
  dashboardGrid.innerHTML = `<section class="page-intro inbox-intro"><div><p class="card-kicker">Comunicacao</p><h2>Caixa de entrada</h2><p>Centralize conversas, atualizacoes e avisos importantes do workspace.</p></div><button class="button button-primary compact-action inbox-compose" type="button">+ Nova mensagem</button></section><section class="inbox-layout"><aside class="data-card inbox-sidebar"><div class="section-heading"><div><p class="card-kicker">Pastas</p><h2>Mensagens</h2></div><span class="task-count">1 nova</span></div><button class="inbox-folder is-active" type="button"><span>Entrada</span><b>1</b></button><button class="inbox-folder" type="button"><span>Importantes</span><b>0</b></button><button class="inbox-folder" type="button"><span>Enviadas</span><b>0</b></button><button class="inbox-folder" type="button"><span>Arquivadas</span><b>0</b></button><div class="inbox-note"><strong>Foco do dia</strong><span>Responda as mensagens que desbloqueiam o proximo passo.</span></div></aside><section class="data-card inbox-card"><div class="section-heading"><div><p class="card-kicker">Atualizacoes recentes</p><h2>Sua conversa</h2></div><button class="filter-button inbox-filter" type="button">Filtrar <span>⌄</span></button></div><div class="inbox-list">${messages.map((message) => `<article class="inbox-message ${message.unread ? "is-unread" : ""}"><span class="inbox-avatar">${message.sender.split(" ").map((part) => part[0]).join("").slice(0, 2)}</span><div class="inbox-message-body"><div><strong>${message.sender}</strong><time>${message.time}</time></div><h3>${message.subject}</h3><p>${message.preview}</p><span class="inbox-tag">${message.tag}</span></div><button class="inbox-more" type="button" aria-label="Mais opcoes">•••</button></article>`).join("")}</div></section></section>`;
  dashboardGrid.querySelectorAll(".inbox-folder").forEach((folder) => folder.addEventListener("click", () => { dashboardGrid.querySelector(".inbox-folder.is-active")?.classList.remove("is-active"); folder.classList.add("is-active"); }));
}

let inboxActiveFilter = "all";
let inboxMessages = [
  { sender: "Marina Lopes", subject: "Aprovacao do briefing", preview: "O cliente respondeu e pediu apenas dois ajustes no escopo.", time: "09:42", tag: "Cliente", unread: true, important: true },
  { sender: "Equipe FocusDev", subject: "Resumo da semana", preview: "Confira os principais avanços e os proximos marcos do time.", time: "Ontem", tag: "Interno", unread: false, important: false },
  { sender: "Alex Martins", subject: "Reuniao confirmada", preview: "Deixei o convite na agenda para quarta-feira as 14h.", time: "12 set", tag: "Agenda", unread: false, important: true },
  { sender: "Nexum", subject: "Documentos do projeto", preview: "Os arquivos atualizados ja estao disponiveis para revisao.", time: "10 set", tag: "Projeto", unread: false, important: false }
];
function renderInboxView() {
  const visible = inboxActiveFilter === "unread" ? inboxMessages.filter((message) => message.unread) : inboxActiveFilter === "important" ? inboxMessages.filter((message) => message.important) : inboxMessages;
  const rows = visible.length ? visible.map((message) => { const index = inboxMessages.indexOf(message); return `<article class="inbox-message ${message.unread ? "is-unread" : ""}" data-inbox-index="${index}"><span class="inbox-avatar">${message.sender.split(" ").map((part) => part[0]).join("").slice(0, 2)}</span><div class="inbox-message-body"><div><strong>${escapeHtml(message.sender)}</strong><time>${message.time}</time></div><h3>${escapeHtml(message.subject)}</h3><p>${escapeHtml(message.preview)}</p><span class="inbox-tag">${escapeHtml(message.tag)}</span></div><button class="inbox-more" type="button" data-inbox-read="${index}" aria-label="Marcar como lida">${message.unread ? "Nova" : "✓"}</button></article>`; }).join("") : '<p class="agenda-empty">Nenhuma mensagem nesta pasta.</p>';
  const unreadCount = inboxMessages.filter((message) => message.unread).length;
  dashboardGrid.innerHTML = `<section class="page-intro inbox-intro"><div><p class="card-kicker">Comunicacao</p><h2>Caixa de entrada</h2><p>Centralize conversas, atualizacoes e avisos importantes do workspace.</p></div><button class="button button-primary compact-action inbox-compose" type="button">+ Nova mensagem</button></section><section class="inbox-layout"><aside class="data-card inbox-sidebar"><div class="section-heading"><div><p class="card-kicker">Pastas</p><h2>Mensagens</h2></div><span class="task-count">${unreadCount} nova${unreadCount === 1 ? "" : "s"}</span></div><button class="inbox-folder ${inboxActiveFilter === "all" ? "is-active" : ""}" data-inbox-filter="all" type="button"><span>Entrada</span><b>${inboxMessages.length}</b></button><button class="inbox-folder ${inboxActiveFilter === "unread" ? "is-active" : ""}" data-inbox-filter="unread" type="button"><span>Nao lidas</span><b>${unreadCount}</b></button><button class="inbox-folder ${inboxActiveFilter === "important" ? "is-active" : ""}" data-inbox-filter="important" type="button"><span>Importantes</span><b>${inboxMessages.filter((message) => message.important).length}</b></button><div class="inbox-note"><strong>Foco do dia</strong><span>Abra uma mensagem para marcar como lida e acompanhar a conversa.</span></div></aside><section class="data-card inbox-card"><div class="section-heading"><div><p class="card-kicker">Atualizacoes recentes</p><h2>Sua conversa</h2></div><button class="filter-button inbox-filter" type="button">${inboxActiveFilter === "all" ? "Todas" : inboxActiveFilter === "unread" ? "Nao lidas" : "Importantes"}</button></div><div class="inbox-list">${rows}</div></section></section>`;
  dashboardGrid.querySelectorAll("[data-inbox-filter]").forEach((folder) => folder.addEventListener("click", () => { inboxActiveFilter = folder.dataset.inboxFilter; renderInboxView(); }));
  dashboardGrid.querySelectorAll("[data-inbox-read]").forEach((button) => button.addEventListener("click", (event) => { event.stopPropagation(); inboxMessages[Number(button.dataset.inboxRead)].unread = false; renderInboxView(); }));
  dashboardGrid.querySelectorAll("[data-inbox-index]").forEach((row) => row.addEventListener("click", () => { const message = inboxMessages[Number(row.dataset.inboxIndex)]; message.unread = false; window.alert(`${message.subject}\n\n${message.preview}`); renderInboxView(); }));
  dashboardGrid.querySelector(".inbox-compose")?.addEventListener("click", () => { const subject = window.prompt("Assunto da mensagem:"); if (!subject?.trim()) return; inboxMessages.unshift({ sender: "Gustavo", subject: subject.trim(), preview: "Rascunho criado agora. Adicione os detalhes da conversa.", time: "Agora", tag: "Rascunho", unread: false, important: false }); inboxActiveFilter = "all"; renderInboxView(); });
}


registerRoutes({
  "caixa-de-entrada": () => renderInboxView(),
  // Conversas usa a mesma base de mensagens; por enquanto reaproveita a caixa de entrada.
  "conversas": () => renderInboxView(),
});
