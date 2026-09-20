/* Contas: contatos, empresas, clientes, CNPJ e portal. */
const contaEsc = (v) => escapeHtml(v ?? "");
const contaMoneyFormatter = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const contaMoney = (v) => contaMoneyFormatter.format(Number(v || 0));
const contaStatus = { active: "Ativo", inactive: "Inativo", churned: "Cancelado", draft: "Rascunho", paused: "Pausado", completed: "Concluído", cancelled: "Cancelado" };
const contaFieldLabels = { name: "Nome", email: "E-mail", phone: "Telefone", whatsapp: "WhatsApp", role: "Cargo", notes: "Observações", department: "Departamento", document: "Documento", birth_date: "Nascimento", city: "Cidade", state: "UF", country: "País", preferred_channel: "Canal preferido", contact_type: "Tipo de contato", source: "Origem", owner: "Responsável", tags: "Tags", is_primary: "Contato principal", company_id: "Empresa (ID)", company_name: "Empresa", contact_id: "Contato (ID)", website: "Site", address: "Endereço", legal_name: "Razão social", trade_name: "Nome fantasia", state_registration: "Inscrição estadual", municipal_registration: "Inscrição municipal", status: "Status", founded_on: "Fundação", size: "Porte", segment: "Segmento", primary_activity: "Atividade principal", zip_code: "CEP", street: "Rua", street_number: "Número", complement: "Complemento", neighborhood: "Bairro", internal_owner: "Responsável interno", last_cnpj_lookup_at: "Última consulta CNPJ", created_at: "Criado em", updated_at: "Atualizado em", person_type: "Tipo de pessoa", responsible_name: "Responsável", responsible_role: "Cargo do responsável", secondary_phone: "Telefone secundário", instagram: "Instagram", linkedin: "LinkedIn", contact_hours: "Horário de contato", company_size: "Porte", services_interest: "Serviços de interesse", main_need: "Necessidade principal", estimated_budget: "Orçamento estimado", urgency: "Urgência", sales_owner: "Vendedor", funnel_stage: "Etapa do funil", lead_temperature: "Temperatura", closing_probability: "Probabilidade de fechamento", first_contact_at: "Primeiro contato", last_contact_at: "Último contato", next_contact_at: "Próximo contato", next_action: "Próxima ação", commercial_notes: "Notas comerciais", financial_status: "Situação financeira", avatar_url: "Avatar", default_payment_terms: "Condições de pagamento" };
const contaDateTimeFormatter = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });
const contaDateFormatter = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" });
const contaFieldValue = (key, value) => { if (value === null || value === undefined || value === "") return "—"; if (typeof value === "boolean") return value ? "Sim" : "Não"; if (Array.isArray(value)) return value.join(", ") || "—"; if (typeof value === "object") return JSON.stringify(value); if (/_at$/.test(key) && /^\d{4}-\d{2}-\d{2}T/.test(String(value))) { const date = new Date(value); return Number.isNaN(date.getTime()) ? "—" : contaDateTimeFormatter.format(date); } if (/(_on|_date)$/.test(key) && /^\d{4}-\d{2}-\d{2}/.test(String(value))) { const date = new Date(value); return Number.isNaN(date.getTime()) ? "—" : contaDateFormatter.format(date); } if (key === "status") return contaStatus[value] || String(value); return String(value); };
const contaFacts = (record, limit = 40) => ui.facts(Object.entries(record).filter(([key, value]) => !["id", "organization_id", "password_hash", "portal_password_hash"].includes(key) && !/(_hash|_token)$/.test(key) && value !== null && value !== undefined && value !== "").slice(0, limit).map(([key, value]) => [contaFieldLabels[key] || key.replaceAll("_", " "), contaFieldValue(key, value)]));
const contaTone = (status) => ({ active: "green", completed: "green", paused: "orange", draft: "gray", inactive: "gray", churned: "red", cancelled: "red" }[status] || "gray");
/* KPIs por tipo de lista: sempre calculados sobre o universo completo, não só sobre a página filtrada. */
function contaKpis(type, universe, rows, filtered) {
  const week = Date.now() - 7 * 864e5, recent = universe.filter((r) => r.created_at && new Date(r.created_at).getTime() >= week).length;
  const note = filtered ? `${rows.length} na lista` : "";
  if (type === "client") { const active = universe.filter((r) => r.status === "active").length; return ui.stats([{ label: "Clientes", value: ui.number(universe.length), note }, { label: "Ativos", value: ui.number(active), tone: "green" }, { label: "Inativos ou cancelados", value: ui.number(universe.filter((r) => ["inactive", "churned", "cancelled"].includes(r.status)).length), tone: universe.length && active < universe.length ? "orange" : undefined }, { label: "Novos em 7 dias", value: ui.number(recent) }]); }
  if (type === "company") { return ui.stats([{ label: "Empresas", value: ui.number(universe.length), note }, { label: "Ativas", value: ui.number(universe.filter((r) => (r.status || "active") === "active").length), tone: "green" }, { label: "Com CNPJ", value: ui.number(universe.filter((r) => r.document).length) }, { label: "Novas em 7 dias", value: ui.number(recent) }]); }
  return ui.stats([{ label: "Contatos", value: ui.number(universe.length), note }, { label: "Com e-mail", value: ui.number(universe.filter((r) => r.email).length), tone: "green" }, { label: "Com telefone", value: ui.number(universe.filter((r) => r.phone).length) }, { label: "Novos em 7 dias", value: ui.number(recent) }]);
}
const contaState = (kind, text) => `<div class="conta-state">${stateBlock[kind](String(text ?? "").replaceAll("...", "…"))}</div>`;
const contaIntro = (title, text, kind) => `<section class="page-intro contas-intro"><div><p class="card-kicker">Contas</p><h2>${contaEsc(title)}</h2><p>${contaEsc(text)}</p></div>${kind && kind !== "portal" ? `<button class="button button-primary compact-action" data-create="${kind}" type="button">+ Novo</button>` : ""}</section>`;
const records = async (path, key) => (await api(path))[key] || [];
function portalShareActions(anchor, link, clientName = "cliente") {
  if (!anchor?.parentElement || anchor.parentElement.querySelector("[data-portal-share]")) return;
  const message = `Olá, ${clientName}! Acompanhe seus contratos, projetos e pagamentos pelo Portal do cliente: ${link}`;
  const share = document.createElement("div");
  share.dataset.portalShare = "1";
  share.className = "portal-share-actions";
  share.innerHTML = `<small>Compartilhar portal</small><div><button type="button" class="compact-action" data-portal-copy>Copiar link</button><button type="button" class="compact-action" data-portal-whatsapp>WhatsApp</button><button type="button" class="compact-action" data-portal-email>E-mail</button><button type="button" class="compact-action" data-portal-native>Outros canais</button></div>`;
  const copy = async () => { await ui.copyText(link); ui.toast("Link do portal copiado.", "success"); };
  share.querySelector("[data-portal-copy]").addEventListener("click", copy);
  share.querySelector("[data-portal-whatsapp]").addEventListener("click", () => window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer"));
  share.querySelector("[data-portal-email]").addEventListener("click", () => { window.location.href = `mailto:?subject=${encodeURIComponent("Acesso ao Portal do cliente")}&body=${encodeURIComponent(message)}`; });
  share.querySelector("[data-portal-native]").addEventListener("click", async () => { if (navigator.share) { try { await navigator.share({ title: "Portal do cliente", text: message, url: link }); } catch { /* cancelado pelo usuário */ } } else await copy(); });
  anchor.parentElement.append(share);
}
// Campos são opcionais por padrão; cada fluxo marca explicitamente seus obrigatórios.
const field = (name, label, type = "text", extra = {}) => ({ name, label, type, required: false, ...extra });
createConfig.contato = { title: "Novo contato", endpoint: "/api/contacts", fields: [field("name", "Nome", "text", { required: true }), field("email", "E-mail", "email"), field("phone", "Telefone"), field("role", "Cargo"), field("notes", "Observações"), field("company_id", "Empresa", "select", { options: [] })] };
createConfig.empresa = { title: "Nova empresa", endpoint: "/api/companies", fields: [field("name", "Nome", "text", { required: true }), field("document", "CNPJ"), field("email", "E-mail", "email"), field("phone", "Telefone"), field("website", "Website", "url"), field("address", "Endereço")] };
createConfig.contato.fields.push(field("department", "Departamento"), field("document", "CPF"), field("birth_date", "Data de nascimento", "date", { required: false }), field("city", "Cidade"), field("state", "Estado"), field("preferred_channel", "Canal preferido"), field("contact_type", "Tipo de contato"), field("source", "Origem"), field("owner", "Responsável interno"), field("tags", "Etiquetas"), field("is_primary", "Contato principal", "checkbox"));
createConfig.empresa.fields.push(field("legal_name", "Razão social"), field("trade_name", "Nome fantasia"), field("state_registration", "Inscrição estadual"), field("municipal_registration", "Inscrição municipal"), field("status", "Situação"), field("founded_on", "Data de abertura", "date", { required: false }), field("size", "Porte"), field("segment", "Segmento"), field("primary_activity", "Atividade principal"), field("whatsapp", "WhatsApp"), field("zip_code", "CEP", "text", { required: false, cepLookup: true }), field("street", "Rua"), field("street_number", "Número"), field("city", "Cidade"), field("state", "Estado"), field("country", "País"), field("internal_owner", "Responsável interno"), field("source", "Origem"));
// A criação usa o endpoint rápido existente; a edição reutiliza os mesmos
// campos pela rota canônica /api/clients/:id. Vínculos são opcionais.
createConfig.cliente = { title: "Novo cliente", endpoint: "/api/clients/quick", fields: [field("name", "Nome", "text", { required: true }), field("company_id", "Empresa", "select", { options: [] }), field("contact_id", "Contato", "select", { options: [] }), field("company_name", "Empresa (opcional)"), field("company_document", "CNPJ da empresa (opcional)"), field("email", "E-mail", "email"), field("phone", "Telefone"), field("status", "Status", "select", { options: [["active", "Ativo"], ["inactive", "Inativo"], ["churned", "Cancelado"]] })] };
createConfig.cliente.fields[5].options = [["lead", "Lead"], ["prospecting", "Prospectando"], ["active", "Cliente ativo"], ["inactive", "Cliente inativo"], ["blocked", "Bloqueado"]];
createConfig.cliente.fields.push(field("legal_name", "Razão social", "text", { required: false }), field("trade_name", "Nome fantasia", "text", { required: false }), field("person_type", "Pessoa física ou jurídica", "select", { options: [["person", "Pessoa física"], ["company", "Pessoa jurídica"]] }), field("document", "CPF/CNPJ", "text", { required: false }), field("responsible_name", "Responsável", "text", { required: false }), field("responsible_role", "Cargo", "text", { required: false }), field("whatsapp", "WhatsApp", "tel", { required: false }), field("secondary_phone", "Telefone secundário", "tel", { required: false }), field("website", "Site", "url", { required: false }), field("instagram", "Instagram", "text", { required: false }), field("linkedin", "LinkedIn", "url", { required: false }), field("preferred_channel", "Canal preferido", "text", { required: false }), field("zip_code", "CEP", "text", { required: false, cepLookup: true }), field("street", "Rua", "text", { required: false }), field("street_number", "Número", "text", { required: false }), field("complement", "Complemento", "text", { required: false }), field("neighborhood", "Bairro", "text", { required: false }), field("city", "Cidade", "text", { required: false }), field("state", "Estado", "text", { required: false }), field("country", "País", "text", { required: false }), field("segment", "Segmento", "text", { required: false }), field("services_interest", "Serviços de interesse", "text", { required: false }), field("main_need", "Necessidade principal", "text", { required: false }), field("sales_owner", "Responsável comercial", "text", { required: false }), field("lead_temperature", "Temperatura", "select", { options: [["cold", "Frio"], ["warm", "Morno"], ["hot", "Quente"]] }), field("last_contact_at", "Último contato", "datetime-local", { required: false }), field("next_contact_at", "Próximo contato", "datetime-local", { required: false }), field("next_action", "Próxima ação", "text", { required: false }), field("estimated_budget", "Orçamento estimado", "number", { required: false }), field("monthly_fee", "Mensalidade", "number", { required: false }), field("financial_status", "Situação financeira", "text", { required: false }), field("internal_notes", "Observações internas", "text", { required: false }));
async function prepareCreate(kind, shouldOpen = true) { const routeAtStart = location.hash; if (kind === "contato" || kind === "cliente") { const [companies, contacts] = await Promise.all([records("/api/companies", "companies"), kind === "cliente" ? records("/api/contacts", "contacts") : Promise.resolve([])]); if (location.hash !== routeAtStart) return; const config = createConfig[kind]; const companyField = config?.fields?.find((x) => x.name === "company_id"); const contactField = config?.fields?.find((x) => x.name === "contact_id"); if (companyField) companyField.options = [["", "Sem empresa"], ...companies.map((x) => [x.id, x.name])]; if (contactField) contactField.options = [["", "Sem contato"], ...contacts.map((x) => [x.id, x.name])]; } if (shouldOpen && location.hash === routeAtStart) openCreateDialog(kind); }
function tableRows(rows, type) { return rows.map((r) => `<article class="conta-row" data-q="${contaEsc(`${r.name || ""} ${r.email || ""} ${r.document || ""}`.toLowerCase())}"><div><strong>${contaEsc(r.name)}</strong><small>${contaEsc(r.email || r.document || r.phone || "Sem dados adicionais")}</small></div>${type === "client" ? ui.badge(contaStatus[r.status] || r.status || "—", contaTone(r.status)) : type === "company" ? `<small>${contaEsc(r.city ? `${r.city}${r.state ? `/${r.state}` : ""}` : r.phone || r.segment || "")}</small>` : `<small>${contaEsc(r.role || r.phone || "")}</small>`}<button class="compact-action" data-detail="${r.id}" data-detail-type="${type}" type="button">Detalhes</button>${type === "client" ? `<button class="compact-action" data-portal="${r.id}" type="button">Gerar link do portal</button>` : ""}<button class="compact-action" data-edit="${r.id}" data-edit-type="${type}" type="button">Editar</button><button class="compact-action" data-remove="${r.id}" data-remove-type="${type}" type="button">Excluir</button></article>`).join(""); }
const contaStatusFilters = { client: [["", "Todos os status"], ["active", "Ativo"], ["inactive", "Inativo"], ["blocked", "Bloqueado"], ["churned", "Cancelado"]], company: [["", "Todos os status"], ["active", "Ativa"], ["inactive", "Inativa"]] };
let contaListRequest = 0;
async function renderList(kind, title, description, path, key, type, search = "", status = "") { const request = ++contaListRequest; const routeEpoch = contaRouteEpoch; dashboardGrid.innerHTML = contaIntro(title, description, kind) + contaState("loading", "Carregando..."); try { const params = new URLSearchParams(); if (search) params.set("search", search.slice(0, 100)); if (status) params.set("status", status); const query = params.toString() ? `?${params}` : ""; const filter = contaStatusFilters[type]?.length ? `<label class="conta-filter">Status<select data-conta-status aria-label="Filtrar por status">${contaStatusFilters[type].map(([value, label]) => `<option value="${value}" ${value === status ? "selected" : ""}>${label}</option>`).join("")}</select></label>` : ""; const rows = await records(`${path}${query}`, key); if (request !== contaListRequest || routeEpoch !== contaRouteEpoch) return; const universe = query ? await records(path, key).catch(() => rows) : rows; if (request !== contaListRequest || routeEpoch !== contaRouteEpoch) return; dashboardGrid.innerHTML = contaIntro(title, description, kind) + contaKpis(type, universe, rows, query) + `<section class="data-card contas-list"><div class="section-heading"><h2>${contaEsc(title)}</h2><div class="conta-list-filters"><label>Busca<input data-conta-search value="${contaEsc(search)}" placeholder="Buscar…" aria-label="Buscar" /></label>${filter}<button class="compact-action" type="button" data-conta-csv>Exportar CSV</button></div></div><div class="conta-rows">${rows.length ? tableRows(rows, type) : universe.length ? `<div class="ui-empty-inline">Nenhum registro corresponde à busca.</div>` : contaState("empty", `Nenhum registro de ${title.toLowerCase()}.`)}</div></section>`; dashboardGrid.querySelector("[data-conta-csv]")?.addEventListener("click", () => ui.downloadCsv(`${title.toLowerCase().replace(/\s+/g, "-")}.csv`, ["Nome", "E-mail", "Telefone", "Documento", "Status"], rows.map((r) => [r.name || "", r.email || "", r.phone || "", r.document || "", contaStatus[r.status] || r.status || ""]))); bindList(rows, type, path, { kind, title, description, key, search, status }); } catch (e) { if (request !== contaListRequest || routeEpoch !== contaRouteEpoch) return; dashboardGrid.innerHTML = contaIntro(title, description, kind) + contaState("error", e.message); bindCreateButtons(); } }
const contaRenderList = renderList;
let contaRouteEpoch = 0;
renderList = async (...args) => {
  const routeByKind = { contato: ["#contatos"], empresa: ["#empresas"], cliente: ["#clientes", "#portal-do-cliente"] };
  if (args[0] === "portal" && location.hash !== "#portal-do-cliente") return;
  if (routeByKind[args[0]] && !routeByKind[args[0]].includes(location.hash)) return;
  const routeAtStart = location.hash;
  const epoch = ++contaRouteEpoch;
  dashboardGrid.setAttribute("aria-busy", "true");
  try { return await contaRenderList(...args); } finally {
    if (epoch !== contaRouteEpoch && location.hash !== routeAtStart) renderHashRoute();
    if (epoch === contaRouteEpoch) dashboardGrid.removeAttribute("aria-busy");
  }
};
window.addEventListener("hashchange", () => { contaRouteEpoch += 1; });
function bindCreateButtons() { dashboardGrid.querySelectorAll("[data-create]").forEach((b) => b.addEventListener("click", () => prepareCreate(b.dataset.create).catch((error) => { if (location.hash === "#contatos" || location.hash === "#empresas" || location.hash === "#clientes") ui.toast(error.message, "error"); }))); }

let contaSearchSnapshot;
dashboardGrid.addEventListener("input", (event) => {
  const input = event.target.closest?.("[data-conta-search]");
  if (input) contaSearchSnapshot = { value: input.value, position: input.selectionStart };
}, true);
const contaSearchObserver = new MutationObserver(() => {
  const input = dashboardGrid.querySelector("[data-conta-search]");
  if (!input) return;
  input.type = "search";
  input.name = "search";
  input.setAttribute("autocomplete", "off");
  if (!contaSearchSnapshot) return;
  if (input.value === contaSearchSnapshot.value) {
    input.focus();
    try { input.setSelectionRange(contaSearchSnapshot.position, contaSearchSnapshot.position); } catch { /* busca sem cursor em alguns navegadores */ }
  }
  contaSearchSnapshot = null;
});
contaSearchObserver.observe(dashboardGrid, { childList: true, subtree: true });

dashboardGrid.addEventListener("click", async (event) => {
  const button = event.target.closest?.("[data-portal]");
  if (!button || !["#clientes", "#portal-do-cliente"].includes(location.hash)) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  if (button.dataset.busy === "1") return;
  button.dataset.busy = "1";
  button.disabled = true;
  button.setAttribute("aria-busy", "true");
  const originalLabel = button.textContent;
  button.textContent = "Gerando link…";
  try {
    const data = await api(`/api/clients/${button.dataset.portal}/portal-link`, { method: "POST", body: {} });
    const link = `${location.origin}/api/portal/${data.token}`;
    await ui.copyText(link);
    button.textContent = "Copiar link novamente";
    const note = button.parentElement.querySelector("[data-portal-link-note]") || document.createElement("small");
    note.dataset.portalLinkNote = "1";
    note.textContent = link;
    button.parentElement.append(note);
    portalShareActions(button, link, button.parentElement.querySelector("strong")?.textContent || "cliente");
    ui.toast("Link do portal copiado.", "success");
  } catch (error) {
    button.textContent = originalLabel;
    ui.toast(error.message, "error");
  } finally {
    button.disabled = false;
    button.removeAttribute("aria-busy");
    button.dataset.busy = "";
  }
}, true);
function bindList(rows, type, path, options) { bindCreateButtons(); const input = dashboardGrid.querySelector("[data-conta-search]"); const status = dashboardGrid.querySelector("[data-conta-status]"); let timer; const refresh = () => renderList(options.kind, options.title, options.description, path, options.key, type, input?.value.trim() || "", status?.value || ""); input?.addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(refresh, 250); }); status?.addEventListener("change", refresh); dashboardGrid.querySelectorAll("[data-portal]").forEach((b) => b.addEventListener("click", async () => { b.disabled = true; try { const d = await api(`/api/clients/${b.dataset.portal}/portal-link`, { method: "POST", body: {} }); const link = `${location.origin}/api/portal/${d.token}`; await ui.copyText(link); b.textContent = "Link copiado"; const note = document.createElement("small"); note.textContent = link; b.parentElement.append(note); const client = rows.find((x) => String(x.id) === String(b.dataset.portal)); portalShareActions(b, link, client?.name || "cliente"); } catch (e) { b.disabled = false; b.textContent = e.message; } })); dashboardGrid.querySelectorAll("[data-remove]").forEach((b) => b.addEventListener("click", async () => { if (b.dataset.confirm !== "1") { b.dataset.confirm = "1"; b.textContent = "Confirmar"; return; } await api(`/api/${type === "contact" ? "contacts" : type === "company" ? "companies" : "clients"}/${b.dataset.remove}`, { method: "DELETE" }); renderHashRoute(); })); dashboardGrid.querySelectorAll("[data-edit]").forEach((b) => b.addEventListener("click", () => { const r = rows.find((x) => String(x.id) === b.dataset.edit); if (!r) return; const kind = type === "contact" ? "contato" : type === "company" ? "empresa" : "cliente"; openEditDialog(kind, r, `/api/${type === "contact" ? "contacts" : type === "company" ? "companies" : "clients"}/${r.id}`); })); dashboardGrid.querySelectorAll("[data-detail]").forEach((b) => b.addEventListener("click", () => { const record = rows.find((x) => String(x.id) === b.dataset.detail); type === "client" ? openClientDetails(record) : openDetails(record, type); })); }
function openDetails(record, type) { if (!record) return; const drawer = ui.drawer({ title: record.name || "Registro", subtitle: type === "client" ? "Cliente" : type === "company" ? "Empresa" : "Contato", html: `${contaFacts(record)}<div class="conta-related" data-related></div>` }); const panel = drawer.body; if (type === "company") Promise.all([records("/api/contacts", "contacts"), records("/api/clients", "clients")]).then(([c, l]) => { const related = panel.isConnected && panel.querySelector("[data-related]"); if (!related) return; related.innerHTML = `<h3>Vínculos</h3><p>Contatos: ${c.filter((x) => String(x.company_id) === String(record.id)).map((x) => contaEsc(x.name)).join(", ") || "Nenhum"}</p><p>Clientes: ${l.filter((x) => String(x.company_id) === String(record.id)).map((x) => contaEsc(x.name)).join(", ") || "Nenhum"}</p>`; }); if (type === "client") records(`/api/contracts?client_id=${record.id}`, "contracts").then((c) => { const related = panel.isConnected && panel.querySelector("[data-related]"); if (!related) return; const total = c.reduce((a, x) => a + Number(x.value || 0), 0); related.innerHTML = `<h3>Contratos</h3><p>Total: ${contaMoney(total)}</p>${c.map((x) => `<p>${contaEsc(x.name)} — ${contaMoney(x.value)}</p>`).join("") || "<p>Nenhum contrato.</p>"}`; }); }
async function renderCnpj() { dashboardGrid.innerHTML = contaIntro("Consulta CNPJ", "Consulte dados cadastrais e salve uma empresa qualificada.") + `<section class="data-card cnpj-card"><form data-cnpj-form><label>CNPJ<input name="cnpj" inputmode="numeric" placeholder="00.000.000/0000-00" required /></label><button class="button button-primary" type="submit">Consultar</button></form><div data-cnpj-result>${contaState("empty", "Digite um CNPJ para consultar.")}</div></section>`; dashboardGrid.querySelector("[data-cnpj-form]").onsubmit = async (e) => { e.preventDefault(); const cnpj = e.target.cnpj.value; dashboardGrid.querySelector("[data-cnpj-result]").innerHTML = contaState("loading", "Consultando..."); try { const d = await api(`/api/cnpj/${encodeURIComponent(cnpj)}`); const name = d.nome_fantasia || d.razao_social; dashboardGrid.querySelector("[data-cnpj-result]").innerHTML = `<div class="cnpj-result"><h3>${contaEsc(name)}</h3><p>${contaEsc(d.razao_social)} · ${contaEsc(d.municipio)} / ${contaEsc(d.uf)}</p><p>${contaEsc(d.email || "")} ${contaEsc(d.telefone || "")}</p><button class="button button-secondary" data-save-cnpj type="button">Criar empresa com estes dados</button></div>`; dashboardGrid.querySelector("[data-save-cnpj]").onclick = async () => { const button = dashboardGrid.querySelector("[data-save-cnpj]"); button.disabled = true; try { const normalizedCnpj = String(d.cnpj || "").replace(/\D/g, ""), [byCnpj, byName] = await Promise.all([records(`/api/companies?search=${encodeURIComponent(d.cnpj)}`, "companies"), d.razao_social ? records(`/api/companies?search=${encodeURIComponent(d.razao_social)}`, "companies") : Promise.resolve([])]), existing = [...byCnpj, ...byName].find((item, index, list) => list.findIndex((candidate) => String(candidate.id) === String(item.id)) === index && (String(item.document || "").replace(/\D/g, "") === normalizedCnpj || String(item.name || "").trim().toLowerCase() === String(d.razao_social || "").trim().toLowerCase())); if (existing) { button.disabled = false; button.textContent = "Empresa já cadastrada"; ui.toast(`CNPJ já está em ${existing.name || "uma empresa existente"}.`, "info"); return; } await api("/api/companies", { method: "POST", body: { name: d.razao_social || name, trade_name: d.nome_fantasia, document: d.cnpj, email: d.email, phone: d.telefone, status: d.situacao, founded_on: d.abertura, primary_activity: d.cnae, zip_code: d.cep, street: d.logradouro, street_number: d.numero, complement: d.complemento, neighborhood: d.bairro, city: d.municipio, state: d.uf, country: "Brasil", address: [d.logradouro, d.numero, d.bairro, d.municipio, d.uf].filter(Boolean).join(", ") } }); button.textContent = "Empresa criada"; ui.toast("Empresa criada com os dados da Receita Federal.", "success"); } catch (error) { button.disabled = false; button.textContent = error.message; ui.toast(error.message, "error"); } }; } catch (err) { dashboardGrid.querySelector("[data-cnpj-result]").innerHTML = contaState("error", err.message); } }; }
async function renderCnpjCore() {
  if (location.hash !== "#consulta-cnpj") return;
  const routeAtStart = location.hash;
  dashboardGrid.innerHTML = contaIntro("Consulta CNPJ", "Consulte dados cadastrais e salve uma empresa qualificada.") + `<section class="data-card cnpj-card"><form data-cnpj-form><label>CNPJ<input name="cnpj" inputmode="numeric" autocomplete="off" placeholder="00.000.000/0000-00…" required /></label><button class="button button-primary" type="submit">Consultar</button></form><div data-cnpj-result role="status" aria-live="polite">${contaState("empty", "Digite um CNPJ para consultar.")}</div></section>`;
  const form = dashboardGrid.querySelector("[data-cnpj-form]"), input = form?.querySelector("[name=cnpj]"), result = dashboardGrid.querySelector("[data-cnpj-result]");
  if (!form || !input || !result) return;
  form.onsubmit = async (event) => {
    event.preventDefault();
    const digits = input.value.replace(/\D/g, "");
    if (digits.length !== 14) { result.innerHTML = contaState("error", "Informe um CNPJ válido com 14 dígitos."); input.focus(); return; }
    const submit = form.querySelector("[type=submit]"); submit.disabled = true; submit.setAttribute("aria-busy", "true"); result.innerHTML = contaState("loading", "Consultando…");
    try {
      const data = await api(`/api/cnpj/${encodeURIComponent(digits)}`);
      if (location.hash !== routeAtStart || !form.isConnected) return;
      const name = data.nome_fantasia || data.razao_social || "Empresa sem nome";
      result.innerHTML = `<div class="cnpj-result"><h3>${contaEsc(name)}</h3><p>${contaEsc(data.razao_social)} · ${contaEsc(data.municipio)} / ${contaEsc(data.uf)}</p><p>${contaEsc(data.email || "")} ${contaEsc(data.telefone || "")}</p><button class="button button-secondary" data-save-cnpj type="button">Criar empresa com estes dados</button></div>`;
      result.querySelector("[data-save-cnpj]")?.addEventListener("click", async (saveEvent) => {
        const button = saveEvent.currentTarget; if (button.disabled) return; button.disabled = true; button.setAttribute("aria-busy", "true");
        try {
          const normalized = String(data.cnpj || digits).replace(/\D/g, ""), [byCnpj, byName] = await Promise.all([records(`/api/companies?search=${encodeURIComponent(normalized)}`, "companies"), data.razao_social ? records(`/api/companies?search=${encodeURIComponent(data.razao_social)}`, "companies") : Promise.resolve([])]);
          if (location.hash !== routeAtStart || !button.isConnected) return;
          const existing = [...byCnpj, ...byName].find((item, index, list) => list.findIndex((candidate) => String(candidate.id) === String(item.id)) === index && (String(item.document || "").replace(/\D/g, "") === normalized || String(item.name || "").trim().toLowerCase() === String(data.razao_social || "").trim().toLowerCase()));
          if (existing) { button.disabled = false; button.textContent = "Empresa já cadastrada"; ui.toast(`CNPJ já está em ${existing.name || "uma empresa existente"}.`, "info"); return; }
          await api("/api/companies", { method: "POST", body: { name: data.razao_social || name, trade_name: data.nome_fantasia, document: data.cnpj || digits, email: data.email, phone: data.telefone, status: data.situacao, founded_on: data.abertura, primary_activity: data.cnae, zip_code: data.cep, street: data.logradouro, street_number: data.numero, complement: data.complemento, neighborhood: data.bairro, city: data.municipio, state: data.uf, country: "Brasil", address: [data.logradouro, data.numero, data.bairro, data.municipio, data.uf].filter(Boolean).join(", ") } });
          if (location.hash !== routeAtStart || !button.isConnected) return;
          button.textContent = "Empresa criada"; ui.toast("Empresa criada com os dados da Receita Federal.", "success");
        } catch (error) { if (location.hash === routeAtStart && button.isConnected) { button.disabled = false; button.removeAttribute("aria-busy"); button.textContent = error.message; ui.toast(error.message, "error"); } }
      });
    } catch (error) { if (location.hash === routeAtStart && result.isConnected) result.innerHTML = contaState("error", error.message); }
    finally { if (form.isConnected) { submit.disabled = false; submit.removeAttribute("aria-busy"); } }
  };
}
const contaOriginalRenderCnpj = renderCnpjCore;
renderCnpj = async function renderCnpjAccessible() {
  if (location.hash !== "#consulta-cnpj") return;
  await contaOriginalRenderCnpj();
  const form = dashboardGrid.querySelector("[data-cnpj-form]");
  const input = form?.querySelector("[name=cnpj]");
  const result = dashboardGrid.querySelector("[data-cnpj-result]");
  if (!form || !input || !result || form.dataset.accessibleBound === "1") return;
  form.dataset.accessibleBound = "1";
  input.setAttribute("autocomplete", "off");
  input.placeholder = "00.000.000/0000-00…";
  result.setAttribute("role", "status");
  result.setAttribute("aria-live", "polite");
  const originalSubmit = form.onsubmit;
  form.onsubmit = async (event) => {
    const digits = input.value.replace(/\D/g, "");
    if (digits.length !== 14) {
      event.preventDefault();
      result.innerHTML = contaState("error", "Informe um CNPJ válido com 14 dígitos.");
      input.focus();
      return;
    }
    const submit = form.querySelector("[type=submit]");
    submit.disabled = true;
    submit.setAttribute("aria-busy", "true");
    submit.textContent = "Consultando…";
    try {
      return await originalSubmit.call(form, event);
    } finally {
      submit.disabled = false;
      submit.removeAttribute("aria-busy");
      submit.textContent = "Consultar";
    }
  };
};

