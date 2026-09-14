create table if not exists files (
  id bigserial primary key, organization_id uuid not null references organizations(id),
  name text not null, url text not null, kind text, size_bytes bigint,
  project_id bigint references projects(id) on delete set null,
  client_id bigint references clients(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists files_organization_id_idx on files(organization_id);
