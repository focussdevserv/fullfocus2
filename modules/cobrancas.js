const chargeEsc = (value) => escapeHtml(value ?? "");
const toast = (...args) => { if (location.hash === "#cobrancas") ui.toast(...args); };
const chargeMoneyFormatter = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const chargeMoney = (value) => chargeMoneyFormatter.format(Number(value || 0));
const chargeDate = (value) => { if (!value) return "—"; const parsed = new Date(value); return Number.isNaN(parsed.getTime()) ? "—" : new Intl.DateTimeFormat("pt-BR").format(parsed); };
const chargeStatus = { draft: "Rascunho", generated: "Gerada", sent: "Enviada", viewed: "Visualizada", pending: "Pendente", paid: "Paga", overdue: "Vencida", cancelled: "Cancelada", refunded: "Reembolsada" };
const chargeTone = (status) => status === "paid" ? "positive" : ["overdue", "cancelled"].includes(status) ? "warning" : "neutral";
const chargeFilter = { search: "", status: "", request: 0 };
function chargeDetails(item) { ui.drawer({ title: item.message || "Cobrança", subtitle: chargeStatus[item.status] || "Financeiro", html: ui.facts([["Mensagem", item.message], ["Canal", item.channel], ["Valor", chargeMoney(item.amount)], ["Vencimento", chargeDate(item.due_at)], ["Recebível", item.receivable_id], ["Provedor", item.provider], ["Link de pagamento", item.payment_url], ["Status", chargeStatus[item.status] || item.status]]) }); }
async function chargeForm(item = null) {
  const routeAtStart = location.hash;
  if (routeAtStart !== "#cobrancas") return;
  let receivables = [];
  if (!item) {
    try {
      receivables = (await api("/api/receivables")).receivables || [];
    } catch (error) {
      if (location.hash === routeAtStart) toast(error.message || "Não foi possível carregar as contas a receber.", "error");
      return;
    }
  }
  if (location.hash !== routeAtStart || location.hash !== "#cobrancas") return;
  ui.form({ title: item ? "Editar cobrança" : "Nova cobrança", subtitle: "Financeiro", values: item || {}, fields: [{ name: "receivable_id", label: "Conta a receber", type: "select", required: false, options: [["", "Sem vínculo"], ...receivables.map((entry) => [entry.id, `${entry.description} · ${chargeMoney(entry.amount)}`])] }, { name: "amount", label: "Valor", type: "number", min: 0.01, step: 0.01 }, { name: "channel", label: "Canal", type: "select", options: [["pix", "Pix"], ["boleto", "Boleto"], ["card", "Cartão"], ["link", "Link de pagamento"], ["transfer", "Transferência"]] }, { name: "due_at", label: "Vencimento", type: "date", required: false }, { name: "message", label: "Mensagem", required: false }, { name: "status", label: "Status", type: "select", options: Object.entries(chargeStatus) }], onSubmit: async (values) => { await api(item ? `/api/charges/${item.id}` : "/api/charges", { method: item ? "PATCH" : "POST", body: values }); if (location.hash !== routeAtStart || location.hash !== "#cobrancas") return; toast(item ? "Cobrança atualizada." : "Cobrança criada.", "success"); renderChargesScreen(); } });
}

