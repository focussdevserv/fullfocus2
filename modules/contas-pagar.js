/* Tela operacional de contas a pagar. */
const payableEsc = (value) => escapeHtml(value ?? "");
const toast = (...args) => { if (location.hash === "#contas-a-pagar") ui.toast(...args); };
const payableMoneyFormatter = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const payableDateFormatter = new Intl.DateTimeFormat("pt-BR");
const payableMoney = (value) => payableMoneyFormatter.format(Number(value || 0));
const payableDate = (value) => { if (!value) return "—"; const date = new Date(value); return Number.isNaN(date.getTime()) ? "—" : payableDateFormatter.format(date); };
const payableStatus = { pending: "Pendente", overdue: "Vencida", paid: "Paga", cancelled: "Cancelada" };
const payableState = { search: "", status: "", offset: 0, request: 0 };
let payableTimer;
function payableDetails(item) { ui.drawer({ title: item.description || "Conta a pagar", subtitle: payableStatus[item.status] || "Financeiro", html: ui.facts([["Descrição", item.description], ["Fornecedor", item.supplier], ["Valor", payableMoney(item.amount)], ["Vencimento", payableDate(item.due_at)], ["Categoria", item.category], ["Forma de pagamento", item.payment_method], ["Status", payableStatus[item.status] || item.status], ["Pago em", payableDate(item.paid_at)]]) }); }
function payableForm(item = null) { ui.form({ title: item ? "Editar conta a pagar" : "Nova conta a pagar", subtitle: "Financeiro", values: item || {}, fields: [{ name: "description", label: "Descrição" }, { name: "supplier", label: "Fornecedor", required: false }, { name: "amount", label: "Valor", type: "number", min: 0.01, step: 0.01 }, { name: "due_at", label: "Vencimento", type: "date", required: false }, { name: "category", label: "Categoria", required: false }, { name: "payment_method", label: "Forma de pagamento", required: false }, { name: "status", label: "Status", type: "select", options: Object.entries(payableStatus) }], onSubmit: async (values) => { await api(item ? `/api/payables/${item.id}` : "/api/payables", { method: item ? "PATCH" : "POST", body: values }); toast(item ? "Conta atualizada." : "Conta criada.", "success"); renderPayablesScreen(); } }); }

