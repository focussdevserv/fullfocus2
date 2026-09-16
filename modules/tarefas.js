/* ==========================================================================
   FocusDev — módulo "tarefas"
   Tela: Tarefas (lista agrupada por prazo ou kanban), dados de /api/tasks.
   Ownership: modules/tarefas.js, modules/tarefas.css
   ========================================================================== */

const STATUS = { todo: "A fazer", doing: "Em andamento", waiting_client: "Aguardando cliente", review: "Em revisão", blocked: "Bloqueada", done: "Concluída", cancelled: "Cancelada" };
const PRIORITY = { urgent: ["Urgente", "priority-urgent"], high: ["Alta", "priority-high"], medium: ["Média", "priority-medium"], low: ["Baixa", "priority-low"] };
const DAY = 86_400_000;

const taskSavedMode = (() => { try { return localStorage.getItem("focusdev_tasks_mode"); } catch { return null; } })();
const state = { mode: taskSavedMode || "list", status: "open", priority: "all", project: "all", sort: "due", query: "", tasks: [], projects: [], pendingDelete: null, request: 0, mutation: 0 };

const esc = (v) => escapeHtml(v == null ? "" : String(v));
const taskTimeFormatter = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" });
const taskDateFormatter = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" });
const startOfDay = (d = new Date()) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const timeOf = (v) => { const date = new Date(v); return Number.isNaN(date.getTime()) ? "—" : taskTimeFormatter.format(date); };
const dateOf = (v) => { const date = new Date(v); return Number.isNaN(date.getTime()) ? "—" : taskDateFormatter.format(date); };
const isDone = (t) => t.status === "done";
const isClosed = (t) => t.status === "done" || t.status === "cancelled";
const isLate = (t) => !isClosed(t) && t.due_at && new Date(t.due_at) < startOfDay();
const dueDays = (t) => (t.due_at ? Math.round((startOfDay(t.due_at) - startOfDay()) / DAY) : null);

function dueText(t) {
  const days = dueDays(t);
  if (days === null) return { text: "Sem prazo", tone: "" };
  if (days < 0) return { text: `Venceu há ${-days === 1 ? "1 dia" : `${-days} dias`}`, tone: "is-late" };
  if (days === 0) return { text: `Hoje · ${timeOf(t.due_at)}`, tone: "is-today" };
  if (days === 1) return { text: `Amanhã · ${timeOf(t.due_at)}`, tone: "" };
  return { text: `${dateOf(t.due_at)} · ${timeOf(t.due_at)}`, tone: "" };
}

const projectName = (t) => state.projects.find((p) => String(p.id) === String(t.project_id))?.name || "";

/* ---------------------------------------------------------------------------
   Carregamento
   --------------------------------------------------------------------------- */

async function renderTasks() {
  if (location.hash !== "#tarefas") return;
  const request = state.request = (state.request || 0) + 1;
  dashboardGrid.setAttribute("aria-busy", "true");
  const restoreSearchFocus = ui.keepSearchFocus(dashboardGrid, ".tasks-search");
  dashboardGrid.innerHTML = `<section class="page-intro"><div><p class="card-kicker">Meu dia</p><h2>Tarefas</h2><p>Organize prioridades e acompanhe o trabalho da equipe.</p></div></section>${stateBlock.loading("Carregando tarefas…")}`;
  const params = new URLSearchParams(); if (state.query.trim()) params.set("search", state.query.trim()); if (state.status !== "all") params.set("status", state.status); if (state.priority !== "all") params.set("priority", state.priority); if (state.project !== "all") params.set("project_id", state.project);
  const [tasks, projects] = await Promise.allSettled([api(`/api/tasks?${params}`), api("/api/projects")]);
  if (request !== state.request || location.hash !== "#tarefas") return;
  if (tasks.status === "rejected") {
    dashboardGrid.removeAttribute("aria-busy");
    dashboardGrid.innerHTML = `<section class="page-intro"><div><p class="card-kicker">Meu dia</p><h2>Tarefas</h2></div></section>${stateBlock.error(tasks.reason?.message, "tasks-retry")}`;
    dashboardGrid.querySelector(".tasks-retry")?.addEventListener("click", renderTasks);
    return;
  }
  state.tasks = tasks.value.tasks || [];
  state.projects = projects.status === "fulfilled" ? projects.value.projects || [] : [];
  // Projetos disponíveis no dialog de criação/edição.
  const projectField = createConfig.tarefa.fields.find((f) => f.name === "project_id");
  if (projectField) projectField.options = [["", "Sem projeto"], ...state.projects.map((p) => [String(p.id), p.name])];
  draw();
  dashboardGrid.removeAttribute("aria-busy");
  restoreSearchFocus();
}

