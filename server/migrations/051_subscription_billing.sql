alter table receivables add column if not exists subscription_id bigint references subscriptions(id) on delete set null;
alter table receivables add column if not exists billing_period date;
create unique index if not exists receivables_subscription_period_idx on receivables(subscription_id, billing_period) where subscription_id is not null and billing_period is not null;
