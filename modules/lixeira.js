const toast = (...args) => { if (location.hash === "#lixeira") ui.toast(...args); };
const trashEsc = (value) => escapeHtml(value ?? "");
const trashKnownTypes = ["contacts", "companies", "clients", "leads", "projects", "tasks", "files", "invoices", "catalog_items", "automations", "templates", "integrations", "infrastructure_assets", "knowledge_articles", "payables", "bank_accounts", "forms", "deliveries"];
const trashEntityLabel = (value) => ({ contacts: "Contato", companies: "Empresa", clients: "Cliente", leads: "Lead", projects: "Projeto", tasks: "Tarefa", files: "Arquivo", invoices: "Nota fiscal", catalog_items: "Item do catálogo", automations: "Automação", templates: "Template", integrations: "Integração", infrastructure_assets: "Recurso de infraestrutura", knowledge_articles: "Artigo", payables: "Conta a pagar", bank_accounts: "Conta bancária", forms: "Formulário", deliveries: "Entrega" }[value] || value || "Registro");
const trashDateFormatter = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });
const trashDate = (value) => { if (!value) return "Sem prazo"; const date = new Date(value); return Number.isNaN(date.getTime()) ? "Data inválida" : trashDateFormatter.format(date); };
const trashExpiresWithinNextWeek = (value) => { if (!value) return false; const time = new Date(value).getTime(), now = Date.now(); return Number.isFinite(time) && time >= now && time <= now + 7 * 864e5; };
const trashState = { search: "", entity_type: "", offset: 0, request: 0 };
let trashTimer;

