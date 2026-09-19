alter table subscriptions add column if not exists provider text;
alter table subscriptions add column if not exists provider_id text;
alter table subscriptions add column if not exists provider_status text;
alter table subscriptions add column if not exists provider_url text;
alter table subscriptions add column if not exists provider_payload jsonb;
create unique index if not exists uq_subscriptions_org_provider_id on subscriptions(organization_id, provider_id) where provider_id is not null;
