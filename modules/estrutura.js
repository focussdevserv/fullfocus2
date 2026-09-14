/* Telas dos recursos operacionais complementares do menu final. */
const labels = {
  aprovacoes: ["Aprovações", "approvals", "title"], briefings: ["Briefings", "briefings", "name"],
  "contas-a-pagar": ["Contas a pagar", "payables", "description"], "contas-bancarias": ["Contas bancárias", "bank_accounts", "name"],
  "notas-fiscais": ["Notas fiscais", "invoices", "number"], formularios: ["Formulários", "forms", "name"],
  "base-de-conhecimento": ["Base de conhecimento", "knowledge_articles", "title"], auditoria: ["Auditoria", "audit_events", "action"],
  lixeira: ["Lixeira", "trash", "entity_type"], comissoes: ["Comissões", "commissions", "description"],
  horas: ["Horas trabalhadas", "team", "name"], metas: ["Metas", "team_goals", "name"], ausencias: ["Ausências", "absences", "kind"],
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
};
configs.aprovacao.fields.push({ name: "status", label: "Status", type: "select", options: [["pending", "Pendente"], ["approved", "Aprovada"], ["rejected", "Recusada"], ["cancelled", "Cancelada"]] }, { name: "comment", label: "Comentário", type: "textarea", required: false });
Object.assign(createConfig, configs);
const esc = (value) => escapeHtml(value ?? "");
const recordCreateKind = { aprovacoes: "aprovacao", briefings: "briefing", "contas-a-pagar": "payable", "contas-bancarias": "bank_account", "notas-fiscais": "invoice", formularios: "form", "base-de-conhecimento": "knowledge_article", metas: "team_goal", ausencias: "absence" };
async function renderEstrutura(key) {
  const [title, table, primary] = labels[key];
  dashboardGrid.innerHTML = `<section class="page-intro"><div><p class="card-kicker">Operação integrada</p><h2>${title}</h2><p>${key === "auditoria" ? "Registro de alterações, acessos e ações administrativas." : key === "lixeira" ? "Registros removidos com prazo para restauração." : "Dados vinculados por cliente, projeto e organização."}</p></div>${recordCreateKind[key] ? `<button class="button button-primary compact-action" data-new>+ Novo</button>` : ""}</section>${stateBlock.loading("Carregando...")}`;
  try {
    const data = await api(table === "team" ? "/api/team" : `/api/${table}`); const rows = data[table] || data.users || [];
    dashboardGrid.innerHTML = `<section class="page-intro"><div><p class="card-kicker">Operação integrada</p><h2>${title}</h2></div>${recordCreateKind[key] ? `<button class="button button-primary compact-action" data-new>+ Novo</button>` : ""}</section><section class="data-card automation-list">${rows.map((row) => `<article><strong>${esc(row[primary] || row.name || row.id)}</strong><span>${esc(row.status || row.entity_type || row.kind || "Registro")}</span><small>${esc(row.created_at ? new Date(row.created_at).toLocaleString("pt-BR") : "")}</small></article>`).join("") || stateBlock.empty(`Nenhum registro em ${title.toLowerCase()}`, "Os registros criados aparecerão aqui.", recordCreateKind[key] ? "Criar agora" : "")}</section>`;
    dashboardGrid.querySelector("[data-new]")?.addEventListener("click", () => openCreateDialog(recordCreateKind[key]));
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
registerRoutes(Object.fromEntries(Object.keys(labels).map((key) => [key, () => renderEstrutura(key)])));
