const ticketEsc = (value) => escapeHtml(value ?? "");
const toast = (...args) => { if (location.hash === "#tickets") ui.toast(...args); };
const ticketLabels = { new: "Novo", open: "Aberto", in_analysis: "Em análise", in_progress: "Em atendimento", waiting_client: "Aguardando cliente", waiting_third_party: "Aguardando terceiro", resolved: "Resolvido", closed: "Fechado", reopened: "Reaberto", cancelled: "Cancelado" };
const ticketPriorities = { low: "Baixa", medium: "Média", high: "Alta", urgent: "Urgente" };
const ticketFilter = { search: "", status: "", priority: "", request: 0 };
function ticketKpis(items) { const count = (statuses) => items.filter((item) => statuses.includes(item.status)).length; return ui.stats([{ label: "Em aberto", value: ui.number(count(["new", "open", "reopened"])), tone: "orange" }, { label: "Em andamento", value: ui.number(count(["in_analysis", "in_progress", "waiting_client", "waiting_third_party"])), tone: "blue" }, { label: "Resolvidos", value: ui.number(count(["resolved"])), tone: "green" }, { label: "Total", value: ui.number(items.length) }]); }
function ticketDetails(item) { if (!item) return; const value = (entry) => entry === null || entry === undefined || entry === "" ? "—" : typeof entry === "object" ? JSON.stringify(entry) : String(entry); const labelsByField = { title: "Título", description: "Descrição", status: "Status", priority: "Prioridade", client_name: "Cliente", project_name: "Projeto", due_at: "Prazo", created_at: "Criado em", updated_at: "Atualizado em", requester: "Solicitante", category: "Categoria", source_channel: "Canal de origem", first_response_at: "Primeira resposta em", resolved_at: "Resolvido em", paused_minutes: "Minutos pausados" }; const hiddenFields = ["id", "organization_id", "client_id", "contract_id", "project_id", "assignee_id"]; const pairs = Object.entries(item).filter(([key]) => !hiddenFields.includes(key) && labelsByField[key]).map(([key, entry]) => [labelsByField[key], key === "status" ? ticketLabels[entry] || entry : key === "priority" ? ticketPriorities[entry] || entry : value(entry)]); ui.drawer({ title: item.title || "Ticket", subtitle: `${ticketLabels[item.status] || item.status || "Sem status"} · ${ticketPriorities[item.priority] || item.priority || "Sem prioridade"}`, html: ui.facts(pairs) }); }

