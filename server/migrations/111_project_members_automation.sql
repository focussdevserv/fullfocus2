alter table automations drop constraint if exists automations_trigger_check;
alter table automations add constraint automations_trigger_check check (trigger in (
  'lead_created','lead_stage_changed','lead_no_response','meeting_scheduled',
  'proposal_created','proposal_sent','proposal_viewed','proposal_approved',
  'contract_signed','project_created','task_due_soon','task_overdue',
  'project_overdue','receivable_due_soon','receivable_overdue','payment_confirmed',
  'payment_overdue','ticket_created','ticket_no_response','customer_message',
  'scheduled_datetime','webhook_received','freelancer_project_finished','sale_won',
  'team_member_invited','member_added_to_project','project_member_added'
));
alter table automations drop constraint if exists automations_action_check;
alter table automations add constraint automations_action_check check (action in (
  'notify','create_task','send_message','send_email','send_onboarding','create_followup',
  'create_charge','generate_contract','create_project','update_status','move_pipeline',
  'assign_owner','add_tag','webhook','n8n_flow','wait','end','calculate_commission',
  'reassign_support','create_calendar_event','request_satisfaction','generate_document',
  'grant_project_access'
));
create table if not exists project_members (
  id bigserial primary key,
  organization_id uuid not null references organizations(id) on delete cascade,
  project_id bigint not null references projects(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  access_level text not null default 'member',
  files_visible boolean not null default true,
  tasks_visible boolean not null default true,
  added_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (organization_id, project_id, user_id)
);
create index if not exists idx_project_members_org_added on project_members(organization_id, added_at desc);
