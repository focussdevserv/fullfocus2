-- Expand workflow vocabulary and persist commissions created by automations.
alter table automations drop constraint if exists automations_trigger_check;
alter table automations drop constraint if exists automations_action_check;
alter table automations add constraint automations_trigger_check check (trigger in (
  'lead_created','lead_stage_changed','lead_no_response','meeting_scheduled',
  'proposal_created','proposal_sent','proposal_viewed','proposal_approved',
  'contract_signed','project_created','task_due_soon','task_overdue',
  'project_overdue','receivable_due_soon','receivable_overdue','payment_confirmed',
  'payment_overdue','ticket_created','ticket_no_response','customer_message',
  'scheduled_datetime','webhook_received','freelancer_project_finished','sale_won'
));
alter table automations add constraint automations_action_check check (action in (
  'notify','create_task','send_message','send_email','create_followup',
  'create_charge','generate_contract','create_project','update_status',
  'move_pipeline','assign_owner','add_tag','webhook','n8n_flow','wait',
  'end','calculate_commission','reassign_support','create_calendar_event',
  'request_satisfaction','generate_document'
));

alter table templates drop constraint if exists templates_kind_check;
alter table templates add constraint templates_kind_check check (kind in (
  'proposal','contract','project','task','checklist','charge','followup',
  'support','ticket','briefing','delivery_term','report','notification',
  'email','message','whatsapp'
));

alter table integrations drop constraint if exists integrations_provider_check;
alter table integrations add constraint integrations_provider_check check (provider in (
  'whatsapp','email','smtp','google_calendar','google_drive','github','n8n',
  'mercado_pago','asaas','stripe','firebase','supabase','cnpj','esign',
  'webhook','api'
));

create table if not exists commissions (
  id bigserial primary key,
  organization_id uuid not null references organizations(id) on delete cascade,
  project_id bigint references projects(id) on delete set null,
  user_id uuid references users(id) on delete set null,
  responsible text,
  description text not null,
  base_amount numeric(14,2) not null default 0 check (base_amount >= 0),
  rate numeric(8,2) not null default 0 check (rate >= 0),
  amount numeric(14,2) not null default 0 check (amount >= 0),
  status text not null default 'pending' check (status in ('pending','approved','paid','cancelled')),
  source_automation_id bigint references automations(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_commissions_org_created on commissions(organization_id, created_at desc);
create unique index if not exists idx_commissions_automation_project on commissions(source_automation_id, project_id) where project_id is not null;
