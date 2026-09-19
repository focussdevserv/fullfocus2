/* ==========================================================================
   FocusDev — módulo "inicio"
   Tela: Início (painel inicial). Toda informação vem das APIs do workspace;
   nada é inventado. Cada bloco tem estado próprio (carregando / valor /
   indisponível / vazio com ação).
   Ownership: modules/inicio.js, modules/inicio.css
   ========================================================================== */

const PROFILE_KEY = "focusdev_dashboard_profile";
const DAY = 24 * 60 * 60 * 1000;

const brlFormatter = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const dateFormatter = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" });
const timeFormatter = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" });
const topbarDateFormatter = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long" });
const brl = (value) => brlFormatter.format(Number(value || 0));
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const safe = (value) => escapeHtml(value == null ? "" : String(value));
const asDate = (value) => { const date = value instanceof Date ? new Date(value) : new Date(value); return Number.isNaN(date.getTime()) ? null : date; };
const startOfDay = (date = new Date()) => { const d = asDate(date) || new Date(); d.setHours(0, 0, 0, 0); return d; };
const isToday = (value) => { const date = asDate(value); return Boolean(date && date.toDateString() === new Date().toDateString()); };
const sameMonth = (value, ref = new Date()) => { const d = asDate(value); return Boolean(d && d.getMonth() === ref.getMonth() && d.getFullYear() === ref.getFullYear()); };
const previousMonthRef = () => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 1); return d; };
const sum = (list, field = "amount") => list.reduce((acc, item) => acc + Number(item[field] || 0), 0);
const isOpen = (item) => !["paid", "done", "cancelled", "canceled", "won", "lost"].includes(String(item.status || "").toLowerCase()) && !item.paid_at;
const timeOf = (value) => { const date = asDate(value); return date ? timeFormatter.format(date) : "Sem horário"; };
const dateOf = (value) => { const date = asDate(value); return date ? dateFormatter.format(date) : "Sem data"; };

function relativeTime(value) {
  const date = asDate(value);
  if (!date) return "";
  const diff = Date.now() - date.getTime();
  if (diff < 60_000) return "agora";
  if (diff < 3_600_000) return `há ${Math.floor(diff / 60_000)} min`;
  if (diff < DAY) return `há ${Math.floor(diff / 3_600_000)} h`;
  if (diff < 7 * DAY) return `há ${plural(Math.floor(diff / DAY), "dia", "dias")}`;
  return new Intl.DateTimeFormat("pt-BR").format(date);
}

function dueLabel(value) {
  if (!value) return { text: "Sem prazo", tone: "" };
  const days = Math.round((startOfDay(value) - startOfDay()) / DAY);
  if (days < 0) return { text: `Venceu ${plural(-days, "dia", "dias")} atrás`, tone: "is-late" };
  if (days === 0) return { text: `Hoje · ${timeOf(value)}`, tone: "is-today" };
  if (days === 1) return { text: "Amanhã", tone: "" };
  return { text: dateOf(value), tone: "" };
}

const PRIORITY = { urgent: ["Urgente", "priority-high"], high: ["Alta", "priority-high"], medium: ["Média", "priority-medium"], low: ["Baixa", "priority-low"] };

/* ---------------------------------------------------------------------------
   Carregamento
   --------------------------------------------------------------------------- */

const SOURCES = {
  revenues: "/api/revenues", expenses: "/api/expenses", receivables: "/api/receivables",
  leads: "/api/leads", opportunities: "/api/opportunities", tasks: "/api/tasks", events: "/api/events",
  projects: "/api/projects", tickets: "/api/tickets", contacts: "/api/contacts", companies: "/api/companies", activity: "/api/activity",
};

async function loadWorkspace() {
  const keys = Object.keys(SOURCES);
  const results = await Promise.allSettled(keys.map((key) => api(SOURCES[key])));
  const data = {}; const failed = [];
  keys.forEach((key, index) => {
    const result = results[index];
    if (result.status === "fulfilled") data[key] = key === "activity" ? result.value.activities || [] : result.value[key] || [];
    else { data[key] = null; failed.push(key); }
  });
  return { data, failed };
}

/* ---------------------------------------------------------------------------
   Render principal
   --------------------------------------------------------------------------- */

let loadedAt = null;
let homeRequest = 0;