const trapContaDrawerKey = (event, panel, close) => {
  if (event.key === "Escape") { event.preventDefault(); close(); return; }
  if (event.key !== "Tab") return;
  const focusable = [...panel.querySelectorAll("button, input, select, textarea, a[href], [tabindex]:not([tabindex=\"-1\"])")].filter((element) => !element.disabled && element.getAttribute("aria-hidden") !== "true");
  if (!focusable.length) return;
  const first = focusable[0], last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
};

openDetails = async function openContaDetails(record, type) {
  if (!record) return;
  const previouslyFocused = document.activeElement;
  const panel = document.createElement("aside");
  panel.className = "conta-drawer conta-drawer-wide"; panel.setAttribute("role", "dialog"); panel.setAttribute("aria-modal", "true"); panel.setAttribute("aria-label", `Relacionamentos · ${record.name || "Registro"}`);
  panel.innerHTML = `<button class="conta-close" type="button">&times;</button><p class="card-kicker">Relacionamentos</p><h2>${contaEsc(record.name)}</h2><div class="conta-overview" data-related>${contaState("loading", "Carregando vínculos…")}</div>`;
  document.body.append(panel);
  const closePanel = () => { if (!panel.isConnected) return; panel.remove(); document.removeEventListener("keydown", onKey); if (previouslyFocused instanceof HTMLElement && previouslyFocused.isConnected) previouslyFocused.focus(); }; const onKey = (event) => trapContaDrawerKey(event, panel, closePanel); document.addEventListener("keydown", onKey); panel.querySelector(".conta-close").onclick = closePanel; panel.querySelector(".conta-close").focus();
  try {
    const resource = type === "company" ? "companies" : "contacts";
    const data = await api(`/api/${resource}/${record.id}/overview`);
    const entity = type === "company" ? data.company : data.contact;
    const list = (items, empty) => items?.length ? items.map((item) => `<li><strong>${contaEsc(item.name || item.subject || item.title || item.action || "Registro")}</strong>${item.status ? ` · ${contaEsc(contaStatus[item.status] || item.status)}` : ""}</li>`).join("") : `<li class="conta-muted">${empty}</li>`;
    const sections = type === "company"
      ? [["Contatos", data.contacts, "Nenhum contato vinculado."], ["Oportunidades", data.opportunities, "Nenhuma oportunidade."], ["Propostas", data.proposals, "Nenhuma proposta."], ["Contratos", data.contracts, "Nenhum contrato."], ["Projetos", data.projects, "Nenhum projeto."]]
      : [["Clientes", data.clients, "Nenhum cliente vinculado."], ["Leads", data.leads, "Nenhum lead."], ["Oportunidades", data.opportunities, "Nenhuma oportunidade."], ["Conversas", data.conversations, "Nenhuma conversa."]];
    if (!panel.isConnected) return;
    panel.querySelector("[data-related]").innerHTML = `<section><h3>Dados principais</h3><dl>${Object.entries(entity || record).filter(([key]) => !["id", "organization_id"].includes(key)).slice(0, 12).map(([key, value]) => `<dt>${contaEsc(key.replaceAll("_", " "))}</dt><dd>${contaEsc(contaStatus[value] || value || "—")}</dd>`).join("")}</dl></section>${sections.map(([title, items, empty]) => `<section><h3>${title}</h3><ul class="conta-related-list">${list(items, empty)}</ul></section>`).join("")}<section><h3>Histórico de atividades</h3><ul class="conta-related-list">${list(data.activities, "Nenhuma atividade registrada.")}</ul></section>`;
  } catch (error) {
    if (panel.isConnected) panel.querySelector("[data-related]").innerHTML = contaState("error", error.message);
  }
};

