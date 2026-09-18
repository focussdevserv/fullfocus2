const toast = (...args) => { if (location.hash === "#notas-fiscais") ui.toast(...args); };
const invoiceEsc = (value) => escapeHtml(value ?? "");
const invoiceHref = (value) => { const raw = String(value ?? "").trim(); if (!raw) return ""; try { const url = new URL(raw, window.location.origin); return ["http:", "https:"].includes(url.protocol) ? url.href : ""; } catch { return ""; } };
dashboardGrid.addEventListener("click", (event) => { const link = event.target.closest?.("a[href]"); if (!link || !dashboardGrid.contains(link)) return; const href = invoiceHref(link.getAttribute("href")); if (!href) { event.preventDefault(); event.stopImmediatePropagation(); toast("Este endereço de documento não é seguro.", "error"); return; } link.href = href; }, true);
const invoiceMoneyFormatter = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const invoiceDateFormatter = new Intl.DateTimeFormat("pt-BR");
const invoiceMoney = (value) => invoiceMoneyFormatter.format(Number(value || 0));
const invoiceDate = (value) => { if (!value) return "—"; const date = new Date(value); return Number.isNaN(date.getTime()) ? "—" : invoiceDateFormatter.format(date); };
const invoiceStatus = { draft: "Rascunho", issued: "Emitida", cancelled: "Cancelada", error: "Com erro", pending: "Pendente" };
const invoiceFilter = { search: "", status: "", request: 0 };
function invoiceDetails(item) { ui.drawer({ title: item.number || "Nota fiscal", subtitle: invoiceStatus[item.status] || "Financeiro", html: ui.facts([["Número", item.number], ["Cliente", item.client_name || item.client_id], ["Projeto", item.project_id], ["Valor", invoiceMoney(item.amount)], ["Emissão", invoiceDate(item.issued_on)], ["Status", invoiceStatus[item.status] || item.status], ["PDF", item.pdf_url], ["XML", item.xml_url], ["Erro", item.error]]) }); }
async function invoiceForm(item = null) {
  const routeAtStart = location.hash;
  if (routeAtStart !== "#notas-fiscais") return;
  const [clientsData, projectsData] = await Promise.all([
    api("/api/clients?limit=250").catch(() => ({ clients: [] })),
    api("/api/projects?limit=250").catch(() => ({ projects: [] })),
  ]);
  if (location.hash !== routeAtStart || location.hash !== "#notas-fiscais") return;
  const clients = clientsData.clients || [], projects = projectsData.projects || [];
  ui.form({ title: item ? "Editar nota fiscal" : "Nova nota fiscal", subtitle: "Financeiro", values: item || {}, fields: [{ name: "number", label: "Número", required: false }, { name: "client_id", label: "Cliente", type: "select", required: false, options: [["", "Sem cliente"], ...clients.map((client) => [client.id, client.name])] }, { name: "project_id", label: "Projeto", type: "select", required: false, options: [["", "Sem projeto"], ...projects.map((project) => [project.id, project.name])] }, { name: "amount", label: "Valor", type: "number", min: 0.01, step: 0.01 }, { name: "issued_on", label: "Data de emissão", type: "date", required: false }, { name: "status", label: "Status", type: "select", options: Object.entries(invoiceStatus) }, { name: "pdf_url", label: "URL do PDF", type: "url", required: false }, { name: "xml_url", label: "URL do XML", type: "url", required: false }, { name: "error", label: "Observação/erro", required: false }], onSubmit: async (values) => { await api(item ? `/api/invoices/${item.id}` : "/api/invoices", { method: item ? "PATCH" : "POST", body: values }); if (location.hash !== routeAtStart || location.hash !== "#notas-fiscais") return; toast(item ? "Nota fiscal atualizada." : "Nota fiscal criada.", "success"); renderInvoicesScreen(); } });
}