function renderHome() {
  if (location.hash && location.hash !== "#inicio") return;
  const request = homeRequest += 1;
  dashboardGrid.setAttribute("aria-busy", "true");
  dashboardGrid.innerHTML = initialDashboardMarkup;
  bindSkeleton();
  dashboardGrid.querySelector(".dashboard-pulse")?.replaceChildren();
  dashboardGrid.querySelector(".activity-list")?.replaceChildren(Object.assign(document.createElement("p"), { className: "inicio-empty", textContent: "Carregando atividades…" }));
  dashboardGrid.querySelector(".agenda-list")?.replaceChildren(Object.assign(document.createElement("p"), { className: "inicio-empty", textContent: "Carregando eventos…" }));
  const metricKeys = ["revenue", "leads", "tasks", "projects", "receivables", "overdue", "cashflow", "tickets"];
  metricKeys.forEach((key) => setMetric(key, "…", "Carregando"));
  setAvailability("Sincronizando com o workspace…", "loading");
  loadWorkspace().then(({ data, failed }) => {
    if (request !== homeRequest || (location.hash && location.hash !== "#inicio")) return;
    loadedAt = new Date();
    renderMetrics(data);
    renderPulse(data);
    renderPriorities(data.tasks);
    renderAgenda(data.events);
    renderActivity(data);
    renderDueSoon(data.receivables);
    renderOnboarding(data);
    dashboardGrid.removeAttribute("aria-busy");
    if (failed.length) setAvailability(`Workspace parcialmente indisponível: ${failed.map(labelOf).join(", ")} sem resposta.`, "warning");
    else setAvailability(`Dados sincronizados ${relativeTime(loadedAt)} · ${plural(Object.keys(SOURCES).length, "fonte", "fontes")} do workspace.`, "ok");
    renderTopbarStatus(data, failed);
  }).catch((error) => {
    if (request !== homeRequest || (location.hash && location.hash !== "#inicio")) return;
    dashboardGrid.removeAttribute("aria-busy");
    setAvailability(error.message || "Não foi possível sincronizar o workspace.", "error");
    const message = dashboardGrid.querySelector(".workspace-data-status");
    if (message) { message.setAttribute("role", "alert"); message.textContent = error.message || "Não foi possível carregar o workspace. Tente novamente."; }
    dashboardGrid.querySelectorAll(".inicio-empty").forEach((region) => { region.textContent = "Não foi possível carregar este bloco. Tente atualizar os dados."; });
  });
}

/* Linha de status do topo: data de hoje + resumo do dia. */
function renderTopbarStatus(data, failed) {
  const box = document.querySelector(".workspace-data-status");
  if (!box) return;
  const strong = box.querySelector("strong"), span = box.querySelector("span:last-child");
  const today = topbarDateFormatter.format(new Date());
  const openTasks = data.tasks ? data.tasks.filter((t) => t.status !== "done" && isToday(t.due_at)).length : null;
  const eventsToday = data.events ? data.events.filter((e) => isToday(e.starts_at)).length : null;
  const parts = [today.charAt(0).toUpperCase() + today.slice(1)];
  if (openTasks !== null) parts.push(plural(openTasks, "tarefa para hoje", "tarefas para hoje"));
  if (eventsToday !== null) parts.push(plural(eventsToday, "compromisso", "compromissos"));
  if (strong) strong.textContent = failed.length ? "Conexão parcial" : "Workspace conectado";
  if (span) span.textContent = parts.join(" · ");
  box.classList.toggle("is-degraded", failed.length > 0);
}

const labelOf = (key) => ({ revenues: "receitas", expenses: "despesas", receivables: "contas a receber", leads: "leads", opportunities: "oportunidades", tasks: "tarefas", events: "agenda", projects: "projetos", tickets: "tickets", contacts: "contatos", companies: "empresas" })[key] || key;

