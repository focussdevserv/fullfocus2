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
  crm: '<circle cx="8" cy="8" r="3"/><circle cx="16" cy="8" r="3"/><path d="M3 20c.7-3.4 2.7-5 5-5s4.3 1.6 5 5M11 20c.7-3 2.4-4.4 5-4.4 2.5 0 4.4 1.4 5 4.4"/>',
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

const operationsModules = {
  contratos: { kicker: "Operação", title: "Contratos", intro: "Controle vigências, assinaturas e obrigações de cada parceria.", art: "spiderman-card-hero.png", action: "Novo contrato", metrics: [["Ativos", "18", "2 vencem este mês", "warning"], ["Em assinatura", "04", "Aguardando cliente", "neutral"], ["Valor anual", "R$ 428 mil", "↑ 12,8% no ciclo", "positive"]], columns: ["Contrato", "Cliente", "Vigência", "Status"], rows: [["Retainer de produto", "Acme Inc.", "30 set 2026", "Ativo"], ["Desenvolvimento mobile", "Vértice", "18 out 2026", "Em assinatura"], ["Suporte e evolução", "Nexum", "04 nov 2026", "Renovação"], ["Consultoria de dados", "Orbit", "12 dez 2026", "Ativo"]] },
  projetos: { kicker: "Operação", title: "Projetos", intro: "Acompanhe entregas, marcos e a saúde do portfólio em um só lugar.", art: "spiderman-card-web.png", action: "Novo projeto", metrics: [["Em andamento", "12", "3 precisam de atenção", "warning"], ["Entregas no mês", "28", "↑ 18% vs. anterior", "positive"], ["Horas alocadas", "1.248h", "82% da capacidade", "neutral"]], columns: ["Projeto", "Cliente", "Progresso", "Saúde"], rows: [["Website institucional", "Acme Inc.", "78%", "No prazo"], ["Aplicativo mobile", "Vértice", "46%", "Atenção"], ["Campanha de lançamento", "Nexum", "92%", "No prazo"], ["Portal do cliente", "Orbit", "28%", "Bloqueado"]] },
  arquivos: { kicker: "Biblioteca", title: "Arquivos", intro: "Encontre documentos, assets e entregáveis compartilhados pela equipe.", art: "spiderman-card-duo.png", action: "Enviar arquivo", metrics: [["Arquivos", "486", "34 adicionados hoje", "positive"], ["Armazenamento", "68%", "6,8 GB de 10 GB", "neutral"], ["Compartilhados", "124", "9 aguardam revisão", "warning"]], columns: ["Arquivo", "Pasta", "Atualizado", "Acesso"], rows: [["Briefing institucional.pdf", "Acme Inc.", "Hoje, 10:42", "Equipe"], ["Design system v3.fig", "Produto", "Ontem, 16:20", "Equipe"], ["Contrato-suporte.docx", "Contratos", "12 set 2026", "Restrito"], ["Fotos campanha.zip", "Marketing", "10 set 2026", "Cliente"]] },
  tickets: { kicker: "Operação", title: "Tickets", intro: "Priorize solicitações e mantenha clientes informados até a resolução.", art: "spiderman-card-bg.png", action: "Abrir ticket", metrics: [["Em aberto", "24", "6 alta prioridade", "warning"], ["SLA cumprido", "94%", "↑ 3,4% esta semana", "positive"], ["Tempo médio", "3h 18m", "Dentro da meta de 4h", "neutral"]], columns: ["Ticket", "Solicitante", "Atualizado", "Status"], rows: [["#1048 · Ajuste no checkout", "Marina Lopes", "há 12 min", "Em atendimento"], ["#1045 · Acesso ao portal", "Acme Inc.", "há 1h", "Aguardando cliente"], ["#1041 · Exportação de dados", "Nexum", "há 3h", "Resolvido"], ["#1038 · Erro no relatório", "Orbit", "ontem", "Alta prioridade"]] },
  relatorios: { kicker: "Visão financeira", title: "Relatórios", intro: "Transforme os dados do workspace em decisões mais rápidas.", art: "agenda-spider-split.png", action: "Criar relatório", metrics: [["Relatórios salvos", "16", "4 favoritos da equipe", "neutral"], ["Agendados", "07", "Próximo: segunda, 08:00", "positive"], ["Visualizações", "1.284", "↑ 22% no período", "positive"]], columns: ["Relatório", "Área", "Última execução", "Status"], rows: [["Receita por cliente", "Financeiro", "Hoje, 08:00", "Atualizado"], ["Performance de projetos", "Operação", "Ontem, 18:30", "Agendado"], ["Pipeline comercial", "CRM", "12 set 2026", "Atualizado"], ["SLA de atendimento", "Tickets", "10 set 2026", "Precisa revisão"]] },
  catalogo: { kicker: "Catálogo", title: "Catálogo", intro: "Organize serviços, pacotes e itens que alimentam suas propostas.", art: "spiderman-card-hero.png", action: "Novo item", metrics: [["Itens ativos", "32", "5 categorias publicadas", "positive"], ["Mais vendido", "Sprint de produto", "14 vendas no trimestre", "neutral"], ["Rascunhos", "06", "Prontos para revisão", "warning"]], columns: ["Item", "Categoria", "Preço base", "Status"], rows: [["Sprint de produto", "Consultoria", "R$ 8.400", "Publicado"], ["Landing page premium", "Design", "R$ 4.800", "Publicado"], ["Suporte contínuo", "Operação", "R$ 2.200/mês", "Publicado"], ["Discovery workshop", "Estratégia", "R$ 3.600", "Rascunho"]] },
  automacoes: { kicker: "Configuração", title: "Automações", intro: "Deixe o workspace cuidar das rotinas para sua equipe focar no que importa.", art: "spiderman-hanging.png", action: "Nova automação", metrics: [["Ativas", "14", "1.860 execuções no mês", "positive"], ["Economia", "42h", "Tempo poupado estimado", "neutral"], ["Alertas", "02", "Requerem atenção", "warning"]], columns: ["Automação", "Gatilho", "Última execução", "Status"], rows: [["Avisar contrato próximo do vencimento", "30 dias antes", "Hoje, 07:00", "Ativa"], ["Criar tarefa de onboarding", "Novo cliente", "Hoje, 09:14", "Ativa"], ["Resumo semanal de projetos", "Toda sexta", "12 set 2026", "Ativa"], ["Notificar SLA estourado", "Ticket vencido", "11 set 2026", "Pausada"]] },
  templates: { kicker: "Configuração", title: "Templates", intro: "Crie uma base consistente para propostas, documentos e comunicações.", art: "agenda-spider-mask.png", action: "Novo template", metrics: [["Disponíveis", "28", "9 usados esta semana", "positive"], ["Favoritos", "08", "Compartilhados pela equipe", "neutral"], ["Em revisão", "03", "Aguardando aprovação", "warning"]], columns: ["Template", "Tipo", "Atualizado", "Uso"], rows: [["Proposta comercial 2026", "Proposta", "Hoje, 11:20", "18 usos"], ["Briefing de projeto", "Documento", "Ontem, 15:42", "12 usos"], ["E-mail de follow-up", "Comunicação", "10 set 2026", "34 usos"], ["Relatório executivo", "Relatório", "08 set 2026", "Em revisão"]] },
  integracoes: { kicker: "Configuração", title: "Integrações", intro: "Conecte as ferramentas que sua operação já usa e mantenha tudo sincronizado.", art: "spiderman-card-web.png", action: "Conectar app", metrics: [["Conectadas", "09", "Todas operando normalmente", "positive"], ["Eventos hoje", "2.406", "Sincronizados automaticamente", "neutral"], ["Com atenção", "01", "Token expira em 7 dias", "warning"]], columns: ["Integração", "Categoria", "Última sincronização", "Status"], rows: [["Google Calendar", "Produtividade", "Agora", "Conectada"], ["Slack", "Comunicação", "há 2 min", "Conectada"], ["Stripe", "Financeiro", "há 8 min", "Conectada"], ["HubSpot", "CRM", "há 1 dia", "Reautorizar"]] },
  equipe: { kicker: "Configuração", title: "Equipe", intro: "Dê visibilidade aos papéis, acessos e capacidade de quem faz o trabalho acontecer.", art: "spiderman-card-duo.png", action: "Convidar pessoa", metrics: [["Pessoas ativas", "24", "3 convites pendentes", "positive"], ["Times", "06", "Operação é o maior", "neutral"], ["Acessos para revisar", "04", "Próxima revisão em 5 dias", "warning"]], columns: ["Pessoa", "Time", "Última atividade", "Acesso"], rows: [["Marina Lopes", "Operação", "Agora", "Administrador"], ["Alex Martins", "Produto", "há 12 min", "Editor"], ["Joana Silva", "Financeiro", "há 1h", "Editor"], ["Rafael Costa", "Comercial", "ontem", "Colaborador"]] },
  configuracoes: { kicker: "Configuração", title: "Configurações", intro: "Ajuste preferências, permissões e identidade do seu workspace.", art: "spiderman-card-bg.png", action: "Salvar alterações", metrics: [["Perfil do workspace", "100%", "Informações completas", "positive"], ["Preferências", "12", "Tudo sincronizado", "neutral"], ["Pendências", "02", "Revisar permissões", "warning"]], columns: ["Preferência", "Área", "Atualização", "Status"], rows: [["Identidade visual", "Workspace", "Hoje, 09:30", "Configurado"], ["Notificações", "Preferências", "12 set 2026", "Configurado"], ["Papéis e permissões", "Segurança", "11 set 2026", "Revisar"], ["Faturamento", "Conta", "01 set 2026", "Configurado"]] }
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

function renderFunnelView() {
  const stages = [
    ["Entrada", "12 leads", "R$ 86.400", "spiderman-card-web.png", [["Lucas Andrade", "Nexum", "R$ 12.000"], ["Marina Lopes", "Orbit", "R$ 8.400"]]],
    ["Qualificacao", "8 leads", "R$ 64.800", "spiderman-card-duo.png", [["Bruno Almeida", "Acme Inc.", "R$ 24.000"], ["Fernanda Reis", "Vertice", "R$ 18.500"]]],
    ["Proposta", "4 leads", "R$ 42.300", "spiderman-card-hero.png", [["Carolina Mendes", "Vértice", "R$ 18.500"], ["Diego Nunes", "Orbit", "R$ 23.800"]]],
    ["Fechamento", "2 leads", "R$ 31.200", "agenda-spider-red-emblem.png", [["Rafael Costa", "Nexum", "R$ 17.200"], ["Joana Silva", "Acme Inc.", "R$ 14.000"]]]
  ];
  dashboardGrid.innerHTML = `<section class="page-intro funnel-intro"><div><p class="card-kicker">CRM</p><h2>Funil de vendas</h2><p>Visualize o caminho de cada oportunidade e saiba onde agir agora.</p></div><button class="button button-primary compact-action funnel-new" type="button">+ Nova oportunidade</button></section><section class="funnel-toolbar"><div><strong>Pipeline comercial</strong><span>26 oportunidades em andamento</span></div><div><button class="filter-button funnel-filter" type="button">Todos os responsáveis</button><button class="filter-button funnel-view" type="button">▦ Compacto</button></div></section><section class="funnel-board">${stages.map(([name, count, total, image, cards]) => `<section class="funnel-column" style="--funnel-image:url('assets/${image}')"><header><div><h3>${name}</h3><span>${count}</span></div><strong>${total}</strong></header><div class="funnel-column-list">${cards.map(([person, company, value]) => `<article class="funnel-opportunity"><div class="funnel-opportunity-top"><span class="lead-avatar">${person.split(" ").map((part) => part[0]).join("").slice(0, 2)}</span><button class="inbox-more" type="button" aria-label="Mais opcoes">•••</button></div><strong>${person}</strong><small>${company}</small><div><b>${value}</b><span>Atualizado hoje</span></div></article>`).join("")}<button class="funnel-add" type="button">+ Adicionar oportunidade</button></div></section>`).join("")}</section>`;
  dashboardGrid.querySelector(".funnel-new")?.addEventListener("click", () => openCreateDialog("lead"));
  dashboardGrid.querySelectorAll(".funnel-add").forEach((button) => button.addEventListener("click", () => openCreateDialog("lead")));
}

function renderOpportunitiesView() {
  const opportunities = [["Website institucional", "Acme Inc.", "R$ 24.000", "78%", "30 set", "Alta"], ["Aplicativo mobile", "Vertice", "R$ 42.800", "54%", "14 out", "Media"], ["Campanha de lancamento", "Nexum", "R$ 18.400", "32%", "22 out", "Baixa"], ["Portal do cliente", "Orbit", "R$ 31.200", "86%", "28 set", "Alta"]];
  dashboardGrid.innerHTML = `<section class="page-intro opportunities-intro"><div><p class="card-kicker">CRM</p><h2>Oportunidades</h2><p>Priorize negociações pelo valor, probabilidade e próximo passo.</p></div><button class="button button-primary compact-action opportunity-new" type="button">+ Nova oportunidade</button></section><section class="opportunity-summary"><article class="data-card"><span>Pipeline total</span><strong>R$ 116.400</strong><small class="positive">↑ 18,4% no mês</small></article><article class="data-card"><span>Valor ponderado</span><strong>R$ 72.860</strong><small class="neutral">Por probabilidade de fechamento</small></article><article class="data-card"><span>Fechamento previsto</span><strong>3</strong><small class="warning">Precisam de atenção</small></article></section><section class="data-card opportunities-card"><div class="section-heading"><div><p class="card-kicker">Negociações abertas</p><h2>Carteira comercial</h2></div><div class="opportunity-actions"><button class="filter-button" type="button">Filtros</button><button class="filter-button" type="button">Exportar</button></div></div><div class="opportunity-list">${opportunities.map(([name, company, value, probability, due, priority]) => `<article class="opportunity-row"><span class="opportunity-icon">◈</span><div class="opportunity-name"><strong>${name}</strong><small>${company}</small></div><div><small>Valor</small><strong>${value}</strong></div><div><small>Chance</small><strong>${probability}</strong></div><div><small>Próximo passo</small><strong>${due}</strong></div><span class="priority-pill priority-${priority.toLowerCase()}">${priority}</span><button class="inbox-more" type="button" aria-label="Mais opcoes">•••</button></article>`).join("")}</div></section>`;
  dashboardGrid.querySelector(".opportunity-new")?.addEventListener("click", () => openCreateDialog("lead"));
}

function renderProposalsView() {
  const proposals = [["Proposta comercial · Website", "Acme Inc.", "R$ 24.000", "Enviada", "28 set", "spiderman-card-hero.png"], ["Escopo aplicativo mobile", "Vertice", "R$ 42.800", "Em revisao", "02 out", "spiderman-card-web.png"], ["Plano de crescimento Q4", "Nexum", "R$ 18.400", "Rascunho", "—", "spiderman-card-duo.png"]];
  dashboardGrid.innerHTML = `<section class="page-intro proposals-intro"><div><p class="card-kicker">CRM</p><h2>Propostas</h2><p>Crie propostas claras, acompanhe respostas e acelere o fechamento.</p></div><button class="button button-primary compact-action proposal-new" type="button">+ Nova proposta</button></section><section class="proposal-stats"><article class="data-card"><span>Em aberto</span><strong>02</strong><small>R$ 66.800 em negociação</small></article><article class="data-card"><span>Taxa de aceite</span><strong>68%</strong><small class="positive">↑ 6,2% este mês</small></article><article class="data-card"><span>Tempo médio</span><strong>4,2 dias</strong><small>Da criação ao envio</small></article></section><section class="data-card proposals-card"><div class="section-heading"><div><p class="card-kicker">Documentos comerciais</p><h2>Propostas recentes</h2></div><button class="filter-button" type="button">Filtrar <span>⌄</span></button></div><div class="proposal-list">${proposals.map(([name, client, value, status, due, image]) => `<article class="proposal-row"><div class="proposal-cover" style="--proposal-image:url('assets/${image}')"><span>PDF</span></div><div class="proposal-main"><strong>${name}</strong><small>${client}</small><div><span>${value}</span><em>${due === "—" ? "Sem prazo" : `Válida até ${due}`}</em></div></div><span class="proposal-status proposal-${status.toLowerCase().replace(" ", "-")}">${status}</span><button class="filter-button proposal-open" type="button">Abrir</button><button class="inbox-more" type="button" aria-label="Mais opcoes">•••</button></article>`).join("")}</div></section>`;
  dashboardGrid.querySelector(".proposal-new")?.addEventListener("click", () => openCreateDialog("projeto"));
  dashboardGrid.querySelectorAll(".proposal-open").forEach((button) => button.addEventListener("click", () => window.alert("Visualização da proposta pronta para receber o documento comercial.")));
}

function renderFollowupsView() {
  const followups = [["Ligar para Carolina Mendes", "Proposta do aplicativo mobile", "Hoje · 14:30", "Alta", "CM"], ["Enviar estudo de caso", "Bruno Almeida · Nexum", "Amanhã · 09:00", "Média", "BA"], ["Confirmar reunião de fechamento", "Diego Nunes · Orbit", "18 set · 16:00", "Alta", "DN"], ["Retomar contato", "Fernanda Reis · Acme Inc.", "20 set · 11:00", "Baixa", "FR"]];
  dashboardGrid.innerHTML = `<section class="page-intro followups-intro"><div><p class="card-kicker">CRM</p><h2>Follow-ups</h2><p>Nunca perca o momento certo de retomar uma conversa comercial.</p></div><button class="button button-primary compact-action followup-new" type="button">+ Novo follow-up</button></section><section class="followup-summary"><article class="data-card"><span>Para hoje</span><strong>01</strong><small class="warning">Prioridade alta</small></article><article class="data-card"><span>Próximos 7 dias</span><strong>04</strong><small>Todos os responsáveis</small></article><article class="data-card"><span>Concluídos no mês</span><strong>18</strong><small class="positive">↑ 22% de produtividade</small></article></section><section class="data-card followups-card"><div class="section-heading"><div><p class="card-kicker">Minha fila</p><h2>Próximos contatos</h2></div><button class="filter-button" type="button">Todos os status</button></div><div class="followup-list">${followups.map(([title, detail, date, priority, initials]) => `<article class="followup-row"><label class="followup-check"><input type="checkbox" /><span></span></label><span class="followup-avatar">${initials}</span><div class="followup-main"><strong>${title}</strong><small>${detail}</small></div><div class="followup-date"><small>Retorno</small><strong>${date}</strong></div><span class="priority-pill priority-${priority.toLowerCase()}">${priority}</span><button class="inbox-more" type="button" aria-label="Mais opcoes">•••</button></article>`).join("")}</div></section>`;
  dashboardGrid.querySelector(".followup-new")?.addEventListener("click", () => openCreateDialog("tarefa"));
}

function renderCRMView() {
  const modules = [["leads", "Leads", "Organize contatos e novas oportunidades.", "spiderman-card-web.png"], ["campanhas", "Campanhas", "Acompanhe desempenho e investimento.", "spiderman-card-hero.png"], ["funil", "Funil", "Veja cada oportunidade avançar.", "spiderman-card-duo.png"], ["oportunidades", "Oportunidades", "Priorize negociações importantes.", "agenda-spider-red-emblem.png"], ["propostas", "Propostas", "Crie e acompanhe documentos comerciais.", "agenda-spider-mask.png"], ["follow-ups", "Follow-ups", "Controle todos os próximos contatos.", "spiderman-hanging.png"]];
  dashboardGrid.innerHTML = `<section class="page-intro crm-intro"><div><p class="card-kicker">Workspace comercial</p><h2>CRM FocusDev</h2><p>Um centro único para controlar relacionamento, pipeline e fechamento.</p></div><button class="button button-primary compact-action" type="button" data-crm-module="leads">+ Novo lead</button></section><section class="crm-overview"><article class="data-card"><span>Pipeline total</span><strong>R$ 116.400</strong><small>26 oportunidades em andamento</small></article><article class="data-card"><span>Próximos contatos</span><strong>04</strong><small>1 prioridade para hoje</small></article><article class="data-card"><span>Propostas abertas</span><strong>02</strong><small>R$ 66.800 em negociação</small></article></section><section class="data-card crm-hub"><div class="section-heading"><div><p class="card-kicker">Módulos do CRM</p><h2>Escolha uma área para continuar</h2></div></div><div class="crm-module-grid">${modules.map(([key, title, description, image]) => `<button class="crm-module-card" type="button" data-crm-module="${key}" style="--crm-image:url('assets/${image}')"><span class="crm-module-icon">✦</span><strong>${title}</strong><small>${description}</small><b>Abrir →</b></button>`).join("")}</div></section>`;
  const actions = { leads: renderLeadsView, campanhas: renderCampaignsView, funil: renderFunnelView, oportunidades: renderOpportunitiesView, propostas: renderProposalsView, "follow-ups": renderFollowupsView };
  dashboardGrid.querySelectorAll("[data-crm-module]").forEach((button) => button.addEventListener("click", () => { const key = button.dataset.crmModule; history.replaceState({}, "", `#${key}`); actions[key]?.(); }));
}

function renderOperationsView(key) {
  const view = operationsModules[key];
  if (!view) return false;
  const makeRows = (query = "", status = "all") => view.rows.filter((row) => row.join(" ").toLocaleLowerCase("pt-BR").includes(query.toLocaleLowerCase("pt-BR")) && (status === "all" || row[row.length - 1].toLocaleLowerCase("pt-BR").includes(status))).map((row) => `<tr>${row.map((cell, index) => `<td class="${index === row.length - 1 ? "status-cell" : ""}">${escapeHtml(cell)}</td>`).join("")}</tr>`).join("") || `<tr><td colspan="${view.columns.length}" class="operations-empty">Nenhum registro encontrado.</td></tr>`;
  dashboardGrid.innerHTML = `<section class="page-intro operations-intro"><div><p class="card-kicker">${view.kicker}</p><h2>${view.title}</h2><p>${view.intro}</p></div><button class="button button-primary compact-action operations-new" type="button">+ ${view.action}</button></section><section class="operations-hero" style="--operations-art:url('assets/${view.art}')"><div><span class="operations-eyebrow">FocusDev workspace</span><strong>${key === "equipe" ? "Pessoas alinhadas, operação mais leve." : key === "relatorios" ? "Clareza para escolher o próximo passo." : "Tudo que você precisa para manter o ritmo."}</strong><small>Atualizado agora · dados sincronizados com seu workspace</small></div><span class="operations-art-label">SPIDER<br><b>FOCUS</b></span></section><section class="operations-metrics">${view.metrics.map(([label, value, note, tone]) => `<article class="data-card operations-metric"><span>${label}</span><strong>${value}</strong><small class="${tone}">${note}</small></article>`).join("")}</section><section class="data-card operations-table"><div class="section-heading"><div><p class="card-kicker">${key === "arquivos" ? "Biblioteca compartilhada" : "Visão geral"}</p><h2>${key === "equipe" ? "Pessoas e acessos" : key === "automacoes" ? "Fluxos configurados" : "Registros recentes"}</h2></div><div class="operations-toolbar"><label class="operations-search"><span aria-hidden="true">⌕</span><input type="search" placeholder="Buscar ${view.title.toLocaleLowerCase("pt-BR")}..." aria-label="Buscar ${view.title}" /></label><select class="operations-filter" aria-label="Filtrar status"><option value="all">Todos os status</option><option value="ativo">Ativo</option><option value="publicado">Publicado</option><option value="conectada">Conectada</option><option value="revisar">Revisar</option><option value="rascunho">Rascunho</option></select><button class="filter-button operations-export" type="button">Exportar</button></div></div><div class="table-wrap"><table><thead><tr>${view.columns.map((column) => `<th>${column}</th>`).join("")}</tr></thead><tbody class="operations-tbody">${makeRows()}</tbody></table></div></section>`;
  const search = dashboardGrid.querySelector(".operations-search input"), filter = dashboardGrid.querySelector(".operations-filter"), tbody = dashboardGrid.querySelector(".operations-tbody");
  const refresh = () => { tbody.innerHTML = makeRows(search.value, filter.value); };
  search.addEventListener("input", refresh); filter.addEventListener("change", refresh);
  dashboardGrid.querySelector(".operations-new").addEventListener("click", () => window.alert(`${view.action} · formulário pronto para receber os dados do workspace.`));
  dashboardGrid.querySelector(".operations-export").addEventListener("click", () => window.alert(`Exportação de ${view.title.toLocaleLowerCase("pt-BR")} iniciada.`));
  return true;
}
const financeMoney = (value) => `R$ ${Number(value).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
const financeRows = {
  receitas: [["Mensalidade · Website", "Acme Inc.", "Hoje", 8400, "Recebida"], ["Projeto · Aplicativo mobile", "Vértice", "22 Jun", 14800, "Pendente"], ["Suporte mensal", "Nexum", "30 Jun", 5200, "Agendada"], ["Consultoria estratégica", "Orbit", "05 Jul", 3900, "Pendente"], ["Implantação CRM", "Lumen", "12 Jul", 11200, "Agendada"]],
  despesas: [["Mídia paga", "Marketing", "13 Jun", 3240, "Pago"], ["Software e ferramentas", "Operação", "15 Jun", 1860, "Pago"], ["Freelancers", "Projetos", "18 Jun", 4750, "Agendado"], ["Infraestrutura cloud", "Tecnologia", "20 Jun", 2280, "Pendente"], ["Impostos e taxas", "Administrativo", "25 Jun", 3960, "Pendente"]]
};

function financeIntro(kicker, title, description, action = "+ Nova movimentação") {
  return `<section class="page-intro finance-intro"><div><p class="card-kicker">${kicker}</p><h2>${title}</h2><p>${description}</p></div><button class="button button-primary compact-action finance-action" type="button">${action}</button></section>`;
}
function financeMetric(label, value, detail, tone = "positive") { return `<article class="data-card finance-metric"><span>${label}</span><strong>${value}</strong><small class="${tone}">${detail}</small></article>`; }
function financeTable(rows, headers = ["Descrição", "Categoria", "Vencimento", "Valor", "Status"]) {
  return `<div class="table-wrap finance-table-wrap"><table class="finance-table"><thead><tr>${headers.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((cell, i) => `<td class="${i === row.length - 1 ? "status-cell" : i === row.length - 2 ? "money-cell" : ""}">${i === row.length - 2 ? financeMoney(cell) : cell}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
}

function renderFinanceOverview() {
  const bars = [["Jan", 61], ["Fev", 74], ["Mar", 57], ["Abr", 82], ["Mai", 69], ["Jun", 91]];
  dashboardGrid.innerHTML = `${financeIntro("Financeiro", "Visão financeira", "Uma leitura rápida da saúde financeira, fluxo de caixa e previsões.", "Exportar relatório")}<section class="finance-metrics">${financeMetric("Saldo disponível", "R$ 84.620,00", "↑ 12,4% vs. mês anterior")} ${financeMetric("Receitas no mês", "R$ 42.300,00", "↑ 8,6% realizado")} ${financeMetric("Despesas no mês", "R$ 18.740,00", "↓ 4,2% sob controle", "neutral")} ${financeMetric("Resultado projetado", "R$ 23.560,00", "Margem de 55,7%", "warning")}</section><section class="finance-overview-grid"><article class="data-card finance-chart-card"><div class="section-heading"><div><p class="card-kicker">Fluxo de caixa</p><h2>Entradas x saídas</h2></div><span class="finance-period">Últimos 6 meses⌄</span></div><div class="finance-chart"><div class="chart-y"><span>50k</span><span>25k</span><span>0</span></div><div class="chart-bars">${bars.map(([month, height]) => `<div class="chart-column"><div class="chart-bar-stack"><i style="height:${height}%"></i><b style="height:${Math.max(18, height - 32)}%"></b></div><span>${month}</span></div>`).join("")}</div></div><div class="chart-legend"><span><i class="legend-income"></i> Receitas</span><span><i class="legend-expense"></i> Despesas</span></div></article><article class="data-card finance-health-card"><div class="section-heading"><div><p class="card-kicker">Saúde financeira</p><h2>Distribuição do mês</h2></div></div><div class="finance-donut"><div><strong>55,7%</strong><small>margem líquida</small></div></div><div class="finance-breakdown"><span><i class="dot blue"></i> Operação <b>42%</b></span><span><i class="dot pink"></i> Marketing <b>21%</b></span><span><i class="dot orange"></i> Pessoas <b>37%</b></span></div></article></section><section class="data-card finance-activity-card"><div class="section-heading"><div><p class="card-kicker">Movimentações</p><h2>Atividade financeira recente</h2></div><button class="filter-button" type="button">Ver tudo →</button></div>${financeTable(financeRows.receitas.slice(0, 4))}</section>`;
}

function renderReceitasView() {
  const rows = financeRows.receitas;
  dashboardGrid.innerHTML = `${financeIntro("Financeiro", "Receitas", "Acompanhe entradas, vencimentos e a previsibilidade do seu faturamento.", "+ Nova receita")}<section class="finance-metrics">${financeMetric("Faturado no mês", "R$ 42.300,00", "↑ 8,6% vs. mês anterior")} ${financeMetric("A receber", "R$ 38.940,00", "12 lançamentos pendentes", "warning")} ${financeMetric("Recebido", "R$ 31.600,00", "74,7% do faturado", "positive")}</section><section class="data-card revenue-forecast-card"><div class="section-heading"><div><p class="card-kicker">Previsibilidade</p><h2>Receita projetada</h2></div><span class="finance-badge">Próximos 90 dias</span></div><div class="revenue-forecast"><div><strong>R$ 126.800</strong><small>previsão acumulada</small></div><div class="forecast-line"><i style="height:34%"></i><i style="height:48%"></i><i style="height:43%"></i><i style="height:67%"></i><i style="height:61%"></i><i style="height:86%"></i><i style="height:76%"></i><i style="height:100%"></i></div></div></section><section class="data-card finance-activity-card"><div class="section-heading"><div><p class="card-kicker">Faturamento</p><h2>Receitas recentes</h2></div><div class="receivable-filters"><button class="filter-button is-active" type="button">Todas</button><button class="filter-button" type="button">Pendentes</button></div></div>${financeTable(rows)}</section>`;
}

function renderExpensesView() {
  const categories = [["Pessoas", "R$ 8.240", 44, "blue"], ["Operação", "R$ 4.980", 27, "pink"], ["Marketing", "R$ 3.240", 17, "orange"], ["Tecnologia", "R$ 2.280", 12, "green"]];
  dashboardGrid.innerHTML = `${financeIntro("Financeiro", "Despesas", "Controle custos, compromissos e o impacto de cada categoria no resultado.")}<section class="finance-metrics">${financeMetric("Total no mês", "R$ 18.740,00", "↓ 4,2% vs. mês anterior", "neutral")} ${financeMetric("Contas pendentes", "R$ 6.240,00", "3 vencem esta semana", "warning")} ${financeMetric("Orçamento utilizado", "68,4%", "Dentro do planejado", "positive")}</section><section class="finance-overview-grid expenses-overview"><article class="data-card expense-category-card"><div class="section-heading"><div><p class="card-kicker">Onde estamos investindo</p><h2>Por categoria</h2></div></div><div class="expense-categories">${categories.map(([name, value, percent, color]) => `<div class="expense-category"><div><span><i class="dot ${color}"></i>${name}</span><strong>${value}</strong></div><div class="expense-track"><i class="${color}" style="width:${percent}%"></i></div><small>${percent}% do total</small></div>`).join("")}</div></article><article class="data-card budget-card"><div class="section-heading"><div><p class="card-kicker">Planejamento</p><h2>Orçamento mensal</h2></div><span class="finance-badge">Junho</span></div><strong class="budget-value">R$ 27.400 <small>de R$ 40.000</small></strong><div class="budget-track"><i style="width:68%"></i></div><p>Você ainda pode investir <b>R$ 12.600</b> neste ciclo.</p><button class="filter-button" type="button">Ajustar orçamento</button></article></section><section class="data-card finance-activity-card"><div class="section-heading"><div><p class="card-kicker">Lançamentos</p><h2>Despesas recentes</h2></div><button class="filter-button" type="button">Filtrar</button></div>${financeTable(financeRows.despesas)}</section>`;
}

function renderReceivablesView() {
  const timeline = [["Hoje", "Acme Inc.", "Mensalidade · Website", "R$ 8.400", "Recebido", "green"], ["22 Jun", "Vértice", "Parcela 2/4 · Aplicativo", "R$ 7.400", "Vence em 3 dias", "blue"], ["30 Jun", "Nexum", "Suporte mensal", "R$ 5.200", "Agendado", "orange"], ["05 Jul", "Orbit", "Consultoria estratégica", "R$ 3.900", "Agendado", "pink"]];
  dashboardGrid.innerHTML = `${financeIntro("Financeiro", "Contas a receber", "Acompanhe vencimentos, recebimentos previstos e risco de inadimplência.", "+ Nova conta a receber")}<section class="finance-metrics">${financeMetric("Total a receber", "R$ 38.940,00", "↑ 14,8% no ciclo")} ${financeMetric("Em atraso", "R$ 4.280,00", "2 contas precisam de ação", "warning")} ${financeMetric("Recebido no mês", "R$ 31.600,00", "81,1% do previsto", "positive")} </section><section class="data-card receivables-card"><div class="section-heading"><div><p class="card-kicker">Agenda de recebimentos</p><h2>Próximos vencimentos</h2></div><div class="receivable-filters"><button class="filter-button is-active" type="button">Todos</button><button class="filter-button" type="button">Em atraso</button></div></div><div class="receivable-timeline">${timeline.map(([date, client, detail, value, status, tone]) => `<article class="receivable-item"><div class="timeline-date"><strong>${date}</strong><span>Jun · 2024</span></div><i class="timeline-dot ${tone}"></i><div class="receivable-main"><strong>${client}</strong><small>${detail}</small></div><strong class="receivable-value">${value}</strong><span class="finance-status ${tone}">${status}</span><button class="inbox-more" type="button" aria-label="Mais opções">•••</button></article>`).join("")}</div></section><section class="receivable-aging"><article class="data-card"><p class="card-kicker">Aging de recebíveis</p><h2>Por período</h2><div class="aging-grid"><span><b>R$ 31.600</b><small>A vencer</small></span><span><b>R$ 3.060</b><small>1–30 dias</small></span><span><b>R$ 1.220</b><small>31–60 dias</small></span></div></article></section>`;
}

function renderChargesView() {
  const events = [["13 Jun · 09:42", "Lembrete enviado", "Acme Inc. recebeu o link de pagamento da mensalidade.", "Concluído", "green"], ["12 Jun · 16:18", "Pagamento confirmado", "Nexum confirmou o pagamento de R$ 5.200,00.", "Pago", "blue"], ["11 Jun · 10:05", "Cobrança criada", "Parcela 2/4 do projeto Aplicativo mobile.", "Aguardando", "orange"], ["09 Jun · 14:30", "Vencimento ultrapassado", "Orbit ainda não visualizou a cobrança de R$ 4.280,00.", "Ação necessária", "pink"]];
  dashboardGrid.innerHTML = `${financeIntro("Financeiro", "Cobranças", "Centralize lembretes, links de pagamento e o histórico de cada cobrança.", "+ Nova cobrança")}<section class="finance-metrics">${financeMetric("Em aberto", "08", "R$ 14.860,00 em cobrança", "warning")} ${financeMetric("Taxa de recebimento", "92,4%", "↑ 3,1% este mês")} ${financeMetric("Tempo médio", "2,8 dias", "Até a confirmação", "neutral")}</section><section class="data-card charges-card"><div class="section-heading"><div><p class="card-kicker">Linha do tempo</p><h2>Atividade de cobranças</h2></div><button class="filter-button" type="button">Últimos 30 dias⌄</button></div><div class="charge-timeline">${events.map(([date, title, text, status, tone]) => `<article class="charge-event"><div class="charge-marker ${tone}"></div><div class="charge-event-body"><small>${date}</small><strong>${title}</strong><p>${text}</p></div><span class="finance-status ${tone}">${status}</span><button class="inbox-more" type="button" aria-label="Mais opções">•••</button></article>`).join("")}</div></section>`;
}

function renderSubscriptionsView() {
  const subscriptions = [["Acme Inc.", "Plano Growth", "R$ 2.400,00", "18 Jun 2024", "Ativa", "blue"], ["Nexum", "Plano Scale", "R$ 1.800,00", "22 Jun 2024", "Ativa", "green"], ["Orbit", "Plano Starter", "R$ 890,00", "03 Jul 2024", "Trial", "orange"], ["Vértice", "Plano Growth", "R$ 2.400,00", "10 Jul 2024", "Ativa", "blue"], ["Lumen", "Plano Scale", "R$ 1.800,00", "15 Jul 2024", "Pausada", "pink"]];
  dashboardGrid.innerHTML = `${financeIntro("Financeiro", "Assinaturas", "Gerencie receita recorrente, planos ativos e os próximos ciclos de cobrança.", "+ Nova assinatura")}<section class="finance-metrics">${financeMetric("MRR", "R$ 18.460,00", "↑ 9,8% no mês")} ${financeMetric("Assinaturas ativas", "42", "3 novas este mês")} ${financeMetric("Churn mensal", "2,4%", "↓ 0,8% vs. anterior", "positive")} ${financeMetric("Ticket médio", "R$ 439,00", "↑ 4,2% no período", "neutral")}</section><section class="data-card subscriptions-card"><div class="section-heading"><div><p class="card-kicker">Receita recorrente</p><h2>Carteira de assinaturas</h2></div><div class="receivable-filters"><button class="filter-button is-active" type="button">Todas</button><button class="filter-button" type="button">Ativas</button><button class="filter-button" type="button">Em risco</button></div></div><div class="subscription-list">${subscriptions.map(([client, plan, value, date, status, tone]) => `<article class="subscription-row"><span class="lead-avatar">${client.split(" ").map((p) => p[0]).join("").slice(0, 2)}</span><div class="subscription-client"><strong>${client}</strong><small>${plan}</small></div><div><small>Valor mensal</small><strong>${value}</strong></div><div><small>Próxima cobrança</small><strong>${date}</strong></div><span class="finance-status ${tone}">${status}</span><button class="inbox-more" type="button" aria-label="Mais opções">•••</button></article>`).join("")}</div></section>`;
}

function renderWorkspaceView(hash, label) {
  if (!dashboardGrid) return;
  const key = hash?.replace("#", "");
  if (key === "inicio") {
    dashboardGrid.innerHTML = initialDashboardMarkup;
    return;
  }
  if (key === "crm") { renderCRMView(); return; }
  if (key === "agenda") { renderAgendaView(); return; }
  if (key === "tarefas") { renderTasksView(); return; }
  if (key === "caixa-de-entrada") { renderInboxView(); return; }
  if (key === "leads") { renderLeadsView(); return; }
  if (key === "campanhas") { renderCampaignsView(); return; }
  if (key === "funil") { renderFunnelView(); return; }
  if (key === "oportunidades") { renderOpportunitiesView(); return; }
  if (key === "propostas") { renderProposalsView(); return; }
  if (key === "follow-ups") { renderFollowupsView(); return; }
  if (renderOperationsView(key)) return;
  if (key === "visao-financeira") { renderFinanceOverview(); return; }
  if (key === "despesas") { renderExpensesView(); return; }
  if (key === "contas-a-receber") { renderReceivablesView(); return; }
  if (key === "cobrancas") { renderChargesView(); return; }
  if (key === "assinaturas") { renderSubscriptionsView(); return; }
  if (key === "receitas") { renderReceitasView(); return; }
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
