alter table opportunities
  add column if not exists client_id bigint references clients(id) on delete set null;

create index if not exists opportunities_org_client_idx
  on opportunities(organization_id, client_id);
