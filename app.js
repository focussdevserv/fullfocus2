const $ = (id) => document.getElementById(id);

const loginShell = $("login-shell");
const hero = $("hero");
const loginScreen = $("login-screen");
const resetScreen = $("reset-screen");
const registerScreen = $("register-screen");

const loginForm = $("login-form");
const emailInput = $("email");
const passwordInput = $("password");
const passwordToggle = $("password-toggle");
const loginSubmit = $("login-submit");
const loginStatus = $("login-status");
const forgotButton = $("forgot-button");
const createAccount = $("create-account");

const resetForm = $("reset-form");
const resetEmail = $("reset-email");
const resetSubmit = $("reset-submit");
const resetStatus = $("reset-status");
const backButton = $("back-button");
const registerBack = $("register-back");
const registerForm = $("register-form");
const registerSubmit = $("register-submit");
const registerStatus = $("register-status");

const appShell = $("app-shell");
const appTitle = $("app-title");
const appSidebar = $("app-sidebar");
const sidebarBackdrop = $("sidebar-backdrop");
const mobileMenu = $("mobile-menu");
const topAccountTrigger = $("top-account-trigger");
const topAccountDropdown = $("top-account-dropdown");
const topLogoutButton = $("top-logout-button");
const createMenuTrigger = $("create-menu-trigger");
const createMenu = $("create-menu");
const globalSearch = $("global-search");
const searchResults = $("search-results");
const dashboardGrid = document.querySelector(".dashboard-grid");
const initialDashboardMarkup = dashboardGrid?.innerHTML || "";
const notificationButton = document.querySelector(".notification-button");
const themeButton = document.createElement("button"); themeButton.className = "theme-toggle"; themeButton.type = "button"; themeButton.setAttribute("aria-label", "Alternar tema"); themeButton.textContent = document.body.classList.contains("dark-mode") ? "☾" : "☀"; document.querySelector(".topbar-actions")?.insertBefore(themeButton, document.querySelector(".create-menu-wrap"));
const notificationPanel = document.createElement("div"); notificationPanel.className = "notification-panel"; notificationPanel.hidden = true; notificationPanel.innerHTML = '<div class="section-heading"><h2>Notificações</h2><button type="button" class="notification-close" aria-label="Fechar">×</button></div><div class="notification-list"></div>'; document.body.append(notificationPanel);
const THEME_KEY = "focusdev_theme_v2";
themeButton.addEventListener("click", () => { document.body.classList.toggle("dark-mode"); localStorage.setItem(THEME_KEY, document.body.classList.contains("dark-mode") ? "dark" : "light"); themeButton.textContent = document.body.classList.contains("dark-mode") ? "☾" : "☀"; });
notificationButton?.addEventListener("click", () => { notificationPanel.hidden = !notificationPanel.hidden; }); notificationPanel.querySelector(".notification-close").addEventListener("click", () => { notificationPanel.hidden = true; });

const notificationEnable = document.createElement("button");
notificationEnable.type = "button";
notificationEnable.className = "notification-enable button button-secondary";
notificationEnable.textContent = "Ativar alertas do navegador";
notificationPanel.querySelector(".section-heading")?.after(notificationEnable);
notificationEnable.addEventListener("click", async () => {
  if (!("Notification" in window)) return;
  const permission = await Notification.requestPermission();
  notificationEnable.textContent = permission === "granted" ? "Alertas ativados" : "Permissão não concedida";
  notificationEnable.disabled = permission === "granted";
});
if (!("Notification" in window)) notificationEnable.hidden = true;
if ("Notification" in window && Notification.permission === "granted") { notificationEnable.textContent = "Alertas ativados"; notificationEnable.disabled = true; }

function sendBrowserNotifications(tasks, events) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  const now = Date.now();
  const due = events.filter((event) => { const start = new Date(event.starts_at).getTime(); return start >= now && start - now <= (Number(event.reminder_minutes) || 30) * 60000; }).map((event) => ({ key: "event-" + event.id + "-" + event.starts_at, title: "Próximo evento", body: event.title }));
  const overdue = tasks.filter((task) => task.status !== "done" && task.due_at && new Date(task.due_at).getTime() < now).slice(0, 3).map((task) => ({ key: "task-" + task.id + "-" + task.due_at, title: "Tarefa atrasada", body: task.title }));
  const notified = JSON.parse(localStorage.getItem("focusdev_browser_notifications") || "[]");
  [...due, ...overdue].filter((item) => !notified.includes(item.key)).forEach((item) => { new Notification(item.title, { body: item.body, icon: "/assets/icon-192.svg", tag: item.key }); notified.push(item.key); });
  localStorage.setItem("focusdev_browser_notifications", JSON.stringify(notified.slice(-100)));
}

async function pollBrowserNotifications() {
  try {
    const [tasksResponse, eventsResponse] = await Promise.all([fetch("/api/tasks"), fetch("/api/events")]);
    if (tasksResponse.ok && eventsResponse.ok) sendBrowserNotifications((await tasksResponse.json()).tasks || [], (await eventsResponse.json()).events || []);
  } catch { /* alertas são opcionais quando a API está indisponível */ }
}
window.setInterval(pollBrowserNotifications, 60000);

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SESSION_KEY = "focusdev_session";
// Simula a latência da API enquanto o endpoint de autenticação não existe.
const FAKE_REQUEST_MS = 650;

const wait = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));

createAccount.addEventListener("click", showRegister);
registerBack.addEventListener("click", showLogin);
registerForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const name = $("register-name"), email = $("register-email"), password = $("register-password"), confirm = $("register-confirm");
  [[name, name.value.trim().length >= 2 ? "" : "Informe seu nome."], [email, validateEmail(email)], [password, password.value.length >= 8 ? "" : "A senha deve ter pelo menos 8 caracteres."], [confirm, confirm.value === password.value ? "" : "As senhas não coincidem."]].forEach(([input, error]) => setFieldError(input, error));
  if (registerForm.querySelector(".has-error")) return;
  setLoading(registerSubmit, true); setStatus(registerStatus, "");
  try {
    const response = await fetch("/api/auth/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: name.value.trim(), email: email.value.trim(), password: password.value }) });
    const data = await response.json(); if (!response.ok) throw new Error(data.error || "Não foi possível criar a conta.");
    setLoading(registerSubmit, false); setStatus(registerStatus, "Conta criada! Você já pode entrar."); loginScreen.hidden = false; registerScreen.hidden = true; emailInput.value = email.value; passwordInput.focus();
  } catch (error) { setLoading(registerSubmit, false); setStatus(registerStatus, error.message, "error"); }
});

/* ---------------------------------------------------------------------------
   Utilidades de formulário
   --------------------------------------------------------------------------- */

function setStatus(element, message = "", type = "success") {
  element.textContent = message;
  element.dataset.type = type;
}

function setFieldError(input, message = "") {
  const field = input.closest(".field");
  const error = field.querySelector(".field-error");
  field.classList.toggle("has-error", Boolean(message));
  input.setAttribute("aria-invalid", String(Boolean(message)));
  error.textContent = message;
}

function validateEmail(input) {
  const value = input.value.trim();
  if (!value) return "Informe seu e-mail.";
  if (!EMAIL_PATTERN.test(value)) return "Esse e-mail não parece válido.";
  return "";
}

function setLoading(button, isLoading) {
  button.classList.toggle("is-loading", isLoading);
  button.disabled = isLoading;
}

function clearForm(form, status) {
  form.reset();
  form.querySelectorAll("input").forEach((input) => setFieldError(input, ""));
  setStatus(status, "");
}

function focusFirstError(form) {
  form.querySelector(".field.has-error input")?.focus();
}

/* ---------------------------------------------------------------------------
   Telas
   --------------------------------------------------------------------------- */

function showLogin() {
  appShell.hidden = true;
  loginShell.hidden = false;
  resetScreen.hidden = true;
  registerScreen.hidden = true;
  loginScreen.hidden = false;
  hero.dataset.scene = "login";
}

function showReset() {
  loginScreen.hidden = true;
  resetScreen.hidden = false;
  hero.dataset.scene = "reset";
}

