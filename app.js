const $ = (id) => document.getElementById(id);

const loginShell = $("login-shell");
const hero = $("hero");
const loginScreen = $("login-screen");
const resetScreen = $("reset-screen");

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

const appShell = $("app-shell");
const appTitle = $("app-title");
const appSidebar = $("app-sidebar");
const sidebarBackdrop = $("sidebar-backdrop");
const mobileMenu = $("mobile-menu");
const accountTrigger = $("account-trigger");
const accountDropdown = $("account-dropdown");
const logoutButton = $("logout-button");
const globalSearch = $("global-search");
const searchResults = $("search-results");
const dashboardGrid = document.querySelector(".dashboard-grid");
const initialDashboardMarkup = dashboardGrid?.innerHTML || "";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Simula a latência da API enquanto o endpoint de autenticação não existe.
const FAKE_REQUEST_MS = 650;

const wait = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));

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
  loginScreen.hidden = false;
  hero.dataset.scene = "login";
}

function showReset() {
  loginScreen.hidden = true;
  resetScreen.hidden = false;
  hero.dataset.scene = "reset";
}

function showApp() {
  loginShell.hidden = true;
  appShell.hidden = false;
  closeSidebar();
  closeAccountMenu();
  appTitle.focus();
  syncDashboard();
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
  await wait(FAKE_REQUEST_MS);
  setLoading(loginSubmit, false);

  clearForm(loginForm, loginStatus);
  passwordInput.type = "password";
  passwordToggle.setAttribute("aria-pressed", "false");
  passwordToggle.setAttribute("aria-label", "Mostrar senha");
  showApp();
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
  accountDropdown.hidden = false;
  accountTrigger.setAttribute("aria-expanded", "true");
}

function closeAccountMenu() {
  accountDropdown.hidden = true;
  accountTrigger.setAttribute("aria-expanded", "false");
}

mobileMenu.addEventListener("click", () => {
  appSidebar.classList.contains("is-open") ? closeSidebar() : openSidebar();
});

sidebarBackdrop.addEventListener("click", closeSidebar);

accountTrigger.addEventListener("click", () => {
  accountDropdown.hidden ? openAccountMenu() : closeAccountMenu();
});

document.addEventListener("click", (event) => {
  if (!accountDropdown.hidden && !event.target.closest(".account-menu")) closeAccountMenu();
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  if (!accountDropdown.hidden) {
    closeAccountMenu();
    accountTrigger.focus();
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
    appTitle.textContent = label === "Início" ? "Bom dia, FocusDev" : label;
    document.querySelector(".eyebrow").textContent = item.closest(".nav-group")?.querySelector("p")?.textContent || "Workspace";
    renderWorkspaceView(item.getAttribute("href"), label);
    closeSidebar();
  });
});

const views = {
  tarefas: { kicker: "Meu dia", title: "Tarefas", intro: "Organize prioridades e acompanhe o trabalho da equipe.", columns: ["Tarefa", "Responsável", "Prazo", "Status"], rows: [["Revisar briefing do cliente", "Alex Martins", "Hoje, 14:00", "Em andamento"], ["Preparar relatório mensal", "Joana Silva", "Amanhã", "A fazer"], ["Publicar nova campanha", "Rafael Costa", "20 Jun", "Concluída"], ["Validar pagamentos pendentes", "Marina Lopes", "22 Jun", "A fazer"]] },
  leads: { kicker: "CRM", title: "Leads", intro: "Gerencie oportunidades e acompanhe cada conversa.", columns: ["Lead", "Empresa", "Origem", "Etapa"], rows: [["Bruno Almeida", "Nexum", "Indicação", "Qualificação"], ["Carolina Mendes", "Vértice", "Site", "Proposta"], ["Diego Nunes", "Orbit", "Campanha", "Novo lead"], ["Fernanda Reis", "Acme Inc.", "Evento", "Negociação"]] },
  projetos: { kicker: "Operação", title: "Projetos", intro: "Veja o andamento dos projetos e os próximos marcos.", columns: ["Projeto", "Cliente", "Progresso", "Saúde"], rows: [["Website institucional", "Acme Inc.", "78%", "No prazo"], ["Aplicativo mobile", "Vértice", "46%", "Atenção"], ["Campanha de lançamento", "Nexum", "92%", "No prazo"], ["Portal do cliente", "Orbit", "28%", "No prazo"]] },
  receitas: { kicker: "Financeiro", title: "Receitas", intro: "Acompanhe entradas, vencimentos e recebimentos.", columns: ["Descrição", "Cliente", "Vencimento", "Valor"], rows: [["Mensalidade · Website", "Acme Inc.", "Hoje", "R$ 8.400"], ["Projeto · Aplicativo mobile", "Vértice", "22 Jun", "R$ 14.800"], ["Suporte mensal", "Nexum", "30 Jun", "R$ 5.200"], ["Consultoria", "Orbit", "05 Jul", "R$ 3.900"]] },
};

function renderWorkspaceView(hash, label) {
  if (!dashboardGrid) return;
  const key = hash?.replace("#", "");
  if (key === "inicio") {
    dashboardGrid.innerHTML = initialDashboardMarkup;
    return;
  }
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

logoutButton.addEventListener("click", () => {
  closeAccountMenu();
  showLogin();
  emailInput.focus();
});
