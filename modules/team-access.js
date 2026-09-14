const esc = (value) => escapeHtml(value ?? "");
async function renderTeamAccess() {
  dashboardGrid.innerHTML = stateBlock.loading("Carregando equipe...");
  try {
    const data = await api("/api/team/access-status"); const users = data.users || [];
    dashboardGrid.innerHTML = `<section class="page-intro"><div><p class="card-kicker">Gestão</p><h2>Equipe</h2><p>Controle papéis e encerre acessos sem apagar o histórico.</p></div></section><section class="data-card config-card"><div class="config-members">${users.map((user) => `<article class="config-member"><div><strong>${esc(user.name)}</strong><small>${esc(user.email)} · ${esc(user.role)} · ${esc(user.access_status || "active")}</small></div><button class="compact-action" type="button" data-access="${esc(user.id)}" data-status="${esc(user.access_status || "active")}" ${user.access_status !== "active" ? "disabled" : ""}>${user.access_status === "active" ? "Encerrar acesso" : "Usuário desativado"}</button></article>`).join("") || stateBlock.empty("Nenhum membro cadastrado.")}</div></section>`;
    dashboardGrid.querySelectorAll("[data-access]").forEach((button) => button.addEventListener("click", async () => { if (!window.confirm("Encerrar o acesso deste usuário? O cadastro será preservado.")) return; await api(`/api/team/${button.dataset.access}/access`, { method: "PATCH", body: { access_status: "inactive" } }); renderTeamAccess(); }));
  } catch (error) { dashboardGrid.innerHTML = stateBlock.error(error.message, "team-retry"); }
}
registerRoutes({ equipe: renderTeamAccess });
