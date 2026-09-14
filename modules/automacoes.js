const tr = {
  lead_created: "Novo lead", lead_stage_changed: "Lead mudou de etapa", lead_no_response: "Lead sem resposta",
  meeting_scheduled: "Reunião agendada", proposal_created: "Proposta criada", proposal_sent: "Proposta enviada",
  proposal_viewed: "Proposta visualizada", proposal_approved: "Proposta aprovada", contract_signed: "Contrato assinado",
  project_created: "Projeto criado", task_due_soon: "Tarefa próxima do prazo", task_overdue: "Tarefa atrasada",
  project_overdue: "Projeto atrasado", receivable_due_soon: "Parcela próxima do vencimento", receivable_overdue: "Parcela vencida",
  payment_confirmed: "Pagamento confirmado", payment_overdue: "Pagamento atrasado", ticket_created: "Ticket aberto",
  ticket_no_response: "Ticket sem resposta", customer_message: "Cliente enviou mensagem", scheduled_datetime: "Data ou horário definido",
  webhook_received: "Webhook recebido", freelancer_project_finished: "Freelancer finalizou projeto", sale_won: "Venda concluída", team_member_invited: "Novo membro convidado", member_added_to_project: "Membro adicionado a projeto", project_member_added: "Membro adicionado a projeto", task_assigned: "Tarefa atribuída", member_overloaded: "Membro sobrecarregado", absence_started: "Férias iniciadas", user_deactivated: "Usuário desativado",
};
const act = {
  notify: "Enviar notificação", notify_responsible: "Lembrar responsável", create_task: "Criar tarefa", send_message: "Enviar WhatsApp", send_email: "Enviar e-mail", send_onboarding: "Enviar acesso e orientações",
  create_followup: "Criar follow-up", create_charge: "Criar cobrança", generate_contract: "Gerar contrato", create_project: "Criar projeto",
  update_status: "Alterar status", move_pipeline: "Mover no funil", assign_owner: "Atribuir responsável", add_tag: "Adicionar etiqueta",
  webhook: "Chamar webhook", n8n_flow: "Executar fluxo n8n", wait: "Aguardar período", end: "Encerrar automação",
  calculate_commission: "Calcular comissão", reassign_support: "Reatribuir atendimentos", create_calendar_event: "Criar evento no calendário",
  request_satisfaction: "Solicitar pesquisa de satisfação", generate_document: "Gerar e enviar documento", grant_project_access: "Liberar arquivos e tarefas", revoke_access: "Encerrar acesso",
};
const tk = { proposal: "Proposta", contract: "Contrato", project: "Projeto", task: "Tarefa", checklist: "Checklist", charge: "Cobrança", followup: "Follow-up", support: "Atendimento", ticket: "Resposta de ticket", briefing: "Briefing", delivery_term: "Termo de entrega", report: "Relatório", notification: "Notificação", email: "E-mail", message: "Mensagem", whatsapp: "WhatsApp" };
const providers = { whatsapp: "WhatsApp/Evolution API", email: "Gmail", smtp: "SMTP", google_calendar: "Google Calendar", google_drive: "Google Drive", github: "GitHub", n8n: "n8n", asaas: "Asaas", stripe: "Stripe", firebase: "Firebase", supabase: "Supabase", cnpj: "Consulta CNPJ", esign: "Assinatura eletrônica", webhook: "Webhook", api: "API própria" };
const e = (value) => escapeHtml(value ?? "");
const optionFields = (options) => ({ type: "select", options: Object.entries(options) });

const configs = {
  automation: {
    title: "Nova automação", endpoint: "/api/automations",
    fields: [
      { name: "name", label: "Nome" }, { name: "description", label: "Descrição", required: false },
      { name: "trigger", label: "Gatilho", ...optionFields(tr) }, { name: "action", label: "Ação", ...optionFields(act) },
      { name: "config", label: "Configuração JSON (ex.: {\"rate\":10})", required: false },
      { name: "conditions", label: "Condições JSON", required: false }, { name: "actions", label: "Ações adicionais JSON", required: false },
      { name: "active", label: "Ativa (true/false)", required: false },
    ],
  },
  template: {
    title: "Novo template", endpoint: "/api/templates",
    fields: [{ name: "kind", label: "Tipo", ...optionFields(tk) }, { name: "name", label: "Nome" }, { name: "subject", label: "Assunto", required: false }, { name: "body", label: "Conteúdo" }, { name: "variables", label: "Variáveis", required: false }, { name: "category", label: "Categoria", required: false }],
  },
  integration: {
    title: "Nova integração", endpoint: "/api/integrations",
    fields: [{ name: "provider", label: "Provedor", ...optionFields(providers) }, { name: "account_name", label: "Conta conectada", required: false }, { name: "config", label: "Configuração JSON", required: false }],
  },
};
Object.assign(createConfig, configs);

