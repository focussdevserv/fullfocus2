create table if not exists followups (id bigserial primary key, organization_id uuid not null references organizations(id), lead_id bigint not null references leads(id) on delete cascade, due_at timestamptz not null, channel text, note text, done_at timestamptz, created_at timestamptz not null default now());
create index if not exists followups_organization_id_idx on followups(organization_id);
