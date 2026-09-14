-- Add database-level protection for lead identities without deleting or rewriting
-- existing records. If legacy duplicates exist, the application guard remains
-- active and the index can be created after those records are reviewed.
do $$
begin
  if not exists (select 1 from leads where email is not null and trim(email) <> '' group by organization_id, lower(trim(email)) having count(*) > 1) then
    create unique index if not exists leads_org_email_identity_idx on leads (organization_id, lower(trim(email))) where email is not null and trim(email) <> '';
  end if;
  if not exists (select 1 from leads where phone is not null and trim(phone) <> '' group by organization_id, phone having count(*) > 1) then
    create unique index if not exists leads_org_phone_identity_idx on leads (organization_id, phone) where phone is not null and trim(phone) <> '';
  end if;
  if not exists (select 1 from clients where document is not null and trim(document) <> '' group by organization_id, document having count(*) > 1) then
    create unique index if not exists clients_org_document_identity_idx on clients (organization_id, document) where document is not null and trim(document) <> '';
  end if;
end $$;
