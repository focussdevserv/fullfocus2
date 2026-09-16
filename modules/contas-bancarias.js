/* Visão de contas e carteiras com saldo e extrato real do workspace. */
const bankEsc = (value) => escapeHtml(value ?? "");
const toast = (...args) => { if (location.hash === "#contas-bancarias") ui.toast(...args); };
const bankMoneyFormatter = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const bankDateFormatter = new Intl.DateTimeFormat("pt-BR");
const bankMoney = (value) => bankMoneyFormatter.format(Number(value || 0));
const bankDate = (value) => { if (!value) return "—"; const date = new Date(value); return Number.isNaN(date.getTime()) ? "—" : bankDateFormatter.format(date); };
const bankState = { search: "", status: "", offset: 0, request: 0 };
let bankTimer;
function bankDetails(account, transactions = []) { ui.drawer({ title: account.name || "Conta bancária", subtitle: account.status === "active" ? "Ativa" : "Inativa", html: `${ui.facts([["Tipo", account.kind], ["Saldo inicial", bankMoney(account.opening_balance)], ["Saldo atual", bankMoney(account.current_balance ?? account.opening_balance)], ["Status", account.status === "active" ? "Ativa" : "Inativa"]])}<h3>Movimentações recentes</h3>${transactions.length ? transactions.slice(0, 10).map((item) => `<p>${item.kind === "credit" ? "+" : "−"}${bankMoney(item.amount)} · ${bankEsc(item.description)}</p>`).join("") : "<p>Nenhuma movimentação registrada.</p>"}` }); }
function bankForm(account = null) { const routeAtStart = location.hash; if (routeAtStart !== "#contas-bancarias") return; ui.form({ title: account ? "Editar conta bancária" : "Nova conta bancária", subtitle: "Financeiro", values: account || {}, fields: [{ name: "name", label: "Nome" }, { name: "kind", label: "Tipo", required: false }, { name: "opening_balance", label: "Saldo inicial", type: "number", step: 0.01, required: false }, { name: "status", label: "Status", type: "select", options: [["active", "Ativa"], ["inactive", "Inativa"]] }], onSubmit: async (values) => { await api(account ? `/api/bank_accounts/${account.id}` : "/api/bank_accounts", { method: account ? "PATCH" : "POST", body: values }); if (location.hash !== routeAtStart || location.hash !== "#contas-bancarias") return; toast(account ? "Conta atualizada." : "Conta criada.", "success"); renderBankAccountsScreen(); } }); }