async function renderPayablesScreen() {
  if (location.hash !== "#contas-a-pagar") return;
  const request = payableState.request = (payableState.request || 0) + 1;
  dashboardGrid.setAttribute("aria-busy", "true");
  const restoreSearchFocus = ui.keepSearchFocus(dashboardGrid, "[data-payable-search]");
  const title = "Contas a pagar", description = "Controle compromissos futuros, vencimentos e pagamentos dos fornecedores.";
  dashboardGrid.innerHTML = `<section class="page-intro"><div><p class="card-kicker">Financeiro</p><h2>${title}</h2><p>${description}</p></div><button class="button button-primary compact-action" data-payable-new type="button">+ Nova conta</button></section>${stateBlock.loading("Carregando contas a pagar…")}`;
  try {
    const params = new URLSearchParams({ limit: "100", offset: String(payableState.offset) }); if (payableState.search) params.set("search", payableState.search); if (payableState.status) params.set("status", payableState.status);
    const response = await api(`/api/payables?${params}`), items = response.payables || [], pagination = response.pagination || {}, open = items.filter((item) => !["paid", "cancelled"].includes(item.status));
    if (request !== payableState.request || location.hash !== "#contas-a-pagar") return;
    dashboardGrid.innerHTML = `<section class="page-intro"><div><p class="card-kicker">Financeiro</p><h2>${title}</h2><p>${description}</p></div><button class="button button-primary compact-action" data-payable-new type="button">+ Nova conta</button></section><section class="finance-metrics"><article class="data-card finance-metric"><span>Em aberto</span><strong>${payableMoney(open.reduce((sum, item) => sum + Number(item.amount || 0), 0))}</strong></article><article class="data-card finance-metric"><span>Vencidas</span><strong>${payableMoney(items.filter((item) => item.status === "overdue").reduce((sum, item) => sum + Number(item.amount || 0), 0))}</strong></article><article class="data-card finance-metric"><span>Pendentes</span><strong>${items.filter((item) => item.status === "pending").length}</strong></article><article class="data-card finance-metric"><span>Pagas</span><strong>${items.filter((item) => item.status === "paid").length}</strong></article></section><section class="data-card finance-list"><div class="finance-toolbar"><input type="search" data-payable-search value="${payableEsc(payableState.search)}" placeholder="Buscar descrição ou fornecedor…" aria-label="Buscar conta a pagar"><select data-payable-filter aria-label="Filtrar status"><option value="">Todos os status</option><option value="pending"${payableState.status === "pending" ? " selected" : ""}>Pendentes</option><option value="overdue"${payableState.status === "overdue" ? " selected" : ""}>Vencidas</option><option value="paid"${payableState.status === "paid" ? " selected" : ""}>Pagas</option><option value="cancelled"${payableState.status === "cancelled" ? " selected" : ""}>Canceladas</option></select></div><p class="ui-filter-status" data-payable-results role="status" aria-live="polite"></p>${items.length ? `<div class="table-wrap"><table class="finance-table"><thead><tr><th>Descrição</th><th>Fornecedor</th><th>Valor</th><th>Vencimento</th><th>Status</th><th>Ações</th></tr></thead><tbody>${items.map((item) => `<tr><td>${payableEsc(item.description)}</td><td>${payableEsc(item.supplier || "—")}</td><td>${payableMoney(item.amount)}</td><td>${payableDate(item.due_at)}</td><td><span class="finance-status ${item.status === "paid" ? "positive" : item.status === "overdue" ? "warning" : "neutral"}">${payableStatus[item.status] || payableEsc(item.status)}</span></td><td>${["pending", "overdue"].includes(item.status) ? `<button class="compact-action" data-payable-pay="${item.id}" type="button">Registrar pagamento</button>` : ""}<button class="compact-action" data-payable-delete="${item.id}" type="button">Excluir</button></td></tr>`).join("")}</tbody></table></div>` : stateBlock.empty("Nenhuma conta a pagar", "Cadastre um compromisso para acompanhar o vencimento.", "Criar agora", "payable-empty")}<div class="table-pagination"><button type="button" class="compact-action" data-payable-prev ${payableState.offset === 0 ? "disabled" : ""}>Anterior</button><span>Página ${Math.floor(payableState.offset / 100) + 1}</span><button type="button" class="compact-action" data-payable-next ${(pagination.returned ?? items.length) < 100 ? "disabled" : ""}>Próxima</button></div></section>`;
    dashboardGrid.querySelector(".finance-metrics")?.remove(); dashboardGrid.querySelector(".page-intro")?.insertAdjacentHTML("afterend", ui.stats([{ label: "Em aberto", value: payableMoney(open.reduce((sum, item) => sum + Number(item.amount || 0), 0)), tone: "orange" }, { label: "Vencidas", value: payableMoney(items.filter((item) => item.status === "overdue").reduce((sum, item) => sum + Number(item.amount || 0), 0)), tone: "red" }, { label: "Pendentes", value: ui.number(items.filter((item) => item.status === "pending").length) }, { label: "Pagas", value: ui.number(items.filter((item) => item.status === "paid").length), tone: "green" }]));
    dashboardGrid.removeAttribute("aria-busy");
    dashboardGrid.querySelector("[data-payable-new]")?.addEventListener("click", () => payableForm());
    dashboardGrid.querySelector(".payable-empty .compact-action")?.addEventListener("click", () => payableForm());
    dashboardGrid.querySelectorAll("tbody tr").forEach((row, index) => { const item = items[index], actions = row.lastElementChild; if (!item || !actions) return; const details = document.createElement("button"); details.className = "compact-action"; details.type = "button"; details.textContent = "Detalhes"; details.addEventListener("click", () => payableDetails(item)); const edit = document.createElement("button"); edit.className = "compact-action"; edit.type = "button"; edit.textContent = "Editar"; edit.addEventListener("click", () => payableForm(item)); actions.prepend(edit, details); });
    restoreSearchFocus();
    const reload = () => { payableState.search = dashboardGrid.querySelector("[data-payable-search]").value.trim(); payableState.status = dashboardGrid.querySelector("[data-payable-filter]").value; payableState.offset = 0; clearTimeout(payableTimer); payableTimer = setTimeout(renderPayablesScreen, 250); };
    dashboardGrid.querySelector("[data-payable-search]")?.addEventListener("input", reload); dashboardGrid.querySelector("[data-payable-filter]")?.addEventListener("change", reload);
    dashboardGrid.querySelector("[data-payable-prev]")?.addEventListener("click", () => { payableState.offset = Math.max(0, payableState.offset - 100); renderPayablesScreen(); }); dashboardGrid.querySelector("[data-payable-next]")?.addEventListener("click", () => { payableState.offset += 100; renderPayablesScreen(); });
    dashboardGrid.querySelectorAll("[data-payable-delete]").forEach((button) => button.addEventListener("click", () => ui.confirmInline(button, { text: "Excluir conta a pagar?", onConfirm: async () => { const originalLabel = button.textContent; button.disabled = true; button.setAttribute("aria-busy", "true"); button.textContent = "Excluindo…"; try { await api(`/api/payables/${button.dataset.payableDelete}`, { method: "DELETE" }); toast("Conta excluída.", "success"); renderPayablesScreen(); } catch (error) { button.disabled = false; button.removeAttribute("aria-busy"); button.textContent = originalLabel; toast(error.message, "error"); } } })));
  } catch (error) { if (request !== payableState.request || location.hash !== "#contas-a-pagar") return; dashboardGrid.removeAttribute("aria-busy"); dashboardGrid.innerHTML = `<section class="page-intro"><div><p class="card-kicker">Financeiro</p><h2>${title}</h2></div></section>${stateBlock.error(error.message, "payable-retry")}`; dashboardGrid.querySelector(".payable-retry")?.addEventListener("click", renderPayablesScreen); }
}

