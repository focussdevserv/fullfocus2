alter table contracts add column if not exists public_token_hash text;
alter table contracts add column if not exists public_token_created_at timestamptz;
create unique index if not exists idx_contracts_public_token_hash on contracts(public_token_hash) where public_token_hash is not null;
