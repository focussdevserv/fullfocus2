# Auditoria arquitetural — FullFocuss / FocusDev

**Data:** 13/09/2026  
**Escopo:** repositório `fullfocus-audit` (somente leitura do código; nenhum arquivo de produto foi alterado e nenhuma dependência foi instalada).  
**Validação executada:** `npm run check` — **PASS** (exit 0): `node --check app.js`, `server/index.js` e `server/recurrence.js`. Não foi executado teste de integração contra PostgreSQL porque não há instância/credenciais disponíveis no repositório.

## Sumário executivo

O projeto é um SPA vanilla em `index.html`/`app.js`, servido pelo Express e apoiado por PostgreSQL. Há um núcleo funcional parcial para autenticação, dashboard, tarefas, eventos/agenda, leads, receitas e projetos; a maior parte da navegação, CRM avançado, relacionamento, operações e financeiro é uma camada visual com arrays hard-coded e botões de demonstração.

O fluxo mais crítico está quebrado no limite de autenticação: o login retorna um usuário, mas não cria cookie/JWT nem há middleware de autenticação; a sessão fica apenas em `localStorage` e todas as APIs aceitam chamadas anônimas. Em consequência, o “workspace” não é isolado por usuário/empresa e qualquer cliente que conheça a API pode ler ou alterar dados.

Também existe divergência entre telas e backend: entidades persistidas não têm GET/PATCH/DELETE completos, as telas principais não recarregam dados reais, campos enviados são ignorados em alguns PATCHes, e módulos exibidos como CRM/financeiro/portal não possuem entidades ou APIs correspondentes.

## Mapa de arquivos

| Arquivo | Responsabilidade observada | Situação |
|---|---|---|
| `index.html` | Shell de login, registro, reset visual, sidebar, dashboard inicial e links para dezenas de módulos | Muitas métricas/listas iniciais são conteúdo estático; “esqueci a senha” não tem API |
| `app.js` | SPA, navegação por hash, formulários, fetches, renderização das telas e mocks | 777 linhas; mistura domínio real com mock/UI demo e sessão client-side |
| `styles.css` | Estilos e responsividade | Sem problema sintático auditado; não substitui lacunas funcionais |
| `server/index.js` | Express, CORS, JSON, schema bootstrap, autenticação e APIs | 141 linhas; sem autenticação/autorização de requisições |
| `server/schema.sql` | DDL, alterações incrementais e seed | Tabelas mínimas; seed global e sem tenant/user ownership |
| `server/recurrence.js` | Expansão diária/semanal/mensal de eventos | Lógica isolada e coberta por `server/recurrence.test.js` |
| `server/recurrence.test.js` | 3 testes unitários de recorrência | Não cobre HTTP, banco, auth ou telas |
| `service-worker.js` | Cache shell offline; ignora `/api/` | Cache-first/fallback de arquivos pode servir UI antiga |
| `manifest.webmanifest` | Metadados PWA e ícones | Sem impacto no domínio; conteúdo mostra sinais de encoding quebrado |
| `Dockerfile` | Imagem Node 22 Alpine e start do Express | `npm install` no build sem lockfile; não inclui Postgres/migrations separados |
| `.env.example` | `PORT`, `DATABASE_URL`, `DATABASE_SSL` | Segredo é placeholder, mas não há documentação de migração/rotação |
| `assets/` | Imagens/ícones Spider-Man e ilustrações | Conteúdo de marca/demo; revisar licenciamento antes de produção |
| `package.json` | Scripts `start`, `test`, `check`; Express 5, pg, cors, dotenv | Não há lint, cobertura, integração, migração ou build |

## Stack e fluxo técnico

- Frontend: HTML/CSS/JavaScript sem framework, renderização manual, hash routing e `fetch`.
- Backend: Node.js 22, Express 5, `pg`, `cors`, `dotenv`; serve o mesmo diretório como estático.
- Banco: PostgreSQL; `server/index.js` executa todo `schema.sql` no startup antes de `listen`.
- PWA: service worker faz cache/rede para recursos GET, mas deliberadamente não cacheia APIs.
- Deploy: Dockerfile único; depende de um PostgreSQL externo via `DATABASE_URL`.

