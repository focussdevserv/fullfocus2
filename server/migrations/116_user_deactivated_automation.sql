create table if not exists team_access_events (
  id bigserial primary key,
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  access_status text not null check (access_status in ('inactive','blocked')),
  created_at timestamptz not null default now()
);
create index if not exists idx_team_access_events_org_created on team_access_events(organization_id, created_at desc);
alter table automations drop constraint if exists automations_trigger_check;
alter table automations add constraint automations_trigger_check check (trigger in (
  'lead_created','lead_stage_changed','lead_no_response','meeting_scheduled','proposal_created','proposal_sent',
  'proposal_viewed','proposal_approved','contract_signed','project_created','task_due_soon','task_overdue',
  'project_overdue','receivable_due_soon','receivable_overdue','payment_confirmed','payment_overdue','ticket_created',
  'ticket_no_response','customer_message','scheduled_datetime','webhook_received','freelancer_project_finished',
  'project_completed','sale_won','team_member_invited','member_added_to_project','project_member_added','task_assigned',
  'member_overloaded','absence_started','user_deactivated'
));
alter table automations drop constraint if exists automations_action_check;
alter table automations add constraint automations_action_check check (action in (
  'notify','notify_responsible','create_task','send_message','send_email','send_onboarding','create_followup',
  'create_charge','generate_contract','create_project','update_status','move_pipeline','assign_owner','add_tag',
  'webhook','n8n_flow','wait','end','calculate_commission','reassign_support','create_calendar_event',
  'request_satisfaction','generate_document','grant_project_access','revoke_access'
));
