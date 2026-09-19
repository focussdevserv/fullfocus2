alter table charges add column if not exists provider_status text;
alter table charges add column if not exists provider_payload jsonb;
alter table charges add column if not exists idempotency_key text;
alter table payments add column if not exists provider_status text;
create unique index if not exists uq_charges_org_external_id on charges(organization_id, external_id) where external_id is not null;
create unique index if not exists uq_payments_org_external_id on payments(organization_id, external_id) where external_id is not null;

