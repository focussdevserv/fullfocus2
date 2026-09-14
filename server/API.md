# FullFocuss API

As rotas de domÃ­nio exigem sessÃ£o autenticada. O login emite o cookie HttpOnly `focus_session`; o contexto da organizaÃ§Ã£o vem da sessÃ£o, e `organization_id` nÃ£o Ã© aceito no corpo. `POST /api/auth/register` e `POST /api/auth/login` sÃ£o pÃºblicos; `GET /api/auth/me` e `POST /api/auth/logout` gerenciam a sessÃ£o. Defina `SESSION_SECRET` forte em ambientes compartilhados.

Todas as entidades pertencem a uma organização. Envie `x-organization-id` (UUID) em cada requisição; para compatibilidade com o cliente legado, a ausência do cabeçalho usa a organização interna `00000000-0000-0000-0000-000000000001`. Nenhuma rota aceita `organization_id` no corpo para evitar que o cliente altere o tenant do registro.

## Rotas

`POST`, `GET` e `PATCH /api/{entidade}` (o patch recebe `/:id`) estão disponíveis para:

- `contacts`: name, email, phone, role, notes
- `companies`: name, document, email, phone, website, address
- `leads`: name, company, company_id, contact_id, email, phone, source, status
- `opportunities`: name, lead_id, company_id, stage, amount, expected_close
- `clients`: name, company_id, contact_id, email, phone, status
- `contracts`: name, client_id, opportunity_id, status, value, starts_on, ends_on
- `projects`: name, contract_id, client_id, status, progress
- `tasks`: title, project_id, status, priority, due_at, tags, parent_id
- `revenues` e `expenses`: description, amount, vínculo, due_at, paid_at
- `receivables`: description, amount, due_at, client_id, contract_id, status, paid_at
- `charges`: amount, receivable_id, provider, external_id, status, due_at
- `payments`: amount, receivable_id, charge_id, paid_at, method, external_id

O fluxo comercial usa as chaves `lead_id`, `opportunity_id`, `client_id`, `contract_id` e `project_id`, preservando a organização em todos os relacionamentos. `GET /api/dashboard`, `GET/POST/PATCH /api/events`, autenticação e `GET /api/health` continuam disponíveis.

O schema em `schema.sql` é idempotente e não insere dados de demonstração. Registros antigos sem tenant são migrados para a organização interna de compatibilidade; novos registros sempre recebem o tenant calculado pelo cabeçalho.