function showRegister() {
  loginScreen.hidden = true;
  resetScreen.hidden = true;
  registerScreen.hidden = false;
  hero.dataset.scene = "login";
  $("register-name").focus();
}

function showApp(user) {
  loginShell.hidden = true;
  appShell.hidden = false;
  closeSidebar();
  closeAccountMenu();
  if (user?.name) {
    const firstName = user.name.trim().split(/\s+/)[0];
    appTitle.textContent = `Bom dia, ${firstName}`;
    document.querySelectorAll(".account-name strong").forEach((element) => { element.textContent = firstName; });
    document.querySelectorAll(".avatar").forEach((element) => { element.textContent = user.name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase(); });
  }
  appTitle.focus();
  syncDashboard();
  loadWeather();
}

function saveSession(user) {
  try { localStorage.setItem(SESSION_KEY, JSON.stringify({ id: user.id, name: user.name, email: user.email })); } catch { /* armazenamento indisponível */ }
}

function restoreSession() {
  try {
    const session = JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
    if (session?.id && session?.name) showApp(session);
  } catch { localStorage.removeItem(SESSION_KEY); }
}

async function syncDashboard() {
  try {
    const response = await fetch("/api/dashboard");
    if (!response.ok) return;
    const data = await response.json();
    Object.entries(data).forEach(([key, value]) => {
      const target = document.querySelector(`[data-metric="${key}"]`);
      if (target) target.textContent = key === "revenue" ? `R$ ${Number(value).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : value;
    });
    await refreshHomePanels();
  } catch { /* API opcional durante o desenvolvimento local */ }
}

async function refreshHomePanels() {
  try {
    const [tasksResponse, eventsResponse] = await Promise.all([fetch("/api/tasks"), fetch("/api/events")]);
    const tasks = tasksResponse.ok ? ((await tasksResponse.json()).tasks || []) : [], events = eventsResponse.ok ? ((await eventsResponse.json()).events || []) : [];
    const taskList = document.querySelector(".priorities-card .priority-list"), agendaList = document.querySelector(".agenda-card .agenda-list"), activityList = document.querySelector(".activity-card .activity-list");
    if (taskList) taskList.innerHTML = tasks.slice(0, 5).map((task) => `<label class="priority-item"><input type="checkbox" data-home-task="${task.id}" ${task.status === "done" ? "checked" : ""} /><span class="checkmark"></span><span class="priority-text"><strong>${escapeHtml(task.title)}</strong><small>${task.due_at ? new Date(task.due_at).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "Sem prazo"}</small></span><em class="priority-${task.priority || "medium"}">${task.priority === "high" ? "Alta" : task.priority === "low" ? "Baixa" : "Média"}</em></label>`).join("") || '<p class="agenda-empty">Nenhuma tarefa cadastrada.</p>';
    taskList?.querySelectorAll("[data-home-task]").forEach((input) => input.addEventListener("change", async () => { await fetch(`/api/tasks/${input.dataset.homeTask}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: input.checked ? "done" : "doing" }) }); refreshHomePanels(); }));
    if (agendaList) agendaList.innerHTML = events.filter((event) => new Date(event.starts_at).toDateString() === new Date().toDateString()).slice(0, 5).map((event) => { const date = new Date(event.starts_at); return `<article class="agenda-item"><time>${date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</time><div><strong>${escapeHtml(event.title)}</strong><small>${escapeHtml(event.description || "Compromisso da agenda")}</small></div></article>`; }).join("") || '<p class="agenda-empty">Nenhum evento para hoje.</p>';
    const openTasks = tasks.filter((task) => task.status !== "done").length, doneTasks = tasks.filter((task) => task.status === "done").length, taskCount = document.querySelector(".priorities-card .task-count"), taskProgress = document.querySelector(".priorities-card .task-progress strong"), taskProgressBar = document.querySelector(".priorities-card .task-progress i"), tasksMetric = document.querySelector(".metric-blue small");
    if (taskCount) taskCount.textContent = `${openTasks} tarefa${openTasks === 1 ? "" : "s"}`; if (taskProgress) taskProgress.textContent = `${doneTasks} de ${tasks.length} concluídas`; if (taskProgressBar) taskProgressBar.style.width = `${tasks.length ? (doneTasks / tasks.length) * 100 : 0}%`; if (tasksMetric) tasksMetric.textContent = `${openTasks} em aberto`;
    if (activityList) activityList.innerHTML = [...tasks.slice(0, 3).map((task) => `<article class="activity-item"><span class="activity-avatar blue">✓</span><div><strong>${task.status === "done" ? "Tarefa concluída" : "Tarefa atualizada"}: ${escapeHtml(task.title)}</strong><small>Agora · Tarefas</small></div><span class="activity-dot"></span></article>`), ...events.slice(0, 2).map((event) => `<article class="activity-item"><span class="activity-avatar pink">◷</span><div><strong>Novo evento: ${escapeHtml(event.title)}</strong><small>Agenda · ${new Date(event.starts_at).toLocaleDateString("pt-BR")}</small></div><span class="activity-dot"></span></article>`)].slice(0, 4).join("") || '<p class="agenda-empty">Nenhuma atividade recente.</p>';
    const now = Date.now(), notifications = [...tasks.filter((task) => task.status !== "done" && task.due_at && new Date(task.due_at).getTime() < now).map((task) => `Tarefa atrasada: ${task.title}`), ...events.filter((event) => new Date(event.starts_at).getTime() >= now && new Date(event.starts_at).getTime() - now <= (Number(event.reminder_minutes) || 30) * 60000).map((event) => `Próximo evento: ${event.title}`)];
    if (notificationButton) { notificationButton.title = notifications.length ? notifications.join("\n") : "Nenhuma notificação"; notificationButton.classList.toggle("has-notifications", notifications.length > 0); const list = notificationPanel.querySelector(".notification-list"); if (list) list.innerHTML = notifications.map((notification) => `<p>${escapeHtml(notification)}</p>`).join("") || '<p class="notification-empty">Tudo em dia.</p>'; }
  } catch { /* mantém o conteúdo local se a API estiver indisponível */ }
}

const weatherLabels = { 0: "Céu limpo", 1: "Predominantemente limpo", 2: "Parcialmente nublado", 3: "Nublado", 45: "Neblina", 48: "Neblina", 51: "Garoa leve", 53: "Garoa", 55: "Garoa forte", 61: "Chuva leve", 63: "Chuva", 65: "Chuva forte", 80: "Pancadas leves", 81: "Pancadas de chuva", 82: "Pancadas fortes", 95: "Trovoada" };
const weatherIcons = { 0: "☀", 1: "🌤", 2: "⛅", 3: "☁", 45: "〰", 48: "〰", 51: "☂", 53: "☂", 55: "☂", 61: "☂", 63: "☂", 65: "☂", 80: "☂", 81: "☂", 82: "☂", 95: "ϟ" };

async function loadWeather() {
  const widget = $("hero-weather");
  if (!widget || !navigator.geolocation) return;
  const position = await new Promise((resolve) => navigator.geolocation.getCurrentPosition(resolve, () => resolve(null), { enableHighAccuracy: false, timeout: 7000, maximumAge: 900000 }));
  const coords = position?.coords || { latitude: -23.5505, longitude: -46.6333 };
  try {
    const params = new URLSearchParams({ latitude: coords.latitude, longitude: coords.longitude, current: "temperature_2m,apparent_temperature,weather_code", timezone: "auto" });
    const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
    if (!response.ok) throw new Error("weather unavailable");
    const data = await response.json();
    const code = data.current.weather_code;
    $("weather-temperature").textContent = `${Math.round(data.current.temperature_2m)}°C`;
    $("weather-summary").textContent = `${weatherLabels[code] || "Condição atual"} · sensação ${Math.round(data.current.apparent_temperature)}°C`;
    widget.querySelector(".weather-symbol").textContent = weatherIcons[code] || "☼";
  } catch {
    $("weather-temperature").textContent = "Indisponível";
    $("weather-summary").textContent = "Tente novamente mais tarde";
  }
}