async function renderBankAccountsScreen() {
  if (location.hash !== "#contas-bancarias") return;
  const request = bankState.request = (bankState.request || 0) + 1;
  dashboardGrid.setAttribute("aria-busy", "true");
  const restoreSearchFocus = ui.keepSearchFocus(dashboardGrid, "[data-bank-search]");
  const title = "Contas bancárias", description = "Controle saldos, entradas, saídas e histórico por conta.";
  dashboardGrid.innerHTML = `<section class="page-intro"><div><p class="card-kicker">Financeiro</p><h2>${title}</h2><p>${description}</p></div><button class="button button-primary compact-action" data-bank-new type="button">+ Nova conta</button></section>${stateBlock.loading("Carregando contas…")}`;
  try {
    const params = new URLSearchParams({ limit: "100", offset: String(bankState.offset) }); if (bankState.search) params.set("search", bankState.search); if (bankState.status) params.set("status", bankState.status);
    const accountResponse = await api(`/api/bank_accounts?${params}`);
    if (request !== bankState.request || location.hash !== "#contas-bancarias") return;
    const accounts = accountResponse.bank_accounts || [], pagination = accountResponse.pagination || {};
    const enriched = await Promise.all(accounts.map(async (account) => { try { return { account, transactions: ((await api(`/api/bank_accounts/${account.id}/transactions`)).transactions || []), transactionError: false }; } catch { return { account, transactions: [], transactionError: true }; } }));
    if (request !== bankState.request || location.hash !== "#contas-bancarias") return;
    const total = accounts.reduce((sum, account) => sum + Number(account.current_balance ?? account.opening_balance ?? 0), 0);
    dashboardGrid.innerHTML = `<section class="page-intro"><div><p class="card-kicker">Financeiro</p><h2>${title}</h2><p>${description}</p></div><button class="button button-primary compact-action" data-bank-new type="button">+ Nova conta</button></section><section class="finance-metrics"><article class="data-card finance-metric"><span>Saldo consolidado</span><strong>${bankMoney(total)}</strong></article><article class="data-card finance-metric"><span>Contas ativas</span><strong>${accounts.filter((item) => item.status === "active").length}</strong></article><article class="data-card finance-metric"><span>Entradas registradas</span><strong>${bankMoney(enriched.flatMap((item) => item.transactions).filter((item) => item.kind === "credit").reduce((sum, item) => sum + Number(item.amount || 0), 0))}</strong></article><article class="data-card finance-metric"><span>Saídas registradas</span><strong>${bankMoney(enriched.flatMap((item) => item.transactions).filter((item) => item.kind === "debit").reduce((sum, item) => sum + Number(item.amount || 0), 0))}</strong></article></section><section class="data-card finance-list"><div class="finance-toolbar"><input type="search" data-bank-search value="${bankEsc(bankState.search)}" placeholder="Buscar conta ou movimentação…" aria-label="Buscar conta ou movimentação"><select data-bank-filter aria-label="Filtrar situação"><option value="">Todas as contas</option><option value="active"${bankState.status === "active" ? " selected" : ""}>Ativas</option><option value="inactive"${bankState.status === "inactive" ? " selected" : ""}>Inativas</option></select></div>${accounts.length ? `<div class="bank-account-grid">${enriched.map(({ account, transactions }) => `<article class="data-card bank-account-card"><div class="section-heading"><div><h3>${bankEsc(account.name || "Conta sem nome")}</h3><small>${bankEsc(account.kind || "Conta bancária")}</small></div><span class="finance-status ${account.status === "active" ? "positive" : "neutral"}">${account.status === "active" ? "Ativa" : "Inativa"}</span></div><strong class="bank-balance">${bankMoney(account.current_balance ?? account.opening_balance)}</strong><small>Saldo inicial: ${bankMoney(account.opening_balance)}</small><div class="bank-account-actions"><button class="compact-action" data-bank-movement="${account.id}" type="button">Movimentar</button><button class="compact-action" data-bank-toggle="${account.id}" data-next="${account.status === "active" ? "inactive" : "active"}" type="button">${account.status === "active" ? "Desativar" : "Ativar"}</button><button class="compact-action" data-bank-delete="${account.id}" type="button">Excluir</button></div><details class="bank-extract"><summary>Extrato (${transactions.length})</summary>${transactions.length ? `<div class="bank-transactions">${transactions.slice(0, 20).map((item) => `<div class="bank-transaction"><span class="${item.kind === "credit" ? "positive" : "warning"}">${item.kind === "credit" ? "+" : "−"}${bankMoney(item.amount)}</span><span>${bankEsc(item.description || "Movimentação sem descrição")}</span><small>${bankDate(item.occurred_at || item.created_at)}</small></div>`).join("")}</div>` : `<p class="muted">Nenhuma movimentação registrada.</p>`}</details></article>`).join("")}</div>` : stateBlock.empty("Nenhuma conta bancária", "Cadastre uma conta ou carteira para acompanhar o caixa.", "Criar conta", "bank-empty")}<div class="table-pagination"><button type="button" class="compact-action" data-bank-prev ${bankState.offset === 0 ? "disabled" : ""}>Anterior</button><span>Página ${Math.floor(bankState.offset / 100) + 1}</span><button type="button" class="compact-action" data-bank-next ${(pagination.returned ?? accounts.length) < 100 ? "disabled" : ""}>Próxima</button></div></section>`;
    dashboardGrid.querySelector(".finance-metrics")?.remove(); dashboardGrid.querySelector(".page-intro")?.insertAdjacentHTML("afterend", ui.stats([{ label: "Saldo consolidado", value: bankMoney(total), tone: total >= 0 ? "green" : "red" }, { label: "Contas ativas", value: ui.number(accounts.filter((item) => item.status === "active").length) }, { label: "Entradas", value: bankMoney(enriched.flatMap((item) => item.transactions).filter((item) => item.kind === "credit").reduce((sum, item) => sum + Number(item.amount || 0), 0)), tone: "green" }, { label: "Saídas", value: bankMoney(enriched.flatMap((item) => item.transactions).filter((item) => item.kind === "debit").reduce((sum, item) => sum + Number(item.amount || 0), 0)), tone: "orange" }]));
    const openNew = () => bankForm();
    if (enriched.some((item) => item.transactionError)) dashboardGrid.querySelector(".finance-list")?.insertAdjacentHTML("afterbegin", `<p class="muted" role="status" aria-live="polite">Alguns extratos não puderam ser carregados agora. Tente novamente em instantes.</p>`);
    dashboardGrid.querySelector("[data-bank-new]")?.addEventListener("click", openNew); dashboardGrid.querySelector(".bank-empty")?.querySelector(".compact-action")?.addEventListener("click", openNew);
    dashboardGrid.querySelectorAll(".bank-account-card").forEach((card, index) => { const entry = enriched[index], account = entry?.account; if (!account) return; const details = document.createElement("button"); details.className = "compact-action"; details.type = "button"; details.textContent = "Detalhes"; details.addEventListener("click", () => bankDetails(account, entry.transactions)); const edit = document.createElement("button"); edit.className = "compact-action"; edit.type = "button"; edit.textContent = "Editar"; edit.addEventListener("click", () => bankForm(account)); card.querySelector(".bank-account-actions")?.prepend(edit, details); });
    restoreSearchFocus();
    const bankSearch = dashboardGrid.querySelector("[data-bank-search]");
    bankSearch?.setAttribute("name", "search");
    bankSearch?.setAttribute("autocomplete", "off");
    const bankFilter = dashboardGrid.querySelector("[data-bank-filter]");
    bankFilter?.setAttribute("name", "status");
    bankFilter?.setAttribute("autocomplete", "off");
    const reload = () => { bankState.search = dashboardGrid.querySelector("[data-bank-search]").value.trim(); bankState.status = dashboardGrid.querySelector("[data-bank-filter]").value; bankState.offset = 0; clearTimeout(bankTimer); bankTimer = setTimeout(renderBankAccountsScreen, 250); };
    dashboardGrid.querySelector("[data-bank-search]")?.addEventListener("input", reload); dashboardGrid.querySelector("[data-bank-filter]")?.addEventListener("change", reload);
    dashboardGrid.querySelector("[data-bank-prev]")?.addEventListener("click", () => { bankState.offset = Math.max(0, bankState.offset - 100); renderBankAccountsScreen(); }); dashboardGrid.querySelector("[data-bank-next]")?.addEventListener("click", () => { bankState.offset += 100; renderBankAccountsScreen(); });
    dashboardGrid.querySelectorAll("[data-bank-toggle]").forEach((button) => button.addEventListener("click", async () => { button.disabled = true; try { await api(`/api/bank_accounts/${button.dataset.bankToggle}`, { method: "PATCH", body: { status: button.dataset.next } }); if (location.hash === "#contas-bancarias") { toast("Conta atualizada.", "success"); renderBankAccountsScreen(); } } catch (error) { button.disabled = false; if (location.hash === "#contas-bancarias") toast(error.message, "error"); } }));
    dashboardGrid.querySelectorAll("[data-bank-delete]").forEach((button) => button.addEventListener("click", () => ui.confirmInline(button, { text: "Excluir conta e seu histórico?", onConfirm: async () => { if (button.disabled) return; const originalLabel = button.textContent; button.disabled = true; button.setAttribute("aria-busy", "true"); button.textContent = "Excluindo…"; try { await api(`/api/bank_accounts/${button.dataset.bankDelete}`, { method: "DELETE" }); if (location.hash === "#contas-bancarias") { toast("Conta excluída.", "success"); renderBankAccountsScreen(); } } catch (error) { button.disabled = false; button.removeAttribute("aria-busy"); button.textContent = originalLabel; toast(error.message, "error"); } } })));
  } catch (error) { if (request !== bankState.request || location.hash !== "#contas-bancarias") return; dashboardGrid.innerHTML = `<section class="page-intro"><div><p class="card-kicker">Financeiro</p><h2>${title}</h2></div></section>${stateBlock.error(error.message, "bank-retry")}`; dashboardGrid.querySelector(".bank-retry")?.addEventListener("click", renderBankAccountsScreen); }
}

