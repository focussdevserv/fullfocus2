/* Guia de integração: reduz a dependência de JSON e orienta a escolha do provedor. */
const integrationGuide = [
  ["WhatsApp", "Atendimento e auxiliar", "#whatsapp", "Conecte o número e gere o QR code."],
  ["Google Calendar", "Reuniões e agenda", "#integracoes", "Use OAuth ou as credenciais do provedor."],
  ["E-mail", "Propostas e avisos", "#integracoes", "Configure SMTP, Gmail ou o serviço de envio."],
  ["Pix e pagamentos", "Cobranças e confirmações", "#contas-bancarias", "Cadastre a chave Pix e, se quiser automação, um gateway."],
  ["Webhooks e n8n", "Automações externas", "#integracoes", "Cole a URL do webhook e teste a conexão."],
  ["GitHub e infraestrutura", "Projetos e hospedagem", "#infraestrutura", "Organize repositórios, domínio e recursos do projeto."],
];

function drawIntegrationGuide() {
  if (location.hash !== "#integracoes" || dashboardGrid.querySelector("[data-integration-guide]")) return;
  const anchor = dashboardGrid.querySelector(".automation-list");
  if (!anchor) return;
  const guide = document.createElement("section");
  guide.className = "data-card integration-guide";
  guide.dataset.integrationGuide = "true";
  guide.innerHTML = `<div class="section-heading"><div><p class="card-kicker">Configuração simples</p><h2>Escolha o que você quer conectar</h2><p class="integration-guide-help">Cada conexão tem uma finalidade. Abra a tela certa e preencha somente os dados necessários; chaves ficam protegidas no servidor.</p></div><a class="compact-action" href="#configuracoes">Voltar para configurações</a></div><div class="integration-guide-grid">${integrationGuide.map(([title, subtitle, href, text]) => `<article class="integration-guide-card"><div><strong>${title}</strong><small>${subtitle}</small><p>${text}</p></div><a class="compact-action" href="${href}" data-integration-guide-link="${title}">${title === "WhatsApp" ? "Abrir conexão" : "Configurar"}</a></article>`).join("")}</div>`;
  anchor.before(guide);
}

const integrationGuideObserver = new MutationObserver(drawIntegrationGuide);
integrationGuideObserver.observe(dashboardGrid, { childList: true, subtree: true });
window.addEventListener("hashchange", () => { if (location.hash === "#integracoes") setTimeout(drawIntegrationGuide, 0); });
setTimeout(drawIntegrationGuide, 0);