async function renderTrashScreen() {
  if (location.hash !== "#lixeira") return;
  const request = trashState.request = (trashState.request || 0) + 1;
  dashboardGrid.setAttribute("aria-busy", "true");
  const title = "Lixeira", description = "Registros excluídos ficam recuperáveis por até 30 dias.";
  dashboardGrid.innerHTML = `<section class="page-intro"><div><p class="card-kicker">Configurações</p><h2>${title}</h2><p>${description}</p></div></section>${stateBlock.loading("Carregando lixeira…")}`;
  const params = new URLSearchParams({ limit: "100", offset: String(trashState.offset), active: "true" });
  if (trashState.search) params.set("search", trashState.search); if (trashState.entity_type) params.set("entity_type", trashState.entity_type);
  try {
    const response = await api(`/api/trash?${params}`), items = response.trash || [], pagination = response.pagination || {}, types = [...new Set([...trashKnownTypes, ...items.map((item) => item.entity_type).filter(Boolean)])].sort();
    if (request !== trashState.request || location.hash !== "#lixeira") return;
    const option = (value, label, selected) => `<option value="${trashEsc(value)}"${selected === value ? " selected" : ""}>${trashEsc(label)}</option>`;
    const expiring = items.filter((item) => trashExpiresWithinNextWeek(item.restore_until)).length;
    dashboardGrid.innerHTML = `<section class="page-intro"><div><p class="card-kicker">Configurações</p><h2>${title}</h2><p>${description}</p></div></section>${ui.stats([{ label: "Registros na página", value: ui.number(items.length) }, { label: "Expiram em 7 dias", value: ui.number(expiring), tone: expiring ? "orange" : undefined }, { label: "Tipos de registro", value: ui.number(types.length) }])}<section class="data-card"><div class="finance-toolbar"><input type="search" data-trash-search value="${trashEsc(trashState.search)}" placeholder="Buscar registro excluído…" aria-label="Buscar na lixeira"><select data-trash-filter aria-label="Filtrar tipo"><option value="">Todos os tipos</option>${types.map((type) => option(type, trashEntityLabel(type), trashState.entity_type)).join("")}</select></div>${items.length ? `<div class="table-wrap"><table class="finance-table"><thead><tr><th>Registro</th><th>Tipo</th><th>Excluído em</th><th>Recuperável até</th><th></th></tr></thead><tbody>${items.map((item) => `<tr><td><strong>${trashEsc(item.name || item.title || `${trashEntityLabel(item.entity_type)} #${item.entity_id}`)}</strong><small>${trashEsc(item.deleted_by_name || "Sistema")}</small></td><td>${trashEsc(trashEntityLabel(item.entity_type))}</td><td>${trashEsc(trashDate(item.created_at))}</td><td>${trashEsc(trashDate(item.restore_until))}</td><td><button type="button" class="compact-action" data-trash-detail="${item.id}">Detalhes</button><button type="button" class="compact-action" data-trash-restore="${item.id}">Restaurar</button></td></tr>`).join("")}</tbody></table></div>` : stateBlock.empty("Lixeira vazia", "Registros excluídos aparecerão aqui enquanto puderem ser recuperados.")}<div class="table-pagination"><button type="button" class="compact-action" data-trash-prev ${trashState.offset === 0 ? "disabled" : ""}>Anterior</button><span>Página ${Math.floor(trashState.offset / 100) + 1}</span><button type="button" class="compact-action" data-trash-next ${(pagination.returned ?? items.length) < 100 ? "disabled" : ""}>Próxima</button></div></section>`;
    dashboardGrid.removeAttribute("aria-busy");
    dashboardGrid.querySelectorAll("[data-trash-detail]").forEach((button) => button.addEventListener("click", () => { if (location.hash !== "#lixeira" || !button.isConnected) return; const item = items.find((entry) => String(entry.id) === String(button.dataset.trashDetail)); if (!item) return; ui.drawer({ title: trashEntityLabel(item.entity_type), subtitle: `Registro excluído por ${item.deleted_by_name || "Sistema"}`, html: ui.facts([["ID original", item.entity_id], ["Excluído em", trashDate(item.created_at)], ["Recuperável até", trashDate(item.restore_until)], ["Dias restantes", item.restore_until ? Math.max(0, Math.ceil((new Date(item.restore_until) - Date.now()) / 864e5)) : "Sem prazo"]]) }); }));
    const searchInput = dashboardGrid.querySelector("[data-trash-search]");
    if (searchInput) { searchInput.name = "search"; searchInput.setAttribute("autocomplete", "off"); }
    const typeFilter = dashboardGrid.querySelector("[data-trash-filter]");
    if (typeFilter) { typeFilter.name = "entity_type"; typeFilter.setAttribute("autocomplete", "off"); }
    const reload = () => { trashState.search = searchInput.value.trim(); trashState.entity_type = dashboardGrid.querySelector("[data-trash-filter]").value; trashState.offset = 0; clearTimeout(trashTimer); trashTimer = setTimeout(renderTrashScreen, 250); };
    dashboardGrid.querySelector("[data-trash-search]")?.addEventListener("input", reload); dashboardGrid.querySelector("[data-trash-filter]")?.addEventListener("change", reload);
    dashboardGrid.querySelector("[data-trash-prev]")?.addEventListener("click", () => { if (location.hash !== "#lixeira") return; trashState.offset = Math.max(0, trashState.offset - 100); renderTrashScreen(); });
    dashboardGrid.querySelector("[data-trash-next]")?.addEventListener("click", () => { if (location.hash !== "#lixeira") return; trashState.offset += 100; renderTrashScreen(); });
  } catch (error) { if (request !== trashState.request || location.hash !== "#lixeira") return; dashboardGrid.removeAttribute("aria-busy"); dashboardGrid.innerHTML = `<section class="page-intro"><div><p class="card-kicker">Configurações</p><h2>${title}</h2></div></section>${stateBlock.error(error.message, "trash-retry")}`; dashboardGrid.querySelector(".trash-retry")?.addEventListener("click", renderTrashScreen); }
}
async function restoreTrashSafely(button) {
  const routeAtStart = location.hash;
  if (routeAtStart !== "#lixeira" || !button || button.dataset.trashBusy === "1") return;
  const originalLabel = button.textContent;
  button.dataset.trashBusy = "1";
  button.disabled = true;
  button.setAttribute("aria-busy", "true");
  button.textContent = "Restaurando…";
  try {
    await api(`/api/trash/${button.dataset.trashRestore}/restore`, { method: "POST", body: {} });
    if (location.hash === routeAtStart && routeAtStart === "#lixeira" && button.isConnected) { toast("Registro restaurado.", "success"); renderTrashScreen(); }
  } catch (error) {
    if (button.isConnected) { button.disabled = false; button.removeAttribute("aria-busy"); button.textContent = originalLabel; }
    if (location.hash === routeAtStart) toast(error.message, "error");
  } finally {
    if (button.isConnected) { button.removeAttribute("aria-busy"); button.disabled = false; button.textContent = originalLabel; }
    delete button.dataset.trashBusy;
  }
}

dashboardGrid.addEventListener("click", (event) => {
  const button = event.target.closest?.("[data-trash-restore]");
  if (!button || location.hash !== "#lixeira" || button.dataset.trashGuarded === "1") return;
  event.preventDefault();
  event.stopImmediatePropagation();
  button.dataset.trashGuarded = "1";
  ui.confirmInline(button, { text: "Restaurar este registro?", onConfirm: () => restoreTrashSafely(button).finally(() => { delete button.dataset.trashGuarded; }), onCancel: () => { delete button.dataset.trashGuarded; } });
}, true);

registerRoutes({ lixeira: renderTrashScreen });
window.addEventListener("hashchange", () => {
  if (location.hash !== "#lixeira") { trashState.request += 1; clearTimeout(trashTimer); trashTimer = null; }
});
const trashUiObserver = new MutationObserver(() => {
  const card = dashboardGrid.querySelector(".data-card");
  const toolbar = card?.querySelector(".finance-toolbar");
  if (!card || !toolbar) return;
  const search = toolbar.querySelector("[data-trash-search]");
  if (search) search.placeholder = "Buscar registro excluído…";
  const actionHeader = card.querySelector("table thead th:last-child");
  if (actionHeader && !actionHeader.textContent.trim()) actionHeader.textContent = "Ações";
  let status = card.querySelector("[data-trash-results]");
  if (!status) {
    status = document.createElement("p");
    status.className = "ui-filter-status";
    status.dataset.trashResults = "true";
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    toolbar.insertAdjacentElement("afterend", status);
  }
  const message = `${ui.number(card.querySelectorAll("tbody tr").length)} registros encontrados.`;
  if (status.textContent !== message) status.textContent = message;
});
trashUiObserver.observe(dashboardGrid, { childList: true, subtree: true });
dashboardGrid.addEventListener("focusin", (event) => { if (event.target.matches?.("[data-trash-search]")) event.target.setAttribute("autocomplete", "off"); });
let trashSearchSnapshot = null;
dashboardGrid.addEventListener("input", (event) => {
  if (!event.target.matches("[data-trash-search]")) return;
  trashSearchSnapshot = { value: event.target.value, start: event.target.selectionStart, end: event.target.selectionEnd };
}, true);
new MutationObserver(() => {
  if (!trashSearchSnapshot) return;
  const input = dashboardGrid.querySelector("[data-trash-search]");
  if (!input) return;
  input.focus(); input.setSelectionRange(trashSearchSnapshot.start, trashSearchSnapshot.end); trashSearchSnapshot = null;
}).observe(dashboardGrid, { childList: true });
dashboardGrid.addEventListener("click", (event) => { if (event.target.closest(".trash-retry")) renderTrashScreen(); });

new MutationObserver(() => {
  const card = dashboardGrid.querySelector(".data-card");
  const table = card?.querySelector("table.finance-table");
  if (table && !table.caption) {
    const caption = document.createElement("caption");
    caption.className = "sr-only";
    caption.textContent = "Registros da lixeira do workspace";
    table.prepend(caption);
  }
  card?.querySelectorAll("table thead th").forEach((header) => header.setAttribute("scope", "col"));
  card?.querySelectorAll("button").forEach((button) => {
    button.style.touchAction = "manipulation";
    if (button.disabled) button.setAttribute("aria-busy", "true");
  });
}).observe(dashboardGrid, { childList: true, subtree: true, attributes: true, attributeFilter: ["disabled"] });
