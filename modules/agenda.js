/* ==========================================================================
   FocusDev — módulo "agenda"
   Tela: Agenda (mês / semana / dia), eventos reais de /api/events.
   Ownership: modules/agenda.js, modules/agenda.css
   ========================================================================== */

const WEEKDAYS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const RECURRENCE = { none: "", daily: "Diário", weekly: "Semanal", monthly: "Mensal", yearly: "Todo ano" };
const HOURS = Array.from({ length: 15 }, (_, i) => i + 7); // 07h–21h na visão semana/dia

const view = { mode: localStorage.getItem("focusdev_agenda_mode") || "month", cursor: new Date(), selected: new Date(), query: "", eventType: "", status: "", events: [], loading: false };

const esc = (v) => escapeHtml(v == null ? "" : String(v));
const sameDay = (a, b) => new Date(a).toDateString() === new Date(b).toDateString();
const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const startOfWeek = (d) => addDays(startOfDay(d), -new Date(d).getDay());
const timeOf = (v) => new Date(v).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
const longDate = (d) => new Date(d).toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
const monthTitle = (d) => new Date(d).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
const toLocalInput = (d) => { const x = new Date(d); x.setMinutes(x.getMinutes() - x.getTimezoneOffset()); return x.toISOString().slice(0, 16); };
const eventId = (e) => e.source_id || e.id;
const isRecurring = (e) => e.recurrence && e.recurrence !== "none";

function eventsOn(day) {
  const q = view.query.trim().toLocaleLowerCase("pt-BR");
  return view.events.filter((e) => sameDay(e.starts_at, day) && (!q || `${e.title} ${e.description || ""}`.toLocaleLowerCase("pt-BR").includes(q))).sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at));
}

/* ---------------------------------------------------------------------------
   Carregamento e render
   --------------------------------------------------------------------------- */

async function renderAgenda() {
  if (!view.loading) {
    view.loading = true;
    dashboardGrid.innerHTML = `<section class="page-intro"><div><p class="card-kicker">Meu dia</p><h2>Agenda</h2><p>Compromissos, reuniões e lembretes do workspace.</p></div></section>${stateBlock.loading("Carregando agenda…")}`;
    try { const params = new URLSearchParams(); if (view.eventType) params.set("event_type", view.eventType); if (view.status) params.set("status", view.status); view.events = (await api(`/api/events?${params}`)).events || []; }
    catch (error) { view.loading = false; dashboardGrid.innerHTML = `<section class="page-intro"><div><p class="card-kicker">Meu dia</p><h2>Agenda</h2></div></section>${stateBlock.error(error.message, "agenda-retry")}`; dashboardGrid.querySelector(".agenda-retry")?.addEventListener("click", renderAgenda); return; }
    view.loading = false;
  }
  draw();
}

