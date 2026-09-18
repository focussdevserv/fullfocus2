create table if not exists agent_configs (
  id bigserial primary key,
  organization_id uuid not null unique references organizations(id) on delete cascade,
  name text not null default 'Agente Focussdev',
  system_prompt text not null default '',
  model text not null default 'gpt-5',
  enabled boolean not null default false,
  autonomy_level integer not null default 1 check (autonomy_level between 0 and 4),
  settings jsonb not null default '{}'::jsonb,
  prompt_version text not null default '1.0',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_agent_configs_org on agent_configs(organization_id);
