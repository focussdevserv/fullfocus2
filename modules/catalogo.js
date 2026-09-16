const types = { product: "Produto", service: "Serviço", package: "Pacote", plan: "Plano", subscription: "Assinatura", addon: "Serviço adicional" };
const billingTypes = { one_time: "Pagamento único", recurring: "Recorrente", milestone: "Por etapa" };
const esc = (value) => escapeHtml(value ?? "");
const moneyFormatter = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const money = (value) => moneyFormatter.format(Number(value || 0));
const catalogFilter = { search: "", kind: "", active: "", request: 0 };

const fields = [
  { name: "name", label: "Nome", required: true, placeholder: "Ex.: Site institucional" },
  { name: "kind", label: "Tipo", type: "select", options: Object.entries(types), required: true },
  { name: "price", label: "Preço", type: "number", min: 0, step: 0.01, required: true },
  { name: "unit", label: "Unidade", placeholder: "Ex.: projeto, mês, hora", required: false },
  { name: "category", label: "Categoria", required: false },
  { name: "billing_type", label: "Tipo de cobrança", type: "select", options: [["", "Não definido"], ...Object.entries(billingTypes)], required: false },
  { name: "recurrence", label: "Recorrência", placeholder: "Ex.: mensal", required: false },
  { name: "short_description", label: "Descrição curta", required: false },
  { name: "full_description", label: "Descrição completa", type: "textarea", rows: 3, required: false },
  { name: "included_scope", label: "O que está incluído", type: "textarea", rows: 2, required: false },
  { name: "excluded_scope", label: "O que não está incluído", type: "textarea", rows: 2, required: false },
  { name: "delivery_days", label: "Prazo médio (dias)", type: "number", min: 0, required: false },
  { name: "image_url", label: "URL da imagem", type: "url", placeholder: "https://exemplo.com/imagem.jpg", required: false },
  { name: "active", label: "Item ativo", type: "checkbox", required: false },
  { name: "public_visible", label: "Exibir no catálogo público", type: "checkbox", required: false },
  { name: "highlighted", label: "Destacar no catálogo público", type: "checkbox", required: false },
];

const queryString = () => { const params = new URLSearchParams(); if (catalogFilter.search) params.set("search", catalogFilter.search); if (catalogFilter.kind) params.set("kind", catalogFilter.kind); if (catalogFilter.active) params.set("active", catalogFilter.active); return params.toString(); };
const statusTone = (item) => item.active ? "positive" : "neutral";

function catalogDetails(item) {
  const description = item.full_description || item.description || item.short_description || "Sem descrição cadastrada.";
  ui.drawer({ title: item.name || "Item do catálogo", subtitle: `${types[item.kind] || "Item"} · ${item.active ? "Ativo" : "Inativo"}`, html: `<div class="catalog-drawer-price">${money(item.price)} <small>${esc(item.unit || "por item")}</small></div><p class="catalog-drawer-description">${esc(description)}</p>${ui.facts([["Categoria", item.category], ["Cobrança", billingTypes[item.billing_type] || item.billing_type], ["Recorrência", item.recurrence], ["Prazo médio", item.delivery_days ? `${item.delivery_days} dias` : "—"], ["Visibilidade", item.public_visible ? "Catálogo público" : "Somente interno"]])}` });
}

function catalogForm(item = null, onSaved) {
  const routeAtStart = location.hash;
  if (routeAtStart !== "#catalogo") return;
  const saveOnCurrentRoute = onSaved;
  onSaved = () => { if (location.hash === routeAtStart && location.hash === "#catalogo") saveOnCurrentRoute(); };
  ui.form({ title: item ? "Editar item" : "Novo item", subtitle: "Catálogo", values: { active: true, public_visible: false, ...item }, fields, submitLabel: item ? "Salvar alterações" : "Criar item", onSubmit: async (values) => { const endpoint = item ? `/api/catalog-items/${item.id}` : "/api/catalog-items"; await api(endpoint, { method: item ? "PATCH" : "POST", body: values }); if (location.hash !== routeAtStart || location.hash !== "#catalogo") return; toast(item ? "Item atualizado." : "Item criado no catálogo.", "success"); onSaved(); } });
}

