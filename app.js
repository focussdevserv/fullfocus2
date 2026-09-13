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
  } catch { /* API opcional durante o desenvolvimento local */ }
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
  tarefa: { title: "Nova tarefa", endpoint: "/api/tasks", fields: [{ name: "title", label: "Título", placeholder: "Ex.: Revisar briefing do cliente" }] },
  lead: { title: "Novo lead", endpoint: "/api/leads", fields: [{ name: "name", label: "Nome", placeholder: "Nome do contato" }, { name: "company", label: "Empresa", placeholder: "Empresa (opcional)" }] },
  receita: { title: "Nova receita", endpoint: "/api/revenues", fields: [{ name: "description", label: "Descrição", placeholder: "Ex.: Mensalidade do projeto" }, { name: "amount", label: "Valor", type: "number", placeholder: "0,00" }] },
  projeto: { title: "Novo projeto", endpoint: "/api/projects", fields: [{ name: "name", label: "Nome do projeto", placeholder: "Ex.: Website institucional" }] }
  ,evento: { title: "Novo evento", endpoint: "/api/events", fields: [{ name: "title", label: "Título", placeholder: "Ex.: Reunião com cliente" }, { name: "startsAt", label: "Data e hora", type: "datetime-local", placeholder: "" }, { name: "description", label: "Descrição", placeholder: "Detalhes (opcional)", required: false }] }
};
const createDialog = document.createElement("div");
createDialog.className = "create-dialog-backdrop";
createDialog.hidden = true;
createDialog.innerHTML = '<form class="create-dialog" id="create-dialog-form"><button class="dialog-close" type="button" aria-label="Fechar">×</button><p class="card-kicker" id="dialog-kicker">Novo registro</p><h2 id="dialog-title"></h2><div id="dialog-fields"></div><p class="dialog-status" id="dialog-status" role="status"></p><div class="dialog-actions"><button class="button button-secondary" id="dialog-cancel" type="button">Cancelar</button><button class="button button-primary" type="submit">Salvar</button></div></form>';
document.body.append(createDialog);
const dialogForm = $("create-dialog-form"), dialogFields = $("dialog-fields"), dialogTitle = $("dialog-title"), dialogStatus = $("dialog-status");
function closeCreateDialog() { createDialog.hidden = true; dialogForm.reset(); dialogStatus.textContent = ""; }
function openCreateDialog(kind) { const config = createConfig[kind]; if (!config) return; dialogTitle.textContent = config.title; dialogFields.innerHTML = config.fields.map((field) => `<label class="dialog-field">${field.label}<input name="${field.name}" type="${field.type || "text"}" placeholder="${field.placeholder}"${field.required === false ? "" : " required"} /></label>`).join(""); dialogForm.dataset.kind = kind; createDialog.hidden = false; dialogFields.querySelector("input")?.focus(); }
document.querySelectorAll(".create-menu a").forEach((link) => link.addEventListener("click", (event) => { event.preventDefault(); createMenu.hidden = true; createMenuTrigger?.setAttribute("aria-expanded", "false"); const text = link.textContent.toLocaleLowerCase("pt-BR"); openCreateDialog(text.includes("tarefa") ? "tarefa" : text.includes("lead") ? "lead" : text.includes("receita") ? "receita" : "projeto"); }));
document.querySelectorAll(".quick-actions button").forEach((button) => button.addEventListener("click", () => { const text = button.textContent.toLocaleLowerCase("pt-BR"); openCreateDialog(text.includes("tarefa") ? "tarefa" : text.includes("lead") ? "lead" : text.includes("receita") ? "receita" : "projeto"); }));
dialogForm.addEventListener("submit", async (event) => { event.preventDefault(); const config = createConfig[dialogForm.dataset.kind]; const payload = Object.fromEntries(new FormData(dialogForm)); if (payload.amount) payload.amount = payload.amount.replace(",", "."); const submit = dialogForm.querySelector("[type=submit]"); submit.disabled = true; dialogStatus.textContent = "Salvando..."; try { const response = await fetch(config.endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }); const data = await response.json(); if (!response.ok) throw new Error(data.error || "Não foi possível salvar."); closeCreateDialog(); await syncDashboard(); } catch (error) { dialogStatus.textContent = error.message; } finally { submit.disabled = false; } });
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