const contaOpenEditDialog = openEditDialog;
openEditDialog = function openContaEditDialog(kind, record, endpoint) {
  if (kind === "contato" || kind === "cliente") {
    prepareCreate(kind, false).then(() => contaOpenEditDialog(kind, record, endpoint)).catch((error) => window.ui?.toast?.(error.message, "error"));
    return;
  }
  contaOpenEditDialog(kind, record, endpoint);
};

async function openClientDetails(record) {
  if (!record) return;
  const previouslyFocused = document.activeElement;
  const panel = document.createElement("aside"); panel.className = "conta-drawer conta-drawer-wide"; panel.setAttribute("role", "dialog"); panel.setAttribute("aria-modal", "true"); panel.setAttribute("aria-label", `Visão 360 · ${record.name || "Cliente"}`);
  panel.innerHTML = `<button class="conta-close" type="button" aria-label="Fechar painel">&times;</button><p class="card-kicker">Visão 360</p><h2>${contaEsc(record.name)}</h2><div class="conta-overview" data-overview>${contaState("loading", "Carregando dados do cliente…")}</div>`;
  document.body.append(panel); const closePanel = () => { if (!panel.isConnected) return; panel.remove(); document.removeEventListener("keydown", onKey); if (previouslyFocused instanceof HTMLElement && previouslyFocused.isConnected) previouslyFocused.focus(); }; const onKey = (event) => trapContaDrawerKey(event, panel, closePanel); document.addEventListener("keydown", onKey); panel.querySelector(".conta-close").onclick = closePanel; panel.querySelector(".conta-close").focus();
  try {
    const data = await api(`/api/clients/${record.id}/overview`); if (!panel.isConnected) return; panel._focusClientOverview = data; const money = (v) => contaMoney(v);
    const rows = (items, empty) => items.length ? items : `<p class="conta-muted">${empty}</p>`;
    panel.querySelector("[data-overview]").innerHTML = `<div class="conta-overview-stats"><div><small>Conversas</small><strong>${data.conversations.length}</strong></div><div><small>Projetos ativos</small><strong>${data.summary.active_projects}</strong></div><div><small>Tarefas</small><strong>${data.tasks.length}</strong></div><div><small>A receber</small><strong>${money(data.receivables.filter((x) => !x.paid_at).reduce((a, x) => a + Number(x.amount || 0), 0))}</strong></div></div><section><h3>Contato e empresa</h3><p>${contaEsc(data.client.contact_name || "Sem contato")} · ${contaEsc(data.client.contact_phone || data.client.phone || "Sem telefone")}</p><p>${contaEsc(data.client.company_name || "Sem empresa")}</p></section><section><h3>WhatsApp e conversas</h3>${rows(data.conversations.map((x) => `<p><strong>${contaEsc(x.subject)}</strong> · ${contaEsc(x.last_message || "Sem mensagens")}</p>`).join(""), "Nenhuma conversa vinculada.")}</section><section><h3>Projetos e tarefas</h3>${rows([...data.projects.map((x) => `<p><strong>${contaEsc(x.name)}</strong> · ${contaEsc(contaStatus[x.status] || x.status)} · ${Number(x.progress || 0)}%</p>`), ...data.tasks.slice(0, 10).map((x) => `<p>↳ ${contaEsc(x.title)} · ${contaEsc(x.status || "pendente")}</p>`)].join(""), "Nenhum projeto ou tarefa vinculada.")}</section><section><h3>Contratos</h3>${rows(data.contracts.map((x) => `<p><strong>${contaEsc(x.name)}</strong> · ${contaEsc(contaStatus[x.status] || x.status)} · ${money(x.value)}</p>`).join(""), "Nenhum contrato.")}</section><section><h3>Propostas</h3>${rows(data.proposals.map((x) => `<p><strong>${contaEsc(x.title)}</strong> · ${contaEsc(x.status)} · ${money(x.amount)}</p>`).join(""), "Nenhuma proposta.")}</section><section><h3>Contas a receber</h3>${rows(data.receivables.map((x) => `<p><strong>${contaEsc(x.description)}</strong> · ${money(x.amount)} · ${contaEsc(x.status)}</p>`).join(""), "Nenhuma conta encontrada.")}</section><section><h3>Histórico de atividades</h3>${rows(data.activities.map((x) => `<p><strong>${contaEsc(x.action)}</strong> · ${contaEsc(x.entity_type)} · ${new Date(x.created_at).toLocaleString("pt-BR")}</p>`).join(""), "Nenhuma atividade registrada.")}</section>`;
    const nextActions = [...data.tasks.filter((item) => item.status !== "done").slice(0, 3).map((item) => ({ label: `Concluir tarefa: ${item.title}`, href: "#tarefas" })), ...data.receivables.filter((item) => !item.paid_at).slice(0, 2).map((item) => ({ label: `Acompanhar pagamento: ${item.description}`, href: "#contas-a-receber" })), ...data.conversations.filter((item) => Number(item.unread_count) > 0).slice(0, 2).map((item) => ({ label: `Responder conversa: ${item.subject}`, href: "#conversas" }))];
    panel.querySelector("[data-overview]").insertAdjacentHTML("afterbegin", `<section class="client-next-actions"><h3>Próximas ações</h3>${nextActions.length ? nextActions.map((item) => `<a class="client-next-action" href="${item.href}">${contaEsc(item.label)} <span>→</span></a>`).join("") : "<p class=\"conta-muted\">Nenhuma pendência urgente para este cliente.</p>"}</section>`);
  } catch (error) { if (!panel.isConnected) return; panel.querySelector("[data-overview]").innerHTML = contaState("error", error.message); }
}