/* ---------------------------------------------------------------------------
   Login
   --------------------------------------------------------------------------- */

passwordToggle.addEventListener("click", () => {
  const reveal = passwordInput.type === "password";
  passwordInput.type = reveal ? "text" : "password";
  passwordToggle.setAttribute("aria-pressed", String(reveal));
  passwordToggle.setAttribute("aria-label", reveal ? "Ocultar senha" : "Mostrar senha");
  passwordInput.focus();
});

[emailInput, passwordInput].forEach((input) => {
  input.addEventListener("input", () => {
    setFieldError(input, "");
    setStatus(loginStatus, "");
  });
});

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (loginSubmit.disabled) return;

  setFieldError(emailInput, validateEmail(emailInput));
  setFieldError(passwordInput, passwordInput.value ? "" : "Informe sua senha.");

  if (loginForm.querySelector(".has-error")) {
    setStatus(loginStatus, "Revise os campos destacados.", "error");
    focusFirstError(loginForm);
    return;
  }

  setStatus(loginStatus, "");
  setLoading(loginSubmit, true);
  try {
    const response = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: emailInput.value.trim(), password: passwordInput.value }) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Não foi possível entrar.");
    setLoading(loginSubmit, false); clearForm(loginForm, loginStatus); passwordInput.type = "password"; passwordToggle.setAttribute("aria-pressed", "false"); passwordToggle.setAttribute("aria-label", "Mostrar senha"); saveSession(data.user); showApp(data.user);
  } catch (error) { setLoading(loginSubmit, false); setStatus(loginStatus, error.message, "error"); }
});

createAccount.addEventListener("click", () => {
  setStatus(loginStatus, "O cadastro será liberado em breve.");
});

/* ---------------------------------------------------------------------------
   Redefinição de senha
   --------------------------------------------------------------------------- */

forgotButton.addEventListener("click", () => {
  clearForm(resetForm, resetStatus);
  resetEmail.value = emailInput.value.trim();
  showReset();
  resetEmail.focus();
});

backButton.addEventListener("click", () => {
  showLogin();
  emailInput.focus();
});

resetEmail.addEventListener("input", () => {
  setFieldError(resetEmail, "");
  setStatus(resetStatus, "");
});

resetForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (resetSubmit.disabled) return;

  setFieldError(resetEmail, validateEmail(resetEmail));
  if (resetForm.querySelector(".has-error")) {
    focusFirstError(resetForm);
    return;
  }

  setStatus(resetStatus, "");
  setLoading(resetSubmit, true);
  await wait(FAKE_REQUEST_MS);
  setLoading(resetSubmit, false);

  setStatus(resetStatus, `Link enviado para ${resetEmail.value.trim()}. Confira sua caixa de entrada.`);
});

/* ---------------------------------------------------------------------------
   Workspace
   --------------------------------------------------------------------------- */

function openSidebar() {
  appSidebar.classList.add("is-open");
  sidebarBackdrop.hidden = false;
  mobileMenu.setAttribute("aria-expanded", "true");
  mobileMenu.setAttribute("aria-label", "Fechar menu");
}

function closeSidebar() {
  appSidebar.classList.remove("is-open");
  sidebarBackdrop.hidden = true;
  mobileMenu.setAttribute("aria-expanded", "false");
  mobileMenu.setAttribute("aria-label", "Abrir menu");
}

function openAccountMenu() {
  if (topAccountDropdown && topAccountTrigger) { topAccountDropdown.hidden = false; topAccountTrigger.setAttribute("aria-expanded", "true"); }
}

function closeAccountMenu() {
  if (topAccountDropdown && topAccountTrigger) { topAccountDropdown.hidden = true; topAccountTrigger.setAttribute("aria-expanded", "false"); }
}

mobileMenu.addEventListener("click", () => {
  appSidebar.classList.contains("is-open") ? closeSidebar() : openSidebar();
});

sidebarBackdrop.addEventListener("click", closeSidebar);

topAccountTrigger?.addEventListener("click", () => {
  topAccountDropdown.hidden ? openAccountMenu() : closeAccountMenu();
});

createMenuTrigger?.addEventListener("click", () => {
  createMenu.hidden = !createMenu.hidden;
  createMenuTrigger.setAttribute("aria-expanded", String(!createMenu.hidden));
});

const createConfig = {
  tarefa: { title: "Nova tarefa", endpoint: "/api/tasks", fields: [{ name: "title", label: "Título", placeholder: "Ex.: Revisar briefing do cliente" }, { name: "priority", label: "Prioridade", type: "select", options: [["low", "Baixa"], ["medium", "Média"], ["high", "Alta"]] }, { name: "tags", label: "Tags (separe por vírgula)", placeholder: "Ex.: cliente, urgente", required: false }, { name: "dueAt", label: "Prazo (opcional)", type: "datetime-local", placeholder: "", required: false }] },
  lead: { title: "Novo lead", endpoint: "/api/leads", fields: [{ name: "name", label: "Nome", placeholder: "Nome do contato" }, { name: "company", label: "Empresa", placeholder: "Empresa (opcional)" }] },
  receita: { title: "Nova receita", endpoint: "/api/revenues", fields: [{ name: "description", label: "Descrição", placeholder: "Ex.: Mensalidade do projeto" }, { name: "amount", label: "Valor", type: "number", placeholder: "0,00" }] },
  projeto: { title: "Novo projeto", endpoint: "/api/projects", fields: [{ name: "name", label: "Nome do projeto", placeholder: "Ex.: Website institucional" }] }
  ,evento: { title: "Novo evento", endpoint: "/api/events", fields: [{ name: "title", label: "Título", placeholder: "Ex.: Reunião com cliente" }, { name: "startsAt", label: "Data e hora", type: "datetime-local", placeholder: "" }, { name: "description", label: "Descrição", placeholder: "Detalhes (opcional)", required: false }, { name: "recurrence", label: "Recorrência", type: "select", options: [["none", "Não repetir"], ["daily", "Todos os dias"], ["weekly", "Toda semana"], ["monthly", "Todo mês"]] }, { name: "reminderMinutes", label: "Lembrete", type: "select", options: [["0", "Sem lembrete"], ["10", "10 minutos antes"], ["30", "30 minutos antes"], ["60", "1 hora antes"]] }] }
};
const createDialog = document.createElement("div");
createDialog.className = "create-dialog-backdrop";
createDialog.hidden = true;
createDialog.innerHTML = '<form class="create-dialog" id="create-dialog-form"><button class="dialog-close" type="button" aria-label="Fechar">×</button><p class="card-kicker" id="dialog-kicker">Novo registro</p><h2 id="dialog-title"></h2><div id="dialog-fields"></div><p class="dialog-status" id="dialog-status" role="status"></p><div class="dialog-actions"><button class="button button-secondary" id="dialog-cancel" type="button">Cancelar</button><button class="button save-button" type="submit"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h12l2 2v14H5Z"/><path d="M8 4v6h8V4M8 20v-5h8v5"/></svg><span>Salvar</span></button></div></form>';
document.body.append(createDialog);
const dialogForm = $("create-dialog-form"), dialogFields = $("dialog-fields"), dialogTitle = $("dialog-title"), dialogStatus = $("dialog-status");
function closeCreateDialog() { createDialog.hidden = true; dialogForm.reset(); dialogStatus.textContent = ""; }
function openCreateDialog(kind) { const config = createConfig[kind]; if (!config) return; dialogTitle.textContent = config.title; dialogFields.innerHTML = config.fields.map((field) => field.type === "select" ? `<label class="dialog-field">${field.label}<select name="${field.name}">${field.options.map(([value, label]) => `<option value="${value}">${label}</option>`).join("")}</select></label>` : `<label class="dialog-field">${field.label}<input name="${field.name}" type="${field.type || "text"}" placeholder="${field.placeholder || ""}"${field.required === false ? "" : " required"} /></label>`).join(""); dialogForm.dataset.kind = kind; delete dialogForm.dataset.method; delete dialogForm.dataset.endpoint; createDialog.hidden = false; dialogFields.querySelector("input, select")?.focus(); }
function openEditDialog(kind, item, endpoint) { openCreateDialog(kind); dialogTitle.textContent = kind === "evento" ? "Editar evento" : "Editar tarefa"; dialogForm.dataset.method = "PATCH"; dialogForm.dataset.endpoint = endpoint; Object.entries(item).forEach(([name, value]) => { const field = dialogFields.querySelector(`[name="${name}"]`); if (!field || value == null) return; const date = new Date(value); field.value = name === "dueAt" || name === "startsAt" ? new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16) : value; }); }
function openSubtaskDialog(task) { openCreateDialog("tarefa"); dialogTitle.textContent = `Nova subtarefa · ${task.title}`; dialogFields.insertAdjacentHTML("beforeend", `<input type="hidden" name="parentId" value="${task.id}" />`); }
document.querySelectorAll(".create-menu a").forEach((link) => link.addEventListener("click", (event) => { event.preventDefault(); createMenu.hidden = true; createMenuTrigger?.setAttribute("aria-expanded", "false"); const text = link.textContent.toLocaleLowerCase("pt-BR"); openCreateDialog(text.includes("tarefa") ? "tarefa" : text.includes("lead") ? "lead" : text.includes("receita") ? "receita" : "projeto"); }));
document.querySelectorAll(".quick-actions button").forEach((button) => button.addEventListener("click", () => { const text = button.textContent.toLocaleLowerCase("pt-BR"); openCreateDialog(text.includes("tarefa") ? "tarefa" : text.includes("lead") ? "lead" : text.includes("receita") ? "receita" : "projeto"); }));
dialogForm.addEventListener("submit", async (event) => { event.preventDefault(); const config = createConfig[dialogForm.dataset.kind]; const payload = Object.fromEntries(new FormData(dialogForm)); if (payload.amount) payload.amount = payload.amount.replace(",", "."); const submit = dialogForm.querySelector("[type=submit]"); submit.disabled = true; dialogStatus.textContent = "Salvando..."; try { const method = dialogForm.dataset.method || "POST", endpoint = dialogForm.dataset.endpoint || config.endpoint; const response = await fetch(endpoint, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }); const data = response.status === 204 ? {} : await response.json(); if (!response.ok) throw new Error(data.error || "Não foi possível salvar."); const wasAgenda = dialogForm.dataset.kind === "evento", wasTasks = dialogForm.dataset.kind === "tarefa"; closeCreateDialog(); if (wasAgenda) await renderAgendaView(); else if (wasTasks) await renderTasksView(); else await syncDashboard(); } catch (error) { dialogStatus.textContent = error.message; } finally { submit.disabled = false; } });
dialogForm.querySelector(".dialog-close").addEventListener("click", closeCreateDialog); $("dialog-cancel").addEventListener("click", closeCreateDialog);

