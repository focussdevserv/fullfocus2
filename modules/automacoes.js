/* ==========================================================================
   FocusDev — módulo "automacoes"
   Telas: Automações, Templates, Integrações
   Carregado depois de app.js; usa os helpers globais do núcleo
   (dashboardGrid, escapeHtml, openCreateDialog, api, stateBlock, registerRoutes).
   Ownership: modules/automacoes.js
   ========================================================================== */

const automacoesModules = {
  automacoes: { kicker: "Configuração", title: "Automações", intro: "Deixe o workspace cuidar das rotinas para sua equipe focar no que importa.", art: "spiderman-hanging.png", action: "Nova automação", metrics: [["Ativas", "14", "1.860 execuções no mês", "positive"], ["Economia", "42h", "Tempo poupado estimado", "neutral"], ["Alertas", "02", "Requerem atenção", "warning"]], columns: ["Automação", "Gatilho", "Última execução", "Status"], rows: [["Avisar contrato próximo do vencimento", "30 dias antes", "Hoje, 07:00", "Ativa"], ["Criar tarefa de onboarding", "Novo cliente", "Hoje, 09:14", "Ativa"], ["Resumo semanal de projetos", "Toda sexta", "12 set 2026", "Ativa"], ["Notificar SLA estourado", "Ticket vencido", "11 set 2026", "Pausada"]] },
  templates: { kicker: "Configuração", title: "Templates", intro: "Crie uma base consistente para propostas, documentos e comunicações.", art: "agenda-spider-mask.png", action: "Novo template", metrics: [["Disponíveis", "28", "9 usados esta semana", "positive"], ["Favoritos", "08", "Compartilhados pela equipe", "neutral"], ["Em revisão", "03", "Aguardando aprovação", "warning"]], columns: ["Template", "Tipo", "Atualizado", "Uso"], rows: [["Proposta comercial 2026", "Proposta", "Hoje, 11:20", "18 usos"], ["Briefing de projeto", "Documento", "Ontem, 15:42", "12 usos"], ["E-mail de follow-up", "Comunicação", "10 set 2026", "34 usos"], ["Relatório executivo", "Relatório", "08 set 2026", "Em revisão"]] },
  integracoes: { kicker: "Configuração", title: "Integrações", intro: "Conecte as ferramentas que sua operação já usa e mantenha tudo sincronizado.", art: "spiderman-card-web.png", action: "Conectar app", metrics: [["Conectadas", "09", "Todas operando normalmente", "positive"], ["Eventos hoje", "2.406", "Sincronizados automaticamente", "neutral"], ["Com atenção", "01", "Token expira em 7 dias", "warning"]], columns: ["Integração", "Categoria", "Última sincronização", "Status"], rows: [["Google Calendar", "Produtividade", "Agora", "Conectada"], ["Slack", "Comunicação", "há 2 min", "Conectada"], ["Stripe", "Financeiro", "há 8 min", "Conectada"], ["HubSpot", "CRM", "há 1 dia", "Reautorizar"]] },
};


registerRoutes({
  "automacoes": () => renderModulePage("automacoes", automacoesModules["automacoes"]),
  "templates": () => renderModulePage("templates", automacoesModules["templates"]),
  "integracoes": () => renderModulePage("integracoes", automacoesModules["integracoes"]),
});
