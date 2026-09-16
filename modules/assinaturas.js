const subEsc = (value) => escapeHtml(value ?? "");
const subMoneyFormatter = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const subMoney = (value) => subMoneyFormatter.format(Number(value || 0));
const subDate = (value) => { if (!value) return "—"; const date = new Date(value); return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat("pt-BR").format(date); };
const subStatus = { active: "Ativa", paused: "Pausada", cancelled: "Cancelada", pending: "Pagamento pendente" };
const subscriptionFilter = { search: "", status: "", request: 0 };
const isDueWithinNextWeek = (value) => { if (!value) return false; const time = new Date(value).getTime(); return Number.isFinite(time) && time >= Date.now() && time <= Date.now() + 7 * 864e5; };
async function subscriptionForm(item = null) { const routeAtStart = location.hash; if (routeAtStart !== "#assinaturas") return; const clients = item ? [] : ((await api("/api/clients?limit=250")).clients || []); if (location.hash !== routeAtStart || location.hash !== "#assinaturas") return; const fields = item ? [{ name: "status", label: "Status", type: "select", options: Object.entries(subStatus) }] : [{ name: "client_id", label: "Cliente", type: "select", required: false, options: [["", "Sem cliente"], ...clients.map((client) => [client.id, client.name])] }, { name: "plan", label: "Plano", required: true }, { name: "amount", label: "Valor", type: "number", min: 0.01, step: 0.01 }, { name: "interval", label: "Intervalo", type: "select", options: [["monthly", "Mensal"], ["yearly", "Anual"]] }, { name: "next_billing_on", label: "Próxima cobrança", type: "date", required: false }]; ui.form({ title: item ? "Atualizar status da assinatura" : "Nova assinatura", subtitle: "Financeiro", values: item || {}, fields, submitLabel: item ? "Salvar status" : "Criar assinatura", onSubmit: async (values) => { await api(item ? `/api/subscriptions/${item.id}` : "/api/subscriptions", { method: item ? "PATCH" : "POST", body: values }); if (location.hash !== routeAtStart || location.hash !== "#assinaturas") return; toast(item ? "Status atualizado." : "Assinatura criada.", "success"); renderSubscriptionsScreen(); } }); }

