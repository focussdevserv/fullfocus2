const financeCurrencyFormatter = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const financeInputNumberFormatter = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const financeDateFormatter = new Intl.DateTimeFormat("pt-BR");
const financeMonthFormatter = new Intl.DateTimeFormat("pt-BR", { month: "short" });
const financeCurrency = (value) => financeCurrencyFormatter.format(Number(value || 0));
const toast = (...args) => { if (["#visao-financeira", "#receitas", "#despesas", "#contas-a-receber"].includes(location.hash)) ui.toast(...args); };
const financeDate = (value) => { if (!value) return "—"; const date = new Date(value); return Number.isNaN(date.getTime()) ? "—" : financeDateFormatter.format(date); };
const financeStatus = { pending: "Pendente", paid: "Pago", overdue: "Vencido", cancelled: "Cancelado", sent: "Enviada", active: "Ativa", paused: "Pausada" };
const financeEsc = (value) => escapeHtml(value ?? "");
const financeTone = (status) => ["paid", "active"].includes(status) ? "positive" : ["overdue", "cancelled"].includes(status) ? "warning" : "neutral";
document.addEventListener("click", async (event) => { const button = event.target.closest?.("[data-pay][data-table='receivables']"); if (!button) return; event.stopImmediatePropagation(); const routeAtStart = location.hash; const row = button.closest("tr"); const description = row?.cells?.[0]?.textContent?.trim() || "conta a receber"; const total = Number(String(row?.cells?.[1]?.textContent || "0").replace(/[^0-9,.-]/g, "").replace(/\./g, "").replace(",", ".")) || 0; ui.form({ title: "Registrar recebimento", subtitle: description, fields: [{ name: "amount", label: "Valor recebido", type: "number", min: 0.01, step: 0.01, value: financeInputNumberFormatter.format(total), help: total ? `Valor em aberto: ${financeCurrency(total)}. Um valor menor registra recebimento parcial.` : "" }, { name: "method", label: "Forma", type: "select", value: "pix", options: [["pix", "Pix"], ["transfer", "Transferência"], ["card", "Cartão"], ["boleto", "Boleto"], ["cash", "Dinheiro"], ["manual", "Outro"]] }], submitLabel: "Confirmar recebimento", onSubmit: async (values) => { const amount = Number(values.amount); if (!Number.isFinite(amount) || amount <= 0) throw new Error("Informe um valor de pagamento válido."); await api(`/api/receivables/${button.dataset.pay}/record-payment`, { method: "POST", body: { amount, method: values.method || "manual" } }); if (location.hash !== routeAtStart || routeAtStart !== "#contas-a-receber" || !button.isConnected) return; toast("Pagamento registrado e receita confirmada.", "success"); renderHashRoute(); } }); }, true);

