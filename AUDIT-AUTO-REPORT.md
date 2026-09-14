# Auditoria independente — FullFocuss

**Data:** 13/09/2026  
**Escopo:** implementação atual após as mudanças de auth, tenant, eventos, Docker e leads. Inspeção estática do repositório e checks locais; nenhum arquivo de produto foi alterado.

## Resultado executivo

`npm test` passou com 8 testes e `npm run check` passou (sintaxe de `app.js`, `server/index.js` e `server/recurrence.js`). A autenticação/isolamento básico agora existe no backend, mas o produto ainda mistura um núcleo persistido (tasks/events e CRUD genérico) com telas demonstrativas: CRM avançado, operações e financeiro continuam exibindo dados fixos e ações que apenas mostram alertas. Não foi possível validar HTTP/SQL contra PostgreSQL local porque não há banco/credenciais configurados para um ambiente isolado.

## Achados priorizados

### P1 — reset de senha promete uma ação que não existe

O formulário aceita qualquer e-mail, aguarda uma latência artificial e afirma que o link foi enviado (`app.js:321-337`); não há endpoint de reset, token, expiração ou envio. Isso é um fluxo de autenticação funcionalmente falso e precisa ser implementado ou explicitamente desabilitado antes de aceite.

### P1 — a maior parte das telas continua stale/mock apesar do CRUD do backend

`operationsModules` contém linhas, métricas e texto de “workspace sincronizado” hard-coded (`app.js:476-488`), e os botões Novo/Exportar somente chamam `alert` (`app.js:660-670`). As telas financeiras usam `financeRows`/métricas constantes (`app.js:672-704`), enquanto o servidor já expõe entidades `revenues`, `expenses`, `receivables`, `charges` e `payments` (`server/index.js:48-64`). CRM tem arrays locais e apenas a criação de lead chama API (`app.js:581-658`); refresh/nova sessão perde filtros e alterações.

### P1 — navegação por URL não reage a back/forward

Os listeners renderizam apenas no `click` dos links (`app.js:418-428`) e não existe listener `hashchange`. Abrir um hash diretamente recebe apenas o clique inicial (`app.js:905-907`); depois de navegar e usar Back/Forward, o hash e o conteúdo podem divergir. Adicionar teste smoke para cada rota e para histórico do navegador.

### P1 — migrations/DDL ainda executam no boot da aplicação

`start()` lê e executa todo `schema.sql` antes de abrir o listener (`server/index.js:73-74`). O arquivo ainda contém seed da organização default e updates de dados antigos (`server/schema.sql:7-16`, `31-40`, `58-67` etc.). Isso acopla deploy a privilégio DDL, alonga/fragiliza startup e não oferece versão, rollback ou observabilidade de migração; separar migration runner versionado e seed de desenvolvimento.

### P2 — contrato de resposta plural→singular está quebrado para palavras irregulares

O CRUD calcula a chave de retorno com `table.slice(0, -1)` (`server/index.js:60`, `63`). Assim `companies` retorna `companie` e `opportunities` retorna `opportunitie`, em vez de `company`/`opportunity`; clientes que consumirem o DTO documentado não conseguem desserializar corretamente. Usar mapa explícito e testes de contrato para todas as entidades.

### P2 — validação de valores diverge do schema e erros de input viram 503

`normalize()` exige `amount()` estritamente maior que zero (`server/index.js:23`, `56`), mas `opportunities.amount` e `contracts.value` aceitam zero no SQL (`server/schema.sql:37`, `47`). Status, prioridade e `progress` também dependem de constraint do banco; violações caem no catch genérico e retornam 503 (`server/index.js:63`) em vez de 400. Centralizar schemas de entrada, alinhar limites e classificar erros de constraint.

### P2 — metadados `updated_at` não acompanham edições

Quase todas as tabelas têm `updated_at` (`server/schema.sql:18-24`, `26-35`, `37-54`), mas o update genérico apenas grava os campos enviados e não atualiza `updated_at` (`server/index.js:63`); também não há trigger. Ordenação/“última atualização” ficarão incorretas para CRM e operação.

### P2 — dados visíveis ainda apresentam corrupção de encoding

Strings do app, API e manifest aparecem como `Ã`, `Â` e `â` em várias linhas (`app.js:43-46`, `index.html:215-284`, `server/index.js:20-46`, `manifest.webmanifest:2`). Isso afeta legibilidade, labels e possivelmente exportações; adicionar verificação UTF-8/acentos ao CI após normalizar os arquivos.

### P2 — cobertura de aceite insuficiente

Os 8 testes atuais cobrem apenas domínio CRM/recorrência (`server/*.test.js`); `npm run check` só faz parse sintático (`package.json`). Não há lint, build, testes HTTP de sessão/tenant/CRUD, contrato de payload, reset, autorização negativa, persistência frontend, smoke de todas as rotas, nem teste de Docker/Postgres isolado.

## Recomendada próxima onda

1. Fechar contrato e segurança operacional: migration runner versionado, schemas de entrada/erros 4xx, DTOs explícitos, `updated_at`, rate-limit de login e testes HTTP com Postgres isolado.
2. Transformar tasks/events/dashboard em slice de aceite completo: hashchange, estados de erro/vazio, timezone/recorrência, e testes de browser autenticado.
3. Escolher um único vertical CRM (companies/contacts/leads/opportunities) e trocar arrays/alerts por GET/listagem, filtros, mutações persistidas e testes; marcar os demais módulos como “em breve” até possuírem backend.
4. Implementar reset real e depois conectar financeiro/operations às tabelas existentes, removendo números fixos e aceitando somente ações persistidas.

## Comandos executados

- `npm test` — PASS, 8/8.
- `npm run check` — PASS.
- Sem integração PostgreSQL: nenhum banco isolado disponível no repositório.
