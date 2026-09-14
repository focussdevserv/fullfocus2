const esc = (value) => escapeHtml(value ?? "");
const roleLabel = (role) => ({ owner: "Proprietário", admin: "Administrador", member: "Membro" }[role] || role || "Membro");

async function renderTeamAccess() {
  dashboardGrid.innerHTML = stateBlock.loading("Carregando equipe...");
  try {
    const [data, dashboard, roleData] = await Promise.all([api("/api/team/access-status"), api("/api/team/dashboard"), api("/api/team/roles").catch(() => ({ roles: [] }))]);
    const users = data.users || [], roles = roleData.roles || [], metrics = dashboard.members || {}, tasks = dashboard.tasks || {};
    dashboardGrid.innerHTML = `<section class="page-intro"><div><p class="card-kicker">Gestão</p><h2>Equipe</h2><p>Controle papéis, produtividade e acessos sem apagar o histórico.</p></div><button class="button button-secondary compact-action" type="button" data-revoke-all>Encerrar todas as sessões</button></section><section class="metrics"><article class="metric-card"><span class="metric-label">Membros</span><strong>${metrics.total || 0}</strong><small>${metrics.active || 0} ativos · ${metrics.inactive || 0} inativos</small></article><article class="metric-card"><span class="metric-label">Disponibilidade</span><strong>${metrics.available || 0}</strong><small>${metrics.online || 0} online · ${metrics.busy || 0} ocupados</small></article><article class="metric-card"><span class="metric-label">Tarefas</span><strong>${tasks.pending || 0}</strong><small>${tasks.overdue || 0} atrasadas</small></article><article class="metric-card"><span class="metric-label">Horas trabalhadas</span><strong>${Math.floor(Number(dashboard.hours?.total_minutes || 0) / 60)}h</strong><small>${dashboard.tickets?.total || 0} tickets em atendimento</small></article></section><section class="data-card config-card"><div class="config-members">${users.map((user) => `<article class="config-member"><div><strong>${esc(user.name)}</strong><small>${esc(user.email)} · ${esc(roleLabel(user.role))} · ${esc(user.access_status || "active")}</small></div>${roles.length ? `<select class="ui-select" data-team-role="${esc(user.id)}" aria-label="Cargo de ${esc(user.name)}"><option value="">Cargo padrão</option>${roles.map((role) => `<option value="${esc(role.id)}">${esc(role.name)}</option>`).join("")}</select>` : ""}<button class="compact-action" type="button" data-access="${esc(user.id)}" ${user.access_status !== "active" ? "disabled" : ""}>${user.access_status === "active" ? "Encerrar acesso" : "Usuário desativado"}</button></article>`).join("") || stateBlock.empty("Nenhum membro cadastrado.")}</div></section>`;
    dashboardGrid.querySelectorAll("[data-team-role]").forEach((select) => select.addEventListener("change", async () => { try { await api(`/api/team/${select.dataset.teamRole}/team-role`, { method: "PATCH", body: { team_role_id: select.value || null } }); ui.toast("Cargo atualizado.", "success"); } catch (error) { ui.toast(error.message, "error"); } }));
    dashboardGrid.querySelectorAll("[data-access]").forEach((button) => button.addEventListener("click", () => ui.confirmInline(button, { text: "Encerrar acesso?", onConfirm: async () => { await api(`/api/team/${button.dataset.access}/access`, { method: "PATCH", body: { access_status: "inactive" } }); ui.toast("Acesso encerrado.", "success"); renderTeamAccess(); } })));
    dashboardGrid.querySelector("[data-revoke-all]")?.addEventListener("click", (event) => ui.confirmInline(event.currentTarget, { text: "Todos precisarão entrar novamente. Confirmar?", onConfirm: async () => { await api("/api/team/sessions/revoke-all", { method: "POST" }); window.location.reload(); } }));
  } catch (error) { dashboardGrid.innerHTML = stateBlock.error(error.message, "team-retry"); }
}

registerRoutes({ equipe: renderTeamAccess });

const rolePanelObserver = new MutationObserver(() => {
  if (location.hash !== "#equipe" || dashboardGrid.querySelector("[data-new-team-role]")) return;
  api("/api/team/access-status").then((data) => { (data.users || []).forEach((user) => { const select = dashboardGrid.querySelector(`[data-team-role="${CSS.escape(String(user.id))}"]`); if (select) select.value = user.team_role_id ? String(user.team_role_id) : ""; }); }).catch(() => {});
  const panel = document.createElement("section"); panel.className = "data-card config-card"; panel.innerHTML = `<h3>Novo cargo personalizado</h3><p>Defina permissões JSON e campos ocultos para este cargo.</p><form data-new-team-role><input name="name" placeholder="Nome do cargo" required><input name="department" placeholder="Departamento"><textarea name="permissions" rows="3" placeholder='{"crm":{"view":true,"create":false}}'>{}</textarea><input name="hidden_fields" placeholder='["pix_key","internal_notes"]'><button class="button button-primary" type="submit">Criar cargo</button><output data-role-result></output></form>`;
  dashboardGrid.append(panel);
  panel.querySelector("form").addEventListener("submit", async (event) => {
    event.preventDefault(); const form = event.currentTarget, values = Object.fromEntries(new FormData(form));
    try { await api("/api/team_roles", { method: "POST", body: { name: values.name, department: values.department, permissions: JSON.parse(values.permissions || "{}"), hidden_fields: JSON.parse(values.hidden_fields || "[]") } }); ui.toast("Cargo criado.", "success"); renderTeamAccess(); }
    catch (error) { form.querySelector("[data-role-result]").textContent = error.message.includes("JSON") ? "Permissões e campos ocultos devem ser JSON válido." : error.message; }
  });
});
rolePanelObserver.observe(dashboardGrid, { childList: true });