export function financeSixMonths(revenues, expenses, today = new Date()) {
  return Array.from({ length: 6 }, (_, index) => {
    const date = new Date(today.getFullYear(), today.getMonth() - 5 + index, 1);
    const month = (items) => items.filter((item) => item.paid_at && new Date(item.paid_at).getFullYear() === date.getFullYear() && new Date(item.paid_at).getMonth() === date.getMonth()).reduce((sum, item) => sum + Number(item.amount || 0), 0);
    return { label: financeMonthFormatter.format(date), revenue: month(revenues), expense: month(expenses) };
  });
}
function intro(title, text, action, kind) { return `<section class="page-intro finance-intro"><div><p class="card-kicker">Financeiro</p><h2>${financeEsc(title)}</h2><p>${financeEsc(text)}</p></div>${action ? `<button class="button button-primary compact-action" data-create="${kind}" type="button">${financeEsc(action)}</button>` : ""}</section>`; }
function state(kind, label) { return stateBlock[kind](String(label ?? "").replaceAll("...", "…")); }
function bindCreate() { dashboardGrid.querySelectorAll("[data-create]").forEach((button) => button.addEventListener("click", async () => { if (["recebivel", "assinatura"].includes(button.dataset.create)) { const clients = (await api("/api/clients")).clients || []; createConfig[button.dataset.create].fields.find((field) => field.name === "client_id").options = [["", "Sem cliente"], ...clients.map((client) => [client.id, client.name])]; } openCreateDialog(button.dataset.create); })); }
function bindRetry() { dashboardGrid.querySelector(".state-retry")?.addEventListener("click", () => renderHashRoute()); }
function rowActions(items, table) { return items.map((item) => { const status = item.status || (item.paid_at ? "paid" : "pending"), canPay = ["pending", "partially_paid"].includes(status); const paymentInput = ""; return `<tr><td>${financeEsc(item.description)}</td><td>${financeCurrency(item.amount)}</td><td>${financeDate(item.due_at)}</td><td><span class="finance-status ${financeTone(status)}">${financeStatus[status] || financeEsc(status)}</span></td><td class="finance-actions">${canPay ? paymentInput + `<button type="button" class="compact-action" data-pay="${item.id}" data-table="${table}">Marcar pago</button>` : ""}<button type="button" class="compact-action" data-remove="${item.id}" data-table="${table}">Excluir</button></td></tr>`; }).join(""); }
function bindActions() { dashboardGrid.querySelectorAll("[data-pay]").forEach((button) => button.addEventListener("click", async () => { const routeAtStart = location.hash; if (button.disabled) return; button.disabled = true; button.setAttribute("aria-busy", "true"); button.textContent = "Registrando…"; try { await api(`/api/${button.dataset.table}/${button.dataset.pay}`, { method: "PATCH", body: { paid_at: new Date().toISOString(), status: "paid" } }); if (location.hash !== routeAtStart || !button.isConnected) return; toast("Pagamento registrado.", "success"); renderHashRoute(); } catch (error) { if (location.hash !== routeAtStart || !button.isConnected) return; button.disabled = false; button.removeAttribute("aria-busy"); button.textContent = "Marcar pago"; toast(error.message, "error"); } })); dashboardGrid.querySelectorAll("[data-remove]").forEach((button) => button.addEventListener("click", () => { if (button.disabled) return; if (!button.dataset.confirm) { button.dataset.confirm = "true"; button.textContent = "Confirmar exclusão"; return; } const routeAtStart = location.hash; button.disabled = true; button.setAttribute("aria-busy", "true"); api(`/api/${button.dataset.table}/${button.dataset.remove}`, { method: "DELETE" }).then(() => { if (location.hash === routeAtStart && button.isConnected) renderHashRoute(); }).catch((error) => { if (location.hash !== routeAtStart || !button.isConnected) return; button.disabled = false; button.removeAttribute("aria-busy"); button.dataset.confirm = ""; button.textContent = "Excluir"; toast(error.message, "error"); }); })); }
async function renderLedger(table, title, description, kind, singular) { dashboardGrid.setAttribute("aria-busy", "true"); dashboardGrid.innerHTML = intro(title, description, `+ Nova ${singular}`, kind) + state("loading", "Carregando…"); try { const data = await api(`/api/${table}`), items = data[table] || []; dashboardGrid.innerHTML = intro(title, description, `+ Nova ${singular}`, kind) + `<section class="data-card finance-list"><div class="finance-toolbar"><input data-search name="search" autocomplete="off" placeholder="Buscar por descrição…" aria-label="Buscar lançamentos"/><select data-filter name="status" autocomplete="off" aria-label="Filtrar status"><option value="">Todos</option><option value="paid">Pagos</option><option value="pending">Pendentes</option></select><select data-sort name="sort" autocomplete="off" aria-label="Ordenar vencimento"><option value="asc">Vencimento crescente</option><option value="desc">Vencimento decrescente</option></select></div>${items.length ? `<div class="table-wrap"><table class="finance-table"><thead><tr><th>Descrição</th><th>Valor</th><th>Vencimento</th><th>Status</th><th>Ações</th></tr></thead><tbody>${rowActions([...items].sort((a, b) => new Date(a.due_at || 0) - new Date(b.due_at || 0)), table)}</tbody></table></div>` : state("empty", "Nenhum lançamento encontrado")}</section>`; dashboardGrid.removeAttribute("aria-busy"); bindCreate(); bindActions(); const refresh = () => { const query = dashboardGrid.querySelector("[data-search]").value.toLowerCase(), filter = dashboardGrid.querySelector("[data-filter]").value, sort = dashboardGrid.querySelector("[data-sort]").value; [...dashboardGrid.querySelectorAll("tbody tr")].sort((a, b) => { const av = a.cells[2].textContent, bv = b.cells[2].textContent; return (sort === "asc" ? 1 : -1) * av.localeCompare(bv, "pt-BR"); }).forEach((row) => row.parentNode.appendChild(row)); dashboardGrid.querySelectorAll("tbody tr").forEach((row) => { const text = row.textContent.toLowerCase(); row.hidden = (query && !text.includes(query)) || (filter && !text.includes(financeStatus[filter].toLowerCase())); }); }; ["[data-search]", "[data-filter]", "[data-sort]"].forEach((selector) => dashboardGrid.querySelector(selector)?.addEventListener("input", refresh)); } catch (error) { dashboardGrid.removeAttribute("aria-busy"); dashboardGrid.innerHTML = intro(title, description, `+ Nova ${singular}`, kind) + state("error", error.message); bindCreate(); bindRetry(); } }
function metric(label, value) { return `<article class="data-card finance-metric"><span>${financeEsc(label)}</span><strong>${value}</strong></article>`; }
async function renderOverview() { const routeAtStart = location.hash; if (routeAtStart !== "#visao-financeira") return; dashboardGrid.innerHTML = intro("Visão financeira", "Receitas, despesas e recebíveis do seu workspace.") + state("loading", "Carregando..."); try { const [revenueData, expenseData, receivableData] = await Promise.all([api("/api/revenues"), api("/api/expenses"), api("/api/receivables")]); if (location.hash !== routeAtStart || routeAtStart !== "#visao-financeira") return; const revenues = revenueData.revenues || [], expenses = expenseData.expenses || [], receivables = receivableData.receivables || [], now = new Date(), current = (item) => item.paid_at && new Date(item.paid_at).getMonth() === now.getMonth() && new Date(item.paid_at).getFullYear() === now.getFullYear(), paidRevenue = revenues.filter(current).reduce((sum, item) => sum + Number(item.amount), 0), paidExpense = expenses.filter(current).reduce((sum, item) => sum + Number(item.amount), 0), open = receivables.filter((item) => ["pending", "overdue"].includes(item.status)), overdue = receivables.filter((item) => item.status === "overdue"), months = financeSixMonths(revenues, expenses, now), max = Math.max(0, ...months.flatMap((item) => [item.revenue, item.expense])), movements = [...revenues.map((item) => ({ ...item, type: "Receita", date: item.paid_at || item.due_at })), ...expenses.map((item) => ({ ...item, type: "Despesa", date: item.paid_at || item.due_at }))].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5); const chart = max ? `<div class="finance-chart">${months.map((item) => `<div class="chart-column"><div class="chart-bars"><i class="chart-bar chart-income" style="height:${item.revenue / max * 100}%" title="Receitas: ${financeCurrency(item.revenue)}"></i><i class="chart-bar chart-expense" style="height:${item.expense / max * 100}%" title="Despesas: ${financeCurrency(item.expense)}"></i></div><small>${financeEsc(item.label)}</small></div>`).join("")}</div><div class="chart-legend"><span><i class="chart-income"></i> Receitas</span><span><i class="chart-expense"></i> Despesas</span></div>` : `<p class="finance-chart-empty">Sem movimentações nos últimos 6 meses</p>`; dashboardGrid.innerHTML = intro("Visão financeira", "Receitas, despesas e recebíveis do seu workspace.") + `<section class="finance-metrics">${metric("Receitas pagas", financeCurrency(paidRevenue))}${metric("Despesas pagas", financeCurrency(paidExpense))}${metric("Resultado", financeCurrency(paidRevenue - paidExpense))}${metric("A receber em aberto", financeCurrency(open.reduce((sum, item) => sum + Number(item.amount), 0)))}${metric("Vencidas", financeCurrency(overdue.reduce((sum, item) => sum + Number(item.amount), 0)))}</section><section class="data-card finance-chart-card"><h2>Últimos 6 meses</h2>${chart}</section><section class="data-card finance-list"><h2>Últimas movimentações</h2><div class="table-wrap"><table class="finance-table"><thead><tr><th>Descrição</th><th>Tipo</th><th>Valor</th><th>Data</th></tr></thead><tbody>${movements.map((item) => `<tr><td>${financeEsc(item.description)}</td><td>${item.type}</td><td>${financeCurrency(item.amount)}</td><td>${financeDate(item.date)}</td></tr>`).join("") || `<tr><td colspan="4">Nenhuma movimentação.</td></tr>`}</tbody></table></div></section>`; } catch (error) { if (location.hash !== routeAtStart || routeAtStart !== "#visao-financeira") return; dashboardGrid.innerHTML = intro("Visão financeira", "Receitas, despesas e recebíveis do seu workspace.") + state("error", error.message); bindRetry(); } }
async function renderReceivables() { await renderLedger("receivables", "Contas a receber", "Acompanhe vencimentos e recebimentos.", "recebivel", "conta a receber"); dashboardGrid.querySelectorAll("[data-pay]").forEach((button) => { button.textContent = "Marcar recebido"; const charge = document.createElement("button"); charge.type = "button"; charge.className = "compact-action"; charge.textContent = "Gerar cobrança"; charge.addEventListener("click", async () => { charge.disabled = true; try { const data = await api(`/api/receivables/${button.dataset.pay}/create-charge`, { method: "POST", body: { channel: "link" } }); toast(data.notice || "Cobrança registrada.", "success"); charge.textContent = data.created === false ? "Cobrança existente" : "Cobrança gerada"; } catch (error) { charge.disabled = false; toast(error.message, "error"); } }); button.parentElement.append(" ", charge); }); }
createConfig.despesa = { title: "Nova despesa", endpoint: "/api/expenses", fields: [{ name: "description", label: "Descrição" }, { name: "amount", label: "Valor", type: "number", min: 0.01, step: 0.01 }, { name: "due_at", label: "Vencimento", type: "date", required: false }] };
createConfig.recebivel = { title: "Nova conta a receber", endpoint: "/api/receivables", fields: [{ name: "description", label: "Descrição" }, { name: "amount", label: "Valor", type: "number", min: 0.01, step: 0.01 }, { name: "due_at", label: "Vencimento", type: "date" }, { name: "client_id", label: "Cliente", type: "select", options: [] }] };
createConfig.assinatura = { title: "Nova assinatura", endpoint: "/api/subscriptions", fields: [{ name: "plan", label: "Plano" }, { name: "amount", label: "Valor", type: "number", min: 0.01, step: 0.01 }, { name: "interval", label: "Intervalo", type: "select", options: [["monthly", "Mensal"], ["yearly", "Anual"]] }, { name: "next_billing_on", label: "Próxima cobrança", type: "date", required: false }, { name: "client_id", label: "Cliente", type: "select", options: [] }] };
// A visão financeira consolidada é registrada abaixo junto das demais rotas financeiras.
const financeListState = {};
let financeOverviewRequest = 0;
const financeOverviewBase = renderOverview;
renderOverview = async function renderOverviewWithAccessibleLoading() {
  if (location.hash !== "#visao-financeira") return;
  const request = ++financeOverviewRequest;
  dashboardGrid.setAttribute("aria-busy", "true");
  try {
    await financeOverviewBase();
    if (request !== financeOverviewRequest || location.hash !== "#visao-financeira") {
      if (location.hash !== "#visao-financeira") renderHashRoute();
      return;
    }
  } finally {
    if (request === financeOverviewRequest) dashboardGrid.removeAttribute("aria-busy");
  }
};
window.addEventListener("hashchange", () => {
  if (location.hash !== "#visao-financeira") financeOverviewRequest += 1;
});
function financeKpis(items) { const statuses = items.map((item) => item.status || (item.paid_at ? "paid" : "pending")); const total = items.reduce((sum, item) => sum + Number(item.amount || 0), 0); const paid = items.filter((item, index) => statuses[index] === "paid").reduce((sum, item) => sum + Number(item.amount || 0), 0); const overdue = items.filter((item, index) => statuses[index] === "overdue").reduce((sum, item) => sum + Number(item.amount || 0), 0); const pending = items.filter((item, index) => ["pending", "partially_paid", "sent"].includes(statuses[index])).reduce((sum, item) => sum + Number(item.amount || 0), 0); return `<section class="finance-metrics">${metric("Total", financeCurrency(total))}${metric("Pago", financeCurrency(paid))}${metric("Pendente", financeCurrency(pending))}${metric("Vencido", financeCurrency(overdue))}</section>`; }
function financeDetails(item, table) { if (!item) return; const hidden = new Set(["id", "organization_id"]); const value = (entry) => entry === null || entry === undefined || entry === "" ? "—" : typeof entry === "object" ? JSON.stringify(entry) : String(entry); const html = Object.entries(item).filter(([key]) => !hidden.has(key)).map(([key, entry]) => `<dt>${financeEsc(key.replaceAll("_", " "))}</dt><dd>${financeEsc(value(entry))}</dd>`).join(""); ui.drawer({ title: item.description || "Lançamento financeiro", subtitle: table === "receivables" ? "Contas a receber" : table === "revenues" ? "Receita" : "Despesa", html: `<dl>${html || "<dd>Sem detalhes disponíveis.</dd>"}</dl>` }); }
async function renderLedgerConnected(table, title, description, kind, singular) {
  const routeByTable = { revenues: "#receitas", expenses: "#despesas", receivables: "#contas-a-receber" };
  if (routeByTable[table] && location.hash !== routeByTable[table]) return;
  const stateData = financeListState[table] || (financeListState[table] = { query: "", status: "" });
  const request = stateData.request = (stateData.request || 0) + 1;
  const restoreSearchFocus = ui.keepSearchFocus(dashboardGrid, "[data-search]");
  dashboardGrid.setAttribute("aria-busy", "true");
  dashboardGrid.innerHTML = intro(title, description, `+ Nova ${singular}`, kind) + state("loading", "Carregando…");
  try {
    const params = new URLSearchParams(); if (stateData.query.trim()) params.set("search", stateData.query.trim()); if (stateData.status) params.set("status", stateData.status);
    const items = (await api(`/api/${table}?${params}`))[table] || [];
    if (request !== stateData.request || (routeByTable[table] && location.hash !== routeByTable[table])) return;
    dashboardGrid.innerHTML = intro(title, description, `+ Nova ${singular}`, kind) + `<section class="data-card finance-list"><div class="finance-toolbar"><input data-search value="${financeEsc(stateData.query)}" placeholder="Buscar descrição ou categoria…" aria-label="Buscar descrição ou categoria"><select data-filter aria-label="Filtrar status"><option value="">Todos os status</option><option value="pending" ${stateData.status === "pending" ? "selected" : ""}>Pendentes</option><option value="paid" ${stateData.status === "paid" ? "selected" : ""}>Pagos</option><option value="overdue" ${stateData.status === "overdue" ? "selected" : ""}>Vencidos</option></select></div>${items.length ? `<div class="table-wrap"><table class="finance-table"><thead><tr><th>Descrição</th><th>Valor</th><th>Vencimento</th><th>Status</th><th>Ações</th></tr></thead><tbody>${rowActions(items, table)}</tbody></table></div>` : state("empty", "Nenhum lançamento encontrado")}</section>`;
    dashboardGrid.removeAttribute("aria-busy");
    restoreSearchFocus();
    dashboardGrid.querySelectorAll("input, select, textarea").forEach((control) => { if (!control.name) control.name = control.dataset.filter || control.dataset.sort || "field"; if (!control.getAttribute("autocomplete") && control.type !== "password") control.setAttribute("autocomplete", "off"); if (control.placeholder?.includes("...")) control.placeholder = control.placeholder.replaceAll("...", "…"); });
    dashboardGrid.querySelector(".finance-list")?.insertAdjacentHTML("beforebegin", financeKpis(items)); bindCreate(); bindActions(); dashboardGrid.querySelectorAll("tbody tr").forEach((row, index) => { const detail = document.createElement("button"); detail.type = "button"; detail.className = "compact-action"; detail.textContent = "Detalhes"; detail.addEventListener("click", () => financeDetails(items[index], table)); row.querySelector(".finance-actions")?.prepend(detail); });
    dashboardGrid.querySelector("[data-search]")?.addEventListener("input", (event) => { stateData.query = event.target.value; clearTimeout(stateData.timer); stateData.timer = setTimeout(() => renderLedgerConnected(table, title, description, kind, singular), 250); });
    dashboardGrid.querySelector("[data-filter]")?.addEventListener("change", (event) => { stateData.status = event.target.value; renderLedgerConnected(table, title, description, kind, singular); });
    if (table === "receivables") dashboardGrid.querySelectorAll("[data-pay]").forEach((button) => { const charge = document.createElement("button"); charge.type = "button"; charge.className = "compact-action"; charge.textContent = "Gerar cobrança"; charge.addEventListener("click", async () => { const routeAtStart = location.hash; if (routeAtStart !== routeByTable[table] || charge.dataset.busy === "1") return; const originalLabel = charge.textContent; charge.dataset.busy = "1"; charge.disabled = true; charge.setAttribute("aria-busy", "true"); charge.textContent = "Gerando…"; try { const result = await api(`/api/receivables/${button.dataset.pay}/create-charge`, { method: "POST", body: { channel: "link" } }); if (location.hash !== routeAtStart || !charge.isConnected) return; charge.textContent = result.created === false ? "Cobrança existente" : "Cobrança gerada"; toast(result.notice || "Cobrança registrada.", "success"); } catch (error) { if (location.hash === routeAtStart && charge.isConnected) toast(error.message, "error"); } finally { if (charge.isConnected) { charge.disabled = false; charge.removeAttribute("aria-busy"); if (charge.textContent === "Gerando…") charge.textContent = originalLabel; } delete charge.dataset.busy; } }); button.parentElement.append(" ", charge); });
  } catch (error) { if (request !== stateData.request || (routeByTable[table] && location.hash !== routeByTable[table])) return; dashboardGrid.removeAttribute("aria-busy"); dashboardGrid.innerHTML = intro(title, description, `+ Nova ${singular}`, kind) + state("error", error.message); bindCreate(); bindRetry(); }
}
registerRoutes({ "visao-financeira": renderOverview, receitas: () => renderLedgerConnected("revenues", "Receitas", "Acompanhe entradas e vencimentos.", "receita", "receita"), despesas: () => renderLedgerConnected("expenses", "Despesas", "Controle custos e compromissos.", "despesa", "despesa"), "contas-a-receber": () => renderLedgerConnected("receivables", "Contas a receber", "Acompanhe vencimentos e recebimentos.", "recebivel", "conta a receber") });
createConfig.receita = { title: "Nova receita", endpoint: "/api/revenues", fields: [{ name: "description", label: "Descrição" }, { name: "amount", label: "Valor líquido", type: "number", min: 0.01, step: 0.01 }, { name: "category", label: "Categoria", required: false }, { name: "payment_method", label: "Forma de pagamento", required: false }, { name: "paid_at", label: "Data do recebimento", type: "date", required: false }, { name: "project_id", label: "Projeto (ID)", required: false }, { name: "contract_id", label: "Contrato (ID)", required: false }] };
const financeBaseOpenCreateDialog = openCreateDialog;
openCreateDialog = function openFinanceCreateDialog(kind) {
  financeBaseOpenCreateDialog(kind);
  const config = createConfig[kind];
  config?.fields?.forEach((field) => {
    const input = dialogFields.querySelector(`[name="${field.name}"]`);
    if (!input) return;
    if (field.min !== undefined) input.min = String(field.min);
    if (field.max !== undefined) input.max = String(field.max);
    if (field.step !== undefined) input.step = String(field.step);
  });
};
const financeCreateKinds = new Set(["receita", "despesa", "recebivel", "assinatura"]);
document.addEventListener("click", async (event) => {
  const button = event.target.closest?.("[data-create]");
  const kind = button?.dataset.create;
  if (!button || !financeCreateKinds.has(kind) || !dashboardGrid.contains(button)) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  if (button.disabled) return;
  const routeAtStart = location.hash;
  const originalLabel = button.textContent;
  button.disabled = true;
  button.textContent = "Carregando…";
  try {
    if (["recebivel", "assinatura"].includes(kind)) {
      const clients = (await api("/api/clients")).clients || [];
      if (location.hash !== routeAtStart || !button.isConnected) return;
      createConfig[kind].fields.find((field) => field.name === "client_id").options = [["", "Sem cliente"], ...clients.map((client) => [client.id, client.name])];
    }
    if (location.hash !== routeAtStart || !button.isConnected) return;
    openCreateDialog(kind);
  } catch (error) {
    toast(error.message || "Não foi possível abrir o formulário.", "error");
  } finally {
    if (button.isConnected) { button.disabled = false; button.textContent = originalLabel; }
  }
}, true);

