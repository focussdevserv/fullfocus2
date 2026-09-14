alter table notifications add column if not exists archived_at timestamptz;
create index if not exists notifications_user_inbox_idx on notifications(organization_id, user_id, archived_at, created_at desc);