function visibleTasks() {
  const q = state.query.trim().toLocaleLowerCase("pt-BR");
  return state.tasks.filter((t) => {
    if (state.status === "open" && isClosed(t)) return false;
    if (state.status !== "all" && state.status !== "open" && t.status !== state.status) return false;
    if (state.priority !== "all" && (t.priority || "medium") !== state.priority) return false;
    if (state.project !== "all" && String(t.project_id || "") !== state.project) return false;
    if (q && !`${t.title} ${(t.tags || []).join(" ")} ${projectName(t)}`.toLocaleLowerCase("pt-BR").includes(q)) return false;
    return true;
  }).sort(sorter());
}

function sorter() {
  const rank = { urgent: 0, high: 1, medium: 2, low: 3 };
  if (state.sort === "priority") return (a, b) => (rank[a.priority || "medium"] - rank[b.priority || "medium"]) || dueSort(a, b);
  if (state.sort === "recent") return (a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0);
  return dueSort;
}
const dueSort = (a, b) => (a.due_at ? new Date(a.due_at).getTime() : Infinity) - (b.due_at ? new Date(b.due_at).getTime() : Infinity);

/* ---------------------------------------------------------------------------
   Render
   --------------------------------------------------------------------------- */

function draw() {
  const all = state.tasks, open = all.filter((t) => !isClosed(t));
  const today = open.filter((t) => dueDays(t) === 0).length, late = open.filter(isLate).length;
  const weekAgo = Date.now() - 7 * DAY;
  const doneWeek = all.filter((t) => isDone(t) && new Date(t.updated_at || t.created_at || 0).getTime() >= weekAgo).length;
  const visible = visibleTasks();
  const roots = visible.filter((t) => !t.parent_id || !all.some((p) => String(p.id) === String(t.parent_id)));

  dashboardGrid.innerHTML = `
    <section class="page-intro"><div><p class="card-kicker">Meu dia</p><h2>Tarefas</h2><p>${open.length ? `${open.length} em aberto${late ? ` · <span class="tasks-late-text">${late} atrasada${late === 1 ? "" : "s"}</span>` : ""}` : "Nenhuma tarefa em aberto"}</p></div><button class="button button-primary compact-action" type="button" data-new>+ Nova tarefa</button></section>
    <section class="tasks-summary">
      <button class="data-card tasks-stat ${state.status === "open" && !state.query ? "is-active" : ""}" type="button" data-quick="open"><span>Em aberto</span><strong>${open.length}</strong></button>
      <button class="data-card tasks-stat" type="button" data-quick="today"><span>Para hoje</span><strong>${today}</strong></button>
      <button class="data-card tasks-stat ${late ? "is-danger" : ""}" type="button" data-quick="late"><span>Atrasadas</span><strong>${late}</strong></button>
      <button class="data-card tasks-stat" type="button" data-quick="done"><span>Concluídas (7 dias)</span><strong>${doneWeek}</strong></button>
    </section>
    <section class="data-card tasks-card">
      <form class="tasks-quick-add" data-quick-add><input type="text" name="title" placeholder="Adicionar tarefa rápida e pressionar Enter…" aria-label="Nova tarefa rápida" autocomplete="off" /><button class="button button-secondary compact-action" type="submit">Adicionar</button></form>
      <div class="tasks-toolbar">
        <input class="tasks-search" name="search" autocomplete="off" type="search" placeholder="Buscar por título, tag ou projeto…" value="${esc(state.query)}" aria-label="Buscar tarefa" />
        <select name="status" autocomplete="off" data-filter="status" aria-label="Situação"><option value="open">Em aberto</option><option value="all">Todas</option>${Object.entries(STATUS).map(([k, v]) => `<option value="${k}">${v}</option>`).join("")}</select>
        <select name="priority" autocomplete="off" data-filter="priority" aria-label="Prioridade"><option value="all">Toda prioridade</option>${Object.entries(PRIORITY).map(([k, [v]]) => `<option value="${k}">${v}</option>`).join("")}</select>
        <select name="project_id" autocomplete="off" data-filter="project" aria-label="Projeto"><option value="all">Todos os projetos</option><option value="">Sem projeto</option>${state.projects.map((p) => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join("")}</select>
        <select name="sort" autocomplete="off" data-filter="sort" aria-label="Ordenar"><option value="due">Por prazo</option><option value="priority">Por prioridade</option><option value="recent">Mais recentes</option></select>
        <div class="tasks-modes" role="tablist" aria-label="Modo de visualização"><button class="filter-button ${state.mode === "list" ? "is-active" : ""}" type="button" role="tab" aria-selected="${state.mode === "list"}" data-mode="list">Lista</button><button class="filter-button ${state.mode === "kanban" ? "is-active" : ""}" type="button" role="tab" aria-selected="${state.mode === "kanban"}" data-mode="kanban">Kanban</button></div>
      </div>
      ${roots.length ? (state.mode === "list" ? listMarkup(roots) : kanbanMarkup(roots)) : emptyMarkup()}
    </section>`;
  ["status", "priority", "project", "sort"].forEach((key) => { const el = dashboardGrid.querySelector(`[data-filter="${key}"]`); if (el) el.value = state[key]; });
  bind();
}