## Rotas de frontend

Os links da sidebar em `index.html` incluem: `inicio`, `agenda`, `tarefas`, `caixa-de-entrada`, `crm`, `conversas`, `contatos`, `consulta-cnpj`, `clientes`, `portal-do-cliente`, `empresas`, `contratos`, `projetos`, `arquivos`, `tickets`, `visao-financeira`, `receitas`, `contas-a-receber`, `despesas`, `cobrancas`, `assinaturas`, `relatorios`, `catalogo`, `automacoes`, `templates`, `integracoes`, `equipe` e `configuracoes` (aprox. `index.html:212-265`).

Implementações com API ou estado real:

- `#agenda`: GET/POST/PATCH/DELETE de eventos, recorrência e arrastar/mover (`app.js:514-550`).
- `#tarefas`: GET/POST/PATCH/DELETE, detalhe, subtarefa, lista/kanban (`app.js:492-511`).
- Dashboard: `/api/dashboard`, `/api/tasks`, `/api/events` (`app.js:196-223`).
- `#crm` agrega subrotas, mas somente o botão de novo lead efetivamente grava (`app.js:629-634`).
- Login/registro: POST `/api/auth/login` e `/api/auth/register`; reset não possui endpoint (`app.js:90-105`, `app.js:283-327`).

Implementações predominantemente mock:

- Leads, campanhas, funil, oportunidades, propostas e follow-ups geram arrays locais em cada render (`app.js:581-634`); exceto criação de lead, filtros/ações não persistem.
- Conversas, contatos, clientes, portal, empresas e CNPJ usam arrays HTML/`data-toast`; CNPJ explicita “resposta simulada local” (`app.js:690-781`).
- Contratos, projetos, arquivos, tickets, relatórios, catálogo, automações, templates, integrações, equipe e configurações usam `operationsModules` com rows fixas e alertas (`app.js:471-483`, `636-646`).
- Financeiro/receitas/despesas/contas a receber/cobranças/assinaturas usa `financeRows` e números fixos; o botão “nova receita” não está ligado ao diálogo em várias telas (`app.js:648-689`).

## APIs e entidades

| Endpoint | Persistência | Observações |
|---|---|---|
| `POST /api/auth/register` | `users` | Hash scrypt; retorna usuário, mas não sessão/token |
| `POST /api/auth/login` | `users` | Verifica hash; resposta sem cookie/JWT |
| `GET /api/health` | DB | Expõe `error.message` de banco na resposta de falha |
| `GET /api/dashboard` | `tasks`, `leads`, `projects`, `revenues` | Agregados globais, sem usuário/tenant |
| `POST/GET/PATCH/DELETE /api/tasks` | `tasks` | PATCH comum atualiza apenas status; `title`/`priority` calculados e ignorados |
| `PATCH /api/tasks/:id/details` | `tasks` | Edita título/prioridade/tags/prazo; sem validação de parentId/ownership |
| `POST /api/leads` | `leads` | Não há GET/PATCH/DELETE |
| `POST /api/revenues` | `revenues` | Não há GET/PATCH/DELETE; `paid` usa data do servidor |
| `POST /api/projects` | `projects` | Não há GET/PATCH/DELETE; dashboard só conta projetos |
| `POST/GET/PATCH/DELETE /api/events` | `events` | PATCH simples só move data; `/schedule` atualiza tudo |
| `PATCH /api/events/:id/details` | `events` | Calcula recurrence/reminder mas SQL atualiza apenas título/data/descrição |

`schema.sql` cria `tasks`, `leads`, `projects`, `revenues`, `users` e `events` (`server/schema.sql:1-14`). Faltam entidades para workspace/tenant, membros e papéis, contatos, empresas, oportunidades/estágios, propostas, clientes, mensagens, arquivos, tickets, contratos, despesas, contas a receber, cobranças, assinaturas, integrações e auditoria.