function draw() {
  const today = new Date();
  const thisWeek = view.events.filter((e) => new Date(e.starts_at) >= startOfWeek(today) && new Date(e.starts_at) < addDays(startOfWeek(today), 7)).length;
  const upcoming = view.events.filter((e) => new Date(e.starts_at) >= today).sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at)).slice(0, 6);
  const title = view.mode === "month" ? monthTitle(view.cursor) : view.mode === "week" ? `Semana de ${addDays(startOfWeek(view.cursor), 0).toLocaleDateString("pt-BR", { day: "numeric", month: "short" })} a ${addDays(startOfWeek(view.cursor), 6).toLocaleDateString("pt-BR", { day: "numeric", month: "short" })}` : longDate(view.cursor);

  dashboardGrid.innerHTML = `
    <section class="page-intro"><div><p class="card-kicker">Meu dia</p><h2>Agenda</h2><p>${esc(eventsOn(today).length ? `${eventsOn(today).length} compromisso${eventsOn(today).length === 1 ? "" : "s"} hoje` : "Nenhum compromisso hoje")} · ${thisWeek} nesta semana</p></div><button class="button button-primary compact-action" type="button" data-agenda-new>+ Novo evento</button></section>
    <section class="agenda-layout">
      <section class="data-card calendar-card">
        <div class="calendar-toolbar">
          <div class="calendar-nav-group"><button class="calendar-nav" type="button" data-shift="-1" aria-label="Anterior">‹</button><button class="calendar-nav" type="button" data-shift="1" aria-label="Próximo">›</button><button class="filter-button" type="button" data-today>Hoje</button></div>
          <h2>${esc(title)}</h2>
          <div class="agenda-modes" role="tablist">${["month", "week", "day"].map((m) => `<button class="filter-button ${view.mode === m ? "is-active" : ""}" type="button" role="tab" aria-selected="${view.mode === m}" data-mode="${m}">${{ month: "Mês", week: "Semana", day: "Dia" }[m]}</button>`).join("")}</div>
        </div>
        <div class="agenda-search"><input type="search" placeholder="Buscar compromisso…" value="${esc(view.query)}" aria-label="Buscar compromisso" /></div>
        ${view.mode === "month" ? monthMarkup() : view.mode === "week" ? weekMarkup() : dayMarkup()}
      </section>
      <div class="agenda-side">
        <aside class="data-card day-agenda">
          <div class="section-heading"><div><p class="card-kicker">${sameDay(view.selected, today) ? "Hoje" : WEEKDAYS[new Date(view.selected).getDay()]}</p><h2>${esc(new Date(view.selected).toLocaleDateString("pt-BR", { day: "numeric", month: "long" }))}</h2></div><button class="icon-action" type="button" data-agenda-new-on="${toLocalInput(atHour(view.selected, 9))}" aria-label="Novo evento neste dia">+</button></div>
          <div class="day-event-list">${eventsOn(view.selected).map(eventRow).join("") || `<div class="agenda-empty"><p>Nenhum compromisso neste dia.</p><button class="text-action" type="button" data-agenda-new-on="${toLocalInput(atHour(view.selected, 9))}">Agendar às 09:00 →</button></div>`}</div>
        </aside>
        <aside class="data-card agenda-upcoming">
          <div class="section-heading"><div><p class="card-kicker">Em seguida</p><h2>Próximos compromissos</h2></div></div>
          ${upcoming.length ? upcoming.map((e) => `<button class="agenda-upcoming-item" type="button" data-go="${esc(e.starts_at)}"><time>${esc(new Date(e.starts_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }))}<br>${esc(timeOf(e.starts_at))}</time><span><strong>${esc(e.title)}</strong><small>${esc(e.description || (isRecurring(e) ? RECURRENCE[e.recurrence] : "Compromisso"))}</small></span></button>`).join("") : `<div class="agenda-empty"><p>Nada agendado para os próximos dias.</p></div>`}
        </aside>
      </div>
    </section>`;
  bind();
}

const atHour = (day, hour) => { const d = startOfDay(day); d.setHours(hour, 0, 0, 0); return d; };

function chip(e) {
  return `<button class="agenda-chip ${isRecurring(e) ? "is-recurring" : ""}" type="button" draggable="true" data-event="${esc(e.id)}" title="${esc(e.title)} · ${esc(timeOf(e.starts_at))}"><time>${esc(timeOf(e.starts_at))}</time>${esc(e.title)}</button>`;
}

function monthMarkup() {
  const y = view.cursor.getFullYear(), m = view.cursor.getMonth();
  const first = new Date(y, m, 1), offset = first.getDay(), days = new Date(y, m + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < 42; i += 1) {
    const dayNumber = i - offset + 1;
    if (dayNumber < 1 || dayNumber > days) { cells.push(`<div class="agenda-cell is-empty"></div>`); continue; }
    const day = new Date(y, m, dayNumber);
    const list = eventsOn(day);
    cells.push(`<div class="agenda-cell ${sameDay(day, new Date()) ? "is-today" : ""} ${sameDay(day, view.selected) ? "is-selected" : ""}" data-day="${day.toISOString()}" role="gridcell"><button class="agenda-cell-day" type="button" data-select="${day.toISOString()}">${dayNumber}</button><div class="agenda-cell-events">${list.slice(0, 3).map(chip).join("")}${list.length > 3 ? `<button class="agenda-more" type="button" data-select="${day.toISOString()}">+${list.length - 3}</button>` : ""}</div></div>`);
  }
  return `<div class="calendar-weekdays">${WEEKDAYS.map((d) => `<span>${d}</span>`).join("")}</div><div class="agenda-month" role="grid">${cells.join("")}</div>`;
}

