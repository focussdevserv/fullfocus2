# Auditoria atual — FocusDev

Data: 19/09/2026  
Escopo: aplicação web local em `C:\Users\focussdev\orca\fullfocus2`.

## Evidências executadas

| Verificação | Resultado | Observação |
|---|---|---|
| `npm run check` | OK | 142 arquivos com sintaxe válida. |
| `npm run build` | OK | 53 rotas do menu, referências locais e build estático validados. |
| `npm test` | OK | 168 testes aprovados, 0 falhas. O teste de limite de upload registra um erro HTTP esperado e passa. |
| Navegação com banco/conta reais | PENDENTE | Ainda é necessário executar smoke test no ambiente com PostgreSQL e sessão autenticada. |
| Integrações externas | PENDENTE | Mercado Pago, WhatsApp e e-mail precisam de teste controlado com credenciais reais e webhook configurado. |

Os testes automatizados comprovam sintaxe, contratos e regras cobertas pelos testes; não comprovam, sozinhos, que cada tela renderizada conclui o fluxo UI → API → banco.

## Classificação por domínio

| Domínio | Classificação atual | Evidência / lacuna principal |
|---|---|---|
| Autenticação e usuários | PARCIAL | Há registro, login, cookie de sessão assinado, `/api/auth/me`, logout, expiração e bloqueio. Falta smoke test real de login/expiração e revisão visual de permissões por tela. |
| Multi-tenant e permissões | PARCIAL | Rotas autenticadas usam `organization_id` e há papéis. Falta teste matricial por papel para todas as ações sensíveis. |
| Clientes, contatos e empresas | PARCIAL | CRUD e ficha central existem, com relações e busca. O fluxo unificado cliente + empresa + projeto + proposta ainda precisa de teste ponta a ponta em banco real. |
| Ficha 360 do cliente | PARCIAL | A ficha agrega projetos, contatos, propostas, contratos, cobranças, tarefas, tickets, arquivos, notas e infraestrutura. Falta validar todos os botões e edição a partir da ficha. |
| Leads e CRM | PARCIAL | Existem leads, funil, oportunidades, atividades e conversão relacionada. Falta comprovar o ciclo completo lead → oportunidade → proposta → cliente. |
| Propostas | PARCIAL | Há rotas, tela e relação com clientes/oportunidades. Envio e aceite dependem de validação real do destinatário e persistência do status. |
| Projetos e workspace | PARCIAL | Projetos possuem overview, tarefas, arquivos, entregas, aprovações, alterações, infraestrutura, portal e visão lista/kanban/timeline. Falta smoke test dos vínculos e permissões de portal. |
| Tarefas | FUNCIONAL EM TESTES / PARCIAL EM PRODUÇÃO | API, filtros, subtarefas, status e drag/drop têm cobertura. Ainda falta validar UI com banco e concorrência. |
| Financeiro e cobranças | PARCIAL | Receitas, despesas, contas a receber/pagar, cobranças, assinaturas, PIX e campos Mercado Pago existem. Falta validar idempotência, webhook, baixa automática e reflexão no dashboard. |
| Contratos | PARCIAL | Há autofill a partir de proposta/projeto/cliente e CRUD. Falta validar assinatura, versão, envio e mudança de status com documento real. |
| Agenda | PARCIAL | Eventos, recorrência, atualização e exclusão existem. Falta smoke test de conflito, timezone e lembretes. |
| Arquivos e documentos | PARCIAL | Upload, arquivos de projeto e documentos aparecem na arquitetura. Falta validar permissões, limites e download em cada contexto. |
| Suporte/tickets | PARCIAL | Tickets e triagem existem. Falta validar SLA, handoff, histórico e resolução refletida no cliente/projeto. |
| Notificações e inbox | PARCIAL | Conversas, mensagens, leitura e integração WhatsApp possuem rotas. Falta teste real de envio e recebimento por webhook. |
| Dashboard | PARCIAL | O dashboard consulta `/api/dashboard` e possui loading/erro/atualização; ainda há markup inicial/fallback visual e não há smoke test com dados reais nesta auditoria. |
| Configurações | PARCIAL | A tela e rotas de configurações existem; há histórico de tela travada em “Carregando módulo”. Precisa teste por seção e salvamento real. |
| Integrações | PARCIAL | Existem módulos para WhatsApp, Mercado Pago, webhooks, agente e automações. Conexões externas ainda exigem validação controlada. |
| Agente | PARCIAL | Configuração, autonomia e teste controlado existem. Execução real depende de chave/configuração e permissões. |
| Catálogo/produtos | PARCIAL | Catálogo e produtos existem, mas a auditoria precisa verificar criação, edição, imagem, compartilhamento e ausência de dados fictícios. |
| Automações | PARCIAL | CRUD, templates e histórico de execuções existem. Faltam testes de gatilho, idempotência e retries em ambiente real. |
| Relatórios | VISUAL/PARCIAL | Há telas e endpoints em partes do domínio; é necessário validar origem dos números e exportações contra o banco. |

