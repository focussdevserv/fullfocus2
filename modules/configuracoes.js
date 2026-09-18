// As rotas "configuracoes" e "equipe" são registradas por configuracoes-enhanced.js e team-access.js;
// este arquivo só contribui acessibilidade/estado genéricos e o submit handler abaixo.
new MutationObserver(() => {
  const labels = { name: "Nome", email: "E-mail", currentPassword: "Senha atual", newPassword: "Nova senha", confirm: "Confirmar nova senha", company_description: "Descrição da empresa", company_document: "Documento da empresa", company_website: "Site da empresa", notifications: "Notificações do navegador" };
  dashboardGrid.querySelectorAll("input, select, textarea").forEach((control) => {
    if (!control.name && !control.disabled) control.name = control.dataset.notifications !== undefined ? "notifications" : "field";
    if (!control.getAttribute("autocomplete") && control.type !== "password") control.setAttribute("autocomplete", "off");
    if (!control.getAttribute("aria-label") && !control.closest("label") && !control.id) control.setAttribute("aria-label", labels[control.name] || "Campo de configuração");
  });
  dashboardGrid.querySelectorAll("form button[type=submit]").forEach((button) => {
    if (button.disabled) button.setAttribute("aria-busy", "true");
    else button.removeAttribute("aria-busy");
  });
  dashboardGrid.querySelectorAll(".state-loading p").forEach((label) => { if (label.textContent?.includes("...")) label.textContent = label.textContent.replaceAll("...", "…"); });
  if (dashboardGrid.querySelector(".state-loading")) dashboardGrid.setAttribute("aria-busy", "true");
  else dashboardGrid.removeAttribute("aria-busy");
}).observe(dashboardGrid, { childList: true, subtree: true, attributes: true, attributeFilter: ["disabled"] });

dashboardGrid.addEventListener("submit", async (event) => {
  const form = event.target.closest?.("[data-profile], [data-password]");
  if (!form || !dashboardGrid.contains(form)) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  const submit = form.querySelector("button[type=submit], button:not([type])");
  let status = form.querySelector("[data-form-status]");
  if (!status) {
    status = document.createElement("p");
    status.dataset.formStatus = "true";
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    form.append(status);
  }
  const values = Object.fromEntries(new FormData(form));
  if (form.matches("[data-password]") && values.newPassword !== values.confirm) {
    status.setAttribute("role", "alert");
    status.textContent = "As senhas não coincidem. Revise a confirmação.";
    form.elements.confirm?.focus();
    return;
  }
  const originalLabel = submit?.textContent || "Salvar";
  if (submit) { submit.disabled = true; submit.setAttribute("aria-busy", "true"); submit.textContent = form.matches("[data-password]") ? "Alterando…" : "Salvando…"; }
  status.setAttribute("role", "status");
  status.textContent = "Processando…";
  try {
    if (form.matches("[data-password]")) {
      await api("/api/profile/password", { method: "POST", body: values });
      form.reset();
      status.textContent = "Senha alterada com sucesso.";
    } else {
      const data = await api("/api/profile", { method: "PATCH", body: { name: values.name } });
      document.querySelectorAll(".account-name strong").forEach((node) => { node.textContent = data.user.name; });
      status.textContent = "Perfil salvo com sucesso.";
    }
  } catch (error) {
    status.setAttribute("role", "alert");
    status.textContent = error.message || "Não foi possível salvar. Tente novamente.";
  } finally {
    if (submit) { submit.disabled = false; submit.removeAttribute("aria-busy"); submit.textContent = originalLabel; }
  }
}, true);
