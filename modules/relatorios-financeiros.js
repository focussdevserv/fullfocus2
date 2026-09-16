/* Relatórios financeiros exportáveis a partir do resumo real do workspace. */
const reportEsc = (value) => escapeHtml(value ?? "");
const toast = (...args) => { if (location.hash === "#relatorios") ui.toast(...args); };
const reportMoneyFormatter = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const reportMoney = (value) => reportMoneyFormatter.format(Number(value || 0));

function downloadReport(name, content, type) { const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([content], { type })); link.download = name; link.style.display = "none"; document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(link.href), 1000); }
function reportRows(rows) { return rows.map((row) => `<tr><td>${reportEsc(row.month)}</td><td>${reportMoney(row.revenue)}</td><td>${reportMoney(row.expense)}</td><td>${reportMoney(row.result)}</td></tr>`).join(""); }
const reportState = { months: 12, clientId: "", projectId: "", request: 0 };
function reportDetails(row) { ui.drawer({ title: `Resumo de ${row.month || "período"}`, subtitle: "Relatório financeiro", html: ui.facts([["Mês", row.month], ["Receitas", reportMoney(row.revenue)], ["Despesas", reportMoney(row.expense)], ["Resultado", reportMoney(row.result)]]) }); }

async function renderFinancialReports() {
  if (location.hash !== "#relatorios") return;
  const request = reportState.request = (reportState.request || 0) + 1;
  dashboardGrid.setAttribute("aria-busy", "true");
  const title = "Relatórios", description = "Compare receitas, despesas e resultado do workspace por período.";
  dashboardGrid.innerHTML = `<section class="page-intro"><div><p class="card-kicker">Financeiro</p><h2>${title}</h2><p>${description}</p></div></section>${stateBlock.loading("Carregando relatório…")}`;
  try {
    const [summaryData, clientData, projectData] = await Promise.all([api(`/api/finance/summary?months=${Math.min(24, Math.max(1, reportState.months))}${reportState.clientId ? `&client_id=${encodeURIComponent(reportState.clientId)}` : ""}${reportState.projectId ? `&project_id=${encodeURIComponent(reportState.projectId)}` : ""}`), api("/api/clients?limit=250"), api("/api/projects?limit=250")]);
    if (request !== reportState.request || location.hash !== "#relatorios") return;
    const rows = summaryData.summary || [], clients = clientData.clients || [], projects = projectData.projects || [];
    const totals = rows.reduce((out, row) => ({ revenue: out.revenue + Number(row.revenue || 0), expense: out.expense + Number(row.expense || 0), result: out.result + Number(row.result || 0) }), { revenue: 0, expense: 0, result: 0 });
    dashboardGrid.innerHTML = `<section class="page-intro"><div><p class="card-kicker">Financeiro</p><h2>${title}</h2><p>${description}</p></div><div class="page-actions"><button class="button button-secondary compact-action" data-report-print type="button">Visualizar / PDF</button><button class="button button-secondary compact-action" data-report-xls type="button">Excel</button><button class="button button-primary compact-action" data-report-csv type="button">CSV</button></div></section><section class="finance-metrics"><article class="data-card finance-metric"><span>Receitas no período</span><strong>${reportMoney(totals.revenue)}</strong></article><article class="data-card finance-metric"><span>Despesas no período</span><strong>${reportMoney(totals.expense)}</strong></article><article class="data-card finance-metric"><span>Resultado</span><strong>${reportMoney(totals.result)}</strong></article></section><section class="data-card finance-list"><div class="finance-toolbar"><label>Período<select data-report-period aria-label="Período do relatório"><option value="6"${reportState.months === 6 ? " selected" : ""}>Últimos 6 meses</option><option value="12"${reportState.months === 12 ? " selected" : ""}>Últimos 12 meses</option><option value="24"${reportState.months === 24 ? " selected" : ""}>Últimos 24 meses</option></select></label><label>Cliente<select data-report-client aria-label="Filtrar cliente"><option value="">Todos os clientes</option>${clients.map((item) => `<option value="${reportEsc(item.id)}"${String(reportState.clientId) === String(item.id) ? " selected" : ""}>${reportEsc(item.name)}</option>`).join("")}</select></label><label>Projeto<select data-report-project aria-label="Filtrar projeto"><option value="">Todos os projetos</option>${projects.map((item) => `<option value="${reportEsc(item.id)}"${String(reportState.projectId) === String(item.id) ? " selected" : ""}>${reportEsc(item.name)}</option>`).join("")}</select></label></div><div class="table-wrap"><table class="finance-table"><caption class="sr-only">Resumo financeiro por mês</caption><thead><tr><th scope="col">Mês</th><th scope="col">Receitas</th><th scope="col">Despesas</th><th scope="col">Resultado</th></tr></thead><tbody>${reportRows(rows) || `<tr><td colspan="4">Nenhuma movimentação no período.</td></tr>`}</tbody></table></div></section>`;
    dashboardGrid.querySelector(".finance-metrics")?.remove(); dashboardGrid.querySelector(".page-intro")?.insertAdjacentHTML("afterend", ui.stats([{ label: "Receitas no período", value: reportMoney(totals.revenue), tone: "green" }, { label: "Despesas no período", value: reportMoney(totals.expense), tone: "orange" }, { label: "Resultado", value: reportMoney(totals.result), tone: totals.result >= 0 ? "green" : "red" }]));
    dashboardGrid.querySelectorAll(".finance-list tbody tr").forEach((row, index) => { if (!rows[index] || row.children.length < 4) return; const detail = document.createElement("button"); detail.className = "compact-action"; detail.type = "button"; detail.textContent = "Detalhes"; detail.addEventListener("click", () => reportDetails(rows[index])); const cell = document.createElement("td"); cell.append(detail); row.append(cell); });
    dashboardGrid.querySelector(".finance-list thead tr")?.insertAdjacentHTML("beforeend", '<th scope="col">Ações</th>');
    dashboardGrid.querySelector('.finance-list tbody td[colspan="4"]')?.setAttribute("colspan", "5");
    const period = dashboardGrid.querySelector("[data-report-period]"), client = dashboardGrid.querySelector("[data-report-client]"), project = dashboardGrid.querySelector("[data-report-project]");
    [[period, "months"], [client, "client_id"], [project, "project_id"]].forEach(([control, name]) => { if (!control) return; control.name = name; control.setAttribute("autocomplete", "off"); });
    const reload = () => { const months = Number(period.value); reportState.months = [6, 12, 24].includes(months) ? months : 12; reportState.clientId = client.value; reportState.projectId = project.value; renderFinancialReports(); };
    dashboardGrid.querySelector("[data-report-period]")?.addEventListener("change", reload); dashboardGrid.querySelector("[data-report-client]")?.addEventListener("change", reload); dashboardGrid.querySelector("[data-report-project]")?.addEventListener("change", reload);
    dashboardGrid.querySelector("[data-report-csv]")?.addEventListener("click", (event) => { const button = event.currentTarget; if (button.disabled) return; button.disabled = true; button.setAttribute("aria-busy", "true"); try { ui.downloadCsv("relatorio-financeiro.csv", ["Mês", "Receitas", "Despesas", "Resultado"], rows.map((row) => [row.month, row.revenue, row.expense, row.result])); } finally { button.disabled = false; button.removeAttribute("aria-busy"); } });
    dashboardGrid.querySelector("[data-report-xls]")?.addEventListener("click", (event) => { const button = event.currentTarget; if (button.disabled) return; button.disabled = true; button.setAttribute("aria-busy", "true"); try { const html = `<table><thead><tr><th>Mês</th><th>Receitas</th><th>Despesas</th><th>Resultado</th></tr></thead><tbody>${rows.map((row) => `<tr><td>${reportEsc(row.month)}</td><td>${Number(row.revenue || 0)}</td><td>${Number(row.expense || 0)}</td><td>${Number(row.result || 0)}</td></tr>`).join("")}</tbody></table>`; downloadReport("relatorio-financeiro.xls", `<!doctype html><html><meta charset="utf-8">${html}</html>`, "application/vnd.ms-excel;charset=utf-8"); } finally { button.disabled = false; button.removeAttribute("aria-busy"); } });
    dashboardGrid.querySelector("[data-report-print]")?.addEventListener("click", (event) => { const button = event.currentTarget; if (button.disabled) return; button.disabled = true; button.setAttribute("aria-busy", "true"); try { const popup = window.open("", "_blank", "noopener,noreferrer"); if (!popup) { toast("Permita pop-ups para visualizar o relatório.", "error"); return; } popup.document.write(`<!doctype html><html lang="pt-BR"><meta charset="utf-8"><title>Relatório financeiro FocusDev</title><style>body{font-family:Arial,sans-serif;margin:40px;color:#111}table{border-collapse:collapse;width:100%}th,td{padding:10px;border:1px solid #ddd;text-align:right}th:first-child,td:first-child{text-align:left}h1{margin-bottom:4px}p{color:#555}</style><h1>Relatório financeiro FocusDev</h1><p>Resumo dos últimos ${reportState.months} meses</p><table><thead><tr><th>Mês</th><th>Receitas</th><th>Despesas</th><th>Resultado</th></tr></thead><tbody>${reportRows(rows)}</tbody></table><script>window.onload=()=>window.print();<\/script></html>`); popup.document.close(); } finally { button.disabled = false; button.removeAttribute("aria-busy"); } });
  } catch (error) { if (request !== reportState.request || location.hash !== "#relatorios") return; dashboardGrid.removeAttribute("aria-busy"); dashboardGrid.innerHTML = `<section class="page-intro"><div><p class="card-kicker">Financeiro</p><h2>${title}</h2></div></section>${stateBlock.error(error.message, "report-retry")}`; dashboardGrid.querySelector(".report-retry")?.addEventListener("click", renderFinancialReports); }
}

