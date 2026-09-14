alter table leads add column if not exists owner_id uuid references users(id) on delete set null;
alter table leads add column if not exists tags text[] not null default '{}';
alter table opportunities add column if not exists owner_id uuid references users(id) on delete set null;
alter table opportunities add column if not exists tags text[] not null default '{}';
create index if not exists leads_org_owner_idx on leads(organization_id, owner_id);
create index if not exists opportunities_org_owner_idx on opportunities(organization_id, owner_id);
