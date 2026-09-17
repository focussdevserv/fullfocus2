/* Gestão operacional: metas, horas, comissões e ausências com dados persistidos. */
const mgEsc = (value) => escapeHtml(value ?? "");
const mgDateFormatter = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" });
const mgMoneyFormatter = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const mgIntegerFormatter = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const mgDate = (value) => { if (!value) return "—"; const date = new Date(value); return Number.isNaN(date.getTime()) ? "—" : mgDateFormatter.format(date); };
const mgMoney = (value) => mgMoneyFormatter.format(Number(value || 0));
const mgDuration = (minutes) => { const total = Math.max(0, Number(minutes) || 0); return `${mgIntegerFormatter.format(Math.floor(total / 60))}h ${mgIntegerFormatter.format(total % 60)}min`; };
const mgConfig = {
  metas: { title: "Metas", table: "team_goals", key: "name", fields: [{ name: "name", label: "Meta" }, { name: "category", label: "Categoria", required: false }, { name: "period_start", label: "Início", type: "date", required: false }, { name: "period_end", label: "Fim", type: "date", required: false }, { name: "target", label: "Valor esperado", type: "number", min: 0, required: false }, { name: "current_value", label: "Resultado atual", type: "number", min: 0, required: false }, { name: "notes", label: "Observações", type: "textarea", required: false }] },
  comissoes: { title: "Comissões", table: "commissions", key: "description", fields: [{ name: "description", label: "Descrição" }, { name: "responsible", label: "Responsável", required: false }, { name: "base_amount", label: "Base da venda", type: "number", min: 0, required: false }, { name: "rate", label: "Percentual", type: "number", min: 0, max: 100, required: false }, { name: "amount", label: "Valor da comissão", type: "number", min: 0, required: true, help: "Informe o valor final da comissão em reais." }, { name: "status", label: "Status", type: "select", options: [["pending", "Pendente"], ["approved", "Aprovada"], ["paid", "Paga"], ["cancelled", "Cancelada"]], required: false }] },
  ausencias: { title: "Ausências", table: "absences", key: "kind", fields: [{ name: "user_id", label: "Membro (ID)" }, { name: "kind", label: "Tipo", type: "select", options: [["vacation", "Férias"], ["sick_leave", "Licença médica"], ["day_off", "Folga"], ["remote", "Remoto"], ["personal", "Pessoal"], ["training", "Treinamento"], ["other", "Outro"]] }, { name: "starts_on", label: "Início", type: "date" }, { name: "ends_on", label: "Fim", type: "date" }, { name: "status", label: "Status", type: "select", options: [["scheduled", "Agendada"], ["active", "Em andamento"], ["completed", "Concluída"], ["cancelled", "Cancelada"]], required: false }, { name: "notes", label: "Observações", type: "textarea", required: false }] },
  horas: { title: "Horas trabalhadas", table: "time_entries", key: "notes", fields: [{ name: "user_id", label: "Membro (ID)" }, { name: "project_id", label: "Projeto (ID)", required: false }, { name: "task_id", label: "Tarefa (ID)", required: false }, { name: "minutes", label: "Minutos", type: "number", min: 1 }, { name: "billable", label: "Faturável", type: "checkbox", required: false }, { name: "status", label: "Status", type: "select", options: [["pending", "Pendente"], ["approved", "Aprovada"], ["rejected", "Rejeitada"]], required: false }, { name: "notes", label: "Observações", type: "textarea", required: false }] }
};
const mgValue = (kind, row) => kind === "metas" ? `${mgIntegerFormatter.format(Number(row.current_value || 0))} / ${mgIntegerFormatter.format(Number(row.target || 0))}` : kind === "comissoes" ? mgMoney(row.amount) : kind === "horas" ? mgDuration(row.minutes) : `${mgDate(row.starts_on)} → ${mgDate(row.ends_on)}`;
const mgStatusLabels = { scheduled: "Agendada", active: "Em andamento", completed: "Concluída", approved: "Aprovada", pending: "Pendente", paid: "Paga", cancelled: "Cancelada", rejected: "Recusada", in_progress: "Em andamento", done: "Concluída", open: "Aberta", running: "Em execução", billed: "Faturada" };
const mgStatusOptions = { metas: [], comissoes: ["pending", "approved", "paid", "cancelled"], ausencias: ["scheduled", "active", "completed", "cancelled"], horas: ["pending", "approved", "rejected"] };
const mgStatusTone = { scheduled: "blue", active: "green", in_progress: "blue", running: "blue", completed: "green", done: "green", approved: "green", paid: "green", billed: "green", pending: "orange", open: "orange", cancelled: "red", rejected: "red" };
const mgKindLabels = { vacation: "Férias", sick_leave: "Licença médica", sick: "Licença médica", day_off: "Folga", dayoff: "Folga", remote: "Remoto", personal: "Pessoal", training: "Treinamento", other: "Outro" };
const mgPlaceholders = { name: "Ex.: Meta de novos contratos…", category: "Ex.: Comercial…", description: "Ex.: Comissão da proposta Aurora…", responsible: "Ex.: Nome do responsável…", notes: "Adicione observações importantes…" };
const mgFields = (fields) => fields.map((field) => ({ ...field, placeholder: field.placeholder || mgPlaceholders[field.name] || ({ user_id: "Ex.: ID do membro…", project_id: "Ex.: ID do projeto…", task_id: "Ex.: ID da tarefa…", minutes: "Ex.: 60" }[field.name]) }));
const mgState = Object.fromEntries(Object.keys(mgConfig).map((kind) => [kind, { search: "", status: "", offset: 0, request: 0 }]));
const mgTimers = {};
const mgValidatePeriod = (kind, values) => {
  const pairs = kind === "metas" ? ["period_start", "period_end"] : kind === "ausencias" ? ["starts_on", "ends_on"] : [];
  if (pairs.length && values[pairs[0]] && values[pairs[1]] && values[pairs[1]] < values[pairs[0]]) throw new Error("A data final deve ser igual ou posterior à data inicial.");
};
const mgValidateCommission = (values) => {
  const amount = Number(values.amount);
  const rate = values.rate === "" || values.rate === undefined || values.rate === null ? null : Number(values.rate);
  if (!Number.isFinite(amount) || amount < 0) throw new Error("Informe um valor de comissão igual ou maior que zero.");
  if (rate !== null && (!Number.isFinite(rate) || rate < 0 || rate > 100)) throw new Error("O percentual deve estar entre 0 e 100.");
};
const mgValidateAbsence = (values) => {
  if (!String(values.user_id || "").trim()) throw new Error("Informe o membro da equipe.");
  if (!String(values.kind || "").trim()) throw new Error("Selecione o tipo de ausência.");
  if (!values.starts_on || !values.ends_on) throw new Error("Informe as datas de início e fim da ausência.");
};
const mgDetails = (kind, row) => { if (!row) return; const labels = { metas: "Meta", comissoes: "Comissão", ausencias: "Ausência", horas: "Registro de horas" }; const format = (entry) => entry === null || entry === undefined || entry === "" ? "—" : typeof entry === "object" ? JSON.stringify(entry, null, 2) : String(entry); ui.drawer({ title: row.name || row.description || mgKindLabels[row.kind] || labels[kind], subtitle: labels[kind], html: ui.facts(Object.entries(row).filter(([key]) => !["id", "organization_id"].includes(key)).map(([key, entry]) => [key.replaceAll("_", " "), format(entry)])) }); };