/* Ficha 360: transforma o resumo em uma área de trabalho completa sem alterar o cadastro simples. */
const contaSummaryOpenClientDetails = openClientDetails;
openClientDetails = async function openCompleteClientSheet(record) {
  await contaSummaryOpenClientDetails(record);
  const panel = document.querySelector(".conta-drawer-wide");
  if (!panel?.isConnected) return;
  const header = panel.querySelector(".card-kicker")?.parentElement;
  if (header && !panel.querySelector("[data-client-sheet-tools]")) {
    const tools = document.createElement("div");
    tools.dataset.clientSheetTools = "true";
    tools.dataset.clientId = String(record.id);
    tools.dataset.clientName = String(record.name || "Cliente atual");
    tools._focusClientRecord = record;
    tools.className = "client-sheet-tools";
    tools.innerHTML = `<button type="button" class="compact-action" data-client-sheet-edit>Editar ficha</button><button type="button" class="compact-action" data-client-sheet-portal>Gerar portal</button>${record.phone || record.whatsapp ? `<a class="compact-action" href="https://wa.me/${String(record.whatsapp || record.phone).replace(/\\D/g, "")}" target="_blank" rel="noopener noreferrer">WhatsApp</a>` : ""}${record.email ? `<a class="compact-action" href="mailto:${contaEsc(record.email)}">E-mail</a>` : ""}`;
    header.append(tools);
    tools.querySelector("[data-client-sheet-edit]")?.addEventListener("click", () => openEditDialog("cliente", record, `/api/clients/${record.id}`));
    tools.querySelector("[data-client-sheet-portal]")?.addEventListener("click", async (event) => { const button = event.currentTarget; button.disabled = true; button.setAttribute("aria-busy", "true"); try { const result = await api(`/api/clients/${record.id}/portal-link`, { method: "POST", body: {} }); const link = `${location.origin}/api/portal/${result.token}`; button.textContent = "Portal criado"; portalShareActions(button, link, record.name || "cliente"); } catch (error) { button.disabled = false; ui.toast(error.message, "error"); } finally { button.removeAttribute("aria-busy"); } });
  }
  const overview = panel.querySelector("[data-overview]");
  if (!overview || overview.dataset.completeSheet === "1") return;
  overview.dataset.completeSheet = "1";
  try {
    const data = panel._focusClientOverview || await api(`/api/clients/${record.id}/overview`);
    panel._focusClientOverview = data;
    if (!panel.isConnected) return;
    const money = (value) => contaMoney(value);
    const label = (value) => contaStatus[value] || value || "Sem status";
    const empty = (message) => `<p class="conta-muted">${message}</p>`;
    const rows = (items, render, message) => items?.length ? items.map(render).join("") : empty(message);
    const editRelated = (kind, item, endpoint) => item?.id ? `<button type="button" class="compact-action client-related-edit" data-client-related-edit="${contaEsc(kind)}" data-client-related-id="${contaEsc(item.id)}" data-client-related-endpoint="${contaEsc(endpoint)}">Editar</button>` : "";
    const openAmount = (data.receivables || []).filter((item) => !item.paid_at).reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const facts = contaFacts(data.client || record, 80);
    overview.innerHTML = `<nav class="client-sheet-tabs" aria-label="Seções da ficha"><button type="button" class="is-active" aria-selected="true" data-client-tab="sheet-overview">Resumo</button><button type="button" aria-selected="false" data-client-tab="sheet-profile">Dados e contatos</button><button type="button" aria-selected="false" data-client-tab="sheet-commercial">Comercial</button><button type="button" aria-selected="false" data-client-tab="sheet-projects">Projetos e operação</button><button type="button" aria-selected="false" data-client-tab="sheet-finance">Financeiro</button><button type="button" aria-selected="false" data-client-tab="sheet-history">Histórico</button></nav><section data-client-panel="sheet-overview"><div class="conta-overview-stats"><div><small>Conversas</small><strong>${data.conversations.length}</strong></div><div><small>Projetos ativos</small><strong>${data.summary.active_projects}</strong></div><div><small>Tarefas abertas</small><strong>${data.tasks.filter((item) => !["done", "completed"].includes(item.status)).length}</strong></div><div><small>Em aberto</small><strong>${money(openAmount)}</strong></div><div><small>Tickets abertos</small><strong>${data.summary.open_tickets}</strong></div><div><small>Alterações pendentes</small><strong>${data.summary.pending_changes}</strong></div></div><div class="client-sheet-grid"><article><h3>Próximas ações</h3>${rows([...data.tasks.filter((item) => !["done", "completed"].includes(item.status)).slice(0, 5).map((item) => ({ text: item.title, meta: label(item.status), href: "#tarefas" })), ...data.receivables.filter((item) => !item.paid_at).slice(0, 3).map((item) => ({ text: item.description, meta: money(item.amount), href: "#cobrancas" })), ...data.tickets.filter((item) => !["done", "closed", "cancelled"].includes(item.status)).slice(0, 2).map((item) => ({ text: item.title, meta: `Ticket · ${label(item.priority)}`, href: "#tickets" }))], (item) => `<a class="client-next-action" href="${item.href}">${contaEsc(item.text)} <span>${contaEsc(item.meta)}</span></a>`, "Nenhuma pendência para este cliente.")}</article><article><h3>Resumo cadastral</h3>${facts}</article></div></section><section data-client-panel="sheet-profile" hidden><div class="client-sheet-grid"><article><h3>Dados completos</h3>${facts}</article><article><h3>Contatos relacionados</h3>${rows(data.contacts, (item) => `<div class="client-related-row"><strong>${contaEsc(item.name)}</strong><span>${contaEsc(item.role || "Contato")}</span><small>${contaEsc(item.email || item.phone || "Sem canal informado")}</small>${editRelated("contato", item, `/api/contacts/${item.id}`)}</div>`, "Nenhum contato vinculado.")}</article></div></section><section data-client-panel="sheet-commercial" hidden><div class="client-sheet-grid"><article><h3>Propostas</h3>${rows(data.proposals, (item) => `<div class="client-related-row"><strong>${contaEsc(item.title)}</strong><span>${contaEsc(label(item.status))}</span><small>${money(item.amount)} · validade ${contaFieldValue("valid_until", item.valid_until)}</small>${editRelated("proposta", item, `/api/proposals/${item.id}`)}</div>`, "Nenhuma proposta registrada.")}</article><article><h3>Conversas</h3>${rows(data.conversations, (item) => `<div class="client-related-row"><strong>${contaEsc(item.subject)}</strong><span>${contaEsc(item.channel || "interno")} · ${contaEsc(label(item.status))}</span><small>${contaEsc(item.last_message || "Sem mensagens")}</small></div>`, "Nenhuma conversa vinculada.")}</article></div></section><section data-client-panel="sheet-projects" hidden><div class="client-sheet-grid"><article><h3>Projetos</h3>${rows(data.projects, (item) => `<div class="client-related-row"><strong>${contaEsc(item.name)}</strong><span>${contaEsc(label(item.status))} · ${Number(item.progress || 0)}%</span><small>${item.due_on ? `Prazo ${contaFieldValue("due_on", item.due_on)}` : "Sem prazo definido"}${item.production_url ? ` · <a href="${contaEsc(item.production_url)}" target="_blank" rel="noopener noreferrer">Abrir</a>` : ""}</small>${editRelated("projeto", item, `/api/projects/${item.id}`)}</div>`, "Nenhum projeto vinculado.")}</article><article><h3>Tarefas, contratos e suporte</h3>${rows(data.tasks, (item) => `<div class="client-related-row"><strong>${contaEsc(item.title)}</strong><span>${contaEsc(label(item.status))}</span><small>${item.due_at ? `Prazo ${contaFieldValue("due_at", item.due_at)}` : "Sem prazo"}</small>${editRelated("tarefa", item, `/api/tasks/${item.id}`)}</div>`, "Nenhuma tarefa registrada.")}${rows(data.contracts, (item) => `<div class="client-related-row"><strong>${contaEsc(item.name)}</strong><span>${contaEsc(label(item.status))}</span><small>${money(item.value)}${item.ends_on ? ` · até ${contaFieldValue("ends_on", item.ends_on)}` : ""}</small>${editRelated("contrato", item, `/api/contracts/${item.id}`)}</div>`, "Nenhum contrato registrado.")}${rows(data.tickets, (item) => `<div class="client-related-row"><strong>${contaEsc(item.title)}</strong><span>${contaEsc(label(item.status))} · ${contaEsc(label(item.priority))}</span><small>${item.due_at ? `Prazo ${contaFieldValue("due_at", item.due_at)}` : "Sem prazo"}</small>${editRelated("ticket", item, `/api/tickets/${item.id}`)}</div>`, "Nenhum ticket registrado.")}</article></div><div class="client-sheet-grid"><article><h3>Arquivos e briefings</h3>${rows(data.files, (item) => `<div class="client-related-row"><strong>${contaEsc(item.name)}</strong><span>${contaEsc(item.kind || "Arquivo")}</span><small>${item.url ? `<a href="${contaEsc(item.url)}" target="_blank" rel="noopener noreferrer">Abrir arquivo</a>` : "Sem link"}</small></div>`, "Nenhum arquivo vinculado.")}${rows(data.briefings, (item) => `<div class="client-related-row"><strong>${contaEsc(item.name)}</strong><span>${contaEsc(label(item.status))}</span><small>Briefing do projeto</small></div>`, "Nenhum briefing registrado.")}</article><article><h3>Alterações e infraestrutura</h3>${rows(data.change_requests, (item) => `<div class="client-related-row"><strong>${contaEsc(item.title)}</strong><span>${contaEsc(label(item.status))}</span><small>${item.additional_cost ? `Adicional ${money(item.additional_cost)}` : "Sem adicional informado"}</small></div>`, "Nenhuma alteração registrada.")}${rows(data.infrastructure, (item) => `<div class="client-related-row"><strong>${contaEsc(item.name)}</strong><span>${contaEsc(item.provider || item.kind || "Recurso")}</span><small>${item.expires_on ? `Vencimento ${contaFieldValue("expires_on", item.expires_on)}` : "Sem vencimento"}</small></div>`, "Nenhum recurso de infraestrutura.")}</article></div></section><section data-client-panel="sheet-finance" hidden><div class="client-sheet-grid"><article><h3>Contas a receber</h3>${rows(data.receivables, (item) => `<div class="client-related-row"><strong>${contaEsc(item.description)}</strong><span>${contaEsc(label(item.status))}</span><small>${money(item.amount)} · vencimento ${contaFieldValue("due_at", item.due_at)}${item.paid_at ? ` · pago em ${contaFieldValue("paid_at", item.paid_at)}` : ""}</small>${editRelated("recebivel", item, `/api/receivables/${item.id}`)}</div>`, "Nenhum lançamento financeiro.")}</article><article><h3>Resumo financeiro</h3>${ui.facts([["Em aberto", money(openAmount)], ["Projetos concluídos", data.summary.completed_projects], ["Mensalidade", money(data.summary.recurring_monthly)], ["Tickets abertos", data.summary.open_tickets]])}<a class="client-next-action" href="#cobrancas">Abrir cobranças <span>→</span></a></article></div></section><section data-client-panel="sheet-history" hidden><article><h3>Histórico de atividades</h3>${rows(data.activities, (item) => `<div class="client-related-row"><strong>${contaEsc(item.action)}</strong><span>${contaEsc(item.entity_type || "registro")}</span><small>${contaFieldValue("created_at", item.created_at)}</small></div>`, "Nenhuma atividade registrada.")}</article></section>`;
    const opportunityCount = Number(data.summary?.opportunities_total ?? data.opportunities?.length ?? 0);
    const overviewStats = overview.querySelector(".conta-overview-stats");
    overviewStats?.firstElementChild?.insertAdjacentHTML("afterend", `<div><small>Oportunidades</small><strong>${opportunityCount}</strong></div>`);
    const commercialGrid = overview.querySelector('[data-client-panel="sheet-commercial"] .client-sheet-grid');
    commercialGrid?.insertAdjacentHTML("afterbegin", `<article><h3>Oportunidades <small class="conta-muted">${opportunityCount}</small></h3>${rows(data.opportunities, (item) => `<div class="client-related-row"><strong>${contaEsc(item.name)}</strong><span>${contaEsc(label(item.stage))}${item.probability != null ? ` · ${Number(item.probability)}%` : ""}</span><small>${money(item.amount)}${item.expected_close ? ` · previsão ${contaFieldValue("expected_close", item.expected_close)}` : ""}</small></div>`, "Nenhuma oportunidade vinculada.")}</article>`);
    overview.querySelectorAll("[data-client-tab]").forEach((button) => button.addEventListener("click", () => { const selected = button.dataset.clientTab; overview.querySelectorAll("[data-client-tab]").forEach((item) => { const active = item === button; item.classList.toggle("is-active", active); item.setAttribute("aria-selected", String(active)); }); overview.querySelectorAll("[data-client-panel]").forEach((section) => { section.hidden = section.dataset.clientPanel !== selected; }); }));
    const relatedItems = { proposta: data.proposals, projeto: data.projects, tarefa: data.tasks, contrato: data.contracts, ticket: data.tickets, recebivel: data.receivables, contato: data.contacts };
    const relatedModules = { proposta: "crm", projeto: "projetos", tarefa: "tarefas", contrato: "contratos", ticket: "tickets", recebivel: "contas-a-receber", contato: "contatos" };
    overview.querySelectorAll("[data-client-related-edit]").forEach((button) => button.addEventListener("click", async () => {
      const kind = button.dataset.clientRelatedEdit, item = relatedItems[kind]?.find((entry) => String(entry.id) === String(button.dataset.clientRelatedId));
      if (!item) return;
      try {
        await window.FocusModuleLoader?.load(relatedModules[kind]);
        if (kind === "proposta") return window.FocusEditProposal?.(item, record.id, record.name);
        openEditDialog(kind, item, button.dataset.clientRelatedEndpoint);
      } catch (error) { ui.toast(error.message || "Não foi possível abrir a edição.", "error"); }
    }));
  } catch (error) { if (overview.isConnected) overview.insertAdjacentHTML("beforeend", contaState("error", error.message)); }
};
window.FocusOpenClientDetails = (record) => openClientDetails(record);

