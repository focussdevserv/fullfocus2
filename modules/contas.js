/* ==========================================================================
   FocusDev — módulo "contas"
   Telas: Contatos, Consulta CNPJ, Clientes, Portal do cliente, Empresas
   Carregado depois de app.js; usa os helpers globais do núcleo
   (dashboardGrid, escapeHtml, openCreateDialog, api, stateBlock, registerRoutes).
   Ownership: modules/contas.js
   ========================================================================== */

const customerModuleData = {
  conversas: {
    kicker: "Relacionamento",
    title: "Conversas",
    intro: "Acompanhe cada troca com clientes e mantenha o próximo passo sempre claro.",
  },
  contatos: {
    kicker: "Base de relacionamento",
    title: "Contatos",
    intro: "Uma visão viva das pessoas que fazem os projetos da FocusDev avançarem.",
  },
  "consulta-cnpj": {
    kicker: "Inteligência comercial",
    title: "Consulta CNPJ",
    intro: "Valide empresas, encontre contexto e transforme uma busca em uma conversa relevante.",
  },
  clientes: {
    kicker: "Carteira",
    title: "Clientes",
    intro: "Saúde, relacionamento e próximos marcos da sua carteira em um único lugar.",
  },
  "portal-do-cliente": {
    kicker: "Experiência externa",
    title: "Portal do cliente",
    intro: "Dê autonomia ao cliente para acompanhar entregas, documentos e aprovações.",
  },
  empresas: {
    kicker: "Organização",
    title: "Empresas",
    intro: "Conecte contatos, projetos e decisões à estrutura certa de cada negócio.",
  }
};

