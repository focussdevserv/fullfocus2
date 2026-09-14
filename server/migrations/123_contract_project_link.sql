create unique index if not exists idx_projects_org_contract_unique
  on projects(organization_id, contract_id)
  where contract_id is not null;
