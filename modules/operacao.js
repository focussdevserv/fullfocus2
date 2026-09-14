/* ==========================================================================
   FocusDev — módulo "operacao"
   Telas: Contratos, Projetos, Arquivos, Tickets
   Carregado depois de app.js; usa os helpers globais do núcleo
   (dashboardGrid, escapeHtml, openCreateDialog, api, stateBlock, registerRoutes).
   Ownership: modules/operacao.js
   ========================================================================== */

const operacaoModules = {
  contratos: { kicker: "Operação", title: "Contratos", intro: "Controle vigências, assinaturas e obrigações de cada parceria.", art: "spiderman-card-hero.png", action: "Novo contrato", metrics: [["Ativos", "18", "2 vencem este mês", "warning"], ["Em assinatura", "04", "Aguardando cliente", "neutral"], ["Valor anual", "R$ 428 mil", "↑ 12,8% no ciclo", "positive"]], columns: ["Contrato", "Cliente", "Vigência", "Status"], rows: [["Retainer de produto", "Acme Inc.", "30 set 2026", "Ativo"], ["Desenvolvimento mobile", "Vértice", "18 out 2026", "Em assinatura"], ["Suporte e evolução", "Nexum", "04 nov 2026", "Renovação"], ["Consultoria de dados", "Orbit", "12 dez 2026", "Ativo"]] },
  projetos: { kicker: "Operação", title: "Projetos", intro: "Acompanhe entregas, marcos e a saúde do portfólio em um só lugar.", art: "spiderman-card-web.png", action: "Novo projeto", metrics: [["Em andamento", "12", "3 precisam de atenção", "warning"], ["Entregas no mês", "28", "↑ 18% vs. anterior", "positive"], ["Horas alocadas", "1.248h", "82% da capacidade", "neutral"]], columns: ["Projeto", "Cliente", "Progresso", "Saúde"], rows: [["Website institucional", "Acme Inc.", "78%", "No prazo"], ["Aplicativo mobile", "Vértice", "46%", "Atenção"], ["Campanha de lançamento", "Nexum", "92%", "No prazo"], ["Portal do cliente", "Orbit", "28%", "Bloqueado"]] },
  arquivos: { kicker: "Biblioteca", title: "Arquivos", intro: "Encontre documentos, assets e entregáveis compartilhados pela equipe.", art: "spiderman-card-duo.png", action: "Enviar arquivo", metrics: [["Arquivos", "486", "34 adicionados hoje", "positive"], ["Armazenamento", "68%", "6,8 GB de 10 GB", "neutral"], ["Compartilhados", "124", "9 aguardam revisão", "warning"]], columns: ["Arquivo", "Pasta", "Atualizado", "Acesso"], rows: [["Briefing institucional.pdf", "Acme Inc.", "Hoje, 10:42", "Equipe"], ["Design system v3.fig", "Produto", "Ontem, 16:20", "Equipe"], ["Contrato-suporte.docx", "Contratos", "12 set 2026", "Restrito"], ["Fotos campanha.zip", "Marketing", "10 set 2026", "Cliente"]] },
  tickets: { kicker: "Operação", title: "Tickets", intro: "Priorize solicitações e mantenha clientes informados até a resolução.", art: "spiderman-card-bg.png", action: "Abrir ticket", metrics: [["Em aberto", "24", "6 alta prioridade", "warning"], ["SLA cumprido", "94%", "↑ 3,4% esta semana", "positive"], ["Tempo médio", "3h 18m", "Dentro da meta de 4h", "neutral"]], columns: ["Ticket", "Solicitante", "Atualizado", "Status"], rows: [["#1048 · Ajuste no checkout", "Marina Lopes", "há 12 min", "Em atendimento"], ["#1045 · Acesso ao portal", "Acme Inc.", "há 1h", "Aguardando cliente"], ["#1041 · Exportação de dados", "Nexum", "há 3h", "Resolvido"], ["#1038 · Erro no relatório", "Orbit", "ontem", "Alta prioridade"]] },
};


registerRoutes({
  "contratos": () => renderModulePage("contratos", operacaoModules["contratos"]),
  "projetos": () => renderModulePage("projetos", operacaoModules["projetos"]),
  "arquivos": () => renderModulePage("arquivos", operacaoModules["arquivos"]),
  "tickets": () => renderModulePage("tickets", operacaoModules["tickets"]),
});
