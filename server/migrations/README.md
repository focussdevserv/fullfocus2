# Migrations

Um arquivo `.sql` por mudança, aplicado uma única vez em ordem de nome pelo
`server/migrate.js` no boot (depois do baseline `schema.sql`).

Convenção de nome: `NNN_<dominio>_<descricao>.sql` (ex.: `010_inbox_conversas.sql`).
Faixas reservadas por domínio para evitar colisão de número entre workers:

| Domínio       | Faixa   |
| ------------- | ------- |
| meu-dia       | 001-009 |
| inbox         | 010-019 |
| crm           | 020-029 |
| contas        | 030-039 |
| operacao      | 040-049 |
| financeiro    | 050-059 |
| catalogo      | 060-069 |
| automacoes    | 070-079 |
| configuracoes | 080-089 |

Use `create table if not exists` / `add column if not exists` para manter idempotência.
Toda tabela de produto precisa de `organization_id uuid not null references organizations(id)` e índice por organização.
