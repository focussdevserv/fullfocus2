/* Telas dos recursos operacionais complementares do menu final. */
const estruturaMoneyFormatter = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const estruturaDateFormatter = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" });
const estruturaDateTimeFormatter = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });
const estruturaToastRoutes = new Set(["cofre", "aprovacoes", "briefings", "contas-a-pagar", "contas-bancarias", "notas-fiscais", "formularios", "base-de-conhecimento", "auditoria", "lixeira", "comissoes", "horas", "metas", "ausencias", "alteracoes", "entregas", "infraestrutura"]);
const toast = (...args) => { if (estruturaToastRoutes.has(location.hash.replace(/^#/, ""))) ui.toast(...args); };
const estruturaMoney = (value) => estruturaMoneyFormatter.format(Number(value || 0));
const estruturaDate = (value) => { const date = new Date(value); return Number.isNaN(date.getTime()) ? "—" : estruturaDateFormatter.format(date); };
const estruturaDateTime = (value) => { const date = new Date(value); return Number.isNaN(date.getTime()) ? "—" : estruturaDateTimeFormatter.format(date); };
const estruturaSafeExternalUrl = (value) => { try { const url = new URL(String(value || ""), window.location.origin); return ["http:", "https:"].includes(url.protocol) ? url.href : ""; } catch { return ""; } };
const labels = {
  cofre: ["Cofre de acessos", "vault", "name"],
  aprovacoes: ["Aprovações", "approvals", "title"], briefings: ["Briefings", "briefings", "name"],
  "contas-a-pagar": ["Contas a pagar", "payables", "description"], "contas-bancarias": ["Contas bancárias", "bank_accounts", "name"],
  "notas-fiscais": ["Notas fiscais", "invoices", "number"], formularios: ["Formulários", "forms", "name"],
  "base-de-conhecimento": ["Base de conhecimento", "knowledge_articles", "title"], auditoria: ["Auditoria", "audit_events", "action"],
  lixeira: ["Lixeira", "trash", "entity_type"], comissoes: ["Comissões", "commissions", "description"],
  horas: ["Horas trabalhadas", "time_entries", "minutes"], metas: ["Metas", "team_goals", "name"], ausencias: ["Ausências", "absences", "kind"],
};
const configs = {
  cofre: { title: "Novo acesso protegido", endpoint: "/api/vault", fields: [{ name: "name", label: "Nome do acesso" }, { name: "service", label: "Serviço" }, { name: "client_id", label: "Cliente (ID)", required: false }, { name: "project_id", label: "Projeto (ID)", required: false }, { name: "username", label: "Login", required: false }, { name: "password", label: "Senha", type: "password", required: false }, { name: "api_key", label: "Token/API key", type: "password", required: false }, { name: "expires_on", label: "Expiração", type: "date", required: false }] },
  aprovacao: { title: "Nova aprovação", endpoint: "/api/approvals", fields: [{ name: "target_type", label: "Tipo" }, { name: "title", label: "Título" }, { name: "client_id", label: "Cliente (ID)", required: false }, { name: "project_id", label: "Projeto (ID)", required: false }] },
  briefing: { title: "Novo briefing", endpoint: "/api/briefings", fields: [{ name: "name", label: "Nome" }, { name: "client_id", label: "Cliente (ID)", required: false }, { name: "questions", label: "Perguntas JSON", required: false }] },
  payable: { title: "Nova conta a pagar", endpoint: "/api/payables", fields: [{ name: "description", label: "Descrição" }, { name: "supplier", label: "Fornecedor", required: false }, { name: "amount", label: "Valor", type: "number" }, { name: "due_at", label: "Vencimento", type: "date", required: false }] },
  bank_account: { title: "Nova conta bancária", endpoint: "/api/bank_accounts", fields: [{ name: "name", label: "Nome" }, { name: "kind", label: "Tipo" }, { name: "opening_balance", label: "Saldo inicial", type: "number", required: false }] },
  invoice: { title: "Nova nota fiscal", endpoint: "/api/invoices", fields: [{ name: "number", label: "Número", required: false }, { name: "amount", label: "Valor", type: "number" }, { name: "client_id", label: "Cliente (ID)", required: false }] },
  form: { title: "Novo formulário", endpoint: "/api/forms", fields: [{ name: "name", label: "Nome" }, { name: "kind", label: "Tipo", type: "select", options: [["capture", "Captação"], ["quote", "Orçamento"], ["briefing", "Briefing"], ["support", "Suporte"], ["satisfaction", "Pesquisa de satisfação"], ["onboarding", "Onboarding"]] }, { name: "schema", label: "Campos JSON", type: "textarea", rows: 7, placeholder: '[{"name":"email","label":"E-mail","type":"email","required":true}]', help: "Use uma lista JSON com name, label, type e required.", required: false }, { name: "automation_config", label: "Automação JSON (lead, opportunity, ticket ou task)", type: "textarea", rows: 4, placeholder: '{"create":"lead"}', help: "Opcional: descreva o registro criado ao receber uma resposta.", required: false }] },
  knowledge_article: { title: "Novo artigo", endpoint: "/api/knowledge_articles", fields: [{ name: "title", label: "Título" }, { name: "body", label: "Conteúdo" }, { name: "category", label: "Categoria", required: false }] },
  team_goal: { title: "Nova meta", endpoint: "/api/team_goals", fields: [{ name: "name", label: "Meta" }, { name: "target", label: "Valor esperado", type: "number", required: false }, { name: "period_end", label: "Fim do período", type: "date", required: false }] },
  absence: { title: "Nova ausência", endpoint: "/api/absences", fields: [{ name: "user_id", label: "Membro (ID)" }, { name: "kind", label: "Tipo" }, { name: "starts_on", label: "Início", type: "date" }, { name: "ends_on", label: "Fim", type: "date" }] },
  commission: { title: "Nova comissão", endpoint: "/api/commissions", fields: [{ name: "description", label: "Descrição" }, { name: "responsible", label: "Responsável", required: false }, { name: "user_id", label: "Membro (ID)", required: false }, { name: "project_id", label: "Projeto (ID)", required: false }, { name: "base_amount", label: "Base da venda", type: "number", required: false }, { name: "rate", label: "Percentual", type: "number", required: false }, { name: "amount", label: "Valor da comissão", type: "number" }, { name: "status", label: "Status", type: "select", options: [["pending", "Pendente"], ["approved", "Aprovada"], ["paid", "Paga"], ["cancelled", "Cancelada"]] }] },
  time_entry: { title: "Nova hora trabalhada", endpoint: "/api/time_entries", fields: [{ name: "user_id", label: "Membro (ID)" }, { name: "project_id", label: "Projeto (ID)", required: false }, { name: "task_id", label: "Tarefa (ID)", required: false }, { name: "minutes", label: "Minutos", type: "number" }, { name: "billable", label: "Faturável", type: "checkbox", required: false }, { name: "status", label: "Status", type: "select", options: [["pending", "Pendente"], ["approved", "Aprovada"], ["rejected", "Rejeitada"]] }, { name: "notes", label: "Observações", type: "textarea", required: false }] },
};
configs.aprovacao.fields.push({ name: "status", label: "Status", type: "select", options: [["pending", "Pendente"], ["approved", "Aprovada"], ["rejected", "Recusada"], ["cancelled", "Cancelada"]] }, { name: "comment", label: "Comentário", type: "textarea", required: false });
Object.assign(createConfig, configs);
const estruturaPlaceholders = { name: "Ex.: Painel de hospedagem…", service: "Ex.: Provedor de hospedagem…", username: "Ex.: usuario@empresa.com…", responsible: "Ex.: Pessoa responsável…", title: "Ex.: Solicitação de acesso…", version: "Ex.: v1.0.0…", environment: "Ex.: Produção…" };
labels.alteracoes = ["Alterações de escopo", "change_requests", "title"];
labels.entregas = ["Entregas e publicações", "deliveries", "version"];
labels.infraestrutura = ["Infraestrutura", "infrastructure_assets", "name"];
configs.alteracao = { title: "Nova solicitação de alteração", endpoint: "/api/change_requests", fields: [{ name: "title", label: "Título" }, { name: "description", label: "Descrição", type: "textarea", required: false }, { name: "project_id", label: "Projeto (ID)", required: false }, { name: "client_id", label: "Cliente (ID)", required: false }, { name: "impact_days", label: "Impacto no prazo (dias)", type: "number", required: false }, { name: "additional_cost", label: "Valor adicional", type: "number", required: false }, { name: "status", label: "Status", type: "select", options: [["pending", "Pendente"], ["approved", "Aprovada"], ["rejected", "Recusada"], ["implemented", "Implementada"]] }] };
configs.entrega = { title: "Nova entrega", endpoint: "/api/deliveries", fields: [{ name: "version", label: "Versão" }, { name: "project_id", label: "Projeto (ID)" }, { name: "environment", label: "Ambiente", required: false }, { name: "published_url", label: "Link publicado", type: "url", required: false }, { name: "status", label: "Status", type: "select", options: [["draft", "Rascunho"], ["ready", "Pronta"], ["published", "Publicada"], ["approved", "Aprovada"]] }, { name: "backup_done", label: "Backup realizado", type: "checkbox", required: false }, { name: "client_approved", label: "Aprovada pelo cliente", type: "checkbox", required: false }] };
configs.infraestrutura = { title: "Novo recurso de infraestrutura", endpoint: "/api/infrastructure_assets", fields: [{ name: "kind", label: "Tipo" }, { name: "name", label: "Nome" }, { name: "provider", label: "Provedor", required: false }, { name: "project_id", label: "Projeto (ID)", required: false }, { name: "client_id", label: "Cliente (ID)", required: false }, { name: "expires_on", label: "Vencimento", type: "date", required: false }, { name: "cost", label: "Custo", type: "number", required: false }, { name: "client_price", label: "Valor cobrado do cliente", type: "number", required: false }, { name: "responsible", label: "Responsável", required: false }] };
Object.assign(createConfig, { alteracao: configs.alteracao, entrega: configs.entrega, infraestrutura: configs.infraestrutura });
Object.values(createConfig).forEach((config) => config.fields?.forEach((field) => { if (!field.placeholder && estruturaPlaceholders[field.name]) field.placeholder = estruturaPlaceholders[field.name]; }));
const esc = (value) => escapeHtml(value ?? "");
const structuredListState = {};
const recordCreateKind = { aprovacoes: "aprovacao", briefings: "briefing", alteracoes: "alteracao", entregas: "entrega", infraestrutura: "infraestrutura", cofre: "cofre", "contas-a-pagar": "payable", "contas-bancarias": "bank_account", "notas-fiscais": "invoice", formularios: "form", "base-de-conhecimento": "knowledge_article", metas: "team_goal", ausencias: "absence", comissoes: "commission", horas: "time_entry" };
const structuredRowMarkup = (key, row) => {
  const primary = labels[key]?.[2];
  const title = row[primary] || row.name || row.title || `#${row.id}`;
  const detail = key === "metas" ? `Meta: ${row.target ?? "—"} · Até ${row.period_end ? estruturaDate(row.period_end) : "sem prazo"}` : key === "ausencias" ? `${row.starts_on ? estruturaDate(row.starts_on) : "Sem início"} → ${row.ends_on ? estruturaDate(row.ends_on) : "Sem fim"}` : key === "horas" ? `${row.minutes ?? 0} minuto(s)${row.billable ? " · Faturável" : ""}` : key === "contas-a-pagar" ? `${estruturaMoney(row.amount)} · Vencimento ${row.due_at ? estruturaDate(row.due_at) : "sem data"}` : key === "notas-fiscais" ? estruturaMoney(row.amount) : key === "comissoes" ? estruturaMoney(row.amount) : row.entity_type || row.kind || "Registro";
  return `<article class="structured-row"><div class="structured-row-main"><strong>${esc(title)}</strong><span>${esc(detail)}</span></div><small>${esc(row.status || (row.created_at ? estruturaDateTime(row.created_at) : "Registro"))}</small></article>`;
};
async function prepareStructuredCreate(kind) {
  const config = createConfig[kind];
  if (!config) return;
  const routeKey = Object.entries(recordCreateKind).find(([, value]) => value === kind)?.[0];
  const routeAtStart = location.hash.replace(/^#/, "");
  if (routeKey && routeAtStart !== routeKey) return;
  const relationFields = config.fields.filter((field) => ["client_id", "project_id", "task_id", "user_id"].includes(field.name));
  if (!relationFields.length) return openCreateDialog(kind);
  try {
    const [clientData, projectData, taskData, teamData] = await Promise.all([
      relationFields.some((field) => field.name === "client_id") ? api("/api/clients") : Promise.resolve({ clients: [] }),
      relationFields.some((field) => field.name === "project_id") ? api("/api/projects") : Promise.resolve({ projects: [] }),
      relationFields.some((field) => field.name === "task_id") ? api("/api/tasks") : Promise.resolve({ tasks: [] }),
      relationFields.some((field) => field.name === "user_id") ? api("/api/team") : Promise.resolve({ users: [] }),
    ]);
    if (routeKey && location.hash.replace(/^#/, "") !== routeKey) return;
    const clients = clientData.clients || [], projects = projectData.projects || [], tasks = taskData.tasks || [], users = teamData.users || [];
    relationFields.forEach((field) => {
      field.type = "select";
      const source = field.name === "client_id" ? clients : field.name === "project_id" ? projects : field.name === "task_id" ? tasks : users;
      const empty = field.name === "client_id" ? "Sem cliente" : field.name === "project_id" ? "Sem projeto" : field.name === "task_id" ? "Sem tarefa" : "Selecione o membro";
      field.options = [["", empty], ...source.map((item) => [item.id, item.name || item.title || `#${item.id}`])];
    });
    openCreateDialog(kind);
  } catch (error) {
    if (!routeKey || location.hash.replace(/^#/, "") === routeKey) toast(error.message || "Não foi possível preparar o formulário.", "error");
  }
}
async function renderEstrutura(key) {
  if (location.hash.replace(/^#/, "") !== key) return;
  const [title, table, primary] = labels[key];
  dashboardGrid.setAttribute("aria-busy", "true");
  const filterState = structuredListState[key] || (structuredListState[key] = { search: "", status: "", offset: 0 });
  const request = filterState.request = (filterState.request || 0) + 1;
  dashboardGrid.innerHTML = `<section class="page-intro"><div><p class="card-kicker">Operação integrada</p><h2>${title}</h2><p>${key === "auditoria" ? "Registro de alterações, acessos e ações administrativas." : key === "lixeira" ? "Registros removidos com prazo para restauração." : "Dados vinculados por cliente, projeto e organização."}</p></div>${recordCreateKind[key] ? `<button type="button" class="button button-primary compact-action" data-new>+ Novo</button>` : ""}</section>${stateBlock.loading("Carregando…")}`;
  try {
    const params = new URLSearchParams({ limit: "100", offset: String(filterState.offset) }); if (filterState.search) params.set("search", filterState.search); if (filterState.status) params.set("status", filterState.status);
    const data = await api(table === "team" ? "/api/team" : `/api/${table}?${params}`); if (request !== filterState.request || location.hash.replace(/^#/, "") !== key) return; const rows = data[table] || data.users || [], pagination = data.pagination || {};
    dashboardGrid.innerHTML = `<section class="page-intro"><div><p class="card-kicker">Operação integrada</p><h2>${title}</h2></div>${recordCreateKind[key] ? `<button type="button" class="button button-primary compact-action" data-new>+ Novo</button>` : ""}${key === "horas" ? `<button type="button" class="button button-secondary compact-action" data-start-timer>Iniciar cronômetro</button>` : ""}</section><section class="data-card automation-list" data-structured-list="1"><div class="finance-toolbar"><input type="search" data-structured-search value="${esc(filterState.search)}" autocomplete="off" placeholder="Buscar em ${esc(title.toLowerCase())}…" aria-label="Buscar ${esc(title)}"><input data-structured-status value="${esc(filterState.status)}" autocomplete="off" placeholder="Status (opcional)…" aria-label="Filtrar status"></div>${rows.map((row) => structuredRowMarkup(key, row)).join("") || stateBlock.empty(`Nenhum registro em ${title.toLowerCase()}`, "Os registros criados aparecerão aqui.", recordCreateKind[key] ? "Criar agora" : "", recordCreateKind[key] ? "structured-empty-action" : "")}<div class="table-pagination"><button type="button" class="compact-action" data-structured-prev ${filterState.offset === 0 ? "disabled" : ""}>Anterior</button><span>Página ${Math.floor(filterState.offset / 100) + 1}</span><button type="button" class="compact-action" data-structured-next ${(pagination.returned ?? rows.length) < 100 ? "disabled" : ""}>Próxima</button></div></section>`;
    dashboardGrid.removeAttribute("aria-busy");
    const reload = () => { filterState.search = dashboardGrid.querySelector("[data-structured-search]").value.trim(); filterState.status = dashboardGrid.querySelector("[data-structured-status]").value.trim(); filterState.offset = 0; clearTimeout(filterState.timer); filterState.timer = setTimeout(() => renderEstrutura(key), 250); };
    dashboardGrid.querySelector("[data-structured-search]")?.addEventListener("input", reload); dashboardGrid.querySelector("[data-structured-status]")?.addEventListener("input", reload); dashboardGrid.querySelector("[data-structured-prev]")?.addEventListener("click", () => { filterState.offset = Math.max(0, filterState.offset - 100); renderEstrutura(key); }); dashboardGrid.querySelector("[data-structured-next]")?.addEventListener("click", () => { filterState.offset += 100; renderEstrutura(key); });
    dashboardGrid.querySelector("[data-new]")?.addEventListener("click", () => prepareStructuredCreate(recordCreateKind[key]));
    dashboardGrid.querySelector(".structured-empty-action")?.addEventListener("click", () => prepareStructuredCreate(recordCreateKind[key]));
    dashboardGrid.querySelector("[data-start-timer]")?.addEventListener("click", async (event) => { const button = event.currentTarget, routeAtStart = location.hash; button.disabled = true; button.setAttribute("aria-busy", "true"); button.textContent = "Iniciando…"; try { await api("/api/time-entry-timer/start", { method: "POST", body: {} }); if (location.hash !== routeAtStart || !button.isConnected) return; toast("Cronômetro iniciado.", "success"); renderEstrutura(key); } catch (error) { if (location.hash === routeAtStart && button.isConnected) toast(error.message, "error"); } finally { if (button.isConnected && location.hash === routeAtStart) { button.disabled = false; button.removeAttribute("aria-busy"); button.textContent = "Iniciar cronômetro"; } } });
  } catch (error) { if (request !== filterState.request || location.hash.replace(/^#/, "") !== key) return; dashboardGrid.removeAttribute("aria-busy"); dashboardGrid.innerHTML = stateBlock.error(error.message, "estrutura-retry"); dashboardGrid.querySelector(".estrutura-retry")?.addEventListener("click", () => renderEstrutura(key)); }
}
let deliverySearchSnapshot;
dashboardGrid.addEventListener("input", (event) => {
  const input = event.target.closest?.("[data-delivery-search]");
  if (input) deliverySearchSnapshot = { value: input.value, position: input.selectionStart };
}, true);
const changeDecisionStateObserver = new MutationObserver(() => {
  dashboardGrid.querySelectorAll("[data-change-decision]").forEach((button) => {
    if (button.disabled) {
      if (!button.dataset.actionLabel) button.dataset.actionLabel = button.textContent;
      button.setAttribute("aria-busy", "true");
      button.textContent = button.dataset.changeStatus === "approved" ? "Aprovando…" : "Recusando…";
    } else if (button.dataset.actionLabel) {
      button.textContent = button.dataset.actionLabel;
      delete button.dataset.actionLabel;
      button.removeAttribute("aria-busy");
    }
  });
});
changeDecisionStateObserver.observe(dashboardGrid, { childList: true, subtree: true, attributes: true, attributeFilter: ["disabled"] });
const vaultResultsObserver = new MutationObserver(() => {
  const list = dashboardGrid.querySelector(".vault-list");
  const grid = list?.querySelector(".vault-grid");
  if (!list) return;
  let status = list.querySelector("[data-vault-results]");
  if (!status) {
    status = document.createElement("p");
    status.className = "ui-filter-status";
    status.dataset.vaultResults = "true";
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    list.querySelector(".finance-toolbar")?.after(status);
  }
  const count = grid?.querySelectorAll(".vault-card").length || 0;
  const message = `${ui.number(count)} ${count === 1 ? "acesso encontrado" : "acessos encontrados"}.`;
  if (status.textContent !== message) status.textContent = message;
});
vaultResultsObserver.observe(dashboardGrid, { childList: true, subtree: true });

function revealVaultAccess(row) {
  if (!row?.id) {
    toast("Não foi possível identificar este acesso protegido.", "error");
    return;
  }
  ui.form({
    title: `Revelar · ${row.name || "Acesso protegido"}`,
    subtitle: "Confirme sua senha para visualizar os dados protegidos.",
    fields: [{ name: "confirmation_password", label: "Sua senha", type: "password", autocomplete: "current-password", required: true }],
    submitLabel: "Revelar acesso",
    onSubmit: async (values) => {
      const routeAtStart = location.hash;
      const result = await api(`/api/vault/${row.id}/reveal`, { method: "POST", body: values });
      if (location.hash !== routeAtStart || location.hash !== "#cofre") return;
      const secret = result.secret && typeof result.secret === "object" ? result.secret : {};
      ui.drawer({
        title: row.name || "Acesso protegido",
        subtitle: row.service || "Cofre de acessos",
        html: `<p class="vault-secret-warning" role="note">Evite copiar estes dados para documentos ou mensagens. Feche este painel quando terminar.</p>${ui.facts(Object.entries(secret).map(([name, value]) => [name, value ?? "—"]))}`
      });
    }
  });
}

new MutationObserver(() => {
  if (dashboardGrid.querySelector(".state-loading")) dashboardGrid.setAttribute("aria-busy", "true");
  else dashboardGrid.removeAttribute("aria-busy");
  dashboardGrid.querySelectorAll("[data-structured-search], [data-structured-status], [data-change-search], [data-change-status], [data-delivery-search], [data-delivery-status], [data-vault-search]").forEach((control) => {
    if (!control.name) control.name = control.matches("[data-structured-search], [data-change-search], [data-delivery-search], [data-vault-search]") ? "search" : "status";
    control.setAttribute("autocomplete", "off");
    if (control.placeholder?.includes("...")) control.placeholder = control.placeholder.replaceAll("...", "…");
  });
  dashboardGrid.querySelectorAll("button").forEach((button) => {
    if (button.disabled) button.setAttribute("aria-busy", "true");
    else button.removeAttribute("aria-busy");
  });
  dashboardGrid.querySelectorAll(".finance-status, .approval-total").forEach((status) => { status.setAttribute("role", "status"); status.setAttribute("aria-live", "polite"); });
  dashboardGrid.querySelectorAll(".state-loading p").forEach((label) => { if (label.textContent?.includes("...")) label.textContent = label.textContent.replaceAll("...", "…"); });
}).observe(dashboardGrid, { childList: true, subtree: true, attributes: true, attributeFilter: ["disabled"] });
const deliverySearchObserver = new MutationObserver(() => {
  if (!deliverySearchSnapshot) return;
  const input = dashboardGrid.querySelector("[data-delivery-search]");
  if (!input) return;
  input.setAttribute("autocomplete", "off");
  if (input.value === deliverySearchSnapshot.value) {
    input.focus();
    try { input.setSelectionRange(deliverySearchSnapshot.position, deliverySearchSnapshot.position); } catch { /* busca sem cursor em alguns navegadores */ }
  }
  deliverySearchSnapshot = null;
});
deliverySearchObserver.observe(dashboardGrid, { childList: true, subtree: true });

dashboardGrid.addEventListener("click", async (event) => {
  const button = event.target.closest?.("[data-delivery-share]");
  if (!button) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  if (button.dataset.busy === "1") return;
  const routeAtStart = location.hash;
  button.dataset.busy = "1";
  button.disabled = true;
  try {
    const data = await api(`/api/deliveries/${button.dataset.deliveryShare}/public-link`, { method: "POST", body: {} });
    await ui.copyText(`${location.origin}${data.path}`);
    if (location.hash !== routeAtStart || !button.isConnected) return;
    button.textContent = "Link copiado";
    ui.toast("Link da entrega copiado.", "success");
  } catch (error) {
    if (location.hash === routeAtStart && button.isConnected) ui.toast(error.message, "error");
  } finally {
    if (button.isConnected) { button.disabled = false; button.dataset.busy = ""; }
  }
}, true);

dashboardGrid.addEventListener("click", async (event) => {
  const changeDecision = event.target.closest?.("[data-change-decision]");
  const deliveryApprove = event.target.closest?.("[data-delivery-approve]");
  const destructive = event.target.closest?.("[data-change-delete], [data-delivery-delete]");
  if (!changeDecision && !deliveryApprove && !destructive) return;
  const routeAtStart = location.hash;
  const requestState = changeDecision || destructive?.matches("[data-change-delete]") ? changeRequestState : deliveryScreenState;
  const requestAtStart = requestState.request;
  if ((changeDecision && routeAtStart !== "#alteracoes") || (deliveryApprove && routeAtStart !== "#entregas") || (!changeDecision && !deliveryApprove && !["#alteracoes", "#entregas"].includes(routeAtStart))) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  if (destructive) {
    if (destructive.dataset.confirming === "1") return;
    destructive.dataset.confirming = "1";
    ui.confirmInline(destructive, { text: destructive.matches("[data-change-delete]") ? "Excluir esta alteração?" : "Excluir esta entrega?", onConfirm: async () => {
      destructive.disabled = true;
      try {
        const table = destructive.matches("[data-change-delete]") ? "change_requests" : "deliveries";
        const id = destructive.dataset.changeDelete || destructive.dataset.deliveryDelete;
        await api(`/api/${table}/${id}`, { method: "DELETE" });
        if (location.hash !== routeAtStart || requestState.request !== requestAtStart || !destructive.isConnected) return;
        toast("Registro removido.", "success");
        (table === "change_requests" ? renderChangeRequests : renderDeliveries)();
      } catch (error) {
        if (location.hash === routeAtStart && destructive.isConnected) throw error;
      } finally {
        delete destructive.dataset.confirming;
      }
    } });
    return;
  }
  const action = changeDecision || deliveryApprove;
  if (action.dataset.busy === "1") return;
  action.dataset.busy = "1";
  action.disabled = true;
  action.setAttribute("aria-busy", "true");
  try {
    const isChange = Boolean(changeDecision);
    const id = isChange ? action.dataset.changeDecision : action.dataset.deliveryApprove;
    const body = isChange ? { status: action.dataset.changeStatus, approval_data: { decision: action.dataset.changeStatus, decided_at: new Date().toISOString() } } : { client_approved: true, status: "approved" };
    await api(`/${isChange ? "api/change_requests" : "api/deliveries"}/${id}`, { method: "PATCH", body });
    if (location.hash !== routeAtStart || requestState.request !== requestAtStart || !action.isConnected) return;
    toast(isChange ? "Decisão registrada." : "Aprovação registrada.", "success");
    (isChange ? renderChangeRequests : renderDeliveries)();
  } catch (error) {
    if (location.hash === routeAtStart && action.isConnected) toast(error.message, "error");
  } finally {
    if (action.isConnected) { action.disabled = false; action.removeAttribute("aria-busy"); action.dataset.busy = ""; }
  }
}, true);

const approvalSummaryObserver = new MutationObserver(async () => {
  if (location.hash.replace(/^#/, "") !== "aprovacoes" || dashboardGrid.querySelector("[data-approval-summary]")) return;
  const routeAtStart = location.hash;
  const list = dashboardGrid.querySelector(".automation-list[data-structured-list]"); if (!list) return;
  try {
    const data = await api("/api/approvals/overview");
    if (location.hash !== routeAtStart || !list.isConnected) return;
    const groups = [
      ["Propostas aguardando resposta", data.proposals || [], "#propostas", (item) => item.title || "Proposta"],
      ["Contratos aguardando assinatura", data.contracts || [], "#contratos", (item) => item.name || "Contrato"],
      ["Entregas aguardando aprovação", data.deliveries || [], "#entregas", (item) => `Versão ${item.version || "—"}`],
      ["Alterações aguardando decisão", data.changes || [], "#alteracoes", (item) => item.title || "Alteração"],
    ];
    const card = document.createElement("section"); card.className = "data-card approval-summary"; card.dataset.approvalSummary = "1";
    card.innerHTML = `<div class="section-heading"><div><p class="card-kicker">Visão consolidada</p><h2>Decisões pendentes</h2></div><strong>${groups.reduce((total, [, items]) => total + items.length, 0)}</strong></div><div class="approval-summary-grid">${groups.map(([title, items, href, label]) => `<a class="approval-summary-item" href="${href}"><strong>${items.length}</strong><span>${title}</span>${items.slice(0, 2).map((item) => `<small>${escapeHtml(label(item))}</small>`).join("")}</a>`).join("")}</div>`;
    list.before(card);
  } catch (error) { if (location.hash === routeAtStart) toast(error.message, "error"); }
});
approvalSummaryObserver.observe(dashboardGrid, { childList: true, subtree: true });

const approvalActionsObserver = new MutationObserver(async () => {
  if (location.hash.replace(/^#/, "") !== "aprovacoes") return;
  const routeAtStart = location.hash;
  const list = dashboardGrid.querySelector(".automation-list[data-structured-list]");
  if (!list || list.dataset.approvalActions === "1") return;
  list.dataset.approvalActions = "1";
  try {
    const rows = (await api("/api/approvals")).approvals || [];
    if (location.hash !== routeAtStart || !list.isConnected) return;
    list.querySelectorAll("article").forEach((article, index) => {
      const approval = rows[index];
      if (!approval || approval.status !== "pending") return;
      const actions = document.createElement("div"); actions.className = "approval-actions";
      [ ["approved", "Aprovar", "success"], ["rejected", "Recusar", "danger"] ].forEach(([status, label, kind]) => { const button = document.createElement("button"); button.type = "button"; button.className = `compact-action ${kind}`; button.textContent = label; button.addEventListener("click", async () => { button.disabled = true; try { await api(`/api/approvals/${approval.id}`, { method: "PATCH", body: { status, decision: status, decided_at: new Date().toISOString() } }); toast(status === "approved" ? "Aprovação registrada." : "Recusa registrada.", status === "approved" ? "success" : "info"); renderEstrutura("aprovacoes"); } catch (error) { button.disabled = false; toast(error.message, "error"); } }); actions.append(button); }); article.append(actions);
    });
  } catch (error) { list.dataset.approvalActions = ""; if (location.hash === routeAtStart) toast(error.message, "error"); }
});
approvalActionsObserver.observe(dashboardGrid, { childList: true, subtree: true });
const briefingLinkObserver = new MutationObserver(async () => {
  if (location.hash.replace(/^#/, "") !== "briefings") return;
  const list = dashboardGrid.querySelector(".automation-list[data-structured-list]");
  if (!list || list.dataset.briefingLinks === "1") return;
  list.dataset.briefingLinks = "1";
  try {
    const rows = (await api("/api/briefings")).briefings || [];
    list.querySelectorAll("article").forEach((article, index) => {
      const briefing = rows[index]; if (!briefing || briefing.status === "answered") return;
      const button = document.createElement("button"); button.type = "button"; button.className = "compact-action"; button.textContent = briefing.public_token ? "Copiar link" : "Gerar link";
      button.addEventListener("click", async () => { button.disabled = true; try { const data = briefing.public_token ? { path: `/briefing/${briefing.public_token}` } : await (await fetch(`/api/briefings/${briefing.id}/public-link`, { method: "POST", credentials: "same-origin" })).json(); if (!data.path) throw new Error(data.error || "Não foi possível gerar o link."); await ui.copyText(`${location.origin}${data.path}`); button.textContent = "Link copiado"; toast("Link do briefing copiado.", "success"); } catch (error) { button.disabled = false; toast(error.message, "error"); } }); article.append(button);
    });
  } catch (error) { list.dataset.briefingLinks = ""; toast(error.message, "error"); }
});
briefingLinkObserver.observe(dashboardGrid, { childList: true, subtree: true });
const formLinkObserver = new MutationObserver(async () => {
  if (location.hash.replace(/^#/, "") !== "formularios") return;
  const list = dashboardGrid.querySelector(".automation-list[data-structured-list]");
  if (!list || list.dataset.formLinks === "1") return;
  list.dataset.formLinks = "1";
  try {
    const rows = (await api("/api/forms")).forms || [];
    list.querySelectorAll("article").forEach((article, index) => {
      const form = rows[index]; if (!form) return;
      const button = document.createElement("button"); button.type = "button"; button.className = "compact-action"; button.textContent = form.public_token ? "Copiar link" : "Gerar link";
      button.addEventListener("click", async () => { button.disabled = true; try { const data = form.public_token ? { path: `/form/${form.public_token}` } : await (await fetch(`/api/forms/${form.id}/public-link`, { method: "POST", credentials: "same-origin" })).json(); if (!data.path) throw new Error(data.error || "Não foi possível gerar o link."); await ui.copyText(`${location.origin}${data.path}`); button.textContent = "Link copiado"; toast("Link do formulário copiado.", "success"); } catch (error) { button.disabled = false; toast(error.message, "error"); } }); article.append(button);
    });
  } catch (error) { list.dataset.formLinks = ""; toast(error.message, "error"); }
});
formLinkObserver.observe(dashboardGrid, { childList: true, subtree: true });
const operationActionObserver = new MutationObserver(async () => {
  const key = location.hash.replace(/^#/, "");
  if (!["alteracoes", "entregas"].includes(key)) return;
  const list = dashboardGrid.querySelector(".automation-list[data-structured-list]");
  if (!list || list.dataset.operationActions === "1") return;
  list.dataset.operationActions = "1";
  const table = key === "alteracoes" ? "change_requests" : "deliveries";
  try {
    const rows = (await api(`/api/${table}`))[table] || [];
    list.querySelectorAll("article").forEach((article, index) => {
      const item = rows[index]; if (!item) return;
      const actions = document.createElement("div"); actions.className = "operation-actions";
      const choices = key === "alteracoes" && item.status === "pending" ? [["approved", "Aprovar"], ["rejected", "Recusar"]] : key === "entregas" && !item.client_approved ? [["approved", "Registrar aprovação"]] : [];
      if (key === "entregas") { const share = document.createElement("button"); share.type = "button"; share.className = "compact-action"; share.textContent = "Link para aprovação"; share.addEventListener("click", async () => { share.disabled = true; try { const data = await api(`/api/deliveries/${item.id}/public-link`, { method: "POST", body: {} }); await ui.copyText(`${location.origin}${data.path}`); share.textContent = "Link copiado"; toast("Link da entrega copiado.", "success"); } catch (error) { share.disabled = false; toast(error.message, "error"); } }); actions.append(share); }
      choices.forEach(([status, label]) => { const button = document.createElement("button"); button.type = "button"; button.className = "compact-action"; button.textContent = label; button.addEventListener("click", async () => { button.disabled = true; try { const body = key === "entregas" ? { client_approved: true, status: "approved" } : { status, approval_data: { decision: status, decided_at: new Date().toISOString() } }; await api(`/api/${table}/${item.id}`, { method: "PATCH", body }); toast("Atualização registrada.", "success"); renderEstrutura(key); } catch (error) { button.disabled = false; toast(error.message, "error"); } }); actions.append(button); });
      if (actions.children.length) article.append(actions);
    });
  } catch (error) { list.dataset.operationActions = ""; toast(error.message, "error"); }
});
operationActionObserver.observe(dashboardGrid, { childList: true, subtree: true });
// Workspaces dedicados assumem as rotas que exigem telas próprias.
const changeRequestState = { search: "", status: "", offset: 0, request: 0 };
async function renderChangeRequests() {
  if (location.hash !== "#alteracoes") return;
  const request = changeRequestState.request = (changeRequestState.request || 0) + 1;
  const statusLabels = { pending: "Pendente", approved: "Aprovada", rejected: "Recusada", implemented: "Implementada" };
  dashboardGrid.innerHTML = `<section class="page-intro"><div><p class="card-kicker">Operação integrada</p><h2>Alterações de escopo</h2><p>Registre impacto, custo e decisão antes de transformar um pedido em trabalho.</p></div><button type="button" class="button button-primary compact-action" data-change-new>+ Nova alteração</button></section>${stateBlock.loading("Carregando alterações…")}`;
  try {
    const params = new URLSearchParams({ limit: "100", offset: String(changeRequestState.offset) }); if (changeRequestState.search) params.set("search", changeRequestState.search); if (changeRequestState.status) params.set("status", changeRequestState.status);
    const [changeResult, clientsResult, projectsResult] = await Promise.allSettled([api(`/api/change_requests?${params}`), api("/api/clients"), api("/api/projects")]);
    if (request !== changeRequestState.request || location.hash !== "#alteracoes") return;
    if (changeResult.status === "rejected") throw changeResult.reason;
    const rows = changeResult.value.change_requests || [], clients = new Map((clientsResult.status === "fulfilled" ? clientsResult.value.clients || [] : []).map((item) => [String(item.id), item.name])), projects = new Map((projectsResult.status === "fulfilled" ? projectsResult.value.projects || [] : []).map((item) => [String(item.id), item.name]));
    const pending = rows.filter((row) => row.status === "pending").length, totalCost = rows.reduce((sum, row) => sum + Number(row.additional_cost || 0), 0), totalDays = rows.reduce((sum, row) => sum + Number(row.impact_days || 0), 0);
    const money = estruturaMoney;
    const context = (row) => [row.client_id && (clients.get(String(row.client_id)) || `Cliente #${row.client_id}`), row.project_id && (projects.get(String(row.project_id)) || `Projeto #${row.project_id}`)].filter(Boolean).join(" · ") || "Sem cliente ou projeto vinculado";
    const detail = (row) => { if (!row) return; const hidden = new Set(["id", "organization_id"]); const value = (item) => item === null || item === undefined || item === "" ? "—" : typeof item === "object" ? JSON.stringify(item) : String(item); const html = Object.entries(row).filter(([key]) => !hidden.has(key)).map(([key, item]) => `<dt>${esc(key.replaceAll("_", " "))}</dt><dd>${esc(value(item))}</dd>`).join(""); ui.drawer({ title: row.title || "Alteração", subtitle: context(row), html: `<dl>${html || "<dd>Sem detalhes disponíveis.</dd>"}</dl>` }); };
    const cards = rows.length ? rows.map((row) => `<article class="change-row"><div class="change-row-main"><div><span class="finance-status ${row.status === "pending" ? "warning" : row.status === "approved" ? "success" : "neutral"}">${esc(statusLabels[row.status] || row.status || "Sem status")}</span><h3>${esc(row.title || "Alteração sem título")}</h3><p>${esc(context(row))}</p></div><div class="change-impact"><strong>${esc(money(row.additional_cost))}</strong><small>${esc(String(row.impact_days || 0))} dia(s) de impacto</small></div></div><div class="change-row-actions"><button type="button" class="compact-action" data-change-detail="${esc(row.id)}">Detalhes</button>${row.status === "pending" ? `<button type="button" class="compact-action approval-accept" data-change-decision="${esc(row.id)}" data-change-status="approved">Aprovar</button><button type="button" class="compact-action approval-reject" data-change-decision="${esc(row.id)}" data-change-status="rejected">Recusar</button>` : ""}<button type="button" class="compact-action" data-change-edit="${esc(row.id)}">Editar</button><button type="button" class="compact-action" data-change-delete="${esc(row.id)}">Excluir</button></div></article>`).join("") : stateBlock.empty("Nenhuma alteração encontrada", "Crie uma solicitação para registrar mudanças de prazo e investimento.", "Criar alteração", "change-empty");
    const returnedChanges = changeResult.value.pagination?.returned ?? rows.length;
    dashboardGrid.innerHTML = `<section class="page-intro"><div><p class="card-kicker">Operação integrada</p><h2>Alterações de escopo</h2><p>Registre impacto, custo e decisão antes de transformar um pedido em trabalho.</p></div><button type="button" class="button button-primary compact-action" data-change-new>+ Nova alteração</button></section><section class="change-summary"><article class="data-card"><span>Total no filtro</span><strong>${rows.length}</strong></article><article class="data-card"><span>Aguardando decisão</span><strong>${pending}</strong></article><article class="data-card"><span>Impacto acumulado</span><strong>${totalDays} dias</strong></article><article class="data-card"><span>Custo adicional</span><strong>${esc(money(totalCost))}</strong></article></section><section class="data-card change-list"><div class="finance-toolbar"><input type="search" data-change-search value="${esc(changeRequestState.search)}" placeholder="Buscar solicitação…" aria-label="Buscar alteracoes"><select data-change-status aria-label="Filtrar por status"><option value="">Todos os status</option>${Object.entries(statusLabels).map(([value, label]) => `<option value="${value}" ${changeRequestState.status === value ? "selected" : ""}>${label}</option>`).join("")}</select></div><div class="change-rows">${cards}</div><div class="table-pagination"><button type="button" class="compact-action" data-change-prev ${changeRequestState.offset === 0 ? "disabled" : ""}>Anterior</button><span>Página ${Math.floor(changeRequestState.offset / 100) + 1}</span><button type="button" class="compact-action" data-change-next ${returnedChanges < 100 ? "disabled" : ""}>Proxima</button></div></section>`;
    const legacyChangeSummary = dashboardGrid.querySelector(".change-summary"); if (legacyChangeSummary) { legacyChangeSummary.insertAdjacentHTML("afterend", ui.stats([{ label: "No filtro", value: ui.number(rows.length) }, { label: "Aguardando decisão", value: ui.number(pending), tone: pending ? "orange" : undefined }, { label: "Impacto acumulado", value: `${ui.number(totalDays)} dias` }, { label: "Custo adicional", value: money(totalCost), tone: totalCost ? "orange" : undefined }])); legacyChangeSummary.remove(); }
    const openNew = () => prepareStructuredCreate("alteracao"); dashboardGrid.querySelector("[data-change-new]")?.addEventListener("click", openNew); dashboardGrid.querySelector(".change-empty")?.addEventListener("click", openNew);
    dashboardGrid.querySelector("[data-change-search]")?.addEventListener("input", (event) => { changeRequestState.search = event.target.value.trim(); changeRequestState.offset = 0; clearTimeout(changeRequestState.timer); changeRequestState.timer = setTimeout(renderChangeRequests, 250); }); dashboardGrid.querySelector("[data-change-status]")?.addEventListener("change", (event) => { changeRequestState.status = event.target.value; changeRequestState.offset = 0; renderChangeRequests(); }); dashboardGrid.querySelector("[data-change-prev]")?.addEventListener("click", () => { changeRequestState.offset = Math.max(0, changeRequestState.offset - 100); renderChangeRequests(); }); dashboardGrid.querySelector("[data-change-next]")?.addEventListener("click", () => { changeRequestState.offset += 100; renderChangeRequests(); });
    dashboardGrid.querySelectorAll("[data-change-detail]").forEach((button) => button.addEventListener("click", () => detail(rows.find((row) => String(row.id) === String(button.dataset.changeDetail)))));
    dashboardGrid.querySelectorAll("[data-change-decision]").forEach((button) => button.addEventListener("click", async () => { button.disabled = true; try { await api(`/api/change_requests/${button.dataset.changeDecision}`, { method: "PATCH", body: { status: button.dataset.changeStatus, approval_data: { decision: button.dataset.changeStatus, decided_at: new Date().toISOString() } } }); toast("Decisão registrada.", "success"); renderChangeRequests(); } catch (error) { button.disabled = false; toast(error.message, "error"); } }));
    dashboardGrid.querySelectorAll("[data-change-edit]").forEach((button) => button.addEventListener("click", async () => { const row = rows.find((item) => String(item.id) === String(button.dataset.changeEdit)); if (!row) return; await prepareStructuredCreate("alteracao"); const form = document.querySelector("#create-form"); if (!form) return; Object.entries(row).forEach(([field, value]) => { const input = form.elements[field]; if (input && value !== null && value !== undefined) input.value = String(value); }); form.dataset.method = "PATCH"; form.dataset.endpoint = `/api/change_requests/${row.id}`; }));
    dashboardGrid.querySelectorAll("[data-change-delete]").forEach((button) => button.addEventListener("click", () => ui.confirmInline(button, { text: "Excluir esta alteração?", onConfirm: async () => { await api(`/api/change_requests/${button.dataset.changeDelete}`, { method: "DELETE" }); toast("Alteração removida.", "success"); renderChangeRequests(); } })));
  } catch (error) { if (request !== changeRequestState.request || location.hash !== "#alteracoes") return; dashboardGrid.innerHTML = `<section class="page-intro"><div><p class="card-kicker">Operação integrada</p><h2>Alterações de escopo</h2></div><button type="button" class="button button-primary compact-action" data-change-new>+ Nova alteração</button></section>${stateBlock.error(error.message, "change-retry")}`; dashboardGrid.querySelector("[data-change-new]")?.addEventListener("click", () => prepareStructuredCreate("alteracao")); dashboardGrid.querySelector(".change-retry")?.addEventListener("click", renderChangeRequests); }
}
const genericStructureKeys = ["cofre", "aprovacoes", "alteracoes", "entregas"];
const deliveryScreenState = { search: "", status: "", offset: 0, request: 0 };
async function renderDeliveries() {
  if (location.hash !== "#entregas") return;
  const request = deliveryScreenState.request = (deliveryScreenState.request || 0) + 1;
  const statusLabels = { draft: "Rascunho", ready: "Pronta", published: "Publicada", approved: "Aprovada" };
  dashboardGrid.innerHTML = `<section class="page-intro"><div><p class="card-kicker">Operação integrada</p><h2>Entregas e publicações</h2><p>Controle versões, ambientes, backups e aprovação do cliente em um único lugar.</p></div><button type="button" class="button button-primary compact-action" data-delivery-new>+ Nova entrega</button></section>${stateBlock.loading("Carregando entregas…")}`;
  try {
    const params = new URLSearchParams({ limit: "100", offset: String(deliveryScreenState.offset) }); if (deliveryScreenState.search) params.set("search", deliveryScreenState.search); if (deliveryScreenState.status) params.set("status", deliveryScreenState.status);
    const [deliveryResult, projectsResult] = await Promise.allSettled([api(`/api/deliveries?${params}`), api("/api/projects")]);
    if (request !== deliveryScreenState.request || location.hash !== "#entregas") return;
    if (deliveryResult.status === "rejected") throw deliveryResult.reason;
    const rows = deliveryResult.value.deliveries || [], projects = new Map((projectsResult.status === "fulfilled" ? projectsResult.value.projects || [] : []).map((item) => [String(item.id), item.name]));
    const published = rows.filter((row) => row.status === "published").length, approved = rows.filter((row) => row.client_approved || row.status === "approved").length, pending = rows.filter((row) => !row.client_approved && row.status !== "approved").length;
    const projectName = (row) => row.project_id ? projects.get(String(row.project_id)) || `Projeto #${row.project_id}` : "Sem projeto vinculado";
    const showDetails = (row) => { if (!row) return; const value = (item) => item === null || item === undefined || item === "" ? "—" : typeof item === "object" ? JSON.stringify(item) : String(item); const html = Object.entries(row).filter(([key]) => !["id", "organization_id"].includes(key)).map(([key, item]) => `<dt>${esc(key.replaceAll("_", " "))}</dt><dd>${esc(value(item))}</dd>`).join(""); ui.drawer({ title: `Versão ${row.version || "sem número"}`, subtitle: projectName(row), html: `<dl>${html || "<dd>Sem detalhes disponíveis.</dd>"}</dl>` }); };
    const cards = rows.length ? rows.map((row) => `<article class="delivery-row"><div class="delivery-row-main"><div><span class="finance-status ${row.status === "approved" ? "success" : row.status === "published" ? "info" : "neutral"}">${esc(statusLabels[row.status] || row.status || "Sem status")}</span><h3>Versão ${esc(row.version || "sem número")}</h3><p>${esc(projectName(row))} · ${esc(row.environment || "Ambiente não informado")}</p></div><div class="delivery-checks"><span class="${row.backup_done ? "is-done" : ""}">${row.backup_done ? "✓" : "○"} Backup</span><span class="${row.client_approved ? "is-done" : ""}">${row.client_approved ? "✓" : "○"} Cliente</span></div></div><div class="delivery-row-actions"><button type="button" class="compact-action" data-delivery-detail="${esc(row.id)}">Detalhes</button>${row.published_url ? `<a class="compact-action" href="${esc(row.published_url)}" target="_blank" rel="noreferrer">Abrir publicação</a>` : ""}<button type="button" class="compact-action" data-delivery-share="${esc(row.id)}">Link de aprovação</button>${!row.client_approved && row.status !== "approved" ? `<button type="button" class="compact-action approval-accept" data-delivery-approve="${esc(row.id)}">Registrar aprovação</button>` : ""}<button type="button" class="compact-action" data-delivery-edit="${esc(row.id)}">Editar</button><button type="button" class="compact-action" data-delivery-delete="${esc(row.id)}">Excluir</button></div></article>`).join("") : stateBlock.empty("Nenhuma entrega encontrada", "Cadastre uma versão para acompanhar publicação e aprovação do cliente.", "Criar entrega", "delivery-empty");
    dashboardGrid.innerHTML = `<section class="page-intro"><div><p class="card-kicker">Operação integrada</p><h2>Entregas e publicações</h2><p>Controle versões, ambientes, backups e aprovação do cliente em um único lugar.</p></div><button type="button" class="button button-primary compact-action" data-delivery-new>+ Nova entrega</button></section><section class="delivery-summary"><article class="data-card"><span>Total no filtro</span><strong>${rows.length}</strong></article><article class="data-card"><span>Publicadas</span><strong>${published}</strong></article><article class="data-card"><span>Aprovadas pelo cliente</span><strong>${approved}</strong></article><article class="data-card"><span>Aguardando aprovação</span><strong>${pending}</strong></article></section><section class="data-card delivery-list"><div class="finance-toolbar"><input type="search" data-delivery-search value="${esc(deliveryScreenState.search)}" placeholder="Buscar versão ou ambiente…" aria-label="Buscar entregas"><select data-delivery-status aria-label="Filtrar por status"><option value="">Todos os status</option>${Object.entries(statusLabels).map(([value, label]) => `<option value="${value}" ${deliveryScreenState.status === value ? "selected" : ""}>${label}</option>`).join("")}</select></div><div class="delivery-rows">${cards}</div><div class="table-pagination"><button type="button" class="compact-action" data-delivery-prev ${deliveryScreenState.offset === 0 ? "disabled" : ""}>Anterior</button><span>Página ${Math.floor(deliveryScreenState.offset / 100) + 1}</span><button type="button" class="compact-action" data-delivery-next ${(deliveryResult.value.pagination?.returned ?? rows.length) < 100 ? "disabled" : ""}>Proxima</button></div></section>`;
    const legacyDeliverySummary = dashboardGrid.querySelector(".delivery-summary"); if (legacyDeliverySummary) { legacyDeliverySummary.insertAdjacentHTML("afterend", ui.stats([{ label: "No filtro", value: ui.number(rows.length) }, { label: "Publicadas", value: ui.number(published), tone: "blue" }, { label: "Aprovadas", value: ui.number(approved), tone: "green" }, { label: "Aguardando aprovação", value: ui.number(pending), tone: pending ? "orange" : undefined }])); legacyDeliverySummary.remove(); }
    const openNew = () => prepareStructuredCreate("entrega"); dashboardGrid.querySelector("[data-delivery-new]")?.addEventListener("click", openNew); dashboardGrid.querySelector(".delivery-empty")?.addEventListener("click", openNew);
    dashboardGrid.querySelector("[data-delivery-search]")?.addEventListener("input", (event) => { deliveryScreenState.search = event.target.value.trim(); deliveryScreenState.offset = 0; clearTimeout(deliveryScreenState.timer); deliveryScreenState.timer = setTimeout(renderDeliveries, 250); }); dashboardGrid.querySelector("[data-delivery-status]")?.addEventListener("change", (event) => { deliveryScreenState.status = event.target.value; deliveryScreenState.offset = 0; renderDeliveries(); }); dashboardGrid.querySelector("[data-delivery-prev]")?.addEventListener("click", () => { deliveryScreenState.offset = Math.max(0, deliveryScreenState.offset - 100); renderDeliveries(); }); dashboardGrid.querySelector("[data-delivery-next]")?.addEventListener("click", () => { deliveryScreenState.offset += 100; renderDeliveries(); });
    dashboardGrid.querySelectorAll("[data-delivery-detail]").forEach((button) => button.addEventListener("click", () => showDetails(rows.find((row) => String(row.id) === String(button.dataset.deliveryDetail)))));
    dashboardGrid.querySelectorAll("[data-delivery-share]").forEach((button) => button.addEventListener("click", async () => { button.disabled = true; try { const data = await api(`/api/deliveries/${button.dataset.deliveryShare}/public-link`, { method: "POST", body: {} }); await ui.copyText(`${location.origin}${data.path}`); button.textContent = "Link copiado"; toast("Link da entrega copiado.", "success"); } catch (error) { button.disabled = false; toast(error.message, "error"); } }));
    dashboardGrid.querySelectorAll("[data-delivery-approve]").forEach((button) => button.addEventListener("click", async () => { button.disabled = true; try { await api(`/api/deliveries/${button.dataset.deliveryApprove}`, { method: "PATCH", body: { client_approved: true, status: "approved" } }); toast("Aprovação registrada.", "success"); renderDeliveries(); } catch (error) { button.disabled = false; toast(error.message, "error"); } }));
    dashboardGrid.querySelectorAll("[data-delivery-edit]").forEach((button) => button.addEventListener("click", async () => { const row = rows.find((item) => String(item.id) === String(button.dataset.deliveryEdit)); if (!row) return; await prepareStructuredCreate("entrega"); const form = document.querySelector("#create-form"); if (!form) return; Object.entries(row).forEach(([field, value]) => { const input = form.elements[field]; if (input && value !== null && value !== undefined) input.value = String(value); }); form.dataset.method = "PATCH"; form.dataset.endpoint = `/api/deliveries/${row.id}`; }));
    dashboardGrid.querySelectorAll("[data-delivery-delete]").forEach((button) => button.addEventListener("click", () => ui.confirmInline(button, { text: "Excluir esta entrega?", onConfirm: async () => { await api(`/api/deliveries/${button.dataset.deliveryDelete}`, { method: "DELETE" }); toast("Entrega removida.", "success"); renderDeliveries(); } })));
  } catch (error) { if (request !== deliveryScreenState.request || location.hash !== "#entregas") return; dashboardGrid.innerHTML = `<section class="page-intro"><div><p class="card-kicker">Operação integrada</p><h2>Entregas e publicações</h2></div><button type="button" class="button button-primary compact-action" data-delivery-new>+ Nova entrega</button></section>${stateBlock.error(error.message, "delivery-retry")}`; dashboardGrid.querySelector("[data-delivery-new]")?.addEventListener("click", () => prepareStructuredCreate("entrega")); dashboardGrid.querySelector(".delivery-retry")?.addEventListener("click", renderDeliveries); }
}
const vaultScreenState = { search: "", request: 0 };
async function renderVault() {
  if (location.hash !== "#cofre") return;
  const request = vaultScreenState.request = (vaultScreenState.request || 0) + 1;
  dashboardGrid.setAttribute("aria-busy", "true");
  const restoreVaultSearchFocus = ui.keepSearchFocus(dashboardGrid, "[data-vault-search]");
  dashboardGrid.innerHTML = `<section class="page-intro"><div><p class="card-kicker">Operação segura</p><h2>Cofre de acessos</h2><p>Credenciais criptografadas, vinculadas ao cliente e ao projeto correto.</p></div><button type="button" class="button button-primary compact-action" data-vault-new>+ Novo acesso</button></section>${stateBlock.loading("Carregando acessos protegidos…")}`;
  try {
    const [vaultResult, clientsResult, projectsResult] = await Promise.allSettled([api("/api/vault"), api("/api/clients"), api("/api/projects")]);
    if (request !== vaultScreenState.request || location.hash !== "#cofre") return;
    if (vaultResult.status === "rejected") throw vaultResult.reason;
    const rows = vaultResult.value.vault || [], clients = new Map((clientsResult.status === "fulfilled" ? clientsResult.value.clients || [] : []).map((item) => [String(item.id), item.name])), projects = new Map((projectsResult.status === "fulfilled" ? projectsResult.value.projects || [] : []).map((item) => [String(item.id), item.name]));
    const visible = rows.filter((row) => !vaultScreenState.search || `${row.name} ${row.service} ${clients.get(String(row.client_id)) || ""} ${projects.get(String(row.project_id)) || ""}`.toLocaleLowerCase("pt-BR").includes(vaultScreenState.search.toLocaleLowerCase("pt-BR")));
    dashboardGrid.innerHTML = `<section class="page-intro"><div><p class="card-kicker">Operação segura</p><h2>Cofre de acessos</h2><p>Credenciais criptografadas, vinculadas ao cliente e ao projeto correto.</p></div><button type="button" class="button button-primary compact-action" data-vault-new>+ Novo acesso</button></section><section class="vault-summary"><article class="data-card"><span>Acessos protegidos</span><strong>${rows.length}</strong></article><article class="data-card"><span>Com cliente vinculado</span><strong>${rows.filter((row) => row.client_id).length}</strong></article><article class="data-card"><span>Expiram em 30 dias</span><strong>${rows.filter((row) => row.expires_on && new Date(row.expires_on) >= new Date() && new Date(row.expires_on) <= new Date(Date.now() + 30 * 864e5)).length}</strong></article></section><section class="data-card vault-list"><div class="finance-toolbar"><input type="search" data-vault-search value="${esc(vaultScreenState.search)}" placeholder="Buscar serviço, cliente ou projeto…" aria-label="Buscar acesso protegido"></div>${visible.length ? `<div class="vault-grid">${visible.map((row) => `<article class="vault-card"><div class="section-heading"><div><span class="vault-icon" aria-hidden="true">⌁</span><div><h3>${esc(row.name)}</h3><small>${esc(row.service)}</small></div></div><span class="finance-status ${row.expires_on && new Date(row.expires_on) < new Date() ? "warning" : "neutral"}">${row.expires_on ? `Expira em ${esc(estruturaDate(row.expires_on))}` : "Sem expiração"}</span></div><div class="vault-links"><span>${esc(row.client_id ? clients.get(String(row.client_id)) || `Cliente #${row.client_id}` : "Sem cliente")}</span><span>${esc(row.project_id ? projects.get(String(row.project_id)) || `Projeto #${row.project_id}` : "Sem projeto")}</span></div><div class="template-actions"><button type="button" class="compact-action" data-vault-reveal="${esc(row.id)}">Revelar com senha</button><button type="button" class="compact-action" data-vault-edit="${esc(row.id)}">Editar</button><button type="button" class="compact-action" data-vault-delete="${esc(row.id)}">Excluir</button></div></article>`).join("")}</div>` : stateBlock.empty("Nenhum acesso protegido", "Cadastre um acesso para manter credenciais fora de documentos e mensagens.", "Criar acesso", "vault-empty")}</section>`;
    dashboardGrid.removeAttribute("aria-busy");
    const legacySummary = dashboardGrid.querySelector(".vault-summary"); if (legacySummary) { legacySummary.insertAdjacentHTML("afterend", ui.stats([{ label: "Acessos protegidos", value: ui.number(rows.length) }, { label: "Com cliente vinculado", value: ui.number(rows.filter((row) => row.client_id).length), tone: "green" }, { label: "Expiram em 30 dias", value: ui.number(rows.filter((row) => row.expires_on && new Date(row.expires_on) >= new Date() && new Date(row.expires_on) <= new Date(Date.now() + 30 * 864e5)).length), tone: "orange" }])); legacySummary.remove(); }
    restoreVaultSearchFocus();
    const openNew = () => prepareStructuredCreate("cofre");
    dashboardGrid.querySelector("[data-vault-new]")?.addEventListener("click", openNew); dashboardGrid.querySelector(".vault-empty")?.addEventListener("click", openNew);
    let vaultTimer; dashboardGrid.querySelector("[data-vault-search]")?.addEventListener("input", (event) => { vaultScreenState.search = event.target.value.trim(); clearTimeout(vaultTimer); vaultTimer = setTimeout(renderVault, 250); });
    dashboardGrid.querySelectorAll("[data-vault-reveal]").forEach((button) => button.addEventListener("click", () => revealVaultAccess(rows.find((item) => String(item.id) === String(button.dataset.vaultReveal)))));
    dashboardGrid.querySelectorAll("[data-vault-edit]").forEach((button) => button.addEventListener("click", async () => { const row = rows.find((item) => String(item.id) === String(button.dataset.vaultEdit)); if (!row) return; await prepareStructuredCreate("cofre"); const form = document.querySelector("#create-form"); if (!form) return; Object.entries(row).forEach(([field, value]) => { const input = form.elements[field]; if (input && value !== null && value !== undefined && field !== "secret") input.value = String(value); }); form.dataset.method = "PATCH"; form.dataset.endpoint = `/api/vault/${row.id}`; }));
    dashboardGrid.querySelectorAll("[data-vault-delete]").forEach((button) => button.addEventListener("click", () => ui.confirmInline(button, { text: "Excluir este acesso?", onConfirm: async () => { await api(`/api/vault/${button.dataset.vaultDelete}`, { method: "DELETE" }); toast("Acesso removido.", "success"); renderVault(); } })));
  } catch (error) { dashboardGrid.removeAttribute("aria-busy"); dashboardGrid.innerHTML = `<section class="page-intro"><div><p class="card-kicker">Operação segura</p><h2>Cofre de acessos</h2></div><button type="button" class="button button-primary compact-action" data-vault-new>+ Novo acesso</button></section>${stateBlock.error(error.message, "vault-retry")}`; dashboardGrid.querySelector("[data-vault-new]")?.addEventListener("click", () => prepareStructuredCreate("cofre")); dashboardGrid.querySelector(".vault-retry")?.addEventListener("click", renderVault); }
}
dashboardGrid.addEventListener("click", (event) => {
  const button = event.target.closest?.("[data-vault-delete]");
  if (!button || location.hash !== "#cofre") return;
  event.preventDefault();
  event.stopImmediatePropagation();
  if (button.dataset.confirming === "1") return;
  button.dataset.confirming = "1";
  const request = vaultScreenState.request;
  ui.confirmInline(button, { text: "Excluir este acesso?", onConfirm: async () => {
    button.disabled = true;
    button.setAttribute("aria-busy", "true");
    try {
      await api(`/api/vault/${button.dataset.vaultDelete}`, { method: "DELETE" });
      if (request !== vaultScreenState.request || location.hash !== "#cofre" || !button.isConnected) return;
      toast("Acesso removido.", "success");
      renderVault();
    } catch (error) {
      if (request === vaultScreenState.request && location.hash === "#cofre" && button.isConnected) throw error;
    } finally {
      delete button.dataset.confirming;
    }
  } });
}, true);
let approvalActionRequest = 0;
dashboardGrid.addEventListener("click", async (event) => {
  if (location.hash !== "#aprovacoes") return;
  const button = event.target.closest?.("[data-approval-action]");
  if (!button) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  if (button.dataset.approvalBusy === "1") return;
  const approved = button.dataset.approvalStatus === "approved";
  const actionRequest = ++approvalActionRequest;
  button.dataset.approvalBusy = "1";
  button.dataset.approvalLabel = button.textContent;
  button.disabled = true;
  button.setAttribute("aria-busy", "true");
  button.textContent = approved ? "Aprovando…" : "Recusando…";
  try {
    await api(`/api/approvals/${button.dataset.approvalAction}`, { method: "PATCH", body: { status: button.dataset.approvalStatus, decision: button.dataset.approvalStatus, decided_at: new Date().toISOString() } });
    if (actionRequest !== approvalActionRequest || location.hash !== "#aprovacoes" || !button.isConnected) return;
    toast(approved ? "Aprovação registrada." : "Recusa registrada.", "success");
    renderApprovals();
  } catch (error) {
    if (actionRequest !== approvalActionRequest || location.hash !== "#aprovacoes" || !button.isConnected) return;
    button.disabled = false;
    button.removeAttribute("aria-busy");
    button.textContent = button.dataset.approvalLabel || (approved ? "Aprovar" : "Recusar");
    delete button.dataset.approvalBusy;
    delete button.dataset.approvalLabel;
    toast(error.message, "error");
  }
}, true);

let approvalRenderRequest = 0;
async function renderApprovals() {
  if (location.hash !== "#aprovacoes") return;
  const request = ++approvalRenderRequest;
  dashboardGrid.innerHTML = `<section class="page-intro"><div><p class="card-kicker">Meu dia</p><h2>Aprovações</h2><p>Centralize decisões pendentes de propostas, contratos, entregas e alterações.</p></div></section>${stateBlock.loading("Carregando aprovações…")}`;
  const [overviewResult, manualResult] = await Promise.allSettled([api("/api/approvals/overview"), api("/api/approvals")]);
  if (request !== approvalRenderRequest || location.hash !== "#aprovacoes") return;
  if (overviewResult.status === "rejected" && manualResult.status === "rejected") { dashboardGrid.innerHTML = `<section class="page-intro"><div><p class="card-kicker">Meu dia</p><h2>Aprovações</h2></div></section>${stateBlock.error("Não foi possível carregar as aprovações. Tente novamente.", "approval-retry")}`; dashboardGrid.querySelector(".approval-retry")?.addEventListener("click", renderApprovals); return; }
  const overview = overviewResult.status === "fulfilled" ? overviewResult.value : {};
  const manual = manualResult.status === "fulfilled" ? manualResult.value.approvals || [] : [];
  const groups = [["Aprovações manuais", manual, "#aprovacoes", (item) => item.title || "Solicitação"], ["Propostas", overview.proposals || [], "#propostas", (item) => item.title || "Proposta"], ["Contratos", overview.contracts || [], "#contratos", (item) => item.name || "Contrato"], ["Entregas", overview.deliveries || [], "#entregas", (item) => `Versão ${item.version || "—"}`], ["Alterações de escopo", overview.changes || [], "#alteracoes", (item) => item.title || "Alteração"]];
  const total = groups.reduce((sum, [, items]) => sum + items.length, 0);
  const cards = groups.map(([label, items, href, itemLabel]) => `<article class="data-card approval-workspace-card"><div class="section-heading"><div><p class="card-kicker">Pendente</p><h3>${label}</h3></div><strong>${items.length}</strong></div>${items.length ? `<div class="approval-workspace-items">${items.slice(0, 8).map((item) => `<div class="approval-workspace-item"><div><strong>${escapeHtml(itemLabel(item))}</strong><small>${escapeHtml(item.client_name || item.project_name || item.status || "Aguardando decisão")}</small></div>${href === "#aprovacoes" && item.status === "pending" ? `<div class="approval-inline-actions"><button type="button" class="compact-action approval-accept" data-approval-action="${escapeHtml(item.id)}" data-approval-status="approved">Aprovar</button><button type="button" class="compact-action approval-reject" data-approval-action="${escapeHtml(item.id)}" data-approval-status="rejected">Recusar</button></div>` : `<a class="compact-action" href="${href}">Abrir</a>`}</div>`).join("")}</div>` : `<p class="approval-workspace-empty">Nenhuma pendência.</p>`}</article>`).join("");
  dashboardGrid.innerHTML = `<section class="page-intro"><div><p class="card-kicker">Meu dia</p><h2>Aprovações</h2><p>Centralize decisões pendentes de propostas, contratos, entregas e alterações.</p></div><strong class="approval-total">${total} pendência${total === 1 ? "" : "s"}</strong></section>${overviewResult.status === "rejected" ? `<div class="data-card state-error approval-warning"><p>O resumo consolidado está indisponível; exibindo aprovações manuais.</p></div>` : ""}${ui.stats([{ label: "Pendências totais", value: ui.number(total), tone: total ? "orange" : "green" }, { label: "Manuais", value: ui.number(manual.length) }, { label: "Entregas", value: ui.number((overview.deliveries || []).length) }, { label: "Alterações", value: ui.number((overview.changes || []).length) }])}<section class="approval-workspace-grid">${cards}</section>`;
  dashboardGrid.querySelectorAll("[data-approval-action]").forEach((button) => button.addEventListener("click", async () => { button.disabled = true; try { await api(`/api/approvals/${button.dataset.approvalAction}`, { method: "PATCH", body: { status: button.dataset.approvalStatus, decision: button.dataset.approvalStatus, decided_at: new Date().toISOString() } }); toast(button.dataset.approvalStatus === "approved" ? "Aprovação registrada." : "Recusa registrada.", "success"); renderApprovals(); } catch (error) { button.disabled = false; toast(error.message, "error"); } }));
}
dashboardGrid.addEventListener("click", async (event) => {
  const button = event.target.closest?.("[data-delivery-share], [data-delivery-approve]");
  if (!button || location.hash !== "#entregas") return;
  event.preventDefault();
  event.stopImmediatePropagation();
  if (button.dataset.busy === "1") return;
  const routeAtStart = location.hash;
  button.dataset.busy = "1";
  button.disabled = true;
  button.setAttribute("aria-busy", "true");
  const originalLabel = button.textContent;
  const isApproval = button.hasAttribute("data-delivery-approve");
  button.textContent = isApproval ? "Registrando…" : "Gerando link…";
  try {
    if (isApproval) {
      await api(`/api/deliveries/${button.dataset.deliveryApprove}`, { method: "PATCH", body: { client_approved: true, status: "approved" } });
      if (location.hash !== routeAtStart || !button.isConnected) return;
      toast("Aprovação registrada.", "success");
      await renderDeliveries();
    } else {
      const data = await api(`/api/deliveries/${button.dataset.deliveryShare}/public-link`, { method: "POST", body: {} });
      if (location.hash !== routeAtStart || !button.isConnected) return;
      await ui.copyText(`${location.origin}${data.path}`);
      button.textContent = "Link copiado";
      toast("Link da entrega copiado.", "success");
    }
  } catch (error) {
    if (button.isConnected && location.hash === routeAtStart) { button.disabled = false; button.textContent = originalLabel; toast(error.message, "error"); }
  } finally {
    if (!button.isConnected) return;
    button.disabled = false;
    button.removeAttribute("aria-busy");
    button.dataset.busy = "";
  }
}, true);

registerRoutes(Object.fromEntries(genericStructureKeys.map((key) => [key, key === "aprovacoes" ? renderApprovals : key === "cofre" ? renderVault : key === "alteracoes" ? renderChangeRequests : key === "entregas" ? renderDeliveries : () => renderEstrutura(key)])));
window.addEventListener("hashchange", () => {
  const hash = location.hash;
  approvalActionRequest += 1;
  if (hash !== "#alteracoes") { changeRequestState.request += 1; clearTimeout(changeRequestState.timer); changeRequestState.timer = null; }
  if (hash !== "#entregas") { deliveryScreenState.request += 1; clearTimeout(deliveryScreenState.timer); deliveryScreenState.timer = null; }
  if (hash !== "#cofre") { vaultScreenState.request += 1; }
});
const estruturaCopyObserver = new MutationObserver(() => {
  const hash = location.hash.replace(/^#/, "");
  dashboardGrid.querySelectorAll(".state-loading p").forEach((label) => { const normalized = label.textContent?.replaceAll("alteracoes", "alterações").replaceAll("...", "…"); if (normalized !== label.textContent) label.textContent = normalized; });
  if (hash === "alteracoes") {
    dashboardGrid.querySelector("[data-change-search]")?.setAttribute("placeholder", "Buscar solicitação…");
    const next = dashboardGrid.querySelector("[data-change-next]");
    if (next && next.textContent !== "Próxima") next.textContent = "Próxima";
    dashboardGrid.querySelectorAll(".change-row .finance-status").forEach((status) => { status.setAttribute("role", "status"); status.setAttribute("aria-live", "polite"); });
  }
  if (hash === "entregas") {
    dashboardGrid.querySelector("[data-delivery-search]")?.setAttribute("placeholder", "Buscar versão ou ambiente…");
    const next = dashboardGrid.querySelector("[data-delivery-next]");
    if (next && next.textContent !== "Próxima") next.textContent = "Próxima";
    dashboardGrid.querySelectorAll(".delivery-row a[href]").forEach((link) => { const safeUrl = estruturaSafeExternalUrl(link.getAttribute("href")); if (!safeUrl) { link.removeAttribute("href"); link.setAttribute("aria-disabled", "true"); link.classList.add("is-disabled"); } else { link.setAttribute("href", safeUrl); link.setAttribute("rel", "noopener noreferrer"); } });
  }
});
estruturaCopyObserver.observe(dashboardGrid, { childList: true, subtree: true });
const estruturaInteractionObserver = new MutationObserver(() => {
  dashboardGrid.querySelectorAll("button, a").forEach((control) => { control.style.touchAction = "manipulation"; });
  dashboardGrid.querySelectorAll(".finance-status, .approval-total").forEach((status) => { status.setAttribute("role", "status"); status.setAttribute("aria-live", "polite"); });
});
estruturaInteractionObserver.observe(dashboardGrid, { childList: true, subtree: true });

/* A lista estruturada também precisa permitir manutenção dos registros. */
const structuredMutationObserver = new MutationObserver(async () => {
  const key = location.hash.replace(/^#/, "");
  const kind = recordCreateKind[key];
  if (!kind || ["auditoria", "lixeira"].includes(key)) return;
  const routeAtStart = location.hash;
  const list = dashboardGrid.querySelector(".automation-list[data-structured-list]");
  if (!list || list.dataset.maintenanceActions === "1") return;
  list.dataset.maintenanceActions = "1";
  try {
    const table = labels[key][1], rows = ((await api(`/api/${table}`))[table] || []);
    if (location.hash !== routeAtStart || !list.isConnected) return;
    list.querySelectorAll("article").forEach((article, index) => {
      const row = rows[index]; if (!row) return;
      const actions = document.createElement("span"); actions.className = "structured-actions";
      const details = document.createElement("button"); details.type = "button"; details.className = "compact-action"; details.textContent = "Detalhes";
      details.addEventListener("click", () => {
        const hidden = new Set(["id", "organization_id", "password", "password_hash", "api_key", "secret", "secret_ciphertext", "secret_iv", "secret_tag", "token", "public_token"]);
        const value = (v) => v === null || v === undefined || v === "" ? "—" : typeof v === "object" ? JSON.stringify(v) : /^\d{4}-\d{2}-\d{2}T/.test(String(v)) ? estruturaDateTime(v) : String(v);
        const html = Object.entries(row).filter(([field]) => !hidden.has(field)).map(([field, v]) => `<dt>${escapeHtml(field.replaceAll("_", " "))}</dt><dd>${escapeHtml(value(v))}</dd>`).join("");
        ui.drawer({ title: row[labels[key][2]] || row.name || row.title || `#${row.id}`, subtitle: labels[key][0], html: `<dl>${html || "<dd>Sem detalhes disponíveis.</dd>"}</dl>` });
      });
      actions.append(details);
      const edit = document.createElement("button"); edit.type = "button"; edit.className = "compact-action"; edit.textContent = "Editar";
      edit.addEventListener("click", () => openEditDialog(kind, row, `/api/${table}/${row.id}`));
      const remove = document.createElement("button"); remove.type = "button"; remove.className = "compact-action"; remove.textContent = "Excluir";
      remove.addEventListener("click", async () => {
        if (remove.dataset.confirm !== "1") { remove.dataset.confirm = "1"; remove.textContent = "Confirmar"; return; }
        remove.disabled = true;
        try { await api(`/api/${table}/${row.id}`, { method: "DELETE" }); renderEstrutura(key); }
        catch (error) { remove.disabled = false; remove.textContent = error.message; }
      });
      actions.append(edit, remove);
      if (key === "cofre") { const reveal = document.createElement("button"); reveal.type = "button"; reveal.className = "compact-action"; reveal.textContent = "Revelar com senha"; reveal.addEventListener("click", () => revealVaultAccess(row)); actions.append(reveal); }
      if (key === "contas-a-pagar" && !["paid", "cancelled"].includes(row.status)) { const pay = document.createElement("button"); pay.type = "button"; pay.className = "compact-action"; pay.textContent = "Registrar pagamento"; pay.addEventListener("click", async () => { pay.disabled = true; try { await api(`/api/payables/${row.id}/record-payment`, { method: "POST", body: {} }); ui.toast("Pagamento registrado como despesa.", "success"); renderEstrutura(key); } catch (error) { pay.disabled = false; ui.toast(error.message, "error"); } }); actions.append(pay); }
      if (key === "contas-bancarias") { const movement = document.createElement("button"); movement.type = "button"; movement.className = "compact-action"; movement.textContent = "Movimentar"; movement.addEventListener("click", () => ui.form({ title: `Movimentar · ${row.name}`, subtitle: "Conta bancária", fields: [{ name: "kind", label: "Tipo", type: "select", options: [["credit", "Entrada"], ["debit", "Saída"]] }, { name: "amount", label: "Valor", type: "number", min: 0.01, step: 0.01 }, { name: "description", label: "Descrição" }], onSubmit: async (values) => { await api(`/api/bank_accounts/${row.id}/transactions`, { method: "POST", body: values }); ui.toast("Movimentação registrada.", "success"); renderEstrutura(key); } })); actions.append(movement); }
      if (key === "horas" && row.started_at && !row.ended_at) { const stop = document.createElement("button"); stop.type = "button"; stop.className = "compact-action"; stop.textContent = "Finalizar cronômetro"; stop.addEventListener("click", async () => { stop.disabled = true; try { await api(`/api/time-entry-timer/${row.id}/stop`, { method: "POST", body: {} }); toast("Cronômetro finalizado.", "success"); renderEstrutura(key); } catch (error) { stop.disabled = false; toast(error.message, "error"); } }); actions.append(stop); }
      article.append(actions);
    });
  } catch (error) { list.dataset.maintenanceActions = ""; if (location.hash === routeAtStart) toast(error.message, "error"); }
});
structuredMutationObserver.observe(dashboardGrid, { childList: true, subtree: true });

dashboardGrid.addEventListener("click", (event) => {
  if (location.hash.replace(/^#/, "") !== "horas") return;
  const button = event.target.closest?.("button");
  if (!button || !button.textContent.includes("Finalizar cronômetro") || button.dataset.timerBusy === "1") return;
  button.dataset.timerBusy = "1";
  button.dataset.timerLabel = button.textContent;
  button.disabled = true;
  button.setAttribute("aria-busy", "true");
  button.textContent = "Finalizando…";
}, true);

new MutationObserver(() => {
  dashboardGrid.querySelectorAll("button[data-timer-busy=\"1\"]").forEach((button) => {
    if (button.disabled) return;
    button.textContent = button.dataset.timerLabel || "Finalizar cronômetro";
    button.removeAttribute("aria-busy");
    delete button.dataset.timerBusy;
    delete button.dataset.timerLabel;
  });
}).observe(dashboardGrid, { childList: true, subtree: true, attributes: true, attributeFilter: ["disabled"] });

const trashRestoreObserver = new MutationObserver(async () => {
  if (location.hash.replace(/^#/, "") !== "lixeira") return;
  const list = dashboardGrid.querySelector(".automation-list[data-structured-list]");
  if (!list || list.dataset.restoreActions === "1") return;
  list.dataset.restoreActions = "1";
  try {
    const rows = (await api("/api/trash")).trash || [];
    if (location.hash.replace(/^#/, "") !== "lixeira" || !list.isConnected) return;
    list.querySelectorAll("article").forEach((article, index) => {
      const item = rows[index]; if (!item) return;
      const button = document.createElement("button"); button.type = "button"; button.className = "compact-action"; button.textContent = "Restaurar";
      button.addEventListener("click", async () => { if (location.hash.replace(/^#/, "") !== "lixeira" || button.disabled) return; button.disabled = true; button.setAttribute("aria-busy", "true"); try { await api(`/api/trash/${item.id}/restore`, { method: "POST", body: {} }); if (location.hash.replace(/^#/, "") === "lixeira") { toast("Registro restaurado.", "success"); renderEstrutura("lixeira"); } } catch (error) { if (button.isConnected) { button.disabled = false; button.removeAttribute("aria-busy"); } if (location.hash.replace(/^#/, "") === "lixeira") toast(error.message, "error"); } });
      article.append(button);
    });
  } catch (error) { list.dataset.restoreActions = ""; toast(error.message, "error"); }
});
trashRestoreObserver.observe(dashboardGrid, { childList: true, subtree: true });

dashboardGrid.addEventListener("click", async (event) => {
  const button = event.target.closest?.("[data-delivery-share]");
  if (!button || location.hash !== "#entregas") return;
  event.preventDefault();
  event.stopImmediatePropagation();
  if (button.dataset.busy === "1") return;
  button.dataset.busy = "1";
  button.disabled = true;
  button.textContent = "Gerando…";
  try {
    const data = await api(`/api/deliveries/${button.dataset.deliveryShare}/public-link`, { method: "POST", body: {} });
    await ui.copyText(`${location.origin}${data.path}`);
    button.textContent = "Link copiado";
    toast("Link da entrega copiado.", "success");
  } catch (error) {
    button.textContent = "Link de aprovação";
    toast(error.message, "error");
  } finally {
    button.disabled = false;
    button.dataset.busy = "";
  }
}, true);
