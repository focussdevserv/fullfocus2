/* Registra as rotas de cada domínio (um arquivo por área do menu). */
import * as inbox from "./inbox.js";
import * as crm from "./crm.js";
import * as contas from "./contas.js";
import * as operacao from "./operacao.js";
import * as financeiro from "./financeiro.js";
import * as catalogo from "./catalogo.js";
import * as automacoes from "./automacoes.js";
import * as configuracoes from "./configuracoes.js";
import * as meu_dia from "./meu-dia.js";
import * as whatsapp from "./whatsapp.js";
import * as email from "./email.js";
import * as teamAccess from "./team-access.js";
import * as projectWorkspace from "./project-workspace.js";
import * as notifications from "./notifications.js";
import * as vault from "./vault.js";
import * as portalNotificationHooks from "./portal-notification-hooks.js";

const domains = [inbox, notifications, vault, portalNotificationHooks, crm, contas, operacao, projectWorkspace, financeiro, catalogo, automacoes, configuracoes, meu_dia, whatsapp, email, teamAccess];

export function registerDomainRoutes(app, ctx) {
  for (const domain of domains) domain.register(app, ctx);
}
