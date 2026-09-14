create table if not exists delivery_publication_history (
  id bigserial primary key,
  organization_id uuid not null references organizations(id) on delete cascade,
  delivery_id bigint not null references deliveries(id) on delete cascade,
  version text not null,
  environment text,
  published_url text,
  status text not null,
  published_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_delivery_publication_history_delivery on delivery_publication_history(organization_id, delivery_id, created_at desc);