async function renderSubscriptionsScreen() {
  if (location.hash !== "#assinaturas") return;
  const request = subscriptionFilter.request = (subscriptionFilter.request || 0) + 1;
  const title = "Assinaturas", description = "Controle serviços recorrentes, cobranças e renovações.";
  dashboardGrid.setAttribute("aria-busy", "true");
  dashboardGrid.innerHTML = `<section class="page-intro"><div><p class="card-kicker">Financeiro</p><h2>${title}</h2><p>${description}</p></div><button class="button button-primary compact-action" data-sub-new type="button">+ Nova assinatura</button></section>${stateBlock.loading("Carregando assinaturas…")}`;
  try {
    const params = new URLSearchParams(); if (subscriptionFilter.search) params.set("search", subscriptionFilter.search); if (subscriptionFilter.status) params.set("status", subscriptionFilter.status);
    const items = (await api(`/api/subscriptions?${params}`)).subscriptions || [];
    if (request !== subscriptionFilter.request || location.hash !== "#assinaturas") return;
    const active = items.filter((item) => item.status === "active");
    const mrr = active.reduce((sum, item) => sum + (item.interval === "yearly" ? Number(item.amount || 0) / 12 : Number(item.amount || 0)), 0);
    dashboardGrid.innerHTML = `<section class="page-intro"><div><p class="card-kicker">Financeiro</p><h2>${title}</h2><p>${description}</p></div><button class="button button-primary compact-action" data-sub-new type="button">+ Nova assinatura</button></section><section class="finance-metrics"><article class="data-card finance-metric"><span>Ativas</span><strong>${active.length}</strong></article><article class="data-card finance-metric"><span>MRR estimado</span><strong>${subMoney(mrr)}</strong></article><article class="data-card finance-metric"><span>Pausadas</span><strong>${items.filter((item) => item.status === "paused").length}</strong></article><article class="data-card finance-metric"><span>Próximas em 7 dias</span><strong>${items.filter((item) => isDueWithinNextWeek(item.next_billing_on)).length}</strong></article></section><section class="data-card finance-list"><div class="finance-toolbar"><input type="search" data-sub-search value="${subEsc(subscriptionFilter.search)}" placeholder="Buscar plano ou cliente…" aria-label="Buscar assinatura"><select data-sub-filter aria-label="Filtrar status"><option value="">Todos os status</option><option value="active">Ativas</option><option value="paused">Pausadas</option><option value="cancelled">Canceladas</option></select></div>${items.length ? `<div class="table-wrap"><table class="finance-table"><thead><tr><th scope="col">Plano</th><th scope="col">Cliente</th><th scope="col">Valor</th><th scope="col">Próxima cobrança</th><th scope="col">Status</th><th scope="col">Ações</th></tr></thead><tbody>${items.map((item) => `<tr data-sub-row><td>${subEsc(item.plan || "Assinatura sem nome")}</td><td>${subEsc(item.client_name || "Sem cliente")}</td><td>${subMoney(item.amount)} / ${item.interval === "yearly" ? "ano" : "mês"}</td><td>${subDate(item.next_billing_on)}</td><td><span class="finance-status ${item.status === "active" ? "positive" : "neutral"}">${subStatus[item.status] || subEsc(item.status)}</span></td><td>${item.status !== "cancelled" ? `<button class="compact-action" data-sub-status="${subEsc(item.id)}" data-next="${item.status === "active" ? "paused" : "active"}" type="button">${item.status === "active" ? "Pausar" : "Reativar"}</button>` : ""}<button class="compact-action" data-sub-delete="${subEsc(item.id)}" type="button">Excluir</button></td></tr>`).join("")}</tbody></table></div>` : stateBlock.empty("Nenhuma assinatura cadastrada.")}</section>`;
    dashboardGrid.removeAttribute("aria-busy");
    dashboardGrid.querySelector(".finance-metrics")?.remove(); dashboardGrid.querySelector(".page-intro")?.insertAdjacentHTML("afterend", ui.stats([{ label: "Ativas", value: ui.number(active.length), tone: "green" }, { label: "MRR estimado", value: subMoney(mrr) }, { label: "Pausadas", value: ui.number(items.filter((item) => item.status === "paused").length), tone: "orange" }, { label: "Próximas em 7 dias", value: ui.number(items.filter((item) => item.next_billing_on && new Date(item.next_billing_on) <= new Date(Date.now() + 7 * 864e5)).length) }]));
    dashboardGrid.querySelector(".finance-list tbody")?.querySelectorAll("tr").forEach((row, index) => { const item = items[index], actions = row.lastElementChild; if (!item || !actions) return; const details = document.createElement("button"); details.className = "compact-action"; details.type = "button"; details.textContent = "Detalhes"; details.addEventListener("click", () => ui.drawer({ title: item.plan || "Assinatura", subtitle: subStatus[item.status] || item.status || "Sem status", html: ui.facts([["Cliente", item.client_name], ["Plano", item.plan], ["Valor", `${subMoney(item.amount)} / ${item.interval === "yearly" ? "ano" : "mês"}`], ["Próxima cobrança", subDate(item.next_billing_on)], ["Status", subStatus[item.status] || item.status]]) })); const edit = document.createElement("button"); edit.className = "compact-action"; edit.type = "button"; edit.textContent = "Editar status"; edit.addEventListener("click", () => subscriptionForm(item)); actions.prepend(edit, details); });
    const search = dashboardGrid.querySelector("[data-sub-search]"), status = dashboardGrid.querySelector("[data-sub-filter]"); if (status && ![...status.options].some((option) => option.value === "pending")) status.add(new Option("Pagamento pendente", "pending")); if (status) { status.value = subscriptionFilter.status; status.name = "status"; status.autocomplete = "off"; } if (search) search.placeholder = "Buscar plano ou cliente…"; let timer;
    search?.addEventListener("input", () => { clearTimeout(timer); subscriptionFilter.search = search.value.trim(); timer = setTimeout(renderSubscriptionsScreen, 250); });
    status?.addEventListener("change", () => { subscriptionFilter.status = status.value; renderSubscriptionsScreen(); });
    dashboardGrid.querySelector("[data-sub-new]")?.addEventListener("click", () => { const routeAtStart = location.hash; subscriptionForm().catch((error) => { if (location.hash === routeAtStart && routeAtStart === "#assinaturas") toast(error.message, "error"); }); });
    dashboardGrid.querySelectorAll("[data-sub-status]").forEach((button) => button.addEventListener("click", async () => { if (button.dataset.next === "paused" || button.dataset.busy === "1") return; const routeAtStart = location.hash, originalLabel = button.dataset.pendingLabel || button.textContent; button.dataset.busy = "1"; button.disabled = true; button.setAttribute("aria-busy", "true"); button.textContent = "Reativando…"; try { await api(`/api/subscriptions/${button.dataset.subStatus}`, { method: "PATCH", body: { status: button.dataset.next } }); if (location.hash !== routeAtStart || routeAtStart !== "#assinaturas" || !button.isConnected) return; toast("Assinatura reativada.", "success"); renderSubscriptionsScreen(); } catch (error) { if (location.hash !== routeAtStart || !button.isConnected) return; button.disabled = false; button.removeAttribute("aria-busy"); button.textContent = originalLabel; toast(error.message, "error"); } finally { if (button.isConnected) { button.dataset.busy = ""; button.disabled = false; button.removeAttribute("aria-busy"); } } }));
  } catch (error) { if (request !== subscriptionFilter.request || location.hash !== "#assinaturas") return; dashboardGrid.removeAttribute("aria-busy"); dashboardGrid.innerHTML = `<section class="page-intro"><div><p class="card-kicker">Financeiro</p><h2>${title}</h2></div></section>${stateBlock.error(error.message, "sub-retry")}`; dashboardGrid.querySelector(".sub-retry")?.addEventListener("click", renderSubscriptionsScreen); }
}

