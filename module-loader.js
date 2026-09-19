/* Carrega apenas o módulo da tela acessada. Cada módulo registra suas próprias rotas. */
(function () {
  const groups = {
    inicio: ["inicio.js"], tarefas: ["tarefas.js"], agenda: ["agenda.js", "agenda-enhanced.js"],
    "caixa-de-entrada": ["inbox.js"], conversas: ["inbox.js"],
    crm: ["crm.js"], leads: ["crm.js"], campanhas: ["crm.js"], funil: ["crm.js"], oportunidades: ["crm.js"], propostas: ["crm.js"], "follow-ups": ["crm.js"],
    contatos: ["contas.js"], empresas: ["contas.js"], clientes: ["contas.js"], "consulta-cnpj": ["contas.js"], "portal-do-cliente": ["contas.js"],
    contratos: ["operacao.js"], projetos: ["operacao.js"],
    "visao-financeira": ["financeiro.js"], receitas: ["financeiro.js"], despesas: ["financeiro.js"], "contas-a-receber": ["financeiro.js"],
    cobrancas: ["cobrancas.js", "mercadopago-finance-ui.js"], assinaturas: ["assinaturas.js", "mercadopago-finance-ui.js"], catalogo: ["catalogo.js"],
    automacoes: ["automacoes.js", "automacoes-workspace.js"], templates: ["templates.js"], "base-de-conhecimento": ["base-conhecimento.js"], formularios: ["formularios.js"], integracoes: ["integracoes.js", "integracoes-enhanced.js"], tickets: ["operacao.js", "tickets.js"], arquivos: ["operacao.js", "arquivos.js"], lixeira: ["lixeira.js"],
    configuracoes: ["configuracoes-hub.js"], whatsapp: ["whatsapp.js"], agente: ["agente.js"], briefings: ["briefings.js"], "contas-a-pagar": ["contas-pagar.js"], "notas-fiscais": ["notas-fiscais.js"], "contas-bancarias": ["contas-bancarias.js"], relatorios: ["relatorios-financeiros.js"],
    equipe: ["team-access.js"], auditoria: ["auditoria.js"], infraestrutura: ["infraestrutura.js"], metas: ["gestao.js"], comissoes: ["gestao.js"], ausencias: ["gestao.js"], horas: ["gestao.js"], aprovacoes: ["estrutura.js"], cofre: ["estrutura.js"], alteracoes: ["estrutura.js"], entregas: ["estrutura.js"]
  };
  const loaded = new Map();
  const styleGroups = { "inicio.js": "inicio", "tarefas.js": "tarefas", "agenda.js": "agenda", "inbox.js": "inbox", "crm.js": "crm", "contas.js": "contas", "operacao.js": "operacao", "financeiro.js": "financeiro", "catalogo.js": "catalogo", "automacoes.js": "automacoes", "automacoes-workspace.js": "automacoes", "integracoes.js": "automacoes", "integracoes-enhanced.js": "automacoes", "configuracoes.js": "configuracoes", "configuracoes-enhanced.js": "configuracoes", "configuracoes-hub.js": "configuracoes", "whatsapp.js": "whatsapp", "agente.js": "agente", "estrutura.js": "estrutura" };
  const styles = new Map();
  const loadStyle = (file) => {
    const name = styleGroups[file];
    if (!name || styles.has(name)) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = `modules/${name}.css?v=4`;
    document.head.append(link);
    styles.set(name, link);
  };
  const importWithTimeout = (file, timeoutMs = 12000) => {
    const importPromise = import(`./modules/${file}?v=4`);
    let timeoutId;
    const timeout = new Promise((_, reject) => {
      timeoutId = window.setTimeout(() => reject(new Error(`O módulo ${file} demorou mais que o esperado para carregar.`)), timeoutMs);
    });
    return Promise.race([importPromise, timeout]).finally(() => window.clearTimeout(timeoutId));
  };
  const load = async (key) => {
    const files = groups[key] || [];
    if (!files.length) throw new Error(`Rota sem mÃ³dulo configurado: ${key}.`);
    for (const file of files) {
      loadStyle(file);
      if (!loaded.has(file)) {
        const request = importWithTimeout(file).catch((error) => {
        // Uma falha transitória não pode deixar uma promessa rejeitada presa no cache.
        // Assim, o botão de retry faz uma nova tentativa de verdade.
          loaded.delete(file);
          throw error;
        });
        loaded.set(file, request);
      }
      await loaded.get(file);
    }
    return { key, files };
  };
  window.FocusModuleLoader = { load };
  window.addEventListener("focusdev:route-needed", (event) => {
    const key = event.detail?.key;
    load(key).catch((error) => {
      console.error(`Falha ao carregar o módulo ${key}`, error);
      window.dispatchEvent(new CustomEvent("focusdev:module-error", { detail: { key, error } }));
    });
  });
  window.dispatchEvent(new CustomEvent("focusdev:module-loader-ready"));
})();
