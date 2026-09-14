alter table users add column if not exists role text not null default 'member' check (role in ('owner','admin','member'));
alter table organizations add column if not exists settings jsonb not null default '{}'::jsonb;