function bindSkeleton() {
  dashboardGrid.querySelector(".hero-actions .button-light")?.addEventListener("click", () => { location.hash = "#tarefas"; });
  dashboardGrid.querySelector(".hero-link")?.addEventListener("click", toggleHelp);
  dashboardGrid.querySelector(".agenda-card .icon-action")?.addEventListener("click", () => openCreateDialog("evento"));
  const quickKinds = ["tarefa", "lead", "receita", "projeto"];
  dashboardGrid.querySelectorAll(".quick-actions button").forEach((button, index) => {
    const kind = quickKinds[index];
    if (!kind) return;
    button.dataset.create = kind;
    button.addEventListener("click", async () => {
      if (button.dataset.busy === "1") return;
      button.dataset.busy = "1";
      button.disabled = true;
      button.setAttribute("aria-busy", "true");
      try {
        if (typeof window.FocusOpenGlobalCreate === "function") await window.FocusOpenGlobalCreate(kind);
        else openCreateDialog(kind);
      } catch (error) {
        ui.toast(error?.message || "Não foi possível abrir este cadastro.", "error");
      } finally {
        delete button.dataset.busy;
        button.disabled = false;
        button.removeAttribute("aria-busy");
      }
    });
  });
  const select = dashboardGrid.querySelector("#dashboard-profile");
  if (select) {
    select.name = "dashboard_profile";
    select.setAttribute("autocomplete", "off");
    select.value = window.FocusStorage?.get(PROFILE_KEY, "manager") || "manager";
    select.addEventListener("change", (event) => { window.FocusStorage?.set(PROFILE_KEY, event.target.value); window.applyDashboardProfile?.(event.target.value); });
    window.applyDashboardProfile?.(select.value);
  }
  const toolbar = dashboardGrid.querySelector(".dashboard-toolbar");
  if (toolbar && !toolbar.querySelector(".dashboard-refresh")) {
    const button = document.createElement("button");
    button.type = "button"; button.className = "text-action dashboard-refresh"; button.textContent = "Atualizar dados";
    button.addEventListener("click", () => { button.disabled = true; button.textContent = "Atualizando…"; renderHome(); });
    toolbar.append(button);
  }
  const availability = dashboardGrid.querySelector(".workspace-availability");
  availability?.setAttribute("role", "status");
  availability?.setAttribute("aria-live", "polite");
  if (availability && !availability.querySelector(".availability-refresh")) {
    const button = document.createElement("button");
    button.type = "button"; button.className = "text-action availability-refresh"; button.textContent = "Atualizar";
    button.addEventListener("click", renderHome);
    availability.append(button);
  }
}

function toggleHelp() {
  const existing = dashboardGrid.querySelector(".inicio-help-panel");
  if (existing) { existing.remove(); return; }
  const panel = document.createElement("aside");
  panel.className = "data-card inicio-help-panel";
  panel.innerHTML = `<div class="section-heading"><div><p class="card-kicker">Como funciona</p><h2>Seu dia em um só lugar</h2></div><button class="icon-action" type="button" aria-label="Fechar">×</button></div>
    <ol class="inicio-help-list">
      <li><strong>Indicadores</strong> resumem receitas, leads, tarefas, projetos, recebíveis e tickets do workspace.</li>
      <li><strong>Prioridades</strong> mostra as tarefas mais urgentes; marque a caixa para concluir.</li>
      <li><strong>Agenda</strong> lista os compromissos de hoje e os próximos; o “+” cria um evento.</li>
      <li><strong>Ações rápidas</strong> criam tarefa, lead, receita ou projeto sem sair daqui.</li>
      <li>O seletor <strong>Perfil</strong> ajusta quais indicadores aparecem para cada função.</li>
    </ol>`;
  panel.querySelector(".icon-action").addEventListener("click", () => panel.remove());
  dashboardGrid.querySelector(".dashboard-hero")?.after(panel);
}

function setAvailability(text, tone) {
  const box = dashboardGrid.querySelector(".workspace-availability");
  if (!box) return;
  box.dataset.tone = tone;
  const p = box.querySelector("p"); if (p) p.textContent = text;
  const mark = box.querySelector(".availability-mark"); if (mark) mark.textContent = tone === "ok" ? "✓" : tone === "warning" ? "!" : "…";
}

// O status técnico de sincronização não aparece no dashboard; os próprios
// cards exibem carregamento, vazio e erro quando necessário.
function setMetric(key, value, note) {
  const strong = dashboardGrid.querySelector(`[data-metric="${key}"]`);
  if (!strong) return;
  strong.textContent = value;
  const small = strong.closest(".metric-card")?.querySelector("small");
  if (small && note !== undefined) small.textContent = note;
}

/* ---------------------------------------------------------------------------
   Indicadores
   --------------------------------------------------------------------------- */

