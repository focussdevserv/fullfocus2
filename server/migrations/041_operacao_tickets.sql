create table if not exists tickets (
  id bigserial primary key, organization_id uuid not null references organizations(id),
  title text not null, description text, client_id bigint references clients(id) on delete set null,
  priority text default 'medium' check (priority in ('low','medium','high','urgent')),
  status text default 'open' check (status in ('open','in_progress','waiting','done')),
  due_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists tickets_organization_id_idx on tickets(organization_id);