async function renderPortal() { return renderList("portal", "Portal do cliente", "Gere links seguros para clientes acompanharem contratos e contas em aberto.", "/api/clients", "clients", "client"); }
const portalAccessObserver = new MutationObserver(() => {
  if (location.hash.replace(/^#/, "") !== "portal-do-cliente") return;
  dashboardGrid.querySelectorAll("[data-portal]").forEach((source) => {
    if (source.parentElement.querySelector("[data-portal-access]")) return;
    const button = document.createElement("button"); button.type = "button"; button.className = "compact-action"; button.dataset.portalAccess = source.dataset.portal; button.textContent = "Configurar acesso";
    button.addEventListener("click", () => {
      const previouslyFocused = document.activeElement;
      const panel = document.createElement("aside"); panel.className = "conta-drawer"; panel.setAttribute("role", "dialog"); panel.setAttribute("aria-modal", "true"); panel.setAttribute("aria-label", "Configurar acesso do portal"); panel.innerHTML = `<button class="conta-close" type="button" aria-label="Fechar painel">×</button><p class="card-kicker">Portal do cliente</p><h2>Acesso individual</h2><p class="conta-muted">Defina as credenciais do cliente. A senha é armazenada de forma protegida e nunca aparece novamente.</p><form data-portal-access-form><label>E-mail de acesso<input name="email" type="email" autocomplete="username" required></label><label>Nova senha<input name="password" type="password" minlength="8" autocomplete="new-password" required></label><label>Confirmar senha<input name="confirmation" type="password" minlength="8" autocomplete="new-password" aria-describedby="portal-password-error" required></label><small id="portal-password-error" class="field-error" role="alert"></small><button class="button button-primary" type="submit">Salvar acesso</button><output data-portal-access-result role="status" aria-live="polite"></output></form>`; document.body.append(panel); const closePanel = () => { panel.remove(); document.removeEventListener("keydown", onKey); if (previouslyFocused instanceof HTMLElement && previouslyFocused.isConnected) previouslyFocused.focus(); }; const onKey = (event) => { if (event.key === "Escape") closePanel(); }; document.addEventListener("keydown", onKey); panel.querySelector(".conta-close").onclick = closePanel; panel.querySelector(".conta-close").focus(); panel.querySelector("form").onsubmit = async (event) => { event.preventDefault(); const form = event.currentTarget, values = Object.fromEntries(new FormData(form)); const result = panel.querySelector("[data-portal-access-result]"), passwordError = panel.querySelector("#portal-password-error"), confirmation = form.elements.confirmation, submit = form.querySelector("button[type=submit]"); if (form.dataset.busy === "1") return; passwordError.textContent = ""; confirmation.removeAttribute("aria-invalid"); if (values.password !== values.confirmation) { passwordError.textContent = "As senhas não conferem."; confirmation.setAttribute("aria-invalid", "true"); confirmation.focus(); return; } form.dataset.busy = "1"; submit.disabled = true; submit.setAttribute("aria-busy", "true"); result.setAttribute("role", "status"); result.textContent = "Salvando…"; try { await api(`/api/clients/${button.dataset.portalAccess}/portal-access`, { method: "PUT", body: { email: values.email, password: values.password } }); result.textContent = "Acesso configurado com sucesso."; form.reset(); } catch (error) { result.setAttribute("role", "alert"); result.textContent = error.message || "Não foi possível configurar o acesso. Tente novamente."; } finally { delete form.dataset.busy; submit.disabled = false; submit.removeAttribute("aria-busy"); } };
    }); source.parentElement.append(button);
  });
});
portalAccessObserver.observe(dashboardGrid, { childList: true, subtree: true });
const clientSheetQuickActionsObserver = new MutationObserver(() => {
  document.querySelectorAll(".client-sheet-tools").forEach((tools) => {
    if (tools.querySelector("[data-client-create-actions]")) return;
    const quick = document.createElement("div");
    quick.dataset.clientCreateActions = "1";
    quick.className = "client-sheet-quick-actions";
    quick.innerHTML = `<small class="client-sheet-action-label">Criar neste cliente</small><button class="compact-action" data-client-create="oportunidade" type="button">+ Oportunidade</button><button class="compact-action" data-client-create="projeto" type="button">+ Projeto</button><button class="compact-action" data-client-create="proposta" type="button">+ Proposta</button><button class="compact-action" data-client-create="contrato" type="button">+ Contrato</button><button class="compact-action" data-client-create="recebivel" type="button">+ Cobrança</button><button class="compact-action" data-client-create="assinatura" type="button">+ Recorrência</button><button class="compact-action" data-client-create="tarefa" type="button">+ Tarefa</button><button class="compact-action" data-client-create="ticket" type="button">+ Suporte</button>`;
    const moduleByKind = { oportunidade: "oportunidades", projeto: "projetos", proposta: "propostas", contrato: "contratos", recebivel: "contas-a-receber", assinatura: "assinaturas", tarefa: "tarefas", ticket: "tickets" };
    const openForClient = async (button) => {
      const kind = button.dataset.clientCreate, clientId = tools.dataset.clientId;
      if (!kind || !clientId || button.disabled) return;
      const original = button.textContent; button.disabled = true; button.textContent = "Abrindo…";
      try {
        if (!window.FocusModuleLoader?.load) throw new Error("O carregador de módulos não está disponível.");
        await window.FocusModuleLoader.load(moduleByKind[kind]);
        if (kind === "oportunidade") {
          if (typeof window.FocusOpenOpportunityForClient !== "function") throw new Error("O editor de oportunidades não está disponível.");
          await window.FocusOpenOpportunityForClient(clientId, tools.dataset.clientName, () => {
            const clientRecord = tools._focusClientRecord || { id: clientId, name: tools.dataset.clientName };
            tools.closest(".conta-drawer-wide")?.querySelector(".conta-close")?.click();
            window.FocusOpenClientDetails?.(clientRecord);
          });
          return;
        }
        if (kind === "proposta") {
          if (typeof window.FocusOpenProposalForClient !== "function") throw new Error("O editor de propostas não está disponível.");
          await window.FocusOpenProposalForClient(clientId, tools.dataset.clientName);
          return;
        }
        const config = createConfig[kind];
        if (!config) throw new Error("Este cadastro ainda não está disponível.");
        const clientField = config.fields?.find((field) => field.name === "client_id");
        if (clientField) clientField.options = [["", "Sem cliente"], [clientId, tools.dataset.clientName || "Cliente atual"]];
        openCreateDialog(kind);
        const select = dialogFields.querySelector("[name=client_id]");
        if (select) select.value = String(clientId);
      } catch (error) { ui.toast(error.message || "Não foi possível abrir o cadastro.", "error"); }
      finally { button.disabled = false; button.textContent = original; }
    };
    quick.querySelectorAll("[data-client-create]").forEach((button) => button.addEventListener("click", () => openForClient(button)));
    tools.append(quick);
  });
});
clientSheetQuickActionsObserver.observe(document.body, { childList: true, subtree: true });
const contaDrawerAccessibilityObserver = new MutationObserver(() => {
  document.querySelectorAll(".conta-drawer").forEach((panel) => {
    panel.querySelector(".conta-close")?.setAttribute("aria-label", "Fechar painel");
    panel.querySelector("[data-related], [data-overview]")?.setAttribute("aria-live", "polite");
    panel.querySelectorAll("output").forEach((output) => { output.setAttribute("role", "status"); output.setAttribute("aria-live", "polite"); output.setAttribute("aria-atomic", "true"); });
  });
});
contaDrawerAccessibilityObserver.observe(document.body, { childList: true, subtree: true });
document.addEventListener("keydown", (event) => {
  const panels = [...document.querySelectorAll(".conta-drawer")];
  const panel = panels[panels.length - 1];
  if (!panel) return;
  const close = panel.querySelector(".conta-close");
  if (event.key === "Escape") { event.preventDefault(); event.stopImmediatePropagation(); close?.click(); return; }
  if (event.key !== "Tab") return;
  const focusable = [...panel.querySelectorAll("button, input, select, textarea, a[href], [tabindex]:not([tabindex=\"-1\"])")].filter((element) => !element.disabled && element.getAttribute("aria-hidden") !== "true");
  if (!focusable.length) return;
  const first = focusable[0], last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); event.stopImmediatePropagation(); last.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); event.stopImmediatePropagation(); first.focus(); }
}, true);
window.addEventListener("hashchange", () => { document.querySelectorAll(".conta-drawer .conta-close").forEach((button) => button.click()); });