let subscriptionSearchSnapshot;
dashboardGrid.addEventListener("input", (event) => {
  const input = event.target.closest?.("[data-sub-search]");
  if (input) subscriptionSearchSnapshot = { value: input.value, position: input.selectionStart };
}, true);
const subscriptionSearchObserver = new MutationObserver(() => {
  const input = dashboardGrid.querySelector("[data-sub-search]");
  if (!input) return;
  input.type = "search";
  input.name = "search";
  input.setAttribute("autocomplete", "off");
  if (!subscriptionSearchSnapshot) return;
  if (input.value === subscriptionSearchSnapshot.value) {
    input.focus();
    try { input.setSelectionRange(subscriptionSearchSnapshot.position, subscriptionSearchSnapshot.position); } catch { /* busca sem cursor em alguns navegadores */ }
  }
  subscriptionSearchSnapshot = null;
});
subscriptionSearchObserver.observe(dashboardGrid, { childList: true, subtree: true });

registerRoutes({ assinaturas: renderSubscriptionsScreen });
window.addEventListener("hashchange", () => {
  if (location.hash !== "#assinaturas") subscriptionFilter.request += 1;
});

dashboardGrid.addEventListener("click", (event) => {
  const button = event.target.closest?.("[data-sub-status]");
  if (!button || button.disabled || button.dataset.pendingLabel || button.dataset.next === "paused") return;
  button.dataset.pendingLabel = button.textContent;
  button.textContent = "Atualizando…";
}, true);

const subscriptionResultsObserver = new MutationObserver(() => {
  const list = dashboardGrid.querySelector(".finance-list");
  const toolbar = list?.querySelector(".finance-toolbar");
  if (!list || !toolbar) return;
  let status = list.querySelector("[data-sub-results]");
  if (!status) {
    status = document.createElement("p");
    status.className = "ui-filter-status";
    status.dataset.subResults = "true";
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    toolbar.insertAdjacentElement("afterend", status);
  }
  const count = list.querySelectorAll("tbody tr").length;
  status.textContent = `${ui.number(count)} ${count === 1 ? "assinatura encontrada" : "assinaturas encontradas"}.`;
});
subscriptionResultsObserver.observe(dashboardGrid, { childList: true, subtree: true });

dashboardGrid.addEventListener("click", (event) => {
  const button = event.target.closest?.("[data-sub-status]");
  if (!button || button.disabled || button.dataset.next !== "paused" || button.dataset.pauseConfirm === "1") return;
  event.preventDefault();
  event.stopImmediatePropagation();
  button.dataset.pauseConfirm = "1";
  const pauseRouteAtStart = location.hash;
  ui.confirmInline(button, {
    text: "Pausar esta assinatura e as próximas cobranças?",
    onConfirm: async () => {
      button.disabled = true;
      button.setAttribute("aria-busy", "true");
      button.textContent = "Pausando…";
      try {
        await api(`/api/subscriptions/${button.dataset.subStatus}`, { method: "PATCH", body: { status: "paused" } });
        if (location.hash !== pauseRouteAtStart || pauseRouteAtStart !== "#assinaturas" || !button.isConnected) return;
        toast("Assinatura pausada.", "success");
        if (location.hash === "#assinaturas") renderSubscriptionsScreen();
      } catch (error) {
        if (location.hash !== pauseRouteAtStart || !button.isConnected) return;
        button.disabled = false;
        button.removeAttribute("aria-busy");
        button.textContent = "Pausar";
        throw error;
      } finally {
        button.dataset.pauseConfirm = "";
      }
    },
    onCancel: () => { button.dataset.pauseConfirm = ""; }
  });
}, true);