registerRoutes({ relatorios: renderFinancialReports });
window.addEventListener("hashchange", () => { if (location.hash !== "#relatorios") reportState.request += 1; });
dashboardGrid.addEventListener("click", (event) => {
  const button = event.target.closest?.("[data-report-print], [data-report-xls], [data-report-csv]");
  if (!button || button.disabled || button.dataset.pendingLabel) return;
  button.dataset.pendingLabel = button.textContent;
  button.textContent = button.matches("[data-report-print]") ? "Preparando visualização…" : button.matches("[data-report-xls]") ? "Gerando Excel…" : "Gerando CSV…";
}, true);

new MutationObserver(() => {
  if (dashboardGrid.querySelector(".state-loading")) dashboardGrid.setAttribute("aria-busy", "true");
  else dashboardGrid.removeAttribute("aria-busy");
  dashboardGrid.querySelectorAll("button, select").forEach((control) => { control.style.touchAction = "manipulation"; });
  const list = dashboardGrid.querySelector(".finance-list");
  const table = list?.querySelector("tbody");
  if (!list || !table || !dashboardGrid.querySelector("[data-report-period]")) return;
  let status = list.querySelector("[data-report-results]");
  if (!status) {
    status = document.createElement("p");
    status.className = "ui-filter-status";
    status.dataset.reportResults = "true";
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    list.querySelector(".finance-toolbar")?.after(status);
  }
  const rows = [...table.rows].filter((row) => row.children.length > 1 && !row.hasAttribute("colspan")).length;
  const label = rows === 1 ? "1 mês no relatório" : `${rows} meses no relatório`;
  if (status.textContent !== label) status.textContent = label;
  dashboardGrid.querySelectorAll("[data-report-print], [data-report-xls], [data-report-csv]").forEach((button) => { if (!button.disabled && button.dataset.pendingLabel) { button.textContent = button.dataset.pendingLabel; delete button.dataset.pendingLabel; } });
}).observe(dashboardGrid, { childList: true, subtree: true, attributes: true, attributeFilter: ["disabled"] });