document.addEventListener("click", (event) => {
  if (topAccountDropdown && !topAccountDropdown.hidden && !event.target.closest(".account-menu")) closeAccountMenu();
  if (createMenu && !createMenu.hidden && !event.target.closest(".create-menu-wrap")) { createMenu.hidden = true; createMenuTrigger?.setAttribute("aria-expanded", "false"); }
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  if (topAccountDropdown && !topAccountDropdown.hidden) {
    closeAccountMenu();
    topAccountTrigger?.focus();
  } else if (appSidebar.classList.contains("is-open")) {
    closeSidebar();
    mobileMenu.focus();
  }
});

document.querySelectorAll(".nav-item").forEach((item) => {
  item.addEventListener("click", () => {
    document.querySelector(".nav-item.is-active")?.classList.remove("is-active");
    item.classList.add("is-active");
    const label = item.textContent.trim();
    appTitle.textContent = item.getAttribute("href") === "#inicio" ? "Bom dia, FocusDev" : label;
    document.querySelector(".eyebrow").textContent = item.closest(".nav-group")?.querySelector("p")?.textContent || "Workspace";
    renderWorkspaceView(item.getAttribute("href"), label);
    closeSidebar();
  });
});

const navIconPaths = {
  inicio: '<path d="m3 11 9-8 9 8v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1Z"/><path d="M9 21v-6h6v6"/>',
  agenda: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18"/>',
  tarefas: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="m8 12 2.5 2.5L16 9"/>',
  'caixa-de-entrada': '<path d="M4 5h16v14H4Z"/><path d="M4 13h4l1.5 2h5L16 13h4M8 9h8"/>',
  leads: '<circle cx="9" cy="8" r="3"/><path d="M3 20c.7-3.4 2.7-5 6-5s5.3 1.6 6 5M16 5.5a3 3 0 0 1 0 5.8M17 15c2.2.5 3.5 2.1 4 5"/>',
  campanhas: '<path d="m4 11 16-6v14L4 13Z"/><path d="M8 14v5M4 11v2M20 10h1"/>',
  funil: '<path d="M4 5h16l-6 7v6l-4 2v-8Z"/>',
  oportunidades: '<circle cx="12" cy="12" r="8"/><path d="m12 7 1.5 3.5L17 12l-3.5 1.5L12 17l-1.5-3.5L7 12l3.5-1.5Z"/>',
  propostas: '<path d="M5 3h10l4 4v14H5Z"/><path d="M15 3v5h5M8 12h8M8 16h6"/>',
  'follow-ups': '<circle cx="12" cy="12" r="8"/><path d="M12 8v5l3 2M16 4l3 2"/>',
  projetos: '<path d="m12 3 8 4.5v9L12 21l-8-4.5v-9Z"/><path d="m4 7.5 8 4.5 8-4.5M12 12v9"/>',
  receitas: '<path d="M4 18V6M4 18h17"/><path d="m7 14 3-4 3 2 5-6"/>',
  conversas: '<path d="M4 5h16v11H8l-4 4Z"/><path d="M8 9h8M8 12h5"/>',
  contatos: '<circle cx="12" cy="8" r="3"/><path d="M5 20c.8-3.5 3.1-5 7-5s6.2 1.5 7 5"/>',
  'consulta-cnpj': '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 7h8M8 11h5M8 15h8M8 18h4"/>',
  clientes: '<path d="M16 20v-1.5a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4V20"/><circle cx="9.5" cy="7" r="3.5"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M17 14.5c2.3.5 3.5 2 4 4"/>',
  'portal-do-cliente': '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M8 14h4M8 17h7"/>',
  empresas: '<rect x="4" y="4" width="16" height="17" rx="2"/><path d="M8 8h2M14 8h2M8 12h2M14 12h2M8 16h2M14 16h2"/>',
  contratos: '<path d="M6 3h9l3 3v15H6Z"/><path d="M15 3v4h4M9 12h6M9 16h5"/>',
  arquivos: '<path d="M4 6a2 2 0 0 1 2-2h5l2 2h5a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z"/>',
  tickets: '<path d="M4 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v3a2 2 0 0 0 0 4v3a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-3a2 2 0 0 0 0-4Z"/><path d="M12 8v1M12 12v1M12 16v1"/>',
  'visao-financeira': '<circle cx="12" cy="12" r="8"/><path d="M12 7v10M15 9.5c-.7-.7-1.6-1-3-1-1.5 0-2.5.8-2.5 2s1 2 2.5 2 2.5.8 2.5 2-1 2-2.5 2c-1.4 0-2.3-.3-3-1"/>',
  despesas: '<path d="M4 18V6M4 18h17"/><path d="m7 9 3 4 3-6 5 4"/>',
  'contas-a-receber': '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 9h10M7 13h4M16 15h.01"/>',
  cobrancas: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',
  assinaturas: '<path d="M4 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z"/><path d="M8 10h8M8 14h5"/>',
  relatorios: '<path d="M5 20V10M12 20V4M19 20v-7"/><path d="M3 20h18"/>',
  catalogo: '<path d="M4 6a2 2 0 0 1 2-2h12v16H6a2 2 0 0 1-2-2Z"/><path d="M8 8h6M8 12h6"/>',
  automacoes: '<path d="m13 2-9 11h7l-1 9 9-11h-7Z"/>',
  templates: '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M4 9h16M9 9v11"/>',
  integracoes: '<circle cx="8" cy="12" r="3"/><circle cx="16" cy="12" r="3"/><path d="M11 12h2"/>',
  equipe: '<circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3 20c.7-3.4 2.7-5 6-5s5.3 1.6 6 5M16 15c2.8.2 4.3 1.7 5 4"/>'
};
document.querySelectorAll(".nav-item").forEach((item) => {
  const key = item.getAttribute("href")?.slice(1);
  item.insertAdjacentHTML("afterbegin", `<svg class="nav-icon" viewBox="0 0 24 24" aria-hidden="true">${navIconPaths[key] || '<circle cx="12" cy="12" r="3"/>'}</svg>`);
});

