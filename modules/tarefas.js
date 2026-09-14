/* ==========================================================================
   FocusDev — módulo "tarefas"
   Tela: Tarefas (lista agrupada por prazo ou kanban), dados de /api/tasks.
   Ownership: modules/tarefas.js, modules/tarefas.css
   ========================================================================== */

const STATUS = { todo: "A fazer", doing: "Em andamento", blocked: "Bloqueada", done: "Concluída" };
const PRIORITY = { high: ["Alta", "priority-high"], medium: ["Média", "priority-medium"], low: ["Baixa", "priority-low"] };
const DAY = 86_400_000;

const state = { mode: localStorage.getItem("focusdev_tasks_mode") || "list", status: "open", priority: "all", project: "all", sort: "due", query: "", tasks: [], projects: [], pendingDelete: null };

const esc = (v) => escapeHtml(v == null ? "" : String(v));
const startOfDay = (d = new Date()) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const timeOf = (v) => new Date(v).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
const dateOf = (v) => new Date(v).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
const isDone = (t) => t.status === "done";
const isLate = (t) => !isDone(t) && t.due_at && new Date(t.due_at) < startOfDay();
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
  dashboardGrid.innerHTML = `<section class="page-intro"><div><p class="card-kicker">Meu dia</p><h2>Tarefas</h2><p>Organize prioridades e acompanhe o trabalho da equipe.</p></div></section>${stateBlock.loading("Carregando tarefas…")}`;
  const [tasks, projects] = await Promise.allSettled([api("/api/tasks"), api("/api/projects")]);
  if (tasks.status === "rejected") {
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
}

function visibleTasks() {
  const q = state.query.trim().toLocaleLowerCase("pt-BR");
  return state.tasks.filter((t) => {
    if (state.status === "open" && isDone(t)) return false;
    if (state.status !== "all" && state.status !== "open" && t.status !== state.status) return false;
    if (state.priority !== "all" && (t.priority || "medium") !== state.priority) return false;
    if (state.project !== "all" && String(t.project_id || "") !== state.project) return false;
    if (q && !`${t.title} ${(t.tags || []).join(" ")} ${projectName(t)}`.toLocaleLowerCase("pt-BR").includes(q)) return false;
    return true;
  }).sort(sorter());
}

function sorter() {
  const rank = { high: 0, medium: 1, low: 2 };
  if (state.sort === "priority") return (a, b) => (rank[a.priority || "medium"] - rank[b.priority || "medium"]) || dueSort(a, b);
  if (state.sort === "recent") return (a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0);
  return dueSort;
}
const dueSort = (a, b) => (a.due_at ? new Date(a.due_at).getTime() : Infinity) - (b.due_at ? new Date(b.due_at).getTime() : Infinity);

/* ---------------------------------------------------------------------------
   Render
   --------------------------------------------------------------------------- */

