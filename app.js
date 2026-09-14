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

/* Contador de mensagens não lidas (exposto por modules/inbox.js em window.FocusInbox). */
async function refreshInboxBadge() {
  if (!notificationButton || typeof window.FocusInbox?.unreadCount !== "function" || appShell.hidden) return;
  try {
    const count = Number(await window.FocusInbox.unreadCount()) || 0;
    let badge = notificationButton.querySelector(".inbox-badge");
    if (!badge) { badge = document.createElement("span"); badge.className = "inbox-badge"; notificationButton.append(badge); }
    badge.textContent = count > 99 ? "99+" : String(count);
    badge.hidden = count === 0;
    notificationButton.classList.toggle("has-unread", count > 0);
  } catch { /* badge é opcional */ }
}
window.setInterval(refreshInboxBadge, 45000);
document.addEventListener("focus-inbox-changed", refreshInboxBadge);

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SESSION_KEY = "focusdev_session";
let authTransition = 0;


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

let homeGreeting = "Bom dia, FocusDev";
function greetingForNow(date = new Date()) {
  const hour = date.getHours();
  return hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
}

function showApp(user) {
  loginShell.hidden = true;
  appShell.hidden = false;
  closeSidebar();
  closeAccountMenu();
  if (user?.name) {
    const firstName = user.name.trim().split(/\s+/)[0];
    homeGreeting = `${greetingForNow()}, ${firstName}`;
    appTitle.textContent = homeGreeting;
    document.querySelectorAll(".account-name strong").forEach((element) => { element.textContent = firstName; });
    document.querySelectorAll(".avatar").forEach((element) => { element.textContent = user.name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase(); });
  }
  appTitle.focus();
  // Quando modules/inicio.js registra a rota "inicio", ele é o dono do painel inicial.
  if (!routeRenderers.inicio) syncDashboard();
  loadWeather();
  window.setTimeout(refreshInboxBadge, 300);
  // Sempre re-renderiza a rota atual com a sessão válida (o boot pode ter desenhado a tela deslogado).
  window.requestAnimationFrame(() => renderHashRoute(window.location.hash || "#inicio"));
}

function saveSession(user) {
  try { localStorage.setItem(SESSION_KEY, JSON.stringify({ id: user.id, name: user.name, email: user.email })); } catch { /* armazenamento indisponível */ }
}

function readSavedSession() {
  try {
    const saved = JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
    return saved?.id && saved?.email ? saved : null;
  } catch {
    return null;
  }
}

async function restoreSession() {
  const transition = authTransition;
  const savedSession = readSavedSession();
  try {
    const response = await fetch("/api/auth/me", { credentials: "same-origin" });
    if (transition !== authTransition) return;
    if (response.status === 401) {
      // Sessão expirada ou inválida: a cópia local não vale mais.
      localStorage.removeItem(SESSION_KEY);
      showLogin();
      return;
    }
    if (!response.ok) throw new Error();
    const data = await response.json();
    saveSession(data.user);
    showApp(data.user);
  } catch {
    if (transition !== authTransition) return;
    // Rede/API indisponível: mantém o workspace utilizável com a sessão salva (modo offline do PWA).
    if (savedSession) {
      showApp(savedSession);
      return;
    }
    showLogin();
  }
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
    // O usuário pode ter saído do Início enquanto a geolocalização/API respondia.
    const temperature = $("weather-temperature"), summary = $("weather-summary"), symbol = widget.querySelector(".weather-symbol");
    if (!temperature || !summary) return;
    temperature.textContent = `${Math.round(data.current.temperature_2m)}°C`;
    summary.textContent = `${weatherLabels[code] || "Condição atual"} · sensação ${Math.round(data.current.apparent_temperature)}°C`;
    if (symbol) symbol.textContent = weatherIcons[code] || "☼";
  } catch {
    const temperature = $("weather-temperature"), summary = $("weather-summary");
    if (temperature) temperature.textContent = "Indisponível";
    if (summary) summary.textContent = "Tente novamente mais tarde";
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
    setLoading(loginSubmit, false); clearForm(loginForm, loginStatus); passwordInput.type = "password"; passwordToggle.setAttribute("aria-pressed", "false"); passwordToggle.setAttribute("aria-label", "Mostrar senha"); authTransition += 1; saveSession(data.user); showApp(data.user);
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
  try {
    // Responde 202 sempre (não revela se o e-mail existe); o link chega por e-mail.
    await api("/api/auth/reset-request", { method: "POST", body: { email: resetEmail.value.trim() } });
    setStatus(resetStatus, `Se ${resetEmail.value.trim()} tiver uma conta, o link de redefinição chega em instantes. O link vale por 1 hora.`);
  } catch (error) {
    setStatus(resetStatus, error.message, "error");
  } finally {
    setLoading(resetSubmit, false);
  }
});