registerRoutes({ "contas-a-pagar": renderPayablesScreen });

dashboardGrid.addEventListener("click", (event) => {
  const button = event.target.closest?.("[data-payable-pay]");
  if (!button || button.disabled || button.dataset.pendingLabel) return;
  button.dataset.pendingLabel = button.textContent;
  button.textContent = "Registrando…";
}, true);

new MutationObserver(() => {
  dashboardGrid.querySelectorAll(".finance-table thead th").forEach((header) => header.setAttribute("scope", "col"));
  dashboardGrid.querySelectorAll(".finance-list .finance-status").forEach((status) => {
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
  });
  dashboardGrid.querySelectorAll("[data-payable-pay], [data-payable-delete]").forEach((button) => button.setAttribute("style", "touch-action: manipulation;"));
}).observe(dashboardGrid, { childList: true, subtree: true, attributes: true, attributeFilter: ["disabled"] });

new MutationObserver(() => {
  const table = dashboardGrid.querySelector(".finance-table");
  if (table && !table.caption) {
    const caption = document.createElement("caption");
    caption.className = "sr-only";
    caption.textContent = "Contas a pagar do workspace";
    table.prepend(caption);
  }
  table?.querySelectorAll("thead th").forEach((header) => header.setAttribute("scope", "col"));
  table?.querySelectorAll("tbody td:nth-child(3)").forEach((cell) => { cell.style.fontVariantNumeric = "tabular-nums"; });
  dashboardGrid.querySelectorAll("[data-payable-results], .finance-list .finance-status").forEach((status) => {
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
  });
  dashboardGrid.querySelectorAll("[data-payable-pay], [data-payable-delete]").forEach((button) => button.style.touchAction = "manipulation");
}).observe(dashboardGrid, { childList: true, subtree: true, attributes: true, attributeFilter: ["disabled"] });