function emptyMarkup() {
  const filtered = state.query || state.status !== "open" || state.priority !== "all" || state.project !== "all";
  return `<div class="tasks-empty"><h3>${filtered ? "Nada encontrado com esses filtros." : "Nenhuma tarefa em aberto."}</h3><p>${filtered ? "Ajuste a busca ou os filtros para ver outras tarefas." : "Use a linha acima para adicionar uma tarefa rápida ou crie uma completa com prazo, prioridade e projeto."}</p>${filtered ? `<button class="button button-secondary compact-action" type="button" data-clear>Limpar filtros</button>` : `<button class="button button-primary compact-action" type="button" data-new>Criar tarefa</button>`}</div>`;
}

const GROUPS = [["late", "Atrasadas"], ["today", "Hoje"], ["week", "Esta semana"], ["later", "Mais tarde"], ["none", "Sem prazo"], ["done", "Concluídas"], ["cancelled", "Canceladas"]];
function groupOf(t) {
  if (isDone(t)) return "done";
  if (t.status === "cancelled") return "cancelled";
  const d = dueDays(t);
  if (d === null) return "none";
  if (d < 0) return "late";
  if (d === 0) return "today";
  if (d <= 7) return "week";
  return "later";
}

function listMarkup(roots) {
  const groups = new Map(GROUPS.map(([k]) => [k, []]));
  roots.forEach((t) => groups.get(groupOf(t)).push(t));
  return `<div class="tasks-list">${GROUPS.filter(([k]) => groups.get(k).length).map(([k, label]) => `<section class="tasks-group tasks-group-${k}"><h3>${label} <span>${groups.get(k).length}</span></h3>${groups.get(k).map(rowMarkup).join("")}</section>`).join("")}</div>`;
}

function subtasksOf(t) { return state.tasks.filter((x) => String(x.parent_id) === String(t.id)); }