new MutationObserver(() => {
  if (dashboardGrid.querySelector(".state-loading")) dashboardGrid.setAttribute("aria-busy", "true");
  else dashboardGrid.removeAttribute("aria-busy");
  dashboardGrid.querySelectorAll("[data-search], [data-filter], [data-sort], [data-report-months]").forEach((control) => {
    if (!control.name) control.name = control.dataset.search !== undefined ? "search" : control.dataset.filter !== undefined ? "status" : control.dataset.sort !== undefined ? "sort" : "months";
    control.setAttribute("autocomplete", "off");
    if (control.placeholder?.includes("...")) control.placeholder = control.placeholder.replaceAll("...", "…");
  });
  dashboardGrid.querySelectorAll("[data-pay], [data-remove], [data-create]").forEach((button) => {
    if (button.disabled) button.setAttribute("aria-busy", "true");
    else button.removeAttribute("aria-busy");
    if (button.textContent?.includes("...")) button.textContent = button.textContent.replaceAll("...", "…");
  });
  dashboardGrid.querySelectorAll(".state-loading p").forEach((label) => { if (label.textContent?.includes("...")) label.textContent = label.textContent.replaceAll("...", "…"); });
}).observe(dashboardGrid, { childList: true, subtree: true, attributes: true, attributeFilter: ["disabled"] });