// Cadastro rÃ¡pido: detalhes comerciais continuam disponÃ­veis na ficha do cliente.
createConfig.contato = { title: "Novo contato", endpoint: "/api/contacts", fields: [field("name", "Nome", "text", { required: true }), field("document", "CPF/CNPJ"), field("email", "E-mail", "email"), field("phone", "Telefone"), field("city", "Cidade"), field("state", "UF")] };
createConfig.empresa = { title: "Nova empresa", endpoint: "/api/companies", fields: [field("name", "Nome", "text", { required: true }), field("document", "CNPJ")] };
createConfig.cliente = { title: "Novo cliente", endpoint: "/api/clients/quick", fields: [field("name", "Nome", "text", { required: true }), field("document", "CPF/CNPJ"), field("email", "E-mail", "email"), field("phone", "Telefone"), field("whatsapp", "WhatsApp"), field("company_name", "Empresa (opcional)"), field("company_document", "CNPJ da empresa"), field("street", "EndereÃ§o"), field("street_number", "NÃºmero"), field("city", "Cidade"), field("state", "UF"), field("zip_code", "CEP")] };
/* Fluxo inicial simples: cliente é independente; empresa e contato são opcionais. Os demais dados entram na ficha. */
createConfig.cliente = { title: "Novo cliente", endpoint: "/api/clients/quick", fields: [field("name", "Nome", "text", { required: true }), field("document", "CPF/CNPJ"), field("email", "E-mail", "email"), field("phone", "Telefone/WhatsApp", "tel"), field("company_name", "Empresa (opcional)"), field("company_document", "CNPJ da empresa (opcional)"), field("status", "Situação", "select", { options: [["active", "Ativo"], ["inactive", "Inativo"], ["blocked", "Bloqueado"]] })] };
createConfig.cliente.onCreated = (data, payload) => {
  if (location.hash !== "#clientes" || !data?.client?.id) return;
  // O endpoint rápido já devolve o ID canônico, inclusive quando encontra um
  // cadastro existente. Isso torna a abertura da ficha imediata e inequívoca.
  window.FocusOpenClientDetails?.({ ...payload, ...data.client });
};
// Criação e edição de cliente compartilham a ficha completa. O POST continua
// usando /api/clients/quick para preservar a API existente; campos extras são
// ignorados pelo cadastro rápido e ficam disponíveis na edição canônica.
createConfig.cliente = { title: "Novo cliente", endpoint: "/api/clients/quick", fields: [
  field("name", "Nome", "text", { required: true }),
  field("company_id", "Empresa", "select", { options: [] }),
  field("contact_id", "Contato", "select", { options: [] }),
  field("company_name", "Empresa (opcional)"), field("company_document", "CNPJ da empresa (opcional)"),
  field("email", "E-mail", "email"), field("phone", "Telefone"),
  field("status", "Status", "select", { options: [["active", "Ativo"], ["inactive", "Inativo"], ["churned", "Cancelado"], ["blocked", "Bloqueado"]] }),
  field("legal_name", "Razão social"), field("trade_name", "Nome fantasia"),
  field("person_type", "Pessoa física ou jurídica", "select", { options: [["person", "Pessoa física"], ["company", "Pessoa jurídica"]] }),
  field("document", "CPF/CNPJ"), field("responsible_name", "Responsável"), field("responsible_role", "Cargo"),
  field("whatsapp", "WhatsApp", "tel"), field("secondary_phone", "Telefone secundário"), field("website", "Site", "url"),
  field("instagram", "Instagram"), field("linkedin", "LinkedIn", "url"), field("preferred_channel", "Canal preferido"),
  field("zip_code", "CEP", "text", { cepLookup: true }), field("street", "Rua"), field("street_number", "Número"), field("complement", "Complemento"), field("neighborhood", "Bairro"), field("city", "Cidade"), field("state", "Estado"), field("country", "País"),
  field("segment", "Segmento"), field("services_interest", "Serviços de interesse"), field("main_need", "Necessidade principal"), field("sales_owner", "Responsável comercial"),
  field("lead_temperature", "Temperatura", "select", { options: [["cold", "Frio"], ["warm", "Morno"], ["hot", "Quente"]] }), field("last_contact_at", "Último contato", "datetime-local"), field("next_contact_at", "Próximo contato", "datetime-local"), field("next_action", "Próxima ação"), field("estimated_budget", "Orçamento estimado", "number"), field("monthly_fee", "Mensalidade", "number"), field("financial_status", "Situação financeira"), field("internal_notes", "Observações internas")
] };
createConfig.cliente.onCreated = (data, payload) => {
  if (location.hash === "#clientes" && data?.client?.id) window.FocusOpenClientDetails?.({ ...payload, ...data.client });
};
window.prepareCreate = async function prepareClientCreate(kind, shouldOpen = true) {
  await prepareCreate(kind, shouldOpen && location.hash !== "#portal-do-cliente");
};

