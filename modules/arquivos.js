const fileEsc = (value) => escapeHtml(value ?? "");
const fileDateFormatter = new Intl.DateTimeFormat("pt-BR");
const fileDate = (value) => { if (!value) return "—"; const parsed = new Date(value); return Number.isNaN(parsed.getTime()) ? "—" : fileDateFormatter.format(parsed); };
const fileHref = (value) => {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  try {
    const parsed = new URL(raw, window.location.origin);
    if (["http:", "https:"].includes(parsed.protocol)) return parsed.href;
    if (parsed.protocol === "data:" && /^(image\/(?:png|jpeg|gif|webp)|application\/pdf|text\/plain);/i.test(raw.slice(5))) return raw;
  } catch { /* URL inválida não vira link */ }
  return "";
};
const fileLink = (item) => { const name = item?.name || "Arquivo sem nome"; const href = fileHref(item?.url); return href ? `<a data-file-link href="${fileEsc(href)}" target="_blank" rel="noopener noreferrer">${fileEsc(name)}</a>` : `<span>${fileEsc(name)}</span>`; };
dashboardGrid.addEventListener("click", (event) => {
  const link = event.target.closest?.("[data-file-link]");
  if (!link || !dashboardGrid.contains(link)) return;
  const href = fileHref(link.getAttribute("href"));
  if (!href) { event.preventDefault(); event.stopPropagation(); toast("Este endereço de arquivo não é seguro.", "error"); return; }
  link.href = href;
});
const toast = (...args) => { if (location.hash === "#arquivos") ui.toast(...args); };
const fileKind = { document: "Documento", image: "Imagem", video: "Vídeo", code: "Código", backup: "Backup", other: "Outro" };
const fileFilter = { search: "", project_id: "", kind: "", request: 0 };
function fileDetails(item) { if (!item) return; const hidden = new Set(["id", "organization_id"]); const value = (entry) => entry === null || entry === undefined || entry === "" ? "—" : typeof entry === "object" ? JSON.stringify(entry) : String(entry); const html = Object.entries(item).filter(([key]) => !hidden.has(key) && key !== "url").map(([key, entry]) => `<dt>${fileEsc(key.replaceAll("_", " "))}</dt><dd>${fileEsc(value(entry))}</dd>`).join(""); const href = fileHref(item.url); ui.drawer({ title: item.name || "Arquivo", subtitle: fileKind[item.kind] || item.kind || "Arquivo", html: `${html ? `<dl>${html}</dl>` : "<p>Sem detalhes disponíveis.</p>"}${href ? `<p><a data-file-link class="compact-action" href="${fileEsc(href)}" target="_blank" rel="noopener noreferrer">Abrir arquivo</a></p>` : ""}` }); }

