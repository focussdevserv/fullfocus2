alter table users add column if not exists access_revoked_at timestamptz;
alter table users add column if not exists deactivated_at timestamptz;
