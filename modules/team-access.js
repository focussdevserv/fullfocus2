const esc = (value) => escapeHtml(value ?? "");
const teamListState = { search: "", status: "", availability: "", request: 0 };
const roleLabel = (role) => ({ owner: "Proprietário", admin: "Administrador", member: "Membro" }[role] || role || "Membro");

async function renderTeamAccess() {
  if (location.hash !== "#equipe") return;
  const request = teamListState.request = (teamListState.request || 0) + 1;
  const restoreSearchFocus = ui.keepSearchFocus(dashboardGrid, "[data-team-search]");
  dashboardGrid.setAttribute("aria-busy", "true");
  dashboardGrid.innerHTML = stateBlock.loading("Carregando equipe…");
  try {
    const params = new URLSearchParams(); if (teamListState.search) params.set("search", teamListState.search); if (teamListState.status) params.set("status", teamListState.status); if (teamListState.availability) params.set("availability", teamListState.availability);
    const [data, dashboard, roleData] = await Promise.all([api(`/api/team/access-status?${params}`), api("/api/team/dashboard"), api("/api/team/roles").catch(() => ({ roles: [] }))]);
    if (request !== teamListState.request || location.hash !== "#equipe") return;
    const users = data.users || [], roles = roleData.roles || [], metrics = dashboard.members || {}, tasks = dashboard.tasks || {};
    const accessLabel = { active: "Ativo", inactive: "Inativo", blocked: "Bloqueado", suspended: "Suspenso" };
    dashboardGrid.innerHTML = `<section class="page-intro"><div><p class="card-kicker">Gestão</p><h2>Equipe</h2><p>Controle papéis, produtividade e acessos sem apagar o histórico.</p></div><button class="button button-secondary compact-action" type="button" data-revoke-all>Encerrar todas as sessões</button></section>${ui.stats([{ label: "Membros", value: ui.number(metrics.total || 0), note: `${metrics.active || 0} ativos · ${metrics.inactive || 0} inativos` }, { label: "Disponibilidade", value: ui.number(metrics.available || 0), note: `${metrics.online || 0} online · ${metrics.busy || 0} ocupados`, tone: "green" }, { label: "Tarefas pendentes", value: ui.number(tasks.pending || 0), note: `${tasks.overdue || 0} atrasadas`, tone: tasks.overdue ? "orange" : undefined }, { label: "Horas trabalhadas", value: `${Math.floor(Number(dashboard.hours?.total_minutes || 0) / 60)}h`, note: `${dashboard.tickets?.total || 0} tickets em atendimento` }])}<section class="data-card config-card"><div class="config-members">${users.map((user) => `<article class="config-member"><div><strong>${esc(user.name)}</strong><small>${esc(user.email)} · ${esc(roleLabel(user.role))} · ${esc(accessLabel[user.access_status] || user.access_status || "Ativo")}</small></div>${roles.length ? `<select class="ui-select" data-team-role="${esc(user.id)}" aria-label="Cargo de ${esc(user.name)}"><option value="">Cargo padrão</option>${roles.map((role) => `<option value="${esc(role.id)}">${esc(role.name)}</option>`).join("")}</select>` : ""}<button class="compact-action" type="button" data-access="${esc(user.id)}" ${user.access_status !== "active" ? "disabled" : ""}>${user.access_status === "active" ? "Encerrar acesso" : "Usuário desativado"}</button></article>`).join("") || stateBlock.empty("Nenhum membro cadastrado.")}</div></section>`;
    restoreSearchFocus();
    users.forEach((user) => { const select = dashboardGrid.querySelector(`[data-team-role="${CSS.escape(String(user.id))}"]`); if (select) { select.name = "team_role_id"; select.setAttribute("autocomplete", "off"); if (user.team_role_id != null) select.value = String(user.team_role_id); select.dataset.previous = select.value; } });
    const membersCard = dashboardGrid.querySelector(".config-members"); if (membersCard && !dashboardGrid.querySelector("[data-team-search]")) { membersCard.insertAdjacentHTML("beforebegin", `<div class="filters-bar"><input data-team-search placeholder="Buscar membro, e-mail ou cargo…" aria-label="Buscar membro"><select data-team-status aria-label="Filtrar por status"><option value="">Todos os status</option><option value="active">Ativos</option><option value="inactive">Inativos</option><option value="blocked">Bloqueados</option></select><select data-team-availability aria-label="Filtrar disponibilidade"><option value="">Toda disponibilidade</option><option value="online">Online</option><option value="available">Disponível</option><option value="busy">Ocupado</option><option value="offline">Offline</option></select></div>`); }
    const statusFilter = dashboardGrid.querySelector("[data-team-status]"); if (statusFilter) { statusFilter.name = "status"; statusFilter.setAttribute("autocomplete", "off"); statusFilter.value = teamListState.status; statusFilter.onchange = () => { teamListState.status = statusFilter.value; renderTeamAccess(); }; } const availabilityFilter = dashboardGrid.querySelector("[data-team-availability]"); if (availabilityFilter) { availabilityFilter.name = "availability"; availabilityFilter.setAttribute("autocomplete", "off"); availabilityFilter.value = teamListState.availability; availabilityFilter.onchange = () => { teamListState.availability = availabilityFilter.value; renderTeamAccess(); }; } const search = dashboardGrid.querySelector("[data-team-search]"); if (search) { search.name = "search"; search.placeholder = "Buscar membro, e-mail ou cargo…"; search.setAttribute("autocomplete", "off"); search.value = teamListState.search; let timer; search.oninput = () => { clearTimeout(timer); teamListState.search = search.value.trim(); timer = setTimeout(renderTeamAccess, 250); }; }
    dashboardGrid.querySelectorAll("[data-team-role]").forEach((select) => select.addEventListener("change", async () => { if (select.disabled) return; const routeAtStart = location.hash, previous = select.dataset.previous ?? select.value; select.disabled = true; select.setAttribute("aria-busy", "true"); try { await api(`/api/team/${select.dataset.teamRole}/team-role`, { method: "PATCH", body: { team_role_id: select.value || null } }); if (location.hash !== routeAtStart || location.hash !== "#equipe") return; select.dataset.previous = select.value; ui.toast("Cargo atualizado.", "success"); } catch (error) { if (location.hash === routeAtStart && select.isConnected) { select.value = previous; select.dataset.previous = previous; ui.toast(error.message || "Não foi possível atualizar o cargo.", "error"); } } finally { if (select.isConnected) { select.disabled = false; select.removeAttribute("aria-busy"); } } }));
    dashboardGrid.querySelectorAll("[data-access]").forEach((button) => button.addEventListener("click", () => ui.confirmInline(button, { text: "Encerrar acesso?", onConfirm: async () => { const routeAtStart = location.hash, originalLabel = button.textContent; button.disabled = true; button.setAttribute("aria-busy", "true"); button.textContent = "Encerrando…"; try { await api(`/api/team/${button.dataset.access}/access`, { method: "PATCH", body: { access_status: "inactive" } }); if (location.hash === routeAtStart && location.hash === "#equipe") { ui.toast("Acesso encerrado.", "success"); renderTeamAccess(); } } catch (error) { if (button.isConnected) { button.disabled = false; button.removeAttribute("aria-busy"); button.textContent = originalLabel; ui.toast(error.message, "error"); } } } })));
    dashboardGrid.querySelector("[data-revoke-all]")?.addEventListener("click", (event) => ui.confirmInline(event.currentTarget, { text: "Todos precisarão entrar novamente. Confirmar?", onConfirm: async () => { const button = event.currentTarget, routeAtStart = location.hash; const originalLabel = button.textContent; button.disabled = true; button.setAttribute("aria-busy", "true"); button.textContent = "Encerrando sessões…"; try { await api("/api/team/sessions/revoke-all", { method: "POST" }); if (location.hash === routeAtStart && routeAtStart === "#equipe") window.location.reload(); } catch (error) { if (location.hash !== routeAtStart || !button.isConnected) return; button.disabled = false; button.removeAttribute("aria-busy"); button.textContent = originalLabel; ui.toast(error.message, "error"); } } }));
  } catch (error) { if (request !== teamListState.request || location.hash !== "#equipe") return; dashboardGrid.removeAttribute("aria-busy"); dashboardGrid.innerHTML = stateBlock.error(error.message, "team-retry"); }
}