const subscriptionMetricObserver = new MutationObserver(() => {
  const metric = [...dashboardGrid.querySelectorAll(".ui-stat")].find((card) => card.querySelector("span")?.textContent === "Próximas em 7 dias");
  const rows = dashboardGrid.querySelectorAll(".finance-list tbody tr");
  if (!metric) return;
  const upcoming = [...rows].filter((row) => {
    const [day, month, year] = (row.children[3]?.textContent || "").trim().split("/").map(Number);
    return day && month && year && isDueWithinNextWeek(new Date(year, month - 1, day, 12));
  }).length;
  const value = metric.querySelector("strong");
  if (value && value.textContent !== ui.number(upcoming)) value.textContent = ui.number(upcoming);
});
subscriptionMetricObserver.observe(dashboardGrid, { childList: true, subtree: true });

new MutationObserver(() => {
  const status = dashboardGrid.querySelector("[data-sub-filter]");
  if (status) { status.name = "status"; status.setAttribute("autocomplete", "off"); }
  dashboardGrid.querySelectorAll("[data-sub-status], [data-sub-delete]").forEach((button) => {
    if (button.disabled) button.setAttribute("aria-busy", "true");
    else { button.removeAttribute("aria-busy"); if (button.dataset.pendingLabel) { button.textContent = button.dataset.pendingLabel; delete button.dataset.pendingLabel; } }
  });
  dashboardGrid.querySelectorAll(".finance-list .finance-status").forEach((status) => { status.setAttribute("role", "status"); status.setAttribute("aria-live", "polite"); });
  dashboardGrid.querySelectorAll("table.finance-table").forEach((table) => {
    if (!table.caption) {
      const caption = document.createElement("caption");
      caption.className = "sr-only";
      caption.textContent = "Assinaturas do workspace";
      table.prepend(caption);
    }
    table.querySelectorAll("thead th").forEach((header) => header.setAttribute("scope", "col"));
    table.querySelectorAll("tbody td:nth-child(3)").forEach((cell) => { cell.style.fontVariantNumeric = "tabular-nums"; });
    table.querySelectorAll("button, a").forEach((control) => { control.style.touchAction = "manipulation"; });
  });
  dashboardGrid.querySelectorAll(".state-loading p").forEach((label) => { label.textContent = label.textContent.replaceAll("...", "…"); });
}).observe(dashboardGrid, { childList: true, subtree: true, attributes: true, attributeFilter: ["disabled"] });

dashboardGrid.addEventListener("click", (event) => {
  const button = event.target.closest?.("[data-sub-delete]");
  if (!button || button.disabled || button.dataset.deleteConfirm === "1" || location.hash !== "#assinaturas") return;
  event.preventDefault();
  event.stopImmediatePropagation();
  button.dataset.deleteConfirm = "1";
  const deleteRouteAtStart = location.hash;
  ui.confirmInline(button, {
    text: "Excluir esta assinatura?",
    onConfirm: async () => {
      button.disabled = true;
      button.setAttribute("aria-busy", "true");
      button.textContent = "Excluindo…";
      try {
        await api(`/api/subscriptions/${button.dataset.subDelete}`, { method: "DELETE" });
        if (location.hash !== deleteRouteAtStart || deleteRouteAtStart !== "#assinaturas" || !button.isConnected) return;
        toast("Assinatura excluída.", "success");
        if (location.hash === "#assinaturas") renderSubscriptionsScreen();
      } catch (error) {
        if (location.hash !== deleteRouteAtStart || !button.isConnected) return;
        button.disabled = false;
        button.removeAttribute("aria-busy");
        button.textContent = "Excluir";
        throw error;
      } finally {
        button.dataset.deleteConfirm = "";
      }
    },
    onCancel: () => { button.dataset.deleteConfirm = ""; }
  });
}, true);