function draw() {
  const all = state.tasks, open = all.filter((t) => !isDone(t));
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
        <input class="tasks-search" type="search" placeholder="Buscar por título, tag ou projeto…" value="${esc(state.query)}" aria-label="Buscar tarefa" />
        <select data-filter="status" aria-label="Situação"><option value="open">Em aberto</option><option value="all">Todas</option>${Object.entries(STATUS).map(([k, v]) => `<option value="${k}">${v}</option>`).join("")}</select>
        <select data-filter="priority" aria-label="Prioridade"><option value="all">Toda prioridade</option>${Object.entries(PRIORITY).map(([k, [v]]) => `<option value="${k}">${v}</option>`).join("")}</select>
        <select data-filter="project" aria-label="Projeto"><option value="all">Todos os projetos</option><option value="">Sem projeto</option>${state.projects.map((p) => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join("")}</select>
        <select data-filter="sort" aria-label="Ordenar"><option value="due">Por prazo</option><option value="priority">Por prioridade</option><option value="recent">Mais recentes</option></select>
        <div class="tasks-modes" role="tablist"><button class="filter-button ${state.mode === "list" ? "is-active" : ""}" type="button" data-mode="list">Lista</button><button class="filter-button ${state.mode === "kanban" ? "is-active" : ""}" type="button" data-mode="kanban">Kanban</button></div>
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

const GROUPS = [["late", "Atrasadas"], ["today", "Hoje"], ["week", "Esta semana"], ["later", "Mais tarde"], ["none", "Sem prazo"], ["done", "Concluídas"]];
function groupOf(t) {
  if (isDone(t)) return "done";
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
    <select class="tasks-status ${esc(t.status)}" data-status="${esc(t.id)}" aria-label="Situação">${Object.entries(STATUS).map(([k, v]) => `<option value="${k}" ${t.status === k ? "selected" : ""}>${v}</option>`).join("")}</select>
    <em class="${pClass}">${pLabel}</em>
    <div class="tasks-actions"><button class="tasks-icon" type="button" data-subtask="${esc(t.id)}" title="Adicionar subtarefa">+</button><button class="tasks-icon" type="button" data-edit="${esc(t.id)}" title="Editar">✎</button><button class="tasks-icon" type="button" data-delete="${esc(t.id)}" title="Excluir">×</button></div>
  </article>`;
}

function kanbanMarkup(roots) {
  return `<div class="kanban-board tasks-kanban">${Object.entries(STATUS).map(([status, label]) => { const list = roots.filter((t) => t.status === status); return `<section class="kanban-column" data-column="${status}"><h3>${label}<span>${list.length}</span><button class="tasks-icon" type="button" data-new-status="${status}" title="Nova tarefa nesta coluna">+</button></h3>${list.map(cardMarkup).join("") || `<p class="tasks-column-empty">Arraste tarefas para cá</p>`}</section>`; }).join("")}</div>`;
}

function cardMarkup(t) {
  const due = dueText(t), [pLabel, pClass] = PRIORITY[t.priority || "medium"] || PRIORITY.medium, subs = subtasksOf(t);
  return `<article class="kanban-task tasks-kanban-card ${due.tone}" draggable="true" data-task="${esc(t.id)}"><strong>${esc(t.title)}</strong><small class="${due.tone}">${esc(due.text)}</small>${projectName(t) ? `<small>◈ ${esc(projectName(t))}</small>` : ""}${subs.length ? `<small>${subs.filter(isDone).length}/${subs.length} subtarefas</small>` : ""}<div class="tasks-card-foot"><em class="${pClass}">${pLabel}</em><span class="tasks-actions"><button class="tasks-icon" type="button" data-edit="${esc(t.id)}" title="Editar">✎</button><button class="tasks-icon" type="button" data-delete="${esc(t.id)}" title="Excluir">×</button></span></div></article>`;
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
    const button = quick.querySelector("button"); button.disabled = true;
    try { const { task } = await api("/api/tasks", { method: "POST", body: { title, status: "todo", priority: "medium" } }); state.tasks.unshift(task); draw(); root.querySelector("[data-quick-add] input")?.focus(); }
    catch (error) { notify(error.message, true); button.disabled = false; }
  });

  const search = root.querySelector(".tasks-search");
  search?.addEventListener("input", () => { state.query = search.value; const pos = search.selectionStart; draw(); const again = root.querySelector(".tasks-search"); again?.focus(); again?.setSelectionRange(pos, pos); });
  root.querySelectorAll("[data-filter]").forEach((select) => select.addEventListener("change", () => { state[select.dataset.filter] = select.value; draw(); }));
  root.querySelectorAll("[data-mode]").forEach((b) => b.addEventListener("click", () => { state.mode = b.dataset.mode; localStorage.setItem("focusdev_tasks_mode", state.mode); draw(); }));

  root.querySelectorAll("[data-toggle]").forEach((input) => input.addEventListener("change", async () => {
    const task = find(input.dataset.toggle); if (!task) return;
    const previous = task.status; task.status = input.checked ? "done" : "todo";
    try { await patch(task.id, { status: task.status }); draw(); }
    catch (error) { task.status = previous; input.checked = previous === "done"; notify(error.message, true); }
  }));
  root.querySelectorAll("[data-status]").forEach((select) => select.addEventListener("change", async () => {
    const task = find(select.dataset.status); if (!task) return;
    const previous = task.status; task.status = select.value;
    try { await patch(task.id, { status: task.status }); draw(); } catch (error) { task.status = previous; notify(error.message, true); draw(); }
  }));
  root.querySelectorAll("[data-edit]").forEach((b) => b.addEventListener("click", () => {
    const t = find(b.dataset.edit); if (!t) return;
    openEditDialog("tarefa", { title: t.title, priority: t.priority || "medium", status: t.status, tags: (t.tags || []).join(", "), due_at: t.due_at || "", project_id: t.project_id ? String(t.project_id) : "" }, `/api/tasks/${t.id}`);
  }));
  root.querySelectorAll("[data-subtask]").forEach((b) => b.addEventListener("click", () => { const t = find(b.dataset.subtask); if (t) openSubtaskDialog(t); }));
  root.querySelectorAll("[data-delete]").forEach((b) => b.addEventListener("click", () => {
    const holder = b.closest(".tasks-actions") || b.parentElement;
    const t = find(b.dataset.delete); if (!t || !holder) return;
    const subs = subtasksOf(t).length;
    holder.innerHTML = `<span class="tasks-confirm">${subs ? `Excluir com ${subs} subtarefa${subs === 1 ? "" : "s"}?` : "Excluir?"} <button class="text-action" type="button" data-confirm>Sim</button> <button class="text-action" type="button" data-cancel>Não</button></span>`;
    holder.querySelector("[data-cancel]").addEventListener("click", () => draw());
    holder.querySelector("[data-confirm]").addEventListener("click", async () => {
      try { await api(`/api/tasks/${t.id}`, { method: "DELETE" }); state.tasks = state.tasks.filter((x) => String(x.id) !== String(t.id) && String(x.parent_id) !== String(t.id)); draw(); }
      catch (error) { notify(error.message, true); draw(); }
    });
  }));

  // Kanban: arrastar entre colunas.
  root.querySelectorAll(".tasks-kanban [draggable=true]").forEach((card) => card.addEventListener("dragstart", (event) => { event.dataTransfer.setData("text/plain", card.dataset.task); card.classList.add("is-dragging"); }));
  root.querySelectorAll("[data-column]").forEach((column) => {
    column.addEventListener("dragover", (event) => { event.preventDefault(); column.classList.add("is-drop-target"); });
    column.addEventListener("dragleave", () => column.classList.remove("is-drop-target"));
    column.addEventListener("drop", async (event) => {
      event.preventDefault(); column.classList.remove("is-drop-target");
      const t = find(event.dataTransfer.getData("text/plain")); if (!t || t.status === column.dataset.column) return;
      const previous = t.status; t.status = column.dataset.column;
      try { await patch(t.id, { status: t.status }); draw(); } catch (error) { t.status = previous; notify(error.message, true); draw(); }
    });
  });
}

registerRoutes({ tarefas: renderTasks });
createConfig.tarefa.fields.find((field) => field.name === "priority").options = [["low", "Baixa"], ["medium", "Média"], ["high", "Alta"], ["urgent", "Urgente"]];
createConfig.tarefa.fields.find((field) => field.name === "status").options = [["todo", "Pendente"], ["doing", "Em andamento"], ["waiting_client", "Aguardando cliente"], ["review", "Em revisão"], ["blocked", "Bloqueada"], ["done", "Concluída"], ["cancelled", "Cancelada"]];
createConfig.tarefa.fields.push({ name: "description", label: "Descrição", type: "text", required: false }, { name: "client_id", label: "Cliente", type: "select", options: [["", "Sem cliente"]], required: false }, { name: "stage", label: "Etapa do projeto", required: false }, { name: "assignee", label: "Responsável", required: false }, { name: "starts_at", label: "Data de início", type: "datetime-local", required: false }, { name: "category", label: "Categoria", required: false }, { name: "estimated_minutes", label: "Tempo estimado (minutos)", type: "number", required: false }, { name: "worked_minutes", label: "Tempo trabalhado (minutos)", type: "number", required: false }, { name: "recurrence", label: "Recorrência", type: "select", options: [["none", "Não repetir"], ["daily", "Diária"], ["weekly", "Semanal"], ["monthly", "Mensal"], ["yearly", "Anual"]], required: false }, { name: "blocked_reason", label: "Motivo do bloqueio", required: false }, { name: "internal_notes", label: "Observações internas", required: false });