registerRoutes({ equipe: renderTeamAccess });
dashboardGrid.addEventListener("click", (event) => {
  const button = event.target.closest?.("[data-access]");
  if (!button || location.hash !== "#equipe" || button.disabled || button.dataset.accessGuarded === "1") return;
  event.preventDefault();
  event.stopImmediatePropagation();
  button.dataset.accessGuarded = "1";
  const routeAtStart = location.hash;
  const requestAtStart = teamListState.request;
  ui.confirmInline(button, {
    text: "Encerrar acesso?",
    onConfirm: async () => {
      const originalLabel = button.textContent;
      button.disabled = true;
      button.setAttribute("aria-busy", "true");
      button.textContent = "Encerrando…";
      try {
        await api(`/api/team/${button.dataset.access}/access`, { method: "PATCH", body: { access_status: "inactive" } });
        if (location.hash !== routeAtStart || routeAtStart !== "#equipe" || requestAtStart !== teamListState.request || !button.isConnected) return;
        ui.toast("Acesso encerrado.", "success");
        renderTeamAccess();
      } catch (error) {
        if (location.hash !== routeAtStart || !button.isConnected) return;
        button.disabled = false;
        button.removeAttribute("aria-busy");
        button.textContent = originalLabel;
        throw error;
      } finally {
        if (button.isConnected) {
          button.disabled = false;
          button.removeAttribute("aria-busy");
        }
        delete button.dataset.accessGuarded;
      }
    },
    onCancel: () => { delete button.dataset.accessGuarded; },
  });
}, true);
dashboardGrid.addEventListener("focusin", (event) => { if (event.target.matches?.("[data-team-search]")) event.target.setAttribute("autocomplete", "off"); });
dashboardGrid.addEventListener("click", async (event) => {
  const button = event.target.closest?.("[data-copy-invite]");
  if (!button || location.hash !== "#equipe") return;
  event.preventDefault();
  event.stopImmediatePropagation();
  const link = button.parentElement?.querySelector(".invite-link")?.value;
  if (!link) return;
  button.disabled = true;
  try { await ui.copyText(link); ui.toast("Link copiado.", "success"); }
  catch (error) { ui.toast(error.message, "error"); }
  finally { button.disabled = false; }
}, true);
dashboardGrid.addEventListener("click", (event) => { if (event.target.closest(".team-retry")) renderTeamAccess(); });