new MutationObserver(() => {
  const list = dashboardGrid.querySelector(".finance-list");
  const table = list?.querySelector("tbody");
  if (!list || !table || !dashboardGrid.querySelector("[data-search]")) return;
  list.querySelectorAll("thead th").forEach((header) => header.setAttribute("scope", "col"));
  list.querySelectorAll("button, a, input, select").forEach((control) => { control.style.touchAction = "manipulation"; });
  let status = list.querySelector("[data-finance-results]");
  if (!status) {
    status = document.createElement("p");
    status.className = "ui-filter-status";
    status.dataset.financeResults = "true";
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    list.querySelector(".finance-toolbar")?.after(status);
  }
  const visible = [...table.rows].filter((row) => !row.hidden).length;
  const label = visible === 1 ? "1 lançamento encontrado" : `${visible} lançamentos encontrados`;
  if (status.textContent !== label) status.textContent = label;
}).observe(dashboardGrid, { childList: true, subtree: true, attributes: true, attributeFilter: ["hidden"] });

// A ação de gerar cobrança é adicionada depois do render; mantenha seu estado
// assíncrono acessível sem duplicar o fluxo de API do módulo.
dashboardGrid.addEventListener("click", (event) => {
  const button = event.target.closest?.(".finance-actions button");
  if (!button || !button.textContent.toLocaleLowerCase("pt-BR").includes("gerar")) return;
  button.setAttribute("aria-busy", "true");
}, true);

