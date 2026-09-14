alter table proposals add column if not exists public_token_hash text;
alter table proposals add column if not exists public_token_created_at timestamptz;
create unique index if not exists idx_proposals_public_token_hash on proposals(public_token_hash) where public_token_hash is not null;