async function list(path, title, kind, render) {
  dashboardGrid.innerHTML = `<section class="page-intro"><div><p class="card-kicker">Configuração</p><h2>${title}</h2></div><button class="button button-primary compact-action" data-new>+ Novo</button></section>${stateBlock.loading("Carregando...")}`;
  try { const data = await api(path); render(data[kind] || []); } catch (error) { dashboardGrid.innerHTML = stateBlock.error(error.message, "automation-retry"); }
}

const autoMetric = (label, value) => `<article class="data-card finance-metric"><span>${e(label)}</span><strong>${e(value)}</strong></article>`;
const autoDetails = (item) => { if (!item) return; const value = (entry) => entry === null || entry === undefined || entry === "" ? "—" : typeof entry === "object" ? JSON.stringify(entry, null, 2) : String(entry); const html = Object.entries(item).filter(([key]) => !["id", "organization_id"].includes(key)).map(([key, entry]) => `<dt>${e(key.replaceAll("_", " "))}</dt><dd>${e(value(entry))}</dd>`).join(""); ui.drawer({ title: item.name || "Automacao", subtitle: e(tr[item.trigger] || item.trigger || "Regra"), html: `<dl>${html || "<dd>Sem detalhes disponiveis.</dd>"}</dl>` }); };
function automations() {
  list("/api/automations", "Automações", "automations", (rows) => {
    dashboardGrid.innerHTML = `<section class="page-intro"><div><p class="card-kicker">Gatilho → condição → ação</p><h2>Automações</h2></div><button class="button button-primary compact-action" data-new>+ Nova automação</button></section><section class="data-card automation-list">${rows.map((x) => `<article><strong>${e(x.name)}</strong><span>${e(tr[x.trigger] || x.trigger)} → ${e(act[x.action] || x.action)}</span><small>${x.status === "error" ? "Com erro" : x.active ? "Ativa" : "Pausada"}</small><button class="compact-action" data-toggle="${x.id}">${x.active ? "Desativar" : "Ativar"}</button></article>`).join("") || stateBlock.empty("Nenhuma automação", "Crie uma regra para começar.", "Criar agora")}</section>`;
    dashboardGrid.querySelector(".automation-list")?.insertAdjacentHTML("beforebegin", `<section class="finance-metrics">${autoMetric("Total", rows.length)}${autoMetric("Ativas", rows.filter((item) => item.active).length)}${autoMetric("Pausadas", rows.filter((item) => !item.active).length)}${autoMetric("Com erro", rows.filter((item) => item.status === "error").length)}</section>`); dashboardGrid.querySelectorAll(".automation-list article").forEach((article, index) => { const details = document.createElement("button"); details.type = "button"; details.className = "compact-action"; details.textContent = "Detalhes"; details.addEventListener("click", () => autoDetails(rows[index])); article.append(details); });
    dashboardGrid.querySelector("[data-new]").onclick = () => openCreateDialog("automation");
    dashboardGrid.querySelectorAll("[data-toggle]").forEach((button) => { button.onclick = async () => { await api(`/api/automations/${button.dataset.toggle}`, { method: "PATCH", body: { active: button.textContent === "Ativar", status: button.textContent === "Ativar" ? "active" : "paused" } }); automations(); }; });
  });
}
function templates() {
  list("/api/templates", "Templates", "templates", (rows) => {
    dashboardGrid.innerHTML = `<section class="page-intro"><h2>Templates</h2><button class="button button-primary compact-action" data-new>+ Novo template</button></section><section class="data-card automation-list">${rows.map((x) => `<article><strong>${e(x.name)}</strong><span>${e(tk[x.kind] || x.kind)}</span><p>${e(x.body)}</p></article>`).join("") || stateBlock.empty("Nenhum template", "Crie seu primeiro template.", "Criar agora")}</section>`;
    dashboardGrid.querySelector("[data-new]").onclick = () => openCreateDialog("template");
  });
}
function integrations() {
  list("/api/integrations", "Integrações", "integrations", (rows) => {
    dashboardGrid.innerHTML = `<section class="page-intro"><h2>Integrações</h2><button class="button button-primary compact-action" data-new>+ Nova integração</button></section><section class="integration-grid">${rows.map((x) => `<article class="data-card"><h3>${e(providers[x.provider] || x.provider)}</h3><p>Status: ${e(x.status)}</p><button class="compact-action" data-toggle="${x.id}">${x.status === "connected" ? "Desconectar" : "Conectar"}</button>${x.provider === "webhook" ? `<button class="compact-action" data-test="${x.id}">Testar</button><small data-result="${x.id}"></small>` : ""}</article>`).join("") || stateBlock.empty("Nenhuma integração", "Adicione uma integração.", "Criar agora")}</section>`;
    dashboardGrid.querySelector("[data-new]").onclick = () => openCreateDialog("integration");
    dashboardGrid.querySelectorAll("[data-toggle]").forEach((button) => { button.onclick = async () => { await api(`/api/integrations/${button.dataset.toggle}`, { method: "PATCH", body: { status: button.textContent === "Conectar" ? "connected" : "disconnected" } }); integrations(); }; });
    dashboardGrid.querySelectorAll("[data-test]").forEach((button) => { button.onclick = async () => { try { const result = await api(`/api/integrations/${button.dataset.test}/test`, { method: "POST" }); dashboardGrid.querySelector(`[data-result="${button.dataset.test}"]`).textContent = `Resultado: ${result.status}`; } catch (error) { dashboardGrid.querySelector(`[data-result="${button.dataset.test}"]`).textContent = error.message; } }; });
  });
}
// Templates e integrações possuem workspaces dedicados; esta tela mantém apenas automações.
// O workspace dedicado de automações é carregado depois e é o proprietário da rota.
const automationHistoryObserver = new MutationObserver(async () => {
  if (location.hash.replace(/^#/, "") !== "automacoes") { dashboardGrid.dataset.runsBound = ""; return; } if (dashboardGrid.dataset.runsBound === "1") return;
  const articles = [...dashboardGrid.querySelectorAll(".automation-list article")]; if (!articles.length) return;
  dashboardGrid.dataset.runsBound = "1";
  try {
    const rows = (await api("/api/automations")).automations || [];
    articles.forEach((article, index) => { const automation = rows[index]; if (!automation) return; const button = document.createElement("button"); button.type = "button"; button.className = "compact-action"; button.textContent = "Histórico"; button.addEventListener("click", async () => { button.disabled = true; try { const runs = (await api(`/api/automations/${automation.id}/runs`)).runs || []; const panel = document.createElement("aside"); panel.className = "conta-drawer"; panel.innerHTML = `<button class="conta-close" type="button">×</button><p class="card-kicker">Automações</p><h2>Histórico · ${e(automation.name)}</h2>${runs.length ? runs.map((run) => `<div class="automation-run"><strong>${e(run.source_type)} #${e(run.source_id)}</strong><small>${e(new Date(run.created_at).toLocaleString("pt-BR"))}</small>${run.result?.error ? `<p>${e(run.result.error)}</p><button class="compact-action" data-retry="${e(run.id)}">Tentar novamente</button>` : `<p>Concluída</p>`}</div>`).join("") : `<p class="conta-muted">Nenhuma execução registrada.</p>`}`; document.body.append(panel); panel.querySelector(".conta-close").onclick = () => panel.remove(); panel.querySelectorAll("[data-retry]").forEach((retry) => retry.onclick = async () => { retry.disabled = true; try { await api(`/api/automations/${automation.id}/runs/${retry.dataset.retry}/retry`, { method: "POST" }); retry.textContent = "Retentativa agendada"; } catch (error) { retry.disabled = false; retry.textContent = error.message; } }); } catch (error) { toast(error.message, "error"); } finally { button.disabled = false; } }); article.append(button); });
  } catch { dashboardGrid.dataset.runsBound = ""; }
});
automationHistoryObserver.observe(dashboardGrid, { childList: true, subtree: true });
dashboardGrid.addEventListener("click", (event) => { if (event.target.closest(".automation-retry")) automations(); });
