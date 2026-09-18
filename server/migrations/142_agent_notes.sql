create table if not exists agent_notes (
  id bigserial primary key,
  organization_id uuid not null references organizations(id) on delete cascade,
  author_user_id uuid references users(id) on delete set null,
  entity_type text,
  entity_id bigint,
  body text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_agent_notes_org_entity on agent_notes(organization_id, entity_type, entity_id, created_at desc);