const catalogCard = (item) => `<article class="data-card catalog-card"><div class="catalog-card-top"><span class="catalog-kind">${esc(types[item.kind] || item.kind || "Item")}</span><span class="finance-status ${statusTone(item)}">${item.active ? "Ativo" : "Inativo"}</span></div><h3>${esc(item.name || "Sem nome")}</h3><div class="catalog-price">${money(item.price)}<small>${esc(item.unit || "por item")}</small></div><p>${esc(item.short_description || item.description || "Sem descrição curta")}</p><div class="catalog-card-meta">${item.category ? `<span>${esc(item.category)}</span>` : ""}${item.delivery_days ? `<span>Entrega em ${ui.number(item.delivery_days)} dias</span>` : ""}</div><div class="card-actions"><button class="compact-action" data-details="${esc(item.id)}" type="button">Detalhes</button><button class="compact-action" data-edit="${esc(item.id)}" type="button">Editar</button><button class="compact-action" data-toggle="${esc(item.id)}" type="button">${item.active ? "Desativar" : "Ativar"}</button><button class="compact-action" data-delete="${esc(item.id)}" type="button">Excluir</button></div></article>`;

const catalogFormBase = catalogForm;
catalogForm = (...args) => { catalogFormBase(...args); return Promise.resolve(); };

