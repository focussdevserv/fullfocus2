alter table users add column if not exists team_role_id bigint references team_roles(id) on delete set null;
create index if not exists idx_users_org_team_role on users(organization_id, team_role_id);