registerRoutes({ "contas-bancarias": renderBankAccountsScreen });

dashboardGrid.addEventListener("click", (event) => {
  const button = event.target.closest?.("[data-bank-movement]");
  if (!button || button.disabled || button.dataset.movementConfirm === "1") return;
  event.preventDefault();
  event.stopImmediatePropagation();
  button.dataset.movementConfirm = "1";
  ui.confirmInline(button, {
    text: "Registrar esta movimentação e atualizar o saldo?",
    onConfirm: async () => {
      button.disabled = true;
      button.setAttribute("aria-busy", "true");
      try {
        const accountId = button.dataset.bankMovement;
        ui.form({ title: "Registrar movimentação", subtitle: "A alteração atualiza o saldo da conta.", fields: [{ name: "kind", label: "Tipo", type: "select", options: [["credit", "Entrada"], ["debit", "Saída"]] }, { name: "amount", label: "Valor", type: "number", min: 0.01, step: 0.01 }, { name: "description", label: "Descrição" }], onSubmit: async (values) => { await api(`/api/bank_accounts/${accountId}/transactions`, { method: "POST", body: values }); toast("Movimentação registrada.", "success"); renderBankAccountsScreen(); } });
      } finally {
        button.disabled = false;
        button.removeAttribute("aria-busy");
        button.dataset.movementConfirm = "";
      }
    },
    onCancel: () => { button.dataset.movementConfirm = ""; }
  });
}, true);

dashboardGrid.addEventListener("click", (event) => {
  const button = event.target.closest?.("[data-bank-toggle]");
  if (!button || button.disabled || button.dataset.pendingLabel) return;
  button.dataset.pendingLabel = button.textContent;
  button.textContent = "Atualizando…";
}, true);