async function renderChargesScreen() {
  if (location.hash !== "#cobrancas") return;
  const request = chargeFilter.request = (chargeFilter.request || 0) + 1;
  const title = "Cobranças", description = "Acompanhe solicitações de pagamento ligadas às contas a receber.";
  dashboardGrid.setAttribute("aria-busy", "true");
  dashboardGrid.innerHTML = `<section class="page-intro"><div><p class="card-kicker">Financeiro</p><h2>${title}</h2><p>${description}</p></div><button class="button button-primary compact-action" data-charge-new type="button">+ Nova cobrança</button></section>${stateBlock.loading("Carregando cobranças…")}`;
  try {
    const params = new URLSearchParams(); if (chargeFilter.search) params.set("search", chargeFilter.search); if (chargeFilter.status) params.set("status", chargeFilter.status); const items = (await api(`/api/charges?${params}`)).charges || [];
    if (request !== chargeFilter.request || location.hash !== "#cobrancas") return;
    const amount = (status) => items.filter((item) => !status || item.status === status).reduce((sum, item) => sum + Number(item.amount || 0), 0);
    dashboardGrid.innerHTML = `<section class="page-intro"><div><p class="card-kicker">Financeiro</p><h2>${title}</h2><p>${description}</p></div><button class="button button-primary compact-action" data-charge-new type="button">+ Nova cobrança</button></section><section class="finance-metrics"><article class="data-card finance-metric"><span>Total gerado</span><strong>${chargeMoney(amount())}</strong></article><article class="data-card finance-metric"><span>Pendentes</span><strong>${items.filter((item) => ["generated", "sent", "viewed", "pending"].includes(item.status)).length}</strong></article><article class="data-card finance-metric"><span>Pagas</span><strong>${chargeMoney(amount("paid"))}</strong></article><article class="data-card finance-metric"><span>Vencidas</span><strong>${items.filter((item) => item.status === "overdue").length}</strong></article></section><section class="data-card finance-list"><div class="finance-toolbar"><input type="search" data-charge-search value="${chargeEsc(chargeFilter.search)}" placeholder="Buscar mensagem, cliente ou projeto…" aria-label="Buscar cobrança"><select data-charge-filter aria-label="Filtrar status"><option value="">Todos os status</option>${Object.entries(chargeStatus).map(([key, label]) => `<option value="${key}">${label}</option>`).join("")}</select></div>${items.length ? `<div class="table-wrap"><table class="finance-table"><thead><tr><th scope="col">Identificação</th><th scope="col">Canal</th><th scope="col">Valor</th><th scope="col">Vencimento</th><th scope="col">Status</th><th scope="col">Ações</th></tr></thead><tbody>${items.map((item) => `<tr><td><strong>${chargeEsc(item.message || "Cobrança")}</strong><small>Recebível: ${chargeEsc(item.receivable_id || "não vinculado")}</small></td><td>${chargeEsc(item.channel || "link")}</td><td>${chargeMoney(item.amount)}</td><td>${chargeDate(item.due_at)}</td><td><span class="finance-status ${chargeTone(item.status)}">${chargeStatus[item.status] || chargeEsc(item.status || "Pendente")}</span></td><td><button class="compact-action" data-charge-edit="${chargeEsc(item.id)}" type="button">Editar</button><button class="compact-action" data-charge-delete="${chargeEsc(item.id)}" type="button">Excluir</button></td></tr>`).join("")}</tbody></table></div>` : stateBlock.empty("Nenhuma cobrança registrada", "Gere uma cobrança a partir de uma conta a receber.")}</section>`;
    const search = dashboardGrid.querySelector("[data-charge-search]"), status = dashboardGrid.querySelector("[data-charge-filter]"); status.value = chargeFilter.status; search?.setAttribute("name", "charge_search"); search?.setAttribute("autocomplete", "off"); status?.setAttribute("name", "status"); status?.setAttribute("autocomplete", "off"); let timer; search?.addEventListener("input", () => { clearTimeout(timer); chargeFilter.search = search.value.trim(); timer = setTimeout(renderChargesScreen, 250); }); status?.addEventListener("change", () => { chargeFilter.status = status.value; renderChargesScreen(); });
    const openNew = () => chargeForm();
    dashboardGrid.querySelector(".finance-metrics")?.remove(); dashboardGrid.querySelector(".page-intro")?.insertAdjacentHTML("afterend", ui.stats([{ label: "Total gerado", value: chargeMoney(amount()) }, { label: "Pendentes", value: ui.number(items.filter((item) => ["generated", "sent", "viewed", "pending"].includes(item.status)).length), tone: "orange" }, { label: "Pagas", value: chargeMoney(amount("paid")), tone: "green" }, { label: "Vencidas", value: ui.number(items.filter((item) => item.status === "overdue").length), tone: "red" }]));
    dashboardGrid.querySelector(".finance-list .ui-empty .compact-action")?.addEventListener("click", () => chargeForm());
    dashboardGrid.querySelectorAll("[data-charge-edit]").forEach((button) => button.addEventListener("click", () => { const item = items.find((entry) => String(entry.id) === String(button.dataset.chargeEdit)); if (item) chargeForm(item).catch((error) => toast(error.message, "error")); }));
    dashboardGrid.querySelectorAll(".finance-list tbody tr").forEach((row, index) => { const button = document.createElement("button"); button.className = "compact-action"; button.type = "button"; button.textContent = "Detalhes"; button.addEventListener("click", () => chargeDetails(items[index])); row.querySelector("td:last-child")?.prepend(button); }); dashboardGrid.querySelector(".finance-list")?.setAttribute("data-details-bound", "1");
    dashboardGrid.querySelectorAll("[data-charge-delete]").forEach((button) => button.addEventListener("click", () => ui.confirmInline(button, { text: "Excluir cobrança?", onConfirm: async () => { if (button.disabled) return; const routeAtStart = location.hash, originalLabel = button.textContent; button.disabled = true; button.setAttribute("aria-busy", "true"); button.textContent = "Excluindo…"; try { await api(`/api/charges/${button.dataset.chargeDelete}`, { method: "DELETE" }); if (location.hash !== routeAtStart || routeAtStart !== "#cobrancas" || !button.isConnected) return; toast("Cobrança excluída.", "success"); renderChargesScreen(); } catch (error) { if (location.hash !== routeAtStart || !button.isConnected) return; button.disabled = false; button.removeAttribute("aria-busy"); button.textContent = originalLabel; toast(error.message, "error"); } finally { if (button.isConnected) { button.disabled = false; button.removeAttribute("aria-busy"); } } } })));
  } catch (error) { if (request !== chargeFilter.request || location.hash !== "#cobrancas") return; dashboardGrid.removeAttribute("aria-busy"); dashboardGrid.innerHTML = stateBlock.error(error.message, "charge-retry"); dashboardGrid.querySelector(".charge-retry")?.addEventListener("click", renderChargesScreen); }
}