function renderMetrics({ revenues, expenses, receivables, leads, tasks, projects, tickets }) {
  const unavailable = (key) => setMetric(key, "Indisponível", "Fonte sem resposta");

  if (revenues) {
    const paidThisMonth = sum(revenues.filter((r) => r.paid_at && sameMonth(r.paid_at)));
    const paidLastMonth = sum(revenues.filter((r) => r.paid_at && sameMonth(r.paid_at, previousMonthRef())));
    const delta = paidLastMonth > 0 ? Math.round(((paidThisMonth - paidLastMonth) / paidLastMonth) * 100) : null;
    setMetric("revenue", brl(paidThisMonth), delta === null ? (paidThisMonth ? "Sem base de comparação" : "Nenhuma receita paga no mês") : `${delta >= 0 ? "↑" : "↓"} ${Math.abs(delta)}% vs. mês anterior`);
  } else unavailable("revenue");

  if (leads) {
    const active = leads.filter((l) => !["won", "lost"].includes(String(l.status)));
    const weekAgo = Date.now() - 7 * DAY;
    const fresh = leads.filter((l) => l.created_at && new Date(l.created_at).getTime() >= weekAgo).length;
    setMetric("leads", String(active.length), fresh ? `${plural(fresh, "novo", "novos")} nesta semana` : "Nenhum novo nesta semana");
  } else unavailable("leads");

  if (tasks) {
    const open = tasks.filter((t) => t.status !== "done");
    const today = open.filter((t) => isToday(t.due_at)).length;
    const late = open.filter((t) => t.due_at && new Date(t.due_at) < startOfDay()).length;
    setMetric("tasks", String(open.length), late ? `${plural(late, "atrasada", "atrasadas")} · ${today} para hoje` : `${today} para hoje`);
  } else unavailable("tasks");

  if (projects) {
    const active = projects.filter((p) => !["done", "published", "cancelled", "paused"].includes(String(p.status || "active").toLowerCase()));
    const stalled = active.filter((p) => Number(p.progress || 0) === 0).length;
    setMetric("projects", String(active.length), stalled ? `${plural(stalled, "sem progresso", "sem progresso")}` : active.length ? "Todos em andamento" : "Nenhum projeto ativo");
  } else unavailable("projects");

  if (receivables) {
    const open = receivables.filter(isOpen);
    const late = open.filter((r) => r.due_at && new Date(r.due_at) < startOfDay());
    setMetric("receivables", brl(sum(open)), `${plural(open.length, "lançamento pendente", "lançamentos pendentes")}`);
    setMetric("overdue", brl(sum(late)), late.length ? `${plural(late.length, "precisa de ação", "precisam de ação")}` : "Nada vencido");
  } else { unavailable("receivables"); unavailable("overdue"); }

  if (revenues && expenses) {
    const incoming = sum(revenues.filter((r) => isOpen(r) && sameMonth(r.due_at || r.created_at)));
    const outgoing = sum(expenses.filter((e) => isOpen(e) && sameMonth(e.due_at || e.created_at)));
    setMetric("cashflow", brl(incoming - outgoing), `${brl(incoming)} a receber − ${brl(outgoing)} a pagar`);
  } else unavailable("cashflow");

  if (tickets) {
    const open = tickets.filter((t) => t.status !== "done");
    const urgent = open.filter((t) => ["urgent", "high"].includes(String(t.priority))).length;
    setMetric("tickets", String(open.length), urgent ? `${plural(urgent, "urgente", "urgentes")}` : open.length ? "Nenhum urgente" : "Fila vazia");
  } else unavailable("tickets");
}

/* ---------------------------------------------------------------------------
   Resumo operacional (3 cartões)
   --------------------------------------------------------------------------- */

const STAGES = [["prospecting", "Prospecção"], ["proposal", "Proposta"], ["negotiation", "Negociação"], ["won", "Ganho"], ["lost", "Perdido"]];