async function renderManagement(kind) {
  if (location.hash.replace(/^#/, "") !== kind) return;
  const cfg = mgConfig[kind];
  const state = mgState[kind], request = state.request = (state.request || 0) + 1;
  dashboardGrid.setAttribute("aria-busy", "true");
  const restoreSearchFocus = ui.keepSearchFocus(dashboardGrid, "[data-mg-search]");
  dashboardGrid.innerHTML = `<section class="page-intro"><div><p class="card-kicker">Gestão</p><h2>${cfg.title}</h2><p>Registros vinculados ao workspace, com histórico e permissões aplicadas.</p></div></section>${stateBlock.loading("Carregando…")}`;
  try {
    const params = new URLSearchParams({ limit: "100", offset: String(state.offset) });
    if (state.search) params.set("search", state.search); if (state.status) params.set("status", state.status);
    const response = await api(`/api/${cfg.table}?${params}`), rows = response[cfg.table] || [], pagination = response.pagination || {};
    if (request !== state.request || location.hash.replace(/^#/, "") !== kind) return;
    const total = kind === "horas" ? rows.reduce((sum, row) => sum + Number(row.minutes || 0), 0) : kind === "comissoes" ? rows.reduce((sum, row) => sum + Number(row.amount || 0), 0) : rows.length;
    const statusValues = mgStatusOptions[kind].length ? mgStatusOptions[kind] : [...new Set(rows.map((row) => row.status).filter(Boolean))].sort();
    dashboardGrid.innerHTML = `<section class="page-intro"><div><p class="card-kicker">Gestão</p><h2>${cfg.title}</h2><p>Registros vinculados ao workspace, com histórico e permissões aplicadas.</p></div><button type="button" class="button button-primary compact-action" data-mg-new>+ Novo</button></section><section class="finance-metrics"><article class="data-card finance-metric"><span>Total de registros</span><strong>${rows.length}</strong></article><article class="data-card finance-metric"><span>${kind === "horas" ? "Tempo registrado" : kind === "comissoes" ? "Valor acumulado" : kind === "metas" ? "Metas em andamento" : "Programadas"}</span><strong>${kind === "horas" ? `${Math.floor(total / 60)}h` : kind === "comissoes" ? mgMoney(total) : rows.filter((row) => !["completed", "cancelled", "paid"].includes(row.status)).length}</strong></article></section><section class="data-card"><div class="finance-toolbar"><input type="search" data-mg-search value="${mgEsc(state.search)}" placeholder="Buscar registro…" aria-label="Buscar registro"><select data-mg-status aria-label="Filtrar status"><option value="">Todos os status</option>${[...new Set(rows.map((row) => row.status).filter(Boolean))].sort().map((status) => `<option value="${mgEsc(status)}"${state.status === status ? " selected" : ""}>${mgEsc(status)}</option>`).join("")}</select></div><p class="ui-filter-status" data-mg-results role="status" aria-live="polite"></p>${rows.length ? `<div class="table-wrap"><table class="finance-table"><thead><tr><th>${kind === "metas" ? "Meta" : kind === "comissoes" ? "Comissão" : kind === "ausencias" ? "Tipo" : "Registro"}</th><th>Resumo</th><th>Status</th><th>Data</th><th>Ações</th></tr></thead><tbody>${rows.map((row) => `<tr data-mg-row><td><strong>${mgEsc(kind === "ausencias" ? (mgKindLabels[row.kind] || row.kind || "Ausência") : row[cfg.key] || row.name || `Registro #${row.id}`)}</strong>${kind === "ausencias" && row.notes ? `<small>${mgEsc(row.notes)}</small>` : ""}</td><td>${mgEsc(mgValue(kind, row))}</td><td>${row.status ? ui.badge(mgStatusLabels[row.status] || row.status, mgStatusTone[row.status] || "gray") : `<span class="muted">—</span>`}</td><td>${mgEsc(mgDate(row.created_at || row.starts_on))}</td><td><button type="button" class="compact-action" data-mg-edit="${row.id}">Editar</button><button type="button" class="compact-action" data-mg-delete="${row.id}">Excluir</button></td></tr>`).join("")}</tbody></table></div>` : stateBlock.empty(`Nenhum registro em ${cfg.title.toLowerCase()}`, "Cadastre o primeiro registro para acompanhar este indicador.", "Criar agora", "mg-empty")}<div class="table-pagination"><button type="button" class="compact-action" data-mg-prev ${state.offset === 0 ? "disabled" : ""}>Anterior</button><span>Página ${Math.floor(state.offset / 100) + 1}</span><button type="button" class="compact-action" data-mg-next ${(pagination.returned ?? rows.length) < 100 ? "disabled" : ""}>Próxima</button></div></section>`;
    const legacyMetrics = dashboardGrid.querySelector(".finance-metrics"); if (legacyMetrics) { legacyMetrics.insertAdjacentHTML("afterend", ui.stats([{ label: "Registros nesta página", value: ui.number(rows.length) }, { label: kind === "horas" ? "Tempo registrado" : kind === "comissoes" ? "Valor acumulado" : kind === "metas" ? "Em andamento" : "Programadas", value: kind === "horas" ? `${Math.floor(total / 60)}h` : kind === "comissoes" ? mgMoney(total) : ui.number(rows.filter((row) => !["completed", "cancelled", "paid"].includes(row.status)).length), tone: kind === "comissoes" ? "green" : undefined } ])); legacyMetrics.remove(); }
    const statusFilter = dashboardGrid.querySelector("[data-mg-status]");
    if (statusFilter) { statusFilter.name = "status"; statusFilter.setAttribute("autocomplete", "off"); }
    if (statusFilter && mgStatusOptions[kind].length) statusFilter.innerHTML = `<option value="">Todos os status</option>${statusValues.map((status) => `<option value="${mgEsc(status)}"${state.status === status ? " selected" : ""}>${mgEsc(mgStatusLabels[status] || status)}</option>`).join("")}`;
    dashboardGrid.removeAttribute("aria-busy");
    restoreSearchFocus();
    const searchInput = dashboardGrid.querySelector("[data-mg-search]");
    if (searchInput) { searchInput.name = "search"; searchInput.autocomplete = "off"; }
    dashboardGrid.querySelectorAll("[data-mg-row]").forEach((row, index) => { const detail = document.createElement("button"); detail.type = "button"; detail.className = "compact-action"; detail.textContent = "Detalhes"; detail.setAttribute("aria-label", `Ver detalhes de ${cfg.title.toLowerCase()} ${index + 1}`); detail.addEventListener("click", () => mgDetails(kind, rows[index])); row.querySelector("td:last-child")?.prepend(detail); if (kind === "horas" && rows[index]?.started_at && !rows[index]?.ended_at) { const stop = document.createElement("button"); stop.type = "button"; stop.className = "compact-action"; stop.textContent = "Finalizar cronômetro"; stop.setAttribute("aria-label", "Finalizar cronômetro deste registro"); stop.addEventListener("click", async () => { if (stop.dataset.busy === "1") return; const routeAtStart = location.hash, requestAtStart = state.request; stop.dataset.busy = "1"; stop.disabled = true; stop.setAttribute("aria-busy", "true"); const originalLabel = stop.textContent; stop.textContent = "Finalizando…"; try { await api(`/api/time-entry-timer/${rows[index].id}/stop`, { method: "POST", body: {} }); if (location.hash !== routeAtStart || requestAtStart !== state.request || !stop.isConnected) return; toast("Cronômetro finalizado.", "success"); renderManagement(kind); } catch (error) { if (location.hash === routeAtStart && requestAtStart === state.request && stop.isConnected) { stop.disabled = false; stop.removeAttribute("aria-busy"); stop.textContent = originalLabel; toast(error.message, "error"); } } finally { if (stop.isConnected) { stop.dataset.busy = ""; stop.disabled = false; stop.removeAttribute("aria-busy"); } } }); row.querySelector("td:last-child")?.append(stop); } });
    dashboardGrid.querySelectorAll("[data-mg-status] option").forEach((option) => { option.textContent = mgStatusLabels[option.value] || option.textContent; });
    const reload = () => { state.search = dashboardGrid.querySelector("[data-mg-search]").value.trim(); state.status = dashboardGrid.querySelector("[data-mg-status]").value; state.offset = 0; clearTimeout(mgTimers[kind]); mgTimers[kind] = setTimeout(() => renderManagement(kind), 250); };
    dashboardGrid.querySelector("[data-mg-search]")?.addEventListener("input", reload); dashboardGrid.querySelector("[data-mg-status]")?.addEventListener("change", reload);
    dashboardGrid.querySelector("[data-mg-prev]")?.addEventListener("click", () => { state.offset = Math.max(0, state.offset - 100); renderManagement(kind); }); dashboardGrid.querySelector("[data-mg-next]")?.addEventListener("click", () => { state.offset += 100; renderManagement(kind); });
    const openForm = (row = {}) => { const routeAtStart = location.hash; return ui.form({ title: row.id ? `Editar ${cfg.title.toLowerCase()}` : `Novo registro · ${cfg.title}`, subtitle: "Gestão", values: row, fields: mgFields(cfg.fields), submitLabel: row.id ? "Salvar alterações" : "Cadastrar", onSubmit: async (values) => { mgValidatePeriod(kind, values); if (kind === "comissoes") mgValidateCommission(values); if (kind === "ausencias") mgValidateAbsence(values); await api(row.id ? `/api/${cfg.table}/${row.id}` : `/api/${cfg.table}`, { method: row.id ? "PATCH" : "POST", body: values }); if (location.hash !== routeAtStart || location.hash.replace(/^#/, "") !== kind) return; toast("Registro salvo.", "success"); renderManagement(kind); } }); };
    dashboardGrid.querySelector("[data-mg-new], .mg-empty")?.addEventListener("click", () => openForm());
    dashboardGrid.querySelectorAll("[data-mg-edit]").forEach((button) => button.addEventListener("click", () => Promise.resolve(openForm(rows.find((row) => String(row.id) === button.dataset.mgEdit))).catch((error) => toast(error.message, "error"))));
    dashboardGrid.querySelectorAll("[data-mg-delete]").forEach((button) => button.addEventListener("click", () => ui.confirmInline(button, { text: "Excluir este registro?", onConfirm: async () => { const routeAtStart = location.hash, originalLabel = button.textContent; button.disabled = true; button.setAttribute("aria-busy", "true"); button.textContent = "Excluindo…"; try { await api(`/api/${cfg.table}/${button.dataset.mgDelete}`, { method: "DELETE" }); if (location.hash === routeAtStart && location.hash.replace(/^#/, "") === kind) { toast("Registro movido para a lixeira.", "success"); renderManagement(kind); } } catch (error) { if (button.isConnected) { button.disabled = false; button.removeAttribute("aria-busy"); button.textContent = originalLabel; toast(error.message, "error"); } } } })));
  } catch (error) { if (request !== state.request || location.hash.replace(/^#/, "") !== kind) return; dashboardGrid.removeAttribute("aria-busy"); dashboardGrid.innerHTML = stateBlock.error(error.message, "mg-retry"); dashboardGrid.querySelector(".mg-retry")?.addEventListener("click", () => renderManagement(kind)); }
}
registerRoutes({ metas: () => renderManagement("metas"), comissoes: () => renderManagement("comissoes"), ausencias: () => renderManagement("ausencias"), horas: () => renderManagement("horas") });
window.addEventListener("hashchange", () => {
  const activeKind = location.hash.replace(/^#/, "");
  Object.entries(mgState).forEach(([kind, state]) => { if (kind !== activeKind) { state.request += 1; clearTimeout(mgTimers[kind]); mgTimers[kind] = null; } });
});
const mgTimerObserver = new MutationObserver(() => {
  if (location.hash.replace(/^#/, "") !== "horas") return;
  const intro = dashboardGrid.querySelector(".page-intro");
  if (!intro || intro.querySelector("[data-mg-start-timer]")) return;
  const button = document.createElement("button");
  button.type = "button";
  button.className = "button button-secondary compact-action";
  button.dataset.mgStartTimer = "1";
  button.textContent = "Iniciar cronômetro";
  intro.append(button);
});
mgTimerObserver.observe(dashboardGrid, { childList: true, subtree: true });

dashboardGrid.addEventListener("click", async (event) => {
  const button = event.target.closest?.("[data-mg-start-timer]");
  if (!button || button.dataset.busy === "1") return;
  const routeAtStart = location.hash;
  button.dataset.busy = "1";
  button.disabled = true;
  button.setAttribute("aria-busy", "true");
  button.textContent = "Iniciando…";
  try {
    await api("/api/time-entry-timer/start", { method: "POST", body: {} });
    if (location.hash !== routeAtStart || location.hash !== "#horas" || !button.isConnected) return;
    toast("Cronômetro iniciado.", "success");
    renderManagement("horas");
  } catch (error) {
    if (location.hash !== routeAtStart || !button.isConnected) return;
    button.disabled = false;
    button.removeAttribute("aria-busy");
    button.dataset.busy = "";
    button.textContent = "Iniciar cronômetro";
    toast(error.message, "error");
  }
}, true);
dashboardGrid.addEventListener("click", (event) => {
  const button = event.target.closest?.("[data-mg-delete]");
  const kind = location.hash.replace(/^#/, "");
  const cfg = mgConfig[kind];
  if (!button || !cfg || button.dataset.mgDeleteGuarded === "1") return;
  event.preventDefault();
  event.stopImmediatePropagation();
  button.dataset.mgDeleteGuarded = "1";
  const routeAtStart = location.hash;
  const requestAtStart = mgState[kind].request;
  ui.confirmInline(button, {
    text: "Excluir este registro?",
    onConfirm: async () => {
      button.disabled = true;
      button.setAttribute("aria-busy", "true");
      button.textContent = "Excluindo…";
      try {
        await api(`/api/${cfg.table}/${button.dataset.mgDelete}`, { method: "DELETE" });
        if (location.hash !== routeAtStart || requestAtStart !== mgState[kind].request) return;
        ui.toast("Registro movido para a lixeira.", "success");
        renderManagement(kind);
      } catch (error) {
        if (location.hash !== routeAtStart) return;
        if (button.isConnected) { button.disabled = false; button.removeAttribute("aria-busy"); button.textContent = originalLabel; }
        throw error;
      } finally {
        delete button.dataset.mgDeleteGuarded;
      }
    },
    onCancel: () => { delete button.dataset.mgDeleteGuarded; },
  });
}, true);
dashboardGrid.addEventListener("click", (event) => { if (!event.target.closest(".mg-retry")) return; const key = location.hash.replace(/^#/, ""); if (mgConfig[key]) renderManagement(key); });

new MutationObserver(() => {
  dashboardGrid.querySelectorAll(".state-loading p").forEach((label) => { if (label.textContent?.includes("...")) label.textContent = label.textContent.replaceAll("...", "…"); });
  dashboardGrid.querySelectorAll("button:disabled, input:disabled, select:disabled").forEach((control) => control.setAttribute("aria-busy", "true"));
  dashboardGrid.querySelectorAll(".finance-table thead th").forEach((header) => header.setAttribute("scope", "col"));
  dashboardGrid.querySelectorAll("[data-mg-row] td:last-child button, .table-pagination button, [data-mg-new], .mg-empty").forEach((control) => { control.style.touchAction = "manipulation"; });
  dashboardGrid.querySelectorAll("table.finance-table").forEach((table) => {
    if (table.caption) return;
    const caption = document.createElement("caption");
    caption.className = "sr-only";
    caption.textContent = "Registros de gestão do workspace";
    table.prepend(caption);
  });
  const result = dashboardGrid.querySelector("[data-mg-results]");
  if (result) { const count = dashboardGrid.querySelectorAll("[data-mg-row]").length; const label = count === 1 ? "1 registro encontrado" : `${count} registros encontrados`; if (result.textContent !== label) result.textContent = label; }
}).observe(dashboardGrid, { childList: true, subtree: true });
