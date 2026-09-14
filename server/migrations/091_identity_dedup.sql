-- Normalize identity fields at the application boundary and prevent duplicates
-- within each workspace without changing existing nullable records.
create unique index if not exists contacts_org_email_identity_idx
  on contacts (organization_id, lower(trim(email))) where email is not null and trim(email) <> '';
create unique index if not exists contacts_org_phone_identity_idx
  on contacts (organization_id, phone) where phone is not null and trim(phone) <> '';
create unique index if not exists companies_org_document_identity_idx
  on companies (organization_id, document) where document is not null and trim(document) <> '';
create unique index if not exists companies_org_email_identity_idx
  on companies (organization_id, lower(trim(email))) where email is not null and trim(email) <> '';
create unique index if not exists companies_org_phone_identity_idx
  on companies (organization_id, phone) where phone is not null and trim(phone) <> '';
create unique index if not exists clients_org_email_identity_idx
  on clients (organization_id, lower(trim(email))) where email is not null and trim(email) <> '';
create unique index if not exists clients_org_phone_identity_idx
  on clients (organization_id, phone) where phone is not null and trim(phone) <> '';
