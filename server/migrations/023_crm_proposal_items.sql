-- Itens de proposta (linhas com quantidade e preço), opcionalmente ligados ao catálogo.
create table if not exists proposal_items (
  id bigserial primary key,
  organization_id uuid not null references organizations(id),
  proposal_id bigint not null references proposals(id) on delete cascade,
  catalog_item_id bigint,
  description text not null,
  quantity numeric(12,2) not null default 1 check (quantity > 0),
  unit_price numeric(14,2) not null default 0 check (unit_price >= 0),
  position int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_proposal_items_org on proposal_items(organization_id);
create index if not exists idx_proposal_items_proposal on proposal_items(proposal_id);
alter table proposals add column if not exists sent_at timestamptz;
alter table proposals add column if not exists decided_at timestamptz;
alter table proposals add column if not exists lead_id bigint references leads(id) on delete set null;
alter table opportunities add column if not exists notes text;
alter table opportunities add column if not exists probability int check (probability between 0 and 100);
alter table opportunities add column if not exists contact_id bigint references contacts(id) on delete set null;
alter table leads add column if not exists notes text;
alter table leads add column if not exists value numeric(14,2) check (value >= 0);
alter table leads add column if not exists campaign_id bigint;
