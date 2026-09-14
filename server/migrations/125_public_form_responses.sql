alter table forms add column if not exists responses jsonb not null default '[]'::jsonb;
alter table forms add column if not exists submitted_at timestamptz;