dashboardGrid.addEventListener("click", async (event) => {
  const button = event.target.closest?.("[data-remove]");
  if (!button || button.dataset.busy === "1") return;
  event.preventDefault();
  event.stopImmediatePropagation();
  if (button.dataset.confirm !== "1") { button.dataset.confirm = "1"; button.textContent = "Confirmar exclusão"; return; }
  const type = button.dataset.removeType;
  const endpoint = type === "contact" ? "contacts" : type === "company" ? "companies" : "clients";
  const routeAtStart = location.hash;
  const requestAtStart = contaListRequest;
  const originalLabel = "Excluir";
  button.dataset.busy = "1";
  button.disabled = true;
  button.setAttribute("aria-busy", "true");
  button.textContent = "Excluindo…";
  try { await api(`/api/${endpoint}/${button.dataset.remove}`, { method: "DELETE" }); if (location.hash !== routeAtStart || requestAtStart !== contaListRequest || !button.isConnected) return; ui.toast("Registro excluído.", "success"); renderHashRoute(); }
  catch (error) { if (location.hash !== routeAtStart || !button.isConnected) return; button.disabled = false; button.removeAttribute("aria-busy"); button.dataset.busy = ""; button.dataset.confirm = ""; button.textContent = originalLabel; ui.toast(error.message, "error"); }
}, true);
const portalAccessFormObserver = new MutationObserver(() => {
  document.querySelectorAll("[data-portal-access-form]").forEach((form) => {
    if (form.dataset.accessibleBound === "1") return;
    const originalSubmit = form.onsubmit;
    if (typeof originalSubmit !== "function") return;
    form.dataset.accessibleBound = "1";
    const result = form.querySelector("[data-portal-access-result]");
    result?.setAttribute("aria-live", "polite");
    form.onsubmit = async (event) => {
      const values = Object.fromEntries(new FormData(form));
      if (values.password !== values.confirmation) {
        event.preventDefault();
        if (result) { result.setAttribute("role", "alert"); result.textContent = "As senhas não conferem. Revise a confirmação."; }
        form.querySelector("[name=confirmation]")?.focus();
        return;
      }
      const submit = form.querySelector("button[type=submit]");
      submit?.setAttribute("aria-busy", "true");
      if (submit) { submit.disabled = true; submit.textContent = "Salvando…"; }
      try {
        return await originalSubmit.call(form, event);
      } finally {
        if (submit) { submit.disabled = false; submit.removeAttribute("aria-busy"); submit.textContent = "Salvar acesso"; }
      }
    };
  });
});
portalAccessFormObserver.observe(document.body, { childList: true, subtree: true });
registerRoutes({ contatos: () => renderList("contato", "Contatos", "Pessoas e vínculos da sua operação.", "/api/contacts", "contacts", "contact"), empresas: () => renderList("empresa", "Empresas", "Organizações conectadas ao workspace.", "/api/companies", "companies", "company"), clientes: () => renderList("cliente", "Clientes", "Saúde e relacionamento da sua carteira.", "/api/clients", "clients", "client"), "consulta-cnpj": renderCnpj, "portal-do-cliente": renderPortal });
const contaOpenRelatedDetails = openDetails;
const relatedList = (items = [], label, render) => `<section><h3>${contaEsc(label)}</h3>${items.length ? items.slice(0, 12).map(render).join("") : `<p class="conta-muted">Nenhum registro relacionado.</p>`}</section>`;
openDetails = async function openRelatedDetails(record, type) {
  if (!record || !["contact", "company"].includes(type)) return contaOpenRelatedDetails(record, type);
  const drawer = ui.drawer({ title: record.name || "Registro", subtitle: type === "company" ? "Empresa" : "Contato", html: `<section><h3>Dados principais</h3>${contaFacts(record, 14)}</section><div data-related-overview>${stateBlock.loading("Carregando relacionamentos…")}</div>` });
  const panel = drawer.body;
  try {
    const data = await api(`/api/${type === "contact" ? "contacts" : "companies"}/${record.id}/overview`);
    if (!panel.isConnected) return;
    const relLabels = { ...contaStatus, new: "Novo", qualified: "Qualificado", contacted: "Contatado", won: "Ganho", lost: "Perdido", open: "Aberto", archived: "Arquivado", qualification: "Qualificação", proposal: "Proposta", negotiation: "Negociação", sent: "Enviada", accepted: "Aceita", rejected: "Recusada", whatsapp: "WhatsApp", email: "E-mail", internal: "Interno", post: "criou", patch: "editou", delete: "excluiu", contacts: "contato", leads: "lead", companies: "empresa" }; const renderItem = (item, fields) => `<div class="conta-related-item"><strong>${contaEsc(item[fields[0]] || "Sem nome")}</strong>${ui.badge(relLabels[item[fields[1]]] || item[fields[1]] || relLabels[item.status] || item.status || "—", "gray")}${item.created_at ? `<small>${ui.relative(item.created_at)}</small>` : ""}</div>`;
    const body = type === "contact"
      ? `${relatedList(data.clients, "Clientes", (item) => renderItem(item, ["name", "status"]))}${relatedList(data.leads, "Leads", (item) => renderItem(item, ["name", "status"]))}${relatedList(data.opportunities, "Oportunidades", (item) => renderItem(item, ["name", "stage"]))}${relatedList(data.conversations, "Conversas", (item) => renderItem(item, ["subject", "channel"]))}${relatedList(data.activities, "Histórico", (item) => renderItem(item, ["action", "entity_type"]))}`
      : `${relatedList(data.contacts, "Contatos", (item) => renderItem(item, ["name", "role"]))}${relatedList(data.opportunities, "Oportunidades", (item) => renderItem(item, ["name", "stage"]))}${relatedList(data.proposals, "Propostas", (item) => renderItem(item, ["title", "status"]))}${relatedList(data.contracts, "Contratos", (item) => renderItem(item, ["name", "status"]))}${relatedList(data.projects, "Projetos", (item) => renderItem(item, ["name", "status"]))}${relatedList(data.activities, "Histórico", (item) => renderItem(item, ["action", "entity_type"]))}`;
    panel.querySelector("[data-related-overview]").innerHTML = body;
  } catch (error) { if (!panel.isConnected) return; panel.querySelector("[data-related-overview]").innerHTML = `<section><h3>Relacionamentos</h3><p class="conta-muted">Não foi possível carregar os vínculos agora.</p><small>${contaEsc(error.message || "Tente novamente mais tarde.")}</small></section>`; }
};