function renderPulse({ opportunities, tasks, events }) {
  const box = dashboardGrid.querySelector(".dashboard-pulse");
  if (!box) return;
  let commercial;
  if (opportunities) {
    const open = opportunities.filter((o) => !["won", "lost"].includes(String(o.stage)));
    const won = opportunities.filter((o) => o.stage === "won").length, lost = opportunities.filter((o) => o.stage === "lost").length;
    const conversion = won + lost ? Math.round((won / (won + lost)) * 100) : null;
    const total = sum(open);
    const bars = STAGES.slice(0, 3).map(([stage, label]) => { const value = sum(open.filter((o) => o.stage === stage)); return `<span class="pulse-stage" title="${label}: ${brl(value)}"><i style="width:${total ? Math.max(6, Math.round((value / total) * 100)) : 0}%"></i>${label}</span>`; }).join("");
    commercial = `<span class="card-kicker">Comercial</span><h2>Negócios em andamento</h2><strong>${open.length}</strong><p>${brl(total)} em aberto no funil</p><div class="pulse-stages">${bars}</div><div class="pulse-breakdown"><span>Ganhos <b>${won}</b></span><span>Perdidos <b>${lost}</b></span><span>Conversão <b>${conversion === null ? "—" : `${conversion}%`}</b></span></div><a href="#funil">Abrir funil →</a>`;
  } else commercial = `<span class="card-kicker">Comercial</span><h2>Negócios em andamento</h2><strong>—</strong><p>Oportunidades indisponíveis no momento.</p><a href="#crm">Abrir CRM →</a>`;

  let attention;
  if (tasks) {
    const open = tasks.filter((t) => t.status !== "done");
    const late = open.filter((t) => t.due_at && new Date(t.due_at) < startOfDay());
    const today = open.filter((t) => isToday(t.due_at));
    attention = `<span class="card-kicker">Atenção</span><h2>Tarefas atrasadas</h2><strong class="${late.length ? "pulse-danger" : ""}">${late.length}</strong><p>${late.length ? `${plural(today.length, "vence", "vencem")} hoje · priorize o que bloqueia clientes e projetos.` : today.length ? `Nada atrasado. ${plural(today.length, "tarefa vence", "tarefas vencem")} hoje.` : "Nada atrasado e nada vencendo hoje."}</p><a href="#tarefas">Ver tarefas →</a>`;
  } else attention = `<span class="card-kicker">Atenção</span><h2>Tarefas atrasadas</h2><strong>—</strong><p>Tarefas indisponíveis no momento.</p><a href="#tarefas">Ver tarefas →</a>`;

  let agenda;
  if (events) {
    const upcoming = events.map((e) => ({ ...e, at: new Date(e.starts_at) })).filter((e) => e.at >= new Date()).sort((a, b) => a.at - b.at);
    const today = events.filter((e) => isToday(e.starts_at));
    const next = upcoming[0];
    agenda = `<span class="card-kicker">Próximos compromissos</span><h2>Agenda de hoje</h2><strong>${today.length}</strong><p>${next ? `Próximo: <b>${safe(next.title)}</b> ${isToday(next.starts_at) ? `às ${timeOf(next.starts_at)}` : `em ${dateOf(next.starts_at)} às ${timeOf(next.starts_at)}`}.` : "Nenhum compromisso agendado."}</p><a href="#agenda">Abrir agenda →</a>`;
  } else agenda = `<span class="card-kicker">Próximos compromissos</span><h2>Agenda de hoje</h2><strong>—</strong><p>Agenda indisponível no momento.</p><a href="#agenda">Abrir agenda →</a>`;

  box.innerHTML = [commercial, attention, agenda].map((html) => `<article class="data-card pulse-card">${html}</article>`).join("");
}

/* ---------------------------------------------------------------------------
   Prioridades de hoje
   --------------------------------------------------------------------------- */