function weekMarkup() {
  const start = startOfWeek(view.cursor);
  const columns = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  return `<div class="agenda-week">
    <div class="agenda-week-head"><span></span>${columns.map((d) => `<button class="agenda-week-day ${sameDay(d, new Date()) ? "is-today" : ""}" type="button" data-select="${d.toISOString()}"><small>${WEEKDAYS[d.getDay()]}</small><strong>${d.getDate()}</strong></button>`).join("")}</div>
    <div class="agenda-week-body">${HOURS.map((h) => `<div class="agenda-hour"><span>${String(h).padStart(2, "0")}:00</span>${columns.map((d) => { const slot = atHour(d, h); const list = eventsOn(d).filter((e) => new Date(e.starts_at).getHours() === h); return `<div class="agenda-slot" data-day="${d.toISOString()}" data-slot="${toLocalInput(slot)}">${list.map(chip).join("")}</div>`; }).join("")}</div>`).join("")}</div>
  </div>`;
}

function dayMarkup() {
  const day = view.cursor;
  const list = eventsOn(day);
  const unscheduled = list.filter((e) => { const h = new Date(e.starts_at).getHours(); return h < HOURS[0] || h > HOURS[HOURS.length - 1]; });
  return `<div class="agenda-day">${HOURS.map((h) => { const slot = atHour(day, h); const inHour = list.filter((e) => new Date(e.starts_at).getHours() === h); return `<div class="agenda-day-row ${inHour.length ? "has-events" : ""}"><span>${String(h).padStart(2, "0")}:00</span><div class="agenda-slot agenda-day-slot" data-day="${day.toISOString()}" data-slot="${toLocalInput(slot)}">${inHour.map(eventRow).join("")}</div></div>`; }).join("")}${unscheduled.length ? `<div class="agenda-day-row"><span>fora do horário</span><div class="agenda-slot">${unscheduled.map(eventRow).join("")}</div></div>` : ""}</div>`;
}

function eventRow(e) {
  return `<article class="day-event ${isRecurring(e) ? "is-recurring" : ""}" draggable="true" data-event="${esc(e.id)}">
    <time>${esc(timeOf(e.starts_at))}</time>
    <div><strong>${esc(e.title)}</strong><small>${esc(e.description || "Sem descrição")}${isRecurring(e) ? ` · ${RECURRENCE[e.recurrence]}` : ""}${Number(e.reminder_minutes) ? ` · lembrete ${e.reminder_minutes} min antes` : ""}</small></div>
    <span class="day-event-actions"><button class="icon-action" type="button" data-edit="${esc(e.id)}" aria-label="Editar">✎</button><button class="icon-action" type="button" data-delete="${esc(e.id)}" aria-label="Excluir">×</button></span>
  </article>`;
}

/* ---------------------------------------------------------------------------
   Interações
   --------------------------------------------------------------------------- */

function find(id) { return view.events.find((e) => String(e.id) === String(id)); }

function openNewEvent(startsAtLocal) {
  openCreateDialog("evento");
  const input = document.querySelector('#create-dialog-form [name="startsAt"]');
  if (input && startsAtLocal) input.value = startsAtLocal;
}