const contaDrawerA11yObserver = new MutationObserver(() => {
  document.querySelectorAll("aside.conta-drawer").forEach((panel) => {
    if (panel.dataset.a11yReady === "1") return;
    panel.dataset.a11yReady = "1";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "true");
    if (!panel.getAttribute("aria-label")) panel.setAttribute("aria-label", panel.querySelector("h2")?.textContent?.trim() || "Painel de cliente");
    panel.querySelector(".conta-close")?.setAttribute("aria-label", "Fechar painel");
    panel.querySelector(".conta-close")?.focus({ preventScroll: true });
  });
});
contaDrawerA11yObserver.observe(document.body, { childList: true, subtree: true });
const contaDrawerStateObserver = new MutationObserver(() => {
  document.querySelectorAll("aside.conta-drawer").forEach((panel) => {
    if (panel.querySelector(".state-loading")) panel.setAttribute("aria-busy", "true");
    else panel.removeAttribute("aria-busy");
  });
});
contaDrawerStateObserver.observe(document.body, { childList: true, subtree: true });
document.addEventListener("keydown", (event) => {
  const panel = [...document.querySelectorAll("aside.conta-drawer")].at(-1);
  if (!panel || event.key !== "Tab") return;
  const focusable = [...panel.querySelectorAll("button, input, select, textarea, a[href], [tabindex]:not([tabindex=\"-1\"])")].filter((element) => !element.disabled && element.getAttribute("aria-hidden") !== "true");
  if (!focusable.length) return;
  const first = focusable[0], last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
}, true);

new MutationObserver(() => {
  document.querySelectorAll("aside.conta-drawer button, aside.conta-drawer input, aside.conta-drawer select").forEach((control) => { if (control.disabled) control.setAttribute("aria-busy", "true"); else control.removeAttribute("aria-busy"); });
  document.querySelectorAll("aside.conta-drawer [role=status], aside.conta-drawer .state-loading p").forEach((status) => { if (status.textContent?.includes("...")) status.textContent = status.textContent.replaceAll("...", "…"); });
  document.querySelectorAll("aside.conta-drawer .state-error").forEach((error) => error.setAttribute("role", "alert"));
}).observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["disabled"] });

new MutationObserver(() => {
  if (dashboardGrid.querySelector(".state-loading")) dashboardGrid.setAttribute("aria-busy", "true");
  else dashboardGrid.removeAttribute("aria-busy");
  dashboardGrid.querySelectorAll("[data-conta-status]").forEach((control) => { control.name = "status"; control.setAttribute("autocomplete", "off"); });
  dashboardGrid.querySelectorAll("[data-conta-csv], [data-portal], [data-save-cnpj]").forEach((button) => {
    if (button.disabled) button.setAttribute("aria-busy", "true");
    else button.removeAttribute("aria-busy");
    if (button.textContent?.includes("...")) button.textContent = button.textContent.replaceAll("...", "…");
  });
  dashboardGrid.querySelectorAll("[data-conta-search]").forEach((input) => { input.name = "search"; input.setAttribute("autocomplete", "off"); if (input.placeholder?.includes("...")) input.placeholder = input.placeholder.replaceAll("...", "…"); });
  dashboardGrid.querySelectorAll('input[type="email"]').forEach((input) => input.spellcheck = false);
  dashboardGrid.querySelectorAll("[data-cnpj-result], [data-portal-access-result]").forEach((status) => { status.setAttribute("role", "status"); status.setAttribute("aria-live", "polite"); if (status.textContent?.includes("...")) status.textContent = status.textContent.replaceAll("...", "…"); });
  const list = dashboardGrid.querySelector(".contas-list"), rows = list?.querySelector(".conta-rows");
  if (list && rows) {
    let status = list.querySelector("[data-conta-results]");
    if (!status) { status = document.createElement("p"); status.className = "ui-filter-status"; status.dataset.contaResults = "true"; status.setAttribute("role", "status"); status.setAttribute("aria-live", "polite"); list.querySelector(".section-heading")?.after(status); }
    const count = rows.querySelectorAll("[data-detail]").length;
    const label = count === 1 ? "1 registro encontrado" : `${count} registros encontrados`;
    if (status.textContent !== label) status.textContent = label;
  }
  dashboardGrid.querySelectorAll(".state-loading p, .config-state .state-loading p").forEach((label) => { if (label.textContent?.includes("...")) label.textContent = label.textContent.replaceAll("...", "…"); });
}).observe(dashboardGrid, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["disabled"] });

new MutationObserver(() => {
  const form = dashboardGrid.querySelector("[data-cnpj-form]");
  const result = dashboardGrid.querySelector("[data-cnpj-result]");
  const submit = form?.querySelector("button[type=submit]");
  if (!form || !result || !submit) return;
  const loading = Boolean(result.querySelector(".state-loading"));
  if (loading) {
    submit.disabled = true;
    submit.setAttribute("aria-busy", "true");
  } else if (submit.disabled && !form.dataset.submitLocked) {
    submit.disabled = false;
    submit.removeAttribute("aria-busy");
  }
  result.querySelectorAll(".state-error").forEach((error) => error.setAttribute("role", "alert"));
}).observe(dashboardGrid, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["disabled"] });