function rowMarkup(t) {
  const due = dueText(t), [pLabel, pClass] = PRIORITY[t.priority || "medium"] || PRIORITY.medium;
  const subs = subtasksOf(t), subsDone = subs.filter(isDone).length;
  const project = projectName(t);
  return `<article class="tasks-row ${isDone(t) ? "is-done" : ""} ${due.tone}" data-task="${esc(t.id)}" draggable="true">
    <label class="tasks-check"><input type="checkbox" data-toggle="${esc(t.id)}" ${isDone(t) ? "checked" : ""} aria-label="Concluir ${esc(t.title)}" /><span></span></label>
    <div class="tasks-main">
      <strong>${esc(t.title)}</strong>
      <div class="tasks-meta"><span class="${due.tone}">${esc(due.text)}</span>${project ? `<span class="tasks-project">◈ ${esc(project)}</span>` : ""}${(t.tags || []).map((tag) => `<span class="tasks-tag">#${esc(tag)}</span>`).join("")}${subs.length ? `<span class="tasks-subcount">${subsDone}/${subs.length} subtarefas</span>` : ""}</div>
      ${subs.length ? `<ul class="tasks-subtasks">${subs.map((s) => `<li class="${isDone(s) ? "is-done" : ""}"><label class="tasks-check small"><input type="checkbox" data-toggle="${esc(s.id)}" ${isDone(s) ? "checked" : ""} aria-label="Concluir ${esc(s.title)}" /><span></span></label><span>${esc(s.title)}</span><button class="tasks-icon" type="button" data-delete="${esc(s.id)}" aria-label="Excluir subtarefa">×</button></li>`).join("")}</ul>` : ""}
    </div>
    <select class="tasks-status ${esc(t.status)}" name="status" autocomplete="off" data-status="${esc(t.id)}" aria-label="Situação de ${esc(t.title)}">${Object.entries(STATUS).map(([k, v]) => `<option value="${k}" ${t.status === k ? "selected" : ""}>${v}</option>`).join("")}</select>
    <em class="${pClass}">${pLabel}</em>
    <div class="tasks-actions"><button class="tasks-icon" type="button" data-subtask="${esc(t.id)}" title="Adicionar subtarefa">+</button><button class="tasks-icon" type="button" data-edit="${esc(t.id)}" title="Editar">✎</button><button class="tasks-icon" type="button" data-delete="${esc(t.id)}" title="Excluir">×</button></div>
  </article>`;
}

function kanbanMarkup(roots) {
  return `<div class="kanban-board tasks-kanban">${Object.entries(STATUS).map(([status, label]) => { const list = roots.filter((t) => t.status === status); return `<section class="kanban-column" data-column="${status}"><h3>${label}<span>${list.length}</span><button class="tasks-icon" type="button" data-new-status="${status}" title="Nova tarefa nesta coluna">+</button></h3>${list.map(cardMarkup).join("") || `<p class="tasks-column-empty">Arraste tarefas para cá</p>`}</section>`; }).join("")}</div>`;
}

function cardMarkup(t) {
  const due = dueText(t), [pLabel, pClass] = PRIORITY[t.priority || "medium"] || PRIORITY.medium, subs = subtasksOf(t);
  return `<article class="kanban-task tasks-kanban-card ${due.tone}" draggable="true" data-task="${esc(t.id)}"><strong>${esc(t.title)}</strong><small class="${due.tone}">${esc(due.text)}</small>${projectName(t) ? `<small>◈ ${esc(projectName(t))}</small>` : ""}${subs.length ? `<small>${subs.filter(isDone).length}/${subs.length} subtarefas</small>` : ""}<div class="tasks-card-foot"><em class="${pClass}">${pLabel}</em><label class="tasks-kanban-move"><span class="sr-only">Mover ${esc(t.title)}</span><select class="tasks-status" name="status" autocomplete="off" data-status="${esc(t.id)}" aria-label="Mover ${esc(t.title)} para outra situação">${Object.entries(STATUS).map(([key, label]) => `<option value="${key}" ${t.status === key ? "selected" : ""}>${label}</option>`).join("")}</select></label><span class="tasks-actions"><button class="tasks-icon" type="button" data-edit="${esc(t.id)}" title="Editar">✎</button><button class="tasks-icon" type="button" data-delete="${esc(t.id)}" title="Excluir">×</button></span></div></article>`;
}

/* ---------------------------------------------------------------------------
   Ações
   --------------------------------------------------------------------------- */

async function patch(id, body) { await api(`/api/tasks/${id}`, { method: "PATCH", body }); }
function find(id) { return state.tasks.find((t) => String(t.id) === String(id)); }
function notify(message, isError = false) { const p = dashboardGrid.querySelector(".page-intro p"); if (p) { p.textContent = message; p.classList.toggle("tasks-late-text", isError); } }

function bind() {
  const root = dashboardGrid;
  root.querySelectorAll("[data-new]").forEach((b) => b.addEventListener("click", () => openCreateDialog("tarefa")));
  root.querySelectorAll("[data-new-status]").forEach((b) => b.addEventListener("click", () => { openCreateDialog("tarefa"); const s = document.querySelector('#create-dialog-form [name="status"]'); if (s) s.value = b.dataset.newStatus; }));
  root.querySelector("[data-clear]")?.addEventListener("click", () => { Object.assign(state, { status: "open", priority: "all", project: "all", query: "" }); draw(); });
  root.querySelectorAll("[data-quick]").forEach((b) => b.addEventListener("click", () => {
    const kind = b.dataset.quick;
    Object.assign(state, { query: "", priority: "all", project: "all", status: kind === "done" ? "done" : "open", sort: "due" });
    draw();
    if (kind === "today" || kind === "late") { const group = root.querySelector(`.tasks-group-${kind}`); group?.scrollIntoView({ behavior: "smooth", block: "start" }); if (!group) notify(kind === "today" ? "Nenhuma tarefa vence hoje." : "Nenhuma tarefa atrasada."); }
  }));

  const quick = root.querySelector("[data-quick-add]");
  quick?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const title = quick.title.value.trim(); if (!title) return;
    const button = quick.querySelector("button"), routeAtStart = location.hash; if (button.disabled) return; button.disabled = true; button.setAttribute("aria-busy", "true"); button.textContent = "Adicionando…";
    try { const { task } = await api("/api/tasks", { method: "POST", body: { title, status: "todo", priority: "medium" } }); if (location.hash !== routeAtStart || routeAtStart !== "#tarefas" || !quick.isConnected) return; state.tasks.unshift(task); draw(); root.querySelector("[data-quick-add] input")?.focus(); }
    catch (error) { if (location.hash !== routeAtStart || !quick.isConnected) return; notify(error.message, true); }
    finally { if (button.isConnected) { button.disabled = false; button.removeAttribute("aria-busy"); button.textContent = "Adicionar"; } }
  });

  const search = root.querySelector(".tasks-search");
  search?.addEventListener("input", () => { state.query = search.value; clearTimeout(state.searchTimer); state.searchTimer = setTimeout(renderTasks, 250); });
  root.querySelectorAll("[data-filter]").forEach((select) => select.addEventListener("change", () => { state[select.dataset.filter] = select.value; if (["status", "priority", "project"].includes(select.dataset.filter)) renderTasks(); else draw(); }));
  root.querySelectorAll("[data-mode]").forEach((b) => b.addEventListener("click", () => { state.mode = b.dataset.mode; try { localStorage.setItem("focusdev_tasks_mode", state.mode); } catch { /* preferência somente nesta sessão */ } draw(); }));

  // O Kanban mantém o arrastar, mas também oferece uma alternativa acessível.
  root.querySelectorAll(".tasks-kanban-card").forEach((card) => {
    const task = find(card.dataset.task);
    if (!task || card.querySelector("[data-kanban-status]")) return;
    const select = document.createElement("select");
    select.className = "tasks-kanban-status";
    select.name = "status";
    select.autocomplete = "off";
    select.dataset.status = task.id;
    select.dataset.kanbanStatus = "true";
    select.setAttribute("aria-label", `Situação de ${task.title}`);
    select.innerHTML = Object.entries(STATUS).map(([key, label]) => `<option value="${key}">${label}</option>`).join("");
    select.value = task.status;
    card.querySelector(".tasks-card-foot")?.prepend(select);
  });

  root.querySelectorAll("[data-edit]").forEach((b) => b.addEventListener("click", () => {
    const t = find(b.dataset.edit); if (!t) return;
    openEditDialog("tarefa", { title: t.title, priority: t.priority || "medium", status: t.status, tags: (t.tags || []).join(", "), due_at: t.due_at || "", project_id: t.project_id ? String(t.project_id) : "" }, `/api/tasks/${t.id}`);
  }));
  root.querySelectorAll("[data-subtask]").forEach((b) => b.addEventListener("click", () => { const t = find(b.dataset.subtask); if (t) openSubtaskDialog(t); }));
  root.querySelectorAll("[data-delete]").forEach((b) => b.addEventListener("click", () => {
    const holder = b.closest(".tasks-actions") || b.parentElement;
    const t = find(b.dataset.delete); if (!t || !holder) return;
    const routeAtStart = location.hash;
    const subs = subtasksOf(t).length;
    holder.innerHTML = `<span class="tasks-confirm">${subs ? `Excluir com ${subs} subtarefa${subs === 1 ? "" : "s"}?` : "Excluir?"} <button class="text-action" type="button" data-confirm>Sim</button> <button class="text-action" type="button" data-cancel>Não</button></span>`;
    holder.querySelector("[data-cancel]").addEventListener("click", () => draw());
    holder.querySelector("[data-confirm]").addEventListener("click", async () => {
      const confirm = holder.querySelector("[data-confirm]"); if (confirm.disabled) return; confirm.disabled = true; confirm.textContent = "Excluindo…"; holder.setAttribute("aria-busy", "true");
      try { await api(`/api/tasks/${t.id}`, { method: "DELETE" }); if (location.hash !== routeAtStart || !holder.isConnected) return; state.tasks = state.tasks.filter((x) => String(x.id) !== String(t.id) && String(x.parent_id) !== String(t.id)); draw(); }
      catch (error) { if (location.hash !== routeAtStart || !holder.isConnected) return; confirm.disabled = false; confirm.textContent = "Sim"; holder.removeAttribute("aria-busy"); notify(error.message, true); }
    });
  }));

  // Kanban: arrastar entre colunas.
  root.querySelectorAll(".tasks-kanban [draggable=true]").forEach((card) => card.addEventListener("dragstart", (event) => { event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", card.dataset.task); card.classList.add("is-dragging"); }));
  root.querySelectorAll(".tasks-kanban [draggable=true]").forEach((card) => card.addEventListener("dragend", () => card.classList.remove("is-dragging")));
  root.querySelectorAll("[data-column]").forEach((column) => {
    column.addEventListener("dragover", (event) => { event.preventDefault(); column.classList.add("is-drop-target"); });
    column.addEventListener("dragleave", () => column.classList.remove("is-drop-target"));
    column.addEventListener("drop", async (event) => {
      event.preventDefault(); column.classList.remove("is-drop-target");
      if (column.dataset.busy === "1") return;
      const t = find(event.dataTransfer.getData("text/plain")); if (!t || t.status === column.dataset.column) return;
      const mutation = state.mutation += 1, requestAtStart = state.request, routeAtStart = location.hash;
      const previous = t.status; t.status = column.dataset.column;
      column.dataset.busy = "1"; column.setAttribute("aria-busy", "true");
      try { await patch(t.id, { status: t.status }); if (mutation !== state.mutation || requestAtStart !== state.request || location.hash !== routeAtStart || routeAtStart !== "#tarefas") return; draw(); } catch (error) { if (mutation !== state.mutation || requestAtStart !== state.request || location.hash !== routeAtStart || routeAtStart !== "#tarefas") return; t.status = previous; notify(error.message, true); draw(); } finally { if (column.isConnected) { column.dataset.busy = ""; column.removeAttribute("aria-busy"); } }
    });
  });
}

dashboardGrid.addEventListener("change", async (event) => {
  const control = event.target.closest?.("[data-status], [data-toggle]");
  if (!control || location.hash !== "#tarefas") return;
  event.preventDefault();
  event.stopImmediatePropagation();
  if (control.dataset.busy === "1") return;
  const task = find(control.dataset.status || control.dataset.toggle);
  if (!task) return;
  const previous = task.status;
  const next = control.dataset.toggle ? (control.checked ? "done" : "todo") : control.value;
  task.status = next;
  control.dataset.busy = "1";
  control.disabled = true;
  control.setAttribute("aria-busy", "true");
  try {
    await patch(task.id, { status: next });
    if (location.hash !== "#tarefas" || !control.isConnected) return;
    draw();
  } catch (error) {
    task.status = previous;
    if (location.hash === "#tarefas" && control.isConnected) { notify(error.message, true); draw(); }
  } finally {
    control.disabled = false;
    control.removeAttribute("aria-busy");
    control.dataset.busy = "";
  }
}, true);

new MutationObserver(() => {
  dashboardGrid.querySelectorAll(".tasks-icon").forEach((button) => {
    if (button.getAttribute("aria-label")) return;
    button.setAttribute("aria-label", button.dataset.edit ? "Editar tarefa" : button.dataset.delete ? "Excluir tarefa" : button.dataset.subtask ? "Adicionar subtarefa" : button.dataset.newStatus ? `Nova tarefa em ${button.dataset.newStatus}` : "Ação da tarefa");
  });
  dashboardGrid.querySelectorAll("button:disabled, input:disabled, select:disabled, textarea:disabled").forEach((control) => control.setAttribute("aria-busy", "true"));
  dashboardGrid.querySelectorAll("button, input, select, textarea, [draggable=true]").forEach((control) => { control.style.touchAction = "manipulation"; });
  const card = dashboardGrid.querySelector(".tasks-card");
  if (!card) return;
  const toolbar = card.querySelector(".tasks-toolbar");
  if (toolbar && !toolbar.querySelector("[data-tasks-results]")) {
    const result = document.createElement("p");
    result.className = "ui-filter-status";
    result.dataset.tasksResults = "true";
    result.setAttribute("role", "status");
    result.setAttribute("aria-live", "polite");
    toolbar.after(result);
  }
  const result = card.querySelector("[data-tasks-results]");
  if (result) { const count = visibleTasks().length; const label = count === 1 ? "1 tarefa encontrada" : `${count} tarefas encontradas`; if (result.textContent !== label) result.textContent = label; }
}).observe(dashboardGrid, { childList: true, subtree: true, attributes: true, attributeFilter: ["disabled"] });

registerRoutes({ tarefas: renderTasks });
createConfig.tarefa.fields.find((field) => field.name === "priority").options = [["low", "Baixa"], ["medium", "Média"], ["high", "Alta"], ["urgent", "Urgente"]];
createConfig.tarefa.fields.find((field) => field.name === "status").options = [["todo", "Pendente"], ["doing", "Em andamento"], ["waiting_client", "Aguardando cliente"], ["review", "Em revisão"], ["blocked", "Bloqueada"], ["done", "Concluída"], ["cancelled", "Cancelada"]];
createConfig.tarefa.fields.push({ name: "description", label: "Descrição", type: "text", required: false }, { name: "client_id", label: "Cliente", type: "select", options: [["", "Sem cliente"]], required: false }, { name: "stage", label: "Etapa do projeto", required: false }, { name: "assignee", label: "Responsável", required: false }, { name: "starts_at", label: "Data de início", type: "datetime-local", required: false }, { name: "category", label: "Categoria", required: false }, { name: "estimated_minutes", label: "Tempo estimado (minutos)", type: "number", required: false }, { name: "worked_minutes", label: "Tempo trabalhado (minutos)", type: "number", required: false }, { name: "recurrence", label: "Recorrência", type: "select", options: [["none", "Não repetir"], ["daily", "Diária"], ["weekly", "Semanal"], ["monthly", "Mensal"], ["yearly", "Anual"]], required: false }, { name: "blocked_reason", label: "Motivo do bloqueio", required: false }, { name: "internal_notes", label: "Observações internas", required: false });
