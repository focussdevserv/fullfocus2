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

const domains = [inbox, crm, contas, operacao, financeiro, catalogo, automacoes, configuracoes, meu_dia, whatsapp];

export function registerDomainRoutes(app, ctx) {
  for (const domain of domains) domain.register(app, ctx);
}
