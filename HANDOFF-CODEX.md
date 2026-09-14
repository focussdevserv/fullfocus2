# Handoff para o Codex — FullFocuss (FocusDev)

Estado em 2026-09-14 ~02:15 (horário local). Produção: https://focussapp-focussapp-api.fcoipz.easypanel.host (deploy automático a cada push em `origin/main`; a imagem Docker copia diretórios explicitamente — veja `Dockerfile`).

## O que já está COMPLETO (não refazer)
Início, Agenda, Tarefas, Caixa de entrada/Conversas, CRM (hub, leads, funil, oportunidades, campanhas, propostas com itens, follow-ups), WhatsApp (Evolution API: QR, status, envio, webhook → caixa de entrada), e-mail transacional (Resend: reset de senha, convites). Núcleo: login/registro/reset, roteamento por hash, dialog de criação, kit de UI.

## O que FALTA (um worker por módulo, arquivos disjuntos)
| Módulo | Telas | Arquivos que o worker possui |
| --- | --- | --- |
| contas | Contatos, Empresas, Clientes, Consulta CNPJ, Portal do cliente | `modules/contas.js`, `modules/contas.css`, `server/routes/contas.js`, `server/routes/contas.test.js`, `server/migrations/03x_contas_*.sql` |
| operacao | Contratos, Projetos, Arquivos, Tickets | `modules/operacao.*`, `server/routes/operacao.js`, `server/routes/operacao.test.js`, `server/migrations/04x_*` |
| financeiro | Visão, Receitas, Despesas, Contas a receber, Cobranças, Assinaturas, Relatórios | `modules/financeiro.*`, `server/routes/financeiro.js`, `server/routes/financeiro.test.js`, `server/migrations/05x_*` |
| catalogo | Catálogo | `modules/catalogo.*`, `server/routes/catalogo.js`, `server/routes/catalogo.test.js`, `server/migrations/06x_*` |
| automacoes | Automações, Templates, Integrações | `modules/automacoes.*`, `server/routes/automacoes.js`, `server/routes/automacoes.test.js`, `server/migrations/07x_*` |
| configuracoes | Equipe, Configurações | `modules/configuracoes.*`, `server/routes/configuracoes.js`, `server/routes/configuracoes.test.js`, `server/migrations/08x_*` |

Essas telas hoje "funcionam" mas são rasas (feitas em uma onda anterior sem o kit de UI). "Completo" = o padrão das telas prontas: dados reais, KPIs no topo, busca + filtros, tabela com ações, formulário em modal com validação, painel lateral de detalhes, estados vazio/erro/carregando, confirmação inline, toast, CSV quando fizer sentido, sem `window.alert/confirm`.

## Arquitetura (resumo)
- `index.html` carrega `app.js` (núcleo, script clássico), `ui.js` (kit, clássico) e depois `modules/<area>.js` como `<script type="module">` (escopo próprio; helpers do núcleo são globais).
- Cada módulo registra suas telas: `registerRoutes({ chave: render }, { parent: "#item-do-menu", titles: { chave: "Título" } })`.
- Helpers globais: `dashboardGrid` (container da tela), `api(path, { method, body })` (fetch same-origin JSON; lança `Error` com `.status`), `stateBlock.loading/empty/error`, `escapeHtml`, `openCreateDialog(kind)` + `createConfig`, `renderHashRoute(hash)`, `routeRenderers`.
- Backend: `server/index.js` (sessão por cookie, `tenant(req,res)` → organization_id, CRUD genérico `/api/<tabela>` para contacts, companies, leads, opportunities, clients, contracts, projects, tasks, revenues, expenses, receivables, charges, payments; DTO `{tabela:[...]}` / `{singular:{...}}`). Rotas específicas em `server/routes/<area>.js` → `export function register(app, ctx)`; `ctx = { pool, tenant, requireAuth, asText, classifyDbError, singular, validateRelations, normalize, entities, hashPassword, verifyPassword, signSession, sessionCookie }`. Toda query filtra por `organization_id`. Erros de entrada → 400 pt-BR (`classifyDbError`). Papéis: leia `select role from users where id=$1 and organization_id=$2` (owner/admin/member).
- Banco: nunca edite `server/schema.sql`; crie `server/migrations/NNN_<area>_<desc>.sql` (faixas em `server/migrations/README.md`), idempotente, com `organization_id` e índice. Aplicado no boot por `server/migrate.js`.

