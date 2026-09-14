/* ==========================================================================
   FocusDev — módulo "catalogo"
   Telas: Catálogo
   Carregado depois de app.js; usa os helpers globais do núcleo
   (dashboardGrid, escapeHtml, openCreateDialog, api, stateBlock, registerRoutes).
   Ownership: modules/catalogo.js
   ========================================================================== */

const catalogoModules = {
  catalogo: { kicker: "Catálogo", title: "Catálogo", intro: "Organize serviços, pacotes e itens que alimentam suas propostas.", art: "spiderman-card-hero.png", action: "Novo item", metrics: [["Itens ativos", "32", "5 categorias publicadas", "positive"], ["Mais vendido", "Sprint de produto", "14 vendas no trimestre", "neutral"], ["Rascunhos", "06", "Prontos para revisão", "warning"]], columns: ["Item", "Categoria", "Preço base", "Status"], rows: [["Sprint de produto", "Consultoria", "R$ 8.400", "Publicado"], ["Landing page premium", "Design", "R$ 4.800", "Publicado"], ["Suporte contínuo", "Operação", "R$ 2.200/mês", "Publicado"], ["Discovery workshop", "Estratégia", "R$ 3.600", "Rascunho"]] },
};


registerRoutes({
  "catalogo": () => renderModulePage("catalogo", catalogoModules["catalogo"]),
});
