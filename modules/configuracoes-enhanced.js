/* Configurações organizadas: preferências persistidas no workspace e perfil real. */
const settingEsc = (value) => escapeHtml(value ?? "");
const settingsToast = (...args) => { if (location.hash === "#configuracoes") ui.toast(...args); };
const settingOptions = (items, value) => items.map(([key, label]) => `<option value="${settingEsc(key)}" ${String(value || "") === key ? "selected" : ""}>${settingEsc(label)}</option>`).join("");
const applyWorkspaceTheme = (theme) => { const isDark = theme === "dark" || (theme === "system" && window.matchMedia?.("(prefers-color-scheme: dark)")?.matches); document.body.classList.toggle("dark-mode", Boolean(isDark)); document.querySelector('meta[name="theme-color"]')?.setAttribute("content", isDark ? "#050b18" : "#f5f7fb"); try { localStorage.setItem("focusdev_theme_v2", theme); } catch { /* preferência visual continua aplicada nesta sessão */ } };
let settingsRenderRequest = 0;

async function renderEnhancedSettings() {
  if (location.hash !== "#configuracoes") return;
  const request = ++settingsRenderRequest;
  dashboardGrid.setAttribute("aria-busy", "true");
  dashboardGrid.innerHTML = stateBlock.loading("Carregando configurações…");
  try {
    const [organizationData, meData] = await Promise.all([api("/api/organization"), api("/api/auth/me")]);
    if (request !== settingsRenderRequest || location.hash !== "#configuracoes") return;
    const organization = organizationData.organization, user = meData.user; let settings = { ...(organization.settings || {}) };
    applyWorkspaceTheme(settings.theme || "dark");
    dashboardGrid.removeAttribute("aria-busy");
    dashboardGrid.innerHTML = `${ui.header({ kicker: "Configuração", title: "Configurações do workspace", description: "Preferências centralizadas para empresa, aparência, agenda e financeiro." })}${ui.stats([{ label: "Conta", value: user.name ? "Completa" : "Pendente", tone: user.name ? "green" : "orange" }, { label: "Tema", value: settings.theme === "light" ? "Claro" : settings.theme === "system" ? "Automático" : "Escuro" }, { label: "Moeda", value: settings.currency || "BRL" }, { label: "Notificações", value: settings.notifications ? "Ativas" : "Desativadas", tone: settings.notifications ? "green" : undefined }])}<nav class="config-category-nav" aria-label="Categorias"><a href="#settings-account">Minha conta</a><a href="#settings-company">Empresa</a><a href="#settings-appearance">Aparência</a><a href="#settings-finance">Financeiro</a><a href="#settings-calendar">Agenda</a><a href="#settings-security">Segurança</a></nav><div class="config-grid"><section id="settings-account" class="data-card config-card"><p class="card-kicker">Minha conta</p><h3>Perfil do usuário</h3><form data-setting-profile><label>Nome completo<input name="name" value="${settingEsc(user.name)}" required></label><label>E-mail<input value="${settingEsc(user.email)}" disabled></label><button class="button button-primary" type="submit">Salvar perfil</button></form></section><section id="settings-company" class="data-card config-card"><p class="card-kicker">Empresa</p><h3>Dados da empresa</h3><form data-setting-company><label>Nome do workspace<input name="name" value="${settingEsc(organization.name)}" required></label><label>Descrição<textarea name="company_description" rows="3">${settingEsc(settings.company_description)}</textarea></label><label>CNPJ<input name="company_document" value="${settingEsc(settings.company_document)}" inputmode="numeric"></label><label>Site<input name="company_website" value="${settingEsc(settings.company_website)}" type="url"></label><button class="button button-primary" type="submit">Salvar empresa</button></form></section><section id="settings-appearance" class="data-card config-card"><p class="card-kicker">Aparência</p><h3>Preferências visuais</h3><form data-setting-appearance><label>Tema<select name="theme">${settingOptions([["dark", "Escuro"], ["light", "Claro"], ["system", "Automático"]], settings.theme || "dark")}</select></label><label>Formato de data<select name="date_format">${settingOptions([["dd/mm/yyyy", "DD/MM/AAAA"], ["yyyy-mm-dd", "AAAA-MM-DD"]], settings.date_format || "dd/mm/yyyy")}</select></label><label>Densidade<select name="density">${settingOptions([["comfortable", "Confortável"], ["compact", "Compacta"]], settings.density || "comfortable")}</select></label><button class="button button-primary" type="submit">Salvar aparência</button></form></section><section id="settings-finance" class="data-card config-card"><p class="card-kicker">Financeiro</p><h3>Preferências financeiras</h3><form data-setting-finance><label>Moeda<select name="currency">${settingOptions([["BRL", "Real brasileiro (BRL)"], ["USD", "Dólar (USD)"], ["EUR", "Euro (EUR)"]], settings.currency || "BRL")}</select></label><label>Chave Pix<input name="pix_key" value="${settingEsc(settings.pix_key)}" autocomplete="off"></label><label>Multa padrão (%)<input name="late_fee" type="number" min="0" max="100" step="0.01" value="${settingEsc(settings.late_fee || 0)}"></label><label>Juros mensais (%)<input name="late_interest" type="number" min="0" max="100" step="0.01" value="${settingEsc(settings.late_interest || 0)}"></label><button class="button button-primary" type="submit">Salvar financeiro</button></form></section><section id="settings-calendar" class="data-card config-card"><p class="card-kicker">Agenda</p><h3>Horário de funcionamento</h3><form data-setting-calendar><label>Início<input name="workday_start" type="time" value="${settingEsc(settings.workday_start || "09:00")}"></label><label>Fim<input name="workday_end" type="time" value="${settingEsc(settings.workday_end || "18:00")}"></label><label>Duração padrão (minutos)<input name="meeting_duration" type="number" min="5" max="480" step="5" value="${settingEsc(settings.meeting_duration || 30)}"></label><label><input name="notifications" type="checkbox" ${settings.notifications ? "checked" : ""}> Notificações no navegador</label><button class="button button-primary" type="submit">Salvar agenda</button></form></section><section id="settings-security" class="data-card config-card"><p class="card-kicker">Segurança</p><h3>Alterar senha</h3><form data-setting-password><label>Senha atual<input name="currentPassword" type="password" autocomplete="current-password" required></label><label>Nova senha<input name="newPassword" type="password" minlength="8" autocomplete="new-password" required></label><label>Confirmar senha<input name="confirm" type="password" minlength="8" autocomplete="new-password" required></label><button class="button button-primary" type="submit">Alterar senha</button></form></section></div>`;
    dashboardGrid.querySelectorAll("input, select, textarea").forEach((control) => {
      if (!control.name) control.name = control.type === "email" ? "email" : "setting";
      if (!control.getAttribute("autocomplete")) control.setAttribute("autocomplete", control.name === "name" ? "name" : control.name === "company_website" ? "url" : "off");
      if (control.name === "company_document") { control.inputMode = "numeric"; control.setAttribute("autocomplete", "off"); }
      const placeholders = { name: "Ex.: Ana Souza…", company_description: "Descreva brevemente sua empresa…", company_document: "Ex.: 12.345.678/0001-90…", company_website: "https://exemplo.com.br…", pix_key: "Ex.: contato@empresa.com…" };
      if (!control.getAttribute("placeholder") && placeholders[control.name]) control.setAttribute("placeholder", placeholders[control.name]);
    });
    dashboardGrid.querySelector("[data-setting-company] input[name=name]")?.setAttribute("autocomplete", "organization");
    const profileEmail = dashboardGrid.querySelector("[data-setting-profile] input[disabled]");
    if (profileEmail) { profileEmail.type = "email"; profileEmail.name = "email"; profileEmail.setAttribute("autocomplete", "username"); }
    const saveSettings = async (form, extra = {}) => { const values = Object.fromEntries(new FormData(form)); delete values.confirm; if (form.elements.notifications?.type === "checkbox") values.notifications = form.elements.notifications.checked; const nextSettings = { ...settings, ...extra, ...values }; await api("/api/organization", { method: "PATCH", body: { settings: nextSettings } }); settings = nextSettings; };
    const submitSafely = async (event, action, message) => { event.preventDefault(); const routeAtStart = location.hash, form = event.currentTarget, button = form.querySelector("[type=submit]"); if (button?.disabled) return; let feedback = form.querySelector("[data-settings-status]"); if (!feedback) { feedback = document.createElement("output"); feedback.dataset.settingsStatus = "true"; feedback.className = "config-form-status"; button?.after(feedback); } feedback.setAttribute("role", "status"); feedback.setAttribute("aria-live", "polite"); feedback.textContent = "Salvando…"; if (button) { button.disabled = true; button.setAttribute("aria-busy", "true"); } try { await action(); if (location.hash !== routeAtStart || location.hash !== "#configuracoes" || !form.isConnected) return; feedback.textContent = message; settingsToast(message, "success"); } catch (error) { if (location.hash === routeAtStart && form.isConnected) { feedback.setAttribute("role", "alert"); feedback.textContent = error.message; settingsToast(error.message, "error"); } } finally { if (button?.isConnected) { button.disabled = false; button.removeAttribute("aria-busy"); } } };
    dashboardGrid.querySelector("[data-setting-profile]").addEventListener("submit", (event) => submitSafely(event, async () => { const data = Object.fromEntries(new FormData(event.currentTarget)); const result = await api("/api/profile", { method: "PATCH", body: { name: data.name } }); if (location.hash === "#configuracoes" && event.currentTarget.isConnected) document.querySelectorAll(".account-name strong").forEach((node) => { node.textContent = result.user.name; }); }, "Perfil salvo."));
    dashboardGrid.querySelector("[data-setting-company]").addEventListener("submit", (event) => submitSafely(event, async () => { const data = Object.fromEntries(new FormData(event.currentTarget)); const nextSettings = { ...settings, company_description: data.company_description, company_document: data.company_document, company_website: data.company_website }; await api("/api/organization", { method: "PATCH", body: { name: data.name, settings: nextSettings } }); settings = nextSettings; }, "Dados da empresa salvos."));
    dashboardGrid.querySelector("[data-setting-appearance]").addEventListener("submit", (event) => submitSafely(event, async () => { const data = Object.fromEntries(new FormData(event.currentTarget)); await saveSettings(event.currentTarget, data); applyWorkspaceTheme(data.theme); }, "Aparência salva."));
    dashboardGrid.querySelector("[data-setting-finance]").addEventListener("submit", (event) => submitSafely(event, () => saveSettings(event.currentTarget), "Preferências financeiras salvas."));
    dashboardGrid.querySelector("[data-setting-calendar]").addEventListener("submit", (event) => submitSafely(event, () => saveSettings(event.currentTarget, { notifications: event.currentTarget.elements.notifications.checked }), "Preferências de agenda salvas."));
    dashboardGrid.querySelector("[data-setting-password]").addEventListener("submit", (event) => submitSafely(event, async () => { const values = Object.fromEntries(new FormData(event.currentTarget)); if (values.newPassword !== values.confirm) throw new Error("As senhas não coincidem."); await api("/api/profile/password", { method: "POST", body: values }); event.currentTarget.reset(); }, "Senha alterada."));
  } catch (error) { if (request !== settingsRenderRequest || location.hash !== "#configuracoes") return; dashboardGrid.removeAttribute("aria-busy"); dashboardGrid.innerHTML = stateBlock.error(error.message, "settings-retry"); dashboardGrid.querySelector(".settings-retry")?.addEventListener("click", renderEnhancedSettings); }
}
registerRoutes({ configuracoes: renderEnhancedSettings });
window.addEventListener("hashchange", () => {
  if (location.hash === "#configuracoes") return;
  settingsRenderRequest += 1;
});
dashboardGrid.addEventListener("click", (event) => {
  const link = event.target.closest?.(".config-category-nav a");
  if (!link) return;
  const target = document.querySelector(link.getAttribute("href"));
  if (!target) return;
  event.preventDefault();
  target.scrollIntoView({ behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ? "auto" : "smooth", block: "start" });
});
dashboardGrid.addEventListener("submit", (event) => {
  const passwordForm = event.target.closest?.("[data-setting-password]");
  if (passwordForm) {
    const newPassword = passwordForm.elements.newPassword?.value;
    const confirm = passwordForm.elements.confirm?.value;
    if (newPassword !== confirm) {
      passwordForm.elements.confirm?.focus();
    }
  }
  const form = event.target.closest?.("[data-setting-calendar]");
  if (!form) return;
  const start = form.elements.workday_start?.value;
  const end = form.elements.workday_end?.value;
  if (start && end && end <= start) {
    event.preventDefault();
    event.stopImmediatePropagation();
    settingsToast("O horário de encerramento deve ser posterior ao horário de início.", "error");
    form.elements.workday_end?.focus();
  }
}, true);

new MutationObserver(() => {
  dashboardGrid.querySelectorAll("button, .config-category-nav a").forEach((control) => { control.style.touchAction = "manipulation"; });
  dashboardGrid.querySelectorAll("[data-settings-status]").forEach((status) => { status.setAttribute("aria-live", "polite"); });
}).observe(dashboardGrid, { childList: true, subtree: true });