new MutationObserver(() => {
  dashboardGrid.querySelectorAll(".finance-actions button").forEach((button) => {
    const isChargeAction = button.textContent.toLocaleLowerCase("pt-BR").includes("gerar");
    if (!isChargeAction || !button.disabled) button.removeAttribute("aria-busy");
  });
}).observe(dashboardGrid, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["disabled"] });

new MutationObserver(() => {
  dashboardGrid.querySelectorAll(".finance-actions button").forEach((button) => {
    const label = button.textContent.toLocaleLowerCase("pt-BR");
    const completed = label.includes("cobrança gerada") || label.includes("cobrança existente");
    if (completed) {
      button.removeAttribute("aria-busy");
      button.setAttribute("aria-label", `Cobrança: ${button.textContent.trim()}`);
    }
  });
}).observe(dashboardGrid, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["disabled"] });

new MutationObserver(() => {
  dashboardGrid.querySelectorAll("table.finance-table").forEach((table) => {
    if (!table.caption) {
      const caption = document.createElement("caption");
      caption.className = "sr-only";
      caption.textContent = "Resumo financeiro";
      table.prepend(caption);
    }
    table.querySelectorAll("thead th").forEach((header) => header.setAttribute("scope", "col"));
    table.querySelectorAll("tbody td:nth-child(2), tbody td:nth-child(3), tbody td:nth-child(4)").forEach((cell) => { cell.style.fontVariantNumeric = "tabular-nums"; });
    table.querySelectorAll("button, a").forEach((control) => { control.style.touchAction = "manipulation"; });
  });
}).observe(dashboardGrid, { childList: true, subtree: true });