function bind() {
  const root = dashboardGrid;
  root.querySelector("[data-agenda-new]")?.addEventListener("click", () => openNewEvent(toLocalInput(atHour(view.selected, 9))));
  root.querySelectorAll("[data-agenda-new-on]").forEach((b) => b.addEventListener("click", () => openNewEvent(b.dataset.agendaNewOn)));
  root.querySelector("[data-today]")?.addEventListener("click", () => { view.cursor = new Date(); view.selected = new Date(); draw(); });
  root.querySelectorAll("[data-shift]").forEach((b) => b.addEventListener("click", () => {
    const n = Number(b.dataset.shift);
    if (view.mode === "month") view.cursor = new Date(view.cursor.getFullYear(), view.cursor.getMonth() + n, 1);
    else view.cursor = addDays(view.cursor, view.mode === "week" ? 7 * n : n);
    if (view.mode !== "month") view.selected = new Date(view.cursor);
    draw();
  }));
  root.querySelectorAll("[data-mode]").forEach((b) => b.addEventListener("click", () => { view.mode = b.dataset.mode; localStorage.setItem("focusdev_agenda_mode", view.mode); if (view.mode !== "month") view.cursor = new Date(view.selected); draw(); }));
  root.querySelectorAll("[data-select]").forEach((b) => b.addEventListener("click", (event) => { event.stopPropagation(); view.selected = new Date(b.dataset.select); if (view.mode === "day") view.cursor = new Date(view.selected); draw(); }));
  root.querySelectorAll("[data-go]").forEach((b) => b.addEventListener("click", () => { view.selected = new Date(b.dataset.go); view.cursor = new Date(b.dataset.go); draw(); }));
  const searchBox = root.querySelector(".agenda-search");
  if (searchBox && !searchBox.querySelector("[data-agenda-type]")) searchBox.insertAdjacentHTML("beforeend", `<select data-agenda-type aria-label="Filtrar tipo"><option value="">Todos os tipos</option><option value="meeting">Reunião</option><option value="call">Ligação</option><option value="followup">Retorno</option><option value="deadline">Prazo/entrega</option><option value="billing">Cobrança</option><option value="support">Suporte</option></select><select data-agenda-status aria-label="Filtrar situação"><option value="">Todas as situações</option><option value="pending">Pendente</option><option value="confirmed">Confirmado</option><option value="in_progress">Em andamento</option><option value="done">Concluído</option><option value="cancelled">Cancelado</option></select>`);
  const typeFilter = root.querySelector("[data-agenda-type]"), statusFilter = root.querySelector("[data-agenda-status]");
  if (typeFilter) { typeFilter.value = view.eventType; typeFilter.addEventListener("change", () => { view.eventType = typeFilter.value; view.loading = false; renderAgenda(); }); }
  if (statusFilter) { statusFilter.value = view.status; statusFilter.addEventListener("change", () => { view.status = statusFilter.value; view.loading = false; renderAgenda(); }); }
  const search = root.querySelector(".agenda-search input");
  search?.addEventListener("input", () => { view.query = search.value; const pos = search.selectionStart; draw(); const again = root.querySelector(".agenda-search input"); again?.focus(); again?.setSelectionRange(pos, pos); });

  // Clique em célula/slot vazio cria evento naquele dia/hora; clique num chip abre o dia.
  root.querySelectorAll(".agenda-cell:not(.is-empty)").forEach((cell) => cell.addEventListener("dblclick", () => openNewEvent(toLocalInput(atHour(new Date(cell.dataset.day), 9)))));
  root.querySelectorAll(".agenda-slot").forEach((slot) => slot.addEventListener("click", (event) => { if (event.target === slot) openNewEvent(slot.dataset.slot); }));
  root.querySelectorAll(".agenda-chip").forEach((c) => c.addEventListener("click", (event) => { event.stopPropagation(); const e = find(c.dataset.event); if (!e) return; view.selected = new Date(e.starts_at); draw(); root.querySelector(`.day-event[data-event="${CSS.escape(String(e.id))}"]`)?.scrollIntoView({ block: "nearest" }); }));

  root.querySelectorAll("[data-edit]").forEach((b) => b.addEventListener("click", () => {
    const e = find(b.dataset.edit); if (!e) return;
    openEditDialog("evento", { title: e.title, startsAt: e.starts_at, description: e.description || "", recurrence: e.recurrence || "none", reminderMinutes: e.reminder_minutes || 0 }, `/api/events/${eventId(e)}`);
    if (isRecurring(e)) { const status = document.getElementById("dialog-status"); if (status) status.textContent = "Evento recorrente: a alteração vale para todas as ocorrências."; }
  }));
  root.querySelectorAll("[data-delete]").forEach((b) => b.addEventListener("click", () => {
    const row = b.closest(".day-event"); const e = find(b.dataset.delete); if (!row || !e) return;
    row.querySelector(".day-event-actions").innerHTML = `<span class="event-confirm">${isRecurring(e) ? "Excluir todas as ocorrências?" : "Excluir?"} <button class="text-action" type="button" data-confirm>Sim</button> <button class="text-action" type="button" data-cancel>Não</button></span>`;
    row.querySelector("[data-cancel]").addEventListener("click", () => draw());
    row.querySelector("[data-confirm]").addEventListener("click", async () => { try { await api(`/api/events/${eventId(e)}`, { method: "DELETE" }); view.events = view.events.filter((x) => eventId(x) !== eventId(e)); draw(); } catch (error) { row.querySelector(".event-confirm").textContent = error.message; } });
  }));

  // Arrastar chips/eventos entre dias ou horários (PATCH startsAt mantendo a hora quando o destino é um dia).
  root.querySelectorAll("[draggable=true]").forEach((el) => el.addEventListener("dragstart", (event) => { event.dataTransfer.setData("text/plain", el.dataset.event); event.dataTransfer.effectAllowed = "move"; el.classList.add("is-dragging"); }));
  root.querySelectorAll(".agenda-cell:not(.is-empty), .agenda-slot").forEach((target) => {
    target.addEventListener("dragover", (event) => { event.preventDefault(); target.classList.add("is-drop-target"); });
    target.addEventListener("dragleave", () => target.classList.remove("is-drop-target"));
    target.addEventListener("drop", async (event) => {
      event.preventDefault(); target.classList.remove("is-drop-target");
      const e = find(event.dataTransfer.getData("text/plain")); if (!e) return;
      const original = new Date(e.starts_at);
      let next;
      if (target.dataset.slot) next = new Date(target.dataset.slot);
      else { next = new Date(target.dataset.day); next.setHours(original.getHours(), original.getMinutes(), 0, 0); }
      if (isRecurring(e)) { const delta = next - original; const base = view.events.find((x) => x.id === eventId(e)) || e; next = new Date(new Date(base.starts_at).getTime() + delta); }
      try { await api(`/api/events/${eventId(e)}`, { method: "PATCH", body: { startsAt: next.toISOString() } }); await renderAgenda(); }
      catch (error) { dashboardGrid.querySelector(".page-intro p").textContent = error.message; }
    });
  });
}

registerRoutes({ agenda: renderAgenda });
createConfig.evento.fields.push({ name: "event_type", label: "Tipo", type: "select", options: [["meeting", "Reunião"], ["call", "Ligação"], ["followup", "Retorno ao cliente"], ["deadline", "Prazo/entrega"], ["billing", "Cobrança/vencimento"], ["support", "Suporte"], ["personal", "Compromisso pessoal"], ["other", "Outro"]], required: false }, { name: "status", label: "Status", type: "select", options: [["pending", "Pendente"], ["confirmed", "Confirmado"], ["in_progress", "Em andamento"], ["done", "Concluído"], ["cancelled", "Cancelado"]], required: false }, { name: "endsAt", label: "Horário final", type: "datetime-local", required: false }, { name: "location", label: "Local ou link", required: false }, { name: "participants", label: "Participantes", required: false }, { name: "reminder_channels", label: "Lembretes", placeholder: "app, navegador, e-mail ou WhatsApp", required: false }, { name: "recurrenceUntil", label: "Fim da repetição", type: "date", required: false });