async function renderCatalog() {
  if (location.hash !== "#catalogo") return;
  const request = catalogFilter.request = (catalogFilter.request || 0) + 1;
  dashboardGrid.setAttribute("aria-busy", "true");
  const restoreSearchFocus = ui.keepSearchFocus(dashboardGrid, "[data-search]");
  dashboardGrid.innerHTML = `<section class="page-intro"><div><p class="card-kicker">Catálogo</p><h2>Produtos e serviços</h2><p>Itens reutilizáveis para propostas, projetos e cobranças.</p></div><button class="button button-primary compact-action" data-new type="button">+ Novo item</button></section>${stateBlock.loading("Carregando catálogo…")}`;
  try {
    const [data, me] = await Promise.all([api(`/api/catalog-items?${queryString()}`), api("/api/auth/me")]);
    if (request !== catalogFilter.request || location.hash !== "#catalogo") return;
    const rows = data.catalog_items || [];
    const active = rows.filter((item) => item.active).length;
    const publicItems = rows.filter((item) => item.public_visible).length;
    dashboardGrid.innerHTML = `<section class="page-intro"><div><p class="card-kicker">Catálogo</p><h2>Produtos e serviços</h2><p>Itens reutilizáveis para propostas, projetos e cobranças.</p></div><div class="page-actions"><button class="button button-secondary compact-action" data-public-catalog type="button">Abrir catálogo público</button><button class="button button-primary compact-action" data-new type="button">+ Novo item</button></div></section>${ui.stats([{ label: "Itens encontrados", value: ui.number(rows.length) }, { label: "Ativos", value: ui.number(active), tone: "green" }, { label: "Visíveis no público", value: ui.number(publicItems) }, { label: "Tipos cadastrados", value: ui.number(new Set(rows.map((item) => item.kind).filter(Boolean)).size) }])}<section class="catalog-toolbar"><label class="catalog-search"><span class="sr-only">Buscar no catálogo</span><input type="search" data-search value="${esc(catalogFilter.search)}" placeholder="Buscar por nome, categoria ou descrição…" aria-label="Buscar no catálogo"></label><select data-kind aria-label="Filtrar por tipo"><option value="">Todos os tipos</option>${Object.entries(types).map(([key, label]) => `<option value="${key}">${label}</option>`).join("")}</select><select data-active aria-label="Filtrar por status"><option value="">Todos os status</option><option value="true">Ativos</option><option value="false">Inativos</option></select></section><section class="catalog-grid">${rows.map(catalogCard).join("") || ui.empty({ title: "Seu catálogo está vazio", text: "Cadastre produtos e serviços para reutilizar em propostas e cobranças.", cta: "Criar primeiro item", attr: "data-empty" })}</section>`;
    const search = dashboardGrid.querySelector("[data-search]"), kind = dashboardGrid.querySelector("[data-kind]"), activeFilter = dashboardGrid.querySelector("[data-active]"); kind.value = catalogFilter.kind; activeFilter.value = catalogFilter.active; search?.setAttribute("name", "catalog_search"); search?.setAttribute("autocomplete", "off"); kind?.setAttribute("name", "kind"); kind?.setAttribute("autocomplete", "off"); activeFilter?.setAttribute("name", "active"); activeFilter?.setAttribute("autocomplete", "off"); restoreSearchFocus();
    let timer; search?.addEventListener("input", () => { clearTimeout(timer); catalogFilter.search = search.value.trim(); timer = setTimeout(renderCatalog, 250); }); kind?.addEventListener("change", () => { catalogFilter.kind = kind.value; renderCatalog(); }); activeFilter?.addEventListener("change", () => { catalogFilter.active = activeFilter.value; renderCatalog(); });
    dashboardGrid.querySelector("[data-new]")?.addEventListener("click", () => catalogForm(null, renderCatalog)); dashboardGrid.querySelector("[data-empty]")?.addEventListener("click", () => catalogForm(null, renderCatalog));
    dashboardGrid.querySelector("[data-public-catalog]")?.addEventListener("click", async (event) => { const button = event.currentTarget; if (button.disabled) return; const link = `${location.origin}/catalog/${me.user.organization_id}`; const popup = window.open("about:blank", "_blank", "noopener,noreferrer"); const originalLabel = button.textContent; button.disabled = true; button.setAttribute("aria-busy", "true"); button.textContent = "Abrindo catálogo…"; try { await ui.copyText(link); if (popup) popup.location.href = link; ui.toast("Catálogo público aberto e link copiado.", "success"); } catch (error) { popup?.close(); ui.toast(error.message || "Não foi possível abrir o catálogo público.", "error"); } finally { button.disabled = false; button.removeAttribute("aria-busy"); button.textContent = originalLabel; } });
    dashboardGrid.querySelectorAll("[data-details]").forEach((button) => button.addEventListener("click", () => catalogDetails(rows.find((item) => String(item.id) === button.dataset.details))));
    dashboardGrid.querySelectorAll("[data-edit]").forEach((button) => button.addEventListener("click", () => { const item = rows.find((entry) => String(entry.id) === button.dataset.edit); if (item) catalogForm(item, renderCatalog).catch((error) => toast(error.message, "error")); }));
    dashboardGrid.querySelectorAll("[data-toggle]").forEach((button) => button.addEventListener("click", async () => { const item = rows.find((entry) => String(entry.id) === button.dataset.toggle); if (!item || button.disabled) return; const routeAtStart = location.hash; const originalLabel = button.textContent; button.disabled = true; button.setAttribute("aria-busy", "true"); button.textContent = item.active ? "Desativando…" : "Ativando…"; try { await api(`/api/catalog-items/${item.id}`, { method: "PATCH", body: { active: !item.active } }); if (location.hash !== routeAtStart || location.hash !== "#catalogo" || !button.isConnected) return; toast(item.active ? "Item desativado." : "Item ativado.", "success"); renderCatalog(); } catch (error) { if (location.hash !== routeAtStart || !button.isConnected) return; button.disabled = false; button.removeAttribute("aria-busy"); button.textContent = originalLabel; toast(error.message, "error"); } }));
    dashboardGrid.removeAttribute("aria-busy");
    dashboardGrid.querySelectorAll("[data-delete]").forEach((button) => button.addEventListener("click", () => ui.confirmInline(button, { text: "Excluir item do catálogo?", onConfirm: async () => { const routeAtStart = location.hash; const originalLabel = button.textContent; button.disabled = true; button.setAttribute("aria-busy", "true"); button.textContent = "Excluindo…"; try { await api(`/api/catalog-items/${button.dataset.delete}`, { method: "DELETE" }); if (location.hash !== routeAtStart || location.hash !== "#catalogo" || !button.isConnected) return; toast("Item excluído.", "success"); renderCatalog(); } catch (error) { if (location.hash !== routeAtStart || !button.isConnected) return; button.disabled = false; button.removeAttribute("aria-busy"); button.textContent = originalLabel; toast(error.message, "error"); } } })));
  } catch (error) { if (request !== catalogFilter.request || location.hash !== "#catalogo") return; dashboardGrid.removeAttribute("aria-busy"); dashboardGrid.innerHTML = stateBlock.error(error.message, "catalog-retry"); dashboardGrid.querySelector(".catalog-retry")?.addEventListener("click", renderCatalog); }
}

registerRoutes({ catalogo: renderCatalog });
window.addEventListener("hashchange", () => {
  if (location.hash !== "#catalogo") catalogFilter.request += 1;
});

new MutationObserver(() => {
  const toolbar = dashboardGrid.querySelector(".catalog-toolbar");
  const grid = dashboardGrid.querySelector(".catalog-grid");
  if (!toolbar || !grid) return;
  let status = toolbar.querySelector("[data-catalog-results]");
  if (!status) {
    status = document.createElement("p");
    status.className = "ui-filter-status";
    status.dataset.catalogResults = "true";
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    toolbar.append(status);
  }
  const count = grid.querySelectorAll(".catalog-card").length;
  const label = count === 1 ? "1 item encontrado" : `${count} itens encontrados`;
  if (status.textContent !== label) status.textContent = label;
}).observe(dashboardGrid, { childList: true, subtree: true });

new MutationObserver(() => {
  dashboardGrid.querySelectorAll(".catalog-card .finance-status").forEach((status) => {
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
  });
}).observe(dashboardGrid, { childList: true, subtree: true });