registerRoutes({ cobrancas: renderChargesScreen });
window.addEventListener("hashchange", () => {
  if (location.hash !== "#cobrancas") chargeFilter.request += 1;
});
let chargeSearchSnapshot = null;
dashboardGrid.addEventListener("input", (event) => {
  const input = event.target.closest?.("[data-charge-search]");
  if (input) chargeSearchSnapshot = { value: input.value, position: input.selectionStart ?? input.value.length };
}, true);
const chargeSearchObserver = new MutationObserver(() => {
  const input = dashboardGrid.querySelector("[data-charge-search]");
  if (!input) return;
  input.type = "search";
  input.setAttribute("autocomplete", "off");
  if (!chargeSearchSnapshot || input.value !== chargeSearchSnapshot.value) return;
  input.focus();
  try { input.setSelectionRange(chargeSearchSnapshot.position, chargeSearchSnapshot.position); } catch { /* cursor indisponível */ }
  chargeSearchSnapshot = null;
});
chargeSearchObserver.observe(dashboardGrid, { childList: true, subtree: true });
dashboardGrid.addEventListener("click", (event) => {
  const button = event.target.closest?.("[data-charge-new]");
  if (!button || location.hash !== "#cobrancas") return;
  event.preventDefault();
  event.stopImmediatePropagation();
  if (button.dataset.busy === "1") return;
  button.dataset.busy = "1";
  button.disabled = true;
  chargeForm().catch((error) => toast(error.message, "error")).finally(() => {
    button.disabled = false;
    button.dataset.busy = "";
  });
}, true);
const chargeUiObserver = new MutationObserver(() => {
  const list = dashboardGrid.querySelector(".finance-list"), toolbar = list?.querySelector(".finance-toolbar");
  if (!list || !toolbar) return;
  const search = toolbar.querySelector("[data-charge-search]");
  if (search) search.placeholder = "Buscar mensagem, cliente ou projeto…";
  dashboardGrid.querySelectorAll(".finance-list .finance-status").forEach((status) => { status.setAttribute("role", "status"); status.setAttribute("aria-live", "polite"); });
  list.querySelectorAll("table.finance-table").forEach((table) => {
    if (!table.caption) {
      const caption = document.createElement("caption");
      caption.className = "sr-only";
      caption.textContent = "Cobranças do workspace";
      table.prepend(caption);
    }
    table.querySelectorAll("thead th").forEach((header) => header.setAttribute("scope", "col"));
    table.querySelectorAll("tbody td:nth-child(3)").forEach((cell) => { cell.style.fontVariantNumeric = "tabular-nums"; });
  });
  list.querySelectorAll("button, a").forEach((control) => { control.style.touchAction = "manipulation"; });
  list.querySelectorAll("table.finance-table").forEach((table) => {
    if (!table.caption) {
      const caption = document.createElement("caption");
      caption.className = "sr-only";
      caption.textContent = "Cobranças do workspace";
      table.prepend(caption);
    }
    table.querySelectorAll("thead th").forEach((header) => header.setAttribute("scope", "col"));
    table.querySelectorAll("button, a").forEach((control) => { control.style.touchAction = "manipulation"; });
  });
  let result = list.querySelector("[data-charge-results]");
  if (!result) { result = document.createElement("p"); result.className = "ui-filter-status"; result.dataset.chargeResults = "true"; result.setAttribute("role", "status"); result.setAttribute("aria-live", "polite"); toolbar.insertAdjacentElement("afterend", result); }
  const count = list.querySelectorAll("tbody tr").length;
  result.textContent = `${ui.number(count)} ${count === 1 ? "cobrança encontrada" : "cobranças encontradas"}.`;
});
chargeUiObserver.observe(dashboardGrid, { childList: true, subtree: true });
const chargeLoadingObserver = new MutationObserver(() => {
  if (dashboardGrid.querySelector(".state-loading")) dashboardGrid.setAttribute("aria-busy", "true");
  else dashboardGrid.removeAttribute("aria-busy");
});
chargeLoadingObserver.observe(dashboardGrid, { childList: true, subtree: true });
