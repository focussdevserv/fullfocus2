create table if not exists client_portal_links (
  id bigserial primary key,
  organization_id uuid not null references organizations(id),
  client_id bigint not null references clients(id) on delete cascade,
  token_hash text unique not null,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_client_portal_links_org on client_portal_links(organization_id);
alter table contacts add column if not exists company_id bigint references companies(id) on delete set null;
create index if not exists idx_contacts_company on contacts(company_id);