dashboardGrid.addEventListener("click", (event) => {
  const button = event.target.closest?.("[data-bank-toggle], [data-bank-delete]");
  if (!button || button.dataset.bankActionGuarded === "1") return;
  event.preventDefault();
  event.stopImmediatePropagation();
  const routeAtStart = location.hash;
  button.dataset.bankActionGuarded = "1";
  const isDelete = button.dataset.bankDelete !== undefined;
  if (!isDelete) {
    const originalLabel = button.textContent;
    button.disabled = true;
    button.setAttribute("aria-busy", "true");
    button.textContent = "Atualizando…";
    api(`/api/bank_accounts/${button.dataset.bankToggle}`, { method: "PATCH", body: { status: button.dataset.next } })
      .then(() => { if (location.hash !== routeAtStart || routeAtStart !== "#contas-bancarias" || !button.isConnected) return; toast("Conta atualizada.", "success"); renderBankAccountsScreen(); })
      .catch((error) => { if (location.hash !== routeAtStart || !button.isConnected) return; button.disabled = false; button.removeAttribute("aria-busy"); button.textContent = originalLabel; toast(error.message, "error"); })
      .finally(() => { if (button.isConnected) delete button.dataset.bankActionGuarded; });
    return;
  }
  ui.confirmInline(button, {
    text: "Excluir conta e seu histórico?",
    onConfirm: async () => {
      if (location.hash !== routeAtStart || button.disabled) return;
      button.disabled = true;
      button.setAttribute("aria-busy", "true");
      button.textContent = "Excluindo…";
      try {
        await api(`/api/bank_accounts/${button.dataset.bankDelete}`, { method: "DELETE" });
        if (location.hash !== routeAtStart || routeAtStart !== "#contas-bancarias" || !button.isConnected) return;
        toast("Conta excluída.", "success");
        renderBankAccountsScreen();
      } catch (error) {
        if (location.hash !== routeAtStart || !button.isConnected) return;
        button.disabled = false;
        button.removeAttribute("aria-busy");
        button.textContent = "Excluir";
        throw error;
      } finally { if (button.isConnected) delete button.dataset.bankActionGuarded; }
    },
    onCancel: () => { delete button.dataset.bankActionGuarded; },
  });
}, true);

new MutationObserver(() => {
  if (dashboardGrid.querySelector(".state-loading")) dashboardGrid.setAttribute("aria-busy", "true");
  else dashboardGrid.removeAttribute("aria-busy");
  dashboardGrid.querySelectorAll("[data-bank-search], [data-bank-filter]").forEach((control) => {
    control.name = control.matches("[data-bank-search]") ? "search" : "status";
    control.setAttribute("autocomplete", "off");
  });
  dashboardGrid.querySelectorAll(".state-loading p").forEach((label) => { label.textContent = label.textContent.replaceAll("...", "…"); });
  dashboardGrid.querySelectorAll("button:disabled, input:disabled, select:disabled").forEach((control) => control.setAttribute("aria-busy", "true"));
  dashboardGrid.querySelectorAll("[data-bank-toggle]").forEach((button) => { if (button.disabled) button.setAttribute("aria-busy", "true"); else { button.removeAttribute("aria-busy"); if (button.dataset.pendingLabel) { button.textContent = button.dataset.pendingLabel; delete button.dataset.pendingLabel; } } });
  const list = dashboardGrid.querySelector(".finance-list");
  if (list) {
    let status = list.querySelector("[data-bank-results]");
    if (!status) { status = document.createElement("p"); status.className = "ui-filter-status"; status.dataset.bankResults = "true"; status.setAttribute("role", "status"); status.setAttribute("aria-live", "polite"); list.querySelector(".finance-toolbar")?.after(status); }
    const count = list.querySelectorAll(".bank-account-card").length;
    const label = count === 1 ? "1 conta encontrada" : `${count} contas encontradas`;
    if (status.textContent !== label) status.textContent = label;
  }
}).observe(dashboardGrid, { childList: true, subtree: true, attributes: true, attributeFilter: ["disabled"] });

const bankAccountKinds = [["checking", "Conta corrente"], ["savings", "Poupança"], ["wallet", "Carteira"], ["other", "Outra"]];
new MutationObserver(() => {
  document.querySelectorAll('.ui-modal[aria-label="Nova conta bancária"], .ui-modal[aria-label="Editar conta bancária"]').forEach((modal) => {
    const input = modal.elements?.kind;
    if (!input || input.tagName === "SELECT") return;
    const select = document.createElement("select");
    select.name = "kind";
    select.autocomplete = "off";
    bankAccountKinds.forEach(([value, label]) => select.add(new Option(label, value, false, value === input.value || label === input.value)));
    input.replaceWith(select);
  });
}).observe(document.body, { childList: true, subtree: true });