async function renderFilesScreen() {
  if (location.hash !== "#arquivos") return;
  const request = fileFilter.request = (fileFilter.request || 0) + 1;
  const restoreSearchFocus = ui.keepSearchFocus(dashboardGrid, "[data-file-search]");
  const title = "Arquivos", description = "Documentos e links organizados por cliente e projeto.";
  dashboardGrid.setAttribute("aria-busy", "true");
  dashboardGrid.innerHTML = `<section class="page-intro"><div><p class="card-kicker">Operação</p><h2>${title}</h2><p>${description}</p></div><button class="button button-primary compact-action" data-file-new type="button">+ Adicionar arquivo</button></section>${stateBlock.loading("Carregando arquivos…")}`;
  try {
    const params = new URLSearchParams(); if (fileFilter.search) params.set("search", fileFilter.search); if (fileFilter.project_id) params.set("project_id", fileFilter.project_id); if (fileFilter.kind) params.set("kind", fileFilter.kind);
    const [fileResult, projectResult, clientResult] = await Promise.allSettled([api(`/api/files?${params}`), api("/api/projects"), api("/api/clients")]);
    if (request !== fileFilter.request) return;
    if (fileResult.status === "rejected") throw fileResult.reason;
    const items = fileResult.value.files || [], projects = projectResult.status === "fulfilled" ? projectResult.value.projects || [] : [], clients = clientResult.status === "fulfilled" ? clientResult.value.clients || [] : [];
    const byKind = (kind) => items.filter((item) => (item.kind || "other") === kind).length;
    dashboardGrid.removeAttribute("aria-busy");
    dashboardGrid.innerHTML = `<section class="page-intro"><div><p class="card-kicker">Operação</p><h2>${title}</h2><p>${description}</p></div><button class="button button-primary compact-action" data-file-new type="button">+ Adicionar arquivo</button></section><section class="data-card operations-table"><div class="operations-toolbar"><input type="search" data-file-search value="${fileEsc(fileFilter.search)}" placeholder="Buscar nome, cliente ou projeto…" aria-label="Buscar arquivo"><select data-file-project aria-label="Filtrar projeto"><option value="">Todos os projetos</option>${projects.map((project) => `<option value="${fileEsc(project.id)}">${fileEsc(project.name)}</option>`).join("")}</select><select data-file-kind aria-label="Filtrar tipo"><option value="">Todos os tipos</option>${Object.entries(fileKind).map(([key, label]) => `<option value="${key}">${label}</option>`).join("")}</select></div>${items.length ? `<div class="table-wrap"><table><thead><tr><th scope="col">Nome</th><th scope="col">Tipo</th><th scope="col">Projeto</th><th scope="col">Cliente</th><th scope="col">Enviado em</th><th scope="col">Ações</th></tr></thead><tbody>${items.map((item) => `<tr><td>${fileLink(item)}</td><td>${fileEsc(fileKind[item.kind] || item.kind || "Outro")}</td><td>${fileEsc(item.project_name || item.project_id || "—")}</td><td>${fileEsc(item.client_name || item.client_id || "—")}</td><td>${fileDate(item.created_at)}</td><td><button class="compact-action" data-file-delete="${fileEsc(item.id)}" type="button">Excluir</button></td></tr>`).join("")}</tbody></table></div>` : stateBlock.empty("Nenhum arquivo", "Adicione um link para começar.", "Adicionar arquivo", "file-empty")}</section>`;
    dashboardGrid.querySelector(".page-intro")?.insertAdjacentHTML("afterend", ui.stats([{ label: "Arquivos", value: ui.number(items.length) }, { label: "Documentos", value: ui.number(byKind("document")), tone: "blue" }, { label: "Imagens", value: ui.number(byKind("image")), tone: "green" }, { label: "Outros tipos", value: ui.number(items.length - byKind("document") - byKind("image")) }]));
    const search = dashboardGrid.querySelector("[data-file-search]"), project = dashboardGrid.querySelector("[data-file-project]"), kind = dashboardGrid.querySelector("[data-file-kind]"); project.value = fileFilter.project_id; kind.value = fileFilter.kind; let timer;
    restoreSearchFocus();
    if (search) { search.name = "search"; search.autocomplete = "off"; search.placeholder = "Buscar nome, cliente ou projeto…"; }
    if (project) { project.name = "project_id"; project.autocomplete = "off"; }
    if (kind) { kind.name = "kind"; kind.autocomplete = "off"; }
    search?.addEventListener("input", () => { clearTimeout(timer); fileFilter.search = search.value.trim(); timer = setTimeout(renderFilesScreen, 250); }); project?.addEventListener("change", () => { fileFilter.project_id = project.value; renderFilesScreen(); }); kind?.addEventListener("change", () => { fileFilter.kind = kind.value; renderFilesScreen(); });
    const prepare = () => { const projectField = createConfig.arquivo.fields.find((field) => field.name === "project_id"), clientField = createConfig.arquivo.fields.find((field) => field.name === "client_id"); if (projectField) { projectField.type = "select"; projectField.options = [["", "Sem projeto"], ...projects.map((item) => [item.id, item.name])]; } if (clientField) { clientField.type = "select"; clientField.options = [["", "Sem cliente"], ...clients.map((item) => [item.id, item.name])]; } openCreateDialog("arquivo"); };
    dashboardGrid.querySelector("[data-file-new]")?.addEventListener("click", prepare); dashboardGrid.querySelector(".file-empty")?.addEventListener("click", prepare);
    dashboardGrid.querySelectorAll("tbody tr").forEach((row, index) => { const item = items[index], details = document.createElement("button"); details.type = "button"; details.className = "compact-action"; details.textContent = "Detalhes"; details.addEventListener("click", () => fileDetails(item)); const edit = document.createElement("button"); edit.type = "button"; edit.className = "compact-action"; edit.textContent = "Editar"; edit.addEventListener("click", () => openEditDialog("arquivo", item, `/api/files/${item.id}`)); row.querySelector("td:last-child")?.prepend(edit, details); });
    dashboardGrid.querySelectorAll("[data-file-delete]").forEach((button) => button.addEventListener("click", () => ui.confirmInline(button, { text: "Excluir arquivo?", onConfirm: async () => { if (button.dataset.busy === "1") return; const routeAtStart = location.hash, originalLabel = button.textContent; button.dataset.busy = "1"; button.disabled = true; button.setAttribute("aria-busy", "true"); button.textContent = "Excluindo…"; try { await api(`/api/files/${button.dataset.fileDelete}`, { method: "DELETE" }); if (location.hash !== routeAtStart || routeAtStart !== "#arquivos" || !button.isConnected) return; toast("Arquivo excluído.", "success"); renderFilesScreen(); } catch (error) { if (location.hash !== routeAtStart || !button.isConnected) return; button.disabled = false; button.removeAttribute("aria-busy"); button.textContent = originalLabel; toast(error.message, "error"); } finally { if (button.isConnected) { button.dataset.busy = ""; button.disabled = false; button.removeAttribute("aria-busy"); } } } })));
  } catch (error) { if (request !== fileFilter.request) return; dashboardGrid.removeAttribute("aria-busy"); dashboardGrid.innerHTML = `<section class="page-intro"><div><p class="card-kicker">Operação</p><h2>${title}</h2></div></section>${stateBlock.error(error.message, "file-retry")}`; dashboardGrid.querySelector(".file-retry")?.addEventListener("click", renderFilesScreen); }
}

