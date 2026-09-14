alter table notifications add column if not exists entity_type text;
alter table notifications add column if not exists entity_id bigint;
create index if not exists notifications_origin_idx on notifications(organization_id, entity_type, entity_id);