function renderPriorities(tasks) {
  const card = dashboardGrid.querySelector(".priorities-card");
  if (!card) return;
  const list = card.querySelector(".priority-list"), count = card.querySelector(".task-count"), progress = card.querySelector(".task-progress strong"), progressBar = card.querySelector(".task-progress i");
  if (!tasks) { list.innerHTML = stateBlock.error("Não foi possível carregar as tarefas.", "inicio-retry"); list.querySelector(".inicio-retry")?.addEventListener("click", renderHome); if (count) count.textContent = "—"; return; }
  const open = tasks.filter((t) => t.status !== "done");
  const done = tasks.length - open.length;
  if (progress) progress.textContent = `${done} de ${tasks.length} concluída${done === 1 ? "" : "s"}`;
  if (progressBar) progressBar.style.width = `${tasks.length ? (done / tasks.length) * 100 : 0}%`;
  const rank = (t) => (t.due_at ? new Date(t.due_at).getTime() : Number.MAX_SAFE_INTEGER);
  const items = open.sort((a, b) => rank(a) - rank(b)).slice(0, 6);
  if (count) count.textContent = `${plural(open.length, "tarefa", "tarefas")}`;
  if (!items.length) {
    list.innerHTML = `<div class="inicio-empty"><p>Nenhuma tarefa aberta. Bom sinal — ou hora de planejar o próximo passo.</p><button class="button button-secondary compact-action" type="button" data-create="tarefa">Criar tarefa</button></div>`;
    list.querySelector("[data-create]").addEventListener("click", () => openCreateDialog("tarefa"));
    return;
  }
  list.innerHTML = items.map((t) => {
    const due = dueLabel(t.due_at); const [label, cls] = PRIORITY[String(t.priority)] || [];
    return `<label class="priority-item ${due.tone}"><input type="checkbox" data-task="${safe(t.id)}" /><span class="checkmark"></span><span class="priority-text"><strong>${safe(t.title)}</strong><small>${safe(due.text)}${t.project_id ? " · projeto" : ""}</small></span>${label ? `<em class="${cls}">${label}</em>` : ""}</label>`;
  }).join("");
  list.querySelectorAll("[data-task]").forEach((input) => input.addEventListener("change", async () => {
    const routeAtStart = location.hash;
    input.disabled = true;
    input.setAttribute("aria-busy", "true");
    try {
      await api(`/api/tasks/${input.dataset.task}`, { method: "PATCH", body: { status: "done" } });
      if (location.hash !== routeAtStart || routeAtStart !== "#inicio" || !input.isConnected) return;
      input.closest(".priority-item")?.classList.add("is-done");
      window.setTimeout(() => { if (location.hash === routeAtStart) renderHome(); }, 450);
    }
    catch (error) {
      if (location.hash !== routeAtStart || !input.isConnected) return;
      input.checked = false;
      input.disabled = false;
      input.removeAttribute("aria-busy");
      if (routeAtStart === "#inicio") ui.toast(error.message || "Não foi possível concluir a tarefa.", "error");
    }
  }));
}

/* ---------------------------------------------------------------------------
   Agenda de hoje (+ próximos dias quando hoje está vazio)
   --------------------------------------------------------------------------- */

function renderAgenda(events) {
  const card = dashboardGrid.querySelector(".agenda-card");
  if (!card) return;
  const list = card.querySelector(".agenda-list");
  if (!events) { list.innerHTML = stateBlock.error("Não foi possível carregar a agenda.", "inicio-retry-agenda"); list.querySelector(".inicio-retry-agenda")?.addEventListener("click", renderHome); return; }
  const sorted = events.map((e) => ({ ...e, at: asDate(e.starts_at) })).filter((e) => e.at).sort((a, b) => a.at - b.at);
  const today = sorted.filter((e) => isToday(e.starts_at));
  const upcoming = sorted.filter((e) => e.at > new Date() && !isToday(e.starts_at)).slice(0, 3);
  const row = (e, withDate = false) => `<article class="agenda-item ${e.at < new Date() && isToday(e.starts_at) ? "is-past" : ""}"><time>${withDate ? `${safe(dateOf(e.starts_at))}<br>` : ""}${safe(timeOf(e.starts_at))}</time><div><strong>${safe(e.title)}</strong><small>${safe(e.description || (e.recurrence && e.recurrence !== "none" ? `Recorrente (${{ daily: "diário", weekly: "semanal", monthly: "mensal" }[e.recurrence] || e.recurrence})` : "Sem descrição"))}</small></div></article>`;
  if (today.length) { list.innerHTML = today.map((e) => row(e)).join(""); return; }
  list.innerHTML = `<div class="inicio-empty"><p>Nenhum evento hoje.</p>${upcoming.length ? `<small>Próximos</small>${upcoming.map((e) => row(e, true)).join("")}` : `<button class="button button-secondary compact-action" type="button" data-create="evento">Agendar evento</button>`}</div>`;
  list.querySelector("[data-create]")?.addEventListener("click", () => openCreateDialog("evento"));
}

/* ---------------------------------------------------------------------------
   Atividade recente (registros mais novos de todo o workspace)
   --------------------------------------------------------------------------- */

const ACTIVITY_KINDS = [
  ["tasks", "Tarefa", "blue", (x) => x.title, "#tarefas"], ["leads", "Lead", "pink", (x) => x.name, "#leads"], ["opportunities", "Oportunidade", "purple", (x) => x.name, "#oportunidades"],
  ["receivables", "Recebível", "green", (x) => x.description, "#contas-a-receber"], ["tickets", "Ticket", "orange", (x) => x.title, "#tickets"], ["contacts", "Contato", "blue", (x) => x.name, "#contatos"], ["companies", "Empresa", "green", (x) => x.name, "#empresas"],
];