function renderCustomerModuleView(key) {
  const d = customerModuleData[key];
  const esc = escapeHtml;
  const initials = (name) => name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();
  const contactRows = [
    ["Marina Lopes", "Acme Inc.", "Diretora de Marketing", "Ativa", "Agora"],
    ["Bruno Almeida", "Nexum", "CEO", "Ativa", "Hoje, 09:18"],
    ["Carolina Mendes", "Vértice", "Produto", "Em reunião", "Ontem"],
    ["Diego Nunes", "Orbit", "Operações", "Aguardando", "12 set"]
  ];
  const clientRows = [
    ["Acme Inc.", "Website institucional", "R$ 24.000", "Saudável", "78%"],
    ["Vértice", "Aplicativo mobile", "R$ 42.800", "Atenção", "46%"],
    ["Nexum", "Campanha de lançamento", "R$ 18.400", "Saudável", "92%"],
    ["Orbit", "Portal do cliente", "R$ 31.200", "Novo", "28%"]
  ];
  const companyRows = [
    ["Acme Inc.", "12.345.678/0001-90", "São Paulo, SP", "4 contatos", "Ativa"],
    ["Nexum Tecnologia", "45.678.901/0001-22", "Curitiba, PR", "7 contatos", "Ativa"],
    ["Vértice Saúde", "67.890.123/0001-44", "Belo Horizonte, MG", "3 contatos", "Ativa"],
    ["Orbit Ventures", "89.012.345/0001-66", "Rio de Janeiro, RJ", "5 contatos", "Em implantação"]
  ];
  const stat = (label, value, note, tone = "blue") => `<article class="data-card customer-stat stat-${tone}"><span>${label}</span><strong>${value}</strong><small>${note}</small></article>`;
  const pageStart = `<section class="page-intro customer-intro"><div><p class="card-kicker">${d.kicker}</p><h2>${d.title}</h2><p>${d.intro}</p></div><div class="customer-hero-mark"><span>✦</span><small>FOCUSDEV / SPIDER</small></div></section>`;
  let markup = pageStart;

  if (key === "conversas") {
    const conversations = [
      ["Marina Lopes", "Aprovação do briefing", "O cliente respondeu e pediu dois ajustes no escopo.", "09:42", "ML", true],
      ["Bruno Almeida", "Próximos passos do site", "Consegue me enviar a nova previsão de publicação?", "Ontem", "BA", false],
      ["Carolina Mendes", "Aplicativo mobile", "Perfeito. Vou validar com o time de produto.", "12 set", "CM", false],
      ["Diego Nunes", "Kickoff Portal", "Compartilhei os acessos no documento do projeto.", "11 set", "DN", false]
    ];
    markup += `<section class="customer-metrics">${stat("Conversas abertas", "18", "+4 nesta semana", "red")}${stat("Tempo de resposta", "1h 42", "média no mês", "blue")}${stat("Pendentes", "05", "2 prioritárias", "gold")}</section><section class="customer-split"><section class="data-card conversation-card"><div class="section-heading"><div><p class="card-kicker">Central de relacionamento</p><h2>Caixa de conversas</h2></div><div class="conversation-tabs"><button class="is-active" data-conversation-filter="Todas" type="button">Todas</button><button data-conversation-filter="Não lidas" type="button">Não lidas</button></div></div><div class="conversation-list">${conversations.map(([name, subject, preview, time, avatar, unread]) => `<button class="conversation-row ${unread ? "is-unread" : ""}" data-conversation="${unread ? "Não lidas" : "Todas"}" type="button"><span class="customer-avatar">${avatar}</span><span class="conversation-copy"><span><strong>${name}</strong><time>${time}</time></span><b>${subject}</b><small>${preview}</small></span>${unread ? '<i class="unread-dot"></i>' : ""}</button>`).join("")}</div></section><aside class="data-card customer-focus-card"><p class="card-kicker">Radar do time</p><h2>Próximas respostas</h2><div class="focus-line"><span class="focus-icon">!</span><div><strong>Marina Lopes</strong><small>Ajustes no briefing · há 18 min</small></div></div><div class="focus-line"><span class="focus-icon blue">↗</span><div><strong>Diego Nunes</strong><small>Enviar acesso ao portal · hoje</small></div></div><button class="button button-primary" type="button" data-toast="Conversa iniciada com sucesso.">+ Iniciar conversa</button></aside></section>`;
  } else if (key === "contatos") {
    markup += `<section class="customer-metrics">${stat("Contatos totais", "248", "+12 este mês", "blue")}${stat("Com interação recente", "184", "74% da base", "red")}${stat("Sem empresa", "09", "Precisam de vínculo", "gold")}</section><section class="data-card contacts-card"><div class="section-heading"><div><p class="card-kicker">Diretório inteligente</p><h2>Pessoas e vínculos</h2></div><div class="customer-actions"><label class="inline-search"><span>⌕</span><input data-contact-search placeholder="Buscar contato" /></label><button class="button button-primary compact-action" type="button" data-toast="Novo contato pronto para cadastro.">+ Novo contato</button></div></div><div class="contact-grid">${contactRows.map(([name, company, role, status, last]) => `<article class="contact-tile" data-contact-name="${name.toLowerCase()}"><div class="contact-tile-head"><span class="customer-avatar avatar-alt">${initials(name)}</span><span class="status-pill">${status}</span></div><h3>${name}</h3><p>${role}</p><strong>${company}</strong><small>Última interação <b>${last}</b></small><div class="contact-tile-actions"><button type="button" data-toast="Conversa aberta com ${name}.">Mensagem</button><button type="button" data-toast="Perfil de ${name} selecionado.">Ver perfil</button></div></article>`).join("")}</div></section>`;
  } else if (key === "consulta-cnpj") {
    markup += `<section class="cnpj-hero"><div><span class="cnpj-badge">BASE RECEITA + FOCUSDEV</span><h3>Descubra o contexto por trás de um CNPJ.</h3><p>Consulte dados cadastrais e salve empresas qualificadas para o seu próximo contato.</p></div><form class="cnpj-form"><label for="cnpj-input">CNPJ da empresa</label><div><input id="cnpj-input" inputmode="numeric" placeholder="00.000.000/0000-00" value="12.345.678/0001-90" /><button class="button button-primary" type="submit">Consultar</button></div><small>Exemplo: Acme Inc. · resposta simulada local</small></form></section><section class="data-card cnpj-result" aria-live="polite"><div class="cnpj-result-placeholder"><span>⌁</span><div><strong>Pronto para consultar</strong><p>Digite um CNPJ para visualizar os dados da empresa.</p></div></div></section><section class="customer-metrics">${stat("Consultas no mês", "42", "8 novas oportunidades", "blue")}${stat("Empresas salvas", "16", "3 com alta aderência", "red")}${stat("Dados atualizados", "Hoje", "Última sincronização 10:24", "gold")}</section>`;
  } else if (key === "clientes") {
    markup += `<section class="customer-metrics">${stat("Carteira ativa", "24", "R$ 318 mil recorrentes", "red")}${stat("NPS da carteira", "72", "+8 pts no trimestre", "blue")}${stat("Renovações", "03", "próximos 30 dias", "gold")}</section><section class="data-card clients-card"><div class="section-heading"><div><p class="card-kicker">Visão executiva</p><h2>Saúde dos clientes</h2></div><div class="client-filters"><button class="is-active" data-client-filter="Todos" type="button">Todos</button><button data-client-filter="Saudável" type="button">Saudáveis</button><button data-client-filter="Atenção" type="button">Atenção</button></div></div><div class="client-table">${clientRows.map(([company, project, value, health, progress]) => `<button class="client-row" data-client-health="${health}" type="button"><span class="company-logo">${company.slice(0, 1)}</span><span><strong>${company}</strong><small>${project}</small></span><b>${value}</b><span class="health health-${health.toLowerCase().replace("ã", "a")}">${health}</span><span class="client-progress"><i style="width:${progress}"></i></span><em>${progress}</em></button>`).join("")}</div></section>`;
  } else if (key === "portal-do-cliente") {
    markup += `<section class="portal-banner"><div class="portal-copy"><span class="portal-orbit">◉</span><div><p class="card-kicker">Área externa segura</p><h3>O cliente acompanha. Seu time entrega.</h3><p>Centralize aprovações, arquivos e atualizações em uma experiência com a marca da FocusDev.</p><button class="button button-primary" type="button" data-toast="Link de convite copiado para a área de transferência.">Copiar link de convite</button></div></div><div class="portal-preview"><span>PORTAL / ACME</span><strong>Olá, Marina</strong><small>Seu projeto está avançando</small><div><i></i><i></i><i></i></div></div></section><section class="customer-metrics">${stat("Portais ativos", "08", "2 aguardando convite", "blue")}${stat("Aprovações abertas", "04", "R$ 38 mil em projetos", "red")}${stat("Acessos este mês", "126", "+21% contra agosto", "gold")}</section><section class="data-card portal-list-card"><div class="section-heading"><div><p class="card-kicker">Espaços publicados</p><h2>Portais dos clientes</h2></div><button class="filter-button" type="button" data-toast="Novo portal iniciado.">+ Criar portal</button></div><div class="portal-list">${[["Acme Inc.", "marina@acme.com", "Ativo", "Hoje, 09:12"], ["Vértice", "carolina@vertice.com", "Ativo", "Ontem, 16:40"], ["Orbit", "diego@orbit.com", "Convite pendente", "Sem acesso"]].map(([company, email, status, last]) => `<article><span class="company-logo">${company[0]}</span><div><strong>${company}</strong><small>${email}</small></div><span class="portal-status ${status.includes("pendente") ? "pending" : ""}">${status}</span><small>${last}</small><button class="inbox-more" type="button" data-toast="Ações de ${company} abertas." aria-label="Mais opções">•••</button></article>`).join("")}</div></section>`;
  } else {
    markup += `<section class="company-overview"><div class="company-network"><span class="network-line"></span><div class="company-emblem">FD</div><div class="network-node node-a">AC</div><div class="network-node node-b">NX</div><div class="network-node node-c">VT</div><p><strong>FocusDev</strong><small>Empresa principal · São Paulo</small></p></div><div class="company-overview-copy"><p class="card-kicker">Mapa da operação</p><h3>Empresas conectadas ao seu workspace.</h3><p>Tenha uma visão única das unidades e dos vínculos que alimentam sua operação comercial.</p><button class="button button-primary" type="button" data-toast="Nova empresa pronta para cadastro.">+ Cadastrar empresa</button></div></section><section class="data-card companies-card"><div class="section-heading"><div><p class="card-kicker">Todas as organizações</p><h2>Empresas cadastradas</h2></div><label class="inline-search"><span>⌕</span><input data-company-search placeholder="Buscar empresa" /></label></div><div class="company-list">${companyRows.map(([company, cnpj, city, contacts, status]) => `<article data-company-name="${company.toLowerCase()}"><span class="company-logo">${company.slice(0, 1)}</span><div><strong>${company}</strong><small>${cnpj}</small></div><span><b>${city}</b><small>${contacts}</small></span><span class="status-pill">${status}</span><button class="filter-button" type="button" data-toast="Empresa ${company} selecionada.">Abrir</button></article>`).join("")}</div></section>`;
  }
  dashboardGrid.innerHTML = markup;
  bindCustomerInteractions(key);
}