## Dados fake e botões sem comportamento

Há dados fake no HTML inicial: métricas “R$ 48.240”, 128 leads, 24 tarefas, 12 projetos, prioridades, atividade e agenda (`index.html:305-322`). `syncDashboard` atualiza apenas os números; a lista inicial só é substituída por tarefas/eventos quando o refresh consegue carregar a API.

Achados representativos:

- Botões “Ver prioridades”, “Como funciona”, “Ver tudo”, ação rápida inicial, criar evento do card e notificações são visuais ou não têm fluxo completo (`index.html:305-322`).
- Operações “+ Novo”, “Exportar” apenas exibem `alert` (`app.js:640-646`); filtros só filtram arrays locais.
- CNPJ sempre retorna Acme para 14 dígitos, sem chamada externa (`app.js:759-780`).
- Conversas, mensagens e contatos alteram apenas arrays em memória; recarregar a página perde mudanças (`app.js:552-578`, `app.js:749-758`).
- Ações de customer/portal mostram toast, sem persistência (`app.js:772-780`).
- Reset de senha tem formulário visual, mas não existe POST `/api/auth/reset`.

## Segurança, confiabilidade e qualidade

### Críticos / altos

1. **P0 — ausência de autorização e isolamento de dados.** Login não emite credencial; todas as rotas de domínio são públicas. IDs sequenciais podem ser enumerados e tarefas/eventos podem ser lidos, criados, editados ou excluídos por qualquer cliente (`server/index.js:20-141`). Adicionar sessão segura, middleware, ownership/tenant em cada tabela, RBAC e testes negativos antes de produção.
2. **P0 — bootstrap destrutivo/indiscriminado em runtime.** Executar DDL/seed no start (`server/index.js:127-138`) acopla deploy à migração, não tem versionamento/rollback e seed “where not exists” é global. Separar migrations idempotentes versionadas e job de seed de desenvolvimento.
3. **P1 — CORS aberto.** `app.use(cors())` aceita qualquer origem (`server/index.js:13`); restringir allowlist, credenciais e headers conforme o modelo de sessão.
4. **P1 — vazamento de detalhes internos.** Várias respostas retornam `error.message`/`detail` do PostgreSQL e `/api/health` expõe erro (`server/index.js:40-41`, demais catch). Logar no servidor com correlation id e devolver erro genérico.
5. **P1 — sessão insegura e logout incompleto.** Dados de sessão em `localStorage` são acessíveis a qualquer XSS e não há revogação/expiração. Usar cookie HttpOnly, Secure, SameSite, expiração e proteção CSRF se cookie.
6. **P1 — validação e integridade incompletas.** IDs, datas, `parentId`, limites e relacionamentos não são validados; `status`/`priority` têm defaults silenciosos; `events.reminder_minutes` aceita negativos. Adotar schemas de entrada e constraints/índices.

### Médios

7. **P2 — contrato frontend/backend divergente.** `PATCH /tasks/:id` calcula título/prioridade e descarta ambos; `/events/:id/details` calcula recurrence/reminder e descarta ambos (`server/index.js:68-71`, `108-110`). Padronizar DTOs e testes de contrato.
8. **P2 — erros de encoding.** Strings exibidas no código aparecem como `Ã`, `Â` e `â` em HTML/JS/erros (`server/index.js`, `app.js`, `manifest.webmanifest`). Corrigir encoding UTF-8 e adicionar verificação no CI.
9. **P2 — observabilidade/testes insuficientes.** Só há três testes unitários de recorrência; sem testes HTTP, auth, banco, autorização, frontend ou smoke de rotas. `npm run check` valida apenas sintaxe.
10. **P2 — cache e deploy.** Service worker usa cache de shell com versões manuais (`service-worker.js:1-11`), podendo manter HTML/JS incompatíveis; Docker instala sem lockfile (`Dockerfile:1-8`). Gerar lockfile, cache bust automático e smoke pós-deploy.

