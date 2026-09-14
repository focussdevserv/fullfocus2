create unique index if not exists contracts_organization_proposal_unique
  on contracts (organization_id, proposal_id)
  where proposal_id is not null;
