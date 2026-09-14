create extension if not exists pgcrypto;

create table if not exists organizations (
  id uuid primary key default gen_random_uuid(), name text not null check (length(trim(name)) > 0),
  created_at timestamptz not null default now()
);
-- Stable internal tenant used only when a legacy client does not send a tenant header.
insert into organizations (id, name) values ('00000000-0000-0000-0000-000000000001', 'Default organization') on conflict (id) do nothing;

create table if not exists users (
  id uuid primary key default gen_random_uuid(), name text not null, email text not null unique,
  password_hash text not null, organization_id uuid not null references organizations(id), created_at timestamptz not null default now()
);
alter table users add column if not exists organization_id uuid;
update users set organization_id = '00000000-0000-0000-0000-000000000001' where organization_id is null;
alter table users alter column organization_id set not null;

create table if not exists contacts (
  id bigserial primary key, organization_id uuid not null references organizations(id), name text not null,
  email text, phone text, role text, notes text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists companies (
  id bigserial primary key, organization_id uuid not null references organizations(id), name text not null,
  document text, email text, phone text, website text, address text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists leads (
  id bigserial primary key, organization_id uuid not null references organizations(id), name text not null, company text,
  company_id bigint references companies(id) on delete set null, contact_id bigint references contacts(id) on delete set null,
  email text, phone text, source text, status text not null default 'new' check (status in ('new','contacted','qualified','proposal','won','lost')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table leads add column if not exists organization_id uuid;
update leads set organization_id = '00000000-0000-0000-0000-000000000001' where organization_id is null;
alter table leads alter column organization_id set not null;
alter table leads add column if not exists company_id bigint references companies(id) on delete set null;
alter table leads add column if not exists contact_id bigint references contacts(id) on delete set null;
alter table leads add column if not exists email text;
alter table leads add column if not exists phone text;
alter table leads add column if not exists source text;
alter table leads add column if not exists updated_at timestamptz not null default now();

create table if not exists opportunities (
  id bigserial primary key, organization_id uuid not null references organizations(id), lead_id bigint references leads(id) on delete set null,
  company_id bigint references companies(id) on delete set null, name text not null, stage text not null default 'qualification',
  amount numeric(14,2) not null default 0 check (amount >= 0), expected_close date, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists clients (
  id bigserial primary key, organization_id uuid not null references organizations(id), company_id bigint references companies(id) on delete set null,
  contact_id bigint references contacts(id) on delete set null, name text not null, email text, phone text, status text not null default 'active',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists contracts (
  id bigserial primary key, organization_id uuid not null references organizations(id), client_id bigint not null references clients(id) on delete cascade,
  opportunity_id bigint references opportunities(id) on delete set null, name text not null, status text not null default 'draft' check (status in ('draft','active','paused','completed','cancelled')),
  value numeric(14,2) not null default 0 check (value >= 0), starts_on date, ends_on date, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists projects (
  id bigserial primary key, organization_id uuid not null references organizations(id), contract_id bigint references contracts(id) on delete set null,
  client_id bigint references clients(id) on delete set null, name text not null, status text not null default 'active', progress smallint not null default 0 check (progress between 0 and 100), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table projects add column if not exists organization_id uuid;
update projects set organization_id = '00000000-0000-0000-0000-000000000001' where organization_id is null;
alter table projects alter column organization_id set not null;
alter table projects add column if not exists contract_id bigint references contracts(id) on delete set null;
alter table projects add column if not exists client_id bigint references clients(id) on delete set null;
alter table projects add column if not exists updated_at timestamptz not null default now();

create table if not exists tasks (
  id bigserial primary key, organization_id uuid not null references organizations(id), project_id bigint references projects(id) on delete cascade,
  title text not null, status text not null default 'todo', priority text not null default 'medium' check (priority in ('low','medium','high')),
  due_at timestamptz, tags text[] not null default '{}', parent_id bigint references tasks(id) on delete cascade, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table tasks add column if not exists organization_id uuid;
update tasks set organization_id = '00000000-0000-0000-0000-000000000001' where organization_id is null;
alter table tasks alter column organization_id set not null;
alter table tasks add column if not exists project_id bigint references projects(id) on delete cascade;
alter table tasks add column if not exists updated_at timestamptz not null default now();

create table if not exists revenues (id bigserial primary key, organization_id uuid not null references organizations(id), contract_id bigint references contracts(id) on delete set null, description text not null, amount numeric(14,2) not null check (amount > 0), due_at timestamptz, paid_at timestamptz, created_at timestamptz not null default now());
alter table revenues add column if not exists organization_id uuid;
update revenues set organization_id = '00000000-0000-0000-0000-000000000001' where organization_id is null;
alter table revenues alter column organization_id set not null;
alter table revenues add column if not exists contract_id bigint references contracts(id) on delete set null;
create table if not exists expenses (id bigserial primary key, organization_id uuid not null references organizations(id), project_id bigint references projects(id) on delete set null, description text not null, amount numeric(14,2) not null check (amount > 0), due_at timestamptz, paid_at timestamptz, created_at timestamptz not null default now());
create table if not exists receivables (id bigserial primary key, organization_id uuid not null references organizations(id), client_id bigint references clients(id) on delete set null, contract_id bigint references contracts(id) on delete set null, description text not null, amount numeric(14,2) not null check (amount > 0), due_at date not null, status text not null default 'pending' check (status in ('pending','paid','overdue','cancelled')), paid_at timestamptz, created_at timestamptz not null default now());
create table if not exists charges (id bigserial primary key, organization_id uuid not null references organizations(id), receivable_id bigint references receivables(id) on delete cascade, provider text, external_id text, status text not null default 'pending', amount numeric(14,2) not null check (amount > 0), due_at date, created_at timestamptz not null default now());
create table if not exists payments (id bigserial primary key, organization_id uuid not null references organizations(id), receivable_id bigint references receivables(id) on delete set null, charge_id bigint references charges(id) on delete set null, amount numeric(14,2) not null check (amount > 0), paid_at timestamptz not null default now(), method text, external_id text);
create table if not exists events (id bigserial primary key, organization_id uuid not null references organizations(id), title text not null, starts_at timestamptz not null, description text, recurrence text not null default 'none', reminder_minutes integer not null default 30, created_at timestamptz not null default now());
alter table events add column if not exists organization_id uuid;
update events set organization_id = '00000000-0000-0000-0000-000000000001' where organization_id is null;
alter table events alter column organization_id set not null;

create index if not exists idx_contacts_org on contacts(organization_id); create index if not exists idx_companies_org on companies(organization_id);
create index if not exists idx_leads_org on leads(organization_id); create index if not exists idx_opportunities_org on opportunities(organization_id);
create index if not exists idx_clients_org on clients(organization_id); create index if not exists idx_contracts_org on contracts(organization_id);
create index if not exists idx_projects_org on projects(organization_id); create index if not exists idx_tasks_org on tasks(organization_id);
create index if not exists idx_revenues_org on revenues(organization_id); create index if not exists idx_expenses_org on expenses(organization_id);
create index if not exists idx_receivables_org on receivables(organization_id); create index if not exists idx_charges_org on charges(organization_id); create index if not exists idx_payments_org on payments(organization_id); create index if not exists idx_events_org on events(organization_id);
