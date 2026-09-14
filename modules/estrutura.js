/* Telas dos recursos operacionais complementares do menu final. */
const labels = {
  aprovacoes: ["Aprovações", "approvals", "title"], briefings: ["Briefings", "briefings", "name"],
  "contas-a-pagar": ["Contas a pagar", "payables", "description"], "contas-bancarias": ["Contas bancárias", "bank_accounts", "name"],
  "notas-fiscais": ["Notas fiscais", "invoices", "number"], formularios: ["Formulários", "forms", "name"],
  "base-de-conhecimento": ["Base de conhecimento", "knowledge_articles", "title"], auditoria: ["Auditoria", "audit_events", "action"],
  lixeira: ["Lixeira", "trash", "entity_type"], comissoes: ["Comissões", "commissions", "description"],
  horas: ["Horas trabalhadas", "time_entries", "minutes"], metas: ["Metas", "team_goals", "name"], ausencias: ["Ausências", "absences", "kind"],
};
const configs = {
  aprovacao: { title: "Nova aprovação", endpoint: "/api/approvals", fields: [{ name: "target_type", label: "Tipo" }, { name: "title", label: "Título" }, { name: "client_id", label: "Cliente (ID)", required: false }, { name: "project_id", label: "Projeto (ID)", required: false }] },
  briefing: { title: "Novo briefing", endpoint: "/api/briefings", fields: [{ name: "name", label: "Nome" }, { name: "client_id", label: "Cliente (ID)", required: false }, { name: "questions", label: "Perguntas JSON", required: false }] },
  payable: { title: "Nova conta a pagar", endpoint: "/api/payables", fields: [{ name: "description", label: "Descrição" }, { name: "supplier", label: "Fornecedor", required: false }, { name: "amount", label: "Valor", type: "number" }, { name: "due_at", label: "Vencimento", type: "date", required: false }] },
  bank_account: { title: "Nova conta bancária", endpoint: "/api/bank_accounts", fields: [{ name: "name", label: "Nome" }, { name: "kind", label: "Tipo" }, { name: "opening_balance", label: "Saldo inicial", type: "number", required: false }] },
  invoice: { title: "Nova nota fiscal", endpoint: "/api/invoices", fields: [{ name: "number", label: "Número", required: false }, { name: "amount", label: "Valor", type: "number" }, { name: "client_id", label: "Cliente (ID)", required: false }] },
  form: { title: "Novo formulário", endpoint: "/api/forms", fields: [{ name: "name", label: "Nome" }, { name: "kind", label: "Tipo" }, { name: "schema", label: "Campos JSON", required: false }] },
  knowledge_article: { title: "Novo artigo", endpoint: "/api/knowledge_articles", fields: [{ name: "title", label: "Título" }, { name: "body", label: "Conteúdo" }, { name: "category", label: "Categoria", required: false }] },
  team_goal: { title: "Nova meta", endpoint: "/api/team_goals", fields: [{ name: "name", label: "Meta" }, { name: "target", label: "Valor esperado", type: "number", required: false }, { name: "period_end", label: "Fim do período", type: "date", required: false }] },
  absence: { title: "Nova ausência", endpoint: "/api/absences", fields: [{ name: "user_id", label: "Membro (ID)" }, { name: "kind", label: "Tipo" }, { name: "starts_on", label: "Início", type: "date" }, { name: "ends_on", label: "Fim", type: "date" }] },
  commission: { title: "Nova comissão", endpoint: "/api/commissions", fields: [{ name: "description", label: "Descrição" }, { name: "responsible", label: "Responsável", required: false }, { name: "user_id", label: "Membro (ID)", required: false }, { name: "project_id", label: "Projeto (ID)", required: false }, { name: "base_amount", label: "Base da venda", type: "number", required: false }, { name: "rate", label: "Percentual", type: "number", required: false }, { name: "amount", label: "Valor da comissão", type: "number" }, { name: "status", label: "Status", type: "select", options: [["pending", "Pendente"], ["approved", "Aprovada"], ["paid", "Paga"], ["cancelled", "Cancelada"]] }] },
  time_entry: { title: "Nova hora trabalhada", endpoint: "/api/time_entries", fields: [{ name: "user_id", label: "Membro (ID)" }, { name: "project_id", label: "Projeto (ID)", required: false }, { name: "task_id", label: "Tarefa (ID)", required: false }, { name: "minutes", label: "Minutos", type: "number" }, { name: "billable", label: "Faturável", type: "checkbox", required: false }, { name: "status", label: "Status", type: "select", options: [["pending", "Pendente"], ["approved", "Aprovada"], ["rejected", "Rejeitada"]] }, { name: "notes", label: "Observações", type: "textarea", required: false }] },
};
configs.aprovacao.fields.push({ name: "status", label: "Status", type: "select", options: [["pending", "Pendente"], ["approved", "Aprovada"], ["rejected", "Recusada"], ["cancelled", "Cancelada"]] }, { name: "comment", label: "Comentário", type: "textarea", required: false });
Object.assign(createConfig, configs);
labels.alteracoes = ["Alterações de escopo", "change_requests", "title"];
labels.entregas = ["Entregas e publicações", "deliveries", "version"];
labels.infraestrutura = ["Infraestrutura", "infrastructure_assets", "name"];
configs.alteracao = { title: "Nova solicitação de alteração", endpoint: "/api/change_requests", fields: [{ name: "title", label: "Título" }, { name: "description", label: "Descrição", type: "textarea", required: false }, { name: "project_id", label: "Projeto (ID)", required: false }, { name: "client_id", label: "Cliente (ID)", required: false }, { name: "impact_days", label: "Impacto no prazo (dias)", type: "number", required: false }, { name: "additional_cost", label: "Valor adicional", type: "number", required: false }, { name: "status", label: "Status", type: "select", options: [["pending", "Pendente"], ["approved", "Aprovada"], ["rejected", "Recusada"], ["implemented", "Implementada"]] }] };
configs.entrega = { title: "Nova entrega", endpoint: "/api/deliveries", fields: [{ name: "version", label: "Versão" }, { name: "project_id", label: "Projeto (ID)" }, { name: "environment", label: "Ambiente", required: false }, { name: "published_url", label: "Link publicado", type: "url", required: false }, { name: "status", label: "Status", type: "select", options: [["draft", "Rascunho"], ["ready", "Pronta"], ["published", "Publicada"], ["approved", "Aprovada"]] }, { name: "backup_done", label: "Backup realizado", type: "checkbox", required: false }, { name: "client_approved", label: "Aprovada pelo cliente", type: "checkbox", required: false }] };
configs.infraestrutura = { title: "Novo recurso de infraestrutura", endpoint: "/api/infrastructure_assets", fields: [{ name: "kind", label: "Tipo" }, { name: "name", label: "Nome" }, { name: "provider", label: "Provedor", required: false }, { name: "project_id", label: "Projeto (ID)", required: false }, { name: "client_id", label: "Cliente (ID)", required: false }, { name: "expires_on", label: "Vencimento", type: "date", required: false }, { name: "cost", label: "Custo", type: "number", required: false }, { name: "client_price", label: "Valor cobrado do cliente", type: "number", required: false }, { name: "responsible", label: "Responsável", required: false }] };
Object.assign(createConfig, { alteracao: configs.alteracao, entrega: configs.entrega, infraestrutura: configs.infraestrutura });
const esc = (value) => escapeHtml(value ?? "");
const recordCreateKind = { aprovacoes: "aprovacao", briefings: "briefing", alteracoes: "alteracao", entregas: "entrega", infraestrutura: "infraestrutura", "contas-a-pagar": "payable", "contas-bancarias": "bank_account", "notas-fiscais": "invoice", formularios: "form", "base-de-conhecimento": "knowledge_article", metas: "team_goal", ausencias: "absence", comissoes: "commission", horas: "time_entry" };
async function prepareStructuredCreate(kind) { const config = createConfig[kind]; if (!config) return; const relationFields = config.fields.filter((field) => ["client_id", "project_id", "task_id", "user_id"].includes(field.name)); if (!relationFields.length) return openCreateDialog(kind); const [clientData, projectData, taskData, teamData] = await Promise.all([relationFields.some((field) => field.name === "client_id") ? api("/api/clients") : Promise.resolve({ clients: [] }), relationFields.some((field) => field.name === "project_id") ? api("/api/projects") : Promise.resolve({ projects: [] }), relationFields.some((field) => field.name === "task_id") ? api("/api/tasks") : Promise.resolve({ tasks: [] }), relationFields.some((field) => field.name === "user_id") ? api("/api/team") : Promise.resolve({ users: [] })]); const clients = clientData.clients || [], projects = projectData.projects || [], tasks = taskData.tasks || [], users = teamData.users || []; relationFields.forEach((field) => { field.type = "select"; const source = field.name === "client_id" ? clients : field.name === "project_id" ? projects : field.name === "task_id" ? tasks : users; const empty = field.name === "client_id" ? "Sem cliente" : field.name === "project_id" ? "Sem projeto" : field.name === "task_id" ? "Sem tarefa" : "Selecione o membro"; field.options = [["", empty], ...source.map((item) => [item.id, item.name || item.title || `#${item.id}`])]; }); openCreateDialog(kind); }
async function renderEstrutura(key) {
  const [title, table, primary] = labels[key];
  dashboardGrid.innerHTML = `<section class="page-intro"><div><p class="card-kicker">Operação integrada</p><h2>${title}</h2><p>${key === "auditoria" ? "Registro de alterações, acessos e ações administrativas." : key === "lixeira" ? "Registros removidos com prazo para restauração." : "Dados vinculados por cliente, projeto e organização."}</p></div>${recordCreateKind[key] ? `<button class="button button-primary compact-action" data-new>+ Novo</button>` : ""}</section>${stateBlock.loading("Carregando...")}`;
  try {
    const data = await api(table === "team" ? "/api/team" : `/api/${table}`); const rows = data[table] || data.users || [];
    dashboardGrid.innerHTML = `<section class="page-intro"><div><p class="card-kicker">Operação integrada</p><h2>${title}</h2></div>${recordCreateKind[key] ? `<button class="button button-primary compact-action" data-new>+ Novo</button>` : ""}</section><section class="data-card automation-list">${rows.map((row) => `<article><strong>${esc(row[primary] || row.name || row.id)}</strong><span>${esc(row.status || row.entity_type || row.kind || "Registro")}</span><small>${esc(row.created_at ? new Date(row.created_at).toLocaleString("pt-BR") : "")}</small></article>`).join("") || stateBlock.empty(`Nenhum registro em ${title.toLowerCase()}`, "Os registros criados aparecerão aqui.", recordCreateKind[key] ? "Criar agora" : "", recordCreateKind[key] ? "structured-empty-action" : "")}</section>`;
    dashboardGrid.querySelector("[data-new]")?.addEventListener("click", () => prepareStructuredCreate(recordCreateKind[key]));
    dashboardGrid.querySelector(".structured-empty-action")?.addEventListener("click", () => prepareStructuredCreate(recordCreateKind[key]));
  } catch (error) { dashboardGrid.innerHTML = stateBlock.error(error.message, "estrutura-retry"); }
}
const approvalActionsObserver = new MutationObserver(async () => {
  if (location.hash.replace(/^#/, "") !== "aprovacoes") return;
  const list = dashboardGrid.querySelector(".automation-list");
  if (!list || list.dataset.approvalActions === "1") return;
  list.dataset.approvalActions = "1";
  try {
    const rows = (await api("/api/approvals")).approvals || [];
    list.querySelectorAll("article").forEach((article, index) => {
      const approval = rows[index];
      if (!approval || approval.status !== "pending") return;
      const actions = document.createElement("div"); actions.className = "approval-actions";
      [ ["approved", "Aprovar", "success"], ["rejected", "Recusar", "danger"] ].forEach(([status, label, kind]) => { const button = document.createElement("button"); button.type = "button"; button.className = `compact-action ${kind}`; button.textContent = label; button.addEventListener("click", async () => { button.disabled = true; try { await api(`/api/approvals/${approval.id}`, { method: "PATCH", body: { status, decision: status, decided_at: new Date().toISOString() } }); toast(status === "approved" ? "Aprovação registrada." : "Recusa registrada.", status === "approved" ? "success" : "info"); renderEstrutura("aprovacoes"); } catch (error) { button.disabled = false; toast(error.message, "error"); } }); actions.append(button); }); article.append(actions);
    });
  } catch {}
});
approvalActionsObserver.observe(dashboardGrid, { childList: true, subtree: true });
const briefingLinkObserver = new MutationObserver(async () => {
  if (location.hash.replace(/^#/, "") !== "briefings") return;
  const list = dashboardGrid.querySelector(".automation-list");
  if (!list || list.dataset.briefingLinks === "1") return;
  list.dataset.briefingLinks = "1";
  try {
    const rows = (await api("/api/briefings")).briefings || [];
    list.querySelectorAll("article").forEach((article, index) => {
      const briefing = rows[index]; if (!briefing || briefing.status === "answered") return;
      const button = document.createElement("button"); button.type = "button"; button.className = "compact-action"; button.textContent = briefing.public_token ? "Copiar link" : "Gerar link";
      button.addEventListener("click", async () => { button.disabled = true; try { const data = briefing.public_token ? { path: `/briefing/${briefing.public_token}` } : await (await fetch(`/api/briefings/${briefing.id}/public-link`, { method: "POST", credentials: "same-origin" })).json(); if (!data.path) throw new Error(data.error || "Não foi possível gerar o link."); await navigator.clipboard?.writeText(`${location.origin}${data.path}`); button.textContent = "Link copiado"; toast("Link do briefing copiado.", "success"); } catch (error) { button.disabled = false; toast(error.message, "error"); } }); article.append(button);
    });
  } catch {}
});
briefingLinkObserver.observe(dashboardGrid, { childList: true, subtree: true });
const formLinkObserver = new MutationObserver(async () => {
  if (location.hash.replace(/^#/, "") !== "formularios") return;
  const list = dashboardGrid.querySelector(".automation-list");
  if (!list || list.dataset.formLinks === "1") return;
  list.dataset.formLinks = "1";
  try {
    const rows = (await api("/api/forms")).forms || [];
    list.querySelectorAll("article").forEach((article, index) => {
      const form = rows[index]; if (!form) return;
      const button = document.createElement("button"); button.type = "button"; button.className = "compact-action"; button.textContent = form.public_token ? "Copiar link" : "Gerar link";
      button.addEventListener("click", async () => { button.disabled = true; try { const data = form.public_token ? { path: `/form/${form.public_token}` } : await (await fetch(`/api/forms/${form.id}/public-link`, { method: "POST", credentials: "same-origin" })).json(); if (!data.path) throw new Error(data.error || "Não foi possível gerar o link."); await navigator.clipboard?.writeText(`${location.origin}${data.path}`); button.textContent = "Link copiado"; toast("Link do formulário copiado.", "success"); } catch (error) { button.disabled = false; toast(error.message, "error"); } }); article.append(button);
    });
  } catch {}
});
formLinkObserver.observe(dashboardGrid, { childList: true, subtree: true });
const operationActionObserver = new MutationObserver(async () => {
  const key = location.hash.replace(/^#/, "");
  if (!["alteracoes", "entregas"].includes(key)) return;
  const list = dashboardGrid.querySelector(".automation-list");
  if (!list || list.dataset.operationActions === "1") return;
  list.dataset.operationActions = "1";
  const table = key === "alteracoes" ? "change_requests" : "deliveries";
  try {
    const rows = (await api(`/api/${table}`))[table] || [];
    list.querySelectorAll("article").forEach((article, index) => {
      const item = rows[index]; if (!item) return;
      const actions = document.createElement("div"); actions.className = "operation-actions";
      const choices = key === "alteracoes" && item.status === "pending" ? [["approved", "Aprovar"], ["rejected", "Recusar"]] : key === "entregas" && !item.client_approved ? [["approved", "Registrar aprovação"]] : [];
      choices.forEach(([status, label]) => { const button = document.createElement("button"); button.type = "button"; button.className = "compact-action"; button.textContent = label; button.addEventListener("click", async () => { button.disabled = true; try { const body = key === "entregas" ? { client_approved: true, status: "approved" } : { status, approval_data: { decision: status, decided_at: new Date().toISOString() } }; await api(`/api/${table}/${item.id}`, { method: "PATCH", body }); toast("Atualização registrada.", "success"); renderEstrutura(key); } catch (error) { button.disabled = false; toast(error.message, "error"); } }); actions.append(button); });
      if (actions.children.length) article.append(actions);
    });
  } catch {}
});
operationActionObserver.observe(dashboardGrid, { childList: true, subtree: true });
registerRoutes(Object.fromEntries(Object.keys(labels).map((key) => [key, () => renderEstrutura(key)])));

/* A lista estruturada também precisa permitir manutenção dos registros. */
const structuredMutationObserver = new MutationObserver(async () => {
  const key = location.hash.replace(/^#/, "");
  const kind = recordCreateKind[key];
  if (!kind || ["auditoria", "lixeira"].includes(key)) return;
  const list = dashboardGrid.querySelector(".automation-list");
  if (!list || list.dataset.maintenanceActions === "1") return;
  list.dataset.maintenanceActions = "1";
  try {
    const table = labels[key][1], rows = ((await api(`/api/${table}`))[table] || []);
    list.querySelectorAll("article").forEach((article, index) => {
      const row = rows[index]; if (!row) return;
      const actions = document.createElement("span"); actions.className = "structured-actions";
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
      if (key === "contas-a-pagar" && !["paid", "cancelled"].includes(row.status)) { const pay = document.createElement("button"); pay.type = "button"; pay.className = "compact-action"; pay.textContent = "Registrar pagamento"; pay.addEventListener("click", async () => { pay.disabled = true; try { await api(`/api/payables/${row.id}/record-payment`, { method: "POST", body: {} }); ui.toast("Pagamento registrado como despesa.", "success"); renderEstrutura(key); } catch (error) { pay.disabled = false; ui.toast(error.message, "error"); } }); actions.append(pay); }
      if (key === "contas-bancarias") { const movement = document.createElement("button"); movement.type = "button"; movement.className = "compact-action"; movement.textContent = "Movimentar"; movement.addEventListener("click", () => ui.form({ title: `Movimentar · ${row.name}`, subtitle: "Conta bancária", fields: [{ name: "kind", label: "Tipo", type: "select", options: [["credit", "Entrada"], ["debit", "Saída"]] }, { name: "amount", label: "Valor", type: "number", min: 0.01, step: 0.01 }, { name: "description", label: "Descrição" }], onSubmit: async (values) => { await api(`/api/bank_accounts/${row.id}/transactions`, { method: "POST", body: values }); ui.toast("Movimentação registrada.", "success"); renderEstrutura(key); } })); actions.append(movement); }
      article.append(actions);
    });
  } catch {}
});
structuredMutationObserver.observe(dashboardGrid, { childList: true, subtree: true });

const trashRestoreObserver = new MutationObserver(async () => {
  if (location.hash.replace(/^#/, "") !== "lixeira") return;
  const list = dashboardGrid.querySelector(".automation-list");
  if (!list || list.dataset.restoreActions === "1") return;
  list.dataset.restoreActions = "1";
  try {
    const rows = (await api("/api/trash")).trash || [];
    list.querySelectorAll("article").forEach((article, index) => {
      const item = rows[index]; if (!item) return;
      const button = document.createElement("button"); button.type = "button"; button.className = "compact-action"; button.textContent = "Restaurar";
      button.addEventListener("click", async () => { button.disabled = true; try { await api(`/api/trash/${item.id}/restore`, { method: "POST", body: {} }); toast("Registro restaurado.", "success"); renderEstrutura("lixeira"); } catch (error) { button.disabled = false; toast(error.message, "error"); } });
      article.append(button);
    });
  } catch {}
});
trashRestoreObserver.observe(dashboardGrid, { childList: true, subtree: true });