const views = {
  tarefas: { kicker: "Meu dia", title: "Tarefas", intro: "Organize prioridades e acompanhe o trabalho da equipe.", columns: ["Tarefa", "Responsável", "Prazo", "Status"], rows: [["Revisar briefing do cliente", "Alex Martins", "Hoje, 14:00", "Em andamento"], ["Preparar relatório mensal", "Joana Silva", "Amanhã", "A fazer"], ["Publicar nova campanha", "Rafael Costa", "20 Jun", "Concluída"], ["Validar pagamentos pendentes", "Marina Lopes", "22 Jun", "A fazer"]] },
  leads: { kicker: "CRM", title: "Leads", intro: "Gerencie oportunidades e acompanhe cada conversa.", columns: ["Lead", "Empresa", "Origem", "Etapa"], rows: [["Bruno Almeida", "Nexum", "Indicação", "Qualificação"], ["Carolina Mendes", "Vértice", "Site", "Proposta"], ["Diego Nunes", "Orbit", "Campanha", "Novo lead"], ["Fernanda Reis", "Acme Inc.", "Evento", "Negociação"]] },
  projetos: { kicker: "Operação", title: "Projetos", intro: "Veja o andamento dos projetos e os próximos marcos.", columns: ["Projeto", "Cliente", "Progresso", "Saúde"], rows: [["Website institucional", "Acme Inc.", "78%", "No prazo"], ["Aplicativo mobile", "Vértice", "46%", "Atenção"], ["Campanha de lançamento", "Nexum", "92%", "No prazo"], ["Portal do cliente", "Orbit", "28%", "No prazo"]] },
  receitas: { kicker: "Financeiro", title: "Receitas", intro: "Acompanhe entradas, vencimentos e recebimentos.", columns: ["Descrição", "Cliente", "Vencimento", "Valor"], rows: [["Mensalidade · Website", "Acme Inc.", "Hoje", "R$ 8.400"], ["Projeto · Aplicativo mobile", "Vértice", "22 Jun", "R$ 14.800"], ["Suporte mensal", "Nexum", "30 Jun", "R$ 5.200"], ["Consultoria", "Orbit", "05 Jul", "R$ 3.900"]] },
};

let agendaMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
let agendaSelectedDate = new Date();
let agendaViewMode = "month";
const escapeHtml = (value) => String(value ?? "").replace(/[&<>\"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[character]));

let taskViewMode = "list";
let taskPriorityFilter = "all";
async function renderTasksView(filter = "all", mode = taskViewMode) {
  let tasks = [];
  try { const response = await fetch("/api/tasks"); if (response.ok) tasks = (await response.json()).tasks || []; } catch { /* mantém a tela utilizável sem a API */ }
  const visible = tasks.filter((task) => (filter === "all" || task.status === filter) && (taskPriorityFilter === "all" || (task.priority || "medium") === taskPriorityFilter));
  const open = tasks.filter((task) => task.status !== "done").length, done = tasks.length - open;
  const tags = (task) => (task.tags || []).map((tag) => `<span class="task-tag">${escapeHtml(tag)}</span>`).join(""), progress = (task) => { const children = tasks.filter((item) => String(item.parent_id) === String(task.id)); return children.length ? `<small class="task-progress-label">${children.filter((item) => item.status === "done").length}/${children.length} subtarefas</small>` : ""; };
  const card = (task) => { const priority = task.priority || "medium"; return `<article class="kanban-task" draggable="true" data-kanban-id="${task.id}"><strong>${escapeHtml(task.title)}</strong><small>${task.due_at ? new Date(task.due_at).toLocaleDateString("pt-BR") : "Sem prazo"}</small>${progress(task)}<div class="task-tags">${tags(task)}</div><span class="task-status priority-${priority}">${priority === "high" ? "Alta" : priority === "low" ? "Baixa" : "Média"}</span><div><button class="task-subtask" type="button" data-subtask-task="${task.id}">+</button><button class="task-edit" type="button" data-edit-task="${task.id}">✎</button><button class="task-delete" type="button" data-delete-task="${task.id}">×</button></div></article>`; };
  const rows = visible.length ? visible.map((task) => { const due = task.due_at ? new Date(task.due_at).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "Sem prazo"; const priority = task.priority || "medium"; return `<li class="task-row ${task.status === "done" ? "is-done" : ""}"><label class="task-check"><input type="checkbox" data-task-id="${task.id}" ${task.status === "done" ? "checked" : ""} /><span></span></label><div><strong>${escapeHtml(task.title)}</strong><small>${due}</small>${progress(task)}<span class="task-tags">${tags(task)}</span></div><em class="task-status priority-${priority}">${priority === "high" ? "Alta" : priority === "low" ? "Baixa" : "Média"}</em><button class="task-subtask" type="button" data-subtask-task="${task.id}" aria-label="Adicionar subtarefa">+</button><button class="task-edit" type="button" data-edit-task="${task.id}" aria-label="Editar ${escapeHtml(task.title)}">✎</button><button class="task-delete" type="button" data-delete-task="${task.id}" aria-label="Excluir ${escapeHtml(task.title)}">×</button></li>`; }).join("") : '<li class="task-empty">Nenhuma tarefa encontrada.</li>';
  const columns = [["todo", "A fazer"], ["doing", "Em andamento"], ["blocked", "Bloqueadas"], ["done", "Concluídas"]].map(([status, label]) => `<section class="kanban-column" data-kanban-status="${status}"><h3>${label}<span>${visible.filter((task) => task.status === status).length}</span></h3>${visible.filter((task) => task.status === status).map(card).join("") || '<p class="task-empty">Vazio</p>'}</section>`).join("");
  dashboardGrid.innerHTML = `<section class="page-intro"><div><p class="card-kicker">Meu dia</p><h2>Tarefas</h2><p>Organize prioridades e acompanhe o trabalho da equipe.</p></div><button class="button button-primary compact-action task-new" type="button">+ Nova tarefa</button></section><section class="task-summary"><article class="data-card"><span>Em aberto</span><strong>${open}</strong></article><article class="data-card"><span>Concluídas</span><strong>${done}</strong></article><article class="data-card"><span>Total</span><strong>${tasks.length}</strong></article></section><section class="data-card tasks-card"><div class="section-heading"><div><p class="card-kicker">Organização</p><h2>Minhas tarefas</h2></div><div class="task-toolbar"><select class="task-filter" aria-label="Filtrar tarefas"><option value="all" ${filter === "all" ? "selected" : ""}>Todas</option><option value="todo" ${filter === "todo" ? "selected" : ""}>A fazer</option><option value="doing" ${filter === "doing" ? "selected" : ""}>Em andamento</option><option value="blocked" ${filter === "blocked" ? "selected" : ""}>Bloqueadas</option><option value="done" ${filter === "done" ? "selected" : ""}>Concluídas</option></select><select class="task-priority-filter" aria-label="Filtrar prioridade"><option value="all" ${taskPriorityFilter === "all" ? "selected" : ""}>Todas prioridades</option><option value="high" ${taskPriorityFilter === "high" ? "selected" : ""}>Alta</option><option value="medium" ${taskPriorityFilter === "medium" ? "selected" : ""}>Média</option><option value="low" ${taskPriorityFilter === "low" ? "selected" : ""}>Baixa</option></select><button class="filter-button task-mode" type="button">${mode === "list" ? "Kanban" : "Lista"}</button></div></div>${mode === "list" ? `<ul class="task-list">${rows}</ul>` : `<div class="kanban-board">${columns}</div>`}</section>`;
  dashboardGrid.querySelector(".task-new").addEventListener("click", () => openCreateDialog("tarefa"));
  dashboardGrid.querySelector(".task-filter").addEventListener("change", (event) => renderTasksView(event.target.value, mode));
  dashboardGrid.querySelector(".task-priority-filter").addEventListener("change", (event) => { taskPriorityFilter = event.target.value; renderTasksView(filter, mode); });
  dashboardGrid.querySelector(".task-mode").addEventListener("click", () => { taskViewMode = mode === "list" ? "kanban" : "list"; renderTasksView(filter, taskViewMode); });
  dashboardGrid.querySelectorAll("[data-task-id]").forEach((input) => input.addEventListener("change", async () => { input.disabled = true; try { const response = await fetch(`/api/tasks/${input.dataset.taskId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: input.checked ? "done" : "doing" }) }); if (!response.ok) throw new Error(); await renderTasksView(filter); } catch { input.disabled = false; input.checked = !input.checked; window.alert("Não foi possível atualizar a tarefa."); } }));
  dashboardGrid.querySelectorAll("[data-delete-task]").forEach((button) => button.addEventListener("click", async () => { if (!window.confirm("Excluir esta tarefa?")) return; const response = await fetch(`/api/tasks/${button.dataset.deleteTask}`, { method: "DELETE" }); if (response.ok) renderTasksView(filter); }));
  dashboardGrid.querySelectorAll("[data-edit-task]").forEach((button) => button.addEventListener("click", () => { const task = tasks.find((item) => String(item.id) === button.dataset.editTask); if (task) openEditDialog("tarefa", { title: task.title, priority: task.priority || "medium", tags: (task.tags || []).join(", "), dueAt: task.due_at }, `/api/tasks/${task.id}/details`); }));
  dashboardGrid.querySelectorAll("[data-subtask-task]").forEach((button) => button.addEventListener("click", () => { const task = tasks.find((item) => String(item.id) === button.dataset.subtaskTask); if (task) openSubtaskDialog(task); }));
  dashboardGrid.querySelectorAll("[data-kanban-status]").forEach((column) => { column.addEventListener("dragover", (event) => event.preventDefault()); column.addEventListener("drop", async (event) => { const id = event.dataTransfer.getData("text/plain"); if (!id) return; await fetch(`/api/tasks/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: column.dataset.kanbanStatus }) }); renderTasksView(filter, mode); }); });
  dashboardGrid.querySelectorAll("[data-kanban-id]").forEach((task) => task.addEventListener("dragstart", (event) => event.dataTransfer.setData("text/plain", task.dataset.kanbanId)));
}