async function renderTicketsScreen() {
  if (location.hash !== "#tickets") return;
  const request = ticketFilter.request = (ticketFilter.request || 0) + 1;
  const title = "Tickets", description = "Suporte, manutenção e solicitações com prioridade e status rastreáveis.";
  dashboardGrid.setAttribute("aria-busy", "true");
  dashboardGrid.innerHTML = `<section class="page-intro"><div><p class="card-kicker">Operação</p><h2>${title}</h2><p>${description}</p></div><button class="button button-primary compact-action" data-ticket-new type="button">+ Novo ticket</button></section>${stateBlock.loading("Carregando tickets…")}`;
  try {
    const params = new URLSearchParams(); if (ticketFilter.search) params.set("search", ticketFilter.search); if (ticketFilter.status) params.set("status", ticketFilter.status); if (ticketFilter.priority) params.set("priority", ticketFilter.priority);
    const items = (await api(`/api/tickets?${params}`)).tickets || [];
    if (request !== ticketFilter.request || location.hash !== "#tickets") return;
    createConfig.ticket.fields.find((field) => field.name === "status").options = Object.entries(ticketLabels);
    dashboardGrid.innerHTML = `<section class="page-intro"><div><p class="card-kicker">Operação</p><h2>${title}</h2><p>${description}</p></div><button class="button button-primary compact-action" data-ticket-new type="button">+ Novo ticket</button></section><section class="finance-toolbar"><input type="search" data-ticket-search value="${ticketEsc(ticketFilter.search)}" placeholder="Buscar título, cliente ou projeto…" aria-label="Buscar ticket"><select data-ticket-filter aria-label="Filtrar status"><option value="">Todos os status</option>${Object.entries(ticketLabels).map(([key, label]) => `<option value="${key}">${label}</option>`).join("")}</select><select data-ticket-priority aria-label="Filtrar prioridade"><option value="">Todas as prioridades</option>${Object.entries(ticketPriorities).map(([key, label]) => `<option value="${key}">${label}</option>`).join("")}</select></section><section class="operations-kanban">${Object.entries(ticketLabels).map(([status, label]) => `<div class="data-card operations-column" data-ticket-column="${status}"><h3>${label} <small>${items.filter((item) => item.status === status).length}</small></h3>${items.filter((item) => item.status === status).map((item) => `<article draggable="true" class="operations-ticket" data-ticket-row><strong>${ticketEsc(item.title || "Sem título")}</strong><small>${ticketEsc(item.client_name || "Sem cliente")}${item.project_name ? ` · ${ticketEsc(item.project_name)}` : ""}</small><span class="operations-priority priority-${ticketEsc(item.priority)}">${ticketPriorities[item.priority] || ticketEsc(item.priority || "Média")}</span><div><button class="compact-action" data-ticket-edit="${ticketEsc(item.id)}" type="button">Editar</button><button class="compact-action" data-ticket-delete="${ticketEsc(item.id)}" type="button">Excluir</button></div></article>`).join("")}</div>`).join("")}</section>`;
    dashboardGrid.removeAttribute("aria-busy");
    const search = dashboardGrid.querySelector("[data-ticket-search]"), status = dashboardGrid.querySelector("[data-ticket-filter]"), priority = dashboardGrid.querySelector("[data-ticket-priority]"); status.value = ticketFilter.status; priority.value = ticketFilter.priority; search?.setAttribute("name", "ticket_search"); search?.setAttribute("autocomplete", "off"); status?.setAttribute("name", "status"); status?.setAttribute("autocomplete", "off"); priority?.setAttribute("name", "priority"); priority?.setAttribute("autocomplete", "off"); let timer;
    search?.addEventListener("input", () => { clearTimeout(timer); ticketFilter.search = search.value.trim(); timer = setTimeout(renderTicketsScreen, 250); }); status?.addEventListener("change", () => { ticketFilter.status = status.value; renderTicketsScreen(); }); priority?.addEventListener("change", () => { ticketFilter.priority = priority.value; renderTicketsScreen(); });
    dashboardGrid.querySelector(".page-intro")?.insertAdjacentHTML("afterend", ticketKpis(items)); dashboardGrid.querySelector("[data-ticket-new]")?.addEventListener("click", () => openCreateDialog("ticket"));
    dashboardGrid.querySelectorAll("[data-ticket-row]").forEach((card) => { const item = items.find((entry) => String(entry.id) === String(card.querySelector("[data-ticket-edit]")?.dataset.ticketEdit)); const details = document.createElement("button"); details.type = "button"; details.className = "compact-action"; details.textContent = "Detalhes"; details.addEventListener("click", () => ticketDetails(item)); const move = document.createElement("button"); move.type = "button"; move.className = "compact-action"; move.textContent = "Mover"; move.setAttribute("aria-label", `Mover ticket ${item?.title || "sem título"}`); move.addEventListener("click", () => ui.form({ title: "Mover ticket", subtitle: item?.title || "Ticket", values: { status: item?.status || "new" }, fields: [{ name: "status", label: "Novo status", type: "select", options: Object.entries(ticketLabels) }], submitLabel: "Atualizar status", onSubmit: async (values) => { if (!item || values.status === item.status) return; await api(`/api/tickets/${item.id}`, { method: "PATCH", body: { status: values.status } }); toast("Status atualizado.", "success"); renderTicketsScreen(); } })); card.querySelector("div")?.prepend(details, move); });
    dashboardGrid.querySelectorAll("[data-ticket-edit]").forEach((button) => button.addEventListener("click", () => { const item = items.find((entry) => String(entry.id) === String(button.dataset.ticketEdit)); if (item) openEditDialog("ticket", item, `/api/tickets/${item.id}`); }));
    dashboardGrid.querySelectorAll("[data-ticket-delete]").forEach((button) => button.addEventListener("click", () => ui.confirmInline(button, { text: "Excluir ticket?", onConfirm: async () => { const originalLabel = button.textContent; button.disabled = true; button.setAttribute("aria-busy", "true"); button.textContent = "Excluindo…"; try { await api(`/api/tickets/${button.dataset.ticketDelete}`, { method: "DELETE" }); toast("Ticket excluído.", "success"); renderTicketsScreen(); } catch (error) { button.disabled = false; button.removeAttribute("aria-busy"); button.textContent = originalLabel; toast(error.message, "error"); } } })));
    dashboardGrid.querySelectorAll("[data-ticket-row]").forEach((card) => card.addEventListener("dragstart", (event) => { card.classList.add("is-dragging"); event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", card.querySelector("[data-ticket-edit]")?.dataset.ticketEdit || ""); }));
    dashboardGrid.querySelectorAll("[data-ticket-row]").forEach((card) => card.addEventListener("dragend", () => card.classList.remove("is-dragging")));
    dashboardGrid.querySelectorAll("[data-ticket-column]").forEach((column) => { column.addEventListener("dragover", (event) => { event.preventDefault(); column.classList.add("is-drop-target"); }); column.addEventListener("dragleave", () => column.classList.remove("is-drop-target")); });
  } catch (error) { if (request !== ticketFilter.request || location.hash !== "#tickets") return; dashboardGrid.removeAttribute("aria-busy"); dashboardGrid.innerHTML = `<section class="page-intro"><div><p class="card-kicker">Operação</p><h2>${title}</h2></div></section>${stateBlock.error(error.message, "ticket-retry")}`; dashboardGrid.querySelector(".ticket-retry")?.addEventListener("click", renderTicketsScreen); }
}

dashboardGrid.addEventListener("drop", async (event) => {
  const column = event.target.closest?.("[data-ticket-column]");
  if (!column || location.hash !== "#tickets") return;
  event.preventDefault();
  event.stopImmediatePropagation();
  if (column.dataset.busy === "1" || dashboardGrid.dataset.ticketDropBusy === "1") return;
  const id = event.dataTransfer?.getData("text/plain");
  if (!id) return;
  const routeAtStart = location.hash;
  const requestAtStart = ticketFilter.request;
  const source = dashboardGrid.querySelector(".is-dragging")?.closest("[data-ticket-column]");
  if (source === column) return;
  column.dataset.busy = "1";
  dashboardGrid.dataset.ticketDropBusy = "1";
  column.setAttribute("aria-busy", "true");
  try {
    await api(`/api/tickets/${id}`, { method: "PATCH", body: { status: column.dataset.ticketColumn } });
    if (location.hash !== routeAtStart || requestAtStart !== ticketFilter.request || !column.isConnected) return;
    toast("Status atualizado.", "success");
    renderTicketsScreen();
  } catch (error) {
    if (location.hash === "#tickets") toast(error.message, "error");
  } finally {
    column.dataset.busy = "";
    dashboardGrid.dataset.ticketDropBusy = "";
    column.removeAttribute("aria-busy");
  }
}, true);

dashboardGrid.addEventListener("click", (event) => {
  const deleteButton = event.target.closest?.("[data-ticket-delete]");
  const moveButton = event.target.closest?.("[data-ticket-row] button");
  if (deleteButton && location.hash === "#tickets") {
    event.preventDefault();
    event.stopImmediatePropagation();
    if (deleteButton.dataset.ticketActionGuarded === "1") return;
    deleteButton.dataset.ticketActionGuarded = "1";
    const routeAtStart = location.hash;
    const requestAtStart = ticketFilter.request;
    ui.confirmInline(deleteButton, {
      text: "Excluir ticket?",
      onConfirm: async () => {
        const originalLabel = deleteButton.textContent;
        deleteButton.disabled = true;
        deleteButton.setAttribute("aria-busy", "true");
        deleteButton.textContent = "Excluindo…";
        try {
          await api(`/api/tickets/${deleteButton.dataset.ticketDelete}`, { method: "DELETE" });
          if (location.hash !== routeAtStart || routeAtStart !== "#tickets" || requestAtStart !== ticketFilter.request) return;
          toast("Ticket excluído.", "success");
          renderTicketsScreen();
        } catch (error) {
          if (location.hash !== routeAtStart) return;
          throw error;
        } finally {
          delete deleteButton.dataset.ticketActionGuarded;
        }
      },
      onCancel: () => { delete deleteButton.dataset.ticketActionGuarded; },
    });
    return;
  }
  if (!moveButton || moveButton.textContent.trim() !== "Mover" || location.hash !== "#tickets") return;
  event.preventDefault();
  event.stopImmediatePropagation();
  const itemId = moveButton.closest("[data-ticket-row]")?.querySelector("[data-ticket-edit]")?.dataset.ticketEdit;
  const routeAtStart = location.hash;
  const requestAtStart = ticketFilter.request;
  const currentItem = itemId ? { id: itemId } : null;
  const source = [...dashboardGrid.querySelectorAll("[data-ticket-row]")].find((card) => card.querySelector("[data-ticket-edit]")?.dataset.ticketEdit === itemId);
  const status = source?.closest("[data-ticket-column]")?.dataset.ticketColumn || "new";
  if (!currentItem) return;
  ui.form({ title: "Mover ticket", subtitle: source?.querySelector("strong")?.textContent || "Ticket", values: { status }, fields: [{ name: "status", label: "Novo status", type: "select", options: Object.entries(ticketLabels) }], submitLabel: "Atualizar status", onSubmit: async (values) => { if (values.status === status) return; await api(`/api/tickets/${currentItem.id}`, { method: "PATCH", body: { status: values.status } }); if (location.hash !== routeAtStart || routeAtStart !== "#tickets" || requestAtStart !== ticketFilter.request) return; toast("Status atualizado.", "success"); renderTicketsScreen(); } });
}, true);

registerRoutes({ tickets: renderTicketsScreen });

/* Um ticket pode virar tarefa interna sem copiar manualmente o atendimento. */
const ticketTaskObserver = new MutationObserver(() => {
  if (location.hash !== "#tickets") return;
  dashboardGrid.querySelectorAll("[data-ticket-row]").forEach((card) => {
    const actions = card.querySelector("div");
    const id = card.querySelector("[data-ticket-edit]")?.dataset.ticketEdit;
    if (!actions || !id || actions.querySelector("[data-ticket-task]")) return;
    const button = document.createElement("button");
    button.type = "button"; button.className = "compact-action"; button.dataset.ticketTask = id; button.textContent = "Criar tarefa";
    button.addEventListener("click", async () => {
      button.disabled = true; button.textContent = "Criando…";
      try { const result = await api(`/api/tickets/${id}/create-task`, { method: "POST", body: {} }); toast(result.created === false ? "A tarefa deste ticket já existe." : "Tarefa interna criada.", "success"); button.textContent = "Tarefa criada"; }
      catch (error) { button.disabled = false; button.textContent = "Criar tarefa"; toast(error.message, "error"); }
    });
    actions.append(button);
  });
});
ticketTaskObserver.observe(dashboardGrid, { childList: true, subtree: true });

dashboardGrid.addEventListener("dragstart", (event) => {
  const card = event.target.closest?.("[data-ticket-row]");
  if (!card) return;
  card.setAttribute("aria-grabbed", "true");
  card.setAttribute("inert", "");
}, true);
dashboardGrid.addEventListener("dragend", (event) => {
  const card = event.target.closest?.("[data-ticket-row]");
  if (!card) return;
  card.removeAttribute("aria-grabbed");
  card.removeAttribute("inert");
}, true);

let ticketSearchSnapshot = null;
dashboardGrid.addEventListener("input", (event) => {
  const input = event.target.closest?.("[data-ticket-search]");
  if (!input) return;
  ticketSearchSnapshot = { value: input.value, position: input.selectionStart ?? input.value.length };
});
const ticketSearchObserver = new MutationObserver(() => {
  if (!ticketSearchSnapshot) return;
  const input = dashboardGrid.querySelector("[data-ticket-search]");
  if (!input || input.value !== ticketSearchSnapshot.value) return;
  input.focus();
  try { input.setSelectionRange(ticketSearchSnapshot.position, ticketSearchSnapshot.position); } catch { /* cursor indisponível */ }
  ticketSearchSnapshot = null;
});
ticketSearchObserver.observe(dashboardGrid, { childList: true, subtree: true });

const ticketUiObserver = new MutationObserver(() => {
  const board = dashboardGrid.querySelector(".operations-kanban");
  if (!board) return;
  const search = dashboardGrid.querySelector("[data-ticket-search]");
  if (search) search.placeholder = "Buscar título, cliente ou projeto…";
  board.setAttribute("aria-label", "Quadro de tickets por status");
  dashboardGrid.querySelectorAll("button, input, select").forEach((control) => { control.style.touchAction = "manipulation"; });
  board.querySelectorAll("[data-ticket-row]").forEach((card) => {
    const title = card.querySelector("strong")?.textContent?.trim();
    if (title && !card.getAttribute("aria-label")) card.setAttribute("aria-label", `Ticket: ${title}`);
  });
  board.querySelectorAll("[data-ticket-column]").forEach((column) => {
    column.setAttribute("role", "region");
    const heading = column.querySelector("h3");
    if (heading && !column.getAttribute("aria-label")) column.setAttribute("aria-label", `Tickets ${heading.textContent.trim()}`);
  });
  board.querySelectorAll(".operations-priority").forEach((priority) => { priority.setAttribute("role", "status"); priority.setAttribute("aria-live", "polite"); });
  let status = dashboardGrid.querySelector("[data-ticket-results]");
  const toolbar = dashboardGrid.querySelector(".finance-toolbar");
  if (toolbar && !status) {
    status = document.createElement("p");
    status.className = "ui-filter-status";
    status.dataset.ticketResults = "true";
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    toolbar.insertAdjacentElement("afterend", status);
  }
  if (status) {
    const cards = dashboardGrid.querySelectorAll("[data-ticket-row]").length;
    const label = `${ui.number(cards)} ${cards === 1 ? "ticket encontrado" : "tickets encontrados"}.`;
    if (status.textContent !== label) status.textContent = label;
  }
  dashboardGrid.querySelectorAll("[data-ticket-delete], [data-ticket-edit], [data-ticket-new]").forEach((button) => {
    if (button.disabled) button.setAttribute("aria-busy", "true");
    else button.removeAttribute("aria-busy");
  });
});
ticketUiObserver.observe(dashboardGrid, { childList: true, subtree: true, attributes: true, attributeFilter: ["disabled"] });

const ticketInteractionObserver = new MutationObserver(() => {
  dashboardGrid.querySelectorAll("[data-ticket-row]").forEach((card) => {
    card.setAttribute("tabindex", "0");
    const title = card.querySelector("strong")?.textContent?.trim();
    if (title) card.setAttribute("aria-label", `Ticket: ${title}`);
  });
  dashboardGrid.querySelectorAll("[data-ticket-column]").forEach((column) => {
    if (column.querySelector("[data-ticket-row], .operations-column-empty")) return;
    const empty = document.createElement("p");
    empty.className = "operations-column-empty";
    empty.textContent = "Nenhum ticket neste status.";
    column.append(empty);
  });
});
ticketInteractionObserver.observe(dashboardGrid, { childList: true, subtree: true });

dashboardGrid.addEventListener("keydown", (event) => {
  const card = event.target.closest?.("[data-ticket-row]");
  if (!card || event.target !== card || !["Enter", " "].includes(event.key)) return;
  event.preventDefault();
  card.querySelector("[data-ticket-edit]")?.click();
});
