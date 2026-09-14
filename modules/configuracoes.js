/* ==========================================================================
   FocusDev — módulo "configuracoes"
   Telas: Equipe, Configurações
   Carregado depois de app.js; usa os helpers globais do núcleo
   (dashboardGrid, escapeHtml, openCreateDialog, api, stateBlock, registerRoutes).
   Ownership: modules/configuracoes.js
   ========================================================================== */

const configuracoesModules = {
  equipe: { kicker: "Configuração", title: "Equipe", intro: "Dê visibilidade aos papéis, acessos e capacidade de quem faz o trabalho acontecer.", art: "spiderman-card-duo.png", action: "Convidar pessoa", metrics: [["Pessoas ativas", "24", "3 convites pendentes", "positive"], ["Times", "06", "Operação é o maior", "neutral"], ["Acessos para revisar", "04", "Próxima revisão em 5 dias", "warning"]], columns: ["Pessoa", "Time", "Última atividade", "Acesso"], rows: [["Marina Lopes", "Operação", "Agora", "Administrador"], ["Alex Martins", "Produto", "há 12 min", "Editor"], ["Joana Silva", "Financeiro", "há 1h", "Editor"], ["Rafael Costa", "Comercial", "ontem", "Colaborador"]] },
  configuracoes: { kicker: "Configuração", title: "Configurações", intro: "Ajuste preferências, permissões e identidade do seu workspace.", art: "spiderman-card-bg.png", action: "Salvar alterações", metrics: [["Perfil do workspace", "100%", "Informações completas", "positive"], ["Preferências", "12", "Tudo sincronizado", "neutral"], ["Pendências", "02", "Revisar permissões", "warning"]], columns: ["Preferência", "Área", "Atualização", "Status"], rows: [["Identidade visual", "Workspace", "Hoje, 09:30", "Configurado"], ["Notificações", "Preferências", "12 set 2026", "Configurado"], ["Papéis e permissões", "Segurança", "11 set 2026", "Revisar"], ["Faturamento", "Conta", "01 set 2026", "Configurado"]] }
};


registerRoutes({
  "equipe": () => renderModulePage("equipe", configuracoesModules["equipe"]),
  "configuracoes": () => renderModulePage("configuracoes", configuracoesModules["configuracoes"]),
});
