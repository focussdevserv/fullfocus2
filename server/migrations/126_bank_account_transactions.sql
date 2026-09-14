create table if not exists bank_account_transactions (
  id bigserial primary key,
  organization_id uuid not null references organizations(id) on delete cascade,
  bank_account_id bigint not null references bank_accounts(id) on delete cascade,
  kind text not null check (kind in ('credit','debit')),
  amount numeric(14,2) not null check (amount > 0),
  description text not null,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists idx_bank_account_transactions_account on bank_account_transactions(organization_id, bank_account_id, occurred_at desc);