async function renderInvoicesScreen() {
  if (location.hash !== "#notas-fiscais") return;
  const request = invoiceFilter.request = (invoiceFilter.request || 0) + 1;
  dashboardGrid.setAttribute("aria-busy", "true");
  const title = "Notas fiscais", description = "Acompanhe documentos fiscais e o status de cada emissão.";
  dashboardGrid.innerHTML = `<section class="page-intro"><div><p class="card-kicker">Financeiro</p><h2>${title}</h2><p>${description}</p></div><button class="button button-primary compact-action" data-invoice-new type="button">+ Nova nota</button></section>${stateBlock.loading("Carregando notas fiscais…")}`;
  try {
    const params = new URLSearchParams(); if (invoiceFilter.search) params.set("search", invoiceFilter.search); if (invoiceFilter.status) params.set("status", invoiceFilter.status); const items = (await api(`/api/invoices?${params}`)).invoices || [];
    if (request !== invoiceFilter.request || location.hash !== "#notas-fiscais") return;
    dashboardGrid.innerHTML = `<section class="page-intro"><div><p class="card-kicker">Financeiro</p><h2>${title}</h2><p>${description}</p></div><button class="button button-primary compact-action" data-invoice-new type="button">+ Nova nota</button></section><section class="finance-metrics"><article class="data-card finance-metric"><span>Total registrado</span><strong>${invoiceMoney(items.reduce((sum, item) => sum + Number(item.amount || 0), 0))}</strong></article><article class="data-card finance-metric"><span>Emitidas</span><strong>${items.filter((item) => item.status === "issued").length}</strong></article><article class="data-card finance-metric"><span>Rascunhos</span><strong>${items.filter((item) => item.status === "draft").length}</strong></article><article class="data-card finance-metric"><span>Com erro</span><strong>${items.filter((item) => item.status === "error").length}</strong></article></section><section class="data-card finance-list"><div class="finance-toolbar"><input type="search" data-invoice-search value="${invoiceEsc(invoiceFilter.search)}" placeholder="Buscar número ou cliente…" aria-label="Buscar nota fiscal"><select data-invoice-filter aria-label="Filtrar status"><option value="">Todos os status</option><option value="draft">Rascunhos</option><option value="issued">Emitidas</option><option value="cancelled">Canceladas</option><option value="error">Com erro</option></select></div>${items.length ? `<div class="table-wrap"><table class="finance-table"><thead><tr><th>Número</th><th>Cliente</th><th>Valor</th><th>Emissão</th><th>Status</th><th>Documentos</th><th>Ações</th></tr></thead><tbody>${items.map((item) => `<tr><td>${invoiceEsc(item.number || "Sem número")}</td><td>${invoiceEsc(item.client_name || item.client_id || "Sem cliente")}</td><td>${invoiceMoney(item.amount)}</td><td>${invoiceDate(item.issued_on)}</td><td><span class="finance-status ${item.status === "issued" ? "positive" : item.status === "error" ? "warning" : "neutral"}">${invoiceStatus[item.status] || invoiceEsc(item.status)}</span>${item.error ? `<small>${invoiceEsc(item.error)}</small>` : ""}</td><td>${item.pdf_url ? `<a href="${invoiceEsc(item.pdf_url)}" target="_blank" rel="noopener">PDF</a>` : "—"}${item.xml_url ? ` · <a href="${invoiceEsc(item.xml_url)}" target="_blank" rel="noopener">XML</a>` : ""}</td><td><button class="compact-action" data-invoice-edit="${invoiceEsc(item.id)}" type="button">Editar</button><button class="compact-action" data-invoice-delete="${invoiceEsc(item.id)}" type="button">Excluir</button></td></tr>`).join("")}</tbody></table></div>` : stateBlock.empty("Nenhuma nota fiscal", "Cadastre um documento ou conecte um emissor fiscal.")}</section>`;
    dashboardGrid.removeAttribute("aria-busy");
    const search = dashboardGrid.querySelector("[data-invoice-search]"), status = dashboardGrid.querySelector("[data-invoice-filter]"); search?.setAttribute("name", "search"); search?.setAttribute("autocomplete", "off"); status?.setAttribute("name", "status"); status?.setAttribute("autocomplete", "off"); status.value = invoiceFilter.status; let timer; search?.addEventListener("input", () => { clearTimeout(timer); invoiceFilter.search = search.value.trim(); timer = setTimeout(renderInvoicesScreen, 250); }); status?.addEventListener("change", () => { invoiceFilter.status = status.value; renderInvoicesScreen(); });
    dashboardGrid.querySelector(".finance-metrics")?.remove(); dashboardGrid.querySelector(".page-intro")?.insertAdjacentHTML("afterend", ui.stats([{ label: "Total registrado", value: invoiceMoney(items.reduce((sum, item) => sum + Number(item.amount || 0), 0)) }, { label: "Emitidas", value: ui.number(items.filter((item) => item.status === "issued").length), tone: "green" }, { label: "Rascunhos", value: ui.number(items.filter((item) => item.status === "draft").length) }, { label: "Com erro", value: ui.number(items.filter((item) => item.status === "error").length), tone: "red" }]));
    dashboardGrid.querySelector("[data-invoice-new]")?.addEventListener("click", () => invoiceForm()); dashboardGrid.querySelector(".finance-list .ui-empty .compact-action")?.addEventListener("click", () => invoiceForm());
    dashboardGrid.querySelectorAll("[data-invoice-edit]").forEach((button) => button.addEventListener("click", () => { const item = items.find((entry) => String(entry.id) === String(button.dataset.invoiceEdit)); if (item) invoiceForm(item).catch((error) => toast(error.message, "error")); }));
    dashboardGrid.querySelectorAll(".finance-list tbody tr").forEach((row, index) => { const button = document.createElement("button"); button.className = "compact-action"; button.type = "button"; button.textContent = "Detalhes"; button.addEventListener("click", () => invoiceDetails(items[index])); row.querySelector("td:last-child")?.prepend(button); }); dashboardGrid.querySelector(".finance-list")?.setAttribute("data-details-bound", "1");
  } catch (error) { if (request !== invoiceFilter.request || location.hash !== "#notas-fiscais") return; dashboardGrid.removeAttribute("aria-busy"); dashboardGrid.innerHTML = stateBlock.error(error.message, "invoice-retry"); dashboardGrid.querySelector(".invoice-retry")?.addEventListener("click", renderInvoicesScreen); }
}

