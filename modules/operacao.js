/* Operação: telas reais de contratos, projetos, arquivos e tickets. */
const labels = { draft: "Rascunho", active: "Ativo", expired: "Expirado", cancelled: "Cancelado", planning: "Planejamento", paused: "Pausado", done: "Concluído", open: "Aberto", in_progress: "Em andamento", waiting: "Aguardando", low: "Baixa", medium: "Média", high: "Alta", urgent: "Urgente", lead: "Lead", quote: "Orçamento", awaiting_approval: "Aguardando aprovação", in_review: "Em revisão", awaiting_client: "Aguardando cliente", testing: "Em testes", published: "Publicado", maintenance: "Manutenção", sent: "Enviado", viewed: "Visualizado", awaiting_signature: "Aguardando assinatura", signed: "Assinado", near_expiry: "Perto de vencer", closed: "Encerrado" };
// Mesma lista aceita pela API (server/routes/operacao.js); usada no filtro e no formulário de projetos.
const projectStatuses = ["lead", "quote", "awaiting_approval", "planning", "active", "in_review", "awaiting_client", "testing", "done", "published", "maintenance", "cancelled", "paused"];
const esc = (v) => escapeHtml(v ?? "");
const operationDateFormatter = new Intl.DateTimeFormat("pt-BR");
const operationDateTimeFormatter = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });
const operationMoneyFormatter = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const date = (v) => { if (!v) return "—"; const value = new Date(v); return Number.isNaN(value.getTime()) ? "—" : operationDateFormatter.format(value); };
const dateTime = (v) => { if (!v) return "—"; const value = new Date(v); return Number.isNaN(value.getTime()) ? "—" : operationDateTimeFormatter.format(value); };
const money = (v) => operationMoneyFormatter.format(Number(v || 0));
const state = (kind, title, description = "") => kind === "loading" ? stateBlock.loading(title) : kind === "error" ? stateBlock.error(title, "operations-retry") : stateBlock.empty(title, description, "Criar agora", "operations-empty-action");
let clients = [];
const config = {
  contrato: { title: "Novo contrato", endpoint: "/api/contracts", fields: [{ name: "name", label: "Nome", required: true }, { name: "client_id", label: "Cliente", type: "select", options: [] }, { name: "value", label: "Valor", type: "number" }, { name: "starts_on", label: "Início", type: "date" }, { name: "ends_on", label: "Fim", type: "date" }, { name: "status", label: "Status", type: "select", options: Object.entries({ draft: "Rascunho", in_review: "Em revisão", sent: "Enviado", viewed: "Visualizado", awaiting_signature: "Aguardando assinatura", signed: "Assinado", active: "Ativo", near_expiry: "Próximo do vencimento", closed: "Encerrado", cancelled: "Cancelado", expired: "Expirado" }) } ] },
  projeto: { title: "Novo projeto", endpoint: "/api/projects", fields: [{ name: "name", label: "Nome" }, { name: "client_id", label: "Cliente", type: "select", options: [] }, { name: "contract_id", label: "Contrato (ID)", required: false }, { name: "status", label: "Status", type: "select", options: Object.entries({ planning: "Planejamento", active: "Ativo", paused: "Pausado", done: "Concluído" }) }, { name: "progress", label: "Progresso", type: "number" }] },
  arquivo: { title: "Adicionar arquivo", endpoint: "/api/files", fields: [{ name: "name", label: "Nome" }, { name: "url", label: "URL externa", type: "url" }, { name: "kind", label: "Tipo", type: "select", options: [["document", "Documento"], ["image", "Imagem"], ["video", "Vídeo"], ["code", "Código"], ["backup", "Backup"], ["other", "Outro"]] }, { name: "project_id", label: "Projeto (ID)", required: false }, { name: "client_id", label: "Cliente", type: "select", options: [] }] },
  ticket: { title: "Novo ticket", endpoint: "/api/tickets", fields: [{ name: "title", label: "Título" }, { name: "description", label: "Descrição", required: false }, { name: "client_id", label: "Cliente", type: "select", options: [] }, { name: "priority", label: "Prioridade", type: "select", options: Object.entries({ low: "Baixa", medium: "Média", high: "Alta", urgent: "Urgente" }) }, { name: "status", label: "Status", type: "select", options: Object.entries({ open: "Aberto", in_progress: "Em andamento", waiting: "Aguardando", done: "Concluído" }) }, { name: "due_at", label: "Prazo", type: "datetime-local", required: false }] }
};
Object.assign(createConfig, config);
config.arquivo.fields.find((field) => field.name === "url").required = false;
config.arquivo.fields.push({ name: "file", label: "Ou envie um arquivo (até 750 KB)", type: "file", required: false });
document.addEventListener("submit", async (event) => {
  const form = event.target;
  const routeAtStart = window.location.hash;
  const fileInput = form?.id === "create-dialog-form" ? form.querySelector("input[type=file]") : null;
  if (!fileInput?.files?.[0]) return;
  event.preventDefault(); event.stopImmediatePropagation();
  const file = fileInput.files[0], submit = form.querySelector("[type=submit]"), status = form.querySelector("[data-dialog-status]") || document.querySelector("#dialog-status");
  if (file.size > 750000) { if (status) { status.textContent = "O arquivo deve ter no máximo 750 KB."; status.setAttribute("role", "alert"); status.setAttribute("aria-live", "assertive"); } fileInput.focus(); return; }
  if (submit) submit.disabled = true; submit?.setAttribute("aria-busy", "true"); if (status) { status.textContent = "Enviando arquivo…"; status.setAttribute("role", "status"); status.setAttribute("aria-live", "polite"); }
  try {
    const reader = new FileReader();
    const dataUrl = await new Promise((resolve, reject) => { reader.onload = () => resolve(reader.result); reader.onerror = () => reject(new Error("Não foi possível ler o arquivo.")); reader.readAsDataURL(file); });
    const payload = Object.fromEntries(new FormData(form)); payload.file = undefined; payload.url = dataUrl; Object.keys(payload).forEach((key) => { if (payload[key] === "" || payload[key] === undefined) delete payload[key]; });
    const response = await fetch(form.dataset.endpoint || "/api/files", { method: form.dataset.method || "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const data = response.status === 204 ? {} : await response.json(); if (!response.ok) throw new Error(data.error || "Não foi possível salvar o arquivo.");
    if (window.location.hash !== routeAtStart || !form.isConnected) return;
    closeCreateDialog(); renderHashRoute(window.location.hash); toast("Arquivo enviado com sucesso.", "success");
  } catch (error) { if (status) { status.textContent = error.message || "Não foi possível enviar o arquivo. Tente novamente."; status.setAttribute("role", "alert"); status.setAttribute("aria-live", "assertive"); } fileInput.focus(); }
  finally { if (form.isConnected && submit) submit.disabled = false; if (form.isConnected) submit?.removeAttribute("aria-busy"); }
}, true);
const projectContractField = config.projeto.fields.find((field) => field.name === "contract_id");
const projectState = { query: "", status: "", view: (() => { try { return localStorage.getItem("focusdev_projects_view") || "list"; } catch { return "list"; } })(), request: 0 };
if (projectContractField) { projectContractField.type = "select"; projectContractField.options = [["", "Sem contrato"]]; }
config.contrato.fields.push({ name: "proposal_id", label: "Proposta aprovada (ID)", required: false }, { name: "project_id", label: "Projeto vinculado (ID)", required: false }, { name: "contract_type", label: "Tipo de contrato", required: false }, { name: "contract_number", label: "Número do contrato", required: false }, { name: "issued_on", label: "Data de emissão", type: "date", required: false }, { name: "description", label: "Objeto e descrição", required: false }, { name: "scope_included", label: "Escopo incluído", required: false }, { name: "scope_excluded", label: "Escopo não incluído", required: false }, { name: "deliverables", label: "Entregáveis", required: false }, { name: "technologies", label: "Tecnologias", required: false }, { name: "milestones", label: "Etapas e cronograma", required: false }, { name: "installments", label: "Quantidade de parcelas", type: "number", required: false }, { name: "installment_value", label: "Valor das parcelas", type: "number", required: false }, { name: "payment_method", label: "Forma de pagamento", required: false }, { name: "payment_due_dates", label: "Datas de vencimento", required: false }, { name: "maintenance_monthly", label: "Manutenção mensal", type: "number", required: false }, { name: "hosting_monthly", label: "Hospedagem mensal", type: "number", required: false }, { name: "server_monthly", label: "Servidor/VPS mensal", type: "number", required: false }, { name: "domain_monthly", label: "Domínio mensal", type: "number", required: false }, { name: "apis_monthly", label: "APIs mensal", type: "number", required: false }, { name: "licenses_monthly", label: "Licenças mensal", type: "number", required: false }, { name: "warranty_period", label: "Garantia", required: false }, { name: "support_period", label: "Suporte", required: false }, { name: "intellectual_property", label: "Propriedade intelectual", required: false }, { name: "cancellation_terms", label: "Cancelamento e rescisão", required: false }, { name: "data_protection_terms", label: "Proteção de dados/LGPD", required: false });
const proposalField = config.contrato.fields.find((field) => field.name === "proposal_id");
if (proposalField) { proposalField.type = "select"; proposalField.options = [["", "Selecione uma proposta aprovada"]]; }
config.projeto.fields.push(
  { name: "description", label: "Descrição", required: false },
  { name: "current_stage", label: "Etapa atual", required: false },
  { name: "starts_on", label: "Data de início", type: "date", required: false },
  { name: "due_on", label: "Prazo previsto", type: "date", required: false },
  { name: "next_action", label: "Próxima ação", required: false },
  { name: "next_action_at", label: "Data da próxima ação", type: "datetime-local", required: false },
  { name: "technologies", label: "Tecnologias", required: false },
  { name: "repository_url", label: "Repositório GitHub", type: "url", required: false, githubAutoFill: true },
  { name: "development_url", label: "Link de desenvolvimento", type: "url", required: false },
  { name: "staging_url", label: "Link de homologação", type: "url", required: false },
  { name: "production_url", label: "Link de produção", type: "url", required: false },
  { name: "domain", label: "Domínio", required: false },
  { name: "hosting_provider", label: "Provedor de hospedagem", required: false },
  { name: "database_provider", label: "Banco/Firebase/Supabase", required: false },
  { name: "external_apis", label: "APIs e serviços externos", required: false },
  { name: "access_storage_reference", label: "Onde os acessos estão guardados", placeholder: "Ex.: 1Password do cliente", required: false },
  { name: "total_value", label: "Valor total", type: "number", required: false },
  { name: "down_payment", label: "Valor de entrada", type: "number", required: false },
  { name: "payment_status", label: "Situação do pagamento", required: false },
  { name: "pending_items", label: "Pendências", required: false },
  { name: "observations", label: "Observações", required: false }
);
config.ticket.fields.splice(3, 0, { name: "project_id", label: "Projeto", type: "select", options: [["", "Sem projeto"]], required: false });
async function setup(kind) { const c = config[kind]; if (c.fields.some((f) => f.name.endsWith("_id"))) { const [clientData, contractData, proposalData, projectData] = await Promise.all([api("/api/clients"), kind === "projeto" ? api("/api/contracts") : Promise.resolve({ contracts: [] }), kind === "contrato" ? api("/api/proposals") : Promise.resolve({ proposals: [] }), ["ticket", "arquivo"].includes(kind) ? api("/api/projects") : Promise.resolve({ projects: [] })]); clients = clientData.clients || []; c.fields.forEach((f) => { if (f.name === "client_id") f.options = [["", "Sem cliente"], ...clients.map((x) => [x.id, x.name])]; if (f.name === "contract_id" && f.type === "select") f.options = [["", "Sem contrato"], ...(contractData.contracts || []).map((x) => [x.id, x.name])]; if (f.name === "project_id" && f.type === "select") f.options = [["", "Sem projeto"], ...(projectData.projects || []).map((x) => [x.id, x.name])]; if (f.name === "proposal_id" && f.type === "select") { const proposals = (proposalData.proposals || []).filter((x) => x.status === "accepted"); f.options = [["", proposals.length ? "Selecione uma proposta aprovada" : "Nenhuma proposta aprovada"], ...proposals.map((x) => [x.id, `${x.title || "Proposta"} · ${money(x.amount)}`])]; } }); } openCreateDialog(kind); }
function intro(title, description, kind) { return `<section class="page-intro operations-intro"><div><p class="card-kicker">Operação</p><h2>${title}</h2><p>${description}</p></div><button class="button button-primary compact-action operations-new" data-create="${kind}" type="button">+ Novo</button></section>`; }
function bindCommon(kind, rows, endpoint) { dashboardGrid.querySelector(".operations-new")?.addEventListener("click", () => { const routeAtStart = location.hash; setup(kind).catch((error) => { if (location.hash === routeAtStart) ui.toast(error.message, "error"); }); }); dashboardGrid.querySelectorAll("[data-delete]").forEach((b) => b.addEventListener("click", () => ui.confirmInline(b, { text: "Excluir?", onConfirm: async () => { const originalLabel = b.textContent; b.disabled = true; b.setAttribute("aria-busy", "true"); b.textContent = "Excluindo…"; try { await api(`${endpoint}/${b.dataset.delete}`, { method: "DELETE" }); ui.toast("Registro excluído.", "success"); renderHashRoute(); } catch (error) { b.disabled = false; b.removeAttribute("aria-busy"); b.textContent = originalLabel; ui.toast(error.message, "error"); } } }))); dashboardGrid.querySelectorAll("[data-edit]").forEach((b) => b.addEventListener("click", () => { const item = rows.find((x) => String(x.id) === b.dataset.edit); if (!item) return; const routeAtStart = location.hash; setup(kind).then(() => { if (location.hash !== routeAtStart) return; openEditDialog(kind, item, `${endpoint}/${item.id}`); }).catch((error) => { if (location.hash === routeAtStart) ui.toast(error.message, "error"); }); })); }
const contractsState = { search: "", status: "", request: 0 };
const contractTone = (status) => ({ active: "green", signed: "green", awaiting_signature: "orange", near_expiry: "orange", sent: "blue", viewed: "blue", in_review: "blue", draft: "gray", closed: "gray", cancelled: "red", expired: "red" }[status] || "gray");
async function renderContracts() {
  if (location.hash !== "#contratos") return;
  const request = contractsState.request = (contractsState.request || 0) + 1;
  const restoreFocus = ui.keepSearchFocus(dashboardGrid);
  const title = "Contratos", description = "Controle vigências, valores e o relacionamento com cada cliente.";
  dashboardGrid.setAttribute("aria-busy", "true");
  dashboardGrid.innerHTML = intro(title, description, "contrato") + state("loading", "Carregando contratos…");
  try {
    const d = await api("/api/contracts"), rows = d.contracts || [];
    if (request !== contractsState.request || location.hash !== "#contratos") return;
    const now = Date.now(), in30 = now + 30 * 864e5;
    const soon = (x) => x.ends_on && new Date(x.ends_on).getTime() >= now && new Date(x.ends_on).getTime() <= in30 && !["closed", "cancelled", "expired"].includes(x.status);
    const term = contractsState.search.trim().toLowerCase();
    const filtered = rows.filter((x) => (!contractsState.status || x.status === contractsState.status) && (!term || [x.name, x.client_name, x.contract_number, x.description].some((v) => String(v || "").toLowerCase().includes(term))));
    const active = rows.filter((x) => ["active", "signed"].includes(x.status));
    const stats = ui.stats([
      { label: "Contratos", value: ui.number(rows.length), note: `${ui.number(filtered.length)} na lista` },
      { label: "Ativos", value: ui.number(active.length), note: ui.money(active.reduce((sum, x) => sum + Number(x.value || 0), 0)), tone: "green" },
      { label: "Aguardando assinatura", value: ui.number(rows.filter((x) => ["sent", "viewed", "awaiting_signature"].includes(x.status)).length), tone: "orange" },
      { label: "Vencem em 30 dias", value: ui.number(rows.filter(soon).length), note: ui.money(rows.filter(soon).reduce((sum, x) => sum + Number(x.value || 0), 0)), tone: rows.some(soon) ? "red" : undefined },
    ]);
    const statusOptions = [["", "Todos os status"], ...Object.entries({ draft: "Rascunho", in_review: "Em revisão", sent: "Enviado", viewed: "Visualizado", awaiting_signature: "Aguardando assinatura", signed: "Assinado", active: "Ativo", near_expiry: "Próximo do vencimento", closed: "Encerrado", cancelled: "Cancelado", expired: "Expirado" })];
    const toolbar = ui.toolbar({ search: { value: contractsState.search, placeholder: "Buscar contrato, cliente ou número…" }, filters: [{ key: "status", label: "Status", value: contractsState.status, options: statusOptions }], actions: ui.button({ label: "Exportar CSV", kind: "secondary", attr: "data-contracts-csv" }) });
    const table = ui.table({
      columns: [
        { key: "name", label: "Contrato", render: (x) => `${esc(x.name)}${x.contract_number ? `<small>Nº ${esc(x.contract_number)}</small>` : ""}${soon(x) ? "<b>Vence em até 30 dias</b>" : ""}` },
        { key: "client_name", label: "Cliente", render: (x) => esc(x.client_name || "Sem cliente") },
        { key: "value", label: "Valor", align: "right", render: (x) => money(x.value) },
        { key: "starts_on", label: "Vigência", hideOnNarrow: true, render: (x) => `${date(x.starts_on)} — ${date(x.ends_on)}` },
        { key: "status", label: "Status", render: (x) => ui.badge(labels[x.status] || x.status || "—", contractTone(x.status)) },
        { key: "actions", label: "Ações", render: (x) => `<button class="compact-action" data-contract-details="${x.id}" type="button">Detalhes</button><button class="compact-action" data-edit="${x.id}" type="button">Editar</button><button class="compact-action" data-delete="${x.id}" type="button">Excluir</button>` },
      ],
      rows: filtered,
      rowAttr: (x) => `data-contract-row="${esc(x.id)}"`,
      empty: rows.length ? "Nenhum contrato corresponde à busca." : "",
    });
    dashboardGrid.innerHTML = intro(title, description, "contrato") + stats + `<section class="data-card operations-table">${toolbar}${rows.length ? table : state("empty", "Nenhum contrato", "Comece cadastrando o primeiro contrato.")}</section>`;
    dashboardGrid.removeAttribute("aria-busy");
    dashboardGrid.querySelector("[data-search]")?.addEventListener("input", (event) => { contractsState.search = event.target.value; clearTimeout(contractsState.timer); contractsState.timer = setTimeout(() => renderContracts().then(restoreFocus), 220); });
    dashboardGrid.querySelector("[data-filter=status]")?.addEventListener("change", (event) => { contractsState.status = event.target.value; renderContracts(); });
    dashboardGrid.querySelector("[data-contracts-csv]")?.addEventListener("click", () => ui.downloadCsv("contratos.csv", ["Contrato", "Cliente", "Valor", "Início", "Fim", "Status"], filtered.map((x) => [x.name, x.client_name || "", Number(x.value || 0).toFixed(2), x.starts_on || "", x.ends_on || "", labels[x.status] || x.status || ""])));
    dashboardGrid.querySelectorAll("[data-contract-details]").forEach((button) => button.addEventListener("click", () => openContractDetails(rows.find((x) => String(x.id) === button.dataset.contractDetails))));
    bindCommon("contrato", rows, "/api/contracts");
  } catch (e) { if (location.hash !== "#contratos") return; dashboardGrid.removeAttribute("aria-busy"); dashboardGrid.innerHTML = intro(title, description, "contrato") + state("error", e.message); }
}
dashboardGrid.addEventListener("click", (event) => {
  if (location.hash !== "#contratos") return;
  const button = event.target.closest?.("[data-contracts-csv]");
  if (!button) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  const rows = [...dashboardGrid.querySelectorAll(".operations-table tbody tr")].filter((row) => !row.hidden);
  ui.downloadCsv("contratos.csv", ["Contrato", "Cliente", "Valor", "Vigência", "Status"], rows.map((row) => [...row.cells].slice(0, 5).map((cell) => cell.textContent.trim())));
}, true);

function openContractDetails(contract) {
  if (!contract) return;
  const facts = ui.facts([
    ["Cliente", contract.client_name || "Sem cliente"], ["Valor", money(contract.value)], ["Status", labels[contract.status] || contract.status],
    ["Início", date(contract.starts_on)], ["Fim", date(contract.ends_on)], ["Número", contract.contract_number], ["Tipo", contract.contract_type],
    ["Parcelas", contract.installments], ["Entrada", contract.down_payment ? money(contract.down_payment) : ""], ["Assinado em", contract.signed_at ? dateTime(contract.signed_at) : ""],
    ["Criado em", contract.created_at ? dateTime(contract.created_at) : ""],
  ]);
  const text = (label, value) => value ? `<section><h3>${esc(label)}</h3><p>${esc(value)}</p></section>` : "";
  ui.drawer({
    title: contract.name, subtitle: "Contrato",
    html: `${facts}${text("Descrição", contract.description)}${text("Escopo incluído", contract.scope_included)}${text("Escopo excluído", contract.scope_excluded)}${text("Entregáveis", contract.deliverables)}<section><h3>Fluxo</h3><div class="ui-header-actions" style="justify-content:flex-start"><button class="compact-action" type="button" data-contract-link>Link de assinatura</button><button class="compact-action" type="button" data-contract-project>Gerar projeto</button><button class="compact-action" type="button" data-contract-receivables>Gerar recebíveis</button></div><p class="ui-empty-inline" data-contract-flow-status hidden></p></section>`,
    onOpen: (body) => {
      const status = body.querySelector("[data-contract-flow-status]");
      const say = (message, error = false) => { status.hidden = false; status.textContent = message; status.style.color = error ? "#ff8a97" : ""; };
      const run = async (button, work) => { const label = button.textContent; button.disabled = true; button.setAttribute("aria-busy", "true"); button.textContent = "Processando…"; try { await work(); } catch (error) { say(error.message, true); } finally { button.disabled = false; button.removeAttribute("aria-busy"); button.textContent = label; } };
      body.querySelector("[data-contract-link]").addEventListener("click", (event) => run(event.currentTarget, async () => { const data = await api(`/api/contracts/${contract.id}/public-link`, { method: "POST", body: {} }); const url = `${location.origin}${data.path}`; await ui.copyText(url); say(`Link copiado: ${url}`); ui.toast("Link de assinatura gerado.", "success"); }));
      body.querySelector("[data-contract-project]").addEventListener("click", (event) => run(event.currentTarget, async () => { const data = await api(`/api/contracts/${contract.id}/create-project`, { method: "POST", body: {} }); say(data.created === false ? `Este contrato já tem o projeto "${data.project?.name || ""}".` : `Projeto "${data.project?.name || ""}" criado.`); ui.toast(data.created === false ? "Projeto já existia." : "Projeto criado a partir do contrato.", data.created === false ? "info" : "success"); }));
      body.querySelector("[data-contract-receivables]").addEventListener("click", (event) => run(event.currentTarget, async () => { const data = await api(`/api/contracts/${contract.id}/create-receivables`, { method: "POST", body: {} }); const count = (data.receivables || []).length; say(data.created === false ? `Os ${count} recebíveis deste contrato já existiam.` : `${count} recebível(is) gerado(s) em Contas a receber.`); ui.toast(data.created === false ? "Recebíveis já existiam." : "Recebíveis gerados.", data.created === false ? "info" : "success"); }));
    },
  });
}
// Compatibilidade com o roteador legado: as telas atuais vivem nos módulos dedicados.
async function renderProjects() { return renderProjectsConnected(); }
async function renderFiles() { location.hash = "#arquivos"; }
async function renderTickets() { return renderTicketsScreen(); }
const CONTRACT_ROW_ACTIONS = false;
const contractProjectObserver = new MutationObserver(async () => {
  const pendingProposal = sessionStorage.getItem("focusdev.contractProposalId");
  if (location.hash === "#contratos" && pendingProposal && !document.querySelector("[data-contract-fill]")) {
    sessionStorage.removeItem("focusdev.contractProposalId");
    await setup("contrato");
    const proposal = dialogFields.querySelector('[name="proposal_id"]');
    if (proposal) { proposal.value = pendingProposal; dialogFields.querySelector("[data-contract-fill]")?.click(); }
    return;
  }
  // As ações de fluxo (link de assinatura, projeto, recebíveis) vivem no painel "Detalhes" da tela de Contratos;
  // a injeção por índice de linha abaixo fica desativada: duplicava botões, quebrava com filtros e vazava
  // para as tabelas de Projetos/Arquivos/Tickets (mesma classe .operations-table).
  if (!CONTRACT_ROW_ACTIONS) return;
  const table = dashboardGrid.querySelector(".operations-table tbody");
  if (!table || table.dataset.projectActions === "1") return;
  table.dataset.projectActions = "1";
  try {
    const rows = (await api("/api/contracts")).contracts || [];
    table.querySelectorAll("tbody tr").forEach((row) => {
      const contract = rows.find((item) => String(item.id) === String(row.dataset.contractRow));
      if (!contract) return;
      const shareButton = document.createElement("button"); shareButton.className = "compact-action"; shareButton.type = "button"; shareButton.textContent = "Link para assinatura";
      shareButton.addEventListener("click", async () => { shareButton.disabled = true; shareButton.textContent = "Gerando…"; try { const data = await api(`/api/contracts/${contract.id}/public-link`, { method: "POST", body: {} }); const link = `${location.origin}${data.path}`; await ui.copyText(link); shareButton.textContent = "Link copiado"; toast("Link público do contrato copiado.", "success"); } catch (error) { shareButton.disabled = false; shareButton.textContent = "Link para assinatura"; toast(error.message, "error"); } });
      row.lastElementChild?.append(" ", shareButton);
      if (!contract.project_id && ["signed", "active"].includes(contract.status)) { const button = document.createElement("button"); button.className = "compact-action"; button.type = "button"; button.textContent = "Criar projeto";
        button.addEventListener("click", async () => { button.disabled = true; button.textContent = "Criando…"; try { await api(`/api/contracts/${contract.id}/create-project`, { method: "POST", body: {} }); toast("Projeto criado a partir do contrato.", "success"); location.hash = "#projetos"; } catch (error) { button.disabled = false; button.textContent = "Criar projeto"; toast(error.message, "error"); } });
        row.lastElementChild?.append(" ", button); }
      if (!["signed", "active"].includes(contract.status)) return;
      const receivablesButton = document.createElement("button"); receivablesButton.className = "compact-action"; receivablesButton.type = "button"; receivablesButton.textContent = "Gerar parcelas";
      receivablesButton.addEventListener("click", async () => { receivablesButton.disabled = true; receivablesButton.textContent = "Gerando…"; try { const result = await api(`/api/contracts/${contract.id}/create-receivables`, { method: "POST", body: {} }); toast(result.created ? "Parcelas geradas em Contas a receber." : "As parcelas deste contrato já existem.", "success"); } catch (error) { receivablesButton.disabled = false; receivablesButton.textContent = "Gerar parcelas"; toast(error.message, "error"); } });
      row.lastElementChild?.append(" ", receivablesButton);
    });
  } catch (error) { table.dataset.workspaceActions = ""; toast(error.message, "error"); }
});
contractProjectObserver.observe(dashboardGrid, { childList: true, subtree: true });
const trapOperationsDialogKey = (event, panel, close) => {
  if (event.key === "Escape") { close(); return; }
  if (event.key !== "Tab") return;
  const focusable = [...panel.querySelectorAll("button, input, select, textarea, a[href], [tabindex]:not([tabindex=\"-1\"])")].filter((element) => !element.disabled && element.getAttribute("aria-hidden") !== "true");
  if (!focusable.length) return;
  const first = focusable[0], last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
};

async function openProjectOverview(id) {
  const previouslyFocused = document.activeElement;
  const panel = document.createElement("aside"); panel.className = "conta-drawer conta-drawer-wide"; panel.setAttribute("role", "dialog"); panel.setAttribute("aria-modal", "true"); panel.setAttribute("aria-label", "Resumo do projeto"); panel.innerHTML = '<button class="conta-close" type="button" aria-label="Fechar resumo do projeto">×</button><p class="card-kicker">Projeto</p><h2>Carregando resumo…</h2><div class="conta-related">Carregando tarefas, arquivos e financeiro…</div>'; document.body.append(panel);
  const close = () => { panel.remove(); document.removeEventListener("keydown", onKey); if (previouslyFocused instanceof HTMLElement && previouslyFocused.isConnected) previouslyFocused.focus(); };
  const onKey = (event) => trapOperationsDialogKey(event, panel, close);
  document.addEventListener("keydown", onKey); panel.querySelector(".conta-close").onclick = close; panel.querySelector(".conta-close").focus();
  try { const data = await api(`/api/projects/${id}/overview`); if (!panel.isConnected) return; const project = data.project || {}; panel.querySelector("h2").textContent = project.name || "Projeto"; panel.querySelector(".conta-related").innerHTML = `<section><h3>Status e progresso</h3><p>${esc(labels[project.status] || project.status || "—")} · ${Number(project.progress || 0)}%</p><div class="operations-progress"><span style="width:${Math.max(0, Math.min(100, Number(project.progress) || 0))}%"></span></div></section><section><h3>Resumo</h3><p>Cliente: ${esc(project.client_name || "Sem cliente")}</p><p>Prazo: ${date(project.due_on)}</p><p>A receber: ${money(data.balance_receivable)}</p><p>Tarefas atrasadas: ${data.overdue_tasks || 0}</p></section><section><h3>Tarefas</h3>${data.tasks?.length ? data.tasks.map((item) => `<p>${esc(item.title)} · ${esc(labels[item.status] || item.status || "Pendente")}</p>`).join("") : "<p>Nenhuma tarefa vinculada.</p>"}</section><section><h3>Arquivos</h3>${data.files?.length ? data.files.map((item) => `<p>${esc(item.name)}</p>`).join("") : "<p>Nenhum arquivo vinculado.</p>"}</section>`; } catch (error) { if (panel.isConnected) panel.querySelector(".conta-related").textContent = error.message; }
}
const projectOverviewObserver = new MutationObserver(() => { if (location.hash !== "#projetos") return; const table = dashboardGrid.querySelector(".operations-table tbody"); if (!table || table.dataset.overviewActions === "1" || table.querySelector("[data-overview]")) return; table.dataset.overviewActions = "1"; table.querySelectorAll("tr").forEach((row, index) => { const projectId = row.querySelector("[data-edit]")?.dataset.edit; if (!projectId) return; const button = document.createElement("button"); button.type = "button"; button.className = "compact-action"; button.textContent = "Resumo"; button.addEventListener("click", () => openProjectOverview(projectId)); row.lastElementChild?.append(" ", button); }); });
projectOverviewObserver.observe(dashboardGrid, { childList: true, subtree: true });
const projectProgressObserver = new MutationObserver(() => {
  if (location.hash !== "#projetos") return;
  dashboardGrid.querySelectorAll(".operations-progress:not([role=progressbar])").forEach((bar) => {
    const valueText = bar.nextElementSibling?.textContent || "";
    const value = Math.max(0, Math.min(100, Number.parseFloat(valueText.replace(",", ".")) || 0));
    bar.setAttribute("role", "progressbar");
    bar.setAttribute("aria-valuemin", "0");
    bar.setAttribute("aria-valuemax", "100");
    bar.setAttribute("aria-valuenow", String(value));
    bar.setAttribute("aria-label", `Progresso do projeto: ${value}%`);
  });
});
projectProgressObserver.observe(dashboardGrid, { childList: true, subtree: true });
// Arquivos e tickets possuem workspaces dedicados; operação mantém contratos e projetos.
const projectTone = (status) => ({ active: "green", done: "green", published: "green", maintenance: "blue", in_review: "blue", testing: "blue", awaiting_client: "orange", awaiting_approval: "orange", quote: "orange", lead: "gray", planning: "gray", paused: "gray", cancelled: "red" }[status] || "gray");
const projectBoardGroups = [["lead", "Entrada"], ["quote", "Orçamento"], ["awaiting_approval", "Aprovação"], ["planning", "Planejamento"], ["active", "Em andamento"], ["in_review", "Revisão"], ["awaiting_client", "Aguardando cliente"], ["testing", "Testes"], ["done", "Concluídos"], ["published", "Publicados"], ["maintenance", "Manutenção"], ["paused", "Pausados"], ["cancelled", "Cancelados"]];
function projectActionMarkup(project) { return `<div class="project-card-actions"><button type="button" class="compact-action" data-overview="${esc(project.id)}">Resumo</button><button type="button" class="compact-action" data-workspace="${esc(project.id)}">Workspace</button><button type="button" class="compact-action" data-edit="${esc(project.id)}">Editar</button></div>`; }
function projectCardMarkup(project) { const value = Math.max(0, Math.min(100, Number(project.progress) || 0)); return `<article class="project-board-card"><div class="project-board-card-head"><strong>${esc(project.name)}</strong>${ui.badge(labels[project.status] || project.status || "—", projectTone(project.status))}</div><small>${esc(project.client_name || "Sem cliente")}${project.due_on ? ` · prazo ${date(project.due_on)}` : ""}</small><div class="operations-progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${value}" aria-label="Progresso: ${value}%"><span style="width:${value}%"></span></div><small>${value}% concluído${project.priority ? ` · ${esc(labels[project.priority] || project.priority)}` : ""}</small>${project.block_reason ? `<p class="project-blocked">Bloqueado: ${esc(project.block_reason)}</p>` : ""}${projectActionMarkup(project)}</article>`; }
function projectBoardMarkup(rows) { return `<div class="project-board">${projectBoardGroups.map(([status, title]) => { const items = rows.filter((project) => project.status === status); return `<section class="project-board-column" data-project-column="${status}"><header><h3>${title}</h3><span>${items.length}</span></header>${items.length ? items.map(projectCardMarkup).join("") : `<p class="operations-column-empty">Nenhum projeto</p>`}</section>`; }).join("")}</div>`; }
function projectTimelineMarkup(rows) { const sorted = [...rows].sort((a, b) => new Date(a.due_on || a.starts_on || "9999-12-31") - new Date(b.due_on || b.starts_on || "9999-12-31")); return `<div class="project-timeline">${sorted.length ? sorted.map((project) => { const value = Math.max(0, Math.min(100, Number(project.progress) || 0)); return `<article class="project-timeline-row"><div class="project-timeline-date"><strong>${date(project.starts_on)}</strong><span>até ${date(project.due_on)}</span></div><div class="project-timeline-main"><div class="project-board-card-head"><strong>${esc(project.name)}</strong>${ui.badge(labels[project.status] || project.status || "—", projectTone(project.status))}</div><small>${esc(project.client_name || "Sem cliente")} · ${value}% concluído</small><div class="operations-progress"><span style="width:${value}%"></span></div></div>${projectActionMarkup(project)}</article>`; }).join("") : `<p class="operations-column-empty">Nenhum projeto para exibir.</p>`}</div>`; }
function bindProjectBoardDragAndDrop() {
  const board = dashboardGrid.querySelector(".project-board");
  if (!board || board.dataset.dndBound === "1") return;
  board.dataset.dndBound = "1";
  let draggedId = null;
  board.querySelectorAll(".project-board-card").forEach((card) => {
    const id = card.querySelector("[data-overview]")?.dataset.overview;
    if (!id) return;
    card.draggable = true;
    card.setAttribute("aria-grabbed", "false");
    card.addEventListener("dragstart", (event) => {
      draggedId = id;
      card.classList.add("is-dragging");
      card.setAttribute("aria-grabbed", "true");
      event.dataTransfer?.setData("text/plain", id);
      if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
    });
    card.addEventListener("dragend", () => {
      draggedId = null;
      card.classList.remove("is-dragging");
      card.setAttribute("aria-grabbed", "false");
      board.querySelectorAll(".is-drop-target").forEach((column) => column.classList.remove("is-drop-target"));
    });
  });
  board.querySelectorAll("[data-project-column]").forEach((column) => {
    column.addEventListener("dragover", (event) => { if (!draggedId) return; event.preventDefault(); column.classList.add("is-drop-target"); if (event.dataTransfer) event.dataTransfer.dropEffect = "move"; });
    column.addEventListener("dragleave", (event) => { if (!column.contains(event.relatedTarget)) column.classList.remove("is-drop-target"); });
    column.addEventListener("drop", async (event) => {
      event.preventDefault();
      column.classList.remove("is-drop-target");
      const id = event.dataTransfer?.getData("text/plain") || draggedId;
      const status = column.dataset.projectColumn;
      if (!id || !status) return;
      const card = board.querySelector(`[data-overview="${CSS.escape(String(id))}"]`)?.closest(".project-board-card");
      if (card) { card.setAttribute("aria-busy", "true"); card.classList.add("is-saving"); }
      try { await api(`/api/projects/${id}`, { method: "PATCH", body: { status } }); ui.toast("Status do projeto atualizado.", "success"); await renderProjectsConnected(); }
      catch (error) { ui.toast(error.message || "NÃ£o foi possÃ­vel mover o projeto.", "error"); if (card) { card.removeAttribute("aria-busy"); card.classList.remove("is-saving"); } }
    });
  });
}
async function renderProjectsConnected() {
  if (location.hash !== "#projetos") return;
  const title = "Projetos", description = "Acompanhe progresso, status, clientes e contratos.";
  const requestId = ++projectState.request;
  const restoreFocus = ui.keepSearchFocus(dashboardGrid);
  dashboardGrid.setAttribute("aria-busy", "true");
  dashboardGrid.innerHTML = intro(title, description, "projeto") + state("loading", "Carregando projetos…");
  try {
    const params = new URLSearchParams(); if (projectState.query.trim()) params.set("search", projectState.query.trim()); if (projectState.status) params.set("status", projectState.status);
    const [rows, all] = await Promise.all([api(`/api/projects?${params}`).then((d) => d.projects || []), params.size ? api("/api/projects").then((d) => d.projects || []) : null]);
    if (requestId !== projectState.request || location.hash !== "#projetos") return;
    const universe = all || rows;
    const running = universe.filter((x) => ["active", "in_review", "testing", "awaiting_client"].includes(x.status));
    const waiting = universe.filter((x) => ["awaiting_client", "awaiting_approval"].includes(x.status));
    const average = universe.length ? Math.round(universe.reduce((sum, x) => sum + (Number(x.progress) || 0), 0) / universe.length) : 0;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const overdue = universe.filter((x) => x.due_on && new Date(x.due_on) < today && !["done", "published", "cancelled"].includes(x.status));
    const blocked = universe.filter((x) => ["paused", "awaiting_client", "awaiting_approval"].includes(x.status) || x.block_reason);
    const stats = ui.stats([
      { label: "Projetos", value: ui.number(universe.length), note: params.size ? `${ui.number(rows.length)} na lista` : "" },
      { label: "Em andamento", value: ui.number(running.length), tone: "green" },
      { label: "Aguardando cliente", value: ui.number(waiting.length), tone: waiting.length ? "orange" : undefined },
      { label: "Progresso médio", value: `${average}%`, note: `${ui.number(universe.filter((x) => ["done", "published"].includes(x.status)).length)} concluídos` },
      { label: "Atenção", value: ui.number(overdue.length + blocked.length), note: `${overdue.length} atrasado(s) · ${blocked.length} bloqueado(s)`, tone: overdue.length ? "red" : blocked.length ? "orange" : "green" },
    ]);
    const toolbar = ui.toolbar({ search: { value: projectState.query, placeholder: "Buscar projeto, descrição ou cliente…" }, filters: [{ key: "status", label: "Status", value: projectState.status, options: [["", "Todos os status"], ...projectStatuses.map((status) => [status, labels[status] || status])] }], actions: ui.button({ label: "Exportar CSV", kind: "secondary", attr: "data-projects-csv" }) });
    const viewToolbar = `<div class="project-view-switcher" role="tablist" aria-label="Visualização dos projetos"><span>Visualização</span>${[["list", "Lista"], ["board", "Quadro"], ["timeline", "Timeline"]].map(([key, label]) => `<button type="button" class="filter-button ${projectState.view === key ? "is-active" : ""}" data-project-view="${key}" role="tab" aria-selected="${projectState.view === key}">${label}</button>`).join("")}</div>`;
    const table = ui.table({
      columns: [
        { key: "name", label: "Projeto", render: (x) => `${esc(x.name)}${x.description ? `<small>${esc(String(x.description).slice(0, 80))}</small>` : ""}` },
        { key: "client_name", label: "Cliente / contrato", render: (x) => `${esc(x.client_name || "Sem cliente")}${x.contract_name ? `<small>${esc(x.contract_name)}</small>` : ""}` },
        { key: "progress", label: "Progresso", width: "160px", render: (x) => { const value = Math.max(0, Math.min(100, Number(x.progress) || 0)); return `<div class="operations-progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${value}" aria-label="Progresso do projeto: ${value}%"><span style="width:${value}%"></span></div><small>${value}%</small>`; } },
        { key: "status", label: "Status", render: (x) => ui.badge(labels[x.status] || x.status || "—", projectTone(x.status)) },
        { key: "actions", label: "Ações", render: (x) => `<button class="compact-action" data-overview="${x.id}" type="button">Resumo</button><button class="compact-action" data-workspace="${x.id}" type="button">Workspace</button><button class="compact-action" data-progress="${x.id}" type="button">Progresso</button><button class="compact-action" data-edit="${x.id}" type="button">Editar</button><button class="compact-action" data-delete="${x.id}" type="button">Excluir</button>` },
      ],
      rows,
      empty: universe.length ? "Nenhum projeto corresponde à busca." : "",
    });
    const content = projectState.view === "board" ? projectBoardMarkup(rows) : projectState.view === "timeline" ? projectTimelineMarkup(rows) : (universe.length ? table : state("empty", "Nenhum projeto", "Crie um projeto para acompanhar entregas."));
    dashboardGrid.innerHTML = intro(title, description, "projeto") + stats + `<section class="data-card operations-table">${toolbar}${viewToolbar}${content}</section>`;
    dashboardGrid.removeAttribute("aria-busy");
    bindCommon("projeto", rows, "/api/projects");
    bindProjectBoardDragAndDrop();
    dashboardGrid.querySelector("[data-search]")?.addEventListener("input", (event) => { projectState.query = event.target.value; clearTimeout(projectState.timer); projectState.timer = setTimeout(() => renderProjectsConnected().then(restoreFocus), 250); });
    dashboardGrid.querySelector("[data-filter=status]")?.addEventListener("change", (event) => { projectState.status = event.target.value; renderProjectsConnected(); });
    dashboardGrid.querySelector("[data-projects-csv]")?.addEventListener("click", () => ui.downloadCsv("projetos.csv", ["Projeto", "Cliente", "Contrato", "Progresso", "Status"], rows.map((x) => [x.name, x.client_name || "", x.contract_name || "", Number(x.progress) || 0, labels[x.status] || x.status || ""])));
    dashboardGrid.querySelectorAll("[data-project-view]").forEach((button) => button.addEventListener("click", () => { projectState.view = button.dataset.projectView; try { localStorage.setItem("focusdev_projects_view", projectState.view); } catch { /* preferência local */ } renderProjectsConnected(); }));
    dashboardGrid.querySelectorAll("[data-overview]").forEach((button) => button.addEventListener("click", () => openProjectOverview(button.dataset.overview)));
    dashboardGrid.querySelectorAll("[data-workspace]").forEach((button) => button.addEventListener("click", () => openProjectWorkspace(button.dataset.workspace)));
    dashboardGrid.querySelectorAll("[data-progress]").forEach((button) => button.addEventListener("click", () => { const item = rows.find((row) => String(row.id) === button.dataset.progress); if (!item) return; const routeAtStart = location.hash; setup("projeto").then(() => { if (location.hash !== routeAtStart) return; const form = document.querySelector("#create-dialog-form"); if (!form) return; form.elements.progress.value = Number(item.progress) || 0; form.elements.status.value = item.status || "active"; form.dataset.method = "PATCH"; form.dataset.endpoint = `/api/projects/${item.id}`; }).catch((error) => { if (location.hash === routeAtStart) ui.toast(error.message, "error"); }); }));
  } catch (error) { if (requestId !== projectState.request || location.hash !== "#projetos") return; dashboardGrid.removeAttribute("aria-busy"); dashboardGrid.innerHTML = intro(title, description, "projeto") + state("error", error.message); }
}
let githubAutoFillBusy = false;
document.addEventListener("change", async (event) => {
  const input = event.target;
  if (location.hash !== "#projetos" || input?.name !== "repository_url" || !/^https:\/\/(www\.)?github\.com\//i.test(input.value.trim()) || githubAutoFillBusy) return;
  githubAutoFillBusy = true;
  try {
    const data = await api(`/api/projects/github-preview?url=${encodeURIComponent(input.value.trim())}`);
    if (location.hash !== "#projetos" || !input.isConnected) return;
    const form = input.closest("form");
    ["name", "description", "repository_url", "production_url", "technologies", "domain", "observations"].forEach((name) => { const field = form?.elements?.[name], value = data[name]; if (field && value !== undefined && value !== null && !String(field.value || "").trim()) field.value = value; });
    toast("Dados do GitHub identificados e campos vazios preenchidos.", "success");
  } catch (error) { if (location.hash === "#projetos" && input.isConnected) toast(error.message || "Não foi possível consultar o GitHub.", "error"); }
  finally { githubAutoFillBusy = false; }
});
registerRoutes({ contratos: renderContracts, projetos: renderProjectsConnected });
dashboardGrid.addEventListener("click", (event) => {
  const button = event.target.closest?.("[data-delete]");
  const route = location.hash;
  const config = route === "#contratos" ? { request: contractsState, endpoint: "/api/contracts", success: "Contrato excluído.", render: renderContracts } : route === "#projetos" ? { request: projectState, endpoint: "/api/projects", success: "Projeto excluído.", render: renderProjectsConnected } : null;
  if (!button || !config || button.dataset.operationsDeleteGuarded === "1") return;
  event.preventDefault();
  event.stopImmediatePropagation();
  button.dataset.operationsDeleteGuarded = "1";
  const routeAtStart = route;
  const requestAtStart = config.request.request;
  ui.confirmInline(button, {
    text: route === "#contratos" ? "Excluir contrato?" : "Excluir projeto?",
    onConfirm: async () => {
      button.disabled = true;
      button.setAttribute("aria-busy", "true");
      button.textContent = "Excluindo…";
      try {
        await api(`${config.endpoint}/${button.dataset.delete}`, { method: "DELETE" });
        if (location.hash !== routeAtStart || requestAtStart !== config.request.request) return;
        ui.toast(config.success, "success");
        config.render();
      } catch (error) {
        if (location.hash !== routeAtStart) return;
        throw error;
      } finally {
        delete button.dataset.operationsDeleteGuarded;
      }
    },
    onCancel: () => { delete button.dataset.operationsDeleteGuarded; },
  });
}, true);
window.addEventListener("hashchange", () => {
  contractsState.request += 1;
  projectState.request += 1;
  clearTimeout(contractsState.timer);
  clearTimeout(projectState.timer);
  contractsState.timer = null;
  projectState.timer = null;
});

async function openProjectWorkspace(id) {
  const previouslyFocused = document.activeElement;
  const panel = document.createElement("aside");
  panel.className = "conta-drawer conta-drawer-wide";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-modal", "true");
  panel.setAttribute("aria-label", "Workspace do projeto");
  panel.innerHTML = '<button class="conta-close" type="button" aria-label="Fechar">×</button><p class="card-kicker">Projeto</p><h2>Carregando workspace…</h2><div class="conta-related" role="status" aria-live="polite">Carregando áreas relacionadas…</div>';
  panel.setAttribute("aria-busy", "true");
  document.body.append(panel);
  const close = () => { panel.remove(); document.removeEventListener("keydown", onKey); if (previouslyFocused instanceof HTMLElement && previouslyFocused.isConnected) previouslyFocused.focus(); };
  const onKey = (event) => trapOperationsDialogKey(event, panel, close);
  document.addEventListener("keydown", onKey);
  panel.querySelector(".conta-close").onclick = close;
  panel.querySelector(".conta-close").focus();
  try {
    const data = await api(`/api/projects/${id}/workspace`); if (!panel.isConnected || location.hash !== "#projetos") { close(); return; } const project = data.project || {};
    const list = (items, render) => items?.length ? items.map(render).join("") : '<p class="operations-muted">Nenhum registro nesta área.</p>';
    panel.querySelector("h2").textContent = project.name || "Projeto";
    panel.querySelector(".conta-related").innerHTML = `<section><h3>Visão geral</h3><p>${esc(labels[project.status] || project.status || "—")} · ${Number(project.progress || 0)}% · Cliente: ${esc(project.client_name || "Sem cliente")}</p><div class="operations-progress"><span style="width:${Math.max(0, Math.min(100, Number(project.progress) || 0))}%"></span></div></section><section><h3>Tarefas</h3>${list(data.tasks, (item) => `<p>${esc(item.title)} · ${esc(labels[item.status] || item.status || "Pendente")}</p>`)}</section><section><h3>Entregas e aprovações</h3>${list(data.deliveries, (item) => `<p>Versão ${esc(item.version)} · ${esc(item.status)}${item.client_approved ? " · Aprovada" : ""}</p>`)}${list(data.approvals, (item) => `<p>${esc(item.title)} · ${esc(item.status)}</p>`)}</section><section><h3>Alterações e suporte</h3>${list(data.changes, (item) => `<p>${esc(item.title)} · ${esc(item.status)}${item.additional_cost ? ` · ${money(item.additional_cost)}` : ""}</p>`)}${list(data.tickets, (item) => `<p>${esc(item.title)} · ${esc(labels[item.status] || item.status)}</p>`)}</section><section><h3>Infraestrutura e horas</h3>${list(data.infrastructure, (item) => `<p>${esc(item.name)} · ${esc(item.provider || item.kind || "Recurso")}${item.expires_on ? ` · vence ${esc(item.expires_on)}` : ""}</p>`)}<p>Total registrado: ${Math.round((data.time_entries || []).reduce((sum, item) => sum + Number(item.minutes || 0), 0) / 60 * 10) / 10}h</p></section><section><h3>Arquivos</h3>${list(data.files, (item) => `<p>${esc(item.name)} · ${esc(item.kind || "Arquivo")}</p>`)}</section>`;
    const visibilityLabels = [["show_overview", "Resumo do projeto"], ["show_tasks", "Tarefas"], ["show_files", "Arquivos"], ["show_deliveries", "Entregas"], ["show_approvals", "Aprovações"], ["show_changes", "Alterações de escopo"], ["show_infrastructure", "Infraestrutura"], ["show_repository", "Repositório"], ["show_hosting", "Hospedagem e domínio"], ["show_finance", "Financeiro"], ["show_support", "Suporte"]];
    panel.querySelector(".conta-related").insertAdjacentHTML("afterbegin", `<section><h3>Próximas ações</h3><div class="ui-header-actions" style="justify-content:flex-start"><button class="compact-action" type="button" data-workflow-create="tarefa">Nova tarefa</button><button class="compact-action" type="button" data-workflow-create="arquivo">Adicionar arquivo</button><button class="compact-action" type="button" data-workflow-create="ticket">Abrir suporte</button></div></section>`);
    panel.querySelectorAll("[data-workflow-create]").forEach((button) => button.addEventListener("click", async () => {
      button.disabled = true;
      try { await window.FocusWorkflow?.openLinked(button.dataset.workflowCreate, { project_id: project.id, client_id: project.client_id }); }
      catch (error) { ui.toast(error.message || "Não foi possível abrir o cadastro.", "error"); }
      finally { button.disabled = false; }
    }));
    const visibility = data.portal_settings || {};
    panel.querySelector(".conta-related").insertAdjacentHTML("beforeend", `<section class="portal-visibility-editor"><h3>Visibilidade no portal do cliente</h3><p class="operations-muted">Escolha o que o cliente poderá acompanhar. Senhas e dados do cofre nunca são publicados.</p><div class="portal-visibility-grid">${visibilityLabels.map(([key, label]) => `<label><input type="checkbox" data-portal-visibility="${key}" ${visibility[key] ? "checked" : ""}> ${label}</label>`).join("")}</div><button type="button" class="button button-primary compact-action" data-save-portal-visibility>Salvar visibilidade</button><p class="operations-muted" data-portal-visibility-status role="status"></p></section>`);
    panel.querySelector("[data-save-portal-visibility]")?.addEventListener("click", async (event) => {
      const button = event.currentTarget, status = panel.querySelector("[data-portal-visibility-status]");
      button.disabled = true; button.textContent = "Salvando…";
      try {
        const payload = Object.fromEntries([...panel.querySelectorAll("[data-portal-visibility]")].map((input) => [input.dataset.portalVisibility, input.checked]));
        await api(`/api/projects/${id}/portal-settings`, { method: "PATCH", body: payload });
        if (status) status.textContent = "Visibilidade salva com segurança.";
        ui.toast("Portal atualizado.", "success");
      } catch (error) { if (status) status.textContent = error.message; }
      finally { if (button.isConnected) { button.disabled = false; button.textContent = "Salvar visibilidade"; } }
    });
  } catch (error) { if (panel.isConnected && location.hash === "#projetos") panel.querySelector(".conta-related").textContent = error.message; else if (panel.isConnected) close(); }
  if (panel.isConnected) panel.removeAttribute("aria-busy");
}

const projectWorkspaceObserver = new MutationObserver(async () => {
  if (location.hash !== "#projetos") return;
  const routeAtStart = location.hash;
  const table = dashboardGrid.querySelector(".operations-table tbody");
  if (!table || table.dataset.workspaceActions === "1" || table.querySelector("[data-workspace]")) return;
  table.dataset.workspaceActions = "1";
  let rows;
  try {
    rows = (await api("/api/projects")).projects || [];
    if (location.hash !== routeAtStart || !table.isConnected) return;
  } catch (error) { if (location.hash === routeAtStart) toast(error.message, "error"); return; }
  table.querySelectorAll("tr").forEach((row, index) => {
    const project = rows[index]; if (!project || row.querySelector("[data-workspace]")) return;
    const button = document.createElement("button"); button.type = "button"; button.className = "compact-action"; button.dataset.workspace = project.id; button.textContent = "Workspace";
    button.addEventListener("click", () => openProjectWorkspace(project.id)); row.lastElementChild?.append(" ", button);
  });
});
projectWorkspaceObserver.observe(dashboardGrid, { childList: true, subtree: true });
dashboardGrid.addEventListener("click", (event) => {
  const button = event.target.closest?.("[data-workspace]");
  if (!button || location.hash !== "#projetos" || button.dataset.busy === "1") return;
  button.dataset.busy = "1";
  button.disabled = true;
  button.setAttribute("aria-busy", "true");
  const originalLabel = button.textContent;
  button.textContent = "Abrindo…";
  Promise.resolve(openProjectWorkspace(button.dataset.workspace)).finally(() => {
    if (!button.isConnected) return;
    button.disabled = false;
    button.removeAttribute("aria-busy");
    button.dataset.busy = "";
    button.textContent = originalLabel;
  });
}, true);

// O estado de erro pode ser renderizado novamente pelo roteador; a ação precisa
// continuar funcionando mesmo quando a tela foi trocada após o primeiro bind.
dashboardGrid.addEventListener("click", (event) => {
  if (!event.target.closest(".operations-retry")) return;
  if (location.hash === "#contratos") renderContracts();
  if (location.hash === "#projetos") renderProjectsConnected();
});

new MutationObserver(() => {
  if (dashboardGrid.querySelector(".state-loading")) dashboardGrid.setAttribute("aria-busy", "true");
  else dashboardGrid.removeAttribute("aria-busy");
  dashboardGrid.querySelectorAll("input, select, textarea").forEach((control) => {
    if (!control.name) control.name = control.matches("[data-search], [data-project-search], [data-delivery-search]") ? "search" : control.dataset.filter || control.dataset.search || "field";
    if (!control.getAttribute("autocomplete") && control.type !== "password") control.setAttribute("autocomplete", "off");
    if (!control.getAttribute("aria-label") && control.matches("[data-file-project]")) control.setAttribute("aria-label", "Filtrar por projeto");
    if (control.placeholder?.includes("...")) control.placeholder = control.placeholder.replaceAll("...", "…");
  });
  dashboardGrid.querySelectorAll("button").forEach((button) => {
    button.style.touchAction = "manipulation";
    if (button.disabled) button.setAttribute("aria-busy", "true");
    else button.removeAttribute("aria-busy");
  });
  dashboardGrid.querySelectorAll(".state-loading p").forEach((label) => { if (label.textContent?.includes("...")) label.textContent = label.textContent.replaceAll("...", "…"); });
  dashboardGrid.querySelectorAll(".state-error").forEach((status) => status.setAttribute("role", "alert"));
  dashboardGrid.querySelectorAll("table").forEach((table) => {
    if (!table.caption) {
      const caption = document.createElement("caption");
      caption.className = "sr-only";
      caption.textContent = `Registros de ${location.hash.replace(/^#/, "Operação")}`;
      table.prepend(caption);
    }
    table.querySelectorAll("thead th").forEach((header) => header.setAttribute("scope", "col"));
  });
  const operationsTable = dashboardGrid.querySelector(".operations-table");
  if (operationsTable && location.hash === "#projetos") {
    let result = operationsTable.querySelector("[data-operation-results]");
    if (!result) {
      result = document.createElement("p");
      result.className = "ui-filter-status";
      result.dataset.operationResults = "true";
      result.setAttribute("role", "status");
      result.setAttribute("aria-live", "polite");
      operationsTable.querySelector(".ui-toolbar")?.after(result);
    }
    const count = operationsTable.querySelectorAll("tbody tr:not([hidden])").length;
    const label = count === 1 ? "1 projeto encontrado" : `${count} projetos encontrados`;
    if (result.textContent !== label) result.textContent = label;
  }
}).observe(dashboardGrid, { childList: true, subtree: true, attributes: true, attributeFilter: ["disabled"] });

new MutationObserver(() => {
  document.querySelectorAll(".conta-drawer").forEach((panel) => {
    const walker = document.createTreeWalker(panel, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach((node) => { if (node.nodeValue?.includes("...")) node.nodeValue = node.nodeValue.replaceAll("...", "…"); });
  });
}).observe(document.body, { childList: true, subtree: true });

new MutationObserver(() => {
  document.querySelectorAll(".conta-drawer .operations-progress:not([role=progressbar])").forEach((bar) => {
    const match = (bar.parentElement?.textContent || "").match(/(\d+(?:[.,]\d+)?)%/);
    const value = Math.max(0, Math.min(100, Number.parseFloat((match?.[1] || "0").replace(",", ".")) || 0));
    bar.setAttribute("role", "progressbar");
    bar.setAttribute("aria-valuemin", "0");
    bar.setAttribute("aria-valuemax", "100");
    bar.setAttribute("aria-valuenow", String(value));
    bar.setAttribute("aria-label", `Progresso do projeto: ${value}%`);
  });
}).observe(document.body, { childList: true, subtree: true });
