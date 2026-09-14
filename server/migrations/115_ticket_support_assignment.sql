alter table tickets add column if not exists assignee_id uuid references users(id) on delete set null;
create index if not exists idx_tickets_org_assignee_status on tickets(organization_id, assignee_id, status);