## Achados de implementação

1. A navegação extensa foi reorganizada para grupos recolhíveis, com persistência local da preferência e abertura automática do grupo da rota atual.
2. O carregamento global possui estados de loading e erro, mas os testes de navegador ainda precisam confirmar que nenhum módulo fica preso em loading após falha de API.
3. O backend possui autenticação e isolamento por organização, porém algumas rotas de domínio precisam ser exercitadas com papéis diferentes, não apenas com o proprietário.
4. A base de dados já possui relações para clientes, leads, oportunidades, projetos, tarefas, contratos, financeiro, agenda, arquivos, portal e integrações; o risco principal atual é fluxo incompleto, não ausência total de tabelas.
5. O dashboard ainda preserva markup inicial para evitar tela vazia durante carregamento. Isso é fallback de UX, não evidência de dados fictícios, mas deve ser conferido no smoke test.
6. Os relatórios históricos `AUDIT-FULLFOCUSS.md` e `AUDIT-AUTO-REPORT.md` não devem ser usados como retrato atual sem revalidação; contêm afirmações anteriores à evolução recente do código.
7. A central de configurações agora carrega somente `configuracoes-hub.js`; implementações antigas permanecem no repositório como histórico, mas não são mais carregadas juntas nem disputam handlers da tela.

## Botões e fluxos que exigem validação manual prioritária

- Criar/editar cliente e empresa a partir da ficha 360.
- Criar projeto, proposta, contrato e cobrança sem cadastro prévio artificialmente obrigatório.
- Ações rápidas da ficha: WhatsApp, e-mail, portal, editar, nova proposta, novo contrato e nova cobrança.
- Conversão de lead para cliente sem duplicidade.
- Criação/edição de projeto e mudança entre lista, quadro e timeline.
- Criação de cobrança, geração de PIX/QR, webhook de pagamento e baixa.
- Configuração de WhatsApp: gerar QR, conectar, desconectar, listar instâncias e exibir estado real.
- Configurações: salvar cada seção e reabrir a tela sem travamento.
- Compartilhamento de propostas, contratos e catálogo por link, e-mail e WhatsApp.

## Ordem de execução recomendada

### P0 — desbloquear operação

1. Smoke test autenticado de login, sessão expirada, logout e autorização por papel.
2. Fluxo único de cliente: dados básicos + empresa opcional + contato + primeiro projeto/oportunidade na mesma ficha.
3. Corrigir qualquer erro de console/API que impeça abrir clientes, configurações, tarefas e projetos.
4. Garantir que estados de erro nunca deixem a tela travada.

### P1 — fechar os fluxos de negócio

1. Lead → oportunidade → proposta → contrato → cliente → projeto.
2. Cliente → cobrança → PIX/Mercado Pago → webhook → pagamento confirmado → dashboard.
3. Projeto → tarefas → arquivos → aprovação → entrega → portal.
4. WhatsApp/e-mail com mensagens e histórico persistidos.

### P2 — escala e acabamento

1. Relatórios exclusivamente derivados do banco.
2. Idempotência e retry de automações/webhooks.
3. Testes matriciais de permissões e auditoria.
4. Otimização de consultas, paginação, cache e bundle somente após medir gargalos reais.

## Próximo slice de implementação

O próximo trabalho deve ser o smoke test funcional autenticado do fluxo de cliente e ficha 360. Ele é a dependência mais importante para propostas, contratos, projetos e cobranças. Só depois de confirmar esse caminho deve-se avançar para integrações financeiras e automações.
## CorreÃ§Ã£o aplicada nesta rodada

- `arquivos` e `tickets` passaram a carregar `operacao.js` antes da prÃ³pria tela, pois reutilizam configuraÃ§Ãµes de criaÃ§Ã£o definidas nesse mÃ³dulo.
- O carregador de mÃ³dulos passou a respeitar a ordem declarada de dependÃªncias, evitando que uma tela dependente seja executada antes do mÃ³dulo-base.
- O fallback de carregamento embutido no `index.html` recebeu a mesma correÃ§Ã£o para deploys em que o loader externo nÃ£o esteja disponÃ­vel.
- VerificaÃ§Ã£o: `npm run check`, `npm run build` e `npm test` aprovados; 168 testes sem falhas.