const ACTIVITY_ROUTE = {
  leads: "leads", opportunities: "oportunidades", proposals: "propostas", followups: "follow-ups",
  contacts: "contatos", companies: "empresas", clients: "clientes", projects: "projetos",
  tasks: "tarefas", events: "agenda", revenues: "receitas", expenses: "despesas",
  receivables: "contas-a-receber", tickets: "tickets", contracts: "contratos", catalog: "catalogo",
  "catalog-items": "catalogo", organization: "configuracoes", profile: "configuracoes",
  team: "equipe", "team_roles": "equipe", integrations: "integracoes", templates: "templates",
  automations: "automacoes", conversations: "conversas", audit_events: "auditoria",
};
const ACTIVITY_ACTION = { post: "criou", patch: "atualizou", put: "atualizou", delete: "removeu" };

function renderActivity(data) {
  const card = dashboardGrid.querySelector(".activity-card");
  if (!card) return;
  const list = card.querySelector(".activity-list"), toggle = card.querySelector(".text-action");
  const items = data.activity?.length ? data.activity.map((x) => ({ kind: x.entity_type || "Atividade", tone: x.action === "delete" || x.action === "deleted" ? "orange" : "blue", hash: `#${ACTIVITY_ROUTE[x.entity_type] || "auditoria"}`, label: `${x.actor_name || "Workspace"} ${ACTIVITY_ACTION[x.action] || x.action || "registrou atividade em"} ${x.entity_type || "registro"}`, at: x.created_at })) : ACTIVITY_KINDS.flatMap(([key, kind, tone, label, hash]) => (data[key] || []).map((x) => ({ kind, tone, hash, label: label(x) || kind, at: x.updated_at || x.created_at }))).filter((x) => x.at).sort((a, b) => new Date(b.at) - new Date(a.at));
  let expanded = false;
  const draw = () => {
    const shown = items.slice(0, expanded ? 15 : 5);
    list.innerHTML = shown.length ? shown.map((x) => `<a class="activity-item" href="${x.hash}"><span class="activity-avatar ${x.tone}">${safe(x.label.trim().slice(0, 2).toUpperCase())}</span><div><strong>${safe(x.label)}</strong><small>${x.kind} · ${safe(relativeTime(x.at))}</small></div><span class="activity-dot"></span></a>`).join("") : `<div class="inicio-empty"><p>Ainda não há atividade. Ela aparece aqui conforme você cria tarefas, leads e lançamentos.</p></div>`;
    if (toggle) { toggle.hidden = items.length <= 5; toggle.innerHTML = expanded ? "Ver menos <span>↑</span>" : "Ver tudo <span>→</span>"; }
  };
  toggle?.addEventListener("click", () => { expanded = !expanded; draw(); });
  draw();
}

/* ---------------------------------------------------------------------------
   Vencimentos dos próximos 7 dias (contas a receber)
   --------------------------------------------------------------------------- */

function renderDueSoon(receivables) {
  dashboardGrid.querySelector(".inicio-due-card")?.remove();
  if (!receivables) return;
  const limit = startOfDay(); limit.setDate(limit.getDate() + 7);
  const items = receivables.filter(isOpen).map((r) => ({ ...r, dueDate: asDate(r.due_at) })).filter((r) => r.dueDate && r.dueDate <= limit).sort((a, b) => a.dueDate - b.dueDate).slice(0, 5);
  if (!items.length) return;
  const card = document.createElement("section");
  card.className = "data-card inicio-due-card";
  card.innerHTML = `<div class="section-heading"><div><p class="card-kicker">Financeiro</p><h2>Vencendo nos próximos 7 dias</h2></div><a class="text-action" href="#contas-a-receber">Contas a receber <span>→</span></a></div>
    <div class="inicio-due-list">${items.map((r) => { const due = dueLabel(r.due_at); return `<div class="inicio-due-item ${due.tone}"><div><strong>${safe(r.description)}</strong><small>${safe(due.text)}</small></div><b>${brl(r.amount)}</b><button class="text-action" type="button" data-paid="${safe(r.id)}">Recebido</button></div>`; }).join("")}</div>`;
  card.querySelectorAll("[data-paid]").forEach((button) => button.addEventListener("click", async () => {
    const routeAtStart = location.hash;
    button.disabled = true;
    button.setAttribute("aria-busy", "true");
    const originalLabel = button.textContent;
    button.textContent = "Recebendo…";
    try {
      await api(`/api/receivables/${button.dataset.paid}`, { method: "PATCH", body: { status: "paid", paid_at: new Date().toISOString() } });
      if (location.hash === routeAtStart && routeAtStart === "#inicio" && button.isConnected) renderHome();
    }
    catch (error) {
      if (location.hash !== routeAtStart || !button.isConnected) return;
      button.disabled = false;
      button.removeAttribute("aria-busy");
      button.textContent = originalLabel;
      if (routeAtStart === "#inicio") ui.toast(error.message || "Não foi possível registrar o recebimento.", "error");
    }
  }));
  dashboardGrid.querySelector(".quick-actions-card")?.after(card);
}

