alter table leads add column if not exists converted_client_id bigint references clients(id) on delete set null;
create index if not exists idx_leads_org_converted_client on leads(organization_id, converted_client_id);
