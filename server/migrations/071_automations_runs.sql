create table if not exists automation_runs (
  id bigserial primary key,
  organization_id uuid not null references organizations(id) on delete cascade,
  automation_id bigint not null references automations(id) on delete cascade,
  source_type text not null,
  source_id bigint not null,
  result jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (automation_id, source_type, source_id)
);
create index if not exists automation_runs_organization_id_idx on automation_runs(organization_id);

create table if not exists notifications (
  id bigserial primary key,
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id uuid references users(id) on delete cascade,
  automation_id bigint references automations(id) on delete set null,
  message text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notifications_organization_id_idx on notifications(organization_id, created_at desc);
