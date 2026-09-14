create table if not exists satisfaction_requests (
  id bigserial primary key,
  organization_id uuid not null references organizations(id) on delete cascade,
  project_id bigint references projects(id) on delete set null,
  client_id bigint references clients(id) on delete set null,
  token text not null unique,
  status text not null default 'pending' check (status in ('pending','completed','cancelled')),
  rating smallint check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  responded_at timestamptz
);
create index if not exists satisfaction_requests_org_created_idx on satisfaction_requests(organization_id, created_at desc);
