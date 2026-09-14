create table if not exists team_invite_events (
  id bigserial primary key,
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists idx_team_invite_events_org_created on team_invite_events(organization_id, created_at desc);
create or replace function record_team_invite_event() returns trigger language plpgsql as $$
begin
  if new.role <> 'owner' then
    insert into team_invite_events (organization_id, user_id) values (new.organization_id, new.id);
  end if;
  return new;
end;
$$;
drop trigger if exists users_team_invite_event on users;
create trigger users_team_invite_event after insert on users for each row execute function record_team_invite_event();
