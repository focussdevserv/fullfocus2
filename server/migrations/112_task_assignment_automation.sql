alter table automations drop constraint if exists automations_trigger_check;
alter table automations add constraint automations_trigger_check check (trigger in (
  'lead_created','lead_stage_changed','lead_no_response','meeting_scheduled',
  'proposal_created','proposal_sent','proposal_viewed','proposal_approved',
  'contract_signed','project_created','task_due_soon','task_overdue','task_assigned',
  'project_overdue','receivable_due_soon','receivable_overdue','payment_confirmed',
  'payment_overdue','ticket_created','ticket_no_response','customer_message',
  'scheduled_datetime','webhook_received','freelancer_project_finished','sale_won',
  'team_member_invited','member_added_to_project','project_member_added'
));
alter table tasks add column if not exists assignee_id uuid references users(id) on delete set null;
alter table tasks add column if not exists assigned_at timestamptz;
create index if not exists idx_tasks_org_assignee on tasks(organization_id, assignee_id, assigned_at desc);