## Kit de UI (`ui.js`, global `ui`) — use em TODAS as telas
`ui.esc, ui.money, ui.number, ui.date, ui.dateTime, ui.relative, ui.plural, ui.initials, ui.toLocalInput, ui.toDateInput`
- `ui.header({ kicker, title, description, actions })` → cabeçalho; `ui.button({ label, attr, kind: "primary"|"secondary" })`
- `ui.stats([{ label, value, note, tone: "green"|"red"|"orange", attr, active }])` → KPIs (com `attr` viram botões)
- `ui.toolbar({ search: { value, placeholder }, filters: [{ key, value, options: [[v, label]] }], actions, extra })` → busca `[data-search]`, filtros `[data-filter=key]`
- `ui.table({ columns: [{ key, label, render(row), align, hideOnNarrow }], rows, rowAttr(row), rowClass(row), empty })`
- `ui.badge(label, tone)`, `ui.avatar(text, tone)`, `ui.rowActions([{ label, title, attr, danger }])`, `ui.empty({ title, text, cta, attr })`
- `ui.form({ title, subtitle, fields: [{ name, label, type: text|number|date|datetime-local|select|textarea|checkbox|tel|email|url, options, required, value, placeholder, rows, half, help }], values, submitLabel, onSubmit(values), danger: { label, onClick } })` → modal; datetime vira ISO; vazio vira null
- `ui.drawer({ title, subtitle, html, onOpen(body, close) })` → painel lateral; `ui.facts([[k, v]])`
- `ui.confirmInline(buttonEl, { text, onConfirm })`, `ui.toast(msg, "success"|"error"|"info")`, `ui.keepSearchFocus(root)`, `ui.downloadCsv(nome, cabeçalhos, linhas)`
Exemplo completo de uso: `modules/crm.js` (leads/oportunidades/propostas). Exemplo de tela com kanban/drag: `modules/tarefas.js`. Estilos: só em `modules/<area>.css`; use tokens `var(--blue)`, `var(--red)`, `var(--muted)`, `var(--line)`; tema escuro é o padrão.

## Regras de trabalho para cada worker
1. Só edite os arquivos da sua linha na tabela. Não toque em `app.js`, `ui.js`, `index.html`, `styles.css`, `server/index.js`, `server/schema.sql`, `package.json`, `service-worker.js`, `Dockerfile`, nem em outros módulos. Precisa de algo do núcleo? Faça no seu módulo (ex.: expor `window.X`) ou registre a necessidade em `HANDOFF-CODEX.md`.
2. Gates antes de commitar: `npm run check` (todos os arquivos) e `npm test` passando; `grep -n "window.alert\|window.confirm\|renderModulePage" modules/<area>.js` vazio; nada inventado (números vêm da API; vazio mostra estado vazio com CTA).
3. Teste de verdade: suba `DATABASE_URL=... PORT=3999 SESSION_SECRET=<32+ chars> node server/index.js` contra um PostgreSQL local, cadastre um usuário via `POST /api/auth/register`, e exercite cada rota com `curl` (201/200/400/404). Se tiver navegador via Orca (`orca tab create`, `orca eval`, `orca screenshot`), abra a tela e confira os três estados.
4. Commit só dos SEUS arquivos: `git add <seus arquivos> && git commit -m "feat(<area>): ..."` e `git pull --rebase origin main && git push origin main`. Cada push publica em produção — confirme depois com `curl https://focussapp-focussapp-api.fcoipz.easypanel.host/api/health` e uma rota sua com a conta de QA (`qa-claude-1789355619@example.com` / `SenhaQA12345`).
5. Envie `worker_done` com resumo de 3 frases e `--outcome`.

## Segurança já tratada (mantenha)
Papéis lidos do banco a cada pedido; só owner mexe em owner; URLs de saída validadas contra SSRF (`server/outbound-url.js`: `parseOutboundUrl`, `assertSafeOutboundUrl`); chaves mascaradas nas respostas de `/api/integrations`; portal do cliente e webhook do WhatsApp são as únicas rotas públicas além de `/api/auth/*`.

## Variáveis de ambiente (EasyPanel → focussapp-api)
`DATABASE_URL`, `SESSION_SECRET` (≥32), `APP_URL`, `RESEND_API_KEY` + `MAIL_FROM` (domínio focussdev.space pendente de verificação no Resend), `EVOLUTION_API_URL` + `EVOLUTION_API_KEY`. Nunca commitar chaves.

## Pendências conhecidas
- Contatos/Empresas/Clientes: hoje CRUD básico; falta drawer de detalhes com relacionados (contratos, conversas, propostas), importação por CNPJ direto no cadastro, deduplicação por e-mail/telefone.
- Portal do cliente: rota pública existe; falta tela pública amigável (HTML) para o link.
- Financeiro: assinaturas sem geração automática de cobrança; relatórios só resumo mensal.
- Automações: gatilhos não executam de verdade (sem scheduler) — criar `server/automations-runner.js` com `setInterval` + registro em `runs`.
- Configurações: preferências de notificação só em localStorage.