/* ---------------------------------------------------------------------------
   Primeiros passos (aparece enquanto o workspace está quase vazio)
   --------------------------------------------------------------------------- */

function renderOnboarding(data) {
  dashboardGrid.querySelector(".inicio-onboarding")?.remove();
  const count = (key) => (data[key] ? data[key].length : 0);
  const steps = [
    { done: count("contacts") + count("companies") > 0, label: "Cadastre um contato ou empresa", action: () => { location.hash = "#contatos"; } },
    { done: count("leads") + count("opportunities") > 0, label: "Registre seu primeiro lead", action: () => openCreateDialog("lead") },
    { done: count("tasks") > 0, label: "Crie uma tarefa para hoje", action: () => openCreateDialog("tarefa") },
    { done: count("events") > 0, label: "Agende um compromisso", action: () => openCreateDialog("evento") },
    { done: count("revenues") + count("receivables") > 0, label: "Lance uma receita ou conta a receber", action: () => openCreateDialog("receita") },
    { done: false, label: "Conecte o WhatsApp da operação", action: () => { location.hash = "#whatsapp"; }, key: "whatsapp" },
  ];
  const finished = steps.filter((s) => s.done).length;
  if (finished >= steps.length - 1) return; // workspace já em uso: não insiste
  const card = document.createElement("section");
  card.className = "data-card inicio-onboarding";
  card.innerHTML = `<div class="section-heading"><div><p class="card-kicker">Primeiros passos</p><h2>Deixe o workspace pronto</h2></div><span class="task-count">${finished} de ${steps.length}</span></div>
    <div class="inicio-progress"><i style="width:${Math.round((finished / steps.length) * 100)}%"></i></div>
    <ul class="inicio-steps">${steps.map((s, i) => `<li class="${s.done ? "is-done" : ""}"><span class="inicio-step-mark">${s.done ? "✓" : i + 1}</span><span>${s.label}</span>${s.done ? "" : `<button class="text-action" type="button" data-step="${i}">Fazer agora →</button>`}</li>`).join("")}</ul>`;
  card.querySelectorAll("[data-step]").forEach((button) => button.addEventListener("click", () => steps[Number(button.dataset.step)].action()));
  const anchor = dashboardGrid.querySelector(".workspace-availability") || dashboardGrid.querySelector(".dashboard-toolbar");
  anchor?.after(card);
  // Estado real do WhatsApp (não bloqueia a tela).
  api("/api/whatsapp/status").then((status) => {
    if (location.hash !== "#inicio" || !card.isConnected || status.state !== "open") return;
    const li = card.querySelectorAll(".inicio-steps li")[5];
    if (!li || li.classList.contains("is-done")) return;
    li.classList.add("is-done");
    li.querySelector("button")?.remove();
    const mark = li.querySelector(".inicio-step-mark"); if (mark) mark.textContent = "✓";
    const finishedLabel = card.querySelector(".task-count");
    if (finishedLabel) finishedLabel.textContent = `${steps.filter((step) => step.done || step === steps[5]).length} de ${steps.length}`;
    const progress = card.querySelector(".inicio-progress i");
    if (progress) progress.style.width = `${Math.round((steps.filter((step) => step.done || step === steps[5]).length / steps.length) * 100)}%`;
  }).catch(() => {});
}

registerRoutes({ inicio: renderHome });

new MutationObserver(() => {
  dashboardGrid.querySelectorAll(".workspace-availability, .inicio-empty, [data-metric]").forEach((region) => {
    region.setAttribute("aria-live", "polite");
  });
  dashboardGrid.querySelectorAll("button").forEach((button) => {
    if (button.disabled) button.setAttribute("aria-busy", "true");
    else button.removeAttribute("aria-busy");
  });
}).observe(dashboardGrid, { childList: true, subtree: true, attributes: true, attributeFilter: ["disabled"] });