const rolePanelObserver = new MutationObserver(() => {
  if (location.hash !== "#equipe" || dashboardGrid.querySelector("[data-new-team-role]")) return;
  const routeAtStart = location.hash;
  api("/api/team/access-status").then((data) => { if (location.hash !== routeAtStart || routeAtStart !== "#equipe") return; (data.users || []).forEach((user) => { const select = dashboardGrid.querySelector(`[data-team-role="${CSS.escape(String(user.id))}"]`); if (select?.isConnected) select.value = user.team_role_id ? String(user.team_role_id) : ""; }); }).catch(() => {});
  const panel = document.createElement("section"); panel.className = "data-card config-card"; panel.innerHTML = `<h3>Novo cargo personalizado</h3><p>Defina permissões JSON e campos ocultos para este cargo.</p><form data-new-team-role><input name="name" placeholder="Nome do cargo…" required><input name="department" placeholder="Departamento…"><textarea name="permissions" rows="3" placeholder='{"crm":{"view":true,"create":false}}…'>{}</textarea><input name="hidden_fields" placeholder='["pix_key","internal_notes"]…'><button class="button button-primary" type="submit">Criar cargo</button><output data-role-result></output></form>`;
  dashboardGrid.append(panel);
  panel.querySelectorAll("input, textarea").forEach((control) => { control.setAttribute("aria-label", control.name === "hidden_fields" ? "Campos ocultos em JSON" : control.name === "permissions" ? "Permissões em JSON" : control.name === "department" ? "Departamento" : "Nome do cargo"); control.setAttribute("autocomplete", "off"); });
  const invite = document.createElement("section"); invite.className = "data-card config-card team-invite-card"; invite.innerHTML = `<p class="card-kicker">Acesso</p><h3>Convidar membro</h3><p>Envie um link seguro para a pessoa entrar no workspace.</p><form data-team-invite><label>Nome<input name="name" required placeholder="Nome completo…"></label><label>E-mail<input name="email" type="email" required placeholder="nome@empresa.com…"></label><label>Permissão<select name="role"><option value="member">Membro</option><option value="admin">Administrador</option></select></label><button class="button button-primary" type="submit">Enviar convite</button><output data-team-invite-result role="status"></output></form></section>`; dashboardGrid.append(invite);
  invite.querySelectorAll("input, select, textarea").forEach((control) => { if (control.type === "email") control.setAttribute("autocomplete", "email"); else if (!control.getAttribute("autocomplete")) control.setAttribute("autocomplete", "off"); });
  invite.querySelector("form")?.addEventListener("submit", async (event) => { event.preventDefault(); const routeAtStart = location.hash, form = event.currentTarget, button = form.querySelector("[type=submit]"), result = form.querySelector("[data-team-invite-result]"), values = Object.fromEntries(new FormData(form)); button.disabled = true; button.setAttribute("aria-busy", "true"); result.setAttribute("role", "status"); result.textContent = "Gerando convite…"; try { const data = await api("/api/team/invite", { method: "POST", body: values }); if (location.hash !== routeAtStart || location.hash !== "#equipe" || !form.isConnected) return; result.innerHTML = `Convite criado. <button class="text-action" type="button" data-copy-invite>Copiar link</button><input class="invite-link" readonly value="${esc(data.resetLink)}" aria-label="Link de convite">`; result.querySelector("[data-copy-invite]")?.addEventListener("click", async () => { const copied = await ui.copyText(data.resetLink); ui.toast(copied ? "Link copiado." : "Não foi possível copiar o link.", copied ? "success" : "error"); }); form.reset(); ui.toast("Convite criado.", "success"); } catch (error) { if (location.hash === routeAtStart && result.isConnected) { result.setAttribute("role", "alert"); result.textContent = error.message || "Não foi possível criar o convite. Tente novamente."; } } finally { if (button.isConnected) { button.disabled = false; button.removeAttribute("aria-busy"); } } });
  panel.querySelector("form").addEventListener("submit", async (event) => {
    event.preventDefault(); const form = event.currentTarget, button = form.querySelector("[type=submit]"), result = form.querySelector("[data-role-result]"), values = Object.fromEntries(new FormData(form)), routeAtStart = location.hash; if (button.disabled) return; button.disabled = true; button.setAttribute("aria-busy", "true"); result.setAttribute("role", "status"); result.setAttribute("aria-live", "polite"); result.textContent = "Criando cargo…";
    try { await api("/api/team_roles", { method: "POST", body: { name: values.name, department: values.department, permissions: JSON.parse(values.permissions || "{}"), hidden_fields: JSON.parse(values.hidden_fields || "[]") } }); if (location.hash !== routeAtStart || routeAtStart !== "#equipe" || !form.isConnected) return; ui.toast("Cargo criado.", "success"); renderTeamAccess(); }
    catch (error) { if (location.hash !== routeAtStart || !form.isConnected) return; result.setAttribute("role", "alert"); result.textContent = error.message.includes("JSON") ? "Permissões e campos ocultos devem ser JSON válido." : error.message; }
    finally { if (button.isConnected) { button.disabled = false; button.removeAttribute("aria-busy"); } }
  });
});
rolePanelObserver.observe(dashboardGrid, { childList: true });

