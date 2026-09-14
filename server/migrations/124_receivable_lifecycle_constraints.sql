alter table receivables drop constraint if exists receivables_status_check;
alter table receivables add constraint receivables_status_check
  check (status in ('pending','overdue','partially_paid','paid','renegotiated','cancelled'));
create unique index if not exists receivables_contract_installment_unique
  on receivables (organization_id, contract_id, installment_number)
  where contract_id is not null and installment_number is not null;
