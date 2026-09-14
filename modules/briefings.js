/* Workspace de briefings: cadastro, leitura de respostas e link público real. */
const briefingEsc = (value) => escapeHtml(value ?? "");
const briefingStatus = { draft: "Rascunho", published: "Publicado", sent: "Enviado", answered: "Respondido", approved: "Aprovado", archived: "Arquivado" };
const briefingFilter = { search: "", status: "" };
const briefingConfig = {
  title: "Novo briefing",
  endpoint: "/api/briefings",
  fields: [
    { name: "name", label: "Nome do briefing" },
    { name: "client_id", label: "Cliente (ID)", required: false },
    { name: "project_id", label: "Projeto (ID)", required: false },
    { name: "status", label: "Status", type: "select", options: Object.entries(briefingStatus).map(([value, label]) => [value, label]), required: false },
    { name: "questions", label: "Perguntas (JSON)", type: "textarea", rows: 8, placeholder: '[{"label":"Qual é o objetivo do projeto?"}]', required: false }
  ]
};
Object.assign(createConfig, { briefing: briefingConfig });

const briefingQuestions = (value) => {
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    return Array.isArray(parsed) ? parsed : Array.isArray(parsed?.questions) ? parsed.questions : [];
  } catch { return []; }
};
const briefingResponses = (value) => {
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch { return {}; }
};

async function prepareBriefingCreate() {
  const [clientsData, projectsData] = await Promise.all([api("/api/clients"), api("/api/projects")]);
  briefingConfig.fields.find((field) => field.name === "client_id").type = "select";
  briefingConfig.fields.find((field) => field.name === "client_id").options = [["", "Sem cliente"], ...(clientsData.clients || []).map((item) => [item.id, item.name])];
  briefingConfig.fields.find((field) => field.name === "project_id").type = "select";
  briefingConfig.fields.find((field) => field.name === "project_id").options = [["", "Sem projeto"], ...(projectsData.projects || []).map((item) => [item.id, item.name])];
  openCreateDialog("briefing");
}