const profileButtonObserver = new MutationObserver(() => {
  if (location.hash !== "#equipe") return;
  dashboardGrid.querySelectorAll(".config-member").forEach((member) => {
    if (member.querySelector("[data-profile]") || !member.querySelector("[data-access]")) return;
    const access = member.querySelector("[data-access]");
    const button = document.createElement("button");
    button.className = "compact-action";
    button.type = "button";
    button.dataset.profile = access.dataset.access;
    button.textContent = "Editar perfil";
    member.append(button);
  });
});
profileButtonObserver.observe(dashboardGrid, { childList: true, subtree: true });
dashboardGrid.addEventListener("submit", (event) => {
  const form = event.target.closest?.("[data-new-team-role]");
  if (!form) return;
  const invalid = ["permissions", "hidden_fields"].find((name) => {
    try { JSON.parse(form.elements[name]?.value || (name === "permissions" ? "{}" : "[]")); return false; } catch { return true; }
  });
  if (!invalid) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  const result = form.querySelector("[data-role-result]");
  if (result) { result.setAttribute("role", "alert"); result.textContent = "Permissões e campos ocultos devem ser JSON válido."; }
  form.elements[invalid]?.focus();
}, true);
dashboardGrid.addEventListener("click", (event) => {
  const button = event.target.closest("[data-profile]");
  if (!button || location.hash !== "#equipe") return;
  if (button.dataset.busy === "1") return;
  const routeAtStart = location.hash, originalLabel = button.textContent;
  button.dataset.busy = "1";
  button.disabled = true;
  button.setAttribute("aria-busy", "true");
  button.textContent = "Carregando…";
  api("/api/team/access-status").then((data) => {
    const member = (data.users || []).find((item) => String(item.id) === String(button.dataset.profile));
    if (!member || location.hash !== routeAtStart || routeAtStart !== "#equipe" || !button.isConnected) return;
    ui.form({
      title: `Perfil de ${member.name}`,
      subtitle: "Dados profissionais e disponibilidade",
      values: member,
      fields: [
        { name: "job_title", label: "Cargo", required: false },
        { name: "department", label: "Departamento", required: false },
        { name: "phone", label: "Telefone", required: false, type: "tel", half: true },
        { name: "whatsapp", label: "WhatsApp", required: false, type: "tel", half: true },
        { name: "employment_type", label: "Tipo de vínculo", required: false },
        { name: "started_on", label: "Data de entrada", required: false, type: "date", half: true },
        { name: "access_expires_on", label: "Expiração do acesso", required: false, type: "date", half: true },
        { name: "hourly_rate", label: "Valor por hora", required: false, type: "number", min: 0, half: true },
        { name: "monthly_rate", label: "Valor mensal", required: false, type: "number", min: 0, half: true },
        { name: "commission_rate", label: "Comissão (%)", required: false, type: "number", min: 0, max: 100, half: true },
        { name: "experience_level", label: "Nível de experiência", required: false },
        { name: "availability", label: "Disponibilidade", required: false, type: "select", options: [["", "Não informado"], ["online", "Online"], ["available", "Disponível"], ["busy", "Ocupado"], ["offline", "Offline"]] },
        { name: "skills", label: "Habilidades", required: false, type: "textarea", rows: 3 },
        { name: "two_factor_enabled", label: "Autenticação em duas etapas", required: false, type: "checkbox", text: "Ativada" },
      ],
      onSubmit: async (values) => { const routeAtStart = location.hash; await api(`/api/team/${button.dataset.profile}/profile`, { method: "PATCH", body: values }); if (location.hash !== routeAtStart || location.hash !== "#equipe") return; ui.toast("Perfil atualizado.", "success"); renderTeamAccess(); },
    });
  }).catch((error) => { if (location.hash === routeAtStart && button.isConnected) ui.toast(error.message, "error"); }).finally(() => {
    if (button.isConnected) { button.disabled = false; button.removeAttribute("aria-busy"); button.dataset.busy = ""; button.textContent = originalLabel; }
  });
});

new MutationObserver(() => {
  if (dashboardGrid.querySelector(".state-loading")) dashboardGrid.setAttribute("aria-busy", "true");
  else dashboardGrid.removeAttribute("aria-busy");
  dashboardGrid.querySelectorAll("input, select, textarea").forEach((control) => {
    control.style.touchAction = "manipulation";
    if (!control.name && !control.disabled) control.name = "field";
    if (!control.getAttribute("autocomplete") && control.type !== "password") control.setAttribute("autocomplete", "off");
  });
  dashboardGrid.querySelectorAll("button").forEach((button) => {
    button.style.touchAction = "manipulation";
    if (button.disabled) button.setAttribute("aria-busy", "true");
    else button.removeAttribute("aria-busy");
  });
  dashboardGrid.querySelectorAll("[data-team-invite-result], [data-role-result]").forEach((output) => output.setAttribute("aria-live", "polite"));
  dashboardGrid.querySelectorAll(".state-loading p").forEach((label) => { if (label.textContent?.includes("...")) label.textContent = label.textContent.replaceAll("...", "…"); });
}).observe(dashboardGrid, { childList: true, subtree: true, attributes: true, attributeFilter: ["disabled"] });