function renderAgendaView() {
  const now = new Date(), year = now.getFullYear(), month = now.getMonth(), monthName = now.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  const firstDay = new Date(year, month, 1).getDay(), days = new Date(year, month + 1, 0).getDate();
  const cells = Array.from({ length: 42 }, (_, index) => { const day = index - firstDay + 1; if (day < 1 || day > days) return '<span class="calendar-day is-empty"></span>'; const isToday = day === now.getDate(); return `<button class="calendar-day${isToday ? " is-today" : ""}" type="button">${day}${[3, 8, 14, 21, 26].includes(day) ? '<i></i>' : ""}</button>`; }).join("");
  dashboardGrid.innerHTML = `<section class="page-intro agenda-intro"><div><p class="card-kicker">Organização</p><h2>Agenda</h2><p>Planeje compromissos, reuniões e os próximos passos da equipe.</p></div><button class="button button-primary compact-action agenda-new" type="button">+ Novo evento</button></section><section class="agenda-layout"><section class="data-card calendar-card"><div class="calendar-toolbar"><button class="calendar-nav" type="button" aria-label="Mês anterior">‹</button><h2>${monthName.charAt(0).toUpperCase() + monthName.slice(1)}</h2><button class="calendar-nav" type="button" aria-label="Próximo mês">›</button></div><div class="calendar-weekdays"><span>Dom</span><span>Seg</span><span>Ter</span><span>Qua</span><span>Qui</span><span>Sex</span><span>Sáb</span></div><div class="calendar-grid">${cells}</div></section><aside class="data-card day-agenda"><div class="section-heading"><div><p class="card-kicker">${now.toLocaleDateString("pt-BR", { weekday: "long" })}</p><h2>Agenda de hoje</h2></div><span class="task-count">3 eventos</span></div><div class="day-event-list"><article class="day-event"><time>09:30</time><div><strong>Reunião de alinhamento</strong><small>Google Meet · Equipe de produto</small></div><i class="event-dot blue"></i></article><article class="day-event"><time>14:00</time><div><strong>Apresentação da proposta</strong><small>Cliente: Acme Inc.</small></div><i class="event-dot pink"></i></article><article class="day-event"><time>16:30</time><div><strong>Revisão de tarefas</strong><small>Time de desenvolvimento</small></div><i class="event-dot orange"></i></article></div><button class="agenda-add-link" type="button">+ Adicionar compromisso</button></aside></section><section class="data-card agenda-upcoming"><div class="section-heading"><div><p class="card-kicker">Visão geral</p><h2>Próximos compromissos</h2></div><button class="text-action" type="button">Ver calendário <span>→</span></button></div><div class="upcoming-list"><article><span class="upcoming-date">Amanhã<strong>10:00</strong></span><div><strong>Daily do time de desenvolvimento</strong><small>Google Meet · Projeto Website</small></div><span class="event-tag blue-tag">Equipe</span></article><article><span class="upcoming-date">16 Jun<strong>15:00</strong></span><div><strong>Revisão de resultados</strong><small>Sala de reunião · FocusDev</small></div><span class="event-tag pink-tag">Reunião</span></article></div></section>`;
  dashboardGrid.querySelectorAll(".calendar-day:not(.is-empty)").forEach((day) => day.addEventListener("click", () => { dashboardGrid.querySelectorAll(".calendar-day.is-selected").forEach((item) => item.classList.remove("is-selected")); day.classList.add("is-selected"); }));
  dashboardGrid.querySelectorAll(".agenda-new, .agenda-add-link").forEach((button) => button.addEventListener("click", () => openCreateDialog("evento")));
  const localMoves = JSON.parse(localStorage.getItem("focusdev_agenda_moves") || "{}");
  dashboardGrid.querySelectorAll(".day-event").forEach((event, index) => { event.draggable = true; event.dataset.eventId = String(index + 1); if (localMoves[event.dataset.eventId]) event.querySelector("small").textContent = `Movido para ${localMoves[event.dataset.eventId]}`; event.addEventListener("dragstart", (drag) => { drag.dataTransfer.setData("text/plain", event.dataset.eventId); event.classList.add("is-dragging"); }); event.addEventListener("dragend", () => event.classList.remove("is-dragging")); });
  dashboardGrid.querySelectorAll(".calendar-day:not(.is-empty)").forEach((day) => { day.addEventListener("dragover", (event) => { event.preventDefault(); day.classList.add("is-drop-target"); }); day.addEventListener("dragleave", () => day.classList.remove("is-drop-target")); day.addEventListener("drop", async (event) => { event.preventDefault(); day.classList.remove("is-drop-target"); const eventId = event.dataTransfer.getData("text/plain"); const moved = dashboardGrid.querySelector(`[data-event-id="${eventId}"]`); if (!moved) return; const dayNumber = Number(day.textContent.replace(/\D/g, "")); localMoves[eventId] = `dia ${dayNumber}`; localStorage.setItem("focusdev_agenda_moves", JSON.stringify(localMoves)); moved.querySelector("small").textContent = `Movido para ${localMoves[eventId]}`; day.classList.add("is-selected"); try { await fetch(`/api/events/${eventId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ startsAt: new Date(year, month, dayNumber, 9, 0, 0).toISOString() }) }); } catch { /* mantém a alteração local se a API estiver indisponível */ } }); day.addEventListener("click", () => { const date = new Date(year, month, Number(day.textContent.replace(/\D/g, "")), 10, 9, 0); openCreateDialog("evento"); const input = dialogFields.querySelector('[name="startsAt"]'); if (input) input.value = new Date(date - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16); }); });
}

function renderWorkspaceView(hash, label) {
  if (!dashboardGrid) return;
  const key = hash?.replace("#", "");
  if (key === "inicio") {
    dashboardGrid.innerHTML = initialDashboardMarkup;
    return;
  }
  if (key === "agenda") { renderAgendaView(); return; }
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