new MutationObserver(() => {
  if (dashboardGrid.querySelector(".state-loading")) dashboardGrid.setAttribute("aria-busy", "true");
  else dashboardGrid.removeAttribute("aria-busy");
  const search = dashboardGrid.querySelector("[data-payable-search]");
  if (search) { search.name = "search"; search.setAttribute("autocomplete", "off"); }
  const status = dashboardGrid.querySelector("[data-payable-filter]");
  if (status) { status.name = "status"; status.setAttribute("autocomplete", "off"); }
  dashboardGrid.querySelectorAll(".state-loading p").forEach((label) => { label.textContent = label.textContent.replaceAll("...", "…"); });
  const results = dashboardGrid.querySelector("[data-payable-results]");
  if (results) { const count = dashboardGrid.querySelectorAll("tbody tr").length; const label = count === 1 ? "1 conta encontrada" : `${count} contas encontradas`; if (results.textContent !== label) results.textContent = label; }
  dashboardGrid.querySelectorAll("button:disabled, input:disabled, select:disabled").forEach((control) => control.setAttribute("aria-busy", "true"));
  dashboardGrid.querySelectorAll("[data-payable-pay]").forEach((button) => { if (!button.disabled && button.dataset.pendingLabel) { button.textContent = button.dataset.pendingLabel; delete button.dataset.pendingLabel; } });
}).observe(dashboardGrid, { childList: true, subtree: true });

dashboardGrid.addEventListener("click", (event) => {
  const button = event.target.closest?.("[data-payable-pay]");
  if (!button || button.disabled || button.dataset.paymentConfirm === "1") return;
  event.preventDefault();
  event.stopImmediatePropagation();
  button.dataset.paymentConfirm = "1";
  const routeAtStart = location.hash;
  ui.confirmInline(button, {
    text: "Registrar pagamento desta conta?",
    onConfirm: async () => {
      button.disabled = true;
      button.setAttribute("aria-busy", "true");
      button.textContent = "Registrando…";
      try {
        await api(`/api/payables/${button.dataset.payablePay}/record-payment`, { method: "POST", body: {} });
        if (location.hash !== routeAtStart || routeAtStart !== "#contas-a-pagar" || !button.isConnected) return;
        toast("Pagamento registrado e despesa confirmada.", "success");
        renderPayablesScreen();
      } catch (error) {
        if (location.hash !== routeAtStart || !button.isConnected) return;
        button.disabled = false;
        button.removeAttribute("aria-busy");
        button.textContent = "Registrar pagamento";
        throw error;
      } finally {
        button.dataset.paymentConfirm = "";
      }
    }
  });
}, true);

dashboardGrid.addEventListener("click", (event) => {
  const button = event.target.closest?.("[data-payable-delete]");
  if (!button || location.hash !== "#contas-a-pagar" || button.dataset.deleteGuarded === "1") return;
  event.preventDefault();
  event.stopImmediatePropagation();
  button.dataset.deleteGuarded = "1";
  const routeAtStart = location.hash;
  const requestAtStart = payableState.request;
  ui.confirmInline(button, {
    text: "Excluir conta a pagar?",
    onConfirm: async () => {
      const originalLabel = button.textContent;
      button.disabled = true;
      button.setAttribute("aria-busy", "true");
      button.textContent = "Excluindo…";
      try {
        await api(`/api/payables/${button.dataset.payableDelete}`, { method: "DELETE" });
        if (location.hash !== routeAtStart || routeAtStart !== "#contas-a-pagar" || requestAtStart !== payableState.request || !button.isConnected) return;
        toast("Conta excluída.", "success");
        renderPayablesScreen();
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
        delete button.dataset.deleteGuarded;
      }
    },
    onCancel: () => { delete button.dataset.deleteGuarded; },
  });
}, true);