async function renderAgendaView() {
  const now = new Date(), year = agendaMonth.getFullYear(), month = agendaMonth.getMonth();
  let events = [];
  try { const response = await fetch("/api/events"); if (response.ok) events = (await response.json()).events || []; } catch { /* permite usar a agenda vazia durante o desenvolvimento */ }
  const monthEvents = events.filter((event) => { const date = new Date(event.starts_at); return date.getFullYear() === year && date.getMonth() === month; });
  const eventsByDay = new Map(monthEvents.map((event) => [new Date(event.starts_at).getDate(), true]));
  const firstDay = new Date(year, month, 1).getDay(), days = new Date(year, month + 1, 0).getDate();
  const cells = Array.from({ length: 42 }, (_, index) => { const day = index - firstDay + 1; if (day < 1 || day > days) return '<span class="calendar-day is-empty"></span>'; const isToday = year === now.getFullYear() && month === now.getMonth() && day === now.getDate(); return `<button class="calendar-day${isToday ? " is-today" : ""}" type="button" data-day="${day}">${day}${eventsByDay.has(day) ? '<i></i>' : ""}</button>`; }).join("");
  const weekStart = new Date(agendaSelectedDate); weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  const weekCells = Array.from({ length: 7 }, (_, index) => { const date = new Date(weekStart); date.setDate(weekStart.getDate() + index); const isToday = date.toDateString() === now.toDateString(), hasEvents = events.some((event) => new Date(event.starts_at).toDateString() === date.toDateString()); return `<button class="calendar-day calendar-week-day${isToday ? " is-today" : ""}${date.toDateString() === agendaSelectedDate.toDateString() ? " is-selected" : ""}" type="button" data-date="${date.toISOString()}"><span>${date.toLocaleDateString("pt-BR", { weekday: "short" })}</span><strong>${date.getDate()}</strong>${hasEvents ? '<i></i>' : ""}</button>`; }).join("");
  const selectedEvents = events.filter((event) => { const date = new Date(event.starts_at); return date.toDateString() === agendaSelectedDate.toDateString(); });
  const eventMarkup = selectedEvents.length ? selectedEvents.map((event, index) => { const date = new Date(event.starts_at), recurrenceLabel = event.recurrence && event.recurrence !== "none" ? ` · ${event.recurrence === "daily" ? "Diário" : event.recurrence === "weekly" ? "Semanal" : "Mensal"}` : "", reminderLabel = Number(event.reminder_minutes) ? ` · Lembrete ${event.reminder_minutes} min` : ""; return `<article class="day-event" draggable="true" data-event-id="${event.id}"><time>${date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</time><div><strong>${escapeHtml(event.title)}</strong><small>${escapeHtml(event.description || "Compromisso da agenda")}${recurrenceLabel}${reminderLabel}</small></div><i class="event-dot ${["blue", "pink", "orange"][index % 3]}"></i><button class="event-edit" type="button" data-edit-event="${event.id}" aria-label="Editar evento">✎</button><button class="event-delete" type="button" data-delete-event="${event.id}" aria-label="Excluir evento">×</button></article>`; }).join("") : '<p class="agenda-empty">Nenhum evento neste dia.</p>';
  const historyEvents = events.filter((event) => new Date(event.starts_at) < now).sort((a, b) => new Date(b.starts_at) - new Date(a.starts_at)).slice(0, 8);
  const historyMarkup = historyEvents.map((event) => { const date = new Date(event.starts_at); return `<article><span class="history-date">${date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}<strong>${date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</strong></span><div><strong>${escapeHtml(event.title)}</strong><small>${escapeHtml(event.description || "Compromisso da agenda")}</small></div><span class="history-status">Concluído</span></article>`; }).join("") || '<p class="agenda-empty">Nenhum compromisso concluído.</p>';
  dashboardGrid.innerHTML = `<section class="page-intro agenda-intro"><div><p class="card-kicker">Organização</p><h2>Agenda</h2><p>Planeje compromissos, reuniões e os próximos passos da equipe.</p></div><button class="button button-primary compact-action agenda-new" type="button">+ Novo evento</button></section><section class="agenda-layout"><section class="data-card calendar-card"><div class="calendar-toolbar"><button class="calendar-nav" type="button" data-agenda-shift="-1" aria-label="Período anterior">‹</button><h2>${agendaViewMode === "month" ? agendaMonth.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }) : "Semana de " + weekStart.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}</h2><div><button class="calendar-nav" type="button" data-agenda-shift="1" aria-label="Próximo período">›</button><button class="filter-button agenda-view-toggle" type="button">${agendaViewMode === "month" ? "Semanal" : "Mensal"}</button></div></div><div class="calendar-weekdays" ${agendaViewMode === "week" ? "hidden" : ""}><span>Dom</span><span>Seg</span><span>Ter</span><span>Qua</span><span>Qui</span><span>Sex</span><span>Sáb</span></div><div class="calendar-grid ${agendaViewMode === "week" ? "is-week-view" : ""}">${agendaViewMode === "month" ? cells : weekCells}</div></section><aside class="data-card day-agenda"><div class="section-heading"><div><p class="card-kicker">${agendaSelectedDate.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}</p><h2>Agenda do dia</h2></div><span class="task-count">${selectedEvents.length} evento${selectedEvents.length === 1 ? "" : "s"}</span></div><div class="day-event-list">${eventMarkup}</div><button class="agenda-add-link" type="button">+ Adicionar compromisso</button></aside></section><section class="data-card agenda-upcoming"><div class="section-heading"><div><p class="card-kicker">Visão geral</p><h2>Próximos compromissos</h2></div><button class="filter-button agenda-export" type="button">Exportar .ics</button></div><div class="upcoming-list">${events.filter((event) => new Date(event.starts_at) >= now).slice(0, 5).map((event) => { const date = new Date(event.starts_at); return `<article><span class="upcoming-date">${date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}<strong>${date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</strong></span><div><strong>${escapeHtml(event.title)}</strong><small>${escapeHtml(event.description || "Compromisso da agenda")}</small></div></article>`; }).join("") || '<p class="agenda-empty">Nenhum próximo compromisso.</p>'}</div></section>`;
  const historyCard = document.createElement("section"); historyCard.className = "data-card agenda-history"; historyCard.innerHTML = `<div class="section-heading"><div><p class="card-kicker">Arquivo</p><h2>Histórico de compromissos</h2></div><span class="task-count">${historyEvents.length} registro${historyEvents.length === 1 ? "" : "s"}</span></div><div class="history-list">${historyMarkup}</div>`; dashboardGrid.append(historyCard);
  dashboardGrid.querySelectorAll(".agenda-new, .agenda-add-link").forEach((button) => button.addEventListener("click", () => { openCreateDialog("evento"); const input = dialogFields.querySelector('[name="startsAt"]'); const date = new Date(agendaSelectedDate); date.setHours(9, 0, 0, 0); if (input) input.value = new Date(date - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16); }));
  dashboardGrid.querySelectorAll("[data-delete-event]").forEach((button) => button.addEventListener("click", async () => { if (!window.confirm("Excluir este evento?")) return; const response = await fetch(`/api/events/${button.dataset.deleteEvent}`, { method: "DELETE" }); if (response.ok) renderAgendaView(); }));
  dashboardGrid.querySelectorAll("[data-edit-event]").forEach((button) => button.addEventListener("click", () => { const event = selectedEvents.find((item) => String(item.id) === button.dataset.editEvent); if (event) openEditDialog("evento", { title: event.title, startsAt: event.starts_at, description: event.description || "", recurrence: event.recurrence || "none", reminderMinutes: String(event.reminder_minutes || 0) }, `/api/events/${event.id}/schedule`); }));
  dashboardGrid.querySelectorAll("[data-agenda-shift]").forEach((button) => button.addEventListener("click", () => { agendaMonth.setMonth(agendaMonth.getMonth() + Number(button.dataset.agendaShift)); renderAgendaView(); }));
  dashboardGrid.querySelector(".agenda-view-toggle").addEventListener("click", () => { agendaViewMode = agendaViewMode === "month" ? "week" : "month"; renderAgendaView(); });
  dashboardGrid.querySelector(".agenda-export").addEventListener("click", () => { const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//FocusDev//Agenda//PT-BR", ...events.map((event) => { const start = new Date(event.starts_at).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z"); return `BEGIN:VEVENT\nUID:${event.id}@focusdev\nDTSTART:${start}\nSUMMARY:${String(event.title).replace(/[\\,;]/g, "\\$&")}\nDESCRIPTION:${String(event.description || "").replace(/[\\,;]/g, "\\$&")}\nEND:VEVENT`; }), "END:VCALENDAR"].join("\n"); const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([lines], { type: "text/calendar" })); link.download = "focusdev-agenda.ics"; link.click(); URL.revokeObjectURL(link.href); });
  dashboardGrid.querySelectorAll(".calendar-day:not(.is-empty):not(.calendar-week-day)").forEach((day) => day.addEventListener("click", () => { agendaSelectedDate = new Date(year, month, Number(day.dataset.day)); renderAgendaView(); }));
  dashboardGrid.querySelectorAll(".calendar-week-day").forEach((day) => day.addEventListener("click", () => { agendaSelectedDate = new Date(day.dataset.date); renderAgendaView(); }));
  dashboardGrid.querySelectorAll(".day-event").forEach((event) => event.addEventListener("dragstart", (drag) => { drag.dataTransfer.setData("text/plain", event.dataset.eventId); event.classList.add("is-dragging"); }));
  dashboardGrid.querySelectorAll(".day-event").forEach((event) => event.addEventListener("dragend", () => event.classList.remove("is-dragging")));
  dashboardGrid.querySelectorAll(".calendar-day:not(.is-empty):not(.calendar-week-day)").forEach((day) => {
    day.addEventListener("dragover", (drag) => { drag.preventDefault(); day.classList.add("is-drop-target"); });
    day.addEventListener("dragleave", () => day.classList.remove("is-drop-target"));
    day.addEventListener("drop", async (drop) => {
      drop.preventDefault(); day.classList.remove("is-drop-target");
      const eventId = drop.dataTransfer.getData("text/plain"); if (!eventId) return;
      const startsAt = new Date(year, month, Number(day.dataset.day), 9, 0);
      try { const response = await fetch(`/api/events/${eventId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ startsAt: startsAt.toISOString() }) }); if (!response.ok) throw new Error(); await renderAgendaView(); } catch { window.alert("Não foi possível mover o evento."); }
    });
  });
}

function renderInboxView() {
  const messages = [
    { sender: "Marina Lopes", subject: "Aprovacao do briefing", preview: "O cliente respondeu e pediu apenas dois ajustes no escopo.", time: "09:42", tag: "Cliente", unread: true },
    { sender: "Equipe FocusDev", subject: "Resumo da semana", preview: "Confira os principais avanços e os proximos marcos do time.", time: "Ontem", tag: "Interno", unread: false },
    { sender: "Alex Martins", subject: "Reuniao confirmada", preview: "Deixei o convite na agenda para quarta-feira as 14h.", time: "12 set", tag: "Agenda", unread: false },
    { sender: "Nexum", subject: "Documentos do projeto", preview: "Os arquivos atualizados ja estao disponiveis para revisao.", time: "10 set", tag: "Projeto", unread: false }
  ];
  dashboardGrid.innerHTML = `<section class="page-intro inbox-intro"><div><p class="card-kicker">Comunicacao</p><h2>Caixa de entrada</h2><p>Centralize conversas, atualizacoes e avisos importantes do workspace.</p></div><button class="button button-primary compact-action inbox-compose" type="button">+ Nova mensagem</button></section><section class="inbox-layout"><aside class="data-card inbox-sidebar"><div class="section-heading"><div><p class="card-kicker">Pastas</p><h2>Mensagens</h2></div><span class="task-count">1 nova</span></div><button class="inbox-folder is-active" type="button"><span>Entrada</span><b>1</b></button><button class="inbox-folder" type="button"><span>Importantes</span><b>0</b></button><button class="inbox-folder" type="button"><span>Enviadas</span><b>0</b></button><button class="inbox-folder" type="button"><span>Arquivadas</span><b>0</b></button><div class="inbox-note"><strong>Foco do dia</strong><span>Responda as mensagens que desbloqueiam o proximo passo.</span></div></aside><section class="data-card inbox-card"><div class="section-heading"><div><p class="card-kicker">Atualizacoes recentes</p><h2>Sua conversa</h2></div><button class="filter-button inbox-filter" type="button">Filtrar <span>⌄</span></button></div><div class="inbox-list">${messages.map((message) => `<article class="inbox-message ${message.unread ? "is-unread" : ""}"><span class="inbox-avatar">${message.sender.split(" ").map((part) => part[0]).join("").slice(0, 2)}</span><div class="inbox-message-body"><div><strong>${message.sender}</strong><time>${message.time}</time></div><h3>${message.subject}</h3><p>${message.preview}</p><span class="inbox-tag">${message.tag}</span></div><button class="inbox-more" type="button" aria-label="Mais opcoes">•••</button></article>`).join("")}</div></section></section>`;
  dashboardGrid.querySelectorAll(".inbox-folder").forEach((folder) => folder.addEventListener("click", () => { dashboardGrid.querySelector(".inbox-folder.is-active")?.classList.remove("is-active"); folder.classList.add("is-active"); }));
}

function renderLeadsView() {
  const leads = [
    ["Bruno Almeida", "Nexum", "Qualificacao", "R$ 24.000", "Novo lead"],
    ["Carolina Mendes", "Vertice", "Proposta", "R$ 18.500", "Proposta"],
    ["Diego Nunes", "Orbit", "Negociacao", "R$ 31.200", "Negociacao"],
    ["Fernanda Reis", "Acme Inc.", "Contato", "R$ 9.800", "Novo lead"]
  ];
  const stages = [["Novo lead", "2", "#3b82f6"], ["Qualificacao", "4", "#8b5cf6"], ["Proposta", "2", "#f59e0b"], ["Negociacao", "1", "#f3132d"]];
  dashboardGrid.innerHTML = `<section class="page-intro leads-intro"><div><p class="card-kicker">CRM</p><h2>Leads</h2><p>Transforme conversas em oportunidades e mantenha cada etapa sob controle.</p></div><button class="button button-primary compact-action lead-new" type="button">+ Novo lead</button></section><section class="lead-funnel">${stages.map(([name, count, color]) => `<article class="lead-stage" style="--stage-color:${color}"><span>${name}</span><strong>${count}</strong><small>oportunidades</small></article>`).join("")}</section><section class="data-card leads-card"><div class="section-heading"><div><p class="card-kicker">Pipeline comercial</p><h2>Oportunidades recentes</h2></div><button class="filter-button" type="button">Filtrar <span>⌄</span></button></div><div class="lead-list">${leads.map(([name, company, stage, value, tag]) => `<article class="lead-row"><span class="lead-avatar">${name.split(" ").map((part) => part[0]).join("").slice(0, 2)}</span><div><strong>${name}</strong><small>${company}</small></div><span class="lead-stage-name">${stage}</span><strong class="lead-value">${value}</strong><span class="inbox-tag">${tag}</span><button class="inbox-more" type="button" aria-label="Mais opcoes">•••</button></article>`).join("")}</div></section>`;
  dashboardGrid.querySelector(".lead-new")?.addEventListener("click", () => openCreateDialog("lead"));
}

function renderCampaignsView() {
  const campaigns = [["Lançamento FocusDev", "Instagram · Meta Ads", "R$ 12.400", "24,8%", "Ativa", "spiderman-card-hero.png"], ["Retargeting Nexum", "Google · Display", "R$ 8.960", "18,2%", "Ativa", "spiderman-card-web.png"], ["Conteúdo de autoridade", "LinkedIn · Orgânico", "R$ 0", "11,4%", "Rascunho", "spiderman-card-duo.png"]];
  dashboardGrid.innerHTML = `<section class="page-intro campaigns-intro"><div><p class="card-kicker">Marketing</p><h2>Campanhas</h2><p>Planeje, acompanhe e otimize suas ações em um só lugar.</p></div><button class="button button-primary compact-action campaign-new" type="button">+ Nova campanha</button></section><section class="campaign-metrics"><article class="data-card"><span>Investimento total</span><strong>R$ 21.360</strong><small class="positive">↑ 12,8% este mês</small></article><article class="data-card"><span>Conversões</span><strong>184</strong><small class="positive">↑ 8,4% contra o período anterior</small></article><article class="data-card"><span>ROI médio</span><strong>3,8x</strong><small class="neutral">Todas as campanhas</small></article></section><section class="data-card campaigns-card"><div class="section-heading"><div><p class="card-kicker">Visão geral</p><h2>Campanhas recentes</h2></div><button class="filter-button" type="button">Filtrar <span>⌄</span></button></div><div class="campaign-list">${campaigns.map(([name, channel, spend, ctr, status, image]) => `<article class="campaign-row" style="--campaign-image:url('assets/${image}')"><div class="campaign-thumb"></div><div class="campaign-main"><strong>${name}</strong><small>${channel}</small><div class="campaign-progress"><span style="width:${status === "Rascunho" ? "32" : "78"}%"></span></div></div><div class="campaign-stat"><small>Investimento</small><strong>${spend}</strong></div><div class="campaign-stat"><small>CTR</small><strong>${ctr}</strong></div><span class="campaign-status ${status === "Ativa" ? "is-active" : "is-draft"}">${status}</span><button class="inbox-more" type="button" aria-label="Mais opcoes">•••</button></article>`).join("")}</div></section>`;
}

function renderWorkspaceView(hash, label) {
  if (!dashboardGrid) return;
  const key = hash?.replace("#", "");
  if (key === "inicio") {
    dashboardGrid.innerHTML = initialDashboardMarkup;
    return;
  }
  if (key === "agenda") { renderAgendaView(); return; }
  if (key === "tarefas") { renderTasksView(); return; }
  if (key === "caixa-de-entrada") { renderInboxView(); return; }
  if (key === "leads") { renderLeadsView(); return; }
  if (key === "campanhas") { renderCampaignsView(); return; }
  const view = views[key] || { kicker: document.querySelector(".eyebrow").textContent, title: label, intro: "Esta área está pronta para receber seus dados.", columns: ["Item", "Responsável", "Atualização", "Status"], rows: [["Nenhum registro carregado", "—", "Agora", "Aguardando dados"]] };
  dashboardGrid.innerHTML = `<section class="page-intro"><div><p class="card-kicker">${view.kicker}</p><h2>${view.title}</h2><p>${view.intro}</p></div><button class="button button-primary compact-action" type="button">+ Novo</button></section><section class="data-card table-card"><div class="section-heading"><div><p class="card-kicker">Visão geral</p><h2>Registros recentes</h2></div><button class="filter-button" type="button">Filtrar <span>⌄</span></button></div><div class="table-wrap"><table><thead><tr>${view.columns.map((column) => `<th>${column}</th>`).join("")}</tr></thead><tbody>${view.rows.map((row) => `<tr>${row.map((cell, index) => `<td class="${index === row.length - 1 ? "status-cell" : ""}">${cell}</td>`).join("")}</tr>`).join("")}</tbody></table></div></section><section class="quick-summary"><article class="data-card"><span class="metric-label">Total de registros</span><strong>${view.rows.length}</strong><small class="positive">↑ 4,2% este mês</small></article><article class="data-card"><span class="metric-label">Atualizados hoje</span><strong>08</strong><small class="neutral">Última atualização há 12 min</small></article><article class="data-card"><span class="metric-label">Precisam de atenção</span><strong>03</strong><small class="warning">Verificar pendências</small></article></section>`;
}

const searchableItems = [...document.querySelectorAll(".nav-item")];
function renderSearchResults(query) {
  const normalized = query.trim().toLocaleLowerCase("pt-BR");
  if (!normalized) {
    searchResults.hidden = true;
    searchResults.innerHTML = "";
    return;
  }
  const matches = searchableItems.filter((item) => item.textContent.toLocaleLowerCase("pt-BR").includes(normalized)).slice(0, 6);
  searchResults.innerHTML = matches.length
    ? matches.map((item) => `<a href="${item.getAttribute("href")}">${item.textContent.trim()}</a>`).join("")
    : '<span style="display:block;padding:10px;color:#6d7f95;font-size:12px">Nenhum resultado encontrado.</span>';
  searchResults.hidden = false;
}

globalSearch?.addEventListener("input", () => renderSearchResults(globalSearch.value));
globalSearch?.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    globalSearch.value = "";
    renderSearchResults("");
    globalSearch.blur();
  }
});
searchResults?.addEventListener("click", (event) => {
  const link = event.target.closest("a");
  if (!link) return;
  const target = searchableItems.find((item) => item.getAttribute("href") === link.getAttribute("href"));
  if (!target) return;
  event.preventDefault();
  target.click();
  globalSearch.value = "";
  renderSearchResults("");
});
document.addEventListener("click", (event) => {
  if (!event.target.closest(".global-search") && !event.target.closest(".search-results")) renderSearchResults("");
});
document.addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    globalSearch?.focus();
  }
});

topLogoutButton?.addEventListener("click", () => {
  closeAccountMenu();
  localStorage.removeItem(SESSION_KEY);
  showLogin();
  emailInput.focus();
});

restoreSession();
const initialRoute = document.querySelector(`.nav-item[href="${window.location.hash || "#inicio"}"]`);
if (initialRoute) initialRoute.click();