async function renderBriefingsScreen() {
  const title = "Briefings", description = "Colete informações, arquivos e decisões do cliente antes de fechar o escopo.";
  dashboardGrid.innerHTML = `<section class="page-intro"><div><p class="card-kicker">Operação</p><h2>${title}</h2><p>${description}</p></div><button class="button button-primary compact-action" data-briefing-new type="button">+ Novo briefing</button></section>${stateBlock.loading("Carregando briefings...")}`;
  try {
    const params = new URLSearchParams(); if (briefingFilter.search) params.set("search", briefingFilter.search); if (briefingFilter.status) params.set("status", briefingFilter.status); const items = (await api(`/api/briefings?${params}`)).briefings || [];
    dashboardGrid.innerHTML = `<section class="page-intro"><div><p class="card-kicker">Operação</p><h2>${title}</h2><p>${description}</p></div><button class="button button-primary compact-action" data-briefing-new type="button">+ Novo briefing</button></section><section class="data-card automation-list"><div class="finance-toolbar"><input type="search" data-briefing-search placeholder="Buscar briefing" aria-label="Buscar briefing"><select data-briefing-filter aria-label="Filtrar status"><option value="">Todos os status</option>${Object.entries(briefingStatus).map(([key, label]) => `<option value="${key}">${label}</option>`).join("")}</select></div><div class="template-grid">${items.length ? items.map((item) => { const questions = briefingQuestions(item.questions), responses = briefingResponses(item.responses), responseCount = Object.keys(responses).length; return `<article class="data-card template-card" data-briefing-row data-status="${briefingEsc(item.status || "draft")}"><div class="section-heading"><div><h3>${briefingEsc(item.name)}</h3><small>${questions.length} pergunta(s) · ${responseCount} resposta(s) · ${item.client_id ? `Cliente #${briefingEsc(item.client_id)}` : "Sem cliente"}</small></div><span class="finance-status ${item.status === "answered" || item.status === "approved" ? "positive" : "neutral"}">${briefingStatus[item.status] || briefingEsc(item.status || "Rascunho")}</span></div><div class="template-actions"><button class="compact-action" data-briefing-preview="${item.id}" type="button">Ver briefing</button>${responseCount ? `<button class="compact-action" data-briefing-responses="${item.id}" type="button">Ver respostas</button>` : ""}<button class="compact-action" data-briefing-link="${item.id}" type="button">${item.public_token ? "Copiar link" : "Gerar link"}</button><button class="compact-action" data-briefing-edit="${item.id}" type="button">Editar</button><button class="compact-action" data-briefing-delete="${item.id}" type="button">Excluir</button></div></article>`; }).join("") : stateBlock.empty("Nenhum briefing", "Crie um questionário para iniciar o levantamento do projeto.", "Criar briefing", "briefing-empty")}</div></section>`;
    const openNew = () => prepareBriefingCreate();
    dashboardGrid.querySelector("[data-briefing-new]")?.addEventListener("click", openNew);
    dashboardGrid.querySelector("[data-briefing-empty]")?.addEventListener("click", openNew);
    const filter = () => { const query = dashboardGrid.querySelector("[data-briefing-search]").value.toLocaleLowerCase("pt-BR"), status = dashboardGrid.querySelector("[data-briefing-filter]").value; dashboardGrid.querySelectorAll("[data-briefing-row]").forEach((row) => { row.hidden = (query && !row.textContent.toLocaleLowerCase("pt-BR").includes(query)) || (status && row.dataset.status !== status); }); };
    dashboardGrid.querySelector("[data-briefing-search]")?.addEventListener("input", filter);
    dashboardGrid.querySelector("[data-briefing-filter]")?.addEventListener("change", filter);
    const briefingSearch = dashboardGrid.querySelector("[data-briefing-search]"), briefingStatusFilter = dashboardGrid.querySelector("[data-briefing-filter]"); if (briefingSearch) briefingSearch.value = briefingFilter.search; if (briefingStatusFilter) briefingStatusFilter.value = briefingFilter.status; let briefingTimer; briefingSearch?.addEventListener("input", () => { clearTimeout(briefingTimer); briefingFilter.search = briefingSearch.value.trim(); briefingTimer = setTimeout(renderBriefingsScreen, 250); }); briefingStatusFilter?.addEventListener("change", () => { briefingFilter.status = briefingStatusFilter.value; renderBriefingsScreen(); });
    dashboardGrid.querySelectorAll("[data-briefing-preview]").forEach((button) => button.addEventListener("click", () => { const item = items.find((entry) => String(entry.id) === String(button.dataset.briefingPreview)); if (!item) return; const questions = briefingQuestions(item.questions); ui.drawer({ title: item.name, subtitle: "Perguntas do briefing", html: questions.length ? `<ol>${questions.map((question) => `<li>${briefingEsc(typeof question === "string" ? question : question?.label || question?.question || "Pergunta")}</li>`).join("")}</ol>` : "<p>Nenhuma pergunta cadastrada.</p>" }); }));
    dashboardGrid.querySelectorAll("[data-briefing-responses]").forEach((button) => button.addEventListener("click", () => { const item = items.find((entry) => String(entry.id) === String(button.dataset.briefingResponses)); if (!item) return; const responses = briefingResponses(item.responses); ui.drawer({ title: `Respostas · ${item.name}`, subtitle: "Dados enviados pelo cliente", html: Object.keys(responses).length ? Object.entries(responses).map(([key, value]) => `<p><strong>${briefingEsc(key)}</strong><br>${briefingEsc(typeof value === "object" ? JSON.stringify(value) : value)}</p>`).join("") : "<p>Nenhuma resposta registrada.</p>" }); }));
    dashboardGrid.querySelectorAll("[data-briefing-link]").forEach((button) => button.addEventListener("click", async () => { const item = items.find((entry) => String(entry.id) === String(button.dataset.briefingLink)); if (!item) return; button.disabled = true; try { const data = item.public_token ? { path: `/briefing/${item.public_token}` } : await api(`/briefings/${item.id}/public-link`, { method: "POST", body: {} }); const link = `${location.origin}${data.path}`; await navigator.clipboard?.writeText(link); button.textContent = "Link copiado"; toast("Link do briefing copiado.", "success"); } catch (error) { toast(error.message, "error"); button.disabled = false; } }));
    dashboardGrid.querySelectorAll("[data-briefing-edit]").forEach((button) => button.addEventListener("click", () => { const item = items.find((entry) => String(entry.id) === String(button.dataset.briefingEdit)); if (item) openEditDialog("briefing", { ...item, questions: JSON.stringify(briefingQuestions(item.questions), null, 2) }, `/api/briefings/${item.id}`); }));
    dashboardGrid.querySelectorAll("[data-briefing-delete]").forEach((button) => button.addEventListener("click", () => ui.confirmInline(button, { text: "Excluir briefing?", onConfirm: async () => { await api(`/api/briefings/${button.dataset.briefingDelete}`, { method: "DELETE" }); toast("Briefing excluído.", "success"); renderBriefingsScreen(); } })));
  } catch (error) { dashboardGrid.innerHTML = `<section class="page-intro"><div><p class="card-kicker">Operação</p><h2>${title}</h2></div></section>${stateBlock.error(error.message, "briefing-retry")}`; dashboardGrid.querySelector(".state-retry")?.addEventListener("click", renderBriefingsScreen); }
}

registerRoutes({ briefings: renderBriefingsScreen });
