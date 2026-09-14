create table if not exists vault_accesses (
  id bigserial primary key,
  organization_id uuid not null references organizations(id) on delete cascade,
  client_id bigint references clients(id) on delete set null,
  project_id bigint references projects(id) on delete set null,
  name text not null,
  service text not null,
  expires_on date,
  secret_ciphertext text not null,
  secret_iv text not null,
  secret_tag text not null,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists vault_accesses_org_idx on vault_accesses(organization_id, created_at desc);