registerRoutes({ arquivos: renderFilesScreen });
window.addEventListener("hashchange", () => {
  if (location.hash !== "#arquivos") fileFilter.request += 1;
});

const fileResultsObserver = new MutationObserver(() => {
  const list = dashboardGrid.querySelector(".operations-table");
  const toolbar = list?.querySelector(".operations-toolbar");
  if (!list || !toolbar) return;
  let status = list.querySelector("[data-file-results]");
  if (!status) {
    status = document.createElement("p");
    status.className = "ui-filter-status";
    status.dataset.fileResults = "true";
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    toolbar.insertAdjacentElement("afterend", status);
  }
  const count = list.querySelectorAll("tbody tr").length;
  status.textContent = `${ui.number(count)} ${count === 1 ? "arquivo encontrado" : "arquivos encontrados"}.`;
});
fileResultsObserver.observe(dashboardGrid, { childList: true, subtree: true });

new MutationObserver(() => {
  dashboardGrid.querySelectorAll("[data-file-search], [data-file-project], [data-file-kind]").forEach((control) => {
    if (control.matches("[data-file-search]")) control.name = "search";
    else if (control.matches("[data-file-project]")) control.name = "project_id";
    else control.name = "kind";
    control.setAttribute("autocomplete", "off");
  });
  dashboardGrid.querySelectorAll("[data-file-delete], [data-file-new]").forEach((button) => {
    if (button.disabled) button.setAttribute("aria-busy", "true");
    else button.removeAttribute("aria-busy");
    button.style.touchAction = "manipulation";
  });
  dashboardGrid.querySelectorAll("table thead th").forEach((header) => header.setAttribute("scope", "col"));
  dashboardGrid.querySelectorAll("table").forEach((table) => {
    if (!table.caption) {
      const caption = document.createElement("caption");
      caption.className = "sr-only";
      caption.textContent = "Arquivos do workspace";
      table.prepend(caption);
    }
    table.querySelectorAll("button, a").forEach((control) => { control.style.touchAction = "manipulation"; });
  });
  dashboardGrid.querySelectorAll(".state-loading p").forEach((label) => { label.textContent = label.textContent.replaceAll("...", "…"); });
}).observe(dashboardGrid, { childList: true, subtree: true, attributes: true, attributeFilter: ["disabled"] });