/* Nova senha a partir do link /#reset=<token> ------------------------------ */
const newPasswordScreen = $("new-password-screen");
const newPasswordForm = $("new-password-form");
const newPasswordInput = $("new-password");
const newPasswordConfirm = $("new-password-confirm");
const newPasswordSubmit = $("new-password-submit");
const newPasswordStatus = $("new-password-status");
const newPasswordBack = $("new-password-back");
let pendingResetToken = "";

function readResetTokenFromHash() {
  const match = /^#reset=([A-Za-z0-9_-]{16,})$/.exec(window.location.hash || "");
  return match ? match[1] : "";
}

function showNewPassword(token) {
  pendingResetToken = token;
  appShell.hidden = true;
  loginShell.hidden = false;
  loginScreen.hidden = true;
  resetScreen.hidden = true;
  registerScreen.hidden = true;
  newPasswordScreen.hidden = false;
  hero.dataset.scene = "reset";
  clearForm(newPasswordForm, newPasswordStatus);
  newPasswordInput.focus();
}

newPasswordBack?.addEventListener("click", () => {
  newPasswordScreen.hidden = true;
  history.replaceState(null, "", window.location.pathname + window.location.search);
  showLogin();
  emailInput.focus();
});

[newPasswordInput, newPasswordConfirm].forEach((input) => input?.addEventListener("input", () => { setFieldError(input, ""); setStatus(newPasswordStatus, ""); }));

newPasswordForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (newPasswordSubmit.disabled) return;
  setFieldError(newPasswordInput, newPasswordInput.value.length >= 8 ? "" : "Use pelo menos 8 caracteres.");
  setFieldError(newPasswordConfirm, newPasswordConfirm.value === newPasswordInput.value ? "" : "As senhas não coincidem.");
  if (newPasswordForm.querySelector(".has-error")) { focusFirstError(newPasswordForm); return; }
  setLoading(newPasswordSubmit, true);
  try {
    await api("/api/auth/reset-confirm", { method: "POST", body: { token: pendingResetToken, password: newPasswordInput.value } });
    pendingResetToken = "";
    history.replaceState(null, "", window.location.pathname + window.location.search);
    newPasswordScreen.hidden = true;
    showLogin();
    setStatus(loginStatus, "Senha atualizada. Entre com a nova senha.");
    emailInput.focus();
  } catch (error) {
    setStatus(newPasswordStatus, error.message, "error");
  } finally {
    setLoading(newPasswordSubmit, false);
  }
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
  tarefa: { title: "Nova tarefa", endpoint: "/api/tasks", fields: [{ name: "title", label: "Título", placeholder: "Ex.: Revisar briefing do cliente" }, { name: "priority", label: "Prioridade", type: "select", options: [["medium", "Média"], ["high", "Alta"], ["low", "Baixa"]] }, { name: "status", label: "Situação", type: "select", options: [["todo", "A fazer"], ["doing", "Em andamento"], ["blocked", "Bloqueada"], ["done", "Concluída"]] }, { name: "due_at", label: "Prazo (opcional)", type: "datetime-local", placeholder: "", required: false }, { name: "tags", label: "Tags (separe por vírgula)", placeholder: "Ex.: cliente, urgente", required: false }, { name: "project_id", label: "Projeto (opcional)", type: "select", options: [["", "Sem projeto"]], required: false }] },
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
function openCreateDialog(kind) { const config = createConfig[kind]; if (!config) return; dialogTitle.textContent = config.title; dialogFields.innerHTML = config.fields.map((field) => { const required = field.required === false ? "" : " required"; const ariaRequired = field.required === false ? "" : " aria-required=\"true\""; if (field.type === "select") return `<label class="dialog-field">${escapeHtml(field.label)}<select name="${escapeHtml(field.name)}"${ariaRequired}>${field.options.map(([value, label]) => `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`).join("")}</select></label>`; if (field.type === "textarea") return `<label class="dialog-field">${escapeHtml(field.label)}<textarea name="${escapeHtml(field.name)}" rows="${field.rows || 4}" placeholder="${escapeHtml(field.placeholder || "")}"${required}${ariaRequired}></textarea></label>`; if (field.type === "checkbox") return `<label class="dialog-field dialog-check"><input name="${escapeHtml(field.name)}" type="checkbox" value="true" />${escapeHtml(field.label)}</label>`; return `<label class="dialog-field">${escapeHtml(field.label)}<input name="${escapeHtml(field.name)}" type="${escapeHtml(field.type || "text")}" placeholder="${escapeHtml(field.placeholder || "")}"${required}${ariaRequired} /></label>`; }).join(""); dialogForm.dataset.kind = kind; delete dialogForm.dataset.method; delete dialogForm.dataset.endpoint; createDialog.hidden = false; dialogFields.querySelector("input, select, textarea")?.focus(); }
function openEditDialog(kind, item, endpoint) { openCreateDialog(kind); dialogTitle.textContent = item?.id ? `Editar ${createConfig[kind]?.title?.replace(/^Novo\s+/i, "").toLowerCase() || "registro"}` : kind === "evento" ? "Editar evento" : "Editar tarefa"; dialogForm.dataset.method = "PATCH"; dialogForm.dataset.endpoint = endpoint; Object.entries(item).forEach(([name, value]) => { const field = dialogFields.querySelector(`[name="${name}"]`); if (!field || value == null) return; if (field.type === "checkbox") { field.checked = value === true || value === "true" || value === 1; return; } const date = new Date(value); field.value = field.type === "datetime-local" && !Number.isNaN(date.getTime()) ? new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16) : field.type === "date" && !Number.isNaN(date.getTime()) ? new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10) : value; }); }
function openSubtaskDialog(task) { openCreateDialog("tarefa"); dialogTitle.textContent = `Nova subtarefa · ${task.title}`; dialogFields.insertAdjacentHTML("beforeend", `<input type="hidden" name="parent_id" value="${escapeHtml(String(task.id))}" />`); const status = dialogFields.querySelector('[name="status"]'); if (status) status.value = "todo"; }
document.querySelectorAll(".create-menu a").forEach((link) => link.addEventListener("click", (event) => { event.preventDefault(); createMenu.hidden = true; createMenuTrigger?.setAttribute("aria-expanded", "false"); const text = link.textContent.toLocaleLowerCase("pt-BR"); openCreateDialog(text.includes("tarefa") ? "tarefa" : text.includes("lead") ? "lead" : text.includes("receita") ? "receita" : "projeto"); }));
document.querySelectorAll(".quick-actions button").forEach((button) => button.addEventListener("click", () => { const text = button.textContent.toLocaleLowerCase("pt-BR"); openCreateDialog(text.includes("tarefa") ? "tarefa" : text.includes("lead") ? "lead" : text.includes("receita") ? "receita" : "projeto"); }));
dialogForm.addEventListener("submit", async (event) => { event.preventDefault(); const config = createConfig[dialogForm.dataset.kind]; const payload = Object.fromEntries(new FormData(dialogForm)); dialogForm.querySelectorAll('input[type="checkbox"]').forEach((input) => { payload[input.name] = input.checked; }); if (payload.amount) payload.amount = payload.amount.replace(",", "."); dialogForm.querySelectorAll('input[type="datetime-local"]').forEach((input) => { if (input.value) payload[input.name] = new Date(input.value).toISOString(); }); Object.keys(payload).forEach((key) => { if (payload[key] === "") delete payload[key]; }); const submit = dialogForm.querySelector("[type=submit]"); submit.disabled = true; dialogStatus.textContent = "Salvando..."; try { const method = dialogForm.dataset.method || "POST", endpoint = dialogForm.dataset.endpoint || config.endpoint; const response = await fetch(endpoint, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }); const data = response.status === 204 ? {} : await response.json(); if (!response.ok) throw new Error(data.error || "Não foi possível salvar."); closeCreateDialog(); /* Re-renderiza a tela atual (qualquer módulo) e atualiza o painel inicial. */ renderHashRoute(window.location.hash); if ((!window.location.hash || window.location.hash === "#inicio") && !routeRenderers.inicio) await syncDashboard(); } catch (error) { dialogStatus.textContent = error.message; } finally { submit.disabled = false; } });
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

