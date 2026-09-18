create table if not exists project_portal_settings (
  project_id bigint primary key references projects(id) on delete cascade,
  organization_id uuid not null references organizations(id) on delete cascade,
  show_overview boolean not null default true,
  show_tasks boolean not null default true,
  show_files boolean not null default true,
  show_deliveries boolean not null default true,
  show_approvals boolean not null default true,
  show_changes boolean not null default false,
  show_infrastructure boolean not null default false,
  show_repository boolean not null default false,
  show_hosting boolean not null default false,
  show_finance boolean not null default true,
  show_support boolean not null default true,
  updated_at timestamptz not null default now()
);
create index if not exists project_portal_settings_org_idx on project_portal_settings(organization_id);
