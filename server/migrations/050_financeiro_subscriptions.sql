create table if not exists subscriptions (
  id bigserial primary key,
  organization_id uuid not null references organizations(id),
  client_id bigint references clients(id) on delete set null,
  plan text not null,
  amount numeric(14,2) not null check (amount >= 0),
  interval text not null default 'monthly' check (interval in ('monthly','yearly')),
  status text not null default 'active' check (status in ('active','paused','cancelled')),
  next_billing_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_subscriptions_org on subscriptions(organization_id);