const navItemsByHash = new Map([...document.querySelectorAll(".nav-item")].map((item) => [item.getAttribute("href"), item]));
let modulesLoading = document.readyState === "loading";
function renderHashRoute(requestedHash = window.location.hash || "#inicio") {
  let hash = requestedHash || "#inicio";
  let key = hash.replace(/^#/, "");
  // Rota válida = item do menu ou rota registrada por um módulo (sub-tela). Fora disso, volta ao Início.
  if (!navItemsByHash.has(hash) && !routeRenderers[key]) {
    // Um hash profundo pode chegar antes do mÃ³dulo que registra sua rota.
    if (modulesLoading) return;
    hash = "#inicio";
    key = "inicio";
  }
  const navItem = navItemsByHash.get(hash) || navItemsByHash.get(routeMeta[key]?.parent || "") || navItemsByHash.get("#inicio");
  if (window.location.hash !== hash) history.replaceState(null, "", hash);
  document.querySelector(".nav-item.is-active")?.classList.remove("is-active");
  navItem?.classList.add("is-active");
  const label = navItemsByHash.has(hash) ? navItem.textContent.trim() : (routeMeta[key]?.title || key);
  document.title = `${key === "inicio" ? "Início" : label} · FocusDev`;
  appTitle.textContent = key === "inicio" ? homeGreeting : label;
  document.querySelector(".eyebrow").textContent = navItem?.closest(".nav-group")?.querySelector("p")?.textContent || "Workspace";
  renderWorkspaceView(hash, label);
  closeSidebar();
}
document.addEventListener("click", (event) => {
  const item = event.target.closest?.(".nav-item");
  if (!item) return;
  event.preventDefault();
  const href = item.getAttribute("href") || "#inicio";
  if (window.location.hash !== href) history.pushState(null, "", href);
  renderHashRoute(href);
});
window.addEventListener("hashchange", () => renderHashRoute(window.location.hash));
window.addEventListener("popstate", () => renderHashRoute(window.location.hash));

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
  whatsapp: '<path d="M12 3a9 9 0 0 0-7.8 13.5L3 21l4.6-1.2A9 9 0 1 0 12 3Z"/><path d="M9.3 8.7c.2-.5.5-.5.8-.5h.5c.2 0 .4.1.5.4l.7 1.6c.1.2 0 .4-.1.5l-.5.6c-.1.1-.1.3 0 .4a6 6 0 0 0 2.9 2.7c.2.1.3 0 .4-.1l.6-.7c.2-.2.4-.2.6-.1l1.6.8c.2.1.3.3.3.5 0 .8-.6 1.6-1.4 1.8-.7.2-1.6 0-2.7-.5a9.4 9.4 0 0 1-3.9-3.7c-.6-1-.8-1.9-.6-2.6Z"/>',
  equipe: '<circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3 20c.7-3.4 2.7-5 6-5s5.3 1.6 6 5M16 15c2.8.2 4.3 1.7 5 4"/>'
};
document.querySelectorAll(".nav-item").forEach((item) => {
  const key = item.getAttribute("href")?.slice(1);
  item.insertAdjacentHTML("afterbegin", `<svg class="nav-icon" viewBox="0 0 24 24" aria-hidden="true">${navIconPaths[key] || '<circle cx="12" cy="12" r="3"/>'}</svg>`);
});