let invoiceSearchSnapshot;
dashboardGrid.addEventListener("input", (event) => {
  const input = event.target.closest?.("[data-invoice-search]");
  if (input) invoiceSearchSnapshot = { value: input.value, position: input.selectionStart };
}, true);
const invoiceSearchObserver = new MutationObserver(() => {
  const input = dashboardGrid.querySelector("[data-invoice-search]");
  if (!input) return;
  input.type = "search";
  input.setAttribute("autocomplete", "off");
  if (!invoiceSearchSnapshot) return;
  if (input.value === invoiceSearchSnapshot.value) {
    input.focus();
    try { input.setSelectionRange(invoiceSearchSnapshot.position, invoiceSearchSnapshot.position); } catch { /* busca sem cursor em alguns navegadores */ }
  }
  invoiceSearchSnapshot = null;
});
invoiceSearchObserver.observe(dashboardGrid, { childList: true, subtree: true });

registerRoutes({ "notas-fiscais": renderInvoicesScreen });
window.addEventListener("hashchange", () => {
  if (location.hash === "#notas-fiscais") return;
  invoiceFilter.request += 1;
});
dashboardGrid.addEventListener("click", (event) => {
  const link = event.target.closest?.('a[target="_blank"]');
  if (!link || !dashboardGrid.contains(link)) return;
  link.rel = "noopener noreferrer";
  try {
    const parsed = new URL(link.getAttribute("href") || "", window.location.origin);
    if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("protocolo inválido");
    link.href = parsed.href;
  } catch {
    event.preventDefault();
    toast("Este endereço de documento não é seguro.", "error");
  }
}, true);
dashboardGrid.addEventListener("click", (event) => {
  const button = event.target.closest?.("[data-invoice-delete]");
  if (!button) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  ui.confirmInline(button, { text: "Excluir nota fiscal?", onConfirm: async () => { if (button.dataset.busy === "1") return; const routeAtStart = location.hash, originalLabel = button.textContent; button.dataset.busy = "1"; button.disabled = true; button.setAttribute("aria-busy", "true"); button.textContent = "Excluindo…"; try { await api(`/api/invoices/${button.dataset.invoiceDelete}`, { method: "DELETE" }); if (location.hash !== routeAtStart || routeAtStart !== "#notas-fiscais" || !button.isConnected) return; toast("Nota fiscal excluída.", "success"); renderInvoicesScreen(); } catch (error) { if (location.hash !== routeAtStart || !button.isConnected) return; button.disabled = false; button.removeAttribute("aria-busy"); button.textContent = originalLabel; toast(error.message, "error"); } finally { if (button.isConnected) { button.dataset.busy = ""; button.disabled = false; button.removeAttribute("aria-busy"); } } } });
}, true);
new MutationObserver(() => {
  if (dashboardGrid.querySelector(".state-loading")) dashboardGrid.setAttribute("aria-busy", "true");
  else dashboardGrid.removeAttribute("aria-busy");
  const list = dashboardGrid.querySelector(".finance-list");
  if (!list) return;
  let status = list.querySelector("[data-invoice-results]");
  if (!status) { status = document.createElement("p"); status.className = "ui-filter-status"; status.dataset.invoiceResults = "true"; status.setAttribute("role", "status"); status.setAttribute("aria-live", "polite"); list.querySelector(".finance-toolbar")?.after(status); }
  const count = list.querySelectorAll("tbody tr").length;
  const label = count === 1 ? "1 nota fiscal encontrada" : `${count} notas fiscais encontradas`;
  if (status.textContent !== label) status.textContent = label;
  list.querySelectorAll("th").forEach((cell) => cell.setAttribute("scope", "col"));
  list.querySelectorAll("button:disabled").forEach((button) => button.setAttribute("aria-busy", "true"));
  list.querySelectorAll(".finance-status").forEach((status) => { status.setAttribute("role", "status"); status.setAttribute("aria-live", "polite"); });
  list.querySelectorAll("table.finance-table").forEach((table) => {
    if (table.caption) return;
    const caption = document.createElement("caption");
    caption.className = "sr-only";
    caption.textContent = "Notas fiscais do workspace";
    table.prepend(caption);
  });
  list.querySelectorAll("button, a").forEach((control) => { control.style.touchAction = "manipulation"; });
}).observe(dashboardGrid, { childList: true, subtree: true, attributes: true, attributeFilter: ["disabled"] });
