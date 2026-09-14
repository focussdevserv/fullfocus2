alter table deliveries add column if not exists public_token_hash text;
alter table deliveries add column if not exists public_token_created_at timestamptz;
alter table deliveries add column if not exists client_approved_at timestamptz;
alter table deliveries add column if not exists client_approval_data jsonb not null default '{}';
create unique index if not exists idx_deliveries_public_token_hash on deliveries(public_token_hash) where public_token_hash is not null;
