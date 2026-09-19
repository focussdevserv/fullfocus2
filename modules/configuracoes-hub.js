const hubEsc = (value) => escapeHtml(value ?? "");
const hubGroups = [["Essencial", [["hub-company", "Empresa e dados", "▦"], ["hub-finance", "Chave Pix e financeiro", "▣"], ["hub-appearance", "Marca, cores e tema", "◉"]]], ["Cobrança automática", [["hub-billing", "Bot de cobranças", "▣"], ["hub-messages", "Templates de mensagem", "□"], ["hub-default-message", "Mensagem padrão", "□"]]], ["Integrações", [["hub-whatsapp", "WhatsApp (Evolution)", "□"], ["hub-webhooks", "Webhooks / n8n", "♧"], ["hub-payments", "Mercado Pago", "▤"]]], ["Recursos", [["hub-portal", "Portal do cliente", "▦"], ["hub-contracts", "Modelo de contrato", "▤"]]], ["Conta e segurança", [["hub-account", "Minha conta", "♙"], ["hub-security", "Senha e segurança", "⬢"], ["hub-audit", "Auditoria", "◈"]]]];
const hubOptions = (items, value) => items.map(([key, label]) => `<option value="${hubEsc(key)}" ${String(value || "") === key ? "selected" : ""}>${hubEsc(label)}</option>`).join("");
const hubMenu = () => `<aside class="settings-hub-sidebar" aria-label="Menu de configurações"><div class="settings-hub-scroll">${hubGroups.map(([title, links]) => `<div class="settings-hub-group"><p>${title}</p>${links.map(([id, label, icon]) => `<button type="button" class="settings-hub-link" data-hub-section="${hubEsc(id)}"><span class="settings-hub-icon" aria-hidden="true">${icon}</span><span>${label}</span></button>`).join("")}</div>`).join("")}</div></aside>`;
const hubSave = async (form, message, action) => {
  if (form.dataset.hubSaving === "true") return;
  const button = form.querySelector("button[type=submit]"), feedback = form.querySelector("[data-hub-feedback]");
  form.dataset.hubSaving = "true";
  form.setAttribute("aria-busy", "true");
  button.disabled = true;
  button.setAttribute("aria-busy", "true");
  if (feedback) feedback.textContent = "Salvando…";
  try {
    await action();
    if (feedback) feedback.textContent = message;
    ui.toast(message, "success");
  } catch (error) {
    const errorMessage = error?.message || "Não foi possível salvar as alterações.";
    if (feedback) feedback.textContent = errorMessage;
    ui.toast(errorMessage, "error");
  } finally {
    delete form.dataset.hubSaving;
    form.removeAttribute("aria-busy");
    button.disabled = false;
    button.removeAttribute("aria-busy");
  }
};
async function renderSettingsHub() {
  if (location.hash !== "#configuracoes") return;
  dashboardGrid.setAttribute("aria-busy", "true");
  try {
    const [{ organization }, { user }] = await Promise.all([api("/api/organization"), api("/api/auth/me")]);
    const settings = { ...(organization.settings || {}) };
    dashboardGrid.innerHTML = `<section class="settings-hub-page"><header class="settings-hub-header"><div><p class="card-kicker">Workspace</p><h1>Configurações</h1><p>Administre todos os dados e recursos da Focussdev em um só lugar.</p></div><label class="settings-hub-search"><span aria-hidden="true">⌕</span><input type="search" data-hub-search placeholder="Buscar configuração…" autocomplete="off"></label><button class="button button-primary compact-action" type="button" data-hub-save-all>Salvar</button></header><div class="settings-hub-layout">${hubMenu()}<main class="settings-hub-content"><section id="hub-company" class="settings-hub-panel"><p class="card-kicker">Essencial</p><h2>Empresa e dados</h2><p class="settings-hub-muted">Informações usadas em propostas, contratos, cobranças e no portal do cliente.</p><form data-hub-company><div class="settings-hub-fields"><label>Nome da empresa<input name="name" value="${hubEsc(organization.name)}" required></label><label>CNPJ<input name="company_document" value="${hubEsc(settings.company_document)}" inputmode="numeric"></label><label>Site<input name="company_website" value="${hubEsc(settings.company_website)}" type="url"></label><label>Descrição<textarea name="company_description" rows="3">${hubEsc(settings.company_description)}</textarea></label></div><button class="button button-primary" type="submit">Salvar empresa</button><output data-hub-feedback></output></form></section><section id="hub-finance" class="settings-hub-panel"><p class="card-kicker">Essencial</p><h2>Chave Pix e financeiro</h2><p class="settings-hub-muted">Configure a chave usada para QR Code, Pix copia e cola e documentos Pix.</p><form data-hub-finance><div class="settings-hub-fields"><label>Tipo da chave Pix<select name="pix_key_type">${hubOptions([["email", "E-mail"], ["phone", "Telefone"], ["cpf", "CPF"], ["cnpj", "CNPJ"], ["random", "Aleatória"]], settings.pix_key_type || "email")}</select></label><label>Chave Pix<input name="pix_key" value="${hubEsc(settings.pix_key)}" placeholder="contato@focussdev.art" autocomplete="off"></label><label>Moeda<select name="currency">${hubOptions([["BRL", "Real brasileiro (BRL)"], ["USD", "Dólar (USD)"], ["EUR", "Euro (EUR)"]], settings.currency || "BRL")}</select></label><label>Multa padrão (%)<input name="late_fee" type="number" min="0" step="0.01" value="${hubEsc(settings.late_fee || 0)}"></label><label>Juros mensais (%)<input name="late_interest" type="number" min="0" step="0.01" value="${hubEsc(settings.late_interest || 0)}"></label></div><button class="button button-primary" type="submit">Salvar financeiro</button><output data-hub-feedback></output></form></section><section id="hub-appearance" class="settings-hub-panel"><p class="card-kicker">Aparência e módulos</p><h2>Marca, cores e tema</h2><form data-hub-appearance><div class="settings-hub-fields"><label>Tema<select name="theme">${hubOptions([["dark", "Modo escuro"], ["light", "Modo claro"], ["system", "Automático"]], settings.theme || "dark")}</select></label><label>Densidade<select name="density">${hubOptions([["comfortable", "Confortável"], ["compact", "Compacta"]], settings.density || "comfortable")}</select></label></div><button class="button button-primary" type="submit">Salvar aparência</button><output data-hub-feedback></output></form></section><section id="hub-account" class="settings-hub-panel"><p class="card-kicker">Conta e segurança</p><h2>Minha conta</h2><form data-hub-profile><div class="settings-hub-fields"><label>Nome<input name="name" value="${hubEsc(user.name)}" required></label><label>E-mail<input value="${hubEsc(user.email)}" disabled type="email"></label></div><button class="button button-primary" type="submit">Salvar perfil</button><output data-hub-feedback></output></form></section><section id="hub-security" class="settings-hub-panel"><p class="card-kicker">Conta e segurança</p><h2>Senha e segurança</h2><form data-hub-password><div class="settings-hub-fields"><label>Senha atual<input name="currentPassword" type="password" required autocomplete="current-password"></label><label>Nova senha<input name="newPassword" type="password" minlength="8" required autocomplete="new-password"></label><label>Confirmar nova senha<input name="confirm" type="password" minlength="8" required autocomplete="new-password"></label></div><button class="button button-primary" type="submit">Alterar senha</button><output data-hub-feedback></output></form></section><section class="settings-hub-panel settings-hub-links-panel"><p class="card-kicker">Atalhos</p><h2>Recursos conectados</h2><div class="settings-hub-shortcuts"><a href="#whatsapp">WhatsApp / Evolution <span>→</span></a><a href="#integracoes">Central de integrações <span>→</span></a><a href="#portal-do-cliente">Portal do cliente <span>→</span></a><a href="#templates">Templates de mensagem <span>→</span></a><a href="#auditoria">Auditoria e segurança <span>→</span></a></div></section></main></div></section>`;
    dashboardGrid.removeAttribute("aria-busy");
    const hubRouteMap = { "hub-company": "hub-company", "hub-finance": "hub-finance", "hub-appearance": "hub-appearance", "hub-account": "hub-account", "hub-security": "hub-security", "hub-audit": "auditoria", "hub-whatsapp": "whatsapp", "hub-webhooks": "integracoes", "hub-payments": "cobrancas", "hub-billing": "cobrancas", "hub-messages": "templates", "hub-default-message": "templates", "hub-portal": "portal-do-cliente", "hub-contracts": "contratos" };
    dashboardGrid.querySelectorAll("[data-hub-section]").forEach((button) => button.addEventListener("click", () => { const target = hubRouteMap[button.dataset.hubSection]; const local = document.getElementById(target); if (local) { local.scrollIntoView({ behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ? "auto" : "smooth", block: "start" }); local.querySelector("input,select,textarea,button")?.focus({ preventScroll: true }); return; } if (target && target !== "configuracoes") location.hash = `#${target}`; }));
    let settingsSaveQueue = Promise.resolve();
    const saveSettings = (form) => {
      const values = Object.fromEntries(new FormData(form));
      const organizationName = form.matches("[data-hub-company]") ? values.name : undefined;
      const sectionSettings = { ...values };
      delete sectionSettings.name;
      const save = settingsSaveQueue.catch(() => {}).then(async () => {
        const nextSettings = { ...settings, ...sectionSettings };
        const body = { settings: nextSettings };
        if (organizationName !== undefined) body.name = organizationName;
        await api("/api/organization", { method: "PATCH", body });
        Object.assign(settings, nextSettings);
        if (sectionSettings.theme) document.body.classList.toggle("dark-mode", sectionSettings.theme === "dark");
      });
      settingsSaveQueue = save;
      return save;
    };
    dashboardGrid.querySelector("[data-hub-company]")?.addEventListener("submit", (event) => { event.preventDefault(); hubSave(event.currentTarget, "Dados da empresa salvos.", () => saveSettings(event.currentTarget)); });
    dashboardGrid.querySelector("[data-hub-finance]")?.addEventListener("submit", (event) => { event.preventDefault(); hubSave(event.currentTarget, "Configuração financeira salva.", () => saveSettings(event.currentTarget)); });
    dashboardGrid.querySelector("[data-hub-appearance]")?.addEventListener("submit", (event) => { event.preventDefault(); hubSave(event.currentTarget, "Aparência salva.", () => saveSettings(event.currentTarget)); });
    dashboardGrid.querySelector("[data-hub-profile]")?.addEventListener("submit", (event) => { event.preventDefault(); hubSave(event.currentTarget, "Perfil salvo.", async () => { const data = Object.fromEntries(new FormData(event.currentTarget)); await api("/api/profile", { method: "PATCH", body: { name: data.name } }); }); });
    dashboardGrid.querySelector("[data-hub-password]")?.addEventListener("submit", (event) => { event.preventDefault(); const values = Object.fromEntries(new FormData(event.currentTarget)); if (values.newPassword !== values.confirm) return ui.toast("As senhas não coincidem.", "error"); hubSave(event.currentTarget, "Senha alterada.", () => api("/api/profile/password", { method: "POST", body: values })); });
    dashboardGrid.querySelector("[data-hub-save-all]")?.addEventListener("click", () => dashboardGrid.querySelectorAll("form[data-hub-company], form[data-hub-finance], form[data-hub-appearance]").forEach((form) => form.requestSubmit()));
    dashboardGrid.querySelector("[data-hub-search]")?.addEventListener("input", (event) => { const term = event.currentTarget.value.toLocaleLowerCase(); dashboardGrid.querySelectorAll(".settings-hub-panel, .settings-hub-link").forEach((node) => { node.hidden = Boolean(term && !node.textContent.toLocaleLowerCase().includes(term)); }); });
    let activeHubSection = "hub-company";
    const localHubPanels = [...dashboardGrid.querySelectorAll(".settings-hub-content > .settings-hub-panel[id]")];
    const activateHubSection = (sectionId) => {
      const panel = localHubPanels.find((item) => item.id === sectionId);
      if (!panel) return false;
      activeHubSection = sectionId;
      localHubPanels.forEach((item) => { item.hidden = item !== panel; });
      dashboardGrid.querySelectorAll("[data-hub-section]").forEach((button) => {
        const active = button.dataset.hubSection === sectionId;
        button.classList.toggle("is-active", active);
        if (active) button.setAttribute("aria-current", "page"); else button.removeAttribute("aria-current");
      });
      panel.querySelector("input, select, textarea, button")?.focus({ preventScroll: true });
      return true;
    };
    activateHubSection(activeHubSection);
    dashboardGrid.querySelectorAll("[data-hub-section]").forEach((button) => button.addEventListener("click", () => activateHubSection(button.dataset.hubSection)));
    dashboardGrid.querySelector("[data-hub-search]")?.addEventListener("input", (event) => { if (!event.currentTarget.value.trim()) activateHubSection(activeHubSection); });
  } catch (error) { dashboardGrid.removeAttribute("aria-busy"); dashboardGrid.innerHTML = stateBlock.error(error.message, "settings-hub-retry"); dashboardGrid.querySelector(".settings-hub-retry")?.addEventListener("click", renderSettingsHub); }
}
registerRoutes({ configuracoes: renderSettingsHub });