const escapeHtml = (value) => String(value ?? "").replace(/[&<>\"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[character]));

/* ---------------------------------------------------------------------------
   Registro de rotas dos módulos (modules/*.js)
   Cada módulo chama registerRoutes({ "chave-do-hash": () => render() }).
   Chaves duplicadas lançam erro para impedir que dois módulos disputem a
   mesma tela.
   --------------------------------------------------------------------------- */
const routeRenderers = Object.create(null);
/* Metadados de rotas que não estão no menu lateral (sub-telas): qual item do
   menu fica destacado e qual título aparece. Módulos podem estender via
   registerRoutes(map, { parent: "#crm", titles: { leads: "Leads" } }). */
const routeMeta = {
  leads: { parent: "#crm", title: "Leads" },
  campanhas: { parent: "#crm", title: "Campanhas" },
  funil: { parent: "#crm", title: "Funil de vendas" },
  oportunidades: { parent: "#crm", title: "Oportunidades" },
  propostas: { parent: "#crm", title: "Propostas" },
  "follow-ups": { parent: "#crm", title: "Follow-ups" },
};
function registerRoutes(map, meta = {}) {
  for (const [key, render] of Object.entries(map)) {
    if (routeRenderers[key]) throw new Error(`Rota "${key}" já registrada por outro módulo.`);
    if (typeof render !== "function") throw new Error(`Rota "${key}" precisa de uma função de render.`);
    routeRenderers[key] = render;
    if (meta.parent || meta.titles?.[key]) routeMeta[key] = { parent: meta.parent || routeMeta[key]?.parent, title: meta.titles?.[key] || routeMeta[key]?.title };
  }
  window.dispatchEvent(new CustomEvent("focusdev:routes-ready"));
}

window.addEventListener("focusdev:routes-ready", () => {
  if (!appShell.hidden) renderHashRoute(window.location.hash || "#inicio");
});
window.addEventListener("load", () => {
  modulesLoading = false;
  if (!appShell.hidden) renderHashRoute(window.location.hash || "#inicio");
}, { once: true });

/* Chamada de API autenticada (cookie same-origin) com erro legível em pt-BR. */
async function api(path, { method = "GET", body, headers } = {}) {
  const response = await fetch(path, {
    method,
    credentials: "same-origin",
    headers: { ...(body !== undefined ? { "Content-Type": "application/json" } : {}), ...headers },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = response.status === 204 ? {} : await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || (response.status === 401 ? "Sua sessão expirou. Entre novamente." : "Não foi possível concluir a operação."));
    error.status = response.status;
    throw error;
  }
  return data;
}

/* Blocos de estado compartilhados pelas telas (carregando / vazio / erro). */
const stateBlock = {
  loading: (label = "Carregando…") => `<section class="data-card state-card state-loading" aria-busy="true"><span class="state-spinner" aria-hidden="true"></span><p>${escapeHtml(label)}</p></section>`,
  empty: (title, description = "", actionLabel = "", actionClass = "") => `<section class="data-card state-card state-empty"><h2>${escapeHtml(title)}</h2>${description ? `<p>${escapeHtml(description)}</p>` : ""}${actionLabel ? `<button class="button button-primary compact-action ${actionClass}" type="button">${escapeHtml(actionLabel)}</button>` : ""}</section>`,
  error: (message = "Não foi possível carregar os dados.", retryClass = "state-retry") => `<section class="data-card state-card state-error" role="alert"><h2>Algo deu errado</h2><p>${escapeHtml(message)}</p><button class="button button-secondary compact-action ${retryClass}" type="button">Tentar novamente</button></section>`,
};

/* Renderizador genérico usado pelas telas ainda não conectadas à API. */
function renderModulePage(key, view) {
  const makeRows = (query = "", status = "all") => view.rows.filter((row) => row.join(" ").toLocaleLowerCase("pt-BR").includes(query.toLocaleLowerCase("pt-BR")) && (status === "all" || row[row.length - 1].toLocaleLowerCase("pt-BR").includes(status))).map((row) => `<tr>${row.map((cell, index) => `<td class="${index === row.length - 1 ? "status-cell" : ""}">${escapeHtml(cell)}</td>`).join("")}</tr>`).join("") || `<tr><td colspan="${view.columns.length}" class="operations-empty">Nenhum registro encontrado.</td></tr>`;

  dashboardGrid.innerHTML = `<section class="page-intro operations-intro"><div><p class="card-kicker">${view.kicker}</p><h2>${view.title}</h2><p>${view.intro}</p></div><button class="button button-primary compact-action operations-new" type="button">+ ${view.action}</button></section><section class="operations-hero" style="--operations-art:url('assets/${view.art}')"><div><span class="operations-eyebrow">FocusDev workspace</span><strong>${key === "equipe" ? "Pessoas alinhadas, operação mais leve." : key === "relatorios" ? "Clareza para escolher o próximo passo." : "Tudo que você precisa para manter o ritmo."}</strong><small>Atualizado agora · dados sincronizados com seu workspace</small></div><span class="operations-art-label">SPIDER<br><b>FOCUS</b></span></section><section class="operations-metrics">${view.metrics.map(([label, value, note, tone]) => `<article class="data-card operations-metric"><span>${label}</span><strong>${value}</strong><small class="${tone}">${note}</small></article>`).join("")}</section><section class="data-card operations-table"><div class="section-heading"><div><p class="card-kicker">${key === "arquivos" ? "Biblioteca compartilhada" : "Visão geral"}</p><h2>${key === "equipe" ? "Pessoas e acessos" : key === "automacoes" ? "Fluxos configurados" : "Registros recentes"}</h2></div><div class="operations-toolbar"><label class="operations-search"><span aria-hidden="true">⌕</span><input type="search" placeholder="Buscar ${view.title.toLocaleLowerCase("pt-BR")}..." aria-label="Buscar ${view.title}" /></label><select class="operations-filter" aria-label="Filtrar status"><option value="all">Todos os status</option><option value="ativo">Ativo</option><option value="publicado">Publicado</option><option value="conectada">Conectada</option><option value="revisar">Revisar</option><option value="rascunho">Rascunho</option></select><button class="filter-button operations-export" type="button">Exportar</button></div></div><div class="table-wrap"><table><thead><tr>${view.columns.map((column) => `<th>${column}</th>`).join("")}</tr></thead><tbody class="operations-tbody">${makeRows()}</tbody></table></div></section>`;
  const search = dashboardGrid.querySelector(".operations-search input"), filter = dashboardGrid.querySelector(".operations-filter"), tbody = dashboardGrid.querySelector(".operations-tbody");
  const refresh = () => { tbody.innerHTML = makeRows(search.value, filter.value); };
  search.addEventListener("input", refresh); filter.addEventListener("change", refresh);
  dashboardGrid.querySelector(".operations-new").addEventListener("click", () => { if (window.ui?.toast) ui.toast(`${view.action} disponível no módulo correspondente.`, "info"); else dashboardGrid.querySelector("[data-page-status]")?.replaceChildren(document.createTextNode(`${view.action} disponível no módulo correspondente.`)); });
  dashboardGrid.querySelector(".operations-export").addEventListener("click", () => { const rows = [...dashboardGrid.querySelectorAll(".operations-tbody tr")].map((row) => [...row.children].map((cell) => cell.textContent.trim())); if (window.ui?.downloadCsv) ui.downloadCsv(`${key}.csv`, view.columns, rows); else dashboardGrid.querySelector("[data-page-status]")?.replaceChildren(document.createTextNode("Exportação indisponível nesta tela.")); });
}

const DASHBOARD_PROFILE_KEY = "focusdev_dashboard_profile";
function applyDashboardProfile(profile = localStorage.getItem(DASHBOARD_PROFILE_KEY) || "manager") {
  const selector = document.querySelector("#dashboard-profile");
  const label = document.querySelector("#dashboard-profile-label");
  if (!selector || !label) return;
  selector.value = profile;
  selector.onchange = (event) => { localStorage.setItem(DASHBOARD_PROFILE_KEY, event.target.value); applyDashboardProfile(event.target.value); };
  const labels = { manager: "Visão geral do gestor", sales: "Foco comercial do vendedor", finance: "Controle financeiro", operations: "Execução operacional" };
  label.textContent = labels[profile] || labels.manager;
  const cards = [...document.querySelectorAll(".metrics .metric-card")];
  cards.forEach((card, index) => {
    const finance = [4, 5, 6].includes(index), commercial = index === 1, operational = [2, 3, 7].includes(index);
    card.hidden = profile === "sales" ? finance : profile === "finance" ? commercial || index === 3 : profile === "operations" ? commercial || finance : false;
  });
  document.querySelectorAll(".dashboard-pulse .pulse-card").forEach((card, index) => { card.hidden = profile === "sales" ? index === 1 : profile === "finance" ? index === 0 : false; });
}

function renderWorkspaceView(hash, label) {
  if (!dashboardGrid) return;
  const key = hash?.replace("#", "");
  const view = null;
  if (key === "inicio" && !routeRenderers.inicio) {
    dashboardGrid.innerHTML = initialDashboardMarkup;
    applyDashboardProfile();
    return;
  }
  const render = routeRenderers[key];
  if (!render) {
    dashboardGrid.innerHTML = `<section class="page-intro"><div><p class="card-kicker">Workspace</p><h2>${escapeHtml(label || "Módulo")}</h2><p>Este módulo ainda não está conectado ao banco nesta versão.</p></div></section>${stateBlock.empty("Nenhum dado disponível", "A tela será habilitada quando o fluxo persistente estiver implementado.")}`;
    return;
  }
  if (render) {
    try {
      const result = render(key, label);
      if (result && typeof result.catch === "function") result.catch((error) => { console.error(`Falha ao renderizar ${key}`, error); dashboardGrid.innerHTML = stateBlock.error(error?.message); });
    } catch (error) {
      console.error(`Falha ao renderizar ${key}`, error);
      dashboardGrid.innerHTML = stateBlock.error(error?.message);
    }
    return;
  }

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

topLogoutButton?.addEventListener("click", async () => {
  authTransition += 1;
  closeAccountMenu();
  await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" }).catch(() => {});
  localStorage.removeItem(SESSION_KEY);
  showLogin();
  emailInput.focus();
});

const bootResetToken = readResetTokenFromHash();
if (bootResetToken) {
  showNewPassword(bootResetToken);
} else {
  restoreSession().then(() => {
    // Só desenha o workspace se houver sessão; deslogado, a tela de login já está visível.
    if (!appShell.hidden) renderHashRoute();
  });
}

const baseOpenCreateDialog = openCreateDialog;
openCreateDialog = function openCreateDialogWithGithub(kind) {
  baseOpenCreateDialog(kind);
  if (kind !== "projeto") return;
  const repository = dialogFields.querySelector('[name="repository_url"]');
  if (!repository || dialogFields.querySelector("[data-github-fill]")) return;
  const button = document.createElement("button");
  button.type = "button";
  button.className = "compact-action";
  button.dataset.githubFill = "true";
  button.textContent = "Preencher pelo GitHub";
  repository.insertAdjacentElement("afterend", button);
  button.addEventListener("click", async () => {
    if (!repository.value) { repository.focus(); return; }
    button.disabled = true; button.textContent = "Lendo GitHub...";
    try {
      const response = await fetch(`/api/projects/github-preview?url=${encodeURIComponent(repository.value)}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Não foi possível ler o GitHub.");
      Object.entries(data).forEach(([name, value]) => { const field = dialogFields.querySelector(`[name="${name}"]`); if (field && value !== undefined && value !== null && value !== "") field.value = value; });
      dialogStatus.textContent = "Dados públicos preenchidos. Revise antes de salvar.";
    } catch (error) { dialogStatus.textContent = error.message; }
    finally { button.disabled = false; button.textContent = "Preencher pelo GitHub"; }
  });
};

const projectAndClientDialog = openCreateDialog;
openCreateDialog = function openCreateDialogWithCep(kind) {
  projectAndClientDialog(kind);
  if (kind !== "cliente") return;
  const zip = dialogFields.querySelector('[name="zip_code"]');
  if (!zip || dialogFields.querySelector("[data-cep-fill]")) return;
  const button = document.createElement("button"); button.type = "button"; button.className = "compact-action"; button.dataset.cepFill = "true"; button.textContent = "Consultar CEP"; zip.insertAdjacentElement("afterend", button);
  button.addEventListener("click", async () => { if (!zip.value) { zip.focus(); return; } button.disabled = true; button.textContent = "Consultando..."; try { const response = await fetch(`/api/cep/${encodeURIComponent(zip.value)}`); const data = await response.json(); if (!response.ok) throw new Error(data.error || "Não foi possível consultar o CEP."); Object.entries(data).forEach(([name, value]) => { const field = dialogFields.querySelector(`[name="${name}"]`); if (field && value) field.value = value; }); dialogStatus.textContent = "Endereço preenchido pelo CEP. Revise antes de salvar."; } catch (error) { dialogStatus.textContent = error.message; } finally { button.disabled = false; button.textContent = "Consultar CEP"; } });
};

const contractDialog = openCreateDialog;
openCreateDialog = function openCreateDialogWithContractAutofill(kind) {
  contractDialog(kind);
  if (kind !== "contrato") return;
  const proposal = dialogFields.querySelector('[name="proposal_id"]');
  if (!proposal || dialogFields.querySelector("[data-contract-fill]")) return;
  const button = document.createElement("button"); button.type = "button"; button.className = "compact-action"; button.dataset.contractFill = "true"; button.textContent = "Preencher da proposta/projeto"; proposal.insertAdjacentElement("afterend", button);
  button.addEventListener("click", async () => { const project = dialogFields.querySelector('[name="project_id"]'); const client = dialogFields.querySelector('[name="client_id"]'); const query = new URLSearchParams(); if (proposal.value) query.set("proposal_id", proposal.value); if (project?.value) query.set("project_id", project.value); if (client?.value) query.set("client_id", client.value); if (!query.toString()) { proposal.focus(); return; } button.disabled = true; button.textContent = "Preenchendo..."; try { const response = await fetch(`/api/contracts/autofill?${query}`); const data = await response.json(); if (!response.ok) throw new Error(data.error || "Não foi possível preparar o contrato."); Object.entries(data).forEach(([name, value]) => { const field = dialogFields.querySelector(`[name="${name}"]`); if (field && value !== undefined && value !== null && value !== "") field.value = value; }); const total = Number(dialogFields.querySelector('[name="total_value"]')?.value || dialogFields.querySelector('[name="value"]')?.value || 0); const entry = Number(dialogFields.querySelector('[name="down_payment"]')?.value || 0); const installments = Number(dialogFields.querySelector('[name="installments"]')?.value || 1); const installment = dialogFields.querySelector('[name="installment_value"]'); if (installment && installments > 0) installment.value = ((total - entry) / installments).toFixed(2); dialogStatus.textContent = "Dados preenchidos. Revise cláusulas e valores antes de salvar."; } catch (error) { dialogStatus.textContent = error.message; } finally { button.disabled = false; button.textContent = "Preencher da proposta/projeto"; } });
};

const accessibleDialog = openCreateDialog;
openCreateDialog = function openCreateDialogWithRichFields(kind) {
  accessibleDialog(kind);
  const config = createConfig[kind];
  if (!config) return;
  config.fields.forEach((field) => {
    const input = dialogFields.querySelector(`[name="${field.name}"]`);
    if (!input) return;
    const label = input.closest("label");
    if (field.required !== false) input.setAttribute("aria-required", "true");
    if (field.type === "email") input.setAttribute("autocomplete", "email");
    if (field.type === "tel") input.setAttribute("autocomplete", "tel");
    if (field.type === "textarea") {
      const area = document.createElement("textarea");
      [...input.attributes].forEach((attribute) => area.setAttribute(attribute.name, attribute.value));
      area.rows = field.rows || 4;
      input.replaceWith(area);
    }
    if (field.type === "checkbox" && label) {
      label.classList.add("dialog-checkbox");
      label.firstChild.textContent = field.text || field.label || "Selecionar";
    }
  });
};
const baseOpenEditDialog = openEditDialog;
openEditDialog = function openEditDialogWithCorrectTitle(kind, item, endpoint) {
  baseOpenEditDialog(kind, item, endpoint);
  const title = createConfig[kind]?.title;
  if (title) dialogTitle.textContent = title.replace(/^Novo\s+/i, "Editar ");
  Object.entries(item || {}).forEach(([name, value]) => { const field = dialogFields.querySelector(`[name="${name}"]`); if (field?.type === "checkbox") field.checked = value === true || value === "true" || value === "on"; });
};
dialogForm.addEventListener("formdata", (event) => {
  dialogForm.querySelectorAll('input[type="checkbox"][name]').forEach((input) => { event.formData.delete(input.name); event.formData.append(input.name, input.checked ? "true" : "false"); });
});
const baseAuthenticatedApi = api;
api = async function apiWithSessionExpiry(path, options) {
  try { return await baseAuthenticatedApi(path, options); }
  catch (error) { if (error?.status === 401) { authTransition += 1; localStorage.removeItem(SESSION_KEY); showLogin(); } throw error; }
};