## Fluxo ponta a ponta quebrado

1. Usuário abre `/`: shell visual funciona e `restoreSession` consulta apenas `localStorage` (`app.js:185-194`).
2. Registro/login fala com API e cria/lê usuário, mas não cria sessão no servidor nem token. O cliente grava o objeto do usuário no browser.
3. Usuário navega para dashboard; `/api/dashboard`, `/api/tasks` e `/api/events` são chamados sem `Authorization` ou cookie. O backend não sabe quem é o usuário e retorna dados globais.
4. Usuário cria uma tarefa/lead/receita/projeto/evento; algumas gravações persistem globalmente, outras telas continuam mostrando arrays fake. Outro usuário pode ver/alterar a mesma linha.
5. Edição de tarefas/eventos aparenta funcionar, porém alguns campos são silenciosamente descartados pelo SQL; recorrências são calculadas em memória e não têm regra de timezone/limite por série.
6. Ao usar CRM avançado, financeiro, portal ou operações, a UI apresenta sucesso/alerta e filtros locais, mas não há API/entidade para salvar o resultado. Refresh perde o estado.
7. Logout remove `localStorage` somente; não revoga credencial porque nenhuma existe, e chamadas diretas continuam autorizadas.

## Plano de ondas

### Onda 0 — contenção e contrato (P0/P1)

- Congelar o conjunto de módulos demonstrativos e marcar explicitamente “demo” onde não houver backend.
- Definir modelo de workspace/tenant, usuário, membership, papéis e política de ownership.
- Escolher cookie HttpOnly ou tokens curtos + refresh; implementar middleware, CORS allowlist, rate limit, headers de segurança e erros sanitizados.
- Criar migrations versionadas, índices, constraints e ambiente de integração PostgreSQL.

### Onda 1 — núcleo confiável (tarefas, agenda, dashboard)

- Migrar todos os dados para `workspace_id`/`created_by`, completar CRUD e DTOs.
- Corrigir PATCHs que descartam campos; validar com schema; definir timezone, recorrência, reminders e exclusão/edição de série.
- Substituir seeds globais por fixture de desenvolvimento; dashboard calculado por workspace.
- Testes de integração HTTP + PostgreSQL, autorização por recurso e smoke das rotas de navegação.

### Onda 2 — CRM e relacionamento

- Modelar companies, contacts, leads/opportunities, stages, activities, messages, proposals e follow-ups.
- Implementar GET/listagem/paginação, filtros server-side, mutações e auditoria; trocar arrays e toasts por estados persistidos.
- Integrar/validar consulta CNPJ com provedor, limites, cache e consentimento; portal do cliente com identidade e permissões próprias.

### Onda 3 — projetos, arquivos e atendimento

- Projetos, contratos, arquivos, tickets, clientes, aprovações, comentários, anexos e SLA com storage seguro e antivírus.
- Implementar upload assinado, controle de acesso, notificações e trilha de auditoria.

### Onda 4 — financeiro e produção

- Entidades de despesas, recebíveis, cobranças, assinaturas, conciliação, relatórios e integrações; valores/ledger com precisão e idempotência.
- Observabilidade (logs estruturados, métricas, tracing, alertas), backups/restore, migrações no CI/CD, CSP, DAST e testes de carga.
- Remover dados fake, validar todas as telas/ações, revisar licença dos assets Spider-Man e fazer aceite funcional ponta a ponta.

## Critério de pronto sugerido

Nenhuma rota de domínio responde sem contexto autorizado; cada botão de criação/edição/exclusão tem API persistente, feedback de erro e teste; dashboard e todas as listagens são filtrados por workspace; migrations são reproduzíveis; CI executa sintaxe, unitários, integração, autorização e smoke; uma reinstalação limpa não depende de seed global nem de estado local do browser.

