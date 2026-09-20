alter table charges add column if not exists cancel_idempotency_key text;
alter table charges add column if not exists refund_idempotency_key text;
alter table charges add column if not exists refunded_amount numeric(14,2) not null default 0;
alter table charges add column if not exists refund_operations jsonb not null default '[]'::jsonb;
alter table payments add column if not exists refunded_amount numeric(14,2) not null default 0;
alter table revenues add column if not exists payment_id bigint references payments(id) on delete set null;
alter table revenues add column if not exists receivable_id bigint references receivables(id) on delete set null;
alter table revenues add column if not exists refunded_amount numeric(14,2) not null default 0;
alter table subscriptions add column if not exists create_idempotency_key text;
alter table subscriptions add column if not exists update_idempotency_key text;
alter table subscriptions add column if not exists cancel_idempotency_key text;

create unique index if not exists uq_charges_org_cancel_operation
  on charges(organization_id, cancel_idempotency_key)
  where cancel_idempotency_key is not null;
create unique index if not exists uq_charges_org_refund_operation
  on charges(organization_id, refund_idempotency_key)
  where refund_idempotency_key is not null;
create unique index if not exists uq_subscriptions_org_create_operation
  on subscriptions(organization_id, create_idempotency_key)
  where create_idempotency_key is not null;

alter table receivables drop constraint if exists receivables_status_check;
alter table receivables add constraint receivables_status_check
  check (status in ('pending','overdue','partially_paid','paid','partially_refunded','refunded','renegotiated','cancelled'));

create index if not exists idx_revenues_org_payment on revenues(organization_id, payment_id);
create index if not exists idx_revenues_org_receivable on revenues(organization_id, receivable_id);