function bindCustomerInteractions(key) {
  const toast = (message) => { let node = document.querySelector(".customer-toast"); if (!node) { node = document.createElement("div"); node.className = "customer-toast"; document.body.append(node); } node.textContent = message; node.classList.add("is-visible"); window.clearTimeout(node._timer); node._timer = window.setTimeout(() => node.classList.remove("is-visible"), 2400); };
  dashboardGrid.querySelectorAll("[data-toast]").forEach((button) => button.addEventListener("click", () => toast(button.dataset.toast)));
  dashboardGrid.querySelectorAll("[data-conversation-filter]").forEach((button) => button.addEventListener("click", () => { dashboardGrid.querySelectorAll("[data-conversation-filter]").forEach((item) => item.classList.toggle("is-active", item === button)); dashboardGrid.querySelectorAll("[data-conversation]").forEach((row) => { row.hidden = button.dataset.conversationFilter === "Não lidas" && row.dataset.conversation !== "Não lidas"; }); }));
  const bindSearch = (input, selector, attribute) => input?.addEventListener("input", () => { const query = input.value.trim().toLowerCase(); dashboardGrid.querySelectorAll(selector).forEach((item) => { item.hidden = query && !item.dataset[attribute].includes(query); }); });
  bindSearch(dashboardGrid.querySelector("[data-contact-search]"), "[data-contact-name]", "contactName");
  bindSearch(dashboardGrid.querySelector("[data-company-search]"), "[data-company-name]", "companyName");
  dashboardGrid.querySelectorAll("[data-client-filter]").forEach((button) => button.addEventListener("click", () => { dashboardGrid.querySelectorAll("[data-client-filter]").forEach((item) => item.classList.toggle("is-active", item === button)); dashboardGrid.querySelectorAll("[data-client-health]").forEach((row) => { row.hidden = button.dataset.clientFilter !== "Todos" && row.dataset.clientHealth !== button.dataset.clientFilter; }); }));
  dashboardGrid.querySelector(".cnpj-form")?.addEventListener("submit", (event) => { event.preventDefault(); const input = dashboardGrid.querySelector("#cnpj-input"); const digits = input.value.replace(/\D/g, ""); const result = dashboardGrid.querySelector(".cnpj-result"); result.innerHTML = digits.length >= 14 ? `<div class="cnpj-company-result"><span class="company-logo">A</span><div><p class="card-kicker">Empresa encontrada</p><h2>Acme Inc.</h2><p>12.345.678/0001-90 · Comércio e serviços digitais</p></div><span class="status-pill">Ativa</span><button class="button button-secondary" type="button" data-toast="Acme Inc. salva na sua base de empresas.">Salvar empresa</button></div>` : `<div class="cnpj-error"><strong>CNPJ incompleto</strong><p>Confira os 14 dígitos e tente novamente.</p></div>`; bindCustomerInteractions(key); });
}


registerRoutes({
  "contatos": () => renderCustomerModuleView("contatos"),
  "consulta-cnpj": () => renderCustomerModuleView("consulta-cnpj"),
  "clientes": () => renderCustomerModuleView("clientes"),
  "portal-do-cliente": () => renderCustomerModuleView("portal-do-cliente"),
  "empresas": () => renderCustomerModuleView("empresas"),
});
