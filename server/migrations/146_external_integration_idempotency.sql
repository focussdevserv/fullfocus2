alter table messages add column if not exists provider_message_id text;
create unique index if not exists uq_messages_org_provider_message_id on messages(organization_id, provider_message_id) where provider_message_id is not null;
create unique index if not exists uq_charges_org_idempotency_key on charges(organization_id, idempotency_key) where idempotency_key is not null;
